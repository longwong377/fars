// Phase 5 shadow review round 6 (REVIEWS/shadow_phase5_r6.md, reviewer A; REVIEWS/shadow_phase5_r6_b.md, reviewer B; D-186):
// a test for each finding, against the numbers the reviewers measured on the round-6 code (74c026d).
//  S1 (A, B) "receiving hides" with no delivery behind it; S2 (A, B) the guards' hearth loop and the unread water_duty and
//  town_errand; S3 (A, B) family visits; S4 (A, B) babies' daytime feed gaps; S5 (A) no dress for the cold; S5 (B) baking
//  before dawn; S6 (A) / S8 (B) the tool's weather header; S6 (B) lambs out of season; S7 (B) the traveller's animals; S9 (B)
//  the foreman's kit.
import { describe, it, expect, beforeAll } from 'vitest';
import { readFileSync } from 'node:fs';
import { NavGrid } from '../src/people/navgrid';
import { PeopleSim, Env } from '../src/people/sim';
import type { Seg } from '../src/people/population';
import { checkPlan } from '../src/people/planCheck';
import { weatherMask, coldBits, pieceBit, COLD_C } from '../src/people/outfits';
import { WeatherSystem } from '../src/weather/weatherState';

const W = new WeatherSystem(1);
const env = (t: number): Env => { const d = Math.floor(t / 24), c = W.conditions(d, t - d * 24); return { rain: c.rain, lightning: c.lightning, windMs: c.windMs, tempC: c.tempC, dust: c.dust }; };
const nav = () => new NavGrid(new Int16Array(readFileSync('public/generated/nav.i16').buffer.slice(0)), new Uint8Array(readFileSync('public/generated/nav_edges.u8')));
let sim: PeopleSim; let P: any;
beforeAll(() => { sim = new PeopleSim(1, nav(), env); P = (sim as any).pop; });
const resident = (pid: number, d: number) => P.present(pid, d) && ['town', 'plain'].includes(P.households[P.home(pid, d)].zone);

describe('S1 (A, B): the Treasury receives what is delivered', () => {
  it('year-wide: hides are received only on a delivery day, from the carriers\' arrival, by at most two storekeepers, for about the time the count takes (was 5,943 person-hours, 47 % on days with no delivery)', () => {
    const staff = P.persons.filter((p: any) => p.job === 'treasury' && (p.work === 'treasury_inside' || p.work === 'treasury_store')).map((p: any) => p.id);
    let hours = 0, deliveries = 0;
    for (let d = 0; d < 354; d++) { const HD = P.hideDelivery(d); if (HD) { deliveries++; expect(HD.n).toBe(P.hidesOn(d)); expect(HD.n).toBeGreaterThanOrEqual(6); expect(HD.receivers.length).toBeLessThanOrEqual(2); }
      const recv = new Set<number>();
      for (const pid of staff) { if (!P.present(pid, d)) continue;
        for (const s of P.plan(pid, d) as Seg[]) { if (!/hides/.test(s.why)) continue; hours += s.t1 - s.t0; recv.add(pid);
          expect(HD, `${pid} d${d}: hides with no delivery`).not.toBeNull(); expect(s.t0, `${pid} d${d}`).toBeGreaterThanOrEqual(HD!.t0 - 1e-6); expect(s.t1, `${pid} d${d}`).toBeLessThanOrEqual(HD!.t1 + 0.2 + 1e-6);
          expect(P.persons[pid].sub).toBe('storekeeper'); } }
      expect(recv.size, `day ${d}`).toBeLessThanOrEqual(2); }
    expect(deliveries).toBeGreaterThan(25); expect(hours).toBeGreaterThan(10); expect(hours).toBeLessThan(deliveries * 2 * 1.0);
  }, 600_000);
  it('1888 on Nisanu 7 (day 6) does his own trade, and the day\'s 9 hides are received at 09:10 by two storekeepers; each silver payment is weighed out by one weigher for its two hours', () => {
    const g: Seg[] = P.plan(1888, 6); expect(g.some(s => /hides/.test(s.why))).toBe(false); expect(new Set(g.filter(s => s.where === 'terrace').map(s => s.act)).size).toBeGreaterThanOrEqual(2);
    const HD = P.hideDelivery(6); expect(HD.n).toBe(9); expect(HD.receivers.length).toBe(2);
    for (const r of HD.receivers) expect((P.plan(r, 6) as Seg[]).filter(s => /hides/.test(s.why)).reduce((a, s) => a + s.t1 - s.t0, 0)).toBeLessThan(0.7);
    let pays = 0; for (let d = 0; d < 354; d += 3) { const PW = P.payWeighers(d); pays += PW.length;
      for (const pid of P.persons.filter((p: any) => p.job === 'treasury' && p.sub === 'weigher' && P.present(p.id, d)).map((p: any) => p.id)) {
        const h = (P.plan(pid, d) as Seg[]).filter(s => /weighing out/.test(s.why)).reduce((a, s) => a + s.t1 - s.t0, 0); const mine = PW.filter((x: any) => x.weigher === pid).length;
        expect(h, `${pid} d${d}`).toBeLessThanOrEqual(2 * mine + 1e-6); } }
    expect(pays).toBeGreaterThan(20);
  }, 300_000);
});

