// Walls laid out from a measured plan (D-130: the Tachara from REF-PLAN). The plan is a list of axis-aligned wall
// rectangles between measured faces (SITE_SPEC plan_walls) and the doorways, windows and blind niches cut in them
// (plan_openings). Doorways are stone-framed (global.r_door_frame: jambs lining the opening, a lintel and a projecting
// cornice; the brick is cut away as wide as the frame, D-050) or plain openings under a brick lintel; windows and niches
// get the frames of openings.ts. Returns the same kinds of parts, doorway descriptors and leaf clearances as the wall-ring
// helpers of terrace.ts, so door leaves (D-051) and jamb reliefs (D-049) work unchanged. Every size comes from SITE_SPEC
// rows: no literals (the literal lint in tests/arch.test.ts covers this file).
import type { Base, Box, Pt, FrameDims, Doorway } from './parts';
import { frameTop, cutWall } from './parts';
import { wallBox, openingParts, ringDoorway } from './openings';

export type Side = 'N' | 'S' | 'E' | 'W';
export interface PlanWall { id: string; x: [number, number]; y: [number, number] }
/** door = stone-framed doorway (leaves hang in it when the building's r_door_state lists it); gap = plain opening under a
 *  brick lintel; window = through the wall; niche = blind, in the `side` face. `at` = centre along the wall (x for an E-W
 *  wall, y for a N-S wall), `side` = the side door leaves open to and jamb figures walk toward, or a niche's face;
 *  `h` = height class (the building's r_doors) */
export interface PlanOpening { id: string; wall: string; at: number; width: number; kind: 'door' | 'gap' | 'window' | 'niche'; side: Side; h: string; present_467?: boolean }
export interface PlanOpeningDims { sill: number; sillBlock: number; nicheDepth: number }
type Meta = Omit<Base, 'kind'>;

const NORMAL: Record<Side, Pt> = { N: [0, 1], S: [0, -1], E: [1, 0], W: [-1, 0] };
// tolerance for coincident faces (a structural constant, not a dimension)
const EPS = Math.sqrt(Number.EPSILON);

/** does the wall run grid E-W (along x)? */
export const alongX = (w: PlanWall) => w.x[1] - w.x[0] >= w.y[1] - w.y[0];
/** a plan wall as a wall side (the shape openings.ringSide returns): mid-plane centre, along u, unit normal toward `side`,
 *  thickness, half-length */
export function planSide(w: PlanWall, side: Side) {
  const ax = alongX(w), n = NORMAL[side];
  if ((ax ? n[1] : n[0]) === 0) throw new Error(`plan wall ${w.id}: side ${side} does not face across the wall`);
  return { w: [(w.x[0] + w.x[1]) / 2, (w.y[0] + w.y[1]) / 2] as Pt, u: (ax ? [1, 0] : [0, 1]) as Pt, n, th: ax ? w.y[1] - w.y[0] : w.x[1] - w.x[0], half: (ax ? w.x[1] - w.x[0] : w.y[1] - w.y[0]) / 2 };
}
/** an opening's centre along its wall, relative to the wall's centre */
export const alongOf = (w: PlanWall, at: number) => at - (alongX(w) ? (w.x[0] + w.x[1]) / 2 : (w.y[0] + w.y[1]) / 2);
/** the leaf-clearance key of a wall face (Doorway.side of the doorways opening to that face) */
export const faceKey = (w: PlanWall, side: Side) => `${w.id}:${side}`;

export interface PlanBuild { walls: Box[]; frames: Box[]; doorways: Doorway[]; clear: Box[]; blocked: Record<string, [number, number][]>; windows: number; niches: number }
/** build the walls of a plan from floor `y0` to `top`: brick pieces between the openings (and over them, from the lintel or
 *  the frame's cornice to the top), stone frames, the doorway descriptors, the clear volumes of windows and niches, and per
 *  wall face the along-wall extents a door leaf lying against that face must keep clear of (the wall's ends, walls that
 *  abut the face, and the frames standing on it) */
