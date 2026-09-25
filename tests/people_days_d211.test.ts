// D-211: the gap audit's sim fills (REVIEWS/gap_audit.md items 3, 9, 12, 24-26) and the round-9 reviewers' findings
// (REVIEWS/shadow_phase5_r9.md, reviewer A; _r9_b.md, reviewer B), each at its rule with a planCheck invariant:
//  1 festivals: two šip feasts and their festival days off (item 3): (o) `festival`;
//  2 the lanes at noon: the doorstep, the lane sellers, the children after the meal, the E-64 lull kept (item 9);
//  3 weddings: the dowry procession, the feast, the women's drum, the season (item 12): (p) `wedding`;
//  4 the healer's calls, the hearing before an official, the children's games (items 24-26);
//  5 r9: the bereaved mother (A S2): (q) `bereaved`; the herders' camp in the rain (B S2 / A S10): (a) `weather`; the boys at
//    the father's trade (A S5 / B S3); one errand to a house (A S6 / B S4); the breakfast "alone" (A S4): (d) `label`; the
//    house's water (A S7): (r) `water`; "storm" only with thunder (A S8): (d); the travellers' rations and station (A S9).
// Days are 0-based indices (the reviews print 1-based regnal days).
import { describe, it, expect, beforeAll } from 'vitest';
import { readFileSync } from 'node:fs';
import { NavGrid } from '../src/people/navgrid';
import { PeopleSim, Env } from '../src/people/sim';
import { type Seg, segAt, wetHours, CAMP_OPEN } from '../src/people/population';
import { checkPlan, invariants } from '../src/people/planCheck';
import { festivals, STORE_BOUNDS } from '../src/people/calendar';
import { musicAt, drumSlot, type PopPerformer } from '../src/audio/performers';
import { WeatherSystem } from '../src/weather/weatherState';

const W = new WeatherSystem(1);
const env = (t: number): Env => { const d = Math.floor(t / 24), c = W.conditions(d, t - d * 24); return { rain: c.rain, lightning: c.lightning, windMs: c.windMs, tempC: c.tempC, dust: c.dust }; };
const nav = () => new NavGrid(new Int16Array(readFileSync('public/generated/nav.i16').buffer.slice(0)), new Uint8Array(readFileSync('public/generated/nav_edges.u8')));
let sim: PeopleSim; let P: any;
beforeAll(() => { sim = new PeopleSim(1, nav(), env); P = (sim as any).pop; });
/** the issues of the named kinds over the persons and days chosen */
function sweep(pids: number[], kinds: string[], days: number[]) { const bad: string[] = []; let n = 0;
  for (const pid of pids) for (const d of days) { if (!P.present(pid, d)) continue; const g: Seg[] = P.plan(pid, d); const pr = d > 0 && P.present(pid, d - 1) ? P.plan(pid, d - 1) as Seg[] : null; n++;
    for (const x of checkPlan(P, pid, d, g, pr ? pr[pr.length - 1].place : null, pr)) if (kinds.includes(x.kind) && bad.length < 8) bad.push(`${pid} ${P.persons[pid].job} d${d} ${x.kind}: ${x.note}`); }
  return { n, bad }; }
const all = () => Array.from({ length: P.persons.length }, (_, i) => i);

