// The town's walkable network, derived read-only from the built plan (D-143; Phase 5 people on the Phase 6 town).
// Nothing here changes the layout: it reads the same 1 m site rasters, walls and doors that build.ts turns into meshes
// and colliders, so a walked route and the drawn walls agree by construction.
//  - cell moves: open ground, lanes and squares join freely; a plot (house, workshop, compound) is entered only through
//    a door in Site.doors (street doors and the rooms' doors onto the court); inside a plot walls stand between rooms,
//    between a room and the court and between court and yard (Site.edgeWall's rules), so nobody passes through a wall;
//  - site routes: A* over a site's cells (8-connected, no corner cutting), string-pulled on the same move rules;
//  - the lane graph between sites: every lane mouth (plan.ts siteExits) and compound gate, joined over open ground by
//    straight runs that cross no plot of any site (a coarse visibility graph of the garden-city's open ground, D-041).
// Frames: grid (e, n) metres (D-002); a site's cells are its local raster (site.ts).
import { Site, OUT, LANE, SQUARE, ROOM, COURT, YARD, toLocal, type P2 } from './site';
import { siteExits, type TownPlan } from './plan';
import { siteFootprints, wallBox, boxDist } from './footprints';

/** open ground a person may stand on without entering a plot */
export const openCode = (c: number) => c === LANE || c === SQUARE || c === OUT;

/** a 4-neighbour move between two cells of one site, as built (walls and doors exactly as site.ts draws them) */
export function passable(s: Site, k1: number, k2: number): boolean {
  const c1 = s.cell[k1], c2 = s.cell[k2];
  if (c1 < 0 && c2 < 0) return openCode(c1) && openCode(c2);
  const e = s.edgeBetween(k1, k2);
  if (s.noWall.has(e)) return false; // closed by another structure (the Tol-e Ajori gate body)
  if (s.doors.has(e)) return true;
  if (c1 !== c2) return false; // a plot's outer wall
  const s1 = s.sub[k1], s2 = s.sub[k2];
  if (s1 === s2) return s1 !== ROOM || s.room[k1] === s.room[k2]; // partitions between rooms
  return false; // facade (room | court) or yard wall (court | yard)
}
/** a cell a person can be in: open ground, or a court, yard or room of a plot */
export const walkableCell = (s: Site, k: number) => { const c = s.cell[k]; return c >= 0 || openCode(c); };

// ---- clearance (D-249; Q-641) ------------------------------------------------------------------------------------------
// A route keeps a body's clearance from what is solid where it walks: the walls as built (Site.walls(): 0.4-0.7 m thick,
// centred on the raster edges), the fixtures' and fittings' colliders (footprints.ts: benches, mangers, portico posts,
// ovens, kilns, troughs, wells, columns) and the plan's solid props standing in a site (TownWalk.fromPlan). Measured as the
// distance to the nearest solid's face, not to a raster edge.
/** a walked line keeps this far from the face of any wall or solid fitting (a body's half width at the shoulders, 0.25 m,
 *  and a margin), except within 0.35 m of its ends (a spot by a wall) */
export const WALL_CLEAR = 0.3;
/** a cell a route may pass through, and every edge it crosses, leaves at least this much room somewhere (else a solid
 *  fills it: a well, a kiln; or the gap is narrower than a body turned sideways and the player's capsule, 0.54 m with
 *  its skin: a 0.56 m slot between two plots' walls, a door narrowed by a wall at its jamb) */
export const BODY_MIN = 0.28;
const REACH = 0.5;
interface SBox { u: number; v: number; hu: number; hv: number; c: number; s: number }
interface SolidIx { boxes: SBox[]; cell: Map<number, number[]> }
const SOLIDS = new Map<Site, SolidIx>(), EXTRA = new Map<Site, SBox[]>(), PROPS_ADDED = new WeakSet<object>();
/** solids a site's own plan does not hold (the plan's props standing in it): local boxes, `rot` from local +u */
export function addSiteSolids(s: Site, boxes: { u: number; v: number; hu: number; hv: number; rot: number }[]) {
  const x = EXTRA.get(s) ?? []; for (const b of boxes) x.push({ u: b.u, v: b.v, hu: b.hu, hv: b.hv, c: Math.cos(b.rot), s: Math.sin(b.rot) }); EXTRA.set(s, x); SOLIDS.delete(s); SPOTS.delete(s); EROOM.delete(s); }
/** the site's solids and a per-cell index of those within REACH of each cell (built once per site) */
export function siteSolids(s: Site): SolidIx {
  let x = SOLIDS.get(s); if (x) return x;
  const boxes: SBox[] = [];
  for (const w of s.walls()) { if (w.door) continue; const b = wallBox(w); boxes.push({ ...b, c: 1, s: 0 }); }
  for (const f of siteFootprints(s)) boxes.push({ u: f.u, v: f.v, hu: f.hu, hv: f.hv, c: Math.cos(f.rot), s: Math.sin(f.rot) });
  boxes.push(...(EXTRA.get(s) ?? []));
  const cell = new Map<number, number[]>();
  boxes.forEach((b, bi) => { const eu = Math.abs(b.c) * b.hu + Math.abs(b.s) * b.hv + REACH, ev = Math.abs(b.s) * b.hu + Math.abs(b.c) * b.hv + REACH;
    for (let j = Math.max(0, s.cj(b.v - ev)); j <= Math.min(s.H - 1, s.cj(b.v + ev)); j++) for (let i = Math.max(0, s.ci(b.u - eu)); i <= Math.min(s.W - 1, s.ci(b.u + eu)); i++) {
      const k = j * s.W + i, l = cell.get(k); if (l) l.push(bi); else cell.set(k, [bi]); } });
  x = { boxes, cell }; SOLIDS.set(s, x); return x;
}
/** distance from local (u, v) to the nearest solid of the site (capped at REACH) */
export function clearAt(s: Site, u: number, v: number): number {
  const i = s.ci(u), j = s.cj(v); if (!s.inb(i, j)) return REACH; const ix = siteSolids(s), l = ix.cell.get(j * s.W + i); if (!l) return REACH;
  let d = REACH; for (const bi of l) { const b = ix.boxes[bi]; const x = boxDist(u, v, b, b.c, b.s); if (x < d) { d = x; if (d <= 0) return 0; } } return d;
}
/** a cell's walking spot: the point of the cell (on a 0.175 m lattice) with the most room up to 0.45 m, nearest its centre;
 *  and that room. Routes run through these spots, so they keep off the walls' faces. Cached per site in bytes (the room in
 *  steps of 3 mm, the lattice point's index): 2 bytes a cell, filled as routes reach it */
