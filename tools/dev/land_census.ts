// D-651: who is out on the working land (node, the life census's reading): at each moment the plain's people by what they do
// and where (fields, threshing floors, roads, river, quarries, pasture, villages), against the plain's adults.
// npx tsx tools/dev/land_census.ts [seed] [days] [hours]
import { buildTraceWorld } from './people_trace';
import { drawnAt } from './life_census';
const seed = +(process.argv[2] ?? 1), days = (process.argv[3] ?? '20,180').split(',').map(Number), hours = (process.argv[4] ?? '8,10,15').split(',').map(Number);
const W = await buildTraceWorld(seed); const P = W.sim.pop as any;
const plainAdults = P.persons.filter((p: any) => P.households[p.hh]?.zone === 'plain' && p.age >= 14).length;
for (const d of days) for (const h of hours) { const D = drawnAt(W, d, h); const by: Record<string, number> = {};
  for (const x of D) { const p = P.persons[x.pid]; if (!p || P.households[P.home(x.pid, d)]?.zone !== 'plain') continue; const seg = x.why; const k = x.moving ? 'walking' : x.act; by[k] = (by[k] ?? 0) + 1; }
  const tot = Object.values(by).reduce((a, b) => a + b, 0);
  console.log(`day ${d} ${h} h: plain people drawn ${tot} of ${plainAdults} adults; ${Object.entries(by).sort((a, b) => b[1] - a[1]).slice(0, 14).map(([k, v]) => `${k} ${v}`).join(', ')}`); }
