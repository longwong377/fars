// Phase 5 shadow review round 8, the reviewers' other findings (REVIEWS/shadow_phase5_r8.md, reviewer A; _r8_b.md,
// reviewer B; D-197), each fixed at its rule and swept year-wide by a planCheck invariant:
//  1 the tool's age-rule stratum drew babies born this year (A S1, B S7);
//  2 a sick little one went wherever its mother worked; a sick guard was never nursed at home; a guard at home with his
//    wife ill did none of her work (A S2, A S10, B S3): (i) `sick`;
//  3 a storm or rain anywhere in the day cancelled the builders' whole day (A S3, B S2): (j) `weatherday`;
//  4 the detailed porters waited for a caravan that had come (A S4): (c) `wait` at the depot;
//  5 labels: "after dark" before dusk, a house named three ways, weather words away from the weather, 1-minute walks to
//    the place one is at (A S7, B S8): (d) `label`;
//  6 roofed doorkeepers stopped at the E-64 noon (A S8): (m) `roofed`;
//  7 Treasury women of every trade spun at home for the workshop (A S9): (d);
//  8 winnowing out of the afternoon wind (A S6): (n) `winnow`, (d);
//  9 13-15-year-olds playing 3-4 h (B S4): (k) `teen`; the homemakers' talk outside the rest cap (B S5); long siestas
//    (B S6): (l) `siesta`.
// Days are 0-based indices (the reviews print 1-based regnal days).
import { describe, it, expect, beforeAll } from 'vitest';
import { readFileSync } from 'node:fs';
import { NavGrid } from '../src/people/navgrid';
import { PeopleSim, Env } from '../src/people/sim';
import { type Seg, workSpan, DRY_WORK_H, HEAT_SLEEP, HEAT_SLEEP_CAP_H } from '../src/people/population';
import { checkPlan, invariants, WAIT_CAP_H, SICK_AWAY_H } from '../src/people/planCheck';
import { WeatherSystem } from '../src/weather/weatherState';
import { pickSample, detailedDay } from '../tools/shadow_days';
import livesData from '../src/data/lives.json';

const W = new WeatherSystem(1);
const env = (t: number): Env => { const d = Math.floor(t / 24), c = W.conditions(d, t - d * 24); return { rain: c.rain, lightning: c.lightning, windMs: c.windMs, tempC: c.tempC, dust: c.dust }; };
const nav = () => new NavGrid(new Int16Array(readFileSync('public/generated/nav.i16').buffer.slice(0)), new Uint8Array(readFileSync('public/generated/nav_edges.u8')));
let sim: PeopleSim; let P: any;
beforeAll(() => { sim = new PeopleSim(1, nav(), env); P = (sim as any).pop; });
const L = livesData as any;
const kindsOf = (pid: number, d: number, segs?: Seg[]) => invariants(P, pid, d, segs ?? P.plan(pid, d)).map(x => `${x.kind}: ${x.note}`);
/** every day of the year for the persons chosen, the named kinds of fault only */
function sweep(pids: number[], kinds: string[], days = (d: number) => true) { const bad: string[] = []; let n = 0;
  for (const pid of pids) { let prev: Seg[] | null = null, pd = -9;
    for (let d = 0; d < 354; d++) { if (!P.present(pid, d) || !days(d)) { continue; } const g: Seg[] = P.plan(pid, d); n++;
      for (const x of checkPlan(P, pid, d, g, pd === d - 1 && prev ? prev[prev.length - 1].place : null, pd === d - 1 ? prev : null)) if (kinds.includes(x.kind) && bad.length < 8) bad.push(`${pid} ${P.persons[pid].job} d${d} ${x.kind}: ${x.note}`);
      prev = g; pd = d; } }
  return { n, bad }; }

describe('1 (A S1, B S7): the age-rule stratum of the shadow pick', () => {
  it('draws a child born before the year who crosses an age rule (1, 5 or 8) on its day, for any pick seed', () => {
    for (const seed of [149, 3, 11, 42, 77, 101, 131]) { const S = pickSample(P, sim, seed); const x = S.population.find(y => /age rule/.test(y.stratum));
      if (!x) continue; const p = P.persons[x.pid]; expect(p.born, `seed ${seed}`).toBeLessThan(0);
      expect([1, 5, 8]).toContain(P.ageOn(x.pid, x.day)); expect(P.ageOn(x.pid, x.day)).toBe(p.age + 1); }
  }, 300_000);
});

