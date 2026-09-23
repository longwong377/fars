// Node preview of the sculpted pieces (D-018, D-151): the built meshes (double-bull protome, volute member, the Gate
// colossi, or a whole capital) rasterised in software with per-pixel interpolated vertex normals (as the renderer shades
// them), Lambert sun + hemisphere sky and a shadow map from the sun. For judging the carving quickly without a browser;
// screenshots find problems, they never prove correctness (brief §3.4).
//   npx tsx tools/sculpt_preview.ts <what> [--lod 0|1] [--view az,el] [--sun az,alt] [--frame cx,cy,cz,r] [--fov 30]
//        [--px 640] [--out dir] [--name file] [--fresh [--raw] [--cell c]] [--bin path] [--wire]
//   <what>: protome | volute | colossus_bull | colossus_lamassu | capital:<building> (the capital of that building's order)
//           | lock:<piece>:<triangles> (a piece's lock template)
//   --view: camera azimuth about +y (0 = looking from +x toward −x, 90 = from +z) and elevation, degrees
//   --frame: look at (cx, cy, cz) in the piece's own frame and fit a sphere of radius r (default: the whole bounding box)
//   --fresh: regenerate the piece from the SDF sources (marching cubes + simplification) instead of public/generated;
//            --raw skips the simplification, --cell sets another marching-cubes cell (quick looks)
//   --bin: read one .bin piece (e.g. a copy of the previous build, for before/after sheets)
//   --wire: overlay the triangle edges (to judge where the simplifier spent its triangles)
import { writeFileSync, mkdirSync, readFileSync } from 'node:fs';
import { deflateSync } from 'node:zlib';
import { piece, generatePiece, capitalAlone, decodePiece, sculptParams, colossusFrontProjections, lockTemplate, pieceModel, type PieceName, type Lod } from '../src/arch/sculpt';
import { buildTerrace } from '../src/arch/terrace';
import type { Box, Column } from '../src/arch/parts';
import type { NormMesh } from '../src/arch/sdf';

const args = process.argv.slice(2);
const opt = (k: string, d: string) => { const i = args.indexOf(k); return i >= 0 ? args.splice(i, 2)[1] : d; };
const flag = (k: string) => { const i = args.indexOf(k); if (i >= 0) { args.splice(i, 1); return true; } return false; };
const LOD = +opt('--lod', '0') as Lod, [VAZ, VEL] = opt('--view', '35,12').split(',').map(Number), [SAZ, SALT] = opt('--sun', '60,35').split(',').map(Number);
const FRAME = opt('--frame', ''), FOV = +opt('--fov', '30'), PX = +opt('--px', '640'), OUT = opt('--out', 'shots/sculpt_preview'), NAME = opt('--name', '');
const FRESH = flag('--fresh'), BIN = opt('--bin', ''), WIRE = flag('--wire'), RAW = flag('--raw'), CELL = +opt('--cell', '0'), SS = 2;
const what = args[0] ?? 'protome';
mkdirSync(OUT, { recursive: true });

function png(w: number, h: number, rgb: Uint8Array): Buffer {
  const crcT = new Uint32Array(256).map((_, n) => { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; return c >>> 0; });
  const crc = (b: Buffer) => { let c = 0xffffffff; for (const x of b) c = crcT[(c ^ x) & 255] ^ (c >>> 8); return (c ^ 0xffffffff) >>> 0; };
  const chunk = (t: string, d: Buffer) => { const l = Buffer.alloc(4); l.writeUInt32BE(d.length); const td = Buffer.concat([Buffer.from(t), d]); const c = Buffer.alloc(4); c.writeUInt32BE(crc(td)); return Buffer.concat([l, td, c]); };
  const raw = Buffer.alloc((w * 3 + 1) * h); for (let y = 0; y < h; y++) { raw[y * (w * 3 + 1)] = 0; for (let i = 0; i < w * 3; i++) raw[y * (w * 3 + 1) + 1 + i] = rgb[y * w * 3 + i]; }
  const ihdr = Buffer.alloc(13); ihdr.writeUInt32BE(w, 0); ihdr.writeUInt32BE(h, 4); ihdr[8] = 8; ihdr[9] = 2;
  return Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', ihdr), chunk('IDAT', deflateSync(raw)), chunk('IEND', Buffer.alloc(0))]);
}

