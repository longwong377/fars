// §13.11 soak test (the anti-diorama gate): run the people simulation headless for one in-game year and measure
//  - variety: per person, each day's signature = the (place, activity) held in each 30-minute bucket; similarity of two
//    days = fraction of buckets that agree. Buckets are coarse, so jitter of a few minutes does not count as variety.
//    A pair of days is a near-copy when similarity ≥ NEAR_COPY. Gate: for EVERY person, < 10 % of pairs are near-copies.
//    Measured for (a) the detailed Terrace agents, simulated step by step (everyone in the abstract LOD), and (b) every
//    person of the population (~46,000 incl. the year's newborns and transients), from their day plans (D-021).
//    Diagnostic (not a gate): a timing-blind similarity (overlap of time shares per (place, activity)) on a sample, to
//    show the variety is not just the same day shifted by an hour.
//  - events: distinct event kinds per week, counted over the research taxonomy only (events_calendar.json `kind`);
//    the floor is 8 (EVENTS.md §10, D-021; raised from D-017's 6).
//  - stability: nobody stuck (the same task > 30 h for detailed agents; the same (place, activity) > 30 h in a plan);
//    the slice's sacks (the Treasury's, and the work camp's barley and flour) stay in [0, 5000]; every store stays within its bounds (calendar.ts STORE_BOUNDS) and no ration
//    group goes short two issues running (CE-03 collapse).
//  - rendered honesty: no detailed agent on the Terrace ever performs an activity outside PeopleSim.EMITS or a placeholder.
//  - plans well formed (planCheck.ts): every person-day of every plan (the detailed agents' plans too) is checked for a
//    night's sleep, an activity that contradicts its own reason, meals for adults awake through a day, and yesterday's
//    end matching today's start; on every third day (118 days) every person is also checked for being "with" someone
//    who is elsewhere (a person in two places) and every child under ten for being alone at night. Gate: no issue at all.
//  - visible change: construction progress week by week and the seasonal state.
//  - cost: step() at 60 fps with the full population (ms/frame), and the day-rollover spike.
// Usage: npx tsx tools/soak.ts [days=354] [dtSeconds=60] [seed=1] [--sample N] [--court]
//   → prints a summary, writes bench-reports/soak-*.json
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { NavGrid } from '../src/people/navgrid';
import { PeopleSim, Env } from '../src/people/sim';
import { ACTIVITIES } from '../src/people/activities';
import { segAt, Seg } from '../src/people/population';
import { checkPlan, checkDay } from '../src/people/planCheck';
import { EVENT_KINDS, STORE_BOUNDS, Stores } from '../src/people/calendar';
import { WeatherSystem } from '../src/weather/weatherState';
import { seasonAt } from '../src/world/season';

