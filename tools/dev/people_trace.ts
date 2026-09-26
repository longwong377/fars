// The renderless people trace (D-244; MASTER_PLAN §3 illusion-break probes, axis D): what the crowd would DRAW, next to
// what each person's plan says, for a seed, day, hour and weather. No browser: the population view (popview.ts) is settled
// exactly as the renderer's pool is fed from it (crowd.ts feedPool: every person the view returns is a skinned body or an
// impostor at the view's position; the detailed agents on the map are drawn from the simulation), and each drawn person's
// pose is the performance crowd.ts resolve()/impAnim() gives (activities.ts performanceFor on the view's act and reason).
//
// Measured, per area (the Terrace; a town site; a village; open ground):
//  - T-D3  people drawn out of doors whose plan says indoors (population.ts planIndoors: the plan's own words, or a block
//          at a roofed place that the plan's shelter rules rely on: the dark, the rain, the storm, leisure in the dust).
//          "Drawn out of doors" is geometric, not the view's flag: the drawn point in an open cell of every town or village
//          raster holding it (court, yard, lane, open ground), outside every roofed Terrace building's footprint (roofs.ts)
//          and outside every court camp tent.
//  - T-D3s household members whose plan says asleep at home at 23:00 DRAWN asleep there: drawn, lying (the performance's
//          anim is `sleep`), inside one of their own household's plots; a small child held by a carer drawn at home counts with
//          the carer. Hidden is not asleep (the row's anti-proxy): a sleeper not drawn fails, with the reason.
//  - T-D4  people drawn in the open at a moment of rain >= 0.5, jobs exempted by evidence (EXEMPT below, each with its
//          reason), against the same hour of a dry twin day (the share, %), world-wide and per area (the row's scope).
//  Beside them, the anti-proxies: how many the plan keeps indoors are drawn inside (drawnIn) or left undrawn for want of a
//  built room (noRoom, by place), the sick drawn out of doors, the dry day's people still out of doors, the rain cover worn.
//  Not traced here: the crowd's extras (world/traffic.ts drivers and riders, visitor-mode escorts, lineups) and animals.
// It is the start of the walker-bot probes (MASTER_PLAN §3): traceAt() is the reusable core (one whole-world snapshot);
// gate() runs a seed's moments; writeEvidence() writes REVIEWS/evidence/<pass>/<id>.json.
//
//   npx tsx tools/dev/people_trace.ts [--seed 1] [--day 25] [--hour 23] [--sample 4] [--no-court] [--json]   one snapshot
//   npx tsx tools/dev/people_trace.ts --gate [--seed 1] [--sample 4] [--no-court] [--json]                  a seed's gate
//   npx tsx tools/dev/people_trace.ts --evidence <pass> --seeds 1,7,<fresh> [--sample 4]                    evidence files
//     --sample k: every k-th household (whole households, so carers and children stay together); 1 = everyone
//     the court comes and goes by default (UD-10); --no-court traces the world without it
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { execSync } from 'node:child_process';
import { NavGrid } from '../../src/people/navgrid';
import { PeopleSim, type Env } from '../../src/people/sim';
import { WeatherSystem } from '../../src/weather/weatherState';
import { buildTownPlan, type TownPlan } from '../../src/world/settlement/plan';
import { PopGeo } from '../../src/people/popgeo';
import { PopView, type ViewPerson } from '../../src/people/popview';
import { buildCanals } from '../../src/world/plain/canals';
import { placeVillages, villageCompounds, type Village } from '../../src/world/plain/villages';
import { loadTerrain, loadRiversFile } from '../../tests/plainLib';
import { segAt, outdoors, planIndoors, type Seg, type Population } from '../../src/people/population';
import { performanceFor, ACTIVITIES, type ActivityId } from '../../src/people/activities';
import { sunTimes } from '../../src/people/calendar';
import { terraceRoofed } from '../../src/people/roofs';
import { ROOM, toLocal, type Site } from '../../src/world/settlement/site';
import { rainBits } from '../../src/people/outfits';

