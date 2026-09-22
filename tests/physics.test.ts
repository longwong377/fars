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
