// D-337: the eye's upward rays through the BVH (src/render/eyeRays.ts) give three's Raycaster's answer, on the built Terrace
import { describe, it, expect } from 'vitest';
import * as THREE from 'three/webgpu';
import { buildTerrace } from '../src/arch/terrace';
import { buildMeshes } from '../src/arch/meshes';
import { rayHitsAny } from '../src/render/eyeRays';
describe('eye rays (D-337)', () => {
  it('match three.Raycaster over the Terrace and are much faster', () => {
    const arch = buildMeshes(buildTerrace().parts).group; arch.updateMatrixWorld(true);
    const dirs = [[0, 1, 0], [0.5, 0.85, 0], [-0.5, 0.85, 0], [0, 0.85, 0.5], [0, 0.85, -0.5], [0.35, 0.6, 0.35], [-0.35, 0.6, -0.35], [0.35, 0.6, -0.35], [-0.35, 0.6, 0.35]].map(d => new THREE.Vector3(...d).normalize());
    const rc = new THREE.Raycaster(); let n = 0, same = 0, tThree = 0, tBvh = 0, hits = 0;
    let s = 7; const rnd = () => (s = (s * 16807) % 2147483647) / 2147483647;
    for (let i = 0; i < 150; i++) { // points over the Terrace (grid x −60…250, y −230…150; z = −y), 0.3–6 m above its court level
      const o = new THREE.Vector3(-60 + rnd() * 310, 0.3 + rnd() * 6, -(-230 + rnd() * 380));
      for (const d of dirs) { rc.set(o, d); rc.far = 60;
        let t = performance.now(); const a = rc.intersectObject(arch, true).length > 0; tThree += performance.now() - t;
        t = performance.now(); const b = rayHitsAny(arch, o, d, 60); tBvh += performance.now() - t;
        n++; if (a === b) same++; if (a) hits++; } }
    console.log(`eye rays: ${same}/${n} agree, ${hits} hits; three ${tThree.toFixed(0)} ms, bvh ${tBvh.toFixed(0)} ms (incl. building)`);
    expect(same).toBe(n); expect(hits).toBeGreaterThan(n * 0.2);
    // warm: the second pass (the BVHs built) is what a frame pays
    let t = performance.now(); for (let i = 0; i < 20; i++) for (const d of dirs) rayHitsAny(arch, new THREE.Vector3(1.9, 1.6, -12), d, 60); const warm = (performance.now() - t) / 20;
    console.log(`one skyVisibility() in the Apadana hall, warm: ${warm.toFixed(2)} ms`); expect(warm).toBeLessThan(5);
  }, 240_000);
});