export interface TraceWorld { seed: number; sim: PeopleSim; geo: PopGeo; view: PopView; weather: WeatherSystem; pop: Population; plan: TownPlan; villages: Village[]; sample: number; court: boolean }
const worlds = new Map<string, TraceWorld>();
/** the world of a seed, as world.ts builds it (the same seed to the weather, the simulation, the plain and the view) */
export function buildTraceWorld(seed: number, sample = 1, court = true): TraceWorld {
  const key = `${seed}/${sample}/${court}`; const w = worlds.get(key); if (w) return w; const b0 = performance.now();
  const weather = new WeatherSystem(seed);
  const env = (t: number): Env => { const d = Math.floor(t / 24), c = weather.conditions(d, t - d * 24); return { rain: c.rain, lightning: c.lightning, windMs: c.windMs, tempC: c.tempC, dust: c.dust }; };
  const nav = new NavGrid(new Int16Array(readFileSync('public/generated/nav.i16').buffer.slice(0)), new Uint8Array(readFileSync('public/generated/nav_edges.u8')));
  const sim = new PeopleSim(seed, nav, env, { court }); const plan = buildTownPlan(); const terrain = loadTerrain(); const rivers = loadRiversFile();
  const canals = buildCanals(terrain, rivers.rivers, seed); const villages = placeVillages(terrain, rivers.rivers, canals, seed);
  const geo = new PopGeo({ pop: sim.pop, nav, town: plan, ground: (e, n) => terrain.heightAt(e, -n), villages, compounds: vi => villageCompounds(villages[vi], terrain, seed), canals: canals.map(c => c.pts), seed });
  const view = new PopView(sim, geo, seed); view.radius = 1e6; view.margin = 0; // (the whole world: everyone is a candidate)
  if (sample > 1) view.only = pid => { const p = sim.pop.persons[pid]; return p.hh % sample === 0 || (p.hh2 >= 0 && p.hh2 % sample === 0); };
  const out: TraceWorld = { seed, sim, geo, view, weather, pop: sim.pop, plan, villages, sample, court }; worlds.set(key, out); if (process.env.TRACE_T) console.error(`world ${((performance.now() - b0) / 1000).toFixed(1)} s`); return out;
}

// ------------------------------------------------------------------------------------------------ exemptions (T-D4)
/** people in the open in the rain by evidence, each with its reason (T-D4 "jobs exempted by evidence"). Only these; the
 *  rest of the people in the open in the rain count */
export const EXEMPT: { id: string; test: (s: Seg, vp: ViewPerson | null) => boolean; why: string }[] = [
  { id: 'watch', test: s => s.act === 'stand_guard' || s.act === 'patrol' || s.place.startsWith('post_') || s.place === 'terrace_round',
    why: 'the guard keeps his post in any weather: the royal guard stood watch at the palace gates (Hdt. 3.77, 3.118; the PF guard rations for posts held all year, PF 1802-1804 sorts; C for the hour)' },
  { id: 'courier', test: s => /courier|messenger|the letter/.test(s.why),
    why: 'the royal couriers ride in all weathers: "neither snow nor rain nor heat nor night" (Hdt. 8.98, A); the PF travel rations issued in every month (PF Q texts, A)' },
  { id: 'flock', test: s => (s.act === 'herd' || s.act === 'tend_animals') && /^(flock:|pasture:|route:)/.test(s.place),
    why: 'herdsmen stay with the flocks at pasture through the rain (the PF flock accounts run through the winter months, PF 2025-2030 sorts; ethnographic Fars transhumance, C)' },
  { id: 'fire', test: s => s.act === 'tend_fire',
    why: 'the kept fire is fed and sheltered through the rain by its magus (D-209; the PF lan and fire offerings issued in every month, A)' },
  { id: 'band', test: s => s.place.startsWith('camp:') || s.place.startsWith('route:'),
    why: 'travellers and transhumant bands in camp or on the move have no roof but their tents (E-49; C)' },
];
export const exemptOf = (s: Seg, vp: ViewPerson | null) => EXEMPT.find(x => x.test(s, vp))?.id ?? null;

