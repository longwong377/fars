// The settlement plan (Phase 6): every town quarter, compound, garden, monument, road, canal, well, tree and fire of the
// settlement, as data in the grid frame (D-002), generated deterministically from src/data/settlement.json. Positions of
// the zones and the named features come from settlement.json (their tiers and sources are there); everything inside them
// is reconstruction (C) and names its basis row in settlement.json `town_elements`. No three.js and no terrain here: the
// builder (build.ts) places it on the ground with terrain.heightAt (D-035).
import { Rng } from '../../core/rng';
import settlementJson from '../../data/settlement.json';
import { Site, SiteMeta, Plot, P2, Frame, toGrid, toLocal, OUT, LANE, FREE, RES, ROOM, COURT, YARD, Fitting } from './site';
import { generateQuarter, QuarterOpts } from './quarter';
import { ringCompound, yardCompound, roomBlock, openGround } from './compounds';
import { HOUSE } from './town_rules';

export const TOWN_SEED = 467; // the town is architecture: fixed, not per world seed
export const SETTLEMENT: any = settlementJson;
export const FEATURES: Record<string, any> = Object.fromEntries(SETTLEMENT.features.map((f: any) => [f.id, f]));
export const ROWS: Record<string, any> = Object.fromEntries((SETTLEMENT.town_elements ?? []).map((r: any) => [r.id, r]));
const deg = Math.PI / 180;
/** grid bearing (clockwise from grid north) of a true bearing: grid north is 341° true (D-002) */
export const gridBearing = (trueDeg: number) => (((trueDeg - 341) % 360) + 360) % 360;
/** frame angle (CCW from grid east) whose +u axis points along a grid bearing */
export const thetaOfBearing = (gridDeg: number) => (90 - gridDeg) * deg;

export type Mat = 'mud' | 'stone' | 'brick' | 'timber' | 'glaze' | 'refuse';
/** a box or cylinder prop (grid frame; heights above a base sampled from the terrain: its group's lowest corner) */
export interface Prop { shape: 'box' | 'cyl'; mat: Mat; c: P2; theta: number; hu: number; hv: number; y0: number; y1: number; group: string; collide: boolean; row: string; feature: string; note: string; colour?: [number, number, number]; r1?: number }
export interface TreeSpot { c: P2; species: string; size: number; row: string; feature: string }
export interface WaterPiece { kind: 'pool' | 'channel' | 'well' | 'canal' | 'ditch'; pts: P2[]; width: number; level: number; row: string; feature: string; note?: string }
export interface Road { id: string; feature: string; row: string; pts: P2[]; width: number; note: string }
export interface Midden { c: P2; r: number; h: number; kind: 'midden' | 'dung' | 'ash' | 'bone'; row: string; feature: string }
export interface Group { id: string; pts: P2[] } // footprint corners that set the base height of a prop group
export interface TownPlan { sites: Site[]; props: Prop[]; trees: TreeSpot[]; water: WaterPiece[]; roads: Road[]; middens: Midden[]; groups: Map<string, P2[]>; gate: { c: P2; theta: number } }

// ---------------------------------------------------------------------------------------------------------------------
// Quarters (all C). Centres and orientations are judgement inside the settlement.json zones; each keeps clear of the
// Terrace approach (the walkable grid, e −620…262, n −245…185), of the empty Frataraka site and of the roads, except
// q_s1, which the road south runs through as its main street.
interface QDef { id: string; feature: string; zone: string; popZone: 'town' | 'plain'; c: P2; theta: number; W: number; H: number; mains: number; crafts: QuarterOpts['crafts']; ws: number; squares: number; road?: string; note: string; shape?: QuarterOpts['shape']; reserve?: { at: P2; W: number; H: number; theta?: number }[] }
const sRoad = FEATURES.road_south_tirazzish.polyline as P2[];
const sDir = (() => { const [a, b] = [sRoad[0], sRoad[1]], L = Math.hypot(b[0] - a[0], b[1] - a[1]); return [(b[0] - a[0]) / L, (b[1] - a[1]) / L] as P2; })();
/** q_s1 sits on the road south: its v axis runs up the road, its centre on the road line */
const qs1c: P2 = (() => { const a = sRoad[0], s = 780; return [a[0] + sDir[0] * s, a[1] + sDir[1] * s]; })();
const qs1theta = Math.atan2(-sDir[1], -sDir[0]) - Math.PI / 2; // +v = back up the road (toward the Terrace)
export const QUARTERS: QDef[] = [
  { id: 'q_s1', feature: 'zone_lower_town_south', zone: 'zone_lower_town_south', popZone: 'town', c: qs1c, theta: qs1theta, W: 230, H: 270, mains: 1, crafts: ['metal', 'wood', 'textile', 'bakery', 'brewery'], ws: 0.09, squares: 3, road: 'road_south_tirazzish', note: 'lower town on the road south, its main street (C)' },
  { id: 'q_s2', feature: 'zone_lower_town_south', zone: 'zone_lower_town_south', popZone: 'town', c: [-815, -1095], theta: -8 * deg, W: 220, H: 220, mains: 2, crafts: ['textile', 'bakery', 'pottery', 'metal'], ws: 0.08, squares: 2, note: 'lower town (C)' },
  { id: 'q_s3', feature: 'zone_lower_town_south', zone: 'zone_lower_town_south', popZone: 'town', c: [-1195, -880], theta: 12 * deg, W: 210, H: 230, mains: 2, crafts: ['wood', 'bakery', 'textile'], ws: 0.07, squares: 2, note: 'lower town (C)' },
  { id: 'q_s4', feature: 'zone_lower_town_south', zone: 'zone_lower_town_south', popZone: 'town', c: [-960, -1440], theta: 4 * deg, W: 230, H: 190, mains: 2, crafts: ['pottery', 'brewery', 'textile'], ws: 0.07, squares: 2, note: 'lower town (C)' },
  { id: 'q_w1', feature: 'pw_area_a', zone: 'zone_persepolis_west', popZone: 'town', c: [-560, 430], theta: 4 * deg, W: 200, H: 180, mains: 2, crafts: ['metal', 'wood', 'bakery'], ws: 0.07, squares: 2, note: 'Persepolis West around Area A (strong geomagnetic anomalies; findings not retrieved): houses (C)' },
  { id: 'q_w2', feature: 'pw_area_b_craft', zone: 'zone_persepolis_west', popZone: 'town', c: [-1075, 560], theta: -6 * deg, W: 210, H: 200, mains: 2, crafts: ['pottery', 'metal', 'textile'], ws: 0.1, squares: 1, note: 'craft quarter around Persepolis West Area B (kiln, bone pits, pigments: B activity; houses C)', reserve: [{ at: FEATURES.pw_area_b_craft.xy, W: 44, H: 34 }] },
  { id: 'q_w3', feature: 'zone_persepolis_west', zone: 'zone_persepolis_west', popZone: 'town', c: [-935, -95], theta: 10 * deg, W: 210, H: 210, mains: 2, crafts: ['textile', 'bakery', 'wood'], ws: 0.07, squares: 2, note: 'Persepolis West (C)' },
  { id: 'q_n1', feature: 'zone_persepolis_west', zone: 'zone_persepolis_west', popZone: 'town', c: [-265, 725], theta: 0, W: 150, H: 130, mains: 1, crafts: ['wood', 'bakery'], ws: 0.05, squares: 1, note: 'houses of officials and scribes near the official building (C)', shape: { p: 4, noise: 0.1 } },
  { id: 'q_f1', feature: 'zone_bagh_e_firuzi', zone: 'zone_bagh_e_firuzi', popZone: 'town', c: [-2140, 2085], theta: -30 * deg, W: 100, H: 90, mains: 1, crafts: ['bakery'], ws: 0.05, squares: 1, note: 'gardeners\' houses of the Bagh-e Firuzi gardens (C)', shape: { p: 2.6, noise: 0.18 } },
  { id: 'q_g1', feature: 'zone_dasht_e_gohar', zone: 'zone_dasht_e_gohar', popZone: 'plain', c: [650, 3800], theta: 8 * deg, W: 90, H: 80, mains: 1, crafts: ['bakery'], ws: 0.05, squares: 1, note: 'gardeners\' houses of the Dasht-e Gohar gardens (C)', shape: { p: 2.6, noise: 0.18 } },
];

