// D-753 (holes.md P2-5, Q-630 s18 D-771: C): the Apadana's corner towers hollow, each with a stair to its top, and the roofs
// walkable where the stairs reach them. The towers held stairs to the roof (Schmidt 1953 on the tower stairs, as Q-630 cites;
// roofs were used for work, sleeping and the watch in the region: B); the plan inside the tower, the flights and every size C.
// A tower is its four walls (TS.wall thick, kind 'tower', each carrying the tower's envelope `env` so the frieze, the standards
// and the windows still see one tower), a door from its portico, and a stair that climbs round the inside walls in flights
// with corner landings (solid stepped masses of plastered mud brick, a service stair inside a mud-brick tower) to a hatch in the slab that roofs the tower;
// from the tower's top a short flight leads down onto the hall's roof.
import type { Part, Box, Pt, Material } from './parts';
import { wallRing } from './parts';
import type { Tier } from './spec';

/** sizes (m, C): wall thickness, riser, tread, flight width, the door, the slab, the headroom at the hatch */
export const TS = { wall: 2.4, riser: 0.24, tread: 0.3, width: 1.5, door: { w: 1.2, h: 2.6 }, slab: 0.9, headroom: 2.1, tier: 'C' as Tier, src: 'RECON;SCHMIDT1953' };
export type Side = 'N' | 'S' | 'E' | 'W';
type Meta = { building: string; material: Material; tier: Tier; src: string; note?: string };

/** the hollow tower's parts: walls, door, stair, landings, the slab with its hatch. env = [x0, y0, x1, y1] (grid), the door on
 *  `door` side at its middle */
