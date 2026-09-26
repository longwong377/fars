// Coverage sampler (D-233, D-235): viewpoints over every place the player can walk, stratified by area, for the coverage
// harness (tests/e2e/coverage.spec.ts renders them; tools/dev/coverage_report.ts aggregates the results).
//
// Where the player can walk, and how each area is read (all node-side, from the same data the world is built from):
//  - terrace / approach: the walkable grid (public/generated/nav.i16, the people's and the camera rig's floor). A cell is
//    classed by the Terrace parts (src/arch/terrace.ts): a stair or landing part → terrace:stairs; inside a building's
//    platform/floor polygon → terrace:<building>:roofed (under one of its roof parts) or :open (its courts, porticoes
//    without roof, platform tops); inside the Terrace outline otherwise → terrace:open; W of the Terrace → approach;
//    E of it (the grid reaches the mountain's foot) → rahmat:foot. Rooftops are NOT walkable in the build (the grid is
//    flood-filled from the ground seeds and no stair reaches a roof), so none are sampled (Q-630).
//  - town: every site raster of the town plan (src/world/settlement/plan.ts), cells reachable from the site's edge through
//    the plan's own move rules (walk.ts siteMoves: doors, walls): lanes and squares, open ground inside a quarter's frame,
//    courts and yards, rooms, the Area B craft yard (plot pw_area_b-yard), and the compounds (gardens, the paradise,
//    orchards, estates, the official complex, stores, stables, the waystation).
//  - plain (within walking reach: REACH m of the Apadana, which takes in Naqsh-e Rustam at 6.1 km and the Pulvar at 3.4 km):
//    the present roads of settlement.json and the village tracks; the villages placed by rule (lanes between compounds and
//    the compounds' courts); the irrigated fields (plain.json field_zone polygons); the Pulvar's banks; the ground in front
//    of the Naqsh-e Rustam cliff; open ground (steppe, rain-fed fields) elsewhere in reach. A point must lie on terrain
//    the player's controller can climb (slope under MAX_SLOPE; the controller's limit is 42°) and off the river channel.
//  - rahmat: Kuh-e Rahmat's lower slopes E and S of the Terrace (3-250 m above the court datum, slope under MAX_SLOPE,
//    within 1.6 km), plus the mountain-foot cells of the walkable grid.
//  - far: the player can walk the whole far terrain ring (±71.7 km; nothing stops a walker), so the world beyond REACH is
//    sampled too: the Kur's banks, the villages beyond 7 km, the irrigated fields of both rivers, open ground, the two
//    quarries (Sivand, Majdabad); and the EDGES of built content, a pair of points just inside and just outside each:
//    the near terrain ring (4 m cells to ±2,048 m), the mid ring (16 m cells to ±10,240 m), the field patchwork
//    (fields.ts ZONE, ±40,960 m) and the far ring's end (±71,680 m; inside only). BUILT_EDGES lists them.
//
// Weights (write them down: D-235). ~450 base points: terrace 150, town 120, plain 85, far 47, approach 25, rahmat 20. Why: the
// Terrace is the place the world exists for and has the densest detail and the most distinct rooms per square metre;
// the town is where most of the lives are and is the largest placeholder (the brief's "town houses first"); the plain is
// by far the largest area (~150 km² in reach) but its views change slowly with position (a field looks like the next
// field), so it gets fewer points per km² with sub-strata for each kind of place; the approach and the mountain are
// small or visited less. Inside an area, strata get points in proportion to sqrt(walkable area) (min 3 per stratum), so
// small rooms are not starved and big open grounds do not swamp the sample. Times (tools/dev/coverage_time.ts, MASTER_PLAN
// axis B, D-242): each view gets a month, an hour band and a weather state (every month, band and state at least once per
// area; weather by the climate's frequency; world-level pairs completed), realised as a real day and hour of the simulated
// year where that happens (weather 'auto'), forced through the override only where the climate never makes it.
// The seed is not chosen: it is the first 8 hex digits of a commit hash (MASTER_PLAN §4.2), recorded in the file's meta.
// Revisits: REVISIT_SHARE of every area's places are rendered a second time at a contrasting state (another season and
// another hour or weather), so no place is judged at one moment only. Variety: VARIETY_PLACES populated places are
// rendered at the same hour on VARIETY_DAYS (D-236: the same place at the same hour on different days must differ).
// Headings: 60 % point down one of the three most open directions (the longest free run on the walkable grid or site
// raster; on the plain towards the Terrace or the monument), 40 % uniformly random. Eye 1.6 m. Deterministic by seed.
// The camera is the player's: the spec renders at the player's field of view (70°) with no rig clearance for people.
//
// Usage: npx tsx tools/dev/coverage_points.ts [--commit <sha> (default: git rev-parse HEAD)] [out=tests/data/coverage_points.json]
import { readFileSync, writeFileSync } from 'node:fs';
import { buildTerrace } from '../../src/arch/terrace';
import { pointInPoly, type Part, type Pt } from '../../src/arch/parts';
import { NAV } from '../../src/people/navgrid';
import { Rng } from '../../src/core/rng';
import { Ring, Terrain, type TerrainMeta } from '../../src/terrain/heightfield';
import { parseRivers, settlementZones, settlementRoads, pointInPolygon, feature, PLAIN } from '../../src/world/plain/data';
import { buildCanals } from '../../src/world/plain/canals';
import { placeVillages, villageCompounds, type Village, type Compound } from '../../src/world/plain/villages';
import { trackLines } from '../../src/world/plain/ribbons';
import { buildTownPlan, type TownPlan } from '../../src/world/settlement/plan';
import { Site, LANE, SQUARE, OUT, ROOM, COURT, YARD } from '../../src/world/settlement/site';
import { siteMoves } from '../../src/world/settlement/walk';
import { execFileSync } from 'node:child_process';
import { assignArea, realise, climate, pairCoverage, areaHits, HOUR_BANDS, WEATHERS, FORCE_MONTHS, type Band, type Weather } from './coverage_time';

