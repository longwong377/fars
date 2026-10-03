// s18 C15 (D-801): the roads of the plain as a walker meets them in 467 BCE, so the walk from the Terrace to Naqsh-e Rustam, the
// villages and the estates is never an empty sheet: along the first 9 km of every road present in 467 (settlement.json roads;
// the Naqsh-e Rustam road its whole length) -
//  - WELLS every ~2.2 km, beside the road: a fieldstone kerb, two posts and a beam for the rope, a stone trough for the beasts;
//  - WAYSIDE HALTS every ~2.6 km: a mud-brick shelter open to the road (three walls and a pole-and-earth roof), a bench, water
//    jars, a tethering post, an ox-cart stood by it (two solid wheels, the bed, the shafts, sacks) and the beasts' dung;
//  - FIELD SHRINES every ~3.1 km, on the far side: a stepped altar of the Naqsh-e Rustam reliefs' form, small, its ash heap and
//    stacked wood (the fire is an action the people perform, not drawn here; no altar of the later "fire temple" kind);
//  (the road's droppings and sherds are world/roadLitter.ts's, session 10: not repeated here)
// The Achaemenid roads had stations and their keepers (the Persepolis Fortification texts' way-stations and travel rations, B);
// wells, shelters and shrines at these intervals are reconstruction (C). Nothing in a settlement zone or on steep ground.
// Drawn in Naqsh-e Rustam's 'nr-life' mesh (one draw: the plain's mesh budget); colliders as boxes.
import * as THREE from 'three/webgpu';
import type { Terrain } from '../../terrain/heightfield';
import settlementJson from '../../data/settlement.json';
import { settlementZones, pointInPolygon } from './data';
import { box, rod, cyl, hash, LIFE_C as C, linRGB } from './naqsh_life';
import type { RGB } from '../../core/colour';

type Geo = THREE.BufferGeometry;
type P2 = [number, number];
export interface WaysideOut { parts: Geo[]; boxes: { c: THREE.Vector3; h: THREE.Vector3; rot: number }[]; info: Record<string, number>; places: { id: string; e: number; n: number }[] }
const K = { reach: 9000, well: [1300, 2200], halt: [900, 2600], shrine: [2000, 3100], pat: 40 } as const;
const STONE = linRGB([0.72, 0.69, 0.62]), ASH = linRGB([0.55, 0.53, 0.5]), DUNG = linRGB([0.36, 0.3, 0.22]), WHEEL = linRGB([0.42, 0.33, 0.24]), SACK = linRGB([0.72, 0.64, 0.48]);

/** a flat quad lying on the ground (2 triangles) */
function pat(e: number, y: number, n: number, r: number, c: RGB, rot: number): Geo {
  const g = new THREE.PlaneGeometry(r * 2, r * 1.4).toNonIndexed(); g.deleteAttribute('uv'); g.rotateX(-Math.PI / 2); g.rotateY(rot); g.translate(e, y, -n);
  const a = new Float32Array(g.getAttribute('position').count * 3); for (let i = 0; i < a.length / 3; i++) a.set(c, i * 3); g.setAttribute('color', new THREE.BufferAttribute(a, 3)); return g;
}

