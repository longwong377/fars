// A village of the plain as one site raster (D-254): the plan the people walk and live in (people/popgeo.ts), the walls,
// roofs, doors and fittings the world draws (villagehouses.ts via settlement/houses.ts) and the colliders, from one Site
// (settlement/site.ts), so the drawn compounds and the people's rasters agree by construction (D-237 found them apart at
// village_p22: the compounds were drawn turned against the raster and overlapping each other).
// Per compound (villages.ts villageCompounds: whole metres on the village's grid): a plot of kind 'house' whose open cells
// are its yard (walls of yard_wall_h_m, plain.json layout), its rooms (roofed, each with a door onto the yard), the gate in
// the S wall (the plot's street door), and the animal pen: a plot of kind 'pen' in a S corner behind a low wall, with a door
// from the yard (it shares its compound's rect, so the two are drawn near or far together). Then the fittings: the bread
// oven (tannur) in a corner of the yard, the hearth before the rooms, storage bins and jars against the walls, the manger in
// the pen, the village well in the lane nearest the centre; and each house's life and court fixtures (houseplan.ts: the
// ladder to the roof, a bench, fuel, fodder, baskets, the roof's things). All C (no village of Achaemenid Fars excavated:
// the region's courtyard houses by analogy, D-207). Pure data: no three.js, no terrain.
import { Site, OUT, ROOM, YARD, toLocal, snapSite, restoreSite, type P2, type Frame } from '../settlement/site';
import { planHouses } from '../settlement/houseplan';
import { feature } from './data';
import type { Compound } from './villages';

export interface VillageLike { id: string; x: number; y: number; r: number }
export interface VillageSite {
  site: Site; comps: Compound[];
  /** per compound: its index if its gate was built (else −1) */
  gates: number[];
  /** per compound: its pen's plot index (−1: none) */
  pens: number[];
  /** the village well (grid e, n), or null */
  well: P2 | null;
}
/** the pen's wall (m; C: a wall a sheep or a goat does not jump, lower than the yard's) and its thickness */
export const PEN_WALL = 1.4, PEN_T = 0.45;
const CACHE = new Map<string, VillageSite>();
const key = (v: VillageLike, comps: Compound[]) => `${v.id}|${v.x.toFixed(3)}|${v.y.toFixed(3)}|${comps.length}|${comps[0]?.seed ?? 0}|${comps[comps.length - 1]?.seed ?? 0}`;

/** the raster of a built village (cached: the people and the drawn world share one Site per village) */
export function villageSite(v: VillageLike, comps: Compound[]): VillageSite {
  const k = key(v, comps); let x = CACHE.get(k); if (x) return x;
  x = buildVillageSite(v, comps); CACHE.set(k, x); return x;
}
/** D-392: the built rasters as plain data for the baked world (keyed by the world: their compounds are the seed's), and back */
export function exportVillageSites() { return [...CACHE].map(([k, x]) => ({ k, meta: x.site.meta, frame: x.site.frame, W: x.site.W, H: x.site.H, st: snapSite(x.site), comps: x.comps, gates: x.gates, pens: x.pens, well: x.well })); }
export function importVillageSites(d: any[]) { for (const e of d) { if (CACHE.has(e.k)) continue; const s = new Site(e.meta, e.frame, e.W, e.H); restoreSite(s, e.st); CACHE.set(e.k, { site: s, comps: e.comps, gates: e.gates, pens: e.pens, well: e.well }); } }
/** forget the cached rasters (tests that build villages under another seed) */
export function clearVillageSites() { CACHE.clear(); }

/** a village raster's frame and size (square, W cells; the raster's u0 = v0 = -W/2) */
export function villageFrame(v: VillageLike, comps: Compound[]): { frame: Frame; W: number } { return { frame: { c: [v.x, v.y], theta: comps.length ? comps[0].angle : 0 }, W: 2 * Math.ceil(v.r * 1.3) + 40 }; }
/** a compound's corner cell (i0, j0) on its village's raster (whole metres from the village centre: villageCompounds), and
 *  whether it lies inside the raster */
