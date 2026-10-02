// s17 C7 (D-610): the rooms of the town's and the villages' houses (settlement/houses.ts SiteHouses: one raster, one
// house generator for both, D-254) furnished by the one planner (plan.ts) for the household that lives there
// (household.ts); ring.ts draws the rooms round the eye (draw.ts). roomPlan is the plan alone (the census,
// tools/dev/interior_census.ts; the tests).
import type { Site } from '../settlement/site';
import type { HouseLife } from '../settlement/houseplan';
import { HOUSE_KINDS } from '../settlement/houseplan';
import { planRoom, type RoomIn, type Door, type Side, type Plan, type Profile, type Use } from './plan';
import { houseProfile, roomUses } from './household';

/** a house room as houses.ts keeps it (RoomEl): its plot, room id, cell rectangle, whether it is whole, its drain side */
export interface RoomRect { plot: number; room: number; i0: number; j0: number; i1: number; j1: number; full: boolean; drain: number; R?: number }
/** what the hook hands over from SiteHouses */
export interface HouseView { s: Site; rooms: readonly RoomRect[]; life: (plot: number) => HouseLife; day: number }
export const seasonOfDay = (day: number): Profile['season'] => { const d = ((day % 360) + 360) % 360; return d >= 45 && d < 100 ? 'harvest' : d >= 100 && d < 170 ? 'warm' : 'cold'; }; // (houses.ts seasonOf)

const USES = new WeakMap<Site, Map<number, Map<number, Use>>>();
/** the uses of a plot's rooms (cached per site) */
export function usesOf(h: HouseView, plot: number): Map<number, Use> {
  let m = USES.get(h.s); if (!m) USES.set(h.s, m = new Map()); let u = m.get(plot); if (u) return u;
  const s = h.s, p = s.plots[plot], street = p.door ? s.room[p.door.cell] : -2;
  const rs = h.rooms.filter(r => r.plot === plot && r.full && r.i1 - r.i0 >= 2 && r.j1 - r.j0 >= 2).map(r => ({ room: r.room, area: (r.i1 - r.i0) * (r.j1 - r.j0), street: r.room === street }));
  u = roomUses(p.id, p.kind, rs); m.set(plot, u); return u;
}
/** a room's doorways (the site's door edges on its rectangle's border, 1 m each) */
export function roomDoors(s: Site, r: RoomRect): Door[] {
  const out: Door[] = [], add = (side: Side, at: number) => { const last = out.find(d => d.side === side && Math.abs(d.at + d.w / 2 - at + 0.5) < 1e-6); if (last) { last.at += 0.5; last.w += 1; } else out.push({ side, at, w: 1 }); };
  for (let i = r.i0; i < r.i1; i++) { if (r.j0 > 0 && s.doors.has(s.eh(i, r.j0 - 1))) add(0, s.cu(i)); if (s.doors.has(s.eh(i, r.j1 - 1))) add(1, s.cu(i)); }
  for (let j = r.j0; j < r.j1; j++) { if (r.i0 > 0 && s.doors.has(s.ev(r.i0 - 1, j))) add(2, s.cv(j)); if (s.doors.has(s.ev(r.i1 - 1, j))) add(3, s.cv(j)); }
  return out;
}
/** the planner's view of a house room, or null (not a house, not whole, too small) */
export function roomIn(h: HouseView, r: RoomRect): RoomIn | null {
  const s = h.s, p = s.plots[r.plot]; if (!HOUSE_KINDS.has(p.kind) || !r.full || r.i1 - r.i0 < 2 || r.j1 - r.j0 < 2) return null;
  const use = usesOf(h, r.plot).get(r.room); if (!use) return null;
  let back = (r.drain >= 0 && r.drain < 4 ? [1, 0, 3, 2][r.drain] : 1) as Side;
  // the vestibule's things face the street door (what the lane sees through it): its back is the wall across from that door
  if (use === 'vestibule' && p.door) { const a = p.door.cell, b = p.door.out, di = (b % s.W) - (a % s.W), dj = ((b / s.W) | 0) - ((a / s.W) | 0); back = (dj < 0 ? 1 : dj > 0 ? 0 : di < 0 ? 3 : 2) as Side; }
  return { id: `${s.id}:${p.id}:${r.room}`, u0: s.u0 + r.i0, u1: s.u0 + r.i1, v0: s.v0 + r.j0, v1: s.v0 + r.j1, doors: roomDoors(s, r), back, use, inset: 0.3, ceil: Math.max(2.0, p.height - 0.45) };
}
/** the household of a house plot (population or plot), in the house's season */
export function plotProfile(h: HouseView, plot: number): Profile {
  const s = h.s, p = s.plots[plot], L = h.life(plot), village = s.meta.popZone === 'plain';
  return houseProfile(p.id, p.kind, p.craft ?? null, L.standing, p.capacity, L.animal, seasonOfDay(h.day), village ? 'village' : 'town');
}
/** which of its household's lived-in rooms a room is: the living room 0, the rooms slept in after it by their order (C) */
export function slotOf(h: HouseView, r: RoomRect): number {
  const u = usesOf(h, r.plot), rank = (q: number) => (u.get(q) === 'living' ? 0 : u.get(q) === 'sleeping' ? 1 : 2);
  const lived = [...u.keys()].filter(q => rank(q) < 2).sort((a, b) => rank(a) - rank(b) || a - b); const i = lived.indexOf(r.room); return i < 0 ? 0 : i;
}
/** a house room's plan (the census and the hook alike) */
export function roomPlan(h: HouseView, r: RoomRect): { room: RoomIn; plan: Plan; prof: Profile } | null {
  const room = roomIn(h, r); if (!room) return null; const prof = { ...plotProfile(h, r.plot), slot: slotOf(h, r) }; return { room, plan: planRoom(room, prof), prof };
}

/** the furnishing on (off: `?interiors=0` in the page, INTERIORS=0 in node: houses.ts draws its own few things, to compare) */
export const interiorsOn = !((typeof process !== 'undefined' && (process as any).env?.INTERIORS === '0') || (typeof location !== 'undefined' && new URLSearchParams(location.search).get('interiors') === '0'));
