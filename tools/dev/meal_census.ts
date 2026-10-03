// D-651: the meals and the babies' feeds over a day's plans as the world lays them (the economy's steps and the other overlays
// in): planCheck's 'meals' and 'feed' issues, by zone. npx tsx tools/dev/meal_census.ts [seed] [days] [step]
import { nav, envOf } from '../../tests/sim_fixture';
import { PeopleSim } from '../../src/people/sim';
import { checkPlan } from '../../src/people/planCheck';
const seed = +(process.argv[2] ?? 1), days = (process.argv[3] ?? '173,245,281,341').split(',').map(Number), step = +(process.argv[4] ?? 3);
const S = new PeopleSim(seed, nav(), envOf(seed), { bonds: true, asks: true }); const P = S.pop;
for (const d of days) { S.jumpTo(d * 24 + 10); const by: Record<string, number> = {}; let n = 0; const ex: string[] = [];
  for (let pid = 0; pid < P.persons.length; pid += step) { if (!P.present(pid, d)) continue; n++; const prev = P.present(pid, d - 1) ? P.plan(pid, d - 1) : null;
    for (const x of checkPlan(P, pid, d, P.plan(pid, d), prev ? prev[prev.length - 1].place : null, prev)) if (x.kind === 'meals' || x.kind === 'feed') { const z = P.households[P.home(pid, d)]?.zone ?? '?'; by[`${x.kind}:${z}`] = (by[`${x.kind}:${z}`] ?? 0) + 1; if (ex.length < 3) ex.push(`${pid} ${P.persons[pid].job}: ${x.note}`); } }
  console.log(`day ${d}: ${n} people, ${JSON.stringify(by)}  e.g. ${ex.join(' | ')}`); }
