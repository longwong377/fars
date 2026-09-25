// The rain shafts (rubric pass 2, R6: "rain has no effect"). The cell for the §1.1 moment (day 299, 11:45, seen from the
// Apadana W portico looking 232°) was drawn as columns up to 12 km wide with σ = 0.00025 /m; the camera stood inside the
// 2R mesh of an offset column, so the whole sky took one even veil and no curtain showed. Now: a few shafts 1–4 km
// across inside the rain area, with the extinction of the rain rate.
import { describe, it, expect } from 'vitest';
import { WeatherSystem } from '../src/weather/weatherState';
import { azAltToWorld } from '../src/sky/ephemeris';
import { shaftLayout, rainSigma, shaftRate, shaftTau, shaftAlpha, shaftShade, skyDarkening, shaftProfile } from '../src/world/rainShafts';
import { airOptics, opticalDepth, Z0 } from '../src/sky/aerial';

describe('rain shafts', () => {
  it('extinction follows the rain rate (visibility ~2 km in 14 mm/h rain)', () => {
    expect(rainSigma(14)).toBeGreaterThan(0.0013); expect(rainSigma(14)).toBeLessThan(0.002);
    expect(rainSigma(2)).toBeLessThan(rainSigma(20));
  });
  it('at the rain-approach moment the camera is outside every shaft, and dense curtains stand inside the view', () => {
    const W = new WeatherSystem(1), cell = W.rainCell(299, 11.45)!;
    expect(cell).not.toBeNull();
    const [dx, , dz] = azAltToWorld(cell.bearingTrueDeg, 0), cx = dx * cell.distanceM, cz = dz * cell.distanceM;
    const cam = [-38, 5]; // world x, z of grid (-38, -5)
    const bearingOf = (x: number, z: number) => { let best = 0, bd = -2; const L = Math.hypot(x, z);
      for (let b = 0; b < 360; b += 0.25) { const [ux, , uz] = azAltToWorld(b, 0), c = (ux * x + uz * z) / L; if (c > bd) { bd = c; best = b; } } return best; };
    const sigma = rainSigma(shaftRate(cell.intensity)); let inView = 0;
    for (const s of shaftLayout(7)) {
      const r = cell.radiusM * s.scale, x = cx + s.off[0] * cell.radiusM, z = cz + s.off[1] * cell.radiusM;
      const d = Math.hypot(x - cam[0], z - cam[1]);
      expect(d, 'camera inside a shaft mesh').toBeGreaterThan(2 * r);
      expect(2 * r).toBeLessThan(4000); expect(2 * r).toBeGreaterThan(1000);
      const tauCore = sigma * r * Math.sqrt(Math.PI); expect(tauCore).toBeGreaterThan(1.5);
      const b = bearingOf(x - cam[0], z - cam[1]), off = Math.abs(((b - 232 + 540) % 360) - 180);
      if (off < 30) inView++;
    }
    expect(inView).toBeGreaterThanOrEqual(2);
  });
  // D-219: the v5 render measured the sky inside the shafts' mask equal to the sky beside it (212/212). The curtain's light is
  // now J·(1 − T_air(1 − k)) at opacity α, so against the sky (J) it darkens the sky by α·T_air·(1 − k)
  it('a mid-rate shaft darkens the sky behind it by at least 15 % at the rain-approach moment (the moment\'s own air)', () => {
    const W = new WeatherSystem(1), cell = W.rainCell(299, 11.45)!, c = W.conditions(299, 11.45);
    const o = airOptics({ haze: c.haze, dust: c.dust, mist: c.mist, rain: c.rain, snow: c.snowFall });
    const [dx, , dz] = azAltToWorld(cell.bearingTrueDeg, 0), cx = dx * cell.distanceM, cz = dz * cell.distanceM;
    const sigma = rainSigma(8); // a mid rate (8 mm/h), not the cell's 19 mm/h
    const dark: number[] = [];
    for (const s of shaftLayout(7)) {
      const r = cell.radiusM * s.scale, x = cx + s.off[0] * cell.radiusM, z = cz + s.off[1] * cell.radiusM, d = Math.hypot(x + 38, z - 5);
      const tAir = Math.exp(-opticalDepth(o, Z0 + 40, Z0 + 40, d)[1]);
      const a = shaftAlpha(shaftTau(sigma * r * Math.sqrt(Math.PI), 1), 0.4, false);
      dark.push(skyDarkening(a, tAir, shaftShade(0.4, false)));
    }
    expect(dark.filter(x => x >= 0.15).length, dark.map(x => x.toFixed(2)).join(' ')).toBeGreaterThanOrEqual(3);
    expect(Math.max(...dark)).toBeLessThan(0.6); // a curtain, not a black wall (T_air carries the air of 6–13 km)
  });
  it('the curtain has a density gradient: dense over the lower two thirds, into the cloud base at the top, soft at the column edge', () => {
    expect(shaftProfile(0.3)).toBe(1); expect(shaftProfile(0.95)).toBeLessThan(0.2); expect(shaftProfile(1)).toBe(0);
    expect(shaftShade(0.9, false)).toBeLessThan(shaftShade(0.1, false)); // darker under the cloud base
    const tc = rainSigma(8) * 1100 * Math.sqrt(Math.PI);
    expect(shaftAlpha(shaftTau(tc, 1), 0.4, false)).toBeGreaterThan(0.8); // through the core
    expect(shaftAlpha(shaftTau(tc, Math.cos(Math.PI / 3)), 0.4, false)).toBeLessThan(0.4); // 1.7 R off the axis
  });
});
