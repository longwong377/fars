// D-651: the people at the plain-side works (C3's D-670 yards) by day: per yard, how many are drawn inside it (node; the life
// census's reading of the sim). npx tsx tools/dev/works_census.ts [seed] [days] [hours]
import { buildTraceWorld } from './people_trace';
import { drawnAt } from './life_census';
import { worksLayout } from '../../src/world/plain/works';
import { buildTownPlan } from '../../src/world/settlement/plan';
const seed = +(process.argv[2] ?? 1), days = (process.argv[3] ?? '30,200').split(',').map(Number), hours = (process.argv[4] ?? '9,15').split(',').map(Number);
const W = await buildTraceWorld(seed), L = worksLayout(buildTownPlan() as any);
for (const d of days) for (const h of hours) { const D = drawnAt(W, d, h);
  const row = L.yards.map(y => { const c = Math.cos(y.theta), s = Math.sin(y.theta); const n = D.filter(p => { const de = p.e - y.c[0], dn = p.n - y.c[1]; return Math.abs(de * c + dn * s) < y.W / 2 + 4 && Math.abs(-de * s + dn * c) < y.H / 2 + 4; }).length; return `${y.id} ${n}`; });
  console.log(`day ${d} ${h} h: ${row.join(', ')}`); }
