// D-752: the carved-relief atlas's PAINT layer rebuilt alone (the paint of src/arch/relief_figures.ts changed, the carving not).
//   npx tsx tools/blender/relief_paint.ts [--check]
// tools/blender/relief_atlas.ts builds both maps and needs Cycles for the normals and the occlusion (hours on a CPU); when only
// the colours change, the heightfields, the layout and nao.ktx2 stay valid. This recomputes each definition's paint on the
// same grid (the same rasterisation, extent and margin as relief_atlas.ts prepare), checks that every rectangle has the size
// and origin the index holds (a carving change fails here: rebuild the whole atlas), writes the pages, encodes each layer as
// UASTC with mips (npm ktx2-encoder, no supercompression), joins the layers per level into one array KTX2 with zstd
// (ktx-parse, node's zlib), as ktx.exe's output (UASTC, sRGB, zstd, the layers in one file), and updates the index's paint
// hash and bytes and its inputs hash. --check: compare only.
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { zstdCompressSync, constants } from 'node:zlib';
import { figureDef } from '../../src/arch/relief_figures';
import { rasterize, fieldCoverage, figureBounds, BG, STONE_SRGB } from '../../src/arch/relief_field';
import { atlasCell, type AtlasIndex } from '../../src/arch/relief_atlas';
import { reliefAtlasInputs } from './lib/relief_inputs';
import { census, bakeFrame } from './lib/relief_census';

const CHECK = process.argv.includes('--check');
const IDX = JSON.parse(readFileSync('src/data/relief_atlas.json', 'utf8')) as AtlasIndex & Record<string, any>;
const PAGE = IDX.size, OUT = 'public/models/reliefs';
// relief_atlas.ts's constants (importing it runs the build): the texel and the grid cap from the index, the margin as there
const TEXEL_M: number = IDX.texel_m, MAX_TEXELS: number = IDX.maxTexels, MARGIN = 12;
const u8 = (c: number) => Math.max(0, Math.min(255, Math.floor(c * 255 + 0.5)));
const log = (...a: unknown[]) => console.log('[relief_paint]', ...a);

const uses = await census();
const pages = Array.from({ length: IDX.layers }, () => { const p = new Uint8Array(PAGE * PAGE * 4); const S0 = STONE_SRGB.map(u8);
  for (let k = 0; k < PAGE * PAGE; k++) { p[k * 4] = S0[0]; p[k * 4 + 1] = S0[1]; p[k * 4 + 2] = S0[2]; p[k * 4 + 3] = 0; } return p; });
let bad = 0, n0 = 0;
for (const [key, e] of Object.entries(IDX.defs)) {
  const u = uses.get(key); if (!u) { log('not in the census:', key); bad++; continue; }
  // relief_atlas.ts prepare(): the same grid
  const { sMax, coarse } = bakeFrame(u), def = figureDef(u.kind, u.seed), b = figureBounds(def);
  const E = Math.max(b[2] - b[0], b[3] - b[1]), cellT = atlasCell(TEXEL_M, MAX_TEXELS, sMax, E, coarse);
  const n = Math.min(MAX_TEXELS + 1, Math.ceil(E / cellT) + 1), f = rasterize(def, n, false), cell = f.cell;
  let i0 = n, i1 = -1, j0 = n, j1 = -1;
  for (let j = 0; j < n; j++) for (let i = 0; i < n; i++) { const g = j * n + i; if (f.h[g] > 0 || f.col[g] !== BG) { if (i < i0) i0 = i; if (i > i1) i1 = i; if (j < j0) j0 = j; if (j > j1) j1 = j; } }
  i0 = Math.max(0, i0 - MARGIN); j0 = Math.max(0, j0 - MARGIN); i1 = Math.min(n - 1, i1 + MARGIN); j1 = Math.min(n - 1, j1 + MARGIN);
  const nx = i1 - i0 + 1, ny = j1 - j0 + 1, fig = [f.x0 + i0 * cell, f.y0 + j0 * cell];
  if (nx !== e.px[2] || ny !== e.px[3] || Math.abs(fig[0] - e.fig[0]) > 1e-5 || Math.abs(fig[1] - e.fig[1]) > 1e-5 || Math.abs(cell - e.cell) / e.cell > 1e-6) {
    log(`carving changed: ${key} ${nx}x${ny} vs ${e.px[2]}x${e.px[3]}`); bad++; continue; }
  const cov = fieldCoverage(f), P = pages[e.layer];
  for (let j = 0; j < ny; j++) for (let i = 0; i < nx; i++) {
    const g = (j + j0) * n + i + i0, ci = f.col[g], c = ci === BG ? STONE_SRGB : f.palette[ci], d = ((e.px[1] + j) * PAGE + e.px[0] + i) * 4;
    P[d] = u8(c[0]); P[d + 1] = u8(c[1]); P[d + 2] = u8(c[2]); P[d + 3] = ci === BG ? 0 : u8(cov[g]);
  }
  n0++;
}
log(`${n0} definitions repainted, ${bad} refused`);
if (bad) { log('the carving changed: rebuild the whole atlas (tools/blender/relief_atlas.ts)'); process.exit(1); }
if (CHECK) process.exit(0);

