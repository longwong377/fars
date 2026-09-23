// Signed-distance models of the organic / carved pieces (D-018), polygonised offline by tools/build_sculpt.ts:
//  • the double-bull protome (unit: shaft diameter D; bull facing +x, mirrored), shared by composite and bull capitals,
//  • the vertical double-volute member of the composite capital (unit D),
//  • the Gate of All Nations doorway colossi (metres, reference box = sculpture.json colossus.reference_box): the W bulls
//    and the E human-headed winged bulls, carved from the jamb: fore-part in the round, flank in high relief.
// Every number is a row of src/data/sculpture.json (tier C shape proportions with notes); nothing here is attested
// measurement. Stylised Achaemenid forms, reconstructed from general knowledge of the type (RECOLLECTION, C).
import S from '../data/sculpture.json';
import { SPEC } from './spec';
import { SDF, Shape, shape, unionOf, smin, smax, clamp, smoothstep, sdEllipsoid, sdRoundCone, sdBox, sdSphere, sdCylY, sdTorus, sdSpiral2, extrude, sdBox2, sdCapsule, sdPoly2 } from './sdf';

type V3 = [number, number, number];
const SC = S as any;
const r = (g: string, k: string) => { const x = SC[g]?.[k]; if (!x || x.v === undefined) throw new Error(`sculpture.json missing ${g}.${k}`); return x.v; };
const dist = (a: V3, b: V3) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
const mid = (a: V3, b: V3): V3 => [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2, (a[2] + b[2]) / 2];

// ------------------------------------------------------------------ bounded primitive constructors
export const ell = (c: V3, rr: V3): Shape => shape((x, y, z) => sdEllipsoid(x - c[0], y - c[1], z - c[2], rr[0], rr[1], rr[2]), c, Math.max(...rr));
export const cone = (a: V3, b: V3, r1: number, r2: number): Shape => shape((x, y, z) => sdRoundCone(x, y, z, a[0], a[1], a[2], b[0], b[1], b[2], r1, r2), mid(a, b), dist(a, b) / 2 + Math.max(r1, r2));
export const rbox = (c: V3, h: V3, rad: number): Shape => shape((x, y, z) => sdBox(x - c[0], y - c[1], z - c[2], h[0], h[1], h[2], rad), c, Math.hypot(...h));
/** squeeze a shape toward the plane z = zc by factor s ≥ 1 (elliptical cross-sections of bodies) */
export const squeezeZ = (sh: Shape, zc: number, s: number): Shape => shape((x, y, z) => sh.f(x, y, zc + (z - zc) * s) / s, sh.c, sh.R);
/** chain of round cones through points with radii */
export const chain = (pts: V3[], radii: number[]): Shape[] => pts.slice(1).map((p, i) => cone(pts[i], p, radii[i], radii[i + 1]));

/** smooth box mask (1 inside [a,b], soft edge e) */
const band = (x: number, a: number, b: number, e: number) => smoothstep(a - e, a + e, x) * (1 - smoothstep(b - e, b + e, x));

/** Snail curls (the lock convention of Achaemenid carving, D-018/D-029/D-151) in staggered rows in a 2D chart (u across,
 *  v along): each lock a FLAT disc of radius `rad` (a crown doming by a tenth, falling over a steep bevelled rim of width
 *  `bevel`·rad to the ground between locks) cut by a spiral groove that coils `turns` times from the centre out to the
 *  rim; neighbouring locks coil in opposite senses, as carved. `inField(cu, cv)`: a lock is carved only if its centre lies
 *  in the field, so a field ends in whole locks. Returns the relief in units of the lock height: 1 on the crown, 0
 *  between locks, down to about 1 − gd in the groove (gw = groove half-width, fraction of rad). Hemispherical bosses
 *  (D-029) read as bubbles and the simplifier cut them into noisy pits. */
export function snail(u: number, v: number, pitch: number, rad: number, turns: number, gw: number, gd: number, bevel = 0.25, inField?: (cu: number, cv: number) => boolean) {
  const row = Math.round(v / pitch); let best = Infinity, bu = 0, bv = 0, hand = 1;
  for (let rr = row - 1; rr <= row + 1; rr++) {
    const off = (rr & 1) ? pitch / 2 : 0, col = Math.round((u - off) / pitch), lu = col * pitch + off, lv = rr * pitch, du = u - lu, dv = v - lv, d2 = du * du + dv * dv;
    if (d2 < best && (!inField || inField(lu, lv))) { best = d2; bu = du; bv = dv; hand = (col + rr) & 1 ? 1 : -1; }
  }
  const r = Math.sqrt(best) / rad; if (r >= 1) return 0;
  const rim = smoothstep(1, 1 - bevel, r), crown = (1 - 0.1 * r * r) * rim;
  let a = Math.atan2(bv, bu) * hand; if (a < 0) a += 2 * Math.PI;
  let dm = Infinity; // distance (rad units) to the nearest arm of the Archimedean spiral r = θ / (2π·turns)
  for (let k = 0; k <= Math.ceil(turns); k++) { const th = a + 2 * Math.PI * k; if (th > turns * 2 * Math.PI) break; dm = Math.min(dm, Math.abs(r - th / (2 * Math.PI * turns))); }
  const g = Math.max(0, 1 - dm / gw);
  return crown - gd * g * g * (3 - 2 * g) * smoothstep(0.04, 0.22, r) * rim;
}
/** the snail profile of one lock at in-plane offset (a, b) from its centre (units of the lock height; see `snail`) */
export function lockProfile(a: number, b: number, rad: number, turns: number, gw: number, gd: number, bevel: number, hand: number) {
  const r = Math.sqrt(a * a + b * b) / rad; if (r >= 1) return 0;
  const rim = smoothstep(1, 1 - bevel, r), crown = (1 - 0.1 * r * r) * rim;
  let ang = Math.atan2(b, a) * hand; if (ang < 0) ang += 2 * Math.PI;
  let dm = Infinity;
  for (let k = 0; k <= Math.ceil(turns); k++) { const th = ang + 2 * Math.PI * k; if (th > turns * 2 * Math.PI) break; dm = Math.min(dm, Math.abs(r - th / (2 * Math.PI * turns))); }
  const g = Math.max(0, 1 - dm / gw);
  return crown - gd * g * g * (3 - 2 * g) * smoothstep(0.04, 0.22, r) * rim;
}
/** one carved lock placed on a curved surface: centre, surface normal, in-plane axes, radius, coiling sense */
export interface Lock { c: V3; n: V3; u: V3; v: V3; rad: number; amp: number; hand: number }
/** a chart that lays a staggered lattice of locks onto a surface: lattice points origin + u·du + v·dv (u, v within the
 *  ranges, accepted by `inField`) are projected along `dir` onto the surface */
