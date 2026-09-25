// Where cloth lies over a body (D-206). A garment shell that is the body surface pushed out along its normals copies
// every hollow and bump of the body — pectorals, spine groove, shoulder blades, the pinna, the toes — and reads as paint
// (the scribe-at-work report: a clothed man read as a naked one). Cloth bridges hollows, stands off the body where it
// hangs and falls straight from what holds it up. Per body variant (cached):
//  * clothHull — a target position under the cloth for each torso and arm vertex (bind space) and the direction the
//    shells lay their thickness along there:
//    - torso (neck, chest, belly, pelvis): per horizontal slice, the 2D convex hull of the section (bridges the breastbone,
//      the spine groove, the hollows above the collarbones); below the armpits the cloth hangs straight down from the
//      widest section above it (chest, bust, shoulder blades, the flanks) to 5 cm above the belt, where the girdle draws
//      it in (a bloused tunic; B for "girt at the waist" on the reliefs, C for the drape);
//    - arms: per section across the bone, the convex hull of the arm's section (the biceps and the elbow's knobs vanish
//      under a sleeve);
//  * headHull — the head under a felt cap: its radial extent dilated over a cone (a rounded bulge over the ears) and, below
//    the cranium's centre, the widest section above hanging straight down (lappets and nape flap).
// Footwear is built as lofted tubes in outfits.ts (the foot's sections made convex there). Everything here is tier C (the
// cut and drape of garments of 467 BCE is reconstructed: MATERIAL_CULTURE "dress").
import type { HumanAssets, HumanVariant } from './humanAssets';
import { HB, PART, type HBone } from './humanFormat';

type V3 = [number, number, number];
const clamp = (x: number, a = 0, b = 1) => Math.max(a, Math.min(b, x));
const sstep = (e0: number, e1: number, x: number) => { const t = clamp((x - e0) / (e1 - e0)); return t * t * (3 - 2 * t); };

/** 2D convex hull (Andrew's monotone chain), counter-clockwise, as a flat [x0, y0, x1, y1, …] */
export function hull2(xs: number[], ys: number[]): number[] {
  const n = xs.length; if (n < 3) return xs.flatMap((x, i) => [x, ys[i]]);
  const id = Array.from({ length: n }, (_, i) => i).sort((a, b) => xs[a] - xs[b] || ys[a] - ys[b]);
  const cr = (o: number, a: number, b: number) => (xs[a] - xs[o]) * (ys[b] - ys[o]) - (ys[a] - ys[o]) * (xs[b] - xs[o]);
  const lo: number[] = [], up: number[] = [];
  for (const i of id) { while (lo.length >= 2 && cr(lo[lo.length - 2], lo[lo.length - 1], i) <= 0) lo.pop(); lo.push(i); }
  for (let k = n - 1; k >= 0; k--) { const i = id[k]; while (up.length >= 2 && cr(up[up.length - 2], up[up.length - 1], i) <= 0) up.pop(); up.push(i); }
  lo.pop(); up.pop(); return [...lo, ...up].flatMap(i => [xs[i], ys[i]]);
}
/** distance from (cx, cy) along the unit direction (dx, dy) to a convex polygon's boundary (the farthest crossing; 0 if none) */
export function rayToHull(poly: number[], cx: number, cy: number, dx: number, dy: number): number {
  let best = 0; const m = poly.length / 2;
  for (let i = 0; i < m; i++) { const ax = poly[i * 2] - cx, ay = poly[i * 2 + 1] - cy, bx = poly[((i + 1) % m) * 2] - cx, by = poly[((i + 1) % m) * 2 + 1] - cy;
    const ex = bx - ax, ey = by - ay, den = dx * ey - dy * ex; if (Math.abs(den) < 1e-12) continue;
    const t = (ax * ey - ay * ex) / den, s = (ax * dy - ay * dx) / den; if (s >= -1e-6 && s <= 1 + 1e-6 && t > best) best = t; }
  return best;
}