// ------------------------------------------------------------------------------------------------ geometry: under a roof?
/** the drawn point is under a built roof: a room cell of a town or village raster, or inside a roofed Terrace building */
export function underRoof(W: TraceWorld, e: number, n: number): boolean {
  const tw = W.geo.town; const l = tw?.locate(e, n); if (l) { const s = tw!.boxes[l.si].s; return s.cell[l.k] >= 0 && s.sub[l.k] === ROOM; }
  // (every village raster holding the point: neighbouring villages' rasters overlap; a room in any of them is drawn there)
  for (let i = 0; i < W.villages.length; i++) { const v = W.villages[i]; if (Math.abs(e - v.x) > v.r * 1.3 + 20 || Math.abs(n - v.y) > v.r * 1.3 + 20) continue;
    const s = W.geo.villageSites()[i] as Site, [u, w] = toLocal(s.frame, e, n), ci = s.ci(u), cj = s.cj(w); if (s.inb(ci, cj)) { const k = s.k(ci, cj); if (s.cell[k] >= 0 && s.sub[k] === ROOM) return true; } }
  if (terraceRoofed(e, n)) return true; // (the roofed Terrace buildings of 467: roofs.ts)
  // (the court's camps: inside a tent's floor, camps.ts; court setting)
  const K = W.pop.court; if (K) for (const t of K.tents) { const r = Math.min(t.w, t.d) / 2; if (Math.abs(e - t.e) < r && Math.abs(n - t.n) < r) return true; }
  return false;
}
/** the area a point is in: 'terrace', 'town:<site>', 'village:<id>', 'open' */
export function areaOf(W: TraceWorld, e: number, n: number): string {
  const tw = W.geo.town; const l = tw?.locate(e, n); if (l) return `town:${W.plan.sites[l.si]?.id ?? l.si}`;
  for (const v of W.villages) if (Math.hypot(e - v.x, n - v.y) < v.r * 1.3 + 20) return `village:${v.id}`;
  const nav = W.sim.nav; if (nav.walkable(e, n)) return 'terrace';
  return 'open';
}