// ---------------------------------------------------------------------------------------------------------------------
const M = (id: string, feature: string, zone: string, popZone: 'town' | 'plain', kind: SiteMeta['kind'], note: string): SiteMeta => ({ id, feature, zone, popZone, kind, tier: 'C', src: 'RECON', note });

function quarterSite(q: QDef): Site {
  const s = new Site(M(q.id, q.feature, q.zone, q.popZone, 'quarter', q.note), { c: q.c, theta: q.theta }, q.W, q.H);
  const rng = new Rng(TOWN_SEED, 'town:' + q.id);
  const reserve = (q.reserve ?? []).map(r => { const [u, v] = toLocal(s.frame, r.at[0], r.at[1]); return [u - r.W / 2, v - r.H / 2, u + r.W / 2, v + r.H / 2] as [number, number, number, number]; });
  generateQuarter(s, { mains: q.mains, mainWidth: 4, laneWidth: 3, alleyWidth: 2, dmax: 16, plotW: HOUSE.plotW, plotD: HOUSE.plotD, workshopShare: q.ws, crafts: q.crafts, squares: q.squares,
    forced: q.road ? [{ axis: 'v', offset: 0, width: 7 }] : undefined, reserve, shape: q.shape, row: 'town_houses', feature: q.feature, idPrefix: q.id }, rng);
  if (q.id === 'q_w2') stampAreaB(s, reserve[0], rng);
  return s;
}

/** open a lane from a rectangle's side to the nearest lane cell (straight run), returns the side used */
function laneTo(s: Site, rect: [number, number, number, number]): 'S' | 'N' | 'W' | 'E' {
  const [i0, j0, i1, j1] = rect; let best: { side: 'S' | 'N' | 'W' | 'E'; d: number; run: [number, number, number, number] } | null = null;
  const probes: ['S' | 'N' | 'W' | 'E', number, number, number, number][] = [['S', (i0 + i1) >> 1, j0 - 1, 0, -1], ['N', (i0 + i1) >> 1, j1, 0, 1], ['W', i0 - 1, (j0 + j1) >> 1, -1, 0], ['E', i1, (j0 + j1) >> 1, 1, 0]];
  for (const [side, i, j, di, dj] of probes) { let d = 0, x = i, y = j; while (s.inb(x, y) && d < 60) { const c = s.cell[s.k(x, y)]; if (c === LANE || c === OUT) break; x += di; y += dj; d++; }
    if (!s.inb(x, y) || d >= 60) continue; if (!best || d < best.d) best = { side, d, run: [i, j, x, y] }; }
  if (!best) return 'S';
  const [i, j, x, y] = best.run;
  // a 3 m lane: clear plots in the way (they lose those cells; the walls follow)
  const lo = -1, hi = 2;
  if (i === x) s.paint(i + lo, Math.min(j, y), i + hi, Math.max(j, y) + 1, LANE, c => c !== RES); else s.paint(Math.min(i, x), j + lo, Math.max(i, x) + 1, j + hi, LANE, c => c !== RES);
  return best.side;
}

/** Persepolis West Area B (PW2017, PW-PIGMENT2021: activity B; layout C): a walled craft yard with a kiln, pits of bone
 *  fragments (raw material for the fluorapatite that whitened the Terrace limestone), a pigment workshop with grinding
 *  slabs and a small furnace (Egyptian blue made here: diopside and a bronze scrap with a blue crust), middens by the kiln */
