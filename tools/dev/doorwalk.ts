// dev (s17 C9, D-630): the door walker. Every door the world marks enterable is walked through, both ways, by the
// player's own controller at the player's own gait (walking pace, inertia on: Player.botSpeed null), steering as a
// player does (at the next point of the route, a little ahead). Enterable: a Terrace doorway with the walkable grid on
// both sides and a route between them; a street door of a town plot (the town's walk graph joins its outside and
// inside cells). The leaves are opened first; the doors that refuse (sealed and barred stores) are listed, not walked
// (the doors' own test covers shut ones). People off by default (the
// geometry: lintels, jambs, thresholds, sills, steps); --people walks among the court and the town at day 25 10:00.
// Reports per kind: doors, entered both ways, the failures with where the body stopped and what it touched.
// Usage: npx tsx tools/dev/doorwalk.ts [--town N=400] [--people] [--json out.json]
import { writeFileSync } from 'node:fs';
import { buildOfflineWorld } from './lib/offline_world';
import { TownWalk } from '../../src/world/settlement/walk';
import { buildTerrace } from '../../src/arch/terrace';
import type { Player } from '../../src/player/player';

type P2 = [number, number];
const argv = process.argv.slice(2), flag = (k: string, d: number) => { const i = argv.indexOf(k); return i >= 0 ? +argv[i + 1] : d; };
const PEOPLE = argv.includes('--people'), TOWN_N = flag('--town', 400);
const W = await buildOfflineWorld({ seed: 1, day: 25, hour: 10, court: true, people: PEOPLE });
const { T, P, nav, doors } = W;
const shut = new Map<string, string>(); // the doors that refuse to open (sealed or barred stores, the Treasury's E door): not enterable
for (const id of doors.doors.keys()) { const r = doors.toggle(id, true); if (r && r.result !== 'opening') shut.set(id, r.result); }
const hour = 10;
for (let i = 0; i < 120; i++) { doors.update(1 / 30, hour); P.step(1 / 30); }
const DT = 1 / 30;
const kill = (pl: Player) => { P.world.removeCollider(pl.collider, false); P.world.removeRigidBody(pl.body); P.world.removeCharacterController(pl.controller); };
/** what the body touches ahead (the controller's contacts last step) */
const touching = (pl: Player) => { const o: string[] = []; for (let i = 0; i < pl.controller.numComputedCollisions(); i++) { const c = pl.controller.computedCollision(i); if (!c?.collider) continue;
  const n = c.normal1, sh: any = c.collider.shape, tr = c.collider.translation(), living = c.collider.parent() && W.livingBodies.has(c.collider.parent()!.handle);
  o.push(`${living ? 'person/animal' : sh.halfExtents ? 'box' : c.collider.shapeType() === P.R.ShapeType.HeightField ? 'terrain' : 'mesh'} n(${n.x.toFixed(2)},${n.y.toFixed(2)},${(-n.z).toFixed(2)}) at (${tr.x.toFixed(1)}, ${(-tr.z).toFixed(1)}, y ${tr.y.toFixed(2)})`); }
  return [...new Set(o)].join('; ') || 'nothing'; };
