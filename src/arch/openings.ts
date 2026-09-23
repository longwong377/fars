// Openings of the Phase 4 palaces (D-050, D-051): window openings and blind niches in monolithic dark-stone frames, the
// doorway descriptors that door leaves and jamb reliefs are placed on, and the timber door leaves themselves. Every size
// comes from SITE_SPEC rows (global.r_window, r_niche, r_door_frame, r_door_leaf; per-building r_windows, r_niches,
// r_door_state): no literals (the literal lint in tests/arch.test.ts covers this file).
import type { Base, Box, Pt, FrameDims, Doorway, DoorLeafData, DoorState, Material } from './parts';
import { frameTop } from './parts';

type Tier = 'A' | 'B' | 'C';
// tolerance for 'grid-aligned' (a structural constant, not a dimension)
const EPS = Math.sqrt(Number.EPSILON);
// grid-aligned box from along [a0, a1] (along u) and across [c0, c1] (along n) about wall point w; u and n axis-aligned
export function wallBox(b: Omit<Base, 'kind'>, kind: string, w: Pt, u: Pt, n: Pt, a0: number, a1: number, c0: number, c1: number, y0: number, y1: number, extra: Partial<Box> = {}): Box {
  const am = (a0 + a1) / 2, cm = (c0 + c1) / 2, alongX = Math.abs(u[0]) > Math.abs(u[1]);
  return { ...b, kind, type: 'box', c: [w[0] + u[0] * am + n[0] * cm, w[1] + u[1] * am + n[1] * cm], size: alongX ? [a1 - a0, c1 - c0] : [c1 - c0, a1 - a0], y0, y1, ...extra };
}
// one side of a wall ring (as wallRing lays it out): the wall's mid-plane point at the side's centre, along u, inner n,
 //  thickness, and the interior half-length along the side
export function ringSide(side: 'N' | 'S' | 'E' | 'W', cx: number, cy: number, w: number, h: number, tx: number, ty: number) {
  return {
    N: { w: [cx, cy + h / 2 + ty / 2] as Pt, u: [1, 0] as Pt, n: [0, -1] as Pt, th: ty, half: w / 2 },
    S: { w: [cx, cy - h / 2 - ty / 2] as Pt, u: [1, 0] as Pt, n: [0, 1] as Pt, th: ty, half: w / 2 },
    E: { w: [cx + w / 2 + tx / 2, cy] as Pt, u: [0, 1] as Pt, n: [-1, 0] as Pt, th: tx, half: h / 2 },
    W: { w: [cx - w / 2 - tx / 2, cy] as Pt, u: [0, 1] as Pt, n: [1, 0] as Pt, th: tx, half: h / 2 },
  }[side];
}
export interface OpeningSpec { width: number; sill: number; head: number; sillBlock: number; nicheDepth: number }
// A window through the wall (through = true) or a blind niche in its inner face, at offset `at` along a ring side, in a
 //  stone frame (jambs, sill block, lintel, projecting cornice). Returns the cutter (the frame's volume inside the wall: the
 //  frame replaces the brick, so no frame face is coplanar with a wall face) and the frame parts.
export function openingParts(b: Omit<Base, 'kind'>, S: ReturnType<typeof ringSide>, at: number, y0: number, O: OpeningSpec, F: FrameDims, through: boolean) {
  const hw = O.width / 2, J = F.jamb, P = F.projection, CP = F.cornice_projection;
  const [c0, c1] = through ? [-S.th / 2 - P, S.th / 2 + P] : [S.th / 2 - O.nicheDepth, S.th / 2 + P]; // across: n points into the hall
  const ys = y0 + O.sill, yh = y0 + O.head, kind = through ? 'window_frame' : 'niche_frame';
  const frames: Box[] = [
    wallBox(b, kind, S.w, S.u, S.n, at - hw - J, at + hw + J, c0, c1, ys - O.sillBlock, ys, { solid: true }), // sill block
    wallBox(b, kind, S.w, S.u, S.n, at - hw - J, at - hw, c0, c1, ys, yh, { solid: true }), wallBox(b, kind, S.w, S.u, S.n, at + hw, at + hw + J, c0, c1, ys, yh, { solid: true }), // jambs
    wallBox(b, kind, S.w, S.u, S.n, at - hw - J, at + hw + J, c0, c1, yh, yh + F.lintel, { solid: true }), // lintel
    wallBox(b, kind, S.w, S.u, S.n, at - hw - J - CP, at + hw + J + CP, through ? c0 - CP : c0, c1 + CP, yh + F.lintel, frameTop(yh, F), { solid: true }), // cornice
  ];
  const [k0, k1] = through ? [-S.th / 2, S.th / 2] : [S.th / 2 - O.nicheDepth, S.th / 2];
  const cutter = wallBox(b, 'cut', S.w, S.u, S.n, at - hw - J, at + hw + J, k0, k1, ys - O.sillBlock, yh + F.lintel);
  // the opening itself (clear space), for tests and the nav check
  const clear = wallBox(b, through ? 'window' : 'niche', S.w, S.u, S.n, at - hw, at + hw, k0, k1, ys, yh);
  return { frames, cutter, clear };
}

