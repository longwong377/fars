// Session 9 (WORLD_INVENTORY G10): the 22 deg halo and sun dogs on cirrus days.
import { describe, it, expect } from 'vitest';
import { haloAmount, parhelionDistance, ringProfile, HALO_R, HALO_DAY_SHARE } from '../src/sky/halo';
import { WeatherSystem } from '../src/weather/weatherState';

describe('the 22 deg halo and the sun dogs (session 9)', () => {
  it('the ring is at the ice prism minimum deviation, red inside; sharp inside and slow outside', () => {
    expect(HALO_R.r).toBeGreaterThan(21.7); expect(HALO_R.b).toBeLessThan(22.7); expect(HALO_R.r).toBeLessThan(HALO_R.b);
    expect(ringProfile(22, 22)).toBe(1); expect(ringProfile(21.3, 22)).toBeLessThan(0.05); expect(ringProfile(23.5, 22)).toBeGreaterThan(0.3);
  });
  it('the sun dogs move out as the sun climbs: 22 deg at the horizon, ~23.5 at 20 deg, ~29 at 40 deg', () => {
    expect(parhelionDistance(0)).toBe(22); expect(parhelionDistance(20)).toBeCloseTo(23.8, 0); expect(parhelionDistance(40)).toBeGreaterThan(28); expect(parhelionDistance(40)).toBeLessThan(30);
  });
  it('only with thin broken dry cover and the sun up, on a share of such days; a year holds tens of halo days', () => {
    expect(haloAmount(1, 3, 0.05, 0, 30)).toBe(0); expect(haloAmount(1, 3, 0.9, 0, 30)).toBe(0); expect(haloAmount(1, 3, 0.3, 0.5, 30)).toBe(0); expect(haloAmount(1, 3, 0.3, 0, -2)).toBe(0);
    let on = 0; for (let d = 0; d < 1000; d++) if (haloAmount(1, d, 0.3, 0, 30) > 0) on++; expect(Math.abs(on / 1000 - HALO_DAY_SHARE)).toBeLessThan(0.05);
    const W = new WeatherSystem(1); let days = 0; for (let d = 0; d < 354; d++) if ([9, 12, 15].some(h => { const c = W.conditions(d, h); return haloAmount(1, d, c.cloud, c.rain, 30) > 0.05; })) days++;
    expect(days).toBeGreaterThan(20); expect(days).toBeLessThan(120);
  });
});