describe('2 (A S2, A S10, B S3): illness changes what the carers do', () => {
  it('27094, 4 and ill on Arahsamnu 23 (day 229), lies ill at home beside his grandfather, who keeps him there (was the lane at 2-7 °C)', () => {
    const g: Seg[] = P.plan(27094, 229), home = P.households[P.home(27094, 229)].home;
    expect(g.every(s => s.place === home)).toBe(true); expect(g.some(s => /grandfather/.test(s.why))).toBe(true);
    expect((P.plan(27096, 229) as Seg[]).every(s => s.place === home)).toBe(true);
    expect(kindsOf(27094, 229)).toEqual([]);
  }, 120_000);
  it('year-wide: every sick little one (0-4) of the town and the plain stays at home (was 91 % of 31,434 sick child-days of 1-4 out at the mother\'s work)', () => {
    let n = 0, away = 0; const bad: string[] = [];
    for (let pid = 0; pid < P.persons.length; pid++) { const p = P.persons[pid]; if (p.job !== 'child' || p.agent >= 0) continue;
      for (let d = 0; d < 354; d++) { if (!P.present(pid, d) || P.ageOn(pid, d) > 4 || !P.sick(pid, d)) continue; const Hh = P.households[P.home(pid, d)]; if (Hh.zone !== 'town' && Hh.zone !== 'plain') continue;
        const g: Seg[] = P.plan(pid, d); if (g.some(s => /taken in by/.test(s.why))) continue; n++;
        const a = g.filter(s => s.where !== 'road' && s.place !== Hh.home && s.place !== '-').reduce((x, s) => x + Math.max(0, Math.min(21, s.t1) - Math.max(5, s.t0)), 0); away += a;
        for (const x of invariants(P, pid, d, g)) if (x.kind === 'sick' && bad.length < 5) bad.push(`${pid} d${d} ${x.note}`); } }
    expect(n).toBeGreaterThan(30_000); expect(bad).toEqual([]); expect(away / n).toBeLessThan(0.05); expect(SICK_AWAY_H).toBeLessThanOrEqual(0.75);
  }, 900_000);
  it('a sick guard with a wife in the town is nursed at home in a share of his illnesses (C), coming down on the second morning and going back up on the last evening', () => {
    let eps = 0, home = 0; const bad: string[] = [];
    for (const pid of P.garrison as number[]) { let prev: Seg[] | null = null;
      for (let d = 0; d < 354; d++) { if (!P.present(pid, d)) { prev = null; continue; } const g: Seg[] = P.plan(pid, d);
        if (P.sick(pid, d) && P.sickDayOf(pid, d).k === 1 && P.sickDayOf(pid, d).n >= 3 && P.households[P.persons[pid].hh].zone === 'town') { eps++; if (P.guardNursedHome(pid, d)) { home++; expect(g.some(s => s.act === 'lie_ill' && s.place === P.households[P.persons[pid].hh].home)).toBe(true); } }
        for (const x of checkPlan(P, pid, d, g, prev ? prev[prev.length - 1].place : null, prev)) if (bad.length < 5) bad.push(`${pid} d${d} ${x.kind}: ${x.note}`);
        prev = g; } }
    expect(bad).toEqual([]); expect(eps).toBeGreaterThan(20); expect(home / eps).toBeGreaterThan(0.3); expect(home / eps).toBeLessThan(0.9);
  }, 900_000);
  it('#28 (person 78) at home on Tebetu 7 (day 272), his wife ill, fetches the water and lights the fire; so does every guard at home with his wife ill', () => {
    const g: Seg[] = P.plan(78, 272); expect(g.some(s => s.act === 'draw_water')).toBe(true); expect(g.some(s => s.act === 'cook')).toBe(true);
    const r = sweep(P.garrison, ['sick']); expect(r.n).toBeGreaterThan(20_000); expect(r.bad).toEqual([]);
  }, 900_000);
});