// a doorway descriptor on a ring side
export function ringDoorway(building: string, door: string, side: string, S: ReturnType<typeof ringSide>, at: number, width: number, height: number, y0: number, F: FrameDims | null): Doorway {
  return { id: `${building}:${door}`, building, door, side, at, c: [S.w[0] + S.u[0] * at, S.w[1] + S.u[1] * at], u: S.u, n: S.n, width, height, y0, depth: S.th, proj: F ? F.projection : 0, jamb: F ? F.jamb : 0, framed: !!F };
}

export interface LeafSpec { thickness: number; gap: number }
// extents along the wall, on the leaf side, that a leaf lying against the wall must not overlap (other frames, corners),
 //  as [a0, a1] offsets along d.u from the doorway centre
export type Blocked = [number, number][];
// The two leaves of a doorway (D-051). Each turns on a post at the opening edge, just in front of the frame on the n
 //  side; closed, the pair spans the opening; open, a leaf swings 180° through the hall to lie against the inner wall face,
 //  or 90° (standing into the hall) where a corner or another frame leaves less than its length. The parts are the leaves
 //  in their walkable-grid pose.
export function leafParts(d: Doorway, state: DoorState, L: LeafSpec, blocked: Blocked, b: { tier: Tier; src: string; material: Material }, outside: Pt): Box[] {
  const out: Box[] = [], len = d.width / 2 - L.gap / 2, t = L.thickness;
  const across = d.depth / 2 + d.proj + t / 2; // pivot line in front of the frame (n side)
  const az = (v: Pt) => Math.atan2(v[1], v[0]);
  const navOpen = state === 'open' || state === 'closed' || state === 'scheduled_locked' || state === 'scheduled_sealed';
  for (const s of [-1, 1] as const) {
    const pa = s * d.width / 2; // opening edge, along u
    const pivot: Pt = [d.c[0] + d.u[0] * pa + d.n[0] * across, d.c[1] + d.u[1] * pa + d.n[1] * across];
    const closedDir: Pt = [-s * d.u[0], -s * d.u[1]];
    // room for the leaf against the wall: nothing blocked between the opening edge and one leaf length (+ gap) beyond it
    const lo = Math.min(pa, pa + s * (len + L.gap)), hi = Math.max(pa, pa + s * (len + L.gap));
    const room = !blocked.some(([a0, a1]) => a1 > lo && a0 < hi);
    // swing through the hall: the leaf passes the n direction on its way (closed → n → against the wall); a quarter turn
    // stops at n. openAz is closedAz ± a quarter or half turn, so interpolating the angle sweeps the hall side
    const closedAz = az(closedDir), quarter = Math.sign(Math.sin(az([d.n[0], d.n[1]]) - closedAz)) * Math.PI / 2;
    const openAz = closedAz + quarter * (room ? 2 : 1);
    const pose = navOpen ? openAz : closedAz, dx = Math.cos(pose), dy = Math.sin(pose);
    const c: Pt = [pivot[0] + dx * len / 2, pivot[1] + dy * len / 2];
    const axis = Math.abs(Math.abs(dx) - 1) < EPS || Math.abs(Math.abs(dy) - 1) < EPS; // grid-aligned: no rot
    const through: Pt = [-d.n[0] * (d.depth + d.proj + t / 2), -d.n[1] * (d.depth + d.proj + t / 2)];
    const door: DoorLeafData = { id: d.id, building: d.building, leaf: s < 0 ? 0 : 1, pivot, len, thickness: t, y0: d.y0, height: d.height, closedAz, openAz, state, navOpen, outside, through };
    out.push({ building: d.building, kind: 'door_leaf', material: b.material, tier: b.tier, src: b.src, type: 'box', c,
      size: axis ? (Math.abs(dx) > Math.abs(dy) ? [len, t] : [t, len]) : [len, t], ...(axis ? {} : { rot: pose }), y0: d.y0, y1: d.y0 + d.height, solid: true, door,
      note: `timber door leaf with bronze fittings (C, D-051); ${state}${room ? '' : ', opens 90° (no room against the wall)'}` });
  }
  return out;
}
