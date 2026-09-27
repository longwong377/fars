// Rows of rooms (D-276): the Terrace's interiors that are ranges of like rooms: the Treasury's store rooms and columned
// halls beyond the Hall of 99 Columns, the Harem's apartments and service rooms, the garrison's quarters and the royal
// guard's mess. A range (SITE_SPEC <building>.room_ranges) is a rectangular block of rooms in a row: outer faces x, y; split
// along `axis` at cross-wall centrelines (`cuts`) or into `n` equal rooms; each room's doorway on the range's `door` side
// unless the room says otherwise (`units`); sides in `omit` carry no wall (a neighbour's or the enclosure's stands there;
// `into` are those whose face is the enclosure's, into which the block's walls run a wall thickness because the traced
// faces are not quite straight); sides in `open` stand open on a row of posts. A room may have a back room behind a
// partition (the apartments' inner rooms) and posts under its roof. Every range is roofed.
// The layout is pure data → walls (plan_walls.ts PlanWall rectangles and PlanOpening doorways, built by buildPlanWalls),
// rooms (interiors, doorways, posts) and the rooms' fittings by use (roomFittings): the same function places the drawn
// mats, jars and hearths (world/furnish.ts), the fires (world/firePlaces.ts) and the people's sleeping and working places
// (people/popgeo.ts), so a sleeper lies on a drawn mat and a storekeeper stands at a drawn bench, off the aisles.
// No dimension is written here: every size comes from SITE_SPEC rows (the literal lint in tests/arch.test.ts covers this file).
import type { Pt } from './parts';
import type { PlanWall, PlanOpening, Side } from './plan_walls';

export type RoomUse = 'store' | 'quarters' | 'apartment' | 'service' | 'mess' | 'hall' | 'passage';
/** a doorway of a room: on its side `side`, centred at `at` along that wall (default: the room's middle); `via`: the doorway is a
 *  neighbour's, in the wall the neighbour stands on (the room only keeps its approach clear), of width `width` */
export interface RangeDoor { side: Side; at?: number; via?: boolean; width?: number }
export interface RangeUnit { use?: RoomUse; doors?: RangeDoor[]; columns?: [number, number]; back?: number }
export interface RoomRange {
  id: string; use: RoomUse; x: [number, number]; y: [number, number]; axis: 'x' | 'y'; cuts?: number[]; n?: number; door: Side;
  omit?: Side[]; into?: Side[]; open?: Side[]; columns?: [number, number]; back?: number; units?: Record<string, RangeUnit>; hall?: boolean; note?: string;
  /** the range's own floor (m above the court datum) where it stands outside its building's raised floor */ floor?: number;
}
export interface RoomDims { wall: number; clear: number; roof: number; hall_clear?: number; hall_roof?: number; post: number; door_width: number; door_height: number; inner_width: number; inner_height: number }
export interface RoomFit {
  mat: [number, number]; mat_t: number; mat_gap: number; wall_gap: number; door_clear: number; approach: number; aisle: number;
  hearth_r: number; hearth_clear: number; hearth_places: number; mess_places: number; post_clear: number; lamp_h: number; ledge: [number, number, number];
  jar_r: number; jar_h: number; jar_pitch: number; jars_quarters: number; jars_store: number; jars_service: number; mats_apartment: number;
  quern: [number, number]; querns_service: number; bench: { height: number; depth: number; gap: number }; work_off: number; work_pitch: number;
}
type Rect = { x: [number, number]; y: [number, number] };
/** a doorway of a room: centre on the wall's mid-plane, unit normal into the room, along the wall, clear width, the wall's
 *  thickness */
