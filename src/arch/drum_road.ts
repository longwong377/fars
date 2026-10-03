// D-754 (holes.md P2-6, Q-710 s18 D-771: C): the column drums' last stretch and their way onto the Terrace. The drums came from the
// Majdabad quarries on sledges (traffic.ts D-256: the haul ends at the drum ground at the N foot, where the ground stands at
// the court's level); how they went up is not attested (D-022). Drawn here (all C):
//  - the sledge road from the drum ground south over the hill's shoulder to the Terrace's N edge (DRUM_ROAD), on the ground as
//    the heightfield gives it (drum_road_profile.json, sampled by tools/blender/drum_road_profile.ts): a packed-earth bed
//    between kerbs of fieldstone, timber sleepers across it every SLEEPER m (the runners slide on them, wetted: the
//    sledge-haul of the Near Eastern reliefs, Sennacherib's bull colossus: B for the method elsewhere);
//  - at the edge, the bank stands ~4 m over the court (the heightfield), and an earth ramp (the rolled clay coat of the roofs) comes down
//    westward along the strip between the edge and the garrison to the court (stepped solid boxes: walkable, as the
//    construction yard's ramps, construction.ts D-570);
//  - at the drum ground, the drums waiting in rows on timber chocks and two sledges drawn up.
// The road and the props are render geometry; the ramp is parts (colliders, the walkable grid).
import * as THREE from 'three/webgpu';
import type { Box } from './parts';
import { DRUM_ROAD } from './drum_road_path';
import PROFILE from './drum_road_profile.json';
import { propMaterial } from '../render/materials';
import { Rng } from '../core/rng';

/** sizes (m, C) */
export const DR = { sleeper: 0.9, sleeperW: 0.22, sleeperH: 0.12, kerb: 0.35, ramp: { e0: 154, e1: 124, n: 159.5, w: 5.5, top: 3.9, steps: 20, landing: [146, 154, 154.8, 164.6] as [number, number, number, number] },
  drum: { r: 0.8, h: 1.0, rows: 3, per: 6, at: [150, 262] as [number, number] }, tier: 'C' as const, src: 'RECON;Q-710' };

/** the ramp from the bank at the N edge down to the court: a landing against the edge at the bank's height, then steps west */
export function drumRampParts(): Box[] {
  const R = DR.ramp, out: Box[] = [], meta = { building: 'drum_ramp', material: 'roof_earth' as const, tier: DR.tier, src: DR.src, type: 'box' as const, solid: true };
  const [lx0, lx1, ly0, ly1] = R.landing;
  out.push({ ...meta, kind: 'ramp', c: [(lx0 + lx1) / 2, (ly0 + ly1) / 2], size: [lx1 - lx0, ly1 - ly0], y0: 0, y1: R.top, note: 'the earth ramp\'s head against the bank at the N edge (D-754, C)' } as Box);
  const run = (R.e0 - R.e1 - (lx1 - lx0)) / R.steps;
  for (let i = 0; i < R.steps; i++) { const x1 = lx0 - i * run, x0 = x1 - run, top = R.top * (1 - (i + 1) / (R.steps + 1));
    out.push({ ...meta, kind: 'ramp', c: [(x0 + x1) / 2, R.n], size: [run, R.w], y0: 0, y1: top, note: 'the earth ramp down to the court (D-754, C)' } as Box); }
  return out;
}

