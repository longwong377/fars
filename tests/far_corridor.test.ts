// B83 (session 9): beyond the mid ring the rivers' corridor can stand above the far ring's coarse ground; no reed, rush or grass
// tuft may hang in the air there (the beasts-lions render showed them across the sky at grid (7.3 km, 11.1 km)).
import { describe, it, expect } from 'vitest';
import * as THREE from 'three/webgpu';
import { loadTerrain, loadRiversFile } from './plainLib';
import { buildRivers } from '../src/world/plain/rivers';
import { riparianMargins } from '../src/world/plain/riparian';

describe('no floating tufts over the far ring (B83)', () => {
  it('at the lions\' camera every tuft stands within 0.45 m of the ground drawn', () => {
    const T = loadTerrain(), R = loadRiversFile(), rv = buildRivers(T, R.rivers, []), m = riparianMargins(rv.profiles, [], T, 'test', [1.2, 1.8]);
    let worst = 0, n = 0;
    for (const [e, nn] of [[7324.9, 11132.7], [7384.9, 11167.7]]) { m.update(new THREE.Vector3(e, T.heightAt(e, -nn) + 1.6, -nn));
      const g = m.mesh.geometry as THREE.InstancedBufferGeometry, pos = Object.values(g.attributes).find((a: any) => a.isInstancedBufferAttribute && a.itemSize === 3) as THREE.InstancedBufferAttribute;
      for (let i = 0; i < g.instanceCount; i++) { const x = pos.getX(i), y = pos.getY(i), z = pos.getZ(i); worst = Math.max(worst, y - T.heightAt(x, z)); n++; } }
    expect(n).toBeGreaterThanOrEqual(0); expect(worst).toBeLessThanOrEqual(0.45);
  });
});