export interface RoomDoor { c: Pt; n: Pt; u: Pt; width: number; depth: number }
export interface Room extends Rect {
  id: string; range: string; building: string; use: RoomUse; back?: Rect; doors: RoomDoor[]; backDoor?: RoomDoor; posts: Pt[]; open: Side[];
  /** the room's sides on the block's edge with no wall of the range's own (omitted: a neighbour's or the enclosure's; open) */ bare: Side[];
  /** floor and clear height (m above the court datum / above the floor) */ fl: number; clear: number;
}
export interface RangeRoof extends Rect { id: string; y0: number; y1: number }
export interface RangeBuild { walls: PlanWall[]; openings: PlanOpening[]; rooms: Room[]; roofs: RangeRoof[]; posts: { c: Pt; range: string; clear: number }[] }

const NORMAL: Record<Side, Pt> = { N: [0, 1], S: [0, -1], E: [1, 0], W: [-1, 0] };
const OPP: Record<Side, Side> = { N: 'S', S: 'N', E: 'W', W: 'E' };
const mid = (a: [number, number]) => (a[0] + a[1]) / 2;
/** heading, radians clockwise from grid north, of the direction (de, dn) */
const headingOf = (de: number, dn: number) => Math.atan2(de, dn);
// tolerance for coincident faces (a structural constant, not a dimension)
const EPS = Math.sqrt(Number.EPSILON);

