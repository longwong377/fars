// Settlement raster sites (Phase 6). A site is a 1 m raster in its own rotated frame (a town quarter or a walled compound).
// Cells are lane / open ground / plot cells; plot cells are rooms (roofed), courts or yards (open). Walls stand on the
// raster edges between cells of different kinds, so every wall, door and roof comes from one plan and the colliders,
// the drawn walls and the door points for the people agree by construction. Pure data: no three.js, no terrain.
// Frames: grid (e = grid east, n = grid north, metres, D-002); a site's local (u, v) is its frame rotated by theta
// (CCW from grid east) about its centre. World = (x = e, y = height, z = −n).
import { Rng } from '../../core/rng';

export type P2 = [number, number];
/** cell codes (≥ 0 = plot index) */
export const OUT = -1, LANE = -2, FREE = -3, SQUARE = -4, RES = -5;
/** plot sub-classes */
export const NONE = 0, ROOM = 1, COURT = 2, YARD = 3;
export const ROOF_T = 0.35; // roof slab (reeds, poles and packed earth), C
export const DOOR_H = 2.0;  // door opening height (C)

export interface Frame { c: P2; theta: number }
export const toGrid = (f: Frame, u: number, v: number): P2 => { const c = Math.cos(f.theta), s = Math.sin(f.theta); return [f.c[0] + u * c - v * s, f.c[1] + u * s + v * c]; };
export const toLocal = (f: Frame, e: number, n: number): P2 => { const c = Math.cos(f.theta), s = Math.sin(f.theta), de = e - f.c[0], dn = n - f.c[1]; return [de * c + dn * s, -de * s + dn * c]; };

export type PlotKind = 'house' | 'house_large' | 'workshop' | 'elite' | 'official' | 'store' | 'stable' | 'station' | 'garden' | 'yard' | 'craft_area' | 'pavilion' | 'pen';
export type Craft = 'metal' | 'wood' | 'textile' | 'bakery' | 'brewery' | 'pottery' | 'pigment' | 'bone' | 'kiln' | 'brick';
export type FittingKind = 'hearth' | 'oven' | 'kiln' | 'forge' | 'jar' | 'jar_big' | 'tree' | 'well' | 'quern' | 'loom' | 'vat' | 'timber' | 'anvil' | 'pit' | 'midden' | 'pen_dung' | 'trough' | 'manger' | 'bench' | 'knucklebones' | 'grind_slab' | 'bricks' | 'pool' | 'channel' | 'column' | 'ditch';

export interface Plot {
  idx: number; id: string; kind: PlotKind;
  /** main rectangle in cells [i0, j0, i1, j1) and its (a, b) frame: a along t, b inward from the street (n) */
  rect: [number, number, number, number]; o: [number, number]; t: [number, number]; n: [number, number]; w: number; d: number;
  /** street door: the plot cell and the outside cell (lane, square or open ground) it opens onto */
  door: { cell: number; out: number } | null;
  court: boolean; height: number; parapet: number; yardWall: number; outerT: number;
  area: number; roofed: number; capacity: number; craft?: Craft; row: string; feature: string; note: string;
}
export interface Fitting { kind: FittingKind; u: number; v: number; rot: number; size: number; plot: number; note?: string; species?: string; len?: number; wid?: number }
export interface Wall { u0: number; v0: number; u1: number; v1: number; thick: number; kind: 'outer' | 'facade' | 'partition' | 'yard'; sides: { plot: number; top: number }[]; door: boolean }
export interface Roof { plot: number; i0: number; j0: number; i1: number; j1: number }

export interface SiteMeta { id: string; feature: string; zone: string; popZone: 'town' | 'plain'; kind: 'quarter' | 'compound'; tier: string; src: string; note: string }

