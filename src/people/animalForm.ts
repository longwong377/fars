// The animals' modelled bodies (D-326; BLENDER_PLAN row 4): one anatomy per family, sized from each species' own build
// (ANIMAL_BUILD: length, withers height, girth, neck, head, leg; animalFrame: the neck root, the poll, the muzzle), as a
// signed-distance model of the parts a real body has — ribcage, belly, croup and buttocks, shoulder blade and upper arm,
// thigh and gaskin, forearm, knee (carpus) and hock with its point, cannon with its tendon, fetlock, pastern and the family's
// foot (the equid hoof, the cloven hoof with its dewclaws, the camel's pad, the carnivore's paw, the bird's scaled toes),
// the neck, the cranium, cheek, face, muzzle, nostrils, eyes and brow, the ears, the horns (annulated), the tail and its
// hair, and each species' own marks (the camel's humps, the zebu's hump and dewlap, the fat tail and the fleece, the boar's
// crest, snout and tusks, the lion's mane, the fowl's comb, wattles, wings and sickles), and the gear the travelling
// animals carry. Every form is C (the living species and the Apadana animals, proportions by eye from the build numbers);
// the numbers that place the joints are the rig's own (animals.ts animalFrame, the hip/knee pivots), so the modelled body
// bends where the procedural one did.
// Three consumers: tools/blender/sources/animal.ts polygonises it (the bake's dense source with its coat colours, and the
// base surface Blender decimates into the game's levels); the game (animalModels.ts) weights each vertex of the loaded
// levels from it (rigWeights: the part distances, "weights transferred" from the anatomy, not painted); the tests.
import { smin, smax, smoothstep, sdEllipsoid, sdRoundCone, clamp } from '../arch/sdf';
import { ANIMAL_BUILD, animalFrame, type Species } from './animals';

export type V3 = [number, number, number];
export type Family = 'equid' | 'bovid' | 'caprine' | 'cervid' | 'antelope' | 'suid' | 'camelid' | 'canid' | 'felid' | 'hare' | 'fowl';
/** the family of each species: one anatomy (and one rig convention) per family */
export const FAMILY: Record<Species, Family> = {
  donkey: 'equid', horse: 'equid', mule: 'equid', onager: 'equid', donkey_pack: 'equid', mule_pack: 'equid', horse_saddle: 'equid',
  ox: 'bovid', cow: 'bovid', calf: 'bovid', zebu: 'bovid',
  sheep: 'caprine', goat: 'caprine', wild_goat: 'caprine', urial: 'caprine',
  deer: 'cervid', stag: 'cervid', gazelle: 'antelope', gazelle_m: 'antelope',
  boar: 'suid', camel: 'camelid', dromedary: 'camelid', camel_pack: 'camelid',
  dog: 'canid', wolf: 'canid', fox: 'canid', hyena: 'canid',
  lion: 'felid', lioness: 'felid', cheetah: 'felid', leopard: 'felid', cat: 'felid',
  hare: 'hare', hen: 'fowl', cock: 'fowl',
};
/** rig groups: what a vertex follows (the torso and the gear are rigid; each leg swings about its hip and bends at its
 *  knee; the neck and head pitch about the neck root; the tail swings about its root) */
export type Group = 'body' | 'leg0' | 'leg1' | 'leg2' | 'leg3' | 'head' | 'skull' | 'tail' | 'gear';
/** surface parts: what colour and coat a point has */
export type Part = 'coat' | 'hoof' | 'horn' | 'eye' | 'nose' | 'mouth' | 'inner_ear' | 'mane' | 'tailhair' | 'wool' | 'udder' | 'comb' | 'beak' | 'shank' | 'tusk'
  | 'feather' | 'sickle' | 'ruff' | 'pad' | 'claw' | 'cloth' | 'wicker' | 'sack' | 'rope' | 'pad_saddle';
export interface Prim { f: (x: number, y: number, z: number) => number; c: V3; R: number; k: number; group: Group; part: Part; sub?: boolean; tag?: string }
export interface Form { sp: Species; fam: Family; prims: Prim[]; subs: Prim[]; min: V3; max: V3;
  /** the rig's numbers (animals.ts: animalFrame, the leg pivots) */
  rig: { bodyY: number; hipY: number; kneeY: number; legs: { x: number; z: number; zk: number; phase: number; fore: number }[]; base: V3; top: V3; hd: V3; muzzle: V3; tailRoot: V3; neckDir: V3; neck: number };
  /** heights of the torso, for the coat patterns */
  bellyY: number; backY: number;
  /** V5 D-520: a library model's form (animalRig.ts realForm): its barrel's half width and the knee's blend band (m) */
  real?: { halfW: number; kneeBand: number } }

const sub = (a: V3, b: V3): V3 => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const add = (a: V3, b: V3): V3 => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
const mul = (a: V3, s: number): V3 => [a[0] * s, a[1] * s, a[2] * s];
const dot = (a: V3, b: V3) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const len3 = (a: V3) => Math.hypot(a[0], a[1], a[2]);
const nrm = (a: V3): V3 => mul(a, 1 / (len3(a) || 1));
const cross = (a: V3, b: V3): V3 => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const lerp3 = (a: V3, b: V3, t: number): V3 => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];

/** an ellipsoid with its third axis along `fwd` (its first axis as near the lateral x as fwd allows, or `side` given) */
export function ell(c: V3, r: V3, fwd: V3 = [0, 0, 1], side: V3 = [1, 0, 0]) {
  const e3 = nrm(fwd), s0 = sub(side, mul(e3, dot(side, e3))), e1 = nrm(len3(s0) > 1e-6 ? s0 : [0, 1, 0]), e2 = cross(e3, e1);
  const f = (x: number, y: number, z: number) => { const d: V3 = [x - c[0], y - c[1], z - c[2]]; return sdEllipsoid(dot(d, e1), dot(d, e2), dot(d, e3), r[0], r[1], r[2]); };
  return { f, c, R: Math.max(r[0], r[1], r[2]) };
}
export function cone(a: V3, b: V3, ra: number, rb: number) {
  const f = (x: number, y: number, z: number) => sdRoundCone(x, y, z, a[0], a[1], a[2], b[0], b[1], b[2], ra, rb);
  return { f, c: lerp3(a, b, 0.5), R: len3(sub(b, a)) / 2 + Math.max(ra, rb) };
}
/** a tube along a polyline, radius tapering from r0 to r1 */
function tube(pts: V3[], r0: number, r1: number) {
  const out: { f: Prim['f']; c: V3; R: number }[] = []; const n = pts.length - 1;
  for (let i = 0; i < n; i++) out.push(cone(pts[i], pts[i + 1], r0 + (r1 - r0) * (i / n), r0 + (r1 - r0) * ((i + 1) / n)));
  return out;
}
/** a leaf (ear): a flattened ellipsoid from its root `a` to its tip direction, `w` wide and `t` thick, its flat face
 *  turned to `face` (the cup opens that way: a smaller ellipsoid is carved out of that face) */
function leaf(a: V3, dir: V3, L: number, w: number, t: number, face: V3, tri = false) {
  const u = nrm(dir), c = add(a, mul(u, L * 0.5)), s0 = sub(face, mul(u, dot(face, u))), n = nrm(s0), side = cross(u, n);
  const outer = tri ? flatCone(a, add(a, mul(u, L)), w * 0.5, w * 0.08, n, w / t) : ell(c, [w * 0.5, t * 0.5, L * 0.5], u, side); // (first axis = side: the width; second = the face normal: the thickness)
  const cupC = add(add(c, mul(n, t * 0.55)), mul(u, L * 0.04)), cup = tri ? flatCone(add(add(a, mul(n, t * 0.45)), mul(u, L * 0.08)), add(add(a, mul(n, t * 0.45)), mul(u, L * 0.85)), w * 0.36, w * 0.04, n, w / t) : ell(cupC, [w * 0.36, t * 0.4, L * 0.4], u, side);
  return { outer, cup, n };
}
/** a round cone from a (radius ra) to b (rb) flattened `k` times along n (a triangular ear) */
function flatCone(a: V3, b: V3, ra: number, rb: number, n: V3, k: number) {
  const f = (x: number, y: number, z: number) => { const q: V3 = [x - a[0], y - a[1], z - a[2]], dn = dot(q, n) * (k - 1), p: V3 = add(add(q, mul(n, dn)), a); return sdRoundCone(p[0], p[1], p[2], a[0], a[1], a[2], b[0], b[1], b[2], ra, rb) / k; };
  return { f, c: lerp3(a, b, 0.5), R: len3(sub(b, a)) / 2 + Math.max(ra, rb) };
}

// ----------------------------------------------------------------------------------------------------------- noise
const hash3 = (x: number, y: number, z: number) => { let h = Math.imul(x, 374761393) ^ Math.imul(y, 668265263) ^ Math.imul(z, 2147483647 & 0x5bd1e995); h = Math.imul(h ^ (h >>> 13), 1274126177); return ((h ^ (h >>> 16)) >>> 0) / 4294967296; };
/** value noise in [-1, 1], smooth */
export function vnoise(x: number, y: number, z: number): number {
  const xi = Math.floor(x), yi = Math.floor(y), zi = Math.floor(z), xf = x - xi, yf = y - yi, zf = z - zi;
  const u = xf * xf * (3 - 2 * xf), v = yf * yf * (3 - 2 * yf), w = zf * zf * (3 - 2 * zf);
  const l = (a: number, b: number, t: number) => a + (b - a) * t;
  const c = (i: number, j: number, k: number) => hash3(xi + i, yi + j, zi + k);
  return 2 * l(l(l(c(0, 0, 0), c(1, 0, 0), u), l(c(0, 1, 0), c(1, 1, 0), u), v), l(l(c(0, 0, 1), c(1, 0, 1), u), l(c(0, 1, 1), c(1, 1, 1), u), v), w) - 1;
}
export const fbm = (x: number, y: number, z: number, oct = 3) => { let s = 0, a = 0.5, f = 1; for (let i = 0; i < oct; i++) { s += a * vnoise(x * f, y * f, z * f); f *= 2.03; a *= 0.5; } return s; };
/** Worley F1 (distance to the nearest feature point, cell units) */
export function worley(x: number, y: number, z: number): number {
  const xi = Math.floor(x), yi = Math.floor(y), zi = Math.floor(z); let d = 9;
  for (let i = -1; i <= 1; i++) for (let j = -1; j <= 1; j++) for (let k = -1; k <= 1; k++) {
    const X = xi + i, Y = yi + j, Z = zi + k, px = X + hash3(X, Y, Z), py = Y + hash3(Y + 17, Z, X), pz = Z + hash3(Z + 31, X, Y);
    const dd = (px - x) ** 2 + (py - y) ** 2 + (pz - z) ** 2; if (dd < d) d = dd; }
  return Math.sqrt(d);
}
/** streaks: noise stretched `ratio` times along `flow` (hair) */
function streak(p: V3, flow: V3, cell: number, ratio: number) { const a = dot(p, flow), q = sub(p, mul(flow, a * (1 - 1 / ratio))); return vnoise(q[0] / cell, q[1] / cell, q[2] / cell); }


// ---------------------------------------------------------------------------------------------------- the anatomy
/** a control point of a swept section: centre, half-width (lateral, x) and half-depth (across the path, in the body's
 *  sagittal plane) */
interface SP { p: V3; rw: number; rd: number }
/** a swept elliptical tube through its control points (Catmull-Rom, `sub` samples per span), capped at both ends: the
 *  torso, the neck, the head, the legs, the tails. One primitive per sample span (bounded: the union's early-out) */