// encode: each layer UASTC + mips (no supercompression), then one array file, the layers joined per level, zstd
const { encodeToKTX2 } = await import('ktx2-encoder');
const { read, write } = await import('ktx-parse');
const sharp = (await import('sharp')).default;
const WORK = process.env.RELIEF_WORK ?? '/tmp/relief_paint'; mkdirSync(WORK, { recursive: true });
// (the encoder takes at most ~12 Mpix per image: each level is encoded alone from a box-filtered chain built here, and the
// 4096² top level in four 2048² quadrants whose UASTC blocks (16 bytes per 4x4 texels, independent) are spliced row by row)
const decode = async (buf: Uint8Array) => { const { data, info } = await sharp(buf).ensureAlpha().raw().toBuffer({ resolveWithObject: true }); return { data: new Uint8Array(data), width: info.width, height: info.height }; };
const encodeRaw = async (rgba: Uint8Array, w: number, h: number): Promise<Uint8Array> => {
  const png = await sharp(Buffer.from(rgba), { raw: { width: w, height: h, channels: 4 } }).png().toBuffer();
  const k2 = await encodeToKTX2(new Uint8Array(png), { isUASTC: true, uastcLDRQualityLevel: 2, needSupercompression: false, generateMipmap: false, isSetKTX2SRGBTransferFunc: true, isKTX2File: true, imageDecoder: decode } as any);
  return read(k2).levels[0].levelData;
};
const half = (src: Uint8Array, w: number, h: number) => { const W = Math.max(1, w >> 1), H = Math.max(1, h >> 1), out = new Uint8Array(W * H * 4);
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) for (let c = 0; c < 4; c++) {
    const x0 = Math.min(w - 1, 2 * x), x1 = Math.min(w - 1, 2 * x + 1), y0 = Math.min(h - 1, 2 * y), y1 = Math.min(h - 1, 2 * y + 1);
    out[(y * W + x) * 4 + c] = (src[(y0 * w + x0) * 4 + c] + src[(y0 * w + x1) * 4 + c] + src[(y1 * w + x0) * 4 + c] + src[(y1 * w + x1) * 4 + c] + 2) >> 2; }
  return { img: out, w: W, h: H }; };
const LIMIT = 12_000_000;
const encodeLevel = async (img: Uint8Array, w: number, h: number): Promise<Uint8Array> => {
  if (w * h <= LIMIT) return encodeRaw(img, w, h);
  const qw = w / 2, qh = h / 2, bx = w / 4, qbx = qw / 4, qby = qh / 4, out = new Uint8Array(bx * (h / 4) * 16);
  for (const [ox, oy] of [[0, 0], [1, 0], [0, 1], [1, 1]]) {
    const q = new Uint8Array(qw * qh * 4);
    for (let y = 0; y < qh; y++) q.set(img.subarray(((oy * qh + y) * w + ox * qw) * 4, ((oy * qh + y) * w + ox * qw + qw) * 4), y * qw * 4);
    const blocks = await encodeRaw(q, qw, qh);
    for (let by = 0; by < qby; by++) out.set(blocks.subarray(by * qbx * 16, (by + 1) * qbx * 16), ((oy * qby + by) * bx + ox * qbx) * 16);
  }
  return out;
};
const NLEV = Math.floor(Math.log2(PAGE)) + 1, levels: Uint8Array[][] = Array.from({ length: NLEV }, () => []);
for (let L = 0; L < pages.length; L++) {
  let img = pages[L], w = PAGE, h = PAGE;
  for (let k = 0; k < NLEV; k++) { levels[k].push(await encodeLevel(img, w, h)); if (k < NLEV - 1) ({ img, w, h } = half(img, w, h)); }
  log(`layer ${L} encoded (${NLEV} levels)`);
}
// the container: the shipped file's own (its format, DFD, size and layer count), new level data
const C = read(new Uint8Array(readFileSync(`${OUT}/paint.ktx2`)));
if (C.pixelWidth !== PAGE || C.layerCount !== pages.length || C.levels.length !== NLEV) throw new Error('the shipped paint.ktx2 is not the index\'s shape');
C.supercompressionScheme = 2;
C.levels = levels.map(ls => { const raw = Buffer.concat(ls.map(b => Buffer.from(b)));
  return { levelData: new Uint8Array(zstdCompressSync(raw, { params: { [constants.ZSTD_c_compressionLevel]: 18 } })), uncompressedByteLength: raw.length }; });

C.keyValue = { ...C.keyValue, KTXwriter: 'fars tools/blender/relief_paint.ts (ktx2-encoder UASTC + ktx-parse, zstd 18)' };
const file = write(C);
writeFileSync(`${OUT}/paint.ktx2`, file);
const sha = (b: Uint8Array) => createHash('sha256').update(b).digest('hex');
IDX.sha.paint = sha(file); IDX.bytes.paint = file.length;
IDX.inHash = reliefAtlasInputs([...uses.values()].map(u => ({ key: u.key, ...bakeFrame(u) }))).hash;
IDX.paintRebuilt = 'D-752: the paint layer rebuilt alone by tools/blender/relief_paint.ts (the carving unchanged: nao.ktx2 as baked)';
writeFileSync('src/data/relief_atlas.json', JSON.stringify(IDX, null, 1) + '\n');
log(`paint.ktx2 ${(file.length / 1e6).toFixed(1)} MB, ${pages.length} layers, index updated`);
