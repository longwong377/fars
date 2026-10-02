// dev (D-570, s17 C3): life on the roads, counted in node. The roads of settlement.json near Pārsa (each cut into stretches of
// STRETCH m within NEAR m of the Terrace) against everyone world/traffic.ts puts on them, over a sample of days of the year:
// per stretch, the longest run of daylight (sunrise + 0.25 h to sunset − 0.25 h) with nobody on it or at its side (the done
// line of the C3 brief: no visible stretch empty for > 2 min) and the share of daylight empty; per road and hour, the
// travellers, the groups, the animals and the loads; and every traveller's purpose (a mover with no `why` is a failure).
// With --site: the building site of the Hall of a Hundred Columns (the masons' yard, the columns, the walls, the ramp) and the
// court's camps, from the population's own day plans: per hour of daylight, how many are there and doing what.
// Usage: npx tsx tools/dev/road_census.ts [--days 30] [--step 20] [--near 2500] [--seed 1] [--court] [--nofolk] [--site] [--json out.json]
import { writeFileSync } from 'node:fs';
import { Traffic, type Mover } from '../../src/world/traffic';
import { buildTownPlan } from '../../src/world/settlement/plan';
import { Population } from '../../src/people/population';
import { EventCalendar } from '../../src/people/calendar';
import { WeatherSystem } from '../../src/weather/weatherState';
import settlement from '../../src/data/settlement.json';

type P2 = [number, number];
const arg = (k: string, d: number) => { const i = process.argv.indexOf(`--${k}`); return i >= 0 ? +process.argv[i + 1] : d; };
const DAYS = arg('days', 30), STEP = arg('step', 20), NEAR = arg('near', 2500), SEED = arg('seed', 1), STRETCH = 250, SIDE = 14;
const COURT = process.argv.includes('--court'), ji = process.argv.indexOf('--json'), JSON_OUT = ji >= 0 ? process.argv[ji + 1] : null;
/** the Terrace's middle (grid m) */
export const PARSA: P2 = [80, 30];

export interface Stretch { road: string; i: number; pts: P2[]; s0: number; box: [number, number, number, number] }
/** the roads' stretches within `near` m of the Terrace: pieces of `len` m of arclength along each road polyline (the last
 *  piece of a road may be shorter), each a short polyline */
export function stretches(near = NEAR, len = STRETCH): Stretch[] {
  const out: Stretch[] = [];
  for (const f of (settlement as any).features as any[]) { if (!f.id.startsWith('road_') || f.present_467 === false || !(f.polyline?.length > 1)) continue;
    const L = f.polyline as P2[], fine: { p: P2; s: number }[] = []; let s = 0;
    for (let k = 0; k < L.length - 1; k++) { const [a, b] = [L[k], L[k + 1]], l = Math.hypot(b[0] - a[0], b[1] - a[1]); for (let x = 0; x < l; x += 10) fine.push({ p: [a[0] + (b[0] - a[0]) * x / l, a[1] + (b[1] - a[1]) * x / l], s: s + x }); s += l; }
    fine.push({ p: L[L.length - 1], s });
    const groups = new Map<number, P2[]>(); for (const q of fine) { const i = Math.floor(q.s / len); (groups.get(i) ?? groups.set(i, []).get(i)!).push(q.p); }
    for (const [i, pts] of groups) { if (i > 0) pts.unshift(groups.get(i - 1)![groups.get(i - 1)!.length - 1]); const m = pts[Math.floor(pts.length / 2)];
      if (pts.length > 1 && Math.hypot(m[0] - PARSA[0], m[1] - PARSA[1]) < near) out.push({ road: f.id, i, pts, s0: i * len, box: [Math.min(...pts.map(q => q[0])), Math.min(...pts.map(q => q[1])), Math.max(...pts.map(q => q[0])), Math.max(...pts.map(q => q[1]))] }); } }
  return out;
}
const segD = (p: P2, a: P2, b: P2) => { const dx = b[0] - a[0], dn = b[1] - a[1], l2 = dx * dx + dn * dn || 1, t = Math.max(0, Math.min(1, ((p[0] - a[0]) * dx + (p[1] - a[1]) * dn) / l2)); return Math.hypot(p[0] - a[0] - t * dx, p[1] - a[1] - t * dn); };
/** the animals a mover brings (its performance's: activities.ts) */
export const animalsOf = (m: Mover) => /string of pack|unloaded string|holding the string/.test(m.why) ? 5 : /camels/.test(m.why) ? 4 : /dragging a column drum|empty sledge/.test(m.why) ? 4
  : /ox cart|timber cart|cart of/.test(m.why) ? 2 : /courier/.test(m.why) ? 1 : /flock|sheep|goats/.test(m.why) && m.act === 'herd' ? 12 : /donkey|ewes|a goat|a sheep|new ox/.test(m.why) ? 1 : 0;
