// s17 C7 (D-610): the rooms of the Terrace's ranges (arch/rooms.ts, terrace_rooms.ts: the Treasury's stores and halls,
// the harem's apartments, stores and kitchens, the garrison's quarters, store, kitchen and mess, the royal kitchens)
// furnished by the same planner (plan.ts) after the fittings rooms.ts lays (mats, benches, jars, querns, lamps, hearths:
// drawn by furnish.ts buildRoomFittings, kept here as taken). What each room holds comes from who uses it: a guard's kit
// at the head of each sleeping mat, the spears and shields of the squad along the walls; the lady's household in an
// apartment (carpets, cushions, chests, the spinning, a child's cradle); the kitchens' pots and troughs; the stores' goods
// on their benches, one class of goods to a room as the Treasury tablets file them (textiles, vessels, arms; the Treasury
// finds' types: B, Schmidt's Persepolis II; their number and place C).
import { hashString } from '../../core/rng';
import { terraceRooms, roomFit } from '../../arch/terrace_rooms';
import type { Room, Fittings } from '../../arch/rooms';
import { addRoomSource, drawPlanned, type NearRoom } from './ring';
import { seasonOfDay } from './town';
import { newCtx, clearZones, runRecipe, planOf, emptyPlan, putAt, onWall, inCorner, hang, type RoomIn, type Profile, type Plan, type Side, type Use, type Kind } from './plan';

const h01 = (s: string) => hashString(s) / 4294967296;
/** the planner's use for a Terrace room's use */
const USE: Record<string, Use> = { quarters: 'sleeping', apartment: 'living', service: 'kitchen', store: 'store', hall: 'store', mess: 'kitchen', passage: 'vestibule' };
/** the triangles a Terrace room may spend (a dormitory of ninety mats holds ninety kits) */
const BUDGET: Record<string, number> = { quarters: 16000, apartment: 3200, service: 2600, store: 5000, hall: 9000, mess: 3000, passage: 0 };

/** a Terrace room as the planner sees it (grid e, n as u, v: the frame is the grid) */
export function terraceRoomIn(room: Room): RoomIn {
  const doors = room.doors.map(d => { const side: Side = Math.abs(d.n[1]) > Math.abs(d.n[0]) ? (d.n[1] > 0 ? 0 : 1) : (d.n[0] > 0 ? 2 : 3); return { side, at: side < 2 ? d.c[0] : d.c[1], w: d.width }; });
  const back = (doors.length ? ([1, 0, 3, 2] as Side[])[doors[0].side] : 1) as Side;
  return { id: `terrace:${room.id}`, u0: room.x[0], u1: room.x[1], v0: room.y[0], v1: room.y[1], doors, back, use: USE[room.use] ?? 'store', inset: 0.06, ceil: room.clear };
}
/** who uses a Terrace room (C: the garrison's squads of ten; the harem's households of a lady, her children and women) */
export function terraceProfile(room: Room, fit: Fittings): Profile {
  const h = (k: string) => h01(`${room.id}:${k}`);
  if (room.use === 'apartment') return { standing: 0.85 + 0.15 * h('st'), members: Math.max(3, fit.sleep.length), children: 1 + Math.floor(h('c') * 3), infants: h('i') < 0.4 ? 1 : 0, women: 3, elders: h('e') < 0.3 ? 1 : 0, craft: null, jobs: ['homemaker', 'servant'], animal: null, persian: true, season: 'warm', from: 'plot', place: 'terrace' };
  if (room.use === 'quarters' || room.building === 'garrison') return { standing: 0.45, members: Math.max(1, fit.sleep.length), children: 0, infants: 0, women: 0, elders: 0, craft: null, jobs: ['guard'], animal: null, persian: true, season: 'warm', from: 'plot', place: 'terrace' };
  return { standing: 0.7, members: 4, children: 0, infants: 0, women: room.use === 'service' ? 3 : 0, elders: 0, craft: null, jobs: room.building === 'treasury' ? ['treasury'] : ['servant'], animal: null, persian: false, season: 'warm', from: 'plot', place: 'terrace' };
}
/** the goods a store keeps (one class to a room, C; the classes from the Treasury's finds, B) */
type Goods = 'textiles' | 'vessels' | 'arms' | 'provisions';
const goodsOf = (room: Room): Goods => room.building === 'garrison' ? (h01(room.id + ':g') < 0.6 ? 'arms' : 'provisions') : room.building === 'treasury' ? (['textiles', 'vessels', 'arms', 'textiles', 'vessels'] as Goods[])[Math.floor(h01(room.id + ':g') * 5)] : 'provisions';

