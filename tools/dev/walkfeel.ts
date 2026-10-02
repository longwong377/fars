// dev (s17 C9, D-630): the walk's feel on the Terrace's real routes, measured with the player's own gait (walking pace,
// inertia, the head): the Phase 3 slice (the Grand Stair, the Gate, the Apadana) and the Phase 4 walkthroughs (Tachara,
// Hadish, Tripylon, Hall of 100, Treasury, Harem), routed on the walkable grid, steered at a point ~1 m ahead on the
// route as a player's eye leads. Per route: targets reached, stalls (wanting to walk, under 0.15 m/s for 0.5 s or
// more), snags (stalls of 2 s or more), the eye's worst vertical and horizontal second difference (m per frame² at 60 Hz;
// the camera's jerk, the head-bob not included: it is a smooth curve by construction), the head's (bob and sway)
// worst, footfalls a second on the level and on stairs, the climb pace. People off by default (--people: the court).
// Usage: npx tsx tools/dev/walkfeel.ts [route,route…|all] [--people] [--json out.json]
import { writeFileSync } from 'node:fs';
import { buildOfflineWorld } from './lib/offline_world';
import { ROUTES, SLICE } from '../../tests/e2e/lib/routes';
import { Head } from '../../src/player/motion';
import type { Player } from '../../src/player/player';

type P2 = [number, number];
const argv = process.argv.slice(2), PEOPLE = argv.includes('--people');
const ALL: Record<string, { start: P2; targets: [number, number, string][] }> = { slice: SLICE, ...ROUTES };
const want = !argv[0] || argv[0].startsWith('--') || argv[0] === 'all' ? Object.keys(ALL) : argv[0].split(',');
const W = await buildOfflineWorld({ seed: 1, day: 25, hour: 10, court: true, people: PEOPLE, plain: false });
const { P, nav, doors } = W;
for (const id of doors.doors.keys()) doors.toggle(id, true);
const DT = 1 / 60, DEBUG = argv.includes('--debug');
/** what the body touches (the controller's contacts last step) */
const touching = (pl: Player) => { const o: string[] = []; for (let i = 0; i < pl.controller.numComputedCollisions(); i++) { const c = pl.controller.computedCollision(i); if (!c?.collider) continue;
  const n = c.normal1, sh: any = c.collider.shape, tr = c.collider.translation(), w = c.witness1;
  o.push(`${sh.halfExtents ? `box ${sh.halfExtents.x.toFixed(2)}x${sh.halfExtents.y.toFixed(2)}x${sh.halfExtents.z.toFixed(2)}` : c.collider.shapeType()} n(${n.x.toFixed(2)},${n.y.toFixed(2)},${(-n.z).toFixed(2)}) at (${tr.x.toFixed(2)}, ${(-tr.z).toFixed(2)}, y ${tr.y.toFixed(2)}) touch (${w.x.toFixed(2)}, ${(-w.z).toFixed(2)}, y ${w.y.toFixed(2)})`); }
  return o.join('; ') || 'nothing'; };
