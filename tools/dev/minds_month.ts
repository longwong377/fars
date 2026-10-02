// D-459: a month of the town's own deeds with no stranger (what kinds, how many done, how many people): npx tsx tools/dev/minds_month.ts [seed] [day0] [days]
import { simAt } from '../../tests/sim_fixture';
const seed = Number(process.argv[2] ?? 1), d0 = Number(process.argv[3] ?? 60), n = Number(process.argv[4] ?? 30);
const sim = simAt(seed, d0, 10, { asks: true, ...(process.env.MINDS === '0' ? { minds: false } : {}) }); const n0 = sim.deeds.log.length, t0 = Date.now();
sim.jumpTo((d0 + n) * 24 + 10); sim.econTo(d0 + n);
const own = sim.deeds.log.slice(n0).filter(r => r.deed.actor !== 'player'), by: Record<string, [number, number]> = {}, why: Record<string, number> = {};
for (const r of own) { const k = r.deed.verb; by[k] ??= [0, 0]; by[k][0]++; if (r.out.ok) by[k][1]++; else why[`${k}: ${r.out.why}`] = (why[`${k}: ${r.out.why}`] ?? 0) + 1; }
console.log(JSON.stringify({ deeds: own.length, people: new Set(own.map(r => r.deed.actor)).size, secs: (Date.now() - t0) / 1000, byVerb: by, cases: sim.deeds.cases.length, stats: sim.deeds.stats, injured: sim.deeds.injuries.size, topRefusals: Object.entries(why).sort((a, b) => b[1] - a[1]).slice(0, 8) }, null, 1));