export function hollowTower(b: string, env: [number, number, number, number], y0: number, y1: number, door: Side): { parts: Box[]; stairTop: Pt; steps: number } {
  const [x0, yA, x1, yB] = env, W = x1 - x0, D = yB - yA, t = TS.wall, cx = (x0 + x1) / 2, cy = (yA + yB) / 2, iw = W - 2 * t, ih = D - 2 * t;
  const meta: Meta = { building: b, material: 'mudbrick', tier: TS.tier, src: TS.src, note: 'corner tower wall, hollow with its stair (D-753, C)' };
  const walls = wallRing(meta, cx, cy, iw, ih, t, y0, y1, [{ side: door, at: 0, width: TS.door.w, height: TS.door.h }])
    .map(w => ({ ...w, kind: 'tower', solid: true, env } as Box));
  // the inner rectangle and the path round it: corners in order, starting at the door's wall middle, going clockwise (grid)
  const ix0 = x0 + t, ix1 = x1 - t, iy0 = yA + t, iy1 = yB - t, w = TS.width;
  // the lane's centre line, w/2 off the walls; corners of the lane (clockwise from the NE: N wall runs W->E... we walk E, S, W, N)
  const L: Record<Side, [Pt, Pt]> = { // each wall's lane from one corner to the next, clockwise (NE -> SE -> SW -> NW -> NE)
    E: [[ix1 - w / 2, iy1 - w / 2], [ix1 - w / 2, iy0 + w / 2]], S: [[ix1 - w / 2, iy0 + w / 2], [ix0 + w / 2, iy0 + w / 2]],
    W: [[ix0 + w / 2, iy0 + w / 2], [ix0 + w / 2, iy1 - w / 2]], N: [[ix0 + w / 2, iy1 - w / 2], [ix1 - w / 2, iy1 - w / 2]],
  };
  const order: Side[] = ['E', 'S', 'W', 'N'], start = order.indexOf(door);
  const parts: Box[] = [...walls], rise = y1 - y0, nTotal = Math.round(rise / TS.riser), riser = rise / nTotal;
  let n = 0, z = y0; let last: { a: Pt; u: Pt; from: number; steps: number; z0: number } | null = null;
  const step = (c: Pt, along: Pt, len: number, top: number, kind: string) =>
    parts.push({ building: b, kind, material: 'mudbrick', tier: TS.tier, src: TS.src, type: 'box', c, size: along[0] ? [len, w] : [w, len], y0, y1: top, solid: true, note: 'tower stair: mud brick, plastered (D-753, C)' } as Box);
  // the first lane starts at the door's middle, past the door's half-width (the threshold stays clear)
  for (let k = 0; k < 8 && n < nTotal; k++) {
    const s = order[(start + k) % 4], [A, B] = L[s], len = Math.hypot(B[0] - A[0], B[1] - A[1]), u: Pt = [(B[0] - A[0]) / len, (B[1] - A[1]) / len];
    const a0 = k === 0 ? len / 2 + TS.door.w / 2 + 0.3 : w / 2, a1 = len - w / 2; // after a corner landing
    const m = Math.min(nTotal - n, Math.floor((a1 - a0) / TS.tread)); if (m <= 0) continue;
    for (let i = 0; i < m; i++) { const a = a0 + (i + 0.5) * TS.tread; z += riser; n++; step([A[0] + u[0] * a, A[1] + u[1] * a], u, TS.tread, z, 'step'); }
    last = { a: A, u, from: a0, steps: m, z0: z - m * riser };
    if (n < nTotal) step([B[0], B[1]], [1, 0], w, z, 'landing'); // the corner landing (w x w)
  }
  // the slab over the inside, with the hatch over the stair's head (where the headroom under the slab falls under TS.headroom)
  const yS = y1 - TS.slab, slab: Box[] = [];
  const hatchSteps = last ? Math.min(last.steps, Math.ceil((TS.slab + TS.headroom) / riser)) : 0;
  let hx0 = 0, hx1 = 0, hy0 = 0, hy1 = 0;
  if (last) { const aA = last.from + (last.steps - hatchSteps) * TS.tread, aB = last.from + last.steps * TS.tread + 0.3;
    const p0: Pt = [last.a[0] + last.u[0] * aA, last.a[1] + last.u[1] * aA], p1: Pt = [last.a[0] + last.u[0] * aB, last.a[1] + last.u[1] * aB];
    hx0 = Math.min(p0[0], p1[0]) - (last.u[0] ? 0 : w / 2); hx1 = Math.max(p0[0], p1[0]) + (last.u[0] ? 0 : w / 2);
    hy0 = Math.min(p0[1], p1[1]) - (last.u[1] ? 0 : w / 2); hy1 = Math.max(p0[1], p1[1]) + (last.u[1] ? 0 : w / 2);
    hx0 = Math.max(ix0, hx0); hx1 = Math.min(ix1, hx1); hy0 = Math.max(iy0, hy0); hy1 = Math.min(iy1, hy1); }
  // the slab as up to four boxes round the hatch (the hatch's rows above and below it across the inside, its sides between)
  const sb = (ax: number, bx: number, ay: number, by: number) => { if (bx - ax > 0.05 && by - ay > 0.05) slab.push({ building: b, kind: 'tower_slab', material: 'mudbrick', tier: TS.tier, src: TS.src, type: 'box', c: [(ax + bx) / 2, (ay + by) / 2], size: [bx - ax, by - ay], y0: yS, y1, solid: true, env, note: 'the tower\'s roof slab round the stair hatch (D-753, C)' } as Box); };
  if (last) { sb(ix0, ix1, hy1, iy1); sb(ix0, ix1, iy0, hy0); sb(ix0, hx0, hy0, hy1); sb(hx1, ix1, hy0, hy1); } else sb(ix0, ix1, iy0, iy1);
  parts.push(...slab);
  const top: Pt = last ? [last.a[0] + last.u[0] * (last.from + last.steps * TS.tread), last.a[1] + last.u[1] * (last.from + last.steps * TS.tread)] : [cx, cy];
  return { parts, stairTop: top, steps: n };
}

/** a short flight on a roof (its top at `roofTop`) up to the tower's top (`towerTop`), against the tower's face on `side`, at
 *  `at` along that face (grid), rising toward the tower */
export function roofFlight(b: string, env: [number, number, number, number], side: Side, at: number, roofTop: number, towerTop: number): Box[] {
  const [x0, yA, x1, yB] = env, n = Math.max(1, Math.round((towerTop - roofTop) / TS.riser)), r = (towerTop - roofTop) / n, out: Box[] = [];
  const d: Pt = { N: [0, -1], S: [0, 1], E: [-1, 0], W: [1, 0] }[side] as Pt; // the rising direction (toward the tower)
  const face = { N: yB, S: yA, E: x1, W: x0 }[side];
  for (let i = 0; i < n; i++) {
    const off = (n - i - 0.5) * TS.tread; // the top step against the face
    const c: Pt = side === 'N' || side === 'S' ? [at, face - d[1] * off] : [face - d[0] * off, at];
    out.push({ building: b, kind: 'step', material: 'mudbrick', tier: TS.tier, src: TS.src, type: 'box', c, size: side === 'N' || side === 'S' ? [TS.width, TS.tread] : [TS.tread, TS.width], y0: roofTop, y1: roofTop + (i + 1) * r, solid: true, note: 'flight from the hall roof to the tower top (D-753, C)' } as Box);
  }
  return out;
}
export type { Part };
