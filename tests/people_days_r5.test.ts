// Phase 5 shadow review round 4 (REVIEWS/shadow_phase5_r4.md; D-150): each test fails on the round-4 code (f905e29) and
// holds the fix.
//  S1 a farming man with no field task idled at home; S2 the grain-heap vigil ended at bedtime; S3 the leader's
//  change-of-watch round walked other files' posts; S4 the herders' band was one template and not families; S5 infants
//  stayed awake through their mothers' work; S6 the child driving the oxen did `field_work` with a hoe; S7 thin winter days
//  for women at home; S10 planner artefacts (a walk home and straight back out, a walk split in two, "an older brother or
//  sister", a guard's meal in the forecourt, a round cut mid-leg); S12 the shadow tool (stratified pick, independent days, days 1-354); the eve of
//  the year's night watch.
import { describe, it, expect, beforeAll } from 'vitest';
import { readFileSync } from 'node:fs';
import { NavGrid } from '../src/people/navgrid';
import { PeopleSim, Env } from '../src/people/sim';
import { Seg, segAt } from '../src/people/population';
import { checkPlan } from '../src/people/planCheck';
import { WeatherSystem } from '../src/weather/weatherState';
import popData from '../src/data/population.json';

const W = new WeatherSystem(1);
const env = (t: number): Env => { const d = Math.floor(t / 24), c = W.conditions(d, t - d * 24); return { rain: c.rain, lightning: c.lightning, windMs: c.windMs, tempC: c.tempC, dust: c.dust }; };
const nav = () => new NavGrid(new Int16Array(readFileSync('public/generated/nav.i16').buffer.slice(0)), new Uint8Array(readFileSync('public/generated/nav_edges.u8')));
let sim: PeopleSim; let P: any;
beforeAll(() => { sim = new PeopleSim(1, nav(), env); P = (sim as any).pop; });

/** hours of rest at a place in daylight (the reviewer's measure) */
const daylightRest = (pid: number, d: number) => { const { rise, set } = P.cal.ctx(d).sun; let r = 0;
  for (const s of P.plan(pid, d) as Seg[]) if (s.act === 'rest' && s.where !== 'road') r += Math.max(0, Math.min(s.t1, set) - Math.max(s.t0, rise)); return r; };
const ableFarmMen = (d: number, step = 1) => { const out: number[] = []; for (let pid = 0; pid < P.persons.length; pid += step) { const p = P.persons[pid];
  if (p.job !== 'farmer' || p.sex !== 'm' || p.age < 16 || p.age > 60 || !P.present(pid, d) || P.sick(pid, d) || P.mourning(pid, d) || P.households[P.home(pid, d)].zone !== 'plain') continue; out.push(pid); } return out; };

/** the runs of road pieces in a plan, as [first, end) index pairs, with a place before and after (a walk, or walks in a row) */
const roadRuns = (s: Seg[]) => { const out: [number, number][] = []; for (let i = 1; i < s.length; i++) { if (s[i].where !== 'road' || s[i - 1].where === 'road') continue;
  let j = i; while (j < s.length && s[j].where === 'road') j++; if (j < s.length) out.push([i, j]); } return out; };
/** a walk that leaves a place and comes straight back to it (no piece of it an hour-long errand on the road) */
const backWalk = (s: Seg[], i: number, j: number) => s[i - 1].place === s[j].place && s.slice(i, j).every(x => x.t1 - x.t0 < 0.5);

