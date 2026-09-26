// dev (D-229): planCheck over the court's people (or everyone with --all) on chosen days, with yesterday's plan
// Usage: npx tsx tools/dev/court_plans.ts <day,day,...> [seed=1] [--all]
import { readFileSync } from 'node:fs';
import { NavGrid } from '../../src/people/navgrid';
import { PeopleSim, Env } from '../../src/people/sim';
import { WeatherSystem } from '../../src/weather/weatherState';
import { checkPlan } from '../../src/people/planCheck';
const a = process.argv.slice(2).filter(x => !x.startsWith('--')), all = process.argv.includes('--all');
const days = a[0].split(',').map(Number), seed = +(a[1] ?? 1);
const nav = new NavGrid(new Int16Array(readFileSync('public/generated/nav.i16').buffer.slice(0)), new Uint8Array(readFileSync('public/generated/nav_edges.u8')));
const W = new WeatherSystem(seed);
const env = (t: number): Env => { const d = Math.floor(t / 24), c = W.conditions(d % W.days.length, t - d * 24); return { rain: c.rain, lightning: c.lightning, windMs: c.windMs, tempC: c.tempC, dust: c.dust }; };
const sim = new PeopleSim(seed, nav, env, { court: true }); for (const ag of sim.agents) ag.lod = 'abstract'; sim.jumpTo(0);
const P = sim.pop; const kinds: Record<string, number> = {}; const ex: string[] = []; let n = 0;
for (const d of days) { sim.cal.ctx(d + 1);
  for (let pid = 0; pid < P.persons.length; pid++) { if (!all && !P.court?.owns(pid)) continue;
    const prev = d > 0 ? P.plan(pid, d - 1) : null, segs = P.plan(pid, d); n++;
    for (const i of checkPlan(P, pid, d, segs, prev ? prev[prev.length - 1].place : null, prev)) { kinds[i.kind] = (kinds[i.kind] ?? 0) + 1; if (ex.length < 20) ex.push(`${pid} ${P.persons[pid].job} day ${d}: ${i.kind}: ${i.note}`); } }
  console.log(`day ${d} done`, JSON.stringify(kinds)); }
console.log(n, 'person-days', JSON.stringify(kinds)); for (const e of ex) console.log(' ', e);