/** the walls, doorways, rooms, roofs and posts of a building's ranges (floor `fl`) */
export function planRanges(b: string, ranges: RoomRange[], D: RoomDims, fl0: number): RangeBuild {
  const out: RangeBuild = { walls: [], openings: [], rooms: [], roofs: [], posts: [] };
  const t = D.wall;
  for (const R of ranges) {
    const fl = R.floor ?? fl0;
    const omit = new Set(R.omit ?? []), into = new Set(R.into ?? []), open = new Set(R.open ?? []);
    for (const s of into) if (!omit.has(s)) throw new Error(`${b}.${R.id}: into ${s} must also be omitted`);
    const has = (s: Side) => !omit.has(s) && !open.has(s), ov = (s: Side) => (into.has(s) ? t : 0);
    const [x0, x1] = R.x, [y0, y1] = R.y;
    const ix: [number, number] = [x0 + (has('W') ? t : 0), x1 - (has('E') ? t : 0)], iy: [number, number] = [y0 + (has('S') ? t : 0), y1 - (has('N') ? t : 0)];
    const W = (id: string, x: [number, number], y: [number, number]) => { const w = { id: `${R.id}_${id}`, x, y }; if (x[1] - x[0] > 0 && y[1] - y[0] > 0) out.walls.push(w); return w; };
    if (has('N')) W('N', [x0 - ov('W'), x1 + ov('E')], [y1 - t, y1]);
    if (has('S')) W('S', [x0 - ov('W'), x1 + ov('E')], [y0, y0 + t]);
    if (has('W')) W('W', [x0, x0 + t], [has('S') ? y0 + t : y0 - ov('S'), has('N') ? y1 - t : y1 + ov('N')]);
    if (has('E')) W('E', [x1 - t, x1], [has('S') ? y0 + t : y0 - ov('S'), has('N') ? y1 - t : y1 + ov('N')]);
    // the rooms along the axis
    const ax = R.axis === 'x', [i0, i1] = ax ? ix : iy;
    let cuts = R.cuts;
    if (!cuts) { const n = R.n ?? 1, L = (i1 - i0 - (n - 1) * t) / n; cuts = Array.from({ length: n - 1 }, (_, k) => i0 + (k + 1) * L + k * t + t / 2); }
    const n = cuts.length + 1;
    cuts.forEach((c, k) => ax ? W(`c${k}`, [c - t / 2, c + t / 2], [has('S') ? iy[0] : y0 - ov('S'), has('N') ? iy[1] : y1 + ov('N')])
      : W(`c${k}`, [has('W') ? ix[0] : x0 - ov('W'), has('E') ? ix[1] : x1 + ov('E')], [c - t / 2, c + t / 2]));
    const clear = R.hall ? (D.hall_clear ?? D.clear) : D.clear, roof = R.hall ? (D.hall_roof ?? D.roof) : D.roof;
    for (let k = 0; k < n; k++) {
      const a0 = k === 0 ? i0 : cuts[k - 1] + t / 2, a1 = k === n - 1 ? i1 : cuts[k] - t / 2;
      if (a1 - a0 <= 0) throw new Error(`${b}.${R.id}: room ${k} has no length`);
      const U = R.units?.[String(k)] ?? {}, use = U.use ?? R.use, doors = U.doors ?? [{ side: R.door }], back = U.back ?? R.back ?? 0, cols = U.columns ?? R.columns ?? [0, 0];
      const unit: Rect = ax ? { x: [a0, a1], y: [...iy] as [number, number] } : { x: [...ix] as [number, number], y: [a0, a1] };
      // the back room: behind a partition parallel to the first doorway's wall, on the far side
      let main: Rect = unit, backR: Rect | undefined, backDoor: RoomDoor | undefined;
      const d0 = doors[0]?.side ?? R.door;
      if (back > 0) {
        const bs = OPP[d0], p: Rect = { x: [...unit.x] as [number, number], y: [...unit.y] as [number, number] };
        const b2: Rect = { x: [...unit.x] as [number, number], y: [...unit.y] as [number, number] }, m2: Rect = { x: [...unit.x] as [number, number], y: [...unit.y] as [number, number] };
        if (bs === 'W') { b2.x = [unit.x[0], unit.x[0] + back]; p.x = [b2.x[1], b2.x[1] + t]; m2.x = [p.x[1], unit.x[1]]; }
        if (bs === 'E') { b2.x = [unit.x[1] - back, unit.x[1]]; p.x = [b2.x[0] - t, b2.x[0]]; m2.x = [unit.x[0], p.x[0]]; }
        if (bs === 'S') { b2.y = [unit.y[0], unit.y[0] + back]; p.y = [b2.y[1], b2.y[1] + t]; m2.y = [p.y[1], unit.y[1]]; }
        if (bs === 'N') { b2.y = [unit.y[1] - back, unit.y[1]]; p.y = [b2.y[0] - t, b2.y[0]]; m2.y = [unit.y[0], p.y[0]]; }
        const pw = W(`b${k}`, p.x, p.y), along = bs === 'W' || bs === 'E' ? mid(unit.y) : mid(unit.x);
        out.openings.push({ id: `${R.id}_${k}_back`, wall: pw.id, at: along, width: D.inner_width, kind: 'gap', side: bs, h: 'inner' });
        const n2 = NORMAL[bs], vert = bs === 'W' || bs === 'E';
        backDoor = { c: vert ? [mid(p.x), along] : [along, mid(p.y)], n: n2, u: vert ? [0, 1] : [1, 0], width: D.inner_width, depth: t };
        main = m2; backR = b2;
      }
      // doorways: in the outer wall of that side, or in the cross wall to the neighbouring room
      const roomDoors: RoomDoor[] = [];
      for (const d of doors) {
        const s = d.side, vert0 = s === 'W' || s === 'E', nIn0 = NORMAL[OPP[s]];
        // a doorway in the wall a neighbour stands on (the hall's own doorway into a side room): no opening made here, but the
        // room keeps its approach clear
        if (d.via) { const at = d.at ?? (vert0 ? mid(main.y) : mid(main.x)), face = s === 'E' ? unit.x[1] : s === 'W' ? unit.x[0] : s === 'N' ? unit.y[1] : unit.y[0];
          roomDoors.push({ c: vert0 ? [face - nIn0[0] * t / 2, at] : [at, face - nIn0[1] * t / 2], n: nIn0, u: vert0 ? [0, 1] : [1, 0], width: d.width ?? D.door_width, depth: t }); continue; }
        const end = ax ? (s === 'E' ? (k === n - 1 ? 'E' : `c${k}`) : s === 'W' ? (k === 0 ? 'W' : `c${k - 1}`) : s)
          : (s === 'N' ? (k === n - 1 ? 'N' : `c${k}`) : s === 'S' ? (k === 0 ? 'S' : `c${k - 1}`) : s);
        const wid = `${R.id}_${end}`, w = out.walls.find(q => q.id === wid);
        if (!w) throw new Error(`${b}.${R.id}: room ${k} has a doorway on side ${s} where no wall stands`);
        const vert = s === 'W' || s === 'E', at = d.at ?? (vert ? mid(main.y) : mid(main.x));
        out.openings.push({ id: `${R.id}_${k}_${s}`, wall: wid, at, width: D.door_width, kind: 'gap', side: OPP[s], h: 'door' });
        const nIn = NORMAL[OPP[s]];
        roomDoors.push({ c: vert ? [mid(w.x), at] : [at, mid(w.y)], n: nIn, u: vert ? [0, 1] : [1, 0], width: D.door_width, depth: t });
      }
      // posts under the roof, evenly in the main room (in the whole room: a back room's partition stands clear of them)
      const posts: Pt[] = [];
      for (let i = 0; i < cols[0]; i++) for (let j = 0; j < cols[1]; j++) posts.push([main.x[0] + (i + 0.5) * (main.x[1] - main.x[0]) / cols[0], main.y[0] + (j + 0.5) * (main.y[1] - main.y[0]) / cols[1]]);
      // an open side: posts along its edge, no further apart than the room's clear height
      for (const s of open) {
        const vert = s === 'W' || s === 'E', [q0, q1] = vert ? unit.y : unit.x, m = Math.max(1, Math.ceil((q1 - q0) / clear));
        const e = s === 'N' ? unit.y[1] - D.post : s === 'S' ? unit.y[0] + D.post : s === 'E' ? unit.x[1] - D.post : unit.x[0] + D.post;
        for (let i = 0; i <= m; i++) { const q = q0 + D.post + (q1 - q0 - 2 * D.post) * i / m; posts.push(vert ? [e, q] : [q, e]); }
      }
      for (const c of posts) out.posts.push({ c, range: R.id, clear });
      const edge = (s: Side) => (ax ? (s === 'N' || s === 'S' || (s === 'W' && k === 0) || (s === 'E' && k === n - 1)) : (s === 'E' || s === 'W' || (s === 'S' && k === 0) || (s === 'N' && k === n - 1)));
      const bare = (['N', 'S', 'E', 'W'] as Side[]).filter(s => edge(s) && !has(s));
      out.rooms.push({ id: `${R.id}:${k}`, range: R.id, building: b, use, x: main.x, y: main.y, back: backR, doors: roomDoors, backDoor, posts, open: [...open], bare, fl, clear });
    }
    out.roofs.push({ id: R.id, x: [x0 - ov('W'), x1 + ov('E')], y: [y0 - ov('S'), y1 + ov('N')], y0: fl + clear, y1: fl + clear + roof });
  }
  return out;
}

