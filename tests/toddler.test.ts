// s18 C14 (D-790, ledger u4): a toddler walks as toddlers do: wide-legged, short steps, the arms up for balance, rocking,
// and now and then plops down and gets up again; a gait without `toddler` is unchanged.
import { describe, it, expect } from 'vitest';
import { pose, GAIT0, TODDLER } from '../src/people/anim';
describe('the toddler\'s walk', () => {
  it('wider, shorter, arms up; a plop now and then; the plain walk untouched', () => {
    const a = pose('walk', 3, 1.2, 0.4), b = pose('walk', 3, 1.2, 0.4, { ...GAIT0, toddler: 1 }), c = pose('walk', 3, 1.2, 0.4, { ...GAIT0, toddler: 0 });
    expect(c).toEqual(a);
    expect(b.rot.l_thigh![2] - (a.rot.l_thigh?.[2] ?? 0)).toBeCloseTo(TODDLER.abduct); expect(Math.abs(b.rot.l_thigh![0])).toBeLessThan(Math.abs(a.rot.l_thigh![0]) + 1e-9);
    expect(b.rot.l_upper![0]).toBeLessThan(-0.6); expect(b.rot.l_upper![2]).toBeGreaterThan(0.3);
    let low = 0; for (let t = 0; t < 90; t += 0.1) low = Math.min(low, pose('walk', t, t * 5, 0.4, { ...GAIT0, toddler: 1 }).hips[1] - pose('walk', t, t * 5, 0.4).hips[1]);
    expect(low, 'sat down at least once in 90 s').toBeLessThan(-0.15);
  });
});