// ---------------------------------------------------------------- the mesh
function loadMesh(): NormMesh {
  if (BIN) { const b = readFileSync(BIN); return decodePiece(b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength)); }
  if (what.startsWith('lock:')) { // lock:<piece>:<triangles> — the lock template of a piece at a triangle count
    const [, pc, tris] = what.split(':'), M = pieceModel(pc as PieceName, sculptParams(0.845), 0);
    if (!M.locks) throw new Error(pc + ' has no locks'); return lockTemplate({ ...M.locks, tris: +tris || M.locks.tris });
  }
  if (what.startsWith('capital:')) {
    const b = what.slice(8), col = (buildTerrace().parts as Column[]).find(p => p.type === 'column' && p.building === b && p.built >= 1);
    if (!col) throw new Error('no complete column in ' + b);
    const m = capitalAlone(col.order, LOD); if (!m) throw new Error('no capital'); return m;
  }
  if (FRESH) {
    const params = what.startsWith('colossus') ? sculptParams((() => { const fr = colossusFrontProjections(buildTerrace().parts as Box[]); return fr.reduce((a, c) => a + c, 0) / fr.length; })()) : sculptParams(0.845);
    const t = Date.now(), g = generatePiece(what as PieceName, params, { lods: [LOD], raw: RAW, cell: CELL || undefined }); console.log(`generated ${what} LOD${LOD}${RAW ? ' (raw)' : ''} in ${((Date.now() - t) / 1000).toFixed(1)} s: ${g[LOD].idx.length / 3} tris`);
    return g[LOD];
  }
  return piece(what as PieceName, LOD);
}
const M = loadMesh(), P = M.pos, N = M.nrm, I = M.idx, nT = I.length / 3;
let bb = [Infinity, Infinity, Infinity, -Infinity, -Infinity, -Infinity];
for (let i = 0; i < P.length; i += 3) for (let k = 0; k < 3; k++) { bb[k] = Math.min(bb[k], P[i + k]); bb[k + 3] = Math.max(bb[k + 3], P[i + k]); }
const [cx, cy, cz, rad] = FRAME ? FRAME.split(',').map(Number) : [(bb[0] + bb[3]) / 2, (bb[1] + bb[4]) / 2, (bb[2] + bb[5]) / 2, Math.hypot(bb[3] - bb[0], bb[4] - bb[1], bb[5] - bb[2]) / 2];

// ---------------------------------------------------------------- camera (perspective, fitted to the frame sphere)
type V = [number, number, number];
const dot = (a: V, b: V) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2], cross = (a: V, b: V): V => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const nrm = (a: V): V => { const l = Math.hypot(...a) || 1; return [a[0] / l, a[1] / l, a[2] / l]; };
const dirFrom = (az: number, el: number): V => { const a = (az * Math.PI) / 180, e = (el * Math.PI) / 180; return [Math.cos(e) * Math.cos(a), Math.sin(e), Math.cos(e) * Math.sin(a)]; };
const back = dirFrom(VAZ, VEL), fov = (FOV * Math.PI) / 180, dist = rad / Math.sin(fov / 2);
const eye: V = [cx + back[0] * dist, cy + back[1] * dist, cz + back[2] * dist];
const fwd = nrm([-back[0], -back[1], -back[2]]), right = nrm(cross(fwd, [0, 1, 0])), up = cross(right, fwd);
const W = PX * SS, H = PX * SS, f = W / 2 / Math.tan(fov / 2);
const project = (x: number, y: number, z: number) => { const d: V = [x - eye[0], y - eye[1], z - eye[2]], zc = dot(d, fwd); return [W / 2 + (dot(d, right) * f) / zc, H / 2 - (dot(d, up) * f) / zc, zc]; };