// ---------------------------------------------------------------- fittings by use
export interface Fittings {
  /** reed mats: centre, size along x and y */ mats: { c: Pt; size: [number, number] }[];
  benches: { c: Pt; size: [number, number]; top: number }[];
  jars: Pt[]; querns: Pt[]; hearths: Pt[];
  /** saucer lamp on a ledge: the lamp's point, the wall's inward normal */ lamps: { c: Pt; n: Pt }[];
  /** where a person lies to sleep (on a mat, head to the wall): e, n, heading (radians clockwise from grid north, toward the head) */ sleep: [number, number, number][];
  /** where a person stands or sits to work (before a bench, at a quern, by the hearth), facing the work */ work: [number, number, number][];
}
const ovl = (a: Rect, b: Rect, m = 0) => a.x[0] < b.x[1] + m && a.x[1] > b.x[0] - m && a.y[0] < b.y[1] + m && a.y[1] > b.y[0] - m;
const rectAt = (c: Pt, s: [number, number]): Rect => ({ x: [c[0] - s[0] / 2, c[0] + s[0] / 2], y: [c[1] - s[1] / 2, c[1] + s[1] / 2] });
const inRect = (r: Rect, p: Pt) => p[0] > r.x[0] && p[0] < r.x[1] && p[1] > r.y[0] && p[1] < r.y[1];

