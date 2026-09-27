// The mud-brick house kit (D-311; session 12, UD-19): pieces modelled and AO-baked in Blender (tools/blender/housekit.py,
// written to src/data/housekit.json) that every house of the town (houses.ts, build.ts) and of the villages (the same
// generator, villagehouses.ts) is dressed from, placed by the plot data: the slumped mud crest on every exposed wall top,
// the poplar poles of every roof, eave, ceiling and lintel, the tannur of every oven fitting, the plank leaf of every street
// door. D-324 finished it: the eave poles' exposed ends (end grain, checks, the axe's chop), the middle ring's crest, the
// court benches, the ladders' rungs, the doorways' jamb boards, the fieldstones (doorsteps, pivot and post stones, the
// spouts' drip stones), the worn threshold slabs, and the brick courses where the plaster has fallen at the wall's foot.
// All tier C (the analogues: Iranian vernacular adobe; the excavated Iron Age and Achaemenid-period houses named in
// HOUSE_PARTS). The pieces carry their own baked AO and a per-vertex shade; the callers keep the measured tints.
import data from '../../data/housekit.json';
import type { Batch, RGB } from './geom';

/** `yr` (D-324, the eave pole 'plog'): each vertex's offset along the piece's y in its own radius units (the end's relief, kept
 *  whatever the length), p.y then the share of the length (0 the start, 1 the end) */
export interface KitPiece { nv: number; p: number[]; n: number[]; ao: number[]; k: number[]; i: number[]; tris: number; min: number[]; max: number[]; yr?: number[] }
export const KIT: Record<string, KitPiece> = {};
for (const [name, q] of Object.entries((data as any).pieces as Record<string, any>)) {
  const nv = q.p.length / 3, min = [1e9, 1e9, 1e9], max = [-1e9, -1e9, -1e9];
  for (let k = 0; k < nv; k++) for (let j = 0; j < 3; j++) { min[j] = Math.min(min[j], q.p[k * 3 + j]); max[j] = Math.max(max[j], q.p[k * 3 + j]); }
  KIT[name] = { nv, p: q.p, n: q.n, ao: q.ao, k: q.k, i: q.i, tris: q.tris, min, max, yr: q.yr };
}
/** HOUSEKIT=0 (node only) builds the pre-kit generator, for A/B measures of the kit's cost */
export const kitOn = !(typeof process !== 'undefined' && (process as any).env?.HOUSEKIT === '0');
export const KIT_SOURCE = 'tools/blender/housekit.py (Blender 5.0.1, Cycles vertex AO); src/data/housekit.json';
const NAMES = new Map<string, string[]>();
/** the variants of a piece: its name followed by a number (crest0.. but not crestL0..: D-324) */
export const kitNames = (prefix: string) => { let n = NAMES.get(prefix); if (!n) { const re = new RegExp(`^${prefix}[0-9]+$`); n = Object.keys(KIT).filter(k => re.test(k)); NAMES.set(prefix, n); } return n; };
export const kitPiece = (prefix: string, h: number) => { const ns = kitNames(prefix); return KIT[ns[Math.min(ns.length - 1, Math.floor(h * ns.length))]]; };

const cross = (a: number[], b: number[]) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
/** a piece placed by an affine frame: world = O + X·x + Y·y + Z·z (X, Y, Z world vectors carrying the scale); normals by the
 *  inverse transpose; colour = base × the piece's shade (or `col(k, world position)`); the extra 'ao' channel = the baked AO
 *  × aoMul (floored). `Y2`: the world vector of one unit of the piece's `yr` (a two-scale piece: its normals are those of the
 *  frame X, Y2, Z) */
export function kitFrame(b: Batch, q: KitPiece, O: number[], X: number[], Y: number[], Z: number[], base: RGB, owner: number, aoMul = b.cur('ao'), aoMin = 0.12, col?: (k: number, p: number[]) => RGB, Y2?: number[]) {
  const YN = Y2 && q.yr ? Y2 : Y, cx = cross(YN, Z), cy = cross(Z, X), cz = cross(X, YN), det = X[0] * cx[0] + X[1] * cx[1] + X[2] * cx[2], sg = det < 0 ? -1 : 1;
  const idx = det < 0 ? flipIdx(q.i) : q.i;
  const yr = Y2 && q.yr, pos = (k: number) => { const x = q.p[k * 3], y = q.p[k * 3 + 1], z = q.p[k * 3 + 2], e = yr ? yr[k] : 0; return [O[0] + X[0] * x + Y[0] * y + Z[0] * z + (e && Y2![0] * e), O[1] + X[1] * x + Y[1] * y + Z[1] * z + (e && Y2![1] * e), O[2] + X[2] * x + Y[2] * y + Z[2] * z + (e && Y2![2] * e)]; };
  b.mesh(q.nv, pos,
    k => { const nx = q.n[k * 3], ny = q.n[k * 3 + 1], nz = q.n[k * 3 + 2]; const v = [cx[0] * nx + cy[0] * ny + cz[0] * nz, cx[1] * nx + cy[1] * ny + cz[1] * nz, cx[2] * nx + cy[2] * ny + cz[2] * nz]; const L = (Math.hypot(v[0], v[1], v[2]) || 1) * sg; return [v[0] / L, v[1] / L, v[2] / L]; },
    col ? k => col(k, pos(k)) : k => { const s = q.k[k]; return [base[0] * s, base[1] * s, base[2] * s]; }, idx, owner, { ao: k => Math.max(aoMin, q.ao[k] * aoMul) });
}
const flipCache = new Map<number[], number[]>();
function flipIdx(i: number[]) { let f = flipCache.get(i); if (!f) { f = i.slice(); for (let t = 0; t + 2 < f.length; t += 3) { const a = f[t + 1]; f[t + 1] = f[t + 2]; f[t + 2] = a; } flipCache.set(i, f); } return f; }
/** a pole between two world points from the kit's log (unit radius, unit length along +y); `prefix` another round piece
 *  laid the same way (D-324: 'plog' an eave pole with its chopped end, 'rung' a ladder rung) */
export function kitLog(b: Batch, A: number[], Bp: number[], r: number, base: RGB, owner: number, h: number, aoMul = b.cur('ao'), prefix = 'log') {
  const d = [Bp[0] - A[0], Bp[1] - A[1], Bp[2] - A[2]], L = Math.hypot(d[0], d[1], d[2]); if (L < 1e-4) return; const w = d.map(x => x / L);
  const up = Math.abs(w[1]) > 0.9 ? [1, 0, 0] : [0, 1, 0]; let e1 = cross(w, up); const l1 = Math.hypot(e1[0], e1[1], e1[2]); e1 = e1.map(x => x / l1); const e2 = cross(w, e1);
  // a quarter of a turn by the hash, so neighbouring poles do not show the same knots
  const a = h * Math.PI * 2, c = Math.cos(a), s = Math.sin(a), X = [0, 1, 2].map(j => (e1[j] * c + e2[j] * s) * r), Z = [0, 1, 2].map(j => (-e1[j] * s + e2[j] * c) * r);
  kitFrame(b, kitPiece(prefix, h), A, X, d, Z, base, owner, aoMul, 0.12, undefined, w.map(x => x * r));
}