const SPOTS = new Map<Site, { q: Uint8Array; li: Uint8Array }>();
const LATTICE: [number, number][] = (() => { const o: [number, number][] = []; for (const y of [-2, -1, 0, 1, 2]) for (const x of [-2, -1, 0, 1, 2]) o.push([x * 0.175, y * 0.175]); return o.sort((a, b) => Math.hypot(a[0], a[1]) - Math.hypot(b[0], b[1]) || a[0] - b[0] || a[1] - b[1]); })();
const QS = REACH / 254, enc = (r: number) => 1 + Math.round(Math.max(0, Math.min(REACH, r)) / QS), dec = (q: number) => (q - 1) * QS;
function spots(s: Site) { let m = SPOTS.get(s); if (!m) SPOTS.set(s, m = { q: new Uint8Array(s.W * s.H), li: new Uint8Array(s.W * s.H) }); return m; }
/** the room of a cell's walking spot (m, up to 0.45) */
export function cellRoom(s: Site, k: number): number {
  const m = spots(s); if (m.q[k]) return dec(m.q[k]);
  const cu = s.cu(k % s.W), cv = s.cv((k / s.W) | 0); let best = -1, bi = 0;
  for (let x = 0; x < LATTICE.length; x++) { const c = Math.min(0.45, clearAt(s, cu + LATTICE[x][0], cv + LATTICE[x][1])); if (c > best + 1e-6) { best = c; bi = x; } if (c >= 0.45) break; }
  m.q[k] = enc(best); m.li[k] = bi; return dec(m.q[k]);
}
/** whether a cell has room >= `need` somewhere (stops at the first lattice point that has it; the full room is cached
 *  once computed) */
export function cellHasRoom(s: Site, k: number, need: number): boolean {
  const m = spots(s); if (m.q[k]) return dec(m.q[k]) >= need;
  const cu = s.cu(k % s.W), cv = s.cv((k / s.W) | 0);
  for (const [du, dv] of LATTICE) if (clearAt(s, cu + du, cv + dv) >= need) return true;
  return cellRoom(s, k) >= need;
}
/** a cell's walking spot (local u, v) and its room */
export function cellSpot(s: Site, k: number): [number, number, number] {
  const r = cellRoom(s, k), l = LATTICE[spots(s).li[k]]; return [s.cu(k % s.W) + l[0], s.cv((k / s.W) | 0) + l[1], r];
}

/** the room a body keeps stepping from cell k to its neighbour (dir 0: to (i + 1, j); 1: to (i, j + 1)): the least
 *  clearance along the segment between the two cells' walking spots (every 0.1 m), up to 0.45 m. Measured on the walk
 *  itself, not on the shared edge: two wall ends offset across a lane's jog leave a diagonal slot inside a cell that no
 *  edge sample sees (cached per site, a byte an edge) */
const EROOM = new Map<Site, Uint8Array>();
function segRoom(s: Site, a: number, b: number, need: number): number {
  const p = cellSpot(s, a), q = cellSpot(s, b), L = Math.hypot(q[0] - p[0], q[1] - p[1]), n = Math.max(1, Math.ceil(L / 0.1)); let m = 0.45;
  for (let t = 0; t <= n; t++) { const c = clearAt(s, p[0] + (q[0] - p[0]) * t / n, p[1] + (q[1] - p[1]) * t / n); if (c < m) { m = c; if (m < need) return m; } }
  return m;
}
export function edgeRoom(s: Site, k: number, dir: 0 | 1): number {
  let m = EROOM.get(s); if (!m) EROOM.set(s, m = new Uint8Array(s.W * s.H * 2)); const key = k * 2 + dir; if (m[key]) return dec(m[key]);
  m[key] = enc(segRoom(s, k, dir === 0 ? k + 1 : k + s.W, -1)); return dec(m[key]);
}
/** whether the step from cell k to its neighbour keeps room >= `need` (early out) */
export function edgeHasRoom(s: Site, k: number, dir: 0 | 1, need: number): boolean { return edgeRoom(s, k, dir) >= need; }
/** whether a diagonal step between two cells' spots keeps room >= `need` */
export function diagHasRoom(s: Site, a: number, b: number, need: number): boolean { return segRoom(s, a, b, need) >= need; }

class Heap { // binary min-heap of (priority, key)
  k: number[] = []; p: number[] = [];
  get size() { return this.k.length; }
  clear() { this.k.length = 0; this.p.length = 0; }
  push(key: number, pri: number) { const k = this.k, p = this.p; let i = k.length; k.push(key); p.push(pri);
    while (i > 0) { const q = (i - 1) >> 1; if (p[q] <= pri) break; k[i] = k[q]; p[i] = p[q]; i = q; } k[i] = key; p[i] = pri; }
  pop(): number { const k = this.k, p = this.p, top = k[0], lk = k.pop()!, lp = p.pop()!; const n = k.length;
    if (n) { let i = 0; for (;;) { let c = 2 * i + 1; if (c >= n) break; if (c + 1 < n && p[c + 1] < p[c]) c++; if (p[c] >= lp) break; k[i] = k[c]; p[i] = p[c]; i = c; } k[i] = lk; p[i] = lp; }
    return top; }
  peekPri() { return this.p[0]; }
}

