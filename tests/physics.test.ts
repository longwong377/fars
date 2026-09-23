import { describe, it, expect, beforeAll } from 'vitest';
import { readFileSync } from 'node:fs';
import { Ring, Terrain, TerrainMeta } from '../src/terrain/heightfield';
import { Physics } from '../src/player/physics';
import { Player } from '../src/player/player';

const meta: TerrainMeta = JSON.parse(readFileSync('public/generated/terrain.json', 'utf8'));
const ring = (k: 'near' | 'mid' | 'far') => new Ring(meta.rings[k], new Uint16Array(readFileSync(`public/${meta.rings[k].file}`).buffer.slice(0)), meta.court_asl);
const T = new Terrain(meta, ring('near'), ring('mid'), ring('far'));
let P: Physics;
beforeAll(async () => { P = await Physics.create(); P.updateTerrain(T, { x: 0, y: 0, z: 0 }); P.step(1 / 60); });

describe('physics terrain collider', () => {
  it('heightfield orientation matches the render heightfield (ray casts vs bilinear sample, 50 points)', () => {
    let worst = 0;
    for (let i = 0; i < 50; i++) {
      const x = -1500 + ((i * 617) % 3000), z = -1500 + ((i * 331) % 3000);
      const hit = P.castRayDown(x, z); expect(hit).not.toBeNull();
      worst = Math.max(worst, Math.abs(hit! - T.heightAt(x, z)));
    }
    expect(worst).toBeLessThan(0.5);
  });
  it('player walks on the plain at walking pace and stays grounded', () => {
    const y = T.heightAt(-300, 0);
    const pl = new Player(P, -300, y, 0);
    for (let i = 0; i < 20; i++) { pl.update(1 / 60, { forward: 0, right: 0, run: false, yaw: 0, pitch: 0 }); P.step(1 / 60); }
    const z0 = pl.position.z;
    for (let i = 0; i < 600; i++) { pl.update(1 / 60, { forward: 1, right: 0, run: false, yaw: 0, pitch: 0 }); P.step(1 / 60); }
    const moved = z0 - pl.position.z; // yaw 0 = toward −Z
    expect(moved).toBeGreaterThan(12.5); expect(moved).toBeLessThan(13.6); // 10 s × 1.35 m/s
    expect(Math.abs(pl.feetY - T.heightAt(pl.position.x, pl.position.z))).toBeLessThan(0.15);
    expect(pl.grounded).toBe(true);
  });
});

describe('player step-up (brief §6: correct step-up; the walkable grid routes over steps ≤ NAV.maxStep)', () => {
  // a flat slab far from the Terrace with step blocks; the player walks at them head-on and obliquely
  it('climbs every step up to STEP_UP head-on and at 45°, and not a 0.6 m ledge', async () => {
    const { STEP_UP } = await import('../src/player/player');
    const W = await Physics.create(); const Y = 50;
    W.addBox({ x: -400, y: Y - 0.5, z: 0 }, { x: 60, y: 0.5, z: 60 });
    const hs = [0.12, 0.24, 0.3, 0.36, STEP_UP, 0.6];
    hs.forEach((h, i) => W.addBox({ x: -380, y: Y + h / 2, z: -40 + i * 14 }, { x: 10, y: h / 2, z: 6 }));
    W.step(1 / 60);
    for (const off of [0, 45]) hs.forEach((h, i) => {
      const pl = new Player(W, -391.2, Y, -40 + i * 14); const yaw = -(90 - off) * Math.PI / 180; let top = -1;
      for (let k = 0; k < 10; k++) { pl.update(1 / 60, { forward: 0, right: 0, run: false, yaw, pitch: 0 }); W.step(1 / 60); }
      for (let k = 0; k < 360; k++) { pl.update(1 / 60, { forward: 1, right: 0, run: false, yaw, pitch: 0 }); W.step(1 / 60); top = Math.max(top, pl.feetY - Y); }
      if (h <= STEP_UP) expect(top, `step ${h} at ${off}°`).toBeGreaterThan(h - 0.05); else expect(top, `ledge ${h} at ${off}°`).toBeLessThan(0.1);
      expect(pl.maxFall, `no fall stepping ${h}`).toBeLessThan(0.1);
      W.world.removeCollider(pl.collider, false); W.world.removeRigidBody(pl.body);
    });
  });
});
