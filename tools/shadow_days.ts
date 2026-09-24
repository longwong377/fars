// §13.11 shadow review input: 20 people, each followed for one full day, written as plain-text timelines for an
// independent reviewer (REVIEWS/shadow_*.md). The pick is stratified so that the town, the Terrace's work gangs and the
// detailed tier are all shadowed (S12 of REVIEWS/shadow_phase5_r4.md: a sample of per-person draws had no townsperson,
// and four of its six detailed agents were guards):
//  - 6 detailed Terrace agents: 3 guards and 3 of the others (masons and their foreman, porters, scribes, bakers and
//    grinders, children, couriers, officials), each stepped through its day in a sim of its own (below);
//  - 14 people of the population (their day plans): 2 who work on the Terrace (builders, work-camp women, the Terrace's
//    porters, the Treasury's staff, the palace caretakers), 3 other townspeople, the six cases round 5 asked to see (a
//    man at work in the open on a rain day, a child past a birthday, a baby under four months, a herder, a traveller or
//    messenger, a vigil night: pickSample), and the rest (3) drawn from everyone.
// Each person's day is a day of the year (1-354) on which the person is alive and here (tools/shadow_pick.ts).
// Independence (S12): each detailed agent is stepped in a fresh simulation that jumps straight to the start of its day, and
// the population's plans come from a simulation that was never stepped, so no person's day depends on which other days
// were drawn or stepped before it (the detailed people's shared meals change later days' relationships in a stepped sim).
// What remains: a jump places everyone where the plan puts them at midnight, and the slice's sacks start from the initial
// stock (the depot's and the Treasury store's), not from the stock a sim running since day 1 would have.
// The shadowed agent walks the real nav-grid routes (full LOD, what the renderer is asked to draw); the others travel in
// the abstract LOD. Every change of what is performed is logged, with no elision.
// Usage: npx tsx tools/shadow_days.ts [seed=1] [pickSeed=7] > REVIEWS/shadow_days_input_seedS_pickP.txt
import { readFileSync } from 'node:fs';
import { NavGrid } from '../src/people/navgrid';
import { PeopleSim, Env } from '../src/people/sim';
import { WeatherSystem } from '../src/weather/weatherState';
import { Rng } from '../src/core/rng';
import { ACTIVITIES } from '../src/people/activities';
import { dateOf, MONTHS, REGNAL_DAYS, rainHours } from '../src/people/calendar';
import { presentDay } from './shadow_pick';

/** the placeholder flag (D-024): an activity simulated but with no performance */
const ph = (a: string) => ((ACTIVITIES as any)[a]?.placeholder ? ' [PLACEHOLDER: not performed]' : '');
export const hm = (h: number) => { const m = Math.floor(h * 60 + 1e-6); return `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`; };
let NAV: NavGrid | null = null;
const nav = () => (NAV ??= new NavGrid(new Int16Array(readFileSync('public/generated/nav.i16').buffer.slice(0)), new Uint8Array(readFileSync('public/generated/nav_edges.u8'))));
const envOf = (W: WeatherSystem) => (t: number): Env => { const d = Math.floor(t / 24), c = W.conditions(d % W.days.length, t - d * 24); return { rain: c.rain, lightning: c.lightning, windMs: c.windMs, tempC: c.tempC, dust: c.dust }; };
/** a fresh simulation (nothing stepped, no relationship changes from earlier days) */
export function freshSim(seed: number) { const W = new WeatherSystem(seed); return { sim: new PeopleSim(seed, nav(), envOf(W)), W }; }