/** radial profile of a convex section: r(θ) in `bins` directions about a centre */
function profile(xs: number[], ys: number[], cx: number, cy: number, bins: number): Float32Array {
  const r = new Float32Array(bins); if (xs.length < 3) return r; const poly = hull2(xs, ys);
  for (let b = 0; b < bins; b++) { const th = (b / bins) * 2 * Math.PI; r[b] = rayToHull(poly, cx, cy, Math.cos(th), Math.sin(th)); }
  return r;
}
/** the radius a vertex moves out to: toward the section's hull (rt) from its own (rv), by at most `cap`, and only where
 *  the surface runs along the section's axis: a vertex on a surface facing along the axis (the sole, a shoulder's top
 *  seen in a horizontal section) lies inside its section, not on its outline, and the ray from the centre through it
 *  would carry it across to the far side (|n·axis| from 0.45 to 0.8 fades the push out; `full` keeps it) */
const pushTo = (rv: number, rt: number, nAxis: number, cap: number, full = false) => rv + Math.min(cap, Math.max(0, rt - rv)) * (full ? 1 : sstep(0.8, 0.45, Math.abs(nAxis)));
const at = (r: Float32Array, th: number) => { const B = r.length, f = ((((th / (2 * Math.PI)) % 1) + 1) % 1) * B, b0 = Math.floor(f) % B, a = f - Math.floor(f); return r[b0] * (1 - a) + r[(b0 + 1) % B] * a; };

export interface ClothHull {
  /** target bind position under the cloth per body render vertex (NO × 3); the body's own position where not computed */
  tgt: Float32Array;
  /** the direction the cloth's thickness is laid along there (NO × 3, unit): the section's radial direction, with the
   *  skin normal's component along the section's axis (the skin normal where not computed). Offsetting along the skin
   *  normal re-imprinted every hollow the hull had bridged (the spine groove's walls, the pinna's folds) */
  dir: Float32Array;
  /** the girdle's height (m, bind space): the belt's top edge, below which the torso cloth is drawn in */
  beltTop: number;
}
/** the belt's top edge relative to spine_01 (outfits.ts belt: dy −0.005, height 0.045) */
export const BELT_TOP = -0.005 + 0.045 / 2;
/** the hang zone: the blouse above the belt blends from drawn-in to hanging over this height (m, C) */
export const BLOUSE = 0.05;

/** The head under a felt cap (headHull): the head's radial extent about the cranium's centre (head and neck vertices),
 *  dilated over a 24° cone of directions, so a cap over the ears is a rounded bulge and not an ear-shaped one (the
 *  pinna, its back and the skull behind it all lie inside). `h(d)`: the distance from `c` to that surface along d. */
export interface HeadHull { c: V3; h: (d: V3) => number;
  /** below the cranium's centre, the felt hangs: the horizontal distance from the vertical axis through `c` at height y in
   *  the direction lon (0 = front, +π/2 = the body's left), the widest section of head and neck above it (from 3 cm above
   *  the centre down), so the lappets and the nape flap fall straight from the ears and the occiput; `raw` the section
   *  itself (where the felt's turned edge meets the skin) */
  hang: (y: number, lon: number, raw?: boolean) => number }
