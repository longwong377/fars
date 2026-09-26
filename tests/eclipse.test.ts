// The lunar eclipse of the simulated year (session 9, T-J5): the Earth's shadow on the Moon (ephemeris.ts earthShadow) agrees
// with astronomy-engine's eclipse search (contacts, depth), and the Moon is untouched away from it.
import { describe, it, expect } from 'vitest';
import * as A from 'astronomy-engine';
import { earthShadow, timeFromJD, moonHorizon, UMBRA_BRIGHTNESS } from '../src/sky/ephemeris';
import { START_JDN } from '../src/core/calendar';

const e = A.SearchLunarEclipse(timeFromJD(START_JDN - 0.5)), peak = e.peak.ut + 2451545.0;
describe('the lunar eclipse of 467 BCE (sim day 101)', () => {
  it('is the year\'s first, a deep partial eclipse, the Moon high over Persepolis', () => {
    expect(e.kind).toBe('partial'); expect(Math.floor(peak - (START_JDN - 0.5) + 52.89 / 360)).toBe(101);
    expect(e.obscuration).toBeGreaterThan(0.85); expect(moonHorizon(peak).altitude).toBeGreaterThan(30);
  });
  it('the shadow model reproduces the umbral contacts within 3 minutes and darkens the disc to < 1 % at the peak', () => {
    const inUmbra = (jd: number) => { const s = earthShadow(jd); return s.sep < s.umbra + s.moonR; };
    const step = 1 / 1440; let t = peak; while (inUmbra(t)) t -= step;
    expect(Math.abs((peak - t) * 1440 - e.sd_partial)).toBeLessThan(3);
    t = peak; while (inUmbra(t)) t += step;
    expect(Math.abs((t - peak) * 1440 - e.sd_partial)).toBeLessThan(3);
    expect(earthShadow(peak).light).toBeLessThan(0.01); expect(earthShadow(peak).light).toBeGreaterThan(UMBRA_BRIGHTNESS);
  });
  it('outside the penumbra the Moon is at full brightness', () => {
    expect(earthShadow(peak - 4 / 24).light).toBe(1); expect(earthShadow(peak + 4 / 24).light).toBe(1);
    expect(earthShadow(peak - 30).light).toBe(1);
  });
});
