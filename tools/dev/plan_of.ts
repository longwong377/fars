// dev: one person's day plan, as lines. Usage: npx tsx tools/dev/plan_of.ts <pid> <day>
import { readFileSync } from 'node:fs';
import { NavGrid } from '../../src/people/navgrid';
import { PeopleSim, type Env } from '../../src/people/sim';
import { WeatherSystem } from '../../src/weather/weatherState';
const [pid, d] = process.argv.slice(2).map(Number);
const nav = new NavGrid(new Int16Array(readFileSync('public/generated/nav.i16').buffer.slice(0)), new Uint8Array(readFileSync('public/generated/nav_edges.u8')));
const W = new WeatherSystem(1), env = (t: number): Env => { const dd = Math.floor(t / 24), c = W.conditions(dd, t - dd * 24); return { rain: c.rain, lightning: c.lightning, windMs: c.windMs, tempC: c.tempC, dust: c.dust }; };
const P = new PeopleSim(1, nav, env).pop;
for (const s of P.plan(pid, d)) console.log(`${s.t0.toFixed(2)}-${s.t1.toFixed(2)} ${s.place} ${s.act}: ${s.why}`);
