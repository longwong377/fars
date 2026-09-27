// D-309b: the outdoor sky visibility from the built world's height map (src/render/skyVis.ts) is wired into the composite,
// renders AFTER the frame (the sun's CSM keeps the first camera that renders the scene: a top-down first render made every
// cascade 166 mm a texel on the probe), and adds no sampler to any material (B122): it lives in the post pass only.
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { SKYVIS, bounceRatio } from '../src/render/skyVis';
describe('sky visibility field (D-309b)', () => {
  const p = readFileSync('src/render/pipeline.ts', 'utf8');
  it('the composite multiplies the SSGI AO by the visibility (with the occluders light) outside the probe volumes', () => {
    expect(p).toContain('mix(visE, float(1), w)'); expect(p).toContain('ao0.mul(mix(float(1), visW, this.ab.skyvis))');
    expect(p).toContain('min(sky.mul(float(1).sub(aoL)), col.rgb.mul'); // never below col·ao: no black shade (D-309c)
  });
  it('D-309c: sunlit occluders outshine the sky at midday, darken it at dusk/overcast', () => {
    expect(bounceRatio(6)).toBeGreaterThan(1); expect(bounceRatio(0)).toBe(SKYVIS.B_MIN); expect(bounceRatio(100)).toBe(SKYVIS.B_MAX);
  });
  it('the height map renders after the frame, never first', () => {
    expect(p.indexOf('this.rp.render(); else')).toBeLessThan(p.indexOf('this.skyVis.update('));
  });
  it('the map covers the lanes at a useful texel and the march reaches 24 m', () => {
    expect(SKYVIS.EXTENT / SKYVIS.SIZE).toBeLessThanOrEqual(0.25); expect(Math.max(...SKYVIS.STEPS)).toBeGreaterThanOrEqual(24);
    expect(readFileSync('src/render/skyVis.ts', 'utf8')).not.toMatch(/materials|surfaceMaterial/); // not in any material
  });
});