type V3 = [number, number, number];
const W = (e: number, y: number, n: number): V3 => [e, y, -n];
class Soup {
  pos: number[] = []; nor: number[] = []; col: number[] = [];
  tri(a: V3, b: V3, c: V3, rgb: number[]) {
    const u = [b[0] - a[0], b[1] - a[1], b[2] - a[2]], v = [c[0] - a[0], c[1] - a[1], c[2] - a[2]];
    let n = [u[1] * v[2] - u[2] * v[1], u[2] * v[0] - u[0] * v[2], u[0] * v[1] - u[1] * v[0]]; const l = Math.hypot(n[0], n[1], n[2]) || 1; n = n.map(x => x / l);
    if (n[1] < -0.2) { [b, c] = [c, b]; n = n.map(x => -x); } // (up-facing: the road is seen from above)
    for (const p of [a, b, c]) { this.pos.push(...p); this.nor.push(...n); this.col.push(rgb[0], rgb[1], rgb[2]); }
  }
  quad(a: V3, b: V3, c: V3, d: V3, rgb: number[]) { this.tri(a, b, c, rgb); this.tri(a, c, d, rgb); }
  box(c: V3, hx: number, hy: number, hz: number, yaw: number, rgb: number[]) { // a box's five visible faces
    const cs = Math.cos(yaw), sn = Math.sin(yaw), P = (x: number, y: number, z: number): V3 => [c[0] + x * cs - z * sn, c[1] + y, c[2] + x * sn + z * cs];
    const two = (a: V3, b: V3, cc: V3, d: V3) => { this.quadRaw(a, b, cc, d, rgb); };
    two(P(-hx, hy, -hz), P(-hx, hy, hz), P(hx, hy, hz), P(hx, hy, -hz));
    two(P(-hx, -hy, hz), P(hx, -hy, hz), P(hx, hy, hz), P(-hx, hy, hz)); two(P(hx, -hy, -hz), P(-hx, -hy, -hz), P(-hx, hy, -hz), P(hx, hy, -hz));
    two(P(hx, -hy, hz), P(hx, -hy, -hz), P(hx, hy, -hz), P(hx, hy, hz)); two(P(-hx, -hy, -hz), P(-hx, -hy, hz), P(-hx, hy, hz), P(-hx, hy, -hz));
  }
  /** a quad wound as given (outward by the caller's order), both faces drawn */
  quadRaw(a: V3, b: V3, c: V3, d: V3, rgb: number[]) {
    for (const [p, q, r] of [[a, b, c], [a, c, d], [a, c, b], [a, d, c]] as V3[][]) {
      const u = [q[0] - p[0], q[1] - p[1], q[2] - p[2]], v = [r[0] - p[0], r[1] - p[1], r[2] - p[2]];
      let n = [u[1] * v[2] - u[2] * v[1], u[2] * v[0] - u[0] * v[2], u[0] * v[1] - u[1] * v[0]]; const l = Math.hypot(n[0], n[1], n[2]) || 1; n = n.map(x => x / l);
      for (const x of [p, q, r]) { this.pos.push(...x); this.nor.push(...n); this.col.push(rgb[0], rgb[1], rgb[2]); }
    }
  }
  cylinder(c: V3, r: number, h: number, seg: number, axisH: boolean, yaw: number, rgb: number[]) { // a drum: upright or on its side
    const cs = Math.cos(yaw), sn = Math.sin(yaw);
    const P = (a: number, t: number): V3 => { const x = Math.cos(a) * r, y = Math.sin(a) * r;
      const lx = axisH ? t : x, ly = axisH ? y + r : t, lz = axisH ? x : y; return [c[0] + lx * cs - lz * sn, c[1] + ly, c[2] + lx * sn + lz * cs]; };
    for (let k = 0; k < seg; k++) { const a0 = (k / seg) * 2 * Math.PI, a1 = ((k + 1) / seg) * 2 * Math.PI, t0 = axisH ? -h / 2 : 0, t1 = axisH ? h / 2 : h;
      this.quadRaw(P(a0, t0), P(a1, t0), P(a1, t1), P(a0, t1), rgb);
      const m0 = axisH ? P(0, t0) : P(0, t0), cen0: V3 = axisH ? [c[0] + t0 * cs, c[1] + r, c[2] + t0 * sn] : [c[0], c[1] + t0, c[2]], cen1: V3 = axisH ? [c[0] + t1 * cs, c[1] + r, c[2] + t1 * sn] : [c[0], c[1] + t1, c[2]]; void m0;
      this.quadRaw(cen0, P(a0, t0), P(a1, t0), cen0, rgb); this.quadRaw(cen1, P(a1, t1), P(a0, t1), cen1, rgb); }
  }
  get tris() { return this.pos.length / 9; }
  geometry() { const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(this.pos, 3)); g.setAttribute('normal', new THREE.Float32BufferAttribute(this.nor, 3)); g.setAttribute('color', new THREE.Float32BufferAttribute(this.col, 3)); g.computeBoundingSphere(); return g; }
}
const lin = (s: number[]) => { const c = new THREE.Color().setRGB(s[0], s[1], s[2], THREE.SRGBColorSpace); return [c.r, c.g, c.b]; };

