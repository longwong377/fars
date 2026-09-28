// Post-step of the Cycles-rendered people impostors (D-331; tools/blender/impostors.mjs): the per-dress cells rendered by
// tools/blender/people_impostors.py (premultiplied by coverage) packed into the game's atlas layout (impostors.ts: rows =
// dress x frame in `cols` columns of blocks, 8 views a row), un-premultiplied, the coverage-preserving mips of the CPU bake
// (impostors.ts mips), three level stacks as PNG, then KTX2 (UASTC + zstd, the mips given, not generated):
//   A (main, second, trim, coverage)   B (skin, hair, leather/felt, ambient occlusion)   N (normal right/up/toward * 0.5 + 0.5, depth)
// The fixed colour's weight is 1 - the six others (the weights of a covered texel sum to 1).
//   npx tsx tools/blender/sources/people_imp_post.ts <src dir> <render dir> <work dir> <game dir>
import { readFileSync, writeFileSync, mkdirSync, existsSync, copyFileSync, statSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { createRequire } from 'node:module';
import { mips, IMP, IMP_DRESSES, FRAMES } from '../../../src/people/impostors';

const [SRC, REN, WORK, GAME] = process.argv.slice(2);
const KTX = process.env.KTX ?? ['C:/Program Files/KTX-Software/bin/ktx.exe', '/usr/local/bin/ktx'].find(p => existsSync(p)) ?? 'ktx';
const sharp = createRequire(import.meta.url)('sharp');
mkdirSync(WORK, { recursive: true }); mkdirSync(GAME, { recursive: true });
const meta = JSON.parse(readFileSync(`${SRC}/meta.json`, 'utf8')), rstats = JSON.parse(readFileSync(`${REN}/render_stats.json`, 'utf8'));
if (JSON.stringify(meta.frames) !== JSON.stringify(FRAMES.map(f => f.id))) throw new Error('the source frames are not impostors.ts FRAMES: rebuild the source step');
const half = (h: number) => { const s = h >> 15, e = (h >> 10) & 31, f = h & 1023; const v = e === 0 ? f / 1024 * 2 ** -14 : e === 31 ? (f ? NaN : Infinity) : (1 + f / 1024) * 2 ** (e - 15); return s ? -v : v; };
function readF16(path: string) {
  const b = readFileSync(path), hl = b.readUInt16LE(8), header = b.toString('latin1', 10, 10 + hl);
  if (!/'descr':\s*'<f2'/.test(header)) throw new Error(`${path}: not float16`);
  const shape = /'shape':\s*\(([^)]*)\)/.exec(header)![1].split(',').map(s => s.trim()).filter(Boolean).map(Number);
  const u = new Uint16Array(b.buffer.slice(b.byteOffset + 10 + hl, b.byteOffset + b.length)), f = new Float32Array(u.length); for (let i = 0; i < u.length; i++) f[i] = half(u[i]);
  return { shape, data: f };
}
const C = rstats.cell as number, V = IMP.views, COLS = 8, F = FRAMES.length, ROWS = IMP_DRESSES.length * F, RPC = Math.ceil(ROWS / COLS);
const W = COLS * V * C, H = RPC * C;
const cellAt = (row: number, view: number): [number, number] => [(Math.floor(row / RPC) * V + view) * C, (row % RPC) * C];
const A = new Float32Array(W * H * 4), B = new Float32Array(W * H * 4), N = new Float32Array(W * H * 4);
for (let k = 0; k < W * H; k++) { B[k * 4 + 3] = 1; N[k * 4] = 0.5; N[k * 4 + 1] = 0.5; N[k * 4 + 2] = 1; N[k * 4 + 3] = 0.5; }
const t0 = Date.now();
IMP_DRESSES.forEach((dress, di) => {
  const path = `${REN}/${dress}.npy`; if (!existsSync(path)) { console.warn(`[people_imp_post] ${dress}: not rendered (its rows stay empty)`); return; }
  const { shape, data } = readF16(path); if (shape[0] !== F || shape[1] !== V || shape[2] !== C || shape[4] !== 16) throw new Error(`${dress}: shape ${shape}`);
  for (let f = 0; f < F; f++) for (let v = 0; v < V; v++) { const [ox, oy] = cellAt(di * F + f, v);
    for (let j = 0; j < C; j++) for (let i = 0; i < C; i++) { const s = ((((f * V + v) * C + j) * C) + i) * 16, a = Math.min(1, data[s + 3]), o = ((oy + j) * W + ox + i) * 4;
      if (a < 1 / 512) continue;
      const w = [data[s], data[s + 1], data[s + 2], data[s + 4], data[s + 5], data[s + 6]].map(x => Math.max(0, x / a)), sum = w.reduce((p, x) => p + x, 0);
      if (sum > 1) for (let q = 0; q < 6; q++) w[q] /= sum;
      A[o] = w[0]; A[o + 1] = w[1]; A[o + 2] = w[2]; A[o + 3] = a; B[o] = w[3]; B[o + 1] = w[4]; B[o + 2] = w[5]; B[o + 3] = Math.min(1, Math.max(0, data[s + 12] / a));
      let nx = data[s + 8] / a * 2 - 1, ny = data[s + 9] / a * 2 - 1, nz = data[s + 10] / a * 2 - 1; const l = Math.hypot(nx, ny, nz) || 1; nx /= l; ny /= l; nz /= l;
      N[o] = nx * 0.5 + 0.5; N[o + 1] = ny * 0.5 + 0.5; N[o + 2] = nz * 0.5 + 0.5; N[o + 3] = Math.min(1, Math.max(0, data[s + 13] / a)); } }
});
const PC = W / C, cov = new Float32Array(PC * RPC);
for (let j = 0; j < H; j++) for (let i = 0; i < W; i++) if (A[(j * W + i) * 4 + 3] >= 0.5) cov[Math.floor(j / C) * PC + Math.floor(i / C)]++;
for (let k = 0; k < cov.length; k++) cov[k] /= C * C;
const L = mips(A, B, N, W, H, cov, C);
console.log(`[people_imp_post] packed ${W} x ${H}, ${L.A.length} levels in ${((Date.now() - t0) / 1000).toFixed(1)} s`);
const files: Record<string, string[]> = { A: [], B: [], N: [] };
for (const k of ['A', 'B', 'N'] as const) for (let l = 0; l < L[k].length; l++) { const lv = L[k][l], p = `${WORK}/imp_${k}_${l}.png`;
  await sharp(Buffer.from(lv.data.buffer, lv.data.byteOffset, lv.data.byteLength), { raw: { width: lv.width, height: lv.height, channels: 4 } }).png({ compressionLevel: 6 }).toFile(p); files[k].push(p); }
