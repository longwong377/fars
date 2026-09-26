// Audit D's ring probe (M1), now the tool of gates T-H1 (MASTER_PLAN §4.1): the walked terrain against the drawn terrain.
//  1. T-H1: collider vs DRAWN ground at the terrain LOD seams, 10,000 samples per ring seam (near/mid, mid/far), the drawn
//     height read from the terrain mesh's own chunk geometry (tests/lib/seams.ts seamSamples); writes the evidence
//     REVIEWS/evidence/s8-h/T-H1.json {id, value (m, the worst seam's worst), n (samples per seam), commit, tool}.
//  2. The audit's bands: physics ray vs Terrain.heightAt (the drawn surface), 200 samples per band from 0 to 30 km.
//  3. The audit's walks across the old collider switch lines (e 1,984 m, 9,984 m; n 1,984 m).
// Session 8 (audit D, a8cba80): near-ring edge 2.56 m apart, 12 of 24 crossings fell. After the H workstream: see the evidence.
// Usage (from the repo root): npx tsx tools/dev/audit_d/ring_probe.mts [--no-write]
import { writeFileSync, mkdirSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { Physics } from '../../../src/player/physics';
import { Player } from '../../../src/player/player';
import { loadTerrain } from '../../../tests/plainLib';
import { seamSamples } from '../../../tests/lib/seams';
const T = loadTerrain(); const P = await Physics.create();
// 1. T-H1
const seam = seamSamples(T, P, 10000, 7);
console.log(`T-H1 collider vs drawn ground at the ring seams (<= 0.05 m at >= 10,000 samples per seam): worst ${(seam.worst * 1000).toFixed(2)} mm (${(seam.ms / 1000).toFixed(0)} s)`); for (const l of seam.lines) console.log(l);
// 2. bands
for (const [lo, hi] of [[0, 1900], [1984, 2040], [2100, 9900], [9984, 10200], [10300, 30000]]) {
  let worst = 0, sum = 0, n = 0;
  for (let i = 0; i < 200; i++) {
    const r = lo + (hi - lo) * ((i * 0.618) % 1), a = i * 2.39996;
    const x = r * Math.cos(a), z = r * Math.sin(a);
    P.updateTerrain(T, { x, y: 0, z }); P.step(1e-4);
    const hit = P.castRayDown(x, z, 6000); if (hit === null) { console.log('NO GROUND at', x, z); continue; }
    const d = Math.abs(hit - T.heightAt(x, z)); worst = Math.max(worst, d); sum += d; n++;
  }
  console.log(`band ${lo}-${hi} m: physics vs drawn height mean ${(sum / n).toFixed(3)} m, worst ${worst.toFixed(3)} m`);
}
// 3. walks across the old switch lines
let lostAny = 0;
for (const [x0, z0, yawDeg] of [[1940, 300, -90], [1940, -800, -90], [9940, 0, -90], [300, 1940, 180]] as [number, number, number][]) {
  P.updateTerrain(T, { x: x0, y: 0, z: z0 }); P.step(1e-4);
  const pl = new Player(P, x0, (P.castRayDown(x0, z0, 6000) ?? T.heightAt(x0, z0)) + 0.05, z0);
  for (let i = 0; i < 30; i++) { pl.update(1 / 30, { forward: 0, right: 0, run: false, yaw: 0, pitch: 0 }); P.updateTerrain(T, pl.position); P.step(1 / 30); }
  pl.maxFall = 0; let worstOff = 0, lost = false;
  for (let i = 0; i < 30 * 90; i++) {
    P.updateTerrain(T, pl.position); pl.update(1 / 30, { forward: 1, right: 0, run: false, yaw: yawDeg * Math.PI / 180, pitch: 0 }); P.step(1 / 30);
    const off = pl.feetY - T.heightAt(pl.position.x, pl.position.z); if (Math.abs(off) > Math.abs(worstOff)) worstOff = off;
    if (off < -3) { lost = true; break; }
  }
  if (lost) lostAny++;
  console.log(`walk from (${x0},${z0}) yaw ${yawDeg}: now (${pl.position.x.toFixed(0)}, ${pl.position.z.toFixed(0)}), worst feet-vs-drawn ${worstOff.toFixed(2)} m, maxFall ${pl.maxFall.toFixed(2)}, fell through: ${lost}`);
  P.world.removeCollider(pl.collider, false); P.world.removeRigidBody(pl.body);
}
if (!process.argv.includes('--no-write')) {
  const commit = execFileSync('git', ['rev-parse', '--short', 'HEAD'], { encoding: 'utf8' }).trim(); mkdirSync('REVIEWS/evidence/s8-h', { recursive: true });
  writeFileSync('REVIEWS/evidence/s8-h/T-H1.json', JSON.stringify({ id: 'T-H1', value: +seam.worst.toFixed(5), n: seam.n, commit, tool: 'tools/dev/audit_d/ring_probe.mts', unit: 'm', seams: seam.seams, walks_fell: lostAny,
    crossings_tool: 'tools/dev/terrain_seams.ts (2,100 crossings: bench numbers in the H workstream report)' }, null, 1) + '\n');
  console.log('wrote REVIEWS/evidence/s8-h/T-H1.json');
}