function sweep(ctrl: SP[], ns = 4): { f: Prim['f']; c: V3; R: number }[] {
  const n = ctrl.length, pts: SP[] = [];
  const cr = (a: number, b: number, c: number, d: number, t: number) => 0.5 * (2 * b + (-a + c) * t + (2 * a - 5 * b + 4 * c - d) * t * t + (-a + 3 * b - 3 * c + d) * t * t * t);
  for (let i = 0; i < n - 1; i++) for (let j = 0; j < ns; j++) {
    const t = j / ns, P0 = ctrl[Math.max(0, i - 1)], P1 = ctrl[i], P2 = ctrl[i + 1], P3 = ctrl[Math.min(n - 1, i + 2)];
    const p: V3 = [0, 1, 2].map(a => cr(P0.p[a], P1.p[a], P2.p[a], P3.p[a], t)) as V3;
    pts.push({ p, rw: Math.max(0.3 * Math.min(P1.rw, P2.rw), cr(P0.rw, P1.rw, P2.rw, P3.rw, t)), rd: Math.max(0.3 * Math.min(P1.rd, P2.rd), cr(P0.rd, P1.rd, P2.rd, P3.rd, t)) }); // (the radii C1 too: no ridges at the control points)
  }
  pts.push(ctrl[n - 1]);
  // the segments: each an elliptical section interpolated along it, capped; the tube is their plain minimum (the sections
  // agree at the joints, so no smooth blend is needed and none bulges), bounded as one primitive
  const segs: { A: SP; Bq: SP; ab: V3; l2: number; e1: V3; e2: V3; e3: V3; c: V3; R: number }[] = [];
  for (let i = 0; i < pts.length - 1; i++) {
    const A = pts[i], Bq = pts[i + 1], ab = sub(Bq.p, A.p), l2 = dot(ab, ab) || 1e-12, e3 = nrm(ab);
    const s0 = sub([1, 0, 0], mul(e3, e3[0])), e1 = nrm(len3(s0) > 1e-6 ? s0 : [0, 1, 0]), e2 = cross(e3, e1);
    segs.push({ A, Bq, ab, l2, e1, e2, e3, c: lerp3(A.p, Bq.p, 0.5), R: Math.sqrt(l2) / 2 + Math.max(A.rw, A.rd, Bq.rw, Bq.rd) });
  }
  const LB = new Float64Array(segs.length);
  const one = (S: typeof segs[number], x: number, y: number, z: number) => {
    const { A, Bq, ab, l2, e1, e2, e3 } = S;
    const qx = x - A.p[0], qy = y - A.p[1], qz = z - A.p[2], h = clamp((qx * ab[0] + qy * ab[1] + qz * ab[2]) / l2, 0, 1);
    const dx = qx - ab[0] * h, dy = qy - ab[1] * h, dz = qz - ab[2] * h, rw = A.rw + (Bq.rw - A.rw) * h, rd = A.rd + (Bq.rd - A.rd) * h;
    return sdEllipsoid(dx * e1[0] + dy * e1[1] + dz * e1[2], dx * e2[0] + dy * e2[1] + dz * e2[2], dx * e3[0] + dy * e3[1] + dz * e3[2], rw, rd, Math.min(rw, rd));
  };
  const f = (x: number, y: number, z: number) => {
    // the nearest bound first (its distance prunes the rest)
    let i0 = 0; for (let i = 0; i < segs.length; i++) { const S = segs[i]; LB[i] = Math.sqrt((x - S.c[0]) ** 2 + (y - S.c[1]) ** 2 + (z - S.c[2]) ** 2) - S.R; if (LB[i] < LB[i0]) i0 = i; }
    let d = one(segs[i0], x, y, z);
    for (let i = 0; i < segs.length; i++) {
      if (i === i0 || LB[i] > d) continue; const S = segs[i];
      const { A, Bq, ab, l2, e1, e2, e3 } = S;
      const qx = x - A.p[0], qy = y - A.p[1], qz = z - A.p[2], h = clamp((qx * ab[0] + qy * ab[1] + qz * ab[2]) / l2, 0, 1);
      const dx = qx - ab[0] * h, dy = qy - ab[1] * h, dz = qz - ab[2] * h, rw = A.rw + (Bq.rw - A.rw) * h, rd = A.rd + (Bq.rd - A.rd) * h;
      const v = sdEllipsoid(dx * e1[0] + dy * e1[1] + dz * e1[2], dx * e2[0] + dy * e2[1] + dz * e2[2], dx * e3[0] + dy * e3[1] + dz * e3[2], rw, rd, Math.min(rw, rd));
      if (v < d) d = v;
    }
    return d;
  };
  const lo: V3 = [1e9, 1e9, 1e9], hi: V3 = [-1e9, -1e9, -1e9];
  for (const S of segs) for (let k = 0; k < 3; k++) { lo[k] = Math.min(lo[k], S.c[k] - S.R); hi[k] = Math.max(hi[k], S.c[k] + S.R); }
  const c = lerp3(lo, hi, 0.5);
  return [{ f, c, R: len3(sub(hi, lo)) / 2 }];
}
type Row = [number, number, number, number];
interface FP { // per family: shape (C, from the living animals' proportions)
  /** the torso along the spine: [z / len, centre y offset / girth, half-width / girth, half-depth / girth] */
  torso: Row[];
  /** the neck from its root to the poll: [t, bow (x neck length, + up), half-width, half-depth] (/ girth; the last row / headR) */
  neck: Row[];
  /** the head along its axis, [t (x head length), offset across (x headR, + up), half-width, half-depth (x headR)]: the face
   *  (poll, forehead, face, nose) and the lower jaw (the round cheek plate behind, down to the chin), two swept sections
   *  whose union leaves the throat's notch under the jowl */
  head: Row[]; jaw: Row[];
  hoof: 'hoof' | 'cloven' | 'pad' | 'paw' | 'bird'; forearm: number; thigh: number; shoulder: number; slope: number; eyeT: number; eyeV: number;
  /** where the neck's section starts, from the rig's neck root: [up / girth, forward / length] */
  neckRoot: [number, number] }
const FAM: Record<Family, FP> = {
  equid: { torso: [[-0.5, -0.02, 0.14, 0.22], [-0.45, 0.02, 0.33, 0.43], [-0.34, 0.05, 0.42, 0.49], [-0.18, 0.01, 0.45, 0.5], [0, -0.01, 0.47, 0.52], [0.16, 0, 0.46, 0.53], [0.3, 0.02, 0.37, 0.52], [0.41, -0.05, 0.3, 0.42], [0.48, -0.1, 0.2, 0.26]],
    neck: [[0, 0, 0.24, 0.42], [0.33, 0.05, 0.19, 0.33], [0.66, 0.05, 0.15, 0.25], [1, 0, 0.62, 0.85]],
    head: [[0.0, 0.05, 0.75, 0.7], [0.2, 0.0, 0.95, 0.75], [0.45, -0.1, 0.72, 0.62], [0.72, -0.2, 0.52, 0.52], [0.88, -0.28, 0.5, 0.56], [0.95, -0.34, 0.48, 0.5]], jaw: [[0.08, -1.1, 0.9, 1.0], [0.22, -1.15, 0.8, 0.75], [0.45, -0.95, 0.5, 0.42], [0.72, -0.85, 0.38, 0.33], [0.9, -0.8, 0.33, 0.28]],
    hoof: 'hoof', forearm: 1, thigh: 1, shoulder: 1, slope: 0, eyeT: 0.24, eyeV: 0.2, neckRoot: [0.26, -0.06] },
  bovid: { torso: [[-0.5, 0.0, 0.18, 0.26], [-0.44, 0.04, 0.38, 0.46], [-0.32, 0.05, 0.45, 0.5], [-0.15, 0.0, 0.49, 0.52], [0, -0.02, 0.5, 0.54], [0.18, -0.01, 0.47, 0.54], [0.32, 0.0, 0.38, 0.54], [0.42, -0.08, 0.3, 0.44], [0.49, -0.12, 0.2, 0.28]],
    neck: [[0, 0, 0.3, 0.44], [0.33, 0, 0.25, 0.35], [0.66, 0, 0.21, 0.28], [1, 0, 0.75, 0.9]],
    head: [[0.0, 0.1, 0.95, 0.75], [0.2, 0.0, 1.0, 0.8], [0.5, -0.12, 0.78, 0.66], [0.78, -0.22, 0.72, 0.6], [0.93, -0.3, 0.78, 0.55]], jaw: [[0.12, -0.95, 0.9, 0.85], [0.3, -0.95, 0.72, 0.6], [0.6, -0.85, 0.52, 0.4], [0.88, -0.8, 0.5, 0.3]],
    hoof: 'cloven', forearm: 1.05, thigh: 0.95, shoulder: 1, slope: 0, eyeT: 0.22, eyeV: 0.25, neckRoot: [0.14, -0.04] },
  caprine: { torso: [[-0.5, 0.0, 0.16, 0.24], [-0.44, 0.04, 0.36, 0.44], [-0.32, 0.05, 0.43, 0.5], [-0.15, 0.0, 0.47, 0.51], [0, -0.02, 0.48, 0.53], [0.18, -0.01, 0.45, 0.53], [0.32, 0.0, 0.37, 0.52], [0.42, -0.07, 0.29, 0.42], [0.49, -0.11, 0.19, 0.26]],
    neck: [[0, 0, 0.23, 0.36], [0.33, 0, 0.18, 0.28], [0.66, 0, 0.15, 0.22], [1, 0, 0.68, 0.85]],
    head: [[0.0, 0.05, 0.85, 0.75], [0.22, 0.0, 0.92, 0.75], [0.5, -0.12, 0.62, 0.6], [0.78, -0.22, 0.45, 0.48], [0.93, -0.28, 0.42, 0.42]], jaw: [[0.12, -0.9, 0.8, 0.8], [0.35, -0.9, 0.6, 0.5], [0.65, -0.8, 0.38, 0.32], [0.88, -0.72, 0.32, 0.26]],
    hoof: 'cloven', forearm: 0.9, thigh: 0.9, shoulder: 0.9, slope: 0, eyeT: 0.25, eyeV: 0.25, neckRoot: [0.16, -0.05] },
  cervid: { torso: [[-0.5, 0.02, 0.13, 0.2], [-0.44, 0.06, 0.31, 0.4], [-0.33, 0.08, 0.38, 0.44], [-0.18, 0.06, 0.41, 0.45], [0, 0.02, 0.44, 0.48], [0.16, -0.01, 0.43, 0.52], [0.3, 0.02, 0.34, 0.52], [0.41, -0.06, 0.27, 0.4], [0.48, -0.1, 0.18, 0.24]],
    neck: [[0, 0, 0.2, 0.34], [0.33, 0.02, 0.15, 0.25], [0.66, 0.02, 0.12, 0.19], [1, 0, 0.62, 0.8]],
    head: [[0.0, 0.05, 0.82, 0.72], [0.22, 0.0, 0.9, 0.72], [0.5, -0.12, 0.58, 0.56], [0.78, -0.22, 0.42, 0.44], [0.93, -0.27, 0.38, 0.38]], jaw: [[0.12, -0.85, 0.75, 0.75], [0.35, -0.85, 0.55, 0.45], [0.65, -0.75, 0.35, 0.3], [0.88, -0.68, 0.3, 0.24]],
    hoof: 'cloven', forearm: 0.85, thigh: 1, shoulder: 0.9, slope: 0, eyeT: 0.24, eyeV: 0.28, neckRoot: [0.2, -0.05] },
  antelope: { torso: [[-0.5, 0.02, 0.13, 0.2], [-0.44, 0.07, 0.3, 0.39], [-0.33, 0.09, 0.37, 0.42], [-0.18, 0.08, 0.39, 0.43], [0, 0.03, 0.42, 0.47], [0.16, -0.01, 0.42, 0.52], [0.3, 0.02, 0.33, 0.52], [0.41, -0.06, 0.26, 0.4], [0.48, -0.1, 0.17, 0.24]],
    neck: [[0, 0, 0.19, 0.33], [0.33, 0.02, 0.14, 0.24], [0.66, 0.02, 0.11, 0.18], [1, 0, 0.6, 0.78]],
    head: [[0.0, 0.05, 0.8, 0.72], [0.22, 0.0, 0.9, 0.72], [0.5, -0.12, 0.56, 0.55], [0.78, -0.22, 0.4, 0.43], [0.93, -0.27, 0.36, 0.37]], jaw: [[0.12, -0.85, 0.72, 0.72], [0.35, -0.85, 0.52, 0.44], [0.65, -0.75, 0.34, 0.29], [0.88, -0.68, 0.29, 0.23]],
    hoof: 'cloven', forearm: 0.8, thigh: 1, shoulder: 0.85, slope: 0, eyeT: 0.26, eyeV: 0.3, neckRoot: [0.2, -0.05] },
  suid: { torso: [[-0.5, -0.02, 0.14, 0.2], [-0.44, 0.0, 0.3, 0.38], [-0.32, 0.0, 0.36, 0.44], [-0.15, 0.0, 0.42, 0.5], [0, 0.0, 0.46, 0.52], [0.16, 0.02, 0.48, 0.56], [0.3, 0.04, 0.44, 0.58], [0.41, -0.02, 0.36, 0.48], [0.48, -0.06, 0.26, 0.34]],
    neck: [[0, 0, 0.36, 0.48], [0.5, 0.05, 0.32, 0.42], [1, 0, 0.95, 1.0]],
    head: [[0.0, 0.1, 1.0, 0.9], [0.25, -0.05, 0.9, 0.8], [0.55, -0.1, 0.6, 0.55], [0.85, -0.12, 0.45, 0.42], [0.97, -0.12, 0.43, 0.4]], jaw: [[0.15, -0.9, 0.9, 0.8], [0.45, -0.8, 0.6, 0.45], [0.8, -0.6, 0.35, 0.3]],
    hoof: 'cloven', forearm: 1, thigh: 0.9, shoulder: 1.2, slope: 0.07, eyeT: 0.3, eyeV: 0.35, neckRoot: [0.08, -0.02] },
  camelid: { torso: [[-0.5, 0.04, 0.12, 0.2], [-0.44, 0.06, 0.28, 0.38], [-0.33, 0.06, 0.34, 0.44], [-0.15, 0.02, 0.4, 0.48], [0, 0.0, 0.44, 0.5], [0.16, -0.02, 0.44, 0.52], [0.3, -0.02, 0.36, 0.5], [0.41, -0.08, 0.28, 0.4], [0.48, -0.12, 0.18, 0.26]],
    neck: [[0, 0, 0.17, 0.3], [0.3, -0.22, 0.13, 0.21], [0.65, -0.12, 0.11, 0.17], [1, 0, 0.6, 0.75]],
    head: [[0.0, 0.05, 0.8, 0.75], [0.22, 0.0, 0.9, 0.75], [0.5, -0.12, 0.6, 0.6], [0.8, -0.22, 0.5, 0.52], [0.94, -0.28, 0.5, 0.5]], jaw: [[0.12, -1.0, 0.8, 0.8], [0.35, -0.95, 0.6, 0.55], [0.65, -0.85, 0.42, 0.38], [0.9, -0.78, 0.42, 0.34]],
    hoof: 'pad', forearm: 0.85, thigh: 0.85, shoulder: 0.9, slope: 0, eyeT: 0.24, eyeV: 0.3, neckRoot: [0.1, -0.03] },
  canid: { torso: [[-0.5, 0.06, 0.13, 0.19], [-0.44, 0.08, 0.29, 0.37], [-0.33, 0.1, 0.34, 0.39], [-0.18, 0.12, 0.33, 0.37], [-0.02, 0.07, 0.37, 0.45], [0.16, 0.0, 0.42, 0.53], [0.3, 0.0, 0.38, 0.52], [0.41, -0.06, 0.3, 0.42], [0.48, -0.1, 0.2, 0.26]],
    neck: [[0, 0, 0.26, 0.38], [0.5, 0.02, 0.21, 0.29], [1, 0, 0.8, 0.85]],
    head: [[-0.05, 0.15, 0.95, 0.95], [0.2, 0.1, 1.1, 0.95], [0.42, 0.0, 0.95, 0.8], [0.56, -0.18, 0.72, 0.68], [0.75, -0.24, 0.62, 0.6], [0.9, -0.27, 0.55, 0.52], [0.97, -0.27, 0.5, 0.44]], jaw: [[0.3, -0.75, 0.8, 0.5], [0.55, -0.75, 0.5, 0.34], [0.88, -0.7, 0.36, 0.24]],
    hoof: 'paw', forearm: 0.85, thigh: 1.05, shoulder: 1, slope: 0, eyeT: 0.36, eyeV: 0.2, neckRoot: [0.18, -0.05] },
  felid: { torso: [[-0.5, 0.04, 0.14, 0.2], [-0.44, 0.06, 0.32, 0.4], [-0.32, 0.08, 0.38, 0.44], [-0.15, 0.1, 0.38, 0.42], [0, 0.06, 0.4, 0.46], [0.16, 0.01, 0.43, 0.52], [0.3, 0.02, 0.38, 0.52], [0.41, -0.05, 0.3, 0.42], [0.48, -0.08, 0.2, 0.26]],
    neck: [[0, 0, 0.3, 0.4], [0.5, 0.02, 0.25, 0.32], [1, 0, 0.9, 0.9]],
    head: [[-0.05, 0.1, 1.0, 0.95], [0.22, 0.05, 1.15, 0.98], [0.45, -0.05, 1.05, 0.88], [0.66, -0.16, 0.95, 0.76], [0.84, -0.22, 0.82, 0.68], [0.95, -0.25, 0.72, 0.58]], jaw: [[0.25, -0.75, 0.95, 0.6], [0.55, -0.75, 0.75, 0.45], [0.86, -0.7, 0.5, 0.32]],
    hoof: 'paw', forearm: 1.15, thigh: 1.1, shoulder: 1.1, slope: 0, eyeT: 0.4, eyeV: 0.22, neckRoot: [0.14, -0.04] },
  hare: { torso: [[-0.5, 0.0, 0.2, 0.3], [-0.42, 0.04, 0.4, 0.48], [-0.3, 0.05, 0.44, 0.5], [-0.12, 0.02, 0.44, 0.48], [0.05, 0, 0.42, 0.46], [0.22, 0, 0.4, 0.46], [0.36, -0.02, 0.34, 0.42], [0.46, -0.06, 0.22, 0.3]],
    neck: [[0, 0, 0.3, 0.34], [1, 0, 0.9, 0.9]],
    head: [[-0.05, 0.0, 0.95, 0.95], [0.25, 0.0, 1.0, 0.95], [0.55, -0.15, 0.75, 0.7], [0.85, -0.25, 0.55, 0.55], [0.95, -0.28, 0.5, 0.45]], jaw: [[0.25, -0.7, 0.7, 0.5], [0.7, -0.6, 0.4, 0.3]],
    hoof: 'paw', forearm: 0.7, thigh: 1.35, shoulder: 0.8, slope: -0.04, eyeT: 0.3, eyeV: 0.3, neckRoot: [0.08, -0.02] },
  fowl: { torso: [], neck: [], head: [], jaw: [], hoof: 'bird', forearm: 1, thigh: 1, shoulder: 1, slope: 0, eyeT: 0.3, eyeV: 0.35, neckRoot: [0, 0] },
};
/** linear interpolation in a profile's rows at t (column 0) */
function prof(rows: Row[], t: number): Row { if (t <= rows[0][0]) return rows[0]; for (let i = 1; i < rows.length; i++) if (t <= rows[i][0]) { const a = rows[i - 1], b = rows[i], s = (t - a[0]) / (b[0] - a[0]); return a.map((v, k) => v + (b[k] - v) * s) as Row; } return rows[rows.length - 1]; }