describe('1 (gap audit item 3): the šip feasts and the festival days off', () => {
  it('two a year, in Nisannu and in Tashritu (Bāgayādiš), with their events; the stores stay in bounds', () => {
    const F = festivals(1); expect(F.length).toBe(2); expect(P.cal.ctx(F[0].day).month).toBe(1); expect(P.cal.ctx(F[1].day).month).toBe(7); expect(F[1].bagayadis).toBe(true);
    for (const f of F) { const ev = P.cal.ctx(f.day).events; expect(ev.some((e: any) => e.id === 'E-33' && e.n > 100)).toBe(true); expect(ev.some((e: any) => e.id === 'E-38')).toBe(true); }
    P.cal.ctx(353); for (const s of P.cal.stockLog) for (const [k, bd] of Object.entries(STORE_BOUNDS)) { if (!bd) continue; expect((s as any)[k], k).toBeGreaterThanOrEqual(bd[0]); expect((s as any)[k], k).toBeLessThanOrEqual(bd[1]); }
  }, 120_000);
  it('on both festival days nobody whose day off it is works, everyone\'s plan holds (every 3rd person), and the builders are off the Terrace', () => {
    const days = festivals(1).map(f => f.day); const r = sweep(all().filter(i => i % 3 === 0), ['festival', 'weather', 'light', 'label', 'meals', 'dress', 'wait', 'teen', 'siesta', 'water', 'reason'], days);
    expect(r.n).toBeGreaterThan(25_000); expect(r.bad).toEqual([]);
    for (const d of days) { let off = 0, up = 0; for (const pid of P.builders as number[]) { if (!P.festDay(pid, d)) continue; off++; if ((P.plan(pid, d) as Seg[]).some(s => s.where === 'terrace')) up++; } expect(off).toBeGreaterThan(250); expect(up).toBe(0); }
  }, 900_000);
  it('the houses\' heads fetch the šip meat in the morning; the houses feast at midday; some women drum in the lanes at dusk', () => {
    const d = festivals(1)[0].day; let fetch = 0, feast = 0, drum = 0, n = 0;
    for (let pid = 0; pid < P.persons.length; pid += 5) { if (!P.festDay(pid, d)) continue; n++; const g: Seg[] = P.plan(pid, d);
      if (g.some(s => s.place === 'offering_place') && g.some(s => /šip meat/.test(s.why) && s.act === 'carry_sack')) fetch++;
      if (g.some(s => s.act === 'eat' && /festival meal/.test(s.why))) feast++; if (g.some(s => /frame drum/.test(s.why))) drum++; }
    expect(fetch).toBeGreaterThan(200); expect(feast / n).toBeGreaterThan(0.6); expect(drum).toBeGreaterThan(50);
    // the drummers' gig: one beats the drum, the others sing (M-22)
    const pop: PopPerformer[] = [0, 1, 2].map(i => ({ pid: 900 + i, sex: 'f', age: 30, act: 'talk', why: 'singing and clapping with the women of the lane to the frame drum, a festival evening', place: 'lane:q_x', e: i, n: 0, y: 0, moving: false, seed: i }));
    expect(pop.every(drumSlot)).toBe(true); let seen = 0;
    for (let m = 0; m < 120; m++) for (const g of musicAt([], { t: d * 24 + 19 + m / 60, seed: 1, courtToday: false, courtYesterday: false, sun: { rise: 6, set: 18.8 }, foul: false }, pop)) { if (g.kind !== 'women_drum') continue; seen++;
      expect(g.parts.filter(p => p.play === 'frame_drum').length).toBe(1); expect(g.claims).toContain('M-22'); }
    expect(seen).toBeGreaterThan(0);
  }, 600_000);
});

describe('2 (gap audit item 9): the lanes at noon', () => {
  it('on a mild day the lanes hold the doorstep\'s work, the sellers and the children after the meal; on an E-64 day the lull holds', () => {
    const count = (d: number, h: number) => { let n = 0; for (let pid = 0; pid < P.persons.length; pid += 2) { if (!P.present(pid, d) || P.households[P.home(pid, d)].zone !== 'town') continue; if (segAt(P.plan(pid, d), h).place.startsWith('lane:')) n++; } return n; };
    expect(P.cal.ctx(25).heatRest).toBe(false); expect(count(25, 12.75)).toBeGreaterThan(400); expect(count(25, 12.2)).toBeGreaterThan(5);
    expect(P.cal.ctx(60).heatRest).toBe(true); expect(count(60, 13.25)).toBeLessThan(10);
    let door = 0, sell = 0; for (let pid = 0; pid < P.persons.length; pid += 2) { if (!P.present(pid, 25)) continue; const g: Seg[] = P.plan(pid, 25); if (g.some(s => /on the doorstep/.test(s.why) && s.place.startsWith('lane:'))) door++; if (g.some(s => /from a tray/.test(s.why))) sell++; }
    expect(door).toBeGreaterThan(300); expect(sell).toBeGreaterThan(20);
  }, 600_000);
});

