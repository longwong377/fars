// The terrain's quality scale runs the right way (Phase 6+7 review, session 8, C1): the top preset draws the finest terrain.
// terrainLodBias is a detail factor (QUALITY in settings.ts); TerrainMesh divides its error and spacing thresholds by it.
import { describe, it, expect } from 'vitest';
import * as THREE from 'three/webgpu';
import { TerrainMesh } from '../src/terrain/terrainMesh';
import { QUALITY } from '../src/core/settings';
import { loadTerrain } from './plainLib';

describe('terrain LOD by quality (C1)', () => {
  it('ultra ≥ high ≥ medium ≥ low ≥ test in triangles at the stair-dawn-plain camera; the full ultra frame stays under 12 M', () => {
    const terrain = loadTerrain();
    // plain.spec stair-dawn-plain: grid (−39.6, 122.45), eye 1.6 m over the ground (world x = e, z = −n)
    const cam = new THREE.Vector3(-39.6, terrain.heightAt(-39.6, -122.45) + 1.6, -122.45);
    const tris: Record<string, number> = {};
    for (const q of ['test', 'low', 'medium', 'high', 'ultra'] as const) { const m = new TerrainMesh(terrain, QUALITY[q].terrainLodBias); m.update(cam); tris[q] = m.stats().tris; }
    expect(tris.ultra, JSON.stringify(tris)).toBeGreaterThanOrEqual(tris.high);
    expect(tris.high).toBeGreaterThanOrEqual(tris.medium); expect(tris.medium).toBeGreaterThanOrEqual(tris.low); expect(tris.low).toBeGreaterThanOrEqual(tris.test);
    // the vista frame at high was 5.89 M with 4.62 M of terrain (D-223 render 2); at ultra the rest is unchanged in this measure
    expect(5.89e6 - tris.high + tris.ultra, JSON.stringify(tris)).toBeLessThan(12e6);
    require('node:fs').writeFileSync('bench-reports/terrain-lod-quality.txt', `stair-dawn-plain terrain triangles by quality (TerrainMesh, node): ${JSON.stringify(tris)}\n`);
  }, 300_000);
});