export interface LockChart { origin: V3; du: V3; dv: V3; dir: V3; u: [number, number]; v: [number, number]; inField: (u: number, v: number) => boolean; pitch: number; rad: number; amp: number; accept?: (p: V3, n: V3) => boolean }
const v3 = { add: (a: V3, b: V3, s = 1): V3 => [a[0] + b[0] * s, a[1] + b[1] * s, a[2] + b[2] * s], dot: (a: V3, b: V3) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2], norm: (a: V3): V3 => { const l = Math.hypot(a[0], a[1], a[2]) || 1; return [a[0] / l, a[1] / l, a[2] / l]; }, cross: (a: V3, b: V3): V3 => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]] };
/** Place locks (D-151): each chart's lattice point is marched along the chart direction onto the surface of `base` (the
 *  model without its locks); the lock takes the surface normal there and an in-plane frame from the chart's v axis. A lock
 *  closer than `minSep`·pitch to one already placed (charts overlapping round a neck) is dropped, so fields wrap round a
 *  curved form in whole locks. Neighbours in a lattice row coil in opposite senses. */
export function placeLocks(base: SDF, charts: LockChart[], minSep = 0.8): Lock[] {
  const out: Lock[] = [];
  for (const ch of charts) {
    const P = ch.pitch, rows = [Math.floor(ch.v[0] / P), Math.ceil(ch.v[1] / P)];
    for (let rr = rows[0]; rr <= rows[1]; rr++) {
      const off = rr & 1 ? P / 2 : 0, cols = [Math.floor((ch.u[0] - off) / P), Math.ceil((ch.u[1] - off) / P)];
      for (let cc = cols[0]; cc <= cols[1]; cc++) {
        const u = cc * P + off, v = rr * P;
        if (u < ch.u[0] || u > ch.u[1] || v < ch.v[0] || v > ch.v[1] || !ch.inField(u, v)) continue;
        let p = v3.add(v3.add(ch.origin, ch.du, u), ch.dv, v), t = 0, hit = false;
        for (let k = 0; k < 200 && t < 4; k++) { const d = base(p[0], p[1], p[2]); if (d < 1e-4) { hit = true; break; } const st = Math.max(d * 0.8, 1e-4); p = v3.add(p, ch.dir, st); t += st; }
        if (!hit) continue;
        const e = 1e-4, n = v3.norm([base(p[0] + e, p[1], p[2]) - base(p[0] - e, p[1], p[2]), base(p[0], p[1] + e, p[2]) - base(p[0], p[1] - e, p[2]), base(p[0], p[1], p[2] + e) - base(p[0], p[1], p[2] - e)]);
        if (v3.dot(n, ch.dir) > -0.25) continue; // the surface there does not face the chart
        if (ch.accept && !ch.accept(p, n)) continue;
        if (out.some(l => Math.hypot(l.c[0] - p[0], l.c[1] - p[1], l.c[2] - p[2]) < minSep * P)) continue;
        const vv = v3.norm(v3.add(ch.dv, n, -v3.dot(ch.dv, n))), uu = v3.cross(vv, n);
        // a lock is carved on a face flat enough to take it: the surface normal under its rim stays within 40° of its own
        let flatEnough = true;
        for (const [du, dv] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
          const q = v3.add(v3.add(p, uu, du * ch.rad), vv, dv * ch.rad), gq = v3.norm([base(q[0] + e, q[1], q[2]) - base(q[0] - e, q[1], q[2]), base(q[0], q[1] + e, q[2]) - base(q[0], q[1] - e, q[2]), base(q[0], q[1], q[2] + e) - base(q[0], q[1], q[2] - e)]);
          if (v3.dot(gq, n) < Math.cos((40 * Math.PI) / 180) || Math.abs(base(q[0], q[1], q[2])) > ch.rad * 0.35) flatEnough = false;
        }
        if (!flatEnough) continue;
        out.push({ c: p, n, u: uu, v: vv, rad: ch.rad, amp: ch.amp, hand: (cc + rr) & 1 ? 1 : -1 });
      }
    }
  }
  return out;
}
/** a set of placed locks with a spatial hash: relief(p) = the profile of the nearest lock whose disc covers p (0 elsewhere) */
export class LockField {
  private grid = new Map<string, Lock[]>(); private cs: number;
  constructor(readonly locks: Lock[], private turns: number, private gw: number, private gd: number, private bevel: number) {
    this.cs = Math.max(1e-3, ...locks.map(l => l.rad)) * 2;
    for (const l of locks) { const k = this.key(l.c[0], l.c[1], l.c[2]); let a = this.grid.get(k); if (!a) this.grid.set(k, (a = [])); a.push(l); }
  }
  private key(x: number, y: number, z: number) { return `${Math.floor(x / this.cs)},${Math.floor(y / this.cs)},${Math.floor(z / this.cs)}`; }
  /** the nearest lock within reach of p (in-plane distance < rad, not too far off its plane), or null */
  nearest(x: number, y: number, z: number): { l: Lock; a: number; b: number } | null {
    const i = Math.floor(x / this.cs), j = Math.floor(y / this.cs), k = Math.floor(z / this.cs); let best: Lock | null = null, bd = Infinity, ba = 0, bb = 0;
    for (let di = -1; di <= 1; di++) for (let dj = -1; dj <= 1; dj++) for (let dk = -1; dk <= 1; dk++) {
      const a = this.grid.get(`${i + di},${j + dj},${k + dk}`); if (!a) continue;
      for (const l of a) {
        const q: V3 = [x - l.c[0], y - l.c[1], z - l.c[2]], h = v3.dot(q, l.n); if (Math.abs(h) > l.rad) continue;
        const qa = v3.dot(q, l.u), qb = v3.dot(q, l.v), d2 = qa * qa + qb * qb;
        if (d2 < bd && d2 < l.rad * l.rad) { bd = d2; best = l; ba = qa; bb = qb; }
      }
    }
    return best ? { l: best, a: ba, b: bb } : null;
  }
  /** the displacement (the lock's amplitude × its profile) at p */
  relief(x: number, y: number, z: number) { const n = this.nearest(x, y, z); return n ? n.l.amp * lockProfile(n.a, n.b, n.l.rad, this.turns, this.gw, this.gd, this.bevel, n.l.hand) : 0; }
}
/** a flat array polygon from [[x, y] …] rows */
const flat2 = (pts: number[][]) => Float64Array.from(pts.flat());
/** a groove along the junction of two touching solids (an inserted horn or ear meeting the head): negative within w of the
 *  curve where both surfaces meet, so max(d, −groove) cuts the joint line */
const joint = (d1: number, d2: number, w: number) => Math.max(Math.abs(d1), Math.abs(d2)) - w;
/** ellipsoid along a segment a → b (half-length along it, half-width `w` and half-thickness `t`), its thin axis `n` */
function leafSDF(p: V3, a: V3, b: V3, w: number, t: number, nHint: V3) {
  const e: V3 = [b[0] - a[0], b[1] - a[1], b[2] - a[2]], L = Math.hypot(...e); e[0] /= L; e[1] /= L; e[2] /= L;
  let n: V3 = [nHint[0] - e[0] * (nHint[0] * e[0] + nHint[1] * e[1] + nHint[2] * e[2]), nHint[1] - e[1] * (nHint[0] * e[0] + nHint[1] * e[1] + nHint[2] * e[2]), nHint[2] - e[2] * (nHint[0] * e[0] + nHint[1] * e[1] + nHint[2] * e[2])];
  const nl = Math.hypot(...n); n = [n[0] / nl, n[1] / nl, n[2] / nl];
  const w3: V3 = [e[1] * n[2] - e[2] * n[1], e[2] * n[0] - e[0] * n[2], e[0] * n[1] - e[1] * n[0]];
  const c: V3 = [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2, (a[2] + b[2]) / 2], q: V3 = [p[0] - c[0], p[1] - c[1], p[2] - c[2]];
  const le = q[0] * e[0] + q[1] * e[1] + q[2] * e[2], lw = q[0] * w3[0] + q[1] * w3[1] + q[2] * w3[2], ln = q[0] * n[0] + q[1] * n[1] + q[2] * n[2];
  return { d: sdEllipsoid(le, lw, ln, L / 2, w, t), le, lw, ln, L };
}
/** overlapping scale feathers (wing coverts) in staggered rows, tips down: each feather rises from the rounded lower rim it
 *  shows and slopes back under the row above. u across, v up (row pitch pv, feather pitch pu); 0..1 */
