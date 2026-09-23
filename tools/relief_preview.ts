// Raking-light preview of the carved relief figures (D-019), rendered in node from the heightfield (or from a LOD mesh)
// without a browser: Lambert + heightfield shadows from a low sun, painted albedo. For judging the modelling quickly;
// screenshots find problems, they never prove correctness (brief §3.4).
//   npx tsx tools/relief_preview.ts [kind[:seed] …] [--n 513] [--lod 0..3] [--sun az,alt] [--out shots/relief_kinds] [--sheet]
import { writeFileSync, mkdirSync } from 'node:fs';
import { deflateSync } from 'node:zlib';
import { FIGURE_KINDS, figureDef } from '../src/arch/relief_figures';
import { rasterize, rtinErrors, extractLod, Field, LodMesh } from '../src/arch/relief_field';
import { LOD_ERRORS } from '../src/arch/relief_field';

const args = process.argv.slice(2);
const opt = (k: string, d: string) => { const i = args.indexOf(k); return i >= 0 ? args.splice(i, 2)[1] : d; };
const flag = (k: string) => { const i = args.indexOf(k); if (i >= 0) { args.splice(i, 1); return true; } return false; };
const N = +opt('--n', '513'), LOD = +opt('--lod', '-1'), OUT = opt('--out', 'shots/relief_kinds'), [SAZ, SALT] = opt('--sun', '150,22').split(',').map(Number);
const DEPTH = +opt('--depth', '0.045'), H = +opt('--height', '0.78'), PX = +opt('--px', '420'), SHEET = flag('--sheet');
const kinds = args.length ? args : Object.keys(FIGURE_KINDS);
mkdirSync(OUT, { recursive: true });

function png(w: number, h: number, rgb: Uint8Array): Buffer {
  const crcT = new Uint32Array(256).map((_, n) => { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; return c >>> 0; });
  const crc = (b: Buffer) => { let c = 0xffffffff; for (const x of b) c = crcT[(c ^ x) & 255] ^ (c >>> 8); return (c ^ 0xffffffff) >>> 0; };
  const chunk = (t: string, d: Buffer) => { const l = Buffer.alloc(4); l.writeUInt32BE(d.length); const td = Buffer.concat([Buffer.from(t), d]); const c = Buffer.alloc(4); c.writeUInt32BE(crc(td)); return Buffer.concat([l, td, c]); };
  const raw = Buffer.alloc((w * 3 + 1) * h); for (let y = 0; y < h; y++) { raw[y * (w * 3 + 1)] = 0; rgb.subarray(y * w * 3, (y + 1) * w * 3).forEach((v, i) => { raw[y * (w * 3 + 1) + 1 + i] = v; }); }
  const ihdr = Buffer.alloc(13); ihdr.writeUInt32BE(w, 0); ihdr.writeUInt32BE(h, 4); ihdr[8] = 8; ihdr[9] = 2;
  return Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', ihdr), chunk('IDAT', deflateSync(raw)), chunk('IEND', Buffer.alloc(0))]);
}

/** metres-scaled height map from a field, or from a LOD mesh rasterised back onto the grid (barycentric) */
function heights(f: Field, lod: LodMesh | null) {
  const n = f.n, hm = new Float32Array(n * n), nm = lod ? new Float32Array(n * n * 3) : null, cm = lod ? new Float32Array(n * n * 3).fill(-1) : null;
  if (!lod) { for (let i = 0; i < n * n; i++) hm[i] = f.h[i] * DEPTH; return { hm, nm, cm }; }
  const P = lod.pos, G = lod.grad, C = lod.col, gi = (x: number) => (x - f.x0) / f.cell, gj = (y: number) => (y - f.y0) / f.cell;
  for (let t = 0; t < lod.index.length; t += 3) {
    const [a, b, c] = [lod.index[t], lod.index[t + 1], lod.index[t + 2]];
    const ax = gi(P[a * 3]), ay = gj(P[a * 3 + 1]), bx = gi(P[b * 3]), by = gj(P[b * 3 + 1]), cx = gi(P[c * 3]), cy = gj(P[c * 3 + 1]);
    const den = (by - cy) * (ax - cx) + (cx - bx) * (ay - cy); if (Math.abs(den) < 1e-9) continue;
    for (let j = Math.floor(Math.min(ay, by, cy)); j <= Math.ceil(Math.max(ay, by, cy)); j++) for (let i = Math.floor(Math.min(ax, bx, cx)); i <= Math.ceil(Math.max(ax, bx, cx)); i++) {
      const w1 = ((by - cy) * (i - cx) + (cx - bx) * (j - cy)) / den, w2 = ((cy - ay) * (i - cx) + (ax - cx) * (j - cy)) / den, w3 = 1 - w1 - w2;
      if (w1 < -1e-6 || w2 < -1e-6 || w3 < -1e-6 || i < 0 || j < 0 || i >= n || j >= n) continue;
      const g = j * n + i; hm[g] = (w1 * P[a * 3 + 2] + w2 * P[b * 3 + 2] + w3 * P[c * 3 + 2]) * DEPTH;
      const gx = w1 * G[a * 2] + w2 * G[b * 2] + w3 * G[c * 2], gy = w1 * G[a * 2 + 1] + w2 * G[b * 2 + 1] + w3 * G[c * 2 + 1];
      nm![g * 3] = -gx * DEPTH / H; nm![g * 3 + 1] = -gy * DEPTH / H; nm![g * 3 + 2] = 1;
      for (let k = 0; k < 3; k++) cm![g * 3 + k] = w1 * C[a * 3 + k] + w2 * C[b * 3 + k] + w3 * C[c * 3 + k];
    }
  }
  return { hm, nm, cm };
}

