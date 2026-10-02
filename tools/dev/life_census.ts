// s17 C10 (D-640; UD-08, UD-09, UD-26, UD-36): THE LIFE CENSUS. Wherever the player stands, by day, are people living and
// working in view? A node count over the coverage set (tests/data/coverage_points.json, every walkable area) on the whole
// population as the renderer is fed it (tools/dev/people_trace.ts: the population view settled with no budgets, plus the
// Terrace's detailed agents): per coverage point, the people DRAWN within 60 m (horizontal) at a grid of daytime moments
// (seasons x hour bands: the same positions at many times, so one unlucky moment does not decide a place), split into
//   work  : at a task (anything not idle and not walking),
//   idle  : resting, eating, talking, playing, sheltering, queueing, asleep, ill, mourning,
//   moving: walking between places (a walk is life in view, but not work),
// and per area (the point's sub-area) and hour band the share of moments with nobody in view, the emptiest points by day,
// and, for each empty moment, the nearest drawn person (how far the life is). "By day" is the sun's: rise + 0.5 h to set.
// Nobody is spawned here: the census only reads the sim.
// How this could pass while the intent fails: people in view who are all walking past (counted apart: `moving`); a point
// reached by one person (the count is reported, not only the yes/no); a point that is empty because it is a room nobody
// lives in (reported with its sub-area, judged in the report, not hidden).
// Out of world, English. Run: npx tsx tools/dev/life_census.ts [--seed 1] [--days 0,60,120,200,290] [--hours 7,9.5,12.5,15.5,18]
//   [--own] (also each daytime point at its own moment; slow: ~70 s a moment) [--json bench-reports/life_census_s1.json]
import { readFileSync, writeFileSync, mkdirSync, existsSync, appendFileSync } from 'node:fs';
import { buildTraceWorld, type TraceWorld } from './people_trace';
import { ACTIVITIES, type ActivityId } from '../../src/people/activities';
import { sunTimes } from '../../src/people/calendar';

export interface CovPoint { id: string; area: string; sub: string; e: number; n: number; band: string; day: number; hour: number }
export const R_VIEW = 60;
/** in sight across open ground (the plain, the hill, the far land: a person is seen well beyond 60 m there): reported beside */
export const R_SIGHT = 250;
const IDLE = new Set<ActivityId>(['rest', 'sleep', 'eat', 'talk', 'gamble', 'play', 'shelter', 'queue', 'offmap', 'lie_ill', 'mourn'] as ActivityId[]);
export interface Drawn { pid: number; e: number; n: number; act: ActivityId; moving: boolean; why: string }
export interface PointCount { work: number; idle: number; moving: number; nearest: number; sight: number; acts: Record<string, number> }

/** everyone drawn at (day, hour): the population view's people and the detailed agents on the map (as people_trace.traceAt) */
export function drawnAt(W: TraceWorld, day: number, hour: number): Drawn[] {
  const t = day * 24 + hour, V = W.view, S = W.sim; S.jumpTo(t); V.settle(t, [-422, -941]);
  const out = new Map<number, Drawn>();
  for (const vp of V.visible) { if (vp.agent >= 0 && !S.agents[vp.agent]?.offmap) continue; out.set(vp.pid, { pid: vp.pid, e: vp.e, n: vp.n, act: vp.act, moving: vp.moving, why: vp.why }); }
  for (const a of S.visibleAgents([-422, -941], 1e7)) out.set(a.pid, { pid: a.pid, e: a.pos[0], n: a.pos[1], act: S.performance(a).act, moving: a.walking, why: a.task?.why ?? '' });
  return [...out.values()];
}
/** the people drawn within R_VIEW of each point (a 64 m hash) */
export function countAt(pts: readonly { e: number; n: number }[], drawn: readonly Drawn[]): PointCount[] {
  const C = 64, key = (i: number, j: number) => i * 100003 + j, H = new Map<number, Drawn[]>();
  for (const d of drawn) { const k = key(Math.floor(d.e / C), Math.floor(d.n / C)); (H.get(k) ?? H.set(k, []).get(k)!).push(d); }
  return pts.map(p => {
    const r: PointCount = { work: 0, idle: 0, moving: 0, nearest: Infinity, sight: 0, acts: {} }, i0 = Math.floor(p.e / C), j0 = Math.floor(p.n / C), k = Math.ceil(R_SIGHT / C);
    for (let i = i0 - k; i <= i0 + k; i++) for (let j = j0 - k; j <= j0 + k; j++) for (const d of H.get(key(i, j)) ?? []) {
      const dd = Math.hypot(d.e - p.e, d.n - p.n); if (dd <= R_SIGHT) r.sight++; if (dd > R_VIEW) continue;
      if (d.moving && ACTIVITIES[d.act]?.moving !== false) r.moving++; else if (IDLE.has(d.act)) r.idle++; else r.work++;
      const a = d.moving ? 'walk' : d.act; r.acts[a] = (r.acts[a] ?? 0) + 1;
    }
    if (r.work + r.idle + r.moving === 0) { let best = Infinity; for (const d of drawn) { const dd = Math.hypot(d.e - p.e, d.n - p.n); if (dd < best) best = dd; } r.nearest = best; } else r.nearest = 0;
    return r;
  });
}
export const bandOf = (day: number, hour: number) => { const s = sunTimes(day); return hour < s.rise + 0.5 ? 'dawn' : hour < 11 ? 'morning' : hour < 14 ? 'noon' : hour < s.set - 1.5 ? 'afternoon' : 'evening'; };
export const isDay = (day: number, hour: number) => { const s = sunTimes(day); return hour >= s.rise + 0.5 && hour <= s.set; };

