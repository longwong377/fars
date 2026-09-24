// D-199: where the court setting's camps stand, checked against the built world (node; tests/court_fill.test.ts and
// tools/dev/court_camps_check.ts): no tent on a town plot, a tree, a prop or a midden, a road, a town water piece, a plain canal or river, or in a
// village; no tent over another; how steep the ground is under each tent; what the plain grows under the plain camps.
import type { Tent } from './camps';
import type { TownPlan } from '../world/settlement/plan';
import { TownWalk } from '../world/settlement/walk';
import { OUT } from '../world/settlement/site';
import { distToPolyline } from '../world/plain/data';

export interface CampWorld {
  town: TownPlan; villages: { x: number; y: number; r: number }[]; canals: [number, number][][]; rivers: { x: Float64Array; y: Float64Array; half: number }[];
  asl: (e: number, n: number) => number;
  /** what grows at a grid point ('natural' = fallow, steppe or the town's used ground) */
  landUse?: (e: number, n: number) => string;
}
export interface CampReport { tents: number; onPlot: number; onTree: number; onProp: number; onRoad: number; onTownWater: number; onCanal: number; onRiver: number; inVillage: number; overlaps: number; maxSlope: number; meanSlope: number; landUse: Record<string, number>; examples: string[] }
/** the corners and centre of a tent's footprint (grid) */
const pts = (t: Tent): [number, number][] => { const a = (t.heading * Math.PI) / 180, fe = Math.sin(a), fn = Math.cos(a), hw = t.w / 2, hd = t.d / 2;
  return [[0, 0], [-hw, -hd], [hw, -hd], [hw, hd], [-hw, hd]].map(([u, v]) => [t.e + u * fn + v * fe, t.n - u * fe + v * fn]); };
export function checkCamps(tents: Tent[], W: CampWorld): Record<string, CampReport> {
  const walk = TownWalk.fromPlan(W.town, []); const out: Record<string, CampReport> = {};
  const water = W.town.water.filter(w => w.kind === 'canal' || w.kind === 'channel' || w.kind === 'ditch');
  for (const t of tents) {
    const R = (out[t.camp] ??= { tents: 0, onPlot: 0, onTree: 0, onProp: 0, onRoad: 0, onTownWater: 0, onCanal: 0, onRiver: 0, inVillage: 0, overlaps: 0, maxSlope: 0, meanSlope: 0, landUse: {}, examples: [] });
    R.tents++; const P = pts(t), rad = Math.hypot(t.w, t.d) / 2; const ex = (k: string) => { if (R.examples.length < 8) R.examples.push(`${t.camp}#${t.i} ${k} at [${t.e.toFixed(0)}, ${t.n.toFixed(0)}]`); };
    if (P.some(([e, n]) => { const l = walk.locate(e, n); if (!l) return false; const s = walk.boxes[l.si].s; return s.cell[l.k] !== OUT; })) { R.onPlot++; ex('on a town plot, lane or square'); }
    if (W.town.trees.some(tr => Math.hypot(tr.c[0] - t.e, tr.c[1] - t.n) < rad + 2)) { R.onTree++; ex('on a tree'); }
    if (W.town.props.some(q => Math.hypot(q.c[0] - t.e, q.c[1] - t.n) < rad + Math.max(q.hu, q.hv) + 1)) { R.onProp++; ex('on a built thing'); }
    if (W.town.middens.some(m => Math.hypot(m.c[0] - t.e, m.c[1] - t.n) < rad + m.r)) { R.onProp++; ex('on a midden'); }
    if (W.town.roads.some(r => distToPolyline(t.e, t.n, r.pts) < r.width / 2 + rad)) { R.onRoad++; ex('on a road'); }
    if (water.some(w => w.pts.length > 1 && distToPolyline(t.e, t.n, w.pts) < w.width / 2 + rad + 1)) { R.onTownWater++; ex('on the town’s water'); }
    if (W.canals.some(c => distToPolyline(t.e, t.n, c) < 6 + rad)) { R.onCanal++; ex('on a canal'); }
    if (W.rivers.some(r => { const line: [number, number][] = []; for (let i = 0; i < r.x.length; i += 2) line.push([r.x[i], r.y[i]]); return distToPolyline(t.e, t.n, line) < r.half + rad; })) { R.onRiver++; ex('on a river'); }
    if (W.villages.some(v => Math.hypot(v.x - t.e, v.y - t.n) < v.r + 30 + rad)) { R.inVillage++; ex('in a village'); }
    const h = P.map(([e, n]) => W.asl(e, n)), slope = (Math.max(...h) - Math.min(...h)) / Math.max(t.w, t.d); R.maxSlope = Math.max(R.maxSlope, slope); R.meanSlope += slope;
    if (W.landUse) { const u = W.landUse(t.e, t.n); R.landUse[u] = (R.landUse[u] ?? 0) + 1; }
  }
  // overlaps: footprints (as discs of the half-diagonal less 0.3 m) of two tents of one camp
  const byCamp = new Map<string, Tent[]>(); for (const t of tents) (byCamp.get(t.camp) ?? byCamp.set(t.camp, []).get(t.camp)!).push(t);
  for (const [id, list] of byCamp) { const R = out[id]; R.meanSlope /= Math.max(1, R.tents);
    for (let i = 0; i < list.length; i++) for (let j = i + 1; j < list.length; j++) { const a = list[i], b = list[j];
      // separating-axis test of the two rectangles (both headings are within ±4° of the camp's axis: a slightly shrunk box)
      const dx = b.e - a.e, dn = b.n - a.n, h = (a.heading * Math.PI) / 180, fe = Math.sin(h), fn = Math.cos(h), u = dx * fn - dn * fe, v = dx * fe + dn * fn;
      if (Math.abs(u) < (a.w + b.w) / 2 - 0.3 && Math.abs(v) < (a.d + b.d) / 2 - 0.3) { R.overlaps++; if (R.examples.length < 8) R.examples.push(`${id}#${a.i} overlaps #${b.i}`); } } }
  return out;
}
