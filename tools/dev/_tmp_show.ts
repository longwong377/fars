import { buildTownPlan } from '../../src/world/settlement/plan';
import { ROOM, COURT } from '../../src/world/settlement/site';
import { TownWalk, cellSpot, edgeRoom } from '../../src/world/settlement/walk';
import { reachable } from './reach_census';
const plan = buildTownPlan(), walk = TownWalk.fromPlan(plan);
const s = plan.sites.find(x => x.id === process.argv[2])!, p = s.plots.find(x => x.id === process.argv[3])!, r = reachable(s);
const [i0, j0, i1, j1] = p.rect, M = +(process.argv[4] ?? 2);
for (let j = j1 + M - 1; j >= j0 - M; j--) { let row = ''; for (let i = i0 - M; i <= i1 + M - 1; i++) { const k = s.k(i, j), cc = s.cell[k];
  const ch = cc < 0 ? '.' : cc !== p.idx ? '#' : s.sub[k] === ROOM ? String.fromCharCode(65 + (s.room[k] % 26)) : s.sub[k] === COURT ? 'c' : 'y';
  let door = ' '; if (s.doors.has(s.edgeBetween(k, k + 1))) door = '|';
  const hd = s.doors.has(s.edgeBetween(k, k + s.W)) ? '^' : ' '; row += (r[k] ? ' ' : '~') + ch + door + hd; } console.log(row); }
for (const f of s.fittings) if (f.plot === p.idx) console.log('fitting', f.kind, s.ci(f.u) - i0 + M, s.cj(f.v) - j0 + M);
for (const e of s.doors) { const N = s.W * s.H, [a, b] = e < N ? [e, e + s.W] : [e - N, e - N + 1]; if (s.cell[a] === p.idx || s.cell[b] === p.idx) console.log('door', a % s.W - i0 + M, ((a / s.W) | 0) - j0 + M, '->', b % s.W - i0 + M, ((b / s.W) | 0) - j0 + M, 'clear', s.doorClear(e).toFixed(2), 'room', edgeRoom(s, a, e < N ? 1 : 0).toFixed(2), s.cell[a], s.cell[b]); }
for (const f of s.fixtures ?? []) if (f.plot === p.idx) console.log('fixture', f.kind, (f.u - s.u0 - i0 + M).toFixed(2), (f.v - s.v0 - j0 + M).toFixed(2), f.len.toFixed(2), f.rot.toFixed(2));
console.log('street', p.door && [p.door.cell % s.W - i0 + M, ((p.door.cell / s.W) | 0) - j0 + M]);
void walk; void cellSpot;