describe('S2, S3 (A, B): the guards\' days off watch', () => {
  const stats = () => { const out: { pid: number; d: number; best: number; storm: boolean; segs: Seg[] }[] = [];
    for (const pid of P.garrison) for (let d = 1; d < 354; d += 2) { if (!P.present(pid, d)) continue; const segs: Seg[] = P.plan(pid, d); let cur = 0, best = 0;
      for (const s of segs) { if (/^garrison_hearth/.test(s.place) && s.act !== 'sleep') { cur += s.t1 - s.t0; best = Math.max(best, cur); } else cur = 0; }
      out.push({ pid, d, best, storm: P.cal.ctx(d).wx.storm, segs }); }
    return out; };
  let S: ReturnType<typeof stats>;
  it('no guard-day holds 10 h unbroken at one hearth, and outside storm days none 6 h (was 10.3 % of guard-days at 10 h or more, 19.4 % at 8 h)', () => {
    S = stats(); expect(S.length).toBeGreaterThan(15_000);
    expect(S.filter(x => x.best >= 10).map(x => `${x.pid} d${x.d} ${x.best.toFixed(2)}`)).toEqual([]);
    expect(S.filter(x => !x.storm && x.best >= 6).map(x => `${x.pid} d${x.d} ${x.best.toFixed(2)}`)).toEqual([]);
    expect(S.filter(x => x.best >= 8).length / S.length).toBeLessThan(0.005);
  }, 600_000);
  it('the day\'s duties and occupations are used: the file\'s water, errands in the town, practice with the bow, the kit; every guard-day passes checkPlan', () => {
    const share = (re: RegExp) => S.filter(x => x.segs.some(s => re.test(s.why))).length / S.length;
    expect(share(/water for his file/)).toBeGreaterThan(0.08); expect(share(/errand for his file/)).toBeGreaterThan(0.08); expect(share(/bow and the spear/)).toBeGreaterThan(0.1); expect(share(/arms and kit/)).toBeGreaterThan(0.2);
    let bad = 0; for (const x of S.filter((_, i) => i % 5 === 0)) { const prev = P.present(x.pid, x.d - 1) ? (P.plan(x.pid, x.d - 1) as Seg[]).slice(-1)[0].place : null; if (checkPlan(P, x.pid, x.d, x.segs, prev).length) bad++; }
    expect(bad).toBe(0);
  }, 600_000);
  it('married guards go down to their families on most days they are well and here, never 4 such days running without going into the town (was 36.6 %, runs to 26 days)', () => {
    let days = 0, visits = 0, worst = 0;
    for (const pid of P.garrison) { if (P.households[P.home(pid, 0)].zone !== 'town') continue; let run = 0;
      for (let d = 0; d < 354; d++) { if (!P.present(pid, d) || P.sick(pid, d) || P.households[P.home(pid, d)].zone !== 'town') { run = 0; continue; } const segs: Seg[] = P.plan(pid, d); days++;
        if (segs.some(s => /with his (wife|household|family)/.test(s.why))) visits++;
        if (segs.some(s => s.where === 'town') || P.cal.ctx(d).wx.storm) run = 0; else { run++; worst = Math.max(worst, run); } } }
    expect(visits / days).toBeGreaterThan(0.6); expect(worst).toBeLessThanOrEqual(3);
  }, 600_000);
  it('a man with no family goes down to the town or the river on some night-watch days in months 1-5 too (was none), and sleeps in the afternoon before a night watch', () => {
    let n = 0, trips = 0, slept = 0; for (const pid of P.garrison) { if (P.households[P.home(pid, 0)].zone === 'town') continue;
      for (let d = 0; d < 148; d += 2) { if (!P.present(pid, d) || P.sick(pid, d)) continue; const me = P.rota(d).get(pid); if (!me || me.watch !== 2) continue; n++; const segs: Seg[] = P.plan(pid, d);
        if (segs.some(s => s.where === 'town')) trips++; if (segs.some(s => /sleeping in the afternoon before the night watch/.test(s.why) && s.t1 - s.t0 >= 1.5)) slept++; } }
    expect(n).toBeGreaterThan(200); expect(trips / n).toBeGreaterThan(0.25); expect(slept / n).toBeGreaterThan(0.9);
  }, 300_000);
});

