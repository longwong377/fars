// D-364: the merlons' modelled near level (src/arch/decor.ts MerlonNear): within MERLON_NEAR of the view camera an instance is drawn
// by the near level and not by the far one (never both, never neither); a shadow (orthographic) camera switches nothing.
import { describe, it, expect } from 'vitest';
import * as THREE from 'three/webgpu';
import { buildTerrace } from '../src/arch/terrace';
import { buildStairCrenellations, stairCrenellationPlan, MerlonNear, MERLON_NEAR } from '../src/arch/decor';
import { setDecorForTest } from '../src/render/decorAssets';

describe('D-364 merlon near level', () => {
  it('splits the instances by distance, every instance drawn once', () => {
    const map = new THREE.DataTexture(new Uint8Array(64).fill(128), 4, 4);
    const box = (s: number) => new THREE.BoxGeometry(0.9 * s, 0.9, 0.45).translate(0, 0.45, 0.225);
    setDecorForTest({ merlon: { lods: [box(1), box(1.01)], maps: [map, map], names: ['lod0', 'lod1'] } });
    try {
      const { parts } = buildTerrace(), plan = stairCrenellationPlan(parts), far = buildStairCrenellations(parts)!;
      const near = far.children.find(c => c instanceof MerlonNear) as MerlonNear; expect(near).toBeDefined();
      const q = plan[10], cam = new THREE.PerspectiveCamera(); cam.position.set(q.c[0], q.y + 1.6, -q.c[1] + 2); cam.updateMatrixWorld();
      near.update(cam);
      expect(far.count + near.near.count).toBe(plan.length); expect(near.near.count).toBeGreaterThan(0); expect(near.near.count).toBeLessThan(plan.length / 3);
      // the near ones are within reach of the eye
      const m = new THREE.Matrix4(), p = new THREE.Vector3();
      for (let i = 0; i < near.near.count; i++) { near.near.getMatrixAt(i, m); p.setFromMatrixPosition(m); expect(p.distanceTo(cam.position)).toBeLessThan(MERLON_NEAR + 3); }
      const n0 = near.near.count, sh = new THREE.OrthographicCamera(); sh.position.set(0, 500, 0); sh.updateMatrixWorld(); near.update(sh); expect(near.near.count).toBe(n0);
      cam.position.set(1e4, 0, 0); cam.updateMatrixWorld(); near.update(cam); expect(near.near.count).toBe(0); expect(far.count).toBe(plan.length);
    } finally { setDecorForTest(null); }
  });
});
