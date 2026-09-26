// dev (D-229, Phase 5 review M3): the people simulation's step on the main thread, measured as the world runs it (one
// route search per step, the detailed agents at full LOD): 1× (1/60 s a frame) and 60× (one game minute a frame), with
// the frames that cross midnight and the slowest frames named by what they did (a day rollover, route searches).
// Usage: npx tsx tools/dev/sim_cost.ts [court] [day=41] [frames60=1440]
import { readFileSync } from 'node:fs';
import { NavGrid } from '../../src/people/navgrid';
import { PeopleSim, Env } from '../../src/people/sim';
import { WeatherSystem } from '../../src/weather/weatherState';
const court = process.argv.includes('court'), a = process.argv.slice(2).filter(x => x !== 'court').map(Number), day = a[0] ?? 41, n60 = a[1] ?? 1440;
const nav = new NavGrid(new Int16Array(readFileSync('public/generated/nav.i16').buffer.slice(0)), new Uint8Array(readFileSync('public/generated/nav_edges.u8')));
const W = new WeatherSystem(1);
const env = (t: number): Env => { const d = Math.floor(t / 24), c = W.conditions(d % W.days.length, t - d * 24); return { rain: c.rain, lightning: c.lightning, windMs: c.windMs, tempC: c.tempC, dust: c.dust }; };
const t0 = performance.now(); const sim = new PeopleSim(1, nav, env, { court }); sim.routeSearchesPerStep = 1; const build = performance.now() - t0;
const t1 = performance.now(); sim.jumpTo(24 * day - 10 / 3600); sim.updateLod([0, 0], 1e9); const jump = performance.now() - t1;
const stat = (x: number[]) => { const s = [...x].sort((p, q) => p - q), m = x.reduce((p, q) => p + q, 0) / x.length; return { mean: +m.toFixed(3), p50: +s[Math.floor(s.length / 2)].toFixed(3), p99: +s[Math.floor(s.length * 0.99)].toFixed(3), max: +s[s.length - 1].toFixed(3), over16: x.filter(v => v > 16.7).length }; };
const r1: number[] = []; let mid1 = 0; for (let i = 0; i < 60 * 30; i++) { const d0 = Math.floor(sim.t / 24), q = performance.now(); sim.step(1 / 60); const dt = performance.now() - q; r1.push(dt); if (Math.floor(sim.t / 24) !== d0) mid1 = dt; }
const r60: number[] = [], slow: { i: number; ms: number; hour: number; midnight: boolean }[] = [];
for (let i = 0; i < n60; i++) { const d0 = Math.floor(sim.t / 24), q = performance.now(); sim.step(60); const dt = performance.now() - q; r60.push(dt); slow.push({ i, ms: +dt.toFixed(1), hour: +(sim.t % 24).toFixed(2), midnight: Math.floor(sim.t / 24) !== d0 }); }
slow.sort((p, q) => q.ms - p.ms);
console.log(JSON.stringify({ court, people: sim.pop.persons.length, agents: sim.agents.length, buildMs: +build.toFixed(0), jumpMs: +jump.toFixed(0), x1: { ...stat(r1), midnightMs: +mid1.toFixed(1) }, x60: stat(r60), slowest60: slow.slice(0, 12) }, null, 1));