/** search scratch per raster size (reused: one search at a time) */
interface Scratch { g: Float32Array; from: Int32Array; stamp: Uint32Array; closed: Uint32Array; run: number }
const SCRATCH = new Map<Site, Scratch>();
const scratch = (s: Site): Scratch => { let x = SCRATCH.get(s); if (!x) { const n = s.W * s.H; x = { g: new Float32Array(n), from: new Int32Array(n), stamp: new Uint32Array(n), closed: new Uint32Array(n), run: 0 }; SCRATCH.set(s, x); } return x; };
const HEAP = new Heap();

/** per site: bit 0 = the move to (i + 1, j) is legal, bit 1 = the move to (i, j + 1) (precomputed once per site) */
const MOVES = new Map<Site, Uint8Array>();
export function siteMoves(s: Site): Uint8Array {
  let m = MOVES.get(s); if (m) return m; m = new Uint8Array(s.W * s.H);
  for (let j = 0; j < s.H; j++) for (let i = 0; i < s.W; i++) { const k = s.k(i, j);
    if (i + 1 < s.W && passable(s, k, k + 1)) m[k] |= 1; if (j + 1 < s.H && passable(s, k, k + s.W)) m[k] |= 2; }
  MOVES.set(s, m); return m;
}
/** forget a site's derived walking data (its solids, spots, edge rooms and moves): after its doors, fittings or fixtures
 *  change while the plan is built (access.ts) */
export function resetSiteCaches(s: Site) { SOLIDS.delete(s); SPOTS.delete(s); EROOM.delete(s); MOVES.delete(s); SCRATCH.delete(s); }
/** the cells a body can walk to from the open cells on the site's edge, by the routes' own rules (legal moves, a cell's
 *  room and each crossed edge's room >= BODY_MIN) */
