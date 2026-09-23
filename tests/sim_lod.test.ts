// Simulation LOD and persistence (D-017): abstract agents make the same decisions with timed travel; promotion re-routes
// from where they are; a two-day catch-up advances the world (stocks, events) and leaves nobody stuck.
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { NavGrid } from '../src/people/navgrid';
import { PeopleSim, Env } from '../src/people/sim';
import { WeatherSystem } from '../src/weather/weatherState';
const nav = new NavGrid(new Int16Array(readFileSync('public/generated/nav.i16').buffer.slice(0)), new Uint8Array(readFileSync('public/generated/nav_edges.u8')));
const W = new WeatherSystem(1);
const env = (t: number): Env => { const d = Math.floor(t / 24), c = W.conditions(d, t - d * 24); return { rain: c.rain, lightning: c.lightning, windMs: c.windMs, tempC: c.tempC }; };
describe('simulation LOD and catch-up', () => {
  it('abstract travel arrives after distance × detour / speed, then performs the task', () => {
    const sim = new PeopleSim(1, nav, env); for (const a of sim.agents) a.lod = 'abstract'; sim.jumpTo(24 * 3 + 9);
    let travelled = 0; for (let i = 0; i < 600; i++) { sim.step(5); travelled += sim.agents.filter(a => a.travel).length; }
    expect(travelled).toBeGreaterThan(0);
    for (const a of sim.agents) { expect(Number.isFinite(a.pos[0]) && Number.isFinite(a.pos[1])).toBe(true); if (!a.walking && !a.offmap && a.task) expect(Math.hypot(a.pos[0] - a.task.spot[0], a.pos[1] - a.task.spot[1])).toBeLessThan(1.5); }
  });
  it('promotion mid-journey re-routes on the walkable grid from the current position (nobody jumps)', () => {
    const sim = new PeopleSim(1, nav, env); for (const a of sim.agents) a.lod = 'abstract'; sim.jumpTo(24 * 3 + 7.5);
    for (let i = 0; i < 400; i++) sim.step(5);
    const moving = sim.agents.filter(a => a.travel); expect(moving.length).toBeGreaterThan(0);
    const before = moving.map(a => [...a.pos]);
    sim.updateLod([0, 0], 1e9);
    // promoted: re-routed from (at most a 6 m step to walkable ground from) where they were; the rest wait to arrive
    let promoted = 0;
    moving.forEach((a, i) => { expect(Math.hypot(a.pos[0] - before[i][0], a.pos[1] - before[i][1])).toBeLessThan(6.01); if (a.lod === 'full') { promoted++; expect(a.travel).toBeNull(); } });
    expect(promoted).toBeGreaterThan(moving.length / 2);
  });
  it('a two-day catch-up advances stocks and events and leaves nobody stuck', () => {
    const sim = new PeopleSim(1, nav, env); sim.jumpTo(24 * 5 + 8); const store0 = sim.stock.store, ev0 = sim.events.length;
    for (const a of sim.agents) a.lod = 'abstract';
    const target = sim.t + 48; while (sim.t < target - 1e-6) sim.step(Math.min(60, (target - sim.t) * 3600));
    expect(sim.events.length).toBeGreaterThan(ev0); expect(sim.stock.store).not.toBe(store0);
    for (const a of sim.agents) expect(a.task!.until).toBeGreaterThan(sim.t - 30);
  });
});
