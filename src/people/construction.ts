// Construction of the Hall of a Hundred Columns as simulation state (brief §9.5 "construction advances week by week
// (courses laid, columns raised, reliefs carved), with named work gangs"; EVENTS E-60 to E-63, CE-11/12; D-022).
// Starts from exactly the state the geometry shows (src/arch/terrace.ts draws each column's `built` fraction from
// Rng(1, 'hall100-construction'); the draw is replicated here and tested against the parts) and advances day by day
// from the labour the population actually puts in (builders present, weather, winter halving, heat).
// Everything here is tier C (no PT memorandum of the works was read): the rates are calibrated so that the expected
// output matches E-61 ("about 5 column shafts a year", itself derived from the completion under Artaxerxes I).
import { v, footprint } from '../arch/spec';
import { grid } from '../arch/parts';
import { order } from '../arch/orders';
import { Rng } from '../core/rng';
import { u01, poisson, salt } from './hash';
import type { P2 } from './navgrid';

/** working numbers (all C; see DECISIONS D-022). Man-days are 9-hour days of one worker. */
export const BUILD = {
  drumH: { v: 1.15, tier: 'C', note: 'working drum height (NOT SEEN, verify against Schmidt 1953): a ~10.4 m shaft in 9 drums' },
  drumsPerWeek: { v: 0.9, tier: 'C', note: 'drums arriving from the quarry (Majdabad/Sivand, plain.json B) per week: calibrated to E-61 (~5 shafts x 9 drums a year); no hauling on rain or storm days' },
  dressDays: { v: 30, tier: 'C', note: 'stonecutter-days to dress one drum to a cylinder with smooth joint faces' },
  raiseDays: { v: 40, tier: 'C', note: 'labour-days to haul one drum up the earth ramp and set it (ramps and levers; no crane evidence retrieved)' },
  fluteDays: { v: 600, tier: 'C', note: 'stonecutter-days to cut the 40 flutes of one shaft after erection (fluting after erection: recollection, C)' },
  capitalDays: { v: 1800, tier: 'C', note: 'stonecutter-days to carve one double-bull capital in the yard' },
  setCapitalDays: { v: 60, tier: 'C', note: 'labour-days to raise and set a capital' },
  reliefDays: { v: 40000, tier: 'C', note: 'stonecutter-days to carve the reliefs of one doorway (throne and hero scenes, BRIT-H100 B); set so the eight doorways take about as long as the columns (~15 years)' },
  courseDays: { v: 600, tier: 'C', note: 'brick-gang days per course (~0.12 m) along one side of the hall wall, counting the moulding, ramps and Tripylon work the same gang does; pace set so the walls rise with the columns (~6 courses a year)' },
  courseH: { v: 0.12, tier: 'C', note: 'mud-brick course height (NOT SEEN)' },
  fluteCrew: { v: 20, tier: 'C', note: 'most stonecutters who can work on one shaft at once' },
  dressCrew: { v: 6, tier: 'C', note: 'stonecutters per drum being dressed' },
  capitalCrew: { v: 14, tier: 'C', note: 'carvers per capital block' },
  reliefStart: { v: { N1: 0.35, N2: 0.3, S1: 0.2, S2: 0.15, E1: 0.1, E2: 0.1, W1: 0.1, W2: 0.05 }, tier: 'C', note: 'carving done on each doorway by 467 (no evidence; the N doorways first, C)' },
} as const;

export interface ColumnState { i: number; at: P2; ring: 'hall' | 'portico'; drums: number; drumsTotal: number; fluted: number; capitalSet: boolean }
export interface BuildEvent { day: number; hour: number; kind: 'drum_arrived' | 'drum_dressed' | 'drum_set' | 'shaft_complete' | 'fluting_done' | 'capital_carved' | 'capital_set' | 'course_laid' | 'relief_progress' | 'halted'; text: string; place: string; column?: number }
export interface Credit { stone: number; labour: number; brick: number; frost: boolean; wet: boolean; storm: boolean }
/** what the stonecutters are doing today (for assigning individual people to real places) */
export interface StoneTasks { flute: number | null; dress: boolean; capital: boolean; relief: string; /** column receiving drums */ raise: number | null; /** dressed drums ready to raise */ dressed: number; /** lowest wall side (next course) */ wall: 'N' | 'S' | 'E' | 'W' }
type Snapshot = ReturnType<Construction['snapshot']>;