const loaded = (m: Mover) => /carry/.test(m.act) || /string of pack|camels with|ox cart of|cart of roof|dragging a column drum|with grain|with the|carrying|loaded/.test(m.why);

export interface Census { wetShare: number; stretches: number; worstGapMin: number; overTwo: number; overTwoShare: number; meanEmptyShare: number; noWhy: number;
  perRoad: Record<string, { stretches: number; worstGapMin: number; p50GapMin: number; emptyShare: number }>;
  perHour: Record<string, { travellers: number; groups: number; animals: number; loads: number }[]>;
  kinds: Record<string, number>; purposes: Record<string, number>; worst: { road: string; i: number; day: number; gapMin: number; at: number }[] }

export function census(traffic: Traffic, pop: { cal: { ctx(d: number): { sun: { rise: number; set: number }; wx?: any } } }, days: number[], step = STEP, near = NEAR): Census {
  const S = stretches(near), byRoad = new Map<string, Stretch[]>(); for (const s of S) (byRoad.get(s.road) ?? byRoad.set(s.road, []).get(s.road)!).push(s);
  const roadW = Object.fromEntries(((settlement as any).features as any[]).filter(f => f.id.startsWith('road_')).map(f => [f.id, (f.width_m ?? 6) / 2 + SIDE]));
  const perHour: Census['perHour'] = {}; for (const r of byRoad.keys()) perHour[r] = Array.from({ length: 24 }, () => ({ travellers: 0, groups: 0, animals: 0, loads: 0 }));
  const kinds: Record<string, number> = {}, purposes: Record<string, number> = {}; let noWhy = 0;
  const gaps: { s: Stretch; day: number; gap: number; at: number }[] = []; const emptyT = new Map<Stretch, number>(), totT = new Map<Stretch, number>();
  const movers: Mover[] = []; let wetT = 0, allT = 0;
  for (const d of days) { const sun = pop.cal.ctx(d).sun, t0 = d * 24 + sun.rise + 0.25, t1 = d * 24 + sun.set - 0.25;
    allT += (t1 - t0) * 3600; const last = new Map<Stretch, number>(), worst = new Map<Stretch, { g: number; at: number }>(); for (const s of S) last.set(s, t0);
    const hourSeen = new Map<string, Set<string>>();
    const wx = pop.cal.ctx(d).wx ?? {}, wet = (h: number) => (!!wx.rain && h >= wx.rain[0] - 0.2 && h < wx.rain[1] + 0.3) || (!!wx.stormH && h >= wx.stormH[0] - 0.3 && h < wx.stormH[1] + 0.3);
    for (let t = t0; t <= t1; t += step / 3600) {
      // (the done line counts dry daylight: in the rain the roads empty but for a few hurrying, and the wet hours are left out;
      // their spells are reported apart)
      if (wet(t - d * 24)) { wetT += step; for (const s of S) last.set(s, t); continue; }
      traffic.at(t, movers, { e: PARSA[0], n: PARSA[1], r: near + 300 }); const occ = new Set<Stretch>(); const h = Math.floor(t - d * 24);
      for (const m of movers) { if (!m.why) noWhy++;
        for (const [road, L] of byRoad) { const w = roadW[road]; let hit = false;
          for (const s of L) { if (m.e < s.box[0] - w || m.e > s.box[2] + w || m.n < s.box[1] - w || m.n > s.box[3] + w) continue; for (let q = 1; q < s.pts.length; q++) if (segD([m.e, m.n], s.pts[q - 1], s.pts[q]) < w) { occ.add(s); hit = true; break; } }
          if (hit) { const k = `${road}|${h}`, seen = hourSeen.get(k) ?? hourSeen.set(k, new Set()).get(k)!; if (!seen.has(m.key)) { seen.add(m.key); const ph = perHour[road][h];
            ph.travellers++; if (!/:\d+$/.test(m.key) || /^(cv|dl|tb|cu|co)/.test(m.key)) ph.groups++; ph.animals += animalsOf(m); if (loaded(m)) ph.loads++;
            kinds[m.kind] = (kinds[m.kind] ?? 0) + 1; const pk = m.why.replace(/\(.*?\)/g, '').replace(/ to .*| from .*| with .*| along .*/, '').trim().slice(0, 60); purposes[pk] = (purposes[pk] ?? 0) + 1; } } } }
      for (const s of S) { totT.set(s, (totT.get(s) ?? 0) + step); if (occ.has(s)) { const g = t - last.get(s)!; const w = worst.get(s); if (!w || g > w.g) worst.set(s, { g, at: t }); last.set(s, t); } else emptyT.set(s, (emptyT.get(s) ?? 0) + step); } }
    for (const s of S) { const g = t1 - last.get(s)!, w = worst.get(s); const best = !w || g > w.g ? { g, at: t1 } : w; gaps.push({ s, day: d, gap: best.g * 60, at: +(best.at - d * 24).toFixed(2) }); } }
  const perRoad: Census['perRoad'] = {};
  for (const [r, L] of byRoad) { const G = gaps.filter(g => g.s.road === r).map(g => g.gap).sort((a, b) => a - b);
    perRoad[r] = { stretches: L.length, worstGapMin: +(G[G.length - 1] ?? 0).toFixed(1), p50GapMin: +(G[Math.floor(G.length / 2)] ?? 0).toFixed(1),
      emptyShare: +(L.reduce((a, s) => a + (emptyT.get(s) ?? 0), 0) / Math.max(1, L.reduce((a, s) => a + (totT.get(s) ?? 0), 0))).toFixed(3) }; }
  const over = gaps.filter(g => g.gap > 2);
  return { wetShare: +(wetT / Math.max(1, allT)).toFixed(3), stretches: S.length, worstGapMin: +Math.max(0, ...gaps.map(g => g.gap)).toFixed(1), overTwo: over.length, overTwoShare: +(over.length / Math.max(1, gaps.length)).toFixed(3),
    meanEmptyShare: +([...S].reduce((a, s) => a + (emptyT.get(s) ?? 0) / Math.max(1, totT.get(s) ?? 1), 0) / Math.max(1, S.length)).toFixed(3), noWhy, perRoad, perHour, kinds,
    purposes: Object.fromEntries(Object.entries(purposes).sort((a, b) => b[1] - a[1]).slice(0, 40)),
    worst: gaps.sort((a, b) => b.gap - a.gap).slice(0, 12).map(g => ({ road: g.s.road, i: g.s.i, day: g.day, gapMin: +g.gap.toFixed(1), at: g.at })) };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const t0 = performance.now(), pop = new Population(SEED, { court: COURT }), W = new WeatherSystem(SEED);
  pop.attach(new EventCalendar(SEED, pop, (t: number) => { const d = Math.floor(t / 24), c = W.conditions(d, t - d * 24); return { rain: c.rain, lightning: c.lightning, windMs: c.windMs, tempC: c.tempC, dust: c.dust }; }, COURT));
  const plan = buildTownPlan(), traffic = new Traffic(SEED, pop as any, plan);
  if (process.argv.includes("--nofolk")) (traffic.folk as any).at = () => [];
  const days = Array.from({ length: DAYS }, (_, k) => Math.floor((k + 0.5) * 360 / DAYS));
  const c = census(traffic, pop as any, days);
  const hours = (r: string) => c.perHour[r].map((x, h) => x.travellers ? `${h}:${x.travellers}/${x.groups}g/${x.animals}a/${x.loads}l` : '').filter(Boolean).join(' ');
  console.log(`road census (seed ${SEED}${COURT ? ', court' : ''}; ${days.length} days, ${STEP} s steps, ${c.stretches} stretches of ${STRETCH} m within ${NEAR} m; ${((performance.now() - t0) / 1000).toFixed(0)} s)`);
  console.log(`  dry daylight (${((1 - c.wetShare) * 100).toFixed(1)} % of the days' daylight; the wet hours left out): longest empty run ${c.worstGapMin} min; stretch-days over 2 min: ${c.overTwo} (${(c.overTwoShare * 100).toFixed(1)} %); mean share of daylight empty: ${(c.meanEmptyShare * 100).toFixed(1)} %; movers without a purpose: ${c.noWhy}`);
  for (const [r, x] of Object.entries(c.perRoad)) console.log(`  ${r}: ${x.stretches} stretches, worst gap ${x.worstGapMin} min, median ${x.p50GapMin} min, empty ${(x.emptyShare * 100).toFixed(1)} %\n    per hour (travellers/groups/animals/loads, over all days): ${hours(r)}`);
  console.log('  kinds:', JSON.stringify(c.kinds)); console.log('  purposes:'); for (const [k, v] of Object.entries(c.purposes)) console.log(`    ${v}  ${k}`);
  console.log('  worst:', c.worst.map(w => `${w.road}#${w.i} d${w.day} ${w.gapMin} min to ${w.at} h`).join('; '));
  let site: Record<string, unknown> | null = null;
  if (process.argv.includes('--site')) { site = siteCensus(pop, days.filter((_, i) => i % 3 === 0)); console.log('  site and camps (people there per daylight hour, mean over days; top activities):'); for (const [k, v] of Object.entries(site)) console.log(`    ${k}: ${JSON.stringify(v)}`); }
  if (JSON_OUT) writeFileSync(JSON_OUT, JSON.stringify({ ...c, site }, null, 1));
}