// ------------------------------------------------------------------------------------------------ the trace
export interface Break { pid: number; area: string; act: string; why: string; drawnAct: string; anim: string; what: string; e: number; n: number }
export interface TraceResult {
  seed: number; day: number; hour: number; rain: number; tempC: number; dark: boolean; sample: number;
  present: number; drawn: number; drawnOpen: number; /** drawn inside a room or tent, or under a Terrace roof */ drawnIn: number; /** the plan says indoors, no room built there: not drawn */ noRoom: number; noRoomBy: Record<string, number>;
  /** T-D3 */ d3: number; d3ByArea: Record<string, number>; d3Examples: Break[];
  /** the plan's weaker reading (not outdoors by the plan's own outdoors(), drawn in the open): reported, not gated */
  notOutdoorsDrawnOpen: number;
  /** T-D3s */ sleepSkipped: number; sleepHouseholds: number; sleepers: number; sleepOk: number; sleepFail: Record<string, number>; sleepFailByArea: Record<string, number>; sleepExamples: { pid: number; why: string; reason: string; what: string }[];
  /** T-D4 counts at this moment: drawn in the open, not exempt; the exempt by reason; with rain cover (the cloak) */
  open: number; openByArea: Record<string, number>; exempt: Record<string, number>; openByAct: Record<string, number>;
  /** the sick (lie_ill in the plan) drawn anywhere, and drawn under a roof */ sickPlanned: number; sickDrawn: number; sickDrawnIn: number;
  /** small children drawn with their carer (carried or held: popview babes), not as bodies of their own */ withCarer: number;
  /** the view's own counts (stats) */ viewStats: Record<string, number>;
}
const inc = (m: Record<string, number>, k: string, v = 1) => { m[k] = (m[k] ?? 0) + v; };
/** the whole world at (day, hour): settle the view (no budgets, as a test render) and compare every drawn person with their plan */
export function traceAt(W: TraceWorld, day: number, hour: number, o: { examples?: number } = {}): TraceResult {
  const t = day * 24 + hour, P = W.pop, V = W.view, S = W.sim, NX = o.examples ?? 12;
  const q0 = performance.now(); S.jumpTo(t); const q1 = performance.now(); V.settle(t, [-422, -941]); if (process.env.TRACE_T) console.error(`jump ${((q1 - q0) / 1000).toFixed(1)} s, settle ${((performance.now() - q1) / 1000).toFixed(1)} s`);
  const c = W.weather.conditions(day, hour), sun = sunTimes(day), dark = hour < sun.rise - 0.25 || hour > sun.set + 0.6, wx = P.cal.ctx(day).wx;
  // what is drawn: the population view's people (crowd.feedPool: skinned or impostor, same place and act) and the detailed
  // agents on the map (drawn from the simulation)
  const drawn = new Map<number, { e: number; n: number; act: ActivityId; why: string; moving: boolean; what: string; vp: ViewPerson | null }>();
  for (const vp of V.visible) { if (vp.agent >= 0 && !S.agents[vp.agent]?.offmap) continue; drawn.set(vp.pid, { e: vp.e, n: vp.n, act: vp.act, why: vp.why, moving: vp.moving, what: vp.what, vp }); }
  for (const a of S.visibleAgents([-422, -941], 1e7)) drawn.set(a.pid, { e: a.pos[0], n: a.pos[1], act: S.performance(a).act, why: a.task?.why ?? '', moving: a.walking, what: `detailed agent ${a.id} (${a.role})`, vp: null });
  // (children carried by a carer are drawn with the carer, not as bodies: popview `babes`; they are where the carer is)
  const carried = new Set<number>(), carerOf = new Map<number, number>(); for (const vp of V.visible) for (const b of vp.babes ?? []) { carried.add(b.pid); carerOf.set(b.pid, vp.pid); }
  const R: TraceResult = { seed: W.seed, day, hour, rain: c.rain, tempC: c.tempC, dark, sample: W.sample, present: 0, drawn: 0, drawnOpen: 0, drawnIn: 0, noRoom: 0, noRoomBy: {}, d3: 0, d3ByArea: {}, d3Examples: [], notOutdoorsDrawnOpen: 0,
    sleepSkipped: 0, sleepHouseholds: 0, sleepers: 0, sleepOk: 0, sleepFail: {}, sleepFailByArea: {}, sleepExamples: [], open: 0, openByArea: {}, exempt: {}, openByAct: {}, sickPlanned: 0, sickDrawn: 0, sickDrawnIn: 0, withCarer: 0, viewStats: { ...V.stats } };
  const anim = (pid: number, act: ActivityId, why: string, moving: boolean) => { const a2 = moving && !ACTIVITIES[act].moving ? 'walk' : act; return performanceFor(a2, why, 0, undefined, { sex: P.persons[pid].sex, age: P.ageOn(pid, day) }).anim; };
  const hhs = new Set<number>();
  const plotKey = (pid: number) => { const st = V.stateOf(pid); return st?.spot?.ok ? W.geo.plotAt(st.spot.e, st.spot.n) : 0; };
  for (let pid = 0; pid < P.persons.length; pid++) {
    if (W.view.only && !W.view.only(pid)) continue; if (!P.present(pid, day)) continue;
    const segs = P.plan(pid, day); if (!segs.length) continue; const s = segAt(segs, hour); if (s.where === 'away') continue; R.present++;
    const d = drawn.get(pid), inCarer = carried.has(pid);
    const indoor = planIndoors(s, wx, sun, hour);
    if (s.act === 'lie_ill') { R.sickPlanned++; if (d) { R.sickDrawn++; if (underRoof(W, d.e, d.n)) R.sickDrawnIn++; } }
    if (!d && inCarer) R.withCarer++;
    if (!d && !inCarer && V.stateOf(pid)?.spot?.noRoom) { R.noRoom++; inc(R.noRoomBy, (V.stateOf(pid)!.spot!.what.split(':')[0] + ' / ' + s.place.split(':')[0]).replace(/[qv]_\w+-\d+|-c\d+|village_\w+/g, '#')); }
    if (d) { R.drawn++; const open = !underRoof(W, d.e, d.n), area = areaOf(W, d.e, d.n); if (!open) R.drawnIn++;
      if (open) { R.drawnOpen++;
        if (!outdoors(s)) R.notOutdoorsDrawnOpen++;
        if (indoor) { R.d3++; inc(R.d3ByArea, area); if (R.d3Examples.length < NX) R.d3Examples.push({ pid, area, act: s.act, why: s.why, drawnAct: d.act, anim: anim(pid, d.act, d.why, d.moving), what: d.what, e: +d.e.toFixed(1), n: +d.n.toFixed(1) }); }
        const ex = exemptOf(s, d.vp); if (ex) inc(R.exempt, ex); else { R.open++; inc(R.openByArea, area); inc(R.openByAct, d.moving ? `${d.act} (moving)` : d.act); } } }
    else if (inCarer) { /* with the carer */ }
    // T-D3s: asleep at home (their own household's house) by the plan
    const home = P.home(pid, day);
    // (a sample of households: a child whose carer tonight lives outside the sample, a wet nurse's or a foster home's, is not
    // judged: the carer is not in the view; with --sample 1 there is none)
    if (s.act === 'sleep' && s.place === `h:${home}` && P.households[home] && s.with !== undefined && s.with >= 0 && !V.stateOf(s.with)) R.sleepSkipped++;
    else if (s.act === 'sleep' && s.place === `h:${home}` && P.households[home]) { R.sleepers++; hhs.add(home);
      // (MASTER_PLAN rev 2.1 anti-proxy: hidden is not asleep: the sleeper must be DRAWN lying where they sleep, their own
      // house; a small child carried asleep by a carer drawn asleep at home counts with the carer)
      let reason = '';
      const st = V.stateOf(pid), hks = W.geo.homePlotKeys(pid, day), hk = hks.length > 0, atHome = (e: number, n: number) => W.geo.plotsAt(e, n).some(k => hks.includes(k));
      if (d) { const a = anim(pid, d.act, d.why, d.moving); if (a !== 'sleep') reason = `drawn awake (${d.act}, ${a}; ${d.what})`; else if (!atHome(d.e, d.n)) reason = `drawn asleep away from home (${d.what})`; }
      else if (inCarer) { const c = carerOf.get(pid), cd = c !== undefined ? drawn.get(c) : undefined; if (!cd || !atHome(cd.e, cd.n)) reason = `carried by a carer not drawn at home (${cd?.what ?? 'carer not drawn'})`; }
      else if (!st) reason = 'not in the view';
      else if (!st.spot || !st.spot.ok) reason = `not placed: ${st.what}`;
      else if (st.spot.noRoom) reason = `no room built in the house (${st.what})`;
      else if (!hk) reason = `no house built for the household (${st.what})`;
      else reason = `not drawn (${st.what})`;
      if (!reason) R.sleepOk++; else { const k = reason.replace(/\(.*$/, '').trim(); inc(R.sleepFail, k); inc(R.sleepFailByArea, P.households[home].zone + ':' + P.households[home].q);
        if (R.sleepExamples.length < NX) R.sleepExamples.push({ pid, why: s.why, reason, what: st?.what ?? '' }); } }
  }
  R.sleepHouseholds = hhs.size;
  return R;
}

// ------------------------------------------------------------------------------------------------ the gate's moments
/** a daytime moment of rain >= minRain in the seed's weather (the first such day from `from`, the hour of heaviest rain
 *  between 8 and 16) */
export function findRainMoment(W: TraceWorld, minRain = 0.5, from = 0): { day: number; hour: number; rain: number } | null {
  for (let d = from; d < from + 354; d++) { const day = d % 354; let best = -1, bh = 0;
    for (let h = 8; h <= 16; h += 0.25) { const r = W.weather.conditions(day, h).rain; if (r > best) { best = r; bh = h; } }
    if (best >= minRain) return { day, hour: bh, rain: best }; }
  return null;
}
/** the dry twin of a day: the nearest day (±1…40) with no rain, no storm and no dust in the plan's weather */
export function findDryDay(W: TraceWorld, day: number): number {
  for (let k = 1; k <= 40; k++) for (const d of [day - k, day + k]) { if (d < 0 || d >= 354) continue; const wx = W.pop.cal.ctx(d).wx; if (!wx.rain && !wx.stormH && !wx.dustH && W.weather.conditions(d, 12).rain === 0) return d; }
  return -1;
}
/** a clear night: the first day from `from` with no rain at 23:00 */
export function findClearNight(W: TraceWorld, from = 25): number { for (let d = from; d < from + 354; d++) if (W.weather.conditions(d % 354, 23).rain === 0 && W.weather.conditions(d % 354, 22.5).rain === 0) return d % 354; return from; }
/** a day with many of the population sick (a sickness case) near `from` */
export function findSickDay(W: TraceWorld, from = 60): number { let best = from, bn = -1; for (let d = from; d < from + 20; d++) { const n = W.pop.sickOnsets(d); if (n > bn) { bn = n; best = d; } } return best; }

/** the first quarter-hour in daylight (8-16 h) from `from` at which the plan's rain begins (the moment people go in: the
 *  boundary lag), and 15 s after it */
export function findRainOnset(W: TraceWorld, from = 0): { day: number; hour: number } | null {
  for (let d = from; d < from + 354; d++) { const day = d % 354, wx = W.pop.cal.ctx(day).wx; if (!wx.rain) continue;
    for (let q = 33; q <= 64; q++) if (wx.rainQ[q] && !wx.rainQ[q - 1]) return { day, hour: q * 0.25 + 15 / 3600 }; }
  return null;
}
/** T-D4 per area: an area is judged when at least this many (sampled) people are in the open there at the dry twin's hour
 *  (fewer: the share is noise; listed, not judged) */
export const AREA_MIN = 20;
export interface Moment { kind: 'rain' | 'dry' | 'onset' | 'dusk' | 'night' | 'sick'; day: number; hour: number; r: TraceResult }
export interface GateResult { seed: number; sample: number; court: boolean;
  rains: { day: number; hour: number; rain: number; dryDay: number; open: number; dryOpen: number; share: number; openByArea: Record<string, number>; openByAct: Record<string, number>; exempt: Record<string, number>; covered: number; outInRain: number;
    /** T-D4 per area (the threshold's scope): areas with at least AREA_MIN people in the open on the dry twin are judged; the rest are listed */
    areas: { area: string; rain: number; dry: number; share: number }[]; worstArea: { area: string; share: number } | null; small: string[] }[];
  /** T-D4 at its scope: the worst judged area's share over both rain moments */ TD4area: number; areasJudged: number;
  night: { day: number; sleepers: number; sleepOk: number; share: number; sleepFail: Record<string, number> };
  sick: { day: number; sickPlanned: number; sickDrawn: number };
  d3ByMoment: Record<string, number>; d3ByArea: Record<string, number>; noRoom: Record<string, number>;
  TD3: number; TD3s: number; TD4: number; moments: Moment[] }
/** the three thresholds on one seed (T-E7: run on >= 3 seeds, one fresh). The moments, all found in the seed's own weather
 *  and calendar: two moments of rain >= 0.5 (the first from the year's start, the first from day 200) and the same hours
 *  of their dry twins; 15 s after a daytime onset of rain (the going in); 15 s after the dark falls on a dry day (dusk); a
 *  clear night at 23:00; a day with many sick at 10:00. T-D3: the sum over every moment; T-D3s: at 23:00; T-D4: the larger
 *  of the two rain shares */
export function gate(seed: number, sample = 1, court = true): GateResult {
  const W = buildTraceWorld(seed, sample, court), M: Moment[] = [], at = (kind: Moment['kind'], day: number, hour: number) => { const r = traceAt(W, day, hour); M.push({ kind, day, hour, r }); return r; };
  const rains: GateResult['rains'] = [];
  for (const from of [0, 200]) { const rm = findRainMoment(W, 0.5, from); if (!rm) throw new Error(`seed ${seed}: no rain >= 0.5 from day ${from}`);
    if (rains.some(x => x.day === rm.day)) continue; const dry = findDryDay(W, rm.day); if (dry < 0) throw new Error(`seed ${seed}: no dry twin of day ${rm.day}`);
    const rR = at('rain', rm.day, rm.hour);
    // (rain cover, reported: of those in the open in the rain, exempt or not, how many wear the cover their dress has: outfits.rainBits)
    let covered = 0, outInRain = 0; for (const vp of W.view.visible) { if (underRoof(W, vp.e, vp.n)) continue; outInRain++; const L = W.view.lookInput(vp.pid); if (rainBits(L.dress)[0]) covered++; }
    const dR = at('dry', dry, rm.hour);
    const areas = [...new Set([...Object.keys(rR.openByArea), ...Object.keys(dR.openByArea)])].map(a => { const x = rR.openByArea[a] ?? 0, y = dR.openByArea[a] ?? 0; return { area: a, rain: x, dry: y, share: y ? (100 * x) / y : x ? Infinity : 0 }; }).sort((a, b) => b.share - a.share);
    const judged = areas.filter(a => a.dry >= AREA_MIN), worst = judged[0] ? { area: judged[0].area, share: judged[0].share } : null;
    rains.push({ day: rm.day, hour: rm.hour, rain: rm.rain, dryDay: dry, open: rR.open, dryOpen: dR.open, share: dR.open ? (100 * rR.open) / dR.open : 0, openByArea: rR.openByArea, openByAct: rR.openByAct, exempt: rR.exempt, covered, outInRain,
      areas, worstArea: worst, small: areas.filter(a => a.dry < AREA_MIN).map(a => `${a.area} ${a.rain}/${a.dry}`) }); }
  const on = findRainOnset(W); if (on) at('onset', on.day, on.hour);
  const dd = rains[0].dryDay, sun = sunTimes(dd); at('dusk', dd, sun.set + 0.6 + 15 / 3600);
  const nR = at('night', findClearNight(W), 23), sR = at('sick', findSickDay(W), 10);
  const d3ByMoment: Record<string, number> = {}, d3ByArea: Record<string, number> = {}, noRoom: Record<string, number> = {};
  for (const m of M) { inc(d3ByMoment, `${m.kind} d${m.day} ${m.hour.toFixed(3)}h`, m.r.d3); for (const [k, v] of Object.entries(m.r.d3ByArea)) inc(d3ByArea, k, v); noRoom[`${m.kind} d${m.day}`] = m.r.viewStats.noRoom ?? 0; }
  const TD3s = nR.sleepers ? (100 * nR.sleepOk) / nR.sleepers : 100;
  return { seed, sample, court, rains, night: { day: nR.day, sleepers: nR.sleepers, sleepOk: nR.sleepOk, share: TD3s, sleepFail: nR.sleepFail }, sick: { day: sR.day, sickPlanned: sR.sickPlanned, sickDrawn: sR.sickDrawn },
    d3ByMoment, d3ByArea, noRoom, TD3: M.reduce((a, m) => a + m.r.d3, 0), TD3s, TD4: Math.max(...rains.map(x => x.share)), TD4area: Math.max(0, ...rains.map(x => x.worstArea?.share ?? 0)), areasJudged: rains.reduce((a, x) => a + x.areas.filter(y => y.dry >= AREA_MIN).length, 0), moments: M };
}

// ------------------------------------------------------------------------------------------------ evidence (MASTER_PLAN §4.1)
/** REVIEWS/evidence/<pass>/<id>.json for T-D3, T-D3s and T-D4 from gate runs ({id, value, n, commit, tool} and the detail).
 *  n is in each row's own sample unit: T-D3 "bot-hours" (these are snapshots of the whole world, not bot-hours: n = 0, the
 *  snapshots counted apart, so the row stays partial until the walker bots trace hours), T-D3s households traced asleep at
 *  23:00, T-D4 rain days x areas judged */
export function writeEvidence(pass: string, runs: GateResult[], commit: string): string[] {
  const dir = `REVIEWS/evidence/${pass}`; mkdirSync(dir, { recursive: true });
  const tool = 'tools/dev/people_trace.ts', date = new Date().toISOString().slice(0, 10), base = { commit, tool, pass, date, sample: runs[0]?.sample, runs: runs.map(g => ({ seed: g.seed, court: g.court })) };
  const per = (f: (g: GateResult) => unknown) => runs.map(g => ({ seed: g.seed, court: g.court, v: f(g) }));
  const out: Record<string, object> = {
    'T-D3': { id: 'T-D3', value: runs.reduce((a, g) => a + g.TD3, 0), n: 0, n_note: 'bot-hours: none (whole-world snapshots, counted in `snapshots`); the walker bots (MASTER_PLAN §3) must trace hours before this row can be built', snapshots: runs.reduce((a, g) => a + g.moments.length, 0),
      areas: [...new Set(runs.flatMap(g => g.moments.flatMap(m => [...Object.keys(m.r.openByArea), ...Object.keys(m.r.d3ByArea)])))].length, byRun: per(g => ({ d3: g.TD3, byMoment: g.d3ByMoment, byArea: g.d3ByArea })), ...base },
    'T-D3s': { id: 'T-D3s', value: Math.min(...runs.map(g => g.TD3s)), n: runs.reduce((a, g) => a + (g.moments.find(m => m.kind === 'night')?.r.sleepHouseholds ?? 0), 0), n_note: 'households with members asleep at home at 23:00, over the runs',
      byRun: per(g => ({ share: g.TD3s, sleepers: g.night.sleepers, ok: g.night.sleepOk, fails: g.night.sleepFail, day: g.night.day })), ...base },
    'T-D4': { id: 'T-D4', value: Math.max(...runs.map(g => g.TD4area)), n: runs.reduce((a, g) => a + g.areasJudged, 0), n_note: `rain days x areas judged (an area judged with >= ${AREA_MIN} sampled people in the open on the dry twin); value: the worst area's share`,
      byRun: per(g => ({ worldShare: g.TD4, worstArea: g.TD4area, rains: g.rains.map(r => ({ day: r.day, hour: r.hour, rain: r.rain, dryDay: r.dryDay, open: r.open, dryOpen: r.dryOpen, worst: r.worstArea, exempt: r.exempt, covered: r.covered, outInRain: r.outInRain, small: r.small })) })), ...base },
  };
  const files: string[] = []; for (const [id, e] of Object.entries(out)) { const f = `${dir}/${id}.json`; writeFileSync(f, JSON.stringify(e, null, 1) + '\n'); files.push(f); }
  return files;
}

// ------------------------------------------------------------------------------------------------ command line
const isMain = process.argv[1] && /people_trace\.ts$/.test(process.argv[1]);
if (isMain) {
  const arg = (k: string, d?: string) => { const i = process.argv.indexOf(`--${k}`); return i > 0 ? process.argv[i + 1] : d; };
  const seed = +(arg('seed', '1')!), sample = +(arg('sample', '1')!), json = process.argv.includes('--json'), court = !process.argv.includes('--no-court');
  const t0 = performance.now();
  if (process.argv.includes('--evidence')) {
    // --evidence <pass> --seeds 1,7,<fresh>: the gate on each seed with the court (the default) and on the first without it
    const pass = arg('evidence')!, seeds = (arg('seeds', '1,7')!).split(',').map(Number), commit = execSync('git rev-parse --short HEAD').toString().trim();
    const dirty = execSync('git status --porcelain -- src tools').toString().trim(); if (dirty) console.error(`(the tree has changes not committed: evidence is of ${commit} plus them)\n${dirty}`);
    const runs: GateResult[] = []; for (const s of seeds) { runs.push(gate(s, sample, true)); console.error(`seed ${s}: T-D3 ${runs[runs.length - 1].TD3}, T-D3s ${runs[runs.length - 1].TD3s.toFixed(2)}, T-D4 world ${runs[runs.length - 1].TD4.toFixed(2)} worst area ${runs[runs.length - 1].TD4area.toFixed(2)}`); }
    runs.push(gate(seeds[0], sample, false)); console.error(`seed ${seeds[0]} (no court): T-D3 ${runs[runs.length - 1].TD3}, T-D3s ${runs[runs.length - 1].TD3s.toFixed(2)}, T-D4 worst area ${runs[runs.length - 1].TD4area.toFixed(2)}`);
    for (const f of writeEvidence(pass, runs, commit + (dirty ? '+dirty' : ''))) console.log(f);
  } else if (process.argv.includes('--gate')) {
    const g = gate(seed, sample, court); const { moments, ...rest } = g;
    if (json) console.log(JSON.stringify(g, null, 1));
    else { console.log(JSON.stringify(rest, null, 1)); for (const { r } of moments) { console.log(`\n-- day ${r.day} ${r.hour.toFixed(2)} h: rain ${r.rain.toFixed(2)}; D3 ${r.d3}; examples:`); for (const x of r.d3Examples) console.log('  ', JSON.stringify(x)); if (r.sleepExamples.length) { console.log('  sleep fails:'); for (const x of r.sleepExamples) console.log('  ', JSON.stringify(x)); } } }
  } else {
    const W = buildTraceWorld(seed, sample, court); const r = traceAt(W, +(arg('day', '25')!), +(arg('hour', '10')!), { examples: 30 });
    console.log(json ? JSON.stringify(r, null, 1) : JSON.stringify({ ...r, d3Examples: undefined, sleepExamples: undefined, viewStats: undefined }, null, 1));
    if (!json) { console.log('D3 examples:'); for (const x of r.d3Examples) console.log('  ', JSON.stringify(x)); console.log('sleep fails:'); for (const x of r.sleepExamples) console.log('  ', JSON.stringify(x)); }
  }
  console.error(`(${((performance.now() - t0) / 1000).toFixed(0)} s)`);
}
