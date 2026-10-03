// D-651: how many people are out on the Terrace and in the town's lanes, by day and hour (node, the life census's own reading
// of the sim: tools/dev/life_census.ts drawnAt). npx tsx tools/dev/terrace_count.ts [seed] [days] [hours]
import { readFileSync } from 'node:fs';
import { buildTraceWorld } from './people_trace';
import { drawnAt, countAt, type CovPoint } from './life_census';
const seed = +(process.argv[2] ?? 1), days = (process.argv[3] ?? '200').split(',').map(Number), hours = (process.argv[4] ?? '8,10,12.5,15,17').split(',').map(Number);
const P: CovPoint[] = JSON.parse(readFileSync('tests/data/coverage_points.json', 'utf8')).points;
const W = await buildTraceWorld(seed);
const groups: Record<string, CovPoint[]> = {}; for (const p of P) (groups[p.area] ??= []).push(p);
for (const d of days) for (const h of hours) {
  const D = drawnAt(W, d, h), onT = D.filter(x => Math.abs(x.e) < 300 && Math.abs(x.n) < 300), out = onT.filter(x => x.act !== 'sleep');
  const acts: Record<string, number> = {}; for (const x of out) acts[x.act] = (acts[x.act] ?? 0) + 1;
  const line = Object.entries(groups).map(([a, ps]) => { const c = countAt(ps, D); const m = c.reduce((s, x) => s + x.work + x.idle + x.moving, 0) / ps.length, e = c.filter(x => x.work + x.idle + x.moving === 0).length; return `${a} ${m.toFixed(1)}/pt ${e}/${ps.length} empty`; }).join(' | ');
  console.log(`day ${d} ${h} h: Terrace box ${onT.length} drawn (${out.length} awake), top acts ${Object.entries(acts).sort((a, b) => b[1] - a[1]).slice(0, 8).map(([k, v]) => k + ' ' + v).join(', ')}\n   ${line}`);
}
