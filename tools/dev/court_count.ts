// The court in residence (D-182), measured from the plans: people on the Terrace by hour with the court setting (and
// without, for the difference), by group, and the plan checks of every court person over a span of days.
// Usage: npx tsx tools/dev/court_count.ts [days=3] [seed=1]   → prints; writes bench-reports/court-count.json
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { NavGrid } from '../../src/people/navgrid';
import { PeopleSim, type Env } from '../../src/people/sim';
import { segAt, type Seg } from '../../src/people/population';
import { checkPlan } from '../../src/people/planCheck';
import { ACTIVITIES } from '../../src/people/activities';
import { WeatherSystem } from '../../src/weather/weatherState';

const [days, seed] = [+(process.argv[2] ?? 3), +(process.argv[3] ?? 1)];
const nav = new NavGrid(new Int16Array(readFileSync('public/generated/nav.i16').buffer.slice(0)), new Uint8Array(readFileSync('public/generated/nav_edges.u8')));
const W = new WeatherSystem(seed);
const env = (t: number): Env => { const d = Math.floor(t / 24), c = W.conditions(d, t - d * 24); return { rain: c.rain, lightning: c.lightning, windMs: c.windMs, tempC: c.tempC, dust: c.dust }; };
const out: Record<string, unknown> = {};
for (const court of [false, true]) {
  const t0 = Date.now(); const sim = new PeopleSim(seed, nav, env, { court }); const P = sim.pop; const build = Date.now() - t0;
  const rows: Record<string, number[]> = {}; const byGroup: Record<string, Record<number, number>> = {};
  const probe = [0, 30, 60, 100].filter(d => d < 117);
  const t1 = Date.now();
  for (const d of probe) { const hours = [0, 2, 4, 6, 8, 10, 12, 14, 16, 18, 20, 22]; const n = hours.map(() => 0);
    for (let pid = 0; pid < P.persons.length; pid++) { if (!P.present(pid, d)) continue; const segs = P.plan(pid, d);
      hours.forEach((h, i) => { const s = segAt(segs, h + 0.001); if (s.where === 'terrace' || (s.where === 'road' && s.place === 'road:terrace' && false)) { n[i]++;
        if (court && h === 10) { const m = P.court?.member(pid); const g = m ? m.g : 'others'; (byGroup[d] ??= {})[g as any] = ((byGroup[d] as any)[g] ?? 0) + 1; } } }); }
    rows[`day ${d}`] = n; }
  const planMs = Date.now() - t1;
  // plan checks of the court's people over the first `days` days
  const issues: Record<string, number> = {}; const ex: string[] = []; let personDays = 0; const acts: Record<string, number> = {};
  if (court && P.court) for (let pid = P.court.first; pid < P.court.end; pid++) { let prev: string | null = null, prevD = -9;
    for (let d = 0; d < days; d++) { if (!P.present(pid, d)) continue; const segs: Seg[] = P.plan(pid, d); personDays++;
      for (const s of segs) { acts[s.act] = (acts[s.act] ?? 0) + 1; if (!ACTIVITIES[s.act] || ACTIVITIES[s.act].placeholder) { issues.act = (issues.act ?? 0) + 1; } }
      let t = 0; for (const s of segs) { if (Math.abs(s.t0 - t) > 1e-6 || s.t1 < s.t0) { issues.contig = (issues.contig ?? 0) + 1; if (ex.length < 30) ex.push(`${pid} day ${d}: not contiguous at ${s.t0}`); break; } t = s.t1; } if (Math.abs(t - 24) > 1e-6) { issues.end = (issues.end ?? 0) + 1; if (ex.length < 30) ex.push(`${pid} day ${d}: ends ${t}`); }
      for (const x of checkPlan(P, pid, d, segs, prevD === d - 1 ? prev : null)) { issues[x.kind] = (issues[x.kind] ?? 0) + 1; if (ex.length < 30) ex.push(`${pid} ${P.court.member(pid)?.g}/${P.court.member(pid)?.role} day ${d}: ${x.kind}: ${x.note}`); }
      prev = segs[segs.length - 1].place; prevD = d; } }
  out[court ? 'court' : 'absent'] = { persons: P.persons.length, court: P.court ? P.court.end - P.court.first : 0, parties: P.court?.parties.length ?? 0, buildMs: build, planMs, terraceByHour: rows, byGroupAt10: byGroup, personDays, issues, examples: ex, acts };
  console.log(court ? 'COURT' : 'ABSENT', JSON.stringify(out[court ? 'court' : 'absent'], null, 1));
}
mkdirSync('bench-reports', { recursive: true }); writeFileSync('bench-reports/court-count.json', JSON.stringify(out, null, 1));
