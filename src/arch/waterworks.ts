// The Terrace's drains and cisterns (D-214; gap audit item 31): 'a system of water conduits and drains hewn out of the rock'
// beneath the platform (Iranica, search extract: B), its plan not read (Schmidt 1953 NOT SEEN). What is drawn, all C
// (terrace.r_drains, terrace.r_cisterns): where the W and S retaining walls face the plain, drain mouths with projecting stone
// spouts in the wall face; above each, on the court, an inlet slab over the rock-cut shaft fed by an open stone gutter; and a
// well-head over a cistern at each of the people's two water points on the Terrace. Not architecture parts (the parts hash,
// the walkable-grid file and the probes are unchanged); the kerbs are solid (colliders, the people's grid blocked at load).
import * as THREE from 'three/webgpu';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { v } from './spec';
import type { Part, Box, Prism, Column, Pt } from './parts';
import { pointInPoly } from './parts';
import { surfaceMaterial } from '../render/materials';

export interface DrainUnit { edge: 'W' | 'S'; edgeIndex: number; at: Pt; n: Pt; along: Pt; sill: number; ground: number; inlet: Pt; channel: [Pt, Pt] }
export interface CisternHead { at: Pt; serves: string; y: number }
export interface WaterPlan { drains: DrainUnit[]; cisterns: CisternHead[]; skipped: { at: Pt; why: string }[] }

const dist2Box = (p: Pt, b: Box) => { const dx = Math.max(0, Math.abs(p[0] - b.c[0]) - b.size[0] / 2), dy = Math.max(0, Math.abs(p[1] - b.c[1]) - b.size[1] / 2); return Math.hypot(dx, dy); };
function distPoly(p: Pt, poly: Pt[]) {
  if (pointInPoly(p[0], p[1], poly)) return 0;
  let d = Infinity; for (let i = 0; i < poly.length; i++) { const a = poly[i], b = poly[(i + 1) % poly.length], ex = b[0] - a[0], ey = b[1] - a[1], l2 = ex * ex + ey * ey || 1;
    const t = Math.max(0, Math.min(1, ((p[0] - a[0]) * ex + (p[1] - a[1]) * ey) / l2)); d = Math.min(d, Math.hypot(p[0] - a[0] - ex * t, p[1] - a[1] - ey * t)); }
  return d;
}
/** the distance from a point to the nearest architecture part other than the Terrace itself and its parapet */
function clearance(p: Pt, parts: Part[]): number {
  let d = Infinity;
  for (const q of parts) {
    if (q.building === 'terrace') continue;
    if (q.type === 'box') d = Math.min(d, dist2Box(p, q as Box));
    else if (q.type === 'prism') d = Math.min(d, distPoly(p, (q as Prism).polygon));
    else d = Math.min(d, Math.hypot(p[0] - (q as Column).c[0], p[1] - (q as Column).c[1]) - (q as Column).order.baseW / 2);
  }
  return d;
}
/** the floor a point stands on: the highest floor or platform prism top containing it at or below 1 m (the court: 0) */
function floorAt(p: Pt, parts: Part[]): number {
  let y = 0; for (const q of parts) if (q.type === 'prism' && (q as Prism).y1 <= 1 && (q as Prism).y1 > y && pointInPoly(p[0], p[1], (q as Prism).polygon)) y = (q as Prism).y1;
  return y;
}
/** where the drains and cisterns stand (terrace.r_drains, terrace.r_cisterns). `ground(e, n)`: the terrain's height (m,
 *  court datum) at a grid point outside the wall */