const HEAD_CACHE = new WeakMap<HumanVariant, HeadHull>();
export function headHull(A: HumanAssets, v: HumanVariant): HeadHull {
  const hit = HEAD_CACHE.get(v); if (hit) return hit;
  const P = v.pos, hj = HB.head * 3, c: V3 = [0, v.eyeY + 0.012, v.joints[hj + 2] + 0.008], NLAT = 48, NLON = 96, raw = new Float32Array(NLAT * NLON), alpha = (24 * Math.PI) / 180;
  const binOf = (d: V3) => { const r = Math.hypot(...d), lat = Math.asin(clamp(d[1] / r, -1, 1)), lon = Math.atan2(d[0], d[2]); return [Math.min(NLAT - 1, Math.floor(((lat + Math.PI / 2) / Math.PI) * NLAT)), ((Math.floor(((lon + Math.PI) / (2 * Math.PI)) * NLON) % NLON) + NLON) % NLON, r]; };
  const dirOf = (a: number, o: number): V3 => { const lat = ((a + 0.5) / NLAT) * Math.PI - Math.PI / 2, lon = ((o + 0.5) / NLON) * 2 * Math.PI - Math.PI; return [Math.cos(lat) * Math.sin(lon), Math.sin(lat), Math.cos(lat) * Math.cos(lon)]; };
  for (let i = 0; i < A.NO; i++) { if (A.part[i] !== PART.head && A.part[i] !== PART.neck) continue; const d: V3 = [P[i * 3] - c[0], P[i * 3 + 1] - c[1], P[i * 3 + 2] - c[2]], [a, o, r] = binOf(d); if (r > raw[a * NLON + o]) raw[a * NLON + o] = r; }
  const dil = new Float32Array(NLAT * NLON), dirs = Array.from({ length: NLAT * NLON }, (_, k) => dirOf(Math.floor(k / NLON), k % NLON)), wa = Math.ceil(alpha / (Math.PI / NLAT)), ca = Math.cos(alpha);
  for (let a = 0; a < NLAT; a++) { const lat = ((a + 0.5) / NLAT) * Math.PI - Math.PI / 2, wo = Math.min(NLON / 2, Math.ceil(wa / Math.max(0.15, Math.cos(lat))));
    for (let o = 0; o < NLON; o++) { const du = dirs[a * NLON + o]; let m = 0;
      for (let a2 = Math.max(0, a - wa); a2 <= Math.min(NLAT - 1, a + wa); a2++) for (let k = -wo; k <= wo; k++) { const o2 = (((o + k) % NLON) + NLON) % NLON, r = raw[a2 * NLON + o2]; if (!r) continue; const d2 = dirs[a2 * NLON + o2], cs = du[0] * d2[0] + du[1] * d2[1] + du[2] * d2[2]; if (cs < ca) continue; if (r * cs > m) m = r * cs; }
      dil[a * NLON + o] = m; } }
  const h = (d: V3) => { const r = Math.hypot(...d), lat = Math.asin(clamp(d[1] / r, -1, 1)), lon = Math.atan2(d[0], d[2]);
    const fa = clamp(((lat + Math.PI / 2) / Math.PI) * NLAT - 0.5, 0, NLAT - 1), fo = ((lon + Math.PI) / (2 * Math.PI)) * NLON - 0.5, a0 = Math.min(NLAT - 2, Math.floor(fa)), ta = fa - a0, o0 = Math.floor(fo), to = fo - o0;
    const g = (aa: number, oo: number) => dil[aa * NLON + (((oo % NLON) + NLON) % NLON)];
    return (g(a0, o0) * (1 - to) + g(a0, o0 + 1) * to) * (1 - ta) + (g(a0 + 1, o0) * (1 - to) + g(a0 + 1, o0 + 1) * to) * ta; };
  // horizontal sections of head and neck from 3 cm above the centre down to the neck joint, 1 cm apart, convex, 96 bins
  const B = 96, yTop = c[1] + 0.03, yBot = v.joints[HB.neck_01 * 3 + 1] - 0.03, dy = 0.01, ny = Math.ceil((yTop - yBot) / dy) + 1, rows: Float32Array[] = [];
  const hn: number[] = []; for (let i = 0; i < A.NO; i++) if (A.part[i] === PART.head || A.part[i] === PART.neck) hn.push(i);
  for (let k = 0; k < ny; k++) { const y = yTop - k * dy, xs: number[] = [], zs: number[] = []; for (const i of hn) if (Math.abs(P[i * 3 + 1] - y) <= 0.006) { xs.push(P[i * 3]); zs.push(P[i * 3 + 2]); }
    const r = new Float32Array(B); if (xs.length >= 3) { const poly = hull2(xs, zs); for (let q = 0; q < B; q++) { const lon = (q / B) * 2 * Math.PI; r[q] = rayToHull(poly, c[0], c[2], Math.sin(lon), Math.cos(lon)); } } rows.push(r); }
  let hung = rows.map(r => r.slice()); for (let k = 1; k < ny; k++) for (let q = 0; q < B; q++) hung[k][q] = Math.max(hung[k][q], hung[k - 1][q]);
  // (softened down the height and round: the step where the ears begin read as a ridge in the felt)
  for (let it = 0; it < 3; it++) hung = hung.map((r, k) => r.map((x, q) => { const up = hung[Math.max(0, k - 1)][q], dn = hung[Math.min(ny - 1, k + 1)][q]; return Math.max(x, (up + 2 * x + dn) / 4 * 0.5 + (r[(q + B - 1) % B] + 2 * x + r[(q + 1) % B]) / 4 * 0.5); }));
  const hang = (y: number, lon: number, raw = false) => { const f = clamp((yTop - y) / dy, 0, ny - 1), k0 = Math.min(ny - 2, Math.floor(f)), a = f - k0, R = raw ? rows : hung, th = ((lon % (2 * Math.PI)) + 2 * Math.PI) % (2 * Math.PI);
    const g = (k: number) => { const fq = (th / (2 * Math.PI)) * B, q0 = Math.floor(fq) % B, t = fq - Math.floor(fq); return R[k][q0] * (1 - t) + R[k][(q0 + 1) % B] * t; };
    return g(k0) * (1 - a) + g(k0 + 1) * a; };
  const out = { c, h, hang }; HEAD_CACHE.set(v, out); return out;
}

