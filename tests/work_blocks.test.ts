// The masons' blocks (D-217; rubric s7 pass 2, R8: "two dark grey boxes" in hall100-site were these blocks, drawn as flat
// vertex-coloured boxes in the props' material). Now quarry-rough limestone: faces bulged, the top dressed flat.
import { describe, it, expect } from 'vitest';
import * as THREE from 'three/webgpu';
import { masonBlock } from '../src/people/crowd';

describe('masons\' blocks (D-217, R8)', () => {
  it('1.4 × 0.75 × 0.9 m on the ground, the sides bulged by up to 3 cm, the top flat', () => {
    const g = masonBlock(7); g.computeBoundingBox(); const b = g.boundingBox!;
    expect(b.min.y).toBeCloseTo(0, 6); expect(b.max.y).toBeCloseTo(0.75, 6);
    expect(b.max.x - b.min.x).toBeGreaterThan(1.4); expect(b.max.x - b.min.x).toBeLessThan(1.4 + 0.09);
    expect(b.max.z - b.min.z).toBeGreaterThan(0.9); expect(b.max.z - b.min.z).toBeLessThan(0.9 + 0.09);
    const p = g.getAttribute('position'); let top = 0, sides = new Set<number>();
    for (let i = 0; i < p.count; i++) { if (Math.abs(p.getY(i) - 0.75) < 1e-6) top++; if (Math.abs(Math.abs(p.getX(i)) - 0.7) > 1e-4 && Math.abs(Math.abs(p.getX(i)) - 0.7) < 0.05) sides.add(+p.getX(i).toFixed(4)); }
    expect(top).toBeGreaterThan(0); expect(sides.size, 'the ends are not planes').toBeGreaterThan(3);
    expect(masonBlock(8).getAttribute('position').array).not.toEqual(g.getAttribute('position').array);
    void THREE;
  });
});
