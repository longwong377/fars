// §13.11 soak test (the anti-diorama gate): run the people simulation headless for one in-game year (every agent in
// the abstract LOD: same decisions, timed straight-line travel) and measure
//  - variety: per person, each day's signature = the (place, activity) held in each 30-minute bucket; similarity of two
//    days = fraction of buckets that agree. Buckets are coarse, so jitter of a few minutes does not count as variety.
//    A pair of days is a near-copy when similarity ≥ NEAR_COPY. Reported: per-person share of near-copy day pairs.
//  - events: distinct event kinds per week (floor below);
//  - stability: nobody stuck (same task > 30 h, or a task that never ends), stocks within [0, bound];
//  - visible change: the seasonal ground state and anything the simulation builds (construction progress if present).
// Usage: npx tsx tools/soak.ts [days=354] [dtSeconds=60] [seed=1]  → prints a summary, writes bench-reports/soak-*.json
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { NavGrid } from '../src/people/navgrid';
import { PeopleSim, Env } from '../src/people/sim';
import { WeatherSystem } from '../src/weather/weatherState';
import { seasonAt } from '../src/world/season';

export const SOAK_GATES = {
  NEAR_COPY: 0.9,          // two days agreeing in ≥ 90 % of their half-hour buckets are near-copies
  MAX_NEAR_COPY_SHARE: 0.1, // pass: for every person, < 10 % of all pairs of days are near-copies
  MIN_EVENT_KINDS_WEEK: 6, // pass: every week has ≥ 6 distinct kinds of recorded event (justified in DECISIONS D-017)
  STUCK_HOURS: 30,
};

