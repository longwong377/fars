// Rainbows on the rain curtains (session 9; src/world/rainShafts.ts BOW, bowWeight): the primary's red outside its blue at
// ~42°, the secondary reversed and weaker, Alexander's dark band between them, and nothing far from the bows.
import { describe, it, expect } from 'vitest';
import { bowWeight, BOW } from '../src/world/rainShafts';

describe('rainbow geometry', () => {
  it('the primary: red peaks outside blue near 42°', () => {
    const at = (c: number) => { let best = 0, th = 0; for (let t = 38; t < 46; t += 0.05) { const w = bowWeight(t)[c]; if (w > best) { best = w; th = t; } } return th; };
    expect(at(0)).toBeGreaterThan(at(2)); expect(at(0)).toBeCloseTo(42.3, 0); expect(at(2)).toBeCloseTo(40.8, 0);
  });
  it('the secondary is reversed (blue outside) and weaker than the primary', () => {
    const peak = (c: number, lo: number, hi: number) => { let best = 0, th = 0; for (let t = lo; t < hi; t += 0.05) { const w = bowWeight(t)[c]; if (w > best) { best = w; th = t; } } return { th, best }; };
    const r2 = peak(0, 48, 56), b2 = peak(2, 48, 56), r1 = peak(0, 38, 46);
    expect(b2.th).toBeGreaterThan(r2.th); expect(r2.best).toBeLessThan(0.6 * r1.best); expect(r2.best).toBeCloseTo(BOW.secondaryShare, 1);
  });
  it('Alexander\'s band (between the bows) is darker than inside the primary, and there is no bow far from them', () => {
    const lum = (t: number) => bowWeight(t).reduce((a, b) => a + b, 0);
    expect(lum(46.5)).toBeLessThan(lum(38)); expect(lum(46.5)).toBeLessThan(0.05); expect(lum(20)).toBe(0); expect(lum(39.5)).toBeGreaterThan(lum(30)); expect(lum(70)).toBeLessThan(1e-6);
  });
});
