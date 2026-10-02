// s17 C7 (D-610): the census of the furnished rooms (tools/dev/interior_census.ts; tests/interiors.test.ts). Per room
// kind: the rooms, the share with fewer than MIN things, the mean things and floor covered, identical rooms among
// neighbours (the same set of things; the same set and layout), things in a doorway's sweep or its approach, and the
// triangles a ring of rooms round the eye costs. Pure data.
import type { RoomIn, Plan, Item } from './plan';
import { FLAT, HUNG, TRIS, roomSignature } from './plan';

/** a censused room: its kind label, centre (grid e, n), the planner's view and its plan */
export interface CRoom { kind: string; e: number; n: number; room: RoomIn; plan: Plan; tris?: number }
/** the fewest things a furnished room of a use holds (below it the room counts as bare) */
export const MIN_THINGS: Record<string, number> = { vestibule: 3, store: 4, kitchen: 6, workroom: 5, living: 8, sleeping: 6 };
const NORM: [number, number][] = [[0, 1], [0, -1], [1, 0], [-1, 0]];
/** things (not flat, not hung) inside a doorway's leaf sweep (door width + 0.2 by half the width + 0.25 into the room) */
export function inDoorway(r: RoomIn, items: Item[]): Item[] {
  const ins = r.inset ?? 0.3, x0 = r.u0 + ins, x1 = r.u1 - ins, y0 = r.v0 + ins, y1 = r.v1 - ins, out: Item[] = [];
  for (const d of r.doors) { const [nu, nv] = NORM[d.side], fu = d.side === 2 ? x0 : d.side === 3 ? x1 : d.at, fv = d.side === 0 ? y0 : d.side === 1 ? y1 : d.at, along = d.w + 0.2, deep = d.w / 2 + 0.25;
    const z = d.side < 2 ? [fu - along / 2, Math.min(fv, fv + nv * deep), fu + along / 2, Math.max(fv, fv + nv * deep)] : [Math.min(fu, fu + nu * deep), fv - along / 2, Math.max(fu, fu + nu * deep), fv + along / 2];
    for (const it of items) { if (FLAT.has(it.k) || HUNG.has(it.k)) continue; const c = Math.abs(Math.cos(it.rot)) > 0.5, hw = (c ? it.w : it.d) / 2 - 0.02, hd = (c ? it.d : it.w) / 2 - 0.02;
      if (it.u + hw > z[0] && it.u - hw < z[2] && it.v + hd > z[1] && it.v - hd < z[3] && !out.includes(it)) out.push(it); } }
  return out;
}
/** can a body (0.25 m round) walk from every doorway to the middle of the room and to every other doorway, between the
 *  things that stand on the floor (flat and hung things aside)? A 0.1 m raster, 4-connected */
