// s18 C14 (D-790): the vehicles' wheels turn: each wheeled kind splits into a body and one wheel (workObjects WHEELS,
// splitWheels), every wheel's triangles accounted for, none of the body's taken; WorkObjects draws the wheels at their axles
// turned by the distance come (crowd: roll = s / R).
import { describe, it, expect } from 'vitest';
import * as THREE from 'three/webgpu';
import { workGeometry, splitWheels, WHEELS, WorkObjects, type WorkKind } from '../src/people/workObjects';
const tris = (g: THREE.BufferGeometry) => (g.index ? g.index.count : g.getAttribute('position').count) / 3;
describe('turning wheels', () => {
  it('each wheeled vehicle splits into its body and its wheels, nothing lost', () => {
    for (const k of Object.keys(WHEELS) as WorkKind[]) { const W = WHEELS[k]!, g = workGeometry(k), { body, wheel } = splitWheels(g, W);
      expect(tris(wheel), `${k} wheel`).toBeGreaterThan(8);
      expect(tris(body) + tris(wheel) * W.axles.length, `${k}: body + wheels = the whole`).toBeCloseTo(tris(g), -1);
      wheel.computeBoundingBox(); const bb = wheel.boundingBox!; expect(Math.max(-bb.min.y, bb.max.y), `${k} wheel centred`).toBeLessThan(W.R + 0.05);
      const P = body.getAttribute('position'); let inWheel = 0; for (let i = 0; i < P.count; i++) for (const [x, z] of W.axles) if (Math.abs(P.getX(i) - x) < W.half * 0.5 && Math.hypot(P.getY(i) - W.R, P.getZ(i) - z) < W.R * 0.8) inWheel++;
      expect(inWheel, `${k}: no wheel left in the body`).toBeLessThan(P.count * 0.02); }
  });
  it('the wheels are drawn at their axles and turn with the roll', () => {
    const O = new WorkObjects(new THREE.MeshStandardNodeMaterial()); O.begin(); O.push('cart', new THREE.Matrix4(), 0); O.push('cart', new THREE.Matrix4(), 1.2); O.end();
    const wm = O.group.children.find(c => c.name === 'work:cart:wheels') as THREE.InstancedMesh; expect(wm.count).toBe(4);
    const a = new THREE.Matrix4(), b = new THREE.Matrix4(); wm.getMatrixAt(0, a); wm.getMatrixAt(2, b);
    expect(new THREE.Vector3().setFromMatrixPosition(a).x).toBeCloseTo(0.82); expect(new THREE.Vector3().setFromMatrixPosition(a).y).toBeCloseTo(0.46);
    expect(a.equals(b)).toBe(false);
  });
});