const FORMS = new Map<Species, Form>();
/** the anatomy of a species (cached) */
export function animalForm(sp: Species): Form { let F = FORMS.get(sp); if (!F) { F = build(sp); FORMS.set(sp, F); } return F; }

function build(sp: Species): Form {
  const B = ANIMAL_BUILD[sp], Fr = animalFrame(sp), fam = FAMILY[sp], P = FAM[fam];
  const g = B.girth, L = B.len, by = Fr.bodyY, bellyY = by - 0.52 * g, backY = by + 0.52 * g, hipY = by - 0.12 * g, kneeY = hipY * 0.45;
  const prims: Prim[] = [], subs: Prim[] = [];
  const put: Put = (s, k, group, part = 'coat', tag) => { prims.push({ ...s, k, group, part, tag }); };
  const cut: Put = (s, k, group, part = 'coat') => { subs.push({ ...s, k, group, part, sub: true }); };
  const putAll = (ss: { f: Prim['f']; c: V3; R: number }[], k: number, group: Group, part: Part = 'coat', tag?: string) => { for (const s of ss) put(s, k, group, part, tag); };
  const base: V3 = [Fr.base.x, Fr.base.y, Fr.base.z], top: V3 = [Fr.top.x, Fr.top.y, Fr.top.z], hd: V3 = [Fr.hd.x, Fr.hd.y, Fr.hd.z], muzzle: V3 = [Fr.muzzle.x, Fr.muzzle.y, Fr.muzzle.z];
  const tailRoot: V3 = [0, by + g * 0.25, -L * 0.5];
  const legs = (B.biped ? [[0.3, -0.04, 0.25, -1], [-0.3, -0.04, 0.75, -1]] : [[0.3, 0.34, 0.25, 1], [-0.3, 0.34, 0.75, 1], [0.3, -0.36, 0, -1], [-0.3, -0.36, 0.5, -1]])
    .map(([x, z, ph, fore]) => ({ x: x * g, z: z * L, zk: z * L + (fore > 0 ? 0.01 : B.biped ? 0.012 : -0.03), phase: ph * 2 * Math.PI, fore }));
  const neckDir = nrm(sub(top, base));
  const rig = { bodyY: by, hipY, kneeY, legs, base, top, hd, muzzle, tailRoot, neckDir, neck: B.neck };

  if (fam === 'fowl') fowl(sp, B, rig, put, cut);
  else {
    const sl = (sp === 'hyena' ? 0.1 : P.slope) * g, yz = (z: number) => sl * (z / (L * 0.5)); // the hyena's and the boar's high forehand
    // ---- the torso: one swept section along the spine, the family's profile (croup, flank, barrel, girth, withers, breast)
    putAll(sweep(P.torso.map(([t, y, w, d]) => ({ p: [0, by + y * g + yz(t * L), t * L] as V3, rw: w * g, rd: d * g })), 8), 0.02 * g, 'body');
    // the muscles over it: the shoulder blade and the upper arm, the withers' ridge, the thigh and the hamstrings (soft blends)
    const km = 0.14 * g;
    for (const s of [-1, 1]) {
      const ps: V3 = [s * 0.3 * g, by - 0.1 * g + yz(0.42 * L), 0.42 * L], sc: V3 = [s * 0.28 * g, by + 0.26 * g + yz(0.3 * L), 0.3 * L];
      put(ell(lerp3(sc, ps, 0.5), [0.1 * g * P.shoulder, 0.13 * g * P.shoulder, len3(sub(ps, sc)) * 0.6], sub(ps, sc)), km, 'body');
      put(cone(ps, [s * 0.3 * g, bellyY + 0.12 * g + yz(0.33 * L), 0.33 * L], 0.1 * g * P.shoulder, 0.09 * g), km, 'body');
      const hip: V3 = [s * 0.28 * g, by + 0.12 * g + yz(-0.3 * L), -0.29 * L], stifle: V3 = [s * 0.33 * g, bellyY + 0.12 * g + yz(-0.24 * L), -0.24 * L];
      put(cone(hip, stifle, 0.18 * g * P.thigh, 0.12 * g * P.thigh), km, 'body');
      put(ell([s * 0.2 * g, by - 0.14 * g + yz(-0.42 * L), -0.42 * L], [0.12 * g * P.thigh, 0.28 * g, 0.09 * L]), km, 'body');
    }
    // the cattle's and the small stock's hip bones (the hooks, the pins) under the skin and the cattle's deep belly
    if (fam === 'bovid' || fam === 'caprine') { for (const s of [-1, 1]) { put(ell([s * 0.36 * g, by + 0.34 * g, -0.27 * L], [0.09 * g, 0.08 * g, 0.07 * L]), 0.1 * g, 'body'); put(ell([s * 0.15 * g, by + 0.24 * g, -0.46 * L], [0.06 * g, 0.07 * g, 0.05 * L]), 0.08 * g, 'body'); }
      put(ell([0, by - 0.16 * g, -0.06 * L], [0.5 * g, 0.4 * g, 0.28 * L]), 0.16 * g, 'body'); }
    // ---- legs
    legs.forEach((lg, i) => leg(i, lg, B, P, fam, { g, L, by, bellyY, hipY, kneeY, yz }, put, putAll));
    // ---- the neck: a swept section from the root to the poll (the camel's bowed down)
    const nperp = nrm(cross(neckDir, [1, 0, 0])), hr = B.headR; // up and back across the neck (its crest side)
    const nr = add(base, [0, P.neckRoot[0] * g, P.neckRoot[1] * L]); // the neck's section starts up and back from the pivot: its top line runs from the withers
    // the throat latch: the neck narrows over its last sixth into the head, leaving the notch under the jowl
    const nrows: Row[] = P.neck.length > 2 ? [...P.neck.slice(0, -1), (() => { const a = P.neck[P.neck.length - 2], z = P.neck[P.neck.length - 1]; return [0.86, a[1] * 0.4, 0.5 * a[2] + 0.5 * z[2] * hr / g, 0.35 * a[3] + 0.65 * z[3] * hr / g] as Row; })(), P.neck[P.neck.length - 1]] : P.neck;
    const nk = nrows.map(([t, bow, w, d], i, a) => { const last = i === a.length - 1, rd = (last ? hr : g) * d; return { p: add(lerp3(nr, top, t), mul(nperp, bow * B.neck - (t > 0.5 ? (t - 0.5) * 2 * 0.8 * (last ? rd : hr * 0.85) : 0))), rw: (last ? hr : g) * w, rd }; });
    putAll(sweep(nk, 8), 0.05 * g, 'head');
    // the dewlap of the cattle (a thin fold from the throat to the brisket; the zebu's deep)
    if (fam === 'bovid') { const a = add(lerp3(base, top, 0.8), mul(nperp, -hr * 1.0)), b: V3 = [0, bellyY + 0.12 * g, 0.44 * L];
      put(ell(lerp3(a, b, 0.5), [0.03 * g, (sp === 'zebu' ? 0.2 : 0.12) * g, len3(sub(b, a)) * 0.55], sub(b, a)), 0.05 * g, 'head'); }
    head(sp, B, P, fam, rig, put, cut, putAll);
    if (B.ruff) { const hr2 = B.headR, u = hd, v = nrm(cross(u, [1, 0, 0])), at = (a: number, b: number): V3 => add(add(top, mul(u, a * B.head)), mul(v, b * hr2));
      putAll(sweep(nk.map((q, i) => ({ p: add(q.p, mul(nperp, 0.03 + 0.02 * i / (nk.length - 1))), rw: q.rw + 0.035, rd: q.rd + 0.045 })), 5), 0.04, 'head', 'ruff');
      put(ell(at(-0.08, 0.05), [hr2 * 1.25, hr2 * 1.15, B.head * 0.16], u), 0.04, 'head', 'ruff');                           // behind the ears
      for (const q of [-1, 1]) put(ell(add(at(0.16, -0.45), [q * hr2 * 0.95, 0, 0]), [hr2 * 0.4, hr2 * 1.0, B.head * 0.2], add(u, mul(v, -0.6))), 0.04, 'skull', 'ruff'); // the cheeks' frame
      put(ell(add(at(0.05, -1.2), [0, -0.02, 0]), [hr2 * 0.7, hr2 * 0.8, B.head * 0.2], add(u, mul(v, -1.2))), 0.04, 'head', 'ruff'); // the throat
      put(ell([0, by - 0.12 * g, 0.42 * L], [0.24 * g, 0.36 * g, 0.1 * L], [0, -0.4, 1]), 0.06, 'body', 'ruff'); }                   // the chest
    tail(sp, B, fam, rig, g, L, put, putAll);
    // the equids' mane: a roached, upright crest along the neck's top from the withers to the poll (the Apadana horses'
    // clipped manes, B imagery; the ass's own short upright mane) and the forelock's tuft
    if (fam === 'equid') { const tn = nrows.map(r => r[0]), hgt = sp.startsWith('donkey') || sp === 'onager' ? 0.085 : 0.07, ctrl: SP[] = [];
      for (let i = 0; i <= 8; i++) { const t = 0.04 + (i / 8) * 0.93; let j = 1; while (j < tn.length - 1 && tn[j] < t) j++; const s = (t - tn[j - 1]) / (tn[j] - tn[j - 1]);
        const c = lerp3(nk[j - 1].p, nk[j].p, s), rd = nk[j - 1].rd + (nk[j].rd - nk[j - 1].rd) * s;
        ctrl.push({ p: add(c, mul(nperp, rd * 0.9 + hgt * 0.35)), rw: 0.02, rd: hgt * (0.55 + 0.45 * (1 - t)) * 0.5 }); }
      putAll(sweep(ctrl, 3), 0.015, 'head', 'mane');
      if (!sp.startsWith('donkey') && sp !== 'onager') { const u = hd, v = nrm(cross(u, [1, 0, 0])); put(ell(add(add(top, mul(u, 0.14 * B.head)), mul(v, hr * 1.0)), [0.028, 0.025, 0.09], add(u, mul(v, 0.6))), 0.02, 'skull', 'mane'); } }
    extras(sp, B, fam, rig, { g, L, by, bellyY, backY, yz }, put, cut);
  }
  // bounds
  const lo: V3 = [1e9, 1e9, 1e9], hi: V3 = [-1e9, -1e9, -1e9];
  for (const p of prims) for (let a = 0; a < 3; a++) { lo[a] = Math.min(lo[a], p.c[a] - p.R); hi[a] = Math.max(hi[a], p.c[a] + p.R); }
  lo[1] = Math.max(lo[1], -0.02);
  return { sp, fam, prims, subs, min: lo, max: hi, rig, bellyY, backY };
}