export function runSoak(days = 354, dt = 60, seed = 1, log = (s: string) => console.log(s)) {
  const nav = new NavGrid(new Int16Array(readFileSync('public/generated/nav.i16').buffer.slice(0)), new Uint8Array(readFileSync('public/generated/nav_edges.u8')));
  const W = new WeatherSystem(seed);
  const env = (t: number): Env => { const d = Math.floor(t / 24), c = W.conditions(d % W.days.length, t - d * 24); return { rain: c.rain, lightning: c.lightning, windMs: c.windMs, tempC: c.tempC }; };
  const sim = new PeopleSim(seed, nav, env);
  for (const a of sim.agents) a.lod = 'abstract';
  sim.jumpTo(0);
  const N = sim.agents.length, B = 48;
  const sig: Int32Array[] = sim.agents.map(() => new Int32Array(days * B)); // hashed (place, act) per half-hour
  const codes = new Map<string, number>(); const code = (k: string) => { let c = codes.get(k); if (c === undefined) { c = codes.size + 1; codes.set(k, c); } return c; };
  const lastChange = new Float64Array(N), lastTask: (string | null)[] = Array(N).fill(null);
  let stuck: { id: number; role: string; act: string; hours: number }[] = [];
  let stockMin = { depot: Infinity, store: Infinity }, stockMax = { depot: -Infinity, store: -Infinity };
  const weeks: Set<string>[] = [];
  const t0 = Date.now();
  for (let d = 0; d < days; d++) {
    for (let b = 0; b < B; b++) {
      const until = d * 24 + (b + 1) * 0.5;
      while (sim.t < until - 1e-9) sim.step(Math.min(dt, (until - sim.t) * 3600));
      sim.agents.forEach((a, i) => {
        const task = a.task; const key = `${task?.place ?? '-'}|${sim.performance(a).act}`;
        sig[i][d * B + b] = code(key);
        const tk = task ? `${task.act}@${task.place}@${task.until.toFixed(3)}` : '-';
        if (tk !== lastTask[i]) { lastTask[i] = tk; lastChange[i] = sim.t; }
        else if (sim.t - lastChange[i] > SOAK_GATES.STUCK_HOURS && !stuck.some(s => s.id === a.id)) stuck.push({ id: a.id, role: a.role, act: task?.act ?? '-', hours: +(sim.t - lastChange[i]).toFixed(1) });
      });
      stockMin = { depot: Math.min(stockMin.depot, sim.stock.depot), store: Math.min(stockMin.store, sim.stock.store) };
      stockMax = { depot: Math.max(stockMax.depot, sim.stock.depot), store: Math.max(stockMax.store, sim.stock.store) };
    }
    const w = Math.floor(d / 7); weeks[w] ??= new Set();
    for (const e of sim.events) if (e.t >= d * 24 && e.t < d * 24 + 24) weeks[w].add(e.kind);
    if (d % 30 === 29) log(`  day ${d + 1}: ${((Date.now() - t0) / 1000).toFixed(0)} s`);
  }
  // variety: all pairs of days per person (days × days / 2 comparisons of 48 buckets)
  const perPerson = sim.agents.map((a, i) => {
    let pairs = 0, near = 0, simSum = 0, maxSim = 0;
    for (let x = 0; x < days; x++) for (let y = x + 1; y < days; y++) {
      let same = 0; for (let b = 0; b < B; b++) if (sig[i][x * B + b] === sig[i][y * B + b]) same++;
      const s = same / B; pairs++; simSum += s; if (s >= SOAK_GATES.NEAR_COPY) near++; if (s > maxSim) maxSim = s;
    }
    return { id: a.id, role: a.role, nearCopyShare: +(near / pairs).toFixed(3), meanSimilarity: +(simSum / pairs).toFixed(3), maxSimilarity: +maxSim.toFixed(3) };
  });
  const byRole: Record<string, { n: number; nearCopyShare: number; meanSimilarity: number }> = {};
  for (const p of perPerson) { const r = (byRole[p.role] ??= { n: 0, nearCopyShare: 0, meanSimilarity: 0 }); r.n++; r.nearCopyShare += p.nearCopyShare; r.meanSimilarity += p.meanSimilarity; }
  for (const r of Object.values(byRole)) { r.nearCopyShare = +(r.nearCopyShare / r.n).toFixed(3); r.meanSimilarity = +(r.meanSimilarity / r.n).toFixed(3); }
  const kindsPerWeek = weeks.map(s => s?.size ?? 0);
  const season = [0, 60, 120, 180, 240, 300].map(d => ({ day: d, ...seasonAt(d) }));
  const worst = [...perPerson].sort((a, b) => b.nearCopyShare - a.nearCopyShare).slice(0, 5);
  const gates = {
    variety: perPerson.every(p => p.nearCopyShare < SOAK_GATES.MAX_NEAR_COPY_SHARE),
    events: kindsPerWeek.every(k => k >= SOAK_GATES.MIN_EVENT_KINDS_WEEK),
    stuck: stuck.length === 0,
    stocks: stockMin.depot >= 0 && stockMin.store >= 0 && stockMax.depot < 5000 && stockMax.store < 5000,
  };
  return { days, dt, seed, people: N, seconds: (Date.now() - t0) / 1000, gates, byRole, worst, kindsPerWeek: { min: Math.min(...kindsPerWeek), max: Math.max(...kindsPerWeek), mean: +(kindsPerWeek.reduce((a, b) => a + b, 0) / kindsPerWeek.length).toFixed(2) }, stuck: stuck.slice(0, 10), stock: { min: stockMin, max: stockMax }, season, eventKinds: [...new Set(weeks.flatMap(s => [...(s ?? [])]))] };
}

if (process.argv[1]?.endsWith('soak.ts')) {
  const [days, dt, seed] = [+(process.argv[2] ?? 354), +(process.argv[3] ?? 60), +(process.argv[4] ?? 1)];
  const r = runSoak(days, dt, seed);
  mkdirSync('bench-reports', { recursive: true }); const f = `bench-reports/soak-${new Date().toISOString().replace(/[:.]/g, '-')}.json`;
  writeFileSync(f, JSON.stringify(r, null, 1));
  console.log(JSON.stringify({ ...r, worst: r.worst, byRole: r.byRole }, null, 1)); console.log('written', f);
  process.exit(Object.values(r.gates).every(Boolean) ? 0 : 1);
}
