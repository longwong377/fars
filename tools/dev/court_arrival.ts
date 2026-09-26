// The court's arrival traced (D-252; UD-09, UD-10; T-F8's before and after, T-F5, T-F3d-like): what the population view would
// DRAW (popview.ts settled as the renderer's pool is fed: people_trace.ts buildTraceWorld) on the days around the seed's arrival
// and departure of the court, not what the plans say:
//  - the road: people drawn walking within 1 km of the Grand Stair foot (T-F3d's "road density within 1 km"), all of them and
//    the court's own, on an ordinary day before anyone of the court comes, in the days of making ready, on the column's days and
//    after; the ratio of the king's day to the ordinary day;
//  - the word (T-F5): the heralds drawn riding on the royal road before the king's day, and the order in the world log;
//  - the Terrace: the court's people drawn on the Terrace, day by day;
//  - a few named court people (the king, a spearman of the advance, a cook of the king's table, a muleteer of the baggage, a
//    herald) before, during and after: their plan and what the view draws.
//   npx tsx tools/dev/court_arrival.ts [--seed 1] [--sample 4] [--hours 9,11,13,15] [--evidence <pass>]
//     --sample k: every k-th household (people_trace.ts), the named people and the heralds always; counts are of the sample
import { writeFileSync, mkdirSync } from 'node:fs';
import { execSync } from 'node:child_process';
import { buildTraceWorld } from './people_trace';
import { segAt } from '../../src/people/population';
import { PLACES } from '../../src/people/sim';
import { sunTimes } from '../../src/people/calendar';

const arg = (k: string, d: string) => { const i = process.argv.indexOf(k); return i >= 0 ? process.argv[i + 1] : d; };
const seed = +arg('--seed', '1'), sample = +arg('--sample', '4'), hours = arg('--hours', '9,11,13,15').split(',').map(Number), pass = arg('--evidence', '');
const W = buildTraceWorld(seed, sample, true), P = W.pop, K = P.court!, V = W.view, Y = K.year;
const FOOT = (PLACES as any).stair_foot.at as [number, number], R = 1000;
// the named: the king, a spearman of the advance (file 0), a cook, a muleteer of the baggage, the first herald
const cook = K.byGroup.get('table')!.find(pid => K.member(pid)!.role === 'cook')!, mule = K.byGroup.get('retinue')!.find(pid => K.member(pid)!.role === 'baggage')!;
const named: Record<string, number> = { king: K.king, spearman: K.guards[0], cook, muleteer: mule, herald: K.heralds[0] };
const keep = new Set<number>([...Object.values(named), ...K.heralds]); const only = V.only; if (only) V.only = pid => only(pid) || keep.has(pid);
const ord = Y.first - 3 >= 0 ? Y.first - 3 : 0; // an ordinary day: before anyone of the court comes (its heralds included)
const days = [...new Set([ord, Y.first, Y.first + 2, Y.arrive - 1, Y.arrive, Y.arrive + 1, Y.arrive + 5, Y.leave - 1, Y.leave, Y.leave + 1])].filter(d => d >= 0 && d < 354).sort((a, b) => a - b);
const label = (d: number) => d === ord ? 'ordinary' : d < Y.first ? 'before' : d < Y.arrive ? 'making ready' : d === Y.arrive ? 'the king’s day' : d <= Y.last ? 'the column' : d < Y.leave ? 'residence' : d === Y.leave ? 'leave day' : 'after';
const rows: any[] = [], namedRows: Record<string, any[]> = Object.fromEntries(Object.keys(named).map(k => [k, []]));
for (const d of days) { const sun = sunTimes(d);
  for (const h of hours) { if (h < sun.rise || h > sun.set) continue; const t0 = performance.now(); W.sim.jumpTo(d * 24 + h); V.settle(d * 24 + h, [-422, -941]);
    let road = 0, roadCourt = 0, heraldsRiding = 0, courtTerrace = 0, drawn = 0;
    for (const vp of V.visible) { drawn++; const own = K.owns(vp.pid), near = Math.hypot(vp.e - FOOT[0], vp.n - FOOT[1]) <= R;
      const s = P.present(vp.pid, d) ? segAt(P.plan(vp.pid, d), h) : null;
      if (vp.moving && s?.where === 'road' && near) { road++; if (own) roadCourt++; }
      if (own && K.member(vp.pid)?.g === 'herald' && vp.moving && /courier riding/.test(vp.why)) heraldsRiding++;
      if (own && s?.where === 'terrace') courtTerrace++; }
    rows.push({ day: d, hour: h, phase: label(d), drawn, roadWithin1km: road, roadWithin1kmCourt: roadCourt, heraldsRiding, courtOnTerraceDrawn: courtTerrace, ms: Math.round(performance.now() - t0) });
    for (const [k, pid] of Object.entries(named)) { if (!P.present(pid, d)) { namedRows[k].push({ day: d, hour: h, plan: 'not at Persepolis' }); continue; }
      const s = segAt(P.plan(pid, d), h), st = V.stateOf(pid), vp = V.visible.find(x => x.pid === pid);
      namedRows[k].push({ day: d, hour: h, plan: `${s.where} ${s.place} ${s.act}: ${s.why}`, drawn: vp ? `${vp.moving ? 'walking' : 'at'} [${vp.e.toFixed(0)}, ${vp.n.toFixed(0)}] ${vp.act}` : `not drawn (${st?.what ?? '-'})` }); }
    console.error(`day ${d} ${h}:00 ${label(d)}: road≤1km ${road} (court ${roadCourt}), heralds riding ${heraldsRiding}, court on the Terrace ${courtTerrace}`); } }