type Put = (s: { f: Prim['f']; c: V3; R: number }, k: number, group: Group, part?: Part, tag?: string) => void;
type PutAll = (ss: { f: Prim['f']; c: V3; R: number }[], k: number, group: Group, part?: Part, tag?: string) => void;
type Rig = Form['rig'];

function leg(i: number, lg: Rig['legs'][number], B: typeof ANIMAL_BUILD[Species], P: FP, fam: Family, T: { g: number; L: number; by: number; bellyY: number; hipY: number; kneeY: number; yz: (z: number) => number }, put: Put, putAll: PutAll) {
  const G = `leg${i}` as Group, { g, bellyY, kneeY } = T, X = lg.x * 1.02, Z = lg.z, r = B.leg, fore = lg.fore > 0;
  const paw = P.hoof === 'paw', pad = P.hoof === 'pad';
  const fy = paw ? kneeY * 0.34 : pad ? kneeY * 0.3 : kneeY * 0.36; // the fetlock
  const zk = lg.zk, zf = zk + (paw ? 0.01 : 0.003);
  const k = r * 0.5;
  if (fore) { // forearm from the elbow, the knee (carpus), the cannon with its tendon, the fetlock
    const fa = P.forearm;
    putAll(sweep([
      { p: [X, bellyY + 0.18 * g + T.yz(Z), Z - 0.02], rw: 0.1 * g * fa, rd: 0.14 * g * fa },
      { p: [X, bellyY + (kneeY - bellyY) * 0.45, Z - 0.006], rw: 0.072 * g * fa, rd: 0.095 * g * fa },
      { p: [X, kneeY + r * 2.2, zk], rw: r * 1.22, rd: r * 1.5 },
      { p: [X, kneeY, zk + 0.002], rw: r * 1.3, rd: r * 1.45 },
      { p: [X, kneeY - r * 2, zk], rw: r * 0.95, rd: r * 1.28 },
      { p: [X, fy + r * 1.3, zf - r * 0.1], rw: r * 0.95, rd: r * 1.3 },
      { p: [X, fy, zf - r * 0.15], rw: r * 1.12, rd: r * 1.38 }], 5), k, G);
  } else { // gaskin from the stifle, the hock with its point, the cannon, the fetlock
    const th = P.thigh;
    putAll(sweep([
      { p: [X * 1.06, bellyY + 0.12 * g + T.yz(Z), Z + 0.1 * T.L], rw: 0.12 * g * th, rd: 0.17 * g * th },
      { p: [X, bellyY + (kneeY - bellyY) * 0.4, Z + 0.035 * T.L], rw: 0.08 * g * th, rd: 0.13 * g * th },
      { p: [X, kneeY + r * 2.4, zk - r * 0.3], rw: r * 1.18, rd: r * 2.0 },
      { p: [X, kneeY, zk - r * 0.2], rw: r * 1.25, rd: r * 1.8 },
      { p: [X, kneeY - r * 2, zk], rw: r * 0.95, rd: r * 1.3 },
      { p: [X, fy + r * 1.3, zf], rw: r * 0.95, rd: r * 1.3 },
      { p: [X, fy, zf - r * 0.1], rw: r * 1.1, rd: r * 1.36 }], 5), k, G);
    put(ell([X, kneeY + r * 0.4, zk - r * 1.6], [r * 0.7, r * 1.1, r * 0.7]), r * 0.6, G); // the point of the hock
  }
  foot([X, fy, zf], paw ? r * 1.3 : pad ? r * 1.2 : r * 2.2, r, P, fam, fore, G, put);
}
function foot(fet: V3, footTop: number, r: number, P: FP, fam: Family, fore: boolean, G: Group, put: Put) {
  const X = fet[0], Z = fet[2];
  if (P.hoof === 'hoof') { // the equid: a sloping pastern, the coronet and the hoof (its wall at ~50 degrees)
    const cor: V3 = [X, footTop, Z + r * 1.4];
    put(cone(fet, cor, r * 1.0, r * 1.05), r * 0.6, G);
    put(cone([X, r * 0.3, Z + r * 1.65], [X, footTop - r * 0.2, Z + r * 1.1], r * 1.5, r * 1.15), r * 0.3, G, 'hoof');
  } else if (P.hoof === 'cloven') { // two toes, the cleft between, the dewclaws behind the fetlock
    const cor: V3 = [X, footTop, Z + r * 1.0];
    put(cone(fet, cor, r * 0.95, r * 0.95), r * 0.5, G);
    for (const s of [-1, 1]) put(cone([X + s * r * 0.5, r * 0.3, Z + r * 1.8], [X + s * r * 0.42, footTop - r * 0.15, Z + r * 0.85], r * 0.6, r * 0.7), r * 0.18, G, 'hoof');
    for (const s of [-1, 1]) put(ell([X + s * r * 0.5, fet[1] - r * 0.9, Z - r * 1.15], [r * 0.28, r * 0.35, r * 0.3]), r * 0.15, G, 'hoof');
  } else if (P.hoof === 'pad') { // the camel: a broad soft pad on two toes, their nails in front
    put(cone(fet, [X, footTop, Z + r * 0.8], r * 1.0, r * 1.1), r * 0.5, G);
    put(ell([X, r * 0.7, Z + r * 1.0], [r * 1.9, r * 0.75, r * 2.3]), r * 0.6, G, 'pad');
    for (const s of [-1, 1]) put(ell([X + s * r * 0.7, r * 0.5, Z + r * 3.0], [r * 0.4, r * 0.3, r * 0.35]), r * 0.15, G, 'claw');
  } else if (P.hoof === 'paw') { // the carnivore's (and the hare's) paw: the metacarpal pad, four toes, the claws
    put(cone(fet, [X, footTop, Z + r * 0.9], r * 1.0, r * 1.05), r * 0.5, G);
    put(ell([X, r * 0.9, Z + r * 1.1], [r * 1.35, r * 0.95, r * 1.6]), r * 0.6, G);
    for (let t = 0; t < 4; t++) { const a = (t - 1.5) * 0.42; put(ell([X + Math.sin(a) * r * 1.05, r * 0.62, Z + r * 1.1 + Math.cos(a) * r * 1.3], [r * 0.46, r * 0.55, r * 0.55]), r * 0.3, G);
      if (fam === 'canid' || fam === 'hare' || !fore) put(ell([X + Math.sin(a) * r * 1.15, r * 0.3, Z + r * 1.1 + Math.cos(a) * r * 1.85], [r * 0.14, r * 0.14, r * 0.3], [0, -0.5, 1]), r * 0.05, G, 'claw'); }
  }
}

function head(sp: Species, B: typeof ANIMAL_BUILD[Species], P: FP, fam: Family, R: Rig, put: Put, cut: Put, putAll: PutAll) {
  const H = B.head, hr = B.headR, u = R.hd, x: V3 = [1, 0, 0], v = nrm(cross(u, x)); // head frame: u along the head, v up across it
  const at = (a: number, b: number, c = 0): V3 => add(add(add(R.top, mul(u, a * H)), mul(v, b * hr)), [c * hr, 0, 0]);
  const G: Group = 'skull', carn = fam === 'canid' || fam === 'felid';
  if (carn) carnHead(sp, fam, at, u, v, hr, H, put, cut, putAll);
  else {
    // the head: one swept section from the poll to the muzzle (the family's profile: jowl, forehead, face, muzzle)
    putAll(sweep(P.head.map(([t, o, w, d]) => ({ p: at(t, o), rw: w * hr, rd: d * hr })), 6), hr * 0.12, G);
    putAll(sweep(P.jaw.map(([t, o, w, d]) => ({ p: at(t, o), rw: w * hr, rd: d * hr })), 6), hr * 0.3, G);
    const pr = (t: number) => prof(P.head, t), pjw = (t: number) => prof(P.jaw, t);
    // the forehead's flat and the brow, the cheekbone, the lower jaw's edge and the chin
    const pc = pjw(0.9);
    if (fam === 'suid') put(ell(at(1.0, -0.05), [hr * 0.44, hr * 0.4, H * 0.035], u), hr * 0.06, G, 'nose'); // the snout's disc
    // nostrils, the mouth's line
    const tn = fam === 'suid' ? 1.02 : 0.95, pn = pr(Math.min(tn, 0.95));
    for (const s of [-1, 1]) cut(ell(add(at(tn, pn[1] + (fam === 'suid' ? 0 : pn[3] * 0.1)), [s * pn[2] * hr * 0.45, 0, 0]), [hr * 0.08, hr * 0.12, hr * 0.13], add(u, mul(v, -0.2))), hr * 0.05, G, 'nose');
    if (fam !== 'suid') for (const s of [-1, 1]) cut(cone(add(at(0.95, pc[1] + pc[3] * 0.9), [s * pc[2] * hr * 0.6, 0, 0]), add(at(0.66, pjw(0.66)[1] + pjw(0.66)[3] * 0.95), [s * pjw(0.66)[2] * hr * 1.0, 0, 0]), hr * 0.035, hr * 0.02), hr * 0.03, G, 'mouth');
    // eyes set into the head's side under the brow (the grazers' on the side, the hunters' forward)
    { const pe = pr(P.eyeT), side = pe[2] * hr * (carn ? 0.78 : 0.86);
      for (const s of [-1, 1]) { const e = add(at(P.eyeT, pe[1] + P.eyeV * pe[3]), [s * side, 0, 0]);
        put(ell(e, [hr * 0.16, hr * 0.14, hr * 0.17], add(u, [s * (carn ? 0.3 : 0.6), 0, 0])), hr * 0.03, G, 'eye');
        put(ell(add(add(e, mul(v, hr * 0.17)), [-s * hr * 0.03, 0, 0]), [hr * 0.2, hr * 0.08, hr * 0.28], u), hr * 0.12, G); } }
  }
  const pr = (t: number) => prof(P.head, t);
  // ears
  const ear = B.ears;
  if (ear !== 'none') {
    const eL = ear === 'long' ? (sp.startsWith('mule') ? 0.16 : sp === 'hare' ? 0.12 : 0.22) : ear === 'mid' ? (fam === 'equid' ? 0.16 : fam === 'bovid' ? 0.16 : fam === 'cervid' ? 0.15 : 0.1) : ear === 'prick' ? (sp === 'fox' ? 0.085 : sp === 'hyena' ? 0.1 : 0.095) : (fam === 'felid' ? 0.06 : fam === 'camelid' ? 0.07 : 0.08);
    const EL = eL, p0 = pr(0.03);
    for (const s of [-1, 1]) {
      const root = add(at(0.03, p0[1] + p0[3] * 0.72), [s * p0[2] * hr * 0.55, 0, 0]);
      let dir: V3, wid: number, face: V3;
      if (ear === 'long' || ear === 'prick' || (ear === 'mid' && fam === 'equid')) { dir = [s * 0.25, 0.95, -0.15]; wid = EL * (ear === 'long' ? 0.36 : ear === 'prick' ? 0.62 : 0.45); face = [s * 0.25, 0, 1]; }
      else if (ear === 'mid' && (fam === 'bovid' || fam === 'caprine')) { dir = [s * 1, 0.12, -0.2]; wid = EL * 0.52; face = [0, 0.35, 1]; }
      else if (ear === 'mid') { dir = [s * 0.55, 0.8, -0.12]; wid = EL * 0.5; face = [s * 0.2, 0, 1]; }
      else if (fam === 'caprine') { dir = [s * 1, -0.35, -0.1]; wid = EL * 0.6; face = [0, 0.4, 1]; } // the sheep's and the urial's small drooping ears
      else { dir = [s * 0.45, 0.85, -0.15]; wid = EL * 0.85; face = [s * 0.25, 0, 1]; }            // small and round (the cats, the camels)
      const lf = leaf(root, dir, EL, wid, Math.max(0.014, EL * 0.11), face, fam === 'canid' || fam === 'felid' || ear === 'prick');
      put(lf.outer, hr * 0.1, G, 'coat', 'ear');
      cut(lf.cup, EL * 0.04, G, 'inner_ear');
    }
  }
  horns(sp, B, R, at, pr, hr, put);
}
/** the dogs', the wolf's, the fox's, the hyena's and the cats' heads (C, from skulls and photographs of the living animals):
 *  the round cranium behind the eyes, the cheek arches (the cats' wide), the stop where the forehead drops to the muzzle, the
 *  muzzle (the canids' about half the head, the cats' a third, broad and blunt, with whisker pads), the nose leather, the
 *  lower jaw and chin, eyes set forward under the brow */