export function compoundCorner(fr: { frame: Frame; W: number }, c: Compound): { i0: number; j0: number; inb: boolean } {
  const [lu, lv] = toLocal(fr.frame, c.x, c.y), i0 = Math.floor(lu - c.w / 2 + 0.5 + fr.W / 2), j0 = Math.floor(lv - c.d / 2 + 0.5 + fr.W / 2);
  return { i0, j0, inb: i0 >= 1 && j0 >= 1 && i0 + c.w < fr.W - 1 && j0 + c.d < fr.W - 1 };
}
function buildVillageSite(v: VillageLike, comps: Compound[]): VillageSite {
  const lay = feature('villages_unlocated').layout, fr = villageFrame(v, comps), W = fr.W;
  const s = new Site({ id: v.id, feature: v.id, zone: 'plain', popZone: 'plain', kind: 'compound', tier: 'C', src: 'RECON', note: 'village (plain/villages.ts, villagesite.ts)' }, fr.frame, W, W);
  s.cell.fill(OUT);
  const cc = comps.map(c => compoundCorner(fr, c)), corner = cc.map(x => [x.i0, x.j0] as [number, number]);
  const inb = (_c: Compound, ci: number) => cc[ci].inb;
  // the compounds' plots first (plot index = compound index: popgeo villageOf), then their pens
  const plots = comps.map((c, ci) => { const [i0, j0] = corner[ci];
    return s.addPlot({ id: `${v.id}-c${ci}`, kind: 'house', rect: [i0, j0, i0 + c.w, j0 + c.d], o: [i0, j0], t: [1, 0], n: [0, 1], w: c.w, d: c.d, door: null, court: true,
      height: c.rooms[0]?.h ?? 2.6, parapet: 0, yardWall: lay.yard_wall_h_m, outerT: lay.wall_m, row: 'village_houses', feature: v.id,
      note: `a courtyard compound of ${v.id}: ${c.w} x ${c.d} m, ${c.rooms.length} rooms${c.wing ? ` (a wing on the ${c.wing < 0 ? 'W' : 'E'} side)` : ''}, an animal pen, the gate in the S wall` }); });
  const pens = comps.map((c, ci) => { if (!inb(c, ci)) return -1; const [i0, j0] = corner[ci];
    return s.addPlot({ id: `${v.id}-c${ci}-pen`, kind: 'pen', rect: [i0, j0, i0 + c.w, j0 + c.d], o: [i0, j0], t: [1, 0], n: [0, 1], w: c.w, d: c.d, door: null, court: false,
      height: PEN_WALL, parapet: 0, yardWall: PEN_WALL, outerT: PEN_T, row: 'village_houses', feature: v.id, note: `the animal pen of ${v.id}-c${ci} (C)` }).idx; });
  // compound-local metres -> cell (u right, v up; whole-metre edges)
  const cellOf = (ci: number, u: number, w: number): [number, number] => { const c = comps[ci], [i0, j0] = corner[ci]; return [i0 + Math.floor(u + c.w / 2), j0 + Math.floor(w + c.d / 2)]; };
  const gates: number[] = [];
  comps.forEach((c, ci) => {
    if (!inb(c, ci)) { gates.push(-1); return; }
    const p = plots[ci], [i0, j0] = corner[ci];
    const rid = c.rooms.map(() => s.newRoom());
    for (let j = j0; j < j0 + c.d; j++) for (let i = i0; i < i0 + c.w; i++) { const k = s.k(i, j); s.cell[k] = p.idx; s.sub[k] = YARD; }
    c.rooms.forEach((r, ri) => { const [a0, b0] = cellOf(ci, r.u0 + 0.5, r.v0 + 0.5), [a1, b1] = cellOf(ci, r.u1 - 0.5, r.v1 - 0.5);
      for (let j = b0; j <= b1; j++) for (let i = a0; i <= a1; i++) { const k = s.k(i, j); s.sub[k] = ROOM; s.room[k] = rid[ri]; } });
    const pi = pens[ci]; { const [a0, b0] = cellOf(ci, c.pen.u0 + 0.5, c.pen.v0 + 0.5), [a1, b1] = cellOf(ci, c.pen.u1 - 0.5, c.pen.v1 - 0.5);
      for (let j = b0; j <= b1; j++) for (let i = a0; i <= a1; i++) { const k = s.k(i, j); s.cell[k] = pi; s.sub[k] = YARD; } }
    // doors: an edge between the two cells either side of a doorway's midpoint
    const door = (d: { u: number; v: number; along: 'u' | 'v' }) => { const [a, b] = d.along === 'u' ? [cellOf(ci, d.u, d.v - 0.5), cellOf(ci, d.u, d.v + 0.5)] : [cellOf(ci, d.u - 0.5, d.v), cellOf(ci, d.u + 0.5, d.v)];
      const e = s.edgeBetween(s.k(a[0], a[1]), s.k(b[0], b[1])); s.doors.add(e); return [s.k(a[0], a[1]), s.k(b[0], b[1])]; };
    for (const d of c.doors) door(d);
    door(c.penDoor);
    const [gin] = [cellOf(ci, c.gateU, -c.d / 2 + 0.5)], gout = [gin[0], gin[1] - 1];
    const kin = s.k(gin[0], gin[1]), kout = s.k(gout[0], gout[1]);
    if (s.cell[kin] === p.idx && s.cell[kout] === OUT) { s.doors.add(s.edgeBetween(kin, kout)); p.door = { cell: kin, out: kout }; gates.push(ci); } else gates.push(-1);
  });
  s.recount();
  // the household's fittings (villages.ts planFittings: the oven, the hearth, bins, jars, the pen's manger)
  comps.forEach((c, ci) => { if (!inb(c, ci)) return; const [i0, j0] = corner[ci], cu = s.u0 + i0 + c.w / 2, cv = s.v0 + j0 + c.d / 2;
    for (const f of c.fittings) s.fittings.push({ kind: f.kind, u: cu + f.u, v: cv + f.v, rot: f.rot, size: f.size, plot: f.pen ? pens[ci] : plots[ci].idx, note: f.note }); });
  // every room, the yard and the pen joined to the gate through doors (the plan gives each one: this adds none, measured in
  // tests/villages.test.ts, as is every doorway's >= 0.8 m clear width: site.ts settleDoors is not needed)
  s.connectPlots(0.8);
  // the houses' lives and court fixtures (houseplan.ts: every choice a hash of the plot id), then the fittings' cells kept
  // clear of standing people (planHouses resets `blocked`)
  planHouses(s);
  for (const f of s.fittings) { const i = s.ci(f.u), j = s.cj(f.v); if (s.inb(i, j)) s.blocked!.add(s.k(i, j)); }
  const well = placeWell(s, v);
  return { site: s, comps, gates, pens, well };
}

