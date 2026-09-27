// The carving layer of the Blender sources (D-306): the relief the photographs of the capitals and the Gate's colossi show
// and the project's signed-distance models do not carry (bead rows, harness and collar bands with rosettes, the ridged mane,
// feather barbs). It is MAP-ONLY relief: added to the dense source surface that Blender bakes from (tools/blender/bake.py),
// never to the game's triangles (the game's pieces, their budgets and the instance fitting stay as they are; the carving
// reaches the screen as the baked normal and occlusion maps).
//
// Every motif is data (tools/blender/carving.json: layout, sizes, tier and the photograph it was read from); this file only
// places and profiles it:
//  - a PATH is a polyline given in the model's own units, each point either [x, y] (projected onto the flank from +z, as the
//    lock charts of sculpt_models.ts project) or [x, y, z] (snapped onto the nearest surface along the SDF gradient); it is
//    resampled densely, projected, and measured in 3D arc length;
//  - on a path: BEADS (hemispherical bosses at a pitch), a BAND (a flat raised strap with bevelled edges, a bead row along
//    each edge, rosettes along its middle), a RIDGE field (the mane: rows of short tongue-shaped locks across the path),
//    a ROSETTE row;
//  - FIELDS are relief functions of position under a mask (the lamassu's feather barbs, the crown's rosette petals).
// The relief r(p) >= 0 is the largest of the motifs at p (they do not add) and the source surface is f(p) - r(p): a bump of
// height r along the surface normal, exact enough for reliefs of a few millimetres on forms of metres.
import type { SDF } from '../../../src/arch/sdf';
import { smoothstep } from '../../../src/arch/sdf';

export type V3 = [number, number, number];
const sub = (a: V3, b: V3): V3 => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const add = (a: V3, b: V3, s = 1): V3 => [a[0] + b[0] * s, a[1] + b[1] * s, a[2] + b[2] * s];
const dot = (a: V3, b: V3) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const cross = (a: V3, b: V3): V3 => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const norm = (a: V3): V3 => { const l = Math.hypot(a[0], a[1], a[2]) || 1; return [a[0] / l, a[1] / l, a[2] / l]; };
export const grad = (f: SDF, p: V3, e = 1e-4): V3 => norm([f(p[0] + e, p[1], p[2]) - f(p[0] - e, p[1], p[2]), f(p[0], p[1] + e, p[2]) - f(p[0], p[1] - e, p[2]), f(p[0], p[1], p[2] + e) - f(p[0], p[1], p[2] - e)]);

/** a point on the surface: position, outward normal */
export interface SP { p: V3; n: V3 }
/** march from `o` along `dir` to the surface of f (null: no hit within `reach`) */
export function march(f: SDF, o: V3, dir: V3, reach = 4): SP | null {
  let p = o, t = 0;
  for (let k = 0; k < 400 && t < reach; k++) { const d = f(p[0], p[1], p[2]); if (Math.abs(d) < 1e-5) return { p, n: grad(f, p) }; const st = Math.max(d * 0.7, 2e-5); p = add(p, dir, st); t += st; }
  return null;
}
/** snap `p` onto the nearest surface (Newton steps along the gradient) */
export function snap(f: SDF, p: V3): SP {
  let q = p;
  for (let k = 0; k < 30; k++) { const d = f(q[0], q[1], q[2]); if (Math.abs(d) < 1e-6) break; q = add(q, grad(f, q), -d); }
  return { p: q, n: grad(f, q) };
}

/** a path on the surface: dense samples with arc length s, surface normal n, tangent t and binormal b = t x n (in the
 *  surface, to the path's left) */
