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
describe('reins (s18 C14)', () => {
  it('a rider holds reins from both hands to the bit; a leader of a string a rope to the first animal', async () => {
    const { readFileSync } = await import('node:fs');
    const { decodeHumanAssets, meshoptSimplify } = await import('../src/people/humanAssets');
    const { buildOutfits } = await import('../src/people/outfits'); const { HumanGPU } = await import('../src/people/humanGPU'); const { Crowd } = await import('../src/people/crowd');
    const b = readFileSync('public/generated/humans/humans.bin'), A = decodeHumanAssets(JSON.parse(readFileSync('public/generated/humans/humans.json', 'utf8')), b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength));
    const { MeshoptSimplifier } = await import('three/addons/libs/meshopt_simplifier.module.js'); await MeshoptSimplifier.ready; const O = buildOutfits(A, { simplify: meshoptSimplify(MeshoptSimplifier) });
    const img = () => new THREE.DataTexture(new Uint8Array(4), 1, 1), humans = { A, O, gpu: new HumanGPU(A, O, { skin: img(), eye: img() }, { capacity: 16 }), ms: { load: 0, outfits: 0, gpu: 0, worker: false } };
    const cam = new THREE.PerspectiveCamera(60, 1, 0.1, 1000); cam.position.set(4, 2, 8);
    for (const [why, n] of [['riding on horseback with the king', 2], ['leading the king’s horses back to the stable', 1], ['driving out over the plain in the royal chariot, the parasol held over him', 4]] as const) {
      const crowd = new Crowd(null, 1, humans as any); crowd.addExtra('x', { id: 1, sex: 'm', role: 'groom', dress: 'persian', seed: 5, x: 0, y: 0, z: 0, yaw: 0, act: 'walk' as any, why, look: null } as any);
      crowd.update(1, cam.position, null, undefined); crowd.update(1.1, cam.position, null, undefined);
      const M = crowd.reins.mesh; expect(M.count, why).toBeGreaterThanOrEqual(2 * n);
      const m = new THREE.Matrix4(), s = new THREE.Vector3(); let L = 0; for (let i = 0; i < M.count; i++) { M.getMatrixAt(i, m); s.setFromMatrixScale(m); L += s.z; }
      expect(L / n, `${why}: a rein's length`).toBeGreaterThan(0.3); expect(L / n).toBeLessThan(4);
      if (n === 4) { const st = crowd.stats() as any; expect(st.things.kinds.chariot, 'the car drawn').toBe(1); expect(st.animals.instances ?? st.animals.drawn ?? 4).toBeGreaterThanOrEqual(4);
        const w = crowd.things.group.children.find(c => c.name === 'work:chariot:wheels') as THREE.InstancedMesh; expect(w.count, 'its two wheels').toBe(2);
        expect(crowd.persons.get('x')!.root[1], 'standing in the car').toBeGreaterThan(0.4); }
    }
  }, 240_000);
});
