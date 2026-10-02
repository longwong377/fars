// D-570 (s17 C3): the court's camps lived in. The things before each standing tent (world/courtCamps.ts campItems) and the
// camps' picket lines of horses, mules and camels (world/fauna.ts addCampLines), measured in node: nothing inside a tent or a
// town plot, every camp with lines, the lines filled only while the camp's tents stand, and the building site and the camps
// populated by the population's own plans (tools/dev/road_census.ts siteCensus).
import { describe, it, expect, beforeAll } from 'vitest';
import { Population } from '../src/people/population';
import { EventCalendar } from '../src/people/calendar';
import { WeatherSystem } from '../src/weather/weatherState';
import { CAMPS, tentStands, type Tent } from '../src/people/camps';
import { campItems } from '../src/world/courtCamps';
import { Fauna, openGround } from '../src/world/fauna';
import { buildTownPlan, type TownPlan } from '../src/world/settlement/plan';
import { siteCensus } from '../tools/dev/road_census';

const inTent = (t: Tent, e: number, n: number, pad = 0.2) => { const a = t.heading * Math.PI / 180, fe = Math.sin(a), fn = Math.cos(a), de = e - t.e, dn = n - t.n, v = de * fe + dn * fn, u = de * fn - dn * fe; return Math.abs(u) < t.w / 2 + pad && Math.abs(v) < t.d / 2 + pad; };
let pop: Population, tents: Tent[], plan: TownPlan;
beforeAll(() => {
  pop = new Population(1, { court: true }); const W = new WeatherSystem(1);
  pop.attach(new EventCalendar(1, pop, (t: number) => { const d = Math.floor(t / 24), c = W.conditions(d, t - d * 24); return { rain: c.rain, lightning: c.lightning, windMs: c.windMs, tempC: c.tempC, dust: c.dust }; }, true));
  tents = (pop as any).court.tents; plan = buildTownPlan();
}, 240_000);

describe('the court’s camps lived in (D-570)', () => {
  it('every tent has its things before it, none inside a tent', () => {
    const I = campItems(tents), grid = new Map<string, number[]>(); tents.forEach((t, i) => { const k = `${Math.floor(t.e / 20)},${Math.floor(t.n / 20)}`; (grid.get(k) ?? grid.set(k, []).get(k)!).push(i); });
    expect(new Set(I.map(x => x.tent)).size).toBe(tents.length); expect(I.length).toBeGreaterThan(tents.length * 4);
    let bad = 0; for (const it of I) for (let a = -1; a <= 1; a++) for (let b = -1; b <= 1; b++) for (const j of grid.get(`${Math.floor(it.e / 20) + a},${Math.floor(it.n / 20) + b}`) ?? []) if (inTent(tents[j], it.e, it.n)) bad++;
    expect(bad).toBe(0);
  });
  it('each camp has picket lines clear of the tents and the town’s plots, filled only while its tents stand', () => {
    const F = new Fauna(1, plan, [], () => 0); F.addCampLines(tents, plan);
    const camps = new Set(F.campLines.map(L => L.camp)); for (const c of CAMPS) expect(camps.has(c.id), c.id).toBe(true);
    expect(F.campLines.filter(L => L.camp === 'p_horse').length).toBeGreaterThanOrEqual(6);
    for (const L of F.campLines) for (const q of L.slots) { expect(openGround(plan, q[0], q[1])).toBe(true); expect(tents.some(t => inTent(t, q[0], q[1], 1)), `${L.camp} line ${L.id}`).toBe(false); }
    const shares = (at: number) => { (F as any).shareAt = NaN; (F as any).campShares(at); return (F as any).share as Map<string, number>; };
    const court = tents.filter(t => t.camp === 'court'), on = court.find(t => t.pitch !== undefined)!, mid = ((on.pitch ?? 0) + (on.strike ?? 9000)) / 2;
    expect(shares(mid).get('court')).toBeGreaterThan(0.5); expect(shares((on.pitch ?? 0) - 48).get('court')).toBeLessThan(0.05);
    expect(court.filter(t => tentStands(t, mid)).length).toBeGreaterThan(court.length / 2);
  });
  it('the building site and the camps are peopled by the population’s own plans', () => {
    const on = tents.find(t => t.camp === 'court' && t.pitch !== undefined)!, d = Math.floor(((on.pitch ?? 0) + 48) / 24);
    const S = siteCensus(pop, [d, d + 1]) as any; const mean = (k: string) => Object.values(S[k].perHour as Record<string, number>).reduce((a, b) => a + b, 0) / Math.max(1, Object.keys(S[k].perHour).length);
    expect(mean('court camps')).toBeGreaterThan(500); expect(S['hall100 site'].acts.haul ?? 0).toBeGreaterThan(100);
  }, 240_000);
});