export function scales(u: number, v: number, pu: number, pv: number) {
  const row = Math.floor(v / pv), cu = ((u / pu + (row & 1 ? 0.5 : 0)) % 1 + 1) % 1 - 0.5, cv = v / pv - row;
  const rim = 0.45 * (2 * cu) ** 2; // the lower edge of the feather: lowest at its centre
  if (cv < rim) return 0.35 * (1 - (rim - cv) / Math.max(rim, 1e-6)); // the tip of the feather in the row below shows here
  return 1 - 0.75 * ((cv - rim) / (1 - rim));
}
/** the Achaemenid beard: horizontal bands of snail curls alternating with bands of long wavy locks, from the top (v = 0,
 *  measured downward) to the bottom row of curls. B = sculpture.json colossus.beard; returns the relief (units of amp) */
export function beardLocks(u: number, v: number, B: any) {
  const bands = B.bands as [string, number][];
  let top = 0, k = 0;
  for (; k < bands.length - 1; k++) { const h = bands[k][0] === 'curls' ? bands[k][1] * B.pitch : bands[k][1]; if (v < top + h) break; top += h; }
  const lv = v - top; // below the last band: its pattern continues to the beard's lower edge
  if (bands[k][0] === 'curls') return snail(u, lv - B.pitch / 2, B.pitch, B.rad, B.turns, B.groove_w, B.groove_d);
  const s = u + B.wave_amp * Math.sin((2 * Math.PI * lv) / B.wave_len), q = Math.cos((Math.PI * 2 * s) / B.strand_pitch) * 0.5 + 0.5;
  return 0.2 + 0.6 * Math.pow(q, 0.7);
}
/** the relief of whichever masked field has the largest mask (fields do not add: a groove in one is not hidden by a zero
 *  of another) */
const pick = (...fm: [number, number][]) => { let bi = -1, bm = 0; fm.forEach(([, m], i) => { if (m > bm) { bm = m; bi = i; } }); return bi < 0 ? 0 : fm[bi][0] * bm; };

/** The stylised bull head (D-151), shared by the capital bulls and the Gate's W bulls, in its own frame: s from the poll
 *  toward the muzzle, t up-forward, Z = |lateral| (units of the rows H = protome.head, HR = protome.horns). Round masses
 *  (skull, face, broad muzzle, lower jaw, cheek muscle) blended, then cut by the carver's planes: a flat brow and nasal
 *  plane sloping to the nose, flat sides narrowing to the muzzle, a flat nose front (crisp arrises); almond eyes under heavy
 *  upper lids; at full detail shallow nostrils and the mouth line. Returns [head, horn, ear] distances. */
export function bullHead(H: any, HR: any, fb: number, detail: boolean, hornZ = 1): (s: number, t: number, Z: number) => [number, number, number] {
  const hornShapes = chain(HR.horn as V3[], HR.horn_r);
  return (s, t, Z) => {
    const K = H.blend, sk = H.skull, fc = H.face, jw = H.jaw, ck = H.cheek;
    let d = sdEllipsoid(s - sk[0][0], t - sk[0][1], Z, sk[1][0], sk[1][1], sk[1][2]);
    d = smin(d, sdRoundCone(s, t, Z * fc[4], fc[0][0], fc[0][1], 0, fc[1][0], fc[1][1], 0, fc[2], fc[3]) / fc[4], K[0]);
    d = smin(d, sdEllipsoid(s - H.muzzle_c[0], t - H.muzzle_c[1], Z, H.muzzle_r[0], H.muzzle_r[1], H.muzzle_r[2]), K[1]);
    d = smin(d, smin(sdRoundCone(s, t, Z, jw[0][0], jw[0][1], 0, jw[1][0], jw[1][1], 0, jw[2], jw[3]), sdEllipsoid(s - ck[0][0], t - ck[0][1], Z - ck[0][2], ck[1][0], ck[1][1], ck[1][2]), K[2]), K[1]);
    const pt = H.plane_top, ps = H.plane_side, pf = H.plane_front;
    d = smax(d, t - (pt[0] - pt[1] * s), pt[2]);
    d = smax(d, Z - (ps[0] - ps[1] * s), ps[2]);
    d = smax(d, s - pf[0], pf[1]);
    if (d < 0.12) {
      // the eye: an almond eyeball under a heavy upper lid (the upper part of a larger ellipsoid, cut level just above the
      // eyeball's centre, so the lid overhangs it with a crisp edge)
      const e = H.eye, er = H.eye_r, lc = H.lid, lr = H.lid_r;
      d = smin(d, sdEllipsoid(s - e[0], t - e[1], Z - e[2], er[0], er[1], er[2]), fb);
      d = smin(d, Math.max(sdEllipsoid(s - lc[0], t - lc[1], Z - lc[2], lr[0], lr[1], lr[2]), e[1] + H.lid_cut - t), fb);
      if (detail) {
        const n = H.nostril, nr = H.nostril_r, mo = H.mouth; // shallow flared nostrils on the muzzle's front corners; the mouth
        d = smax(d, -sdEllipsoid(s - n[0], t - n[1], Z - n[2], nr[0], nr[1], nr[2]), 0.008);
        d = smax(d, -sdCapsule(s, t, Z, mo[0][0], mo[0][1], mo[0][2], mo[1][0], mo[1][1], mo[1][2], mo[2]), 0.004);
      }
    }
    let horn = 1e9; for (const hs of hornShapes) horn = Math.min(horn, hs.f(s, t, Z / hornZ) * Math.min(1, hornZ));
    const ear = leafSDF([s, t, Z], HR.ear[0], HR.ear[1], HR.ear_w, HR.ear_t, HR.ear_n);
    let de = ear.d;
    if (detail && de < 0.05) de = Math.max(de, -sdEllipsoid(ear.le, ear.lw, ear.ln - HR.ear_t * (1 - HR.ear_hollow), ear.L * 0.36, HR.ear_w * 0.62, HR.ear_t * 0.6)); // the hollow of the ear, inside its rim
    return [d, horn, de];
  };
}

// ================================================================== double-bull protome (unit D)
/** a piece's signed-distance model: the field, its box, and optional simplification weights (> 1 keeps more triangles) */
/** carved locks to add to a piece as template meshes (sculpt.ts addLocks): the placed locks, the surface they sit on, whether
 *  the piece is mirrored in x (the protome's two bulls), the lock profile, its height and embedding depth (fractions of the
 *  lock radius) and the template's triangle count */
