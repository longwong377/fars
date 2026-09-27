// dev (D-276): is every room of the room ranges reached by the walkable grid (public/generated/nav.i16, a flood fill from the
// seeds: walkable = reachable)? Per room: the share of its floor cells walkable, its sleeping and working places walkable,
// the mess and the quarters' hearth places. npx tsx tools/dev/rooms_reach.ts
import { readFileSync } from 'node:fs';
import { NavGrid } from '../../src/people/navgrid';
import { terraceRooms } from '../../src/arch/terrace_rooms';

const nav = new NavGrid(new Int16Array(readFileSync('public/generated/nav.i16').buffer.slice(0)), new Uint8Array(readFileSync('public/generated/nav_edges.u8')));
let bad = 0, sleepOff = 0, workOff = 0, sleepN = 0, workN = 0;
for (const { room, fit } of terraceRooms()) {
  let n = 0, w = 0;
  for (const r of [room, ...(room.back ? [room.back] : [])]) for (let x = r.x[0] + 0.25; x < r.x[1]; x += 0.5) for (let y = r.y[0] + 0.25; y < r.y[1]; y += 0.5) { n++; if (nav.walkable(x, y)) w++; }
  const so = fit.sleep.filter(([e, nn]) => !nav.walkable(e, nn)).length, wo = fit.work.filter(([e, nn]) => !nav.walkable(e, nn)).length;
  sleepOff += so; workOff += wo; sleepN += fit.sleep.length; workN += fit.work.length;
  const share = w / Math.max(1, n); if (share < 0.3 && room.use !== 'passage') bad++;
  if (share < 0.3 || process.argv.includes('--all')) console.log(room.id.padEnd(16), room.use.padEnd(10), `walkable ${(100 * share).toFixed(0)}%`, `sleep off ${so}/${fit.sleep.length}`, `work off ${wo}/${fit.work.length}`);
}
console.log(`rooms under 30 % walkable: ${bad}; sleeping places not walkable ${sleepOff}/${sleepN}; working places not walkable ${workOff}/${workN}`);