/** the Julian date of a day of the regnal year (day 0 = 17 April 467 BCE, Julian: research/CALENDAR_AND_UNITS.md) */
export function julian(d: number) {
  const ML = [['Jan', 31], ['Feb', 28], ['Mar', 31], ['Apr', 30], ['May', 31], ['Jun', 30], ['Jul', 31], ['Aug', 31], ['Sep', 30], ['Oct', 31], ['Nov', 30], ['Dec', 31]] as [string, number][];
  let m = 3, day = 17 + d, y = 467; while (day > ML[m][1]) { day -= ML[m][1]; m++; if (m === 12) { m = 0; y = 466; } } // 467 and 466 BCE are not leap years (Julian)
  return `${day} ${ML[m][0]} ${y} BCE`;
}
/** the day's line: the regnal day, the Babylonian date, the Julian date, the sun (local solar time) */
export function dayLine(sim: PeopleSim, W: WeatherSystem, d: number) {
  const { month, dom } = dateOf(d), C = sim.cal.ctx(d), c = W.conditions(d, 12), w = W.days[d];
  return `day ${d + 1} of the regnal year · ${MONTHS[month - 1].bab} ${dom} (${julian(d)}) · sunrise ${hm(C.sun.rise)}, sunset ${hm(C.sun.set)} · weather: ${w.tmin.toFixed(0)}–${w.tmax.toFixed(0)} °C, cloud ${(c.cloud * 100).toFixed(0)} %, ${w.wet ? (w.snow ? 'snow' : 'rain') + ` ${w.precipMm.toFixed(1)} mm` : 'dry'}, wind ${c.windMs.toFixed(0)} m/s${w.dust ? ', dust' : ''}`
    // the hours the planners obey (the calendar's day: rain > 0.25 = shelter, lightning or rain > 0.7 = storm, dust > 0.25;
    // S6 of reviewer A / S8 of reviewer B, r6: a storm 05:45-13:30 was printed as "rain")
    + (C.wx.rain ? ` · rain ${hm(C.wx.rain[0])}–${hm(C.wx.rain[1])}` : '') + (C.wx.stormH ? ` · storm ${hm(C.wx.stormH[0])}–${hm(C.wx.stormH[1])}` : '') + (C.wx.dustH ? ` · dust in the air ${hm(C.wx.dustH[0])}–${hm(C.wx.dustH[1])}` : '');
}
/** age on the day (the year's birthdays counted); months for the under-threes */
export const ageStr = (P: any, pid: number, d: number) => { const p = P.persons[pid], a = P.ageOn(pid, d);
  if (a >= 3) return `${a}`; const born = p.born >= 0 ? p.born : (p.bday >= 0 ? p.bday - 354 * (p.age + 1) : -Math.round(354 * (p.age + 0.5)));
  const mo = Math.max(0, Math.floor((d - born) / 29.5)); return mo < 24 ? `${mo} months` : `${a}`; };
// (a member who is ill today is marked: S8 of reviewer B, r5: a mother's sickness was invisible in her child's day)
const members = (P: any, h: number, d: number) => P.membersOn(h, d).map((x: number) => `${x} ${P.persons[x].job} ${P.persons[x].sex}${ageStr(P, x, d)}${P.sick(x, d) ? ' (ill today)' : ''}`).join(', ');

/** a population person who works on the Terrace (the gangs, the work camp, the Terrace porters, the Treasury's staff inside,
 *  the palace caretakers) and one of the town's households */
export const terraceWorker = (p: any) => p.agent < 0 && (p.job === 'builder' || p.job === 'camp' || (p.job === 'porter' && p.sub === 'terrace') || p.work === 'treasury_inside' || p.work === 'treasury_store' || p.job === 'caretaker');
export const townsperson = (P: any, p: any) => p.agent < 0 && P.households[p.hh]?.zone === 'town' && !terraceWorker(p);
export interface Pick { detailed: { id: number; day: number; stratum: string }[]; population: { pid: number; day: number; stratum: string }[] }
/** the stratified draw (seeded). Detailed: 3 guards (one of them a leader of ten) and 3 other detailed agents. Population:
 *  2 Terrace workers, 3 townspeople, and, as both round-5 reviewers asked for the next round (REVIEWS/shadow_phase5_r5.md
 *  "minimum before a re-review" 4; shadow_phase5_r5_b.md 5), one of each of the cases round 5 could not test: a man who works
 *  in the open on a day with at least an hour of rain in daylight, a child who has had a birthday this year that moves it
 *  across an age rule (1, 5 or 8 on the day), a baby under four months, a transhumant herder, a traveller or a messenger of
 *  the road station, and a man sitting up by the grain heap on a threshing night; then 3 of everyone. Days 0-353 (printed
 *  1-354); each draw is re-drawn until the person is alive and here, and on the day the stratum names (D-175) */
