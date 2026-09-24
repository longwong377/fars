// The soak's variety gate (tools/soak.ts: < 10 % of pairs of days near-copies, a near-copy agreeing in ≥ 90 % of the 48
// half-hour buckets) for the court's people only (D-182). Usage: npx tsx tools/dev/court_variety.ts [days=30] [seed=1]
import { readFileSync } from 'node:fs';
import { NavGrid } from '../../src/people/navgrid';
import { PeopleSim, type Env } from '../../src/people/sim';
import { segAt } from '../../src/people/population';
import { WeatherSystem } from '../../src/weather/weatherState';

const [days, seed] = [+(process.argv[2] ?? 30), +(process.argv[3] ?? 1)];
const nav = new NavGrid(new Int16Array(readFileSync('public/generated/nav.i16').buffer.slice(0)), new Uint8Array(readFileSync('public/generated/nav_edges.u8')));
const W = new WeatherSystem(seed);
const env = (t: number): Env => { const d = Math.floor(t / 24), c = W.conditions(d, t - d * 24); return { rain: c.rain, lightning: c.lightning, windMs: c.windMs, tempC: c.tempC, dust: c.dust }; };
const sim = new PeopleSim(seed, nav, env, { court: true }); const P = sim.pop, K = P.court!;
const byG: Record<string, { n: number; worst: number; worstPid: number; failing: number; mean: number }> = {};
for (let pid = K.first; pid < K.end; pid++) {
  const sig: number[][] = []; const codes = new Map<string, number>();
  for (let d = 0; d < days; d++) { if (!P.present(pid, d)) continue; const segs = P.plan(pid, d); const row: number[] = [];
    for (let b = 0; b < 48; b++) { const s = segAt(segs, b * 0.5 + 0.5 - 1e-6); const k = `${s.place}|${s.act}`; let c = codes.get(k); if (c === undefined) { c = codes.size; codes.set(k, c); } row.push(c); } sig.push(row); }
  if (sig.length < 2) continue; let pairs = 0, near = 0;
  for (let x = 0; x < sig.length; x++) for (let y = x + 1; y < sig.length; y++) { let diff = 0; for (let b = 0; b < 48; b++) if (sig[x][b] !== sig[y][b]) diff++; pairs++; if (diff <= 4) near++; }
  const share = near / pairs, g = K.member(pid)!.g; const G = (byG[g] ??= { n: 0, worst: 0, worstPid: -1, failing: 0, mean: 0 }); G.n++; G.mean += share; if (share > G.worst) { G.worst = share; G.worstPid = pid; } if (share >= 0.1) G.failing++;
}
for (const g of Object.values(byG)) g.mean = +(g.mean / g.n).toFixed(4);
console.log(JSON.stringify(byG, null, 1));
