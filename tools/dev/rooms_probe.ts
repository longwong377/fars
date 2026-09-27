// dev: the Terrace's room ranges (D-276) laid out from SITE_SPEC: rooms per building and use, their fittings and sleeping
// places (npx tsx tools/dev/rooms_probe.ts [--rooms])
import { terraceRooms, terraceRanges } from '../../src/arch/terrace_rooms';
const R = terraceRooms();
for (const B of terraceRanges()) console.log(B.b, 'fl', B.fl, 'ranges', B.ranges.length, 'walls', B.ranges.reduce((a, r) => a + r.G.walls.length, 0), 'openings', B.ranges.reduce((a, r) => a + r.G.openings.length, 0));
const by: Record<string, { rooms: number; sleep: number; work: number; mats: number; jars: number; benches: number; hearths: number }> = {};
for (const { room, fit } of R) {
  const k = `${room.building}/${room.use}`; const o = (by[k] ??= { rooms: 0, sleep: 0, work: 0, mats: 0, jars: 0, benches: 0, hearths: 0 });
  o.rooms++; o.sleep += fit.sleep.length; o.work += fit.work.length; o.mats += fit.mats.length; o.jars += fit.jars.length; o.benches += fit.benches.length; o.hearths += fit.hearths.length;
}
console.table(by);
if (process.argv.includes('--rooms')) for (const { room, fit } of R) console.log(room.id, room.use, room.x.map(v => v.toFixed(1)).join('..'), room.y.map(v => v.toFixed(1)).join('..'), 'doors', room.doors.length, 'posts', room.posts.length, 'sleep', fit.sleep.length, 'work', fit.work.length, 'hearth', fit.hearths.map(h => h.map(v => v.toFixed(1)).join(',')).join(' '));
