// Villages of the plain (Phase 7). Four are Barrington Atlas points (plain.json village_*; map-scale, +-3 km, C); the other
// 33 of Sumner's 39 secure Achaemenid sites (two more are the settlement.json town zones) could not be located (the survey
// text is blocked, Q-050) and are placed by the plain.json `villages_unlocated` rule: on low rises within 1.5 km of a river
// or canal, >= 2 km apart (C). A Barrington point is used as given unless it falls where no village can stand (in a river
// corridor, a settlement zone or on a slope); then the nearest suitable spot inside its uncertainty is used and the offset
// is recorded. Layout inside each village is reconstruction (C): courtyard compounds of mud brick (villages_unlocated.layout).
import * as THREE from 'three/webgpu';
import type { Terrain } from '../../terrain/heightfield';
import { feature, pointInPolygon, settlementZones, PointIndex, RiverProfile, tag } from './data';
import type { Canal } from './canals';
import { Rng } from '../../core/rng';
import { SURFACES, surfaceMaterial } from '../../render/materials';

// village mud plaster on mud brick, unpainted (C): the Terrace's greyish yellow-green clay paint is not assumed here
SURFACES.village_mud = { albedo: [0.56, 0.49, 0.38], roughness: 0.95, porosity: 0.85, noiseScale: 0.7, noiseAmp: 0.09, bump: { amp: 0.006, freq: 1.1 }, tier: 'C', note: 'village houses: mud plaster over mud brick, flat roofs of beams, reeds and mud (C)' };

export interface Village {
  id: string; name: string; x: number; y: number; pop: number; r: number; tier: string; src: string; note: string;
  located: boolean; /** metres moved from the data point to stand on suitable ground */ moved: number; chrono: string;
}
export interface Compound { x: number; y: number; w: number; d: number; angle: number; rooms: { u0: number; v0: number; u1: number; v1: number; h: number }[]; gate: number; seed: number }