export class Site {
  readonly cell: Int32Array; readonly sub: Uint8Array; readonly room: Int32Array;
  readonly doors = new Set<number>();
  /** edges where no wall stands at all (another structure closes them, e.g. the Tol-e Ajori gate body) */
  readonly noWall = new Set<number>();
  readonly plots: Plot[] = []; readonly fittings: Fitting[] = [];
  readonly u0: number; readonly v0: number;
  private roomN = 0;
  constructor(readonly meta: SiteMeta, readonly frame: Frame, readonly W: number, readonly H: number) {
    this.cell = new Int32Array(W * H).fill(FREE); this.sub = new Uint8Array(W * H); this.room = new Int32Array(W * H).fill(-1);
    this.u0 = -W / 2; this.v0 = -H / 2;
  }
  get id() { return this.meta.id; }
  k(i: number, j: number) { return j * this.W + i; }
  inb(i: number, j: number) { return i >= 0 && j >= 0 && i < this.W && j < this.H; }
  at(i: number, j: number) { return this.inb(i, j) ? this.cell[j * this.W + i] : OUT; }
  /** cell centre in local (u, v) */
  cu(i: number) { return this.u0 + i + 0.5; } cv(j: number) { return this.v0 + j + 0.5; }
  /** cell containing local (u, v) */
  ci(u: number) { return Math.floor(u - this.u0); } cj(v: number) { return Math.floor(v - this.v0); }
  grid(u: number, v: number): P2 { return toGrid(this.frame, u, v); }
  cellGrid(k: number): P2 { return this.grid(this.cu(k % this.W), this.cv((k / this.W) | 0)); }
  /** walkable outside a plot: lane, square or open ground */
  static open(c: number) { return c === LANE || c === SQUARE || c === OUT; }
  paint(i0: number, j0: number, i1: number, j1: number, code: number, over?: (c: number) => boolean) {
    for (let j = Math.max(0, j0); j < Math.min(this.H, j1); j++) for (let i = Math.max(0, i0); i < Math.min(this.W, i1); i++) {
      const k = j * this.W + i; if (!over || over(this.cell[k])) this.cell[k] = code; }
  }
  newRoom() { return this.roomN++; }
  /** edge ids: 'h' between (i, j) and (i, j + 1); 'v' between (i, j) and (i + 1, j) */
  eh(i: number, j: number) { return j * this.W + i; }
  ev(i: number, j: number) { return this.W * this.H + j * this.W + i; }
  /** the edge between two 4-adjacent cells */
  edgeBetween(k1: number, k2: number) {
    const i1 = k1 % this.W, j1 = (k1 / this.W) | 0, i2 = k2 % this.W, j2 = (k2 / this.W) | 0;
    if (j1 === j2) return this.ev(Math.min(i1, i2), j1);
    return this.eh(i1, Math.min(j1, j2));
  }
  /** add a plot over the given cells (all set to `sub`) */
  addPlot(p: Omit<Plot, 'idx' | 'area' | 'roofed' | 'capacity'> & { capacity?: number }): Plot {
    const plot: Plot = { ...p, idx: this.plots.length, area: 0, roofed: 0, capacity: p.capacity ?? 0 };
    this.plots.push(plot); return plot;
  }
  /** (a, b) → cell index inside a plot's main rectangle frame */
  ab(p: Plot, a: number, b: number) { return this.k(p.o[0] + a * p.t[0] + b * p.n[0], p.o[1] + a * p.t[1] + b * p.n[1]); }
  abLocal(p: Plot, a: number, b: number): P2 { const i = p.o[0] + a * p.t[0] + b * p.n[0], j = p.o[1] + a * p.t[1] + b * p.n[1]; return [this.cu(i), this.cv(j)]; }
  /** local (u, v) at fractional (a, b) (cell units, 0 = the corner of cell (0, 0)) */
  abPoint(p: Plot, a: number, b: number): P2 {
    // cell (a, b) centre is at a + 0.5, b + 0.5; the frame origin cell is p.o
    const ci = p.o[0] + 0.5 + (a - 0.5) * p.t[0] + (b - 0.5) * p.n[0], cj = p.o[1] + 0.5 + (a - 0.5) * p.t[1] + (b - 0.5) * p.n[1];
    return [this.u0 + ci, this.v0 + cj];
  }
  recount() {
    for (const p of this.plots) { p.area = 0; p.roofed = 0; }
    for (let k = 0; k < this.cell.length; k++) { const c = this.cell[k]; if (c >= 0) { this.plots[c].area++; if (this.sub[k] === ROOM) this.plots[c].roofed++; } }
  }
  /** local (u, v) of a door: the midpoint of its edge; and the outside/inside cell centres */
  doorPoints(p: Plot): { mid: P2; out: P2; inside: P2 } | null {
    if (!p.door) return null;
    const a = p.door.cell, b = p.door.out, ia = a % this.W, ja = (a / this.W) | 0, ib = b % this.W, jb = (b / this.W) | 0;
    return { mid: [this.u0 + (ia + ib) / 2 + 0.5, this.v0 + (ja + jb) / 2 + 0.5], out: [this.cu(ib), this.cv(jb)], inside: [this.cu(ia), this.cv(ja)] };
  }

