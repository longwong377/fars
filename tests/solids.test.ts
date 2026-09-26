// Solidity near the player (brief §6 "player collision with crowds and animals"; audit D M12; D-237): everyone and every
// animal within SOLID_R of the player is solid (src/world/solids.ts), within a CPU budget.
import { describe, it, expect } from 'vitest';
import * as THREE from 'three/webgpu';
import { Physics } from '../src/player/physics';
import { Player } from '../src/player/player';
import { NearSolids, SOLID_POOLS, SOLID_R } from '../src/world/solids';
import type { AnimalInst, Species } from '../src/people/animals';

const flat = async () => { const P = await Physics.create(); P.addBox({ x: 0, y: -0.5, z: 0 }, { x: 200, y: 0.5, z: 200 }); P.step(1 / 60); return P; };
const inst = (sp: Species, lie = 0): AnimalInst => ({ sp, x: 0, z: 0, yaw: 0, phase: 0, walk: 0, graze: 0, lie, coat: 0 });
const M = (x: number, z: number, yaw: number) => new THREE.Matrix4().compose(new THREE.Vector3(x, 0, z), new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), yaw), new THREE.Vector3(1, 1, 1));
/** walk the player toward +x from x = 0 for `sec` s; returns how far it got */
function walkX(P: Physics, S: NearSolids, feed: () => void, sec = 6) {
  const pl = new Player(P, 0, 0, 0);
  for (let i = 0; i < sec * 30; i++) { S.begin(pl.position); feed(); S.end(); pl.update(1 / 30, { forward: 1, right: 0, run: false, yaw: -Math.PI / 2, pitch: 0 }); P.step(1 / 30); }
  const x = pl.position.x; P.world.removeCollider(pl.collider, false); P.world.removeRigidBody(pl.body); return x;
}

describe('people and animals near the player are solid (D-237)', () => {
  it('a person, an ox (broadside and end-on), a sheep, a dog, a lying donkey stop the walker; a hen does not', async () => {
    const cases: [string, (S: NearSolids) => void, number][] = [
      ['person', S => S.person(3, 0, 0), 2.6],
      ['ox broadside', S => { S.beginAnimals(); S.animal(inst('ox'), M(3, 0, 0)); }, 2.8],
      ['ox end-on', S => { S.beginAnimals(); S.animal(inst('ox'), M(3.6, 0, Math.PI / 2)); }, 2.8],
      ['sheep', S => { S.beginAnimals(); S.animal(inst('sheep'), M(3, 0, 0)); }, 2.8],
      ['dog', S => { S.beginAnimals(); S.animal(inst('dog'), M(3, 0, 0.3)); }, 2.9],
      ['lying donkey', S => { S.beginAnimals(); S.animal(inst('donkey', 1), M(3, 0, 0)); }, 2.9],
    ];
    for (const [what, feed, stopBefore] of cases) { const P = await flat(), S = new NearSolids(P); const x = walkX(P, S, () => feed(S)); expect(x, what).toBeLessThan(stopBefore); expect(x, what).toBeGreaterThan(1.5); }
    const P = await flat(), S = new NearSolids(P); const x = walkX(P, S, () => { S.beginAnimals(); S.animal(inst('hen'), M(3, 0, 0)); });
    expect(x, 'a hen scatters (not solid)').toBeGreaterThan(6);
  });
  it('the nearest are solid, farther than SOLID_R nobody; the pools fill nearest first', async () => {
    const P = await flat(), S = new NearSolids(P);
    S.begin({ x: 0, z: 0 }); for (let i = 0; i < 400; i++) S.person(Math.cos(i) * (1 + i * 0.05), 0, Math.sin(i) * (1 + i * 0.05)); S.end();
    expect(S.stats.people).toBe(SOLID_POOLS.people); expect(S.stats.candidatesPeople).toBe(301); // r ≤ 16 m: i ≤ 300; the rest dropped before the pool
    expect(S.stats.dropped).toBe(301 - SOLID_POOLS.people); // reported, never silent
    P.step(1 / 60);
    const ys = S.bodies().slice(0, SOLID_POOLS.people).map(b => b.translation()); const far = ys.filter(t => Math.hypot(t.x, t.z) > SOLID_R + 1e-3 && t.y > -500);
    expect(far.length).toBe(0);
  });
  it('CPU: a full court around the player (160 people + 64 animals solid) costs the physics step < 1.5 ms more than none (measured under load: a bound, not a benchmark)', async () => {
    const time = async (fill: boolean) => { const P = await flat(), S = new NearSolids(P), pl = new Player(P, 0, 0, 0); let ms = 0;
      for (let i = 0; i < 300; i++) { const t0 = performance.now(); S.begin(pl.position);
        if (fill) { for (let k = 0; k < 220; k++) { const a = k * 2.4, r = 1.5 + (k % 14); S.person(r * Math.cos(a), 0, r * Math.sin(a) + (i % 7) * 0.01); }
          S.beginAnimals(); const sp: Species[] = ['sheep', 'goat', 'ox', 'donkey', 'dog', 'camel']; for (let k = 0; k < 70; k++) S.animal(inst(sp[k % 6]), M(Math.cos(k) * (2 + k % 13), Math.sin(k) * (2 + k % 13), k)); }
        S.end(); pl.update(1 / 30, { forward: 1, right: 0.3, run: false, yaw: i * 0.02, pitch: 0 }); P.step(1 / 30); if (i >= 60) ms += performance.now() - t0; }
      return ms / 240; };
    const none = await time(false), full = await time(true);
    console.log(`solids CPU per step: none ${none.toFixed(3)} ms, full ${full.toFixed(3)} ms (+${(full - none).toFixed(3)})`);
    expect(full - none).toBeLessThan(1.5);
  });
});
