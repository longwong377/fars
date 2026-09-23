import { describe, it, expect } from 'vitest';
import * as THREE from 'three/webgpu';
import { sunNormalLux, sunHorizontalLux, skyLux, moonLux, NIGHT_LUX, SKY_LUX_REF, extinctionK } from '../src/sky/illuminance';
import { SkySystem } from '../src/sky/skySystem';
import { WorldClock } from '../src/core/clock';

// D-115: light levels from USNO Circular 171 (Janiczek & DeYoung 1987, a fit to Brown 1952), checked against published
// values that do not come from that fit (SX: search extracts; see research/SOURCES.md), within a factor of 2.
const within2 = (v: number, ref: number) => v / ref > 0.5 && v / ref < 2;
const total = (h: number) => sunHorizontalLux(h) + skyLux(h);

describe('clear-sky illuminance vs sun altitude (USNO-C171)', () => {
  it('matches independently published clear-sky values within a factor of 2', () => {
    expect(total(0), 'sunrise/sunset on a clear day ≈ 400 lx (Lux table, SX)').toBeGreaterThan(400 / 2);
    expect(total(0), 'Brown 1952 / Schlyter ≈ 750 lx').toBeLessThan(750 * 2);
    expect(within2(skyLux(-6), 3.4), `end of civil twilight 3.4 lx; got ${skyLux(-6).toFixed(2)}`).toBe(true);
    expect(within2(skyLux(-6), 3.2), 'the "twilight envelope" 3.2 lx (visualexpert, SX)').toBe(true);
    expect(NIGHT_LUX, 'moonless clear night with airglow ≈ 0.002 lx (SX): the starlight floor is not above it').toBeLessThanOrEqual(0.002);
    // the zenith sun: the highest measured clear-sky illuminance in Iran is 129 klx (Iranian clear-sky study, SX)
    expect(within2(total(90), 129000)).toBe(true);
    // the full moon high in a clear sky: 0.05–0.3 lx (Lux table, SX); 0.27–1.0 lx (another extract)
    const fm = moonLux(180, 50); expect(fm.normal * Math.sin((50 * Math.PI) / 180) + fm.sky).toBeGreaterThan(0.05 / 2);
    expect(fm.normal * Math.sin((50 * Math.PI) / 180) + fm.sky).toBeLessThan(1.0 * 2);
  });
  it('diffuse skylight keeps the measured ratios to noon: ~1/30 at sunrise, ~1/5000 at the end of civil twilight', () => {
    // the ratios stated in the twilight brief (measured clear-sky diffuse illuminance); noon = the sun at 70° (spring)
    const noon = skyLux(70);
    expect(within2(skyLux(0) / noon, 1 / 30), `sunrise ratio 1/${(noon / skyLux(0)).toFixed(0)}`).toBe(true);
    expect(within2(skyLux(-6) / noon, 1 / 5000), `civil-twilight ratio 1/${(noon / skyLux(-6)).toFixed(0)}`).toBe(true);
    // monotone through the horizon: no ramp, no floor
    let prev = 0; for (let h = -18; h <= 90; h += 0.5) { const v = skyLux(h); expect(v).toBeGreaterThanOrEqual(prev); prev = v; }
  });
  it('the direct beam follows Beer–Lambert with an independent air mass (Kasten–Young) within a factor of 2 above 2°', () => {
    for (const h of [2, 5, 10, 30, 60]) {
      const ky = 1 / (Math.sin((h * Math.PI) / 180) + 0.50572 * Math.pow(h + 6.07995, -1.6364));
      const ref = 133775 * Math.exp(-0.21 * ky);
      expect(within2(sunNormalLux(h), ref), `sun ${h}°`).toBe(true);
    }
    expect(sunNormalLux(-1.5)).toBe(0);
  });
});

describe('the renderer\'s lights keep the USNO ratios to noon (D-115)', () => {
  const sky = new SkySystem(new THREE.Scene(), 256, 'test');
  const at = (day: number, hour: number, haze = 0.25) => {
    sky.update(new WorldClock(day, hour).jdUT, new THREE.Vector3(), 0.05, haze, { ms: 2, fromDeg: 270, tSeconds: 0 }, new THREE.Vector3(1, 0, 0));
    return { alt: sky.state.sunAlt, sun: sky.sun.intensity / sky.gain, hemi: sky.hemi.intensity / sky.gain, gain: sky.gain };
  };
  it('noon keeps the session-3 values; twilight skylight falls with the measured ratios', () => {
    const noon = at(80, 12); // day 80 (early July), the sun ~80°
    expect(noon.gain).toBe(1);
    // session-3 values at this altitude: sun 3.2·exp(−0.18(1+haze)·m), skylight 0.98·(1 − 0.3·cloud)
    const m = 1 / Math.sin((noon.alt * Math.PI) / 180);
    expect(noon.sun / (3.2 * Math.exp(-0.18 * 1.25 * m) * (1 - 0.75 * 0.05))).toBeCloseTo(1, 1);
    expect(within2(noon.hemi, 0.98 * (1 - 0.3 * 0.05))).toBe(true);
    const cases: [number, number][] = [[0, 5.65], [0, 5.4], [0, 5.25], [0, 18.9]]; // sun ≈ +0.2°, −2.9°, −4.8°, −7°
    for (const [d, h] of cases) {
      const t = at(d, h);
      const ref = skyLux(t.alt) / skyLux(noon.alt);
      expect(within2(t.hemi / noon.hemi, ref), `skylight at ${t.alt.toFixed(1)}°`).toBe(true);
      if (t.alt > 1) expect(within2(t.sun / noon.sun, sunNormalLux(t.alt, extinctionK(0.25)) / sunNormalLux(noon.alt, extinctionK(0.25)))).toBe(true);
    }
    // the session-3 skylight ramp gave 79 % of noon at sunrise and 37 % at −6°; now ~1/20 and ~1/4000
    const sr = at(0, 5.6), c6 = at(0, 18.87);
    expect(sr.hemi / noon.hemi).toBeLessThan(0.1);
    expect(c6.hemi / noon.hemi).toBeLessThan(1 / 1000);
    expect(SKY_LUX_REF).toBeGreaterThan(14000);
  });
});