  // ---- walls ----------------------------------------------------------------------------------------------------
  /** wall kind and per-side top (m above the side plot's base) for the edge between cells k1, k2; null = no wall */
  private edgeWall(k1: number, k2: number): { kind: Wall['kind']; sides: { plot: number; top: number }[]; thick: number } | null {
    const c1 = this.cell[k1], c2 = k2 < 0 ? OUT : this.cell[k2];
    if (c1 < 0 && c2 < 0) return null;
    const s1 = c1 >= 0 ? this.sub[k1] : NONE, s2 = c2 >= 0 ? this.sub[k2] : NONE;
    const topOuter = (p: Plot, s: number) => s === ROOM ? p.height + p.parapet : s === COURT ? p.height : p.yardWall;
    if (c1 !== c2) { // plot boundary
      const sides: { plot: number; top: number }[] = [];
      let thick = 0;
      for (const [c, s] of [[c1, s1], [c2, s2]] as const) if (c >= 0) { const p = this.plots[c]; sides.push({ plot: c, top: topOuter(p, s) }); thick = Math.max(thick, s === YARD ? Math.min(p.outerT, 0.55) : p.outerT); }
      return { kind: 'outer', sides, thick };
    }
    const p = this.plots[c1];
    if (s1 === s2) {
      if (s1 !== ROOM || this.room[k1] === this.room[k2]) return null;
      return { kind: 'partition', sides: [{ plot: c1, top: p.height - ROOF_T }], thick: 0.4 };
    }
    if (s1 === ROOM || s2 === ROOM) return { kind: 'facade', sides: [{ plot: c1, top: p.height + p.parapet }], thick: 0.55 };
    if ((s1 === COURT && s2 === YARD) || (s1 === YARD && s2 === COURT)) return { kind: 'yard', sides: [{ plot: c1, top: p.yardWall }], thick: 0.45 };
    return null;
  }
  /** all wall segments (runs of equal edges merged; corners closed: u-direction walls extend, v-direction walls trim) */
  walls(): Wall[] {
    const { W, H } = this;
    type E = { kind: Wall['kind']; sides: { plot: number; top: number }[]; thick: number; door: boolean; key: string } | null;
    const hE: E[] = new Array(W * (H + 1)).fill(null), vE: E[] = new Array((W + 1) * H).fill(null);
    let nd = 0; const key = (w: NonNullable<ReturnType<Site['edgeWall']>>, door: boolean) => `${w.kind}|${w.thick}|${w.sides.map(s => s.plot + ':' + s.top.toFixed(3)).join(',')}|${door ? 'd' + nd++ : ''}`;
    // horizontal edges along u at v-line j (between row j−1 and row j), j = 0..H
    for (let j = 0; j <= H; j++) for (let i = 0; i < W; i++) {
      const a = j > 0 ? this.k(i, j - 1) : -1, b = j < H ? this.k(i, j) : -1;
      if (a >= 0 && b >= 0 && this.noWall.has(this.eh(i, j - 1))) continue;
      const w = a < 0 ? (b < 0 ? null : this.edgeWall(b, -1)) : this.edgeWall(a, b);
      if (!w) continue;
      const door = a >= 0 && b >= 0 && j > 0 && this.doors.has(this.eh(i, j - 1));
      hE[j * W + i] = { ...w, door, key: key(w, door) };
    }
    for (let j = 0; j < H; j++) for (let i = 0; i <= W; i++) {
      const a = i > 0 ? this.k(i - 1, j) : -1, b = i < W ? this.k(i, j) : -1;
      if (a >= 0 && b >= 0 && this.noWall.has(this.ev(i - 1, j))) continue;
      const w = a < 0 ? (b < 0 ? null : this.edgeWall(b, -1)) : this.edgeWall(a, b);
      if (!w) continue;
      const door = a >= 0 && b >= 0 && i > 0 && this.doors.has(this.ev(i - 1, j));
      vE[j * (W + 1) + i] = { ...w, door, key: key(w, door) };
    }
    // vertex tables: max half-thickness of u-walls and v-walls meeting at each grid vertex (i, j), 0..W × 0..H
    const hu = new Float32Array((W + 1) * (H + 1)), hv = new Float32Array((W + 1) * (H + 1)), vk = (i: number, j: number) => j * (W + 1) + i;
    for (let j = 0; j <= H; j++) for (let i = 0; i < W; i++) { const e = hE[j * W + i]; if (!e || e.door) continue; for (const ii of [i, i + 1]) hu[vk(ii, j)] = Math.max(hu[vk(ii, j)], e.thick / 2); }
    for (let j = 0; j < H; j++) for (let i = 0; i <= W; i++) { const e = vE[j * (W + 1) + i]; if (!e || e.door) continue; for (const jj of [j, j + 1]) hv[vk(i, jj)] = Math.max(hv[vk(i, jj)], e.thick / 2); }
    const out: Wall[] = [];
    for (let j = 0; j <= H; j++) { let i = 0; while (i < W) { const e = hE[j * W + i]; if (!e) { i++; continue; } let i1 = i + 1; while (i1 < W && hE[j * W + i1]?.key === e.key) i1++;
      const ext0 = e.door ? 0 : hv[vk(i, j)], ext1 = e.door ? 0 : hv[vk(i1, j)];
      out.push({ u0: this.u0 + i - ext0, v0: this.v0 + j, u1: this.u0 + i1 + ext1, v1: this.v0 + j, thick: e.thick, kind: e.kind, sides: e.sides, door: e.door }); i = i1; } }
    for (let i = 0; i <= W; i++) { let j = 0; while (j < H) { const e = vE[j * (W + 1) + i]; if (!e) { j++; continue; } let j1 = j + 1; while (j1 < H && vE[j1 * (W + 1) + i]?.key === e.key) j1++;
      const tr0 = e.door ? 0 : hu[vk(i, j)], tr1 = e.door ? 0 : hu[vk(i, j1)];
      if (j1 - j - tr0 - tr1 > 0.02) out.push({ u0: this.u0 + i, v0: this.v0 + j + tr0, u1: this.u0 + i, v1: this.v0 + j1 - tr1, thick: e.thick, kind: e.kind, sides: e.sides, door: e.door }); j = j1; } }
    return out;
  }
  /** roof slabs: greedy rectangles over each plot's roofed cells */
  roofs(): Roof[] {
    const { W, H } = this, used = new Uint8Array(W * H), out: Roof[] = [];
    const ok = (i: number, j: number, p: number) => this.inb(i, j) && !used[this.k(i, j)] && this.cell[this.k(i, j)] === p && this.sub[this.k(i, j)] === ROOM;
    for (let j = 0; j < H; j++) for (let i = 0; i < W; i++) {
      const k = this.k(i, j), p = this.cell[k]; if (p < 0 || used[k] || this.sub[k] !== ROOM) continue;
      let i1 = i + 1; while (ok(i1, j, p)) i1++;
      let j1 = j + 1; while (true) { let all = true; for (let x = i; x < i1; x++) if (!ok(x, j1, p)) { all = false; break; } if (!all) break; j1++; }
      for (let y = j; y < j1; y++) for (let x = i; x < i1; x++) used[this.k(x, y)] = 1;
      out.push({ plot: p, i0: i, j0: j, i1, j1 });
    }
    return out;
  }
  /** walkable connectivity: components of open cells (lane, square, open ground) — 4-neighbour; returns label per cell (−1 = not open) */
  openComponents(): Int32Array {
    const { W, H } = this, lab = new Int32Array(W * H).fill(-1); let n = 0; const q: number[] = [];
    for (let s = 0; s < W * H; s++) { if (lab[s] >= 0 || !Site.open(this.cell[s])) continue;
      lab[s] = n; q.length = 0; q.push(s);
      while (q.length) { const k = q.pop()!, i = k % W, j = (k / W) | 0;
        for (const [di, dj] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { const ii = i + di, jj = j + dj; if (!this.inb(ii, jj)) continue; const kk = this.k(ii, jj); if (lab[kk] < 0 && Site.open(this.cell[kk])) { lab[kk] = n; q.push(kk); } } }
      n++; }
    return lab;
  }
  /** component labels that reach the site boundary (the open plain around it) */
  exitComponents(lab: Int32Array): Set<number> {
    const s = new Set<number>(); const { W, H } = this;
    for (let i = 0; i < W; i++) for (const j of [0, H - 1]) { const l = lab[this.k(i, j)]; if (l >= 0) s.add(l); }
    for (let j = 0; j < H; j++) for (const i of [0, W - 1]) { const l = lab[this.k(i, j)]; if (l >= 0) s.add(l); }
    for (let k = 0; k < W * H; k++) if (this.cell[k] === OUT && lab[k] >= 0) s.add(lab[k]);
    return s;
  }
}

/** deterministic shuffle */
export function shuffle<T>(a: T[], rng: Rng) { for (let i = a.length - 1; i > 0; i--) { const j = rng.int(0, i); [a[i], a[j]] = [a[j], a[i]]; } return a; }
