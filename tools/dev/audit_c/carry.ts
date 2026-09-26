import { readFileSync } from 'node:fs';
import { NavGrid } from '../../../src/people/navgrid';
import { PeopleSim, type Env } from '../../../src/people/sim';
import { WeatherSystem } from '../../../src/weather/weatherState';
import { propOf } from '../../../src/people/popview';
process.chdir('/home/user/fars');
const W = new WeatherSystem(1);
const env = (t: number): Env => { const d = Math.floor(t / 24), c = W.conditions(d, t - d * 24); return { rain: c.rain, lightning: c.lightning, windMs: c.windMs, tempC: c.tempC, dust: c.dust }; };
const nav = new NavGrid(new Int16Array(readFileSync('public/generated/nav.i16').buffer.slice(0)), new Uint8Array(readFileSync('public/generated/nav_edges.u8')));
const sim = new PeopleSim(1, nav, env); const P: any = sim.pop;
const none: Record<string, number> = {}; let segsC = 0, segsNone = 0, hrsNone = 0;
for (const day of [25, 45, 150]) { sim.cal.ctx(day); for (const p of P.persons) { if (!P.present(p.id, day)) continue; for (const s of P.plan(p.id, day)) { if (!s.carry) continue; segsC++; if (propOf(s.act, s.carry) === null) { segsNone++; hrsNone += s.t1 - s.t0; const k = s.carry.replace(/\d+/g, '#').slice(0, 70); none[k] = (none[k] ?? 0) + 1; } } } }
console.log(`carried segments ${segsC}; with no drawn prop ${segsNone} (${hrsNone.toFixed(0)} person-hours)`);
console.log(Object.entries(none).sort((a, b) => b[1] - a[1]).slice(0, 40).map(([k, v]) => `${v}\t${k}`).join('\n'));
