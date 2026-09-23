import { describe, it, expect } from 'vitest';
import * as THREE from 'three/webgpu';
import { Atmosphere, aerosolTauFor, OBSERVER_ALT } from '../src/sky/atmosphere';
import { extinctionK } from '../src/sky/illuminance';
import { CLOUD_BASE, CLOUD_TOP } from '../src/sky/clouds';
import { SkySystem } from '../src/sky/skySystem';
import { WorldClock } from '../src/core/clock';

// D-119: the cloud layer takes sunlight at its own height: after sunset for the ground the sun still lights the deck from
// below for as long as it is above that height's horizon (geometric dip √(2Δh/R) over the 1600 m plain), reddened by the
// grazing path through the spherical atmosphere of D-116.
const Y = (c: number[]) => 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
describe('clouds at low sun (D-119)', () => {
  const A = new Atmosphere(aerosolTauFor(extinctionK(0.25)));
  const base = (h: number) => A.sunColorAt(OBSERVER_ALT + CLOUD_BASE, h), top = (h: number) => A.sunColorAt(OBSERVER_ALT + CLOUD_TOP, h);
  it('the base and the top of the deck keep the sun below the ground\'s horizon, each until its own horizon', () => {
    expect(Y(A.sunColorAt(OBSERVER_ALT, -1.0))).toBe(0);                    // set for the ground
    expect(Y(base(-1.0))).toBeGreaterThan(0); expect(base(-1.0)[0] / Math.max(1e-12, base(-1.0)[2])).toBeGreaterThan(10); // red
    expect(Y(base(-1.6))).toBe(0);                                          // dip of 1.5 km over the plain: 1.25° + the disc
    expect(Y(top(-1.6))).toBeGreaterThan(0); expect(Y(top(-2.3))).toBe(0);  // dip of 3.6 km: 1.93° + the disc
    expect(Y(top(-1.0))).toBeGreaterThan(100 * Y(base(-1.0)));              // the glow is carried by the upper deck
  });
  it('at noon the deck is lit like the ground (a little brighter: less air above it)', () => {
    const g = A.sunColorAt(OBSERVER_ALT, 80), b = base(80);
    expect(Y(b) / Y(g)).toBeGreaterThan(1); expect(Y(b) / Y(g)).toBeLessThan(1.25);
  });
  it('the SkySystem hands the cloud shader a red sun at the top and none at the base after sunset', () => {
    const sky = new SkySystem(new THREE.Scene(), 256, 'test');
    sky.update(new WorldClock(0, 18.47).jdUT, new THREE.Vector3(), 0.3, 0.25, { ms: 2, fromDeg: 270, tSeconds: 0 }, new THREE.Vector3(1, 0, 0)); // sun ≈ −1.4°
    expect(sky.state.sunAlt).toBeLessThan(-1.2); expect(sky.state.sunAlt).toBeGreaterThan(-1.7);
    const t = sky.clouds.sunColorTop.value as THREE.Color, b = sky.clouds.sunColor.value as THREE.Color;
    expect(t.r).toBeGreaterThan(0); expect(t.r).toBeGreaterThan(5 * t.b);
    expect(b.r + b.g + b.b).toBeLessThan(1e-3 * (t.r + t.g + t.b) + 1e-9);
    expect(sky.sun.intensity).toBe(0);
  });
});
