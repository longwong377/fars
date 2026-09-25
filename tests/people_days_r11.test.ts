// Phase 5 shadow review round 9 (REVIEWS/shadow_phase5_r9.md A S1, _r9_b.md B S1; D-213): a detailed agent kept the water
// jar on his head when his plan took him off the Terrace (guard #76 on Nisanu 9 carried it to the craftsmen's quarter and
// back; 1,105 of ~4,400 guard water-duty days). The load is now set down before an off-Terrace block (sim.ts setDown).
import { describe, it, expect } from 'vitest';
import { detailedDay } from '../tools/shadow_days';

describe('r9 S1: no load carried off the Terrace', () => {
  it('guard #76 on Nisanu 9 (index 8): the jar ends at the hearth; nothing carried after it', () => {
    const { log } = detailedDay(1, 76, 8);
    const i = log.findIndex(l => /carry_jar_head/.test(l)); expect(i).toBeGreaterThan(-1);
    const after = log.slice(i).filter(l => !/carry_jar_head/.test(l));
    expect(after.filter(l => /\[carrying a jar of water on the head\]/.test(l))).toEqual([]);
  }, 300_000);
});
