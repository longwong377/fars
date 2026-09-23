// Walled compounds stamped onto a site raster (Phase 6): ranges of rooms around a court behind one gate (official
// building, stores, stables, way-station, estate houses), walled gardens and yards. All layouts are reconstruction (C);
// each caller states its basis. Pure data.
import { Rng } from '../../core/rng';
import { Site, Plot, PlotKind, Craft, OUT, LANE, FREE, ROOM, COURT, YARD } from './site';

const DIRS: [number, number][] = [[1, 0], [-1, 0], [0, 1], [0, -1]];
export type Side = 'S' | 'N' | 'W' | 'E'; // local −v, +v, −u, +u

export interface RingOpts {
  kind: PlotKind; id: string; row: string; feature: string; note: string;
  /** rect in cells [i0, j0, i1, j1) */
  rect: [number, number, number, number];
  depth: number | Partial<Record<Side, number>>; roomLen: [number, number];
  gate: Side; gateAt?: number; gateW?: number; height: number; parapet?: number; outerT?: number; capacity: number; craft?: Craft;
  /** court class: COURT (house-like) or YARD (work yard, stable yard) */
  open?: typeof COURT | typeof YARD;
}
/** a ring of rooms around an open court, one gate passage (a roofed gate room with doors both ends) */
export function ringCompound(s: Site, o: RingOpts, rng: Rng): Plot {
  const [i0, j0, i1, j1] = o.rect, w = i1 - i0, d = j1 - j0;
  const dep = (sd: Side) => typeof o.depth === 'number' ? o.depth : (o.depth[sd] ?? 0);
  const dS = dep('S'), dN = dep('N'), dW = dep('W'), dE = dep('E');
  const p = s.addPlot({ id: o.id, kind: o.kind, rect: [i0, j0, i1, j1], o: [i0, j0], t: [1, 0], n: [0, 1], w, d, door: null, court: true, height: o.height, parapet: o.parapet ?? 0.5,
    yardWall: 2.4, outerT: o.outerT ?? 0.9, row: o.row, feature: o.feature, note: o.note, capacity: o.capacity, craft: o.craft });
  const openC = o.open ?? COURT;
  for (let j = j0; j < j1; j++) for (let i = i0; i < i1; i++) { const k = s.k(i, j); s.cell[k] = p.idx;
    const inCourt = i >= i0 + dW && i < i1 - dE && j >= j0 + dS && j < j1 - dN; s.sub[k] = inCourt ? openC : ROOM; }
  // partition each range into rooms along its length (corners go to the S/N ranges)
  const cut = (cellsAt: (x: number) => number[], lo: number, hi: number) => { let x = lo; while (x < hi) { let L = rng.int(o.roomLen[0], o.roomLen[1]); if (hi - (x + L) < o.roomLen[0]) L = hi - x; const r = s.newRoom(); for (let y = x; y < x + L; y++) for (const k of cellsAt(y)) s.room[k] = r; x += L; } };
  const colCells = (i: number, ja: number, jb: number) => { const r: number[] = []; for (let j = ja; j < jb; j++) r.push(s.k(i, j)); return r; };
  const rowCells = (j: number, ia: number, ib: number) => { const r: number[] = []; for (let i = ia; i < ib; i++) r.push(s.k(i, j)); return r; };
  if (dS) cut(i => colCells(i, j0, j0 + dS), i0, i1);
  if (dN) cut(i => colCells(i, j1 - dN, j1), i0, i1);
  if (dW) cut(j => rowCells(j, i0, i0 + dW), j0 + dS, j1 - dN);
  if (dE) cut(j => rowCells(j, i1 - dE, i1), j0 + dS, j1 - dN);
  // gate: a passage room across the gate-side range, doors at both ends
  const gw = o.gateW ?? 3;
  const side = o.gate, along = side === 'S' || side === 'N' ? w : d, at = o.gateAt ?? Math.floor(along / 2 - gw / 2);
  const gr = s.newRoom();
  const range = side === 'S' ? dS : side === 'N' ? dN : side === 'W' ? dW : dE;
  for (let x = at; x < at + gw; x++) for (let y = 0; y < Math.max(1, range); y++) {
    const [i, j] = side === 'S' ? [i0 + x, j0 + y] : side === 'N' ? [i0 + x, j1 - 1 - y] : side === 'W' ? [i0 + y, j0 + x] : [i1 - 1 - y, j0 + x];
    const k = s.k(i, j); if (range > 0) { s.sub[k] = ROOM; s.room[k] = gr; }
    if (y === 0) { const [oi, oj] = side === 'S' ? [i, j - 1] : side === 'N' ? [i, j + 1] : side === 'W' ? [i - 1, j] : [i + 1, j]; if (s.inb(oi, oj) && Site.open(s.cell[s.k(oi, oj)])) { s.doors.add(s.edgeBetween(k, s.k(oi, oj))); if (!p.door) p.door = { cell: k, out: s.k(oi, oj) }; } }
    if (y === Math.max(1, range) - 1 && range > 0) { const [ci, cj] = side === 'S' ? [i, j + 1] : side === 'N' ? [i, j - 1] : side === 'W' ? [i + 1, j] : [i - 1, j]; s.doors.add(s.edgeBetween(k, s.k(ci, cj))); }
  }
  // every other room: one door onto the court at the middle of its court edge
  const rooms = new Map<number, number[]>();
  for (let j = j0; j < j1; j++) for (let i = i0; i < i1; i++) { const k = s.k(i, j); if (s.sub[k] === ROOM && s.room[k] !== gr) { const r = s.room[k]; if (!rooms.has(r)) rooms.set(r, []); rooms.get(r)!.push(k); } }
  for (const [rid, ks] of rooms) {
    const ce: [number, number][] = [], re: [number, number][] = [];
    for (const k of ks) { const i = k % s.W, j = (k / s.W) | 0; for (const [di, dj] of DIRS) { const ii = i + di, jj = j + dj; if (!s.inb(ii, jj)) continue; const kk = s.k(ii, jj); if (s.cell[kk] !== p.idx) continue;
      if (s.sub[kk] === COURT || s.sub[kk] === YARD) ce.push([k, kk]); else if (s.room[kk] !== rid) re.push([k, kk]); } }
    const e = ce.length ? ce[Math.floor(ce.length / 2)] : re[Math.floor(re.length / 2)]; if (e) s.doors.add(s.edgeBetween(e[0], e[1]));
  }
  return p;
}