function stampAreaB(s: Site, r: [number, number, number, number], rng: Rng) {
  const rect: [number, number, number, number] = [s.ci(r[0]), s.cj(r[1]), s.ci(r[2]), s.cj(r[3])];
  const side = laneTo(s, rect);
  const p = yardCompound(s, { kind: 'craft_area', id: 'pw_area_b-yard', row: 'area_b_yard', feature: 'pw_area_b_craft', note: 'Area B craft yard: kiln, bone pits, pigment workshop (activity B, layout C)', rect, wall: 2.4, gate: side, gateW: 2, capacity: 6, craft: 'pigment' });
  // pigment workshop: a range of rooms along the side opposite the gate
  const [i0, j0, i1, j1] = rect; const opp = { S: 'N', N: 'S', W: 'E', E: 'W' }[side];
  const blk: [number, number, number, number] = opp === 'N' ? [i0, j1 - 6, i1, j1] : opp === 'S' ? [i0, j0, i1, j0 + 6] : opp === 'W' ? [i0, j0, i0 + 6, j1] : [i1 - 6, j0, i1, j1];
  roomBlock(s, p, blk, [5, 7], rng);
  p.height = 3.4; p.parapet = 0.4;
  const cu = (i: number) => s.cu(i), cv = (j: number) => s.cv(j), mi = (i0 + i1) / 2, mj = (j0 + j1) / 2;
  const F = (kind: Fitting['kind'], u: number, v: number, size = 1, note = '') => s.fittings.push({ kind, u, v, rot: 0, size, plot: p.idx, note });
  const [bu, bv] = [(cu(blk[0]) + cu(blk[2] - 1)) / 2, (cv(blk[1]) + cv(blk[3] - 1)) / 2];
  F('kiln', cu(Math.round(mi)) - 8, cv(Math.round(mj)), 1.4, 'kiln "of possible Achaemenid date" (PW2017, B); product not retrieved; updraft form C');
  for (let x = 0; x < 3; x++) F('pit', cu(Math.round(mi)) + 4 + x * 3.2, cv(Math.round(mj)) - 3 + (x % 2) * 2.5, 1, 'pit of bone fragments: raw material for fluorapatite, used to whiten the grey limestone of the Terrace (PW2017, B); pit form C');
  F('forge', bu, bv, 0.8, 'small furnace for Egyptian blue (diopside, blue-crusted bronze scrap: PW-PIGMENT2021, B); form C');
  for (let x = 0; x < 3; x++) F('grind_slab', bu + (x - 1) * 1.6, bv + (opp === 'N' ? -1.8 : 1.8), 1, 'grinding slab with pigment lumps: azurite, malachite, Egyptian blue, glauconite, red and yellow ochre (PW-PIGMENT2021, B)');
  F('jar', cu(i0 + 2), cv(j0 + 2), 1); F('jar_big', cu(i0 + 3), cv(j0 + 2), 1);
  F('knucklebones', cu(Math.round(mi)) - 2, cv(Math.round(mj)) + 4, 1, 'knucklebones (astragali) left in the yard: a game known across the period (RECOLLECTION, NOT SEEN; C)');
  F('midden', cu(Math.round(mi)) - 14, cv(Math.round(mj)) + 6, 1.2, 'midden by the kiln (SETTLEMENT zoning, C)');
  s.recount();
}

function compoundSite(id: string, feature: string, zone: string, popZone: 'town' | 'plain', c: P2, theta: number, W: number, H: number, note: string): Site {
  const s = new Site(M(id, feature, zone, popZone, 'compound', note), { c, theta }, W + 4, H + 4); openGround(s); return s;
}
const inner = (s: Site, W: number, H: number): [number, number, number, number] => [2, 2, 2 + W, 2 + H];

function officialSite(): Site {
  // ~1 ha official building N of the Frataraka site (GONDET2018: existence B, position C, size ~100 x 100 m C). Plan C:
  // ranges of rooms around a court, a gate toward the Terrace (grid S), a square columned hall in the court.
  const f = FEATURES.north_official_complex; const s = compoundSite('official', 'north_official_complex', 'north_official_complex', 'town', f.xy, 0, 100, 100, f.note);
  const rng = new Rng(TOWN_SEED, 'town:official');
  const p = ringCompound(s, { kind: 'official', id: 'official-0001', row: 'official_court', feature: 'north_official_complex', note: 'official building (existence B, plan C)', rect: inner(s, 100, 100), depth: { S: 9, N: 9, W: 8, E: 8 }, roomLen: [5, 9], gate: 'S', gateW: 4, height: 6.0, capacity: 60 }, rng);
  // the hall: a roofed square in the court with 4 x 4 columns (render props), doors on the S
  const h0 = 2 + 38, hall: [number, number, number, number] = [h0, h0 + 2, h0 + 24, h0 + 26];
  roomBlockHall(s, p, hall);
  for (let a = 0; a < 4; a++) for (let b = 0; b < 4; b++) s.fittings.push({ kind: 'column', u: s.cu(hall[0]) + 3.3 + a * 5.8 - 0.5, v: s.cv(hall[1]) + 3.3 + b * 5.8 - 0.5, rot: 0, size: 5.4, plot: p.idx, note: 'column of the official hall (C: stone base, plastered timber shaft)' });
  s.fittings.push({ kind: 'well', u: s.cu(20), v: s.cv(20), rot: 0, size: 1, plot: p.idx, note: 'well in the court (C)' });
  for (const [u, v] of [[-30, -28], [30, -28]]) s.fittings.push({ kind: 'hearth', u, v, rot: 0, size: 1, plot: p.idx, note: 'court hearth (C)' });
  s.recount(); return s;
}
/** a single roofed hall inside a court, two doors on its S side */
function roomBlockHall(s: Site, p: Plot, r: [number, number, number, number]) {
  const rid = s.newRoom();
  for (let j = r[1]; j < r[3]; j++) for (let i = r[0]; i < r[2]; i++) { const k = s.k(i, j); s.sub[k] = ROOM; s.room[k] = rid; }
  for (const i of [r[0] + 8, r[2] - 9]) s.doors.add(s.edgeBetween(s.k(i, r[1]), s.k(i, r[1] - 1)));
  void p;
}

function storesSite(): Site {
  // storehouse (royal stores: PF 2-8 deliveries "for the royal stores", A Darius-era; place and plan C): long
  // magazines N and S of a court, the gate toward the road south
  const c: P2 = [-265, -520]; const s = compoundSite('stores', 'zone_persepolis_west', 'zone_persepolis_west', 'town', c, qs1theta, 70, 50, 'storehouse (C place and plan)');
  const rng = new Rng(TOWN_SEED, 'town:stores');
  const p = ringCompound(s, { kind: 'store', id: 'stores-0001', row: 'town_stores', feature: 'zone_persepolis_west', note: 'storehouse: magazines around a court (C)', rect: inner(s, 70, 50), depth: { S: 14, N: 14, W: 0, E: 5 }, roomLen: [4, 4], gate: 'E', gateW: 3, height: 4.6, capacity: 6 }, rng);
  for (let x = 0; x < 10; x++) s.fittings.push({ kind: 'jar_big', u: -26 + x * 2.2, v: (x % 2 ? 1 : -1) * 6, rot: 0, size: 1, plot: p.idx, note: 'storage jar in the store court (C)' });
  s.fittings.push({ kind: 'hearth', u: 20, v: 5, rot: 0, size: 1, plot: p.idx, note: 'keepers\' hearth (C)' });
  s.recount(); return s;
}

