// dev (D-256): node traces of the work on the land. (1) a column drum's journey from the Majdabad quarry to the Terrace's
// drum ground and the team's way back (world/traffic.ts), sampled every half hour, against the construction's E-61 arrival;
// (2) a village cow-herding day (lives.json farm_men_other_work.cattle), a milking woman's day, a fishing, a snaring, a nut-
// gathering and a bee-keeping day (population.ts), each checked by planCheck; (3) the year's person-days of each new
// activity over a sample of plain households; (4) the quarrymen at hours of a working day.
// Usage: npx tsx tools/dev/land_trace.ts [seed=1] [--out REVIEWS/evidence/s9-land/trace.txt]
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import { NavGrid } from '../../src/people/navgrid';
import { PeopleSim, Env } from '../../src/people/sim';
import { WeatherSystem } from '../../src/weather/weatherState';
import { checkPlan } from '../../src/people/planCheck';
import { Traffic, DRUM, DRUM_GROUND, along } from '../../src/world/traffic';
import { quarrySites } from '../../src/world/plain/quarries';
import { dateOf } from '../../src/people/calendar';
import { performanceFor } from '../../src/people/activities';
import { loadTerrain } from '../../tests/plainLib';
import type { Seg } from '../../src/people/population';

const seed = +(process.argv.slice(2).find(a => /^\d+$/.test(a)) ?? 1), oi = process.argv.indexOf('--out'), outPath = oi >= 0 ? process.argv[oi + 1] : null;
const lines: string[] = []; const log = (s: string) => { lines.push(s); console.log(s); };
const hm = (h: number) => { const d = Math.floor(h / 24), x = h - d * 24; return `d${d} ${String(Math.floor(x)).padStart(2, '0')}:${String(Math.floor((x % 1) * 60)).padStart(2, '0')}`; };
const nav = new NavGrid(new Int16Array(readFileSync('public/generated/nav.i16').buffer.slice(0)), new Uint8Array(readFileSync('public/generated/nav_edges.u8')));
const W = new WeatherSystem(seed);
const env = (t: number): Env => { const d = Math.floor(t / 24), c = W.conditions(d % W.days.length, t - d * 24); return { rain: c.rain, lightning: c.lightning, windMs: c.windMs, tempC: c.tempC, dust: c.dust }; };
const sim = new PeopleSim(seed, nav, env, {}); for (const ag of sim.agents) ag.lod = 'abstract'; sim.jumpTo(0);
const P = sim.pop;

// ---------------------------------------------------------------- (1) a drum's journey
const T = new Traffic(seed, P as any, null); T.setQuarries(quarrySites(loadTerrain()));
log(`# (1) a column drum from the quarry to the Terrace (world/traffic.ts; D-256)`);
log(`quarry ${T.quarry?.id} at (${T.quarry?.x.toFixed(0)}, ${T.quarry?.y.toFixed(0)}), moved ${T.quarry?.moved} m to rock; route ${(T.drumRoute!.len / 1000).toFixed(2)} km to the drum ground (${DRUM_GROUND.join(', ')}); pace ${DRUM.pace} m/s loaded, ${DRUM.back} m/s back`);
let shown = 0, hauls = 0, bad = 0;
for (let d = 3; d < 354; d++) { for (const H of T.haulsArriving(d)) { hauls++;
  const moved = H.out.reduce((a, [x, y]) => a + (y - x), 0) * 3600 * DRUM.pace; if (Math.abs(moved - T.drumRoute!.len) > 1) bad++;
  const ev = P.cal!.ctx(d).events.find(e => e.id === 'E-61' && /drum arrived/.test(e.text));
  if (shown++ > 0) continue;
  log(`haul ${H.key}: E-61 "${ev?.text}" at ${hm(ev!.t)}; at the drum ground ${hm(H.arrive)}; out spans ${H.out.map(([a, b]) => `${hm(a)}-${hm(b)}`).join(', ')}; back ${H.back.map(([a, b]) => `${hm(a)}-${hm(b)}`).join(', ')}`);
  const t0 = H.out[0][0] - 1.5, t1 = H.back[H.back.length - 1][1] + 0.1;
  for (let t = t0; t <= t1; t += 0.5) { const m = T.at(t).find(x => x.key === H.key); if (!m) { log(`  ${hm(t)}  (not on the road)`); continue; }
    const pf = performanceFor(m.act, m.why, 0), g = Math.hypot(m.e - DRUM_GROUND[0], m.n - DRUM_GROUND[1]);
    log(`  ${hm(t)}  (${m.e.toFixed(0)}, ${m.n.toFixed(0)}) ${(g / 1000).toFixed(2)} km from the drum ground  ${m.act} | ${m.why}  [animals ${pf.animals ? `${pf.animals.kind} ${pf.animals.species.join('/')}` : '-'}; work ${(pf.work ?? []).map(w => w.kind).join(',') || '-'}]`); } } }
