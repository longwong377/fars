// s18 C14 (D-790, ledger u4): a toddler walks as toddlers do: wide-legged, short steps, the arms up for balance, rocking,
// and now and then plops down and gets up again; a gait without `toddler` is unchanged.
import { describe, it, expect } from 'vitest';
import { pose, toddle, GAIT0, TODDLER } from '../src/people/anim';
describe('the toddler\'s walk', () => {
  it('wider, shorter, arms up; a plop now and then; the plain walk untouched', () => {
    const a = pose('walk', 3, 1.2, 0.4), b = pose('walk', 3, 1.2, 0.4, { ...GAIT0, toddler: 1 }), c = pose('walk', 3, 1.2, 0.4, { ...GAIT0, toddler: 0 });
    expect(c).toEqual(a);
    expect(b.rot.l_thigh![2] - (a.rot.l_thigh?.[2] ?? 0)).toBeCloseTo(TODDLER.abduct); expect(Math.abs(b.rot.l_thigh![0])).toBeLessThan(Math.abs(a.rot.l_thigh![0]) + 1e-9);
    expect(b.rot.l_upper![0]).toBeLessThan(-0.6); expect(b.rot.l_upper![2]).toBeGreaterThan(0.3);
    let low = 0, lowW = 0; for (let t = 0; t < 90; t += 0.1) { const q = pose('walk', t, t * 5, 0.4); const y0 = q.hips[1]; toddle(q, t, t * 5, 0.4, 1, true); low = Math.min(low, q.hips[1] - y0); lowW = Math.min(lowW, pose('walk', t, t * 5, 0.4, { ...GAIT0, toddler: 1 }).hips[1] - y0); }
    expect(low, 'held in place, sat down at least once in 90 s').toBeLessThan(-0.15); expect(lowW, 'walking, never slides along seated').toBeGreaterThan(-0.05);
  });
});
describe('the bit, for reins and lead ropes (s18 C14)', () => {
  it('sits at the head, ahead of the body, low when grazing, turned with the animal', async () => {
    const { bitAt, ANIMAL_BUILD } = await import('../src/people/animals');
    const a = { sp: 'horse' as const, x: 0, z: 0, yaw: 0, phase: 0, walk: 0, graze: 0, lie: 0, coat: 0.5 };
    const up = bitAt(a, 0), down = bitAt({ ...a, graze: 1 }, 0), turned = bitAt({ ...a, yaw: Math.PI / 2 }, 0), B = ANIMAL_BUILD.horse;
    expect(up[2]).toBeGreaterThan(0.3 * B.len); expect(up[1]).toBeGreaterThan(0.8 * B.h); expect(down[1]).toBeLessThan(0.35);
    expect(turned[0]).toBeCloseTo(up[2], 3); expect(Math.abs(turned[2])).toBeLessThan(0.05);
  });
});
