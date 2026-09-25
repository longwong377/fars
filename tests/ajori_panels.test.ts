// Tol-e Ajori glazed panels (render pass 2): every panel triangle faces the way its normal attribute points. With the
// panels double-sided, the quads wound against their normal had it flipped into the wall and rendered black.
import { describe, it, expect } from 'vitest';
import * as THREE from 'three/webgpu';
import { buildAjori } from '../src/world/settlement/ajori';
import { buildTownPlan } from '../src/world/settlement/plan';

describe('Tol-e Ajori glazed panels', () => {
  it('wind every triangle to its normal and render front faces only', () => {
    const { gate } = buildTownPlan(), { group } = buildAjori(gate, () => 1600);
    const m = group.getObjectByName('settlement:tol_ajori:glaze') as THREE.Mesh, g = m.geometry;
    expect((m.material as THREE.Material).side).toBe(THREE.FrontSide);
    const P = g.getAttribute('position'), N = g.getAttribute('normal'), I = g.index!;
    const v = (i: number) => new THREE.Vector3().fromBufferAttribute(P, i);
    let bad = 0;
    for (let t = 0; t < I.count; t += 3) {
      const [a, b, c] = [I.getX(t), I.getX(t + 1), I.getX(t + 2)];
      const f = new THREE.Vector3().crossVectors(v(b).sub(v(a)), v(c).sub(v(a)));
      if (f.dot(new THREE.Vector3().fromBufferAttribute(N, a)) <= 0) bad++;
    }
    expect(I.count / 3).toBeGreaterThan(20); expect(bad).toBe(0);
  });
});
