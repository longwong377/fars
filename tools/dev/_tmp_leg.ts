import { buildOfflineWorld } from './lib/offline_world';
import { TownWalk } from '../../src/world/settlement/walk';
type P2 = [number, number];
const legs: [P2, P2][] = [];
for (let i = 2; i + 3 < process.argv.length; i += 4) legs.push([[+process.argv[i], +process.argv[i + 1]], [+process.argv[i + 2], +process.argv[i + 3]]]);
const W = await buildOfflineWorld({ seed: 1, day: 25, hour: 10, court: true });
const { P } = W; const tw = TownWalk.fromPlan(W.settlement!.plan);
const rot = { x: 0, y: 0, z: 0, w: 1 };
for (const [a, b] of legs) {
  const r = tw.route(a, b); console.log('leg', a, b, 'route', r ? r.map(p => `(${p[0].toFixed(2)},${p[1].toFixed(2)})`).join(' ') : null); if (!r) continue;
  let pl = W.spawn(a[0], -a[1]); for (let i = 0; i < 10; i++) W.step(pl, 1 / 30, { forward: 0, yaw: 0 });
  for (let i = 1; i < r.length; i++) { const [e, n] = r[i]; let t = 0, best = 1e9, lp = 0, ok = false;
    while (t < 60) { const p = pl.position, de = e - p.x, dn = n + p.z; const d = Math.hypot(de, dn); if (d < (i === r.length - 1 ? 0.6 : 0.35)) { ok = true; break; }
      if (d < best - 0.05) { best = d; lp = t; } if (t - lp > 4) break; W.step(pl, 1 / 30, { forward: 1, yaw: Math.atan2(-de, dn), run: true }); t += 1 / 30; }
    if (!ok) { const p = pl.position, de = e - p.x, dn = n + p.z, L = Math.hypot(de, dn);
      const hit = P.world.castShape(p, rot, { x: de / L, y: 0, z: -dn / L }, pl.collider.shape, 0, 0.6, true, undefined, undefined, pl.collider, pl.body);
      let what = 'none'; if (hit) { const c = hit.collider, tr = c.translation(), sh: any = c.shape; what = `collider at (${tr.x.toFixed(2)}, ${(-tr.z).toFixed(2)}) y ${tr.y.toFixed(2)} shape ${c.shapeType()} half ${sh.halfExtents ? JSON.stringify(sh.halfExtents) : sh.radius} living ${W.livingBodies.has(c.parent()?.handle ?? -1)}`; }
      console.log(`  stuck at (${p.x.toFixed(2)}, ${(-p.z).toFixed(2)}) before waypoint ${i} (${e.toFixed(2)}, ${n.toFixed(2)}): ${what}`); break; }
  }
  P.world.removeCollider(pl.collider, false); P.world.removeRigidBody(pl.body); P.world.removeCharacterController(pl.controller);
}