export interface PathS { p: V3[]; n: V3[]; t: V3[]; b: V3[]; s: number[]; len: number }
export interface PathSpec { pts: number[][]; side?: number; step?: number }
/** resample the polyline at `step` (in its own space), put each point on the surface, measure it */
export function surfacePath(f: SDF, spec: PathSpec, defStep: number): PathS {
  const step = spec.step ?? defStep, side = spec.side ?? 2.5, raw: number[][] = [];
  for (let i = 0; i + 1 < spec.pts.length; i++) {
    const a = spec.pts[i], b = spec.pts[i + 1], L = Math.hypot(...a.map((x, k) => (b[k] ?? 0) - x)), n = Math.max(1, Math.ceil(L / step));
    for (let j = 0; j < n; j++) raw.push(a.map((x, k) => x + ((b[k] - x) * j) / n));
  }
  raw.push(spec.pts[spec.pts.length - 1]);
  const on: SP[] = [];
  for (const q of raw) {
    const hit = q.length === 2 ? march(f, [q[0], q[1], side], [0, 0, -1], side * 2) : snap(f, q as V3);
    if (hit) on.push(hit);
  }
  const P: PathS = { p: [], n: [], t: [], b: [], s: [], len: 0 };
  let s = 0;
  on.forEach((h, i) => {
    if (i) s += Math.hypot(...sub(h.p, on[i - 1].p));
    const a = on[Math.max(0, i - 1)].p, c = on[Math.min(on.length - 1, i + 1)].p;
    let t = sub(c, a); t = norm(add(t, h.n, -dot(t, h.n)));
    P.p.push(h.p); P.n.push(h.n); P.t.push(t); P.b.push(cross(t, h.n)); P.s.push(s);
  });
  P.len = s; return P;
}
/** the point at arc length s along a path (and its frame) */
export function along(P: PathS, s: number) {
  let i = 0; while (i + 1 < P.s.length && P.s[i + 1] < s) i++;
  const j = Math.min(P.s.length - 1, i + 1), w = P.s[j] > P.s[i] ? (s - P.s[i]) / (P.s[j] - P.s[i]) : 0;
  const lerp = (A: V3[]) => add(A[i], sub(A[j], A[i]), w);
  return { p: lerp(P.p), n: norm(lerp(P.n)), t: norm(lerp(P.t)), b: norm(lerp(P.b)) };
}
/** a path offset sideways (along its binormal, in the surface) by `d`, re-snapped onto the surface */
export function offsetPath(f: SDF, P: PathS, d: number): PathS {
  const pts = P.p.map((p, i) => snap(f, add(p, P.b[i], d)).p as number[]);
  return surfacePath(f, { pts: pts.filter((_, i) => i % 1 === 0), step: 1e9 }, 1e9);
}

// ------------------------------------------------------------------ primitives, looked up through a spatial hash
interface Bead { c: V3; n: V3; r: number; h: number }
interface Rosette { c: V3; n: V3; u: V3; R: number; h: number; petals: number }
interface Strip { P: PathS; w: number; prof: (s: number, t: number) => number; hmax: number }
export interface Field { mask: (x: number, y: number, z: number) => number; rel: (x: number, y: number, z: number) => number }

const NONE: never[] = [];
class Hash<T> {
  private m = new Map<number, T[]>();
  constructor(readonly cs: number) {}
  // integer cell keys (a string key per lookup cost 10x the model's own SDF)
  private static k(i: number, j: number, k: number) { return ((i + 2048) * 4096 + (j + 2048)) * 4096 + (k + 2048); }
  /** file v under every cell its reach (a sphere of radius rad round p) touches: a lookup then reads one cell */
  put(p: V3, v: T, rad: number) {
    const lo = [0, 1, 2].map(q => Math.floor((p[q] - rad) / this.cs)), hi = [0, 1, 2].map(q => Math.floor((p[q] + rad) / this.cs));
    for (let i = lo[0]; i <= hi[0]; i++) for (let j = lo[1]; j <= hi[1]; j++) for (let k = lo[2]; k <= hi[2]; k++) { const key = Hash.k(i, j, k); let a = this.m.get(key); if (!a) this.m.set(key, (a = [])); a.push(v); }
  }
  near(x: number, y: number, z: number): T[] | undefined { return this.m.get(Hash.k(Math.floor(x / this.cs), Math.floor(y / this.cs), Math.floor(z / this.cs))); }
}

