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
      const ng = S.g[k] + (di && dj ? Math.SQRT2 : 1);
      if (S.stamp[kk] !== run || ng < S.g[kk]) { S.stamp[kk] = run; S.g[kk] = ng; S.from[kk] = k; HEAP.push(kk, ng + h(kk)); }
    }
  }
  const end = found >= 0 ? found : bestExit; if (end < 0) return null;
  const cells: number[] = []; for (let k = end; k !== -1; k = S.from[k]) cells.push(k); cells.reverse(); return cells;
}

/** the walls are 0.45-0.55 m thick on the cell edges (site.ts): a walked line keeps this far from any edge it may not cross */
export const WALL_CLEAR = 0.3;
/** straight walk between two local points of a site: every cell the segment crosses is walkable, each cell-to-cell step is
 *  a legal move (diagonal steps need a legal detour), and the line keeps `r` from every wall (an edge it could not cross
 *  from where it is: the walls are thick), except within 0.35 m of its ends (a spot by a wall) */
export function siteLine(s: Site, a: P2, b: P2, r = WALL_CLEAR): boolean {
  const L = Math.hypot(b[0] - a[0], b[1] - a[1]), steps = Math.max(1, Math.ceil(L / 0.1));
  let pi = s.ci(a[0]), pj = s.cj(a[1]); if (!s.inb(pi, pj) || !walkableCell(s, s.k(pi, pj))) return false;
  for (let t = 1; t <= steps; t++) { const f = t / steps, u = a[0] + (b[0] - a[0]) * f, v = a[1] + (b[1] - a[1]) * f, i = s.ci(u), j = s.cj(v);
    if (i !== pi || j !== pj) { if (!s.inb(i, j)) return false;
      const k0 = s.k(pi, pj); if (Math.abs(i - pi) > 1 || Math.abs(j - pj) > 1 || move8(s, k0, i - pi, j - pj) < 0) return false;
      pi = i; pj = j; }
    if (r > 0 && f * L > 0.35 && (1 - f) * L > 0.35) { // clearance: the neighbours the body reaches into must be reachable
      const fu = u - s.u0 - i, fv = v - s.v0 - j, k = s.k(i, j), du = fu < r ? -1 : fu > 1 - r ? 1 : 0, dv = fv < r ? -1 : fv > 1 - r ? 1 : 0;
      if (du && move8(s, k, du, 0) < 0) return false; if (dv && move8(s, k, 0, dv) < 0) return false; if (du && dv && move8(s, k, du, dv) < 0) return false; } }
  return true;
}
/** cell path → string-pulled polyline of local points (the first and last points are the given ends) */
export function pullPath(s: Site, cells: number[], a: P2, b: P2 | null): P2[] {
  const pts: P2[] = cells.map(k => [s.cu(k % s.W), s.cv((k / s.W) | 0)]); pts[0] = a; if (b) pts[pts.length - 1] = b;
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
        const s = B.s, la = toLocal(s.frame, a[0], a[1]), lb = toLocal(s.frame, b[0], b[1]); const L = Math.hypot(lb[0] - la[0], lb[1] - la[1]), steps = Math.max(1, Math.ceil(L / 0.25)), r = WALL_CLEAR;
        for (let t = 0; t <= steps; t++) { const f = t / steps, u = la[0] + (lb[0] - la[0]) * f, v = la[1] + (lb[1] - la[1]) * f, i = s.ci(u), j = s.cj(v); if (!s.inb(i, j)) continue; if (!openCode(s.cell[s.k(i, j)])) return false;
          if (f * L > 0.35 && (1 - f) * L > 0.35) { const fu = u - s.u0 - i, fv = v - s.v0 - j, du = fu < r ? -1 : fu > 1 - r ? 1 : 0, dv = fv < r ? -1 : fv > 1 - r ? 1 : 0;
            for (const [x, y] of [[du, 0], [0, dv], [du, dv]]) { if (!x && !y) continue; const ii = i + x, jj = j + y; if (s.inb(ii, jj) && !openCode(s.cell[s.k(ii, jj)])) return false; } } } }
    return true;
  }
  /** build the lane graph: each node joined to up to 6 nearest clear nodes of its own site within 400 m; every pair of
   *  sites within 6 km by their 3 shortest clear runs; the extra nodes (the Terrace approach, facilities) to up to 8
   *  nearest clear nodes within 2.5 km */
  private build() {
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
      const cells = siteSearch(s, la.k, null, toLocal(s.frame, far[0], far[1])); hit = cells ? pullPath(s, cells, [s.cu(la.k % s.W), s.cv((la.k / s.W) | 0)], null).map(p => s.grid(p[0], p[1])) : null;
      if (this.leaveCache.size > 60_000) this.leaveCache.clear(); this.leaveCache.set(key, hit); }
    if (!hit) return null;
    // the cached way starts at the cell's centre: from the exact point straight to its second point when that is clear,
    // else by the centre (a step inside one cell)
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
    PLOT_CELLS.set(s, t); }
  return t[idx];
}
export { OUT, LANE, SQUARE, ROOM, COURT, YARD };