const out: Record<string, any> = {};
for (const id of want) {
  const R = ALL[id]; if (!R) { console.log(`unknown route ${id}`); continue; }
  const pl: Player = W.spawn(R.start[0], -R.start[1], nav.heightAt(...R.start)); for (let i = 0; i < 30; i++) W.step(pl, DT, { forward: 0, yaw: 0 });
  const H = new Head(); let steps = 0, stairSteps = 0, levelT = 0, stairT = 0; pl.onStep = f => { if (f.stair) stairSteps++; else steps++; };
  const m = { whereY: '', whereXZ: '', targets: R.targets.length, reached: 0, stalls: 0, snags: [] as string[], eyeJerkY: 0, eyeJerkXZ: 0, headMax: 0, t: 0, climbUp: 0, climbT: 0 };
  let pos: P2 = [...R.start], ye: number[] = [], xe: number[] = [], ze: number[] = [], slowT = 0;
  for (const [e, n, what] of R.targets) {
    const path = nav.findPath(pos, [e, n]) ?? [pos, [e, n] as P2]; let i = 1, t = 0, ok = false;
    while (t < 90) {
      const p = pl.position, here: P2 = [p.x, -p.z];
      while (i < path.length - 1 && Math.hypot(path[i][0] - here[0], path[i][1] - here[1]) < 1.0) i++;
      const [ae, an] = path[i], d = Math.hypot(e - here[0], n - here[1]);
      if (d < 0.5) { ok = true; break; }
      const y0 = pl.feetY; W.step(pl, DT, { forward: 1, yaw: Math.atan2(-(ae - here[0]), an - here[1]) }); t += DT; m.t += DT;
      const dy = pl.feetY - y0; if (pl.grade > 0.15) { m.climbUp += dy; m.climbT += DT; }
      if (pl.grade > 0.15 || pl.grade < -0.15) stairT += DT; else levelT += DT;
      const eye = pl.eye; ye.push(eye.y); xe.push(eye.x); ze.push(eye.z);
      if (ye.length > 3) { ye.shift(); xe.shift(); ze.shift(); }
      if (ye.length === 3 && t > 0.5) {
        const jy = Math.abs(ye[2] - 2 * ye[1] + ye[0]), jxz = Math.hypot(xe[2] - 2 * xe[1] + xe[0], ze[2] - 2 * ze[1] + ze[0]);
        if (DEBUG && (jy > 0.02 || jxz > 0.02)) console.log(`      jerk y ${(jy * 1000).toFixed(1)} xz ${(jxz * 1000).toFixed(1)} at (${here[0].toFixed(2)}, ${here[1].toFixed(2)}) feet ${pl.feetY.toFixed(3)} dy ${dy.toFixed(3)} grounded ${pl.grounded} steps ${pl.steps} ease ${pl.stepEase.y.toFixed(3)} aiming (${ae.toFixed(1)}, ${an.toFixed(1)})`);
        if (jy > m.eyeJerkY) { m.eyeJerkY = jy; m.whereY = `(${here[0].toFixed(1)}, ${here[1].toFixed(1)}) grounded ${pl.grounded} fall ${pl.lastFall.toFixed(2)} steps ${pl.steps} unsticks ${pl.unsticks}`; }
        if (jxz > m.eyeJerkXZ) { m.eyeJerkXZ = jxz; m.whereXZ = `(${here[0].toFixed(1)}, ${here[1].toFixed(1)}) speed ${pl.speed.toFixed(2)} steps ${pl.steps} unsticks ${pl.unsticks} dodge ${pl.dodgeT.toFixed(2)}`; } }
      const h = H.update(DT, { phase: pl.bobPhase, speed: pl.speed, grounded: pl.grounded, landed: pl.landed, bob: true }, pl.yaw); m.headMax = Math.max(m.headMax, Math.abs(h.y));
      if (DEBUG && slowT > 0 && Math.abs(slowT - 1) < DT / 2) console.log(`      stalled at (${here[0].toFixed(2)}, ${here[1].toFixed(2)}) feet ${pl.feetY.toFixed(2)} aiming (${ae.toFixed(1)}, ${an.toFixed(1)}): ${touching(pl)}`);
      if (pl.speed < 0.15 && t > 0.6) slowT += DT; else { if (slowT >= 0.5) { m.stalls++; if (slowT >= 2) m.snags.push(`${slowT.toFixed(1)} s at (${here[0].toFixed(1)}, ${here[1].toFixed(1)}) on the way to ${what}`); } slowT = 0; }
      if (slowT > 8) break;
    }
    if (ok) m.reached++; else m.snags.push(`not reached: ${what} (${e}, ${n}); stopped at (${pl.position.x.toFixed(1)}, ${(-pl.position.z).toFixed(1)})`);
    pos = [pl.position.x, -pl.position.z];
  }
  P.world.removeCollider(pl.collider, false); P.world.removeRigidBody(pl.body); P.world.removeCharacterController(pl.controller);
  out[id] = { ...m, stepsPerS: +(steps / Math.max(1e-6, levelT)).toFixed(2), stairStepsPerS: +(stairSteps / Math.max(1e-6, stairT)).toFixed(2), climbMs: +(m.climbUp / Math.max(1e-6, m.climbT)).toFixed(2) };
  console.log(`${id.padEnd(9)} reached ${m.reached}/${m.targets} · stalls ${m.stalls} · snags ${m.snags.length} · eye jerk y ${(m.eyeJerkY * 1000).toFixed(1)} mm, xz ${(m.eyeJerkXZ * 1000).toFixed(1)} mm /frame² · head ${(m.headMax * 100).toFixed(1)} cm · steps/s level ${out[id].stepsPerS}, stairs ${out[id].stairStepsPerS} · ${m.t.toFixed(0)} s`);
  if (DEBUG) console.log(`     worst y at ${m.whereY}; worst xz at ${m.whereXZ}`);
  for (const s of m.snags) console.log('    ', s);
}
const jf = argv.indexOf('--json'); if (jf >= 0) writeFileSync(argv[jf + 1], JSON.stringify({ people: PEOPLE, routes: out }, null, 1));