/** column positions and the initial built fraction exactly as src/arch/terrace.ts draws them */
export function hall100Layout() {
  const b = 'hall100', f = footprint(b), [x0, y0, x1, y1] = f.bounds, ia = v(b, 'interaxial');
  const c: P2 = [(x0 + x1) / 2, (y0 + y1) / 2];
  const CP = v<any>(b, 'r_construction_probs'); const rng = new Rng(1, 'hall100-construction');
  const [nx, ny] = v<number[]>(b, 'hall_columns'); const pts = grid(nx, ny, c[0], c[1], ia);
  const built = pts.map(() => { const u = rng.next(); return u < CP.raised ? 1 : u < CP.raised + CP.partial ? CP.partial_min + CP.partial_span * rng.next() : 0; });
  const PX = v<any>(b, 'r_portico_extent'); const depth = PX.front_y - y1; const [pnx, pny] = v<number[]>(b, 'portico');
  const por = grid(pnx, pny, c[0], y1 + depth / 2, ia, depth / pny);
  const ord = order(b, { base: 'bell', capital: 'bull' });
  const shaftH = ord.height - (ord as any).baseH - (ord as any).capitalH;
  return { centre: c, hall: pts as P2[], built, portico: por as P2[], shaftH, doors: v<any[]>(b, 'doors') };
}

