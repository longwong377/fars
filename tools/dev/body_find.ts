// D-292: find a moment for the body and the day, from the renderless view (people_trace's world, as world.ts builds it):
// women far on with child standing out of doors in the town at an hour, and the care pairs drawn then (the delousing on a
// doorstep, the barber in the lane), with a camera pose 4 m off each (moments.spec.ts v: grid e, n, eye height, TRUE
// azimuth, pitch; grid north is 341° true, so true = grid − 19°).
//   npx tsx tools/dev/body_find.ts [--seed 1] [--day 30] [--hour 8.5] [--radius 700]
import { buildTraceWorld } from './people_trace';

const arg = (k: string, v: string) => { const i = process.argv.indexOf(`--${k}`); return i > 0 ? process.argv[i + 1] : v; };
const seed = +arg('seed', '1'), day = +arg('day', '30'), hour = +arg('hour', '8.5'), radius = +arg('radius', '700');
const W = buildTraceWorld(seed, 1, true); W.view.radius = radius;
const centre: [number, number] = [-422, -941], t = day * 24 + hour; W.sim.jumpTo(t); W.view.settle(t, centre);
const P = W.pop, pose = (e: number, n: number, headingDeg: number, dist = 4) => { const h = headingDeg * Math.PI / 180, ce = e + Math.sin(h) * dist, cn = n + Math.cos(h) * dist, g = (Math.atan2(e - ce, n - cn) * 180 / Math.PI + 360) % 360;
  return `[${ce.toFixed(1)}, ${cn.toFixed(1)}, 1.6, ${((g - 19 + 360) % 360).toFixed(1)}, -6]`; };
const rows: string[] = [];
for (const vp of W.view.visible) { if (vp.agent >= 0) continue; const x = P.dueIn(vp.pid, day);
  if (x !== null && x >= 0 && x < 70 && P.expecting(vp.pid, day)) rows.push(`WITH CHILD p${vp.pid} due ${x} d, belly ${P.gravid(vp.pid, day).toFixed(2)}, ${vp.moving ? 'walking' : 'standing'} ${vp.act} "${vp.why}" at (${vp.e.toFixed(1)}, ${vp.n.toFixed(1)}) h ${vp.heading.toFixed(0)}: ${vp.what}; camera ${pose(vp.e, vp.n, vp.heading)}`);
  if (vp.act === 'tend_body') rows.push(`CARE p${vp.pid} "${vp.why}" at (${vp.e.toFixed(1)}, ${vp.n.toFixed(1)}) h ${vp.heading.toFixed(0)}: ${vp.what}; camera ${pose(vp.e, vp.n, vp.heading)}`); }
console.log(`seed ${seed} day ${day} ${hour} h: ${W.view.visible.length} out of doors within ${radius} m; pairs placed ${W.view.pairs.placed}, alone ${W.view.pairs.alone}`);
for (const r of rows) console.log(r);