function carnHead(sp: Species, fam: Family, at: (a: number, b: number, c?: number) => V3, u: V3, v: V3, hr: number, H: number, put: Put, cut: Put, putAll: PutAll) {
  const G: Group = 'skull', fel = fam === 'felid';
  const ts = fel ? (sp === 'cheetah' ? 0.72 : sp === 'lion' ? 0.68 : 0.7) : sp === 'hyena' ? 0.54 : sp === 'fox' ? 0.54 : 0.58;   // the stop
  const mw = sp === 'fox' ? 0.78 : sp === 'hyena' ? 1.2 : sp === 'lion' ? 1.12 : sp === 'cheetah' ? 0.85 : 1; // the muzzle's breadth
  const ck = fel ? (sp === 'lion' ? 1.35 : sp === 'cheetah' ? 1.05 : 1.22) : sp === 'hyena' ? 1.25 : sp === 'fox' ? 0.85 : 1; // the cheeks
  put(ell(at(0.24, 0.16), [hr * (fel ? 1.05 : 0.98), hr * (fel ? 1.0 : 0.92), H * (fel ? 0.32 : 0.28)], u), hr * 0.35, G); // the cranium
  put(ell(at(0.02, -0.02), [hr * 0.8, hr * 0.85, H * 0.14], u), hr * 0.35, G);                // its back, over the neck
  for (const q of [-1, 1]) put(ell(add(at(ts - 0.16, -0.32), [q * hr * 0.6 * ck, 0, 0]), [hr * 0.42 * ck, hr * 0.5, H * 0.17], u), hr * 0.3, G); // the cheek arches
  const m0 = fel ? { t: ts - 0.16, o: -0.1, w: 0.78, d: 0.66 } : { t: ts - 0.1, o: -0.08, w: 0.56, d: 0.6 };
  const m1 = fel ? { t: 0.88, o: -0.26, w: 0.56, d: 0.44 } : { t: 0.95, o: -0.3, w: 0.34, d: 0.32 };
  putAll(sweep([{ p: at(m0.t, m0.o), rw: m0.w * mw * hr, rd: m0.d * hr }, { p: at((m0.t + m1.t) / 2, (m0.o + m1.o) / 2 - 0.02), rw: (m0.w + m1.w) / 2 * mw * hr, rd: (m0.d + m1.d) / 2 * hr }, { p: at(m1.t, m1.o), rw: m1.w * mw * hr, rd: m1.d * hr }], 4), hr * 0.18, G);
  if (fel) for (const q of [-1, 1]) put(ell(add(at(0.82, -0.4), [q * hr * 0.26 * mw, 0, 0]), [hr * 0.22, hr * 0.22, H * 0.09], u), hr * 0.14, G); // the whisker pads
  putAll(sweep([{ p: at(0.3, -0.72), rw: hr * 0.7 * ck, rd: hr * 0.34 }, { p: at(0.62, -0.72), rw: hr * 0.5 * mw, rd: hr * 0.28 }, { p: at(fel ? 0.8 : 0.88, fel ? -0.6 : -0.58), rw: hr * (fel ? 0.36 : 0.24) * mw, rd: hr * (fel ? 0.24 : 0.16) }], 3), hr * 0.2, G); // the lower jaw
  put(ell(at(fel ? 0.93 : 0.99, fel ? -0.2 : -0.16), [hr * (fel ? 0.22 : 0.26) * mw, hr * 0.16, H * 0.025], u), hr * 0.08, G, 'nose'); // the nose leather
  for (const q of [-1, 1]) cut(ell(add(at(fel ? 0.955 : 1.0, fel ? -0.24 : -0.2), [q * hr * 0.14 * mw, 0, 0]), [hr * 0.06, hr * 0.06, hr * 0.08], u), hr * 0.03, G, 'nose');
  for (const q of [-1, 1]) cut(cone(add(at(0.96, fel ? -0.52 : -0.46), [q * hr * 0.1, 0, 0]), add(at(ts + 0.1, -0.56), [q * hr * 0.4 * mw, 0, 0]), hr * 0.012, hr * 0.008), hr * 0.012, G, 'mouth');
  // the eyes, forward, under the brow at the stop
  for (const q of [-1, 1]) { const e = add(at(ts - 0.12, fel ? 0.12 : 0.18), [q * hr * (fel ? 0.55 : 0.58), 0, 0]);
    put(ell(e, [hr * 0.15, hr * 0.13, hr * 0.15], add(u, [q * 0.35, 0, 0])), hr * 0.03, G, 'eye');
    put(ell(add(e, mul(v, hr * 0.16)), [hr * 0.2, hr * 0.08, hr * 0.22], u), hr * 0.1, G); }
}
function horns(sp: Species, B: typeof ANIMAL_BUILD[Species], R: Rig, at: (a: number, b: number, c?: number) => V3, pr: (t: number) => Row, hr: number, put: Put) {
  const G: Group = 'skull', p0 = pr(0.06);
  const curve = (s: number, root: V3, steps: V3[], r0: number, r1: number) => { const pts = [root]; let p = root; for (const d of steps) { p = add(p, [s * d[0], d[1], d[2]]); pts.push(p); } for (const t of tube(pts, r0, r1)) put(t, r0 * 0.25, G, 'horn'); };
  for (const s of [-1, 1]) {
    const root = add(at(0.08, p0[1] + p0[3] * 0.75), [s * p0[2] * hr * 0.35, 0, 0]);
    if (B.horns === 'goat' && sp !== 'urial') { const big = sp === 'wild_goat' ? 1.9 : 1; // the goat's back-curved horns; the bezoar's long scimitars
      const st: V3[] = []; for (let i = 0; i < 7; i++) { const a = 0.45 + i * 0.22; st.push([0.012 * big, 0.055 * big * Math.cos(a), -0.055 * big * Math.sin(a)]); }
      curve(s, root, st, 0.022 * Math.sqrt(big), 0.006); }
    else if (sp === 'urial') { // the urial's heavy horns curling back, down and forward round the ear (the old form's goat horns replaced)
      const st: V3[] = []; for (let i = 0; i < 12; i++) { const a = -0.3 + i * 0.42; st.push([0.012, 0.045 * Math.cos(a), -0.045 * Math.sin(a)]); }
      curve(s, add(root, [s * hr * 0.1, 0, 0]), st, 0.03, 0.01); }
    else if (B.horns === 'ox') { const zb = sp === 'zebu' || sp === 'cow' ? 0.8 : 1;
      curve(s, add(at(0.02, p0[1] + p0[3] * 0.7), [s * p0[2] * hr * 0.8, 0, 0]), ([[0.08, 0.01, 0.02], [0.07, 0.03, 0.04], [0.03, 0.06, 0.04], [0.0, 0.06, 0.02]] as V3[]).map(d => mul(d, zb)), 0.032, 0.008); }
    else if (B.horns === 'gazelle') curve(s, root, [[0.012, 0.07, -0.04], [0.016, 0.06, -0.04], [0.0, 0.06, -0.01], [-0.012, 0.05, 0.02]], 0.013, 0.004);
    else if (B.horns === 'antler') { // the Mesopotamian fallow buck: burr, a long beam curving out, back and up, brow and trez tines, a small crown palm with points (C)
      const a0 = add(at(0.06, p0[1] + p0[3] * 0.7), [s * hr * 0.4, 0, 0]);
      put(ell(a0, [0.024, 0.014, 0.024], [0, 1, 0]), 0.004, G, 'horn');                                        // the burr
      const beam: V3[] = [a0, add(a0, [s * 0.05, 0.1, -0.04]), add(a0, [s * 0.11, 0.22, -0.09]), add(a0, [s * 0.14, 0.33, -0.11]), add(a0, [s * 0.14, 0.43, -0.07])];
      for (const t of tube(beam, 0.02, 0.012)) put(t, 0.004, G, 'horn');
      for (const t of tube([add(a0, [s * 0.01, 0.03, 0.01]), add(a0, [s * 0.03, 0.07, 0.08]), add(a0, [s * 0.04, 0.12, 0.13])], 0.011, 0.004)) put(t, 0.003, G, 'horn'); // brow tine
      for (const t of tube([beam[2], add(beam[2], [s * 0.02, 0.05, 0.07]), add(beam[2], [s * 0.03, 0.11, 0.1])], 0.009, 0.003)) put(t, 0.003, G, 'horn'); // trez tine
      const palm = add(beam[4], [s * 0.01, 0.03, -0.03]); put(ell(palm, [0.012, 0.035, 0.07], [0, 0.8, -0.6]), 0.008, G, 'horn');
      for (let j = 0; j < 3; j++) { const q0 = add(palm, [s * 0.005, 0.02 + 0.01 * j, 0.03 - 0.035 * j]); for (const t of tube([q0, add(q0, [s * 0.015, 0.06, -0.015 * j])], 0.007, 0.002)) put(t, 0.003, G, 'horn'); }
    }
  }
}
function tail(sp: Species, B: typeof ANIMAL_BUILD[Species], fam: Family, R: Rig, g: number, L: number, put: Put, putAll: PutAll) {
  const tr = R.tailRoot, G: Group = 'tail', t = B.tail, S = (p: V3, rw: number, rd = rw): SP => ({ p, rw, rd });
  if (t === 'curl') putAll(sweep([S(tr, 0.036), S(add(tr, [0, 0.1, -0.06]), 0.034), S(add(tr, [0, 0.18, -0.03]), 0.03), S(add(tr, [0.03, 0.2, 0.06]), 0.025), S(add(tr, [0.045, 0.15, 0.1]), 0.018)], 3), 0.02, G);
  else if (t === 'brush') { const k = B.h / 0.78;
    putAll(sweep([S(tr, 0.035 * k), S(add(tr, [0, -0.1 * k, -0.1 * k]), 0.05 * k), S(add(tr, [0, -0.25 * k, -0.15 * k]), 0.065 * k, 0.07 * k), S(add(tr, [0, -0.38 * k, -0.16 * k]), 0.045 * k), S(add(tr, [0, -0.43 * k, -0.15 * k]), 0.02 * k)], 3), 0.02 * k, G, 'tailhair'); }
  else if (t === 'cat') { const Lt = L * 0.55, rr = 0.028 * g / 0.4;
    const pts: V3[] = [tr, add(tr, [0, -Lt * 0.3, -Lt * 0.2]), add(tr, [0, -Lt * 0.58, -Lt * 0.32]), add(tr, [0, -Lt * 0.78, -Lt * 0.5]), add(tr, [0, -Lt * 0.72, -Lt * 0.68])];
    putAll(sweep(pts.map((p, i) => S(p, rr * (1.25 - i * 0.1))), 3), rr * 0.5, G);
    if (sp === 'lion' || sp === 'lioness') put(ell(add(pts[4], [0, 0.02, -0.02]), [rr * 1.4, rr * 1.4, rr * 2.4], [0, 1, -0.5]), rr * 0.5, G, 'tailhair'); }
  else if (t === 'hen' || t === 'cock') { /* the fowl: fowl() */ }
  else if (t === 'fat') putAll(sweep([S(tr, 0.03), S(add(tr, [0, -0.12, -0.04]), 0.025)], 2), 0.02, G);
  else if (t === 'short') { const up = fam === 'cervid' || fam === 'antelope' || fam === 'hare'; const tl = fam === 'hare' ? 0.07 : fam === 'cervid' ? 0.17 : 0.11;
    putAll(sweep([S(tr, 0.03 * g / 0.4, 0.035 * g / 0.4), S(add(tr, up ? [0, tl * 0.05, -tl * 0.5] : [0, -tl * 0.6, -tl * 0.3]), 0.026 * g / 0.4, 0.03 * g / 0.4), S(add(tr, up ? [0, -tl * 0.4, -tl * 0.75] : [0, -tl, -tl * 0.35]), 0.012)], 3), 0.02, G, fam === 'antelope' ? 'tailhair' : 'coat'); }
  else { // 'hair' (the horse's and the mule's long tail of hair), 'tuft' (the ass's, the cattle's, the camel's, the boar's: a thin tail with a tuft)
    const tl = t === 'hair' ? 0.72 : fam === 'bovid' ? 0.8 : fam === 'camelid' ? 0.45 : fam === 'suid' ? 0.28 : 0.46;
    if (t === 'hair') {
      putAll(sweep([S(tr, 0.05, 0.055), S(add(tr, [0, -0.07, -0.07]), 0.045, 0.05), S(add(tr, [0, -0.2, -0.1]), 0.035, 0.04)], 3), 0.03, G);
      putAll(sweep([S(add(tr, [0, -0.02, -0.08]), 0.05, 0.055), S(add(tr, [0, -0.22, -0.13]), 0.07, 0.065), S(add(tr, [0, -0.48, -0.14]), 0.075, 0.06), S(add(tr, [0, -tl, -0.1]), 0.04, 0.03)], 4), 0.03, G, 'tailhair');
    } else {
      const bend = fam === 'suid' ? 0.3 : 0;
      putAll(sweep([S(tr, 0.03, 0.034), S(add(tr, [0, -0.06, -0.06]), 0.024), S(add(tr, [0, -tl * 0.5, -0.1 - bend * 0.1]), 0.018), S(add(tr, [0, -tl * 0.85, -0.09]), 0.013)], 3), 0.015, G);
      putAll(sweep([S(add(tr, [0, -tl * 0.78, -0.09]), 0.022), S(add(tr, [0, -tl * 0.95, -0.085]), 0.04, 0.035), S(add(tr, [0, -tl * 1.1, -0.08]), 0.02)], 3), 0.015, G, 'tailhair');
    }
  }
}
function extras(sp: Species, B: typeof ANIMAL_BUILD[Species], fam: Family, R: Rig, T: { g: number; L: number; by: number; bellyY: number; backY: number; yz: (z: number) => number }, put: Put, cut: Put) {
  const { g, L, by, bellyY, backY } = T;
  if (B.humps === 2) for (const z of [0.2, -0.2]) { put(ell([0, backY + 0.02 * g, z * L], [0.2 * g, 0.28 * g, 0.13 * L]), 0.12 * g, 'body'); put(ell([0, backY + 0.2 * g, z * L - 0.02], [0.1 * g, 0.1 * g, 0.08 * L], [0, 0.3, -1]), 0.08 * g, 'body', 'wool'); }
  if (B.humps === 1) put(ell([0, backY - 0.02 * g, -0.02 * L], [0.28 * g, 0.36 * g, 0.24 * L]), 0.16 * g, 'body');
  if (fam === 'camelid') { // the camel's chest pad and the callosities of the knees; the Bactrian's woolly throat, forearms and hump tops
    put(ell([0, bellyY + 0.035, 0.3 * L], [0.1 * g, 0.045 * g, 0.09 * L]), 0.06 * g, 'body', 'pad');
    if (B.humps === 2) { const t = lerp3(R.base, R.top, 0.45), n = nrm(cross(R.neckDir, [1, 0, 0])); put(ell(add(t, mul(n, -0.1)), [0.1, 0.16, 0.22], R.neckDir), 0.06, 'head', 'wool');
      for (const lg of R.legs.filter(l => l.fore > 0)) put(ell([lg.x, bellyY - 0.05, lg.z + 0.02], [0.09, 0.14, 0.09]), 0.05, `leg${R.legs.indexOf(lg)}` as Group, 'wool'); }
  }
  if (B.withers) { put(ell([0, backY + 0.08 * g, 0.3 * L], [0.17 * g, 0.3 * g, 0.12 * L], [0, 0.4, 1]), 0.1 * g, 'body'); }
  if (B.udder) { put(ell([0, bellyY - 0.02, -0.26 * L], [0.16 * g, 0.12 * g, 0.12 * L]), 0.06 * g, 'body', 'udder');
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) put(cone([sx * 0.05 * g, bellyY - 0.06, -0.26 * L + sz * 0.05 * g], [sx * 0.055 * g, bellyY - 0.12, -0.26 * L + sz * 0.055 * g], 0.012, 0.009), 0.01, 'body', 'udder'); }
  if (B.tail === 'fat') { const tr = R.tailRoot; put(ell(add(tr, [0, -0.1, -0.02]), [0.16 * g / 0.44, 0.13, 0.08]), 0.06, 'tail', 'wool'); for (const s of [-1, 1]) put(ell(add(tr, [s * 0.05, -0.17, -0.03]), [0.07, 0.08, 0.07]), 0.04, 'tail', 'wool'); }
  if (sp === 'sheep') { // the fleece: a shell over the torso, the neck and the thighs (its locks are the bake's relief)
    put(ell([0, by + 0.04 * g, 0.02 * L], [0.54 * g, 0.6 * g, 0.53 * L]), 0.12 * g, 'body', 'wool');
    put(ell(lerp3(R.base, R.top, 0.35), [0.28 * g, 0.34 * g, B.neck * 0.45], R.neckDir), 0.1 * g, 'head', 'wool');
  }
  if (sp === 'goat' || sp === 'wild_goat') put(ell(add(R.muzzle, [0, -B.headR * 1.1, -0.1]), [0.02, 0.03, 0.07], [0, -1, 0.3]), 0.015, 'skull', 'tailhair'); // the beard
  if (fam === 'suid') { // the boar's bristle crest along the neck and back, tusks
    for (let i = 0; i <= 8; i++) { const z = 0.45 * L - i * 0.1 * L; put(ell([0, backY + T.yz(z) + 0.03 - Math.abs(z) * 0.05, z], [0.03, 0.07, 0.07]), 0.03, 'body', 'mane'); }
    for (const s of [-1, 1]) { const a = add(R.muzzle, [s * B.headR * 0.5, -0.05, -0.1]); for (const t of tube([a, add(a, [s * 0.02, 0.035, 0.03]), add(a, [s * 0.025, 0.07, 0.02])], 0.011, 0.004)) put(t, 0.003, 'skull', 'tusk'); }
  }
  if (sp === 'hyena') for (const q of sweep([0.46, 0.3, 0.1, -0.1, -0.3].map((t, i) => ({ p: [0, backY + T.yz(t * L) - 0.005 - i * 0.004, t * L] as V3, rw: 0.018, rd: 0.035 - i * 0.004 })), 3)) put(q, 0.02, 'body', 'mane');

  // ---- gear
  if (B.gear === 'pack' || B.gear === 'pack_camel' || B.gear === 'saddle') gear(sp, B, R, T, put);
}
function gear(sp: Species, B: typeof ANIMAL_BUILD[Species], R: Rig, T: { g: number; L: number; by: number; bellyY: number; backY: number }, put: Put) {
  const { g, L, by, backY } = T, G: Group = 'gear';
  // the body's barrel as a shell a cloth or a girth lies on (the torso's ellipsoid, +1.5 cm)
  const rx = g * 0.46 + 0.02, ry = g * 0.52 + 0.02, rz = L * 0.5;
  const barrel = (x: number, y: number, z: number) => sdEllipsoid(x, y - by, z, rx, ry, rz);
  if (B.gear === 'saddle') { // the saddle cloth (the Apadana horses' shabrack: B imagery, its cut C): a 1 cm cloth over 0.36 of the body, a girth
    const zs = L * 0.06, f = (x: number, y: number, z: number) => Math.max(Math.abs(barrel(x, y, z) + 0.004) - 0.007, Math.abs(z - zs) - L * 0.18, by - 0.12 * g - y);
    put({ f, c: [0, by, zs], R: Math.hypot(rx, ry, L * 0.2) }, 0.004, G, 'cloth');
    const gz = zs + L * 0.12, fg = (x: number, y: number, z: number) => Math.max(Math.abs(barrel(x, y, z) + 0.006) - 0.006, Math.abs(z - gz) - 0.03);
    put({ f: fg, c: [0, by, gz], R: Math.hypot(rx, ry) + 0.05 }, 0.003, G, 'rope');
    return;
  }
  const zc = B.gear === 'pack' ? -0.04 * L : 0.02 * L;
  if (B.gear === 'pack') { // a pack saddle pad, two wicker panniers hanging each side, a sack across the top, the girth
    const pad = (x: number, y: number, z: number) => Math.max(Math.abs(barrel(x, y, z) + 0.01) - 0.02, Math.abs(z - zc) - L * 0.2, by + 0.1 * g - y);
    put({ f: pad, c: [0, backY, zc], R: Math.hypot(rx, L * 0.25) }, 0.01, G, 'pad_saddle');
    for (const s of [-1, 1]) { const cx = s * (g * 0.46 + 0.12), cy = by + 0.06 * g;
      const bask = (x: number, y: number, z: number) => { const q = sdEllipsoid(x - cx, y - cy, z - zc, 0.12, g * 0.36, L * 0.2); return Math.max(q, Math.abs(y - cy) - g * 0.3); };
      put({ f: bask, c: [cx, cy, zc], R: Math.max(g * 0.36, L * 0.2) + 0.02 }, 0.01, G, 'wicker');
      put(cone([s * rx * 0.7, backY + 0.02, zc - 0.1], [cx, cy + g * 0.3, zc - 0.1], 0.008, 0.008), 0.003, G, 'rope');
      put(cone([s * rx * 0.7, backY + 0.02, zc + 0.1], [cx, cy + g * 0.3, zc + 0.1], 0.008, 0.008), 0.003, G, 'rope'); }
    put(ell([0, backY + 0.13, zc], [g * 0.62, 0.11, 0.12], [0, 0, 1]), 0.03, G, 'sack');
    const gz = zc + L * 0.1, fg = (x: number, y: number, z: number) => Math.max(Math.abs(barrel(x, y, z) + 0.006) - 0.006, Math.abs(z - gz) - 0.025);
    put({ f: fg, c: [0, by, gz], R: Math.hypot(rx, ry) + 0.05 }, 0.003, G, 'rope');
  } else { // the Bactrian's load: two great sacks slung each side, a bundle between the humps, the ropes
    for (const s of [-1, 1]) put(ell([s * (g * 0.46 + 0.17), by + 0.18 * g, zc], [0.19, 0.24, L * 0.26]), 0.05, G, 'sack');
    put(ell([0, backY + 0.22 * g, zc], [g * 0.72, 0.15, 0.17], [0, 0, 1]), 0.05, G, 'sack');
    for (const dz of [-0.14, 0.14]) { const gz = zc + dz, fg = (x: number, y: number, z: number) => Math.max(Math.abs(barrel(x, y, z) + 0.01) - 0.008, Math.abs(z - gz) - 0.018); put({ f: fg, c: [0, by, gz], R: Math.hypot(rx, ry) + 0.05 }, 0.003, G, 'rope'); }
  }
}
/** the fowl (red-junglefowl type): the egg of the body with the breast forward, the folded wings, the saddle and the tail
 *  (the hen's upright fan; the cock's arched sickles), the hackled neck, the small head with comb, wattles and beak, the
 *  feathered thighs, the scaled shanks and four toes */