export class Construction {
  readonly columns: ColumnState[] = [];
  walls = { N: 0, S: 0, E: 0, W: 0 } as Record<'N' | 'S' | 'E' | 'W', number>;
  coursesTotal: number;
  reliefs: Record<string, number> = {};
  yard = { waiting: 0, dressWork: 0, dressed: 0, capitalWork: 0, capitalsReady: 0, raiseWork: 0, setWork: 0, fluteWork: 0, reliefWork: 0, courseWork: 0 };
  day = -1;
  readonly log: BuildEvent[] = [];
  /** per-day summary (for the soak's "visible change" measure) */
  readonly daily: { day: number; drumsSet: number; fluted: number; courses: number; relief: number; stoneMd: number; labourMd: number; brickMd: number }[] = [];
  readonly gangs: { id: number; kind: 'stone' | 'labour' | 'brick'; chief: number; name: string | null; size: number }[] = [];
  readonly tasks: StoneTasks[] = [];
  private S = { drum: salt('c-drum'), day: salt('c-day') };
  constructor(readonly seed: number) {
    const L = hall100Layout();
    const total = Math.round(L.shaftH / BUILD.drumH.v);
    L.hall.forEach((at, i) => this.columns.push({ i, at, ring: 'hall', drums: Math.round(L.built[i] * total), drumsTotal: total, fluted: L.built[i] === 1 ? 1 : 0, capitalSet: L.built[i] === 1 }));
    L.portico.forEach((at, j) => this.columns.push({ i: L.hall.length + j, at, ring: 'portico', drums: 0, drumsTotal: total, fluted: 0, capitalSet: false }));
    const wallTop = v('hall100', 'column_height') + v('hall100', 'r_wall_top_above_columns');
    this.coursesTotal = Math.round(wallTop / BUILD.courseH.v);
    for (const k of Object.keys(this.walls) as ('N' | 'S' | 'E' | 'W')[]) this.walls[k] = Math.round(this.coursesTotal / 3); // walls at a third (terrace.ts)
    for (const d of L.doors) this.reliefs[d.id] = (BUILD.reliefStart.v as any)[d.id] ?? 0.1;
  }
  /** built fraction of a column's shaft (what the geometry's `built` means) */
  built(i: number) { const c = this.columns[i]; return c.drums / c.drumsTotal; }
  get raised() { return this.columns.filter(c => c.drums >= c.drumsTotal).length; }
  /** the column now receiving drums: finish the tallest partial one first, then the next bare base in plan order */
  private raiseTarget(): ColumnState | null {
    let best: ColumnState | null = null;
    for (const c of this.columns) if (c.drums > 0 && c.drums < c.drumsTotal && (!best || c.drums > best.drums)) best = c;
    return best ?? this.columns.find(c => c.drums === 0) ?? null;
  }
  private fluteTarget(): ColumnState | null { return this.columns.find(c => c.drums >= c.drumsTotal && c.fluted < 1) ?? null; }
  /** today's stonecutting tasks (before the day's work is credited): used to put individual people at real places */
  stoneTasks(): StoneTasks {
    const f = this.fluteTarget(); const relief = Object.entries(this.reliefs).filter(([, p]) => p < 1).sort((a, b) => b[1] - a[1])[0]?.[0] ?? 'N1';
    const rt = this.raiseTarget(); const wall = (['N', 'E', 'S', 'W'] as const).reduce((a, b) => (this.walls[b] < this.walls[a] ? b : a));
    return { flute: f ? f.i : null, dress: this.yard.waiting > 0 || this.yard.dressWork > 0, capital: this.yard.capitalsReady < 2, relief, raise: rt ? rt.i : null, dressed: this.yard.dressed, wall };
  }
  /** advance one day with the labour actually present (man-days) and the day's weather */
  step(day: number, cr: Credit): BuildEvent[] {
    if (day <= this.day) return [];
    this.day = day; const out: BuildEvent[] = []; const B = BUILD;
    const ev = (hour: number, kind: BuildEvent['kind'], text: string, place: string, column?: number) => { const e = { day, hour, kind, text, place, column }; out.push(e); this.log.push(e); if (this.log.length > 4000) this.log.shift(); };
    this.tasks[day] = this.stoneTasks();
    // drums from the quarry: hauling stops on rain and storm days (W-01, W-02)
    const nDrums = cr.wet || cr.storm ? 0 : poisson(u01(this.seed, this.S.drum, day), B.drumsPerWeek.v / 7);
    for (let k = 0; k < nDrums; k++) { this.yard.waiting++; ev(10 + k, 'drum_arrived', 'a column drum arrived from the quarry at the masons’ yard', 'worksite'); }
    const sum = { drumsSet: 0, fluted: 0, courses: 0, relief: 0 };
    if (cr.storm) ev(12, 'halted', 'storm: work on the Hall of a Hundred Columns stopped', 'worksite');
    // --- stonecutters: fluting first, then dressing, then capitals, the rest on the doorway reliefs
    let S = cr.stone;
    const f = this.fluteTarget();
    if (f && S > 0) { const w = Math.min(S, B.fluteCrew.v); S -= w; this.yard.fluteWork += w;
      const need = B.fluteDays.v * (1 - f.fluted); const done = Math.min(this.yard.fluteWork, need); f.fluted = Math.min(1, f.fluted + done / B.fluteDays.v); this.yard.fluteWork -= done; sum.fluted += done / B.fluteDays.v;
      if (f.fluted >= 1) { this.yard.fluteWork = 0; ev(15, 'fluting_done', `fluting of column ${f.i + 1} finished`, colPlace(f.i), f.i); } }
    if ((this.yard.waiting > 0 || this.yard.dressWork > 0) && S > 0) { const w = Math.min(S, B.dressCrew.v * Math.max(1, this.yard.waiting)); S -= w; this.yard.dressWork += w;
      while (this.yard.dressWork >= B.dressDays.v && this.yard.waiting > 0) { this.yard.dressWork -= B.dressDays.v; this.yard.waiting--; this.yard.dressed++; ev(14, 'drum_dressed', 'a drum dressed and ready to raise', 'worksite'); }
      if (this.yard.waiting === 0) this.yard.dressWork = 0; }
    if (this.yard.capitalsReady < 2 && S > 0) { const w = Math.min(S, B.capitalCrew.v); S -= w; this.yard.capitalWork += w;
      if (this.yard.capitalWork >= B.capitalDays.v) { this.yard.capitalWork -= B.capitalDays.v; this.yard.capitalsReady++; ev(15, 'capital_carved', 'a double-bull capital finished in the yard', 'worksite_capital'); } }
    if (S > 0) { const doors = Object.keys(this.reliefs).filter(k => this.reliefs[k] < 1); if (doors.length) { const k = this.tasks[day].relief; const d = S / B.reliefDays.v; this.reliefs[k] = Math.min(1, this.reliefs[k] + d); sum.relief += d; } }
    // --- labourers: raise dressed drums onto the target column; set a capital on a finished, fluted shaft
    let Lb = cr.storm ? 0 : cr.labour;
    const needCap = this.columns.find(c => c.drums >= c.drumsTotal && c.fluted >= 1 && !c.capitalSet);
    if (needCap && this.yard.capitalsReady > 0 && Lb > 0) { const w = Math.min(Lb, 30); Lb -= w; this.yard.setWork += w;
      if (this.yard.setWork >= B.setCapitalDays.v) { this.yard.setWork = 0; this.yard.capitalsReady--; needCap.capitalSet = true; ev(13, 'capital_set', `capital set on column ${needCap.i + 1}`, colPlace(needCap.i), needCap.i); } }
    while (Lb > 0 && this.yard.dressed > 0) {
      const tgt = this.raiseTarget(); if (!tgt) break;
      const w = Math.min(Lb, B.raiseDays.v - this.yard.raiseWork); Lb -= w; this.yard.raiseWork += w;
      if (this.yard.raiseWork < B.raiseDays.v - 1e-9) break;
      this.yard.raiseWork = 0; this.yard.dressed--; tgt.drums++; sum.drumsSet++;
      ev(11, 'drum_set', `drum ${tgt.drums} of ${tgt.drumsTotal} set on column ${tgt.i + 1}`, colPlace(tgt.i), tgt.i);
      if (tgt.drums >= tgt.drumsTotal) ev(16, 'shaft_complete', `the shaft of column ${tgt.i + 1} is complete: fluting can begin`, colPlace(tgt.i), tgt.i);
    }
    // --- brick gang: courses on the hall walls; no brick, mortar or plaster work on frost or rain days (E-62, CE-12)
    if (!cr.frost && !cr.wet && !cr.storm && cr.brick > 0) {
      this.yard.courseWork += cr.brick;
      const sides: ('N' | 'S' | 'E' | 'W')[] = ['N', 'E', 'S', 'W'];
      while (this.yard.courseWork >= BUILD.courseDays.v) { const low = sides.reduce((a, b) => (this.walls[b] < this.walls[a] ? b : a)); if (this.walls[low] >= this.coursesTotal) break;
        this.yard.courseWork -= BUILD.courseDays.v; this.walls[low]++; sum.courses++; ev(14, 'course_laid', `a course of mud brick laid on the ${({ N: 'north', S: 'south', E: 'east', W: 'west' })[low]} wall of the hall`, `h100_wall_${low}`); }
    }
    this.daily[day] = { day, ...sum, stoneMd: cr.stone, labourMd: cr.labour, brickMd: cr.brick };
    return out;
  }
  snapshot() { return { day: this.day, columns: this.columns.map(c => [c.drums, c.fluted, c.capitalSet ? 1 : 0]), walls: { ...this.walls }, reliefs: { ...this.reliefs }, yard: { ...this.yard } }; }
  restore(s: Snapshot) { this.day = s.day; s.columns.forEach(([d, f, cs], i) => { const c = this.columns[i]; c.drums = d; c.fluted = f; c.capitalSet = !!cs; }); this.walls = { ...s.walls }; this.reliefs = { ...s.reliefs }; this.yard = { ...s.yard }; }
}
/** the place id of a column (people_places are generated for all 100 hall columns in sim.ts) */
export const colPlace = (i: number) => (i < 100 ? `h100_c${String(i).padStart(2, '0')}` : `h100_p${i - 100}`);
