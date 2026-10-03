// dev (s18 C5, D-690): who is out in the town's lanes, courts and markets. For each point and moment: the population drawn
// within R m (standing / walking), and for the people whose home lies within H m why the others are not drawn (indoors
// by the plan, away at work or the fields, not planned yet, no room). Usage: npx tsx tools/dev/lanecensus.ts [--r 25] [--h 60]
import { buildOfflineWorld } from './lib/offline_world';
import { TownWalk } from '../../src/world/settlement/walk';
import { LANE, SQUARE, ROOM } from '../../src/world/settlement/site';
type P2 = [number, number];
const argv = process.argv.slice(2), flag = (k: string, d: number) => { const i = argv.indexOf(k); return i >= 0 ? +argv[i + 1] : d; };
const R = flag('--r', 25), H = flag('--h', 60);
const WORKN = (s: any) => s.work && Number.isFinite(s.work[0]);
const W = await buildOfflineWorld({ seed: 1, day: 0, hour: 10, court: true });
const view = W.view!, sim = W.sim!, pop = sim.pop, tw = TownWalk.fromPlan(W.settlement!.plan);
const where = (e: number, n: number) => { const l = tw.locate(e, n); if (!l) return 'off the town'; const S = tw.boxes[l.si].s, c = S.cell[l.k]; return c === LANE ? 'lane' : c === SQUARE ? 'square' : c < 0 ? 'open' : S.sub[l.k] === ROOM ? 'room' : 'court/yard'; };
const PTS: [string, P2][] = process.env.TPTS ? [['cov-252 terrace open', [100.3, 9.85]], ['cov-294 apadana', [14.31, 32.65]], ['cov-350 gate', [0.77, 122.67]]] : [['q_s1 lane (C6 ask-c1-1)', [-478, -881]], ['q_s1 market', [-444.3, -990.7]], ['q_s1 court (C7)', [-503.4, -1028.7]], ['q_s2 lane', [-789, -1018]], ['q_s3 lane', [-1114, -894]], ['q_w2 lane', [-1026, 487]], ['q_n1', [-236, 711]]];
for (const [day, hour, mode] of (process.env.TPTS ? [[168, 12.59, 'settle'], [200, 8.81, 'settle'], [241, 16.27, 'settle'], [25, 10, 'settle']] : [[0, 10, 'settle'], [0, 10, 'live'], [25, 10, 'settle'], [25, 16, 'settle']]) as [number, number, string][]) {
  const t = day * 24 + hour; sim.jumpTo(t);
  for (const [name, c] of PTS) {
    if (mode === 'settle') view.settle(t, c); else { view.update(t + 0.3, [c[0] + 500, c[1]]); for (let i = 0; i < 300; i++) view.update(t + i / 3600 / 30, c); } // live: walked in, 10 s of frames at the default budgets
    const q = view.query(c, R).filter(v => v.agent < 0), st = q.filter(v => !v.moving).length; const wh: Record<string, number> = {}; for (const v of q) { const k = where(v.e, v.n); wh[k] = (wh[k] ?? 0) + 1; }
    const why: Record<string, number> = {}; let homes = 0;
    for (const s of (view as any).list as any[]) { const h = s.home; if (!Number.isFinite(h[0]) || Math.hypot(h[0] - c[0], h[1] - c[1]) > H) continue; homes++;
      const k = s.mode === 0 ? (s.spot ? (s.spot.inside || !s.spot.out ? 'indoors' : 'hidden') : (s.what || 'none').replace(/[0-9.,()-]+/g, '').slice(0, 40)) : s.mode === 2 ? 'walking' : s.full ? 'no room' : s.spot && Math.hypot(s.sepE - c[0], s.sepN - c[1]) > H ? 'out, away' : s.spot?.inside ? 'in a room (drawn)' : 'out, near';
      why[k] = (why[k] ?? 0) + 1; }
    const top = Object.entries(why).sort((a, b) => b[1] - a[1]).slice(0, 7).map(([k, v]) => `${k} ${v}`).join(', ');
    console.log(`d${day} ${hour}h ${mode.padEnd(6)} ${name.padEnd(24)} drawn within ${R} m: ${q.length} (${st} standing; ${Object.entries(wh).map(([k, v]) => `${k} ${v}`).join(', ')}) | homes within ${H} m: ${homes}: ${top} | pending ${view.stats.pending}`);
  }
}
process.exit(0);
