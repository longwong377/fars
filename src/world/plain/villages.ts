// Villages of the plain (Phase 7). Four are Barrington Atlas points (plain.json village_*; map-scale, +-3 km, C); the other
// 33 of Sumner's 39 secure Achaemenid sites (two more are the settlement.json town zones) could not be located (the survey
// text is blocked, Q-050) and are placed by the plain.json `villages_unlocated` rule: on low rises within 1.5 km of a river
// or canal, >= 2 km apart (C). A Barrington point is used as given unless it falls where no village can stand (in a river
// corridor, a settlement zone or on a slope); then the nearest suitable spot inside its uncertainty is used and the offset
// is recorded. Layout inside each village is reconstruction (C): courtyard compounds of mud brick (villages_unlocated.layout).
// D-254: the compounds are planned here (villageCompounds), rasterised once for the people and the drawn world alike
// (villagesite.ts) and built as houses by the town's house generator (villagehouses.ts; settlement/houses.ts).
import type { Terrain } from '../../terrain/heightfield';
import { feature, pointInPolygon, settlementZones, PointIndex, RiverProfile, baseCourse, priorTerrain } from './data';
import { BASE_CANALS, type Canal } from './canals';
import { Rng } from '../../core/rng';
import { SURFACES } from '../../render/materials';
import { h32, salt } from '../../people/hash';

// village mud plaster on mud brick, unpainted (C): the Terrace's greyish yellow-green clay paint is not assumed here
SURFACES.village_mud = { albedo: [0.56, 0.49, 0.38], roughness: 0.95, porosity: 0.85, noiseScale: 0.7, noiseAmp: 0.09, bump: { amp: 0.006, freq: 1.1 }, tier: 'C', note: 'village houses: mud plaster over mud brick, flat roofs of beams, reeds and mud (C)' };

export interface Village {
  id: string; name: string; x: number; y: number; pop: number; r: number; tier: string; src: string; note: string;
  located: boolean; /** metres moved from the data point to stand on suitable ground */ moved: number; chrono: string;
}
/** a room of a compound (compound-local metres, whole metres from the compound's corner) */
export interface CRoom { u0: number; v0: number; u1: number; v1: number; h: number }
/** a doorway: the midpoint of its 1 m edge (compound-local); `along` the axis its wall runs along */
export interface CDoor { u: number; v: number; along: 'u' | 'v' }
/** a courtyard compound (D-254): centre (grid e, n), sides w (along the village grid's x) and d, the village's angle; the
 *  rooms, their doors onto the court, the animal pen and its door, the gate in the S wall (gateU: its centre; `gate` the
 *  same as a fraction of w − 3, as read before D-254), the wing's side (−1 W, +1 E, 0 none) and the compound's seed */
export interface Compound { x: number; y: number; w: number; d: number; angle: number; rooms: CRoom[]; gate: number; gateU: number; seed: number;
  doors: CDoor[]; pen: { u0: number; v0: number; u1: number; v1: number }; penDoor: CDoor; wing: -1 | 0 | 1; fittings: CFitting[] }
/** a household's fitting (compound-local centre; `rot` the direction it faces, radians CCW from local +u; in the yard or the pen) */
export interface CFitting { kind: 'oven' | 'hearth' | 'bin' | 'jar' | 'manger'; u: number; v: number; rot: number; size: number; pen: boolean; note: string }

