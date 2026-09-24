// The court in residence (D-182, D-199), measured from the plans: people in each zone (Terrace, town, plain) by hour with
// the court setting and without, against population.json's court_resident values; the court's retinue by camp.
// Usage: npx tsx tools/dev/court_zones.ts [seed=1] [days=30,60]   → prints; writes bench-reports/court-zones.json
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { NavGrid } from '../../src/people/navgrid';
import { PeopleSim, type Env } from '../../src/people/sim';
import { segAt } from '../../src/people/population';
import { WeatherSystem } from '../../src/weather/weatherState';

const seed = +(process.argv[2] ?? 1), days = (process.argv[3] ?? '30,60').split(',').map(Number);
const nav = new NavGrid(new Int16Array(readFileSync('public/generated/nav.i16').buffer.slice(0)), new Uint8Array(readFileSync('public/generated/nav_edges.u8')));
const W = new WeatherSystem(seed);
const env = (t: number): Env => { const d = Math.floor(t / 24), c = W.conditions(d, t - d * 24); return { rain: c.rain, lightning: c.lightning, windMs: c.windMs, tempC: c.tempC, dust: c.dust }; };
const POPJ = JSON.parse(readFileSync('src/data/population.json', 'utf8'));
const out: Record<string, unknown> = { seed, targets: Object.fromEntries((POPJ.zones as any[]).map(z => [z.id, z.court_resident])) };
for (const court of [false, true]) {
  const t0 = Date.now(); const sim = new PeopleSim(seed, nav, env, { court }); const P = sim.pop; const buildMs = Date.now() - t0;
  const res: Record<string, unknown> = { persons: P.persons.length, court: P.court ? P.court.end - P.court.first : 0, buildMs };
  const t1 = Date.now();
  for (const d of days) { const rows: Record<string, Record<string, number>> = {};
    for (const h of [2, 10.5]) { const c: Record<string, number> = { terrace: 0, town: 0, plain: 0, away: 0 };
      for (let pid = 0; pid < P.persons.length; pid++) { if (!P.present(pid, d)) continue; const s = segAt(P.plan(pid, d), h);
        const w = s.where === 'road' ? (s.place.startsWith('road:terrace') ? 'terrace' : s.place.startsWith('road:plain') ? 'plain' : 'town') : s.where; c[w] = (c[w] ?? 0) + 1; }
      rows[`${h}h`] = c; }
    res[`day ${d}`] = rows; }
  res.planMs = Date.now() - t1;
  out[court ? 'court' : 'absent'] = res; console.log(court ? 'COURT' : 'ABSENT', JSON.stringify(res));
}
mkdirSync('bench-reports', { recursive: true }); writeFileSync('bench-reports/court-zones.json', JSON.stringify(out, null, 1));
