// Droppings and sherds on the roads (session 10; gap hunter C, C-F08, C-F09; src/world/roadLitter.ts): near the viewer only,
// on the road's band, more on a busier road and at a halt, the same every time for the same place (hashed, not random).
import { describe, it, expect } from 'vitest';
import { RoadLitter, LITTER_R } from '../src/world/roadLitter';

const road = (use: number) => ({ id: 'r', pts: [[-500, 0], [500, 0]] as [number, number][], width: 8, use });
describe('road litter', () => {
  it('lies on the road within reach, denser on a busier road and at a halt, deterministic', () => {
    const A = new RoadLitter(1, [road(1)], () => 0), B = new RoadLitter(1, [road(0.3)], () => 0), H = new RoadLitter(1, [road(1)], () => 0, [[0, 20]]);
    expect(A.update([0, 0])).toBe(true); B.update([0, 0]); H.update([0, 0]);
    expect(A.count).toBeGreaterThan(15); expect(A.count).toBeGreaterThan(B.count * 1.8); expect(H.count).toBeGreaterThan(A.count + 30);
    const pos = A.mesh.geometry.getAttribute('fpos');
    for (let i = 0; i < A.count; i++) { const e = pos.getX(i), n = -pos.getZ(i); expect(Math.hypot(e, n)).toBeLessThanOrEqual(LITTER_R + 1e-6); expect(Math.abs(n)).toBeLessThanOrEqual(4.5); }
    const A2 = new RoadLitter(1, [road(1)], () => 0); A2.update([0, 0]); expect(A2.count).toBe(A.count);
    expect(A.update([1, 0])).toBe(false); // (rebuilt only after 3 m)
    const far = new RoadLitter(1, [road(1)], () => 0); far.update([0, 200]); expect(far.count).toBe(0);
  });
});