function stablesSite(): Site {
  // state stable by the royal road W of the town (horse rations in 76 PF texts, POTTS2023 B; place and plan C)
  const s = compoundSite('stables', 'zone_persepolis_west', 'zone_persepolis_west', 'town', [-1450, 395], -20 * deg, 64, 44, 'state stable (C place and plan)');
  const rng = new Rng(TOWN_SEED, 'town:stables');
  const p = ringCompound(s, { kind: 'stable', id: 'stables-0001', row: 'town_stables', feature: 'zone_persepolis_west', note: 'stable: stalls on three sides of a yard (C)', rect: inner(s, 64, 44), depth: { S: 0, N: 7, W: 7, E: 7 }, roomLen: [8, 10], gate: 'S', gateW: 4, height: 3.8, capacity: 8, open: YARD }, rng);
  for (let x = 0; x < 8; x++) s.fittings.push({ kind: 'manger', u: -24 + x * 7, v: 12, rot: 0, size: 1, plot: p.idx, note: 'manger (C)' });
  s.fittings.push({ kind: 'trough', u: 0, v: -4, rot: 0, size: 2, plot: p.idx }); s.fittings.push({ kind: 'well', u: 6, v: -4, rot: 0, size: 1, plot: p.idx });
  s.fittings.push({ kind: 'midden', u: -30, v: -26, rot: 0, size: 1.3, plot: -1, note: 'dung heap outside the stable (C)' });
  s.fittings.push({ kind: 'hearth', u: -20, v: -6, rot: 0, size: 1, plot: p.idx, note: 'grooms\' hearth (C)' });
  s.recount(); return s;
}

function wayStationSite(): Site {
  // way-station on the royal road near the Kur crossing (ROYALROAD-GIS: stations a day apart, B; this one C): walled
  // court with rooms, store and stable (analogy with the Jinjun and Qaleh-ye Kali stations, B), well and hearth
  const f = FEATURES.waystation_kur_west, road = FEATURES.road_royal_west.polyline as P2[];
  const { foot, dir } = nearestOnPolyline(road, f.xy);
  const nrm: P2 = [-dir[1], dir[0]]; const side = (f.xy[0] - foot[0]) * nrm[0] + (f.xy[1] - foot[1]) * nrm[1] >= 0 ? 1 : -1;
  const c: P2 = [foot[0] + nrm[0] * side * 40, foot[1] + nrm[1] * side * 40];
  const theta = Math.atan2(dir[1], dir[0]);
  const s = compoundSite('waystation', 'waystation_kur_west', 'waystation_kur_west', 'plain', c, theta, 44, 44, f.note);
  const rng = new Rng(TOWN_SEED, 'town:waystation');
  const gate = side > 0 ? 'S' : 'N'; // the gate faces the road
  const p = ringCompound(s, { kind: 'station', id: 'waystation-0001', row: 'waystation_plan', feature: 'waystation_kur_west', note: 'way-station: rooms, store and stable round a court (C, analogy B)', rect: inner(s, 44, 44), depth: 6, roomLen: [5, 8], gate, gateW: 4, height: 4.0, capacity: 12, open: YARD }, rng);
  for (let x = 0; x < 4; x++) s.fittings.push({ kind: 'manger', u: -12 + x * 6, v: (gate === 'S' ? 1 : -1) * 13.5, rot: 0, size: 1, plot: p.idx, note: 'manger for relay horses and pack animals (C)' });
  s.fittings.push({ kind: 'well', u: 0, v: 0, rot: 0, size: 1, plot: p.idx }); s.fittings.push({ kind: 'trough', u: 3, v: 0, rot: 0, size: 2, plot: p.idx });
  s.fittings.push({ kind: 'hearth', u: -8, v: -4, rot: 0, size: 1, plot: p.idx, note: 'station hearth (C)' }); s.fittings.push({ kind: 'oven', u: -9.5, v: -5, rot: 0, size: 1, plot: p.idx });
  for (let x = 0; x < 5; x++) s.fittings.push({ kind: 'jar_big', u: 8 + x * 1.2, v: 6, rot: 0, size: 1, plot: p.idx, note: 'travel rations: flour and beverage by the sealed document (HYLAND2022, B; jars C)' });
  s.fittings.push({ kind: 'midden', u: 26, v: 26, rot: 0, size: 1.1, plot: -1 });
  s.recount(); return s;
}

function estateSite(id: string, c: P2, theta: number): Site {
  // elite estate in the Bagh-e Firuzi zone (very low-density elite occupation among gardens, GONDET2009 B; plan C):
  // a walled orchard with a courtyard house at one end and a pool
  const s = compoundSite(id, 'zone_bagh_e_firuzi', 'zone_bagh_e_firuzi', 'town', c, theta, 90, 70, 'elite estate (C)');
  const rng = new Rng(TOWN_SEED, 'town:' + id);
  const p = yardCompound(s, { kind: 'elite', id: `${id}-0001`, row: 'estates_bagh_e_firuzi', feature: 'zone_bagh_e_firuzi', note: 'estate: courtyard house in a walled orchard (C)', rect: inner(s, 90, 70), wall: 2.6, gate: 'S', gateAt: 8, gateW: 3, capacity: 25 });
  p.height = 4.2; p.parapet = 0.5; p.outerT = 0.8;
  const hx0 = 2, hy0 = 2 + 34; roomBlock(s, p, [hx0, hy0, hx0 + 34, hy0 + 34], [4, 6], rng, [hx0 + 6, hy0 + 6, hx0 + 28, hy0 + 28]);
  // a door from the house into the orchard on the S side of the house
  s.doors.add(s.edgeBetween(s.k(hx0 + 10, hy0), s.k(hx0 + 10, hy0 - 1)));
  const F = (kind: Fitting['kind'], u: number, v: number, size = 1, extra: Partial<Fitting> = {}) => s.fittings.push({ kind, u, v, rot: 0, size, plot: p.idx, ...extra });
  F('hearth', s.cu(hx0 + 9), s.cv(hy0 + 9)); F('oven', s.cu(hx0 + 26), s.cv(hy0 + 26)); F('well', s.cu(hx0 + 17), s.cv(hy0 + 17));
  for (let x = 0; x < 6; x++) F('jar_big', s.cu(hx0 + 7 + x), s.cv(hy0 + 27), 1);
  F('pool', s.cu(2 + 60), s.cv(2 + 35), 1, { len: 12, wid: 6, note: 'garden pool (C)' });
  for (let i = 40; i < 90; i += 6) for (let j = 4; j < 68; j += 6) if (Math.abs(i - 60) > 9 || Math.abs(j - 35) > 6) F('tree', s.cu(2 + i), s.cv(2 + j), rng.range(0.8, 1.15), { species: rng.pick(['pomegranate', 'fig', 'apple', 'pear', 'olive', 'mulberry', 'vine']) });
  for (let j = 4; j < 34; j += 6) for (const i of [4, 16, 28]) F('tree', s.cu(2 + i), s.cv(2 + j), rng.range(0.8, 1.1), { species: rng.pick(['pomegranate', 'fig', 'vine']) });
  s.recount(); return s;
}