log(`hauls in the year: ${hauls} (E-61 arrivals); spans that do not add up to the route: ${bad}`);

// ---------------------------------------------------------------- (2) the days
log(`\n# (2) days on the land (population.ts; planCheck on each)`);
const plainHH = P.households.filter(h => h.zone === 'plain').slice(0, 400);
const want: [string, RegExp][] = [['a turn with the village cows', /village cows/], ['a boy with the cow and calf', /cow and calf with the village cattle/], ['milking', /^milking/], ['fishing', /fishing|fish traps/], ['snaring', /snares/], ['waterfowl', /waterfowl/], ['nuts', /pistachios/], ['acorns', /acorns/], ['bees', /hives/], ['garlic', /wild garlic/]];
const found = new Map<string, { pid: number; d: number }>(), counts: Record<string, number> = {}, issues: Record<string, number> = {};
let personDays = 0;
for (let d = 0; d < 354; d += 3) { for (const H of plainHH) for (const pid of P.membersOn(H.id, d)) { if (!P.present(pid, d)) continue; const segs = P.plan(pid, d); personDays++;
  for (const [k, re] of want) if (segs.some(s => re.test(s.why))) { counts[k] = (counts[k] ?? 0) + 1; if (!found.has(k)) found.set(k, { pid, d });
    const iss = checkPlan(P, pid, d, segs, null, null); for (const i of iss) issues[`${k}: ${(i as any).kind ?? JSON.stringify(i).slice(0, 40)}`] = (issues[`${k}: ${(i as any).kind ?? ''}`] ?? 0) + 1; } } }
log(`sample: ${plainHH.length} plain households, every third day: ${personDays} person-days`);
for (const [k] of want) log(`  ${k}: ${counts[k] ?? 0} person-days`);
log(`planCheck issues on those days: ${Object.keys(issues).length ? JSON.stringify(issues) : 'none'}`);
for (const [k, { pid, d }] of found) { const p = P.persons[pid], C = P.cal!.ctx(d); log(`\n## ${k}: person ${pid} (${p.job} ${p.sex}${P.ageOn(pid, d)}), day ${d} (month ${dateOf(d).month}, sunrise ${C.sun.rise.toFixed(2)}, sunset ${C.sun.set.toFixed(2)})`);
  for (const s of P.plan(pid, d) as Seg[]) log(`  ${s.t0.toFixed(2)}-${s.t1.toFixed(2)} ${s.place} ${s.act} | ${s.why}`); }

// ---------------------------------------------------------------- (4) the quarrymen
log(`\n# (4) the quarrymen at Majdabad (world/traffic.ts)`);
for (const d of [20, 120, 250]) { const C = P.cal!.ctx(d); log(`day ${d} (month ${C.month}, wet ${C.wx.wet}, heat rest ${C.heatRest})`);
  for (const h of [3, 7, 10, 12.3, 13.5, 17, C.sun.set + 0.2, 22]) { const q = T.at(d * 24 + h).filter(m => m.kind === 'quarry'); const by: Record<string, number> = {}; for (const m of q) by[`${m.act} | ${m.why}`] = (by[`${m.act} | ${m.why}`] ?? 0) + 1;
    log(`  ${hm(d * 24 + h)}: ${q.length} men ${JSON.stringify(by)}`); } }
void along;
if (outPath) { mkdirSync(dirname(outPath), { recursive: true }); writeFileSync(outPath, lines.join('\n') + '\n'); }