export const SOAK_GATES = {
  NEAR_COPY: 0.9,          // two days agreeing in ≥ 90 % of their half-hour buckets are near-copies
  MAX_NEAR_COPY_SHARE: 0.1, // pass: for every person, < 10 % of all pairs of days are near-copies
  MIN_EVENT_KINDS_WEEK: 8, // pass: every week has ≥ 8 distinct kinds of event (EVENTS.md §10; DECISIONS D-021; D-017 had 6)
  STUCK_HOURS: 30,
  SACKS_MAX: 5000,
  CONSTRUCTION_WEEKS: 0.75, // visible change: construction advances in at least 3 weeks out of 4
};
const B = 48;
/** near-copy count and similarity statistics over all pairs of the given days (codes: Uint8, 48 per day) */
function pairStats(sig: Uint8Array, days: number[], full: boolean) {
  const n = days.length; let pairs = 0, near = 0, simSum = 0, maxSim = 0; const lim = Math.floor(B * (1 - SOAK_GATES.NEAR_COPY) + 1e-9); // ≤ 4 differing buckets
  for (let x = 0; x < n; x++) { const ox = days[x] * B; for (let y = x + 1; y < n; y++) { const oy = days[y] * B; let diff = 0;
    if (full) { for (let b = 0; b < B; b++) if (sig[ox + b] !== sig[oy + b]) diff++; const s = 1 - diff / B; simSum += s; if (s > maxSim) maxSim = s; }
    else { for (let b = 0; b < B && diff <= lim; b++) if (sig[ox + b] !== sig[oy + b]) diff++; }
    pairs++; if (diff <= lim) near++; } }
  return { pairs, near, share: pairs ? near / pairs : 0, mean: full && pairs ? simSum / pairs : NaN, max: full ? maxSim : NaN };
}
/** timing-blind day similarity: overlap of the time shares of each state (diagnostic) */
function histShare(sig: Uint8Array, days: number[]) {
  const H = days.map(d => { const m = new Map<number, number>(); for (let b = 0; b < B; b++) { const c = sig[d * B + b]; m.set(c, (m.get(c) ?? 0) + 1); } return m; });
  let pairs = 0, near = 0; for (let x = 0; x < H.length; x++) for (let y = x + 1; y < H.length; y++) { let s = 0; for (const [c, k] of H[x]) s += Math.min(k, H[y].get(c) ?? 0); pairs++; if (s / B >= SOAK_GATES.NEAR_COPY) near++; }
  return pairs ? near / pairs : 0;
}