export function walkable(r: RoomIn, items: Item[]): boolean {
  const ins = r.inset ?? 0.3, x0 = r.u0 + ins, x1 = r.u1 - ins, y0 = r.v0 + ins, y1 = r.v1 - ins, nx = Math.max(1, Math.round((x1 - x0) / 0.1)), ny = Math.max(1, Math.round((y1 - y0) / 0.1)), occ = new Uint8Array(nx * ny), R = 0.22;
  for (const it of items) { if (FLAT.has(it.k) || HUNG.has(it.k)) continue; const c = Math.abs(Math.cos(it.rot)) > 0.5, hw = (c ? it.w : it.d) / 2 + R, hd = (c ? it.d : it.w) / 2 + R;
    for (let j = Math.max(0, Math.floor((it.v - hd - y0) / 0.1)); j < Math.min(ny, Math.ceil((it.v + hd - y0) / 0.1)); j++) for (let i = Math.max(0, Math.floor((it.u - hw - x0) / 0.1)); i < Math.min(nx, Math.ceil((it.u + hw - x0) / 0.1)); i++) occ[j * nx + i] = 1; }
  // the walls too (a body's half-width off them)
  const m = Math.ceil(R / 0.1) - 1; for (let j = 0; j < ny; j++) for (let i = 0; i < nx; i++) if (i < m || j < m || i >= nx - m || j >= ny - m) occ[j * nx + i] = 1;
  const cellOf = (u: number, v: number) => { const i = Math.min(nx - 1, Math.max(0, Math.floor((u - x0) / 0.1))), j = Math.min(ny - 1, Math.max(0, Math.floor((v - y0) / 0.1))); return j * nx + i; };
  const starts = r.doors.map(d => { const [nu, nv] = NORM[d.side], fu = d.side === 2 ? x0 : d.side === 3 ? x1 : d.at, fv = d.side === 0 ? y0 : d.side === 1 ? y1 : d.at; return cellOf(fu + nu * (R + 0.1), fv + nv * (R + 0.1)); });
  if (!starts.length) return true; const seen = new Uint8Array(nx * ny), q = [starts[0]]; seen[starts[0]] = 1;
  while (q.length) { const k = q.pop()!, i = k % nx, j = (k / nx) | 0; for (const [di, dj] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { const ii = i + di, jj = j + dj; if (ii < 0 || jj < 0 || ii >= nx || jj >= ny) continue; const kk = jj * nx + ii; if (seen[kk] || (occ[kk] && !starts.includes(kk))) continue; seen[kk] = 1; q.push(kk); } }
  // the middle: any free cell within 0.5 m of the room's centre reached
  const cu = (x0 + x1) / 2, cv = (y0 + y1) / 2; let mid = false;
  for (let j = 0; j < ny && !mid; j++) for (let i = 0; i < nx; i++) { const u = x0 + (i + 0.5) * 0.1, v = y0 + (j + 0.5) * 0.1; if (Math.hypot(u - cu, v - cv) < 0.5 && seen[j * nx + i]) { mid = true; break; } }
  return mid && starts.every(k => seen[k]);
}
export interface KindRow { kind: string; rooms: number; stuck: number; bare: number; things: number; covered: number; twinsSet: number; twinsLayout: number; blocked: number; tris: number; maxTris: number; fromPop: number }
/** the census rows (per kind and in all); neighbours: rooms of the same kind within `near` m */
export function census(rooms: CRoom[], near = 15, fromPop: (r: CRoom) => boolean = () => false): KindRow[] {
  const by = new Map<string, CRoom[]>(); for (const r of rooms) (by.get(r.kind) ?? by.set(r.kind, []).get(r.kind)!).push(r);
  const rows: KindRow[] = [];
  const row = (kind: string, rs: CRoom[]): KindRow => {
    let bare = 0, things = 0, cov = 0, blocked = 0, tris = 0, maxTris = 0, pop = 0, stuck = 0;
    const sig = rs.map(r => roomSignature(r.room, r.plan));
    rs.forEach(r => { const n = r.plan.items.length, use = r.room.use; if (n < (MIN_THINGS[use] ?? 4)) bare++; things += n; cov += r.plan.covered; blocked += inDoorway(r.room, r.plan.items).length; if (!walkable(r.room, r.plan.items)) stuck++;
      const t = r.tris ?? r.plan.items.reduce((a, it) => a + TRIS[it.k], 0); tris += t; maxTris = Math.max(maxTris, t); if (fromPop(r)) pop++; });
    // identical neighbours: the same kind within `near` m (a grid of cells for speed)
    let twinsSet = 0, twinsLayout = 0; const cell = new Map<string, number[]>(), key = (e: number, n: number) => `${Math.floor(e / near)},${Math.floor(n / near)}`;
    rs.forEach((r, i) => { const k = key(r.e, r.n); (cell.get(k) ?? cell.set(k, []).get(k)!).push(i); });
    rs.forEach((r, i) => { const ce = Math.floor(r.e / near), cn = Math.floor(r.n / near); let tS = false, tL = false;
      for (let a = -1; a <= 1; a++) for (let b = -1; b <= 1; b++) for (const j of cell.get(`${ce + a},${cn + b}`) ?? []) { if (j === i) continue; const q = rs[j]; if (Math.hypot(q.e - r.e, q.n - r.n) > near) continue;
        if (sig[i].set === sig[j].set) tS = true; if (sig[i].layout === sig[j].layout && sig[i].set === sig[j].set) tL = true; }
      if (tS) twinsSet++; if (tL) twinsLayout++; });
    return { kind, rooms: rs.length, stuck, bare, things: rs.length ? things / rs.length : 0, covered: rs.length ? cov / rs.length : 0, twinsSet, twinsLayout, blocked, tris: rs.length ? tris / rs.length : 0, maxTris, fromPop: pop };
  };
  for (const [k, rs] of [...by].sort((a, b) => (a[0] < b[0] ? -1 : 1))) rows.push(row(k, rs));
  rows.push(row('ALL', rooms));
  return rows;
}
export function formatCensus(rows: KindRow[]): string {
  const h = 'kind'.padEnd(22) + 'rooms'.padStart(7) + ' bare%'.padStart(7) + ' things'.padStart(8) + ' floor%'.padStart(8) + ' twinSet%'.padStart(10) + ' twinLay%'.padStart(10) + ' blocked'.padStart(9) + ' stuck%'.padStart(8) + ' tris'.padStart(7) + ' max'.padStart(6) + ' pop%'.padStart(6);
  return [h, ...rows.map(r => r.kind.padEnd(22) + String(r.rooms).padStart(7) + (100 * r.bare / Math.max(1, r.rooms)).toFixed(1).padStart(7) + r.things.toFixed(1).padStart(8) + (100 * r.covered).toFixed(0).padStart(8)
    + (100 * r.twinsSet / Math.max(1, r.rooms)).toFixed(1).padStart(10) + (100 * r.twinsLayout / Math.max(1, r.rooms)).toFixed(1).padStart(10) + String(r.blocked).padStart(9) + (100 * r.stuck / Math.max(1, r.rooms)).toFixed(1).padStart(8) + r.tris.toFixed(0).padStart(7) + String(r.maxTris).padStart(6) + (100 * r.fromPop / Math.max(1, r.rooms)).toFixed(0).padStart(6))].join('\n');
}