function render(kind: string, seed: number, lodLevel: number) {
  const def = figureDef(kind, seed); const t0 = performance.now();
  const f = rasterize(def, N); const t1 = performance.now();
  const err = rtinErrors(f); const t2 = performance.now();
  const lod = lodLevel >= 0 ? extractLod(f, err, LOD_ERRORS[lodLevel], [1, 2, 3, 5][lodLevel]) : null;
  const lods = LOD_ERRORS.map((e, i) => extractLod(f, err, e, [1, 2, 3, 5][i]).tris);
  const n = f.n, cellM = f.cell * H, { hm, nm, cm } = heights(f, lod);
  // image: crop to the figure bounds
  const W = PX, Hh = PX, rgb = new Uint8Array(W * Hh * 3);
  const az = (SAZ * Math.PI) / 180, alt = (SALT * Math.PI) / 180, L = [Math.cos(alt) * Math.cos(az), Math.cos(alt) * Math.sin(az), Math.sin(alt)];
  const lin2s = (c: number) => Math.round(255 * Math.min(1, c <= 0.0031308 ? c * 12.92 : 1.055 * Math.pow(c, 1 / 2.4) - 0.055));
  const s2l = (c: number) => (c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4));
  const bg = [0.44, 0.43, 0.4].map(s2l);
  for (let py = 0; py < Hh; py++) for (let px = 0; px < W; px++) {
    const i = Math.min(n - 1, Math.floor((px / W) * n)), j = Math.min(n - 1, Math.floor(((Hh - 1 - py) / Hh) * n)), g = j * n + i;
    let nx: number, ny: number, nz: number;
    if (nm && hm[g] > 0) { nx = nm[g * 3]; ny = nm[g * 3 + 1]; nz = 1; }
    else { const il = Math.max(0, i - 1), ir = Math.min(n - 1, i + 1), jd = Math.max(0, j - 1), ju = Math.min(n - 1, j + 1);
      nx = -(hm[j * n + ir] - hm[j * n + il]) / ((ir - il) * cellM); ny = -(hm[ju * n + i] - hm[jd * n + i]) / ((ju - jd) * cellM); nz = 1; }
    const nl = Math.hypot(nx, ny, nz); nx /= nl; ny /= nl; nz /= nl;
    // heightfield shadow: march toward the sun
    let lit = 1; const stepC = 1, dz = (L[2] / Math.hypot(L[0], L[1])) * cellM * stepC;
    let x = i, y = j, z = hm[g] + 0.0002;
    for (let s = 0; s < 400; s++) { x += L[0] / Math.hypot(L[0], L[1]) * stepC; y += L[1] / Math.hypot(L[0], L[1]) * stepC; z += dz;
      if (x < 0 || y < 0 || x >= n - 1 || y >= n - 1 || z > DEPTH * 1.05) break; if (hm[Math.round(y) * n + Math.round(x)] > z) { lit = 0; break; } }
    const ndl = Math.max(0, nx * L[0] + ny * L[1] + nz * L[2]);
    const alb = cm && cm[g * 3] >= 0 ? [cm[g * 3], cm[g * 3 + 1], cm[g * 3 + 2]] : (f.col[g] ? f.palette[f.col[g]].map(s2l) : bg);
    const sky = 0.25 * (0.5 + 0.5 * nz);
    for (let k = 0; k < 3; k++) rgb[(py * W + px) * 3 + k] = lin2s(alb[k] * (2.6 * ndl * lit + sky));
  }
  const name = `${OUT}/${kind}_${seed}${lod ? '_lod' + lodLevel : ''}.png`;
  writeFileSync(name, png(W, Hh, rgb));
  console.log(`${name}  field ${(t1 - t0).toFixed(1)} ms, rtin ${(t2 - t1).toFixed(1)} ms, tris L0..L3 ${lods.join(' / ')}${lod ? ` (shown L${lodLevel}: ${lod.tris})` : ''}`);
  return { rgb, W, Hh };
}

const tiles: { rgb: Uint8Array; W: number; Hh: number }[] = [];
for (const k of kinds) { const [kind, s] = k.split(':'); if (!FIGURE_KINDS[kind]) { console.error('unknown kind ' + kind); continue; } tiles.push(render(kind, +(s ?? 1), LOD)); }
if (SHEET && tiles.length > 1) { // contact sheet
  const cols = Math.min(6, tiles.length), rows = Math.ceil(tiles.length / cols), W = PX * cols, Hh = PX * rows, rgb = new Uint8Array(W * Hh * 3);
  tiles.forEach((t, k) => { const ox = (k % cols) * PX, oy = Math.floor(k / cols) * PX; for (let y = 0; y < PX; y++) rgb.set(t.rgb.subarray(y * PX * 3, (y + 1) * PX * 3), ((oy + y) * W + ox) * 3); });
  writeFileSync(`${OUT}/_sheet.png`, png(W, Hh, rgb)); console.log(`${OUT}/_sheet.png`);
}
