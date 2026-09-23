import { describe, it, expect } from 'vitest';
import { skyRadiance, skyIrradianceY, horizonRadiance, skyCalibration } from '../src/sky/horizon';
import { azAltToWorld } from '../src/sky/ephemeris';

// D-060: the SkyMesh dome is calibrated against the scene's skylight, and fog / far cloud haze / rain shafts converge to
// the calibrated horizon radiance.
const P = { turbidity: 2.2 + 6 * 0.35, rayleigh: 1.2, mieCoefficient: 0.003 + 0.02 * 0.35, mieDirectionalG: 0.8 };
const Y = (c: number[]) => 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
const sunAt = (alt: number, az = 180) => azAltToWorld(az, alt) as [number, number, number];

describe('sky calibration (D-060)', () => {
  it('the irradiance quadrature agrees with a fine integral within 2 %', () => {
    for (const alt of [3, 20, 60]) {
      const s = sunAt(alt); let E = 0; const NE = 90, NA = 180;
      for (let i = 0; i < NE; i++) for (let j = 0; j < NA; j++) {
        const th = ((i + 0.5) / NE) * (Math.PI / 2), a = ((j + 0.5) / NA) * 2 * Math.PI;
        E += Y(skyRadiance([Math.cos(a) * Math.sin(th), Math.cos(th), Math.sin(a) * Math.sin(th)], s, P)) * Math.cos(th) * Math.sin(th) * (Math.PI / 2 / NE) * (2 * Math.PI / NA);
      }
      expect(Math.abs(skyIrradianceY(s, P) / E - 1), `sun ${alt}°`).toBeLessThan(0.02);
    }
  });
  it('the calibrated dome carries the skylight irradiance by day, and keeps its own values at night', () => {
    const s = sunAt(35), hemiE = 0.78;
    const c = skyCalibration(s, P, hemiE, 0, 1, 0);
    expect(c.scale * skyIrradianceY(s, P)).toBeCloseTo(hemiE, 6);
    expect(skyCalibration(sunAt(-25), P, 0.03, 1, 1, 0).scale).toBe(1);
  });
  it('the calibrated clear horizon is 0.5–3× the radiance of sunlit ground (albedo 0.25), as a clear sky is (C)', () => {
    // the scene's lights at these sun altitudes (skySystem: sun 3.2·T·sin h, skylight ≈ 0.78 in luminance by day)
    for (const alt of [15, 35, 60]) {
      const s = sunAt(alt), h = (alt * Math.PI) / 180, air = 1 / (Math.sin(h) + 0.50572 * Math.pow(alt + 6.07995, -1.6364));
      const sunE = 3.2 * Math.exp(-0.18 * 1.35 * air) * Math.sin(h), hemiE = 0.78;
      const ground = (0.25 * (sunE + hemiE)) / Math.PI;
      const hz = Y(skyCalibration(s, P, hemiE, 0, 1, 0).horizon); // 90° from the sun
      expect(hz / ground, `sun ${alt}°`).toBeGreaterThan(0.5); expect(hz / ground, `sun ${alt}°`).toBeLessThan(3);
    }
  });
  it('the horizon is brighter than the zenith, and the aureole cap holds toward a low sun', () => {
    const s = sunAt(5, 270), c = skyCalibration(s, P, 0.77, 0, -1, 0); // looking into the setting sun
    let mean = 0; for (const [x, z] of [[1, 0], [0, 1], [-1, 0], [0, -1]]) mean += Y(horizonRadiance(s, P, x, z)) / 4;
    expect(Y(c.horizon)).toBeLessThanOrEqual(2.5 * mean * c.scale * 1.0001);
    const day = sunAt(35); expect(Y(horizonRadiance(day, P, 1, 0))).toBeGreaterThan(Y(skyRadiance([0, 1, 0], day, P)));
  });
});