/** a bead: a rounded boss (height h over radius r, h ~ 0.6 r), its foot rounded into the ground: (1 - q²/r²)^1.5, whose
 *  slope stays finite at the foot (a hemisphere's vertical foot polygonised into spikes on a cell of r/3, D-306) */
export const beadProfile = (q: number, r: number, h: number) => { if (q >= r) return 0; const a = 1 - (q * q) / (r * r); return h * a * Math.sqrt(a); };
/** a rosette of `k` petals round a domed boss (the Achaemenid rosette: pointed petals, each with a shallow midrib groove),
 *  (rho, ang) in its plane, R its radius */
export function rosetteProfile(rho: number, ang: number, R: number, h: number, k: number) {
  if (rho >= R) return 0;
  const boss = 0.3 * R;
  if (rho < boss) return h * (0.75 + 0.25 * Math.sqrt(1 - (rho * rho) / (boss * boss)));
  const q = (rho - boss) / (R - boss); // 0 at the boss, 1 at the petal tips
  const ph = (((ang * k) / (2 * Math.PI)) % 1 + 1) % 1 - 0.5; // -0.5..0.5 across one petal
  const wHalf = 0.44 * Math.sin(Math.PI * Math.min(1, 0.15 + q * 0.95)); // almond: narrow at the boss, widest at 0.4, pointed tip
  if (Math.abs(ph) >= wHalf) return 0;
  const x = Math.abs(ph) / wHalf, dome = Math.sqrt(1 - x * x);
  const rib = 1 - 0.35 * Math.max(0, 1 - x / 0.18); // the midrib groove
  return h * 0.7 * dome * rib * (1 - 0.35 * q);
}

export class Relief {
  beads = new Hash<Bead>(0.1); rosettes = new Hash<Rosette>(0.2); strips = new Hash<{ S: Strip; i: number }>(0.1);
  fields: Field[] = []; hmax = 0; counts = { beads: 0, rosettes: 0, strips: 0, fields: 0 };
  constructor(readonly cell: number) { this.beads = new Hash(cell); this.rosettes = new Hash(cell); this.strips = new Hash(cell); }
  bead(c: V3, n: V3, r: number, h: number) { this.beads.put(c, { c, n, r, h }, r * 1.5); this.hmax = Math.max(this.hmax, h); this.counts.beads++; }
  rosette(c: V3, n: V3, u: V3, R: number, h: number, petals: number) { this.rosettes.put(c, { c, n, u, R, h, petals }, R); this.hmax = Math.max(this.hmax, h); this.counts.rosettes++; }
  strip(P: PathS, w: number, hmax: number, prof: (s: number, t: number) => number) {
    const S: Strip = { P, w, prof, hmax };
    P.p.forEach((p, i) => this.strips.put(p, { S, i }, w + hmax + 0.02 * w)); this.hmax = Math.max(this.hmax, hmax); this.counts.strips++;
  }
  field(F: Field, hmax: number) { this.fields.push(F); this.hmax = Math.max(this.hmax, hmax); this.counts.fields++; }
  /** beads at `pitch` along a path, from `s0` to `s1` (arc length; default the whole path, centred) */
  beadsAlong(P: PathS, pitch: number, r: number, h: number, s0 = 0, s1 = P.len) {
    const n = Math.floor((s1 - s0) / pitch + 1e-6), pad = (s1 - s0 - n * pitch) / 2;
    for (let k = 0; k <= n; k++) { const a = along(P, s0 + pad + k * pitch); this.bead(a.p, a.n, r, h); }
  }
  rosettesAlong(P: PathS, pitch: number, R: number, h: number, petals: number) {
    const n = Math.floor(P.len / pitch), pad = (P.len - (n - 1) * pitch) / 2;
    for (let k = 0; k < n; k++) { const a = along(P, pad + k * pitch); this.rosette(a.p, a.n, a.t, R, h, petals); }
  }
  /** the relief at p (>= 0) */
  at(x: number, y: number, z: number): number {
    let best = 0;
    for (const B of this.beads.near(x, y, z) ?? NONE) {
      const q = [x - B.c[0], y - B.c[1], z - B.c[2]] as V3, hn = dot(q, B.n); if (Math.abs(hn) > B.r * 1.5) continue;
      const qq = Math.sqrt(Math.max(0, dot(q, q) - hn * hn)); if (qq < B.r) best = Math.max(best, beadProfile(qq, B.r, B.h));
    }
    for (const R of this.rosettes.near(x, y, z) ?? NONE) {
      const q = [x - R.c[0], y - R.c[1], z - R.c[2]] as V3, hn = dot(q, R.n); if (Math.abs(hn) > R.R) continue;
      const a = dot(q, R.u), v = cross(R.n, R.u), b = dot(q, v), rho = Math.hypot(a, b);
      if (rho < R.R) best = Math.max(best, rosetteProfile(rho, Math.atan2(b, a), R.R, R.h, R.petals));
    }
    let bs: { S: Strip; i: number } | null = null, bd = Infinity;
    for (const e of this.strips.near(x, y, z) ?? NONE) { const p = e.S.P.p[e.i], d = (x - p[0]) ** 2 + (y - p[1]) ** 2 + (z - p[2]) ** 2; if (d < bd) { bd = d; bs = e; } }
    if (bs) {
      const { S, i } = bs, P = S.P, q = [x - P.p[i][0], y - P.p[i][1], z - P.p[i][2]] as V3;
      if (Math.abs(dot(q, P.n[i])) < S.w + S.hmax) {
        const t = dot(q, P.b[i]), s = P.s[i] + dot(q, P.t[i]);
        if (Math.abs(t) < S.w && s >= 0 && s <= P.len) best = Math.max(best, S.prof(s, t));
      }
    }
    for (const F of this.fields) { const m = F.mask(x, y, z); if (m > 0) best = Math.max(best, m * F.rel(x, y, z)); }
    return best;
  }
  /** the carved surface: f minus the relief (evaluated only near the surface) */
  apply(f: SDF, sym?: (x: number, y: number, z: number) => V3): SDF {
    const reach = this.hmax * 3 + 1e-3;
    return (x, y, z) => {
      const d = f(x, y, z); if (d > reach || d < -reach) return d;
      const q = sym ? sym(x, y, z) : [x, y, z];
      return d - this.at(q[0], q[1], q[2]);
    };
  }
}

