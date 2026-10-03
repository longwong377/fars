// D-651: planCheck over a sample of the population (every 53rd person) and checkDay on one day, by kind (node; the
// population test's own check, outside its 120 s timeout). npx tsx tools/dev/plan_check_sample.ts [seed] [days]
import { PeopleSim } from '../../src/people/sim';
import { checkPlan, checkDay } from '../../src/people/planCheck';
import { envOf, nav } from '../../tests/sim_fixture';
const seed = +(process.argv[2] ?? 1), days = (process.argv[3] ?? '4,101,200').split(',').map(Number);
const sim = new PeopleSim(seed, nav(), envOf(seed)); const P = sim.pop; const bad: Record<string, string[]> = {};
for (let pid = 0; pid < P.persons.length; pid += 53) for (const d of days) { if (!P.present(pid, d)) continue;
  const prev = P.present(pid, d - 1) ? P.plan(pid, d - 1) : null;
  for (const x of checkPlan(P, pid, d, P.plan(pid, d), prev ? prev[prev.length - 1].place : null)) (bad[x.kind] ??= []).push(`${pid} ${P.persons[pid].job} d${d}: ${x.note}`); }
for (const [k, v] of Object.entries(bad)) console.log(k, v.length, v.slice(0, 3).map(x => x.slice(0, 200)).join(' | '));
const day = checkDay(P, days[1] ?? days[0], pid => P.plan(pid, days[1] ?? days[0])); const by: Record<string, number> = {}; for (const x of day) by[x.kind] = (by[x.kind] ?? 0) + 1; console.log('checkDay', JSON.stringify(by));
