// D-458: who is on each market ground, hour by hour, on a day (the stallholders, the buyers, everyone else there).
// Run: npx tsx tools/dev/market_count.ts [seed=1] [day=60] [more days...]
import { simAt } from '../../tests/sim_fixture';
import { segAt } from '../../src/people/population';

const seed = Number(process.argv[2] ?? 1), days = process.argv.slice(3).map(Number); if (!days.length) days.push(60);
const HOURS = [7, 8, 9, 10.5, 12, 13, 14.5, 16];
const sim = simAt(seed, days[0], 7); const P = sim.pop;
for (const d of days) {
  if (sim.t < d * 24 + 7) sim.jumpTo(d * 24 + 7);
  const t0 = Date.now(), by = new Map<string, number[]>(), keep = new Map<string, number[]>(), stalls = new Map<string, Set<string>>();
  for (const p of P.persons) { if (!P.present(p.id, d) || p.dies <= d) continue; const plan = P.plan(p.id, d);
    HOURS.forEach((h, i) => { const s = segAt(plan, h); if (!s || !/^market:/.test(s.place) || s.where === 'road') return; const g = s.place.split(':').slice(0, 2).join(':');
      (by.get(g) ?? by.set(g, HOURS.map(() => 0)).get(g)!)[i]++;
      if (/stall_keep/.test(s.ev ?? '')) { (keep.get(g) ?? keep.set(g, HOURS.map(() => 0)).get(g)!)[i]++; (stalls.get(g) ?? stalls.set(g, new Set()).get(g)!).add(s.place); } }); }
  const rows = [...by.entries()].sort((a, b) => Math.max(...b[1]) - Math.max(...a[1]));
  const tot = HOURS.map((_, i) => rows.reduce((a, r) => a + r[1][i], 0)), ktot = HOURS.map((_, i) => [...keep.values()].reduce((a, r) => a + r[i], 0));
  const C = sim.cal.ctx(d);
  console.log(`seed ${seed} day ${d} (${C.season}, rain ${C.wx.rainMm ?? '?'}) ${((Date.now() - t0) / 1000).toFixed(0)} s; hours ${HOURS.join(' ')}`);
  console.log(`  WHOLE: ${tot.join(' ')}  (stallholders ${ktot.join(' ')})  grounds ${rows.length}`);
  for (const [g, n] of rows.slice(0, 12)) console.log(`  ${g.padEnd(22)} ${n.map(x => String(x).padStart(3)).join(' ')}  keepers ${(keep.get(g) ?? []).map(x => String(x).padStart(3)).join(' ')} stalls ${stalls.get(g)?.size ?? 0}`);
}