// ---------------------------------------------------------------- shadow map (orthographic, from the sun)
const L = dirFrom(SAZ, SALT), lr = nrm(cross(L, Math.abs(L[1]) > 0.99 ? [1, 0, 0] : [0, 1, 0])), lu = cross(L, lr) as V;
const SM = 3072, smDepth = new Float32Array(SM * SM).fill(Infinity), R0 = Math.hypot(bb[3] - bb[0], bb[4] - bb[1], bb[5] - bb[2]) / 2, bc: V = [(bb[0] + bb[3]) / 2, (bb[1] + bb[4]) / 2, (bb[2] + bb[5]) / 2];
const toLight = (x: number, y: number, z: number) => { const d: V = [x - bc[0], y - bc[1], z - bc[2]]; return [((dot(d, lr) / R0) * 0.5 + 0.5) * SM, ((dot(d, lu) / R0) * 0.5 + 0.5) * SM, -dot(d, L)]; };
function raster(w: number, h: number, a: number[], b: number[], c: number[], cb: (px: number, py: number, w0: number, w1: number, w2: number) => void) {
  const x0 = Math.max(0, Math.floor(Math.min(a[0], b[0], c[0]))), x1 = Math.min(w - 1, Math.ceil(Math.max(a[0], b[0], c[0])));
  const y0 = Math.max(0, Math.floor(Math.min(a[1], b[1], c[1]))), y1 = Math.min(h - 1, Math.ceil(Math.max(a[1], b[1], c[1])));
  const area = (b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0]); if (Math.abs(area) < 1e-12) return;
  for (let py = y0; py <= y1; py++) for (let px = x0; px <= x1; px++) {
    const sx = px + 0.5, sy = py + 0.5;
    const w0 = ((b[0] - sx) * (c[1] - sy) - (b[1] - sy) * (c[0] - sx)) / area, w1 = ((c[0] - sx) * (a[1] - sy) - (c[1] - sy) * (a[0] - sx)) / area, w2 = 1 - w0 - w1;
    if (w0 < 0 || w1 < 0 || w2 < 0) continue;
    cb(px, py, w0, w1, w2);
  }
}
const LP: number[][] = []; for (let v = 0; v < P.length / 3; v++) LP.push(toLight(P[v * 3], P[v * 3 + 1], P[v * 3 + 2]));
for (let t = 0; t < nT; t++) { const a = LP[I[t * 3]], b = LP[I[t * 3 + 1]], c = LP[I[t * 3 + 2]]; raster(SM, SM, a, b, c, (px, py, w0, w1, w2) => { const z = w0 * a[2] + w1 * b[2] + w2 * c[2], q = py * SM + px; if (z < smDepth[q]) smDepth[q] = z; }); }

// ---------------------------------------------------------------- view pass: depth + interpolated normal + position
const zb = new Float32Array(W * H).fill(Infinity), nb = new Float32Array(W * H * 3), pb = new Float32Array(W * H * 3), tb = new Int32Array(W * H).fill(-1), eb = new Float32Array(W * H);
const VP: number[][] = []; for (let v = 0; v < P.length / 3; v++) VP.push(project(P[v * 3], P[v * 3 + 1], P[v * 3 + 2]));
for (let t = 0; t < nT; t++) {
  const ia = I[t * 3], ib = I[t * 3 + 1], ic = I[t * 3 + 2], a = VP[ia], b = VP[ib], c = VP[ic];
  if (a[2] <= 0.01 || b[2] <= 0.01 || c[2] <= 0.01) continue;
  raster(W, H, a, b, c, (px, py, w0, w1, w2) => {
    // perspective-correct barycentrics
    const q0 = w0 / a[2], q1 = w1 / b[2], q2 = w2 / c[2], s = q0 + q1 + q2, u0 = q0 / s, u1 = q1 / s, u2 = q2 / s, z = 1 / s, g = py * W + px;
    if (z >= zb[g]) return;
    zb[g] = z; tb[g] = t; eb[g] = Math.min(w0, w1, w2);
    for (let k = 0; k < 3; k++) { nb[g * 3 + k] = u0 * N[ia * 3 + k] + u1 * N[ib * 3 + k] + u2 * N[ic * 3 + k]; pb[g * 3 + k] = u0 * P[ia * 3 + k] + u1 * P[ib * 3 + k] + u2 * P[ic * 3 + k]; }
  });
}