describe('S4 (A, B): babies are fed by day as the planner\'s rule says', () => {
  it('babies under two months (every 7th day): a daytime gap between feeds of more than 4 h on under 0.5 % of their days (was 4.4 %)', () => {
    let n = 0, bad = 0; for (let d = 0; d < 354; d += 7) for (let pid = 0; pid < P.persons.length; pid++) { const p = P.persons[pid]; if (p.job !== 'child' || !P.present(pid, d)) continue; const a = P.ageDays(pid, d); if (a < 1 || a >= 60) continue; n++;
      const f = (P.plan(pid, d) as Seg[]).filter(s => s.act === 'eat' && /nursed/.test(s.why) && s.t0 >= 6 && s.t0 <= 20); for (let i = 1; i < f.length; i++) if (f[i].t0 - f[i - 1].t1 > 4) { bad++; break; } }
    expect(n).toBeGreaterThan(10_000); expect(bad / n).toBeLessThan(0.005);
    const g = (P.plan(45124, 172) as Seg[]).filter(s => s.act === 'eat' && /nursed/.test(s.why) && s.t0 >= 6 && s.t0 <= 20); for (let i = 1; i < g.length; i++) expect(g[i].t0 - g[i - 1].t1).toBeLessThanOrEqual(3.3);
  }, 600_000);
});