/** the village well: in the lane or open space nearest the village's centre with 2 m clear round it (C; popgeo's
 *  `well:<village>` place) */
function placeWell(s: Site, v: VillageLike): P2 | null {
  const [cu, cv] = toLocal(s.frame, v.x, v.y), ic = s.ci(cu), jc = s.cj(cv);
  const free = (i: number, j: number) => { for (let dj = -2; dj <= 2; dj++) for (let di = -2; di <= 2; di++) { if (!s.inb(i + di, j + dj) || s.cell[s.k(i + di, j + dj)] !== OUT) return false; } return true; };
  for (let rr = 0; rr < 80; rr++) for (let dj = -rr; dj <= rr; dj++) for (let di = -rr; di <= rr; di++) {
    if (Math.max(Math.abs(di), Math.abs(dj)) !== rr) continue; const i = ic + di, j = jc + dj; if (!free(i, j)) continue;
    const u = s.cu(i), w = s.cv(j); s.fittings.push({ kind: 'well', u, v: w, rot: 0, size: 1, plot: -1, note: `the village well of ${v.id}: a shaft lined with fieldstones, a kerb of stones, a rope and a skin bucket (C; at the lane nearest the village centre)` });
    for (let y = -1; y <= 1; y++) for (let x = -1; x <= 1; x++) s.blocked!.add(s.k(i + x, j + y));
    return s.grid(u, w); }
  return null;
}