export interface LockSet { list: Lock[]; surface: SDF; mirrorX?: boolean; turns: number; gw: number; gd: number; bevel: number; height: number; depth: number; tris: number }
export interface PieceSDF { f: SDF; min: V3; max: V3; weight?: (x: number, y: number, z: number) => number; locks?: LockSet }
/** SDF of the double-bull protome in D units: x ∈ ±w/2 along the beam, y ∈ [0, h], z ∈ ±d/2. D-151: a block carved from
 *  outlines (side, plan, front) with rounded arrises, a planar head from its own three outlines, eyes under heavy lids, a
 *  squared muzzle, inserted horns and ears (joint grooves), folded forelegs with knee, cannon and cloven hoof, and flat snail
 *  locks on the chest apron and the forelock. lod 1 leaves out the locks and the small cuts (its grid cannot carry them). */
export function protomeSDF(lod: 0 | 1 = 0): PieceSDF {
  const B = r('protome', 'body'), H = r('protome', 'head'), HR = r('protome', 'horns'), L = r('protome', 'legs'), C = r('protome', 'curls'), MC = r('protome', 'mc');
  const [pw, pd] = SPEC.global.r_column_proportions.v.capital_boxes.protome as number[], ph = r('protome', 'frame').h as number;
  const detail = lod === 0;
  const side = flat2(B.profile), plan = flat2(B.plan), front = flat2(B.front);
  const block = (X: number, y: number, z: number) => smax(smax(sdPoly2(X, y, side), sdPoly2(X, z, plan), B.round), sdPoly2(z, y, front), B.round);
  // a low swell of the shoulder over the foreleg, blended wide so it has no edge
  const forepart = (X: number, y: number, z: number) => { const b = block(X, y, z); return b > 0.3 ? b : smin(b, sdEllipsoid(X - B.shoulder_c[0], y - B.shoulder_c[1], Math.abs(z) - B.shoulder_c[2], B.shoulder_r[0], B.shoulder_r[1], B.shoulder_r[2]), B.shoulder_blend); };
  // head frame: s along poll → muzzle, t perpendicular (up-forward) in the median plane
  const P0 = H.poll as number[], M0 = H.muzzle as number[], hl = Math.hypot(M0[0] - P0[0], M0[1] - P0[1]), ax = [(M0[0] - P0[0]) / hl, (M0[1] - P0[1]) / hl], tn = [-ax[1], ax[0]];
  const headParts = bullHead(H, HR, B.feature_blend, detail);
  // the folded foreleg: its side outline (forearm, knee, cannon on the base, fetlock and hoof) extruded to a width that
  // narrows from the forearm to the cannon, arrises rounded; a knee cap; the cleft between the claws at LOD0
  const legOut = flat2(L.outline);
  const legs = (X: number, y: number, z: number) => {
    const q = Math.abs(z) - L.z, w = L.w_lower + (L.w_upper - L.w_lower) * smoothstep(L.w_y[0], L.w_y[1], y);
    let d = smax(sdPoly2(X, y, legOut), Math.abs(q) - w, L.round);
    d = smin(d, sdEllipsoid(X - L.knee_c[0], y - L.knee_c[1], q, L.knee_r[0], L.knee_r[1], L.knee_r[2]), 0.02);
    if (detail && X < L.cleft_x) d = Math.max(d, -(Math.abs(q) - L.cleft_w));
    return d;
  };
  // the model without its locks, for X = |x| ≥ 0 (the two bulls are mirror images)
  const base: SDF = (X, y, z) => {
    let d = forepart(X, y, z);
    if (d > 0.9) return d;
    d = smin(d, sdBox(X, y - B.support_h[1], z, B.support_h[0], B.support_h[1], B.support_h[2], B.support_r), 0.02);
    d = smin(d, legs(X, y, z), 0.035);
    // head, horns and ears
    const dx = X - P0[0], dy = y - P0[1];
    if (dx * dx + dy * dy < 0.8 * 0.8) {
      const s = dx * ax[0] + dy * ax[1], t = dx * tn[0] + dy * tn[1], Z = Math.abs(z);
      const [hd, horn, ear] = headParts(s, t, Z);
      d = smin(d, hd, B.head_blend);
      const ins = Math.min(horn, ear); // inserted pieces: a hard union and, at LOD0, a joint groove round each root
      let dd = Math.min(d, ins);
      if (detail) dd = Math.max(dd, -joint(d, ins, HR.socket_w));
      d = dd;
    }
    return d;
  };
  // the locks (LOD0): a bib on the chest front and dewlap and a forelock between the horns, placed on the surface in whole
  // locks (placeLocks) and carved as flat snail locks: each is one template mesh (lockTemplate) shrink-wrapped onto the
  // body, so the simplifier spends nothing on them and every lock keeps the same clean disc, rim and spiral groove
  let locks: LockSet | undefined;
  if (detail) {
    const bib = (u: number, v: number) => Math.abs(u) <= C.apron_w[0] + ((C.apron_w[1] - C.apron_w[0]) * (v - C.apron_y[0])) / (C.apron_y[1] - C.apron_y[0]);
    const fs = C.forelock_scale;
    const charts: LockChart[] = [
      { origin: [2.2, 0, 0], du: [0, 0, 1], dv: [0, 1, 0], dir: [-1, 0, 0], u: [-0.4, 0.4], v: C.apron_y, inField: bib, pitch: C.pitch, rad: C.rad, amp: C.amp },
      { origin: [P0[0] + tn[0] * 0.6, P0[1] + tn[1] * 0.6, 0], du: [ax[0], ax[1], 0], dv: [0, 0, 1], dir: [-tn[0], -tn[1], 0], u: [C.forelock_s[0], C.forelock_s[1]], v: [-C.forelock_w, C.forelock_w], inField: () => true, pitch: C.pitch * fs, rad: C.rad * fs, amp: C.amp * fs },
    ];
    locks = { list: placeLocks(base, charts), surface: base, mirrorX: true, turns: C.turns, gw: C.groove_w, gd: C.groove_d, bevel: C.bevel, height: C.amp / C.rad, depth: C.depth, tris: MC.lock_tris };
  }
  // LOD1 (beyond lod.switch.column a lock spans 3–4 px): the bib as a low pad of the locks' mean height, so the switch
  // does not strip the chest bare
  const pad = (X: number, y: number, z: number) => {
    if (X < C.pad_x || y < C.apron_y[0] - 0.05 || y > C.apron_y[1] + 0.05) return 0;
    const w = C.apron_w[0] + ((C.apron_w[1] - C.apron_w[0]) * (y - C.apron_y[0])) / (C.apron_y[1] - C.apron_y[0]) + C.rad;
    return C.amp * 0.55 * smoothstep(C.apron_y[0] - C.rad, C.apron_y[0], y) * (1 - smoothstep(C.apron_y[1], C.apron_y[1] + C.rad, y)) * (1 - smoothstep(w - 0.03, w, Math.abs(z))) * smoothstep(C.pad_x, C.pad_x + 0.06, X);
  };
  const f: SDF = (x, y, z) => { const X = Math.abs(x), d = base(X, y, z); return detail || d > 0.05 ? d : d - pad(X, y, z); };
  const weight = (x: number, y: number, z: number) => {
    const X = Math.abs(x), dx = X - P0[0], dy = y - P0[1];
    if (dx * dx + dy * dy < 0.62 * 0.62) return MC.weight_face;
    if (Math.abs(z) > 0.36 && y > 0.4 && y < 1.4 && X < 1.2) return MC.weight_flank;
    return 1;
  };
  const w = pw / 2 + 0.05, dd = pd / 2 + 0.05;
  return { f, min: [-w, -0.03, -dd], max: [w, ph + 0.08, dd], weight, locks };
}

