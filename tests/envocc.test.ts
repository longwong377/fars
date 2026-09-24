// Sky specular occlusion (D-157, D-181): the Frostbite cone fit at one roughness for every surface, so that sub-metre
// polish mottling does not switch the large-scale occlusion on and off (the Hadish floor's white blotches, session 6)
import { describe, it, expect } from 'vitest';
import { specularOcclusionCPU as so } from '../src/render/envmap';

describe('sky specular occlusion', () => {
  it('is 1 in the open', () => { for (const nv of [0.05, 0.5, 1]) expect(so(1, nv)).toBeCloseTo(1, 6); });
  it('does not depend on the pixel\'s roughness (the red floor\'s mottling: 0.35 ± 35 %)', () => {
    for (const vis of [0.01, 0.05, 0.11]) for (const nv of [0.05, 0.1, 0.3]) expect(so(vis, nv, 0.23)).toBe(so(vis, nv, 0.47));
  });
  it('falls to 0 at grazing angles when the visibility is a few per cent, and grows with visibility and n·v', () => {
    expect(so(0.01, 0.1)).toBe(0); expect(so(0.02, 0.1)).toBe(0); expect(so(0.02, 0.3)).toBeLessThan(0.5 * 0.02);
    expect(so(0.11, 0.08)).toBeGreaterThan(so(0.05, 0.08)); expect(so(0.05, 0.9)).toBeGreaterThan(so(0.05, 0.3));
    expect(so(0.3, 0.5)).toBeGreaterThan(0.25);
  });
});
