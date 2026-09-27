// The Terrace's room ranges (D-276), laid out once from SITE_SPEC for everyone who needs them: the generator (terrace.ts
// builds their walls, roofs, posts and fittings), the drawn furnishings and fires (world/furnish.ts, world/firePlaces.ts)
// and the people (people/popgeo.ts: a sleeper's mat, a storekeeper's place before a bench). Pure: no parts are built here.
import { v, present, SPEC } from './spec';
import { planRanges, roomFittings, keepClear, type RoomRange, type RoomDims, type RoomFit, type RangeBuild, type Room, type Fittings } from './rooms';

/** the buildings with room ranges and the floor their ranges stand on (their raised floors: terrace.ts) */
export const ROOM_BUILDINGS = ['treasury', 'harem', 'garrison', 'terrace'] as const; // ('terrace': the royal kitchens on the open ground, court.json court_kitchen)
export type RoomBuilding = typeof ROOM_BUILDINGS[number];
const has = (b: string, k: string) => SPEC[b]?.[k]?.v !== undefined;
export const roomFloor = (b: RoomBuilding) => (has(b, 'floor') ? v(b, 'floor') : 0) + (has(b, 'r_floor_raise') ? v(b, 'r_floor_raise') : 0);

export interface BuildingRanges { b: RoomBuilding; fl: number; D: RoomDims; ranges: { R: RoomRange; G: RangeBuild }[] }
let cache: BuildingRanges[] | null = null;
/** every present building's ranges, each laid out on its own (one range = one wall height) */
export function terraceRanges(): BuildingRanges[] {
  if (cache) return cache;
  cache = ROOM_BUILDINGS.filter(b => present(b) && has(b, 'room_ranges')).map(b => {
    const D = v<RoomDims>(b, 'r_rooms'), fl = roomFloor(b);
    return { b, fl, D, ranges: v<RoomRange[]>(b, 'room_ranges').map(R => ({ R, G: planRanges(b, [R], D, fl) })) };
  });
  return cache;
}
export const roomFit = () => v<RoomFit>('global', 'r_room_fittings');
let fitCache: { room: Room; fit: Fittings }[] | null = null;
/** every room of the ranges with its fittings */
export function terraceRooms(): { room: Room; fit: Fittings }[] {
  if (fitCache) return fitCache;
  const F = roomFit();
  fitCache = terraceRanges().flatMap(B => B.ranges.flatMap(({ G }) => G.rooms.map(room => ({ room, fit: roomFittings(room, F) }))));
  return fitCache;
}
type Rect = { x: [number, number]; y: [number, number] };
let aisleCache: Rect[] | null = null;
/** D-276: the ways kept clear of people standing: the corridors, streets and passages between the ranges (<building>.r_aisles),
 *  every room's doorway leaf sweeps and approaches (rooms.ts keepClear), and the passage rooms */
export function terraceAisles(): Rect[] {
  if (aisleCache) return aisleCache;
  const F = roomFit(), out: Rect[] = [];
  for (const b of ROOM_BUILDINGS) if (present(b) && has(b, 'r_aisles')) out.push(...v<Rect[]>(b, 'r_aisles'));
  for (const { room } of terraceRooms()) { out.push(...keepClear(room, F)); if (room.use === 'passage') out.push({ x: room.x, y: room.y }); }
  aisleCache = out; return out;
}
/** (e, n) lies in a way kept clear (terraceAisles) */
export const inAisle = (e: number, n: number) => terraceAisles().some(r => e > r.x[0] && e < r.x[1] && n > r.y[0] && n < r.y[1]);
