// The walked ground is the drawn ground (audit D M1, session 8 H workstream). Until then one terrain collider switched
// from the near to the mid ring 1,984 m out while the drawing switched at 2,048 m (up to 2.56 m apart; 5.97 m at the
// ~10 km seam) and the player fell through Kuh-e Rahmat on 12 of 24 eastward crossings. Now: one heightfield collider per
// drawn chunk from the same samples (physics.ts, Terrain.chunks), streamed around the player; Terrain.heightAt is the
// drawn triangle surface; a safety net puts the player back on the ground if ever below it, counted.
import { describe, it, expect, beforeAll } from 'vitest';
import * as THREE from 'three/webgpu';
import { Physics, TERRAIN_R } from '../src/player/physics';
import { Player, WALK_SPEED } from '../src/player/player';
import { TerrainMesh } from '../src/terrain/terrainMesh';
import { loadTerrain } from './plainLib';
import { seamCrossings } from './lib/seams';
import type { Terrain } from '../src/terrain/heightfield';

let T: Terrain, P: Physics;
beforeAll(async () => { T = loadTerrain(); P = await Physics.create(); });

describe('walked ground = drawn ground', () => {
  it('ray casts on the streamed colliders equal Terrain.heightAt everywhere (0-60 km, every ring and seam band)', () => {
    let worst = 0, n = 0;
    for (const [lo, hi] of [[0, 1900], [1984, 2048], [2048, 2112], [2100, 9900], [10176, 10304], [10300, 60000]]) {
      for (let i = 0; i < 120; i++) { const r = lo + (hi - lo) * ((i * 0.618034) % 1), a = i * 2.39996, x = r * Math.cos(a), z = r * Math.sin(a);
        P.updateTerrain(T, { x, y: 0, z }); const hit = P.castRayDown(x, z, 6000); expect(hit, `ground at ${x}, ${z}`).not.toBeNull();
        worst = Math.max(worst, Math.abs(hit! - T.heightAt(x, z))); n++; }
    }
    expect(worst, `${n} samples`).toBeLessThan(0.005);
  });
  it('Terrain.heightAt is the drawn mesh itself (the chunk geometry at full resolution, ray-picked, at ring and chunk seams)', () => {
    const m = new TerrainMesh(T, 1) as any; const rc = new THREE.Raycaster(); let worst = 0, n = 0;
    const pts: [number, number][] = [[2047.3, 511.2], [2048.6, -733.9], [1999.1, 1500.3], [-2047.9, 12.3], [511.9, 1024.1], [10239.2, 3000.7], [10241.5, -8000.2], [4095.1, 4097.7], [30000.3, -20000.9], [-150.2, 80.9]];
    for (const [x, z] of pts) {
      const ch = m.chunks.find((c: any) => { const x0 = -c.ring.half + c.c0 * c.ring.cell, z0 = -c.ring.half + c.r0 * c.ring.cell, s = c.cells * c.ring.cell; return x >= x0 && x <= x0 + s && z >= z0 && z <= z0 + s; });
      const mesh = new THREE.Mesh(m.buildGeometry(ch, 1)); rc.set(new THREE.Vector3(x, 6000, z), new THREE.Vector3(0, -1, 0));
      const hit = rc.intersectObject(mesh)[0]; expect(hit, `drawn ground at ${x}, ${z}`).toBeTruthy();
      worst = Math.max(worst, Math.abs(hit.point.y - T.heightAt(x, z))); n++;
    }
    expect(worst, `${n} points`).toBeLessThan(0.005);
  });
  it('the ring seams themselves meet (the rings agree along their edges): < 0.05 m', () => {
    let worst = 0;
    for (const [a, b, H] of [[T.near, T.mid, T.near.half], [T.mid, T.far, T.mid.half]] as const)
      for (let s = -H; s <= H; s += a.cell * 3) for (const [x, z] of [[H, s], [-H, s], [s, H], [s, -H]]) worst = Math.max(worst, Math.abs(a.surfaceAt(x, z) - b.surfaceAt(x, z)));
    expect(worst).toBeLessThan(0.05);
  });
});

