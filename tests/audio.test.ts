import { describe, it, expect } from 'vitest';
import { rt60 } from '../src/audio/engine';
import { SPACES, BIRDS, registerRoom } from '../src/audio/soundscape';
import { buildTerrace } from '../src/arch/terrace';
describe('acoustics and fauna schedule', () => {
  // the roofed halls register their spaces from the generator's measured room boxes (as world.ts does)
  for (const [id, m] of Object.entries(buildTerrace().manifest)) if (Array.isArray((m as any).room)) { const r = (m as any).room as number[]; registerRoom(id, r[2], r[3], r[5]); }
  it('Sabine RT60: open air ≈ 0; the Apadana hall is several seconds (C absorption), the Gate and the smaller palaces shorter', () => {
    expect(rt60(SPACES.open)).toBeLessThan(0.5);
    expect(rt60(SPACES.apadana)).toBeGreaterThan(3); expect(rt60(SPACES.apadana)).toBeLessThan(10);
    expect(rt60(SPACES.gate_nations)).toBeLessThan(rt60(SPACES.apadana));
    for (const id of ['tachara', 'hadish', 'harem']) { expect(rt60(SPACES[id])).toBeGreaterThan(0.5); expect(rt60(SPACES[id])).toBeLessThan(rt60(SPACES.apadana)); }
  });
  it('bee-eaters are summer visitors only; jackals call at night only', () => {
    const be = BIRDS.find(b => b.id === 'bee-eater')!; expect(be.months).not.toContain(0); expect(be.months).toContain(5);
    const j = BIRDS.find(b => b.id === 'golden jackal')!; expect(j.hours.every(([a, z]) => a >= 19 || z <= 5)).toBe(true);
  });
});