/** walk the player along pts (grid e, n) from a standing start at pts[0]; true when it reaches the last within 0.4 m */
function walk(pts: P2[], floor0: number): { ok: boolean; at: P2; why: string; t: number } {
  const pl = W.spawn(pts[0][0], -pts[0][1], floor0); for (let i = 0; i < 6; i++) W.step(pl, DT, { forward: 0, yaw: 0 });
  let i = 1, t = 0, best = Infinity, lp = 0;
  while (t < 40) {
    const p = pl.position, [e, n] = pts[i], de = e - p.x, dn = n + p.z, d = Math.hypot(de, dn);
    if (d < (i === pts.length - 1 ? 0.4 : 0.5)) { if (i === pts.length - 1) { kill(pl); return { ok: true, at: [p.x, -p.z], why: '', t }; } i++; best = Infinity; lp = t; continue; }
    if (d < best - 0.05) { best = d; lp = t; } if (t - lp > 4) break;
    W.step(pl, DT, { forward: 1, yaw: Math.atan2(-de, dn) }); t += DT;
  }
  const p = pl.position, why = touching(pl); kill(pl); return { ok: false, at: [p.x, -p.z], why, t };
}
// the floor a walk starts on: cast from 1.2 m over the hint (the town: 0.3 m over the terrain; from higher up the cast
// landed on tall fittings and walls, s17)
const floorAt = (e: number, n: number, hint: number) => P.castRayDown(e, -n, hint + 1.2) ?? hint;
/** room for the standing capsule at (e, n) on the floor there */
const standable = (p: P2) => { const f = floorAt(p[0], p[1], T.surfaceAt(p[0], -p[1]) + 0.3); return !P.world.intersectionWithShape({ x: p[0], y: f + 0.87 + 0.04, z: -p[1] }, { x: 0, y: 0, z: 0, w: 1 }, new P.R.Capsule(0.6, 0.25)); };
interface Res { doors: number; entered: number; failures: string[]; shut: string[] }
const res: Record<string, Res> = { terrace: { doors: 0, entered: 0, failures: [], shut: [] }, town: { doors: 0, entered: 0, failures: [], shut: [] } };
const t0 = Date.now();
// ---- the Terrace's doorways
const { doorways } = buildTerrace();
for (const dw of doorways) {
  const k = dw.depth / 2 + 1.4, a: P2 = [dw.c[0] - dw.n[0] * k, dw.c[1] - dw.n[1] * k], b: P2 = [dw.c[0] + dw.n[0] * k, dw.c[1] + dw.n[1] * k];
  if (!nav.walkable(...a) || !nav.walkable(...b)) continue;
  if (shut.has(dw.id)) { res.terrace.shut.push(`${dw.id} (${shut.get(dw.id)})`); continue; }
  const path = nav.findPath(a, b); if (!path || path.length > 40) continue; // joined only the long way round: not this door
  res.terrace.doors++;
  P.updateTerrain(T, { x: dw.c[0], y: 0, z: -dw.c[1] }); P.step(1e-4);
  let both = true;
  for (const [from, to] of [[a, b], [b, a]] as const) {
    const r = walk([from, dw.c, to], floorAt(from[0], from[1], nav.heightAt(...from)));
    if (!r.ok) { both = false; res.terrace.failures.push(`${dw.id} (${dw.width.toFixed(2)} x ${dw.height.toFixed(2)} m) ${from === a ? 'in' : 'out'}: stopped at (${r.at[0].toFixed(1)}, ${r.at[1].toFixed(1)}) touching ${r.why}`); }
  }
  if (both) res.terrace.entered++;
}
console.log(`terrace: ${res.terrace.entered} / ${res.terrace.doors} doorways walked both ways (${((Date.now() - t0) / 1000).toFixed(0)} s); shut, not walked: ${res.terrace.shut.join(', ') || 'none'}`); for (const f of res.terrace.failures) console.log('   ', f);
// ---- the town's street doors (the plots of the quarters and compounds within 3.5 km, N spread evenly)
const plan = W.settlement!.plan, tw = TownWalk.fromPlan(plan);
const all: { s: (typeof plan.sites)[number]; p: any }[] = [];
for (const s of plan.sites) if (Math.hypot(s.frame.c[0], s.frame.c[1]) < 3500) for (const p of s.plots) if (p.door && p.kind !== 'garden') all.push({ s, p });
const stride = Math.max(1, all.length / TOWN_N), t1 = Date.now();
for (let q = 0; q < all.length && res.town.doors < TOWN_N; q += stride) {
  const { s, p } = all[Math.floor(q)], d = s.doorPoints(p)!; if (!d) continue;
  const out = s.grid(...d.out), mid = s.grid(...d.mid), inside = s.grid(...d.inside);
  // a metre and a half out from the door's own cells, along the door's line (so the walk starts and ends clear of the jambs)
  const ux = inside[0] - out[0], uy = inside[1] - out[1], L = Math.hypot(ux, uy) || 1, a: P2 = [mid[0] - ux / L * 1.5, mid[1] - uy / L * 1.5], b: P2 = [mid[0] + ux / L * 1.5, mid[1] + uy / L * 1.5];
  if (!tw.locate(...a) || !tw.locate(...b) || !tw.route(a, b)) continue;
  res.town.doors++;
  P.updateTerrain(T, { x: mid[0], y: 0, z: -mid[1] }); W.settlement!.streamColliders(mid[0], -mid[1], Infinity); P.step(1e-4);
  let both = true;
  for (const [from, to] of [[a, b], [b, a]] as const) {
    const g = T.surfaceAt(from[0], -from[1]), r = walk([from, mid, to], floorAt(from[0], from[1], g + 0.3));
    if (!r.ok) { both = false; res.town.failures.push(`${s.meta.id} plot ${p.idx} door at (${mid[0].toFixed(1)}, ${mid[1].toFixed(1)}) ${from === a ? 'in' : 'out'}: stopped at (${r.at[0].toFixed(1)}, ${r.at[1].toFixed(1)}) touching ${r.why}`); }
  }
  if (both) res.town.entered++;
}
// ---- the doors inside the plots (room to court, room to room: the walls the plan cuts a door in), N spread evenly
res.rooms = { doors: 0, entered: 0, failures: [], shut: [] };
const inner: { s: (typeof plan.sites)[number]; w: any }[] = [];
for (const s of plan.sites) if (Math.hypot(s.frame.c[0], s.frame.c[1]) < 3500) for (const w of s.walls()) if (w.door && w.kind !== 'outer' && w.kind !== 'facade') inner.push({ s, w });
const stride2 = Math.max(1, inner.length / TOWN_N), t2 = Date.now();
for (let q = 0; q < inner.length && res.rooms.doors < TOWN_N; q += stride2) {
  const { s, w } = inner[Math.floor(q)], du = w.u1 - w.u0, dv = w.v1 - w.v0, L = Math.hypot(du, dv) || 1, mu = (w.u0 + w.u1) / 2, mv = (w.v0 + w.v1) / 2;
  const mid = s.grid(mu, mv), a = s.grid(mu - dv / L * 1.2, mv + du / L * 1.2), b = s.grid(mu + dv / L * 1.2, mv - du / L * 1.2);
  if (!tw.locate(...a) || !tw.locate(...b)) continue;
  const route = tw.route(a, b); if (!route || route.length > 8) continue; // joined only the long way round: not through this door
  P.updateTerrain(T, { x: mid[0], y: 0, z: -mid[1] }); W.settlement!.streamColliders(mid[0], -mid[1], Infinity); P.step(1e-4);
  if (!standable(a) || !standable(b)) { res.rooms.shut.push(`${s.meta.id} ${w.kind} door at (${mid[0].toFixed(1)}, ${mid[1].toFixed(1)}): a fitting stands 1.2 m in`); continue; }
  res.rooms.doors++;
  P.updateTerrain(T, { x: mid[0], y: 0, z: -mid[1] }); W.settlement!.streamColliders(mid[0], -mid[1], Infinity); P.step(1e-4);
  let both = true;
  for (const [from, to] of [[a, b], [b, a]] as const) {
    const g = T.surfaceAt(from[0], -from[1]), r = walk(from === a ? route : route.slice().reverse(), floorAt(from[0], from[1], g + 0.3));
    if (!r.ok) { both = false; res.rooms.failures.push(`${s.meta.id} ${w.kind} door at (${mid[0].toFixed(1)}, ${mid[1].toFixed(1)}) (route ${route.map(q => `(${q[0].toFixed(1)}, ${q[1].toFixed(1)})`).join(' ')}): stopped at (${r.at[0].toFixed(1)}, ${r.at[1].toFixed(1)}) touching ${r.why}`); }
  }
  if (both) res.rooms.entered++;
}
console.log(`rooms: ${res.rooms.entered} / ${res.rooms.doors} doors inside the plots walked both ways along the town's route (${((Date.now() - t2) / 1000).toFixed(0)} s); ${res.rooms.shut.length} skipped: a fitting stands where the walk would start or end`); for (const f of res.rooms.failures.slice(0, 30)) console.log('   ', f);
console.log(`town: ${res.town.entered} / ${res.town.doors} street doors walked both ways (${((Date.now() - t1) / 1000).toFixed(0)} s)`); for (const f of res.town.failures.slice(0, 40)) console.log('   ', f);
const jf = argv.indexOf('--json'); if (jf >= 0) writeFileSync(argv[jf + 1], JSON.stringify({ people: PEOPLE, res }, null, 1));