/** the road, its kerbs and sleepers, and the drum ground's drums and sledges */
export function buildDrumRoad(): THREE.Group {
  const S = (PROFILE as any).samples as { s: number; e: number; n: number; h: [number, number, number] }[], rng = new Rng(754, 'drum-road');
  const earth = new Soup(), wood = new Soup(), stone = new Soup(), drums = stone; // (the drums in the stones' draw: one material)
  const bed = lin([0.6, 0.5, 0.38]), rut = lin([0.5, 0.41, 0.31]), timber = lin([0.42, 0.31, 0.21]), field = lin([0.62, 0.58, 0.52]), lime = lin([0.74, 0.72, 0.68]);
  const hw = DRUM_ROAD.half - 0.5, lift = 0.04;
  // the bed: a strip over the samples (centre and edges at the ground + lift), the two runner ruts darker
  const [A, B] = DRUM_ROAD.path, L = Math.hypot(B[0] - A[0], B[1] - A[1]), u = [(B[0] - A[0]) / L, (B[1] - A[1]) / L], nr = [-u[1], u[0]];
  const at = (q: typeof S[number], o: number): V3 => { const hEdge = o < 0 ? q.h[0] : q.h[2], h = q.h[1] + (hEdge - q.h[1]) * Math.min(1, Math.abs(o) / DRUM_ROAD.half); return W(q.e + nr[0] * o, h + lift, q.n + nr[1] * o); };
  const lanes = [-hw, -0.9, -0.5, 0.5, 0.9, hw];
  for (let i = 0; i + 1 < S.length; i++) for (let k = 0; k + 1 < lanes.length; k++)
    earth.quad(at(S[i], lanes[k]), at(S[i], lanes[k + 1]), at(S[i + 1], lanes[k + 1]), at(S[i + 1], lanes[k]), k === 1 || k === 3 ? rut : bed);
  // the sleepers across the bed
  const total = S[S.length - 1].s;
  for (let s = 1; s < total - 1; s += DR.sleeper) {
    const i = Math.min(S.length - 2, Math.floor(s / DRUM_ROAD.step)), f = (s - S[i].s) / (S[i + 1].s - S[i].s), e = S[i].e + (S[i + 1].e - S[i].e) * f, n = S[i].n + (S[i + 1].n - S[i].n) * f, h = S[i].h[1] + (S[i + 1].h[1] - S[i].h[1]) * f;
    wood.box(W(e, h + lift + DR.sleeperH / 2, n), hw * 0.92, DR.sleeperH / 2, DR.sleeperW / 2, Math.atan2(-nr[1], nr[0]) + (rng.next() - 0.5) * 0.06, timber);
  }
  // the kerbs: fieldstones along both edges
  for (const side of [-1, 1]) for (let s = 0.4; s < total - 0.4; s += 0.55 + rng.next() * 0.25) {
    const i = Math.min(S.length - 2, Math.floor(s / DRUM_ROAD.step)), f = (s - S[i].s) / (S[i + 1].s - S[i].s), q = { e: S[i].e + (S[i + 1].e - S[i].e) * f, n: S[i].n + (S[i + 1].n - S[i].n) * f };
    const h = (side < 0 ? S[i].h[0] : S[i].h[2]) + ((side < 0 ? S[i + 1].h[0] : S[i + 1].h[2]) - (side < 0 ? S[i].h[0] : S[i].h[2])) * f, k = DR.kerb * (0.8 + rng.next() * 0.4);
    stone.box(W(q.e + nr[0] * side * (hw + 0.2), h + k * 0.35, q.n + nr[1] * side * (hw + 0.2)), k * 0.6, k * 0.4, k * 0.5, rng.next() * 3, field);
  }
  // the drum ground: drums on their sides on timber chocks in rows, two sledges drawn up
  const [ge, gn] = DR.drum.at, g0 = S[0].h[1];
  for (let r = 0; r < DR.drum.rows; r++) for (let k = 0; k < DR.drum.per; k++) {
    const e = ge - 14 + k * 2.4 + (rng.next() - 0.5) * 0.3, n = gn + 4 + r * 3.2 + (rng.next() - 0.5) * 0.3, R = DR.drum.r * (0.9 + rng.next() * 0.15);
    drums.cylinder(W(e, g0 + 0.14, n), R, DR.drum.h * (0.9 + rng.next() * 0.25), 14, true, Math.PI / 2 + (rng.next() - 0.5) * 0.1, lime);
    for (const sx of [-0.45, 0.45]) wood.box(W(e, g0 + 0.07, n + sx * R), 0.25, 0.07, 0.12, 0, timber);
  }
  for (const [e, n] of [[ge + 4, gn - 2], [ge + 7.5, gn + 1]]) { // a sledge: two runners curved up at the front, cross-bars, a drum's cradle
    for (const sx of [-0.55, 0.55]) wood.box(W(e + sx, g0 + 0.12, n), 0.09, 0.12, 2.1, 0, timber);
    for (let c = -1.6; c <= 1.6; c += 0.8) wood.box(W(e, g0 + 0.29, n + c), 0.75, 0.05, 0.08, 0, timber);
  }
  const g = new THREE.Group(); g.name = 'c10:drum-road';
  const add = (s: Soup, mat: THREE.Material, name: string, note: string) => { if (!s.tris) return; const m = new THREE.Mesh(s.geometry(), mat); m.name = name; m.castShadow = name !== 'c10:drum-road:bed'; m.receiveShadow = true;
    m.userData = { tier: DR.tier, src: DR.src, placeholder: false, tris: s.tris, note }; g.add(m); };
  add(earth, propMaterial('mud', { vertexColors: true }), 'c10:drum-road:bed', 'the drums\' sledge road from the drum ground to the Terrace\'s N edge: a packed-earth bed with the runners\' ruts (D-754, C)');
  add(wood, propMaterial('wood', { vertexColors: true, rough: 0.8 }), 'c10:drum-road:timber', 'the road\'s sleepers, the drums\' chocks and two sledges (D-754, C)');
  add(stone, propMaterial('stone', { vertexColors: true, rough: 0.95 }), 'c10:drum-road:kerbs', 'the road\'s fieldstone kerbs and the column drums waiting at the drum ground (D-754, C)');
  g.userData = { tier: DR.tier, src: DR.src, placeholder: false };
  return g;
}