export function buildWayside(terrain: Terrain): WaysideOut {
  const out: WaysideOut = { parts: [], boxes: [], info: { wells: 0, halts: 0, carts: 0, shrines: 0, roads: 0 }, places: [] };
  const H = (e: number, n: number) => terrain.heightAt(e, -n), zones = settlementZones();
  const slope = (e: number, n: number) => Math.hypot(H(e + 3, n) - H(e - 3, n), H(e, n + 3) - H(e, n - 3)) / 6;
  const clear = (e: number, n: number, m: number) => slope(e, n) < 0.12 && !zones.some(z => pointInPolygon(e, n, z) || z.some(p => Math.hypot(p[0] - e, p[1] - n) < m));
  const solid = (g: Geo, c: THREE.Vector3, h: THREE.Vector3, rot = 0) => { out.parts.push(g); out.boxes.push({ c, h, rot }); };
  const roads = (settlementJson as any).features.filter((f: any) => f.kind === 'road' && f.present_467 && f.polyline?.length > 1);
  for (const r of roads) { out.info.roads++;
    const pts = r.polyline as P2[], W = (r.width_m ?? 7) / 2, reach = r.id === 'road_naqsh_e_rustam' ? 1e9 : K.reach;
    // walk the road: the point and its direction at distance s
    const segs: { a: P2; b: P2; s0: number; L: number }[] = []; let S = 0;
    for (let i = 0; i + 1 < pts.length; i++) { const L = Math.hypot(pts[i + 1][0] - pts[i][0], pts[i + 1][1] - pts[i][1]); if (L < 1e-3) continue; segs.push({ a: pts[i], b: pts[i + 1], s0: S, L }); S += L; }
    const at = (s: number) => { const q = segs.find(g => s <= g.s0 + g.L) ?? segs[segs.length - 1], t = Math.min(1, (s - q.s0) / q.L), dx = (q.b[0] - q.a[0]) / q.L, dy = (q.b[1] - q.a[1]) / q.L;
      return { e: q.a[0] + dx * t * q.L, n: q.a[1] + dy * t * q.L, dx, dy, side: [-dy, dx] as P2 }; };
    const end = Math.min(S, reach);
    // wells
    for (let s = K.well[0], k = 0; s < end; s += K.well[1], k++) { const p = at(s), sd = k % 2 ? 1 : -1, e = p.e + p.side[0] * sd * (W + 5), n = p.n + p.side[1] * sd * (W + 5); if (!clear(e, n, 60)) continue;
      const y = H(e, n); solid(cyl(e, y - 0.2, -n, 0.85, 0.75, STONE, 8, 0.8), new THREE.Vector3(e, y + 0.2, -n), new THREE.Vector3(0.85, 0.4, 0.85)); out.parts.push(cyl(e, y + 0.5, -n, 0.55, 0.02, C.dark, 8, 0.55));
      const ax = p.dx, ay = p.dy; out.parts.push(rod(new THREE.Vector3(e - ax * 0.9, y, -(n - ay * 0.9)), new THREE.Vector3(e - ax * 0.9, y + 2.1, -(n - ay * 0.9)), 0.06, C.pole, 5), rod(new THREE.Vector3(e + ax * 0.9, y, -(n + ay * 0.9)), new THREE.Vector3(e + ax * 0.9, y + 2.1, -(n + ay * 0.9)), 0.06, C.pole, 5),
        rod(new THREE.Vector3(e - ax, y + 2.05, -(n - ay)), new THREE.Vector3(e + ax, y + 2.05, -(n + ay)), 0.05, C.pole, 5));
      const te = e - p.side[0] * sd * 2.0, tn = n - p.side[1] * sd * 2.0, rot = Math.atan2(p.dy, p.dx); solid(box(te, y + 0.25, -tn, 1.0, 0.25, 0.35, STONE, rot), new THREE.Vector3(te, y + 0.25, -tn), new THREE.Vector3(1.0, 0.25, 0.35), rot); // (along the road)
      out.info.wells++; out.places.push({ id: `well:${r.id}:${k}`, e, n }); }
    // halts, each with its cart
    for (let s = K.halt[0], k = 0; s < end; s += K.halt[1], k++) { const p = at(s), sd = k % 2 ? -1 : 1, e = p.e + p.side[0] * sd * (W + 7), n = p.n + p.side[1] * sd * (W + 7); if (!clear(e, n, 80)) continue;
      const y = H(e, n), rot = Math.atan2(p.dy, p.dx), ux = p.dx, uy = p.dy, vx = p.side[0] * sd, vy = p.side[1] * sd; // u along the road, v away from it
      const P = (u: number, v: number) => [e + ux * u + vx * v, n + uy * u + vy * v] as P2;
      const wall = (u: number, v: number, hu: number, hv: number) => { const [we, wn] = P(u, v), cy = y - 0.2 + 1.2; solid(box(we, cy, -wn, hu, 1.4, hv, C.mud, rot), new THREE.Vector3(we, cy, -wn), new THREE.Vector3(hu, 1.4, hv), rot); };
      wall(0, 1.7, 2.0, 0.25); wall(-1.8, 0.2, 0.25, 1.5); wall(1.8, 0.2, 0.25, 1.5); // back (away from the road) and the two sides
      { const [re, rn] = P(0, 0.5); out.parts.push(box(re, y + 2.7, -rn, 2.4, 0.14, 2.0, C.roof, rot)); }
      { const [be, bn] = P(0, 1.2); solid(box(be, y + 0.22, -bn, 1.4, 0.22, 0.25, C.mud, rot), new THREE.Vector3(be, y + 0.22, -bn), new THREE.Vector3(1.4, 0.22, 0.25), rot); }
      for (const u of [1.2, 1.55]) { const [je, jn] = P(u, 1.1); out.parts.push(cyl(je, y, -jn, 0.22, 0.65, C.clay, 7, 0.15)); }
      { const [te, tn] = P(3.4, -1.2); out.parts.push(rod(new THREE.Vector3(te, y - 0.2, -tn), new THREE.Vector3(te, y + 1.1, -tn), 0.07, C.poleOld, 5)); for (let q = 0; q < 4; q++) { const [de, dn] = P(3.4 + (hash(k, q) - 0.5) * 3, -1.2 - hash(q, k) * 2); out.parts.push(pat(de, H(de, dn) + 0.02, dn, 0.18, DUNG, q)); } }
      // the ox-cart stood beside the halt: two solid wheels on an axle, the bed, the shafts resting on the ground, sacks
      { const [ce, cn] = P(-4.2, -0.6), cy = H(ce, cn), a = new THREE.Vector3(ux, 0, -uy), side = new THREE.Vector3(vx, 0, -vy), c0 = new THREE.Vector3(ce, cy + 0.55, -cn);
        for (const s2 of [-1, 1]) { const w0 = c0.clone().addScaledVector(side, s2 * 0.75), w1 = w0.clone().addScaledVector(side, s2 * 0.12); out.parts.push(rod(w0, w1, 0.55, WHEEL, 10)); }
        out.parts.push(box(ce, cy + 0.85, -cn, 1.2, 0.06, 0.75, C.plank, rot)); // the bed (rot: the box's x along the road)
        for (const s2 of [-0.35, 0.35]) out.parts.push(rod(c0.clone().addScaledVector(side, s2).addScaledVector(a, 1.1).setY(cy + 0.85), c0.clone().addScaledVector(side, s2 * 0.4).addScaledVector(a, 3.0).setY(cy + 0.05), 0.05, C.pole, 5));
        for (let q = 0; q < 3; q++) out.parts.push(box(ce + ux * (q - 1) * 0.6, cy + 1.08, -(cn + uy * (q - 1) * 0.6), 0.25, 0.17, 0.4, SACK, rot));
        out.boxes.push({ c: new THREE.Vector3(ce, cy + 0.55, -cn), h: new THREE.Vector3(1.3, 0.55, 0.9), rot }); out.info.carts++; }
      out.info.halts++; out.places.push({ id: `halt:${r.id}:${k}`, e, n }); }
    // field shrines, on the far side
    for (let s = K.shrine[0], k = 0; s < end; s += K.shrine[1], k++) { const p = at(s), sd = k % 2 ? 1 : -1, e = p.e + p.side[0] * sd * (W + 12), n = p.n + p.side[1] * sd * (W + 12); if (!clear(e, n, 60)) continue;
      const y = H(e, n), rot = Math.atan2(p.dy, p.dx);
      solid(box(e, y + 0.15, -n, 0.55, 0.35, 0.55, STONE, rot), new THREE.Vector3(e, y + 0.3, -n), new THREE.Vector3(0.55, 0.6, 0.55), rot);
      out.parts.push(box(e, y + 0.6, -n, 0.3, 0.12, 0.3, STONE, rot), box(e, y + 0.88, -n, 0.42, 0.16, 0.42, STONE, rot), box(e, y + 1.06, -n, 0.3, 0.03, 0.3, ASH, rot));
      out.parts.push(cyl(e + 1.2, y - 0.05, -n, 0.5, 0.18, ASH, 6, 0.15)); // the ash heap
      for (let q = 0; q < 3; q++) out.parts.push(rod(new THREE.Vector3(e - 1.0, y + 0.08 + q * 0.12, -(n - 0.6)), new THREE.Vector3(e - 1.0, y + 0.08 + q * 0.12, -(n + 0.6)), 0.06, C.poleOld, 5)); // stacked wood
      out.info.shrines++; out.places.push({ id: `shrine:${r.id}:${k}`, e, n }); }
  }
  return out;
}