function fowl(sp: Species, B: typeof ANIMAL_BUILD[Species], R: Rig, put: Put, cut: Put) {
  const g = B.girth, L = B.len, by = R.bodyY, ck = sp === 'cock';
  const putAll = (ss: { f: Prim['f']; c: V3; R: number }[], k: number, group: Group, part: Part) => { for (const q of ss) put(q, k, group, part); };
  // the body: a deep keel under a back that rises to the tail, the breast full and forward, the folded wings along the sides
  putAll(sweep([{ p: [0, by + 0.12 * g, 0.36 * L], rw: 0.32 * g, rd: 0.38 * g }, { p: [0, by + 0.02 * g, 0.2 * L], rw: 0.47 * g, rd: 0.57 * g }, { p: [0, by - 0.02 * g, -0.04 * L], rw: 0.46 * g, rd: 0.52 * g },
    { p: [0, by + 0.1 * g, -0.26 * L], rw: 0.36 * g, rd: 0.38 * g }, { p: [0, by + 0.24 * g, -0.4 * L], rw: 0.16 * g, rd: 0.18 * g }], 5), 0.03, 'body', 'feather');
  for (const q of [-1, 1]) putAll(sweep([{ p: [q * 0.36 * g, by + 0.1 * g, 0.18 * L], rw: 0.08 * g, rd: 0.18 * g }, { p: [q * 0.42 * g, by + 0.06 * g, -0.06 * L], rw: 0.1 * g, rd: 0.3 * g }, { p: [q * 0.3 * g, by + 0.06 * g, -0.34 * L], rw: 0.06 * g, rd: 0.12 * g }], 4), 0.015, 'body', 'feather');
  // the tail: the hen's a narrow upright fan; the cock's broad sickles arching up, over and down, over the saddle's hackles
  const tb: V3 = [0, by + 0.24 * g, -0.4 * L];
  if (!ck) putAll(sweep([{ p: tb, rw: 0.022, rd: 0.03 }, { p: add(tb, [0, 0.06, -0.035]), rw: 0.014, rd: 0.04 }, { p: add(tb, [0, 0.1, -0.05]), rw: 0.007, rd: 0.025 }], 4), 0.012, 'tail', 'feather');
  else { putAll(sweep([{ p: tb, rw: 0.035, rd: 0.035 }, { p: add(tb, [0, 0.08, -0.05]), rw: 0.025, rd: 0.03 }, { p: add(tb, [0, 0.14, -0.07]), rw: 0.012, rd: 0.02 }], 4), 0.015, 'tail', 'sickle');
    for (const q of [-1, 0, 1]) putAll(sweep([{ p: add(tb, [q * 0.01, 0.02, 0]), rw: 0.006, rd: 0.022 }, { p: add(tb, [q * 0.016, 0.15, -0.06]), rw: 0.006, rd: 0.022 }, { p: add(tb, [q * 0.02, 0.2, -0.15]), rw: 0.005, rd: 0.018 },
      { p: add(tb, [q * 0.02, 0.15, -0.25]), rw: 0.004, rd: 0.012 }, { p: add(tb, [q * 0.018, 0.05, -0.3]), rw: 0.003, rd: 0.006 }], 4), 0.004, 'tail', 'sickle');
    for (const q of [-1, 1]) put(ell([q * 0.2 * g, by + 0.3 * g, -0.3 * L], [0.1 * g, 0.12 * g, 0.18 * L], [0, -0.6, -1]), 0.02, 'body', 'feather'); } // the saddle hackles
  // the neck, short and thick with hackles, the small head, the beak, the eyes
  const H = B.head, hr = B.headR, u = R.hd, v = nrm(cross(u, [1, 0, 0])), at = (a: number, b: number): V3 => add(add(R.top, mul(u, a * H)), mul(v, b * hr));
  putAll(sweep([{ p: add(R.base, [0, 0.03, -0.02]), rw: g * 0.34, rd: g * 0.36 }, { p: lerp3(R.base, R.top, 0.55), rw: g * (ck ? 0.2 : 0.17), rd: g * (ck ? 0.22 : 0.19) }, { p: at(0.1, -0.1), rw: hr * 0.95, rd: hr * 1.0 }], 4), 0.015, 'head', 'feather');
  put(ell(at(0.25, 0.15), [hr * 0.9, hr * 0.95, hr * 1.25], u), 0.01, 'skull', 'feather');
  putAll(sweep([{ p: at(0.55, 0.05), rw: hr * 0.34, rd: hr * 0.36 }, { p: at(0.8, -0.1), rw: hr * 0.2, rd: hr * 0.2 }, { p: at(0.98, -0.3), rw: hr * 0.05, rd: hr * 0.05 }], 3), 0.004, 'skull', 'beak');
  for (const q of [-1, 1]) put(ell(add(at(0.33, 0.28), [q * hr * 0.72, 0, 0]), [hr * 0.17, hr * 0.17, hr * 0.17]), 0.003, 'skull', 'eye');
  // the single comb (a serrated blade from the beak's base over the crown: the cock's tall with five points, the hen's low),
  // the wattles under the beak, the ear lobes
  const cs = ck ? 1 : 0.45, cl = 0.004 * (ck ? 1.2 : 1);
  putAll(sweep([{ p: at(0.55, 0.7), rw: cl, rd: 0.008 * cs }, { p: at(0.3, 1.0), rw: cl, rd: 0.014 * cs }, { p: at(0.0, 0.95), rw: cl, rd: 0.012 * cs }], 3), 0.003, 'skull', 'comb');
  for (let i = 0; i < 5; i++) { const t = 0.5 - i * 0.12, c0 = at(t, 1.0 + 0.2 * Math.sin((i / 4) * Math.PI)); put(ell(add(c0, mul(v, 0.016 * cs)), [cl, 0.007 * cs, 0.013 * cs], v), 0.003, 'skull', 'comb'); }
  for (const q of [-1, 1]) put(ell(add(at(0.6, -1.25), [q * 0.006, 0, 0]), [0.006, 0.01 * cs, 0.022 * cs], v), 0.004, 'skull', 'comb');
  for (const q of [-1, 1]) put(ell(add(at(0.1, -0.35), [q * hr * 0.85, 0, 0]), [hr * 0.08, hr * 0.22, hr * 0.18], u), 0.003, 'skull', ck ? 'comb' : 'feather');
  // legs: the feathered thigh, the scaled shank (yellow), the spur of the cock, four toes (three forward, one back)
  R.legs.forEach((lg, i) => { const G = `leg${i}` as Group, X = lg.x, r = B.leg;
    put(ell([X, R.hipY + 0.005, lg.z], [r * 2.8, r * 3.4, r * 3.0]), 0.012, G, 'feather');
    const hock: V3 = [X, R.kneeY, lg.zk], ft: V3 = [X, r * 0.8, lg.zk + 0.005];
    put(cone([X, R.hipY - r * 2, lg.z], hock, r * 1.8, r * 1.1), 0.008, G, 'feather');
    put(cone(hock, ft, r * 0.85, r * 0.75), 0.004, G, 'shank');
    if (ck) put(cone(lerp3(hock, ft, 0.6), add(lerp3(hock, ft, 0.6), [0, 0.004, -0.018]), r * 0.35, r * 0.1), 0.002, G, 'shank');
    for (const a of [-0.45, 0, 0.45]) put(cone(ft, add(ft, [Math.sin(a) * 0.045, -r * 0.3, Math.cos(a) * 0.045]), r * 0.5, r * 0.32), 0.003, G, 'shank');
    put(cone(ft, add(ft, [0, -r * 0.2, -0.025]), r * 0.45, r * 0.3), 0.003, G, 'shank'); });
  void cut;
}

