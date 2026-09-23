// Walkable grid + path finding for people (D-010). The grid is generated offline from the physics colliders
// (tools/build_nav.ts); this module loads it, answers height/walkability queries and finds smoothed A* paths.
// Grid coordinates: i along grid east, j along grid north; cell centres at e0 + (i+½)·cell, n0 + (j+½)·cell.

export const NAV = {
  e0: -140, n0: -245, cell: 0.5, w: 804, h: 860, // covers the plain W of the Grand Stair and the whole Terrace
  maxStep: 0.42, knee: 0.6, head: 1.6, blocked: -32768,
  seeds: [[-120, 122.5], [0.1, 100]] as [number, number][],
};
export type P2 = [number, number];

export class NavGrid {
  readonly w = NAV.w; readonly h = NAV.h; readonly cell = NAV.cell;
  private g: Float32Array; private cost: Float32Array; private from: Int32Array; private stamp: Uint32Array; private closed: Uint32Array; private run = 0;
  /** extra blocked cells (fires, props) layered over the static grid */
  private dyn: Uint8Array;
  constructor(readonly hcm: Int16Array) {
    const n = this.w * this.h; this.g = new Float32Array(n); this.cost = new Float32Array(n); this.from = new Int32Array(n); this.stamp = new Uint32Array(n); this.closed = new Uint32Array(n); this.dyn = new Uint8Array(n);
  }
  static async load(fetchBin: (p: string) => Promise<ArrayBuffer>) { return new NavGrid(new Int16Array(await fetchBin('generated/nav.i16'))); }
  ij(e: number, n: number): [number, number] { return [Math.floor((e - NAV.e0) / this.cell), Math.floor((n - NAV.n0) / this.cell)]; }
  centre(i: number, j: number): P2 { return [NAV.e0 + (i + 0.5) * this.cell, NAV.n0 + (j + 0.5) * this.cell]; }
  okIJ(i: number, j: number) { if (i < 0 || j < 0 || i >= this.w || j >= this.h) return false; const k = j * this.w + i; return this.hcm[k] !== NAV.blocked && !this.dyn[k]; }
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
  /** straight walk possible? every cell along the segment walkable, no step higher than maxStep between samples */
  lineClear(a: P2, b: P2): boolean {
    const L = Math.hypot(b[0] - a[0], b[1] - a[1]), steps = Math.max(1, Math.ceil(L / (this.cell * 0.5)));
    let prev = this.heightAt(a[0], a[1]);
    for (let s = 1; s <= steps; s++) { const t = s / steps, e = a[0] + (b[0] - a[0]) * t, n = a[1] + (b[1] - a[1]) * t;
      // body clearance: the cell and its side neighbours across the direction of travel
      if (!this.walkable(e, n)) return false;
      const hh = this.heightAt(e, n); if (!(Math.abs(hh - prev) <= NAV.maxStep)) return false; prev = hh; }
    return true;
  }
  /** A* (8-connected, octile) from a to b; returns a string-pulled polyline, or null. `maxExpand` bounds the work. */
  findPath(a: P2, b: P2, maxExpand = 400_000): P2[] | null {
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
        if (!di && !dj) continue; const ii = i + di, jj = j + dj; if (!this.okIJ(ii, jj)) continue;
        if (di && dj && (!this.okIJ(i + di, j) || !this.okIJ(i, j + dj))) continue; // no corner cutting
        const kk = jj * W + ii; if (this.closed[kk] === run) continue;
        const dh = Math.abs(this.hcm[kk] - hk) / 100; if (dh > NAV.maxStep) continue;
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