describe('S1: a farming man is not idle at home on a working day', () => {
  it('the fields fraction is applied to men and women separately (population.json field_fraction_by_sex, C)', () => {
    const z = (popData as any).zones.find((x: any) => x.id === 'plain'); const A = z.field_fraction_adults_by_day, S = z.field_fraction_by_sex;
    expect(S).toBeTruthy(); expect(S.tier).toBe('C');
    for (const s of ['spring', 'summer', 'autumn', 'winter']) { expect(S.men[s]).toBeCloseTo(Math.min(0.9, 2 * A[s]), 6); expect(S.women[s]).toBe(0); }
  });
  it('outside winter every able farming man has the day\'s work (a field task or the season\'s other work); in winter some days stay at home', () => {
    for (const d of [5, 15, 25, 150, 163, 192, 222, 340, 350]) { const C = P.cal.ctx(d); expect(C.season).not.toBe('winter');
      let n = 0; for (const pid of ableFarmMen(d, 7)) { if (C.wx.storm) continue; n++; expect(P.hday(P.home(pid, d), d).task, `${pid} day ${d}`).not.toBeNull(); } expect(n).toBeGreaterThan(500); }
    let home = 0, n = 0; for (const pid of ableFarmMen(281, 7)) { n++; if (!P.hday(P.home(pid, 281), 281).task) home++; } expect(home / n).toBeGreaterThan(0.2); expect(home / n).toBeLessThan(0.8);
  }, 120_000);
  it('an able farming man rests at most about 3.75 h in daylight on a day without the E-64 heat (the cap is 2.5 h at home outside winter)', () => {
    let n = 0; for (const d of [15, 163, 205, 222, 340, 350]) { expect(P.cal.ctx(d).heatRest).toBe(false);
      for (const pid of ableFarmMen(d, 5)) { n++; expect(daylightRest(pid, d), `${pid} day ${d}`).toBeLessThanOrEqual(3.75); } }
    expect(n).toBeGreaterThan(5000);
  }, 180_000);
  it('31224 Tuppipi on Nisanu 22 (day 21, the failing day of round 4) works: the season\'s other work, and under 3 h of daylight rest', () => {
    const T = P.hday(P.home(31224, 21), 21).task; expect(T).not.toBeNull(); expect(daylightRest(31224, 21)).toBeLessThan(3);
    expect((P.plan(31224, 21) as Seg[]).some(s => s.place === T.place && s.act === T.act)).toBe(true);
  });
  it('the season\'s other work follows its rows: the threshing floor readied only in the 12 days before the barley harvest (E-41), the sesame cut only in month 6', () => {
    for (let d = 0; d < 354; d += 2) { const C = P.cal.ctx(d); for (let h = 0; h < P.households.length; h += 23) { const T = P.hday(h, d).task; if (!T || T.kind !== 'other') continue;
      if (T.opt === 'floor') { expect(d).toBeGreaterThanOrEqual(21); expect(d).toBeLessThan(33); } if (T.opt === 'sesame') expect(C.month).toBe(6); if (C.season !== 'winter') expect(T.opt).not.toBe('home'); } }
  }, 180_000);
});

describe('S2: the grain-heap vigil lasts the night', () => {
  it('on a threshing night one man of the household, by turns, sleeps by the heap on the floor and his next day begins there', () => {
    const d = 139; let vig = 0; for (let h = 0; h < P.households.length; h += 3) { const H = P.households[h]; if (H.zone !== 'plain') continue;
      const atFloor = (P.membersOn(h, d) as number[]).filter(x => { const s: Seg[] = P.plan(x, d); return s[s.length - 1].place.startsWith('threshing:'); });
      expect(atFloor.length).toBeLessThanOrEqual(1); if (!atFloor.length) continue; vig++; const x = atFloor[0], a: Seg[] = P.plan(x, d), b: Seg[] = P.plan(x, d + 1);
      expect(a[a.length - 1].act, `${x} (household ${h}): ${a.slice(-4).map(s => `${s.t0.toFixed(2)} ${s.act} @ ${s.place}: ${s.why}`).join(' | ')}`).toBe('sleep'); expect(segAt(a, 23).place).toBe(a[a.length - 1].place);
      if (!P.present(x, d + 1)) continue;   // died in the night (seed 1: one man)
      expect(b[0].place, `${x}: ${b[0].why}`).toBe(a[a.length - 1].place); if (!P.sick(x, d + 1)) expect(b[0].act, `${x}: ${b[0].why}`).toBe('sleep');   // or taken ill in the night by the heap
      expect(checkPlan(P, x, d + 1, b, a[a.length - 1].place)).toEqual([]); }
    expect(vig).toBeGreaterThan(100);
  }, 120_000);
});