if (process.argv[1]?.replace(/\\/g, '/').endsWith('tools/dev/life_census.ts')) {
  const arg = (k: string, d: string) => { const i = process.argv.indexOf(k); return i >= 0 ? process.argv[i + 1] : d; };
  const seed = +arg('--seed', '1'), days = arg('--days', '0,60,120,200,290').split(',').map(Number), hours = arg('--hours', '7,9.5,12.5,15.5,18').split(',').map(Number);
  const own = process.argv.includes('--own'), json = arg('--json', `bench-reports/life_census_s${seed}.json`), cache = arg('--cache', '');
  // (--cache file: each moment's counts are appended as they come and reused on a rerun of the same code: a long run survives a restart)
  const cached = new Map<string, PointCount[]>(); if (cache && existsSync(cache)) for (const l of readFileSync(cache, 'utf8').split('\n')) if (l) { const o = JSON.parse(l); cached.set(o.k, o.cs); }
  const t0 = performance.now(), P = (JSON.parse(readFileSync('tests/data/coverage_points.json', 'utf8')).points as CovPoint[]);
  const W = buildTraceWorld(seed); console.log(`world ${((performance.now() - t0) / 1000).toFixed(0)} s, ${P.length} points`);
  // per point: moments by day, moments empty, work/idle/moving sums, the acts seen
  const per = P.map(p => ({ id: p.id, area: p.area, sub: p.sub, e: p.e, n: p.n, moments: 0, empty: 0, sightEmpty: 0, work: 0, idle: 0, moving: 0, workMoments: 0, nearestEmpty: [] as number[], acts: {} as Record<string, number>, byBand: {} as Record<string, [number, number]> }));
  const moments: { day: number; hour: number; drawn: number; s: number }[] = [];
  for (const d of days) for (const h of hours) {
    if (!isDay(d, h)) continue; const m0 = performance.now(), k = `${d}/${h}`, hit = cached.get(k), dr = hit ? [] : drawnAt(W, d, h), cs = hit ?? countAt(P, dr), b = bandOf(d, h);
    if (cache && !hit) appendFileSync(cache, JSON.stringify({ k, cs }) + '\n');
    cs.forEach((c, i) => { const q = per[i]; q.moments++; const n = c.work + c.idle + c.moving; if (!n) { q.empty++; q.nearestEmpty.push(Math.round(c.nearest)); } if (!c.sight) q.sightEmpty++; if (c.work) q.workMoments++;
      q.work += c.work; q.idle += c.idle; q.moving += c.moving; for (const [k, v] of Object.entries(c.acts)) q.acts[k] = (q.acts[k] ?? 0) + v;
      const bb = q.byBand[b] ?? (q.byBand[b] = [0, 0]); bb[0]++; if (!n) bb[1]++; });
    moments.push({ day: d, hour: h, drawn: dr.length, s: (performance.now() - m0) / 1000 }); console.log(`day ${d} ${h} h (${b}): ${dr.length} drawn, ${cs.filter(c => !(c.work + c.idle + c.moving)).length}/${P.length} points empty, ${((performance.now() - m0) / 1000).toFixed(0)} s`);
  }
  // the points at their own moments (by day only)
  const ownRows: { id: string; sub: string; day: number; hour: number; n: number; work: number; nearest: number }[] = [];
  if (own) { const dayPts = P.map((p, i) => ({ p, i })).filter(x => isDay(x.p.day, x.p.hour)).sort((a, b) => a.p.day * 24 + a.p.hour - (b.p.day * 24 + b.p.hour));
    for (const { p } of dayPts) { const c = countAt([p], drawnAt(W, p.day, p.hour))[0]; ownRows.push({ id: p.id, sub: p.sub, day: p.day, hour: p.hour, n: c.work + c.idle + c.moving, work: c.work, nearest: Math.round(c.nearest) }); } }
  // by sub-area and band
  const bySub: Record<string, { points: number; moments: number; empty: number; sightEmpty: number; work: number; idle: number; moving: number; workMoments: number }> = {};
  const byBand: Record<string, [number, number]> = {};
  for (const q of per) { const s = bySub[q.sub] ?? (bySub[q.sub] = { points: 0, moments: 0, empty: 0, sightEmpty: 0, work: 0, idle: 0, moving: 0, workMoments: 0 }); s.points++; s.moments += q.moments; s.empty += q.empty; s.sightEmpty += q.sightEmpty; s.work += q.work; s.idle += q.idle; s.moving += q.moving; s.workMoments += q.workMoments;
    for (const [b, [n, e]] of Object.entries(q.byBand)) { const bb = byBand[b] ?? (byBand[b] = [0, 0]); bb[0] += n; bb[1] += e; } }
  const pct = (a: number, b: number) => b ? (100 * a / b).toFixed(0).padStart(3) + ' %' : '   -';
  console.log(`\nsub-area                        points  empty  work-in-view  people/moment (work idle moving)  none-in-250m`);
  for (const [k, s] of Object.entries(bySub).sort((a, b) => b[1].empty / b[1].moments - a[1].empty / a[1].moments))
    console.log(`${k.padEnd(32)}${String(s.points).padStart(5)}  ${pct(s.empty, s.moments)}  ${pct(s.workMoments, s.moments)}       ${(s.work / s.moments).toFixed(1).padStart(5)} ${(s.idle / s.moments).toFixed(1).padStart(5)} ${(s.moving / s.moments).toFixed(1).padStart(5)}   ${pct(s.sightEmpty, s.moments)}`);
  console.log('\nband: empty share'); for (const [b, [n, e]] of Object.entries(byBand)) console.log(`  ${b.padEnd(10)} ${pct(e, n)} of ${n}`);
  const T = per.reduce((a, q) => [a[0] + q.moments, a[1] + q.empty, a[2] + (q.empty === q.moments && q.moments ? 1 : 0), a[3] + (q.empty ? 1 : 0)], [0, 0, 0, 0]);
  console.log(`\nALL: ${T[1]} of ${T[0]} point-moments empty (${pct(T[1], T[0])}); points empty at every moment: ${T[2]}; points empty at some moment: ${T[3]} of ${per.length}`);
  // the done line (D-640): points where the sim has a reason for people to be, nobody within 60 m at every daytime moment. Not
  // counted, with the reason: the coverage set's edge checks (terrain rings, not places), the far open ground and the open
  // plain between fields, roads and villages (no one's work is there), the roads and the quarries (their people are the roads'
  // travellers and the quarrymen of world/traffic.ts, C3's, not in this count)
  const NO_REASON = /^(edge:|far:open|far:quarries|plain:open|plain:roads)/;
  const reasoned = per.filter(q => !NO_REASON.test(q.sub) && q.moments), always = reasoned.filter(q => q.empty === q.moments), sightAlways = reasoned.filter(q => q.sightEmpty === q.moments);
  const RM = reasoned.reduce((a, q) => [a[0] + q.moments, a[1] + q.empty], [0, 0]);
  console.log(`\nWITH A REASON: ${reasoned.length} points; empty at every daytime moment (60 m): ${always.length}; nobody even within 250 m at every moment: ${sightAlways.length}; point-moments empty ${pct(RM[1], RM[0])}`);
  console.log(`  always empty: ${always.map(q => `${q.id} ${q.sub}`).join(', ')}`);
  const worst = [...per].filter(q => q.empty).sort((a, b) => b.empty / b.moments - a.empty / a.moments || a.work - b.work);
  console.log('\nemptiest points by day:'); for (const q of worst.slice(0, 40)) console.log(`  ${q.id} ${q.sub.padEnd(28)} ${q.empty}/${q.moments} empty, nearest ${q.nearestEmpty.join(',')} m  (${q.e.toFixed(0)}, ${q.n.toFixed(0)})`);
  if (own) { const e = ownRows.filter(r => !r.n); console.log(`\nown moments: ${e.length} of ${ownRows.length} daytime points empty at their own moment`); for (const r of e) console.log(`  ${r.id} ${r.sub} day ${r.day} ${r.hour.toFixed(1)} h, nearest ${r.nearest} m`); }
  mkdirSync('bench-reports', { recursive: true });
  writeFileSync(json, JSON.stringify({ seed, days, hours, r: R_VIEW, moments, all: { pointMoments: T[0], empty: T[1], alwaysEmpty: T[2], sometimesEmpty: T[3] }, reasoned: { points: reasoned.length, alwaysEmpty: always.map(q => q.id), sightAlwaysEmpty: sightAlways.map(q => q.id), pointMoments: RM[0], empty: RM[1] }, bySub, byBand, points: per.map(q => ({ ...q, acts: undefined })), own: own ? ownRows : undefined }, null, 0) + '\n');
  console.log(`\n${json}; ${((performance.now() - t0) / 1000).toFixed(0)} s`);
}