const CACHE = new WeakMap<HumanVariant, ClothHull>();
/** the cloth hull of one body variant (cached) */
export function clothHull(A: HumanAssets, v: HumanVariant): ClothHull {
  const hit = CACHE.get(v); if (hit) return hit;
  const J = (b: HBone): V3 => [v.joints[HB[b] * 3], v.joints[HB[b] * 3 + 1], v.joints[HB[b] * 3 + 2]];
  const P = v.pos, Nv = v.nrm, NO = A.NO, tgt = Float32Array.from(P), dir = Float32Array.from(Nv);
  /** the offset direction: radial (rx, ry, rz: unit, ⟂ axis w) scaled to keep the skin normal's component along w */
  const setDir = (i: number, r: V3, w: V3) => { const nw = Nv[i * 3] * w[0] + Nv[i * 3 + 1] * w[1] + Nv[i * 3 + 2] * w[2], h = Math.sqrt(Math.max(0, 1 - nw * nw));
    for (let e = 0; e < 3; e++) dir[i * 3 + e] = r[e] * h + w[e] * nw; };
  const byPart = new Map<number, number[]>(); for (let i = 0; i < NO; i++) { const p = A.part[i]; if (p >= PART.eye) continue; let l = byPart.get(p); if (!l) byPart.set(p, l = []); l.push(i); }
  const verts = (parts: number[]) => parts.flatMap(p => byPart.get(p) ?? []);

  // ---- torso: horizontal sections about a fixed vertical axis, hull, then the hang from the armpits to the belt
  const s1 = J('spine_01'), s3 = J('spine_03'), beltTop = s1[1] + BELT_TOP, hangTop = J('upperarm_l')[1] - 0.06;
  const torso = verts([PART.neck, PART.chest, PART.belly, PART.pelvis]);
  { let zlo = 9, zhi = -9; for (const i of torso) if (Math.abs(P[i * 3 + 1] - s3[1]) < 0.02) { zlo = Math.min(zlo, P[i * 3 + 2]); zhi = Math.max(zhi, P[i * 3 + 2]); }
    const cz = (zlo + zhi) / 2, B = 96, dy = 0.01, slab = 0.008;
    let y0 = 9, y1 = -9; for (const i of torso) { y0 = Math.min(y0, P[i * 3 + 1]); y1 = Math.max(y1, P[i * 3 + 1]); }
    const ny = Math.ceil((y1 - y0) / dy) + 1, sy = torso.slice().sort((a, b) => P[a * 3 + 1] - P[b * 3 + 1]);
    const rows: Float32Array[] = [];
    let lo = 0;
    for (let k = 0; k < ny; k++) { const y = y0 + k * dy, xs: number[] = [], zs: number[] = [];
      while (lo < sy.length && P[sy[lo] * 3 + 1] < y - slab) lo++;
      for (let q = lo; q < sy.length && P[sy[q] * 3 + 1] <= y + slab; q++) { xs.push(P[sy[q] * 3]); zs.push(P[sy[q] * 3 + 2]); }
      rows.push(profile(xs, zs, 0, cz, B)); }
    // hang: below hangTop each direction keeps the widest section above it (running max downward), blended back to the
    // drawn-in section just above the belt; below the belt, the section itself (under the skirt)
    const hang = rows.map(r => r.slice()); const kTop = Math.min(ny - 1, Math.max(0, Math.round((hangTop - y0) / dy)));
    for (let k = kTop - 1; k >= 0; k--) for (let b = 0; b < B; b++) hang[k][b] = Math.max(rows[k][b], hang[k + 1][b]);
    const R = rows.map((r, k) => { const y = y0 + k * dy, w = y > hangTop ? 1 : sstep(beltTop, beltTop + BLOUSE, y); return r.map((x, b) => (y > hangTop ? x : x + (hang[k][b] - x) * w)); });
    for (const i of torso) { const x = P[i * 3], y = P[i * 3 + 1], z = P[i * 3 + 2] - cz, th = Math.atan2(z, x), rv = Math.hypot(x, z);
      const f = clamp((y - y0) / dy, 0, ny - 1), k0 = Math.min(ny - 2, Math.floor(f)), a = f - k0, rt = at(R[k0], th) * (1 - a) + at(R[k0 + 1], th) * a;
      const nY = Nv[i * 3 + 1], r = pushTo(rv, rt, nY, 0.07, y <= hangTop && nY < 0.2), s = rv > 1e-6 ? r / rv : 1; tgt[i * 3] = x * s; tgt[i * 3 + 2] = z * s + cz; if (rv > 1e-6) setDir(i, [x / rv, 0, z / rv], [0, 1, 0]); }
  }

  // ---- limbs: sections across the bone (arms), convex hull about the bone axis
  const limb = (parts: number[], a: HBone, b: HBone, t0: number, t1: number) => {
    const ja = J(a), jb = J(b), w: V3 = [jb[0] - ja[0], jb[1] - ja[1], jb[2] - ja[2]], L = Math.hypot(...w); w[0] /= L; w[1] /= L; w[2] /= L;
    let u: V3 = [0, 0, 1]; const d = u[0] * w[0] + u[1] * w[1] + u[2] * w[2]; u = [u[0] - w[0] * d, u[1] - w[1] * d, u[2] - w[2] * d]; const ul = Math.hypot(...u); u = [u[0] / ul, u[1] / ul, u[2] / ul];
    const vv: V3 = [w[1] * u[2] - w[2] * u[1], w[2] * u[0] - w[0] * u[2], w[0] * u[1] - w[1] * u[0]];
    const ids = verts(parts), loc = ids.map(i => { const q: V3 = [P[i * 3] - ja[0], P[i * 3 + 1] - ja[1], P[i * 3 + 2] - ja[2]]; return [q[0] * w[0] + q[1] * w[1] + q[2] * w[2], q[0] * u[0] + q[1] * u[1] + q[2] * u[2], q[0] * vv[0] + q[1] * vv[1] + q[2] * vv[2]]; });
    const dt = 0.012, slab = 0.01, B = 48, tLo = t0 * L, tHi = t1 * L, nk = Math.max(2, Math.ceil((tHi - tLo) / dt) + 1), rows: Float32Array[] = [];
    for (let k = 0; k < nk; k++) { const t = tLo + k * dt, xs: number[] = [], ys: number[] = []; for (const q of loc) if (Math.abs(q[0] - t) <= slab) { xs.push(q[1]); ys.push(q[2]); } rows.push(profile(xs, ys, 0, 0, B)); }
    ids.forEach((i, n) => { const q = loc[n]; if (q[0] < tLo - dt || q[0] > tHi + dt) return; const th = Math.atan2(q[2], q[1]), rv = Math.hypot(q[1], q[2]);
      const f = clamp((q[0] - tLo) / dt, 0, nk - 1), k0 = Math.min(nk - 2, Math.floor(f)), a = f - k0, rt = at(rows[k0], th) * (1 - a) + at(rows[k0 + 1], th) * a;
      if (rt <= 0 || rv < 1e-6) return; const s = pushTo(rv, rt, Nv[i * 3] * w[0] + Nv[i * 3 + 1] * w[1] + Nv[i * 3 + 2] * w[2], 0.03) / rv;
      for (let e = 0; e < 3; e++) tgt[i * 3 + e] = ja[e] + w[e] * q[0] + (u[e] * q[1] + vv[e] * q[2]) * s;
      setDir(i, [0, 1, 2].map(e => (u[e] * q[1] + vv[e] * q[2]) / rv) as V3, w); });
  };
  for (const s of ['l', 'r'] as const) {
    limb([s === 'l' ? PART.uarm_l : PART.uarm_r], `upperarm_${s}`, `lowerarm_${s}`, -0.25, 1.05);
    limb([s === 'l' ? PART.farm_l : PART.farm_r], `lowerarm_${s}`, `hand_${s}`, -0.05, 1.05);
  }

  const out = { tgt, dir, beltTop }; CACHE.set(v, out); return out;
}

