// D-363 hook (T-E15's "the day's wardrobe choice shown"): looks.LookInput.outfit (wardrobe/world.ts outfitAt's garments)
// replaces the seeded dye, fading and soil of its slots, and a person without it looks exactly as before.
import { describe, it, expect, beforeAll } from 'vitest';
import { loadA } from '../tools/dev/body_variety';
import { lookFor, type LookInput } from '../src/people/looks';
import type { HumanAssets } from '../src/people/humanAssets';

let A: HumanAssets; beforeAll(() => { A = loadA(); }, 120_000);
const base: LookInput = { id: 7, sex: 'f', role: 'weaver', dress: 'woman', seed: 4242, life: { ageYears: 30 } };

describe('the day\'s outfit on the look', () => {
  it('no outfit: unchanged; an outfit: its dye, dirt and wear shown, the best set stronger than the work set', () => {
    const a = lookFor(A, base, 1), b = lookFor(A, { ...base }, 1);
    expect(b.col.main).toEqual(a.col.main);
    const g = (dirt: number, wear: number) => [{ slot: 'body', dye: 'woad', dirt, wear }, { slot: 'legs', dye: 'madder', dirt, wear }];
    const work = lookFor(A, { ...base, outfit: { set: 'work', garments: g(0.7, 0.6) } }, 1), best = lookFor(A, { ...base, outfit: { set: 'best', garments: g(0.02, 0.05) } }, 1);
    expect(work.wear.soil).toBeCloseTo(0.7, 5); expect(work.wear.fade).toBeCloseTo(0.6, 5);
    expect(best.wear.soil).toBeLessThan(work.wear.soil);
    // woad is blue: the blue channel leads; the best (new, strong) is more saturated than the worn work garment
    for (const L of [work, best]) expect(L.col.main[2]).toBeGreaterThan(L.col.main[0]);
    const sat = (c: number[]) => Math.max(...c) - Math.min(...c);
    expect(sat(best.col.main)).toBeGreaterThan(sat(work.col.main));
    // the body is the person's, whatever they wear
    expect(work.body!.girth).toEqual(a.body!.girth);
  });
});
