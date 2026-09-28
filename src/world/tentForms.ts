// D-330: the court camps' tents as pitched cloth: the frame each kind of camps.ts TENT_KINDS stands on (poles), how its cloth
// is held (the points pinned: the ridge, the pole tops, the eave and hem points where the guy ropes and pegs hold it), and the
// ropes and pegs. One source for the Blender cloth simulation (tools/blender/sources/tents.ts → decor_tents.py) and the game's
// rig (courtCamps.ts draws the poles, ropes and pegs from here, so they meet the simulated cloth at its pinned points).
// Local frame: x to the tent's right, y up from the ground, z = −forward (the door faces −z); metres. All C: nothing of a
// court camp at Persepolis is known (Q-333); the forms are the ridge tent of the Achaemenid army's camp (HDT 9.70, 9.80: tents
// named, not described), the Near Eastern herders' black tent (ethnographic) and a pavilion (C); rigging after pitched tents
// of those types (spacing of ropes ~1 m, pegs 0.3 m: C; Q-917).
import { TENT_KINDS, type TentKind } from '../people/camps';

export type V3 = [number, number, number];
export interface Pole { a: V3; b: V3; r: number }
export interface Rope { a: V3; b: V3 }
/** a cloth panel: a grid over (s, t) in [0, 1]², its rest shape `at(s, t)`, the panel's size in metres along s and t (the
 *  simulation's grid spacing follows), and the (s, t) of the points held (pins) */
export interface Panel { id: string; ls: number; lt: number; pins: [number, number][]; /** whole grid lines held: s = const or t = const */ pinLines: { s?: number; t?: number }[]; /** the diagonals held (a pyramid roof's hips, sewn over hip ropes) */ diag?: boolean; cut?: { s0: number; s1: number; t0: number; t1: number } }
export interface TentForm { kind: TentKind; w: number; d: number; h: number; poles: Pole[]; ropes: Rope[]; pegs: V3[]; panels: Panel[]; note: string }
/** rigging constants (C): rope spacing along an edge, how far out the pegs stand, peg size, pole and rope radii */
export const RIG = { spacing: 1.1, out: 0.9, ridgeOut: 2.2, peg: 0.3, poleR: 0.045, mainPoleR: 0.065, ropeR: 0.006, wall: 0.4, blackFront: 1.45, blackBack: 0.35, pavWall: 1.8, door: { w: 1.6, h: 1.7 }, ridgeDoor: { w: 1.0, h: 1.6 } } as const;
const steps = (a: number, b: number, sp: number) => { const n = Math.max(1, Math.round((b - a) / sp)); return Array.from({ length: n + 1 }, (_, i) => a + ((b - a) * i) / n); };

/** the rest shape of a panel's point (s, t) (the pitched, taut form the simulation starts from) */
export function panelAt(kind: TentKind, id: string, s: number, t: number): V3 {
  const K = TENT_KINDS[kind], hw = K.w / 2, hd = K.d / 2, h = K.h;
  if (kind === 'ridge') {
    const e = RIG.wall, slope = Math.hypot(hw, h - e), L = 2 * (e + slope); // the sheet over the ridge: left hem → eave → ridge → eave → right hem
    if (id === 'sheet') { const a = s * L, z = hd - 2 * hd * t;
      if (a < e) return [-hw, a, z]; if (a < e + slope) { const f = (a - e) / slope; return [-hw + hw * f, e + (h - e) * f, z]; }
      if (a < e + 2 * slope) { const f = (a - e - slope) / slope; return [hw * f, h - (h - e) * f, z]; } return [hw, e - (a - e - 2 * slope), z]; }
    // the gables: back (z = +hd) closed, front (z = −hd) with its door; s across (−hw…hw), t up (0…h)
    const z = id === 'back' ? hd : -hd, x = -hw + 2 * hw * s, top = e + (h - e) * (1 - Math.abs(x) / hw);
    return [x, t * Math.max(top, 1e-3), z];
  }
  if (kind === 'black') {
    const f = RIG.blackFront, bk = RIG.blackBack;
    if (id === 'roof') { const x = -hw + 2 * hw * s, v = -hd + 2 * hd * t, y = v >= 0 ? h + (f - h) * (v / hd) : h + (bk - h) * (-v / hd); return [x, y, -v]; }
    if (id === 'backwall') return [-hw + 2 * hw * s, bk * t, hd];
    // side curtains (left, right): s along the side from back (v = −hd) to front (v = +hd), t up to the roof's edge
    const x = id === 'left' ? -hw : hw, v = -hd + 2 * hd * s, top = v >= 0 ? h + (f - h) * (v / hd) : h + (bk - h) * (-v / hd);
    return [x, t * top, -v];
  }
  // pavilion: the pyramid roof over (s, t) ∈ [0,1]² and four walls (front with the door)
  const wall = RIG.pavWall;
  if (id === 'roof') { const x = -hw + 2 * hw * s, z = -hd + 2 * hd * t, m = Math.max(Math.abs(x) / hw, Math.abs(z) / hd); return [x, wall + (h - wall) * (1 - m), z]; }
  const side = { front: [0, -1], back: [0, 1], left: [-1, 0], right: [1, 0] }[id as 'front' | 'back' | 'left' | 'right']!;
  const a = -1 + 2 * s; // along the wall, left to right seen from outside
  if (side[1] !== 0) return [side[1] < 0 ? a * hw : -a * hw, t * wall, side[1] * hd]; return [side[0] * hw, t * wall, side[0] < 0 ? -a * hd : a * hd];
}