describe('3 (gap audit item 12): weddings', () => {
  it('about half the year\'s weddings fall round the turn of the year; none on a festival day', () => {
    let n = 0, win = 0; const F = new Set(festivals(1).map(f => f.day));
    for (let d = 0; d < 354; d++) for (const x of P.lifeOn(d).marriages) { n++; if (d >= 325 || d <= 20) win++; expect(F.has(d)).toBe(false); void x; }
    expect(n).toBeGreaterThan(200); expect(win / n).toBeGreaterThan(0.4); expect(win / n).toBeLessThan(0.75);
  }, 120_000);
  it('the bride goes in procession with the dowry carried before her; the two houses feast at the groom\'s house; the women drum; every plan holds', () => {
    let n = 0; const days: number[] = []; for (let d = 0; d < 354 && days.length < 6; d += 7) if (P.weddingsOn(d).length) days.push(d);
    for (const d of days) for (const w of P.weddingsOn(d)) { n++; const WP = P.weddingPlan(w), T = P.households[w.to].home, mid = (WP.feast[0] + WP.feast[1]) / 2;
      const b: Seg[] = P.plan(w.bride, d); expect(b.some(s => /procession/.test(s.why) && s.where === 'road')).toBe(true); expect(segAt(b, mid).place).toBe(T); expect(segAt(P.plan(w.groom, d), mid).place).toBe(T);
      const ids = [...new Set([w.bride, w.groom, ...P.membersOn(w.from, d), ...P.membersOn(w.to, d)])] as number[];
      const carriers = ids.filter(x => (P.plan(x, d) as Seg[]).some(s => /dowry/.test(s.why) && /^carry/.test(s.act))); if (P.membersOn(w.from, d).some((x: number) => P.weddingOf(x, d) && P.persons[x].sex === 'f' && P.ageOn(x, d) >= 14)) expect(carriers.length).toBeGreaterThan(0);
      const r = sweep(ids, ['wedding', 'weather', 'light', 'label', 'meals', 'dress', 'teleport', 'water', 'reason', 'festival'], [d]); expect(r.bad).toEqual([]); }
    expect(n).toBeGreaterThan(5);
  }, 600_000);
});

describe('4 (gap audit items 24-26): the healer, the hearing, the games', () => {
  it('a healer calls at sick houses; a dispute is now and then heard before an official the next morning; the children play games in the lanes', () => {
    let calls = 0, hear = 0, games = 0;
    for (let d = 0; d < 354; d += 11) for (let pid = 0; pid < P.persons.length; pid++) { const p = P.persons[pid]; if (!P.present(pid, d)) continue;
      if ((p.job === 'homemaker' || p.job === 'elder') && P.healerRound(pid, d).length) { if ((P.plan(pid, d) as Seg[]).some(s => /healer’s call/.test(s.why))) calls++; }
      if (P.hearing(pid, d)) { const g: Seg[] = P.plan(pid, d); expect(g.some(s => s.place === 'official_bldg' && /before an official/.test(s.why))).toBe(true); hear++; }
      if (p.job === 'child' && pid % 7 === 0 && (P.plan(pid, d) as Seg[]).some(s => /ball|top|chase|knucklebones|on wheels/.test(s.why))) games++; }
    expect(calls).toBeGreaterThan(20); expect(hear).toBeGreaterThan(4); expect(games).toBeGreaterThan(500);
  }, 900_000);
});