const mean = (ph: (r: any) => boolean) => { const xs = rows.filter(ph).map(r => r.roadWithin1km); return xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : NaN; };
const ordinary = mean(r => r.day === ord), kingDay = mean(r => r.day === Y.arrive), vanguard = mean(r => r.day === Y.arrive - 1), leaveDay = mean(r => r.day === Y.leave);
const log: { t: number; id: string; text: string }[] = []; for (let d = 0; d <= Y.leave + 1; d++) for (const e of P.cal.ctx(d).events) if (e.id === 'E-25' || e.id === 'E-26' || (e.id === 'E-20' && /word that the king is coming/.test(e.text))) log.push({ t: +e.t.toFixed(2), id: e.id, text: e.text });
const e25 = log.find(e => e.id === 'E-25')!;
const out = { seed, sample, year: Y, stairFoot: FOOT, radius_m: R,
  tf3dLike: { ordinaryDay: ord, ordinaryMean: +ordinary.toFixed(1), vanguardMean: +vanguard.toFixed(1), kingDayMean: +kingDay.toFixed(1), leaveDayMean: +leaveDay.toFixed(1), kingDayRatio: +(kingDay / Math.max(1, ordinary)).toFixed(2), leaveDayRatio: +(leaveDay / Math.max(1, ordinary)).toFixed(2),
    note: 'people drawn walking on a road block within 1 km of the Grand Stair foot, mean over the daylight hours sampled; the ordinary day is before anyone of the court (the heralds too) has come' },
  tf5: { heraldsDrawnRidingBefore: rows.filter(r => r.day < Y.arrive).reduce((a, r) => a + r.heraldsRiding, 0), worldLog: log, heraldsBeforeE25: log.filter(e => e.id === 'E-20' && e.t < e25.t).length, heraldsAfterE25: log.filter(e => e.id === 'E-20' && e.t >= e25.t).length },
  rows, named: Object.fromEntries(Object.entries(named).map(([k, pid]) => [k, { pid, name: P.nameOf(pid), role: K.roleOf(pid), rows: namedRows[k] }])) };
console.log(JSON.stringify({ tf3dLike: out.tf3dLike, tf5: { ...out.tf5, worldLog: out.tf5.worldLog.length } }, null, 1));
if (pass) { const dir = `REVIEWS/evidence/${pass}`; mkdirSync(dir, { recursive: true }); let commit = 'unknown'; try { commit = execSync('git rev-parse --short HEAD', { encoding: 'utf8' }).trim(); } catch { /* */ }
  const f = `${dir}/court_arrival.seed-${seed}.json`; writeFileSync(f, JSON.stringify({ tool: 'tools/dev/court_arrival.ts', commit, date: new Date().toISOString().slice(0, 10), ...out }, null, 1)); console.log('written', f); }