/** plan a Terrace room after its fittings */
export function planTerraceRoom(room: Room, fit: Fittings, season: Profile['season'] = 'warm'): { room: RoomIn; plan: Plan; prof: Profile } {
  const r = terraceRoomIn(room), p = { ...terraceProfile(room, fit), season }, F = roomFit();
  // the fittings already there: the mats (flat; a guard's kit lies at the head of his), the benches, jars, querns, hearths
  const pre: number[][] = [];
  for (const m of fit.mats) pre.push([m.c[0] - m.size[0] / 2, m.c[1] - m.size[1] / 2, m.c[0] + m.size[0] / 2, m.c[1] + m.size[1] / 2, room.use === 'apartment' ? 1 : 0]);
  for (const b of fit.benches) pre.push([b.c[0] - b.size[0] / 2, b.c[1] - b.size[1] / 2, b.c[0] + b.size[0] / 2, b.c[1] + b.size[1] / 2, 0]);
  for (const j of fit.jars) pre.push([j[0] - F.jar_r, j[1] - F.jar_r, j[0] + F.jar_r, j[1] + F.jar_r, 0]);
  for (const q of fit.querns) pre.push([q[0] - F.quern[0] / 2, q[1] - F.quern[1] / 2, q[0] + F.quern[0] / 2, q[1] + F.quern[1] / 2, 0]);
  for (const q of fit.hearths) pre.push([q[0] - F.hearth_clear, q[1] - F.hearth_clear, q[0] + F.hearth_clear, q[1] + F.hearth_clear, 0]);
  for (const q of room.posts) pre.push([q[0] - 0.35, q[1] - 0.35, q[0] + 0.35, q[1] + 0.35, 0]);
  const c = newCtx(r, p, BUDGET[room.use] ?? 3000, pre); if (!c || room.use === 'passage') return { room: r, plan: emptyPlan(r), prof: p };
  clearZones(c);
  const h = (k: string) => h01(`${room.id}:${k}`), fl = room.fl;
  switch (room.use) {
    case 'quarters': {
      // each man's kit at the head of his mat, beside his rolled bedding: a bag, a folded cloak, a cup (C)
      fit.mats.forEach((m, i) => { const hd = fit.sleep[i][2], hx = Math.sin(hd), hy = Math.cos(hd), L = Math.max(m.size[0], m.size[1]), W2 = Math.min(m.size[0], m.size[1]), sx = hy, sy = -hx; // (head direction; across the mat)
        const at = (a: number, b: number): [number, number] => [m.c[0] + hx * (L / 2 - a) + sx * b, m.c[1] + hy * (L / 2 - a) + sy * b];
        const x = h('kit' + i), rot = Math.atan2(sy, sx), [u1, v1] = at(0.45, W2 * 0.2), [u2, v2] = at(0.5, -W2 * 0.22);
        if (x < 0.55) putAt(c, 'sack_lying', u1, v1, rot, 0.5, 0.34, 0.24, F.mat_t, { note: 'a guard\'s bag of kit at the head of his mat (C)' }, false);
        else if (x < 0.85) putAt(c, 'rugs', u1, v1, rot, 0.46, 0.36, 0.08, F.mat_t, { n: 2, note: 'his cloak and tunic folded at the head of his mat (C)' }, false);
        if (h('cup' + i) < 0.35) putAt(c, 'bowls', u2, v2, 0, 0.16, 0.16, 0.07, F.mat_t, { note: 'his cup (C)' }, false);
      });
      // the squad's arms along the walls: spears leant in the corners and on the walls, the wicker shields, the bows (C:
      // spearmen and archers of the reliefs, B; how a guard kept them in his quarters C)
      for (let i = 0; i < 4 + Math.floor(h('sp') * 4); i++) inCorner(c, 'tool_lean', 0.22, 0.2, 2.3, { sub: 'spear', note: 'spears leant in the corner, the squad\'s (C)' }) || onWall(c, 'tool_lean', 0.2, 0.2, 2.3, h('spw' + i), { sub: 'spear', note: 'a spear leant on the wall (C)' });
      for (let i = 0; i < 2 + Math.floor(h('sh') * 4); i++) onWall(c, 'shield', 0.7, 0.18, 0.68, h('shw' + i), { note: 'a shield leant on the wall (C; the reliefs\' guards, B)' });
      for (let i = 0; i < 1 + Math.floor(h('bw') * 3); i++) onWall(c, 'tool_lean', 0.2, 0.2, 1.05, h('bww' + i), { sub: 'bow', note: 'a bow in its case on the wall (C)' });
      for (let i = 0; i < 3; i++) hang(c, 'peg_cloth', 1.55, 0.5, 0.9, { note: 'cloaks hung on pegs (C)' });
      for (const q of fit.hearths) { putAt(c, 'cookpot', q[0] + F.hearth_r * 0.2, q[1] + F.hearth_r * 0.1, 0, 0.34, 0.32, 0.25, 0, { note: 'the squad\'s cooking pot on the hearth (C)' }, false); putAt(c, 'bowls', q[0] + F.hearth_clear * 0.85, q[1] - F.hearth_clear * 0.4, 0, 0.2, 0.2, 0.12, 0, { note: 'bowls by the hearth (C)' }); putAt(c, 'basket', q[0] - F.hearth_clear * 0.8, q[1] + F.hearth_clear * 0.5, 0, 0.4, 0.34, 0.14, 0, { note: 'a basket of bread (the rations, PF: B; C)' }); }
      break; }
    case 'store': case 'hall': {
      // the goods on the benches: a row along each bench's top, one class of goods to a room (C)
      const g = goodsOf(room);
      fit.benches.forEach((b, bi) => { const along = b.size[0] >= b.size[1], L = Math.max(b.size[0], b.size[1]), D = Math.min(b.size[0], b.size[1]), y = b.top - fl; let a = -L / 2 + 0.1;
        for (let k = 0; a < L / 2 - 0.2 && k < 40; k++) { const x = h(`b${bi}:${k}`);
          const [kind, w, d, hh]: [Kind, number, number, number] = g === 'textiles' ? (x < 0.55 ? ['bale', 0.62, Math.min(D - 0.1, 0.55), 0.45] : x < 0.85 ? ['bolts', 0.95, Math.min(D - 0.1, 0.6), 0.3] : ['chest', 0.9, Math.min(D - 0.1, 0.5), 0.5])
            : g === 'vessels' ? (x < 0.4 ? ['jar_neck', 0.3, 0.3, 0.44] : x < 0.6 ? ['vessels', 0.5, Math.min(D - 0.1, 0.4), 0.26] : x < 0.8 ? ['bowls', 0.24, 0.24, 0.14] : ['basket', 0.42, 0.36, 0.16])
            : g === 'arms' ? (x < 0.4 ? ['shield', 0.7, 0.2, 0.68] : x < 0.75 ? ['arrows', 0.8, 0.3, 0.16] : ['chest', 0.95, Math.min(D - 0.1, 0.5), 0.5])
            : (x < 0.4 ? ['jar_neck', 0.3, 0.3, 0.44] : x < 0.7 ? ['sack', 0.42, 0.42, 0.6] : x < 0.85 ? ['sack_lying', 0.62, 0.42, 0.3] : ['basket', 0.42, 0.36, 0.16]);
          if (a + w > L / 2 - 0.05) break; const m = a + w / 2, [u, v] = along ? [b.c[0] + m, b.c[1]] : [b.c[0], b.c[1] + m];
          if (!putAt(c, kind, u, v, along ? 0 : Math.PI / 2, w, d, hh, y, { note: `${g === 'textiles' ? 'cloth in bales and folded bolts' : g === 'vessels' ? 'stone and metal vessels, jars of oil and wine' : g === 'arms' ? 'shields, bundles of arrows, chests of arms' : 'provisions: jars, sacks, baskets'} on the store\'s bench (the Treasury\'s goods: B; the store's class and the row C)` }, false)) break;
          a += w + 0.06 + 0.1 * h(`g${bi}:${k}`); } });
      // the floor before the benches: a storekeeper's things (a basket of tablets, a balance), sacks by the door (C)
      if (room.building === 'treasury') { onWall(c, 'tablets', 0.42, 0.3, 0.12, 0.2, { note: 'a basket of sealed tablets: the store\'s records (the Treasury tablets, A for their kind; here C)' }); if (room.use === 'hall' || h('wt') < 0.4) onWall(c, 'weigh_table', 0.62, 0.42, 0.77, 0.5, { note: 'a balance on its table for weighing out (C)' }); }
      for (let i = 0; i < 2 + Math.floor(h('fs') * 3); i++) onWall(c, h('fk' + i) < 0.5 ? 'sack' : 'jar_store', 0.5, 0.5, h('fk' + i) < 0.5 ? 0.6 : 0.85, h('fp' + i));
      break; }
    case 'mess': {
      for (const b of fit.benches) { const along = b.size[0] >= b.size[1], L = Math.max(b.size[0], b.size[1]); for (let a = -L / 2 + 0.4, k = 0; a < L / 2 - 0.3; a += 0.9 + 0.5 * h('m' + k), k++) { const [u, v] = along ? [b.c[0] + a, b.c[1]] : [b.c[0], b.c[1] + a]; putAt(c, h('mk' + k) < 0.6 ? 'bowls' : 'jug', u, v, 0, 0.2, 0.2, 0.12, b.top - fl, { note: 'bowls and jugs on the bench (C)' }, false); } }
      for (const q of fit.hearths) { putAt(c, 'cookpot', q[0], q[1] + 0.1, 0, 0.36, 0.34, 0.25, 0, { note: 'a cooking pot on the fire (C)' }, false); putAt(c, 'basket', q[0] + 1.2, q[1], 0, 0.42, 0.36, 0.16, 0, { note: 'the bread of the ration (C)' }); }
      runRecipe(c); break; }
    default: runRecipe(c);
  }
  return { room: r, plan: planOf(c), prof: p };
}
/** every Terrace room planned (the census; the ring builds them as the eye comes near) */
export function terracePlans(season: Profile['season'] = 'warm') { return terraceRooms().map(({ room, fit }) => ({ src: room, ...planTerraceRoom(room, fit, season) })); }

let registered = false;
/** the Terrace's rooms join the ring round the eye (furnish.ts buildRoomFittings calls this when the ranges are built) */
export function registerTerraceInteriors() {
  if (registered) return; registered = true;
  addRoomSource({ near(e: number, n: number, r: number, day: number): NearRoom[] {
    const out: NearRoom[] = [];
    for (const { room, fit } of terraceRooms()) { if (room.use === 'passage') continue; const d = Math.hypot(Math.max(room.x[0] - e, 0, e - room.x[1]), Math.max(room.y[0] - n, 0, n - room.y[1])); if (d > r) continue;
      out.push({ key: `terrace:${room.id}`, d, build: () => { const x = planTerraceRoom(room, fit, seasonOfDay(day));
        return drawPlanned(x.plan.items, `${room.building} ${room.id} (${room.use})`, { grid: (u, v) => [u, v], theta: 0, floor: () => room.fl, prof: x.prof }); } }); }
    return out; } });
}