// ---------------------------------------------------------------------------------------------- D-225: the Persian robe
// The court robe of the reliefs (MATERIAL_CULTURE "Persian court robe", IR-CAND: B) is not a cone: below the belt a stack
// of vertical pleats hangs at the front centre, the cloth drawn up to the belt at the hips falls in diagonal folds that
// run from the front at the waist back and down to the hem, the back hangs in a few broad folds and kicks out at the heel,
// and the hem is higher in front. The pattern is B (the carved convention); every size and count below is C. It is baked
// into the skirt tube's radius (outfits.ts `robeSkirt`), so it moves with the skinning (no cloth simulation): as the
// thighs swing the folds swing with them; they do not lag or sway.
/** the robe's pleats per LOD (LOD 0: 72 columns, the front denser; LOD 1: 24; LOD 2: 10; the far LOD is meshopt's) */
export const ROBE = {
  /** the front pleat stack: half-angle about the front (rad), how far it stands forward (m), grooves across it, their depth (m) */
  panel: 0.3, panelOut: 0.016, panelPleats: 4, panelDepth: 0.008,
  /** diagonal folds at the sides: angular frequency (folds per radian × 2π), how far back (rad) a fold runs from the waist
   *  to the hem, amplitude at the waist and at the hem (m) */
  sideN: 15.7, sideTwist: 1.0, sideAmp: [0.003, 0.02] as [number, number],
  /** the back: broad hanging folds (angular frequency) and their amplitude at the hem (m); the kick-out at the heel (m) */
  backN: 7, backAmp: 0.018, backKick: 0.02,
  /** column density: θ(u) = 2πu − warp·sin 2πu (the front pleat stack gets 1/(1 − warp) the columns of a uniform tube) */
  warp: 0.35,
  /** the material's crease sharpening in each fold's valley (m) and the fine creases in the pleat stack (per pleat) */
  crease: 0.0016, fine: 2,
  segs: [72, 24, 10], rings: [14, 8, 4],
};
/** the robe skirt's baked pleat offset (m, radial) at the skirt parameter t (0 belt … 1 hem) and |θ| from the front
 *  (0 front … π back), for a LOD (1 keeps the stack and the broad folds, 2 the stack's bulge only) */