/** the zones of a room kept clear of fittings and of people standing: each doorway's leaf sweep along the wall and its
 *  approach strip into the room (the aisle) */
export function keepClear(room: Room, F: RoomFit): Rect[] {
  const out: Rect[] = [];
  for (const d of [...room.doors, ...(room.backDoor ? [{ ...room.backDoor, n: [-room.backDoor.n[0], -room.backDoor.n[1]] as Pt }] : [])]) {
    const face: Pt = [d.c[0] + d.n[0] * d.depth / 2, d.c[1] + d.n[1] * d.depth / 2];
    // the leaf sweep: a leaf of half the width turning through the room on each side of the opening
    const sweep = d.width + F.door_clear, reach = d.width / 2 + F.door_clear;
    const strip = (along: number, deep: number): Rect => { const p0: Pt = [face[0] - d.u[0] * along, face[1] - d.u[1] * along], p1: Pt = [face[0] + d.u[0] * along + d.n[0] * deep, face[1] + d.u[1] * along + d.n[1] * deep];
      return { x: [Math.min(p0[0], p1[0]), Math.max(p0[0], p1[0])], y: [Math.min(p0[1], p1[1]), Math.max(p0[1], p1[1])] }; };
    out.push(strip(sweep, reach), strip(d.width / 2 + F.aisle / 2, F.approach));
  }
  return out;
}

/** the hearth of a room: its centre, or half a post pitch along its long side from there, clear of the posts */
function hearthOf(r: Rect, posts: Pt[], F: RoomFit): Pt | null {
  const c: Pt = [mid(r.x), mid(r.y)], lx = r.x[1] - r.x[0] >= r.y[1] - r.y[0];
  const pitch = posts.length > 1 ? Math.min(...posts.flatMap(p => posts.filter(q => q !== p).map(q => Math.hypot(q[0] - p[0], q[1] - p[1])))) : 0;
  for (const s of [0, 0.5, -0.5, 1, -1]) { const h: Pt = lx ? [c[0] + s * pitch, c[1]] : [c[0], c[1] + s * pitch];
    if (inRect(r, h) && posts.every(p => Math.hypot(p[0] - h[0], p[1] - h[1]) >= F.post_clear + F.hearth_r * 2)) return h; }
  return null;
}

/** mats laid over a rect: rows along its walls (head to the wall), then double rows (head to head) down the middle where
 *  the aisles leave room, none in a kept-clear zone, on a post, by the hearth or on a jar */