export function waterPlan(parts: Part[], ground: (e: number, n: number) => number): WaterPlan {
  const R = v<any>('terrace', 'r_drains'), C = v<any>('terrace', 'r_cisterns'), SW = v<any>('terrace', 'r_south_wall_inscriptions');
  const plat = parts.find(p => p.building === 'terrace' && p.type === 'prism') as Prism | undefined, out: WaterPlan = { drains: [], cisterns: [], skipped: [] };
  if (plat) {
    const poly = plat.polygon; let area = 0; for (let i = 0; i < poly.length; i++) { const a = poly[i], b = poly[(i + 1) % poly.length]; area += a[0] * b[1] - b[0] * a[1]; }
    const ccw = area > 0;
    // the S wall's inscription panels (decor.ts: centred on the southernmost S-facing edge): no mouth within 2 m of them
    let south: { mid: Pt; half: number } | null = null;
    for (let i = 0; i < poly.length; i++) { const a = poly[i], b = poly[(i + 1) % poly.length], L = Math.hypot(b[0] - a[0], b[1] - a[1]); if (L < SW.texts.length * (SW.panel_width + SW.gap)) continue;
      const n: Pt = ccw ? [(b[1] - a[1]) / L, -(b[0] - a[0]) / L] : [-(b[1] - a[1]) / L, (b[0] - a[0]) / L], mid: Pt = [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
      if (n[1] < -0.95 && (!south || mid[1] < south.mid[1])) south = { mid, half: (SW.texts.length * SW.panel_width + (SW.texts.length - 1) * SW.gap) / 2 + 2 }; }
    for (let i = 0; i < poly.length; i++) {
      const a = poly[i], b = poly[(i + 1) % poly.length], L = Math.hypot(b[0] - a[0], b[1] - a[1]);
      const n: Pt = ccw ? [(b[1] - a[1]) / L, -(b[0] - a[0]) / L] : [-(b[1] - a[1]) / L, (b[0] - a[0]) / L], along: Pt = [(b[0] - a[0]) / L, (b[1] - a[1]) / L];
      const edge = n[0] < -0.9 ? 'W' : n[1] < -0.9 ? 'S' : null;
      if (!edge || !R.edges.includes(edge) || L < R.min_edge) continue;
      const k = Math.floor((L - 2 * R.end_clear) / R.spacing) + 1, t0 = (L - (k - 1) * R.spacing) / 2;
      for (let j = 0; j < k; j++) {
        const t = t0 + j * R.spacing, at: Pt = [a[0] + along[0] * t, a[1] + along[1] * t];
        const inlet: Pt = [at[0] - n[0] * R.inlet.back, at[1] - n[1] * R.inlet.back], hl = R.channel.length / 2;
        const c0: Pt = [inlet[0] - along[0] * hl, inlet[1] - along[1] * hl], c1: Pt = [inlet[0] + along[0] * hl, inlet[1] + along[1] * hl];
        const outside: Pt = [at[0] + n[0] * 1.5, at[1] + n[1] * 1.5], g = ground(outside[0], outside[1]), sill = g + R.mouth.above_ground;
        const why = south && Math.hypot(at[0] - south.mid[0], at[1] - south.mid[1]) < south.half ? 'the S wall inscriptions'
          : Math.min(clearance(inlet, parts), clearance(c0, parts), clearance(c1, parts)) < R.clear ? 'a building on the court'
          : clearance(outside, parts) < 1 ? 'a stair or building at the wall foot'
          : sill + R.mouth.h > -0.5 ? 'the wall is too low here' : null;
        if (why) { out.skipped.push({ at, why }); continue; }
        out.drains.push({ edge, edgeIndex: i, at, n, along, sill, ground: g, inlet, channel: [c0, c1] });
      }
    }
  }
  for (const h of C.heads as { at: Pt; serves: string }[]) out.cisterns.push({ at: h.at, serves: h.serves, y: floorAt(h.at, parts) });
  return out;
}

const box = (w: number, h: number, d: number, basis: THREE.Matrix4) => { const g = new THREE.BoxGeometry(w, h, d); g.deleteAttribute('uv'); return g.applyMatrix4(basis); };
/** the frame at a grid point: Z out of the wall (grid `n`), Y up, X = Y × Z along the wall (right-handed, so boxes keep
 *  their winding), origin at height y */
function frame(p: Pt, y: number, n: Pt) {
  const Z = new THREE.Vector3(n[0], 0, -n[1]), Y = new THREE.Vector3(0, 1, 0), X = new THREE.Vector3().crossVectors(Y, Z);
  return new THREE.Matrix4().makeBasis(X, Y, Z).setPosition(p[0], y, -p[1]);
}
const at = (m: THREE.Matrix4, x: number, y: number, z: number) => m.clone().multiply(new THREE.Matrix4().makeTranslation(x, y, z));
let darkMat: THREE.MeshStandardNodeMaterial | null = null;
/** the dark of an opening: a shaft or a conduit mouth seen from outside (C) */
const dark = () => (darkMat ??= Object.assign(new THREE.MeshStandardNodeMaterial({ color: new THREE.Color().setRGB(0.012, 0.011, 0.01, THREE.SRGBColorSpace), roughness: 1 }), { userData: { tier: 'C', note: 'the dark inside a drain mouth, an inlet or a cistern shaft' } }));

export interface Waterworks { group: THREE.Group; plan: WaterPlan; navDiscs: [number, number, number][]; colliders: { c: THREE.Vector3; half: THREE.Vector3 }[]; tris: number }
/** the drains' mouths, spouts, inlets and gutters and the cisterns' heads, one mesh per material (stone, dark) */
export function buildWaterworks(parts: Part[], ground: (e: number, n: number) => number): Waterworks {
  const R = v<any>('terrace', 'r_drains'), C = v<any>('terrace', 'r_cisterns'), plan = waterPlan(parts, ground);
  const stone: THREE.BufferGeometry[] = [], voids: THREE.BufferGeometry[] = [], navDiscs: [number, number, number][] = [], colliders: Waterworks['colliders'] = [];
  const M = R.mouth, I = R.inlet, K = R.channel;
  for (const d of plan.drains) {
    // the mouth: the dark of the conduit in the wall face (3 mm proud), a spout under it projecting from the wall
    const f = frame(d.at, 0, d.n);
    voids.push(box(M.w, M.h, 0.004, at(f, 0, d.sill + M.h / 2, 0.003)));
    stone.push(box(M.spout_w, M.spout_h, M.spout, at(f, 0, d.sill - M.spout_h / 2, M.spout / 2))); // the spout's floor
    for (const s of [-1, 1]) stone.push(box((M.spout_w - M.w) / 2, M.spout_h * 0.8, M.spout, at(f, s * (M.w + M.spout_w) / 4, d.sill + M.spout_h * 0.4, M.spout / 2))); // its lips
    // the inlet over the shaft: a slab on the court with a square opening (the dark 1 mm above it)
    const fi = frame(d.inlet, 0, d.n);
    stone.push(box(I.size, I.proud, I.size, at(fi, 0, I.proud / 2, 0)));
    voids.push(box(I.hole, 0.002, I.hole, at(fi, 0, I.proud + 0.001, 0)));
    // the gutter along the edge into the inlet: two kerbs and a floor 4 mm above the court
    const L = Math.hypot(d.channel[1][0] - d.channel[0][0], d.channel[1][1] - d.channel[0][1]), kw = (K.w_out - K.w_in) / 2;
    for (const s of [-1, 1]) for (const half of [-1, 1]) stone.push(box(L / 2 - I.size / 2, K.kerb, kw, at(fi, half * (L / 4 + I.size / 4), K.kerb / 2, s * (K.w_in + kw) / 2)));
    for (const half of [-1, 1]) stone.push(box(L / 2 - I.size / 2, 0.008, K.w_in, at(fi, half * (L / 4 + I.size / 4), 0.004, 0)));
  }
  for (const h of plan.cisterns) {
    const K2 = C.kerb, y = h.y, f = frame(h.at, y, [0, 1]);
    stone.push(box(C.slab, C.slab_h, C.slab, at(f, 0, C.slab_h / 2, 0)));
    // the kerb: a stone ring (lathe of its section: up the outer face, across the top, down into the shaft)
    const ring = new THREE.LatheGeometry([new THREE.Vector2(K2.r_out, 0), new THREE.Vector2(K2.r_out, K2.h), new THREE.Vector2(K2.r_in, K2.h), new THREE.Vector2(K2.r_in, 0)], C.segments);
    ring.deleteAttribute('uv'); stone.push(ring.translate(h.at[0], y + C.slab_h, -h.at[1]));
    const shaft = new THREE.CircleGeometry(K2.r_in, C.segments).rotateX(-Math.PI / 2); shaft.deleteAttribute('uv'); voids.push(shaft.translate(h.at[0], y + C.slab_h + 0.004, -h.at[1]));
    navDiscs.push([h.at[0], h.at[1], K2.r_out]);
    colliders.push({ c: new THREE.Vector3(h.at[0], y + C.slab_h + K2.h / 2, -h.at[1]), half: new THREE.Vector3(K2.r_out * 0.9, K2.h / 2, K2.r_out * 0.9) });
  }
  const group = new THREE.Group(); group.name = 'waterworks'; let tris = 0;
  const note = `the Terrace's drains and cisterns (D-214, all C; terrace.r_drains, r_cisterns): ${plan.drains.length} drain mouths with spouts in the W and S retaining walls, each with an inlet and a gutter on the court; ${plan.cisterns.length} cistern heads at the people's water points (${plan.cisterns.map(c => c.serves).join(', ')}); the drains' plan is not read (Schmidt 1953 NOT SEEN, Q-428)`;
  for (const [geos, mat, name] of [[stone, surfaceMaterial('limestone'), 'waterworks:stone'], [voids, dark(), 'waterworks:dark']] as const) {
    if (!geos.length) continue;
    const g = mergeGeometries(geos.map(q => (q.index ? q.toNonIndexed() : q)))!; tris += g.getAttribute('position').count / 3;
    const m = new THREE.Mesh(g, mat); m.name = name; m.castShadow = name === 'waterworks:stone'; m.receiveShadow = true;
    m.userData = { tier: 'C', src: 'IR-PERS;TERRACE-DRAINS;PASARGADAE-CHANNELS;RECON', note }; group.add(m);
  }
  group.userData = { tier: 'C', src: 'IR-PERS;TERRACE-DRAINS;RECON', note, placeholder: false };
  return { group, plan, navDiscs, colliders, tris };
}