// ---------------------------------------------------------------- shading: stone albedo, sun (shadowed) + hemisphere sky
const s2l = (c: number) => (c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4)), l2s = (c: number) => Math.round(255 * Math.min(1, Math.max(0, c <= 0.0031308 ? c * 12.92 : 1.055 * Math.pow(c, 1 / 2.4) - 0.055)));
const ALB = [0.44, 0.43, 0.4].map(s2l), SUN = [3.0, 2.85, 2.6], SKY = [0.55, 0.62, 0.78], GND = [0.3, 0.27, 0.22], BG = [0.62, 0.66, 0.72];
const big = new Float32Array(W * H * 3);
for (let g = 0; g < W * H; g++) {
  if (tb[g] < 0) { for (let k = 0; k < 3; k++) big[g * 3 + k] = BG[k] * 0.35; continue; }
  let n: V = nrm([nb[g * 3], nb[g * 3 + 1], nb[g * 3 + 2]]);
  const view = nrm([eye[0] - pb[g * 3], eye[1] - pb[g * 3 + 1], eye[2] - pb[g * 3 + 2]]); if (dot(n, view) < 0) n = [-n[0], -n[1], -n[2]] as V; // back faces (open meshes) seen from behind
  const [lx, ly, lz] = toLight(pb[g * 3], pb[g * 3 + 1], pb[g * 3 + 2]); let lit = 0;
  const bias = 0.0025 * R0 + 0.004 * R0 * (1 - Math.max(0, dot(n, L)));
  for (let oy = -1; oy <= 1; oy++) for (let ox = -1; ox <= 1; ox++) { const sx = Math.min(SM - 1, Math.max(0, Math.floor(lx) + ox)), sy = Math.min(SM - 1, Math.max(0, Math.floor(ly) + oy)); if (lz - bias <= smDepth[sy * SM + sx]) lit++; }
  lit /= 9;
  const ndl = Math.max(0, dot(n, L)), hw = 0.5 + 0.5 * n[1];
  for (let k = 0; k < 3; k++) big[g * 3 + k] = ALB[k] * (SUN[k] * ndl * lit + SKY[k] * hw + GND[k] * (1 - hw));
  if (WIRE && eb[g] < 0.012 * (W / 1000)) for (let k = 0; k < 3; k++) big[g * 3 + k] = big[g * 3 + k] * 0.4 + [0.5, 0.1, 0.05][k] * 0.6;
}
// downsample (SS × SS box) and encode
const rgb = new Uint8Array(PX * PX * 3);
for (let y = 0; y < PX; y++) for (let x = 0; x < PX; x++) for (let k = 0; k < 3; k++) {
  let s = 0; for (let j = 0; j < SS; j++) for (let i = 0; i < SS; i++) s += big[((y * SS + j) * W + x * SS + i) * 3 + k];
  rgb[(y * PX + x) * 3 + k] = l2s(s / (SS * SS));
}
const file = `${OUT}/${NAME || `${what.replace(':', '-')}_l${LOD}_${VAZ}_${VEL}`}.png`;
writeFileSync(file, png(PX, PX, rgb));
console.log(`${file}: ${nT} triangles, ${P.length / 3} vertices; bbox ${bb.map(v => v.toFixed(3)).join(' ')}`);