describe('3 (A S3, B S2): the builders work the dry part of the day', () => {
  it('#104 (person 324) on Tashritu 25 (day 201, storm to 09:45) goes up when it clears; on day 246 (rain from 15:00) the gangs work until the rain', () => {
    const g: Seg[] = P.plan(324, 201); const w = g.filter(s => s.where === 'terrace' && s.act === 'dress_stone'); expect(w.length).toBeGreaterThan(0); expect(w[0].t0).toBeGreaterThanOrEqual(9.75);
    let work = 0, n = 0; for (const pid of P.builders as number[]) { if (!P.builderAvailable(pid, 246, P.cal.ctx(246))) continue; n++; const b: Seg[] = P.plan(pid, 246); if (b.some(s => s.where === 'terrace' || s.place === 'brickyard')) work++;
      for (const s of b) if (s.where === 'terrace' && !['walk', 'shelter', 'eat', 'queue', 'rest'].includes(s.act)) expect(s.t1, `${pid}`).toBeLessThanOrEqual(15.0 + 1e-6); }
    expect(n).toBeGreaterThan(250); expect(work).toBe(n);
  }, 300_000);
  it('year-wide: no Terrace worker is kept at home by the weather with DRY_WORK_H of the working window dry (was 4,125 builder-days)', () => {
    const ids = P.persons.filter((p: any, i: number) => i % 3 === 0 && (p.job === 'builder' || p.job === 'camp' || p.job === 'caretaker' || (p.job === 'porter' && p.sub === 'terrace') || p.work === 'treasury_inside' || p.work === 'treasury_store')).map((p: any) => p.id);
    const wet = (d: number) => { const C = P.cal.ctx(d); return !!C.wx.rain || !!C.wx.stormH; };
    const r = sweep(ids, ['weatherday', 'weather', 'label'], wet); expect(r.n).toBeGreaterThan(5_000); expect(r.bad).toEqual([]);
    for (let d = 0; d < 354; d++) { const C = P.cal.ctx(d), w = P.workWindow(C); expect(P.rainedOff(C)).toBe(workSpan(C.wx, w[0], w[1]).dry < DRY_WORK_H); }
  }, 900_000);
});

describe('4 (A S4): the porters and the day\'s caravan', () => {
  it('the detailed porters come for the caravan and go home once it is carried up; their stand at the depot is within its hours ((c), year-wide)', () => {
    const ids = sim.agents.filter(a => a.role === 'porter').map(a => a.pid); const r = sweep(ids, ['wait', 'label', 'weatherday']); expect(r.n).toBeGreaterThan(1500); expect(r.bad).toEqual([]);
    for (const pid of ids) for (let d = 0; d < 354; d += 7) { if (!P.present(pid, d) || P.sick(pid, d)) continue; const c = P.caravan(d), [a, b] = P.depotHours(pid, d); if (!c) continue;
      expect(b - a).toBeLessThan(6); for (const s of P.plan(pid, d) as Seg[]) if (/waiting at the depot for loads/.test(s.why)) { expect(s.t0, `${pid} d${d}`).toBeGreaterThanOrEqual(a - 0.1); expect(s.t1, `${pid} d${d}`).toBeLessThanOrEqual(b + 0.1); } }
  }, 900_000);
  it('#113 (agent 113) on Kislimu 29 (day 264), stepped: no wait for a caravan longer than WAIT_CAP_H, none after the caravan has come (was 4 h 15 min)', () => {
    const { log } = detailedDay(1, 113, 264); const toH = (x: string) => +x.slice(0, 2) + +x.slice(3, 5) / 60; let run = 0;
    for (let i = 0; i < log.length; i++) { const t = toH(log[i]), t1 = i + 1 < log.length ? toH(log[i + 1]) : 24; if (/waiting for a caravan/.test(log[i])) { run += t1 - t; expect(t).toBeLessThan(P.caravan(264).h + 0.05); } else if (!/at the depot, the caravan/.test(log[i])) run = 0; expect(run).toBeLessThanOrEqual(WAIT_CAP_H); }
    expect(log.some(x => /carry_sack/.test(x))).toBe(true);
  }, 300_000);
});