export const EYE = 1.6;
export const REACH = 7000; // m from the grid origin (the Apadana)
export const MAX_SLOPE = 35; // deg (the controller climbs 42°; 35° keeps points off the edge of what is walkable)
export const AREA_WEIGHTS = { terrace: 150, town: 120, plain: 85, far: 47, approach: 25, rahmat: 20 } as const;
export type Area = keyof typeof AREA_WEIGHTS;
/** town sub-strata (fixed shares of the town's 120) */
export const TOWN_WEIGHTS = { 'town:lanes': 45, 'town:open': 10, 'town:courts': 30, 'town:rooms': 12, 'town:areab': 5, 'town:compounds': 18 } as const;
/** plain sub-strata (fixed shares of the plain's 85) */
export const PLAIN_WEIGHTS = { 'plain:roads': 15, 'plain:villages': 15, 'plain:fields': 20, 'plain:river': 12, 'plain:naqsh': 13, 'plain:open': 10 } as const;
/** the world beyond walking reach, sub-strata (fixed shares of far's 47; the edges are pairs in/out, see BUILT_EDGES) */
export const FAR_WEIGHTS = { 'far:kur': 8, 'far:villages': 8, 'far:fields': 8, 'far:open': 6, 'far:quarries': 3 } as const;
/** edges of built content (m from the grid origin, square rings on grid axes): points just inside and just outside */
export const BUILT_EDGES = [
  { id: 'near-ring', half: 2048, what: 'terrain near ring (4 m cells) ends; mid ring (16 m) beyond', n: 4 },
  { id: 'mid-ring', half: 10240, what: 'terrain mid ring (16 m cells) ends; far ring (80 m) beyond', n: 4 },
  { id: 'fields', half: 40960, what: 'the field patchwork (fields.ts ZONE) ends', n: 4 },
  { id: 'world-end', half: 71680, what: 'the far terrain ring ends (the collider and the drawn ground)', n: 2 },
] as const;
export const EDGE_OFFSET = 300; // m inside / outside the edge
export const REVISIT_SHARE = 0.15;
export const VARIETY_DAYS = [25, 26, 33] as const, VARIETY_HOUR = 10, VARIETY_PLACES = 5;
/** the seed of a sample: the first 8 hex digits of a commit hash (never a chosen number; MASTER_PLAN §4.2) */
export const seedOf = (commit: string) => { if (!/^[0-9a-f]{8}/.test(commit)) throw new Error(`coverage: not a commit hash: ${commit}`); return parseInt(commit.slice(0, 8), 16); };

export interface CovPoint {
  id: string; area: Area; sub: string; e: number; n: number; eye: number;
  /** off the walkable grid: the camera's floor is found by a ray cast down from this many metres above the terrain
   *  (below a room's roof in the town; __parsa.view's `cast`), null = the walkable grid's floor */
  cast: number | null;
  az: number; /** true azimuth, deg */ pitch: number; headingWhy: 'open' | 'random' | 'subject'; openM: number;
  /** month (Julian, 1-12), hour band and weather state; `state` = band/weather; day index and local hour where they happen;
   *  w = the weather override ('auto' = the climate's own state; else forced) */
  month: number; band: Band; weather: Weather; state: string; day: number; hour: number; w: string; forced: boolean; sunAlt: number; moonAlt: number; moonFrac: number;
  /** the place (position + heading) this view shows; a revisit shares its place with the first visit */
  place: string; revisit?: boolean;
}
export interface VarietyPlace { place: string; area: Area; sub: string; e: number; n: number; eye: number; cast: number | null; az: number; pitch: number; days: number[]; hour: number; w: string }
export interface CovFile { meta: { seed: number; commit: string | null; total: number; reach: number; weights: any; edges: typeof BUILT_EDGES; strata: Record<string, { area: number; n: number }>; time: any; interimAreas: string; notes: string[] }; points: CovPoint[]; variety: VarietyPlace[]; extras: CovPoint[] }

type P2 = [number, number];
const deg = Math.PI / 180;
/** grid bearing (deg clockwise from grid north) → true azimuth (grid north is true 341°, D-002) */
export const trueAz = (gridBearing: number) => (((gridBearing + 341) % 360) + 360) % 360;
const bearingOf = (de: number, dn: number) => ((Math.atan2(de, dn) / deg) + 360) % 360;
const r1 = (x: number) => Math.round(x * 10) / 10 || 0, r2 = (x: number) => Math.round(x * 100) / 100 || 0; // || 0: no −0 (JSON drops the sign)

// ---------------------------------------------------------------------------------------------------------------------
// world data (node-side)
export interface World {
  nav: Int16Array; terrain: Terrain; parts: Part[]; terracePoly: Pt[]; plan: TownPlan; villages: Village[]; farVillages: Village[]; compounds: Map<string, Compound[]>;
  rivers: ReturnType<typeof parseRivers>['rivers']; zones: P2[][]; tracks: P2[][];
}
let WORLD: World | null = null;
export function loadWorld(): World {
  if (WORLD) return WORLD;
  const meta: TerrainMeta = JSON.parse(readFileSync('public/generated/terrain.json', 'utf8'));
  const ring = (k: 'near' | 'mid' | 'far') => new Ring(meta.rings[k], new Uint16Array(readFileSync(`public/${meta.rings[k].file}`).buffer.slice(0) as ArrayBuffer), meta.court_asl);
  const terrain = new Terrain(meta, ring('near'), ring('mid'), ring('far'));
  const rivers = parseRivers(JSON.parse(readFileSync('public/generated/rivers.json', 'utf8'))).rivers;
  const canals = buildCanals(terrain, rivers);
  const all = placeVillages(terrain, rivers, canals), villages = all.filter(v => Math.hypot(v.x, v.y) < REACH + v.r), farVillages = all.filter(v => !villages.includes(v));
  const compounds = new Map(all.map(v => [v.id, villageCompounds(v, terrain)] as [string, Compound[]]));
  const parts = buildTerrace().parts;
  const tp = parts.find(p => p.building === 'terrace' && p.kind === 'platform') as any;
  const nav = new Int16Array(readFileSync('public/generated/nav.i16').buffer.slice(0) as ArrayBuffer);
  WORLD = { nav, terrain, parts, terracePoly: tp.polygon, plan: buildTownPlan(), villages, farVillages, compounds, rivers, zones: settlementZones(), tracks: trackLines(villages) };
  return WORLD;
}

