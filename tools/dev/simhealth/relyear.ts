// dev (D-360): the relations' year alone: build a sim (bonds on), time Relations.advance(day) and one plan read after it.
import { readFileSync } from 'node:fs';
import { NavGrid } from '../../../src/people/navgrid';
import { PeopleSim, type Env } from '../../../src/people/sim';
const DAY = +(process.argv[2] ?? 300);
const nav = new NavGrid(new Int16Array(readFileSync('public/generated/nav.i16').buffer.slice(0)), new Uint8Array(readFileSync('public/generated/nav_edges.u8')));
const env = (): Env => ({ rain: 0, lightning: false, windMs: 2, tempC: 20, dust: 0 } as Env);
const S = new PeopleSim(1, nav, env, { bonds: true });
let t = performance.now(); (S.bonds as any).ensure(); const initMs = Math.round(performance.now() - t);
t = performance.now(); S.bonds.advance(DAY); const advMs = Math.round(performance.now() - t);
if (process.argv[3] === "noplan") { console.log(JSON.stringify({ initMs, advanceMs: advMs })); process.exit(0); }
const p = S.pop.persons.find(q => S.pop.present(q.id, DAY))!.id; t = performance.now(); S.pop.plan(p, DAY); const planMs = Math.round(performance.now() - t);
console.log(JSON.stringify({ day: DAY, initMs, advanceMs: advMs, firstPlanMs: planMs, stats: S.bonds.stats }));
