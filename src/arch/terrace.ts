// Parametric Terrace generator. Every dimension comes from SITE_SPEC (src/data/site_spec.json): attested/inferred rows,
// DERIVED rows, or `r_*` reconstruction rows (tier C, with a note each) — no literals (brief §3.1, §7; review MJ-1).
// Positions come from the georeferenced OSM footprints. Output: parts + a manifest of measured features.
import { row, v, tierOf, srcOf, present, footprint, SPEC } from './spec';
import { Part, Pt, Box, Prism, Column, ColumnOrder, Manifest, wallRing, grid, BuildResult, Material, doorFrames, frameTop, FrameDims, cutWall, Doorway, DoorState } from './parts';
import { ringSide, ringDoorway, openingParts, leafParts } from './openings';
import { order } from './orders';
import { Rng } from '../core/rng';
import { polyDifference, polyUnion, polyIntersection, rectPoly, single } from './poly';

type Tier = 'A' | 'B' | 'C';
const P = (building: string, kind: string, material: Material, tier: Tier, src: string, extra: Partial<Part> = {}) => ({ building, kind, material, tier, src, ...extra });
const col = (building: string, c: Pt, y0: number, ord: ReturnType<typeof order>, tier: Tier, src: string, built = 1): Column => ({ ...P(building, 'column', ord.material, tier, src), type: 'column', c, y0, order: ord, built });
const prism = (b: string, kind: string, m: Material, t: Tier, s: string, polygon: Pt[], y0: number, y1: number, extra: Partial<Part> = {}): Prism => ({ ...P(b, kind, m, t, s, extra), type: 'prism', polygon, y0, y1 } as Prism);
const box = (b: string, kind: string, m: Material, t: Tier, s: string, c: Pt, size: [number, number], y0: number, y1: number, extra: Partial<Part> = {}): Box => ({ ...P(b, kind, m, t, s, extra), type: 'box', c, size, y0, y1 } as Box);
const T_ = (b: string, k: string) => row(b, k).tier.slice(-1) as Tier;
const S_ = (b: string, k: string) => row(b, k).src;

/** straight flight of solid steps from `start` (foot of the first riser) rising along `dir` */
function flight(b: string, t: Tier, s: string, start: Pt, dir: 'N' | 'S' | 'E' | 'W', steps: number, riser: number, tread: number, width: number, y0: number, base: number): Box[] {
  const out: Box[] = []; const d = { N: [0, 1], S: [0, -1], E: [1, 0], W: [-1, 0] }[dir];
  for (let i = 0; i < steps; i++) {
    const along = (i + 0.5) * tread;
    out.push(box(b, 'step', 'limestone', t, s, [start[0] + d[0] * along, start[1] + d[1] * along], d[0] ? [tread, width] : [width, tread], base, y0 + (i + 1) * riser, { solid: true }));
  }
  return out;
}
/** a flight from a SITE_SPEC flight row {foot, head, z0, z1, steps, tread, width} (axis-aligned; foot = first riser) */
interface FlightRow { id: string; foot: Pt; head: Pt; z0: number; z1: number; steps: number; tread: number; width: number }
const isFlight = (f: any): f is FlightRow => Array.isArray(f.foot) && Array.isArray(f.head);
function flightDirOf(f: { foot: Pt; head: Pt }): 'N' | 'S' | 'E' | 'W' {
  const dx = f.head[0] - f.foot[0], dy = f.head[1] - f.foot[1];
  return Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? 'E' : 'W') : (dy > 0 ? 'N' : 'S');
}
function specFlight(b: string, t: Tier, s: string, f: FlightRow, base: number): Box[] {
  return flight(b, t, s, f.foot, flightDirOf(f), f.steps, (f.z1 - f.z0) / f.steps, f.tread, f.width, f.z0, base);
}
/** stepped parapet along one side of a flight (side +1 = left of the rising direction, −1 = right); the first `open`
 *  steps are left open so the flight can be entered from that side */
function flightParapet(b: string, t: Tier, s: string, f: FlightRow, side: 1 | -1, th: number, h: number, open: number, base: number): Box[] {
  const out: Box[] = []; const dir = flightDirOf(f); const d = { N: [0, 1], S: [0, -1], E: [1, 0], W: [-1, 0] }[dir];
  const lx = -d[1] * side, ly = d[0] * side, lat = f.width / 2 + th / 2, riser = (f.z1 - f.z0) / f.steps;
  for (let i = open; i < f.steps; i++) {
    const along = (i + 0.5) * f.tread;
    out.push(box(b, 'parapet', 'limestone', t, s, [f.foot[0] + d[0] * along + lx * lat, f.foot[1] + d[1] * along + ly * lat], d[0] ? [f.tread, th] : [th, f.tread], base, f.z0 + (i + 1) * riser + h, { solid: true }));
  }
  return out;
}
/** which side (+1 left / −1 right of the rising direction) a point lies on */
function sideOf(f: FlightRow, p: Pt): 1 | -1 { const d = flightDirOf(f); const v2 = { N: [0, 1], S: [0, -1], E: [1, 0], W: [-1, 0] }[d]; return (-v2[1] * (p[0] - f.foot[0]) + v2[0] * (p[1] - f.foot[1])) >= 0 ? 1 : -1; }
/** straight flight of steps along an arbitrary unit direction (rotated boxes), foot at `start` */
function flightAlong(b: string, t: Tier, s: string, start: Pt, u: Pt, steps: number, riser: number, tread: number, width: number, y0: number, base: number): Box[] {
  const out: Box[] = []; const rot = Math.atan2(u[1], u[0]);
  for (let i = 0; i < steps; i++) { const a = (i + 0.5) * tread; out.push({ ...box(b, 'step', 'limestone', t, s, [start[0] + u[0] * a, start[1] + u[1] * a], [tread, width], base, y0 + (i + 1) * riser, { solid: true }), rot }); }
  return out;
}
type Door = { side: 'N' | 'S' | 'E' | 'W'; at: number; width: number; height: number; id?: string };
// stone-framed doorways (global.r_door_frame): the frame parts, the doorway descriptors (door leaves, jamb reliefs), and
 //  the wall gaps: as wide as the frame (the jambs replace the brick, so no jamb face is coplanar with a wall end, D-050)
 //  and up to the frame top so the brick resumes above the cornice; an opening that runs to the top of an unfinished wall
 //  gets a frame of `frameHeight`
function framed(b: string, cx: number, cy: number, w: number, h: number, th: number, y0: number, doors: Door[], frameHeight: number, tx = th, ty = th) {
  const F = v<FrameDims>('global', 'r_door_frame');
  const fd = doors.map(d => ({ ...d, height: Number.isFinite(d.height) ? d.height : frameHeight }));
  const frames = doorFrames({ building: b, material: 'limestone_dark', tier: T_('global', 'r_door_frame'), src: S_('global', 'r_door_frame') }, cx, cy, w, h, th, y0, fd, F, tx, ty);
  const doorways = fd.map(d => ringDoorway(b, d.id ?? d.side, d.side, ringSide(d.side, cx, cy, w, h, tx, ty), d.at, d.width, d.height, y0, F));
  return { wallDoors: doors.map(d => ({ ...d, width: d.width + 2 * F.jamb, height: Number.isFinite(d.height) ? frameTop(d.height, F) : d.height })), frames, doorways, doors: fd };
}
// windows and blind niches of a hall's wall ring (global.r_window, r_niche; per-building r_windows / r_niches, D-050):
 //  width a fraction of the main door, head level with the door head of that wall (the main door's where the wall has
 //  none); the walls are cut where the frames stand. Returns the cut walls, the frame parts, and per side the along-wall
 //  extents a door leaf lying against the wall must keep clear of (other frames and the corners)
function openings(b: string, cx: number, cy: number, w: number, h: number, tx: number, ty: number, y0: number, walls: Box[], doors: Door[], main: { width: number; height: number }) {
  const F = v<FrameDims>('global', 'r_door_frame'), WI = v<any>('global', 'r_window'), NI = v<any>('global', 'r_niche');
  const has = (k: string) => SPEC[b]?.[k]?.v !== undefined;
  const W: Record<string, number[]> = has('r_windows') ? v(b, 'r_windows') : {}, N: Record<string, number[]> = has('r_niches') ? v(b, 'r_niches') : {};
  const meta = (k: string) => ({ building: b, material: 'limestone_dark' as Material, tier: T_(b, k), src: srcOf(row(b, k), row('global', k === 'r_windows' ? 'r_window' : 'r_niche'), row('global', 'r_door_frame')) });
  const frames: Box[] = [], cutters: Box[] = [], clear: Box[] = [], blocked: Record<string, [number, number][]> = {};
  const sides = ['N', 'S', 'E', 'W'] as const;
  for (const side of sides) {
    const S = ringSide(side, cx, cy, w, h, tx, ty), onSide = doors.filter(d => d.side === side);
    blocked[side] = [[S.half, Infinity], [-Infinity, -S.half], ...onSide.map(d => [d.at - d.width / 2 - F.jamb, d.at + d.width / 2 + F.jamb] as [number, number])];
    const head = onSide.length ? Math.max(...onSide.map(d => d.height)) : main.height, ow = main.width * WI.width_of_door;
    const O = { width: ow, sill: WI.sill, head, sillBlock: WI.sill_block, nicheDepth: NI.depth };
    for (const [list, through, key] of [[W[side] ?? [], true, 'r_windows'], [N[side] ?? [], false, 'r_niches']] as const) for (const at of list) {
      const o = openingParts(meta(key), S, at, y0, O, F, through); frames.push(...o.frames); cutters.push(o.cutter); clear.push(o.clear);
      blocked[side].push([at - ow / 2 - F.jamb, at + ow / 2 + F.jamb]);
    }
  }
  return { walls: walls.flatMap(q => cutWall(q, cutters) ?? [q]), frames, clear, blocked, windows: sides.reduce((s, k) => s + (W[k]?.length ?? 0), 0), niches: sides.reduce((s, k) => s + (N[k]?.length ?? 0), 0) };
}
// timber door leaves (global.r_door_leaf, D-051) on the doorways listed in the building's r_door_state row
function hang(b: string, doorways: Doorway[], blocked: Record<string, [number, number][]>, thickness = v<any>('global', 'r_door_leaf').thickness, flip: string[] = []): Box[] {
  const ST = v<Record<string, DoorState>>(b, 'r_door_state'), DL = v<any>('global', 'r_door_leaf'), out: Box[] = [];
  for (const d0 of doorways) {
    const state = ST[d0.door]; if (!state) continue;
    // a doorway whose leaves swing to the outer face (flip) has its n reversed: the approach side is then the n side
    const out1 = flip.includes(d0.door), d: Doorway = out1 ? { ...d0, n: [-d0.n[0], -d0.n[1]] } : d0;
    const rel = (blocked[d0.side] ?? []).map(([a0, a1]) => [a0 - d0.at, a1 - d0.at] as [number, number]).filter(([a0, a1]) => !(a0 < 0 && a1 > 0)); // not its own frame
    out.push(...leafParts(d, state, { thickness, gap: DL.gap }, rel, { tier: tierOf(row(b, 'r_door_state'), row('global', 'r_door_leaf')), src: srcOf(row(b, 'r_door_state'), row('global', 'r_door_leaf')), material: 'timber' },
      out1 ? [d.n[0], d.n[1]] : [-d.n[0], -d.n[1]]));
  }
  return out;
}
/** red lime-plaster floor finish over a hall interior (global.interior_floor; attested for the Tachara and Treasury, B;
 *  extended to the other halls, C) */
