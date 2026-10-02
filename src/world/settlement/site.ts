// Settlement raster sites (Phase 6). A site is a 1 m raster in its own rotated frame (a town quarter or a walled compound).
// Cells are lane / open ground / plot cells; plot cells are rooms (roofed), courts or yards (open). Walls stand on the
// raster edges between cells of different kinds, so every wall, door and roof comes from one plan and the colliders,
// the drawn walls and the door points for the people agree by construction. Pure data: no three.js, no terrain.
// Frames: grid (e = grid east, n = grid north, metres, D-002); a site's local (u, v) is its frame rotated by theta
// (CCW from grid east) about its centre. World = (x = e, y = height, z = −n).
import { Rng } from '../../core/rng';
import type { HouseLife, Fixture } from './houseplan';

export type P2 = [number, number];
/** cell codes (≥ 0 = plot index) */
export const OUT = -1, LANE = -2, FREE = -3, SQUARE = -4, RES = -5;
/** plot sub-classes */
export const NONE = 0, ROOM = 1, COURT = 2, YARD = 3;
export const ROOF_T = 0.35; // roof slab (reeds, poles and packed earth), C
export const DOOR_H = 2.0;  // door opening height (C)
/** D-234: the court facades end under the roof, whose eave oversails the court: the wall's top as seen from the court is the
 *  roof's top plus the eave's mud lip (was the roof plus the parapet: the houses had parapets round their courts) */
export const EAVE_LIP = 0.12;

export interface Frame { c: P2; theta: number }
export const toGrid = (f: Frame, u: number, v: number): P2 => { const c = Math.cos(f.theta), s = Math.sin(f.theta); return [f.c[0] + u * c - v * s, f.c[1] + u * s + v * c]; };
export const toLocal = (f: Frame, e: number, n: number): P2 => { const c = Math.cos(f.theta), s = Math.sin(f.theta), de = e - f.c[0], dn = n - f.c[1]; return [de * c + dn * s, -de * s + dn * c]; };