/** the building site and the camps from the population's plans (Population.plan: what popview draws) */
export function siteCensus(pop: Population, days: number[]) {
  const AREAS: [string, RegExp][] = [['hall100 site', /^(hall100_site|worksite|h100_|brickyard)/], ['court camps', /^(court_camp|rcamp:)/]];
  const out: Record<string, { perHour: Record<number, number>; acts: Record<string, number>; daysWith: number }> = {};
  for (const [k] of AREAS) out[k] = { perHour: {}, acts: {}, daysWith: 0 };
  for (const d of days) { const sun = pop.cal.ctx(d).sun, seen: Record<string, boolean> = {};
    for (let pid = 0; pid < pop.persons.length; pid++) { let segs: { t0: number; t1: number; place: string; act: string }[]; try { segs = pop.plan(pid, d) as any; } catch { continue; }
      for (const sg of segs) for (const [k, re] of AREAS) { if (!re.test(sg.place)) continue;
        for (let h = Math.ceil(Math.max(sg.t0, sun.rise)); h < Math.min(sg.t1, sun.set); h++) { out[k].perHour[h] = (out[k].perHour[h] ?? 0) + 1 / days.length; seen[k] = true; }
        out[k].acts[sg.act] = (out[k].acts[sg.act] ?? 0) + 1; } }
    for (const k of Object.keys(seen)) out[k].daysWith++; }
  for (const v of Object.values(out)) { for (const h of Object.keys(v.perHour)) v.perHour[+h] = Math.round(v.perHour[+h]); v.acts = Object.fromEntries(Object.entries(v.acts).sort((a, b) => b[1] - a[1]).slice(0, 8)); }
  return out;
}
