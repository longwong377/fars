// D-740 (s18, C12's pass): the birds' hours follow the sun through the year, not the clock
import { describe, it, expect } from 'vitest';
import { solarHour, sunHoursOfMonth, BIRDS, EQUINOX_SUN } from '../src/world/wildlife';
describe('the birds keep the sun\'s hours (D-740)', () => {
  it('a morning bound moves with sunrise and an evening bound with sunset', () => {
    const [riseJun, setJun] = sunHoursOfMonth(5), [riseDec, setDec] = sunHoursOfMonth(11);
    expect(solarHour(BIRDS.sparrow.hours[0], 5)).toBeCloseTo(BIRDS.sparrow.hours[0] + riseJun - EQUINOX_SUN[0], 6);
    expect(solarHour(BIRDS.sparrow.hours[1], 11)).toBeCloseTo(BIRDS.sparrow.hours[1] + setDec - EQUINOX_SUN[1], 6);
    // June's chorus starts earlier and its roost later than December's
    expect(solarHour(BIRDS.sparrow.hours[0], 5)).toBeLessThan(solarHour(BIRDS.sparrow.hours[0], 11) - 1);
    expect(solarHour(BIRDS.crow.hours[1], 5)).toBeGreaterThan(solarHour(BIRDS.crow.hours[1], 11) + 1.2);
    expect(riseJun).toBeLessThan(riseDec); expect(setJun).toBeGreaterThan(setDec);
  });
});