// ================================================================== vertical double-volute member (unit D)
/** SDF of the volute member: core with, on each of the four faces, two stacked pairs of spiral scrolls joined by stems
 *  and a reeded central band. x ∈ ±wx/2, z ∈ ±wz/2, y ∈ [0, hv]. */
export function voluteSDF(hv: number, wx: number, wz: number, lod: 0 | 1 = 0): PieceSDF {
  const V = r('volute', 'member');
  const t = V.relief * wx; // relief of the stems and reeds above the core faces
  const cx = wx / 2 - t, cz = wz / 2 - t;
  // D-151: four rolls (rolled bands) run through the member along z at the corners of its broad faces, as the volutes of an
  // Ionic capital stood on end; each end is carved with the spiral (the band's turns separated by a rounded channel,
  // `carve`·rs deep) round a raised eye; vertical stems join the upper and lower rolls on each broad face with a reeded
  // panel between them; the narrow faces show the rolls' round sides over the recessed core. The rolls and channels are
  // extrusions, which the simplifier keeps smooth with few triangles (the carved-on-every-face scrolls of D-029 were
  // polygonised into jagged facets)
  const rs = Math.min(wx * V.scroll_r, hv * V.scroll_r_max), rcx = wx / 2 - rs;
  const pitch = (rs * (1 - V.eye) * V.fill) / V.turns, cd = rs * V.carve, rOut = rs * V.eye + pitch * V.turns;
  const stemX = rcx - rs + V.stem_w, reedW = stemX - V.stem_w;
  const reedPitch = (2 * reedW) / Math.max(2, Math.round((2 * reedW) / V.reed_pitch));
  const eyeH = V.eye_h * t, detail = lod === 0;
  const f: SDF = (x, y, z) => {
    const ax = Math.abs(x), az = Math.abs(z), top = y > hv / 2;
    let d = sdBox(x, y - hv / 2, z, cx, hv / 2, cz, V.core_r); // the core
    if (d > t + 0.1) return d;
    const du = ax - rcx, dv = top ? y - (hv - rs) : rs - y, rr = Math.hypot(du, dv); // mirrored left/right and top/bottom
    let depth = 0;
    if (detail && rr < rOut + pitch && az > wz / 2 - cd - 0.02) {
      const q = Math.min(1, sdSpiral2(du, dv, rs * V.eye, pitch, V.turns, 0, 1, V.phase) / (pitch / 2)); // 0 on a band's crest, 1 in a channel
      depth = cd * smoothstep(0.3, 1, q) * (1 - smoothstep(rOut, rOut + 0.4 * pitch, rr)) * smoothstep(rs * V.eye, rs * V.eye + 0.2 * pitch, rr);
    }
    const roll = Math.max(rr - rs, az - (wz / 2 - depth));
    const eye = Math.max(rr - rs * V.eye, az - (wz / 2 + eyeH)); // the eye stands proud of the end
    const stem = Math.max(sdBox2(ax - stemX, y - hv / 2, V.stem_w, hv / 2 - rs), az - (wz / 2 - t / 2));
    const ru = ((((x + reedW) % reedPitch) + reedPitch) % reedPitch) - reedPitch / 2, rq = Math.min(1, Math.abs(ru) / (reedPitch * 0.5));
    const reeds = Math.max(sdBox2(x, y - hv / 2, reedW, hv / 2 - rs * V.reed_inset), az - (cz + t * V.reed_h * (detail ? 0.35 + 0.65 * Math.sqrt(1 - rq * rq) : 0.7)));
    d = Math.min(d, roll, eye, stem, reeds);
    return Math.max(d, sdBox(x, y - hv / 2, z, wx / 2, hv / 2, wz / 2 + eyeH)); // clip to the member's box
  };
  return { f, min: [-wx / 2 - 0.03, -0.03, -wz / 2 - eyeH - 0.03], max: [wx / 2 + 0.03, hv + 0.03, wz / 2 + eyeH + 0.03] };
}

// ================================================================== doorway colossi (metres, reference box)
export type ColossusModel = 'bull' | 'lamassu';
/** SDF of a doorway colossus in its reference box: x ∈ ±L/2 (head at +x), y ∈ [0, H] (0 = plinth top),
 *  z ∈ ±W/2 (+z = the passage face carrying the relief). `front` = length (m) of the fore-part standing in the round
 *  in front of the jamb block (from the layout: how far the colossus box projects beyond the wall face).
 *  Body coordinates in sculpture.json are relative to the body's median plane z = body.zc. */