export function placeVillages(terrain: Terrain, rivers: RiverProfile[], canals: Canal[], seed = 1): Village[] {
  const zones = settlementZones();
  const water = new PointIndex(500); for (const r of rivers) water.addPolyline(r, 40, 0); for (const c of canals) water.addPolyline(c.pts, 40, 1);
  const riverOnly = new PointIndex(400); for (const r of rivers) riverOnly.addPolyline(r, 20);
  const asl = (x: number, y: number) => terrain.aslAt(x, -y);
  const slopeAt = (x: number, y: number) => Math.hypot(asl(x + 40, y) - asl(x - 40, y), asl(x, y + 40) - asl(x, y - 40)) / 80;
  const density = feature('villages_unlocated').layout.persons_per_ha as number;
  const radiusFor = (pop: number) => Math.sqrt((pop / density) * 1e4 / Math.PI);
  const inZone = (x: number, y: number, m: number) => zones.some(z => pointInPolygon(x, y, z)) || (m > 0 && zones.some(z => z.some(p => Math.hypot(p[0] - x, p[1] - y) < m)));
  const suitable = (x: number, y: number, r: number) => !inZone(x, y, 400) && !riverOnly.any(x, y, r + 80) && slopeAt(x, y) < 0.04 && asl(x, y) < 1700 && Math.hypot(x - 110, y) > 2500;
  const out: Village[] = [];
  for (const f of ['village_masumabad_west', 'village_saidun', 'village_tukrash', 'village_rakkan'].map(feature)) {
    const r = radiusFor(f.pop_est);
    let [x, y] = f.xy as [number, number], moved = 0;
    if (!suitable(x, y, r)) { // spiral search inside the stated uncertainty
      let found = false;
      for (let d = 100; d <= f.unc_m && !found; d += 100) for (let a = 0; a < 360; a += 15) { const px = f.xy[0] + d * Math.cos((a * Math.PI) / 180), py = f.xy[1] + d * Math.sin((a * Math.PI) / 180); if (suitable(px, py, r)) { x = px; y = py; moved = d; found = true; break; } }
    }
    out.push({ id: f.id, name: f.name, x, y, pop: f.pop_est, r, tier: f.tier, src: f.src, located: true, moved, chrono: f.chrono,
      note: `${f.name}: Barrington Atlas point (map-scale, +-${f.unc_m} m; C)${moved ? `, moved ${moved} m to the nearest suitable ground` : ''}; population ${f.pop_est} (C); houses and lanes reconstructed (C)` });
  }
  // the unlocated secure sites
  const vu = feature('villages_unlocated'), rule = vu.procedural_rule, lay = vu.layout;
  const count = rule.count_secure - rule.located_here;
  const rng = new Rng(seed, 'plain-villages');
  // populations: log-uniform in pop_range, scaled to the layout total (C)
  let pops = Array.from({ length: count }, () => Math.exp(rng.range(Math.log(rule.pop_range[0]), Math.log(rule.pop_range[1]))));
  const k = lay.total_procedural_pop / pops.reduce((a, b) => a + b, 0);
  pops = pops.map(p => Math.round(Math.min(rule.pop_range[1], Math.max(rule.pop_range[0], p * k)))).sort((a, b) => b - a);
  const cands: { x: number; y: number; score: number }[] = [];
  for (let i = 0; i < 6000; i++) {
    const x = rng.range(-24000, 24000), y = rng.range(-24000, 24000);
    if (Math.hypot(x, y) > 24000) continue;
    const [dw] = water.nearest(x, y, rule.max_dist_to_water_km * 1000); if (!isFinite(dw)) continue;
    if (!suitable(x, y, 150)) continue;
    if (asl(x, y) > 1660) continue; // on the plain (fields_rainfed rule height)
    // a low rise: height above the mean of a 400 m ring (tells stand a few metres above the plain)
    let ring = 0; for (let a = 0; a < 8; a++) ring += asl(x + 400 * Math.cos(a * Math.PI / 4), y + 400 * Math.sin(a * Math.PI / 4));
    const rise = asl(x, y) - ring / 8;
    cands.push({ x, y, score: rise + rng.range(0, 0.6) - dw / 3000 });
  }
  cands.sort((a, b) => b.score - a.score);
  const spacing = rule.min_spacing_km * 1000;
  let n = 0;
  for (const c of cands) {
    if (n >= count) break;
    if (out.some(v => Math.hypot(v.x - c.x, v.y - c.y) < spacing)) continue;
    const pop = pops[n], r = radiusFor(pop);
    if (!suitable(c.x, c.y, r)) continue;
    out.push({ id: `village_p${String(n + 1).padStart(2, '0')}`, name: `unlocated Achaemenid site ${n + 1} (Sumner survey, placed by rule)`, x: c.x, y: c.y, pop, r,
      tier: 'C', src: vu.src, located: false, moved: 0, chrono: vu.chrono,
      note: `One of Sumner's 39 secure Achaemenid sites whose position was not retrieved: placed by rule on a low rise within ${rule.max_dist_to_water_km} km of water, >= ${rule.min_spacing_km} km from others (C). Population ${pop} (C), area ${(pop / density).toFixed(1)} ha at ${density} persons/ha (B derived); houses and lanes reconstructed (C).` });
    n++;
  }
  return out;
}

/** courtyard compounds of one village (C layout: villages_unlocated.layout) */
export function villageCompounds(v: Village, terrain: Terrain, seed = 1): Compound[] {
  const lay = feature('villages_unlocated').layout;
  const rng = new Rng(seed, 'village-' + v.id);
  const want = Math.max(4, Math.round(v.pop / lay.household_size));
  const spacing = Math.sqrt((Math.PI * v.r * v.r) / want); // one compound per grid cell of the settled disc
  const angle = rng.range(0, Math.PI / 2);
  const ca = Math.cos(angle), sa = Math.sin(angle);
  const cells: { x: number; y: number; d: number }[] = [];
  const R = v.r * 1.15, m = Math.ceil(R / spacing);
  for (let i = -m; i <= m; i++) for (let j = -m; j <= m; j++) {
    const u = (i + rng.range(-0.18, 0.18)) * spacing, w = (j + rng.range(-0.18, 0.18)) * spacing;
    const x = v.x + u * ca - w * sa, y = v.y + u * sa + w * ca;
    const edge = v.r * (0.85 + 0.3 * Math.sin(Math.atan2(w, u) * 3 + v.x * 0.001)); // lobed outline
    const d = Math.hypot(u, w); if (d > edge) continue;
    cells.push({ x, y, d });
  }
  cells.sort((a, b) => a.d - b.d);
  const out: Compound[] = [];
  for (const c of cells.slice(0, want)) {
    if (rng.chance(0.08)) continue; // lanes widen into small open spaces
    const cw = Math.min(spacing - 3, rng.range(lay.compound_m[0], lay.compound_m[1])), cd = Math.min(spacing - 3, rng.range(lay.compound_m[0], lay.compound_m[1]));
    const rd = rng.range(lay.room_depth_m[0], lay.room_depth_m[1]), rh = rng.range(lay.room_height_m[0], lay.room_height_m[1]);
    const a = angle + rng.range(-0.08, 0.08);
    // rooms along the side away from the sun's winter path (grid N side ~ true NNW; C) and sometimes a second wing
    const rooms = [{ u0: -cw / 2, v0: cd / 2 - rd, u1: cw / 2, v1: cd / 2, h: rh }];
    if (rng.chance(0.55)) { const side = rng.chance(0.5) ? -1 : 1; rooms.push({ u0: side < 0 ? -cw / 2 : cw / 2 - rd * 0.9, v0: -cd / 2 + 1.5, u1: side < 0 ? -cw / 2 + rd * 0.9 : cw / 2, v1: cd / 2 - rd, h: rh - 0.2 }); }
    out.push({ x: c.x, y: c.y, w: cw, d: cd, angle: a, rooms, gate: rng.range(-0.3, 0.3), seed: rng.int(0, 1e9) });
  }
  void terrain;
  return out;
}