function layMats(r: Rect, F: RoomFit, clear: Rect[], posts: Pt[], hearth: Pt | null, jars: Pt[], out: Fittings) {
  const [w, L] = F.mat, pitch = w + F.mat_gap, taken: Rect[] = [];
  const free = (m: Rect) => !clear.some(z => ovl(z, m)) && !posts.some(p => ovl(m, rectAt(p, [F.post_clear * 2, F.post_clear * 2]))) && !taken.some(q => ovl(q, m, F.mat_gap / 2))
    && !(hearth && ovl(m, rectAt(hearth, [F.hearth_clear * 2, F.hearth_clear * 2]))) && !jars.some(j => ovl(m, rectAt(j, [F.jar_r * 2 + F.wall_gap, F.jar_r * 2 + F.wall_gap])));
  const put = (c: Pt, alongX: boolean, head: Pt) => { const size: [number, number] = alongX ? [L, w] : [w, L], m = rectAt(c, size); if (m.x[0] < r.x[0] - EPS || m.y[0] < r.y[0] - EPS || m.x[1] > r.x[1] + EPS || m.y[1] > r.y[1] + EPS || !free(m)) return;
    taken.push(m); out.mats.push({ c, size }); out.sleep.push([c[0], c[1], headingOf(head[0], head[1])]); };
  const lx = r.x[1] - r.x[0] >= r.y[1] - r.y[0]; // the long side runs along x
  // along the two long walls first, then the short walls
  const walls: [Side, number][] = lx ? [['N', 0], ['S', 0], ['E', 0], ['W', 0]] : [['E', 0], ['W', 0], ['N', 0], ['S', 0]];
  for (const [s] of walls) {
    const vert = s === 'E' || s === 'W', [q0, q1] = vert ? r.y : r.x, m = Math.floor((q1 - q0 - F.wall_gap * 2) / pitch);
    for (let i = 0; i < m; i++) { const q = q0 + F.wall_gap + pitch * (i + 0.5) + (q1 - q0 - F.wall_gap * 2 - m * pitch) / 2;
      const off = F.wall_gap + L / 2, c: Pt = s === 'N' ? [q, r.y[1] - off] : s === 'S' ? [q, r.y[0] + off] : s === 'E' ? [r.x[1] - off, q] : [r.x[0] + off, q];
      put(c, vert, NORMAL[s]); }
  }
  // double rows down the middle, head to head, where the across span leaves an aisle either side
  const across = lx ? r.y[1] - r.y[0] : r.x[1] - r.x[0], band = across - 2 * (F.wall_gap + L), k = Math.floor((band - F.aisle) / (2 * L + F.mat_gap + F.aisle));
  for (let j = 0; j < k; j++) {
    const cc = (lx ? r.y[0] : r.x[0]) + F.wall_gap + L + F.aisle + (band - F.aisle - k * (2 * L + F.mat_gap + F.aisle)) / 2 + j * (2 * L + F.mat_gap + F.aisle) + L + F.mat_gap / 2;
    const [q0, q1] = lx ? r.x : r.y, m = Math.floor((q1 - q0 - 2 * (F.wall_gap + L) - 2 * F.aisle) / pitch);
    for (let i = 0; i < m; i++) { const q = q0 + F.wall_gap + L + F.aisle + pitch * (i + 0.5);
      for (const sg of [-1, 1]) { const off = sg * (L + F.mat_gap) / 2; put(lx ? [q, cc + off] : [cc + off, q], !lx, lx ? [0, -sg] : [-sg, 0]); } }
  }
}

/** benches along the walls of a rect except in the kept-clear zones (gap at each corner), with the working places before them */
function layBenches(r: Rect, F: RoomFit, clear: Rect[], sides: Side[], fl: number, out: Fittings) {
  const B = F.bench;
  for (const s of sides) {
    const vert = s === 'E' || s === 'W', [q0, q1] = vert ? r.y : r.x, e = s === 'N' ? r.y[1] - B.depth / 2 : s === 'S' ? r.y[0] + B.depth / 2 : s === 'E' ? r.x[1] - B.depth / 2 : r.x[0] + B.depth / 2;
    // the free runs along this wall between the corners (a bench depth plus the gap) and the clear zones
    const lo = q0 + B.depth + B.gap, hi = q1 - B.depth - B.gap; if (hi - lo < B.gap) continue;
    const cuts: [number, number][] = [];
    for (const z of clear) { const band: Rect = vert ? { x: [e - B.depth / 2, e + B.depth / 2], y: [lo, hi] } : { x: [lo, hi], y: [e - B.depth / 2, e + B.depth / 2] };
      if (ovl(z, band)) cuts.push(vert ? [z.y[0] - B.gap / 2, z.y[1] + B.gap / 2] : [z.x[0] - B.gap / 2, z.x[1] + B.gap / 2]); }
    cuts.sort((a, b) => a[0] - b[0]);
    let a = lo; const runs: [number, number][] = [];
    for (const [c0, c1] of cuts) { if (c0 > a) runs.push([a, Math.min(c0, hi)]); a = Math.max(a, c1); }
    if (a < hi) runs.push([a, hi]);
    for (const [u0, u1] of runs) { if (u1 - u0 < B.gap) continue; const c: Pt = vert ? [e, (u0 + u1) / 2] : [(u0 + u1) / 2, e], size: [number, number] = vert ? [B.depth, u1 - u0] : [u1 - u0, B.depth];
      out.benches.push({ c, size, top: fl + B.height });
      const nIn: Pt = [-NORMAL[s][0], -NORMAL[s][1]], m = Math.max(1, Math.floor((u1 - u0) / F.work_pitch));
      for (let i = 0; i < m; i++) { const q = u0 + (u1 - u0) * (i + 0.5) / m, p: Pt = vert ? [e + nIn[0] * (B.depth / 2 + F.work_off), q] : [q, e + nIn[1] * (B.depth / 2 + F.work_off)];
        if (!clear.some(z => inRect(z, p))) out.work.push([p[0], p[1], headingOf(-nIn[0], -nIn[1])]); } }
  }
}

