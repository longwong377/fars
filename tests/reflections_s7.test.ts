// Screen-space reflections and the materials they land on (D-216; render pass 2, R3 water black or maroon, R10 mirror floors).
import { describe, it, expect } from 'vitest';
import * as THREE from 'three/webgpu';
import { reflectionClass, SSR_MAX_ROUGHNESS } from '../src/render/pipeline';
import { surfaceMaterial, SURFACES, SKY_SPECULAR_MAX_ROUGHNESS } from '../src/render/materials';
import { waterMaterial } from '../src/world/settlement/water';

/** the composite's SSR term for one pixel (pipeline.ts): the hit's radiance added, the sky environment the material
 *  reflected removed where the ray hits (only if the material reflected it: class 1), nothing on class 2 */
function ssrComposite(cls: 0 | 1 | 2, scene: number, envSpec: number, hitRefl: number, hit = 1) {
  const envMat = cls === 1 ? 1 : 0, ssrMat = cls === 2 ? 0 : 1;
  return Math.max(0, scene + (hitRefl - envSpec * envMat * hit) * ssrMat);
}

describe('reflection classes (R3)', () => {
  it('the water reflects its own sky and bank and takes no screen-space reflection', () => {
    expect(reflectionClass(waterMaterial())).toBe(2);
  });
  it('smooth surface materials reflect the sky environment; plain standard materials reflect none', () => {
    for (const k of Object.keys(SURFACES)) {
      const d = SURFACES[k], m = surfaceMaterial(k), spec = (d.metal ?? 0) > 0 || d.roughness < SKY_SPECULAR_MAX_ROUGHNESS;
      expect(reflectionClass(m), k).toBe(spec ? 1 : 0);
    }
    expect(reflectionClass(new THREE.MeshStandardNodeMaterial({ roughness: 0.2 }))).toBe(0);
    expect(reflectionClass(null)).toBe(0);
  });
  it('a pixel whose material reflected no environment is never darkened by a ray hit (the black river)', () => {
    // the Pulvar at a grazing angle: its own Fresnel sky ~0.12, the environment the composite used to remove ~0.25, the bank hit 0.03
    const water = 0.12, env = 0.25, bank = 0.03;
    expect(Math.max(0, water + bank - env)).toBe(0); // the old composite: black
    expect(ssrComposite(2, water, env, bank)).toBe(water); // the water's own reflection stands
    expect(ssrComposite(0, water, env, bank)).toBeCloseTo(water + bank, 12); // a plain smooth material: the hit adds
    expect(ssrComposite(1, water + env, env, bank)).toBeCloseTo(water + bank, 12); // an environment reflector: the hit replaces it
  });
});

describe('the red floors: traffic scuffs a painted plaster coat (R10)', () => {
  it('the worn lanes are rougher than the burnished field, and fall out of the SSR there', () => {
    const d = SURFACES.plaster_red, lane = d.roughness * (1 - 1 * d.wear!.rough);
    expect(d.wear!.rough).toBeLessThan(0);
    expect(lane).toBeGreaterThan(d.roughness);
    expect(lane).toBeGreaterThan(SSR_MAX_ROUGHNESS - 0.1); // the SSR fades out over the last 0.1 (pipeline.ts gate)
    // stone treads still polish under feet (hard limestone)
    expect(SURFACES.limestone.wear!.rough).toBeGreaterThan(0);
  });
});
