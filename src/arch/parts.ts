// Architectural parts: pure data emitted by generators. Rendering (meshes.ts), physics colliders and the dimension /
// plan-overlay tests all consume the same parts, so what is tested is what is built.
import type { Tier } from './spec';
export type Pt = [number, number]; // grid (east, north)
export type Material = 'limestone' | 'limestone_dark' | 'mudbrick' | 'plaster' | 'plaster_red' | 'timber' | 'glazed' | 'earth' | 'scaffold' | 'rubble' | 'bronze' | 'court_fill' | 'terrace';
export interface Base { building: string; kind: string; material: Material; tier: Tier; src: string; note?: string; placeholder?: boolean; solid?: boolean }
/** vertical prism: polygon extruded from y0 to y1 (heights relative to the court datum) */
export interface Prism extends Base { type: 'prism'; polygon: Pt[]; y0: number; y1: number }
/** oriented box, grid-aligned (rot = rotation about vertical, radians, counter-clockwise in grid) */
export interface Box extends Base { type: 'box'; c: Pt; size: [number, number]; y0: number; y1: number; rot?: number; sculpt?: Sculpt }
/** a box that is RENDERED as sculpture (the box stays the collider and plan footprint): doorway colossus model, the grid
 *  x direction its head faces (±1) and the grid y side (±1) its relief faces (the doorway passage) */
export interface Sculpt { model: 'bull' | 'lamassu'; facing: 1 | -1; passage: 1 | -1 }
/** column: parametric profile, instanced when rendered */
export interface Column extends Base { type: 'column'; c: Pt; y0: number; order: ColumnOrder; built: number /*0..1 fraction of shaft raised (construction)*/ }
export interface ColumnOrder {
  id: string; height: number; base: 'square2' | 'bell' | 'plain'; baseH: number; baseW: number; shaftD: number; flutes: number;
  capital: 'bull' | 'composite' | 'plain' | 'none'; capitalH: number; material: Material;
}
export type Part = Prism | Box | Column;
export interface Manifest { [building: string]: Record<string, number | number[] | string> }
export interface BuildResult { parts: Part[]; manifest: Manifest }

export const rect = (cx: number, cy: number, w: number, h: number): Pt[] => [[cx - w / 2, cy - h / 2], [cx + w / 2, cy - h / 2], [cx + w / 2, cy + h / 2], [cx - w / 2, cy + h / 2]];
export function polyArea(p: Pt[]) { let a = 0; for (let i = 0; i < p.length; i++) { const [x1, y1] = p[i], [x2, y2] = p[(i + 1) % p.length]; a += x1 * y2 - x2 * y1; } return Math.abs(a) / 2; }
export function polyBounds(p: Pt[]) { let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity; for (const [x, y] of p) { x0 = Math.min(x0, x); y0 = Math.min(y0, y); x1 = Math.max(x1, x); y1 = Math.max(y1, y); } return [x0, y0, x1, y1] as const; }
export function pointInPoly(x: number, y: number, p: Pt[]) { let ins = false; for (let i = 0, j = p.length - 1; i < p.length; j = i++) { const [xi, yi] = p[i], [xj, yj] = p[j]; if ((yi > y) !== (yj > y) && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) ins = !ins; } return ins; }
/** wall ring around a rectangle's interior (w×h at centre) with thickness t, as 4 boxes; `doors` cut gaps: side + offset along side + width */
export function wallRing(b: Omit<Base, 'kind'>, cx: number, cy: number, w: number, h: number, t: number, y0: number, y1: number,
  doors: { side: 'N' | 'S' | 'E' | 'W'; at: number; width: number; height: number }[] = [], tx = t, ty = t): Box[] {
  const out: Box[] = [];
  const sides: Record<string, { c: Pt; len: number; horiz: boolean }> = {
    N: { c: [cx, cy + h / 2 + ty / 2], len: w + 2 * tx, horiz: true }, S: { c: [cx, cy - h / 2 - ty / 2], len: w + 2 * tx, horiz: true },
    E: { c: [cx + w / 2 + tx / 2, cy], len: h, horiz: false }, W: { c: [cx - w / 2 - tx / 2, cy], len: h, horiz: false },
  };
  for (const [s, d] of Object.entries(sides)) {
    const th = d.horiz ? ty : tx;
    const gaps = doors.filter(o => o.side === s).map(o => ({ a: o.at - o.width / 2, b: o.at + o.width / 2, h: o.height })).sort((p, q) => p.a - q.a);
    let cur = -d.len / 2;
    const seg = (a: number, bb: number, ya: number, yb: number) => {
      if (bb - a < 0.01) return;
      const mid = (a + bb) / 2;
      const c: Pt = d.horiz ? [d.c[0] + mid, d.c[1]] : [d.c[0], d.c[1] + mid];
      out.push({ ...b, type: 'box', kind: 'wall', c, size: d.horiz ? [bb - a, th] : [th, bb - a], y0: ya, y1: yb });
    };
    for (const g of gaps) { seg(cur, g.a, y0, y1); if (Number.isFinite(g.h) && y0 + g.h < y1 - 0.01) seg(g.a, g.b, y0 + g.h, y1); cur = g.b; } // lintel zone above the door (none if the opening reaches the wall top)
    seg(cur, d.len / 2, y0, y1);
  }
  return out;
}
export function grid(nx: number, ny: number, cx: number, cy: number, sx: number, sy = sx): Pt[] {
  const out: Pt[] = []; for (let j = 0; j < ny; j++) for (let i = 0; i < nx; i++) out.push([cx + (i - (nx - 1) / 2) * sx, cy + (j - (ny - 1) / 2) * sy]); return out;
}
/** stone door frames for the doorways of a wall ring (same side geometry as wallRing): two jambs lining the opening, a
 *  lintel and a projecting cornice block. `height` is the clear door height (for an opening that runs to the top of an
 *  unfinished wall, pass the frame height). The wall gap should reach `frameTop(h, F)` so the brick resumes above it. */