describe('5 (A S7, B S8): words that hold', () => {
  it('"after dark" only after the light has gone, "at dusk" around it; one name for a house in a day; the weather\'s words near the weather (every 10th person, every 7th day)', () => {
    const r = sweep(P.persons.filter((_: any, i: number) => i % 10 === 3).map((p: any) => p.id), ['label'], d => d % 7 === 0); expect(r.n).toBeGreaterThan(200_000); expect(r.bad).toEqual([]);
    const g: Seg[] = P.plan(4676, 195); const h = g.filter(s => s.place === 'h:1320'); expect(h.length).toBeGreaterThan(0);
    for (const s of g) expect(s.why).not.toMatch(/friend/);
  }, 900_000);
  it('#51 (agent 51) ill on Tebetu 7 (day 272), stepped: no walk to the place he already is (was two 1-minute legs to garrison_sleep)', () => {
    const { log } = detailedDay(1, 51, 272); let last = '';
    for (const x of log) { const m = / (→|@) (\S+) — /.exec(x); if (!m) continue; if (m[1] === '→' && m[2] === last) throw new Error(`walk to where he is: ${x}`); if (m[1] === '@') last = m[2]; }
  }, 300_000);
  it('each new label rule finds its own fault in a made-up day (not vacuous)', () => {
    const d = 195, C = P.cal.ctx(d), set = C.sun.set, pid = 4676, home = P.households[P.home(pid, d)].home; const base: Seg = { t0: 0, t1: 24, place: home, act: 'sleep', why: 'asleep', where: 'town' };
    const k = (segs: Seg[], who = pid, dd = d) => invariants(P, who, dd, segs).map(x => x.kind);
    expect(k([{ ...base, t1: set - 0.2 }, { ...base, t0: set - 0.2, t1: set + 1, place: 'lane:q_pw_s', act: 'talk', why: 'talking with neighbours in the lane after dark' }, { ...base, t0: set + 1 }])).toContain('label');
    expect(k([{ ...base, t1: 9 }, { ...base, t0: 9, t1: 10, place: 'h:1320', act: 'play', why: 'playing at a neighbour’s house' }, { ...base, t0: 10, t1: 11, place: 'h:1320', act: 'talk', why: 'handing over the bread, a word with the kinswoman' }, { ...base, t0: 11 }])).toContain('label');
    const dry = [...Array(354).keys()].find(x => !P.cal.ctx(x).wx.stormH && !P.cal.ctx(x).wx.rain)!;
    expect(k([{ ...base, t1: 9 }, { ...base, t0: 9, t1: 12, act: 'rest', why: 'at home: storm' }, { ...base, t0: 12 }], pid, dry)).toContain('label');
  }, 120_000);
});