describe('S3 and S10: the guards', () => {
  it('a leader of ten\'s change-of-watch round visits his own file\'s posts from the rota, and every leg of his rounds reaches its post (#80, day 128)', () => {
    for (const a of sim.agents) a.lod = 'abstract'; const L = sim.agents[80]; const d = 127, me = P.rota(d).get(L.pid); expect(me.watch).toBe(0);
    const file = P.persons[L.pid].file, posts = new Set([...P.rota(d).entries()].filter(([q, y]: any) => y.watch === 0 && y.post && P.persons[q].file === file).map(([, y]: any) => y.post));
    sim.jumpTo(d * 24 + 5.5); const legs: { place: string; reached: boolean }[] = []; let last: any = null;
    while (sim.t < d * 24 + 14) { sim.step(10); const tk = L.task; if (tk !== last) { last = tk; if (tk?.act === 'patrol') legs.push({ place: tk.place, reached: false }); }
      if (tk?.act === 'patrol' && !L.walking && legs.length) legs[legs.length - 1].reached = true; }
    expect(legs.length).toBeGreaterThan(10); for (const g of legs) { expect(posts.has(g.place), g.place).toBe(true); expect(g.reached, `leg to ${g.place}`).toBe(true); }
  }, 180_000);
  it('a guard\'s bread and water in the gap between meals is eaten at his hearth, not in the forecourt (#52, day 323)', () => {
    const pid = sim.agents[52].pid; const segs: Seg[] = P.plan(pid, 322); const eats = segs.filter(s => s.act === 'eat'); expect(eats.length).toBeGreaterThanOrEqual(3);
    for (const s of eats) expect(s.place, `${s.why}`).not.toBe('forecourt');
    for (let d = 300; d < 330; d++) for (const a of sim.agents.filter(x => x.role === 'guard')) for (const s of P.plan(a.pid, d) as Seg[]) if (s.act === 'eat') expect(s.place, `${a.id} d${d} ${s.why}`).not.toBe('forecourt');
  }, 120_000);
  it('the eve of the year keeps its rota: the night watch is at the posts after midnight on day 1', () => {
    const r = P.rota(-1); expect([...r.values()].filter((x: any) => x.watch === 2 && x.post).length).toBe(16);
    let onPost = 0; for (const a of sim.agents) if (a.role === 'guard') { const s = segAt(P.plan(a.pid, 0), 2); if (s.act === 'stand_guard') onPost++; } expect(onPost).toBeGreaterThanOrEqual(8);
  });
});

describe('S4: the herders\' band is families, and their days differ', () => {
  it('a band holds men, women, children under ten and small ones, now and then the old; children know their mothers', () => {
    const H = P.persons.filter((p: any) => p.job === 'herder'); expect(H.length).toBeGreaterThan(500);
    expect(H.filter((p: any) => p.age < 10).length / H.length).toBeGreaterThan(0.2); expect(H.filter((p: any) => p.age < 5).length).toBeGreaterThan(50);
    expect(H.filter((p: any) => p.sex === 'f').length / H.length).toBeGreaterThan(0.35); expect(H.filter((p: any) => p.age >= 56).length).toBeGreaterThan(10);
    for (const p of H) if (p.age < 12) { expect(p.mother, `${p.id}`).toBeGreaterThanOrEqual(0); expect(P.persons[p.mother].idx).toBe(p.idx); }
  });
  it('on a moving day the band\'s people have different days: the flock with the men, the donkeys with the families, an evening by the fire, two men watching the flock in the night', () => {
    let bands = 0;
    for (const b of P.bands) { const d = b.day + 1; const B = P.bandDay(b.i, d); if (!B.moving || d >= B.leave) continue; bands++;
      const ms: number[] = P.persons.filter((p: any) => p.job === 'herder' && p.idx === b.i && P.present(p.id, d)).map((p: any) => p.id); const plans = ms.map(x => P.plan(x, d) as Seg[]);
      const sig = new Set(plans.map(s => s.map(x => `${x.t0.toFixed(2)}${x.act}${x.place}`).join())); expect(sig.size, `band ${b.i}`).toBeGreaterThan(Math.min(ms.length, 3) - 1);
      const set = P.cal.ctx(d).sun.set;
      expect(plans.some(s => s.some(x => x.act === 'herd' && x.where !== 'road'))).toBe(true); expect(plans.some(s => s.some(x => x.act === 'walk' && /donkey/.test(x.why)))).toBe(true);
      expect(plans.filter(s => segAt(s, Math.min(23.9, set + 1)).act !== 'sleep').length).toBeGreaterThan(0);
      if (ms.filter(x => P.persons[x].sex === 'm' && P.persons[x].age >= 14 && P.persons[x].age <= 55).length >= 2) expect(plans.filter(s => /watching the flock/.test(segAt(s, 23.5).why)).length, `band ${b.i}`).toBe(1); }
    expect(bands).toBeGreaterThan(10);
  }, 120_000);
  it('every herder\'s every day is well formed (sleep, reasons, meals, and yesterday\'s end is today\'s start)', () => {
    let n = 0; for (const b of P.bands) for (let d = b.day; d <= Math.min(353, b.day + b.stay); d++) for (const p of P.persons) { if (p.job !== 'herder' || p.idx !== b.i || !P.present(p.id, d)) continue; n++;
      const prev = d > b.day && P.present(p.id, d - 1) ? (P.plan(p.id, d - 1) as Seg[]).at(-1)!.place : null; expect(checkPlan(P, p.id, d, P.plan(p.id, d), prev), `${p.id} d${d}`).toEqual([]); }
    expect(n).toBeGreaterThan(2000);
  }, 180_000);
});