/** jars in a row along the wall a room's first doorway is in, beside the doorway's leaf sweep (none where they would not fit) */
function layJars(r: Rect, room: Room, F: RoomFit, clear: Rect[], count: number, out: Fittings, taken: Rect[] = []): Pt[] {
  const got: Pt[] = []; const d = room.doors[0]; if (!d || count <= 0) return got;
  const vert = Math.abs(d.u[1]) > Math.abs(d.u[0]), off = F.wall_gap + F.jar_r;
  // the line of the door wall's inner face, moved in by the jar
  const line = vert ? (d.n[0] > 0 ? r.x[0] + off : r.x[1] - off) : (d.n[1] > 0 ? r.y[0] + off : r.y[1] - off);
  const [q0, q1] = vert ? r.y : r.x;
  for (const dir of [1, -1]) {
    for (let q = dir > 0 ? q1 - off : q0 + off; got.length < count && (dir > 0 ? q > q0 + off : q < q1 - off); q -= dir * F.jar_pitch) {
      const p: Pt = vert ? [line, q] : [q, line], jr = rectAt(p, [F.jar_r * 2, F.jar_r * 2]);
      if (clear.some(z => ovl(z, jr)) || taken.some(z => ovl(z, jr))) break;
      got.push(p);
    }
    if (got.length >= count) break;
  }
  out.jars.push(...got); return got;
}

/** the fittings of a room by its use (all C: the types from the town's houses and MATERIAL_CULTURE; their number and places
 *  by rule, here) */