describe('6: each new invariant finds its own fault in a made-up day (not vacuous)', () => {
  it('(o) festival, (p) wedding, (q) bereaved, (r) water, (d) the storm\'s word', () => {
    const k = (pid: number, d: number, segs: Seg[]) => invariants(P, pid, d, segs).map(x => x.kind);
    const fd = festivals(1)[0].day, b = (P.builders as number[]).find(x => P.festDay(x, fd))!, bh = P.households[P.home(b, fd)].home;
    const day = (pid: number, d: number, mid: Seg): Seg[] => { const home = P.households[P.home(pid, d)].home, W = P.households[P.home(pid, d)].zone === 'plain' ? 'plain' : 'town';
      return [{ t0: 0, t1: mid.t0, place: home, act: 'sleep', why: 'asleep', where: W }, mid, { t0: mid.t1, t1: 24, place: home, act: 'sleep', why: 'asleep', where: W }]; };
    expect(k(b, fd, day(b, fd, { t0: 8, t1: 12, place: 'hall100_site', act: 'dress_stone', why: 'dressing a block', where: 'terrace' }))).toContain('festival'); void bh;
    const wd = [...Array(354).keys()].find(d => P.weddingsOn(d).length)!, w = P.weddingsOn(wd)[0];
    expect(k(w.groom, wd, day(w.groom, wd, { t0: 8, t1: 20, place: 'lane:q_x', act: 'talk', why: 'talking', where: 'town' }))).toContain('wedding');
    const f = P.persons.findIndex((p: any, i: number) => p.sex === 'f' && p.job === 'homemaker' && P.present(i, 100) && !P.nurslings(i, 100).length && !P.childrenOf(i).some((c: number) => P.present(c, 100) && P.ageOn(c, 100) <= 1));
    expect(k(f, 100, day(f, 100, { t0: 8, t1: 9, place: P.households[P.home(f, 100)].home, act: 'rest', why: 'resting with the baby', where: 'town' }))).toContain('bereaved');
    const m = P.persons.findIndex((p: any, i: number) => p.sex === 'm' && p.job === 'farmer' && P.present(i, 100) && P.jarsOf(i, 100) === 0 && P.ageOn(i, 100) >= 16);
    const H = P.households[P.home(m, 100)]; expect(k(m, 100, day(m, 100, { t0: 8, t1: 8.3, place: `well:${H.q}`, act: 'draw_water', why: 'drawing water', where: 'plain' }))).toContain('water');
    const sd = [...Array(354).keys()].find(d => { const C = P.cal.ctx(d); return !!C.wx.stormH && !C.wx.thunderH; })!, x = P.persons.findIndex((p: any, i: number) => p.job === 'farmer' && P.present(i, sd));
    const xs: Seg[] = day(x, sd, { t0: P.cal.ctx(sd).wx.stormH![0], t1: P.cal.ctx(sd).wx.stormH![0] + 1, place: P.households[P.home(x, sd)].home, act: 'rest', why: 'at home: storm', where: 'plain' });
    expect(k(x, sd, xs)).toContain('label'); xs[1] = { ...xs[1], why: 'at home: heavy rain' }; expect(k(x, sd, xs)).not.toContain('label');
  }, 300_000);
});

