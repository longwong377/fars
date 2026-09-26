// Session 9 (WORLD_INVENTORY G5): breath visible in the cold.
import { describe, it, expect } from 'vitest';
import * as THREE from 'three/webgpu';
import { BreathFx, breathVisibility, puff, breathAge, BREATH_R } from '../src/world/breath';

describe('breath in the cold (session 9)', () => {
  it('seen below ~6 C, fully by -2 C, more in damp air', () => {
    expect(breathVisibility(10, 60)).toBe(0); expect(breathVisibility(-3, 60)).toBe(1); expect(breathVisibility(2, 60)).toBeCloseTo(0.5, 5); expect(breathVisibility(-3, 20)).toBe(0.5);
  });
  it('a breath forms, spreads and is gone in ~1.3 s; each person on their own rhythm, quicker when walking', () => {
    expect(puff(-0.1)).toBeNull(); expect(puff(1.4)).toBeNull(); expect(puff(0.6)!.size).toBeGreaterThan(puff(0.1)!.size); expect(puff(1.25)!.alpha).toBeLessThan(0.05);
    const onA: number[] = [], onB: number[] = []; for (let t = 0; t < 40; t += 0.05) { if (breathAge('a1', t, false) === 0 || (breathAge('a1', t, false) ?? 9) < 0.05) onA.push(t); if ((breathAge('p9', t, false) ?? 9) < 0.05) onB.push(t); }
    expect(onA.join()).not.toBe(onB.join());
    let still = 0, walk = 0; for (let t = 0; t < 120; t += 0.05) { if ((breathAge('x', t, false) ?? 9) < 0.05) still++; if ((breathAge('x', t, true) ?? 9) < 0.05) walk++; } expect(walk).toBeGreaterThan(still);
  });
  it('puffs in front of the faces of the people within reach, and the walker\'s own; none when warm', () => {
    const b = new BreathFx(), cam = new THREE.PerspectiveCamera(50, 16 / 9, 0.05, 1000); cam.position.set(0, 1.6, 0); cam.updateMatrixWorld();
    const ppl = [{ key: 'a', x: 2, y: 0, z: -3, yaw: 0, age: 30 }, { key: 'b', x: 1, y: 0, z: -2, yaw: Math.PI, age: 8 }, { key: 'far', x: 40, y: 0, z: 0, yaw: 0, age: 30 }];
    let most = 0; for (let t = 0; t < 5; t += 0.1) { b.update(t, cam, ppl, { moving: false }, { tempC: -2, rh: 70 }); most = Math.max(most, b.stats.puffs); }
    expect(most).toBeGreaterThanOrEqual(2); expect(most).toBeLessThanOrEqual(3);
    b.update(1, cam, ppl, { moving: false }, { tempC: 15, rh: 70 }); expect(b.stats.puffs).toBe(0); expect(BREATH_R).toBeLessThan(40);
  });
});
