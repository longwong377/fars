import { buildTownPlan } from '../../src/world/settlement/plan';
import { siteFootprints, wallBox, boxDist } from '../../src/world/settlement/footprints';
import { toLocal, ROOM } from '../../src/world/settlement/site';
import { TownWalk, siteReach, cellRoom } from '../../src/world/settlement/walk';
const plan = buildTownPlan(), walk = TownWalk.fromPlan(plan), e = +process.argv[2], n = +process.argv[3];
const l = walk.locate(e, n)!; const s = walk.boxes[l.si].s, r = siteReach(s);
console.log(s.id, s.meta.kind, 'local', l.u.toFixed(2), l.v.toFixed(2), 'cell', s.cell[l.k], 'sub', s.sub[l.k], 'reach', r[l.k], 'room', cellRoom(s, l.k).toFixed(2));
const ci = l.k % s.W, cj = (l.k / s.W) | 0;
for (let dj = 5; dj >= -5; dj--) { let row = ''; for (let di = -6; di <= 6; di++) { const k = s.k(ci + di, cj + dj), c = s.cell[k];
  row += (c < 0 ? '.' : s.sub[k] === ROOM ? 'R' : s.sub[k] === 2 ? 'c' : 'y') + (r[k] ? ' ' : '~') + (s.doors.has(s.edgeBetween(k, k + 1)) ? '|' : ' ') + (di === 0 && dj === 0 ? '*' : ' '); } console.log(row); }
for (const w of s.walls()) { if (w.door) continue; const b = wallBox(w); const d = boxDist(l.u, l.v, b, 1, 0); if (d < 1.5) console.log('wall', d.toFixed(2), w.kind, JSON.stringify(b)); }
for (const f of siteFootprints(s)) { const d = boxDist(l.u, l.v, f, Math.cos(f.rot), Math.sin(f.rot)); if (d < 2) console.log('foot', f.kind, d.toFixed(2), f.u.toFixed(2), f.v.toFixed(2)); }
for (const f of s.fittings) if (Math.hypot(f.u - l.u, f.v - l.v) < 3) console.log('fitting', f.kind, f.u.toFixed(2), f.v.toFixed(2), f.size);
for (const p of plan.props) if (Math.hypot(p.c[0] - e, p.c[1] - n) < 6) console.log('prop', p.group, p.collide, p.c, p.hu, p.hv, p.y0, p.y1);