describe('minor findings', () => {
  it('no kneading or baking in the morning before 1.2 h before sunrise (B S5: 03:24 with sunrise at 05:19)', () => {
    let n = 0; for (const d of [21, 101, 181, 261, 341]) { const { rise } = P.cal.ctx(d).sun; for (let pid = d % 3; pid < P.persons.length; pid += 3) { if (!resident(pid, d)) continue;
      for (const s of P.plan(pid, d) as Seg[]) if ((s.act === 'knead' || s.act === 'bake') && s.t0 < 12) { n++; expect(s.t0, `${pid} d${d} ${s.why}`).toBeGreaterThanOrEqual(rise - 1.2 - 1e-3); } } } // (to the planner's sliver rule, 3.6 s)
    expect(n).toBeGreaterThan(1000); const m: Seg[] = P.plan(11518, 21); expect(m.filter(s => s.act === 'knead' && s.t0 < 12).every(s => s.t0 >= P.cal.ctx(21).sun.rise - 1.2 - 1e-6)).toBe(true);
  }, 300_000);
  it('the herders\' children are "with the lambs" only in the months of the lambs (10-2); the traveller unloads and waters the animals before the queue for the rations; the foreman carries a cord and a straightedge', () => {
    for (let d = 0; d < 354; d += 5) { const m = P.cal.ctx(d).month; if ([10, 11, 12, 1, 2].includes(m)) continue;
      for (const p of P.persons) { if (p.job !== 'herder' || !P.present(p.id, d)) continue; if (p.id % 4) continue; for (const s of P.plan(p.id, d) as Seg[]) expect(s.why, `${p.id} d${d}`).not.toMatch(/lambs/); } }
    const tr = P.persons.filter((p: any) => p.job === 'traveller'); let n = 0;
    for (const p of tr.slice(0, 80)) { const segs: Seg[] = P.plan(p.id, p.arrive); const q = segs.findIndex(s => s.act === 'queue'), a = segs.findIndex(s => /unloading and watering/.test(s.why)); if (q < 0 || a < 0) continue; n++; expect(a, `${p.id}`).toBeLessThan(q);
      const arr = segs.find(s => /arriving at the road station/.test(s.why)); if (arr) expect(arr.t1 - arr.t0).toBeLessThan(0.15); }
    expect(n).toBeGreaterThan(20);
    const fm = sim.agents.find(a => a.role === 'foreman')!; const fs: Seg[] = P.plan(fm.pid, 70); expect(fs.some(s => /cord and a straightedge/.test(s.carry ?? ''))).toBe(true); expect(fs.some(s => /chisels/.test(s.carry ?? ''))).toBe(false);
  }, 300_000);
  it('the sample\'s day line shows the storm and the rain the planners obey (A S6, B S8: day 324 printed as "rain")', async () => {
    const T = await import('../tools/shadow_days'); const line = T.dayLine(sim, W, 323); expect(line).toMatch(/(heavy rain|thunder [^,]*, heavy weather) 05:45–13:30/); // (D-211: "storm" only where it thunders, A S8 of r9) expect(line).toMatch(/rain \d\d:\d\d–/);
  });
});

describe('S5 (A): dressed for the cold', () => {
  it('below 8 °C the dress\'s own pieces go on (the Median kandys, a working man\'s trousers and cap, a woman\'s mantle over her hair, a child\'s shoes), not above; the Persian robe is unchanged', () => {
    const k = 1 << pieceBit('median', 'kandys'); expect(weatherMask('median', 1, COLD_C - 1) & k).toBe(k); expect(weatherMask('median', 1, COLD_C + 1) & k).toBe(0);
    const hc = 1 << pieceBit('woman', 'headcloth'), hair = 1 << pieceBit('woman', 'hair'); const w = weatherMask('woman', 1 | hair, 2); expect(w & hc).toBe(hc); expect(w & hair).toBe(0);
    expect(coldBits('worker')[0]).toBe((1 << pieceBit('worker', 'work_trousers')) | (1 << pieceBit('worker', 'cap_soft'))); expect(coldBits('child')[0]).toBe(1 << pieceBit('child', 'shoes'));
    expect(weatherMask('persian', 0b1011, -5)).toBe(0b1011);
  });
  it('the plans say so out of doors in the cold (#109 at -2 °C, 34914 out for fuel at -3 °C) and never in the warm', () => {
    const cold = (d: number, h: number) => P.cal.ctx(d).wx.tempQ[Math.floor(h * 4)] < COLD_C; let n = 0;
    const g: Seg[] = P.plan(34914, 251); expect(g.filter(s => s.act === 'gather').every(s => /against the cold/.test(s.wear ?? '') || !cold(251, s.t0))).toBe(true);
    expect(g.some(s => /against the cold/.test(s.wear ?? ''))).toBe(true);
    for (const d of [84, 120]) for (let pid = 0; pid < P.persons.length; pid += 11) { if (!resident(pid, d)) continue; for (const s of P.plan(pid, d) as Seg[]) { if (!/against the cold/.test(s.wear ?? '')) continue; n++; expect(cold(d, s.t0) || cold(d, (s.t0 + s.t1) / 2), `${pid} d${d}`).toBe(true); } }
    expect(n).toBe(0);
  }, 300_000);
});
