// D-695: the visitor's footprints: a print each stride on earth, alternating sides, none on the Terrace's paving, none for a teleport
import { describe, it, expect } from 'vitest';
import { Prints, PRINT_STRIDE, PRINT_N } from '../src/player/prints';
describe('the visitor’s footprints (D-695)', () => {
  it('a print each stride in a town lane, none on the Terrace, none across a teleport, the pool reused', () => {
    const P = new Prints(); let t = 0;
    for (let i = 0; i <= 100; i++) P.step({ x: -478 + i * 0.1, y: -18 + 0.85, z: 881 }, t += 0.074); // 10 m at 1.35 m/s
    expect(P.pressed).toBeGreaterThanOrEqual(Math.floor(10 / PRINT_STRIDE) - 1); expect(P.pressed).toBeLessThanOrEqual(Math.ceil(10 / PRINT_STRIDE) + 1);
    const before = P.pressed; P.step({ x: 50, y: 0.85, z: 0 }, t += 0.1); for (let i = 0; i <= 50; i++) P.step({ x: 50 + i * 0.1, y: 0.85, z: 0 }, t += 0.074);
    expect(P.pressed, 'the Terrace court: paved').toBe(before);
    for (let i = 0; i < 2000; i++) P.step({ x: -600 + i * 0.7, y: 0.85, z: 2000 }, t += 0.5);
    expect(P.mesh.count).toBe(PRINT_N);
  });
});