export function robePleat(absTh: number, t: number, lod: number): number {
  const a = Math.min(Math.PI, Math.abs(absTh)), R = ROBE;
  const pm = 1 - sstep(R.panel, R.panel + 0.12, a); // the front stack
  const grooves = lod === 0 ? R.panelDepth * (Math.abs(Math.sin(Math.PI * (a / (2 * R.panel)) * R.panelPleats * 2)) - 0.64) : 0;
  const stack = pm * (R.panelOut * sstep(0, 0.12, t) + grooves * sstep(0.02, 0.2, t));
  const sideM = sstep(R.panel, R.panel + 0.15, a) * (1 - sstep(2.3, 2.7, a)), backM = sstep(2.3, 2.7, a);
  const nS = lod === 0 ? R.sideN : lod === 1 ? 7 : 0, nB = lod === 0 ? R.backN : lod === 1 ? 4 : 0;
  // rounded crests, sharp valleys (2|cos(φ/2)| − 1)
  const side = nS ? (2 * Math.abs(Math.cos(((a - R.panel - t * R.sideTwist) * nS) / 2)) - 1) * (R.sideAmp[0] + (R.sideAmp[1] - R.sideAmp[0]) * t) : 0;
  const back = nB ? (2 * Math.abs(Math.cos((a * nB) / 2)) - 1) * R.backAmp * t * t : 0;
  return stack + side * sideM + back * backM + R.backKick * backM * sstep(0.45, 1, t);
}
/** the robe tube's column angle (see ROBE.warp) */
export const robeTheta = (j: number, S: number) => { const u = j / S; return 2 * Math.PI * u - ROBE.warp * Math.sin(2 * Math.PI * u); };
/** the robe's sleeves per LOD (outfits.ts robeSleeves; C): columns, rings (even: the lining takes every second), how far
 *  up the front of the forearm the slanted opening is cut (share of the sleeve's length), the folds (count round, turn
 *  over the length in rad, amplitude on the front and extra on the hanging back, m) */