const floorFinish = (b: string, c: Pt, sx: number, sy: number, fl: number, attested: boolean) =>
  box(b, 'floor_finish', v<string>('global', 'interior_floor') as Material, attested ? T_('global', 'interior_floor') : 'C', S_('global', 'interior_floor'), c, [sx, sy], fl, fl + v('global', 'r_floor_finish'), { solid: false, note: attested ? 'red hematite-painted lime plaster floor (B)' : 'red lime-plaster floor as in the Tachara and Treasury (C here)' });
/** landing row {x:[x0,x1], y:[y0,y1], z} → solid box from `base` */
const landingBox = (b: string, t: Tier, s: string, L: { x: [number, number]; y: [number, number]; z: number }, base: number, kind = 'landing') =>
  box(b, kind, 'limestone', t, s, [(L.x[0] + L.x[1]) / 2, (L.y[0] + L.y[1]) / 2], [L.x[1] - L.x[0], L.y[1] - L.y[0]], base, L.z, { solid: true });
/** extreme coordinate of a polygon's boundary along a scan line (e.g. the N edge at x = const) */
function edgeAt(poly: Pt[], axis: 'x' | 'y', value: number, pick: 'max' | 'min'): number {
  const hits: number[] = [];
  for (let i = 0; i < poly.length; i++) {
    const a = poly[i], b = poly[(i + 1) % poly.length];
    const [u0, u1, w0, w1] = axis === 'x' ? [a[0], b[0], a[1], b[1]] : [a[1], b[1], a[0], b[0]];
    if ((u0 - value) * (u1 - value) <= 0 && u0 !== u1) hits.push(w0 + (w1 - w0) * (value - u0) / (u1 - u0));
  }
  return pick === 'max' ? Math.max(...hits) : Math.min(...hits);
}
function ringSign(p: Pt[]) { let a = 0; for (let i = 0; i < p.length; i++) { const [x1, y1] = p[i], [x2, y2] = p[(i + 1) % p.length]; a += x1 * y2 - x2 * y1; } return a > 0 ? 1 : -1; }

