import { readFileSync } from 'node:fs';
import { NavGrid } from '../../../src/people/navgrid';
import { PeopleSim, type Env } from '../../../src/people/sim';
import { WeatherSystem } from '../../../src/weather/weatherState';
import { buildTownPlan } from '../../../src/world/settlement/plan';
import { PopGeo } from '../../../src/people/popgeo';
import { PopView } from '../../../src/people/popview';
import { buildCanals } from '../../../src/world/plain/canals';
import { placeVillages, villageCompounds } from '../../../src/world/plain/villages';
import { loadTerrain, loadRiversFile } from '../../../tests/plainLib';
process.chdir('/home/user/fars');
const W = new WeatherSystem(1);
const env = (t: number): Env => { const d = Math.floor(t / 24), c = W.conditions(d, t - d * 24); return { rain: c.rain, lightning: c.lightning, windMs: c.windMs, tempC: c.tempC, dust: c.dust }; };
const nav = new NavGrid(new Int16Array(readFileSync('public/generated/nav.i16').buffer.slice(0)), new Uint8Array(readFileSync('public/generated/nav_edges.u8')));
const sim = new PeopleSim(1, nav, env); const plan = buildTownPlan(); const terrain = loadTerrain(); const rivers = loadRiversFile(); const canals = buildCanals(terrain, rivers.rivers, 1);
const villages = placeVillages(terrain, rivers.rivers, canals, 1);
const geo = new PopGeo({ pop: sim.pop, nav, town: plan, ground: (e, n) => terrain.heightAt(e, -n), villages, compounds: vi => villageCompounds(villages[vi], terrain, 1), canals: canals.map(c => c.pts), seed: 1 });
const view = new PopView(sim, geo, 1); view.radius = +(process.argv[7] ?? 600); view.margin = 300;
const [E, N, h, R] = process.argv.slice(2, 6).map(Number); const days = process.argv[6].split(",").map(Number); const snaps: Map<number,string>[] = [];
for (const day of days) { const t = day * 24 + h; view.settle(t, [E, N]); const vis = view.query([E, N], R).filter(o => o.agent < 0); const m = new Map<number,string>(); for (const o of vis) m.set(o.pid, `${o.act}@${Math.round(o.e)},${Math.round(o.n)}`); snaps.push(m); const acts: Record<string,number> = {}; for (const o of vis) acts[o.act]=(acts[o.act]??0)+1; console.log(`day ${day}: ${vis.length} visible`, JSON.stringify(acts)); }
for (let i = 1; i < snaps.length; i++) { const a = snaps[0], b = snaps[i]; let samePid = 0, same = 0, sameAct = 0; for (const [pid, s] of b) if (a.has(pid)) { samePid++; if (a.get(pid) === s) same++; if (a.get(pid)!.split("@")[0] === s.split("@")[0]) sameAct++; } console.log(`day ${days[0]} vs ${days[i]}: people in both ${samePid} of ${b.size}; same act ${sameAct}; same act AND same metre ${same} (${(same / Math.max(1, b.size) * 100).toFixed(0)} % of the scene)`); }
process.exit(0);
process.exit(0);
