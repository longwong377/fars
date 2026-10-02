// D-570 (s17 C3): the people of the hinterland on the roads into Pārsa (world/roadFolk.ts), measured in node: the done line
// of the C3 brief (no road stretch within 2.5 km of the Terrace empty for more than two minutes of dry daylight:
// tools/dev/road_census.ts), every traveller with a purpose, the same households going in and coming home, the paths off the
// Terrace and the town's plots, and the day's trips a pure function of the seed and the calendar.
import { describe, it, expect, beforeAll } from 'vitest';
import { Traffic, along, type Mover } from '../src/world/traffic';
import { RoadFolk, household, ROAD_HH } from '../src/world/roadFolk';
import { buildTownPlan, type TownPlan } from '../src/world/settlement/plan';
import { toLocal } from '../src/world/settlement/site';
import { Population } from '../src/people/population';
import { EventCalendar } from '../src/people/calendar';
import { WeatherSystem } from '../src/weather/weatherState';
import { census } from '../tools/dev/road_census';
import footprints from '../src/data/geo/footprints.json';

const TERRACE = (footprints as any).terrace.polygon as number[][];
const inside = (poly: number[][], e: number, n: number) => { let c = false; for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) { const [xi, yi] = poly[i], [xj, yj] = poly[j]; if ((yi > n) !== (yj > n) && e < ((xj - xi) * (n - yi)) / (yj - yi) + xi) c = !c; } return c; };
const inPlot = (plan: TownPlan, e: number, n: number) => { for (const s of plan.sites) { const [u, v] = toLocal(s.frame, e, n), i = s.ci(u), j = s.cj(v); if (!s.inb(i, j)) continue; if (s.cell[s.k(i, j)] >= 0) return s.id; } return null; };

let pop: Population, traffic: Traffic, plan: TownPlan;
beforeAll(() => {
  pop = new Population(1, {}); const W = new WeatherSystem(1);
  pop.attach(new EventCalendar(1, pop, (t: number) => { const d = Math.floor(t / 24), c = W.conditions(d, t - d * 24); return { rain: c.rain, lightning: c.lightning, windMs: c.windMs, tempC: c.tempC, dust: c.dust }; }));
  plan = buildTownPlan(); traffic = new Traffic(1, pop as any, plan);
}, 240_000);

describe('the road folk (D-570)', () => {
  it('no road stretch near Pārsa stands empty for more than two minutes of dry daylight (the C3 done line)', () => {
    const c = census(traffic, pop as any, [20, 110, 200, 290], 20, 2500);
    expect(c.stretches).toBeGreaterThan(30);
    expect(c.worstGapMin, JSON.stringify(c.worst.slice(0, 3))).toBeLessThanOrEqual(2);
    expect(c.noWhy).toBe(0);
  }, 120_000);
  it('every traveller has a purpose, a look, and the paths keep off the Terrace and the town’s plots', () => {
    const out: Mover[] = [], seen = new Set<string>();
    for (let h = 5; h < 19; h += 0.25) { traffic.folk.at(110 * 24 + h, out); const ids = out.map(m => m.look.id); expect(new Set(ids).size, `a person twice at ${h} h`).toBe(ids.length); for (const m of out) { if (seen.has(m.key)) continue; seen.add(m.key);
      expect(m.why.length, m.key).toBeGreaterThan(12); expect(['m', 'f']).toContain(m.look.sex); expect(Number.isFinite(m.e) && Number.isFinite(m.n)).toBe(true); } out.length = 0; }
    expect(seen.size).toBeGreaterThan(500);
    const F = traffic.folk as any; for (const P of [...F.paths.flatMap((p: any) => [p.inn, p.out]), F.through.sw, F.through.ws]) for (let s = 0; s <= P.len; s += 3) { const p = along(P, s);
      expect(inside(TERRACE, p.e, p.n), `on the Terrace at ${p.e.toFixed(0)},${p.n.toFixed(0)}`).toBe(false); expect(inPlot(plan, p.e, p.n), `in a plot at ${p.e.toFixed(0)},${p.n.toFixed(0)}`).toBe(null); }
  });
  it('herders graze their flocks on the verges, off the Terrace and the town’s plots', () => {
    let n = 0; for (let d = 0; d < 360; d += 9) for (const v of traffic.folk.vergeFlocks(d)) { const out: Mover[] = []; for (let t = v.t0; t <= v.t1; t += 0.25) { out.length = 0; traffic.folk.at(t, out);
      for (const m of out.filter(q => q.key.startsWith(v.key))) { n++; expect(m.act).toBe('herd'); expect(inside(TERRACE, m.e, m.n)).toBe(false); expect(inPlot(plan, m.e, m.n), `${m.key} at ${m.e.toFixed(0)},${m.n.toFixed(0)}`).toBe(null); } } }
    expect(n).toBeGreaterThan(100);
  });
  it('the households that come in go home the same afternoon (or next morning from their kin), as the same people', () => {
    const F = traffic.folk as any, T = F.dayTrips(110) as any[], ins = T.filter(t => /:i\d+$/.test(t.key)), outs = T.filter(t => /:o\d+$/.test(t.key));
    expect(ins.length).toBeGreaterThan(80); expect(outs.length).toBeGreaterThan(40);
    const ids = new Set(ins.flatMap(t => t.people.map((p: any) => p.look.id))), back = outs.filter(t => t.people.some((p: any) => ids.has(p.look.id)));
    expect(back.length / outs.length).toBeGreaterThan(0.6);
    for (const t of outs) if (/unloaded string/.test(t.people[0].why)) expect(t.kind).toBe('pack');
  });
  it('the day’s trips are a pure function of the seed and the calendar; households differ', () => {
    const a = new RoadFolk(1, pop.cal).dayTrips(77), b = new RoadFolk(1, pop.cal).dayTrips(77), c = new RoadFolk(2, pop.cal).dayTrips(77);
    expect(a.map(t => `${t.key}@${t.t0.toFixed(4)}`).join()).toBe(b.map(t => `${t.key}@${t.t0.toFixed(4)}`).join());
    expect(a.map(t => t.t0.toFixed(4)).join()).not.toBe(c.map(t => t.t0.toFixed(4)).join());
    const lives = new Set(Array.from({ length: ROAD_HH }, (_, i) => household(1, 0, i).live)); expect(lives.size).toBeGreaterThanOrEqual(6);
  });
});
