// D-199: what the court setting costs in node: the population's build, a day's plans for the court's people by group, the
// population view's one-time route warm-up, and the camps' tents (geometry). Usage: npx tsx tools/dev/court_cost.ts [seed=1]
import { readFileSync } from 'node:fs';
import { NavGrid } from '../../src/people/navgrid';
import { PeopleSim, type Env } from '../../src/people/sim';
import { PopGeo } from '../../src/people/popgeo';
import { PopView } from '../../src/people/popview';
import { buildTownPlan } from '../../src/world/settlement/plan';
import { WeatherSystem } from '../../src/weather/weatherState';
import { CourtCampTents } from '../../src/world/courtCamps';

const seed = +(process.argv[2] ?? 1);
const nav = new NavGrid(new Int16Array(readFileSync('public/generated/nav.i16').buffer.slice(0)), new Uint8Array(readFileSync('public/generated/nav_edges.u8')));
const W = new WeatherSystem(seed);
const env = (t: number): Env => { const d = Math.floor(t / 24), c = W.conditions(d, t - d * 24); return { rain: c.rain, lightning: c.lightning, windMs: c.windMs, tempC: c.tempC, dust: c.dust }; };
const out: Record<string, unknown> = {};
for (const court of [false, true]) {
  let t = performance.now(); const sim = new PeopleSim(seed, nav, env, { court }); const buildMs = performance.now() - t; const P = sim.pop, K = P.court;
  const planMs: Record<string, number> = {};
  if (K) { const d = 30, groups = new Map<string, number[]>(); for (let pid = K.first; pid < K.end; pid++) { const m = K.member(pid)!; const g = m.g === 'retinue' ? `retinue:${m.role}` : m.g; (groups.get(g) ?? groups.set(g, []).get(g)!).push(pid); }
    for (const [g, list] of groups) { t = performance.now(); for (const pid of list) if (P.present(pid, d)) P.plan(pid, d); planMs[g] = +((performance.now() - t) / list.length * 1000).toFixed(1); } }
  t = performance.now(); const geo = new PopGeo({ pop: P, nav, town: buildTownPlan(), seed }); const geoMs = performance.now() - t;
  t = performance.now(); const view = new PopView(sim, geo, seed); const viewMs = performance.now() - t;
  const tents = K ? (() => { const t0 = performance.now(); const C = new CourtCampTents(K.tents, () => 1600); return { ...C.info, buildMs: +(performance.now() - t0).toFixed(0) }; })() : null;
  out[court ? 'court' : 'absent'] = { persons: P.persons.length, court: K ? K.end - K.first : 0, buildMs: +buildMs.toFixed(0), planMsPer1000ByGroup: planMs, geoMs: +geoMs.toFixed(0), viewMs: +viewMs.toFixed(0), warmMs: +view.stats.warmMs.toFixed(0), warmedPairs: view.stats.warmed, tents };
  console.log(court ? 'COURT' : 'ABSENT', JSON.stringify(out[court ? 'court' : 'absent']));
}