// ---------------------------------------------------------------------------------------------------------- evaluation
export interface Eval { d: number; part: Part; group: Group; tag?: string }
/** the signed distance of the body at p, with the part the nearest primitive gives it */
export function evalForm(F: Form, x: number, y: number, z: number, out: Eval = { d: 0, part: 'coat', group: 'body' }): Eval {
  let d = 1e9, best = 1e9, bp: Prim | null = null;
  for (const p of F.prims) {
    const lb = Math.sqrt((x - p.c[0]) ** 2 + (y - p.c[1]) ** 2 + (z - p.c[2]) ** 2) - p.R;
    if (lb > d + p.k && lb > best) continue;
    const v = p.f(x, y, z); d = smin(d, v, p.k); if (v < best) { best = v; bp = p; }
  }
  let part = bp?.part ?? 'coat', group = bp?.group ?? 'body'; const tag = bp?.tag;
  for (const s of F.subs) {
    const lb = Math.sqrt((x - s.c[0]) ** 2 + (y - s.c[1]) ** 2 + (z - s.c[2]) ** 2) - s.R; if (lb > s.k + 0.02) continue;
    const v = s.f(x, y, z), nd = smax(d, -v, s.k); if (v < 0.004) { part = s.part; group = s.group; } d = nd;
  }
  d = Math.max(d, -y); // the ground cuts the soles flat
  out.d = d; out.part = part; out.group = group; out.tag = tag; return out;
}
/** the plain SDF (for the polygoniser) */
export const formSDF = (F: Form) => { const e: Eval = { d: 0, part: 'coat', group: 'body' }; return (x: number, y: number, z: number) => evalForm(F, x, y, z, e).d; };

// ------------------------------------------------------------------------------------------------ relief (the bake's)
/** the coat's relief (m, outward) at a point of the dense source: hair streaks along the coat's flow, the fleece's locks, the
 *  mane's and the tail's strands, the feathers' rows, the horns' rings, the hooves' growth lines, the wicker's weave */
export function relief(F: Form, p: V3, part: Part, group: Group): number {
  const [x, y, z] = p, fam = F.fam;
  const flow: V3 = group.startsWith('leg') ? [0, -1, 0] : group === 'tail' ? [0, -0.9, -0.3] : group === 'head' || group === 'skull' ? nrm([0, -0.35, -1]) : nrm([0, -0.25 - 0.3 * clamp((F.rig.bodyY - y) / 0.3, 0, 1), -1]);
  switch (part) {
    case 'wool': { const w = worley(x / 0.022, y / 0.022, z / 0.022); return 0.009 * (0.55 - w) + 0.002 * fbm(x / 0.006, y / 0.006, z / 0.006, 2); }
    case 'mane': case 'tailhair': case 'ruff': return (part === 'ruff' ? 0.007 : 0.004) * streak(p, part === 'mane' ? [0, 1, 0] : flow, 0.005, 8) + (part === 'ruff' ? 0.006 * fbm(x / 0.04, y / 0.04, z / 0.04, 2) : 0);
    case 'feather': case 'sickle': { const row = Math.sin((z * 0.8 + y * 0.5) / 0.012 * Math.PI + 0.6 * vnoise(x / 0.02, y / 0.02, z / 0.02)); return 0.0012 * Math.max(0, row) + 0.0006 * streak(p, [0, -0.3, -1], 0.002, 6); }
    case 'horn': return 0.0012 * Math.sin(len3(sub(p, F.rig.top)) / 0.009 * Math.PI) + 0.0004 * vnoise(x / 0.003, y / 0.003, z / 0.003);
    case 'hoof': return 0.0005 * Math.sin(y / 0.004 * Math.PI) + 0.0004 * vnoise(x / 0.004, y / 0.02, z / 0.004);
    case 'wicker': return 0.004 * Math.sin(y / 0.02 * Math.PI) * Math.sin(z / 0.03 * Math.PI) + 0.0015 * vnoise(x / 0.005, y / 0.005, z / 0.005);
    case 'sack': case 'cloth': case 'pad_saddle': return 0.003 * fbm(x / 0.05, y / 0.05, z / 0.05, 2) + 0.0005 * Math.sin((x + y) / 0.002);
    case 'shank': return 0.0006 * Math.sin(y / 0.004 * Math.PI);
    case 'eye': case 'nose': case 'mouth': case 'comb': case 'beak': case 'tusk': case 'claw': case 'udder': case 'inner_ear': return 0;
    default: { // the coat: short hair's streaks, deeper for the long-coated (the wolf, the hyena, the fox, the Bactrian), muscle and skin folds
      const longc = fam === 'canid' || fam === 'camelid' || fam === 'suid' ? 1 : fam === 'felid' ? 0.6 : fam === 'hare' ? 0.8 : fam === 'caprine' ? 0.7 : 0.35;
      return 0.0014 * longc * streak(p, flow, 0.004, 6) + 0.0015 * fbm(x / 0.08, y / 0.08, z / 0.08, 2); }
  }
}

