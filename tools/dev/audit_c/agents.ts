import { readFileSync } from 'node:fs';
import { NavGrid } from '../../../src/people/navgrid';
import { PeopleSim } from '../../../src/people/sim';
process.chdir('/home/user/fars');
const nav = new NavGrid(new Int16Array(readFileSync('public/generated/nav.i16').buffer.slice(0)), new Uint8Array(readFileSync('public/generated/nav_edges.u8')));
const sim = new PeopleSim(1, nav, () => ({ rain: 0, lightning: false, windMs: 2, tempC: 18 }));
const roles: Record<string, number> = {}; for (const a of sim.agents) roles[a.role] = (roles[a.role] ?? 0) + 1;
console.log('detailed agents', sim.agents.length, JSON.stringify(roles), 'population', sim.pop.persons.length);
const jobs: Record<string, number> = {}; for (const p of sim.pop.persons) jobs[p.job] = (jobs[p.job] ?? 0) + 1; console.log(JSON.stringify(jobs));
