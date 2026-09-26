// Session 9 (WORLD_INVENTORY G4): hoarfrost at dawn on the cold clear nights, gone by mid-morning; about as many frosty
// mornings in a year as Shiraz's 44 frost days (WMO, A: src/data/climate.json frost_days), none in summer.
import { describe, it, expect } from 'vitest';
import { WeatherSystem, frostAmount } from '../src/weather/weatherState';
import climate from '../src/data/climate.json';

describe('hoarfrost (session 9)', () => {
  it('forms below 0.5 C, thinned by cloud, wind and dry air; none under rain, falling snow or snow cover', () => {
    expect(frostAmount(2, 0, 0, 60, 0, 0)).toBe(0);
    expect(frostAmount(-3, 0, 0, 60, 0, 0)).toBe(1);
    expect(frostAmount(-3, 1, 0, 60, 0, 0)).toBeCloseTo(0.2, 5);
    expect(frostAmount(-3, 0, 8, 60, 0, 0)).toBeLessThan(0.4);
    expect(frostAmount(-3, 0, 0, 20, 0, 0)).toBeCloseTo(0.35, 5);
    expect(frostAmount(-3, 0, 0, 60, 0.5, 0)).toBe(0); expect(frostAmount(-3, 0, 0, 60, 0, 0.6)).toBe(0);
  });
  it('about 44 frosty mornings a year (the WMO frost days), in Nov-Mar only; melted by 11:00', () => {
    const wmo = (climate as any).frost_days.reduce((a: number, b: number) => a + b, 0);
    for (const seed of [1, 7, 971044]) {
      const W = new WeatherSystem(seed); let mornings = 0, summer = 0, late = 0;
      for (let d = 0; d < 354; d++) { const c = W.conditions(d, 6.5), m = c.day.climMonth; if (c.frost > 0.05) { mornings++; if (m >= 3 && m <= 9) summer++; }
        if (W.conditions(d, 11).frost > 0.05) late++; }
      expect(mornings, `seed ${seed}`).toBeGreaterThan(wmo * 0.6); expect(mornings, `seed ${seed}`).toBeLessThan(wmo * 1.6);
      expect(summer).toBe(0); expect(late).toBeLessThan(mornings * 0.15);
    }
  });
});
