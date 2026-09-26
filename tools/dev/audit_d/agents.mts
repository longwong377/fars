import { readFileSync } from 'node:fs';
process.chdir('/home/user/fars');
const { NavGrid } = await import('/home/user/fars/src/people/navgrid');
const { PeopleSim } = await import('/home/user/fars/src/people/sim');
const { WeatherSystem } = await import('/home/user/fars/src/weather/weatherState');
const nav = new NavGrid(new Int16Array(readFileSync('public/generated/nav.i16').buffer.slice(0)), new Uint8Array(readFileSync('public/generated/nav_edges.u8')));
const W = new WeatherSystem(1);
const env = (t: number) => { const d = Math.floor(t / 24), c = W.conditions(d, t - d * 24); return { rain: c.rain, lightning: c.lightning, windMs: c.windMs, tempC: c.tempC, dust: c.dust }; };
const sim: any = new PeopleSim(1, nav, env); sim.jumpTo(25 * 24 + 11);
let minE = 1e9, maxE = -1e9, minN = 1e9, maxN = -1e9, on = 0; const langs: Record<string, number> = {};
for (const a of sim.agents) { if (a.offmap) continue; on++; minE = Math.min(minE, a.pos[0]); maxE = Math.max(maxE, a.pos[0]); minN = Math.min(minN, a.pos[1]); maxN = Math.max(maxN, a.pos[1]); langs[a.langs?.[0]] = (langs[a.langs?.[0]] ?? 0) + 1; }
console.log(`day 25 11:00: ${on} of ${sim.agents.length} detailed agents on the map; extent e ${minE.toFixed(0)}..${maxE.toFixed(0)}, n ${minN.toFixed(0)}..${maxN.toFixed(0)}; first languages ${JSON.stringify(langs)}`);