export function colossusSDF(model: ColossusModel, front: number, lod: 0 | 1 = 0): PieceSDF {
  const RB = r('colossus', 'reference_box'), J = r('colossus', 'jamb'), BD = r('colossus', 'body'), LG = r('colossus', 'legs'), CU = r('colossus', 'curls'), BE = r('colossus', 'beard'), MC = r('colossus', 'mc');
  const L2 = RB.L / 2, W2 = RB.W / 2, Ht = RB.H, zc = BD.zc, detail = lod === 0;
  const xf = L2 - front; // jamb block front face
  const zbg = W2 - J.relief_depth; // recessed background of the relief
  const Z = (p: V3, s = 1): V3 => [p[0], p[1], zc + p[2] * s];
  const legAt = (dz: number, dx: number) => (p: V3): V3 => [p[0] + dx, p[1], zc + dz + p[2]];
  const P: Shape[] = [
    squeezeZ(cone(Z(BD.torso[0]), Z(BD.torso[1]), BD.torso[2], BD.torso[3]), zc, BD.squeeze),
    ell(Z(BD.withers_c), BD.withers_r), ell(Z(BD.rump_c), BD.rump_r), ell(Z(BD.chest_c), BD.chest_r),
    squeezeZ(cone(Z(BD.neck[0]), Z(BD.neck[1]), BD.neck[2], BD.neck[3]), zc, BD.neck_squeeze),
    ...chain(BD.tail.map((p: V3) => Z(p)), BD.tail_r), ell(Z(BD.tuft_c), BD.tuft_r),
    ...[legAt(LG.hind_dz, 0), legAt(-LG.hind_dz, LG.hind_far_dx)].map(m => ell(m(LG.thigh_c), LG.thigh_r)), // the haunches
  ];
  const bodyMass = unionOf(P, BD.blend);
  // ---- legs (D-151): each leg is its side outline extruded to a width that narrows down the leg, arrises rounded; the
  // forearm muscle swells at the front; a tendon groove runs down the back of each cannon; the claws of the hoof are cleft
  const interp = (tab: number[][], y: number) => { if (y <= tab[0][0]) return tab[0][1]; for (let i = 1; i < tab.length; i++) if (y <= tab[i][0]) { const [y0, w0] = tab[i - 1], [y1, w1] = tab[i]; return w0 + ((w1 - w0) * (y - y0)) / (y1 - y0); } return tab[tab.length - 1][1]; };
  const foreOut = flat2(LG.fore_outline), hindOut = flat2(LG.hind_outline), fm = LG.fore_muscle;
  const foreBack = (y: number) => { let b = Infinity; for (let i = 0; i < foreOut.length; i += 2) if (Math.abs(foreOut[i + 1] - y) < 0.25 && foreOut[i] < 0) b = Math.min(b, foreOut[i]); return b; };
  const fbTendon = foreBack(0.85), hbTendon = -1.93; // the cannon's back edge (fore: outline; hind: outline, body x)
  const leg = (lx: number, y: number, q: number, out: Float64Array, wtab: number[][], tendonX: number, muscle: boolean) => {
    const w = interp(wtab, y);
    let d = smax(sdPoly2(lx, y, out), Math.abs(q) - w, LG.round);
    if (d > 0.3) return d;
    if (muscle) d = smin(d, sdEllipsoid(lx - fm[0], y - fm[1], q, fm[2], fm[2] * 3.5, w * 0.95), 0.06); // forearm muscle
    if (detail) {
      if (y > LG.tendon_y[0] && y < LG.tendon_y[1]) d = Math.max(d, -Math.max(Math.abs(lx - (tendonX + 0.05)) - LG.tendon_w, w - LG.tendon_d - Math.abs(q))); // tendon groove
      d = Math.max(d, -Math.max(Math.abs(q) - LG.cleft_w, y - LG.cleft_h, -lx - 0.25)); // the cleft between the claws
    }
    return d;
  };
  const legs = (x: number, y: number, z: number) => {
    if (y > 2.75) return 1e9;
    let d = 1e9;
    for (const [dz, dx] of [[LG.fore_dz, 0], [-LG.fore_dz, LG.fore_far_dx]]) d = Math.min(d, leg(x - LG.fore_x - dx, y, z - zc - dz, foreOut, LG.fore_w, fbTendon, true));
    for (const [dz, dx] of [[LG.hind_dz, 0], [-LG.hind_dz, LG.hind_far_dx]]) d = Math.min(d, leg(x - dx, y, z - zc - dz, hindOut, LG.hind_w, hbTendon, false));
    return d;
  };
  // ---- heads
  const fbU = r('protome', 'body').feature_blend;
  const HB = model === 'bull' ? r('colossus', 'bull_head') : null, bh = HB ? bullHead(r('protome', 'head'), r('protome', 'horns'), fbU, detail, HB.horn_z) : null;
  const hP0 = HB?.poll ?? [0, 0], hM0 = HB?.muzzle ?? [1, 0], hl = Math.hypot(hM0[0] - hP0[0], hM0[1] - hP0[1]), hax = [(hM0[0] - hP0[0]) / hl, (hM0[1] - hP0[1]) / hl], htn = [-hax[1], hax[0]], hk = HB?.scale ?? 1;
  const bullHeadAt = (x: number, y: number, z: number) => {
    const dx = x - hP0[0], dy = y - hP0[1];
    if (dx * dx + dy * dy > 1.4 * 1.4) return 1e9;
    const [hd, horn, ear] = bh!((dx * hax[0] + dy * hax[1]) / hk, (dx * htn[0] + dy * htn[1]) / hk, Math.abs(z - zc) / hk);
    return hk * Math.min(hd, horn, ear);
  };
  const HM = model === 'lamassu' ? r('colossus', 'human_head') : null, CR = HM ? r('colossus', 'crown') : null, WG = HM ? r('colossus', 'wing') : null;
  // the beard's bands from its top down (BE.bands): [kind, top, bottom] in metres below the top
  const bandList: [string, number, number][] = []; { let t = 0; for (const [k, n] of BE.bands as [string, number][]) { const h = k === 'curls' ? n * BE.pitch : n; bandList.push([k, t, t + h]); t += h; } }
  const beardTop = HM ? HM.lips[0][1] - HM.lips[1][1] : 0, beardBot = HM ? HM.beard[0][1] - HM.beard[1][1] : 0;
  const bandAt = (v: number) => { for (const b of bandList) if (v < b[2]) return b[0]; return bandList[bandList.length - 1][0]; };
  const faceProf = HM ? flat2(HM.face_profile) : new Float64Array(0), noseProf = HM ? flat2(HM.nose_profile) : new Float64Array(0);
  const humanHead = (x: number, y: number, z: number) => {
    const w = Math.abs(z - zc), H = HM!;
    if (Math.hypot(x - 2.0, y - 4.3) > 1.35) return 1e9;
    // the face (D-151): its profile (brow, a straight line from the forehead down the cheek front, the lips, the chin)
    // extruded to the face's width at each height, arrises rounded: a face of planes as the reliefs carve it; the nose its
    // own profile and a wedge that widens to the nostrils; eyes in shallow sockets under heavy upper lids
    const cr = H.cranium;
    let d = sdEllipsoid(x - cr[0][0], y - cr[0][1], w, cr[1][0], cr[1][1], cr[1][2]);
    d = smin(d, smax(sdPoly2(x, y, faceProf), w - interp(H.face_width, y), H.face_round), 0.06);
    d = smin(d, smax(sdPoly2(x, y, noseProf), w - interp(H.nose_width, y), H.nose_round), 0.015);
    const sk = H.socket, sr = H.socket_r; d = smax(d, -sdEllipsoid(x - sk[0], y - sk[1], w - sk[2], sr[0], sr[1], sr[2]), 0.01); // the eye socket
    const e = H.eye, er = H.eye_r, lc = H.lid, lr = H.lid_r, ll = H.lower_lid;
    d = smin(d, sdEllipsoid(x - e[0], y - e[1], w - e[2], er[0], er[1], er[2]), 0.006);
    d = smin(d, Math.max(sdEllipsoid(x - lc[0], y - lc[1], w - lc[2], lr[0], lr[1], lr[2]), e[1] + H.lid_cut - y), 0.006); // the heavy upper lid
    d = smin(d, sdCapsule(x, y, w, ll[0][0], ll[0][1], ll[0][2], ll[1][0], ll[1][1], ll[1][2], ll[2]), 0.006); // the lower lid
    if (detail) { const n = H.nostril, nr = H.nostril_r; d = smax(d, -sdEllipsoid(x - n[0], y - n[1], w - n[2], nr[0], nr[1], nr[2]), 0.004); }
    const lp = H.lips; d = smin(d, sdEllipsoid(x - lp[0][0], y - lp[0][1], w, lp[1][0], lp[1][1], lp[1][2]), 0.015);
    for (let i = 0; i + 1 < H.moustache.length; i++) { const a = H.moustache[i], b = H.moustache[i + 1]; d = smin(d, sdRoundCone(x, y, w, a[0], a[1], a[2], b[0], b[1], b[2], H.moustache_r[i], H.moustache_r[i + 1]), 0.012); }
    if (detail) { const mo = H.mouth; d = smax(d, -sdCapsule(x, y, w, mo[0][0], mo[0][1], mo[0][2], mo[1][0], mo[1][1], mo[1][2], mo[2]), 0.004); }
    const hr = H.hair; d = smin(d, sdBox(x - hr[0][0], y - hr[0][1], w, hr[1][0], hr[1][1], hr[1][2], H.hair_rad), 0.05);
    const ear = leafSDF([x, y, w], H.ear[0], H.ear[1], H.ear_w, H.ear_t, [0.4, -0.3, 0.85]);
    d = smin(d, ear.d, 0.015);
    d = smin(d, sdEllipsoid(x - H.earring_c[0], y - H.earring_c[1], w - H.earring_c[2], H.earring_r, H.earring_r * 1.3, H.earring_r), 0.01);
    return d;
  };
  // the rectangular beard: smooth under its bands of locks (placed as templates), with the strand bands carved in grooves.
  // It joins the chin in a soft fillet but stands off the chest in a crisp step (BE.blend: [below, at the chin]): blended
  // into the body as the head is, its underside filleted down over the smooth band of chest under it
  const beardAt = (x: number, y: number, z: number) => {
    const w = Math.abs(z - zc), H = HM!, bd = H.beard;
    let beard = sdBox(x - bd[0][0], y - bd[0][1], w, bd[1][0], bd[1][1], bd[1][2], H.beard_rad);
    if (detail && beard < 0.03 && y < beardTop && y > beardBot) {
      const v = beardTop - y;
      if (bandAt(v) === 'strands') {
        const front = x > H.beard_front - 0.06, u = front ? w : x; // strands run down the front and the sides
        const s = u + BE.wave_amp * Math.sin((2 * Math.PI * v) / BE.wave_len), g = Math.abs(((((s / BE.strand_pitch) % 1) + 1) % 1) - 0.5) * 2; // 1 between strands
        beard += BE.strand_d * smoothstep(0.55, 1, g);
      }
    }
    return beard;
  };
  const crown = (x: number, y: number, z: number) => {
    const px = x - CR.c, pz = z - zc, rr = Math.hypot(px, pz);
    let d = sdCylY(px, y, pz, CR.r, CR.y[0], CR.y[1]);
    if (d > 0.15) return d;
    // three pairs of horns wrapping the tiara: thick where the pair meets at the front, tapering round to the back
    const fr = 0.5 + (0.5 * px) / Math.max(rr, 1e-6), tube = CR.horn_r[1] + (CR.horn_r[0] - CR.horn_r[1]) * fr * fr;
    for (const yb of CR.horn_y) {
      let h = Math.hypot(rr - CR.r, y - yb) - tube;
      if (detail && px > 0) h = Math.max(h, -(Math.abs(pz) - CR.horn_notch * fr)); // the two horns of a pair meet in a notch
      d = Math.min(d, h);
    }
    // a band of rosette bosses, then a crest of upright ribs
    const a = Math.atan2(pz, px), step = (2 * Math.PI) / CR.rosettes, ai = Math.round(a / step) * step;
    d = Math.min(d, sdEllipsoid(px - Math.cos(ai) * CR.r, y - CR.rosette_y, pz - Math.sin(ai) * CR.r, CR.rosette_r * 0.6, CR.rosette_r, CR.rosette_r));
    const rib = Math.abs(((((a / (2 * Math.PI)) * CR.ribs) % 1) + 1) % 1 - 0.5) * 2;
    if (y > CR.crest_y) d -= CR.rib_amp * smoothstep(0.5, 0, rib) * smoothstep(CR.crest_y, CR.crest_y + 0.03, y);
    return d;
  };
  // ---- the wing (lamassu, D-151): rows of coverts in front, a split, then long primaries with ribs and stepped lower
  // edges, their tips stepped at the rear
  const wing = (x: number, y: number, z: number) => {
    const t = clamp((WG.x_front - x) / (WG.x_front - WG.x_back), 0, 1);
    const ylo = WG.lower[0] + (WG.lower[1] - WG.lower[0]) * t, yhi = WG.upper[0] + (WG.upper[1] - WG.upper[0]) * Math.pow(t, WG.upper_pow), hb = Math.max(0.05, yhi - ylo);
    const q = clamp((y - ylo) / hb, 0, 0.9999), pi = Math.floor(q * WG.primaries), bandH = hb / WG.primaries;
    const xEnd = WG.x_back - (WG.tip_len[0] + ((WG.tip_len[1] - WG.tip_len[0]) * pi) / (WG.primaries - 1));
    const yMid = ylo + (pi + 0.5) * bandH;
    let d2 = Math.max(ylo - y, y - yhi, x - WG.x_front);
    d2 = Math.max(d2, x < xEnd + bandH / 2 ? Math.hypot(xEnd + bandH / 2 - x, (y - yMid) * 1.0) - bandH / 2 : xEnd - x); // rounded feather tips
    d2 = Math.max(d2, Math.hypot(Math.max(0, x - (WG.x_front - WG.front_r)), Math.max(0, y - (yhi - WG.front_r))) - WG.front_r); // rounded shoulder
    const zs = W2 - WG.inset;
    let d = Math.max(d2, z - zs, zbg - WG.inset - z);
    if (d < 0.1) {
      let h = 0;
      if (x > WG.x_split) { // coverts: rows parallel to the wing's edges, each feather's rounded tip standing over the row below
        const rq = q * WG.rows, ri = Math.floor(rq), fr = rq - ri, fu = x / WG.covert_w + (ri & 1 ? 0.5 : 0), cu = fu - Math.floor(fu) - 0.5;
        const tipEdge = WG.covert_tip * (1 - Math.sqrt(Math.max(0, 1 - 4 * cu * cu)));
        h = fr < tipEdge ? WG.covert_amp * 0.45 : WG.covert_amp * (1 - (0.55 * (fr - tipEdge)) / (1 - tipEdge)) + (detail ? WG.covert_amp * 0.18 * Math.max(0, 1 - Math.abs(cu) / 0.07) : 0);
      } else { // primaries: each stands prim_step higher at its lower edge where it overlies the one below; a rib along its middle
        const pf = q * WG.primaries - pi;
        h = WG.prim_amp * (1 - WG.prim_step * pf) + (detail ? WG.rib_h * Math.max(0, 1 - Math.abs(pf - 0.45) * bandH / WG.rib_w) : 0);
      }
      d -= h * smoothstep(zs - 0.1, zs, z);
      d = smax(d, -Math.max(Math.abs(x - WG.x_split) - WG.split_w, zs - 0.03 - z), 0.004); // the split between coverts and primaries
    }
    return d;
  };
  const head = HM ? humanHead : bullHeadAt;
  const base: SDF = (x, y, z) => {
    // jamb block with the relief field recessed on the passage face (open at the front and at the foot)
    let block = sdBox(x - (-L2 + xf) / 2, y - Ht / 2, z, (xf + L2) / 2, Ht / 2, W2);
    const rx0 = -L2 + J.frame_back, rx1 = xf + 1, ry1 = Ht - J.frame_top;
    const rec = sdBox(x - (rx0 + rx1) / 2, y - (ry1 - 1) / 2, z - (zbg + W2 + 1) / 2, (rx1 - rx0) / 2, (ry1 + 1) / 2, (W2 + 1 - zbg) / 2, J.recess_r);
    block = Math.max(block, -rec);
    let d = smin(bodyMass(x, y, z), legs(x, y, z), 0.08);
    d = smin(d, head(x, y, z), BD.blend * 0.7);
    if (HM) d = smin(d, beardAt(x, y, z), BE.blend[0] + (BE.blend[1] - BE.blend[0]) * smoothstep(beardBot + 0.15, beardTop - 0.05, y));
    if (HM) d = smin(Math.min(d, crown(x, y, z)), wing(x, y, z), J.fillet);
    d = smin(block, d, J.fillet);
    return Math.max(d, sdBox(x, y - Ht / 2, z, L2, Ht / 2, W2)); // never outside the jamb box (= the plinth footprint)
  };
  // ---- locks (LOD0): chest front and side, belly fringe, haunch, fetlock tufts; bull forelock; lamassu beard bands and hair
  let locks: LockSet | undefined;
  if (detail) {
    const lk = { pitch: CU.pitch, rad: CU.rad, amp: CU.rad * CU.height };
    const chestTop = HM ? Math.min(CU.chest_y[1], beardBot - BE.chest_gap - CU.rad) : CU.chest_y[1]; // whole locks below the gap under the beard
    const onBody = (p: V3) => p[2] > zbg + 0.15; // a side chart's ray must meet the carving, not the cut-back background
    const side = (o: number): Pick<LockChart, 'origin' | 'du' | 'dv' | 'dir' | 'accept'> => ({ origin: [0, 0, W2 + 0.6 + o], du: [1, 0, 0], dv: [0, 1, 0], dir: [0, 0, -1], accept: onBody });
    const chestSide = flat2(CU.chest_side), haunch = flat2(CU.haunch), hair = flat2(BE.hair);
    const charts: LockChart[] = [
      { origin: [L2 + 0.6, 0, zc], du: [0, 0, 1], dv: [0, 1, 0], dir: [-1, 0, 0], u: [-0.6, 0.6], v: [CU.chest_y[0], chestTop], inField: (u, v) => Math.abs(u) <= CU.chest_w[0] + ((CU.chest_w[1] - CU.chest_w[0]) * (v - CU.chest_y[0])) / (CU.chest_y[1] - CU.chest_y[0]), ...lk },
      { ...side(0), u: [1.9, 2.5], v: [CU.chest_y[0], chestTop], inField: (u, v) => sdPoly2(u, v, chestSide) < 0, ...lk },
      { ...side(0), u: CU.belly_x, v: CU.belly_y, inField: () => true, ...lk },
      { ...side(0), u: [-2.0, -1.2], v: [2.2, 3.3], inField: (u, v) => sdPoly2(u, v, haunch) < 0, pitch: CU.pitch * CU.haunch_scale, rad: CU.rad * CU.haunch_scale, amp: lk.amp * CU.haunch_scale },
    ];
    if (HB) { const fs = r('protome', 'curls').forelock_scale * hk, pc = r('protome', 'curls'); charts.push({ origin: [hP0[0] + htn[0] * 0.8, hP0[1] + htn[1] * 0.8, zc], du: [hax[0], hax[1], 0], dv: [0, 0, 1], dir: [-htn[0], -htn[1], 0], u: [pc.forelock_s[0] * hk, pc.forelock_s[1] * hk], v: [-pc.forelock_w * hk, pc.forelock_w * hk], inField: () => true, pitch: pc.pitch * fs, rad: pc.rad * fs, amp: pc.rad * fs * CU.height }); }
    if (HM) {
      const bl = { pitch: BE.pitch, rad: BE.rad, amp: BE.rad * CU.height }, top = beardTop - BE.pitch / 2;
      const curlsAt = (v: number) => bandAt(v + BE.pitch / 2) === 'curls' && beardTop - (v + BE.pitch / 2) > beardBot;
      charts.push({ origin: [HM.beard_front + 0.5, top, zc], du: [0, 0, 1], dv: [0, -1, 0], dir: [-1, 0, 0], u: [-0.3, 0.3], v: [0, beardTop - beardBot], inField: (u, v) => curlsAt(v) && Math.abs(u) <= HM.beard[1][2] - 0.02, ...bl });
      charts.push({ origin: [0, top, W2 + 0.6], du: [1, 0, 0], dv: [0, -1, 0], dir: [0, 0, -1], u: [HM.beard[0][0] - HM.beard[1][0], HM.beard_front - 0.08], v: [0, beardTop - beardBot], inField: (u, v) => curlsAt(v), ...bl });
      charts.push({ ...side(0), u: [1.45, 1.98], v: [3.8, 4.75], inField: (u, v) => sdPoly2(u, v, hair) < 0, ...bl });
    }
    const list = placeLocks(base, charts);
    // a tuft of hair behind each fetlock
    for (const [x0, zz] of [[LG.fore_x + fbTendon - 0.25, zc + LG.fore_dz], [LG.fore_x + LG.fore_far_dx + fbTendon - 0.25, zc - LG.fore_dz], [-L2 + J.frame_back + 0.05, zc + LG.hind_dz]] as [number, number][])
      list.push(...placeLocks(base, [{ origin: [x0, CU.fetlock_y, zz], du: [0, 0, 1], dv: [0, 1, 0], dir: [1, 0, 0], u: [-0.001, 0.001], v: [-0.001, 0.001], inField: () => true, pitch: CU.pitch, rad: CU.rad * CU.fetlock_scale, amp: CU.rad * CU.fetlock_scale * CU.height }], 0));
    locks = { list, surface: base, turns: CU.turns, gw: CU.groove_w, gd: CU.groove_d, bevel: CU.bevel, height: CU.height, depth: CU.depth, tris: MC.lock_tris };
  }
  // LOD1: the chest field as a low pad of the locks' mean height
  const f: SDF = (x, y, z) => {
    const d = base(x, y, z);
    if (detail || d > 0.06 || x < 1.9 || y < CU.chest_y[0] - 0.1 || y > CU.chest_y[1] + 0.1) return d;
    const wv = CU.chest_w[1] + CU.rad, u = Math.abs(z - zc);
    return d - CU.rad * CU.height * CU.pad_h * (1 - smoothstep(wv - 0.05, wv, u)) * smoothstep(CU.chest_y[0] - 0.05, CU.chest_y[0] + 0.05, y) * (1 - smoothstep((HM ? beardBot - BE.chest_gap : CU.chest_y[1]) - 0.05, (HM ? beardBot - BE.chest_gap : CU.chest_y[1]) + 0.05, y));
  };
  const weight = (x: number, y: number, z: number) => {
    if (x > 1.6 && y > 3.3) return MC.weight_face;
    if (HM && y > 3.55 && z > zbg && x < WG.x_front + 0.1) return MC.weight_wing;
    if (z < zbg - 0.05 || x < -L2 + J.frame_back - 0.02 || y > Ht - J.frame_top + 0.02) return MC.weight_block;
    return 1;
  };
  const m = 0.04;
  return { f, min: [-L2 - m, -m, -W2 - m], max: [L2 + m, Ht + m, W2 + m], weight, locks };
}
