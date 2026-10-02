// D-461 (UD-32): the minds' year. A town lived for a year from day 0 with no stranger at all, seed by seed, and measured: the
// goals formed, achieved and abandoned by kind (and why they ended), the deeds by kind and by source (feelings, goals, the
// day's life, the talk of deeds), the chains of cause (a deed that gives rise to a goal whose deeds give rise to another),
// the people with a goal of their own at each month's end, what the minds changed in the world (weddings, places won,
// leavers, crafts taught), and the cost: the minds' milliseconds per game day and their longest slice, against the rest of
// the living world's day; the saved state's size.
// Run: nice -n 15 npx tsx tools/dev/minds_year.ts [seeds=1,7] [days=354]   (out: bench-reports/minds_s15.md, .cache/minds_year-<seed>.json)
import { mkdirSync, writeFileSync } from 'node:fs';
import { PeopleSim } from '../../src/people/sim';
import { nav, envOf } from '../../tests/sim_fixture';
import { KINDS } from '../../src/people/mind/goals';
import { PerformanceObserver } from 'node:perf_hooks';

const seeds = (process.argv[2] ?? '1,7').split(',').map(Number), DAYS = Number(process.argv[3] ?? 354);
const out: string[] = [];
const pct = (a: number, b: number) => b ? `${(100 * a / b).toFixed(0)}%` : '-';
for (const seed of seeds) {
  const gc = { max: 0, over10: 0 }; const obs = new PerformanceObserver(l => { for (const e of l.getEntries()) { if (e.duration > gc.max) gc.max = e.duration; if (e.duration > 10) gc.over10++; } }); obs.observe({ entryTypes: ['gc'] });
  const t0 = performance.now(), sim = new PeopleSim(seed, nav(), envOf(seed), { asks: true }), P = sim.pop, A = sim.deeds.agency, G = A.goals;
  const months: { day: number; withGoal: number; adults: number; townWith: number; townAdults: number; active: number; feelings: number; ms: number }[] = [];
  const endWhy: Record<string, number> = {}; let endSeen = 0; const seenIds = new Set<number>();
  const harvest = () => { for (const g of G.ended) { if (seenIds.has(g.id)) continue; seenIds.add(g.id); endSeen++; const k = `${g.kind} ${g.out}: ${(g.endWhy ?? '').replace(/[A-Z*Šθ][^\s:,']*('s)?/g, 'X').replace(/X('s)? /g, 'X ')}`; endWhy[k] = (endWhy[k] ?? 0) + 1; } };
  for (let d = 30; d <= DAYS; d += 30) {
    for (let x = d - 29; x <= d; x++) { sim.jumpTo(x * 24 + 10); if (x % 5 === 0) harvest(); }
    harvest(); const with_ = new Set<number>(); for (const g of G.active.values()) with_.add(g.pid);
    let adults = 0, townAdults = 0, townWith = 0; for (let i = 0; i < P.persons.length; i++) if (P.present(i, d) && P.ageOn(i, d) >= 14) { adults++; const z = P.households[P.home(i, d)]?.zone; if (z === 'town' || z === 'plain') { townAdults++; if (with_.has(i)) townWith++; } }
    months.push({ day: d, withGoal: with_.size, adults, townWith, townAdults, active: G.active.size, feelings: sim.deeds.minds.size.feelings, ms: A.stats.ms });
    console.log(`seed ${seed} day ${d}: active ${G.active.size}, people with a goal ${with_.size}/${adults}, minds ${(A.stats.ms / A.stats.days).toFixed(1)} ms/day, max slice ${A.stats.maxSlice.toFixed(1)} ms, ${((performance.now() - t0) / 1000).toFixed(0)} s`);
  }
  if (DAYS % 30) { sim.jumpTo(DAYS * 24 + 10); harvest(); }
  const st = A.stats, L = sim.living.stats, wall = (performance.now() - t0) / 1000; obs.disconnect();
  const saved = sim.save() as any, dz = sim.deeds.save(), raw = JSON.stringify(dz).length, packed = saved.deeds?.z?.length ?? 0;
  const res = { seed, days: DAYS, goals: G.stats, endWhy, deeds: st.deeds, done: st.done, src: st.src, chains: st.chains, examples: st.examples, months, cost: { msPerDay: st.ms / st.days, maxSlice: st.maxSlice, parts: st.parts, slices: st.slices, tot: st.tot, gc, livingMsPerDay: (L.msEcon + L.msSim + L.msMeet + L.msArrange) / Math.max(1, L.days), wall },
    world: { everWithGoal: G.ever.size, weddings: G.weds.length, weddingsInYear: G.weds.filter(w => w[2] > 0).length, places: G.places.size, left: G.left.length, learned: G.learned.size, cases: sim.deeds.cases.length, injuries: sim.deeds.injuries.size }, state: { raw, packed, feelings: sim.deeds.minds.size, heapMB: process.memoryUsage().heapUsed / 1048576, log: sim.deeds.log.length } };
  mkdirSync('.cache', { recursive: true }); writeFileSync(`.cache/minds_year-${seed}.json`, JSON.stringify(res, null, 1));
  const totF = KINDS.reduce((a, k) => a + G.stats[k][0], 0), totA = KINDS.reduce((a, k) => a + G.stats[k][1], 0), totX = KINDS.reduce((a, k) => a + G.stats[k][2], 0);
  out.push(`## Seed ${seed}: ${DAYS} days, no stranger (wall ${wall.toFixed(0)} s)`, '',
    `**Cost:** the minds ${res.cost.msPerDay.toFixed(1)} ms per game day for the whole town (${P.persons.length} people), longest slice ${res.cost.maxSlice.toFixed(1)} ms (${st.slices} slices); the rest of the living world ${res.cost.livingMsPerDay.toFixed(0)} ms per day. Longest slice by part: ${Object.entries(st.parts).map(([k, v]) => `${k} ${v.toFixed(1)}`).join(', ')} ms; the time of each part per day: ${Object.entries(st.tot).map(([k, v]) => `${k} ${(v / st.days).toFixed(1)}`).join(', ')} ms. The garbage collector over the year (the whole process, heap ${res.state.heapMB.toFixed(0)} MB at the end): longest pause ${gc.max.toFixed(1)} ms, ${gc.over10} pauses over 10 ms (a pause lands in whatever slice is running).`, '',
    `**State:** deeds and minds save ${(raw / 1024).toFixed(0)} KB raw, ${(packed / 1024).toFixed(0)} KB packed; ${res.state.feelings.feelings} feelings held by ${res.state.feelings.people} people; deed log in memory ${res.state.log} records; heap ${res.state.heapMB.toFixed(0)} MB.`, '',
    `**Goals:** ${totF} formed, ${totA} achieved, ${totX} abandoned, ${G.active.size} still pursued at the end.`, '',
    '| kind | formed | achieved | abandoned |', '|---|---:|---:|---:|', ...KINDS.map(k => `| ${k} | ${G.stats[k][0]} | ${G.stats[k][1]} | ${G.stats[k][2]} |`), '',
    '**How goals ended (top 24):**', '', ...Object.entries(endWhy).sort((a, b) => b[1] - a[1]).slice(0, 24).map(([k, v]) => `- ${v} ${k}`), '',
    `**People with a goal of their own:** ${G.ever.size} people held at least one goal over the ${DAYS} days; at each month's end (of everyone present aged 14+):`, '', '| day | with a goal | of | share | town and plain houses: with a goal | of | share | goals active |', '|---:|---:|---:|---:|---:|---:|---:|---:|', ...months.map(m => `| ${m.day} | ${m.withGoal} | ${m.adults} | ${pct(m.withGoal, m.adults)} | ${m.townWith} | ${m.townAdults} | ${pct(m.townWith, m.townAdults)} | ${m.active} |`), '',
    `**Deeds** (${Object.values(st.deeds).reduce((a, b) => a + b, 0)} in all; by source: ${Object.entries(st.src).map(([k, v]) => `${k} ${v}`).join(', ')}):`, '', '| verb | tried | done |', '|---|---:|---:|', ...Object.entries(st.deeds).sort((a, b) => b[1] - a[1]).map(([k, v]) => `| ${k} | ${v} | ${st.done[k] ?? 0} |`), '',
    `**Chains of cause** (goals by depth: 1 = born of the person's own state; 2+ = born of a deed or a goal that came of another): ${Object.entries(st.chains).map(([k, v]) => `depth ${k}: ${v}`).join(', ')}.`, '', ...st.examples.slice(0, 8).map(e => `- ${e}`), '',
    `**What the minds changed in the world:** ${res.world.weddings} betrothals (${res.world.weddingsInYear} weddings set within the year), ${res.world.places} places with a master held at the end, ${res.world.left} people left the town for good, ${res.world.learned} children taught a craft; ${res.world.cases} cases before the elders (open or recent), ${res.world.injuries} people wounded.`, '');
  console.log(`seed ${seed} done in ${wall.toFixed(0)} s`);
}
const head = ['# The minds\' year (D-461, session 15, cloud)', '', `Run: \`nice -n 15 npx tsx tools/dev/minds_year.ts ${seeds.join(',')} ${DAYS}\` on the cloud box (4 cores, node). Every person of the town and the plain, a year from day 0, with no stranger. Tier C throughout: the odds and the paces are the module's reading (DECISIONS D-461).`, ''];
mkdirSync('bench-reports', { recursive: true }); writeFileSync('bench-reports/minds_s15.md', [...head, ...out].join('\n'));
console.log('written bench-reports/minds_s15.md');