// ---------------------------------------------------------------- geometry and colliders
export interface Box { cx: number; cy: number; cz: number; hx: number; hy: number; hz: number; rot: number; roof: boolean; /** a timber door leaf (drawn dark, no collider) */ door?: boolean }
/** boxes of one compound (world frame; rot about +y): yard walls with a gate gap, room blocks with flat roofs. Every box
 *  reaches 0.6 m below the ground at the compound centre, so gentle slopes do not show a gap. */
export function compoundBoxes(c: Compound, groundY: number): Box[] {
  const lay = feature('villages_unlocated').layout, t = lay.wall_m as number, wh = lay.yard_wall_h_m as number;
  const ca = Math.cos(c.angle), sa = Math.sin(c.angle), out: Box[] = [];
  const add = (u0: number, v0: number, u1: number, v1: number, h: number, roof: boolean, door = false, base = -0.6) => {
    const u = (u0 + u1) / 2, v = (v0 + v1) / 2, x = c.x + u * ca - v * sa, y = c.y + u * sa + v * ca;
    out.push({ cx: x, cy: groundY + (h + base) / 2, cz: -y, hx: Math.abs(u1 - u0) / 2, hy: (h - base) / 2, hz: Math.abs(v1 - v0) / 2, rot: c.angle, roof, door });
  };
  const W = c.w / 2, D = c.d / 2, g = c.gate * (c.w - 3), gw = 1.4;
  add(-W, D - t, W, D, wh, false); add(-W, -D + t, -W + t, D - t, wh, false); add(W - t, -D + t, W, D - t, wh, false); // N, W, E walls
  add(-W, -D, g - gw / 2, -D + t, wh, false); add(g + gw / 2, -D, W, -D + t, wh, false); // S wall with the gate
  for (const [k, r] of c.rooms.entries()) {
    add(r.u0, r.v0, r.u1, r.v1, r.h, true);
    // a door on the courtyard side (0.9 x 1.8 m timber leaf, C): the main range opens south, a wing opens toward the yard
    const du = (c.seed % 7) / 7 - 0.5;
    if (k === 0) { const u = (r.u0 + r.u1) / 2 + du * (r.u1 - r.u0) * 0.6; add(u - 0.45, r.v0 - 0.05, u + 0.45, r.v0 + 0.02, 1.8, false, true, 0); }
    else { const v = (r.v0 + r.v1) / 2, inner = r.u0 < 0 ? r.u1 : r.u0, s = r.u0 < 0 ? 1 : -1; add(Math.min(inner, inner + s * 0.05), v - 0.45, Math.max(inner, inner + s * 0.05), v + 0.45, 1.8, false, true, 0); }
  }
  return out;
}
/** the corners of a box in world coordinates: local u along the compound's grid-x, v along grid-y (world z = -y) */
const corner = (b: Box, su: number, sy: number, sv: number): THREE.Vector3 => {
  const ca = Math.cos(b.rot), sa = Math.sin(b.rot), u = su * b.hx, v = sv * b.hz;
  return new THREE.Vector3(b.cx + u * ca - v * sa, b.cy + sy * b.hy, b.cz - (u * sa + v * ca));
};
const DOOR = new THREE.Color().setRGB(0.2, 0.15, 0.1, THREE.SRGBColorSpace);
/** merged mesh of many boxes (5 faces each, no bottom), vertex-coloured walls and roofs, outward normals */
export function boxesMesh(boxes: Box[], seed: number): THREE.BufferGeometry {
  const pos: number[] = [], nor: number[] = [], col: number[] = [];
  const wall = new THREE.Color(), roof = new THREE.Color(); let k = seed >>> 0;
  const rnd = () => { k = (Math.imul(k, 1664525) + 1013904223) >>> 0; return k / 4294967296; };
  const FACES: [number, number, number][][] = [ // [su, sy, sv] corners of the five faces
    [[-1, 1, -1], [1, 1, -1], [1, 1, 1], [-1, 1, 1]],
    [[-1, -1, 1], [1, -1, 1], [1, 1, 1], [-1, 1, 1]], [[-1, -1, -1], [1, -1, -1], [1, 1, -1], [-1, 1, -1]],
    [[1, -1, -1], [1, -1, 1], [1, 1, 1], [1, 1, -1]], [[-1, -1, -1], [-1, -1, 1], [-1, 1, 1], [-1, 1, -1]]];
  for (const b of boxes) {
    const v = rnd() * 0.08 - 0.04; wall.setRGB(0.56 + v, 0.49 + v, 0.38 + v * 0.8, THREE.SRGBColorSpace); roof.setRGB(0.5 + v, 0.45 + v, 0.37 + v, THREE.SRGBColorSpace);
    const centre = new THREE.Vector3(b.cx, b.cy, b.cz);
    FACES.forEach((f, fi) => {
      let q = f.map(([su, sy, sv]) => corner(b, su, sy, sv));
      const fc = q.reduce((a, p) => a.add(p), new THREE.Vector3()).multiplyScalar(0.25);
      let n = q[1].clone().sub(q[0]).cross(q[3].clone().sub(q[0])).normalize();
      if (n.dot(fc.sub(centre)) < 0) { q = [q[0], q[3], q[2], q[1]]; n.negate(); }
      const cl = b.door ? DOOR : fi === 0 && b.roof ? roof : wall;
      for (const p of [q[0], q[1], q[2], q[0], q[2], q[3]]) { pos.push(p.x, p.y, p.z); nor.push(n.x, n.y, n.z); col.push(cl.r, cl.g, cl.b); }
    });
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3)); g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  g.computeBoundingSphere();
  return g;
}
export interface VillageBuild { group: THREE.Group; boxes: Map<string, Box[]>; tris: number; compounds: number; /** per cell mesh: the centres (world x, z) of its villages, for switching shadows on near the camera */ cells: { mesh: THREE.Mesh; centres: [number, number][] }[] }
/** all villages: one merged mesh per 8 km cell (a few draw calls, frustum-culled per cell); boxes kept for lazy colliders */
export function buildVillageMeshes(villages: Village[], terrain: Terrain, seed = 1): VillageBuild {
  const group = new THREE.Group(); group.name = 'plain-villages';
  const mat = surfaceMaterial('village_mud', { vertexColors: true });
  const cells = new Map<string, Box[]>(), boxes = new Map<string, Box[]>(), centres = new Map<string, [number, number][]>(); let tris = 0, compounds = 0;
  const cellList: VillageBuild['cells'] = [];
  for (const v of villages) {
    const cs = villageCompounds(v, terrain, seed); compounds += cs.length;
    const bx: Box[] = [];
    for (const c of cs) bx.push(...compoundBoxes(c, terrain.heightAt(c.x, -c.y)));
    boxes.set(v.id, bx);
    const key = `${Math.floor(v.x / 8000)},${Math.floor(v.y / 8000)}`; if (!cells.has(key)) { cells.set(key, []); centres.set(key, []); } cells.get(key)!.push(...bx); centres.get(key)!.push([v.x, -v.y]);
  }
  const vu = feature('villages_unlocated');
  for (const [key, bx] of cells) {
    const g = boxesMesh(bx, bx.length); tris += g.getAttribute('position').count / 3;
    const m = new THREE.Mesh(g, mat); m.name = 'plain-villages-' + key; m.castShadow = false; m.receiveShadow = true; // shadows switched on near the camera (index.ts)
    cellList.push({ mesh: m, centres: centres.get(key)! });
    m.userData = tag(vu, 'village houses: courtyard compounds of mud brick (layout C, villages_unlocated.layout); positions: Barrington points (C, map-scale +-3 km) or placed by rule (C)');
    group.add(m);
  }
  group.userData = tag(vu);
  return { group, boxes, tris, compounds, cells: cellList };
}