// ------------------------------------------------------------------------------------------------------ the coat
type RGBA = [number, number, number, number];
const srgb = (c: number) => (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
const S = (r: number, g: number, b: number): [number, number, number] => [srgb(r), srgb(g), srgb(b)];
const FIXED: Partial<Record<Part, [number, number, number]>> = {
  hoof: S(0.2, 0.17, 0.14), horn: S(0.55, 0.5, 0.4), eye: S(0.05, 0.035, 0.03), nose: S(0.12, 0.1, 0.09), mouth: S(0.1, 0.07, 0.07), inner_ear: S(0.62, 0.5, 0.46),
  udder: S(0.8, 0.6, 0.55), comb: S(0.66, 0.1, 0.08), beak: S(0.72, 0.62, 0.34), shank: S(0.7, 0.6, 0.32), tusk: S(0.86, 0.82, 0.72), claw: S(0.18, 0.16, 0.14), pad: S(0.5, 0.44, 0.38),
  cloth: S(0.55, 0.14, 0.1), wicker: S(0.58, 0.47, 0.3), sack: S(0.64, 0.58, 0.46), rope: S(0.5, 0.42, 0.3), pad_saddle: S(0.35, 0.22, 0.14),
};
/** the albedo at a point of the dense source: RGB (linear) and the coat mask A. Where A = 1 the game multiplies RGB x 2 by
 *  the instance's coat colour (0.5 = the coat itself; the hair's grain and the family's marks as lighter or darker); where
 *  A = 0, RGB is the colour itself (hooves, horns, eyes, the nose, the gear, a white belly, a dark mane). Species' marks
 *  (C, from the living animals): the pale bellies and inner legs of the wild ones, the donkey's pale muzzle and belly and its
 *  cross, the onager's dorsal stripe, the bay horse's black points, the fallow deer's spots and white rump, the gazelle's
 *  flank band and face stripes, the fox's white tip and dark stockings, the leopard's rosettes, the cheetah's spots and tear
 *  marks, the hyena's stripes, the lion's dark mane and tail tuft, the wolf's saddle, the cattle's pale muzzle. */
export function coat(F: Form, p: V3, part: Part, group: Group, tag?: string): RGBA {
  const [x, y, z] = p, sp = F.sp, fam = F.fam, R = F.rig, grain = 0.5 * (1 + 0.1 * fbm(x / 0.01, y / 0.01, z / 0.01, 2) + 0.06 * fbm(x / 0.07, y / 0.07, z / 0.07, 2));
  const fx = FIXED[part];
  if (part === 'horn' && (sp === 'gazelle_m' || sp === 'wild_goat' || sp === 'urial')) return [...S(0.28, 0.24, 0.2), 0];
  if (part === 'horn' && sp === 'stag') return [...S(0.52, 0.44, 0.34), 0];
  if (part === 'hoof' && (fam === 'equid' && sp !== 'donkey' && !sp.startsWith('donkey'))) return [...S(0.26, 0.23, 0.2), 0];
  if (part === 'eye' || part === 'nose' || part === 'mouth') return [...fx!, 0];
  if (fx && part !== 'inner_ear') return [fx[0] * (1 + 0.15 * vnoise(x / 0.01, y / 0.01, z / 0.01)), fx[1] * (1 + 0.15 * vnoise(x / 0.01, y / 0.01, z / 0.01)), fx[2] * (1 + 0.15 * vnoise(x / 0.01, y / 0.01, z / 0.01)), 0];
  // positions in the body's terms
  const vy = clamp((y - F.bellyY) / (F.backY - F.bellyY), 0, 1); // 0 belly .. 1 back
  const legY = y / Math.max(0.05, R.kneeY), onLeg = group.startsWith('leg');
  const head = group === 'head' || group === 'skull', hu = head ? dot(sub(p, R.top), R.hd) / (ANIMAL_BUILD[sp].head) : 0; // 0 poll .. 1 muzzle
  const inner = onLeg ? clamp(1 - Math.abs(x) / Math.abs(R.legs[+group[3]]?.x || 1), 0, 1) : 0;
  let k = grain, a = 1, abs: [number, number, number] | null = null, w = 0; // w: the share of `abs`
  const pale = (c: [number, number, number], s: number) => { if (s > w) { abs = c; w = s; } };
  const shade = (m: number) => { k *= m; };
  if (part === 'inner_ear') { pale(S(0.66, 0.56, 0.5), 0.75); }
  if (part === 'mane' || part === 'tailhair') {
    if (fam === 'equid') { if (sp === 'donkey' || sp.startsWith('donkey') || sp === 'onager') shade(0.55); else pale(S(0.08, 0.06, 0.05), 0.85); }
    else if (sp === 'lion' || sp === 'lioness') pale(S(0.14, 0.09, 0.06), 0.9);
    else if (sp === 'fox') { const tip = clamp((R.tailRoot[1] - 0.26 * ANIMAL_BUILD.fox.h / 0.78 - y) / 0.05, 0, 1); pale(S(0.88, 0.86, 0.8), tip); if (!tip) shade(0.85); }
    else if (fam === 'bovid' || fam === 'camelid' || fam === 'suid') pale(S(0.1, 0.08, 0.07), 0.8);
    else if (fam === 'antelope') pale(S(0.12, 0.1, 0.08), 0.85);
    else shade(0.7);
  }
  if (part === 'ruff') { pale(S(0.3, 0.19, 0.1), 0.8); shade(0.8); }
  if (part === 'wool') { shade(1.02 + 0.2 * (worley(x / 0.022, y / 0.022, z / 0.022) - 0.4)); if (vy < 0.2 && group === 'body') shade(0.75); }
  if (part === 'feather' || part === 'sickle') {
    if (sp === 'cock') { // the red-junglefowl cock: the hackles gold, the back red-brown, the breast and tail black-green, the wing's bar
      if (part === 'sickle' || (group === 'body' && vy < 0.45 && z > -0.1)) pale(S(0.05, 0.07, 0.06), 0.95);
      else if (head) pale(S(0.85, 0.55, 0.2), 0.7);
    } else if (group === 'body' && vy < 0.35) shade(1.12);
    shade(1 + 0.12 * Math.sin((z * 0.8 + y * 0.5) / 0.012 * Math.PI));
  }
  // the family's and the species' marks
  const belly = group === 'body' ? 1 - smoothstep(0.12, 0.42, vy) : 0, chin = head && hu > 0.15 ? smoothstep(-0.5, -0.9, dot(sub(p, R.top), nrm(cross(R.hd, [1, 0, 0]))) / ANIMAL_BUILD[sp].headR) : 0;
  const muzzleEnd = head ? smoothstep(0.72, 0.9, hu) : 0;
  switch (sp) {
    case 'donkey': case 'donkey_pack': { pale(S(0.78, 0.74, 0.68), Math.max(belly * 0.85, muzzleEnd * 0.9, inner * 0.6 * (1 - legY * 0.3)));
      if (head) { const eye = R.legs.length && Math.abs(hu - 0.2) < 0.12 ? smoothstep(0.35, 0.8, Math.abs(x) / ANIMAL_BUILD[sp].headR) : 0; pale(S(0.72, 0.68, 0.62), eye * 0.5); }
      if (group === 'body' && Math.abs(x) < 0.025 && vy > 0.8) shade(0.45);                                               // the dorsal stripe
      if (group === "body" && Math.abs(z - 0.3 * ANIMAL_BUILD[sp].len) < 0.014 && vy > 0.62) shade(0.72);                 // and the shoulder cross
      if (onLeg && legY < 0.4) shade(0.85); break; }
    case 'onager': { pale(S(0.88, 0.84, 0.76), Math.max(belly, inner * 0.8, muzzleEnd * 0.8, chin * 0.7)); if (group === 'body' && Math.abs(x) < 0.03 && vy > 0.75) pale(S(0.25, 0.18, 0.12), 0.8); break; }
    case 'horse': case 'horse_saddle': case 'mule': case 'mule_pack': { if (onLeg) pale(S(0.07, 0.06, 0.05), smoothstep(0.95, 0.55, legY) * 0.9); // the bay's black points
      if (head) shade(1 - 0.25 * muzzleEnd); if (sp.startsWith('mule')) pale(S(0.55, 0.46, 0.38), muzzleEnd * 0.6); break; }
    case 'ox': case 'cow': case 'calf': case 'zebu': { pale(S(0.8, 0.74, 0.66), muzzleEnd * (sp === 'zebu' ? 0.2 : 0.55)); if (head && muzzleEnd > 0.6) pale(S(0.2, 0.17, 0.16), (muzzleEnd - 0.6) * 1.6);
      if (sp === 'zebu' && head) shade(0.85); if (sp === 'zebu' && group === 'body' && Math.abs(z - 0.3 * ANIMAL_BUILD.zebu.len) < 0.25 && vy > 0.7) shade(0.8);
      shade(1 + 0.12 * (1 - belly) - 0.1 * belly); break; }
    case 'sheep': { if (head || onLeg) { const face = S(0.62, 0.52, 0.42); pale(face, 0.25); } break; }
    case 'goat': case 'wild_goat': case 'urial': { if (sp !== 'goat') { pale(S(0.86, 0.82, 0.74), Math.max(belly * 0.9, inner * 0.8, muzzleEnd * 0.5)); if (sp === 'wild_goat' && head) shade(0.75); if (sp === 'urial' && head && chin > 0.3) pale(S(0.2, 0.17, 0.14), 0.5); if (onLeg && legY < 0.6) pale(S(0.85, 0.82, 0.76), 0.35); if (sp === 'wild_goat' && group === 'body' && Math.abs(x) < 0.03 && vy > 0.8) shade(0.55); }
      else shade(1 + 0.2 * (fbm(x / 0.15, y / 0.15, z / 0.15, 2))); break; }
    case 'deer': case 'stag': { pale(S(0.9, 0.87, 0.8), Math.max(belly * 0.95, inner * 0.8));
      if (group === 'body' && vy > 0.45) { const sp2 = worley(x / 0.06 + 3, y / 0.06, z / 0.06); pale(S(0.92, 0.88, 0.8), smoothstep(0.24, 0.16, sp2) * 0.9); } // the dappled flanks
      if (group === 'body' && z < -0.44 * ANIMAL_BUILD[sp].len && vy > 0.2) pale(S(0.93, 0.9, 0.84), 0.9);                                    // the white rump
      if (group === 'body' && z < -0.4 * ANIMAL_BUILD[sp].len && Math.abs(Math.abs(x) - 0.06) < 0.02 && vy > 0.35) pale(S(0.12, 0.09, 0.07), 0.8); // its dark border
      break; }
    case 'gazelle': case 'gazelle_m': { pale(S(0.92, 0.9, 0.84), Math.max(belly * 1.0, inner * 0.9, chin * 0.8));
      if (group === 'body' && Math.abs(vy - 0.3) < 0.05) shade(0.7);                                                                 // the flank band
      if (group === 'body' && z < -0.44 * ANIMAL_BUILD[sp].len && vy > 0.15) pale(S(0.92, 0.9, 0.85), 0.9);
      if (head) { const side = Math.abs(x) / ANIMAL_BUILD[sp].headR; if (side > 0.5 && hu > 0.1 && hu < 0.9) pale(S(0.9, 0.88, 0.82), 0.6 * smoothstep(0.5, 0.8, side)); } break; }
    case 'boar': shade(1 - 0.2 * belly); if (onLeg) shade(0.75); break;
    case 'camel': case 'camel_pack': case 'dromedary': pale(S(0.84, 0.76, 0.62), belly * 0.35); if (part === 'wool') shade(0.8); break;
    case 'dog': pale(S(0.86, 0.8, 0.68), Math.max(belly * 0.7, inner * 0.6, chin * 0.5, onLeg && legY < 0.35 ? 0.4 : 0)); break;
    case 'wolf': { pale(S(0.85, 0.8, 0.72), Math.max(belly * 0.85, inner * 0.7, chin * 0.8, muzzleEnd * 0.4)); if (group === 'body' && vy > 0.7 && z > -0.3 && z < 0.35) shade(0.7); if (head && hu > 0.3) shade(0.9); break; }
    case 'fox': { pale(S(0.9, 0.88, 0.84), Math.max(belly * 0.8, chin * 0.95, muzzleEnd * (chin > 0.2 ? 1 : 0))); if (onLeg && legY < 1.4) pale(S(0.08, 0.06, 0.05), smoothstep(1.4, 0.8, legY) * 0.85); if (tag === 'ear') pale(S(0.1, 0.07, 0.06), 0.7); break; }
    case 'hyena': { pale(S(0.8, 0.76, 0.66), belly * 0.6); if (group === 'body' || onLeg) { const st = Math.sin((z * 2.2 + y * 0.6) / 0.09 * Math.PI) + 0.5 * vnoise(x / 0.04, y / 0.04, z / 0.04); if (st > 0.8 && vy > 0.2) pale(S(0.12, 0.1, 0.08), 0.85); }
      if (head && muzzleEnd > 0.2) pale(S(0.12, 0.1, 0.08), muzzleEnd * 0.8); break; }
    case 'lion': case 'lioness': pale(S(0.86, 0.8, 0.68), Math.max(belly * 0.6, chin * 0.7, inner * 0.5)); if (tag === 'ear') pale(S(0.14, 0.1, 0.08), 0.6); break;
    case 'leopard': { pale(S(0.9, 0.86, 0.78), Math.max(belly * 0.85, inner * 0.7, chin * 0.8));
      const sc = head ? 0.02 : onLeg ? 0.025 : 0.045, wv = worley(x / sc, y / sc, z / sc), ring = Math.abs(wv - 0.33) < 0.08;
      if (group !== 'tail' && ((head || onLeg) ? wv < 0.25 : ring)) pale(S(0.1, 0.08, 0.06), 0.9); if (!head && !onLeg && wv < 0.25) shade(0.82);
      if (group === 'tail') { if (Math.sin(y / 0.04 * Math.PI) > 0.6) pale(S(0.1, 0.08, 0.06), 0.85); } break; }
    case 'cheetah': { pale(S(0.9, 0.86, 0.78), Math.max(belly * 0.8, chin * 0.8));
      const wv = worley(x / 0.028, y / 0.028, z / 0.028); if (wv < 0.22 && !(head && hu > 0.55)) pale(S(0.09, 0.07, 0.05), 0.9);
      if (head && Math.abs(Math.abs(x) - ANIMAL_BUILD.cheetah.headR * 0.45) < 0.008 && hu > 0.3 && hu < 0.85) pale(S(0.08, 0.06, 0.05), 0.9); // the tear marks
      if (group === 'tail' && Math.sin(y / 0.05 * Math.PI) > 0.5) pale(S(0.09, 0.07, 0.05), 0.85); break; }
    case 'hare': pale(S(0.9, 0.88, 0.84), Math.max(belly * 0.8, chin * 0.6)); if (tag === 'ear') { const tip = smoothstep(0.08, 0.11, len3(sub(p, R.top)) - 0.05); pale(S(0.1, 0.08, 0.07), tip * 0.9); } break;
    case 'hen': shade(1 + 0.25 * fbm(x / 0.03, y / 0.03, z / 0.03, 2)); break;
    default: break;
  }
  if (abs !== null && w > 0) { const [r, gg, b] = abs as [number, number, number]; a = 1 - w; return [r * w + k * (1 - w), gg * w + k * (1 - w), b * w + k * (1 - w), a]; }
  return [k, k, k, a];
}

