// D-651 (with C5, C12's pagecheck): the walkers near a view. At a moment: the people whose plan at that hour is a walk (a road
// stretch) and whose home or the walk's destination lies within R of the view, against the population view's walkers within
// 60 m (ViewPerson.moving) and what it does with the others. npx tsx tools/dev/walk_trace.ts [seed]
import { readFileSync } from 'node:fs';
import { buildTraceWorld } from './people_trace';
import { segAt } from '../../src/people/population';
const COV = JSON.parse(readFileSync('tests/data/coverage_points.json', 'utf8')).points as any[]; const cov = (id: string) => COV.find(x => x.id === id);
const W = buildTraceWorld(+(process.argv[2] ?? 1)); const S = W.sim, V = W.view as any, P = S.pop as any, G = W.geo as any;
const views: [string, number, number, number, number][] = [['cov-142', 88, 13.805, cov('cov-142').e, cov('cov-142').n], ['cov-142', 88, 10.5, cov('cov-142').e, cov('cov-142').n], ['cov-142', 88, 17, cov('cov-142').e, cov('cov-142').n], ['qs1', 0, 10, cov('cov-381').e, cov('cov-381').n], ['cov-037', 14, 11.07, cov('cov-037').e, cov('cov-037').n]];
for (const [id, d, h, e, n] of views) { const t = d * 24 + h; S.jumpTo(t); V.settle(t, [e, n]);
  let planWalk = 0, planWalkNear = 0; const sample: string[] = [];
  for (let pid = 0; pid < P.persons.length; pid++) { const H = P.households[P.home(pid, d)]; if (!H || !H.xy || !P.present(pid, d)) continue; if (Math.hypot(H.xy[0] - e, H.xy[1] - n) > 150) continue;
    const s = segAt(P.plan(pid, d), h); if (s.where !== 'road') continue; planWalk++; const segs = P.plan(pid, d), i = segs.indexOf(s), to = segs[i + 1];
    let tp: any = null; try { tp = to ? G.spot(pid, to.place, to.act, d, h) : null; } catch { } if (tp && Math.hypot(tp.e - e, tp.n - n) < 150) planWalkNear++; if (sample.length < 3) sample.push(`${pid} ${s.why} -> ${to?.place}`); }
  const vis = (V.visible as any[]).filter(p => Math.hypot(p.e - e, p.n - n) < 60), open = vis.filter(p => !p.indoor && !(p.wall > 0)), mov = open.filter(p => p.moving).length;
  console.log(`${id} d${d} ${h}h: plans walking now (homes within 150 m) ${planWalk} (to a place within 150 m ${planWalkNear}); view within 60 m ${vis.length}, open ${open.length}, moving ${mov} (${(100 * mov / Math.max(1, open.length)).toFixed(1)} %); e.g. ${sample.join(' | ')}`); }