// ---------------------------------------------------------------------------------------------------------------------
export function nearestOnPolyline(pts: P2[], q: P2) {
  let best = { d: Infinity, foot: pts[0], dir: [1, 0] as P2, seg: 0, t: 0 };
  for (let i = 0; i + 1 < pts.length; i++) { const [a, b] = [pts[i], pts[i + 1]], dx = b[0] - a[0], dy = b[1] - a[1], L2 = dx * dx + dy * dy;
    const t = Math.max(0, Math.min(1, ((q[0] - a[0]) * dx + (q[1] - a[1]) * dy) / L2)), f: P2 = [a[0] + dx * t, a[1] + dy * t], d = Math.hypot(q[0] - f[0], q[1] - f[1]);
    if (d < best.d) { const L = Math.sqrt(L2); best = { d, foot: f, dir: [dx / L, dy / L], seg: i, t }; } }
  return best;
}
export function pointInPolygon(p: P2, poly: P2[]) {
  let inside = false; for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) { const [xi, yi] = poly[i], [xj, yj] = poly[j];
    if ((yi > p[1]) !== (yj > p[1]) && p[0] < (xj - xi) * (p[1] - yi) / (yj - yi) + xi) inside = !inside; }
  return inside;
}

// ---------------------------------------------------------------------------------------------------------------------
// Tol-e Ajori: the gate frame. Plan (TOLAJORI2017 via search extract, B): 39.07 m NW-SE x 29.05 m NE-SW, "oriented
// from WNW to ESE, with a 20° shift to N from the E-W axis"; a massive wall 10.47 m thick encloses an inner room
// 8.00 x 14.36 m with low benches, reached by two corridors on the NW and SE short sides. So the passage runs along the
// long axis, at 290°/110° true. Position C (±700 m, settlement.json).
export const AJORI = { c: FEATURES.tol_ajori_gate.xy as P2, long: 39.07, short: 29.05, wall: 10.47, room: [14.36, 8.0] as [number, number], axisTrue: 110, height: 12, corridorW: 4.2 };
const ajTheta = thetaOfBearing(gridBearing(AJORI.axisTrue)); // +u toward the ESE mouth

function paradiseSite(): Site {
  // the walled garden behind (WNW of) the gate, the gate standing in its ESE wall (C); beds divided by stone channels
  // after the Pasargadae garden (B analogy), a columned pavilion at the far end on the axis (C: "column bases and
  // foundations beyond the gate", press)
  const L = 330, Wd = 260;
  const f: Frame = { c: toGrid({ c: AJORI.c, theta: ajTheta }, -L / 2, 0), theta: ajTheta };
  const s = new Site(M('paradise', 'zone_bagh_e_firuzi', 'zone_bagh_e_firuzi', 'town', 'compound', 'walled garden behind the Tol-e Ajori gate (C)'), f, L + 4, Wd + 4); openGround(s);
  const p = yardCompound(s, { kind: 'garden', id: 'paradise-0001', row: 'paradise_bagh_e_firuzi', feature: 'zone_bagh_e_firuzi', note: 'walled garden (paradise) behind the gate (C)', rect: inner(s, L, Wd), wall: 3.0, outerT: 0.9, gate: 'W', gateW: 3, capacity: 0 });
  // the gate occupies the middle of the ESE (+u) wall: cut the wall there (the gate body closes the gap)
  const gi = s.W - 3, half = Math.ceil(AJORI.short / 2);
  const inNotch = (i: number, j: number) => j >= (s.H >> 1) - half && j < (s.H >> 1) + half && i >= gi - 19 && i <= gi;
  for (let j = 0; j < s.H; j++) for (let i = 0; i < s.W; i++) if (inNotch(i, j) && s.cell[s.k(i, j)] === p.idx) s.cell[s.k(i, j)] = OUT;
  for (let j = 0; j < s.H; j++) for (let i = 0; i < s.W; i++) if (inNotch(i, j)) for (const [di, dj] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
    const ii = i + di, jj = j + dj; if (s.inb(ii, jj) && !inNotch(ii, jj) && s.cell[s.k(ii, jj)] === p.idx) s.noWall.add(s.edgeBetween(s.k(i, j), s.k(ii, jj))); }
  const rng = new Rng(TOWN_SEED, 'town:paradise');
  gardenBeds(s, p, rng, { axisV: 0, u0: -L / 2 + 30, u1: L / 2 - 24, v0: -Wd / 2 + 8, v1: Wd / 2 - 8, cross: [-L / 2 + 30, -40, 50, L / 2 - 24], row: 'paradise_bagh_e_firuzi', feature: 'zone_bagh_e_firuzi' });
  s.recount(); PAVILION.frame = { c: s.grid(-L / 2 + 14, 0), theta: f.theta }; return s;
}

function gardenBeds(s: Site, p: Plot, rng: Rng, o: { axisV: number; u0: number; u1: number; v0: number; v1: number; cross: number[]; row: string; feature: string }) {
  const F = (kind: Fitting['kind'], u: number, v: number, size = 1, extra: Partial<Fitting> = {}) => s.fittings.push({ kind, u, v, rot: 0, size, plot: p.idx, ...extra });
  F('channel', (o.u0 + o.u1) / 2, o.axisV, 1, { len: o.u1 - o.u0, wid: 0.3, rot: 0, note: 'stone-lined channel on the garden axis (Pasargadae analogy B; C here)' });
  for (const u of o.cross) F('channel', u, (o.v0 + o.v1) / 2, 1, { len: o.v1 - o.v0, wid: 0.3, rot: Math.PI / 2, note: 'cross channel (C)' });
  for (const u of o.cross.slice(1, -1)) F('pool', u, o.axisV, 1, { len: 5, wid: 5, note: 'basin where channels cross (C)' });
  // planting: cypress and plane along the axis, fruit trees in the beds (species SAEIDI2021/IR-FOODAG B, mix C)
  for (let u = o.u0 + 6; u < o.u1 - 3; u += 8) for (const sgn of [-1, 1]) F('tree', u, o.axisV + sgn * 3.2, rng.range(0.9, 1.1), { species: (Math.round(u / 8) % 3 === 0) ? 'plane' : 'cypress' });
  for (let u = o.u0 + 5; u < o.u1 - 3; u += 7) for (let v = o.v0 + 5; v < o.v1 - 4; v += 7) { if (Math.abs(v - o.axisV) < 7 || o.cross.some(c => Math.abs(u - c) < 4)) continue; if (rng.chance(0.18)) continue;
    F('tree', u + rng.range(-1, 1), v + rng.range(-1, 1), rng.range(0.75, 1.15), { species: rng.pick(['pomegranate', 'pomegranate', 'fig', 'apple', 'pear', 'olive', 'mulberry', 'plane', 'vine']) }); }
}