export function buildTerrace(): BuildResult {
  const parts: Part[] = []; const manifest: Manifest = {}; const doorways: Doorway[] = [];
  const FOUND = -v('global', 'r_found_depth');
  const EAST = v('global', 'r_east_side_x');
  const RISER = row('grand_stair', 'riser'), TREAD = row('grand_stair', 'tread');
  const plainY = -v('global', 'stair_total_rise');

  // ---------------- Terrace platform (terrace polygon minus Grand Stair recess) ----------------
  {
    const T = footprint('terrace').polygon.slice(0, -1) as Pt[];
    const S = (footprint('grand_stair').polygon as Pt[]).slice(0, -1);
    const key = (p: Pt) => `${p[0]},${p[1]}`;
    const shared = T.map((p, i) => [i, S.findIndex(q => key(q) === key(p))]).filter(([, j]) => j >= 0);
    // the stair's outer (W) edge nodes are shared with the terrace outline; the recess is the stair's remaining boundary
    const iTop = Math.min(...shared.map(([i]) => i)), iBot = Math.max(...shared.map(([i]) => i));
    const jTop = shared.find(([i]) => i === iTop)![1], jBot = shared.find(([i]) => i === iBot)![1];
    const walk = (from: number, to: number) => { const r: Pt[] = []; for (let j = (from + 1) % S.length; j !== to; j = (j + 1) % S.length) if (!T.some(p => key(p) === key(S[j]))) r.push(S[j]); return r; };
    const ra = walk(jTop, jBot), rb = walk(jBot, jTop); const recess = ra.length >= rb.length ? ra : rb;
    // walk direction: choose the orientation that goes around the E side of the stair (x > terrace-edge x)
    const [elx0, elx1] = v<number[]>('grand_stair', 'east_lane_x'), eSide = (elx0 + elx1) / 2; // points E of the upper lane's centreline
    const recessPath = recess.some(p => p[0] > eSide) ? recess : [];
    if (!recessPath.length) throw new Error('recess path not found');
    const ordered = Math.abs(recessPath[0][1] - T[iTop][1]) < Math.abs(recessPath[recessPath.length - 1][1] - T[iTop][1]) ? recessPath : [...recessPath].reverse();
    const poly = [...T.slice(0, iTop + 1), ...ordered, ...T.slice(iBot)] as Pt[];
    parts.push(prism('terrace', 'platform', 'terrace', 'B', srcOf(row('terrace', 'extent_ns'), row('terrace', 'stair_recess')), poly, FOUND, 0, { solid: true, note: 'retaining walls of dressed grey limestone; top = court datum (open-court surface C, Q-027)' }));
    const ph = v('terrace', 'parapet_height'), pt = v('terrace', 'r_parapet_thickness'), sg = ringSign(poly);
    const topOpen = [ordered.reduce((m, p) => (p[0] > m[0] ? p : m)), ordered.filter(p => p[0] > eSide)].flat() as any;
    const eastmost = ordered.filter(p => p[0] > eSide).map(key);
    for (let i = 0; i < poly.length; i++) {
      const a = poly[i], b2 = poly[(i + 1) % poly.length];
      if (a[0] > EAST && b2[0] > EAST) continue; // E side: fortification wall instead
      if (eastmost.includes(key(a)) && eastmost.includes(key(b2))) continue; // Grand Stair top landing opens onto the court
      const len = Math.hypot(b2[0] - a[0], b2[1] - a[1]); if (len < 0.5) continue;
      const nx = -(b2[1] - a[1]) / len, ny = (b2[0] - a[0]) / len; // left normal; inward if ring is CCW
      const c: Pt = [(a[0] + b2[0]) / 2 + sg * nx * pt / 2, (a[1] + b2[1]) / 2 + sg * ny * pt / 2];
      parts.push({ ...box('terrace', 'parapet', 'limestone', T_('terrace', 'parapet_height'), S_('terrace', 'parapet_height'), c, [len, pt], 0, ph, { solid: true }), rot: Math.atan2(b2[1] - a[1], b2[0] - a[0]) });
    }
    void topOpen;
    manifest.terrace = { polygonVertices: poly.length };
  }

  // ---------------- Grand Stair ----------------
  {
    const b = 'grand_stair', t = tierOf(RISER, TREAD), s = srcOf(RISER, TREAD, row(b, 'lower_flight_y'));
    const r = RISER.v as number, tr = TREAD.v as number, cy = v(b, 'centre_y');
    const [wx0, wx1] = v<number[]>(b, 'west_lane_x'), [ex0, ex1] = v<number[]>(b, 'east_lane_x');
    const nLow = v(b, 'steps_lower'), nUp = v(b, 'steps_upper');
    const wW = v(b, 'r_flight_width_w'), wE = v(b, 'flight_width'), grp = v(b, 'r_parapet_step_group'), ph = v(b, 'parapet_height');
    const wxc = (wx0 + wx1) / 2, exc = (ex0 + ex1) / 2;
    const [ly0] = v<number[]>(b, 'lower_flight_y'), [, uy1] = v<number[]>(b, 'upper_flight_y'), [ty0, ty1] = v<number[]>(b, 'top_landing_y');
    const L = v<any>(b, 'outer_landing'); const hLand = plainY + nLow * r;
    const counts: number[] = [];
    for (const sgn of [1, -1]) {
      const m = (y: number) => cy + sgn * (y - cy);
      const lf = flight(b, t, s, [wxc, m(ly0)], sgn > 0 ? 'N' : 'S', nLow, r, tr, wW, plainY, FOUND);
      const [lw0, lw1] = L.west_lane_y, [le0, le1] = L.east_lane_y;
      parts.push(box(b, 'landing', 'limestone', t, s, [wxc, (m(lw0) + m(lw1)) / 2], [wx1 - wx0, Math.abs(lw1 - lw0)], FOUND, hLand, { solid: true }));
      parts.push(box(b, 'landing', 'limestone', t, s, [exc, (m(le0) + m(le1)) / 2], [ex1 - ex0, Math.abs(le1 - le0)], FOUND, hLand, { solid: true }));
      const uf = flight(b, t, s, [exc, m(uy1)], sgn > 0 ? 'S' : 'N', nUp, r, tr, wE, hLand, FOUND);
      parts.push(...lf, ...uf); counts.push(lf.length + uf.length);
      const pw = (wx1 - wx0 - wW) / 2, pe = (ex1 - ex0 - wE) / 2, pt = T_(b, 'parapet_height'), ps = S_(b, 'parapet_height');
      for (let k = 0; k < nLow; k += grp) { const k2 = Math.min(nLow, k + grp); const ya = m(ly0 + k * tr), yb = m(ly0 + k2 * tr);
        for (const px of [wx0 + pw / 2, wx1 - pw / 2]) parts.push(box(b, 'parapet', 'limestone', pt, ps, [px, (ya + yb) / 2], [pw, Math.abs(yb - ya)], FOUND, plainY + k2 * r + ph, { solid: true })); }
      for (let k = 0; k < nUp; k += grp) { const k2 = Math.min(nUp, k + grp); const ya = m(uy1 - k * tr), yb = m(uy1 - k2 * tr);
        for (const px of [ex0 + pe / 2, ex1 - pe / 2]) parts.push(box(b, 'parapet', 'limestone', pt, ps, [px, (ya + yb) / 2], [pe, Math.abs(yb - ya)], FOUND, hLand + k2 * r + ph, { solid: true })); }
    }
    parts.push(box(b, 'landing', 'limestone', t, s, [exc, (ty0 + ty1) / 2], [ex1 - ex0, ty1 - ty0], FOUND, 0, { solid: true, note: 'common upper landing facing the Gate' }));
    const [g0, g1] = v<number[]>(b, 'central_gap');
    parts.push(box(b, 'pavement', 'limestone', T_(b, 'block_construction'), 'IR-PERS', [wxc, (g0 + g1) / 2], [wx1 - wx0, g1 - g0], FOUND, plainY, { solid: true, note: "'pavement of huge well-polished gray limestone'" }));
    manifest.grand_stair = { stepsNorth: counts[0], stepsSouth: counts[1], riser: r, tread: tr, landingHeight: hLand, topHeight: plainY + (nLow + nUp) * r, flightWidthW: wW, flightWidthE: wE };
  }

  // ---------------- Gate of All Nations ----------------
  if (present('gate_nations')) {
    const b = 'gate_nations', f = footprint(b); const [x0, y0, x1, y1] = f.bounds; const c: Pt = [(x0 + x1) / 2, (y0 + y1) / 2];
    const hs = v(b, 'hall_side'), H = v(b, 'column_height'), fl = v(b, 'floor');
    const tx = ((x1 - x0) - hs) / 2, ty = ((y1 - y0) - hs) / 2; // wall_thickness row: DERIVED per axis from the OSM outer outline
    const s = srcOf(row(b, 'hall_side'), row(b, 'outer_size'));
    const dh = v(b, 'door_height'), dw = v(b, 'door_width');
    const roofY = fl + H + v(b, 'r_roof_above_capital');
    parts.push(box(b, 'floor', 'limestone', T_(b, 'floor'), S_(b, 'floor'), c, [x1 - x0, y1 - y0], FOUND, fl, { solid: true }));
    const doors = (v<string[]>(b, 'doors')).map(side => ({ side: side as any, at: 0, width: dw, height: dh }));
    // doorway colossi stand in the W and E door reveals, projecting outward from the wall faces; the box is the collider
    // and plan footprint, rendered as a colossus carved from the jamb (sculpt.ts, D-018): head facing out of the
    // doorway, relief toward the passage. The mud-brick wall ring is cut around each colossus and its plinth (D-032), so
    // parts, colliders and render never overlap
    const K = v<any>(b, 'r_colossus'), G = v<Record<string, string>>(b, 'guardians'), jambs: Box[] = [];
    for (const [side, sx, dir] of [['W', x0, -1], ['E', x1, 1]] as const) for (const dy of [-1, 1] as const) {
      const pl = v(b, 'r_colossus_plinth'), pc: Pt = [sx + dir * (K.length / 2 - tx), c[1] + dy * (dw / 2 + K.width / 2)];
      jambs.push(box(b, 'plinth', 'limestone', 'C', S_(b, 'r_colossus_plinth'), pc, [K.length, K.width], fl, fl + pl, { solid: true }));
      jambs.push(box(b, 'colossus', 'limestone', 'C', srcOf(row(b, 'guardians'), row(b, 'r_colossus')), pc, [K.length, K.width], fl + pl, fl + pl + K.height,
        { solid: true, sculpt: { model: /human-headed/.test(G[side]) ? 'lamassu' : 'bull', facing: dir, passage: dy === 1 ? -1 : 1 },
          note: `${G[side]} colossus (IR-PERS, B) carved from the jamb: procedural sculpture, form C (D-018)` }));
    }
    parts.push(...wallRing({ building: b, material: 'mudbrick', tier: 'C', src: s }, c[0], c[1], hs, hs, 0, fl, roofY, doors, tx, ty).flatMap(w => cutWall(w, jambs) ?? [w]).map(w => ({ ...w, solid: true })));
    const [nx, ny] = v<number[]>(b, 'columns');
    const ord = order(b, { base: 'bell', capital: 'composite' });
    for (const p of grid(nx, ny, c[0], c[1], v(b, 'interaxial'))) parts.push(col(b, p, fl, ord, T_(b, 'column_height'), S_(b, 'column_height')));
    parts.push(box(b, 'roof', 'timber', T_(b, 'roof'), S_(b, 'roof'), c, [x1 - x0, y1 - y0], roofY, roofY + v(b, 'r_roof_thickness'), { note: 'cedar beams, earth roof' }));
    const FL = v<string>('global', 'interior_floor') as Material, FLt = T_('global', 'interior_floor'), FLs = S_('global', 'interior_floor');
    parts.push(box(b, 'floor_finish', FL, FLt, FLs, c, [hs, hs], fl, fl + v('global', 'r_floor_finish'), { solid: false, note: 'red hematite-painted lime plaster floor' }));
    // frieze band above each doorway (on both wall faces) and bronze-studded timber door leaves
    const FR = v<any>(b, 'r_frieze'), DL = v<any>(b, 'r_door_leaves');
    for (const side of doors.map(d => d.side as string)) {
      const horiz = side === 'S' || side === 'N';
      const faceOff = horiz ? hs / 2 + ty : hs / 2 + tx; const sgn = side === 'E' || side === 'N' ? 1 : -1;
      for (const face of [-1, 1]) { const off = sgn * (faceOff + face * (horiz ? ty : tx)) ; const cc: Pt = horiz ? [c[0], c[1] + sgn * (hs / 2 + ty / 2) + face * (ty / 2 + FR.offset)] : [c[0] + sgn * (hs / 2 + tx / 2) + face * (tx / 2 + FR.offset), c[1]]; void off;
        parts.push(box(b, 'frieze', 'glazed', 'C', S_(b, 'r_frieze'), cc, horiz ? [dw + 2 * FR.above_door, FR.thickness] : [FR.thickness, dw + 2 * FR.above_door], fl + dh + FR.above_door, fl + dh + FR.above_door + FR.height, { solid: false })); }
    }
    // timber door leaves with bronze bosses (r_door_leaves, D-032 → D-051): pivots at the inner (hall-side) end of each
    // passage, the leaves open into the hall and lie against the inner wall face beside the opening, because the colossi
    // fill the W and E passages from face to face and leaves against the reveals would cover their carved flanks
    const gd = doors.map(d => ringDoorway(b, d.side, d.side, ringSide(d.side, c[0], c[1], hs, hs, tx, ty), d.at, dw, dh, fl, null));
    doorways.push(...gd);
    parts.push(...hang(b, gd, Object.fromEntries(gd.map(d => [d.side, [[hs / 2, Infinity], [-Infinity, -hs / 2]] as [number, number][]])), DL.thickness));
    parts.push(...jambs);
    manifest.gate_nations = { room: [c[0], c[1], hs, hs, fl, roofY - fl], hallInteriorX: hs, hallInteriorY: hs, columns: nx * ny, columnHeight: ord.height, wallTx: tx, wallTy: ty, doors: doors.length, doorHeight: dh };
  }

  // ---------------- Apadana ----------------
  if (present('apadana')) {
    const b = 'apadana', f = footprint(b), poly = f.polygon.slice(0, -1) as Pt[];
    const pod = v(b, 'podium_height'), hs = v(b, 'hall_side'), [cx, cy] = v<number[]>(b, 'hall_centre'), ia = v(b, 'interaxial');
    const wt = v(b, 'wall_thickness'), H = v(b, 'column_height'), bh = v(b, 'building_height'), pdN = v(b, 'portico_depth_n');
    const s = srcOf(row(b, 'podium_height'), row(b, 'hall_side'));
    parts.push(prism(b, 'platform', 'limestone', 'B', srcOf(row(b, 'platform_footprint'), row(b, 'podium_height')), poly, FOUND, pod, { solid: true }));
    const D = v<any>(b, 'r_door');
    const AD = framed(b, cx, cy, hs, hs, wt, pod, (['N', 'W', 'E', 'S'] as const).map(side => ({ side, at: 0, width: D.width, height: D.height })), D.height);
    const AO = openings(b, cx, cy, hs, hs, wt, wt, pod, wallRing({ building: b, material: 'mudbrick', tier: 'C', src: srcOf(row(b, 'wall_thickness'), row(b, 'wall_height')) }, cx, cy, hs, hs, wt, pod, pod + v(b, 'wall_height'), AD.wallDoors), AD.doors, D);
    parts.push(...AO.walls.map(w => ({ ...w, solid: true })), ...AD.frames, ...hang(b, AD.doorways, AO.blocked)); doorways.push(...AD.doorways);
    parts.push(box(b, 'floor_finish', v<string>('global', 'interior_floor') as Material, T_('global', 'interior_floor'), S_('global', 'interior_floor'), [cx, cy], [hs, hs], pod, pod + v('global', 'r_floor_finish'), { solid: false }));
    // capitals: composite in the hall (row `capital`), per portico from `portico_capitals` (W: double bulls on the shaft)
    const PC = v<Record<string, ColumnOrder['capital']>>(b, 'portico_capitals');
    const hallOrd = order(b, { base: 'square2', capital: 'composite' }), porOrd = (side: string) => order(b, { base: 'bell', capital: PC[side] });
    const [hnx, hny] = v<number[]>(b, 'hall_columns');
    const hallCols = grid(hnx, hny, cx, cy, ia);
    for (const p of hallCols) parts.push(col(b, p, pod, hallOrd, tierOf(row(b, 'column_height'), row(b, 'interaxial')), s));
    const wo = hs / 2 + wt;
    const por = v<Record<string, [number, number]>>(b, 'porticoes'); const porticoCols: Pt[] = [], porticoSide: string[] = [];
    // N portico: [cols along x, rows]; W/E: [rows, cols along y]; rows at 1, 2, … bays out from the hall wall face
    for (let i = 0; i < por.N[0]; i++) for (let k = 1; k <= por.N[1]; k++) { porticoCols.push([cx + (i - (por.N[0] - 1) / 2) * ia, cy + wo + k * ia]); porticoSide.push('N'); }
    for (const [side, sgn] of [['W', -1], ['E', 1]] as const) for (let i = 0; i < por[side][1]; i++) for (let k = 1; k <= por[side][0]; k++) { porticoCols.push([cx + sgn * (wo + k * ia), cy + (i - (por[side][1] - 1) / 2) * ia]); porticoSide.push(side); }
    porticoCols.forEach((p, i) => parts.push(col(b, p, pod, porOrd(porticoSide[i]), tierOf(row(b, 'column_height'), row(b, 'porticoes'), row(b, 'portico_capitals')), s)));
    const [px0, py0, px1] = f.bounds; const nEdge = cy + wo + pdN;
    const tE = v(b, 'r_tower_extra');
    const towers: [number, number, number, number][] = [[px0, cy + wo, cx - wo, nEdge], [cx + wo, cy + wo, px1, nEdge], [px0, py0, cx - wo, cy - wo], [cx + wo, py0, px1, cy - wo]];
    for (const [a0, b0, a1, b1] of towers) parts.push(box(b, 'tower', 'mudbrick', 'C', srcOf(row(b, 'corner_towers'), row(b, 'r_tower_extra')), [(a0 + a1) / 2, (b0 + b1) / 2], [a1 - a0, b1 - b0], pod, pod + bh + tE, { solid: true, note: 'corner tower (count B; size and height C)' }));
    parts.push(box(b, 'storerooms', 'mudbrick', 'C', S_(b, 'south_side'), [cx, (py0 + cy - wo) / 2], [2 * wo, cy - wo - py0], pod, pod + v(b, 'r_storeroom_height'), { solid: true }));
    const rs = S_(b, 'building_height');
    parts.push(box(b, 'roof', 'timber', 'C', rs, [cx, cy], [2 * wo, 2 * wo], pod + H, pod + bh));
    parts.push(box(b, 'roof', 'timber', 'C', rs, [cx, cy + wo + pdN / 2], [2 * wo, pdN], pod + H, pod + bh));
    parts.push(box(b, 'roof', 'timber', 'C', rs, [(px0 + cx - wo) / 2, cy], [cx - wo - px0, 2 * wo], pod + H, pod + bh));
    parts.push(box(b, 'roof', 'timber', 'C', rs, [(px1 + cx + wo) / 2, cy], [px1 - cx - wo, 2 * wo], pod + H, pod + bh));
    // N and E stairways, attached to the podium's true edge at the stair (review MJ-2)
    const sl = (row(b, 'stairs').v as any).N.length as number, sr = v(b, 'stair_riser'), nSt = Math.round(pod / sr), stTr = v(b, 'r_stair_tread'), stW = v(b, 'r_stair_width');
    const run = nSt * stTr, third = sl / 3;
    const stairParts = (axis: 'N' | 'E') => {
      // façade edge: N stair → min over the stair span of the podium's N edge; E stair → max of the E edge (stair overlaps a slanted edge rather than leaving a gap)
      const span = [-sl / 2, sl / 2].map(d => (axis === 'N' ? cx : cy) + d);
      const samples = Array.from({ length: 9 }, (_, i) => span[0] + (span[1] - span[0]) * i / 8);
      const edge = axis === 'N' ? Math.min(...samples.map(x => edgeAt(poly, 'x', x, 'max'))) : Math.max(...samples.map(y => edgeAt(poly, 'y', y, 'max')));
      const across = edge + stW / 2; // centre line of the stair zone, perpendicular to the façade
      const P2 = (along: number): Pt => axis === 'N' ? [cx + along, across] : [across, cy + along];
      const dirTo = (sgnAlong: number) => (axis === 'N' ? (sgnAlong > 0 ? 'E' : 'W') : (sgnAlong > 0 ? 'N' : 'S')) as any;
      const out: Part[] = [];
      const lt = T_(b, 'r_stair_layout'), ls = S_(b, 'r_stair_layout');
      // central part: two flights rising toward the centre from the ends of the central third, meeting a central landing
      for (const sg of [-1, 1]) out.push(...flight(b, lt, ls, P2(sg * third / 2), dirTo(-sg), nSt, sr, stTr, stW, 0, 0));
      const cl = third - 2 * run; out.push(box(b, 'landing', 'limestone', lt, ls, P2(0), axis === 'N' ? [cl, stW] : [stW, cl], 0, pod, { solid: true }));
      // outer parts: flights rising from the outer ends toward the centre, onto landings that adjoin the podium
      for (const sg of [-1, 1]) {
        out.push(...flight(b, lt, ls, P2(sg * sl / 2), dirTo(-sg), nSt, sr, stTr, stW, 0, 0));
        const l0 = sl / 2 - run, l1 = third / 2, lc = sg * (l0 + l1) / 2, ll = l0 - l1;
        out.push(box(b, 'landing', 'limestone', lt, ls, P2(lc), axis === 'N' ? [ll, stW] : [stW, ll], 0, pod, { solid: true }));
      }
      return { out, edge };
    };
    const N = stairParts('N'), E = stairParts('E'); parts.push(...N.out, ...E.out);
    // relief-bearing façade walls on the outer edge of each stair zone: the top follows the stair (flights slope in
    // tread-sized steps, landings level) plus the parapet; reliefs and crenellations are applied by decor.ts
    const ft = v(b, 'r_facade_thickness'), php = v(b, 'r_parapet_height');
    const spans: { a0: number; a1: number; type: 'flight' | 'landing'; rise: 1 | -1 }[] = [];
    const cl = third - 2 * run;
    for (const sg of [-1, 1] as const) { // along coordinate a ∈ [−sl/2, sl/2]; flights rise toward the centre
      spans.push({ a0: sg < 0 ? -sl / 2 : sl / 2 - run, a1: sg < 0 ? -sl / 2 + run : sl / 2, type: 'flight', rise: (-sg) as 1 | -1 });
      spans.push({ a0: sg < 0 ? -sl / 2 + run : third / 2, a1: sg < 0 ? -third / 2 : sl / 2 - run, type: 'landing', rise: 1 });
      spans.push({ a0: sg < 0 ? -third / 2 : cl / 2, a1: sg < 0 ? -cl / 2 : third / 2, type: 'flight', rise: (-sg) as 1 | -1 });
    }
    spans.push({ a0: -cl / 2, a1: cl / 2, type: 'landing', rise: 1 });
    for (const [axis, edge] of [['N', N.edge], ['E', E.edge]] as const) {
      const at = (a: number, w: number, y1: number) => axis === 'N'
        ? box(b, 'facade', 'limestone', 'C', S_(b, 'r_facade_thickness'), [cx + a, edge + stW - ft / 2], [w, ft], 0, y1, { solid: true })
        : box(b, 'facade', 'limestone', 'C', S_(b, 'r_facade_thickness'), [edge + stW - ft / 2, cy + a], [ft, w], 0, y1, { solid: true });
      for (const s of spans) {
        if (s.type === 'landing') { parts.push(at((s.a0 + s.a1) / 2, s.a1 - s.a0, pod + php)); continue; }
        for (let i = 0; i < nSt; i++) { // step i counted from the bottom of the flight
          const aa = s.rise > 0 ? s.a0 + (i + 0.5) * stTr : s.a1 - (i + 0.5) * stTr;
          parts.push(at(aa, stTr, (i + 1) * sr + php));
        }
      }
    }
    manifest.apadana = { room: [cx, cy, hs, hs, pod, H], hallColumns: hallCols.length, porticoColumns: porticoCols.length, columnHeight: hallOrd.height, interaxial: ia, hallInterior: hs, podium: pod, wallThickness: wt, stairLength: sl, nStairEdge: N.edge, eStairEdge: E.edge, stairWidth: stW, hallCentre: [cx, cy] as any, stairSpans: spans as any, stairRiser: sr, stairTread: stTr, parapet: php };
  }

  // ---------------- Tachara ----------------
  const SP = v<any>('global', 'r_stair_parapet'), SPt = T_('global', 'r_stair_parapet'), SPs = S_('global', 'r_stair_parapet');
  if (present('tachara')) {
    const b = 'tachara', f = footprint(b), [x0, , x1, y1] = f.bounds, fl = v(b, 'floor');
    // the S stair runs along the S front inside the traced outline: the platform stops at the building front (Phase 4)
    const Z = v<any>(b, 'stair_s_zone');
    const plat = single(polyIntersection(f.polygon.slice(0, -1) as Pt[], rectPoly([x0 - 1, x1 + 1], [Z.y_building_front, y1 + 1])), 'tachara platform');
    parts.push(prism(b, 'platform', 'limestone', 'B', srcOf(row(b, 'platform_footprint'), row(b, 'floor'), row(b, 'stair_s_zone')), plat, FOUND, fl, { solid: true }));
    const [, Lh] = v<number[]>(b, 'overall'); const bc: Pt = [(x0 + x1) / 2, y1 - Lh / 2];
    const [hx, hy] = v<number[]>(b, 'hall_size'), [ncx, ncy] = v<number[]>(b, 'hall_columns');
    const hc: Pt = [bc[0], v(b, 'r_hall_centre_y')]; const wt = v(b, 'r_wall');
    const ord = order(b, { base: 'square2', capital: 'bull' });
    const DR = v<any[]>(b, 'doors'); const dS = DR.find(d => d.id === 'S_main'), dN = DR.find(d => d.id === 'N_pair');
    const TD = framed(b, hc[0], hc[1], hx, hy, wt, fl, [{ id: 'S_main', side: 'S', at: dS.at[0] - hc[0], width: dS.width, height: dS.height }, ...dN.offsets_x.map((o: number) => ({ id: o < 0 ? 'N_W' : 'N_E', side: 'N' as const, at: o, width: dN.width, height: dN.height }))], dS.height);
    // windows either side of the main doorway and blind niches toward the side rooms (D-050), then the door leaves (D-051)
    const TO = openings(b, hc[0], hc[1], hx, hy, wt, wt, fl, wallRing({ building: b, material: 'mudbrick', tier: 'C', src: srcOf(row(b, 'doors'), row(b, 'r_hall_centre_y')) }, hc[0], hc[1], hx, hy, wt, fl, fl + ord.height + v(b, 'r_wall_above_columns'), TD.wallDoors), TD.doors, dS);
    parts.push(...TO.walls.map(w => ({ ...w, solid: true })), ...TD.frames, ...TO.frames, ...hang(b, TD.doorways, TO.blocked)); doorways.push(...TD.doorways);
    const cols = grid(ncx, ncy, hc[0], hc[1], hx / ncx, hy / ncy);
    for (const p of cols) parts.push(col(b, p, fl, ord, 'C', srcOf(row(b, 'hall_columns'), row(b, 'hall_size'))));
    parts.push(floorFinish(b, hc, hx, hy, fl, true));
    const [pcx, pcy] = v<number[]>(b, 'portico'); const pc: Pt = [hc[0], hc[1] - hy / 2 - wt - v(b, 'r_portico_gap')];
    const pcols = grid(pcx, pcy, pc[0], pc[1], hx / ncx, v(b, 'r_portico_row_spacing'));
    for (const p of pcols) parts.push(col(b, p, fl, ord, T_(b, 'portico'), S_(b, 'portico')));
    const RF = v<any>(b, 'r_roof');
    parts.push(box(b, 'roof', 'timber', 'C', 'RECON', [hc[0], hc[1] + RF.offset_n], [hx + 2 * wt, hy + 2 * wt + RF.extend_s], fl + ord.height, fl + ord.height + RF.thickness));
    // S stairway (standing in 467: XPc on its central façade): two flights along the front rising to a central landing
    let stairSteps = 0;
    if (v<boolean>(b, 'stair_s_present_467')) {
      const st = T_(b, 'stair_s_flights'), ss = srcOf(row(b, 'stair_s_flights'), row(b, 'stair_s_zone'));
      for (const F of v<any[]>(b, 'stair_s_flights')) {
        if (!isFlight(F)) { parts.push(landingBox(b, st, ss, F as any, FOUND)); continue; }
        const fs = specFlight(b, st, ss, F, FOUND); parts.push(...fs); stairSteps += fs.length;
        parts.push(...flightParapet(b, SPt, SPs, F, sideOf(F, [F.foot[0], Z.y_facade - 1]), SP.thickness, SP.height, 0, FOUND)); // outer (S) side
      }
    }
    manifest.tachara = { room: [hc[0], hc[1], hx, hy, fl, ord.height], hallColumns: cols.length, porticoColumns: pcols.length, floor: fl, stairSteps, hallCentreY: hc[1], windows: TO.windows, niches: TO.niches };
  }

  // ---------------- Hadish ----------------
  if (present('hadish')) {
    const b = 'hadish', f = footprint(b), [x0, y0, x1, y1] = f.bounds, fl = v(b, 'floor');
    // platform = traced outline minus the two stair zones (W recessed inside the outline, E partly projecting beyond it)
    const ZW = v<any>(b, 'stair_w_zone'), ZE = v<any>(b, 'stair_e_zone');
    const cutW = rectPoly([Math.min(ZW.x[0], x0) - 1, ZW.x[1]], ZW.y), cutE = rectPoly([ZE.x[0], Math.max(ZE.x[1], x1) + 1], ZE.y);
    const plat = single(polyDifference(f.polygon.slice(0, -1) as Pt[], cutW, cutE), 'hadish platform');
    parts.push(prism(b, 'platform', 'limestone', 'B', srcOf(row(b, 'platform_footprint'), row(b, 'floor'), row(b, 'stair_w_zone'), row(b, 'stair_e_zone')), plat, FOUND, fl, { solid: true }));
    // hall measured on both plans (~27 m, pitch 3.9; Q-P4-06 replaces the 38 m reconstruction)
    const H = v<any>(b, 'hall'), hc = H.centre as Pt, hsx = H.interior_x[1] - H.interior_x[0], hsy = H.interior_y[1] - H.interior_y[0], ia = H.interaxial;
    const [hnx, hny] = v<number[]>(b, 'hall_columns'), [pnx] = v<number[]>(b, 'portico'), wt = v(b, 'r_hall_wall');
    const ord = order(b, { base: 'plain', capital: 'bull' });
    const DR = v<any[]>(b, 'doors'), ds = srcOf(row(b, 'doors'), row(b, 'hall'));
    const doors: Door[] = DR.flatMap((d: any) => d.offsets_x_from_22 ? d.offsets_x_from_22.map((o: number) => ({ id: o < 0 ? 'N_W' : 'N_E', side: 'N' as const, at: o, width: d.width, height: d.height })) // offsets from the hall axis (x 22 = hall centre)
      : [{ id: d.id, side: d.id as 'S' | 'E' | 'W', at: d.id === 'S' ? d.at[0] - hc[0] : d.at[1] - hc[1], width: d.width, height: d.height }]);
    const HD = framed(b, hc[0], hc[1], hsx, hsy, wt, fl, doors, doors[0].height);
    // 9 of the 19 windows (those in the hall walls) and the 4 niches (D-050), then the door leaves (D-051)
    const HO = openings(b, hc[0], hc[1], hsx, hsy, wt, wt, fl, wallRing({ building: b, material: 'mudbrick', tier: 'C', src: ds }, hc[0], hc[1], hsx, hsy, wt, fl, fl + ord.height + v(b, 'r_wall_above_columns'), HD.wallDoors), HD.doors, doors[0]);
    parts.push(...HO.walls.map(w => ({ ...w, solid: true })), ...HD.frames, ...HO.frames, ...hang(b, HD.doorways, HO.blocked)); doorways.push(...HD.doorways);
    const cols = grid(hnx, hny, hc[0], hc[1], ia);
    for (const p of cols) parts.push(col(b, p, fl, ord, T_(b, 'hall'), srcOf(row(b, 'hall_columns'), row(b, 'hall'))));
    parts.push(floorFinish(b, hc, hsx, hsy, fl, false));
    const PL = v<any>(b, 'portico_layout'); const pcols: Pt[] = [];
    for (const y of PL.rows_y) for (let i = 0; i < pnx; i++) pcols.push([PL.x[0] + i * (PL.x[1] - PL.x[0]) / (pnx - 1), y]);
    for (const p of pcols) parts.push(col(b, p, fl, ord, T_(b, 'portico_layout'), srcOf(row(b, 'portico'), row(b, 'portico_layout'))));
    const RF = v<any>(b, 'r_roof');
    parts.push(box(b, 'roof', 'timber', 'C', 'RECON', [hc[0], hc[1] + RF.offset_n], [hsx + 2 * wt, hsy + 2 * wt + RF.extend], fl + ord.height, fl + ord.height + v(b, 'r_wall_above_columns')));
    // W and E stairs: double-reversed (lower flights rise outward from the centre in the outer lane, upper flights
    // return inward to the top in the inner lane). Outer parapet with the foot steps open (entry from the court); the
    // lane divider is a parapet as thick as the gap between the lanes.
    let stairSteps = 0;
    for (const key of ['stair_w_flights', 'stair_e_flights']) {
      const st = T_(b, key), ss = srcOf(row(b, key), row(b, key === 'stair_w_flights' ? 'stair_w_zone' : 'stair_e_zone'));
      const F = v<any[]>(b, key); const flights = F.filter(isFlight) as FlightRow[];
      const lower = flights.filter(q => q.z0 === Math.min(...flights.map(r => r.z0))), upper = flights.filter(q => !lower.includes(q));
      const centre = (q: FlightRow): Pt => [q.foot[0], q.foot[1]];
      for (const L of F) if (!isFlight(L) && !String(L.id).includes('exit')) parts.push(landingBox(b, st, ss, L as any, FOUND)); // top exits lie on the platform
      for (const q of lower) {
        const fs = specFlight(b, st, ss, q, FOUND); parts.push(...fs); stairSteps += fs.length;
        const inner = upper[0] ? centre(upper[0]) : hc; // the outer side is away from the inner lane
        parts.push(...flightParapet(b, SPt, SPs, q, (-sideOf(q, inner)) as 1 | -1, SP.thickness, SP.height, SP.open_steps, FOUND));
      }
      const Z = v<any>(b, key === 'stair_w_flights' ? 'stair_w_zone' : 'stair_e_zone');
      for (const q0 of upper) {
        // the upper flight reaches the platform edge of the zone on its inner side (no slot between flight and platform)
        const lo0 = lower[0], inner = Math.abs(Z.x[0] - lo0.foot[0]) > Math.abs(Z.x[1] - lo0.foot[0]) ? Z.x[0] : Z.x[1];
        const edgeIn = q0.foot[0] + Math.sign(inner - q0.foot[0]) * q0.width / 2, gapIn = Math.abs(inner - edgeIn), sh = Math.sign(inner - q0.foot[0]) * gapIn / 2;
        const q: FlightRow = { ...q0, width: q0.width + gapIn, foot: [q0.foot[0] + sh, q0.foot[1]], head: [q0.head[0] + sh, q0.head[1]] };
        const fs = specFlight(b, st, ss, q, FOUND); parts.push(...fs); stairSteps += fs.length;
        const lo = lower[0]; const lat = (p: FlightRow) => (flightDirOf(p) === 'N' || flightDirOf(p) === 'S') ? p.foot[0] : p.foot[1];
        const gap = Math.max(SP.thickness, Math.abs(lat(q) - lat(lo)) - (q.width + lo.width) / 2);
        const side = sideOf(q, centre(lo));
        parts.push(...flightParapet(b, SPt, SPs, q, side, gap, SP.height, 0, FOUND)); // lane divider, flush with the upper flight
      }
    }
    manifest.hadish = { room: [hc[0], hc[1], hsx, hsy, fl, ord.height], hallColumns: cols.length, porticoColumns: pcols.length, floor: fl, hallInterior: hsx, stairSteps, windows: HO.windows, niches: HO.niches };
    void y0; void y1;
  }

  // ---------------- Hall of a Hundred Columns (under construction) ----------------
  if (present('hall100')) {
    const b = 'hall100', f = footprint(b), [x0, y0, x1, y1] = f.bounds, fl = v(b, 'floor'), hs = v(b, 'hall_side'), ia = v(b, 'interaxial');
    const c: Pt = [(x0 + x1) / 2, (y0 + y1) / 2];
    const tx = ((x1 - x0) - hs) / 2, ty = ((y1 - y0) - hs) / 2;
    const CP = v<any>(b, 'r_construction_probs'); const rng = new Rng(1, 'hall100-construction');
    parts.push(box(b, 'floor', 'limestone', 'C', S_(b, 'floor'), c, [x1 - x0, y1 - y0], FOUND, fl, { solid: true }));
    const ord = order(b, { base: 'bell', capital: 'bull' });
    const wallH = (ord.height + v(b, 'r_wall_top_above_columns')) / 3;
    // eight doorways, two per wall on the aisles ±12.5 m from the centre (REF-PLAN / REF-SCHMIDT; Phase 4). Walls stand at
    // a third of their height, below the door heads, so the openings run to the wall top.
    const DR = v<any[]>(b, 'doors');
    const doors = DR.map((d: any) => { const side = d.wall as 'N' | 'S' | 'E' | 'W'; return { id: d.id, side, at: side === 'N' || side === 'S' ? d.at[0] - c[0] : d.at[1] - c[1], width: d.width, height: Infinity }; });
    const CD = framed(b, c[0], c[1], hs, hs, 0, fl, doors, v(b, 'r_door_height'), tx, ty); // frames set before the brick (C)
    parts.push(...wallRing({ building: b, material: 'mudbrick', tier: 'C', src: srcOf(row(b, 'doors'), row(b, 'construction_state')) }, c[0], c[1], hs, hs, 0, fl, fl + wallH, CD.wallDoors, tx, ty).map(w => ({ ...w, solid: true, note: 'under construction: walls at ~1/3 height' })), ...CD.frames);
    doorways.push(...CD.doorways); // no leaves hung yet (r_door_state); jamb reliefs blocked out (relief_state_467)
    let raised = 0; const [nx, ny] = v<number[]>(b, 'hall_columns'); const pts = grid(nx, ny, c[0], c[1], ia);
    for (const p of pts) { const u = rng.next(); const built = u < CP.raised ? 1 : u < CP.raised + CP.partial ? CP.partial_min + CP.partial_span * rng.next() : 0; if (built === 1) raised++; parts.push(col(b, p, fl, ord, 'C', srcOf(row(b, 'construction_state'), row(b, 'interaxial')), built)); }
    // N portico: floor between the antae towers out to the portico front (y ~27, REF-PLAN), a low step band down to the
    // forecourt (C), two rows of column bases evenly spaced in its depth (shafts not yet raised)
    const PX = v<any>(b, 'r_portico_extent'), PS = v<any>(b, 'r_portico_step'), tread = v(b, 'r_step_tread');
    const depth = PX.front_y - y1, pxs = PS.x as [number, number];
    parts.push(box(b, 'portico_floor', 'limestone', 'C', srcOf(row(b, 'r_portico_extent'), row(b, 'floor')), [(pxs[0] + pxs[1]) / 2, y1 + depth / 2], [pxs[1] - pxs[0], depth], FOUND, fl, { solid: true }));
    // the E tower read on REF-PLAN (to x 185) overlaps the traced garrison W edge (182.7): clip it there (C)
    const gx0 = present('garrison') ? footprint('garrison').bounds[0] : Infinity;
    for (const [tx0, tx1r] of PX.towers_x as [number, number][]) { const tx1 = Math.min(tx1r, gx0); parts.push(box(b, 'tower', 'mudbrick', 'C', S_(b, 'r_portico_extent'), [(tx0 + tx1) / 2, y1 + depth / 2], [tx1 - tx0, depth], FOUND, fl + wallH, { solid: true, note: 'portico anta tower, under construction (C)' })); }
    parts.push(...flight(b, 'C', S_(b, 'r_portico_step'), [(pxs[0] + pxs[1]) / 2, PX.front_y + PS.steps * tread], 'S', PS.steps, fl / PS.steps, tread, pxs[1] - pxs[0], 0, FOUND));
    const [pnx, pny] = v<number[]>(b, 'portico');
    const por = grid(pnx, pny, c[0], y1 + depth / 2, ia, depth / pny);
    for (const p of por) parts.push(col(b, p, fl, ord, 'C', srcOf(row(b, 'portico'), row(b, 'r_portico_extent')), 0));
    // threshold steps outside the W, E and S doorways (the floor is raised above the court)
    const nT = v(b, 'r_threshold_steps');
    for (const d of DR as any[]) {
      if (d.wall === 'N') continue;
      const [start, dir]: [Pt, 'N' | 'S' | 'E' | 'W'] = d.wall === 'W' ? [[x0 - nT * tread, d.at[1]], 'E'] : d.wall === 'E' ? [[x1 + nT * tread, d.at[1]], 'W'] : [[d.at[0], y0 - nT * tread], 'N'];
      parts.push(...flight(b, 'C', S_(b, 'r_threshold_steps'), start, dir, nT, fl / nT, tread, d.width, 0, FOUND));
    }
    manifest.hall100 = { columns: pts.length, porticoColumns: por.length, raised, interaxial: ia, hallInterior: hs, columnHeight: ord.height, doors: DR.length };
  }

  // ---------------- Tripylon (under construction) ----------------
  if (present('tripylon')) {
    const b = 'tripylon', f = footprint(b), [x0, y0, x1, y1] = f.bounds, fl = v(b, 'floor');
    // platform: traced core + the N portico and stair-head terrace, the small S court, and the E corridor with the landing
    // at the head of the narrow E stair (all at floor level; Phase 4, PHASE4_ACCESS §5)
    const NZ = v<any>(b, 'stair_n_zone'), NF = v<any[]>(b, 'stair_n_flights'), UT = NF.find((q: any) => q.id === 'upper_terrace');
    const SC = v<any>(b, 's_portico_court'), EC = v<any>(b, 'r_e_corridor'), EN = v<any>(b, 'stair_e_narrow');
    const plat = single(polyUnion(f.polygon.slice(0, -1) as Pt[], rectPoly(NZ.x, [y1 - 1, UT.y[1]]), rectPoly(SC.court.x, [SC.court.y[0], y0 + 1]),
      rectPoly([x1 - 1, EC.x[1]], EC.y), rectPoly(EN.x, EC.landing_y)), 'tripylon platform');
    parts.push(prism(b, 'platform', 'limestone', 'B', srcOf(row(b, 'floor'), row(b, 'stair_n_zone'), row(b, 's_portico_court'), row(b, 'r_e_corridor')), plat, FOUND, fl, { solid: true }));
    const H = v<any>(b, 'hall'), c = H.centre as Pt, hall = H.side; const ord = order(b, { base: 'bell', capital: 'bull' });
    const DR = v<any[]>(b, 'doors');
    const doors = DR.map((d: any) => ({ id: d.id, side: d.id as 'N' | 'E' | 'S', at: d.id === 'E' ? d.at[1] - c[1] : d.at[0] - c[0], width: d.width, height: Infinity }));
    const PD = framed(b, c[0], c[1], hall, hall, v(b, 'r_wall'), fl, doors, v(b, 'r_door_height'));
    parts.push(...wallRing({ building: b, material: 'mudbrick', tier: 'C', src: srcOf(row(b, 'hall'), row(b, 'doors')) }, c[0], c[1], hall, hall, v(b, 'r_wall'), fl, fl + ord.height * v(b, 'r_wall_fraction_built'), PD.wallDoors).map(w => ({ ...w, solid: true, note: 'under construction' })), ...PD.frames);
    doorways.push(...PD.doorways); // no leaves hung yet (r_door_state)
    const [nx, ny] = v<number[]>(b, 'hall_columns'); const built = v(b, 'r_column_built');
    for (const p of grid(nx, ny, c[0], c[1], v(b, 'r_interaxial'))) parts.push(col(b, p, fl, ord, 'C', 'RECON', built));
    parts.push(floorFinish(b, c, hall, hall, fl, false));
    // two-column porticoes N and S of the hall (N read on the plan; S mirrored, C)
    const NP = v<any>(b, 'r_n_portico');
    for (const x of NP.x) { parts.push(col(b, [x, NP.y], fl, ord, T_(b, 'r_n_portico'), S_(b, 'r_n_portico'), built)); parts.push(col(b, [x, SC.portico_columns_y], fl, ord, 'C', S_(b, 's_portico_court'), built)); }
    // N stair: two flights rising toward a projecting central landing; outer parapet on the N side
    let stairSteps = 0; const nt = T_(b, 'stair_n_flights'), ns = srcOf(row(b, 'stair_n_flights'), row(b, 'stair_n_zone'));
    for (const F of NF) {
      if (!isFlight(F)) { if (F.id !== 'upper_terrace') parts.push(landingBox(b, nt, ns, F as any, FOUND)); continue; } // the terrace is part of the platform
      const fs = specFlight(b, nt, ns, F, FOUND); parts.push(...fs); stairSteps += fs.length;
      parts.push(...flightParapet(b, SPt, SPs, F, sideOf(F, [F.foot[0], NZ.y[1] + 1]), SP.thickness, SP.height, 0, FOUND));
    }
    // small S stair from the S court down to the area E of the Hadish (C) and the narrow E stair up to the E corridor
    const SS = v<any>(b, 'r_stair_s_flight');
    const sF: FlightRow = { id: 'S', foot: [SS.x, SS.top_y - SS.steps * SS.tread], head: [SS.x, SS.top_y], z0: 0, z1: SS.steps * SS.riser, steps: SS.steps, tread: SS.tread, width: SS.width };
    parts.push(...specFlight(b, 'C', S_(b, 'r_stair_s_flight'), sF, FOUND)); stairSteps += SS.steps;
    for (const sd of [1, -1] as const) parts.push(...flightParapet(b, SPt, SPs, sF, sd, SP.thickness, SP.height, 0, FOUND));
    const z0 = v(b, 'r_stair_e_start_level'), dirS = Math.sign(EN.head[1] - EN.foot[1]);
    const eF: FlightRow = { id: 'E', foot: EN.foot, head: [EN.foot[0], EN.foot[1] + dirS * EN.steps * EN.tread], z0, z1: fl, steps: EN.steps, tread: EN.tread, width: EN.x[1] - EN.x[0] };
    parts.push(...specFlight(b, T_(b, 'stair_e_narrow'), srcOf(row(b, 'stair_e_narrow'), row(b, 'r_stair_e_start_level')), eF, FOUND)); stairSteps += EN.steps;
    for (const sd of [1, -1] as const) parts.push(...flightParapet(b, SPt, SPs, eF, sd, SP.thickness, SP.height, 0, FOUND));
    manifest.tripylon = { columns: nx * ny, floor: fl, hallInterior: hall, stairSteps, doors: DR.length };
  }

  // ---------------- Treasury, Harem, Garrison (perimeter walls + key halls; C interiors) ----------------
  /** enclosure walls along an outline; `doors` (grid point + width) cut gaps in the nearest wall run; `steps` puts a short
   *  flight outside each gap, down from the raised floor to the court */
  const perimeter = (b: string, poly: Pt[], fl: number, wallT: number, wallH: number, note: string, doors: { at: Pt; width: number; id?: string; height?: number }[] = [], steps?: { n: number; tread: number; t: Tier; s: string }, floor: Material = 'court_fill') => {
    const sg = ringSign(poly), gapways: Doorway[] = [];
    parts.push(prism(b, 'floor', floor, 'B', 'OSM', poly, FOUND, fl, { solid: true }));
    for (let i = 0; i < poly.length; i++) {
      const a = poly[i], c2 = poly[(i + 1) % poly.length], len = Math.hypot(c2[0] - a[0], c2[1] - a[1]); if (len < wallT / 2) continue;
      const ux = (c2[0] - a[0]) / len, uy = (c2[1] - a[1]) / len, nx = -uy, ny = ux;
      // wall runs along this edge between door gaps (parameter s along the edge)
      const gaps = doors.map(d => ({ s: (d.at[0] - a[0]) * ux + (d.at[1] - a[1]) * uy, off: Math.abs((d.at[0] - a[0]) * nx + (d.at[1] - a[1]) * ny), w: d.width, id: d.id, h: d.height }))
        .filter(g => g.off < wallT * 2 && g.s > 0 && g.s < len).sort((p, q) => p.s - q.s);
      const runs: [number, number][] = []; let s0 = 0;
      for (const g of gaps) { runs.push([s0, g.s - g.w / 2]); s0 = g.s + g.w / 2; }
      runs.push([s0, len]);
      // doorway descriptors (door leaves, D-051): centre on the wall mid-plane, n pointing inward (the enclosure side)
      for (const g of gaps) {
        gapways.push({ id: `${b}:${g.id ?? gapways.length}`, building: b, door: g.id ?? String(gapways.length), side: 'perimeter', at: 0, c: [a[0] + ux * g.s + sg * nx * wallT / 2, a[1] + uy * g.s + sg * ny * wallT / 2], u: [ux, uy], n: [sg * nx, sg * ny], width: g.w, height: g.h ?? wallH, y0: fl, depth: wallT, proj: 0, jamb: 0, framed: false });
        if (g.h !== undefined && g.h < wallH) parts.push({ ...box(b, 'wall', 'mudbrick', 'C', 'RECON', [a[0] + ux * g.s + sg * nx * wallT / 2, a[1] + uy * g.s + sg * ny * wallT / 2], [g.w, wallT], fl + g.h, fl + wallH, { solid: true, note: note + '; over the doorway' }), rot: Math.atan2(uy, ux) });
      }
      for (const [r0, r1] of runs) { if (r1 - r0 < wallT / 2) continue; const m = (r0 + r1) / 2;
        parts.push({ ...box(b, 'wall', 'mudbrick', 'C', 'RECON', [a[0] + ux * m + sg * nx * wallT / 2, a[1] + uy * m + sg * ny * wallT / 2], [r1 - r0, wallT], fl, fl + wallH, { solid: true, note }), rot: Math.atan2(uy, ux) }); }
      if (steps && fl > 0) for (const g of gaps) { // outward = −(inward normal)
        const ox = -sg * nx, oy = -sg * ny, run = steps.n * steps.tread, ex: Pt = [a[0] + ux * g.s + ox * run, a[1] + uy * g.s + oy * run];
        parts.push(...flightAlong(b, steps.t, steps.s, ex, [-ox, -oy], steps.n, fl / steps.n, steps.tread, g.w, 0, FOUND));
      }
    }
    return gapways;
  };
  const fpRing = (k: string) => footprint(k).polygon.slice(0, -1) as Pt[];
  if (present('treasury')) {
    const b = 'treasury', fl = v(b, 'floor') + v(b, 'r_floor_raise'), W = v<any>(b, 'r_wall');
    // the traced N edge includes the ~12 m street S of the Hall of 100 Columns: the N wall stands at y −78 (both plans)
    const [bx0, by0, bx1] = footprint(b).bounds;
    const poly = single(polyIntersection(fpRing(b), rectPoly([bx0 - 1, bx1 + 1], [by0 - 1, v(b, 'r_north_wall_y')])), 'treasury outline');
    const DR = v<any[]>(b, 'doors');
    // floors: lime plaster with a red hematite coat, attested for the Treasury (flooring-plaster study; global.interior_floor, B)
    const TW = perimeter(b, poly, fl, W.thickness, W.height, 'Treasury enclosure (C thickness/height); N and E doorways (REF-PLAN, C)', DR.map((d: any) => ({ ...d, height: v(b, 'r_door_height') })), undefined, v<string>('global', 'interior_floor') as Material);
    const [x0, y0, x1, y1] = footprint(b).bounds;
    const ord = order(b, { base: 'square2', capital: 'plain', material: 'timber' });
    const [gx, gy] = v<number[]>(b, 'r_hall99_grid');
    const pts = grid(gx, gy, (x0 + x1) / 2, (y0 + y1) / 2 + v(b, 'r_hall99_offset_n'), v(b, 'r_hall99_spacing'));
    for (const p of pts) parts.push(col(b, p, fl, ord, 'C', S_(b, 'hall99')));
    // the Hall of 99 Columns: walls one bay outside the column grid, a N doorway toward the entrance, a timber roof, and
    // mud-brick benches along the inner walls for the stored goods (all C; the hall and its contents' types are B)
    const HW = v<any>(b, 'r_hall99_walls'), BN = v<any>(b, 'r_benches'), sp = v(b, 'r_hall99_spacing');
    const hcx = (x0 + x1) / 2, hcy = (y0 + y1) / 2 + v(b, 'r_hall99_offset_n'), hsx = (gx + 1) * sp, hsy = (gy + 1) * sp;
    const hdoor: Door = { side: 'N', at: 0, width: HW.door_width, height: HW.door_height };
    parts.push(...wallRing({ building: b, material: 'mudbrick', tier: 'C', src: S_(b, 'r_hall99_walls') }, hcx, hcy, hsx, hsy, HW.thickness, fl, fl + ord.height + HW.roof, [hdoor]).map(w => ({ ...w, solid: true })));
    // door leaves (D-051): the enclosure doors open inward; the store door of the hall swings out (the benches line its
    // inner wall face) and is sealed outside working hours (r_door_state; sealing global.r_door_sealing)
    const HS = ringSide('N', hcx, hcy, hsx, hsy, HW.thickness, HW.thickness), hd = ringDoorway(b, 'hall99', 'N', HS, 0, HW.door_width, HW.door_height, fl, null);
    doorways.push(...TW, hd); parts.push(...hang(b, TW, {}), ...hang(b, [hd], { N: [[HS.half + HW.thickness, Infinity], [-Infinity, -HS.half - HW.thickness]] }, undefined, ['hall99']));
    parts.push(box(b, 'roof', 'timber', 'C', S_(b, 'r_hall99_walls'), [hcx, hcy], [hsx + 2 * HW.thickness, hsy + 2 * HW.thickness], fl + ord.height, fl + ord.height + HW.roof, { note: 'timber roof of the Hall of 99 Columns (C)' }));
    const benches: number[][] = []; // [cx, cy, sx, sy, top]
    const addBench = (c: Pt, size: [number, number]) => { parts.push(box(b, 'bench', 'mudbrick', 'C', S_(b, 'r_benches'), c, size, fl, fl + BN.height, { solid: true })); benches.push([c[0], c[1], size[0], size[1], fl + BN.height]); };
    const runX = hsx - 2 * BN.gap - 2 * BN.depth, runY = hsy - 2 * BN.gap;
    addBench([hcx, hcy - hsy / 2 + BN.depth / 2], [runX, BN.depth]); // S wall
    for (const s of [-1, 1]) addBench([hcx + s * (hsx / 2 - BN.depth / 2), hcy], [BN.depth, runY]); // W and E walls
    for (const s of [-1, 1]) addBench([hcx + s * (HW.door_width / 2 + BN.gap + (hsx / 2 - BN.gap - BN.depth - HW.door_width / 2 - BN.gap) / 2), hcy + hsy / 2 - BN.depth / 2], [hsx / 2 - BN.gap - BN.depth - HW.door_width / 2 - BN.gap, BN.depth]); // N wall, either side of the door
    // the N range (D-067, REF-PLAN): four rooms along the inside of the N wall under a flat roof, each entered from the S
    // through the inner wall; the E room is the vestibule of the N door, the NE room beside it the scribes' room
    const NR = v<any>(b, 'n_range'), NH = v<any>(b, 'r_n_range_height'), nt = T_(b, 'n_range'), ns = srcOf(row(b, 'n_range'), row(b, 'r_n_range_height'));
    const top = fl + NH.clear, [iwS, iwN] = NR.inner_wall as number[], nIn = NR.inner_face_n as number, iwc = (iwS + iwN) / 2, iwt = iwN - iwS;
    const wallBox = (c: Pt, size: [number, number], y0: number, y1: number, note: string) => parts.push(box(b, 'wall', 'mudbrick', nt, ns, c, size, y0, y1, { solid: true, note }));
    let xa = NR.x[0];
    for (const [d0, d1] of NR.hall_doors as [number, number][]) {
      wallBox([(xa + d0) / 2, iwc], [d0 - xa, iwt], fl, top, 'N range inner wall (REF-PLAN)');
      wallBox([(d0 + d1) / 2, iwc], [d1 - d0, iwt], fl + NH.door_height, top, 'wall over an N-range doorway (lintel, C)');
      xa = d1;
    }
    wallBox([(xa + NR.x[1]) / 2, iwc], [NR.x[1] - xa, iwt], fl, top, 'N range inner wall (REF-PLAN)');
    for (const [c0, c1] of NR.cross_walls as [number, number][]) wallBox([(c0 + c1) / 2, (iwN + nIn) / 2], [c1 - c0, nIn - iwN], fl, top, 'N range cross wall (REF-PLAN)');
    const EW = NR.e_wall, ewc = (EW.x[0] + EW.x[1]) / 2, ewt = EW.x[1] - EW.x[0];
    wallBox([ewc, (iwN + EW.door_y[0]) / 2], [ewt, EW.door_y[0] - iwN], fl, top, 'vestibule E wall (REF-PLAN)');
    wallBox([ewc, (EW.door_y[1] + nIn) / 2], [ewt, nIn - EW.door_y[1]], fl, top, 'vestibule E wall (REF-PLAN)');
    wallBox([ewc, (EW.door_y[0] + EW.door_y[1]) / 2], [ewt, EW.door_y[1] - EW.door_y[0]], fl + NH.door_height, top, 'wall over the vestibule E doorway (C)');
    parts.push(box(b, 'roof', 'timber', 'C', S_(b, 'r_n_range_height'), [(NR.x[0] + NR.x[1]) / 2, (iwS + nIn) / 2], [NR.x[1] - NR.x[0], nIn - iwS], top, top + NH.roof, { note: 'flat timber-and-earth roof over the N range (C)' }));
    // the scribes' room: a mud-brick bench along its N and W walls (C) for the filed tablets
    const SR = v<any>(b, 'scribes_room'), RB = v<any>(b, 'r_scribes_room').bench, [rx0, rx1] = (NR.rooms as number[][])[SR.room];
    const rs = S_(b, 'r_scribes_room'), shelves: number[][] = [];
    const bench = (c: Pt, size: [number, number]) => { parts.push(box(b, 'bench', 'mudbrick', 'C', rs, c, size, fl, fl + RB.height, { solid: true, note: 'scribes\' room bench for filed tablets (C)' })); shelves.push([c[0], c[1], size[0], size[1], fl + RB.height]); };
    bench([(rx0 + RB.depth + RB.gap + rx1 - RB.gap) / 2, nIn - RB.depth / 2], [rx1 - RB.gap - (rx0 + RB.depth + RB.gap), RB.depth]); // N wall
    bench([rx0 + RB.depth / 2, (iwN + RB.gap + nIn) / 2], [RB.depth, nIn - iwN - RB.gap], ); // W wall, from the N wall to the gap by the S wall
    manifest.treasury = { room: [hcx, hcy, hsx, hsy, fl, ord.height], hall99Columns: pts.length, columnHeight: ord.height, northWallY: Math.max(...poly.map(q => q[1])), doors: DR.length, benches: benches as any,
      scribesRoom: [(rx0 + rx1) / 2, (iwN + nIn) / 2, rx1 - rx0, nIn - iwN, fl, NH.clear] as any, scribesShelves: shelves as any };
  }
  if (present('harem')) {
    const b = 'harem', fl = v(b, 'floor'), W = v<any>(b, 'r_wall');
    // the main wing runs N of the modern museum footprint to y ~−73 (both plans): enclosure = traced outline ∪ wing extent
    const MW = v<any>(b, 'r_main_wing_extent');
    const poly = single(polyUnion(fpRing(b), rectPoly(MW.x, MW.y)), 'harem outline');
    const ES = v<any>(b, 'r_entrance_steps');
    perimeter(b, poly, fl, W.thickness, W.height, 'Harem enclosure (C)', (v<any[]>(b, 'r_entrances')).map(e => ({ at: e.at, width: v(b, 'r_entrance_width') })),
      { n: ES.steps, tread: ES.tread, t: T_(b, 'r_entrance_steps'), s: S_(b, 'r_entrance_steps') });
    // main hall (12 columns, 3 × 4) with its four doorways, and the 8-column portico facing the N court
    const HL = v<any>(b, 'hall'), hc: Pt = [(HL.interior_x[0] + HL.interior_x[1]) / 2, (HL.interior_y[0] + HL.interior_y[1]) / 2];
    const hx = HL.interior_x[1] - HL.interior_x[0], hy = HL.interior_y[1] - HL.interior_y[0];
    const ord = order(b, { base: 'bell', capital: 'bull' }); const ia = v(b, 'r_interaxial');
    const DR = v<any[]>(b, 'doors');
    const doors = DR.map((d: any) => ({ id: d.id, side: d.id as 'N' | 'S' | 'E' | 'W', at: d.id === 'N' || d.id === 'S' ? d.at[0] - hc[0] : d.at[1] - hc[1], width: d.width, height: v(b, 'r_door_height') }));
    const RD = framed(b, hc[0], hc[1], hx, hy, v(b, 'r_hall_wall'), fl, doors, v(b, 'r_door_height'));
    const RO = openings(b, hc[0], hc[1], hx, hy, v(b, 'r_hall_wall'), v(b, 'r_hall_wall'), fl, wallRing({ building: b, material: 'mudbrick', tier: 'C', src: srcOf(row(b, 'hall'), row(b, 'doors')) }, hc[0], hc[1], hx, hy, v(b, 'r_hall_wall'), fl, fl + W.height, RD.wallDoors), RD.doors, doors[0]);
    parts.push(...RO.walls.map(w => ({ ...w, solid: true })), ...RD.frames, ...hang(b, RD.doorways, RO.blocked)); doorways.push(...RD.doorways);
    const [hnx, hny] = v<number[]>(b, 'hall_columns'), [pnx] = v<number[]>(b, 'portico');
    const hall = grid(hnx, hny, hc[0], hc[1], ia); for (const p of hall) parts.push(col(b, p, fl, ord, T_(b, 'hall'), srcOf(row(b, 'hall_columns'), row(b, 'hall'))));
    parts.push(floorFinish(b, hc, hx, hy, fl, false));
    const PL = v<any>(b, 'portico_layout'); const por: Pt[] = [];
    for (const y of v<number[]>(b, 'r_portico_rows_y')) for (let i = 0; i < pnx; i++) por.push([(PL.x[0] + PL.x[1]) / 2 + (i - (pnx - 1) / 2) * ia, y]);
    for (const p of por) parts.push(col(b, p, fl, ord, 'C', srcOf(row(b, 'portico'), row(b, 'portico_layout'))));
    const hw = v(b, 'r_hall_wall');
    parts.push(box(b, 'roof', 'timber', 'C', 'RECON', [hc[0], (hc[1] - hy / 2 - hw + PL.front_y) / 2], [hx + 2 * hw, PL.front_y - (hc[1] - hy / 2 - hw)], fl + ord.height, fl + ord.height + hw / 2, { note: 'roof over the main hall and portico (C)' }));
    manifest.harem = { room: [hc[0], hc[1], hx, hy, fl, ord.height], hallColumns: hall.length, porticoColumns: por.length, northEdge: Math.max(...poly.map(q => q[1])) };
  }
  if (present('garrison')) { const W = v<any>('garrison', 'r_wall'); perimeter('garrison', fpRing('garrison'), v('garrison', 'floor') + v('garrison', 'r_floor_raise'), W.thickness, W.height, 'garrison quarters (C)', v<any>('garrison', 'r_doors')); }

  // ---------------- East fortification (mud brick) ----------------
  if (present('fortification_e')) {
    const b = 'fortification_e', t = v(b, 'wall_thickness'), h = v(b, 'curtain_height'), th = v(b, 'tower_extra_height'), sp = v(b, 'tower_spacing'), TW = v<any>(b, 'r_tower');
    const T = footprint('terrace').polygon as Pt[]; const sg = ringSign(T.slice(0, -1));
    let towers = 0;
    for (let i = 0; i < T.length - 1; i++) {
      const a = T[i], c2 = T[i + 1]; if (!(a[0] > EAST && c2[0] > EAST)) continue;
      const len = Math.hypot(c2[0] - a[0], c2[1] - a[1]); if (len < 2) continue;
      const nx = -(c2[1] - a[1]) / len, ny = (c2[0] - a[0]) / len, rot = Math.atan2(c2[1] - a[1], c2[0] - a[0]);
      parts.push({ ...box(b, 'curtain', 'mudbrick', 'B', srcOf(row(b, 'wall_thickness'), row(b, 'curtain_height')), [(a[0] + c2[0]) / 2 + sg * nx * t / 2, (a[1] + c2[1]) / 2 + sg * ny * t / 2], [len, t], 0, h, { solid: true }), rot });
      for (let d = sp / 2; d < len; d += sp) {
        const u = d / len; const p: Pt = [a[0] + (c2[0] - a[0]) * u + sg * nx * t / 2, a[1] + (c2[1] - a[1]) * u + sg * ny * t / 2];
        parts.push({ ...box(b, 'tower', 'mudbrick', 'C', srcOf(row(b, 'tower_spacing'), row(b, 'r_tower')), p, [TW.length, t + TW.extra_width], 0, h + th, { solid: true }), rot }); towers++;
      }
    }
    manifest.fortification_e = { towers, thickness: t, height: h };
  }
  return { parts, manifest, doorways };
}
