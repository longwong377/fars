// Walkable grid + path finding for people (D-010). The grid is generated offline from the physics colliders
// (tools/build_nav.ts); this module loads it, answers height/walkability queries and finds smoothed A* paths.
// Grid coordinates: i along grid east, j along grid north; cell centres at e0 + (i+½)·cell, n0 + (j+½)·cell.

export const NAV = {
  e0: -620, n0: -245, cell: 0.5, w: 1764, h: 860, // covers 480 m of the plain W of the Grand Stair (the approach) and the whole Terrace
  maxStep: 0.42, knee: 0.6, head: 1.6, blocked: -32768,
  seeds: [[-120, 122.5], [-600, 122.5], [0.1, 100]] as [number, number][],
};
export type P2 = [number, number];

export class NavGrid {
  readonly w = NAV.w; readonly h = NAV.h; readonly cell = NAV.cell;
  private g: Float32Array; private cost: Float32Array; private from: Int32Array; private stamp: Uint32Array; private closed: Uint32Array; private run = 0;
  /** extra blocked cells (fires, props) layered over the static grid */
  private dyn: Uint8Array;
  /** temporary obstacles for one search (e.g. people standing in the way of a bot) */
  private tmp: Uint8Array; private tmpList: number[] = [];
  constructor(readonly hcm: Int16Array, readonly edges: Uint8Array = new Uint8Array(hcm.length).fill(3)) {
    const n = this.w * this.h; this.g = new Float32Array(n); this.cost = new Float32Array(n); this.from = new Int32Array(n); this.stamp = new Uint32Array(n); this.closed = new Uint32Array(n); this.dyn = new Uint8Array(n); this.tmp = new Uint8Array(n);
  }
  static async load(fetchBin: (p: string) => Promise<ArrayBuffer>) { return new NavGrid(new Int16Array(await fetchBin('generated/nav.i16')), new Uint8Array(await fetchBin('generated/nav_edges.u8'))); }
  /** legal 4-neighbour move (cells adjacent; walkability, step height and thin walls all checked) */
  move(i: number, j: number, i2: number, j2: number): boolean {
    if (!this.okIJ(i, j) || !this.okIJ(i2, j2)) return false;
    if (i2 === i + 1 && j2 === j) return (this.edges[j * this.w + i] & 1) !== 0;
    if (i2 === i - 1 && j2 === j) return (this.edges[j * this.w + i2] & 1) !== 0;
    if (j2 === j + 1 && i2 === i) return (this.edges[j * this.w + i] & 2) !== 0;
    if (j2 === j - 1 && i2 === i) return (this.edges[j2 * this.w + i] & 2) !== 0;
    return false;
  }
  /** legal 8-neighbour move: diagonals need both orthogonal detours legal (no corner cutting) */
  move8(i: number, j: number, i2: number, j2: number): boolean {
    if (i2 === i || j2 === j) return this.move(i, j, i2, j2);
    return this.move(i, j, i2, j) && this.move(i2, j, i2, j2) && this.move(i, j, i, j2) && this.move(i, j2, i2, j2);
  }
  ij(e: number, n: number): [number, number] { return [Math.floor((e - NAV.e0) / this.cell), Math.floor((n - NAV.n0) / this.cell)]; }
  centre(i: number, j: number): P2 { return [NAV.e0 + (i + 0.5) * this.cell, NAV.n0 + (j + 0.5) * this.cell]; }
  okIJ(i: number, j: number) { if (i < 0 || j < 0 || i >= this.w || j >= this.h) return false; const k = j * this.w + i; return this.hcm[k] !== NAV.blocked && !this.dyn[k] && !this.tmp[k]; }
  walkable(e: number, n: number) { const [i, j] = this.ij(e, n); return this.okIJ(i, j); }
  /** block a disc (e.g. a brazier) */
  blockDisc(e: number, n: number, r: number) { const [i0, j0] = this.ij(e - r, n - r), [i1, j1] = this.ij(e + r, n + r);
    for (let j = j0; j <= j1; j++) for (let i = i0; i <= i1; i++) { const [x, y] = this.centre(i, j); if (Math.hypot(x - e, y - n) <= r && i >= 0 && j >= 0 && i < this.w && j < this.h) this.dyn[j * this.w + i] = 1; } }
  /** ground height (m, court datum) interpolated over walkable neighbours; NaN off the grid */
  heightAt(e: number, n: number): number {
    const fx = (e - NAV.e0) / this.cell - 0.5, fy = (n - NAV.n0) / this.cell - 0.5, i = Math.floor(fx), j = Math.floor(fy), tx = fx - i, ty = fy - j;
    let s = 0, ws = 0;
    for (const [di, dj, wt] of [[0, 0, (1 - tx) * (1 - ty)], [1, 0, tx * (1 - ty)], [0, 1, (1 - tx) * ty], [1, 1, tx * ty]] as const) {
      const ii = i + di, jj = j + dj; if (ii < 0 || jj < 0 || ii >= this.w || jj >= this.h) continue; const v = this.hcm[jj * this.w + ii]; if (v === NAV.blocked) continue; s += (v / 100) * wt; ws += wt;
    }
    if (ws > 0) return s / ws;
    const [ci, cj] = this.ij(e, n); const v = ci >= 0 && cj >= 0 && ci < this.w && cj < this.h ? this.hcm[cj * this.w + ci] : NAV.blocked; return v === NAV.blocked ? NaN : v / 100;
  }
  /** nearest walkable cell centre within r metres (spiral search) */
  snap(e: number, n: number, r = 6): P2 | null {
    const [i0, j0] = this.ij(e, n); if (this.okIJ(i0, j0)) return this.centre(i0, j0);
    const R = Math.ceil(r / this.cell); let best: P2 | null = null, bd = Infinity;
    for (let d = 1; d <= R && !best; d++) for (let dj = -d; dj <= d; dj++) for (let di = -d; di <= d; di++) {
      if (Math.max(Math.abs(di), Math.abs(dj)) !== d || !this.okIJ(i0 + di, j0 + dj)) continue; const dd = di * di + dj * dj; if (dd < bd) { bd = dd; best = this.centre(i0 + di, j0 + dj); }
    }
    return best;
  }
  /** straight walk possible? every grid cell the segment crosses is walkable and each cell-to-cell move is a legal A*
   *  move (height change ≤ maxStep between the raw cell heights; diagonal moves need a legal orthogonal detour) */
  lineClear(a: P2, b: P2): boolean {
    const L = Math.hypot(b[0] - a[0], b[1] - a[1]), steps = Math.max(1, Math.ceil(L / (this.cell * 0.25)));
    let [pi, pj] = this.ij(a[0], a[1]); if (!this.okIJ(pi, pj)) return false;
    for (let s = 1; s <= steps; s++) { const t = s / steps; const [i, j] = this.ij(a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t);
      if (i === pi && j === pj) continue;
      if (Math.abs(i - pi) > 1 || Math.abs(j - pj) > 1 || !this.move8(pi, pj, i, j)) return false;
      pi = i; pj = j; }
    return true;
  }
  /** find a path while treating discs around `avoid` points as blocked (not persisted) */
  findPathAvoiding(a: P2, b: P2, avoid: P2[], r: number): P2[] | null {
    for (const [e, n] of avoid) { const [i0, j0] = this.ij(e - r, n - r), [i1, j1] = this.ij(e + r, n + r);
      for (let j = Math.max(0, j0); j <= Math.min(this.h - 1, j1); j++) for (let i = Math.max(0, i0); i <= Math.min(this.w - 1, i1); i++) { const [x, y] = this.centre(i, j); if (Math.hypot(x - e, y - n) <= r) { const k = j * this.w + i; if (!this.tmp[k]) { this.tmp[k] = 1; this.tmpList.push(k); } } } }
    try { return this.findPath(a, b); } finally { for (const k of this.tmpList) this.tmp[k] = 0; this.tmpList = []; }
  }
  /** A* (8-connected, octile) from a to b; returns a string-pulled polyline, or null. `maxExpand` bounds the work. */
  findPath(a: P2, b: P2, maxExpand = 1_500_000): P2[] | null {
    const sa = this.snap(a[0], a[1]), sb = this.snap(b[0], b[1]); if (!sa || !sb) return null;
    const [si, sj] = this.ij(sa[0], sa[1]), [ti, tj] = this.ij(sb[0], sb[1]); const W = this.w;
    const run = ++this.run; const start = sj * W + si, goal = tj * W + ti;
    const hfun = (i: number, j: number) => { const dx = Math.abs(i - ti), dy = Math.abs(j - tj); return (dx + dy) + (Math.SQRT2 - 2) * Math.min(dx, dy); };
    const heap = new MinHeap(); this.g[start] = 0; this.stamp[start] = run; this.from[start] = -1; heap.push(start, hfun(si, sj));
    let found = false, expanded = 0;
    while (heap.size) {
      const k = heap.pop(); if (this.closed[k] === run) continue; this.closed[k] = run;
      if (k === goal) { found = true; break; }
      if (++expanded > maxExpand) break;
      const i = k % W, j = (k / W) | 0, hk = this.hcm[k];
      for (let dj = -1; dj <= 1; dj++) for (let di = -1; di <= 1; di++) {
        if (!di && !dj) continue; const ii = i + di, jj = j + dj; if (!this.move8(i, j, ii, jj)) continue;
        const kk = jj * W + ii; if (this.closed[kk] === run) continue;
        const dh = Math.abs(this.hcm[kk] - hk) / 100;
        const ng = this.g[k] + (di && dj ? Math.SQRT2 : 1) + dh * 2; // mild climb penalty
        if (this.stamp[kk] !== run || ng < this.g[kk]) { this.stamp[kk] = run; this.g[kk] = ng; this.from[kk] = k; heap.push(kk, ng + hfun(ii, jj)); }
      }
    }
    if (!found) return null;
    const cells: P2[] = []; for (let k = goal; k !== -1; k = this.from[k]) cells.push(this.centre(k % W, (k / W) | 0)); cells.reverse();
    cells[0] = sa; cells[cells.length - 1] = sb;
    // string pulling: keep the farthest visible point
    const out: P2[] = [cells[0]]; let cur = 0;
    while (cur < cells.length - 1) { let nxt = cur + 1; for (let t = cells.length - 1; t > cur + 1; t--) if (this.lineClear(cells[cur], cells[t])) { nxt = t; break; } out.push(cells[nxt]); cur = nxt; }
    return out;
  }
}

class MinHeap {
  private k: number[] = []; private p: number[] = [];
  get size() { return this.k.length; }
  push(key: number, pri: number) { const k = this.k, p = this.p; let i = k.length; k.push(key); p.push(pri);
    while (i > 0) { const par = (i - 1) >> 1; if (p[par] <= pri) break; k[i] = k[par]; p[i] = p[par]; i = par; } k[i] = key; p[i] = pri; }
  pop(): number { const k = this.k, p = this.p, top = k[0], lk = k.pop()!, lp = p.pop()!; const n = k.length;
    if (n) { let i = 0; for (;;) { let c = 2 * i + 1; if (c >= n) break; if (c + 1 < n && p[c + 1] < p[c]) c++; if (p[c] >= lp) break; k[i] = k[c]; p[i] = p[c]; i = c; } k[i] = lk; p[i] = lp; }
    return top; }
}