function areaCGardenSite(): Site {
  // Persepolis West Area C: "a grid of ditches with a fencing wall, read as a garden" (PW2017, B); position C (±600 m)
  const f = FEATURES.pw_area_c_garden; const Lx = 170, Ly = 130;
  const s = compoundSite('area_c_garden', 'pw_area_c_garden', 'zone_persepolis_west', 'town', f.xy, -3 * deg, Lx, Ly, f.note);
  const rng = new Rng(TOWN_SEED, 'town:area_c');
  const p = yardCompound(s, { kind: 'garden', id: 'area_c_garden-0001', row: 'area_c_ditch_garden', feature: 'pw_area_c_garden', note: 'Area C garden: ditch grid inside the fencing wall (B), layout C', rect: inner(s, Lx, Ly), wall: 2.4, gate: 'S', gateW: 3 });
  const sp = 12; // ditch spacing (C)
  for (let u = -Lx / 2 + sp; u < Lx / 2 - 2; u += sp) s.fittings.push({ kind: 'ditch', u, v: 0, rot: Math.PI / 2, size: 1, plot: p.idx, len: Ly - 6, wid: 0.8, note: 'ditch of the grid (PW2017, B; spacing C)' });
  for (let v = -Ly / 2 + sp; v < Ly / 2 - 2; v += sp) s.fittings.push({ kind: 'ditch', u: 0, v, rot: 0, size: 1, plot: p.idx, len: Lx - 6, wid: 0.8, note: 'ditch of the grid (PW2017, B; spacing C)' });
  for (let u = -Lx / 2 + sp / 2; u < Lx / 2 - 3; u += sp) for (let v = -Ly / 2 + sp / 2; v < Ly / 2 - 3; v += sp) { if (rng.chance(0.25)) continue;
    s.fittings.push({ kind: 'tree', u: u + rng.range(-1.5, 1.5), v: v + rng.range(-1.5, 1.5), rot: 0, size: rng.range(0.7, 1.1), plot: p.idx, species: rng.pick(['pomegranate', 'fig', 'apple', 'pear', 'olive', 'mulberry', 'vine', 'plane']) }); }
  s.recount(); return s;
}

/** the pavilion at the far (WNW) end of the garden axis, facing the gate: a columned porch (2 x 4 columns) before a
 *  roofed room (C: "column bases and foundations beyond the gate", press) */
const PAVILION: { frame: Frame | null } = { frame: null };
function pavilionProps(props: Prop[], groups: Map<string, P2[]>) {
  const f = PAVILION.frame; if (!f) return; const W = 18, D = 14, row = 'paradise_bagh_e_firuzi', feature = 'zone_bagh_e_firuzi', note = 'garden pavilion on the axis, facing the gate: columned porch before a room (C; column bases beyond the gate: press)';
  groups.set('pavilion', [[-1, -1], [1, -1], [1, 1], [-1, 1]].map(([a, b]) => toGrid(f, a * D / 2, b * W / 2)));
  const B = (u: number, v: number, hu: number, hv: number, y0: number, y1: number, mat: Mat = 'mud', collide = true, colour?: [number, number, number]) => props.push({ shape: 'box', mat, c: toGrid(f, u, v), theta: f.theta, hu, hv, y0, y1, group: 'pavilion', collide, row, feature, note, colour });
  B(-D / 2 + 0.4, 0, 0.45, W / 2, -0.4, 5.2); B(-D / 2 + 3.5, W / 2 - 0.4, 3.5, 0.45, -0.4, 5.2); B(-D / 2 + 3.5, -W / 2 + 0.4, 3.5, 0.45, -0.4, 5.2); // room walls (back and sides)
  B(-D / 2 + 7, 3.5, 0.4, W / 2 - 3.5, -0.4, 5.2); B(-D / 2 + 7, -W / 2 + 1, 0.4, 1, -0.4, 5.2); // front wall of the room with a door
  B(0, 0, D / 2 + 0.4, W / 2 + 0.4, 5.2, 5.9, 'mud', false); // flat roof
  B(0, 0, D / 2 + 0.6, W / 2 + 0.6, -0.3, 0.35, 'stone', true); // stone platform
  for (let k = 0; k < 4; k++) { const v = -W / 2 + 2.25 + k * 4.5; for (const u of [D / 2 - 0.9, 2.2]) {
    props.push({ shape: 'cyl', mat: 'stone', c: toGrid(f, u, v), theta: 0, hu: 0.55, hv: 0.55, y0: 0.3, y1: 0.7, group: 'pavilion', collide: true, row, feature, note: note + ': stone column base' });
    props.push({ shape: 'cyl', mat: 'timber', c: toGrid(f, u, v), theta: 0, hu: 0.26, hv: 0.26, y0: 0.7, y1: 5.2, group: 'pavilion', collide: true, row, feature, note: note + ': plastered timber column (C)', colour: [0.8, 0.74, 0.64] }); } }
}
// Takht-e Rustam (LIVIUS-TR: ~12.5 x 12.5 m, local stone, base for a higher structure like the lower tiers of Cyrus'
// tomb, B size): placed 18 m E of the road line (the road passes beside it; position C ±400 m). Two steps (the
// settlement.json state); step heights and set-back not retrieved (C: 1.1 m and 1.0 m); orientation C (true north).
export const TAKHT = { size: 12.5, steps: 2, stepH: 1.1, setback: 1.0 };
function takhtPos(): { c: P2; theta: number } {
  const road = FEATURES.road_naqsh_e_rustam.polyline as P2[]; const q = FEATURES.takht_e_rustam.xy as P2; const { dir } = nearestOnPolyline(road, q);
  const e: P2 = [dir[1], -dir[0]]; return { c: [q[0] + e[0] * 18, q[1] + e[1] * 18], theta: thetaOfBearing(gridBearing(0)) };
}
function gardenGoharSite(): Site {
  // Dasht-e Gohar garden E of the platform, away from the road (GONDET2009: garden complexes, B; layout C), with a
  // columned hall at its W end (a hypostyle hall "reburied behind the platform": search extract, C; size and plan C)
  const t = takhtPos(); const c: P2 = [t.c[0] + 150, t.c[1] + 4];
  const s = compoundSite('garden_gohar', 'zone_dasht_e_gohar', 'zone_dasht_e_gohar', 'plain', c, 0, 210, 150, 'Dasht-e Gohar garden (C)');
  const rng = new Rng(TOWN_SEED, 'town:gohar');
  const p = yardCompound(s, { kind: 'garden', id: 'garden_gohar-0001', row: 'garden_dasht_e_gohar', feature: 'zone_dasht_e_gohar', note: 'walled garden (C)', rect: inner(s, 210, 150), wall: 2.8, gate: 'W', gateAt: 20, gateW: 3 });
  gardenBeds(s, p, rng, { axisV: 0, u0: -60, u1: 95, v0: -67, v1: 67, cross: [-60, 15, 95], row: 'garden_dasht_e_gohar', feature: 'zone_dasht_e_gohar' });
  // the hall: 4 x 5 columns under a roof, a mud-brick back wall (props, built below)
  s.recount(); return s;
}

