// The area registry's geometry and lookup (MASTER_PLAN §4.3, D-277): the shapes of data/areas.json, point-in-area, the
// primary area of a point, polygon areas, and the few shape builders the registry needs (rectangles, rotated rectangles,
// circles, polyline buffers, grid splits). Pure: no world is built here, so the test, Tier 0, the samplers and the board
// can all read the registry cheaply. Coordinates are the Persepolis grid (e = grid east, n = grid north, metres, D-002).
import pc from 'polygon-clipping';
import { readFileSync } from 'node:fs';

export type P2 = [number, number];
/** polygon-clipping's MultiPolygon: polygons, each an outer ring then holes */
export type MultiPoly = P2[][][];

/** T-A6x: no unique area over 1 km², 0.25 ha for interiors (gates/thresholds.json) */
export const AREA_LIMIT_M2 = 1e6, INTERIOR_LIMIT_M2 = 2500;

export type AreaKind = 'terrace-interior' | 'terrace-open' | 'terrace-court' | 'town-site' | 'garden-zone' | 'town-zone' | 'named-site' | 'camp' | 'village' |
  'river-reach' | 'approach' | 'near-ground' | 'transect' | 'plain-sector' | 'far-land';
export interface Area {
  id: string; kind: AreaKind; name: string;
  /** 'unique' areas are judged each on its own; 'member' areas are judged with their class */
  role: 'unique' | 'member';
  /** the class a member belongs to */
  cls?: string;
  /** an interior (T-A6x 0.25 ha): roofed ground */
  interior: boolean;
  /** an overlay area (the transect) takes no part in the primary assignment: a point in it keeps its primary area too */
  overlay?: boolean;
  /** lower = wins when areas overlap (the primary area of a point) */
  priority: number;
  /** the data the area was read from (file or builder, and the record id) */
  src: string;
  shape: MultiPoly;
  bbox: [number, number, number, number];
  /** polygon area of the shape (m²) */
  polyM2: number;
  /** the walkable envelope inside the area, counted where the area is the point's primary area (m²; overlay: all of it) */
  envM2?: number;
  /** share of that walkable ground under a roof (the envelope's up-ray) */
  roofedShare?: number;
  /** named records inside the area (features, sites, parts) */
  contains?: string[];
}
export interface AreaClass { id: string; kind: AreaKind; rule: string; members: string[] }
export interface Registry { meta: any; areas: Area[]; classes: AreaClass[] }

const r2 = (x: number) => Math.round(x * 100) / 100 || 0;
export const roundPoly = (m: MultiPoly): MultiPoly => m.map(p => p.map(r => r.map(([x, y]) => [r2(x), r2(y)] as P2)));

// --- polygon measures ------------------------------------------------------------------------------------------------
export function ringArea(r: P2[]) { let a = 0; for (let i = 0, j = r.length - 1; i < r.length; j = i++) a += (r[j][0] + r[i][0]) * (r[j][1] - r[i][1]); return Math.abs(a / 2); }
export function polyArea(m: MultiPoly) { let a = 0; for (const p of m) { a += ringArea(p[0]); for (let k = 1; k < p.length; k++) a -= ringArea(p[k]); } return a; }
export function bboxOf(m: MultiPoly): [number, number, number, number] {
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  for (const p of m) for (const [x, y] of p[0]) { if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; }
  return [r2(x0), r2(y0), r2(x1), r2(y1)];
}
function inRing(x: number, y: number, r: P2[]) {
  let c = false; for (let i = 0, j = r.length - 1; i < r.length; j = i++) { const [xi, yi] = r[i], [xj, yj] = r[j];
    if ((yi > y) !== (yj > y) && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) c = !c; }
  return c;
}
export function inMulti(x: number, y: number, m: MultiPoly) {
  for (const p of m) { if (!inRing(x, y, p[0])) continue; let hole = false; for (let k = 1; k < p.length; k++) if (inRing(x, y, p[k])) { hole = true; break; } if (!hole) return true; }
  return false;
}

// --- shape builders ----------------------------------------------------------------------------------------------------
export const rect = (x0: number, y0: number, x1: number, y1: number): MultiPoly => [[[[x0, y0], [x1, y0], [x1, y1], [x0, y1], [x0, y0]]]];
/** a rectangle centred at c, half sizes (hu, hv) along its own axes, turned by theta (radians, CCW from grid east) */
export function orect(c: P2, hu: number, hv: number, theta: number): MultiPoly {
  const cs = Math.cos(theta), sn = Math.sin(theta), at = (u: number, v: number): P2 => [c[0] + u * cs - v * sn, c[1] + u * sn + v * cs];
  const r = [at(-hu, -hv), at(hu, -hv), at(hu, hv), at(-hu, hv)]; return [[[...r, r[0]]]];
}
export function circle(c: P2, r: number, n = 32): MultiPoly { const ring: P2[] = []; for (let i = 0; i < n; i++) { const a = (2 * Math.PI * i) / n; ring.push([c[0] + r * Math.cos(a), c[1] + r * Math.sin(a)]); } ring.push(ring[0]); return [[ring]]; }
export const polyOf = (ring: P2[]): MultiPoly => { const r = ring.map(p => [p[0], p[1]] as P2); if (r[0][0] !== r[r.length - 1][0] || r[0][1] !== r[r.length - 1][1]) r.push(r[0]); return [[r]]; };
export const union = (...m: MultiPoly[]): MultiPoly => { const a = m.filter(x => x.length); return a.length ? pc.union(a[0] as any, ...(a.slice(1) as any)) as MultiPoly : []; };
export const diff = (a: MultiPoly, ...b: MultiPoly[]): MultiPoly => { const bb = b.filter(x => x.length); return a.length && bb.length ? pc.difference(a as any, ...(bb as any)) as MultiPoly : a; };
export const inter = (a: MultiPoly, b: MultiPoly): MultiPoly => a.length && b.length ? pc.intersection(a as any, b as any) as MultiPoly : [];
/** a buffer of half-width w round a polyline: a quad per segment and a square at each joint, unioned */
export function buffer(pts: P2[], w: number): MultiPoly {
  const parts: MultiPoly[] = [];
  for (let i = 0; i + 1 < pts.length; i++) { const [a, b] = [pts[i], pts[i + 1]], L = Math.hypot(b[0] - a[0], b[1] - a[1]); if (L < 1e-6) continue;
    parts.push(orect([(a[0] + b[0]) / 2, (a[1] + b[1]) / 2], L / 2, w, Math.atan2(b[1] - a[1], b[0] - a[0]))); }
  for (const p of pts) parts.push(circle(p, w, 12));
  return union(...parts);
}
/** split a shape into grid tiles of side s (aligned to the grid's origin); pieces smaller than minM2 join a neighbour's
 *  tile only by staying separate (they are kept: nothing is dropped) */