export type PlotKind = 'house' | 'house_large' | 'workshop' | 'elite' | 'official' | 'store' | 'stable' | 'station' | 'garden' | 'yard' | 'craft_area' | 'pavilion' | 'pen';
export type Craft = 'metal' | 'wood' | 'textile' | 'bakery' | 'brewery' | 'pottery' | 'pigment' | 'bone' | 'kiln' | 'brick';
export type FittingKind = 'hearth' | 'oven' | 'kiln' | 'forge' | 'jar' | 'jar_big' | 'tree' | 'well' | 'quern' | 'loom' | 'vat' | 'timber' | 'anvil' | 'pit' | 'midden' | 'pen_dung' | 'trough' | 'manger' | 'bench' | 'knucklebones' | 'toys' | 'grind_slab' | 'bricks' | 'pool' | 'channel' | 'column' | 'ditch'
  /** D-254: a village household's mud storage bin (plain/villagehouses.ts draws it; the town has none) */
  | 'bin';

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
  /** s15 (D-386): 16-bit (a site's plots and rooms number in the hundreds to low thousands; newRoom and addPlot check): half the
   *  rasters' memory (the town's and 74 villages' ~110 MB) */
  readonly cell: Int16Array; readonly sub: Uint8Array; readonly room: Int16Array;
  readonly doors = new Set<number>();
  /** edges where no wall stands at all (another structure closes them, e.g. the Tol-e Ajori gate body) */
  readonly noWall = new Set<number>();
  readonly plots: Plot[] = []; readonly fittings: Fitting[] = [];
  /** D-234 (houseplan.ts planHouses): each plot's house life, the court and roof fixtures, and the court cells a fixture
   *  stands in (the people do not stand there) */
  lives?: HouseLife[]; fixtures?: Fixture[]; blocked?: Set<number>;
  readonly u0: number; readonly v0: number;
  private roomN = 0;
  constructor(readonly meta: SiteMeta, readonly frame: Frame, readonly W: number, readonly H: number) {
    this.cell = new Int16Array(W * H).fill(FREE); this.sub = new Uint8Array(W * H); this.room = new Int16Array(W * H).fill(-1);
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
  newRoom() { if (this.roomN >= 32767) throw new Error(`site ${this.meta.id}: over 32767 rooms (16-bit raster)`); return this.roomN++; }
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
    if (this.plots.length >= 32767) throw new Error(`site ${this.meta.id}: over 32767 plots (16-bit raster)`);
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
  edgeWall(k1: number, k2: number): { kind: Wall['kind']; sides: { plot: number; top: number }[]; thick: number } | null {
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
    if (s1 === ROOM || s2 === ROOM) return { kind: 'facade', sides: [{ plot: c1, top: p.height + EAVE_LIP }], thick: 0.55 };
    if ((s1 === COURT && s2 === YARD) || (s1 === YARD && s2 === COURT)) return { kind: 'yard', sides: [{ plot: c1, top: p.yardWall }], thick: 0.45 };
    return null;
  }
  // ---- door clearance (D-249; Q-640) ---------------------------------------------------------------------------------
  /** thickness of the wall standing on the u-direction edge from vertex (i, j) to (i + 1, j), 0 where none (or a door); as
   *  walls() reads the edges */
  hWallT(i: number, j: number): number {
    if (i < 0 || i >= this.W || j < 0 || j > this.H) return 0;
    const a = j > 0 ? this.k(i, j - 1) : -1, b = j < this.H ? this.k(i, j) : -1;
    if (a >= 0 && b >= 0 && (this.noWall.has(this.eh(i, j - 1)) || this.doors.has(this.eh(i, j - 1)))) return 0;
    const w = a < 0 ? (b < 0 ? null : this.edgeWall(b, -1)) : this.edgeWall(a, b); return w ? w.thick : 0;
  }
  /** thickness of the wall on the v-direction edge from vertex (i, j) to (i, j + 1), 0 where none (or a door) */
  vWallT(i: number, j: number): number {
    if (i < 0 || i > this.W || j < 0 || j >= this.H) return 0;
    const a = i > 0 ? this.k(i - 1, j) : -1, b = i < this.W ? this.k(i, j) : -1;
    if (a >= 0 && b >= 0 && (this.noWall.has(this.ev(i - 1, j)) || this.doors.has(this.ev(i - 1, j)))) return 0;
    const w = a < 0 ? (b < 0 ? null : this.edgeWall(b, -1)) : this.edgeWall(a, b); return w ? w.thick : 0;
  }
  /** a door edge id → its axis ('h': the edge runs along u, the door is walked through along v) and its first vertex */
  doorEdge(e: number): { h: boolean; i: number; j: number } {
    const N = this.W * this.H; if (e < N) { const i = e % this.W, j = (e / this.W) | 0; return { h: true, i, j: j + 1 }; }
    const k = e - N, i = k % this.W, j = (k / this.W) | 0; return { h: false, i: i + 1, j };
  }
  /** how far walls across the door's line reach into a door opening at vertex (i, j): the half thickness of a wall meeting
   *  the vertex at right angles to the door's wall (a wall run along the door's line ends at the jamb: walls()) */
  jambIntrusion(h: boolean, i: number, j: number): number {
    return h ? Math.max(this.vWallT(i, j - 1), this.vWallT(i, j)) / 2 : Math.max(this.hWallT(i - 1, j), this.hWallT(i, j)) / 2;
  }
  /** the clear width of the opening a door edge belongs to (runs of collinear door edges are one opening, split where a
   *  wall crosses the line), as walls() builds the walls round it */
  doorClear(e: number): number {
    const { h, i, j } = this.doorEdge(e);
    const edgeAt = (x: number) => h ? this.eh(x, j - 1) : this.ev(i - 1, x), along0 = h ? i : j, lim = h ? this.W : this.H;
    const isDoor = (x: number) => x >= 0 && x < lim && this.doors.has(edgeAt(x));
    let lo = along0, hi = along0 + 1;
    const vx = (x: number) => h ? this.jambIntrusion(true, x, j) : this.jambIntrusion(false, i, x);
    while (vx(lo) === 0 && isDoor(lo - 1)) lo--;
    while (vx(hi) === 0 && isDoor(hi)) hi++;
    return hi - lo - vx(lo) - vx(hi);
  }
  /** D-249: every place of a plot (each room, its court, its yard) joined through doors to the plot's street door. The
   *  plan leaves some shut (a room strip or an absorbed yard whose only doors open into each other): a door is added on a
   *  wall between a shut place and a joined place of the same plot, preferring an edge whose opening stays clear
   *  (>= `min`) and has no fitting in its way, then the lowest edge id (deterministic, no random draw). Returns the doors
   *  added and the places left shut. */
  connectPlots(min = 0.8): { added: number; shut: number } {
    const N = this.W * this.H, W = this.W; let added = 0, shut = 0;
    const byPlot = new Map<number, number[]>(); for (let k = 0; k < N; k++) { const c = this.cell[k]; if (c >= 0) (byPlot.get(c) ?? byPlot.set(c, []).get(c)!).push(k); }
    const region = (k: number) => this.sub[k] === ROOM ? -1 - this.room[k] : this.sub[k]; // (within one plot)
    const cellsOf = (e: number): [number, number] => e < N ? [e, e + W] : [e - N, e - N + 1];
    const fits = this.fittings.filter(f => f.kind !== 'tree' && f.kind !== 'channel' && f.kind !== 'ditch' && f.kind !== 'pool' && f.kind !== 'midden' && f.kind !== 'pen_dung');
    const inWay = (e: number) => { const [a, b] = cellsOf(e), p: P2 = [this.cu(a % W), this.cv((a / W) | 0)], q: P2 = [this.cu(b % W), this.cv((b / W) | 0)];
      return fits.some(f => { const t = Math.max(0, Math.min(1, (f.u - p[0]) * (q[0] - p[0]) + (f.v - p[1]) * (q[1] - p[1]))); return Math.hypot(f.u - p[0] - t * (q[0] - p[0]), f.v - p[1] - t * (q[1] - p[1])) < 0.65; }); };
    for (const p of this.plots) {
      if (!p.door || p.kind === 'garden') continue; const cells = byPlot.get(p.idx); if (!cells) continue;
      const doorsIn = () => { const m = new Map<number, number[]>(); for (const k of cells) { const i = k % W, j = (k / W) | 0;
        for (const kk of [i + 1 < W ? k + 1 : -1, j + 1 < this.H ? k + W : -1]) { if (kk < 0 || this.cell[kk] !== p.idx) continue; const ra = region(k), rb = region(kk); if (ra === rb) continue;
          if (!this.doors.has(this.edgeBetween(k, kk))) continue; (m.get(ra) ?? m.set(ra, []).get(ra)!).push(rb); (m.get(rb) ?? m.set(rb, []).get(rb)!).push(ra); } } return m; };
      const all = new Set(cells.map(region));
      for (let guard = 0; guard < 64; guard++) {
        const adj = doorsIn(), start = region(p.door.cell), seen = new Set([start]), q = [start];
        while (q.length) { const r = q.pop()!; for (const x of adj.get(r) ?? []) if (!seen.has(x)) { seen.add(x); q.push(x); } }
        if (seen.size >= all.size) break;
        let best: { e: number; score: number } | null = null;
        for (const k of cells) { const rk = region(k); if (seen.has(rk)) continue; const i = k % W, j = (k / W) | 0;
          for (const [di, dj] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { if (!this.inb(i + di, j + dj)) continue; const kk = this.k(i + di, j + dj); if (this.cell[kk] !== p.idx || !seen.has(region(kk))) continue;
            const e = this.edgeBetween(k, kk); if (this.doors.has(e) || this.noWall.has(e) || !this.edgeWall(k, kk)) continue;
            this.doors.add(e); const cl = this.doorClear(e); this.doors.delete(e);
            const score = (cl >= min ? 0 : 2) + (inWay(e) ? 1 : 0);
            if (!best || score < best.score || (score === best.score && e < best.e)) best = { e, score }; } }
        if (!best) { shut += all.size - seen.size; break; }
        this.doors.add(best.e); added++;
      }
    }
    return { added, shut };
  }
  /** D-249 (Q-640): a door whose opening is narrowed below `min` by a wall meeting its line at a jamb moves: first along its
   *  wall, or to another edge between the same two places (the same room, court, yard or open ground), else to an edge
   *  between one of them and another place of the same plot (a room opening off the next room, as the plan's rooms that
   *  touch no court do; a street door from another part of the house) when the two places stay joined through the
   *  plot's doors. The new edge's jambs must be clear, no fitting stand within reach of it, no other door's opening
   *  narrow, and a street door stays a street door. Nearest first (within 6 cells), deterministic, no random draw.
   *  Returns the doors moved and the ones left narrow. */
  settleDoors(min = 0.8): { moved: number; narrow: number; stepped: number; blocking: number; moves: { from: number; to: number; kind: 'along' | 'same' | 'other' | 'merged' | 'widened' }[] } {
    const N = this.W * this.H, W = this.W; let narrow = 0; const moves: { from: number; to: number; kind: 'along' | 'same' | 'other' | 'merged' | 'widened' }[] = [];
    const lab = this.openComponents();
    // a place, as a number: a room its id; a plot's court or yard; a component of open ground
    const region = (k: number) => { const c = this.cell[k]; if (c < 0) return Site.open(c) ? -1 - lab[k] : -1e9 + c; const sb = this.sub[k]; return sb === ROOM ? this.room[k] : 1e8 + c * 4 + sb; };
    const cellsOf = (e: number): [number, number] => e < N ? [e, e + W] : [e - N, e - N + 1];
    const walkable = (k: number) => this.cell[k] >= 0 || Site.open(this.cell[k]);
    // fittings that stand where they are (hearths, ovens, looms, wells ...) and the small things a household moves (jars,
    // querns, toys: stepped out of a doorway at the end)
    const MOVABLE = new Set<FittingKind>(['jar', 'jar_big', 'quern', 'toys', 'knucklebones', 'grind_slab']);
    const fits = this.fittings.filter(f => !MOVABLE.has(f.kind) && f.kind !== 'tree' && f.kind !== 'channel' && f.kind !== 'ditch' && f.kind !== 'pool' && f.kind !== 'midden' && f.kind !== 'pen_dung');
    const mid = (e: number): P2 => { const [a, b] = cellsOf(e); return [(this.cu(a % W) + this.cu(b % W)) / 2, (this.cv((a / W) | 0) + this.cv((b / W) | 0)) / 2]; };
    // a fitting in the way of the door: within its reach (+ 0.3 m) of the walk through it (cell centre to cell centre)
    const reach = (f: Fitting) => f.kind === 'kiln' ? 1.2 * f.size : f.kind === 'well' ? 1.2 : f.kind === 'trough' || f.kind === 'manger' ? 0.95 : f.kind === 'oven' ? 0.5 : 0.35;
    const passage = (e: number): [P2, P2] => { const [a, b] = cellsOf(e); return [[this.cu(a % W), this.cv((a / W) | 0)], [this.cu(b % W), this.cv((b / W) | 0)]]; };
    const segDist = (u: number, v: number, [p, q]: [P2, P2]) => { const t = Math.max(0, Math.min(1, (u - p[0]) * (q[0] - p[0]) + (v - p[1]) * (q[1] - p[1]))); return Math.hypot(u - p[0] - t * (q[0] - p[0]), v - p[1] - t * (q[1] - p[1])); };
    const inWay = (e: number) => { const ps = passage(e); return fits.some(f => segDist(f.u, f.v, ps) < reach(f) + 0.3); };
    // doors whose openings a change at the given vertices can touch
    const doorsNear = (vs: [number, number][]) => { const out = new Set<number>();
      for (const [i, j] of vs) for (const [di, dj] of [[0, 0], [-1, 0], [0, -1], [-1, -1]]) { const ii = i + di, jj = j + dj; if (ii < 0 || jj < 0 || ii >= W || jj >= this.H) continue;
        for (const e of [this.eh(ii, jj), this.ev(ii, jj)]) if (this.doors.has(e)) out.add(e); } return out; };
    const verts = (e: number): [number, number][] => { const d = this.doorEdge(e); return d.h ? [[d.i, d.j], [d.i + 1, d.j]] : [[d.i, d.j], [d.i, d.j + 1]]; };
    // the places joined through doors (a place's own cells join freely)
    const rdoors = new Map<number, Set<number>>();
    const link = (e: number, on: boolean) => { const [a, b] = cellsOf(e); for (const r of [region(a), region(b)]) { let x = rdoors.get(r); if (!x) rdoors.set(r, x = new Set()); if (on) x.add(e); else x.delete(e); } };
    for (const e of this.doors) link(e, true);
    const joined = (A: number, B: number) => { const seen = new Set([A]), q = [A];
      while (q.length && seen.size < 4000) { const r = q.pop()!; if (r === B) return true;
        for (const e of rdoors.get(r) ?? []) { const [a, b] = cellsOf(e); for (const x of [region(a), region(b)]) if (!seen.has(x)) { seen.add(x); q.push(x); } } }
      return seen.has(B); };
    const streetOf = new Map<number, Plot>(); for (const p of this.plots) if (p.door) streetOf.set(this.edgeBetween(p.door.cell, p.door.out), p);
    for (const e of [...this.doors].sort((x, y) => x - y)) {
      if (!this.doors.has(e) || this.doorClear(e) >= min) continue;
      const [a, b] = cellsOf(e), A = region(a), B = region(b), m0 = mid(e), street = streetOf.get(e), plot = this.cell[a] >= 0 ? this.cell[a] : this.cell[b];
      if (this.cell[a] >= 0 && this.cell[b] >= 0 && this.cell[a] !== this.cell[b]) { narrow++; continue; } // (a door between two plots: none in the plan)
      const d0 = this.doorEdge(e), cand: { e: number; k: number; kk: number; cls: number; dist: number }[] = [], seenE = new Set<number>();
      // the search: 6 cells round the door; a street door: the whole plot (its other edges on the street)
      const ci = a % W, cj = (a / W) | 0, R = street ? street.rect : null;
      const [I0, J0, I1, J1] = R ? [R[0] - 2, R[1] - 2, R[2] + 1, R[3] + 1] : [ci - 6, cj - 6, ci + 6, cj + 6];
      for (let j = Math.max(0, J0); j <= Math.min(this.H - 1, J1); j++) for (let i = Math.max(0, I0); i <= Math.min(W - 1, I1); i++) {
        const k = this.k(i, j), rk = region(k); if (rk !== A && rk !== B) continue;
        for (const [di, dj] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { const ii = i + di, jj = j + dj; if (!this.inb(ii, jj)) continue; const kk = this.k(ii, jj);
          if (!walkable(kk)) continue; const ne = this.edgeBetween(k, kk); if (ne === e || seenE.has(ne) || this.doors.has(ne) || this.noWall.has(ne) || !this.edgeWall(k, kk)) continue;
          const rx = region(kk); if (rx === rk) continue;
          const same = (rk === A && rx === B) || (rk === B && rx === A);
          if (!same) { const cx = this.cell[kk], ck = this.cell[k]; if (cx >= 0 ? cx !== plot : !(Site.open(this.cell[a]) || Site.open(this.cell[b]))) continue; if (ck >= 0 && cx >= 0 && ck !== cx) continue; }
          if (street && !(Site.open(this.cell[k]) || Site.open(this.cell[kk]))) continue; // a street door stays on the street
          seenE.add(ne); const dn = this.doorEdge(ne), m = mid(ne);
          const along = same && dn.h === d0.h && (d0.h ? dn.j === d0.j : dn.i === d0.i);
          cand.push({ e: ne, k, kk, cls: along ? 0 : same ? 1 : 2, dist: Math.hypot(m[0] - m0[0], m[1] - m0[1]) }); } }
      cand.sort((x, y) => x.cls - y.cls || x.dist - y.dist || x.e - y.e);
      let done = false;
      for (const c of cand) {
        if (inWay(c.e)) continue;
        const touched = doorsNear([...verts(e), ...verts(c.e)]); touched.delete(e);
        const before = new Map([...touched].map(x => [x, this.doorClear(x)]));
        link(e, false); this.doors.delete(e); this.doors.add(c.e); link(c.e, true);
        const ok = this.doorClear(c.e) >= min && [...before].every(([x, cl]) => this.doorClear(x) >= Math.min(cl, min)) && (c.cls < 2 || joined(A, B));
        if (!ok) { link(c.e, false); this.doors.delete(c.e); this.doors.add(e); link(e, true); continue; }
        if (street) { const [pc, oc] = this.cell[c.k] >= 0 ? [c.k, c.kk] : [c.kk, c.k]; street.door = { cell: pc, out: oc }; streetOf.delete(e); streetOf.set(c.e, street); }
        moves.push({ from: e, to: c.e, kind: c.cls === 0 ? 'along' : c.cls === 1 ? 'same' : 'other' }); done = true; break;
      }
      if (done) continue;
      // a doorway two cells wide where the two places meet along two cells only and a wall ends at either end (inner doors
      // only: a street door's leaf is one cell wide)
      if (!street) for (const c of cand) { if (c.cls !== 0 || c.dist > 1.01 || inWay(c.e)) continue;
        const touched = doorsNear(verts(c.e)); touched.delete(e); const before = new Map([...touched].map(x => [x, this.doorClear(x)]));
        this.doors.add(c.e); link(c.e, true);
        if (this.doorClear(e) >= min && [...before].every(([x, cl]) => this.doorClear(x) >= Math.min(cl, min))) { moves.push({ from: e, to: c.e, kind: 'widened' }); done = true; break; }
        link(c.e, false); this.doors.delete(c.e); }
      if (done) continue;
      // a door between two rooms of one house that no edge can carry (a room one cell wide, left over where the plan
      // absorbed ground: a closet no body stands in): the smaller room joins the larger, the partition and door go
      if (this.cell[a] >= 0 && this.cell[a] === this.cell[b] && this.sub[a] === ROOM && this.sub[b] === ROOM) {
        const ra = this.room[a], rb = this.room[b]; let na = 0, nb = 0; for (let k = 0; k < N; k++) { if (this.cell[k] !== plot || this.sub[k] !== ROOM) continue; if (this.room[k] === ra) na++; else if (this.room[k] === rb) nb++; }
        const [from, to] = na <= nb ? [ra, rb] : [rb, ra];
        link(e, false); this.doors.delete(e);
        for (let k = 0; k < N; k++) if (this.cell[k] === plot && this.room[k] === from) this.room[k] = to;
        rdoors.clear(); for (const x of this.doors) link(x, true);
        moves.push({ from: e, to: -1, kind: 'merged' }); continue;
      }
      // a room one cell wide (no 2 x 2 of its cells: no body stands in it) opening on a court or a lane through a narrowed
      // door: it joins the room of the house it shares most wall with, and the door goes when the places stay joined
      let fixed = false;
      for (const k of [a, b]) { if (this.cell[k] < 0 || this.sub[k] !== ROOM) continue; const rid = this.room[k], cells: number[] = [];
        for (let x = 0; x < N; x++) if (this.cell[x] === plot && this.sub[x] === ROOM && this.room[x] === rid) cells.push(x);
        const inR = (x: number) => this.cell[x] === plot && this.sub[x] === ROOM && this.room[x] === rid;
        if (cells.some(x => { const i = x % W, j = (x / W) | 0; return i + 1 < W && j + 1 < this.H && inR(x + 1) && inR(x + W) && inR(x + W + 1); })) continue;
        const shared = new Map<number, number>();
        for (const x of cells) { const i = x % W, j = (x / W) | 0; for (const [di, dj] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { if (!this.inb(i + di, j + dj)) continue; const y = this.k(i + di, j + dj);
          if (this.cell[y] === plot && this.sub[y] === ROOM && this.room[y] !== rid) shared.set(this.room[y], (shared.get(this.room[y]) ?? 0) + 1); } }
        const to = [...shared].sort((p, q) => q[1] - p[1] || p[0] - q[0])[0]?.[0]; if (to === undefined) continue;
        const other = region(k === a ? b : a);
        for (const x of cells) this.room[x] = to;
        rdoors.clear(); for (const x of this.doors) link(x, true);
        link(e, false); this.doors.delete(e);
        if (!joined(to, other)) { this.doors.add(e); link(e, true); }
        // doors of the closet into the room it joined are now inside one room
        for (const x of [...this.doors]) { const [p, q] = cellsOf(x); if (this.cell[p] === plot && this.cell[q] === plot && this.sub[p] === ROOM && this.sub[q] === ROOM && this.room[p] === this.room[q]) { link(x, false); this.doors.delete(x); } }
        if (!this.doors.has(e)) { moves.push({ from: e, to: -1, kind: 'merged' }); fixed = true; }
        break; }
      if (fixed) continue;
      narrow++;
    }
    // the small things in a doorway's way step aside along the wall (into the same place), else stay (counted)
    let stepped = 0, blocking = 0; const byCell = new Map<number, Fitting[]>();
    for (const f of this.fittings) if (MOVABLE.has(f.kind)) { const i = this.ci(f.u), j = this.cj(f.v); if (this.inb(i, j)) { const k = this.k(i, j); (byCell.get(k) ?? byCell.set(k, []).get(k)!).push(f); } }
    const doorsBy = [...this.doors].sort((x, y) => x - y), ways = doorsBy.map(passage);
    const wayIx = new Map<number, [P2, P2][]>(), wk = (u: number, v: number) => Math.floor(u / 2) * 100003 + Math.floor(v / 2);
    for (const ps of ways) { const m = [(ps[0][0] + ps[1][0]) / 2, (ps[0][1] + ps[1][1]) / 2]; for (let x = -1; x <= 1; x++) for (let y = -1; y <= 1; y++) { const key = wk(m[0] + 2 * x, m[1] + 2 * y); (wayIx.get(key) ?? wayIx.set(key, []).get(key)!).push(ps); } }
    const clearOf = (u: number, v: number) => (wayIx.get(wk(u, v)) ?? []).every(ps => segDist(u, v, ps) >= 0.65);
    for (const ps of ways) { const [p, q] = ps, tu = -(q[1] - p[1]), tv = q[0] - p[0];
      for (const k0 of [this.k(this.ci(p[0]), this.cj(p[1])), this.k(this.ci(q[0]), this.cj(q[1]))]) for (let dj = -1; dj <= 1; dj++) for (let di = -1; di <= 1; di++) {
        const i = (k0 % W) + di, j = ((k0 / W) | 0) + dj; if (!this.inb(i, j)) continue;
        for (const f of byCell.get(this.k(i, j)) ?? []) { if (segDist(f.u, f.v, ps) >= 0.65) continue;
          const lat = (f.u - p[0]) * tu + (f.v - p[1]) * tv, k = this.k(this.ci(f.u), this.cj(f.v)), c = this.cell[k], sb = this.sub[k];
          let moved = false;
          for (const sg of lat >= 0 ? [1, -1] : [-1, 1]) { const d = sg * 0.7 - lat, u = f.u + tu * d, v = f.v + tv * d, i2 = this.ci(u), j2 = this.cj(v);
            if (!this.inb(i2, j2) || this.cell[this.k(i2, j2)] !== c || this.sub[this.k(i2, j2)] !== sb || !clearOf(u, v)) continue;
            f.u = u; f.v = v; moved = true; stepped++; break; }
          // else the nearest spot of the same place within 2.5 m, clear of every doorway and of the other fittings
          if (!moved) for (const [du, dv] of SPIRAL) { const u = f.u + du, v = f.v + dv, i2 = this.ci(u), j2 = this.cj(v);
            if (!this.inb(i2, j2) || this.cell[this.k(i2, j2)] !== c || this.sub[this.k(i2, j2)] !== sb || !clearOf(u, v) || this.fittings.some(g => g !== f && Math.hypot(g.u - u, g.v - v) < 0.5)) continue;
            f.u = u; f.v = v; moved = true; stepped++; break; }
          if (!moved) blocking++; } } }
    return { moved: moves.length, narrow, moves, stepped, blocking };
  }
  /** all wall segments (runs of equal edges merged; corners closed: u-direction walls extend, v-direction walls trim; no
   *  wall reaches past a jamb into a door opening: D-249) */
  walls(): Wall[] {
    const { W, H } = this;
    type E = { kind: Wall['kind']; sides: { plot: number; top: number }[]; thick: number; door: boolean; key: number } | null;
    const hE: E[] = new Array(W * (H + 1)).fill(null), vE: E[] = new Array((W + 1) * H).fill(null);
    let nd = 0; const KI = { outer: 1, facade: 2, partition: 3, yard: 4 };
    // run signature: equal for edges of one wall run (same kind, thickness, plots and tops); every door is unique
    const key = (w: NonNullable<ReturnType<Site['edgeWall']>>, door: boolean) => { if (door) return -1 - nd++; let h = KI[w.kind] * 7919 + Math.round(w.thick * 1000);
      for (const sd of w.sides) { h = (Math.imul(h, 31) + sd.plot + 1) | 0; h = (Math.imul(h, 131) + Math.round(sd.top * 1000)) | 0; } return h >>> 0; };
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
      const ext0 = e.door || (i > 0 && hE[j * W + i - 1]?.door) ? 0 : hv[vk(i, j)], ext1 = e.door || (i1 < W && hE[j * W + i1]?.door) ? 0 : hv[vk(i1, j)];
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

/** offsets on a 0.25 m lattice within 2.5 m, nearest first (settleDoors) */
const SPIRAL: P2[] = (() => { const o: P2[] = []; for (let y = -10; y <= 10; y++) for (let x = -10; x <= 10; x++) if ((x || y) && x * x + y * y <= 100) o.push([x * 0.25, y * 0.25]); return o.sort((a, b) => a[0] ** 2 + a[1] ** 2 - b[0] ** 2 - b[1] ** 2 || a[0] - b[0] || a[1] - b[1]); })();

/** deterministic shuffle */
export function shuffle<T>(a: T[], rng: Rng) { for (let i = a.length - 1; i > 0; i--) { const j = rng.int(0, i); [a[i], a[j]] = [a[j], a[i]]; } return a; }
