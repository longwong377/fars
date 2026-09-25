// dev: print one person's day plans (the soak's population plans) for a range of days
// Usage: npx tsx tools/dev/plan_dump.ts <pid> <day0> [day1=day0] [seed=1] [--court]
import { readFileSync } from 'node:fs';
import { NavGrid } from '../../src/people/navgrid';
import { PeopleSim, Env } from '../../src/people/sim';
import { WeatherSystem } from '../../src/weather/weatherState';
import { checkPlan } from '../../src/people/planCheck';
const a = process.argv.slice(2).filter(x => !x.startsWith('--')).map(Number), court = process.argv.includes('--court');
const [pid, d0] = a, d1 = a[2] ?? d0, seed = a[3] ?? 1;
const nav = new NavGrid(new Int16Array(readFileSync('public/generated/nav.i16').buffer.slice(0)), new Uint8Array(readFileSync('public/generated/nav_edges.u8')));
const W = new WeatherSystem(seed);
const env = (t: number): Env => { const d = Math.floor(t / 24), c = W.conditions(d % W.days.length, t - d * 24); return { rain: c.rain, lightning: c.lightning, windMs: c.windMs, tempC: c.tempC, dust: c.dust }; };
const sim = new PeopleSim(seed, nav, env, { court }); for (const ag of sim.agents) ag.lod = 'abstract'; sim.jumpTo(0); sim.cal.ctx(d1 + 1);
const P = sim.pop, p = P.persons[pid]; console.log(`person ${pid}: ${p.job} ${p.sex}${p.age} home ${(p as any).home ?? ''}`);
let prev: any = null;
for (let d = d0; d <= d1; d++) { const segs = P.plan(pid, d); console.log(`--- day ${d}`);
  for (const s of segs) console.log(`  ${s.t0.toFixed(2)}–${s.t1.toFixed(2)} ${s.place} ${(s as any).where ?? ''} ${s.act ?? ''} | ${(s as any).why ?? ''}`);
  const iss = checkPlan(P, pid, d, segs, prev ? prev[prev.length - 1].place : null, prev); if (iss.length) console.log('  issues:', JSON.stringify(iss)); prev = segs; }