describe('crossing every kind of seam (tests/lib/seams.ts; tools/dev/terrain_seams.ts runs 2,100)', () => {
  it('420 crossings of ring seams, chunk seams and corners, walking and running, oblique: no fall, no rescue, no invisible wall', () => {
    const r = seamCrossings(T, P, 420, 11);
    expect(r.crossings).toBe(420);
    expect(r.fell, r.falls.join('; ')).toBe(0);
    expect(r.rescued).toBe(0);
    expect(r.wall, r.walls.join('; ')).toBe(0);
    expect(r.worstGroundGap, r.worstGapAt).toBeLessThan(0.25); // the capsule on slopes up to 30° (a residual 0.18 m on a 29° far-ring slope: BLOCKERS B61)
  }, 120_000);
  it('the audit D case: 24 eastward crossings of e = 1,984 m on Kuh-e Rahmat (12 fell before): none falls', () => {
    let falls = 0;
    for (let k = 0; k < 24; k++) {
      const x0 = 1930, z0 = -1900 + k * 160; P.updateTerrain(T, { x: x0, y: 0, z: z0 });
      const pl = new Player(P, x0, T.heightAt(x0, z0) + 0.05, z0);
      for (let i = 0; i < 30 * 60; i++) { P.updateTerrain(T, pl.position); pl.update(1 / 30, { forward: 1, right: 0, run: false, yaw: -Math.PI / 2, pitch: 0 }); P.step(1 / 30); pl.rescueIfUnderground((a, b) => T.heightAt(a, b));
        if (pl.feetY - T.heightAt(pl.position.x, pl.position.z) < -0.3 || pl.rescues) { falls++; break; } }
      P.world.removeCollider(pl.collider, false); P.world.removeRigidBody(pl.body); P.world.removeCharacterController(pl.controller);
    }
    expect(falls).toBe(0);
  }, 120_000);
  it('streaming stays small: at most 9 terrain colliders around a walker, each built in well under a frame', () => {
    const x0 = 2000, z0 = 300; P.updateTerrain(T, { x: x0, y: 0, z: z0 }); let most = 0;
    const pl = new Player(P, x0, T.heightAt(x0, z0) + 0.05, z0);
    for (let i = 0; i < 30 * 30; i++) { P.updateTerrain(T, pl.position); pl.update(1 / 30, { forward: 1, right: 0, run: true, yaw: -Math.PI / 2, pitch: 0 }); P.step(1 / 30); most = Math.max(most, P.terrainChunks().length); }
    expect(most).toBeLessThanOrEqual(9); expect(TERRAIN_R).toBeGreaterThanOrEqual(64);
    expect(P.terrainStats.ms / P.terrainStats.built).toBeLessThan(4);
    P.world.removeCollider(pl.collider, false); P.world.removeRigidBody(pl.body); P.world.removeCharacterController(pl.controller);
  });
});

describe('safety net (counted, so it cannot hide a bug)', () => {
  it('a body pushed 3 m under the ground is put back on it, logged and counted', () => {
    const x = 2100, z = -500; P.updateTerrain(T, { x, y: 0, z }); P.step(1e-4);
    const g = T.heightAt(x, z), pl = new Player(P, x, g - 3, z); P.step(1 / 60);
    const warn = console.warn; let logged = ''; console.warn = (s: string) => { logged = s; };
    try { expect(pl.rescueIfUnderground((a, b) => T.heightAt(a, b))).toBe(true); } finally { console.warn = warn; }
    P.step(1 / 60);
    expect(pl.rescues).toBe(1); expect(logged).toMatch(/rescued the player/);
    expect(Math.abs(pl.feetY - g)).toBeLessThan(0.1);
    expect(pl.rescueIfUnderground((a, b) => T.heightAt(a, b))).toBe(false);
    P.world.removeCollider(pl.collider, false); P.world.removeRigidBody(pl.body); P.world.removeCharacterController(pl.controller);
  });
});

describe('walking pace on slopes (the step-up fired on every slope over 11°: 11.7 m/s uphill)', () => {
  it('uphill on 11-39° planes the player never exceeds walking pace', () => {
    for (const s of [0.2, 0.3, 0.5, 0.8]) {
      const W = new Physics(); (W as any).world = new (P.R as any).World({ x: 0, y: -9.81, z: 0 });
      const n = 17, cell = 80, h = new Float32Array(n * n); for (let r = 0; r < n; r++) for (let c = 0; c < n; c++) h[r + c * n] = s * (c * cell - 640);
      W.world.createCollider(P.R.ColliderDesc.heightfield(16, 16, h, { x: 1280, y: 1, z: 1280 })); W.step(1 / 60);
      const pl = new Player(W, -10, s * -10 + 0.05, 0.3);
      for (let i = 0; i < 8; i++) { pl.update(1 / 30, { forward: 0, right: 0, run: false, yaw: -Math.PI / 2, pitch: 0 }); W.step(1 / 30); }
      const x0 = pl.position.x;
      for (let i = 0; i < 30 * 16; i++) { pl.update(1 / 30, { forward: 1, right: 0, run: false, yaw: -Math.PI / 2, pitch: 0 }); W.step(1 / 30); }
      const along = (pl.position.x - x0) * Math.sqrt(1 + s * s);
      expect(along / 16, `slope ${s}`).toBeLessThanOrEqual(WALK_SPEED * 1.02);
      expect(along / 16, `slope ${s} still climbs`).toBeGreaterThan(0.5);
    }
  });
});
