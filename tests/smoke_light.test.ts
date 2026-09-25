// Skylight on smoke (D-070): optically thin smoke scatters the mean radiance over the sphere (sky above, ground below),
// so it is brighter than the ground it hangs over and follows the hemisphere light, not the horizon behind it.
import { describe, it, expect } from 'vitest';
import * as THREE from 'three/webgpu';
import { smokeSkyRadiance } from '../src/world/fire';

describe('smoke sky radiance', () => {
  const sun = new THREE.DirectionalLight(), state = { sunDir: new THREE.Vector3(0, 1, 0) };
  it('is the sphere-mean radiance (E/pi)(1 + ground albedo)/2 of the hemisphere light, whatever the horizon', () => {
    const hemi = new THREE.HemisphereLight(0xffffff, 0x000000, Math.PI);
    const a = smokeSkyRadiance({ horizon: new THREE.Color(5, 5, 5), hemi, sun, state }, new THREE.Color());
    const b = smokeSkyRadiance({ horizon: new THREE.Color(0.1, 0.1, 0.1), hemi, sun, state }, new THREE.Color());
    expect(a.r).toBeCloseTo(0.625, 6); expect(b.equals(a)).toBe(true);
    // brighter than a Lambertian ground of albedo 0.25 lit by the same sky (0.25 x E / pi), darker than a white one
    expect(a.r).toBeGreaterThan(0.25); expect(a.r).toBeLessThan(1);
  });
  it('falls back to the horizon radiance without a hemisphere light', () => {
    const c = smokeSkyRadiance({ horizon: new THREE.Color(0.2, 0.3, 0.4), sun, state }, new THREE.Color());
    expect(c.toArray()).toEqual([0.2, 0.3, 0.4]);
  });
});

describe('town smoke plumes from emission (session 7: the dawn "comb")', () => {
  it("a household hearth's plume is a faint wisp; ovens and kilns are the visible ones; a charcoal brazier hardly smokes", async () => {
    const { plumeTau } = await import('../src/world/settlement/haze');
    const op = (k: string) => 1 - Math.exp(-plumeTau(k));
    expect(op('hearth')).toBeGreaterThan(0.015); expect(op('hearth')).toBeLessThan(0.05); // was ~0.38 for every plume
    expect(op('oven')).toBeGreaterThan(3 * op('hearth')); expect(op('kiln')).toBeGreaterThan(3 * op('hearth'));
    expect(op('oven')).toBeLessThan(0.2); expect(op('brazier')).toBeLessThan(0.005);
  });
});

import { flameFootprint, FLAME_MIN_PX } from '../src/world/fire';
describe('far flames (render pass 2, the town at dusk from Kuh-e Rahmat)', () => {
  const ppr = 540 / 2 / Math.tan((40 * Math.PI) / 360); // the settlement renders: 540 px, 40° vertical
  it('keep their size near and grow to FLAME_MIN_PX far, with the light reaching the eye unchanged', () => {
    const near = flameFootprint(0.6, 10, ppr); expect(near.k).toBe(1); expect(near.flux).toBe(1);
    for (const d of [300, 1500, 4000]) {
      const { k, flux } = flameFootprint(0.6, d, ppr), px = (0.6 / d) * ppr;
      expect(k).toBeGreaterThan(1); expect((0.6 * k / d) * ppr).toBeCloseTo(FLAME_MIN_PX, 6);
      expect(k * k * flux).toBeCloseTo(1, 9); // area x radiance conserved
      expect(px).toBeLessThan(FLAME_MIN_PX);
    }
  });
});