export function placeVillages(terrain: Terrain, live: RiverProfile[], canals: Canal[], seed = 1): Village[] {
  const rivers = live.map(baseCourse); // D-670: placed on the pre-meander course, as before (the meanders keep clear of them)
  canals = BASE_CANALS.get(canals) ?? canals;
  const zones = settlementZones();
  const water = new PointIndex(500); for (const r of rivers) water.addPolyline(r, 40, 0); for (const c of canals) water.addPolyline(c.pts, 40, 1);
  const riverOnly = new PointIndex(400); for (const r of rivers) riverOnly.addPolyline(r, 20);
  const ground = priorTerrain(terrain, live[0]?.prior), asl = (x: number, y: number) => ground.aslAt(x, -y); // D-670: the ground as before the meanders
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

/** the smallest compound side (m) a crowded village keeps when a compound is shrunk to leave a lane (C) */
export const COMPOUND_MIN = 11;
/** the lane left between two compounds (m; >= 2 cells, Q-670's rule for the town's lanes, C) */
export const LANE_MIN = 2;
/** courtyard compounds of one village (C layout: villages_unlocated.layout). D-254: every compound stands on the village's
 *  1 m grid (the village frame: centre (v.x, v.y), turned by the village's angle), its sides whole metres, so the people's
 *  raster (villagesite.ts) and the drawn walls are one plan; compounds never overlap (a lane of >= LANE_MIN m between them:
 *  a compound that would crowd a neighbour is shrunk, else the ground is left open). Each compound's plan: a range of rooms
 *  along the N side split into two or three rooms, a wing along the E or W side (55 %, C), an animal pen in a S corner, the
 *  gate in the S wall, a door from each room onto the court. The random stream of the village (placement, sizes, the gate
 *  and the seed) is drawn as before D-254; the plan inside draws from the compound's own seed. */
export function villageCompounds(v: Village, terrain: Terrain, seed = 1): Compound[] {
  // (memoised: the plain, the people, the animals and the tools all ask for the same plan; callers do not change it)
  const key = `${v.id}|${seed}|${v.x}|${v.y}|${v.r}|${v.pop}`; const hit = PLANS.get(key); if (hit) return hit;
  const out = planCompounds(v, seed); PLANS.set(key, out); void terrain; return out;
}
const PLANS = new Map<string, Compound[]>();
function planCompounds(v: Village, seed: number): Compound[] {
  const lay = feature('villages_unlocated').layout;
  const rng = new Rng(seed, 'village-' + v.id);
  const want = Math.max(4, Math.round(v.pop / lay.household_size));
  const spacing = Math.sqrt((Math.PI * v.r * v.r) / want); // one compound per grid cell of the settled disc
  const angle = rng.range(0, Math.PI / 2);
  const ca = Math.cos(angle), sa = Math.sin(angle);
  const cells: { u: number; w: number; d: number }[] = [];
  const R = v.r * 1.15, m = Math.ceil(R / spacing);
  for (let i = -m; i <= m; i++) for (let j = -m; j <= m; j++) {
    const u = (i + rng.range(-0.18, 0.18)) * spacing, w = (j + rng.range(-0.18, 0.18)) * spacing;
    const edge = v.r * (0.85 + 0.3 * Math.sin(Math.atan2(w, u) * 3 + v.x * 0.001)); // lobed outline
    const d = Math.hypot(u, w); if (d > edge) continue;
    cells.push({ u, w, d });
  }
  cells.sort((a, b) => a.d - b.d);
  const out: Compound[] = [], taken: [number, number, number, number][] = []; // integer rects [U0, V0, U1, V1) in the village frame
  for (const c of cells.slice(0, want)) {
    if (rng.chance(0.08)) continue; // lanes widen into small open spaces
    const cw = Math.min(spacing - 3, rng.range(lay.compound_m[0], lay.compound_m[1])), cd = Math.min(spacing - 3, rng.range(lay.compound_m[0], lay.compound_m[1]));
    const rd = rng.range(lay.room_depth_m[0], lay.room_depth_m[1]), rh = rng.range(lay.room_height_m[0], lay.room_height_m[1]);
    rng.range(-0.08, 0.08); // (each compound's own small turn before D-254: drawn to keep the village's stream, not used)
    const wing: -1 | 0 | 1 = rng.chance(0.55) ? (rng.chance(0.5) ? -1 : 1) : 0;
    const gate = rng.range(-0.3, 0.3), cseed = rng.int(0, 1e9);
    // on the grid, clear of the compounds already placed
    let W = Math.max(COMPOUND_MIN, Math.round(cw)), D = Math.max(COMPOUND_MIN, Math.round(cd)), U0 = Math.round(c.u - W / 2), V0 = Math.round(c.w - D / 2), ok = false;
    for (let t = 0; t < 32; t++) {
      const hit = taken.find(r => U0 < r[2] + LANE_MIN && U0 + W > r[0] - LANE_MIN && V0 < r[3] + LANE_MIN && V0 + D > r[1] - LANE_MIN);
      if (!hit) { ok = true; break; }
      const ox = Math.min(U0 + W, hit[2] + LANE_MIN) - Math.max(U0, hit[0] - LANE_MIN), oy = Math.min(V0 + D, hit[3] + LANE_MIN) - Math.max(V0, hit[1] - LANE_MIN);
      if (ox <= oy) { if ((hit[0] + hit[2]) / 2 < U0 + W / 2) U0 += ox; W -= ox; } else { if ((hit[1] + hit[3]) / 2 < V0 + D / 2) V0 += oy; D -= oy; }
      if (W < COMPOUND_MIN || D < COMPOUND_MIN) break;
    }
    if (!ok) continue;
    taken.push([U0, V0, U0 + W, V0 + D]);
    const lu = U0 + W / 2, lw = V0 + D / 2;
    out.push({ x: v.x + lu * ca - lw * sa, y: v.y + lu * sa + lw * ca, w: W, d: D, angle, ...compoundPlan(W, D, rd, rh, wing, gate, cseed), seed: cseed });
  }
  return out;
}

/** a compound's plan in whole metres (compound-local: u along the village grid's x, v along its y, the gate in the S wall
 *  at v = −d/2; C throughout, the region's courtyard house by analogy: rooms along the side that faces the winter sun,
 *  research/PLAIN.md) */
function compoundPlan(W: number, D: number, rd: number, rh: number, wingSide: -1 | 0 | 1, gate: number, seed: number): Pick<Compound, 'rooms' | 'gate' | 'gateU' | 'doors' | 'pen' | 'penDoor' | 'wing' | 'fittings'> {
  const r = new Rng(seed, 'village-rooms');
  const U = (a: number) => -W / 2 + a, V = (b: number) => -D / 2 + b; // cell-edge index -> compound-local metres
  const rdI = Math.min(5, Math.max(3, Math.round(rd + r.range(-0.5, 0.5))));
  const rooms: CRoom[] = [], doors: CDoor[] = [];
  // the wing: its width, where it starts from the S wall
  let wing: -1 | 0 | 1 = wingSide, wb0 = r.pick([0, 0, 2, 3]);
  const wd = Math.min(5, Math.max(3, rdI - (r.chance(0.5) ? 1 : 0)));
  // the pen: in the S corner away from the wing (C)
  const ps: -1 | 1 = wing ? (-wing as -1 | 1) : (r.chance(0.5) ? -1 : 1);
  let pw = r.int(3, 5); const pd = Math.max(3, Math.min(r.int(3, 4), D - rdI - 4));
  if (wing && wb0 === 0 && W - pw - wd < 5) wb0 = 2; // leave the S wall room for the gate
  if (wing && D - rdI - wb0 < 3) wing = 0;
  if (W - pw - (wing && wb0 === 0 ? wd : 0) < 5) pw = 3;
  // the main range (N side), in two or three rooms of >= 4 m
  const nMain = W >= 17 ? (r.chance(0.6) ? 3 : 2) : W >= 10 ? 2 : 1, cuts = [0];
  for (let k = 1; k < nMain; k++) cuts.push(Math.round((W * k) / nMain + r.range(-1, 1)));
  cuts.push(W);
  const wingCols = (a: number) => wing === -1 ? a < wd : wing === 1 ? a >= W - wd : false;
  for (let k = 0; k < nMain; k++) {
    const a0 = cuts[k], a1 = cuts[k + 1]; rooms.push({ u0: U(a0), v0: V(D - rdI), u1: U(a1), v1: V(D), h: rh });
    // its door onto the court: a column clear of the room's own ends and of the wing (a wall meeting a jamb narrows it)
    const cand: number[] = []; for (let a = a0 + 1; a <= a1 - 2; a++) if (!wingCols(a) && !wingCols(a - 1) && !wingCols(a + 1)) cand.push(a);
    if (cand.length) { const a = cand[Math.min(cand.length - 1, Math.floor(cand.length * (0.3 + 0.4 * r.next())))]; doors.push({ u: U(a) + 0.5, v: V(D - rdI), along: 'u' }); }
    // a room the wing shuts off the court opens into the next room of the range (a door in the partition, clear of its ends)
    else doors.push({ u: U(k + 1 < nMain ? a1 : a0), v: V(D - rdI + 1 + Math.floor((rdI - 2) * r.next())) + 0.5, along: 'v' });
  }
  if (wing) {
    const b0 = wb0, b1 = D - rdI, au = wing === -1 ? U(0) : U(W - wd), av = wing === -1 ? U(wd) : U(W), face = wing === -1 ? U(wd) : U(W - wd);
    const split = b1 - b0 >= 8 ? b0 + Math.round((b1 - b0) / 2) : -1, spans = split > 0 ? [[b0, split], [split, b1]] : [[b0, b1]];
    for (const [s0, s1] of spans) { rooms.push({ u0: au, v0: V(s0), u1: av, v1: V(s1), h: rh });
      const cand: number[] = []; for (let b = s0 + 1; b <= s1 - 2; b++) cand.push(b);
      if (cand.length) { const b = cand[Math.floor(cand.length * r.next())]; doors.push({ u: face, v: V(b) + 0.5, along: 'v' }); } }
  }
  const pen = { u0: ps === -1 ? U(0) : U(W - pw), v0: V(0), u1: ps === -1 ? U(pw) : U(W), v1: V(pd) };
  const penDoor: CDoor = { u: (ps === -1 ? U(1) : U(W - pw + 1)) + Math.floor((pw - 2) * r.next()) + 0.5, v: V(pd), along: 'u' };
  // the gate: the drawn fraction along the S wall, kept clear of the pen, of a wing that reaches the wall and of the corners
  const left = ps === -1 ? pw : wing === -1 && wb0 === 0 ? wd : 0, right = ps === 1 ? pw : wing === 1 && wb0 === 0 ? wd : 0;
  const a = Math.min(W - right - 2, Math.max(left + 1, Math.round(W / 2 + gate * (W - 3) - 0.5))), gateU = U(a) + 0.5;
  return { rooms, doors, pen, penDoor, gateU, gate: gateU / (W - 3), wing, fittings: planFittings(W, D, rooms, pen, [...doors, penDoor], a, seed) };
}

/** the household's fittings in its yard and pen, on the compound's own 1 m grid (C, deterministic per compound seed): the
 *  bread oven in a corner of the yard, the hearth before the rooms, one or two storage bins and a few jars against the
 *  walls, the manger in the pen; never in a doorway's way (the cells either side of every door and their neighbours stay
 *  free), each pushed off the walls it stands against so that its body clears their faces (a wall stands on the cell edge,
 *  up to 0.3 m of it on this side) */
function planFittings(W: number, D: number, rooms: CRoom[], pen: Compound['pen'], doors: CDoor[], gateA: number, seed: number): CFitting[] {
  const r = new Rng(seed, 'village-fittings'), code = new Int8Array(W * D); // 0 yard, 1 room, 2 pen
  const cellsOf = (q: { u0: number; v0: number; u1: number; v1: number }, c: number) => { for (let b = Math.round(q.v0 + D / 2); b < Math.round(q.v1 + D / 2); b++) for (let a = Math.round(q.u0 + W / 2); a < Math.round(q.u1 + W / 2); a++) code[b * W + a] = c; };
  for (const q of rooms) cellsOf(q, 1); cellsOf(pen, 2);
  const at = (a: number, b: number) => a < 0 || b < 0 || a >= W || b >= D ? -1 : code[b * W + a];
  const near = new Set<number>(), mark = (a: number, b: number) => { for (const [da, db] of [[0, 0], [1, 0], [-1, 0], [0, 1], [0, -1]]) { const x = a + da, y = b + db; if (x >= 0 && y >= 0 && x < W && y < D) near.add(y * W + x); } };
  for (const d of doors) { if (d.along === 'u') { const a = Math.floor(d.u + W / 2), b = Math.round(d.v + D / 2); mark(a, b - 1); mark(a, b); } else { const a = Math.round(d.u + W / 2), b = Math.floor(d.v + D / 2); mark(a - 1, b); mark(a, b); } }
  mark(gateA, 0);
  type WC = { a: number; b: number; walls: [number, number][]; corner: boolean; facade: boolean };
  const wallCells = (c: number): WC[] => { const out: WC[] = [];
    for (let b = 0; b < D; b++) for (let a = 0; a < W; a++) { if (code[b * W + a] !== c || near.has(b * W + a)) continue; const walls: [number, number][] = []; let facade = false;
      for (const [da, db] of [[1, 0], [-1, 0], [0, 1], [0, -1]] as [number, number][]) { const x = at(a + da, b + db); if (x !== c) { walls.push([da, db]); if (x === 1) facade = true; } }
      if (walls.length) out.push({ a, b, walls, corner: walls.length >= 2, facade }); }
    return out; };
  const out: CFitting[] = [], pos = (x: WC): [number, number] => [-W / 2 + x.a + 0.5, -D / 2 + x.b + 0.5];
  const clear = (x: WC, m: number) => { const [u, v] = pos(x); return out.every(f => Math.hypot(f.u - u, f.v - v) >= m); };
  const pick = (list: WC[]) => list.length ? list[Math.floor(r.next() * list.length)] : null;
  const add = (kind: CFitting['kind'], x: WC, rad: number, size: number, note: string, along = false) => {
    const push = Math.max(0, 0.3 + rad - 0.5); let [u, v] = pos(x); for (const [du, dv] of x.walls) { u -= du * push; v -= dv * push; }
    out.push({ kind, u, v, rot: Math.atan2(x.walls[0][1], x.walls[0][0]) + (along ? Math.PI / 2 : 0), size, pen: kind === 'manger', note }); };
  const yard = wallCells(0);
  // 1. the bread oven (tannur): a clay cylinder in a corner of the yard, fired with dung cakes and brushwood before dawn (C: the
  //    tannur is the region's bread oven by analogy; every household bakes its own, D-207)
  const oven = pick(yard.filter(x => x.corner && !x.facade)) ?? pick(yard.filter(x => !x.facade)) ?? pick(yard);
  if (oven) add('oven', oven, 0.44, 1, 'a bread oven (tannur): a clay cylinder in a corner of the yard, fired before dawn (C; the region\'s oven by analogy)');
  // 2. the hearth: before the rooms, where the household cooks in the warm months (C)
  const hearth = pick(yard.filter(x => x.facade && clear(x, 2.2))) ?? pick(yard.filter(x => clear(x, 2.2)));
  if (hearth) add('hearth', hearth, 0.55, 1, 'the household\'s hearth in the yard before the rooms: a ring of stones, the cooking pot and bowls (C)');
  // 3. storage: one or two mud bins for the grain and a few jars against the yard walls (C: bins of unbaked clay, the region's
  //    village storage by analogy; jars: PF ration units, B existence)
  const nb = r.int(1, 2); for (let q = 0; q < nb; q++) { const x = pick(yard.filter(y => !y.facade && clear(y, 1.3))); if (x) add('bin', x, 0.36, r.range(0.85, 1.1), 'a storage bin of unbaked clay for the grain, lidded, against the yard wall (C)'); }
  const nj = r.int(1, 3); for (let q = 0; q < nj; q++) { const x = pick(yard.filter(y => clear(y, 0.8))); if (x) add('jar', x, 0.27, r.range(0.8, 1.1), 'a storage jar: water, oil or grain (jars as ration units: PF, B; form C)'); }
  // 4. the pen: a mud manger along its wall (C)
  const pc = wallCells(2).filter(x => clear(x, 1)), mx = pick(pc.filter(y => !y.corner)) ?? pick(pc);
  if (mx) add('manger', mx, 0.32, 1, 'a mud manger along the pen\'s wall; dung trodden into the floor (C)', true);
  return out;
}

/** the threshing floor's radius (m; C: the region's floors by analogy, RECOLLECTION) */
export const THRESH_R = 7;
/** the threshing floor of a village (the people's `threshing:<village>` place, popgeo.ts): a round floor of beaten earth
 *  with a kerb of fieldstones at the village's edge, beyond its compounds, where the grain is trodden out and winnowed (C).
 *  The bearing is the people's own hash of the village (as since D-143); the distance keeps it clear of every compound */
export function threshingFloor(v: { id: string; x: number; y: number; r: number }, comps: { x: number; y: number; w: number; d: number }[], seed = 1): [number, number] {
  const a = (h32(seed, salt('popgeo-village'), salt(v.id)) / 4294967296) * Math.PI * 2;
  let ext = 0; for (const c of comps) ext = Math.max(ext, Math.hypot(c.x - v.x, c.y - v.y) + Math.hypot(c.w, c.d) / 2);
  const d = Math.max(v.r + 45, ext + THRESH_R + 12);
  return [v.x + Math.cos(a) * d, v.y + Math.sin(a) * d];
}