const navOk = (W: World, i: number, j: number) => i >= 0 && j >= 0 && i < NAV.w && j < NAV.h && W.nav[j * NAV.w + i] !== NAV.blocked;
const navIJ = (e: number, n: number): P2 => [Math.floor((e - NAV.e0) / NAV.cell), Math.floor((n - NAV.n0) / NAV.cell)];
export const onNav = (W: World, e: number, n: number) => { const [i, j] = navIJ(e, n); return navOk(W, i, j); };
const inNavBox = (e: number, n: number) => e > NAV.e0 && e < NAV.e0 + NAV.w * NAV.cell && n > NAV.n0 && n < NAV.n0 + NAV.h * NAV.cell;
/** terrain slope (deg) at grid (e, n), over ±4 m */
export function slopeDeg(W: World, e: number, n: number, d = 4) {
  const h = (x: number, y: number) => W.terrain.heightAt(x, -y);
  return Math.atan(Math.hypot(h(e + d, n) - h(e - d, n), h(e, n + d) - h(e, n - d)) / (2 * d)) / deg;
}
/** the height above the court datum (true asl − 1625 m) */
const above = (W: World, e: number, n: number) => W.terrain.aslAt(e, -n) - W.terrain.meta.court_asl;

// oriented box containment (Terrace parts)
function inBox(p: any, e: number, n: number, margin = 0) {
  const r = -(p.rot ?? 0), c = Math.cos(r), s = Math.sin(r), de = e - p.c[0], dn = n - p.c[1];
  const u = de * c - dn * s, v = de * s + dn * c; return Math.abs(u) <= p.size[0] / 2 + margin && Math.abs(v) <= p.size[1] / 2 + margin;
}
const inPart = (p: any, e: number, n: number) => p.type === 'prism' ? pointInPoly(e, n, p.polygon) : p.type === 'box' ? inBox(p, e, n) : false;

/** the Terrace parts that class a cell (stairs, landings, platforms and floors, roofs), bucketed on an 8 m grid */
const BUCKET = 8;
let PIDX: { W: World; b: Map<string, any[]>; west: number } | null = null;
function partIndex(W: World) {
  if (PIDX && PIDX.W === W) return PIDX;
  const b = new Map<string, any[]>();
  const keep = (p: any) => p.kind === 'step' || p.kind === 'landing' || p.building === 'grand_stair' || p.kind === 'roof' || (p.building !== 'terrace' && ['platform', 'floor', 'portico_floor'].includes(p.kind));
  for (const p of W.parts as any[]) { if (!keep(p) || (p.type !== 'box' && p.type !== 'prism')) continue;
    let x0: number, y0: number, x1: number, y1: number;
    if (p.type === 'prism') { x0 = Math.min(...p.polygon.map((q: Pt) => q[0])); x1 = Math.max(...p.polygon.map((q: Pt) => q[0])); y0 = Math.min(...p.polygon.map((q: Pt) => q[1])); y1 = Math.max(...p.polygon.map((q: Pt) => q[1])); }
    else { const r = Math.hypot(p.size[0], p.size[1]) / 2 + 0.6; x0 = p.c[0] - r; x1 = p.c[0] + r; y0 = p.c[1] - r; y1 = p.c[1] + r; }
    for (let i = Math.floor(x0 / BUCKET); i <= Math.floor(x1 / BUCKET); i++) for (let j = Math.floor(y0 / BUCKET); j <= Math.floor(y1 / BUCKET); j++) { const k = `${i},${j}`; let a = b.get(k); if (!a) b.set(k, a = []); a.push(p); } }
  PIDX = { W, b, west: W.terracePoly.reduce((a, q) => Math.min(a, q[0]), Infinity) }; return PIDX;
}
/** the stratum of a walkable-grid cell */
export function navStratum(W: World, e: number, n: number): { area: Area; sub: string } {
  const I = partIndex(W), P = I.b.get(`${Math.floor(e / BUCKET)},${Math.floor(n / BUCKET)}`) ?? [];
  if (P.some(p => (p.kind === 'step' || p.kind === 'landing') && p.type === 'box' && inBox(p, e, n, 0.1))) return { area: 'terrace', sub: 'terrace:stairs' };
  if (P.some(p => p.building === 'grand_stair' && p.type === 'box' && inBox(p, e, n, 0.5))) return { area: 'terrace', sub: 'terrace:stairs' };
  for (const p of P) {
    if (p.building === 'terrace' || p.building === 'grand_stair') continue;
    if (!['platform', 'floor', 'portico_floor'].includes(p.kind) || !inPart(p, e, n)) continue;
    const roofed = P.some(q => q.building === p.building && q.kind === 'roof' && q.type === 'box' && inBox(q, e, n));
    return { area: 'terrace', sub: `terrace:${p.building}:${roofed ? 'roofed' : 'open'}` };
  }
  if (pointInPoly(e, n, W.terracePoly)) return { area: 'terrace', sub: 'terrace:open' };
  return e < I.west ? { area: 'approach', sub: 'approach' } : { area: 'rahmat', sub: 'rahmat:foot' };
}
/** free run (m) along a grid bearing on the walkable grid */
function navRun(W: World, e: number, n: number, b: number, max = 80) {
  const de = Math.sin(b * deg), dn = Math.cos(b * deg); let [pi, pj] = navIJ(e, n);
  for (let d = 0.5; d <= max; d += 0.5) { const [i, j] = navIJ(e + de * d, n + dn * d); if (i === pi && j === pj) continue;
    if (!navOk(W, i, j)) return d; const hp = W.nav[pj * NAV.w + pi], h = W.nav[j * NAV.w + i]; if (Math.abs(h - hp) > 100) return d; pi = i; pj = j; }
  return max;
}

