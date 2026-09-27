// Post-step of the people's hair (D-307): the strand atlas's mip chain, coverage-preserving (after Castaño, "Computing
// alpha mipmaps", 2010: the trees' method, src/world/trees/atlas.ts mipChain). The first render judged the cards' edges as
// speckled noise: the strands are finer than a pixel at conversation distance, a box-filtered mip turns a card into a grey
// 30 %-coverage film, and the per-pixel hashed alpha test then dithered it. Here each level is box-filtered (colour and data
// weighted by coverage, so no dark halo) and each card cell's alpha is then scaled so that the share of its texels passing
// the material's fixed test (CARD.thr = 0.5) equals the cell's coverage at full size: a card keeps its density at every
// distance and resolves into clumps, not noise. Writes out/people_hair_atlas.mip<k>.png (k = 0..) and
// out/people_hair_atlas.levels.json (the files, for `ktx create --levels`).
// Usage: npx tsx tools/blender/sources/people_hair_post.ts <srcDir> <outDir> <argsJson>
import { readFileSync, writeFileSync } from 'node:fs';
import { decodePNG, encodePNG } from '../../humans/png';

const [, outDir, argJson] = process.argv.slice(2);
const ARGS = JSON.parse(readFileSync(argJson, 'utf8'));
const THR = ARGS.atlas.alphaTest ?? 0.5, COLS = ARGS.atlas.cols, ROWS = ARGS.atlas.rows.length;
const im = decodePNG(readFileSync(`${outDir}/people_hair_atlas.png`));
let W = im.width, H = im.height; let cur = new Float32Array(W * H * 4); for (let i = 0; i < cur.length; i++) cur[i] = im.data[i] / 255;
const cw0 = W / COLS, ch0 = H / ROWS;
// each cell's coverage at full size (the mean alpha)
const cov0 = new Float32Array(COLS * ROWS);
for (let r = 0; r < ROWS; r++) for (let c = 0; c < COLS; c++) { let s = 0; for (let y = r * ch0; y < (r + 1) * ch0; y++) for (let x = c * cw0; x < (c + 1) * cw0; x++) s += cur[(y * W + x) * 4 + 3]; cov0[r * COLS + c] = s / (cw0 * ch0); }
const levels: string[] = []; const stats: any[] = [];
const save = (k: number, buf: Float32Array, w: number, h: number) => { const o = new Uint8Array(w * h * 4); for (let i = 0; i < o.length; i++) o[i] = Math.max(0, Math.min(255, Math.round(buf[i] * 255)));
  const f = `people_hair_atlas.mip${k}.png`; writeFileSync(`${outDir}/${f}`, encodePNG(w, h, o)); levels.push(f); };
save(0, cur, W, H);
for (let k = 1; W > 1 || H > 1; k++) {
  const w = Math.max(1, W >> 1), h = Math.max(1, H >> 1), nx = new Float32Array(w * h * 4);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) { let a = 0; const rgb = [0, 0, 0];
    for (let dy = 0; dy < 2; dy++) for (let dx = 0; dx < 2; dx++) { const sx = Math.min(W - 1, x * 2 + dx), sy = Math.min(H - 1, y * 2 + dy), i = (sy * W + sx) * 4, al = cur[i + 3]; a += al; for (let e = 0; e < 3; e++) rgb[e] += cur[i + e] * al; }
    const o = (y * w + x) * 4; for (let e = 0; e < 3; e++) nx[o + e] = a > 1e-6 ? rgb[e] / a : 0.5; nx[o + 3] = a / 4; }
  // keep the coverage per cell: scale alpha so the share of texels >= THR equals the cell's full-size coverage
  const cw = w / COLS, ch = h / ROWS, out = nx.slice();
  if (cw >= 1 && ch >= 1) for (let r = 0; r < ROWS; r++) for (let c = 0; c < COLS; c++) {
    const target = cov0[r * COLS + c], idx: number[] = []; for (let y = Math.floor(r * ch); y < Math.floor((r + 1) * ch); y++) for (let x = Math.floor(c * cw); x < Math.floor((c + 1) * cw); x++) idx.push((y * w + x) * 4 + 3);
    const pass = (s: number) => idx.reduce((n, i) => n + (nx[i] * s >= THR ? 1 : 0), 0) / idx.length;
    let lo = 0, hi = 64; for (let it = 0; it < 24; it++) { const m = (lo + hi) / 2; if (pass(m) < target) lo = m; else hi = m; }
    const s = (lo + hi) / 2; for (const i of idx) out[i] = Math.min(1, nx[i] * s);
    if (k <= 5 && c === 0) stats.push({ level: k, row: r, cov0: +target.toFixed(3), scale: +s.toFixed(2), passing: +pass(s).toFixed(3) });
  }
  cur = nx; W = w; H = h; // (the next level filters the plain box-filtered level: the scale is not compounded)
  save(k, out, w, h);
}
writeFileSync(`${outDir}/people_hair_atlas.levels.json`, JSON.stringify({ levels, alphaTest: THR, coverage: Array.from(cov0, x => +x.toFixed(3)), stats }, null, 1));
console.log('[people_hair_post]', levels.length, 'levels; coverage per cell', Array.from(cov0, x => x.toFixed(2)).join(' '));