// ------------------------------------------------------------------ motifs from the data (carving.json)
export interface BeadsSpec { kind: 'beads'; path: PathSpec; pitch: number; r: number; h: number; offsets?: number[] }
export interface BandSpec { kind: 'band'; path: PathSpec; w: number; h: number; bevel: number; bead_r: number; bead_h: number; bead_pitch: number; rosette?: { pitch: number; R: number; h: number; petals: number } }
export interface RidgeSpec { kind: 'ridges'; path: PathSpec; w: number; rows: number; pitch: number; h: number; groove: number; border?: { r: number; h: number; pitch: number } }
export interface FringeSpec { kind: 'fringe'; top: PathSpec; rows: number[]; pitch: number; spacing: number; r: number; h: number; dir?: number[] }
export type MotifSpec = (BeadsSpec | BandSpec | RidgeSpec | FringeSpec) & { name: string; tier: string; note?: string; src?: string };

/** a bevelled flat strap: h on its face, falling over `bevel` at each edge */
const strapProfile = (w: number, h: number, bevel: number) => (_s: number, t: number) => h * smoothstep(w, w - bevel, Math.abs(t));
/** the ridged mane (the capitals' and bulls' neck crest): `rows` rows across the band, each of short tongue-shaped locks at
 *  `pitch` along it, staggered by half a pitch row to row; each lock a rounded ridge whose tip (the row's outer edge) is
 *  rounded, with a groove `groove` deep between neighbours */