export function siteReach(s: Site): Uint8Array {
  const W = s.W, H = s.H, seen = new Uint8Array(W * H), q: number[] = [], m = siteMoves(s);
  for (let k = 0; k < W * H; k++) { const i = k % W, j = (k / W) | 0; if ((i === 0 || j === 0 || i === W - 1 || j === H - 1) && openCode(s.cell[k]) && cellRoom(s, k) >= BODY_MIN) { seen[k] = 1; q.push(k); } }
  while (q.length) { const k = q.pop()!, i = k % W, j = (k / W) | 0;
    for (const [di, dj] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { const ii = i + di, jj = j + dj; if (ii < 0 || jj < 0 || ii >= W || jj >= H) continue; const kk = jj * W + ii; if (seen[kk]) continue;
      const lo = Math.min(k, kk), dir: 0 | 1 = di ? 0 : 1; if (!(dir === 0 ? (m[lo] & 1) : (m[lo] & 2))) continue;
      if (!edgeHasRoom(s, lo, dir, BODY_MIN) || !cellHasRoom(s, kk, BODY_MIN)) continue; seen[kk] = 1; q.push(kk); } }
  return seen;
}
/** orthogonal move from cell k by (di, dj) (one of them 0) */
const mv = (m: Uint8Array, W: number, k: number, di: number, dj: number) => di === 1 ? (m[k] & 1) !== 0 : di === -1 ? (m[k - 1] & 1) !== 0 : dj === 1 ? (m[k] & 2) !== 0 : (m[k - W] & 2) !== 0;
/** 8-connected move (diagonals need both orthogonal detours); the neighbour cell or -1 */
function move8(s: Site, k: number, di: number, dj: number): number {
  const W = s.W, i = k % W, j = (k / W) | 0, ii = i + di, jj = j + dj; if (ii < 0 || jj < 0 || ii >= W || jj >= s.H) return -1;
  const m = siteMoves(s), kk = jj * W + ii;
  if (!di || !dj) return mv(m, W, k, di, dj) ? kk : -1;
  const a = j * W + ii, b = jj * W + i;
  return mv(m, W, k, di, 0) && mv(m, W, a, 0, dj) && mv(m, W, k, 0, dj) && mv(m, W, b, di, 0) ? kk : -1;
}
const onBorder = (s: Site, k: number) => { const i = k % s.W, j = (k / s.W) | 0; return i === 0 || j === 0 || i === s.W - 1 || j === s.H - 1; };

/** A* over one site's cells from `start` to `goal`; or, with `exitTo` (a local point outside or anywhere), to whichever
 *  open border cell minimises the walked cost plus the straight distance on to `exitTo` (the way out of the site toward
 *  a destination beyond it). Returns the cell path, or null. `maxExpand` bounds the work. */
export function siteSearch(s: Site, start: number, goal: number | null, exitTo: P2 | null = null, maxExpand = 400_000): number[] | null {
  const S = scratch(s), run = ++S.run, W = s.W;
  let gi = -1, gj = -1; if (goal !== null) { gi = goal % W; gj = (goal / W) | 0; }
  const tx = exitTo ? exitTo[0] - s.u0 - 0.5 : gi, ty = exitTo ? exitTo[1] - s.v0 - 0.5 : gj;
  const h = (k: number) => { const dx = Math.abs(k % W - tx), dy = Math.abs(((k / W) | 0) - ty); return exitTo ? Math.hypot(dx, dy) : dx + dy + (Math.SQRT2 - 2) * Math.min(dx, dy); };
  HEAP.clear(); S.g[start] = 0; S.stamp[start] = run; S.from[start] = -1; HEAP.push(start, h(start));
  let bestExit = -1, bestExitCost = Infinity, found = -1, n = 0;
  while (HEAP.size) {
    if (exitTo && HEAP.peekPri() >= bestExitCost) break;
    const k = HEAP.pop(); if (S.closed[k] === run) continue; S.closed[k] = run;
    if (k === goal) { found = k; break; }
    if (exitTo && onBorder(s, k) && openCode(s.cell[k])) { const c = S.g[k] + h(k); if (c < bestExitCost) { bestExitCost = c; bestExit = k; } }
    if (++n > maxExpand) break;
    for (let dj = -1; dj <= 1; dj++) for (let di = -1; di <= 1; di++) {
      if (!di && !dj) continue; const kk = move8(s, k, di, dj); if (kk < 0 || S.closed[kk] === run) continue;
      // (D-249) a cell a solid fills is not walked through (the goal may be one: a spot by a well); a tight one costs more;
      // a diagonal step needs room in both cells it cuts past; every edge crossed needs room for a body along it (two walls
      // offset across a one-cell passage, a narrowed door: edgeRoom)
      const room = kk === goal ? 1 : cellRoom(s, kk); if (room < BODY_MIN) continue;
      if (!di || !dj) { if (edgeRoom(s, di ? Math.min(k, kk) : Math.min(k, kk), di ? 0 : 1) < BODY_MIN) continue; }
      else { const a1 = k + di, b1 = k + dj * W; if (cellRoom(s, a1) < BODY_MIN || cellRoom(s, b1) < BODY_MIN) continue;
        if (!diagHasRoom(s, k, kk, BODY_MIN) || edgeRoom(s, Math.min(k, a1), 0) < BODY_MIN || edgeRoom(s, Math.min(a1, kk), 1) < BODY_MIN || edgeRoom(s, Math.min(k, b1), 1) < BODY_MIN || edgeRoom(s, Math.min(b1, kk), 0) < BODY_MIN) continue; }
      const ng = S.g[k] + (di && dj ? Math.SQRT2 : 1) + (room < WALL_CLEAR ? 1.5 : 0);
      if (S.stamp[kk] !== run || ng < S.g[kk]) { S.stamp[kk] = run; S.g[kk] = ng; S.from[kk] = k; HEAP.push(kk, ng + h(kk)); }
    }
  }
  const end = found >= 0 ? found : bestExit; if (end < 0) return null;
  const cells: number[] = []; for (let k = end; k !== -1; k = S.from[k]) cells.push(k); cells.reverse(); return cells;
}

/** straight walk between two local points of a site: every cell the segment crosses is walkable, each cell-to-cell step is
 *  a legal move (diagonal steps need a legal detour), and the line keeps `r` from the face of every wall and solid fitting
 *  (clearAt), except within 0.35 m of its ends (a spot by a wall) */
export function siteLine(s: Site, a: P2, b: P2, r = WALL_CLEAR): boolean {
  const L = Math.hypot(b[0] - a[0], b[1] - a[1]), steps = Math.max(1, Math.ceil(L / 0.1));
  let pi = s.ci(a[0]), pj = s.cj(a[1]); if (!s.inb(pi, pj) || !walkableCell(s, s.k(pi, pj))) return false;
  for (let t = 1; t <= steps; t++) { const f = t / steps, u = a[0] + (b[0] - a[0]) * f, v = a[1] + (b[1] - a[1]) * f, i = s.ci(u), j = s.cj(v);
    if (i !== pi || j !== pj) { if (!s.inb(i, j)) return false;
      const k0 = s.k(pi, pj); if (Math.abs(i - pi) > 1 || Math.abs(j - pj) > 1 || move8(s, k0, i - pi, j - pj) < 0) return false;
      pi = i; pj = j; }
    if (r > 0 && f * L > 0.35 && (1 - f) * L > 0.35 && clearAt(s, u, v) < r) return false; }
  return true;
}
/** cell path → string-pulled polyline of local points (the first and last points are the given ends) */
export function pullPath(s: Site, cells: number[], a: P2, b: P2 | null): P2[] {
  // the cells' walking spots, the ends' own cells included (an end by a wall steps to its cell's spot first when no
  // straight line from it is clear): [a, spot0, spot1 ... spotN, b]
  const pts: P2[] = [a, ...cells.map(k => { const p = cellSpot(s, k); return [p[0], p[1]] as P2; })]; if (b) pts.push(b);
  const out: P2[] = [pts[0]]; let cur = 0;
  while (cur < pts.length - 1) { let nxt = cur + 1; for (let t = Math.min(pts.length - 1, cur + 120); t > cur + 1; t--) if (siteLine(s, pts[cur], pts[t])) { nxt = t; break; } out.push(pts[nxt]); cur = nxt; }
  return out;
}

export interface SiteBox { s: Site; e0: number; n0: number; e1: number; n1: number }
/** a grid point located in a site raster (the site whose cell there is not open ground wins) */
export interface SiteLoc { si: number; k: number; u: number; v: number }

/** the town's walkable network: sites, point location, open-ground clearance and the lane graph between sites */
export class TownWalk {
  readonly boxes: SiteBox[];
  private grid = new Map<number, number[]>(); private static CELL = 256;
  /** lane graph nodes (lane mouths and compound gates, grid metres), each with its site (or -1 for extra nodes), and their
   *  clear links (built on first use) */
  nodes: P2[] = []; nodeSite: number[] = []; private links: [number, number][][] | null = null; private nodeGrid = new Map<number, number[]>();
  constructor(readonly sites: Site[], extraNodes: P2[] = []) {
    this.boxes = sites.map(s => { const c = Math.cos(s.frame.theta), sn = Math.sin(s.frame.theta), hw = s.W / 2, hh = s.H / 2;
      const ex = Math.abs(c) * hw + Math.abs(sn) * hh, ny = Math.abs(sn) * hw + Math.abs(c) * hh; return { s, e0: s.frame.c[0] - ex, n0: s.frame.c[1] - ny, e1: s.frame.c[0] + ex, n1: s.frame.c[1] + ny }; });
    this.boxes.forEach((b, i) => { for (let x = Math.floor(b.e0 / TownWalk.CELL); x <= Math.floor(b.e1 / TownWalk.CELL); x++) for (let y = Math.floor(b.n0 / TownWalk.CELL); y <= Math.floor(b.n1 / TownWalk.CELL); y++) { const key = TownWalk.key(x, y); (this.grid.get(key) ?? this.grid.set(key, []).get(key)!).push(i); } });
    sites.forEach((s, si) => { for (const e of siteExits(s)) { this.nodes.push(e); this.nodeSite.push(si); }
      if (s.meta.kind === 'compound') for (const p of s.plots) { const d = s.doorPoints(p); if (d) { this.nodes.push(s.grid(d.out[0] + (d.out[0] - d.inside[0]) * 1.5, d.out[1] + (d.out[1] - d.inside[1]) * 1.5)); this.nodeSite.push(si); } } });
    for (const e of extraNodes) { this.nodes.push(e); this.nodeSite.push(-1); }
  }
  /** the plan's sites, with the roads' vertices (every 150 m) as extra nodes of the lane graph */
  static fromPlan(plan: TownPlan, extraNodes: P2[] = []) {
    const roads: P2[] = []; for (const r of plan.roads) for (let i = 1; i < r.pts.length; i++) { const [a, b] = [r.pts[i - 1], r.pts[i]], L = Math.hypot(b[0] - a[0], b[1] - a[1]), n = Math.max(1, Math.ceil(L / 150));
      for (let k = i === 1 ? 0 : 1; k <= n; k++) { const p: P2 = [a[0] + (b[0] - a[0]) * k / n, a[1] + (b[1] - a[1]) * k / n]; if (Math.hypot(p[0], p[1]) < 8000) roads.push(p); } }
    // the plan's solid props that stand in a site's raster (pavilion posts and walls, the hall's columns, grave stones) are
    // solids its routes keep clear of (D-249): those reaching down to a body (their foot under 1.8 m)
    if (!PROPS_ADDED.has(plan)) { PROPS_ADDED.add(plan);
      for (const s of plan.sites) { const R = Math.hypot(s.W, s.H) / 2 + 2, list: { u: number; v: number; hu: number; hv: number; rot: number }[] = [];
        for (const p of plan.props) { if (!p.collide || p.y0 > 1.8 || Math.hypot(p.c[0] - s.frame.c[0], p.c[1] - s.frame.c[1]) > R + Math.max(p.hu, p.hv)) continue;
          const [u, v] = toLocal(s.frame, p.c[0], p.c[1]); if (Math.abs(u) > s.W / 2 + p.hu + p.hv || Math.abs(v) > s.H / 2 + p.hu + p.hv) continue;
          list.push({ u, v, hu: p.hu, hv: p.shape === 'cyl' ? p.hu : p.hv, rot: p.theta - s.frame.theta }); }
        if (list.length) addSiteSolids(s, list); } }
    return new TownWalk(plan.sites, [...roads, ...extraNodes]); }
  private static key(x: number, y: number) { return (x + 4096) * 8192 + (y + 4096); }
  /** the site indices whose box may contain (e, n) */
  sitesAt(e: number, n: number): number[] { return this.grid.get(TownWalk.key(Math.floor(e / TownWalk.CELL), Math.floor(n / TownWalk.CELL))) ?? []; }
  /** locate a grid point: a site cell (plot cells first, then open cells of a site raster), or null on the open plain */
  locate(e: number, n: number): SiteLoc | null {
    let open: SiteLoc | null = null;
    for (const si of this.sitesAt(e, n)) { const b = this.boxes[si]; if (e < b.e0 || e > b.e1 || n < b.n0 || n > b.n1) continue; const s = b.s;
      const [u, v] = toLocal(s.frame, e, n), i = s.ci(u), j = s.cj(v); if (!s.inb(i, j)) continue; const k = s.k(i, j);
      if (!openCode(s.cell[k])) return { si, k, u, v }; open ??= { si, k, u, v }; }
    return open;
  }
  /** a straight run over open ground crosses no plot of any site (walls, houses, compounds) and keeps WALL_CLEAR from them
   *  (except within 0.35 m of its ends) */
  clear(a: P2, b: P2): boolean {
    const e0 = Math.min(a[0], b[0]) - 1, e1 = Math.max(a[0], b[0]) + 1, n0 = Math.min(a[1], b[1]) - 1, n1 = Math.max(a[1], b[1]) + 1;
    const seen = new Set<number>();
    for (let x = Math.floor(e0 / TownWalk.CELL); x <= Math.floor(e1 / TownWalk.CELL); x++) for (let y = Math.floor(n0 / TownWalk.CELL); y <= Math.floor(n1 / TownWalk.CELL); y++)
      for (const si of this.grid.get(TownWalk.key(x, y)) ?? []) { if (seen.has(si)) continue; seen.add(si); const B = this.boxes[si]; if (B.e1 < e0 || B.e0 > e1 || B.n1 < n0 || B.n0 > n1) continue;
        const s = B.s, la = toLocal(s.frame, a[0], a[1]), lb = toLocal(s.frame, b[0], b[1]); const L = Math.hypot(lb[0] - la[0], lb[1] - la[1]), steps = Math.max(1, Math.ceil(L / 0.25));
        for (let t = 0; t <= steps; t++) { const f = t / steps, u = la[0] + (lb[0] - la[0]) * f, v = la[1] + (lb[1] - la[1]) * f, i = s.ci(u), j = s.cj(v); if (!s.inb(i, j)) continue; if (!openCode(s.cell[s.k(i, j)])) return false;
          if (f * L > 0.35 && (1 - f) * L > 0.35 && clearAt(s, u, v) < WALL_CLEAR) return false; } }
    return true;
  }
  /** build the lane graph: each node joined to up to 6 nearest clear nodes of its own site within 400 m; every pair of
   *  sites within 6 km by their 3 shortest clear runs; the extra nodes (the Terrace approach, facilities) to up to 8
   *  nearest clear nodes within 2.5 km */
  private build() {
    // (D-249) a lane mouth or gate node stands where a body has room: the walking spot of the roomiest open cell within
    // 2 cells of it (a node in a lane's jog, 0.15 m from two walls, was a waypoint nobody could reach)
    this.nodes.forEach((p, i) => { const si = this.nodeSite[i]; if (si < 0) return; const s = this.boxes[si].s, [u, v] = toLocal(s.frame, p[0], p[1]), ci = s.ci(u), cj = s.cj(v);
      let best = -1, bk = -1, bd = Infinity;
      for (let dj = -2; dj <= 2; dj++) for (let di = -2; di <= 2; di++) { const i2 = ci + di, j2 = cj + dj; if (!s.inb(i2, j2)) continue; const k = s.k(i2, j2); if (!openCode(s.cell[k])) continue;
        const r = Math.min(0.45, cellRoom(s, k)), d = Math.hypot(di, dj); if (r > best + 1e-6 || (Math.abs(r - best) <= 1e-6 && d < bd)) { best = r; bk = k; bd = d; } }
      if (bk >= 0) { const sp = cellSpot(s, bk); this.nodes[i] = s.grid(sp[0], sp[1]); } });
    const N = this.nodes, C = 300, links: [number, number][][] = N.map(() => []); this.links = links;
    N.forEach((p, i) => { const k = TownWalk.key(Math.floor(p[0] / C), Math.floor(p[1] / C)); (this.nodeGrid.get(k) ?? this.nodeGrid.set(k, []).get(k)!).push(i); });
    const link = (i: number, j: number) => { if (links[i].some(l => l[0] === j)) return; const d = Math.hypot(N[i][0] - N[j][0], N[i][1] - N[j][1]); links[i].push([j, d]); links[j].push([i, d]); };
    const bySite = new Map<number, number[]>(); N.forEach((_, i) => { const s = this.nodeSite[i]; (bySite.get(s) ?? bySite.set(s, []).get(s)!).push(i); });
    for (const [si, list] of bySite) { if (si < 0) continue;
      for (const i of list) { const near = list.filter(j => j !== i).map(j => [Math.hypot(N[i][0] - N[j][0], N[i][1] - N[j][1]), j]).filter(x => x[0] <= 400).sort((a, b) => a[0] - b[0]);
        let n = 0; for (const [, j] of near) { if (n >= 6) break; if (this.clear(N[i], N[j])) { link(i, j); n++; } } } }
    const groups = [...bySite.keys()].filter(s => s >= 0);
    for (let x = 0; x < groups.length; x++) for (let y = x + 1; y < groups.length; y++) {
      const A = bySite.get(groups[x])!, B = bySite.get(groups[y])!, pairs: [number, number, number][] = [];
      for (const i of A) for (const j of B) { const d = Math.hypot(N[i][0] - N[j][0], N[i][1] - N[j][1]); if (d <= 6000) pairs.push([d, i, j]); }
      pairs.sort((a, b) => a[0] - b[0]); let n = 0, tried = 0;
      for (const [, i, j] of pairs) { if (n >= 3 || tried++ > 150) break; if (this.clear(N[i], N[j])) { link(i, j); n++; } } }
    for (const i of bySite.get(-1) ?? []) { const near = N.map((p, j) => [Math.hypot(p[0] - N[i][0], p[1] - N[i][1]), j]).filter(q => q[1] !== i && q[0] <= 2500).sort((a, b) => a[0] - b[0]);
      let n = 0; for (const [, j] of near) { if (n >= 8) break; if (this.clear(N[i], N[j])) { link(i, j); n++; } } }
  }
  /** the lane graph's runs over open ground: between two sites, or from an extra node (the Terrace stair foot, the
   *  facilities, the roads' vertices). These straight runs are what people walk between the quarters; the plain draws
   *  them as worn paths (D-190). Read-only: builds the graph on first use exactly as routing does */
  openRuns(): { a: P2; b: P2; extra: boolean }[] {
    if (!this.links) this.build(); const out: { a: P2; b: P2; extra: boolean }[] = [];
    this.links!.forEach((ls, i) => { for (const [j] of ls) { if (j <= i) continue; const si = this.nodeSite[i], sj = this.nodeSite[j];
      if (si === sj && si >= 0) continue; out.push({ a: this.nodes[i], b: this.nodes[j], extra: si < 0 || sj < 0 }); } });
    return out;
  }
  /** node indices within r of p, nearest first */
  nearNodes(p: P2, r: number): number[] {
    if (!this.links) this.build(); const C = 300, out: [number, number][] = [];
    for (let x = Math.floor((p[0] - r) / C); x <= Math.floor((p[0] + r) / C); x++) for (let y = Math.floor((p[1] - r) / C); y <= Math.floor((p[1] + r) / C); y++)
      for (const i of this.nodeGrid.get(TownWalk.key(x, y)) ?? []) { const d = Math.hypot(this.nodes[i][0] - p[0], this.nodes[i][1] - p[1]); if (d <= r) out.push([d, i]); }
    return out.sort((a, b) => a[0] - b[0]).map(x => x[1]);
  }
  /** a lane-graph link checked against the caller's obstacles, cached per obstacle function */
  private linkOk = new WeakMap<object, Map<number, boolean>>();
  private linkClear(i: number, j: number, fn: (a: P2, b: P2) => boolean) {
    let m = this.linkOk.get(fn); if (!m) { m = new Map(); this.linkOk.set(fn, m); } const k = i < j ? i * 65536 + j : j * 65536 + i;
    let v = m.get(k); if (v === undefined) { v = fn(this.nodes[i], this.nodes[j]); m.set(k, v); } return v;
  }
  /** a route over open ground between two points on it: straight when clear, else through the lane graph (Dijkstra);
   *  `clearFn` adds other obstacles (the Terrace's walls through the walkable grid, rivers: the caller's) */
  openRoute(a: P2, b: P2, clearFn: (a: P2, b: P2) => boolean = () => true): P2[] | null {
    const ok = (p: P2, q: P2) => this.clear(p, q) && clearFn(p, q);
    if (ok(a, b)) return [a, b];
    if (!this.links) this.build();
    const N = this.nodes, L = this.links!;
    const near = (p: P2) => { const r = this.nearNodes(p, 900); return r.length >= 4 ? r : this.nearNodes(p, 3000); };
    const starts = near(a).slice(0, 20).filter(i => ok(a, N[i])).slice(0, 6), ends = new Map<number, number>();
    for (const i of near(b).slice(0, 20)) { if (ends.size >= 6) break; if (ok(N[i], b)) ends.set(i, Math.hypot(N[i][0] - b[0], N[i][1] - b[1])); }
    if (!starts.length || !ends.size) return null;
    const dist = new Map<number, number>(), from = new Map<number, number>(), H = new Heap();
    for (const i of starts) { const d = Math.hypot(N[i][0] - a[0], N[i][1] - a[1]); dist.set(i, d); from.set(i, -1); H.push(i, d); }
    let best = -1, bestD = Infinity;
    while (H.size) { const pri = H.peekPri(); if (pri >= bestD) break; const i = H.pop(); const d = dist.get(i)!; if (pri > d + 1e-9) continue;
      const e = ends.get(i); if (e !== undefined && d + e < bestD) { bestD = d + e; best = i; }
      for (const [j, w] of L[i]) { const nd = d + w; if (nd < (dist.get(j) ?? Infinity) && this.linkClear(i, j, clearFn)) { dist.set(j, nd); from.set(j, i); H.push(j, nd); } } }
    if (best < 0) return null;
    const path: P2[] = [b]; for (let i = best; i !== -1; i = from.get(i)!) path.push(N[i]); path.push(a); path.reverse();
    // shortcut where a later point is straight in reach (the graph's corners are lane mouths, not waypoints to touch)
    const out: P2[] = [path[0]]; let cur = 0; while (cur < path.length - 1) { let nxt = cur + 1; for (let t = path.length - 1; t > cur + 1; t--) if (ok(path[cur], path[t])) { nxt = t; break; } out.push(path[nxt]); cur = nxt; }
    return out;
  }
  /** from a point inside a site to the border cell of that site that is best toward `toward` (along its lanes, through
   *  doors only); [a] when a is on the open plain or can walk straight to `toward` from open ground; null if shut in.
   *  Cached per (site, start cell, 16th of the compass toward the destination from the site's centre): a house's ways
   *  out repeat every day, and the destination's own site search finishes the way in. */
  private leaveCache = new Map<string, P2[] | null>();
  leave(a: P2, toward: P2, clearFn?: (a: P2, b: P2) => boolean): P2[] | null {
    const la = this.locate(a[0], a[1]); if (!la) return [a];
    const s = this.boxes[la.si].s;
    if (openCode(s.cell[la.k]) && this.clear(a, toward) && (!clearFn || clearFn(a, toward))) return [a];
    const sec = Math.round(Math.atan2(toward[1] - s.frame.c[1], toward[0] - s.frame.c[0]) / (Math.PI / 8)) & 15, key = `${la.si}:${la.k}:${sec}`;
    let hit = this.leaveCache.get(key);
    if (hit === undefined) { const a8 = sec * Math.PI / 8, far: P2 = [s.frame.c[0] + Math.cos(a8) * 4000, s.frame.c[1] + Math.sin(a8) * 4000];
      const cells = siteSearch(s, la.k, null, toLocal(s.frame, far[0], far[1])), sp = cellSpot(s, la.k); hit = cells ? pullPath(s, cells, [sp[0], sp[1]], null).map(p => s.grid(p[0], p[1])) : null;
      if (this.leaveCache.size > 60_000) this.leaveCache.clear(); this.leaveCache.set(key, hit); }
    if (!hit) return null;
    // the cached way starts at the cell's walking spot: from the exact point straight to its second point when that is
    // clear, else by the spot (a step inside one cell)
    if (hit.length > 1 && siteLine(s, [la.u, la.v], toLocal(s.frame, hit[1][0], hit[1][1]))) return [a, ...hit.slice(1)];
    return [a, ...hit];
  }
  /** same-site searches, cached by cell pair */
  private siteCache = new Map<string, number[] | null>();
  private sitePath(si: number, ka: number, kb: number) { const key = `${si}:${ka}:${kb}`; let c = this.siteCache.get(key); if (c === undefined) { c = siteSearch(this.boxes[si].s, ka, kb); if (this.siteCache.size > 60_000) this.siteCache.clear(); this.siteCache.set(key, c); } return c; }
  /** a route between two grid points anywhere in the town: inside one site along its lanes (through doors only); else out
   *  of a's site at the border cell best toward b, over open ground (straight, or through the lane graph) and into b's
   *  site the same way reversed. `clearFn` adds obstacles on the open ground (the Terrace's walls: the caller's) */
  route(a: P2, b: P2, clearFn?: (a: P2, b: P2) => boolean): P2[] | null {
    const la = this.locate(a[0], a[1]), lb = this.locate(b[0], b[1]);
    if (la && lb && la.si === lb.si) { const s = this.boxes[la.si].s; const cells = this.sitePath(la.si, la.k, lb.k); if (cells) return pullPath(s, cells, [la.u, la.v], [lb.u, lb.v]).map(p => s.grid(p[0], p[1])); }
    const head = this.leave(a, b, clearFn); if (!head) return null;
    const pa = head[head.length - 1];
    const tailR = this.leave(b, pa, clearFn); if (!tailR) return null;
    const tail = tailR.slice().reverse(), pb = tail[0];
    const mid = Math.hypot(pa[0] - pb[0], pa[1] - pb[1]) < 0.01 ? [pa] : this.openRoute(pa, pb, clearFn); if (!mid) return null;
    return dedupe([...head, ...mid.slice(1, -1), ...tail]);
  }
}
const dedupe = (pts: P2[]) => pts.filter((p, i) => i === 0 || Math.hypot(p[0] - pts[i - 1][0], p[1] - pts[i - 1][1]) > 1e-3);

/** a plot's cells a body reaches from its door cell by the routes' own room tests (cellRoom, edgeRoom: 4-connected) */
export function reachFromDoor(s: Site, plot: number, door: number): Set<number> {
  const seen = new Set<number>([door]), q = [door], W = s.W;
  for (let x = 0; x < q.length; x++) { const k = q[x], i = k % W, j = (k / W) | 0;
    for (const [di, dj] of [[1, 0], [-1, 0], [0, 1], [0, -1]] as const) { const i2 = i + di, j2 = j + dj; if (!s.inb(i2, j2)) continue; const k2 = j2 * W + i2;
      if (seen.has(k2) || s.cell[k2] !== plot || cellRoom(s, k2) < BODY_MIN || edgeRoom(s, Math.min(k, k2), di ? 0 : 1) < BODY_MIN) continue; seen.add(k2); q.push(k2); } }
  return seen;
}
/** the cells of each plot by use (court or yard cells: open to the sky; room cells: roofed), indexed once per site
 *  (leftover ground absorbed into a plot can lie outside its main rectangle, so the whole raster is scanned) */
const PLOT_CELLS = new Map<Site, { open: number[]; rooms: number[] }[]>();
export function plotCells(s: Site, idx: number): { open: number[]; rooms: number[] } {
  let t = PLOT_CELLS.get(s);
  if (!t) { t = s.plots.map(() => ({ open: [] as number[], rooms: [] as number[] }));
    for (let k = 0; k < s.cell.length; k++) { const c = s.cell[k]; if (c < 0) continue; if (s.sub[k] === ROOM) t[c].rooms.push(k); else if (s.sub[k] === COURT || s.sub[k] === YARD) t[c].open.push(k); }
    // D-234: a court cell with a fixture in it (a ladder's foot, a bench, fodder, a manger: houseplan.ts) is not a spot to
    // stand in, unless the court has no other cell
    const bl = s.blocked; if (bl?.size) for (const x of t) { const o = x.open.filter(k => !bl.has(k)); if (o.length) x.open = o; }
    // s17 C1 (D-550): only the cells a body reaches from the plot's street door (C9's walk bots: a pen's far end lay behind a
    // neck narrower than a body, its spots unreachable); a plot with no door, or none reached, keeps its cells
    s.plots.forEach((p, i) => { if (!p.door) return; const R = reachFromDoor(s, p.idx, p.door.cell), x = t![i];
      const o = x.open.filter(k => R.has(k)), r = x.rooms.filter(k => R.has(k)); if (o.length + r.length) { x.open = o; x.rooms = r; } });
    PLOT_CELLS.set(s, t); }
  return t[idx];
}
/** s17 V10 (D-479): every plot's cells of these sites, flat (per site: the open and room cells plot by plot, and each plot's
 *  counts), for the baked world: the door-reach pass (D-550) was ~4 s of the build on the T4 page, all in the first caller
 *  (world.ts, the fauna). Taken at the same point of the build as before, so the solids it saw are the same */
export function exportPlotCells(sites: Site[]): { open: Int32Array; rooms: Int32Array; nOpen: Int32Array; nRooms: Int32Array }[] {
  return sites.map(s => { const t = s.plots.map((_, i) => plotCells(s, i)), cat = (f: (x: { open: number[]; rooms: number[] }) => number[]) => Int32Array.from(t.flatMap(f));
    return { open: cat(x => x.open), rooms: cat(x => x.rooms), nOpen: Int32Array.from(t, x => x.open.length), nRooms: Int32Array.from(t, x => x.rooms.length) }; });
}
/** the inverse of exportPlotCells (false, nothing taken, when it does not fit these sites) */
export function importPlotCells(sites: Site[], d: ReturnType<typeof exportPlotCells> | null | undefined): boolean {
  if (!d || d.length !== sites.length || d.some((x, i) => x.nOpen.length !== sites[i].plots.length)) return false;
  sites.forEach((s, i) => { if (PLOT_CELLS.has(s)) return; const x = d[i]; let a = 0, b = 0;
    PLOT_CELLS.set(s, Array.from(x.nOpen, (no, p) => { const nr = x.nRooms[p], r = { open: Array.from(x.open.subarray(a, a + no)), rooms: Array.from(x.rooms.subarray(b, b + nr)) }; a += no; b += nr; return r; })); });
  return true;
}
export { OUT, LANE, SQUARE, ROOM, COURT, YARD };