export function roomFittings(room: Room, F: RoomFit): Fittings {
  const out: Fittings = { mats: [], benches: [], jars: [], querns: [], hearths: [], lamps: [], sleep: [], work: [] };
  const clear = keepClear(room, F), main: Rect = { x: room.x, y: room.y };
  const d = room.doors[0], doorSide: Side | null = d ? (Math.abs(d.u[1]) > Math.abs(d.u[0]) ? (d.n[0] > 0 ? 'W' : 'E') : (d.n[1] > 0 ? 'S' : 'N')) : null;
  // the lamp's ledge on a wall of the room's own (a neighbour's or the enclosure's face is not quite where the plan puts it)
  const lamp = (r: Rect, s0: Side) => { const s = !room.bare.includes(s0) ? s0 : ((['N', 'S', 'E', 'W'] as Side[]).find(q => q !== s0 && q !== OPP[s0] && !room.bare.includes(q) && !room.doors.some(d => (d.n[0] === -NORMAL[q][0] && d.n[1] === -NORMAL[q][1]))) ?? s0); const n = NORMAL[OPP[s]], c: Pt = s === 'N' ? [mid(r.x), r.y[1]] : s === 'S' ? [mid(r.x), r.y[0]] : s === 'E' ? [r.x[1], mid(r.y)] : [r.x[0], mid(r.y)];
    out.lamps.push({ c: [c[0] + n[0] * F.ledge[1] / 2, c[1] + n[1] * F.ledge[1] / 2], n }); };
  const back = doorSide ? OPP[doorSide] : 'N';
  switch (room.use) {
    case 'quarters': case 'service': {
      const h = hearthOf(main, room.posts, F); if (h) out.hearths.push(h);
      if (h) for (let i = 0; i < F.hearth_places; i++) { const a = (i + 0.5) * 2 * Math.PI / F.hearth_places; const p: Pt = [h[0] + Math.cos(a) * (F.hearth_r + F.work_off * 2), h[1] + Math.sin(a) * (F.hearth_r + F.work_off * 2)]; if (!clear.some(z => inRect(z, p))) out.work.push([p[0], p[1], headingOf(h[0] - p[0], h[1] - p[1])]); }
      const jars = layJars(main, room, F, clear, room.use === 'service' ? F.jars_service : F.jars_quarters, out);
      lamp(main, back);
      if (room.use === 'service') { // querns beside the hearth, across the room from the jars (C)
        if (h) for (let i = 0; i < F.querns_service; i++) { const p: Pt = Math.abs(main.x[1] - main.x[0]) >= Math.abs(main.y[1] - main.y[0]) ? [h[0] + (i + 1) * (F.hearth_clear + F.quern[0]), h[1]] : [h[0], h[1] + (i + 1) * (F.hearth_clear + F.quern[0])];
          if (inRect(main, p) && !clear.some(z => inRect(z, p))) { out.querns.push(p); out.work.push([p[0], p[1] - F.quern[1], headingOf(0, 1)]); } }
      } else layMats(main, F, clear, room.posts, h, jars, out);
      break; }
    case 'apartment': {
      layJars(main, room, F, clear, F.jars_quarters - 1, out);
      if (room.back) { layMats(room.back, F, keepClear(room, F), [], null, [], out); lamp(room.back, back); }
      else { layMats(main, F, clear, room.posts, null, out.jars, out); lamp(main, back); }
      // a household's sleeping places, not a dormitory: the lady, her children and her women (C)
      out.mats.length = Math.min(out.mats.length, F.mats_apartment); out.sleep.length = Math.min(out.sleep.length, F.mats_apartment);
      break; }
    case 'store': case 'hall': {
      const sides = (['N', 'S', 'E', 'W'] as Side[]).filter(s => !room.open.includes(s));
      layBenches(main, F, clear, room.use === 'store' && doorSide ? sides.filter(s => s !== doorSide) : sides, room.fl, out);
      if (room.use === 'store') { // big jars down the middle where the room is wide enough to walk round them (C)
        const lx = main.x[1] - main.x[0] >= main.y[1] - main.y[0], across = lx ? main.y[1] - main.y[0] : main.x[1] - main.x[0];
        if (across >= 2 * (F.bench.depth + F.work_off + F.aisle) + 2 * F.jar_r) { const [q0, q1] = lx ? main.x : main.y, c = lx ? mid(main.y) : mid(main.x);
          const m = Math.min(F.jars_store, Math.floor((q1 - q0 - 2 * (F.bench.depth + F.aisle)) / F.jar_pitch));
          for (let i = 0; i < m; i++) { const q = mid([q0, q1]) + (i - (m - 1) / 2) * F.jar_pitch, p: Pt = lx ? [q, c] : [c, q]; if (!clear.some(z => ovl(z, rectAt(p, [F.jar_r * 2, F.jar_r * 2])))) out.jars.push(p); } }
      }
      break; }
    case 'mess': {
      layBenches(main, F, clear, [OPP[room.open[0] ?? 'S']], room.fl, out);
      const lx = main.x[1] - main.x[0] >= main.y[1] - main.y[0];
      // one fire in the middle of each half of the hall
      for (const f of [-1, 1]) { const halfX = (main.x[1] - main.x[0]) / 2, halfY = (main.y[1] - main.y[0]) / 2, h: Pt = lx ? [mid(main.x) + f * halfX * 0.5, mid(main.y)] : [mid(main.x), mid(main.y) + f * halfY * 0.5];
        out.hearths.push(h); for (let i = 0; i < F.mess_places; i++) { const a = i * 2 * Math.PI / F.mess_places; const p: Pt = [h[0] + Math.cos(a) * (F.hearth_r + F.work_off * 2), h[1] + Math.sin(a) * (F.hearth_r + F.work_off * 2)]; out.work.push([p[0], p[1], headingOf(h[0] - p[0], h[1] - p[1])]); } }
      break; }
    case 'passage': break;
  }
  return out;
}
