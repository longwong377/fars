// s17 C7 (D-610): the inside of the court camps' tents (people/camps.ts; world/courtCamps.ts draws them and the things before
// their doors, D-570) furnished by the same planner while a tent stands: the noble's pavilion as a rich living room (pile
// carpets, cushions, chests, a low table, the lamp), the black tent of the herders' households (fleeces and hides, the
// bedding rolled, the spinning, the milk pot, the children's things), the ridge tent of the soldiers and servants as a room
// slept in (mats, kit, spears). Nothing taller than the cloth over it; no peg on a tent's wall (C: nothing of a court camp at
// Persepolis is known, Q-333; the region's herders' and soldiers' camps by analogy).
import { hashString } from '../../core/rng';
import type { Tent } from '../../people/camps';
import { RIG } from '../tentForms';
import { planRoom, newCtx, clearZones, runRecipe, planOf, onWall, ROOM_BUDGET, type RoomIn, type Profile, type Item } from './plan';
import { addRoomSource, drawPlanned, type NearRoom } from './ring';
import { seasonOfDay } from './town';

const h01 = (s: string) => hashString(s) / 4294967296;
/** a tent's floor as a room: its own frame (u across, v toward the door), the door in the front (+v) */
export function tentRoomIn(t: Tent): RoomIn {
  const door = t.kind === 'ridge' ? RIG.ridgeDoor.w : RIG.door.w;
  return { id: `tent:${t.camp}:${t.i}`, u0: -t.w / 2, u1: t.w / 2, v0: -t.d / 2, v1: t.d / 2, doors: [{ side: 1, at: 0, w: Math.min(door + (t.kind === 'black' ? 1.2 : 0), t.w - 0.6) }], back: 0, use: t.kind === 'ridge' ? 'sleeping' : 'living', inset: 0.15, ceil: t.h };
}
/** who lives in a tent (C) */
export function tentProfile(t: Tent, season: Profile['season']): Profile {
  const h = (k: string) => h01(`${t.camp}:${t.i}:${k}`);
  if (t.kind === 'pavilion') return { standing: 0.88 + 0.12 * h('s'), members: 3 + Math.floor(h('m') * 4), children: h('c') < 0.3 ? 1 : 0, infants: 0, women: h('w') < 0.4 ? 1 : 0, elders: 0, craft: null, jobs: ['official', 'servant'], animal: null, persian: true, season, from: 'plot', place: 'terrace' };
  if (t.kind === 'black') return { standing: 0.25 + 0.25 * h('s'), members: 4 + Math.floor(h('m') * 5), children: 1 + Math.floor(h('c') * 3), infants: h('i') < 0.35 ? 1 : 0, women: 2, elders: h('e') < 0.4 ? 1 : 0, craft: null, jobs: ['herder', 'homemaker'], animal: 'sheep', persian: true, season, from: 'plot', place: 'village' };
  return { standing: 0.35 + 0.2 * h('s'), members: 4 + Math.floor(h('m') * 5), children: 0, infants: 0, women: 0, elders: 0, craft: null, jobs: [h('j') < 0.6 ? 'guard' : 'servant'], animal: null, persian: true, season, from: 'plot', place: 'terrace' };
}
/** the height of the cloth over a point of the tent's floor (m; the ridge tent's sides fall to its low walls) */
function headroom(t: Tent, u: number, v: number): number {
  if (t.kind === 'pavilion') return RIG.pavWall + (t.h - RIG.pavWall) * Math.max(0, 1 - Math.max(Math.abs(u) / (t.w / 2), Math.abs(v) / (t.d / 2)));
  if (t.kind === 'black') return RIG.blackBack + (RIG.blackFront - RIG.blackBack) * (v / t.d + 0.5);
  return RIG.wall + (t.h - RIG.wall) * Math.max(0, 1 - Math.abs(u) / (t.w / 2));
}
/** a tent's plan: the planner's, less what would stand through the cloth or hang on a wall a tent has not */
export function planTent(t: Tent, season: Profile['season'] = 'warm') {
  const room = tentRoomIn(t), prof = tentProfile(t, season), c = newCtx(room, prof, ROOM_BUDGET[room.use]);
  if (!c) return { room, plan: planRoom(room, prof), prof };
  clearZones(c);
  // what a tent keeps before the household's things: the soldiers' and servants' kit bags, a water skin's jar, the bowls; the
  // herders' saddle-bags and the churn; a noble's chests of travelling plate (C)
  const h = (k: string) => h01(`${t.camp}:${t.i}:${k}`), low = (k: Parameters<typeof onWall>[1], w: number, d: number, hh: number, note: string, extra = {}) => onWall(c, k, w, d, hh, h(note), { note, ...extra });
  if (t.kind === 'ridge') { for (let i = 0; i < Math.ceil(prof.members / 2); i++) low('sack_lying', 0.55, 0.36, 0.26, `a kit bag (${i})`); if (h('jar') < 0.7) low('jar_neck', 0.28, 0.28, 0.42, 'a water jar'); if (h('bw') < 0.6) low('bowls', 0.22, 0.22, 0.12, 'the mess bowls'); if (h('sh') < 0.4) low('basket', 0.4, 0.34, 0.15, 'a basket of bread (the ration)'); }
  else if (t.kind === 'black') { low('bale', 0.7, 0.5, 0.45, 'saddle-bags and the household\'s goods in woven bags along the back (C)'); if (h('ch') < 0.8) low('milkpot', 0.28, 0.28, 0.29, 'the churn pot'); if (h('sk') < 0.5) low('sack', 0.42, 0.42, 0.6, 'a sack of barley'); }
  else { low('chest', 1.0, 0.55, 0.55, 'a travelling chest of the household\'s plate and clothes (C)'); if (h('j') < 0.7) low('jar_neck', 0.3, 0.3, 0.44, 'a jar of wine'); if (h('b') < 0.6) low('bale', 0.7, 0.55, 0.5, 'a bale of bedding for the road'); }
  runRecipe(c); const plan = planOf(c);
  plan.items = plan.items.filter((it: Item) => { if (it.k === 'lamp' || it.k === 'herbs' || it.k === 'onions') return t.kind === 'pavilion'; if (it.k === 'peg_cloth') return false;
    const top = it.y + (it.k === 'tool_lean' ? it.h * 0.98 : it.h); return top < headroom(t, it.u, it.v) * 0.92; });
  return { room, plan, prof };
}

/** the tents join the ring round the eye (courtCamps.ts CourtCampTents: the hook) while they stand */
export function registerTentInteriors(tents: Tent[], ground: (e: number, n: number) => number, standing: (ti: number) => boolean) {
  addRoomSource({ near(e: number, n: number, r: number, day: number): NearRoom[] {
    const out: NearRoom[] = [];
    tents.forEach((t, ti) => { const d = Math.hypot(t.e - e, t.n - n) - Math.hypot(t.w, t.d) / 2; if (d > r || !standing(ti)) return;
      const a = (t.heading * Math.PI) / 180, fe = Math.sin(a), fn = Math.cos(a), grid = (u: number, v: number): [number, number] => [t.e + u * fn + v * fe, t.n - u * fe + v * fn];
      out.push({ key: `tent:${t.camp}:${t.i}`, d: Math.max(0, d), build: () => { const x = planTent(t, seasonOfDay(day));
        return drawPlanned(x.plan.items, `${t.kind} tent ${t.i} of the ${t.camp} camp`, { grid, theta: -a, floor: (u, v) => { const [ge, gn] = grid(u, v); return ground(ge, gn) + 0.01; }, prof: x.prof }); } }); });
    return out; } });
}