const enc = ['--encode', 'uastc', '--uastc-quality', '2', '--uastc-rdo', '--uastc-rdo-l', process.env.RDO ?? '0.5', '--zstd', '18'];
const out: Record<string, { file: string; sha256: string; bytes: number }> = {};
for (const k of ['A', 'B', 'N'] as const) {
  const file = `people_imp_${k.toLowerCase()}.ktx2`, tmp = `${WORK}/${file}`;
  const r = spawnSync(KTX, ['create', '--format', 'R8G8B8A8_UNORM', '--assign-tf', 'linear', '--levels', String(files[k].length), ...enc, ...files[k], tmp], { stdio: 'inherit' });
  if (r.status !== 0) throw new Error(`ktx create ${k}: ${r.status}`);
  copyFileSync(tmp, `${GAME}/${file}`); const bytes = readFileSync(tmp); out[k] = { file, sha256: createHash('sha256').update(bytes).digest('hex'), bytes: bytes.length };
}
const cover = new Float32Array(ROWS * V); for (let r = 0; r < ROWS; r++) for (let v = 0; v < V; v++) { const [x, y] = cellAt(r, v); cover[r * V + v] = cov[(y / C) * PC + x / C]; }
const index = {
  about: 'The far people\'s impostor atlas rendered in Cycles (D-331): built by tools/blender/impostors.mjs (sources/people_imp_src.ts, people_impostors.py, sources/people_imp_post.ts); read by src/people/impostors.ts loadImpostorAtlas; tests/impostor_assets.test.ts. Do not edit.',
  version: 1, cell: C, cols: COLS, views: V, rows: ROWS, rpc: RPC, W, H, levels: L.A.length, width: IMP.width, height: IMP.height, y0: IMP.y0,
  channels: { A: 'main, second, trim weights, coverage', B: 'skin, hair, leather/felt weights, ambient occlusion', N: 'normal (right, up, toward the viewer) * 0.5 + 0.5, depth toward the viewer (0.5 + d / 1.6 m)' },
  frames: FRAMES.map(f => f.id), dresses: IMP_DRESSES, files: out,
  gpuBytes: Math.round(3 * W * H * 4 / 3), // (BC7 / ASTC 4x4: 1 byte a texel, the mips a third more)
  source: meta.dresses.map((d: any) => ({ dress: d.dress, variant: d.variant, verts: d.verts, tris: d.tris, cardTris: d.cards, hairStyle: d.hairStyle, pieces: d.pieces })),
  render: { spp: rstats.spp, device: rstats.device, pxPerMetre: rstats.px_per_m, blender: rstats.blender, seconds: rstats.seconds },
  coverage: Array.from(cover, x => Math.round(x * 1000) / 1000),
};
writeFileSync(`${GAME}/people_impostors.json`, JSON.stringify(index, null, 1) + '\n');
// a contact sheet for the eye: each dress's frames x views shaded with a fixed palette under one light (not shipped)
{ const PAL = [[0.6, 0.12, 0.1], [0.15, 0.25, 0.55], [0.85, 0.7, 0.2], [0.62, 0.42, 0.3], [0.05, 0.04, 0.03], [0.35, 0.22, 0.12], [0.25, 0.16, 0.1]];
  const ld = [-0.45, 0.6, 0.66], l = Math.hypot(...ld), Ld = ld.map(x => x / l), img = new Uint8Array(W * H * 3);
  for (let k = 0; k < W * H; k++) { const a = A[k * 4 + 3], y = Math.floor(k / W), x = k % W, o = ((H - 1 - y) * W + x) * 3;
    if (a < 0.5) { img[o] = img[o + 1] = img[o + 2] = 200; continue; }
    const w = [A[k * 4], A[k * 4 + 1], A[k * 4 + 2], B[k * 4], B[k * 4 + 1], B[k * 4 + 2]], wf = Math.max(0, 1 - w.reduce((p, q) => p + q, 0)); w.push(wf);
    const n = [N[k * 4] * 2 - 1, N[k * 4 + 1] * 2 - 1, N[k * 4 + 2] * 2 - 1], sh = (Math.max(0, n[0] * Ld[0] + n[1] * Ld[1] + n[2] * Ld[2]) * 0.8 + 0.25) * (0.55 + 0.45 * B[k * 4 + 3]);
    for (let c = 0; c < 3; c++) { let s = 0; for (let q = 0; q < 7; q++) s += w[q] * PAL[q][c]; img[o + c] = Math.min(255, Math.round(Math.sqrt(s * sh) * 255)); } }
  await sharp(Buffer.from(img.buffer), { raw: { width: W, height: H, channels: 3 } }).png().toFile(`${WORK}/contact.png`); }
console.log(`[people_imp_post] ${Object.values(out).map(o => `${o.file} ${(o.bytes / 1e6).toFixed(2)} MB`).join(', ')}`);