describe('S5: an infant sleeps through much of the mother\'s work', () => {
  it('babies under four months sleep about 14-17 h in 24 (median) and are seldom awake 2 h at a stretch; 22239 (two months, day 30) sleeps 14 h or more', () => {
    const sleeps: number[] = [], runs: number[] = [];
    for (const d of [29, 120, 250, 339]) for (let pid = 0; pid < P.persons.length; pid += 3) { const p = P.persons[pid]; if (!(p.born >= 0 || p.age === 0) || !P.present(pid, d) || p.zone === 'transient') continue;
      const ageD = p.born >= 0 ? d - p.born : d + 354 - p.bday; if (ageD < 2 || ageD >= 120) continue; let sl = 0, run = 0, lg = 0;
      for (const s of P.plan(pid, d) as Seg[]) { if (s.act === 'sleep') { sl += s.t1 - s.t0; run = 0; } else { run += s.t1 - s.t0; if (s.act !== 'eat') lg = Math.max(lg, run); } } sleeps.push(sl); runs.push(lg); }
    sleeps.sort((a, b) => a - b); runs.sort((a, b) => a - b); expect(sleeps.length).toBeGreaterThan(200);
    const med = sleeps[sleeps.length >> 1]; expect(med).toBeGreaterThanOrEqual(14); expect(med).toBeLessThanOrEqual(17); expect(runs[Math.floor(runs.length * 0.9)]).toBeLessThan(2.1);
    let s22 = 0; for (const s of P.plan(22239, 29) as Seg[]) if (s.act === 'sleep') s22 += s.t1 - s.t0; expect(s22).toBeGreaterThanOrEqual(14);
    expect((P.plan(22239, 29) as Seg[]).some(s => s.act === 'sleep' && /asleep on the mother’s back|asleep, carried on the mother’s back|asleep in the mother’s lap|asleep on a mat beside the mother/.test(s.why) && s.t0 > 7 && s.t1 < 17)).toBe(true);
  }, 120_000);
});