export function runSoak(days = 354, dt = 60, seed = 1, log = (s: string) => console.log(s), opts: { sample?: number; court?: boolean; skipPopulation?: boolean } = {}) {
  const nav = new NavGrid(new Int16Array(readFileSync('public/generated/nav.i16').buffer.slice(0)), new Uint8Array(readFileSync('public/generated/nav_edges.u8')));
  const W = new WeatherSystem(seed);
  const env = (t: number): Env => { const d = Math.floor(t / 24), c = W.conditions(d % W.days.length, t - d * 24); return { rain: c.rain, lightning: c.lightning, windMs: c.windMs, tempC: c.tempC, dust: c.dust }; };
  const tBuild = Date.now();
  const sim = new PeopleSim(seed, nav, env, { court: !!opts.court });
  const buildMs = Date.now() - tBuild;
  for (const a of sim.agents) a.lod = 'abstract';
  sim.jumpTo(0);
  const N = sim.agents.length;
  // ---------------------------------------------------------------- (a) the detailed agents, step by step
  const codesA = new Map<string, number>(); const codeA = (k: string) => { let c = codesA.get(k); if (c === undefined) { c = codesA.size + 1; codesA.set(k, c); } return c; };
  const sigA: Int32Array[] = sim.agents.map(() => new Int32Array(days * B));
  const lastChange = new Float64Array(N), lastTask: (string | null)[] = Array(N).fill(null);
  const stuck: { id: number; role: string; act: string; hours: number }[] = []; const rendered: Record<string, number> = {}; const badRendered: string[] = [];
  let sacks = { min: Infinity, max: -Infinity };
  const t0 = Date.now();
  for (let d = 0; d < days; d++) {
    for (let b = 0; b < B; b++) {
      const until = d * 24 + (b + 1) * 0.5;
      while (sim.t < until - 1e-9) sim.step(Math.min(dt, (until - sim.t) * 3600));
      sim.agents.forEach((a, i) => {
        const task = a.task; const act = sim.performance(a).act; sigA[i][d * B + b] = codeA(`${task?.place ?? '-'}|${act}`);
        if (!a.offmap) { rendered[act] = (rendered[act] ?? 0) + 1; if ((!PeopleSim.EMITS.includes(act) || ACTIVITIES[act]?.placeholder) && badRendered.length < 20) badRendered.push(`${a.id} ${a.role} ${act} @${task?.place} day ${d}`); }
        const tk = task ? `${task.act}@${task.place}@${task.until.toFixed(3)}` : '-';
        if (tk !== lastTask[i]) { lastTask[i] = tk; lastChange[i] = sim.t; }
        else if (sim.t - lastChange[i] > SOAK_GATES.STUCK_HOURS && !stuck.some(s => s.id === a.id)) stuck.push({ id: a.id, role: a.role, act: task?.act ?? '-', hours: +(sim.t - lastChange[i]).toFixed(1) });
      });
      // every stock of the slice's goods, the camp's barley and flour too (S6 of shadow review r5)
      const sv = Object.values(sim.stock); sacks = { min: Math.min(sacks.min, ...sv), max: Math.max(sacks.max, ...sv) };
    }
    if (d % 30 === 29) log(`  detailed agents: day ${d + 1}: ${((Date.now() - t0) / 1000).toFixed(0)} s`);
  }
  const detailedSeconds = (Date.now() - t0) / 1000;
  const allDays = Array.from({ length: days }, (_, i) => i);
  const perAgent = sim.agents.map((a, i) => { const s8 = new Uint8Array(days * B); const m = new Map<number, number>(); for (let k = 0; k < s8.length; k++) { let c = m.get(sigA[i][k]); if (c === undefined) { c = Math.min(255, m.size + 1); m.set(sigA[i][k], c); } s8[k] = c; }
    const presentDays = allDays.filter(d => sim.pop.present(a.pid, d)); const st = pairStats(s8, presentDays, true);
    return { id: a.id, pid: a.pid, role: a.role, days: presentDays.length, nearCopyShare: +st.share.toFixed(3), meanSimilarity: +st.mean.toFixed(3), maxSimilarity: +st.max.toFixed(3), timingBlindNearCopy: +histShare(s8, presentDays).toFixed(3) }; });
  const byRole: Record<string, { n: number; nearCopyShare: number; worst: number; meanSimilarity: number; timingBlind: number }> = {};
  for (const p of perAgent) { const r = (byRole[p.role] ??= { n: 0, nearCopyShare: 0, worst: 0, meanSimilarity: 0, timingBlind: 0 }); r.n++; r.nearCopyShare += p.nearCopyShare; r.meanSimilarity += p.meanSimilarity; r.timingBlind += p.timingBlindNearCopy; r.worst = Math.max(r.worst, p.nearCopyShare); }
  for (const r of Object.values(byRole)) { r.nearCopyShare = +(r.nearCopyShare / r.n).toFixed(3); r.meanSimilarity = +(r.meanSimilarity / r.n).toFixed(3); r.timingBlind = +(r.timingBlind / r.n).toFixed(3); }
  // ---------------------------------------------------------------- calendar: kinds per week, stores, shortfalls, construction
  const cal = sim.cal; cal.ctx(days - 1);
  const taxonomy = new Set(EVENT_KINDS); const weeks: Set<string>[] = []; const other = new Set<string>();
  for (let d = 0; d < days; d++) { const w = Math.floor(d / 7); weeks[w] ??= new Set(); for (const e of cal.days[d].events) { if (taxonomy.has(e.kind)) weeks[w].add(e.kind); else other.add(e.kind); } }
  for (const e of sim.events) if (!taxonomy.has(e.kind)) other.add(e.kind);
  const kindsPerWeek = weeks.map(s => s.size);
  const stores: Record<string, { min: number; max: number; start: number; end: number; bounds: [number, number] | null; ok: boolean }> = {};
  for (const k of Object.keys(cal.stockLog[0]) as (keyof Stores)[]) { let mn = Infinity, mx = -Infinity; for (let d = 0; d < days; d++) { const v = cal.stockLog[d][k]; mn = Math.min(mn, v); mx = Math.max(mx, v); }
    const bd = STORE_BOUNDS[k]; stores[k] = { min: Math.round(mn), max: Math.round(mx), start: Math.round(cal.stockLog[0][k]), end: Math.round(cal.stockLog[days - 1][k]), bounds: bd, ok: !bd || (mn >= bd[0] && mx <= bd[1]) }; }
  const shortRuns: Record<number, number[]> = {}; for (const s of cal.shortfalls) if (!s.paidSilver) (shortRuns[s.group] ??= []).push(s.day);
  const collapse = Object.entries(shortRuns).filter(([, ds]) => ds.some((x, i) => i > 0 && x - ds[i - 1] < 40)).map(([g]) => sim.pop.groups[+g].label);
  const C = cal.construction; const weekly: { drumsSet: number; fluted: number; courses: number; relief: number }[] = [];
  for (let d = 0; d < days; d++) { const w = Math.floor(d / 7); const x = C.daily[d]; weekly[w] ??= { drumsSet: 0, fluted: 0, courses: 0, relief: 0 }; if (x) { weekly[w].drumsSet += x.drumsSet; weekly[w].fluted += x.fluted; weekly[w].courses += x.courses; weekly[w].relief += x.relief; } }
  const advanced = weekly.filter(w => w.drumsSet + w.courses > 0 || w.fluted > 0.005 || w.relief > 0.0005).length;
  const construction = { raisedAtEnd: C.raised, drumsSet: weekly.reduce((s, w) => s + w.drumsSet, 0), shaftsFluted: +weekly.reduce((s, w) => s + w.fluted, 0).toFixed(2), coursesLaid: weekly.reduce((s, w) => s + w.courses, 0),
    reliefDoorways: +weekly.reduce((s, w) => s + w.relief, 0).toFixed(3), weeksAdvanced: advanced, weeks: weekly.length, walls: { ...C.walls }, capitalsSet: C.columns.filter(c => c.capitalSet).length };
  const lifeCounts = { births: 0, deaths: 0, marriages: 0, sick: 0, birthdays: 0 } as Record<string, number>; for (let d = 0; d < days; d++) for (const k of Object.keys(lifeCounts)) lifeCounts[k] += cal.days[d].counts[k] ?? 0;
  // ---------------------------------------------------------------- (b) the population, from its day plans
  const P = sim.pop; const persons = P.persons.length; const ids: number[] = [];
  const sampleN = opts.sample ?? 0; for (let i = 0; i < persons; i++) ids.push(i);
  if (sampleN && sampleN < persons) { // a seeded random sample (without replacement), stratified by nothing: every person equally likely
    for (let i = persons - 1; i > 0; i--) { const j = Math.floor(((Math.imul(i + seed, 2654435761) >>> 0) / 4294967296) * (i + 1)); [ids[i], ids[j]] = [ids[j], ids[i]]; } ids.length = sampleN; }
  const popStats: { pid: number; job: string; days: number; share: number }[] = []; const popStuck: { pid: number; job: string; key: string; hours: number }[] = []; const popBad: string[] = [];
  const newborn = { n: 0, excludedDays: 0, rawFailing: 0, rawShares: [] as number[] };
  const planIssues: Record<string, number> = {}; const planExamples: string[] = [];
  const byJob: Record<string, { n: number; mean: number; worst: number; failing: number; timingBlind: number; tbn: number }> = {};
  const t1 = Date.now(); let plans = 0;
  if (!opts.skipPopulation) for (let k = 0; k < ids.length; k++) {
    // the detailed agents' variety is measured by what they actually did (part a); their plans are checked here like anyone's
    const pid = ids[k], p = P.persons[pid], agent = p.agent >= 0;
    const sig = new Uint8Array(days * B); const codes = new Map<string, number>(); const present: number[] = [];
    let runKey = '', runStart = 0, runEnd = 0, maxRun = 0, maxKey = '', prevLast: string | null = null, prevD = -9, prevSegs: Seg[] | null = null;
    for (let d = 0; d < days; d++) {
      if (!P.present(pid, d)) { runKey = ''; continue; } present.push(d);
      const segs = P.plan(pid, d); plans++;
      for (const x of checkPlan(P, pid, d, segs, prevD === d - 1 ? prevLast : null, prevD === d - 1 ? prevSegs : null)) { planIssues[x.kind] = (planIssues[x.kind] ?? 0) + 1; if (planIssues[x.kind] <= 5 && planExamples.length < 60) planExamples.push(`${pid} ${p.job} ${p.sex}${p.age} day ${d}: ${x.kind}: ${x.note}`); }
      prevLast = segs[segs.length - 1].place; prevD = d; prevSegs = segs;
      let prev = 0; for (const s of segs) { if (s.t0 < prev - 1e-6 || s.t1 < s.t0 - 1e-9) { if (popBad.length < 20) popBad.push(`${pid} ${p.job} day ${d}: segments out of order at ${s.t0}`); break; } prev = s.t1;
        if (!ACTIVITIES[s.act] && popBad.length < 20) popBad.push(`${pid} ${p.job}: unknown activity ${s.act}`);
        if (s.where === 'road' && s.t1 - s.t0 > 3.1 && p.zone !== 'transient' && popBad.length < 20) popBad.push(`${pid} ${p.job} day ${d}: a ${(s.t1 - s.t0).toFixed(1)} h walk (${s.why})`);
        const key = `${s.place}|${s.act}`; if (key === runKey && Math.abs(d * 24 + s.t0 - runEnd) < 1e-6) runEnd = d * 24 + s.t1; else { runKey = key; runStart = d * 24 + s.t0; runEnd = d * 24 + s.t1; }
        if (runEnd - runStart > maxRun) { maxRun = runEnd - runStart; maxKey = key; } }
      if (segs[segs.length - 1].t1 < 24 - 1e-6 && popBad.length < 20) popBad.push(`${pid} ${p.job} day ${d}: plan ends at ${segs[segs.length - 1].t1}`);
      if (agent) continue;
      for (let b = 0; b < B; b++) { const s = segAt(segs, b * 0.5 + 0.5 - 1e-6); const key = `${s.place}|${s.act}`; let c = codes.get(key); if (c === undefined) { c = Math.min(255, codes.size + 1); codes.set(key, c); } sig[d * B + b] = c; }
    }
    if (agent) continue;
    if (maxRun > SOAK_GATES.STUCK_HOURS && popStuck.length < 50 && !maxKey.startsWith('-|')) popStuck.push({ pid, job: p.job, key: maxKey, hours: +maxRun.toFixed(1) });
    // infants in their first year are carried by their mothers: their day is hers, and the gate is applied to her (every
    // mother is measured like anyone). The infants' own shares are measured and REPORTED, not gated (D-021).
    if (p.born >= 0 || p.age === 0) { newborn.n++; if (present.length >= 2) { const raw = pairStats(sig, present, false).share; newborn.rawShares.push(raw); if (raw >= SOAK_GATES.MAX_NEAR_COPY_SHARE) newborn.rawFailing++; } continue; }
    if (present.length < 2) continue;
    const st = pairStats(sig, present, false); popStats.push({ pid, job: p.job, days: present.length, share: st.share });
    const j = (byJob[p.job] ??= { n: 0, mean: 0, worst: 0, failing: 0, timingBlind: 0, tbn: 0 }); j.n++; j.mean += st.share; j.worst = Math.max(j.worst, st.share); if (st.share >= SOAK_GATES.MAX_NEAR_COPY_SHARE) j.failing++;
    if (k % 97 === 0) { j.timingBlind += histShare(sig, present); j.tbn++; }
    if (k % 5000 === 4999) log(`  population: ${k + 1}/${ids.length} people, ${((Date.now() - t1) / 1000).toFixed(0)} s`);
  }
  // every third day: everyone "with" someone is where that one is; no child under ten alone at night
  const dayIssues: Record<string, number> = {}; const dayExamples: string[] = []; let daysChecked = 0;
  if (!opts.skipPopulation) for (let d = 0; d < days; d += 3) { daysChecked++; const cache = new Map<number, Seg[]>();
    const planOf = (x: number) => { let v = cache.get(x); if (!v) { v = P.plan(x, d); cache.set(x, v); } return v; };
    for (const x of checkDay(P, d, planOf)) { dayIssues[x.kind] = (dayIssues[x.kind] ?? 0) + 1; if (dayExamples.length < 30) dayExamples.push(`${x.pid} ${P.persons[x.pid].job} ${P.persons[x.pid].sex}${P.persons[x.pid].age} day ${d}: ${x.kind}: ${x.note}`); }
    if (d % 60 === 0) log(`  day checks: day ${d + 1}, ${((Date.now() - t1) / 1000).toFixed(0)} s`); }
  for (const j of Object.values(byJob)) { j.mean = +(j.mean / j.n).toFixed(3); j.worst = +j.worst.toFixed(3); j.timingBlind = j.tbn ? +(j.timingBlind / j.tbn).toFixed(3) : NaN; }
  const popSeconds = (Date.now() - t1) / 1000;
  const popFailing = popStats.filter(s => s.share >= SOAK_GATES.MAX_NEAR_COPY_SHARE);
  // ---------------------------------------------------------------- per-frame cost of the full population at 60 fps (real-time clock)
  const cost = frameCost(seed, nav, env, !!opts.court);
  const season = [0, 60, 120, 180, 240, 300].map(d => ({ day: d, ...seasonAt(d), river: cal.days[Math.min(d, days - 1)].river, agri: [...cal.days[Math.min(d, days - 1)].agri] }));
  const worst = [...perAgent].sort((a, b) => b.nearCopyShare - a.nearCopyShare).slice(0, 5);
  const gates = {
    variety: perAgent.every(p => p.nearCopyShare < SOAK_GATES.MAX_NEAR_COPY_SHARE),
    populationVariety: !opts.skipPopulation && popFailing.length === 0,
    events: kindsPerWeek.every(k => k >= SOAK_GATES.MIN_EVENT_KINDS_WEEK),
    stuck: stuck.length === 0 && popStuck.length === 0,
    stocks: sacks.min >= 0 && sacks.max < SOAK_GATES.SACKS_MAX && Object.values(stores).every(s => s.ok) && collapse.length === 0,
    renderedHonest: badRendered.length === 0,
    plansWellFormed: !opts.skipPopulation && popBad.length === 0 && Object.keys(planIssues).length === 0 && Object.keys(dayIssues).length === 0,
    visibleChange: advanced >= SOAK_GATES.CONSTRUCTION_WEEKS * weekly.length,
  };
  return { days, dt, seed, court: !!opts.court, detailedAgents: N, population: persons, populationMeasured: popStats.length, sampled: sampleN ? `random ${sampleN} of ${persons}` : 'everyone',
    seconds: { build: buildMs / 1000, detailed: detailedSeconds, population: popSeconds, plans }, gates,
    byRole, worst, byJob, populationFailing: popFailing.slice(0, 20),
    infants: { measured: newborn.n, note: 'under one year: reported, not gated (their mothers are gated)', wouldFail: newborn.rawFailing, meanShare: newborn.rawShares.length ? +(newborn.rawShares.reduce((a, b) => a + b, 0) / newborn.rawShares.length).toFixed(3) : null, worstShare: newborn.rawShares.length ? +Math.max(...newborn.rawShares).toFixed(3) : null }, populationWorst: [...popStats].sort((a, b) => b.share - a.share).slice(0, 10).map(s => ({ ...s, share: +s.share.toFixed(3) })),
    kindsPerWeek: { min: Math.min(...kindsPerWeek), max: Math.max(...kindsPerWeek), mean: +(kindsPerWeek.reduce((a, b) => a + b, 0) / kindsPerWeek.length).toFixed(2), floor: SOAK_GATES.MIN_EVENT_KINDS_WEEK },
    eventKinds: [...new Set(weeks.flatMap(s => [...(s ?? [])]))].sort(), otherEventKinds: [...other].sort(),
    stuck: stuck.slice(0, 10), populationStuck: popStuck.slice(0, 10), sacks, sliceStock: { ...sim.stock }, campFlows: { ...sim.flows }, stores, shortfalls: cal.shortfalls.length, collapse, harvestFactor: +cal.harvestFactor.toFixed(3),
    life: lifeCounts, construction, renderedActivities: rendered, badRendered, planProblems: popBad,
    planChecks: { personDays: plans, issues: planIssues, examples: planExamples, daysChecked, dayIssues, dayExamples, note: 'planCheck.ts: no_sleep, reason, meals, teleport and the D-191 invariants (weather, light, wait, label, feed, dress) on every person-day; apart (a person in two places) and alone (a child under ten at night) on every third day for everyone' },
    season, frameCost: cost };
}

