import { readFileSync } from 'node:fs';
import { NavGrid } from '../../../src/people/navgrid';
import { PeopleSim, type Env } from '../../../src/people/sim';
import { WeatherSystem } from '../../../src/weather/weatherState';
process.chdir('/home/user/fars');
const W = new WeatherSystem(1);
const env = (t: number): Env => { const d = Math.floor(t / 24), c = W.conditions(d, t - d * 24); return { rain: c.rain, lightning: c.lightning, windMs: c.windMs, tempC: c.tempC, dust: c.dust }; };
const nav = new NavGrid(new Int16Array(readFileSync('public/generated/nav.i16').buffer.slice(0)), new Uint8Array(readFileSync('public/generated/nav_edges.u8')));
const sim = new PeopleSim(1, nav, env); for (const a of sim.agents) a.lod = 'abstract';
const t = 25 * 24 + 9.5; sim.jumpTo(t - 1); while (sim.t < t) sim.step(30);
const cam = [146, 45];
for (const a of sim.agents) { if (a.offmap) continue; const d = Math.hypot(a.pos[0] - cam[0], a.pos[1] - cam[1]); if (d < 60) console.log(a.role, a.task?.act, a.task?.place, d.toFixed(1), a.pos.map(v => v.toFixed(1)).join(','), a.walking); }
console.log('on map', sim.agents.filter(a => !a.offmap).length, 'masons', JSON.stringify(sim.agents.filter(a => a.role === 'mason').map(a => `${a.task?.act}@${a.task?.place}${a.offmap ? '(off)' : ''}`)));