// town: reachable cells of every site
export interface TownCell { site: Site; k: number; sub: string }
export function townCells(W: World): Map<string, TownCell[]> {
  const out = new Map<string, TownCell[]>(Object.keys(TOWN_WEIGHTS).map(k => [k, []]));
  for (const s of W.plan.sites) {
    const m = siteMoves(s), seen = new Uint8Array(s.W * s.H), q: number[] = [];
    // seeds: open cells on the raster's edge (the plain around the site)
    for (let i = 0; i < s.W; i++) for (const j of [0, s.H - 1]) { const k = s.k(i, j); if (Site.open(s.cell[k]) && !seen[k]) { seen[k] = 1; q.push(k); } }
    for (let j = 0; j < s.H; j++) for (const i of [0, s.W - 1]) { const k = s.k(i, j); if (Site.open(s.cell[k]) && !seen[k]) { seen[k] = 1; q.push(k); } }
    while (q.length) { const k = q.pop()!, i = k % s.W, j = (k / s.W) | 0;
      const nb: [number, boolean][] = [[k + 1, i + 1 < s.W && (m[k] & 1) !== 0], [k - 1, i > 0 && (m[k - 1] & 1) !== 0], [k + s.W, j + 1 < s.H && (m[k] & 2) !== 0], [k - s.W, j > 0 && (m[k - s.W] & 2) !== 0]];
      for (const [k2, ok] of nb) if (ok && !seen[k2]) { seen[k2] = 1; q.push(k2); } }
    const areaB = s.plots.find(p => p.id === 'pw_area_b-yard')?.idx ?? -1;
    for (let k = 0; k < s.cell.length; k++) { if (!seen[k]) continue; const c = s.cell[k];
      const i = k % s.W, j = (k / s.W) | 0; if (i < 2 || j < 2 || i >= s.W - 2 || j >= s.H - 2) continue; // the raster's rim is the plain's
      let sub: string;
      if (c === LANE || c === SQUARE) sub = 'town:lanes';
      else if (c === OUT) { if (s.meta.kind !== 'quarter') continue; sub = 'town:open'; } // a compound's surrounding open ground is the plain's
      else if (c < 0) continue;
      else if (c === areaB) sub = 'town:areab';
      else if (s.meta.kind === 'compound') sub = 'town:compounds';
      else if (s.sub[k] === ROOM) sub = 'town:rooms';
      else if (s.sub[k] === COURT || s.sub[k] === YARD) sub = 'town:courts';
      else continue;
      out.get(sub)!.push({ site: s, k, sub }); }
  }
  return out;
}
/** free run (m) along a grid bearing inside one site: until the cell's class (open ground / one plot's court, yard or
 *  one room) changes */
function townRun(s: Site, k0: number, b: number, max = 80) {
  const cls = (k: number) => { const c = s.cell[k]; return c < 0 ? (Site.open(c) ? 'o' : 'x') : s.sub[k] === ROOM ? `r${s.room[k]}` : `p${c}.${s.sub[k]}`; };
  const c0 = cls(k0), [u0, v0] = [s.cu(k0 % s.W), s.cv((k0 / s.W) | 0)], th = s.frame.theta;
  // grid bearing b → local (u, v) direction: grid dir (sin b, cos b) rotated by −theta
  const ge = Math.sin(b * deg), gn = Math.cos(b * deg), du = ge * Math.cos(th) + gn * Math.sin(th), dv = -ge * Math.sin(th) + gn * Math.cos(th);
  for (let d = 0.5; d <= max; d += 0.5) { const i = s.ci(u0 + du * d), j = s.cj(v0 + dv * d); if (!s.inb(i, j) || cls(s.k(i, j)) !== c0) return d; }
  return max;
}

// ---------------------------------------------------------------------------------------------------------------------
/** points per stratum ∝ area^power (sqrt by default) with a minimum each, summing exactly to `total` (largest remainder) */
export function allocate(total: number, areas: Record<string, number>, min = 3, power = 0.5): Record<string, number> {
  const keys = Object.keys(areas).filter(k => areas[k] > 0); if (!keys.length) return {};
  const w = keys.map(k => areas[k] ** power), W = w.reduce((a, b) => a + b, 0);
  const free = Math.max(0, total - min * keys.length), raw = w.map(x => min + (free * x) / W);
  const out = raw.map(Math.floor); let left = total - out.reduce((a, b) => a + b, 0);
  const order = raw.map((x, i) => [x - Math.floor(x), i] as [number, number]).sort((a, b) => b[0] - a[0] || a[1] - b[1]);
  for (let q = 0; left > 0; q++, left--) out[order[q % order.length][1]]++;
  return Object.fromEntries(keys.map((k, i) => [k, out[i]]));
}
/** draw n points from a candidate generator with a minimum spacing (Poisson-disc by rejection; relaxes if it must) */
function spread(rng: Rng, n: number, gen: () => P2 | null, minD: number, tries = 60): P2[] {
  const out: P2[] = []; let d = minD;
  for (let t = 0; out.length < n && t < n * tries * 4; t++) {
    if (t > 0 && t % (n * tries) === 0) d *= 0.6;
    const p = gen(); if (!p) continue; if (out.some(q => Math.hypot(q[0] - p[0], q[1] - p[1]) < d)) continue; out.push(p);
  }
  return out;
}
const pickHeading = (rng: Rng, run: (b: number) => number) => {
  const cands = Array.from({ length: 16 }, (_, i) => { const b = i * 22.5 + rng.range(-5, 5); return { b, r: run(b) }; }).sort((a, b) => b.r - a.r);
  if (rng.chance(0.6)) { const c = cands[rng.int(0, 2)]; return { b: c.b, why: 'open' as const, open: c.r }; }
  const b = rng.range(0, 360); return { b, why: 'random' as const, open: run(b) };
};

