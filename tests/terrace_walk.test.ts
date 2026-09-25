// Shadow review round 10 B, S1: a walk between two places ON the Terrace (the plan writes every walk as a road:terrace
// block) must be walked on the Terrace, not played as a trip off it (an official 38 min off the Terrace for a 3-min walk;
// 49 % of the detailed scribes' days, 17 % of the officials').
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { NavGrid } from '../src/people/navgrid';
import { PeopleSim, type Env } from '../src/people/sim';
import { WeatherSystem } from '../src/weather/weatherState';

describe('walks between Terrace places stay on the Terrace (r10 B S1)', () => {
  it('every road block between two Terrace blocks of a detailed agent\'s plan decides to an on-Terrace task', () => {
    const nav = new NavGrid(new Int16Array(readFileSync('public/generated/nav.i16').buffer.slice(0)), new Uint8Array(readFileSync('public/generated/nav_edges.u8')));
    const W = new WeatherSystem(1), env = (t: number): Env => { const d = Math.floor(t / 24), c = W.conditions(d % W.days.length, t - d * 24); return { rain: c.rain, lightning: c.lightning, windMs: c.windMs, tempC: c.tempC, dust: c.dust }; };
    const sim = new PeopleSim(1, nav, env); for (const a of sim.agents) a.lod = 'abstract'; sim.jumpTo(0);
    let n = 0; const off: string[] = [];
    for (let d = 0; d < 354; d += 7) for (const a of sim.agents) {
      const plan = sim.planOf(a, d);
      for (let i = 1; i < plan.length - 1; i++) { const s = plan[i], pv = plan[i - 1], nx = plan[i + 1];
        if (s.where !== 'road' || pv.where !== 'terrace' || nx.where !== 'terrace' || s.t1 - s.t0 < 1e-3) continue;
        (sim as any).t = d * 24 + (s.t0 + s.t1) / 2; const T = sim.decide(a); n++;
        if (T.off && off.length < 6) off.push(`${a.id} ${a.role} day ${d} ${s.t0.toFixed(2)} ${pv.place} → ${nx.place}`); } }
    expect(off).toEqual([]); expect(n).toBeGreaterThan(50);
  }, 300_000);
});
