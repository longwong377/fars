import { describe, it, expect } from 'vitest';
import { rt60 } from '../src/audio/engine';
import { SPACES, BIRDS } from '../src/audio/soundscape';
describe('acoustics and fauna schedule', () => {
  it('Sabine RT60: open air ≈ 0; the Apadana hall is several seconds (C absorption), the Gate shorter', () => {
    expect(rt60(SPACES.open)).toBeLessThan(0.5);
    expect(rt60(SPACES.apadana)).toBeGreaterThan(3); expect(rt60(SPACES.apadana)).toBeLessThan(10);
    expect(rt60(SPACES.gate)).toBeLessThan(rt60(SPACES.apadana));
  });
  it('bee-eaters are summer visitors only; jackals call at night only', () => {
    const be = BIRDS.find(b => b.id === 'bee-eater')!; expect(be.months).not.toContain(0); expect(be.months).toContain(5);
    const j = BIRDS.find(b => b.id === 'golden jackal')!; expect(j.hours.every(([a, z]) => a >= 19 || z <= 5)).toBe(true);
  });
});