// ---------------------------------------------------------------------------------------------------------------------
let cache: TownPlan | null = null;
export function buildTownPlan(): TownPlan {
  if (cache) return cache;
  const sites: Site[] = [];
  for (const q of QUARTERS) sites.push(quarterSite(q));
  sites.push(officialSite(), storesSite(), stablesSite(), wayStationSite(), areaCGardenSite(), paradiseSite(), gardenGoharSite());
  const eAt: [string, P2, number][] = [['estate_1', [-2050, 1720], 15 * deg], ['estate_2', [-2700, 1850], -5 * deg], ['estate_3', [-2950, 2250], 25 * deg], ['estate_4', [-1900, 2360], -35 * deg]];
  for (const [id, c, th] of eAt) sites.push(estateSite(id, c, th));
  sites.push(...orchards());
  const props: Prop[] = [], trees: TreeSpot[] = [], water: WaterPiece[] = [], middens: Midden[] = [], groups = new Map<string, P2[]>();
  // site-local fittings that are really features of the ground (trees, water, middens) become plan entries
  for (const s of sites) for (const f of s.fittings) {
    const c = s.grid(f.u, f.v), row = f.plot >= 0 ? s.plots[f.plot].row : 'town_middens', feature = f.plot >= 0 ? s.plots[f.plot].feature : s.meta.feature;
    if (f.kind === 'tree') trees.push({ c, species: f.species ?? 'pomegranate', size: f.size, row: f.plot >= 0 ? (s.plots[f.plot].kind === 'house' || s.plots[f.plot].kind === 'house_large' ? 'town_houses' : row) : 'town_gardens_orchards', feature });
    else if (f.kind === 'channel' || f.kind === 'ditch' || f.kind === 'pool') {
      const du = Math.cos(f.rot), dv = Math.sin(f.rot), L = (f.len ?? 1) / 2;
      const a = s.grid(f.u - du * L, f.v - dv * L), b = s.grid(f.u + du * L, f.v + dv * L);
      water.push({ kind: f.kind === 'channel' ? 'channel' : f.kind === 'ditch' ? 'ditch' : 'pool', pts: [a, b], width: f.kind === 'pool' ? (f.wid ?? 4) : (f.wid ?? 0.3), level: f.kind === 'ditch' ? -0.1 : 0.12, row, feature, note: f.note });
    } else if (f.kind === 'midden') middens.push({ c, r: 3.5 * f.size, h: 0.9 * f.size, kind: 'midden', row: 'town_middens', feature });
    else if (f.kind === 'pen_dung') middens.push({ c, r: Math.max(2, f.size), h: 0.08, kind: 'dung', row: 'town_pens', feature });
    else if (f.kind === 'pit') middens.push({ c, r: 1.1, h: 0.25, kind: 'bone', row, feature });
  }
  // town-edge middens (C): a few per quarter, just outside house backs
  for (const s of sites) if (s.meta.kind === 'quarter') {
    const rng = new Rng(TOWN_SEED, 'middens:' + s.id); const n = Math.max(2, Math.round(s.W * s.H / 12000));
    for (let x = 0; x < n * 20 && middens.filter(m => m.feature === s.meta.feature && (m as any).site === s.id).length < n; x++) {
      const i = rng.int(2, s.W - 3), j = rng.int(2, s.H - 3); if (s.cell[s.k(i, j)] !== OUT) continue;
      let near = 0; for (let dj = -4; dj <= 4; dj++) for (let di = -4; di <= 4; di++) if (s.at(i + di, j + dj) >= 0) near++;
      if (near < 6 || near > 30) continue;
      const m: any = { c: s.cellGrid(s.k(i, j)), r: rng.range(2.5, 4.5), h: rng.range(0.5, 1.1), kind: 'midden', row: 'town_middens', feature: s.meta.feature, site: s.id }; middens.push(m);
    }
  }
  // Tol-e Ajori and Takht-e Rustam are built by their own modules from AJORI/TAKHT; the hall at Dasht-e Gohar here
  const t = takhtPos(); const gt = t.theta;
  for (let st = 0; st < TAKHT.steps; st++) { const h = TAKHT.size / 2 - st * TAKHT.setback;
    props.push({ shape: 'box', mat: 'stone', c: t.c, theta: gt, hu: h, hv: h, y0: st === 0 ? -0.6 : st * TAKHT.stepH, y1: (st + 1) * TAKHT.stepH, group: 'takht', collide: true, row: 'takht_steps', feature: 'takht_e_rustam', note: `Takht-e Rustam step ${st + 1}: 12.5 x 12.5 m base (LIVIUS-TR, B); step height and set-back not retrieved (C); unfinished` }); }
  groups.set('takht', [[-1, -1], [1, -1], [1, 1], [-1, 1]].map(([a, b]) => toGrid({ c: t.c, theta: gt }, a * TAKHT.size / 2, b * TAKHT.size / 2)));
  const gs = sites.find(s => s.id === 'garden_gohar')!; const hallC = gs.grid(-85, 0); const hf: Frame = { c: hallC, theta: gs.frame.theta };
  const hallW = 24, hallD = 30; groups.set('hall_gohar', [[-1, -1], [1, -1], [1, 1], [-1, 1]].map(([a, b]) => toGrid(hf, a * hallW / 2, b * hallD / 2)));
  const HN = 'columned hall behind Takht-e Rustam ("hypostyle hall reburied behind the platform": search extract, C); size, plan and column form C';
  for (let a = 0; a < 4; a++) for (let b = 0; b < 5; b++) { const [u, v] = [-hallW / 2 + 3 + a * 6, -hallD / 2 + 3 + b * 6];
    props.push({ shape: 'cyl', mat: 'stone', c: toGrid(hf, u, v), theta: 0, hu: 0.75, hv: 0.75, y0: -0.2, y1: 0.45, group: 'hall_gohar', collide: true, row: 'hall_dasht_e_gohar', feature: 'zone_dasht_e_gohar', note: HN + ': stone column base' });
    props.push({ shape: 'cyl', mat: 'timber', c: toGrid(hf, u, v), theta: 0, hu: 0.34, hv: 0.34, y0: 0.45, y1: 6.2, group: 'hall_gohar', collide: true, row: 'hall_dasht_e_gohar', feature: 'zone_dasht_e_gohar', note: HN + ': plastered timber column (C)', colour: [0.78, 0.72, 0.62] }); }
  props.push({ shape: 'box', mat: 'mud', c: toGrid(hf, -hallW / 2 - 0.5, 0), theta: hf.theta, hu: 0.5, hv: hallD / 2 + 1, y0: -0.4, y1: 6.9, group: 'hall_gohar', collide: true, row: 'hall_dasht_e_gohar', feature: 'zone_dasht_e_gohar', note: HN + ': back wall' });
  props.push({ shape: 'box', mat: 'mud', c: toGrid(hf, 0, 0), theta: hf.theta, hu: hallW / 2 + 1, hv: hallD / 2 + 1, y0: 6.2, y1: 6.9, group: 'hall_gohar', collide: false, row: 'hall_dasht_e_gohar', feature: 'zone_dasht_e_gohar', note: HN + ': flat roof on timber beams' });
  pavilionProps(props, groups);
  // roads (settlement.json) and the spur to the Tol-e Ajori gate (C)
  const roads: Road[] = SETTLEMENT.features.filter((f: any) => f.kind === 'road' && f.present_467).map((f: any) => ({ id: f.id, feature: f.id, row: f.id, pts: f.polyline, width: f.width_m ?? 7, note: f.note }));
  const mouth = toGrid({ c: AJORI.c, theta: ajTheta }, AJORI.long / 2, 0), pout = toGrid({ c: AJORI.c, theta: ajTheta }, AJORI.long / 2 + 80, 0);
  const rv = (FEATURES.road_royal_west.polyline as P2[])[2];
  roads.push({ id: 'road_spur_ajori', feature: 'zone_bagh_e_firuzi', row: 'road_spur_ajori', pts: [rv, pout, mouth], width: 6, note: 'spur from the royal road to the ESE mouth of the Tol-e Ajori gate (C)' });
  // the Kuh-e Rahmat canal (settlement.json; width 2 m, depth 0.8 m, C)
  const cf = FEATURES.canal_kuh_e_rahmat; water.push({ kind: 'canal', pts: cf.polyline, width: cf.width_m, level: 0.1, row: 'canal_kuh_e_rahmat', feature: 'canal_kuh_e_rahmat', note: cf.note });
  // wells in the sites
  for (const s of sites) for (const f of s.fittings) if (f.kind === 'well') water.push({ kind: 'well', pts: [s.grid(f.u, f.v)], width: 0.9, level: -1.4, row: 'town_wells', feature: f.plot >= 0 ? s.plots[f.plot].feature : s.meta.feature });
  cache = { sites, props, trees, water, roads, middens, groups, gate: { c: AJORI.c, theta: ajTheta } };
  return cache;
}

