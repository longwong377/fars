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

// D-116: the twilight dome (a spherical single-scattering atmosphere with multiple scattering, atmosphere.ts) blended with
// the Preetham dome below +10° and calibrated the same way; the fog / far haze / rain shafts converge to it.
import { Atmosphere, aerosolTauFor, sampleSkyView, skyViewRadiance, type SkyView } from '../src/sky/atmosphere';
import { twilightWeight, domeRadiance } from '../src/sky/horizon';
import { extinctionK } from '../src/sky/illuminance';

describe('twilight dome (D-116)', () => {
  const A = new Atmosphere(aerosolTauFor(extinctionK(0.25)));
  const views = new Map<number, SkyView>(); const V = (h: number) => { let v = views.get(h); if (!v) { v = A.skyView(h); views.set(h, v); } return v; };
  const deg = Math.PI / 180;
  /** radiance along the antisolar (φ = 180°) or solar (φ = 0) vertical at elevation e (deg) */
  const at = (h: number, e: number, phi: number) => sampleSkyView(V(h), e * deg, phi * deg);
  const xy = (c: number[]) => { const X = 0.4124 * c[0] + 0.3576 * c[1] + 0.1805 * c[2], Yv = 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2], Z = 0.0193 * c[0] + 0.1192 * c[1] + 0.9505 * c[2]; const s = X + Yv + Z; return [X / s, Yv / s]; };
  const rb = (c: number[]) => c[0] / c[2];
  /** the antisolar vertical: elevation of the minimum below the arch, of the arch's maximum, and of the shadow's top (the
   *  rise through the midpoint between them) */
  const profile = (h: number) => {
    const es: number[] = []; for (let e = 0.5; e <= 40; e += 0.5) es.push(e);
    const L = es.map(e => Y(at(h, e, 180)));
    // the dark segment: the minimum within 20° of the horizon (near-field scattering can brighten the lowest degree);
    // the arch: the maximum above it
    let iMin = 0; for (let i = 0; es[i] <= 20; i++) if (L[i] < L[iMin]) iMin = i;
    let iMax = iMin; for (let i = iMin; i < L.length; i++) if (L[i] > L[iMax]) iMax = i;
    const mid = (L[iMin] + L[iMax]) / 2; let top = es[iMax]; for (let i = iMin; i <= iMax; i++) if (L[i] >= mid) { top = es[i]; break; }
    return { eMin: es[iMin], eMax: es[iMax], top, contrast: L[iMax] / L[iMin], cMin: at(h, es[iMin], 180), cMax: at(h, es[iMax], 180) };
  };

  it('the calibrated twilight dome carries the skylight irradiance (the D-060 rule holds for the blend)', () => {
    for (const h of [6, 1, -3, -8]) {
      const s = sunAt(h), w = twilightWeight(h), hemiE = 0.05, tw = { view: V(Math.max(-12, h)), w };
      const c = skyCalibration(s, P, hemiE, 0, 1, 0, tw);
      let E = 0; const NE = 16, NA = 32;
      for (let i = 0; i < NE; i++) for (let j = 0; j < NA; j++) {
        const th0 = (i / NE) * (Math.PI / 2), th1 = ((i + 1) / NE) * (Math.PI / 2), th = (th0 + th1) / 2, a = ((j + 0.5) / NA) * 2 * Math.PI;
        E += Y(domeRadiance([Math.cos(a) * Math.sin(th), Math.cos(th), Math.sin(a) * Math.sin(th)], s, P, c.kP, c.kT, tw.view)) * (Math.PI * (Math.cos(th0) ** 2 - Math.cos(th1) ** 2)) / NA;
      }
      expect(E / hemiE, `sun ${h}°`).toBeCloseTo(1, 2);
    }
    // D-156: the physical sky serves at every sun altitude (was Preetham above +10°, D-116)
    expect(twilightWeight(12)).toBe(1); expect(twilightWeight(1)).toBe(1); expect(twilightWeight(60)).toBe(1);
  });
  it('Earth\'s shadow: a dark band on the antisolar horizon under a brighter arch, for the sun from −1° to −4°', () => {
    for (const h of [-1, -2, -3, -4]) {
      const p = profile(h);
      expect(p.contrast, `sun ${h}°: arch / dark segment`).toBeGreaterThan(h > -4 ? 1.3 : 1.15); // fading by −4°
      expect(p.eMin, `sun ${h}°: the dark segment sits low`).toBeLessThan(p.eMax);
      expect(rb(p.cMax), `sun ${h}°: the arch is warmer than the shadow`).toBeGreaterThan(rb(p.cMin) * 1.1);
    }
  });
  it('the shadow rises as the sun sinks, and the arch (Belt of Venus) lies within ~5–25° while it is seen (documented 10–20°)', () => {
    const tops = [-1, -2, -3, -4].map(h => profile(h).top);
    for (let i = 1; i < tops.length; i++) expect(tops[i], `shadow tops ${tops.join(', ')}`).toBeGreaterThan(tops[i - 1]);
    for (const h of [-1, -2, -3]) { const p = profile(h); expect(p.eMax).toBeGreaterThanOrEqual(5); expect(p.eMax).toBeLessThanOrEqual(25); }
  });
  it('Lee (2015): the dark segment and the sky above the arch have nearly the same colour', () => {
    for (const h of [-2, -3]) {
      const p = profile(h), a = xy(p.cMin), b = xy(at(h, 45, 180));
      expect(Math.hypot(a[0] - b[0], a[1] - b[1]), `sun ${h}°`).toBeLessThan(0.02);
    }
  });
  it('a warm glow toward the sun: brighter and warmer than the antisolar horizon, and not magenta (R ≥ G ≥ B at 3°)', () => {
    for (const h of [2, 0, -2, -4, -6, -8]) {
      const toward = at(h, 3, 0), away = at(h, 3, 180);
      expect(Y(toward) / Y(away), `sun ${h}°`).toBeGreaterThan(2);
      expect(rb(toward), `sun ${h}°`).toBeGreaterThan(1.5 * rb(away));
      expect(toward[0]).toBeGreaterThanOrEqual(toward[1]); expect(toward[1]).toBeGreaterThanOrEqual(toward[2]);
    }
  });
  it('fog and far haze converge to the twilight dome: warmer toward the afterglow than away from it', () => {
    const h = -3, s = sunAt(h, 270), tw = { view: V(h), w: 1 }; // the sun in the W (world −x)
    const west = skyCalibration(s, P, 0.1, 0, -1, 0, tw).horizon, east = skyCalibration(s, P, 0.1, 0, 1, 0, tw).horizon;
    expect(rb(west)).toBeGreaterThan(rb(east));
    // the calibrated horizon is the dome itself 1.5° up (fan-averaged): check one direction against domeRadiance
    const c = skyCalibration(s, P, 0.1, 0, 1, 0, tw);
    const d = domeRadiance([Math.cos(1.5 * deg), Math.sin(1.5 * deg), 0], s, P, c.kP, c.kT, tw.view);
    expect(Y(d) / Y(c.horizon)).toBeGreaterThan(0.5); expect(Y(d) / Y(c.horizon)).toBeLessThan(2);
    void skyViewRadiance;
  });
});
