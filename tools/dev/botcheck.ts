// dev: run the §13.8 walkthrough bot offline (node, no browser): same Rapier colliders, player controller, walkable-grid
// routing and walkTo steering as tests/e2e/lib/bot.ts + src/main.ts, minus rendering and (without --world) people. Seconds instead of the
// minutes a SwiftShader run takes, so a route can be debugged before the e2e run. Usage:
//   npx tsx tools/dev/botcheck.ts [area[,area…]|slice] [--trace] [--world]
// --world (H workstream, D-237): the game's whole world instead of the Terrace colliders alone (tools/dev/lib/offline_world.ts:
// doors, furnishings, waterworks, inscription stones, the town and the plain, the people and animals near the player, solid as
// in the game). Every walkable area beyond these routes: tools/dev/walkers.ts.
import { readFileSync } from 'node:fs';
import { Ring, Terrain, TerrainMeta } from '../../src/terrain/heightfield';
import { Physics } from '../../src/player/physics';
import { Player } from '../../src/player/player';
import { buildTerrace } from '../../src/arch/terrace';
import { buildMeshes } from '../../src/arch/meshes';
import { NavGrid } from '../../src/people/navgrid';
import { ROUTES, SLICE } from '../../tests/e2e/lib/routes';

const meta: TerrainMeta = JSON.parse(readFileSync('public/generated/terrain.json', 'utf8'));
const ring = (k: 'near' | 'mid' | 'far') => new Ring(meta.rings[k], new Uint16Array(readFileSync(`public/${meta.rings[k].file}`).buffer.slice(0)), meta.court_asl);
const useWorld = process.argv.includes('--world');
const OW = useWorld ? await (await import('./lib/offline_world')).buildOfflineWorld({ day: 25, hour: 9.5 }) : null;
const T = OW ? OW.T : new Terrain(meta, ring('near'), ring('mid'), ring('far'));
const P = OW ? OW.P : await Physics.create();
if (!OW) { P.updateTerrain(T, { x: 0, y: 0, z: 0 }); buildMeshes(buildTerrace().parts, P); P.step(1 / 60); }
const nav = await NavGrid.load(async p => { const b = readFileSync('public/' + p); return b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength); });
const trace = process.argv.includes('--trace');
const areas = (process.argv[2] && !process.argv[2].startsWith('--') ? process.argv[2] : Object.keys(ROUTES).join(',')).split(',');

let bad = 0;
for (const area of areas) {
  const R = area === 'slice' ? SLICE : ROUTES[area]; let pos: [number, number] = R.start; // 'slice' = the Phase 3 route (not run by default)
  const x0 = pos[0], z0 = -pos[1]; P.updateTerrain(T, { x: x0, y: 0, z: z0 }); P.step(1e-4);
  const pl = new Player(P, x0, P.castRayDown(x0, z0, 400) ?? T.heightAt(x0, z0), z0); pl.maxFall = 0; pl.fallStartY = null;
  const stepDt = (yawDeg: number, fwd: number, dt: number) => { const yaw = -((yawDeg - 341) * Math.PI) / 180;
    if (OW) { OW.step(pl, dt, { forward: fwd, yaw }); return; }
    P.updateTerrain(T, pl.position); pl.update(dt, { forward: fwd, right: 0, run: false, yaw, pitch: 0 }); P.step(Math.max(1 / 240, dt)); pl.rescueIfUnderground((a, b) => T.surfaceAt(a, b)); };
  for (let i = 0; i < 30; i++) stepDt(0, 0, 1 / 30);
  pl.maxFall = 0;
  const walkTo = (east: number, north: number, maxSeconds = 240, tol = 0.5, dt = 1 / 30) => {
    let t = 0, lastProgress = 0, best = Infinity;
    while (t < maxSeconds) {
      const p = pl.position, de = east - p.x, dn = north + p.z, d = Math.hypot(de, dn);
      if (d < tol) return { reached: true, t };
      if (d < best - 0.05) { best = d; lastProgress = t; }
      if (t - lastProgress > 4) return { reached: false, t };
      stepDt(Math.atan2(de, dn) * 180 / Math.PI + 341, 1, dt); t += dt;
      if (trace && Math.round(t / dt) % 15 === 0) console.log(`    t ${t.toFixed(1)} at (${p.x.toFixed(2)}, ${(-p.z).toFixed(2)}) feet ${pl.feetY.toFixed(2)} grounded ${pl.grounded}`);
    }
    return { reached: false, t };
  };
  for (const [e, n, what] of R.targets) {
    let ok = false, tries = 0;
    while (!ok && tries < 3) {
      tries++; const path = nav.findPath(pos, [e, n]);
      if (!path) { console.log(`  ✗ ${area}: no walkable route to ${what}`); break; }
      ok = true;
      for (const [k, [we, wn]] of path.slice(1).entries()) { const r = walkTo(we, wn, 240, k === path.length - 2 ? 0.5 : 0.2); pos = [pl.position.x, -pl.position.z]; if (!r.reached) { ok = false; if (trace) console.log(`    stuck toward (${we.toFixed(2)}, ${wn.toFixed(2)})`); break; } }
    }
    const lvl = R.levels[what], y = pl.feetY;
    const lvlBad = lvl !== undefined && Math.abs(y - lvl) > 0.05;
    console.log(`  ${ok && !lvlBad && pl.maxFall < 0.6 ? '✓' : '✗'} ${area}: ${what} tries ${tries} at (${pos[0].toFixed(1)}, ${pos[1].toFixed(1)}) y ${y.toFixed(2)}${lvl !== undefined ? ` (level ${lvl})` : ''} maxFall ${pl.maxFall.toFixed(2)}`);
    if (!ok || lvlBad || pl.maxFall >= 0.6) { bad++; break; }
  }
}
process.exit(bad ? 1 : 0);