export function pickSample(P: any, sim: PeopleSim, pickSeed: number): Pick {
  const pick = new Rng(pickSeed, 'shadow-pick'), anyDay = () => pick.int(0, REGNAL_DAYS - 1);
  const out: Pick = { detailed: [], population: [] }; const taken = new Set<number>();
  const drawFrom = (pool: number[], n: number, stratum: string, into: (x: number, d: number, s: string) => void, pidOf: (x: number) => number, dayOk: (pid: number, d: number) => boolean = () => true) => {
    if (!pool.length) return;
    for (let k = 0, got = 0; got < n && k < 5000; k++) { const x = pool[pick.int(0, pool.length - 1)]; const pid = pidOf(x); if (taken.has(pid)) continue;
      const d = presentDay(P, pid, anyDay); if (d < 0 || !dayOk(pid, d)) continue; taken.add(pid); into(x, d, stratum); got++; } };
  const guards = sim.agents.filter(a => a.role === 'guard').map(a => a.id), others = sim.agents.filter(a => a.role !== 'guard').map(a => a.id);
  const leaders = guards.filter(id => P.persons[sim.agents[id].pid]?.rank === 1);
  const addA = (x: number, d: number, s: string) => out.detailed.push({ id: x, day: d, stratum: s }), pidA = (x: number) => sim.agents[x].pid;
  drawFrom(leaders, 1, 'detailed: a guard, a leader of ten', addA, pidA); drawFrom(guards, 2, 'detailed: a guard', addA, pidA); drawFrom(others, 3, 'detailed: not a guard', addA, pidA);
  const ids = P.persons.map((_: any, i: number) => i) as number[];
  const addP = (x: number, d: number, s: string) => out.population.push({ pid: x, day: d, stratum: s }), same = (x: number) => x;
  const resident = (pid: number, d: number) => ['town', 'plain'].includes(P.households[P.home(pid, d)]?.zone);
  drawFrom(ids.filter(i => terraceWorker(P.persons[i])), 2, 'a Terrace worker of the population', addP, same);
  drawFrom(ids.filter(i => townsperson(P, P.persons[i])), 3, 'a townsperson', addP, same);
  // (the conditioned strata draw the day first from the days that qualify, then the person)
  const rainDays = Array.from({ length: REGNAL_DAYS }, (_, d) => d).filter(d => { const C = P.cal.ctx(d); return rainHours(C.wx, C.sun.rise, C.sun.set) >= 1; });
  const outdoor = ids.filter(i => { const p = P.persons[i]; return p.agent < 0 && p.sex === 'm' && p.age >= 15 && ['farmer', 'gardener', 'shepherd'].includes(p.job); });
  for (let k = 0; k < 5000 && rainDays.length; k++) { const d = rainDays[pick.int(0, rainDays.length - 1)], pid = outdoor[pick.int(0, outdoor.length - 1)];
    if (taken.has(pid) || !P.present(pid, d) || !resident(pid, d) || P.sick(pid, d)) continue; taken.add(pid); addP(pid, d, 'a man who works in the open, on a day with rain in daylight'); break; }
  // (born before the year: a baby born this year keeps a stray `bday` and is 0 on both sides of it, so it crosses no age rule:
  // S1 of reviewer A, S7 of reviewer B, round 8, a baby of 2 months drawn for the stratum; and it is a year older on the day)
  drawFrom(ids.filter(i => P.persons[i].job === 'child' && P.persons[i].agent < 0 && P.persons[i].born < 0 && P.persons[i].bday >= 0 && [0, 4, 7].includes(P.persons[i].age)), 1, 'a child past a birthday that moves it across an age rule (1, 5 or 8 on the day)', addP, same,
    (pid, d) => resident(pid, d) && d >= P.persons[pid].bday && P.ageOn(pid, d) === P.persons[pid].age + 1);
  drawFrom(ids.filter(i => P.persons[i].job === 'child' && P.persons[i].agent < 0 && (P.persons[i].born >= 0 || P.persons[i].age === 0)), 1, 'a baby under four months', addP, same,
    (pid, d) => resident(pid, d) && P.ageDays(pid, d) >= 0 && P.ageDays(pid, d) < 120);
  drawFrom(ids.filter(i => P.persons[i].job === 'herder'), 1, 'a transhumant herder', addP, same);
  drawFrom(ids.filter(i => P.persons[i].agent < 0 && (P.persons[i].job === 'traveller' || P.persons[i].job === 'messenger')), 1, 'a traveller or a messenger of the road station', addP, same);
  const threshDays = Array.from({ length: REGNAL_DAYS }, (_, d) => d).filter(d => P.cal.ctx(d).agri.has('E-43')), plainH = P.households.filter((H: any) => H.zone === 'plain').map((H: any) => H.id) as number[];
  for (let k = 0; k < 20000 && threshDays.length; k++) { const d = threshDays[pick.int(0, threshDays.length - 1)], h = plainH[pick.int(0, plainH.length - 1)], pid = P.vigilMan(h, d);
    if (pid < 0 || taken.has(pid)) continue; taken.add(pid); addP(pid, d, 'a man sitting up by the grain heap on a threshing night'); break; }
  drawFrom(ids.filter(i => P.persons[i].agent < 0), 20 - out.detailed.length - out.population.length, 'anyone', addP, same);
  return out;
}

const LOAD: Record<string, string> = { sack: 'a sack', jar: 'a jar', jar_head: 'a jar of water on the head', basket: 'a bread basket' };
/** one detailed agent's day, stepped minute by minute in a fresh simulation (independent of any other day stepped), the
 *  agent in the full LOD; every change of what is performed, where and why is a line (no elision) */
