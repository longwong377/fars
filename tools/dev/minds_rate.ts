// D-720: the cost and reach of the minds' own deeds at a sample size and a daily cap: a world at day 55 run five days live
//   npx tsx tools/dev/minds_rate.ts [sample=4000] [max=300]
import { simAt } from '../../tests/sim_fixture';
const [sample, max] = [Number(process.argv[2] ?? 4000), Number(process.argv[3] ?? 300)];
const sim = simAt(1, 55, 12, { asks: true }); sim.deeds.minds.daily = { sample, max };
const s0 = { ...sim.deeds.stats }, a0 = sim.deeds.agency.stats.ms, n0 = sim.deeds.next, t0 = Date.now();
sim.jumpTo(60 * 24 + 12);
const touched = new Set<number>(); for (const r of sim.deeds.log) if (r.id >= n0) for (const x of [r.deed.actor, r.deed.target]) if (typeof x === 'number') touched.add(x);
const days = sim.deeds.stats.days - s0.days, ms = sim.deeds.stats.ms - s0.ms;
console.log(JSON.stringify({ sample, max, days, deedsPerDay: Math.round((sim.deeds.next - n0) / days), peoplePerDay: Math.round(touched.size / days), mindsMsPerDay: Math.round(ms / days), agencyMs: Math.round((sim.deeds.agency.stats.ms - a0) / days), wallS: (Date.now() - t0) / 1000, maxSliceMs: Math.round(sim.deeds.agency.stats.maxSlice) }));
