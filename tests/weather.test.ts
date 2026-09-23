import { describe, it, expect } from 'vitest';
import { generateYear } from '../src/weather/generator';
import { monthly } from '../src/weather/climate';
import { START_JDN, YEAR_END_JDN } from '../src/core/calendar';

const DAYS = YEAR_END_JDN - START_JDN + 1;
function stats(seed: number) {
  const y = generateYear(seed, START_JDN, DAYS);
  const t = Array(12).fill(0), n = Array(12).fill(0), wet = Array(12).fill(0);
  for (const d of y) { t[d.climMonth] += (d.tmax + d.tmin) / 2; n[d.climMonth]++; if (d.wet) wet[d.climMonth]++; }
  return { y, t: t.map((s, i) => s / n[i]), n, wet };
}

describe('weather generator (§13.6)', () => {
  it('is deterministic in the seed', () => {
    const a = generateYear(1, START_JDN, 60), b = generateYear(1, START_JDN, 60), c = generateYear(2, START_JDN, 60);
    expect(a).toEqual(b); expect(a).not.toEqual(c);
  });
  it('simulated year (WORLD_SEED=1) monthly mean temperatures within ±1 °C of the climate target', () => {
    const s = stats(1);
    const errs = s.t.map((v, m) => (s.n[m] ? v - monthly(m).tmean : 0));
    console.log('monthly Tmean error °C:', errs.map(e => e.toFixed(2)).join(' '));
    for (let m = 0; m < 12; m++) if (s.n[m] >= 20) expect(Math.abs(errs[m])).toBeLessThanOrEqual(1.0);
  });
  it('holds for other seeds too (robustness, 10 seeds)', () => {
    for (let seed = 2; seed < 12; seed++) {
      const s = stats(seed);
      for (let m = 0; m < 12; m++) if (s.n[m] >= 20) expect(Math.abs(s.t[m] - monthly(m).tmean)).toBeLessThanOrEqual(1.0);
    }
  });
  it('precipitation-day count: simulated year within ±20% of the annual climate target; 50-year monthly climatology within ±20% for months with ≥3 wet days', () => {
    const target = Array.from({ length: 12 }, (_, m) => monthly(m).precipDays);
    const annualTarget = target.reduce((a, b) => a + b, 0) * DAYS / 365.25;
    const s1 = stats(1);
    const annual = s1.wet.reduce((a, b) => a + b, 0);
    console.log('wet days seed 1:', annual, 'target', annualTarget.toFixed(1));
    expect(Math.abs(annual - annualTarget) / annualTarget).toBeLessThanOrEqual(0.2);
    const acc = Array(12).fill(0), accN = Array(12).fill(0);
    for (let seed = 1; seed <= 50; seed++) { const s = stats(seed); for (let m = 0; m < 12; m++) { acc[m] += s.wet[m]; accN[m] += s.n[m]; } }
    for (let m = 0; m < 12; m++) {
      if (target[m] < 3) continue;
      const perMonth = acc[m] / accN[m] * [31, 28.25, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31][m];
      expect(Math.abs(perMonth - target[m]) / target[m]).toBeLessThanOrEqual(0.2);
    }
  });
});

describe('rain cell timeline (distant rain shafts, §1.1 rain moment)', () => {
  it('a cell approaches from upwind at the steering wind speed, is overhead during the episode, and recedes downwind', async () => {
    const { WeatherSystem } = await import('../src/weather/weatherState');
    const W = new WeatherSystem(1); const i = W.days.findIndex((d, k) => d.wet && !d.snow && (W as any).rainWindows[k][0] > 2 && (W as any).rainWindows[k][1] < 21);
    const [rs, re] = (W as any).rainWindows[i]; const d = W.days[i];
    const a = W.rainCell(i, rs - 1)!, b = W.rainCell(i, rs - 0.5)!, mid = W.rainCell(i, (rs + re) / 2)!, after = W.rainCell(i, re + 0.5)!;
    expect(a.distanceM).toBeGreaterThan(b.distanceM); expect(b.distanceM).toBeGreaterThan(0);
    expect(a.bearingTrueDeg).toBeCloseTo(d.windDirDeg, 6); // from where the wind blows
    expect(Math.abs(a.distanceM - 2 * b.distanceM)).toBeLessThan(1); // constant speed
    expect(mid.distanceM).toBe(0);
    expect(after.bearingTrueDeg).toBeCloseTo((d.windDirDeg + 180) % 360, 6);
    W.override = 'rain'; expect(W.rainCell(i, rs - 1)).toBeNull();
  });
});
