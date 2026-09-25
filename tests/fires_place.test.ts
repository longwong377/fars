// Fire placement against the architecture (D-217; rubric s7 pass 2, R11: "a thin dark rod floating above the far door": an
// Apadana wall torch, set every 10 m from each wall's middle, stood in the middle of the N doorway 5.7 m over the floor).
import { describe, it, expect } from 'vitest';
import { buildTerrace } from '../src/arch/terrace';
import { apadanaTorches, inDoorway } from '../src/world/world';

describe('wall torches (D-217, R11)', () => {
  const { manifest, doorways } = buildTerrace() as any;
  it('no Apadana wall torch stands in a doorway; the walls keep their torches', () => {
    const t = apadanaTorches(manifest, doorways), doors = doorways.filter((d: any) => d.building === 'apadana');
    expect(doors.length).toBeGreaterThan(0);
    for (const [e, n] of t) expect(inDoorway(doorways, 'apadana', e, n), `torch at ${e.toFixed(1)}, ${n.toFixed(1)}`).toBe(false);
    // the one that floated: the N wall's middle, on the hall's axis (grid e 1.9)
    const a = manifest.apadana, [cx, cy] = a.hallCentre, hs = a.hallInterior;
    expect(inDoorway(doorways, 'apadana', cx, cy + hs / 2 - 0.4)).toBe(true);
    expect(t.some(([e, n]) => Math.abs(e - cx) < 0.5 && Math.abs(n - (cy + hs / 2 - 0.4)) < 0.5)).toBe(false);
    expect(t.length).toBeGreaterThanOrEqual(20 - doors.length); expect(t.length).toBeLessThan(20);
  });
});