export function samplePoints(seed = 1, commit: string | null = null): CovFile {
  const W = loadWorld(), rng = (name: string) => new Rng(seed, 'coverage:' + name);
  const pts: Omit<CovPoint, 'id' | 'month' | 'band' | 'weather' | 'state' | 'day' | 'hour' | 'w' | 'forced' | 'sunAlt' | 'moonAlt' | 'moonFrac' | 'place'>[] = [];
  const strata: Record<string, { area: number; n: number }> = {};
  const add = (area: Area, sub: string, e: number, n: number, cast: number | null, h: { b: number; why: CovPoint['headingWhy']; open: number }, pitch: number) =>
    pts.push({ area, sub, e: r2(e), n: r2(n), eye: EYE, cast, az: r1(trueAz(h.b)), pitch: r1(pitch), headingWhy: h.why, openM: r1(h.open) });

  // --- the walkable grid: terrace, approach, the mountain's foot
  const navCells = new Map<string, number[]>();
  for (let j = 0; j < NAV.h; j++) for (let i = 0; i < NAV.w; i++) { if (!navOk(W, i, j)) continue;
    const e = NAV.e0 + (i + 0.5) * NAV.cell, n = NAV.n0 + (j + 0.5) * NAV.cell, s = navStratum(W, e, n);
    const key = `${s.area}|${s.sub}`; let a = navCells.get(key); if (!a) navCells.set(key, a = []); a.push(j * NAV.w + i); }
  const cellM2 = NAV.cell * NAV.cell;
  const terrAreas: Record<string, number> = {};
  for (const [key, cells] of navCells) if (key.startsWith('terrace|')) terrAreas[key.slice(8)] = cells.length * cellM2;
  const navAlloc: Record<string, number> = { ...allocate(AREA_WEIGHTS.terrace, terrAreas, 3), approach: AREA_WEIGHTS.approach };
  const navFoot = navCells.get('rahmat|rahmat:foot')?.length ?? 0;
  const rahmatFoot = navFoot > 0 ? Math.min(4, Math.max(1, Math.round((AREA_WEIGHTS.rahmat * navFoot * cellM2) / 4e5))) : 0;
  if (rahmatFoot) navAlloc['rahmat:foot'] = rahmatFoot;
  for (const [key, cells] of [...navCells].sort((a, b) => a[0].localeCompare(b[0]))) {
    const [area, sub] = key.split('|') as [Area, string]; const want = navAlloc[sub] ?? 0; if (!want) continue;
    const R = rng(sub), m2 = cells.length * cellM2; strata[sub] = { area: Math.round(m2), n: want };
    const got = spread(R, want, () => { const k = cells[R.int(0, cells.length - 1)], i = k % NAV.w, j = (k / NAV.w) | 0;
      return [NAV.e0 + (i + R.range(0.2, 0.8)) * NAV.cell, NAV.n0 + (j + R.range(0.2, 0.8)) * NAV.cell]; }, 0.5 * Math.sqrt(m2 / want));
    for (const [e, n] of got) { const roofed = sub.endsWith(':roofed');
      add(area, sub, e, n, null, pickHeading(R, b => navRun(W, e, n, b)), roofed ? R.range(-2, 5) : R.range(-4, 3)); }
  }

  // --- the town
  const tc = townCells(W);
  for (const [sub, want] of Object.entries(TOWN_WEIGHTS)) {
    const cells = tc.get(sub)!; if (!cells.length) throw new Error(`coverage: no town cells for ${sub}`);
    const R = rng(sub); strata[sub] = { area: cells.length, n: want };
    const byCell = new Map<string, TownCell>();
    const got = spread(R, want, () => { const c = cells[R.int(0, cells.length - 1)]; const g = c.site.cellGrid(c.k); byCell.set(`${g[0]},${g[1]}`, c); return g; }, 0.5 * Math.sqrt(cells.length / want));
    for (const [e, n] of got) { const c = byCell.get(`${e},${n}`)!;
      add('town', sub, e, n, 1.2, pickHeading(R, b => townRun(c.site, c.k, b)), sub === 'town:rooms' ? R.range(-3, 3) : R.range(-4, 3)); }
  }

  // --- the plain within reach
  const inTown = (e: number, n: number) => W.zones.some(z => pointInPolygon(e, n, z));
  const nearRiver = (e: number, n: number, d: number) => W.rivers.some(r => { for (let i = 0; i < r.x.length; i += 1) if (Math.abs(r.x[i] - e) < d + 25 && Math.abs(r.y[i] - n) < d + 25 && Math.hypot(r.x[i] - e, r.y[i] - n) < d) return true; return false; });
  const inVillage = (e: number, n: number, pad = 0) => W.villages.some(v => Math.hypot(v.x - e, v.y - n) < v.r * 1.2 + pad);
  const inCompound = (e: number, n: number, pad = 0) => { for (const v of [...W.villages, ...W.farVillages]) { if (Math.hypot(v.x - e, v.y - n) > v.r * 1.3 + 40) continue;
    for (const c of W.compounds.get(v.id)!) { const ca = Math.cos(c.angle), sa = Math.sin(c.angle), de = e - c.x, dn = n - c.y, u = de * ca + dn * sa, w = -de * sa + dn * ca;
      if (Math.abs(u) < c.w / 2 + pad && Math.abs(w) < c.d / 2 + pad) return { c, u, w }; } } return null; };
  const walkPlain = (e: number, n: number) => Math.hypot(e, n) < REACH && !inNavBox(e, n) && slopeDeg(W, e, n) < MAX_SLOPE && !nearRiver(e, n, W.rivers[0].topWidth / 2 + 1);
  const toTerrace = (e: number, n: number) => bearingOf(-e, -n);
  const plainHeading = (R: Rng, e: number, n: number, subject?: number) => {
    if (subject !== undefined && R.chance(0.6)) return { b: subject + R.range(-25, 25), why: 'subject' as const, open: 1000 };
    if (R.chance(0.3)) return { b: toTerrace(e, n) + R.range(-30, 30), why: 'subject' as const, open: Math.hypot(e, n) };
    return { b: R.range(0, 360), why: 'random' as const, open: 1000 };
  };
  const plainGen: Record<string, (R: Rng) => { p: P2 | null; subject?: number }> = {
    'plain:roads': R => { const lines = [...settlementRoads().map(r => ({ pts: r.pts as P2[], w: r.width })), ...W.tracks.map(t => ({ pts: t, w: feature('villages_unlocated').tracks.width_m as number }))];
      const segs: { a: P2; b: P2; w: number; L: number }[] = []; for (const l of lines) for (let i = 1; i < l.pts.length; i++) { const a = l.pts[i - 1], b = l.pts[i];
        const L = Math.hypot(b[0] - a[0], b[1] - a[1]); if (Math.hypot(a[0], a[1]) < REACH || Math.hypot(b[0], b[1]) < REACH) segs.push({ a, b, w: l.w, L }); }
      const tot = segs.reduce((s, x) => s + x.L, 0); let u = R.range(0, tot), s = segs[0]; for (const x of segs) { if (u < x.L) { s = x; break; } u -= x.L; }
      const t = u / s.L, de = (s.b[0] - s.a[0]) / s.L, dn = (s.b[1] - s.a[1]) / s.L, off = R.range(-0.4, 0.4) * s.w;
      const p: P2 = [s.a[0] + de * s.L * t - dn * off, s.a[1] + dn * s.L * t + de * off];
      return { p: walkPlain(p[0], p[1]) && !inTown(p[0], p[1]) && !inCompound(p[0], p[1], 0.5) ? p : null, subject: bearingOf(R.chance(0.5) ? de : -de, R.chance(0.5) ? dn : -dn) }; },
    'plain:villages': R => { const v = W.villages[R.int(0, W.villages.length - 1)]; if (Math.hypot(v.x, v.y) > REACH) return { p: null };
      const a = R.range(0, 2 * Math.PI), r = v.r * Math.sqrt(R.next()) * 0.9, p: P2 = [v.x + r * Math.cos(a), v.y + r * Math.sin(a)];
      const cp = inCompound(p[0], p[1], 0.8), court = R.chance(1 / 3);
      if (court) { if (!cp) return { p: null }; const inRoom = cp.c.rooms.some(q => cp.u > q.u0 - 0.6 && cp.u < q.u1 + 0.6 && cp.w > q.v0 - 0.6 && cp.w < q.v1 + 0.6);
        if (inRoom || Math.abs(cp.u) > cp.c.w / 2 - 1 || Math.abs(cp.w) > cp.c.d / 2 - 1) return { p: null }; }
      else if (cp) return { p: null };
      return { p: walkPlain(p[0], p[1]) ? p : null }; },
    'plain:fields': R => { const polys = PLAIN.features.filter((f: any) => f.kind === 'field_zone' && f.present_467 && f.polygon).map((f: any) => f.polygon);
      const a = R.range(0, 2 * Math.PI), r = REACH * Math.sqrt(R.next()), p: P2 = [r * Math.cos(a), r * Math.sin(a)];
      return { p: polys.some((q: any) => pointInPolygon(p[0], p[1], q)) && walkPlain(p[0], p[1]) && !inTown(p[0], p[1]) && !inVillage(p[0], p[1]) && !nearRiver(p[0], p[1], 30) ? p : null }; },
    'plain:river': R => { const rv = W.rivers.find(r => r.id === 'river_pulvar')!; const idx: number[] = []; for (let i = 1; i < rv.x.length - 1; i++) if (Math.hypot(rv.x[i], rv.y[i]) < REACH) idx.push(i);
      const i = idx[R.int(0, idx.length - 1)], tx = rv.x[i + 1] - rv.x[i - 1], ty = rv.y[i + 1] - rv.y[i - 1], L = Math.hypot(tx, ty), side = R.chance(0.5) ? 1 : -1, off = rv.topWidth / 2 + R.range(1.5, 12);
      const p: P2 = [rv.x[i] - (ty / L) * off * side, rv.y[i] + (tx / L) * off * side];
      const ok = Math.hypot(p[0], p[1]) < REACH && slopeDeg(W, p[0], p[1]) < MAX_SLOPE && !nearRiver(p[0], p[1], rv.topWidth / 2 + 1) && !inCompound(p[0], p[1], 0.5);
      return { p: ok ? p : null, subject: R.chance(0.5) ? bearingOf((ty / L) * side, -(tx / L) * side) : bearingOf(tx * (R.chance(0.5) ? 1 : -1), ty) }; },
    'plain:naqsh': R => { const cl = (PLAIN as any).naqsh_e_rustam.cliff, kaba = feature('nr_kaba').xy as P2;
      const p: P2 = [R.range(cl.x_range[0] - 30, cl.x_range[1] + 30), cl.face_y - R.range(15, 300)];
      return { p: Math.hypot(p[0] - kaba[0], p[1] - kaba[1]) > 8 && slopeDeg(W, p[0], p[1]) < MAX_SLOPE ? p : null, subject: 0 }; },
    'plain:open': R => { const a = R.range(0, 2 * Math.PI), r = REACH * Math.sqrt(R.next()), p: P2 = [r * Math.cos(a), r * Math.sin(a)];
      const polys = PLAIN.features.filter((f: any) => f.kind === 'field_zone' && f.present_467 && f.polygon).map((f: any) => f.polygon);
      const ok = walkPlain(p[0], p[1]) && !inTown(p[0], p[1]) && !inVillage(p[0], p[1], 50) && !polys.some((q: any) => pointInPolygon(p[0], p[1], q)) && above(W, p[0], p[1]) < 15 && slopeDeg(W, p[0], p[1]) < 15;
      return { p: ok ? p : null }; },
  };
  for (const [sub, want] of Object.entries(PLAIN_WEIGHTS)) {
    const R = rng(sub), subj = new Map<string, number | undefined>();
    const got = spread(R, want, () => { const g = plainGen[sub](R); if (g.p) subj.set(`${g.p[0]},${g.p[1]}`, g.subject); return g.p; }, sub === 'plain:naqsh' ? 25 : sub === 'plain:villages' ? 30 : 250);
    if (got.length < want) throw new Error(`coverage: ${sub} gave ${got.length}/${want} points`);
    strata[sub] = { area: -1, n: got.length };
    for (const [e, n] of got) { const s = subj.get(`${e},${n}`); add('plain', sub, e, n, 4.0, plainHeading(R, e, n, s), sub === 'plain:naqsh' ? R.range(2, 10) : R.range(-4, 3)); }
  }

  // --- Kuh-e Rahmat's slopes (E and S of the Terrace)
  {
    const want = AREA_WEIGHTS.rahmat - rahmatFoot, R = rng('rahmat:slopes');
    const gen = (): P2 | null => { const p: P2 = [R.range(60, 1600), R.range(-1100, 700)]; const h = above(W, p[0], p[1]);
      if (inNavBox(p[0], p[1]) || pointInPoly(p[0], p[1], W.terracePoly) || h < 3 || h > 250 || slopeDeg(W, p[0], p[1]) > MAX_SLOPE || inTown(p[0], p[1])) return null;
      // only the mountain: E of the Terrace's longitude or S of it (the plain W and N is the plain's)
      if (p[0] < 150 && p[1] > -300) return null; return p; };
    const got = spread(R, want, gen, 90);
    strata['rahmat:slopes'] = { area: -1, n: got.length };
    for (const [e, n] of got) { const down = Array.from({ length: 16 }, (_, i) => i * 22.5).map(b => ({ b, d: above(W, e, n) - above(W, e + 200 * Math.sin(b * deg), n + 200 * Math.cos(b * deg)) })).sort((a, b) => b.d - a.d);
      const h = R.chance(0.6) ? { b: down[R.int(0, 2)].b + R.range(-10, 10), why: 'open' as const, open: 200 } : { b: R.range(0, 360), why: 'random' as const, open: 200 };
      add('rahmat', 'rahmat:slopes', e, n, 4.0, h, R.range(-8, 2)); }
  }

  // --- the world beyond walking reach, and the edges of built content
  {
    const ring = (R: Rng, r0: number, r1: number): P2 => { const a = R.range(0, 2 * Math.PI), r = Math.sqrt(R.range(r0 * r0, r1 * r1)); return [r * Math.cos(a), r * Math.sin(a)]; };
    const walkFar = (e: number, n: number) => slopeDeg(W, e, n, 40) < 30 && !nearRiver(e, n, 30) && !inCompound(e, n, 0.5);
    const polys = PLAIN.features.filter((f: any) => f.kind === 'field_zone' && f.present_467 && f.polygon).map((f: any) => f.polygon);
    const FIELDS = 40960 - 200;
    const gens: Record<string, (R: Rng) => { p: P2 | null; subject?: number }> = {
      'far:kur': R => { const rv = W.rivers.find(r => r.id === 'river_kur')!; const i = R.int(1, rv.x.length - 2), d = Math.max(Math.abs(rv.x[i]), Math.abs(rv.y[i]));
        if (d > FIELDS || Math.hypot(rv.x[i], rv.y[i]) < REACH) return { p: null };
        const tx = rv.x[i + 1] - rv.x[i - 1], ty = rv.y[i + 1] - rv.y[i - 1], L = Math.hypot(tx, ty), side = R.chance(0.5) ? 1 : -1, off = rv.topWidth / 2 + R.range(2, 15);
        const p: P2 = [rv.x[i] - (ty / L) * off * side, rv.y[i] + (tx / L) * off * side];
        return { p: slopeDeg(W, p[0], p[1]) < MAX_SLOPE && !nearRiver(p[0], p[1], rv.topWidth / 2 + 1) ? p : null, subject: bearingOf((ty / L) * side, -(tx / L) * side) }; },
      'far:villages': R => { const v = W.farVillages[R.int(0, W.farVillages.length - 1)]; if (!v || Math.max(Math.abs(v.x), Math.abs(v.y)) > FIELDS) return { p: null };
        const a = R.range(0, 2 * Math.PI), r = v.r * Math.sqrt(R.next()) * 0.9, p: P2 = [v.x + r * Math.cos(a), v.y + r * Math.sin(a)];
        return { p: !inCompound(p[0], p[1], 0.8) && slopeDeg(W, p[0], p[1]) < MAX_SLOPE ? p : null }; },
      'far:fields': R => { const p = ring(R, REACH, FIELDS); return { p: Math.max(Math.abs(p[0]), Math.abs(p[1])) < FIELDS && polys.some((q: any) => pointInPolygon(p[0], p[1], q)) && walkFar(p[0], p[1]) ? p : null }; },
      'far:open': R => { const p = ring(R, REACH, FIELDS); return { p: Math.max(Math.abs(p[0]), Math.abs(p[1])) < FIELDS && !polys.some((q: any) => pointInPolygon(p[0], p[1], q)) && walkFar(p[0], p[1]) ? p : null }; },
      'far:quarries': R => { const q = feature(R.chance(0.5) ? 'quarry_sivand' : 'quarry_majdabad').xy as P2, a = R.range(0, 2 * Math.PI), r = R.range(20, 120), p: P2 = [q[0] + r * Math.cos(a), q[1] + r * Math.sin(a)];
        return { p: slopeDeg(W, p[0], p[1]) < MAX_SLOPE ? p : null, subject: bearingOf(q[0] - p[0], q[1] - p[1]) }; },
    };
    for (const [sub, want] of Object.entries(FAR_WEIGHTS)) {
      const R = rng(sub), subj = new Map<string, number | undefined>();
      const got = spread(R, want, () => { const g = gens[sub](R); if (g.p) subj.set(`${g.p[0]},${g.p[1]}`, g.subject); return g.p; }, sub === 'far:quarries' ? 30 : 2000);
      if (got.length < want) throw new Error(`coverage: ${sub} gave ${got.length}/${want} points`);
      strata[sub] = { area: -1, n: got.length };
      for (const [e, n] of got) add('far', sub, e, n, 4.0, plainHeading(R, e, n, subj.get(`${e},${n}`)), R.range(-4, 3));
    }
    // edges: on a grid axis side chosen per point, just inside and just outside the edge; the heading looks across it
    for (const E of BUILT_EDGES) {
      const R = rng('edge:' + E.id);
      for (let k = 0; k < E.n; k++) {
        const inside = E.id === 'world-end' || k % 2 === 0, sub = `edge:${E.id}:${inside ? 'in' : 'out'}`;
        for (let t = 0; t < 400; t++) {
          const side = R.int(0, 3), along = R.range(-0.8, 0.8) * E.half, d = E.half + (inside ? -EDGE_OFFSET : EDGE_OFFSET) * (E.id === 'world-end' ? 5 : 1);
          const p: P2 = side === 0 ? [d, along] : side === 1 ? [-d, along] : side === 2 ? [along, d] : [along, -d];
          if (slopeDeg(W, p[0], p[1], 40) > 25 || nearRiver(p[0], p[1], 40) || inTown(p[0], p[1])) continue;
          const out = side === 0 ? 90 : side === 1 ? 270 : side === 2 ? 0 : 180; // grid bearing outward
          add('far', sub, p[0], p[1], 4.0, { b: (R.chance(0.5) ? out : out + 180) + R.range(-30, 30), why: 'subject', open: EDGE_OFFSET }, R.range(-3, 2));
          strata[sub] = { area: -1, n: (strata[sub]?.n ?? 0) + 1 }; break;
        }
      }
    }
  }

  // --- times: month × hour band × weather per area (coverage_time.ts), realised on real days of the simulated year
  const out: CovPoint[] = [];
  const byArea = new Map<Area, typeof pts>(); for (const p of pts) { let a = byArea.get(p.area); if (!a) byArea.set(p.area, a = []); a.push(p); }
  const seen = new Set<string>(), floors = new Set<CovPoint>();
  const put = (p: (typeof pts)[number], t: ReturnType<typeof realise>, extra: Partial<CovPoint> = {}): CovPoint =>
    ({ id: '', ...p, month: t.month, band: t.band, weather: t.weather, state: `${t.band}/${t.weather}`, day: t.day, hour: t.hour, w: t.w, forced: t.forced, sunAlt: t.sunAlt, moonAlt: t.moonAlt, moonFrac: t.moonFrac, place: '', ...extra });
  for (const area of Object.keys(AREA_WEIGHTS) as Area[]) { const list = byArea.get(area) ?? [], R = rng('time:' + area);
    const rows = assignArea(R, list.length, seen);
    list.forEach((p, i) => { const r = rows[i], q = put(p, realise(R, r.month, r.band, r.weather)); if (r.floor) floors.add(q); out.push(q); }); }
  // world-level pairs (T-B1p): complete band × weather and month × band on views that carry no floor
  { const R = rng('time:pairs'), areas = Object.keys(AREA_WEIGHTS);
    for (let pass = 0; pass < 4; pass++) {
      const cov = pairCoverage(out, areas); if (!cov.miss.bw.length && !cov.miss.mb.length) break;
      const free = () => out.filter(q => !floors.has(q));
      for (const k of cov.miss.bw) { const [b, w] = k.split('|') as [Band, Weather]; const c0 = free().filter(q => climate(q.month, b)[w] > 0), c1 = free().filter(q => FORCE_MONTHS[w].includes(q.month)), c = c0.length ? c0 : c1.length ? c1 : free().filter(q => q.band === b);
        const pool = c.length ? c : free(); const q = pool[R.int(0, pool.length - 1)];
        Object.assign(q, put(q, realise(R, q.month, b, w))); floors.add(q); }
      for (const k of cov.miss.mb) { const [m, b] = k.split('|'); const c = free().filter(q => q.month === +m); const pool = c.length ? c : free(); const q = pool[R.int(0, pool.length - 1)];
        const p = climate(+m, b as Band); let u = R.next(), w: Weather = 'clear'; for (const x of WEATHERS) { if (u < p[x]) { w = x; break; } u -= p[x]; }
        Object.assign(q, put(q, realise(R, +m, b as Band, w))); floors.add(q); }
    } }
  // places: one per first visit (stable order before sorting)
  out.forEach((p, i) => { p.place = `pl-${String(i).padStart(3, '0')}`; });
  // revisits: REVISIT_SHARE of each area's places again at a contrasting time: 3-9 months away, another hour band, the
  // climate's weather for it
  for (const area of Object.keys(AREA_WEIGHTS) as Area[]) {
    const R = rng('revisit:' + area), list = out.filter(p => p.area === area && !p.revisit), n = Math.round(list.length * REVISIT_SHARE);
    const pick = [...list]; for (let i = pick.length - 1; i > 0; i--) { const j = R.int(0, i); [pick[i], pick[j]] = [pick[j], pick[i]]; }
    for (const p of pick.slice(0, n)) { const m = ((p.month - 1 + R.int(3, 9)) % 12) + 1, bands = HOUR_BANDS.filter(b => b !== p.band), b = bands[R.int(0, bands.length - 1)];
      const cl = climate(m, b); let u = R.next(), w: Weather = 'clear'; for (const x of WEATHERS) { if (u < cl[x]) { w = x; break; } u -= cl[x]; }
      out.push(put(p, realise(R, m, b, w), { place: p.place, revisit: true })); }
  }
  // variety: populated places, the same hour on several days
  const variety: VarietyPlace[] = [];
  { const R = rng('variety'), want: [string, number][] = [['town:lanes', 2], ['approach', 1], ['terrace:open', 1], ['plain:villages', 1]];
    for (const [sub, k] of want) { const c = out.filter(p => p.sub === sub && !p.revisit); for (let i = 0; i < k && c.length; i++) { const p = c.splice(R.int(0, c.length - 1), 1)[0];
      variety.push({ place: p.place, area: p.area, sub: p.sub, e: p.e, n: p.n, eye: p.eye, cast: p.cast, az: p.az, pitch: p.pitch, days: [...VARIETY_DAYS], hour: VARIETY_HOUR, w: 'auto' }); } } }
  // order: by day and hour (one page load per chunk steps setTime from view to view)
  out.sort((a, b) => a.day - b.day || a.hour - b.hour || a.area.localeCompare(b.area) || a.place.localeCompare(b.place));
  out.forEach((p, i) => { p.id = `cov-${String(i).padStart(3, '0')}`; });
  const areasL = Object.keys(AREA_WEIGHTS), pc = pairCoverage(out, areasL);
  const time = { areaHits: areaHits(out), pairs: { share: +pc.share.toFixed(4), missing: pc.miss }, forced: out.filter(p => p.forced).length,
    weathers: Object.fromEntries(WEATHERS.map(w => [w, out.filter(p => p.weather === w).length])), bands: Object.fromEntries(HOUR_BANDS.map(b => [b, out.filter(p => p.band === b).length])) };
  return { meta: { seed, commit, total: out.length, reach: REACH, weights: { area: AREA_WEIGHTS, town: TOWN_WEIGHTS, plain: PLAIN_WEIGHTS, far: FAR_WEIGHTS, terrace: 'sqrt(walkable area) per stratum, min 3', revisit: REVISIT_SHARE }, edges: BUILT_EDGES, strata, time,
    interimAreas: 'INTERIM areas (not the MASTER_PLAN §4.3 registry: data/areas.json from tools/dev/areas.ts is not built): six top-level areas and their strata, from the walkable grid, the town plan, the plain data and the terrain',
    notes: ['rooftops: not walkable in the build (Q-630)', 'the plain beyond REACH m of the Apadana is not sampled (walking reach, not the whole plain)', 'revisits share a place id with the first visit', 'extras: worst-first views (up to 25 % more) go in `extras`, reported apart, never in a pass rate; none yet (Tier 0 is not built)'] }, points: out, variety, extras: [] };
}

if (process.argv[1]?.endsWith('coverage_points.ts')) {
  const a = process.argv.slice(2), ci = a.indexOf('--commit'), commit = ci >= 0 ? a.splice(ci, 2)[1] : execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim();
  const f = a[0] ?? 'tests/data/coverage_points.json', seed = seedOf(commit);
  const t0 = Date.now(), res = samplePoints(seed, commit);
  writeFileSync(f, JSON.stringify(res, null, 0).replace(/\},\{"id"/g, '},\n{"id"'));
  const by = new Map<string, number>(); for (const p of res.points) by.set(p.sub, (by.get(p.sub) ?? 0) + 1);
  console.log(`${res.points.length} points (${res.points.filter(p => p.revisit).length} revisits), ${res.variety.length} variety places, seed ${seed} (commit ${commit.slice(0, 8)}) → ${f} (${Date.now() - t0} ms)`);
  console.log(`  time: pairs ${(res.meta.time.pairs.share * 100).toFixed(1)} %, forced ${res.meta.time.forced}; per area ${JSON.stringify(res.meta.time.areaHits)}`); for (const [k, v] of [...by].sort()) console.log(`  ${k.padEnd(30)} ${v}`);
}