/** walled orchards among the town blocks (SELOPERSE: a garden city of blocks among gardens, orchards and fields, B;
 *  places and plantings C) */
function orchards(): Site[] {
  const defs: [string, P2, number, number, number][] = [
    ['orchard_1', [-660, -800], 110, 80, -20], ['orchard_2', [-1000, -1250], 120, 90, 6], ['orchard_3', [-1400, -1080], 100, 120, 10], ['orchard_4', [-800, 115], 120, 90, 2],
    ['orchard_5', [-1300, 725], 110, 100, -4], ['orchard_6', [-360, 540], 80, 70, 0], ['orchard_7', [-1180, -300], 100, 110, 12], ['orchard_8', [-370, -1250], 100, 120, -25],
  ];
  return defs.map(([id, c, W, H, th]) => {
    const inTown = pointInPolygon(c, FEATURES.zone_lower_town_south.polygon) ? 'zone_lower_town_south' : 'zone_persepolis_west';
    const s = compoundSite(id, inTown, inTown, 'town', c, th * deg, W, H, 'walled orchard (C)'); const rng = new Rng(TOWN_SEED, 'town:' + id);
    const p = yardCompound(s, { kind: 'garden', id: `${id}-0001`, row: 'town_gardens_orchards', feature: inTown, note: 'walled orchard (C)', rect: inner(s, W, H), wall: 2.2, gate: rng.pick(['S', 'N', 'W', 'E']), gateW: 2 });
    const sp = rng.range(6, 8), sp2 = rng.range(6, 8), spec = rng.pick(['pomegranate', 'fig', 'apple', 'pear', 'olive', 'mulberry', 'vine']), spec2 = rng.pick(['pomegranate', 'fig', 'apple', 'pear', 'olive', 'mulberry', 'vine']);
    for (let u = -W / 2 + 4; u < W / 2 - 3; u += sp) for (let v = -H / 2 + 4; v < H / 2 - 3; v += sp2) if (!rng.chance(0.08)) s.fittings.push({ kind: 'tree', u, v, rot: 0, size: rng.range(0.8, 1.1), plot: p.idx, species: u < 0 ? spec : spec2 });
    s.fittings.push({ kind: 'ditch', u: 0, v: -H / 2 + 3, rot: 0, size: 1, plot: p.idx, len: W - 6, wid: 0.6, note: 'irrigation ditch (C)' });
    s.recount(); return s;
  });
}

/** every plot as a house-plot row for the population simulation */
export interface TownPlotRow { id: string; site: string; zone: string; pop_zone: 'town' | 'plain'; kind: string; craft?: string; c: [number, number]; door: [number, number] | null; door_in: [number, number] | null; area_m2: number; roofed_m2: number; capacity: number; tier: 'C'; row: string }
export function plotRows(plan = buildTownPlan()): TownPlotRow[] {
  const out: TownPlotRow[] = []; const r1 = (x: number) => Math.round(x * 10) / 10;
  for (const s of plan.sites) for (const p of s.plots) {
    const [i0, j0, i1, j1] = p.rect; const c = s.grid((s.cu(i0) + s.cu(i1 - 1)) / 2, (s.cv(j0) + s.cv(j1 - 1)) / 2); const d = s.doorPoints(p);
    out.push({ id: p.id, site: s.id, zone: s.meta.zone, pop_zone: s.meta.popZone, kind: p.kind, ...(p.craft ? { craft: p.craft } : {}), c: [r1(c[0]), r1(c[1])],
      door: d ? (s.grid(...d.out).map(r1) as [number, number]) : null, door_in: d ? (s.grid(...d.inside).map(r1) as [number, number]) : null,
      area_m2: p.area, roofed_m2: p.roofed, capacity: p.capacity, tier: 'C', row: p.row });
  }
  return out;
}
export { OUT, LANE, FREE, RES, ROOM, COURT, YARD };