export function detailedDay(seed: number, id: number, d: number): { head: string[]; log: string[] } {
  const { sim, W } = freshSim(seed); for (const a of sim.agents) a.lod = 'abstract'; const a = sim.agents[id]; a.lod = 'full';
  sim.jumpTo(d * 24); const P: any = sim.pop, pid = a.pid, H = P.households[P.home(pid, d)], ag = P.ageOn(pid, d);
  const sx = ag < 14 ? (a.sex === 'm' ? 'boy' : 'girl') : (a.sex === 'm' ? 'man' : 'woman');
  const head = [`## Detailed agent #${id}: ${a.name ?? '(unnamed)'} — ${a.role}, ${sx} ${ag}, ${a.origin}${a.name ? ` (name ${a.nameTier}: ${a.nameNote})` : ''}; speaks ${a.langs.join(', ')}; person ${pid}`,
    `${dayLine(sim, W, d)} · household ${H.id} (${H.q ?? H.zone}, home ${H.home}, ${P.membersOn(H.id, d).length} people: ${members(P, H.id, d)})`];
  let last = ''; const log: string[] = [];
  for (let t = d * 24; t < d * 24 + 24 - 1e-9; t += 1 / 60) {
    while (sim.t < t - 1e-9) sim.step(Math.min(60, (t - sim.t) * 3600));
    // "→ place" on the way there, "@ place" once there; what is performed (the renderer's act, as it is: a guard walking to
    // his own post performs `patrol`, the armed guard's walk, and is marked so: S10 of round 4 read it as a round), the
    // physical load or what the plan says is carried; "[off the Terrace: not drawn]" when the person is in the town or the
    // plain (hidden, doing what the plan says)
    const tk = a.task, act = sim.performance(a).act, toPost = a.walking && act === 'patrol' && tk?.act === 'stand_guard';
    const held = a.carry ? LOAD[a.carry] ?? a.carry : tk?.holds;
    const s = `${act}${ph(act)}${toPost ? ' (the armed walk to his own post, not a round)' : ''} ${a.walking ? '→' : '@'} ${tk?.place ?? '-'} — ${tk?.why ?? ''}${held ? ` [carrying ${held}]` : ''}${tk?.wears ? ` [${tk.wears}]` : ''}${a.sick ? ' [sick]' : ''}${a.offmap ? ' [off the Terrace: not drawn]' : ''}`;
    if (s !== last) { log.push(`${hm(t - d * 24)}  ${s}`); last = s; }
  }
  return { head, log };
}
/** a population person's day plan, as lines */
export function populationDay(sim: PeopleSim, W: WeatherSystem, pid: number, d: number): { head: string[]; log: string[] } {
  const P: any = sim.pop, p = P.persons[pid], H = P.households[P.home(pid, d)];
  const head = [`## Person ${pid}: ${P.nameOf(pid) ?? '(unnamed)'} — ${p.job}${p.sub ? ` (${p.sub})` : ''}, ${p.sex === 'm' ? 'male' : 'female'}, age ${ageStr(P, pid, d)}, ${p.origin}, zone ${p.zone}`,
    `${dayLine(sim, W, d)} · household ${H.id} (${H.zone}${H.q ? ` ${H.q}` : ''}, ${P.membersOn(H.id, d).length} people: ${members(P, H.id, d)})${P.sick(pid, d) ? ' · SICK today' : ''}`];
  const log = (P.plan(pid, d) as any[]).map(s => `${hm(s.t0)}–${hm(s.t1)}  ${s.act}${ph(s.act)} @ ${s.place} (${s.where}) — ${s.why}${s.with !== undefined ? ` [with ${s.with}]` : ''}${s.carry ? ` [carrying ${s.carry}]` : ''}${s.wear ? ` [${s.wear}]` : ''}${s.ev ? ` {${s.ev}}` : ''}`);
  return { head, log };
}

if (process.argv[1]?.endsWith('shadow_days.ts')) {
  const seed = +(process.argv[2] ?? 1), pickSeed = +(process.argv[3] ?? 7);
  const base = freshSim(seed), P: any = base.sim.pop; const S = pickSample(P, base.sim, pickSeed);
  const out: string[] = [`# Shadow days (§13.11): 20 people, one full day each (seed ${seed}, pick seed ${pickSeed}); court absent (D-003). Times are local solar hours; dates are the Babylonian month and day and the Julian date.`,
    `Pick (stratified): ${S.detailed.map(x => `#${x.id} (${x.stratum})`).join(', ')}; ${S.population.map(x => `${x.pid} (${x.stratum})`).join(', ')}.`,
    'Each detailed agent is stepped alone in a fresh simulation from midnight of its day, walking the real routes; "[off the Terrace: not drawn]" marks hours it spends hidden in the town or the plain. Population people are their day plans.'];
  for (const x of S.detailed) { const r = detailedDay(seed, x.id, x.day); out.push('', ...r.head, ...r.log); }
  for (const x of S.population) { const r = populationDay(base.sim, base.W, x.pid, x.day); out.push('', ...r.head, ...r.log); }
  console.log(out.join('\n'));
}