describe('6-9: the heat, the Treasury\'s take-home work, the winnowing wind, the teens, the homemakers, the siesta', () => {
  it('A S8: 3885 keeps the door of the closed tachara through the afternoon of Abu 22 (day 139, a heat day), and sleeps no more than HEAT_SLEEP_CAP_H in the heat', () => {
    const g: Seg[] = P.plan(3885, 139); expect(P.cal.ctx(139).heatRest).toBe(true);
    const door = g.filter(s => /keeping the door/.test(s.why)); expect(door[door.length - 1].t1).toBeGreaterThanOrEqual(15);
    expect(g.filter(s => s.act === 'sleep' && HEAT_SLEEP.test(s.why)).reduce((a, s) => a + s.t1 - s.t0, 0)).toBeLessThanOrEqual(HEAT_SLEEP_CAP_H + 1e-6);
  }, 120_000);
  it('year-wide (every 3rd day): no roofed worker stopped at noon, no trade but the textile women spins at home for the workshop, no farming man off the floor in the winnowing wind, no teen at play past the cap, no siesta past the cap', () => {
    const ids = P.persons.filter((p: any, i: number) => (i % 4 === 0 && (p.job === 'caretaker' || p.job === 'treasury')) || (i % 9 === 0 && (p.job === 'farmer' || p.job === 'child' || p.job === 'homemaker'))).map((p: any) => p.id);
    const r = sweep(ids, ['roofed', 'label', 'winnow', 'teen', 'siesta'], d => d % 3 === 0); expect(r.n).toBeGreaterThan(150_000); expect(r.bad).toEqual([]);
  }, 900_000);
  it('A S6: on a threshing day with a working afternoon wind the floor is winnowed in the afternoon and evening; B S4: a girl of 14 (4676, day 195) plays no more than the cap', () => {
    const d = [...Array(354).keys()].find(x => P.cal.ctx(x).agri.has('E-43') && P.cal.ctx(x).wx.windPM >= L.winnowing.wind_ms)!;
    let am = 0, pm = 0; for (let pid = 0; pid < P.persons.length; pid += 3) { if (!P.present(pid, d)) continue; for (const s of P.plan(pid, d) as Seg[]) if (s.act === 'thresh' && /winnow/.test(s.why)) { if (s.t0 < 13) am += s.t1 - s.t0; else pm += s.t1 - s.t0; } }
    expect(pm).toBeGreaterThan(0.3 * (am + pm));
    expect((P.plan(4676, 195) as Seg[]).filter(s => s.act === 'play').reduce((a, s) => a + s.t1 - s.t0, 0)).toBeLessThanOrEqual(L.children.work.teen_play_cap_h + 1e-6);
  }, 300_000);
  it('B S5: a homemaker\'s talk with the household counts with her rest (her hours at home); with only little ones at home it is the spindle', () => {
    let n = 0, idle = 0, work = 0; const X = new Set(['sleep', 'rest', 'talk', 'play', 'gamble', 'eat', 'walk', 'lie_ill', 'offmap']);
    for (let pid = 1; pid < P.persons.length; pid += 11) { const p = P.persons[pid]; if (p.job !== 'homemaker' || P.households[p.hh].zone !== 'town') continue;
      for (let d = 0; d < 354; d += 9) { if (!P.present(pid, d) || P.sick(pid, d) || P.ageOn(pid, d) < 16 || P.ageOn(pid, d) > 50 || P.gaveBirth(pid, d) >= 0 || P.mourning(pid, d)) continue; const C = P.cal.ctx(d); n++;
        for (const s of P.plan(pid, d) as Seg[]) { const a = Math.max(s.t0, C.sun.rise), b = Math.min(s.t1, C.sun.set); if (b <= a) continue; if (!X.has(s.act)) work += b - a; else if (/^(rest|talk|play)$/.test(s.act) && s.where !== 'road') idle += b - a; } } }
    expect(n).toBeGreaterThan(1000); expect(work / n).toBeGreaterThan(5.48); expect(idle / n).toBeLessThan(4.65); // (before, all year: 5.48 h of work and 4.65 h of rest, talk and play in daylight)
  }, 600_000);
  it('the new invariants each find their own fault in a made-up day (not vacuous)', () => {
    // (i) a sick little one taken out to the threshing floor
    const sk = P.persons.findIndex((p: any, i: number) => p.job === 'child' && P.present(i, 229) && P.ageOn(i, 229) <= 4 && P.sick(i, 229) && P.households[P.home(i, 229)].zone === 'plain');
    const hs = P.households[P.home(sk, 229)].home; const b: Seg = { t0: 0, t1: 24, place: hs, act: 'sleep', why: 'asleep', where: 'plain' };
    expect(kindsOf(sk, 229, [{ ...b, t1: 7 }, { ...b, t0: 7, t1: 11, place: 'threshing:v_01', act: 'lie_ill', why: 'ill, lying beside the mother' }, { ...b, t0: 11 }]).join()).toMatch(/(^|,)sick:/);
    // (j) a builder kept at home on a dry day
    const dry = [...Array(354).keys()].find(x => !P.cal.ctx(x).wx.stormH && !P.cal.ctx(x).wx.rain && !P.cal.ctx(x).winter)!; const bd = (P.builders as number[]).find(x => P.present(x, dry))!;
    const hb = P.households[P.home(bd, dry)].home; const bb: Seg = { t0: 0, t1: 24, place: hb, act: 'sleep', why: 'asleep', where: 'town' };
    expect(kindsOf(bd, dry, [{ ...bb, t1: 7 }, { ...bb, t0: 7, t1: 12, act: 'rest', why: 'at home: no work on the building site today' }, { ...bb, t0: 12 }]).join()).toMatch(/weatherday/);
    // (k) a teen at play all afternoon; (l) a siesta of four hours
    const teen = P.persons.findIndex((p: any, i: number) => p.job === 'child' && P.present(i, 195) && P.ageOn(i, 195) >= 13); const ht = P.households[P.home(teen, 195)].home; const bt: Seg = { t0: 0, t1: 24, place: ht, act: 'sleep', why: 'asleep', where: 'town' };
    expect(kindsOf(teen, 195, [{ ...bt, t1: 7 }, { ...bt, t0: 7, t1: 11, act: 'play', why: 'playing at home' }, { ...bt, t0: 11 }]).join()).toMatch(/teen/);
    expect(kindsOf(3885, 139, [{ ...bt, place: 'h:1377', t1: 12 }, { ...bt, place: 'h:1377', t0: 12, t1: 16, why: 'sleeping through the heat of the day' }, { ...bt, place: 'h:1377', t0: 16 }]).join()).toMatch(/siesta/);
    // (m) a doorkeeper gone at noon on a heat day
    expect(kindsOf(3885, 139, [{ ...bt, place: 'h:1377', t1: 6 }, { ...bt, t0: 6, t1: 12, place: 'palaces:tachara', act: 'rest', why: 'keeping the door of the closed tachara', where: 'terrace' }, { ...bt, place: 'h:1377', t0: 12.5 }]).join()).toMatch(/roofed/);
  }, 300_000);
});