export function tentForm(kind: TentKind): TentForm {
  const K = TENT_KINDS[kind], hw = K.w / 2, hd = K.d / 2, h = K.h, poles: Pole[] = [], ropes: Rope[] = [], pegs: V3[] = [], panels: Panel[] = [];
  const peg = (x: number, z: number) => { pegs.push([x, 0, z]); };
  if (kind === 'ridge') {
    const e = RIG.wall, slope = Math.hypot(hw, h - e), L = 2 * (e + slope);
    for (const z of [-hd, hd]) { poles.push({ a: [0, 0, z], b: [0, h, z], r: RIG.mainPoleR }); ropes.push({ a: [0, h, z], b: [0, 0, z + Math.sign(z) * RIG.ridgeOut] }); peg(0, z + Math.sign(z) * RIG.ridgeOut); }
    poles.push({ a: [0, h, -hd], b: [0, h, hd], r: RIG.poleR }); // the ridge pole
    const zs = steps(-hd, hd, RIG.spacing), pins: [number, number][] = [];
    for (const z of zs) { const t = (hd - z) / (2 * hd);
      for (const sx of [-1, 1]) { ropes.push({ a: [sx * hw, e, z], b: [sx * (hw + RIG.out), 0, z] }); peg(sx * (hw + RIG.out), z); peg(sx * hw, z); }
      pins.push([e / L, t], [1 - e / L, t], [0, t], [1, t]); } // the eaves at the ropes, the hems at the pegs
    panels.push({ id: 'sheet', ls: L, lt: 2 * hd, pins, pinLines: [{ s: 0.5 }, { t: 0 }, { t: 1 }] }); // the ridge on its pole; the gable seams taut
    const xs = steps(-hw, hw, RIG.spacing);
    for (const id of ['back', 'front']) { const gp: [number, number][] = xs.map(x => [(x + hw) / (2 * hw), 0] as [number, number]);
      panels.push({ id, ls: 2 * hw, lt: h, pins: gp, pinLines: [{ t: 1 }, { s: 0 }, { s: 1 }], ...(id === 'front' ? { cut: { s0: 0.5 - RIG.ridgeDoor.w / (4 * hw), s1: 0.5 + RIG.ridgeDoor.w / (4 * hw), t0: 0, t1: RIG.ridgeDoor.h / h } } : {}) });
      for (const x of xs) if (id === 'back' || Math.abs(x) > RIG.ridgeDoor.w / 2) peg(x, id === 'back' ? hd : -hd); }
  } else if (kind === 'black') {
    const f = RIG.blackFront, bk = RIG.blackBack, xs = steps(-hw, hw, RIG.spacing * 2);
    const mids = [-hw * 0.6, 0, hw * 0.6];
    for (const x of mids) poles.push({ a: [x, 0, 0], b: [x, h, 0], r: RIG.mainPoleR });
    const roofPins: [number, number][] = mids.map(x => [(x + hw) / (2 * hw), 0.5] as [number, number]);
    for (const x of xs) { poles.push({ a: [x, 0, -hd], b: [x, f, -hd], r: RIG.poleR }); ropes.push({ a: [x, f, -hd], b: [x * 1.12, 0, -hd - 1.6] }); peg(x * 1.12, -hd - 1.6);
      poles.push({ a: [x, 0, hd], b: [x, bk, hd], r: RIG.poleR * 0.8 }); ropes.push({ a: [x, bk, hd], b: [x, 0, hd + RIG.out] }); peg(x, hd + RIG.out);
      const s = (x + hw) / (2 * hw); roofPins.push([s, 1], [s, 0]); }
    for (const sx of [-1, 1]) { ropes.push({ a: [sx * hw, h, 0], b: [sx * (hw + 1.8), 0, 0] }); peg(sx * (hw + 1.8), 0); }
    roofPins.push([0, 0.5], [1, 0.5]);
    panels.push({ id: 'roof', ls: 2 * hw, lt: 2 * hd, pins: roofPins, pinLines: [{ s: 0 }, { s: 1 }, { t: 0 }] }); // (the side and back edges roped taut to the curtains; the open front sags between its poles)
    const bx = steps(-hw, hw, RIG.spacing);
    panels.push({ id: 'backwall', ls: 2 * hw, lt: bk, pins: bx.map(x => [(x + hw) / (2 * hw), 0] as [number, number]), pinLines: [{ t: 1 }] }); for (const x of bx) peg(x, hd);
    const sv = steps(0, 1, RIG.spacing / (2 * hd));
    for (const id of ['left', 'right']) { panels.push({ id, ls: 2 * hd, lt: h, pins: sv.map(s => [s, 0] as [number, number]), pinLines: [{ t: 1 }] }); for (const s of sv) peg(id === 'left' ? -hw : hw, hd - 2 * hd * s); }
  } else {
    const wall = RIG.pavWall; poles.push({ a: [0, 0, 0], b: [0, h, 0], r: RIG.mainPoleR * 1.1 });
    const at = steps(-1, 1, RIG.spacing * 1.6 / hw), roofPins: [number, number][] = [[0.5, 0.5]];
    for (const a of at) for (const [x, z] of [[a * hw, -hd], [a * hw, hd], [-hw, a * hd], [hw, a * hd]] as [number, number][]) {
      if (z === -hd && Math.abs(x) < RIG.door.w / 2 + 0.05) continue; // (no pole in the doorway)
      if (poles.some(p => Math.hypot(p.a[0] - x, p.a[2] - z) < 0.01)) continue;
      poles.push({ a: [x, 0, z], b: [x, wall, z], r: RIG.poleR }); const ox = Math.abs(x) >= hw - 1e-6 ? Math.sign(x) : 0, oz = Math.abs(z) >= hd - 1e-6 ? Math.sign(z) : 0, ol = Math.hypot(ox, oz) || 1;
      ropes.push({ a: [x, wall, z], b: [x + (ox / ol) * 1.3, 0, z + (oz / ol) * 1.3] }); peg(x + (ox / ol) * 1.3, z + (oz / ol) * 1.3); }
    panels.push({ id: 'roof', ls: 2 * hw, lt: 2 * hd, pins: roofPins, pinLines: [{ s: 0 }, { s: 1 }, { t: 0 }, { t: 1 }], diag: true }); // the eave on its valance rope, the hips on their ropes, taut
    for (const id of ['front', 'back', 'left', 'right']) { const L = id === 'front' || id === 'back' ? 2 * hw : 2 * hd, ss = steps(0, 1, RIG.spacing / L);
      const cut = id === 'front' ? { s0: 0.5 - RIG.door.w / (2 * L), s1: 0.5 + RIG.door.w / (2 * L), t0: 0, t1: RIG.door.h / wall } : undefined;
      panels.push({ id, ls: L, lt: wall, pins: ss.filter(s => !cut || s < cut.s0 || s > cut.s1).map(s => [s, 0] as [number, number]), pinLines: [{ t: 1 }], ...(cut ? { cut } : {}) });
      for (const s of ss) { if (cut && s > cut.s0 && s < cut.s1) continue; const p = panelAt(kind, id, s, 0); peg(p[0], p[2]); } }
  }
  return { kind, w: K.w, d: K.d, h: K.h, poles, ropes, pegs, panels, note: K.note };
}
