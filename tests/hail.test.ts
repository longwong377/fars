// Session 9 (WORLD_INVENTORY G9): hail opening some spring thunderstorms, the stones lying white and melting.
import { describe, it, expect } from 'vitest';
import { WeatherSystem } from '../src/weather/weatherState';

describe('hail (session 9)', () => {
  it('a few hail days a year, all in Feb-May thunderstorms; hail falls only at the storm\'s start and the stones melt within the hour', () => {
    let days = 0;
    for (const seed of [1, 7, 971044]) { const W = new WeatherSystem(seed);
      for (let d = 0; d < 354; d++) { let hailH: number[] = [], coverAt: [number, number][] = [];
        for (let h = 0; h < 24; h += 1 / 30) { const c = W.conditions(d, h); if (c.hail > 0) hailH.push(h); coverAt.push([h, c.hailCover]); }
        if (!hailH.length) { expect(coverAt.every(([, v]) => v === 0)).toBe(true); continue; }
        days++; const c0 = W.conditions(d, 12).day; expect(c0.thunder).toBe(true); expect(c0.climMonth).toBeGreaterThanOrEqual(1); expect(c0.climMonth).toBeLessThanOrEqual(4);
        expect(Math.max(...hailH) - Math.min(...hailH)).toBeLessThanOrEqual(0.26);
        const end = Math.max(...hailH); expect(coverAt.filter(([h, v]) => h > end + 0.8 && v > 0).length).toBe(0); expect(Math.max(...coverAt.map(([, v]) => v))).toBeGreaterThan(0.5); } }
    expect(days / 3).toBeGreaterThan(0.5); expect(days / 3).toBeLessThan(8);
  });
  it('the fixed weathers of the tests carry no hail', () => { const W = new WeatherSystem(1); (W as any).override = 'clear'; for (let d = 0; d < 354; d += 3) expect(W.conditions(d, 14).hail).toBe(0); });
});
