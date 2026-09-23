// Polygon booleans for the generators (polygon-clipping, MIT): cutting stair recesses out of platforms, moving a wall
// line (Treasury N wall) and extending an outline (Harem main wing). Rings are open (last point ≠ first) in grid (e, n).
import pc from 'polygon-clipping';
import type { Pt } from './parts';

const close = (r: Pt[]): Pt[] => (r.length && (r[0][0] !== r[r.length - 1][0] || r[0][1] !== r[r.length - 1][1]) ? [...r, r[0]] : r);
const open = (r: Pt[]): Pt[] => (r.length > 1 && r[0][0] === r[r.length - 1][0] && r[0][1] === r[r.length - 1][1] ? r.slice(0, -1) : r);
export interface Poly { outer: Pt[]; holes: Pt[][] }
const out = (m: pc.MultiPolygon): Poly[] => m.map(p => ({ outer: open(p[0] as Pt[]), holes: p.slice(1).map(h => open(h as Pt[])) }));
export const rectPoly = (x: [number, number], y: [number, number]): Pt[] => [[x[0], y[0]], [x[1], y[0]], [x[1], y[1]], [x[0], y[1]]];
export const polyDifference = (a: Pt[], ...cuts: Pt[][]): Poly[] => out(pc.difference([close(a)], ...cuts.map(c => [close(c)])));
export const polyUnion = (...ps: Pt[][]): Poly[] => out(pc.union([close(ps[0])], ...ps.slice(1).map(c => [close(c)])));
export const polyIntersection = (a: Pt[], b: Pt[]): Poly[] => out(pc.intersection([close(a)], [close(b)]));
/** the single outer ring of a boolean result; throws if the operation split the shape or left a hole (generators expect neither) */
export function single(ps: Poly[], what: string): Pt[] {
  if (ps.length !== 1 || ps[0].holes.length) throw new Error(`${what}: expected one simple polygon, got ${ps.length} (holes ${ps.map(p => p.holes.length)})`);
  return ps[0].outer;
}