export function buildPlanWalls(b: string, meta: { wall: Meta; door: Meta; window: Meta; niche: Meta }, walls: PlanWall[], openings: PlanOpening[],
  y0: number, top: number, heights: Record<string, number>, F: FrameDims, O: PlanOpeningDims): PlanBuild {
  const out: PlanBuild = { walls: [], frames: [], doorways: [], clear: [], blocked: {}, windows: 0, niches: 0 };
  const byId = new Map(walls.map(w => [w.id, w]));
  const built = openings.filter(o => o.present_467 !== false);
  for (const o of built) if (!byId.has(o.wall)) throw new Error(`${b}: opening ${o.id} on unknown wall ${o.wall}`);
  const h = (o: PlanOpening) => { const v = heights[o.h]; if (!Number.isFinite(v)) throw new Error(`${b}: no height class ${o.h}`); return v; };
  for (const w of walls) {
    const ax = alongX(w), S0 = planSide(w, ax ? 'N' : 'E'), mine = built.filter(o => o.wall === w.id);
    // gaps in the brick: a framed doorway as wide as its frame up to the cornice top, a plain opening up to its lintel
    const gaps = mine.filter(o => o.kind === 'door' || o.kind === 'gap').map(o => {
      const a = alongOf(w, o.at), j = o.kind === 'door' ? F.jamb : 0;
      return { a: a - o.width / 2 - j, b: a + o.width / 2 + j, h: o.kind === 'door' ? frameTop(h(o), F) : h(o) };
    }).sort((p, q) => p.a - q.a);
    for (const g of gaps) if (g.a < -S0.half - EPS || g.b > S0.half + EPS) throw new Error(`${b}: an opening runs off the end of wall ${w.id}`);
    const pieces: Box[] = [];
    const seg = (a: number, a1: number, ya: number, yb: number) => { if (a1 - a > EPS && yb - ya > EPS) pieces.push(wallBox(meta.wall, 'wall', S0.w, S0.u, S0.n, a, a1, -S0.th / 2, S0.th / 2, ya, yb, { solid: true })); };
    let cur = -S0.half;
    for (const g of gaps) { if (g.a < cur - EPS) throw new Error(`${b}: overlapping openings in wall ${w.id}`); seg(cur, g.a, y0, top); seg(g.a, g.b, y0 + g.h, top); cur = g.b; }
    seg(cur, S0.half, y0, top);
    // windows and niches: the frame replaces the brick (cutters), so no frame face is coplanar with a wall face (D-050)
    const cutters: Box[] = [];
    for (const o of mine.filter(q => q.kind === 'window' || q.kind === 'niche')) {
      const through = o.kind === 'window', S = planSide(w, o.side);
      const op = openingParts(through ? meta.window : meta.niche, S, alongOf(w, o.at), y0, { width: o.width, sill: O.sill, head: h(o), sillBlock: O.sillBlock, nicheDepth: O.nicheDepth }, F, through);
      out.frames.push(...op.frames); cutters.push(op.cutter); out.clear.push(op.clear);
      if (through) out.windows++; else out.niches++;
    }
    out.walls.push(...pieces.flatMap(q => cutWall(q, cutters) ?? [q]));
    // doorways: frames (as parts.doorFrames: jambs through the wall plus the projection, lintel, cornice) and descriptors
    for (const o of mine.filter(q => q.kind === 'door' || q.kind === 'gap')) {
      const S = planSide(w, o.side), a = alongOf(w, o.at), hh = h(o), framed = o.kind === 'door', deep = S.th / 2 + F.projection, hw = o.width / 2;
      if (framed) {
        const fb = (a0: number, a1: number, c: number, ya: number, yb: number) => wallBox(meta.door, 'door_frame', S.w, S.u, S.n, a0, a1, -c, c, ya, yb, { solid: true });
        out.frames.push(fb(a - hw - F.jamb, a - hw, deep, y0, y0 + hh), fb(a + hw, a + hw + F.jamb, deep, y0, y0 + hh),
          fb(a - hw - F.jamb, a + hw + F.jamb, deep, y0 + hh, y0 + hh + F.lintel),
          fb(a - hw - F.jamb - F.cornice_projection, a + hw + F.jamb + F.cornice_projection, deep + F.cornice_projection, y0 + hh + F.lintel, frameTop(y0 + hh, F)));
      }
      out.doorways.push(ringDoorway(b, o.id, faceKey(w, o.side), S, a, o.width, hh, y0, framed ? F : null));
    }
    // leaf clearances on each face: the wall's ends, walls abutting the face (reaching into the strip one wall thickness
    // deep in front of it), frames on the face (doors and windows: both faces; niches: their own face) and plain openings
    for (const side of (ax ? ['N', 'S'] : ['E', 'W']) as Side[]) {
      const S = planSide(w, side), sgn = ax ? S.n[1] : S.n[0], cA = ax ? S.w[0] : S.w[1], face = (ax ? S.w[1] : S.w[0]) + sgn * S.th / 2;
      const strip = sgn > 0 ? [face, face + S.th] : [face - S.th, face];
      const list: [number, number][] = [[S.half, Infinity], [-Infinity, -S.half]];
      for (const q of walls) {
        if (q === w) continue;
        const [qa0, qa1] = ax ? q.x : q.y, [qc0, qc1] = ax ? q.y : q.x;
        if (qc0 < strip[1] - EPS && qc1 > strip[0] + EPS && qa1 - cA > -S.half + EPS && qa0 - cA < S.half - EPS) list.push([qa0 - cA, qa1 - cA]);
      }
      for (const o of mine) if (o.kind !== 'niche' || o.side === side) {
        const a = alongOf(w, o.at), j = o.kind === 'gap' ? 0 : F.jamb; list.push([a - o.width / 2 - j, a + o.width / 2 + j]);
      }
      out.blocked[faceKey(w, side)] = list;
    }
  }
  return out;
}