describe('S6, S7, S10: children at the floor, women in winter, planner artefacts', () => {
  it('a child at the threshing floor threshes and carries a stick or a fork, never a hoe, and her walks are not split in two (18978, day 104)', () => {
    const segs: Seg[] = P.plan(18978, 103); expect(segs.some(s => s.act === 'thresh' && s.place.startsWith('threshing:'))).toBe(true);
    for (const [i, j] of roadRuns(segs)) expect(j - i, `18978 d103 a walk split in two at ${segs[i].t0.toFixed(2)} (S10)`).toBe(1);
    for (const s of segs) { expect(s.act === 'field_work' && s.place.startsWith('threshing:')).toBe(false); if (s.carry) expect(s.carry).not.toMatch(/hoe/); }
    for (let pid = 0; pid < P.persons.length; pid += 5) { const p = P.persons[pid]; if (p.age >= 14 || p.age < 5 || P.households[p.hh].zone !== 'plain') continue; for (const d of [80, 120]) { if (!P.present(pid, d)) continue;
      const s: Seg[] = P.plan(pid, d); for (let i = 0; i < s.length; i++) { if (s[i].place.startsWith('threshing:')) expect(s[i].act).not.toBe('field_work');
        if (s[i].where === 'road' && s[i].carry && (s[i + 1]?.place.startsWith('threshing:') || s[i - 1]?.place.startsWith('threshing:'))) expect(s[i].carry, `${pid} d${d}`).not.toMatch(/hoe/); } } }
  }, 120_000);
  it('a woman at home on a winter day spins or weaves for hours (18904 on Kislimu 19; the baker #122 on her winter day off)', () => {
    const spin = (pid: number, d: number) => (P.plan(pid, d) as Seg[]).filter(s => s.act === 'spin' || s.act === 'weave').reduce((a, s) => a + s.t1 - s.t0, 0);
    expect(spin(18904, 254)).toBeGreaterThanOrEqual(1); const b = sim.agents[122].pid; expect(spin(b, 271)).toBeGreaterThanOrEqual(1.5); expect(daylightRest(b, 271)).toBeLessThan(4);
    let n = 0, sp = 0, rs = 0; for (let pid = 0; pid < P.persons.length; pid += 7) { const p = P.persons[pid]; if (p.sex !== 'f' || p.job !== 'homemaker' || p.age < 14 || p.age > 59 || !P.present(pid, 271) || P.sick(pid, 271) || P.gaveBirth(pid, 271) >= 0) continue; n++; sp += spin(pid, 271); rs += daylightRest(pid, 271); }
    expect(sp / n).toBeGreaterThan(2.5); expect(rs / n).toBeLessThan(2);
  }, 120_000);
  it('play leads from one place to the next: no walk leaves a place and comes straight back to it, and a little one\'s sister is "the elder sister"', () => {
    let kids = 0; for (let pid = 0; pid < P.persons.length; pid += 4) { const p = P.persons[pid]; if (p.age > 13 || p.age < 1) continue; for (const d of [60, 163, 242]) { if (!P.present(pid, d)) continue; kids++; const s: Seg[] = P.plan(pid, d);
      for (const [i, j] of roadRuns(s)) expect(backWalk(s, i, j), `${pid} d${d} ${s[i].t0.toFixed(2)} ${s[i - 1].place}`).toBe(false);
      for (const x of s) expect(x.why).not.toMatch(/an older brother or sister/); } }
    expect(kids).toBeGreaterThan(3000);
  }, 180_000);
  it('the grown-ups too: no walk back to where it started, no walk that arrives and goes straight on (fewer than 1 in 200 person-days: a horse led along the road and back), and between two trips to the well the water is poured at home', () => {
    let n = 0, split = 0; for (let pid = 1; pid < P.persons.length; pid += 9) { const p = P.persons[pid]; if (p.age < 14) continue; for (const d of [60, 163, 242]) { if (!P.present(pid, d)) continue; n++; const s: Seg[] = P.plan(pid, d);
      for (const [i, j] of roadRuns(s)) { expect(backWalk(s, i, j), `${pid} d${d} ${s[i].t0.toFixed(2)} ${s[i - 1].place}`).toBe(false); if (j - i >= 2) split++; }
      for (let i = 1; i + 2 < s.length; i++) if (s[i].act === 'carry_jar_head' && s[i + 1].where === 'road' && s[i + 2].act === 'draw_water') expect(`${pid} d${d} ${s[i].t0.toFixed(2)}: carried home and straight back out`).toBe(''); } }
    expect(n).toBeGreaterThan(5000); expect(split / n).toBeLessThan(0.005);
  }, 180_000);
});

describe('S12: the shadow tool', () => {
  it('draws a stratified sample of 20 living, present people on days 1-354, and a detailed agent\'s day does not depend on what was stepped before', async () => {
    const T = await import('../tools/shadow_days');
    const S = T.pickSample(P, sim, 97); expect(S.detailed.length).toBe(6); expect(S.population.length).toBe(14);
    expect(S.detailed.filter(x => sim.agents[x.id].role === 'guard').length).toBe(3);
    expect(S.population.filter(x => T.terraceWorker(P.persons[x.pid])).length).toBeGreaterThanOrEqual(2); expect(S.population.filter(x => T.townsperson(P, P.persons[x.pid])).length).toBeGreaterThanOrEqual(3);
    const pids = [...S.detailed.map(x => sim.agents[x.id].pid), ...S.population.map(x => x.pid)]; expect(new Set(pids).size).toBe(20);
    for (const x of [...S.detailed.map(y => ({ pid: sim.agents[y.id].pid, day: y.day })), ...S.population]) { expect(P.present(x.pid, x.day)).toBe(true); expect(x.day).toBeGreaterThanOrEqual(0); expect(x.day).toBeLessThanOrEqual(353); }
    expect(T.julian(0)).toBe('17 Apr 467 BCE'); expect(T.julian(322)).toBe('5 Mar 466 BCE');
    const a = T.detailedDay(1, 26, 141), b0 = T.detailedDay(1, 52, 322), b = T.detailedDay(1, 26, 141); void b0; expect(b.log).toEqual(a.log); expect(a.log.length).toBeGreaterThan(20);
  }, 180_000);
});