/** a walled open enclosure (garden, orchard, pen, work yard) with one door on the given side */
export function yardCompound(s: Site, o: { kind: PlotKind; id: string; row: string; feature: string; note: string; rect: [number, number, number, number]; wall: number; outerT?: number; gate: Side; gateAt?: number; gateW?: number; capacity?: number; craft?: Craft }): Plot {
  const [i0, j0, i1, j1] = o.rect;
  const p = s.addPlot({ id: o.id, kind: o.kind, rect: o.rect, o: [i0, j0], t: [1, 0], n: [0, 1], w: i1 - i0, d: j1 - j0, door: null, court: false, height: 0, parapet: 0, yardWall: o.wall, outerT: o.outerT ?? 0.6,
    row: o.row, feature: o.feature, note: o.note, capacity: o.capacity ?? 0, craft: o.craft });
  for (let j = j0; j < j1; j++) for (let i = i0; i < i1; i++) { const k = s.k(i, j); s.cell[k] = p.idx; s.sub[k] = YARD; }
  const gw = o.gateW ?? 2, side = o.gate, along = side === 'S' || side === 'N' ? i1 - i0 : j1 - j0, at = o.gateAt ?? Math.floor(along / 2 - gw / 2);
  for (let x = at; x < at + gw; x++) {
    const [i, j, oi, oj] = side === 'S' ? [i0 + x, j0, i0 + x, j0 - 1] : side === 'N' ? [i0 + x, j1 - 1, i0 + x, j1] : side === 'W' ? [i0, j0 + x, i0 - 1, j0 + x] : [i1 - 1, j0 + x, i1, j0 + x];
    if (!s.inb(oi, oj) || !Site.open(s.cell[s.k(oi, oj)])) continue;
    const k = s.k(i, j), ko = s.k(oi, oj); s.doors.add(s.edgeBetween(k, ko)); if (!p.door) p.door = { cell: k, out: ko };
  }
  return p;
}

/** carve a rectangle of rooms inside an existing plot (a house block inside an estate or a pavilion wall block) */
export function roomBlock(s: Site, p: Plot, rect: [number, number, number, number], roomLen: [number, number], rng: Rng, courtRect?: [number, number, number, number], doorSide?: Side) {
  const [i0, j0, i1, j1] = rect;
  for (let j = j0; j < j1; j++) for (let i = i0; i < i1; i++) { const k = s.k(i, j); const c = courtRect && i >= courtRect[0] && i < courtRect[2] && j >= courtRect[1] && j < courtRect[3]; s.sub[k] = c ? COURT : ROOM; }
  // rooms: rows of cells between court and edge, split along their length
  const cells: number[] = []; for (let j = j0; j < j1; j++) for (let i = i0; i < i1; i++) if (s.sub[s.k(i, j)] === ROOM) cells.push(s.k(i, j));
  // simple partition: strips of roomLen along i, full height between edge and court
  let x = i0; while (x < i1) { const L = Math.min(i1 - x, rng.int(roomLen[0], roomLen[1])); const top = s.newRoom(), bot = s.newRoom();
    for (let i = x; i < x + L; i++) for (let j = j0; j < j1; j++) { const k = s.k(i, j); if (s.sub[k] !== ROOM) continue; const above = courtRect ? j >= courtRect[3] : j >= (j0 + j1) / 2; s.room[k] = above ? top : bot; }
    x += L; }
  // doors: each room onto the court, else onto the surrounding open plot area
  const rooms = new Map<number, number[]>(); for (const k of cells) { const r = s.room[k]; if (!rooms.has(r)) rooms.set(r, []); rooms.get(r)!.push(k); }
  for (const [rid, ks] of rooms) {
    const opts: [number, number, number][] = [];
    for (const k of ks) { const i = k % s.W, j = (k / s.W) | 0; for (const [di, dj] of DIRS) { const ii = i + di, jj = j + dj; if (!s.inb(ii, jj)) continue; const kk = s.k(ii, jj); if (s.cell[kk] !== p.idx) continue;
      if (s.sub[kk] === COURT) opts.push([k, kk, 0]); else if (s.sub[kk] === YARD) opts.push([k, kk, 1]); else if (s.room[kk] !== rid) opts.push([k, kk, 2]); } }
    opts.sort((a, b) => a[2] - b[2]); const best = opts.filter(o => o[2] === opts[0]?.[2]);
    const e = best[Math.floor(best.length / 2)]; if (e) s.doors.add(s.edgeBetween(e[0], e[1]));
  }
  void doorSide;
}

/** mark every cell outside all plots as open ground (compound sites stand in the open plain) */
export function openGround(s: Site) { for (let k = 0; k < s.cell.length; k++) if (s.cell[k] === FREE) s.cell[k] = OUT; }
export { LANE, OUT, FREE };
