// dev (D-360): the living world's late-year load, measured alone, with the world's options (bonds on). Usage:
//   npx tsx tools/dev/simhealth/lateload.ts [day = 300] [bonds = 1]
// Prints: the time to build the sim, to load a day-N save (economy restore + the relations' year + 20 plans read), and
// whether the plans read after the load equal those of the sim that lived the year (the intent, not only the clock).
import { readFileSync } from 'node:fs';
import { NavGrid } from '../../../src/people/navgrid';
import { PeopleSim, type Env } from '../../../src/people/sim';
import { WeatherSystem } from '../../../src/weather/weatherState';
const DAY = +(process.argv[2] ?? 300), bonds = (process.argv[3] ?? '1') === '1';
const nav = new NavGrid(new Int16Array(readFileSync('public/generated/nav.i16').buffer.slice(0)), new Uint8Array(readFileSync('public/generated/nav_edges.u8')));
const W = new WeatherSystem(1), env = (t: number): Env => { const dd = Math.floor(t / 24), c = W.conditions(dd, t - dd * 24); return { rain: c.rain, lightning: c.lightning, windMs: c.windMs, tempC: c.tempC, dust: c.dust }; };
const ms = (t: number) => Math.round(performance.now() - t);
let t = performance.now(); const mk = () => new PeopleSim(1, nav, env, { bonds }); const S5 = mk(); const buildMs = ms(t);
S5.t = DAY * 24 + 10; t = performance.now(); S5.economy(); const genMs = ms(t);
const lateStr = JSON.stringify(S5.save()), late = JSON.parse(lateStr);
const lateTalks = S5.living.talks.filter(x => x.done && x.done.day > DAY && x.done.h0 >= 0).slice(0, 20);
const pids = [...lateTalks.map(x => x.doer), ...S5.pop.persons.filter((p, i) => i % 97 === 0 && S5.pop.present(p.id, DAY)).map(p => p.id).slice(0, 40)];
t = performance.now(); for (const p of pids) S5.pop.plan(p, DAY); const plansLived = ms(t);
const S6 = mk(); t = performance.now(); S6.load(late); S6.economy(); const restoreMs = ms(t);
const t2 = performance.now(); for (const p of pids) S6.pop.plan(p, DAY); const plansMs = ms(t2); const loadMs = ms(t);
let same = 0; for (const p of pids) if (JSON.stringify(S6.pop.plan(p, DAY)) === JSON.stringify(S5.pop.plan(p, DAY))) same++;
console.log(JSON.stringify({ day: DAY, bonds, buildMs, generateMs: genMs, plansLivedMs: plansLived, restoreMs, plansAfterLoadMs: plansMs, loadMs, plansCompared: pids.length, plansIdentical: same, saveBytes: lateStr.length }));
