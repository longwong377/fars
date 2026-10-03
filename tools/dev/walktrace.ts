// dev (s18 C5, D-697): the walks of the plans against the view's walkers. At a point and moment: the people whose plan
// has them on the move then (a 'road' block: an errand's leg, a way to work), how the view shows each (walking, standing at
// the place left or the place reached, not drawn, and why), and the walkers the view draws within R m.
// Usage: npx tsx tools/dev/walktrace.ts [--day 88] [--hour 13.8] [--e -857.15] [--n -147.78] [--r 60] [--live 0]
import { buildOfflineWorld } from './lib/offline_world';
const argv = process.argv.slice(2), flag = (k: string, d: number) => { const i = argv.indexOf(k); return i >= 0 ? +argv[i + 1] : d; };
const DAY = flag('--day', 88), HOUR = flag('--hour', 13.805), C: [number, number] = [flag('--e', -857.15), flag('--n', -147.78)], R = flag('--r', 60), LIVE = flag('--live', 0);
const W = await buildOfflineWorld({ seed: 1, day: DAY, hour: HOUR, court: true });
const sim = W.sim!, view = W.view!, pop = sim.pop, t = DAY * 24 + HOUR;
sim.jumpTo(t); if (LIVE) { for (let f = 0; f < LIVE * 30; f++) view.update(t + f / 30 / 3600, C); } else view.settle(t, C);
const te = LIVE ? t + LIVE / 3600 : t;
const L = (view as any).list as any[]; let planWalk = 0; const how: Record<string, number> = {}; const ex: string[] = [];
for (const s of L) { const h = s.home; if (!Number.isFinite(h[0]) || Math.hypot(h[0] - C[0], h[1] - C[1]) > 400) continue;
  if (!pop.present(s.pid, DAY)) continue; const P = pop.plan(s.pid, DAY), hh = te - DAY * 24, seg = P.find(q => q.t0 <= hh && hh < q.t1); if (!seg || seg.where !== 'road') continue;
  planWalk++; const k = s.mode === 2 ? 'walking' : s.mode === 1 ? `standing (${String(s.what).replace(/[0-9.,:()-]+/g, '').slice(0, 50)})` : `not drawn (${String(s.what).replace(/[0-9.,:()-]+/g, '').slice(0, 60)})`;
  how[k] = (how[k] ?? 0) + 1; if (ex.length < 12 && s.mode !== 2) ex.push(`p${s.pid} plan ${seg.place} ${seg.act} ${seg.t0.toFixed(2)}-${seg.t1.toFixed(2)} "${seg.why.slice(0, 50)}" -> mode ${s.mode} v ${(s.v0 - DAY * 24).toFixed(2)}-${(s.v1 - DAY * 24).toFixed(2)} ${String(s.what).slice(0, 80)}`); }
const near = view.query(C, R).filter(v => v.agent < 0);
console.log(`d${DAY} ${HOUR}h at (${C}): people living within 400 m whose plan has them on the move now: ${planWalk}; the view shows them: ${JSON.stringify(how)}`);
console.log(`drawn within ${R} m: ${near.length}, walking ${near.filter(v => v.moving).length}; view stats: routeWait ${view.stats.routeWait}, unresolved ${view.stats.unresolved}, walking ${view.stats.walking}, steps ${view.stats.steps}`);
for (const e of ex) console.log('  ', e);
process.exit(0);