export function maneProfile(w: number, rows: number, pitch: number, h: number, groove: number) {
  const rw = w / rows; // |t| from 0 (the crest) to w; rows count outward
  return (s: number, t: number) => {
    const at = Math.abs(t), ri = Math.min(rows - 1, Math.floor(at / rw)), fr = at / rw - ri; // fr 0 at the row's inner edge
    const off = ri & 1 ? pitch / 2 : 0, u = ((((s - off) / pitch) % 1) + 1) % 1 - 0.5; // -0.5..0.5 across a lock
    const tip = 0.5 * Math.sqrt(Math.max(0, 1 - 4 * u * u)); // the lock's rounded tip reaches fr = 0.5 + tip
    if (fr > 0.5 + tip) return h * 0.35 * (1 - smoothstep(0.5 + tip, 1, fr)) + h * 0.2; // the ground between the tips, under the next row
    const ridge = Math.sqrt(Math.max(0, 1 - (2 * u) ** 2 * 1.1));
    const fall = smoothstep(0.5 + tip, 0.5 + tip - 0.12, fr); // the tip's rounded fall
    return h * (1 - groove * (1 - ridge)) * fall * (1 - 0.25 * fr) * (1 - smoothstep(w * 0.97, w, at) * 1);
  };
}

export function buildRelief(f: SDF, motifs: MotifSpec[], cell: number, step: number): { R: Relief; log: Record<string, any> } {
  const R = new Relief(cell), log: Record<string, any> = {};
  for (const M of motifs) {
    if (M.kind === 'beads') {
      const P = surfacePath(f, M.path, step);
      for (const o of M.offsets ?? [0]) R.beadsAlong(o ? offsetPath(f, P, o) : P, M.pitch, M.r, M.h);
      log[M.name] = { len: +P.len.toFixed(3), samples: P.p.length };
    } else if (M.kind === 'band') {
      const P = surfacePath(f, M.path, step);
      R.strip(P, M.w, M.h, strapProfile(M.w, M.h, M.bevel));
      for (const o of [-1, 1]) R.beadsAlong(offsetPath(f, P, o * (M.w - M.bead_r * 0.9)), M.bead_pitch, M.bead_r, M.h + M.bead_h);
      if (M.rosette) {
        // rosettes stand on the strap's face (the strap under them is part of their height)
        const n = Math.floor(P.len / M.rosette.pitch), pad = (P.len - (n - 1) * M.rosette.pitch) / 2;
        for (let k = 0; k < n; k++) { const a = along(P, pad + k * M.rosette.pitch); R.rosette(a.p, a.n, a.t, M.rosette.R, M.h + M.rosette.h, M.rosette.petals); }
      }
      log[M.name] = { len: +P.len.toFixed(3), samples: P.p.length };
    } else if (M.kind === 'ridges') {
      const P = surfacePath(f, M.path, step);
      R.strip(P, M.w, M.h, maneProfile(M.w, M.rows, M.pitch, M.h, M.groove));
      if (M.border) for (const o of [-1, 1]) R.beadsAlong(offsetPath(f, P, o * (M.w + M.border.r)), M.border.pitch, M.border.r, M.border.h); // the bead row that edges the mane
      log[M.name] = { len: +P.len.toFixed(3), samples: P.p.length };
    } else if (M.kind === 'fringe') {
      // short bead rows hanging from a path (the pendant of the harness): row k starts on the top path at k*spacing and runs
      // down (projected direction `dir`, default -y) for rows[k] beads
      const T = surfacePath(f, M.top, step), n = M.rows.length, pad = (T.len - (n - 1) * M.spacing) / 2, dir = (M.dir ?? [0, -1, 0]) as V3;
      M.rows.forEach((cnt, k) => {
        const a = along(T, pad + k * M.spacing);
        const pts: number[][] = [[...a.p]]; for (let j = 1; j <= cnt; j++) pts.push(add(a.p, dir, j * M.pitch) as number[]);
        const P = surfacePath(f, { pts, step: M.pitch / 4 }, step);
        R.beadsAlong(P, M.pitch, M.r, M.h, 0, P.len);
      });
      log[M.name] = { len: +T.len.toFixed(3), rows: n };
    }
  }
  log.counts = R.counts;
  return { R, log };
}
