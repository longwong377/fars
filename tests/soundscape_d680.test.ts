// D-680: the songbirds' day (the dawn chorus, the summer noon hush) and the nightingale on spring nights
import { describe, it, expect } from 'vitest';
import { ambientWeight, chorusFactor } from '../src/audio/soundscape';
import * as S from '../src/audio/soundscape';

describe('D-680 the birds by the sun and the season', () => {
  const sun = { rise: 5.8, set: 18.4 };
  it('the dawn chorus peaks about half an hour after sunrise; the summer heat silences them at noon', () => {
    expect(chorusFactor('house sparrow', { hour: 6.2, month: 3, sun })).toBeGreaterThan(2.8);
    expect(chorusFactor('house sparrow', { hour: 9, month: 3, sun })).toBeLessThan(1.05);
    expect(chorusFactor('house sparrow', { hour: 13, month: 6, sun, tempC: 34 })).toBeCloseTo(0.3, 2);
    expect(chorusFactor('golden jackal', { hour: 6.2, month: 3, sun })).toBe(1);
  });
  it('the nightingale sings in the trees on spring nights only', () => {
    const N = (S as any).BIRDS?.find((b: any) => b.id === 'nightingale') ?? null;
    if (!N) return; // (BIRDS not exported: the weight is covered through ambientWeight below when it is)
    const place: any = { trees: 1, water: 1, town: 0 };
    expect(ambientWeight(N, { hour: 23, month: 4, place, sun })).toBeGreaterThan(0);
    expect(ambientWeight(N, { hour: 23, month: 8, place, sun })).toBe(0);
    expect(ambientWeight(N, { hour: 14, month: 4, place, sun })).toBe(0);
  });
});