/** step() cost with the full population at 60 fps and the real-time clock, over a stretch that crosses midnight */
export function frameCost(seed: number, nav: NavGrid, env: (t: number) => Env, court = false) {
  const sim = new PeopleSim(seed, nav, env, { court }); sim.routeSearchesPerStep = 1; // as the world runs it (D-024)
  sim.jumpTo(24 * 41 - 10 / 3600); sim.updateLod([0, 0], 1e9);
  const times: number[] = []; let rollMs = 0; for (let i = 0; i < 60 * 30; i++) { const a = performance.now(); const d0 = Math.floor(sim.t / 24); sim.step(1 / 60); const dt = performance.now() - a; times.push(dt); if (Math.floor(sim.t / 24) !== d0) rollMs = dt; } // 30 s of real time, 10 s before midnight to 20 s after
  const sorted = [...times].sort((a, b) => a - b); const mean = times.reduce((a, b) => a + b, 0) / times.length;
  // accelerated clock (x60, e.g. a time-lapse): one game minute per frame
  const fast: number[] = []; for (let i = 0; i < 600; i++) { const a = performance.now(); sim.step(60); fast.push(performance.now() - a); } const fs = [...fast].sort((a, b) => a - b);
  const r = (x: number) => +x.toFixed(3);
  return { realtime: { frames: times.length, meanMs: r(mean), p99Ms: r(sorted[Math.floor(sorted.length * 0.99)]), maxMs: r(sorted[sorted.length - 1]), midnightFrameMs: r(rollMs) },
    x60: { frames: fast.length, meanMs: r(fast.reduce((a, b) => a + b, 0) / fast.length), p99Ms: r(fs[Math.floor(fs.length * 0.99)]), maxMs: r(fs[fs.length - 1]) }, note: 'detailed agents at full LOD; the day rollover (calendar day for ~46,000 people) falls inside the real-time run' };
}

if (process.argv[1]?.endsWith('soak.ts')) {
  const args = process.argv.slice(2).filter(a => !a.startsWith('--')); const flag = (k: string) => process.argv.indexOf(k);
  const [days, dt, seed] = [+(args[0] ?? 354), +(args[1] ?? 60), +(args[2] ?? 1)];
  const sample = flag('--sample') >= 0 ? +process.argv[flag('--sample') + 1] : 0;
  const r = runSoak(days, dt, seed, undefined, { sample, court: flag('--court') >= 0 });
  mkdirSync('bench-reports', { recursive: true }); const f = `bench-reports/soak-${new Date().toISOString().replace(/[:.]/g, '-')}.json`;
  writeFileSync(f, JSON.stringify(r, null, 1));
  const { renderedActivities, season, ...brief } = r; void renderedActivities; void season;
  console.log(JSON.stringify(brief, null, 1)); console.log('written', f);
  process.exit(Object.values(r.gates).every(Boolean) ? 0 : 1);
}
