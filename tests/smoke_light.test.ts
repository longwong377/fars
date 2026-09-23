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
