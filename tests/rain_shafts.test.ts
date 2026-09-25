// The rain shafts (rubric pass 2, R6: "rain has no effect"). The cell for the §1.1 moment (day 299, 11:45, seen from the
// Apadana W portico looking 232°) was drawn as columns up to 12 km wide with σ = 0.00025 /m; the camera stood inside the
// 2R mesh of an offset column, so the whole sky took one even veil and no curtain showed. Now: a few shafts 1–4 km
// across inside the rain area, with the extinction of the rain rate.
import { describe, it, expect } from 'vitest';
import { WeatherSystem } from '../src/weather/weatherState';
import { azAltToWorld } from '../src/sky/ephemeris';
import { shaftLayout, rainSigma, shaftRate } from '../src/world/rainShafts';

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
});