describe('5 (shadow review r9): the reviewers\' findings at their rules', () => {
  it('A S2: Artaynte (1177) on day 213 does not speak of her dead baby; no mother does after its death (q), year-wide', () => {
    const g: Seg[] = P.plan(1177, 213); for (const s of g) expect(s.why).not.toMatch(/the baby|newborn/); expect(invariants(P, 1177, 213, g)).toEqual([]);
    let n = 0; const bad: string[] = [];
    for (let pid = 0; pid < P.persons.length; pid++) { const p = P.persons[pid]; if (p.sex !== 'f') continue;
      for (const c of P.childrenOf(pid)) { const q = P.persons[c]; if (q.born < 0 || q.dies >= 354 || q.dies - q.born > 45) continue;
        for (let d = q.dies; d < Math.min(354, q.born + 46); d++) { if (!P.present(pid, d)) continue; n++; for (const x of invariants(P, pid, d, P.plan(pid, d))) if (x.kind === 'bereaved' && bad.length < 5) bad.push(`${pid} d${d} ${x.note}`); } } }
    expect(n).toBeGreaterThan(300); expect(bad).toEqual([]);
  }, 600_000);
  it('B S2 / A S10: the herders\' camp work and leisure go into the tent in the rain (a), every herder on every wet day', () => {
    const wet = [...Array(354).keys()].filter(d => { const C = P.cal.ctx(d); return !!C.wx.rain || !!C.wx.stormH; });
    const ids = all().filter(i => P.persons[i].job === 'herder'); const r = sweep(ids, ['weather', 'light', 'dress', 'label'], wet); expect(r.n).toBeGreaterThan(200); expect(r.bad).toEqual([]);
    for (const pid of ids) for (const d of wet) { if (!P.present(pid, d)) continue; for (const s of P.plan(pid, d) as Seg[]) if (s.place.startsWith('camp:') && CAMP_OPEN.test(s.why) && s.act !== 'sleep') expect(wetHours(P.cal.ctx(d).wx, s.t0, s.t1), `${pid} d${d} ${s.why}`).toBe(0); }
  }, 600_000);
  it('A S5 / B S3: boys of 13-15 go now and then with their fathers of the gangs and the workshops (every 7th day)', () => {
    const by: Record<string, [number, number]> = {};
    for (let d = 0; d < 354; d += 7) for (let pid = 0; pid < P.persons.length; pid++) { const p = P.persons[pid]; if (p.job !== 'child' || p.sex !== 'm' || p.agent >= 0 || !P.present(pid, d)) continue; const a = P.ageOn(pid, d); if (a < 13 || a > 15) continue;
      const H = P.households[P.home(pid, d)]; if (H.zone !== 'town') continue; const fa = P.membersOn(H.id, d).find((x: number) => x !== pid && P.persons[x].sex === 'm' && !P.persons[x].kin && P.ageOn(x, d) >= a + 16); if (fa === undefined) continue;
      const r = (by[P.persons[fa].job] ??= [0, 0]); r[0]++; if ((P.plan(pid, d) as Seg[]).some(s => s.with === fa)) r[1]++; }
    for (const j of ['builder', 'weaver']) { expect(by[j]?.[0] ?? 0, j).toBeGreaterThan(30); expect(by[j][1] / by[j][0], j).toBeGreaterThan(0.1); }
  }, 900_000);
  it('A S6 / B S4, A S4, A S7, A S8, A S9: one errand to a house, the breakfast words, the house\'s water, the storm\'s word, the travellers\' rations (every 9th day, every 5th person)', () => {
    const days = [...Array(354).keys()].filter(d => d % 9 === 4); const ids = all().filter(i => i % 5 === 1);
    const r = sweep(ids, ['label', 'water'], days); expect(r.n).toBeGreaterThan(100_000); expect(r.bad).toEqual([]);
    let dup = 0, q = 0, empty = 0, home = 0;
    for (const d of days) for (let pid = 0; pid < P.persons.length; pid++) { const p = P.persons[pid]; if (!P.present(pid, d)) continue;
      if (p.job === 'child' && pid % 3 === 0) { const g: Seg[] = P.plan(pid, d); const h = g.filter(s => /^handing over the bread/.test(s.why)).map(s => s.place); if (h.length !== new Set(h).size || g.filter((s, i) => /barley for oil/.test(s.why) && !(i > 0 && g[i - 1].why === s.why && g[i - 1].place === s.place)).length > 1) dup++; } // (one exchange cut in two by the cold's dress is one)
      if (p.job === 'traveller') { const g: Seg[] = P.plan(pid, d); g.forEach((s, i) => { if (s.act === 'queue' && s.place === 'store_town') { q++; if (g[i + 1]?.where === 'road' && g[i + 1].act !== 'carry_sack') empty++; } if (s.place === 'station' && /at home/.test(s.why)) home++; }); } }
    expect(dup).toBe(0); expect(q).toBeGreaterThan(30); expect(empty).toBe(0); expect(home).toBe(0);
    for (let d = 0; d < 354; d++) { const C = P.cal.ctx(d); if (!C.wx.stormH || C.wx.thunderH) continue; for (let pid = 0; pid < P.persons.length; pid += 13) if (P.present(pid, d)) for (const s of P.plan(pid, d) as Seg[]) expect(s.why).not.toMatch(/\bstorm\b/); }
  }, 900_000);
});