export function splitGrid(m: MultiPoly, s: number): MultiPoly[] {
  const [x0, y0, x1, y1] = bboxOf(m), out: MultiPoly[] = [];
  for (let i = Math.floor(x0 / s); i * s < x1; i++) for (let j = Math.floor(y0 / s); j * s < y1; j++) {
    const piece = inter(m, rect(i * s, j * s, (i + 1) * s, (j + 1) * s)); if (piece.length && polyArea(piece) > 0.01) out.push(piece); }
  return out;
}
/** Douglas-Peucker simplification of a polyline (tolerance tol m) */
export function simplify(pts: P2[], tol: number): P2[] {
  if (pts.length < 3) return pts.slice(); const keep = new Uint8Array(pts.length); keep[0] = keep[pts.length - 1] = 1; const st: [number, number][] = [[0, pts.length - 1]];
  while (st.length) { const [a, b] = st.pop()!; const [ax, ay] = pts[a], [bx, by] = pts[b], L = Math.hypot(bx - ax, by - ay) || 1e-9; let md = -1, mi = -1;
    for (let i = a + 1; i < b; i++) { const d = Math.abs((bx - ax) * (ay - pts[i][1]) - (ax - pts[i][0]) * (by - ay)) / L; if (d > md) { md = d; mi = i; } }
    if (md > tol) { keep[mi] = 1; st.push([a, mi], [mi, b]); } }
  return pts.filter((_, i) => keep[i]);
}

// --- lookup ---------------------------------------------------------------------------------------------------------------
const BUCKET = 256;
/** point → areas, with a bucket index on the areas' boxes (members of the plain and far classes are grid tiles: found
 *  arithmetically, not through the index) */
export class AreaIndex {
  readonly byId = new Map<string, Area>();
  private buckets = new Map<number, Area[]>();
  private big: Area[] = [];
  /** class members are square grid tiles: found by arithmetic (tile size → key → area) */
  private tiles = new Map<number, Map<string, Area>>();
  constructor(readonly reg: Registry) {
    const sorted = [...reg.areas].sort((a, b) => a.priority - b.priority || (a.id < b.id ? -1 : 1));
    for (const a of sorted) { this.byId.set(a.id, a);
      const [x0, y0, x1, y1] = a.bbox;
      if (a.role === 'member' && Math.abs((x1 - x0) - (y1 - y0)) < 1e-6 && a.shape.length === 1 && a.shape[0].length === 1 && a.shape[0][0].length === 5 && Math.abs(x0 / (x1 - x0) - Math.round(x0 / (x1 - x0))) < 1e-9 && Math.abs(y0 / (x1 - x0) - Math.round(y0 / (x1 - x0))) < 1e-9) {
        const s = x1 - x0; let m = this.tiles.get(s); if (!m) this.tiles.set(s, m = new Map()); m.set(`${Math.round(x0 / s)},${Math.round(y0 / s)}`, a); continue; }
      if ((x1 - x0) * (y1 - y0) > 400 * BUCKET * BUCKET) { this.big.push(a); continue; }
      for (let i = Math.floor(x0 / BUCKET); i <= Math.floor(x1 / BUCKET); i++) for (let j = Math.floor(y0 / BUCKET); j <= Math.floor(y1 / BUCKET); j++) {
        const k = (i + 32768) * 65536 + (j + 32768); let l = this.buckets.get(k); if (!l) this.buckets.set(k, l = []); l.push(a); } }
  }
  static load(file = 'data/areas.json') { return new AreaIndex(JSON.parse(readFileSync(file, 'utf8'))); }
  /** every area containing (e, n), primary first (by priority), overlays included */
  all(e: number, n: number): Area[] {
    const k = (Math.floor(e / BUCKET) + 32768) * 65536 + (Math.floor(n / BUCKET) + 32768), out: Area[] = [];
    for (const a of [...(this.buckets.get(k) ?? []), ...this.big]) { const b = a.bbox; if (e < b[0] || e > b[2] || n < b[1] || n > b[3]) continue; if (inMulti(e, n, a.shape)) out.push(a); }
    for (const [s, m] of this.tiles) { const a = m.get(`${Math.floor(e / s)},${Math.floor(n / s)}`); if (a) out.push(a); }
    return out.sort((a, b) => a.priority - b.priority || (a.id < b.id ? -1 : 1));
  }
  /** the point's primary area (the first non-overlay area by priority), or null outside the registry */
  primary(e: number, n: number): Area | null { for (const a of this.all(e, n)) if (!a.overlay) return a; return null; }
}