export interface FrameDims { jamb: number; projection: number; lintel: number; cornice_height: number; cornice_projection: number }
export const frameTop = (h: number, F: FrameDims) => h + F.lintel + F.cornice_height;
export function doorFrames(b: Omit<Base, 'kind'>, cx: number, cy: number, w: number, h: number, t: number, y0: number,
  doors: { side: 'N' | 'S' | 'E' | 'W'; at: number; width: number; height: number }[], F: FrameDims, tx = t, ty = t): Box[] {
  const out: Box[] = [];
  for (const d of doors) {
    const horiz = d.side === 'N' || d.side === 'S', th = horiz ? ty : tx;
    const wc: Pt = { N: [cx, cy + h / 2 + ty / 2], S: [cx, cy - h / 2 - ty / 2], E: [cx + w / 2 + tx / 2, cy], W: [cx - w / 2 - tx / 2, cy] }[d.side] as Pt;
    const at = (along: number): Pt => horiz ? [wc[0] + along, wc[1]] : [wc[0], wc[1] + along];
    const sz = (along: number, across: number): [number, number] => horiz ? [along, across] : [across, along];
    const deep = th + 2 * F.projection;
    for (const s of [-1, 1]) out.push({ ...b, type: 'box', kind: 'door_frame', c: at(d.at + s * (d.width / 2 + F.jamb / 2)), size: sz(F.jamb, deep), y0, y1: y0 + d.height, solid: true });
    out.push({ ...b, type: 'box', kind: 'door_frame', c: at(d.at), size: sz(d.width + 2 * F.jamb, deep), y0: y0 + d.height, y1: y0 + d.height + F.lintel, solid: true });
    out.push({ ...b, type: 'box', kind: 'door_frame', c: at(d.at), size: sz(d.width + 2 * (F.jamb + F.cornice_projection), deep + 2 * F.cornice_projection), y0: y0 + d.height + F.lintel, y1: frameTop(y0 + d.height, F), solid: true });
  }
  return out;
}

type AABB = [number, number, number, number, number, number]; // e0 e1 n0 n1 y0 y1
const aabb = (b: Box): AABB => [b.c[0] - b.size[0] / 2, b.c[0] + b.size[0] / 2, b.c[1] - b.size[1] / 2, b.c[1] + b.size[1] / 2, b.y0, b.y1];
function subtractAabb(a: AABB, c: AABB): AABB[] {
  if (a[0] >= c[1] || a[1] <= c[0] || a[2] >= c[3] || a[3] <= c[2] || a[4] >= c[5] || a[5] <= c[4]) return [a];
  const out: AABB[] = [], r = [...a] as AABB;
  for (let ax = 0; ax < 3; ax++) {
    const lo = ax * 2, hi = lo + 1;
    if (r[lo] < c[lo]) { const q = [...r] as AABB; q[hi] = c[lo]; out.push(q); r[lo] = c[lo]; }
    if (r[hi] > c[hi]) { const q = [...r] as AABB; q[lo] = c[hi]; out.push(q); r[hi] = c[hi]; }
  }
  return out;
}
/** slivers thinner than this (m) are dropped: floating-point residue where a cutter face coincides with a wall face */
const SLIVER = 1e-4;
/** A grid-aligned wall box minus the volumes of grid-aligned cutters (the Gate's colossus jambs and their plinths): the wall
 *  pieces that remain, so walls, colossi and plinths never overlap in the parts, the colliders or the render (D-032).
 *  Returns null when nothing intersects (or the wall is rotated). */
export function cutWall(w: Box, cutters: Box[]): Box[] | null {
  if ((w.rot ?? 0) !== 0) return null;
  let pieces: AABB[] = [aabb(w)], hit = false;
  for (const c of cutters) { const next: AABB[] = []; for (const q of pieces) { const s = subtractAabb(q, aabb(c)); if (s.length !== 1 || s[0] !== q) hit = true; next.push(...s); } pieces = next; }
  if (!hit) return null;
  return pieces.filter(q => q[1] - q[0] > SLIVER && q[3] - q[2] > SLIVER && q[5] - q[4] > SLIVER)
    .map(q => ({ ...w, c: [(q[0] + q[1]) / 2, (q[2] + q[3]) / 2] as Pt, size: [q[1] - q[0], q[3] - q[2]] as [number, number], y0: q[4], y1: q[5] }));
}