export const SLEEVE = { segs: [32, 10, 8], rings: [12, 4, 4], cut: 0.28, folds: 6, twist: 3.0, foldAmp: [0.004, 0.012] as [number, number] };
/** the long beard of the court as the reliefs carve it (outfits.ts beardGeo, humanMaterial hair): stacked rows of spiral
 *  curls down the hanging mass (B for the carved convention, MATERIAL_CULTURE "Court dressing of hair and beard"; real hair
 *  C, Q-241), each row a roll (rowAmp m, geometry at full detail) with `around` curls round the mass (the material's
 *  cells, about 2.2 cm); the curls of the beard over the cheeks and chin in rows of cheekRow m; spiral turns per curl */
export const BEARD = { rows: 6, rowAmp: 0.0045, around: 14, cheekRow: 0.012, turns: 2 };
/** a court beard's row profile at the mass tube's parameter t and θ from the front (−0.6 … 0.4; × BEARD.rowAmp m along the
 *  normal, laid out by the material's vertex stage: outfits.ts stores 0.6 + this in the spare byte) */
export const beardRow = (t: number, thFront: number) => (Math.pow(Math.sin(Math.PI * ((t * BEARD.rows) % 1)), 0.6) - 0.6) * sstep(0.04, 0.12, t) * sstep(-0.6, 0.2, Math.cos(thFront));
