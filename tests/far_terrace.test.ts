// D-361 (B175): the Terrace's far levels (src/render/far_terrace.ts): index-only (the near attributes shared, instanced ones
// too), each level within its error bound, drawn only beyond FAR_MIN and where its bound is under FAR_PX at the lens, a long
// lens keeping the near shapes further, a swapped near geometry re-read. The whole Terrace's cost: tools/blender/far_terrace_cost.ts.
import { describe, it, expect, beforeAll } from 'vitest';
import * as THREE from 'three/webgpu';
import { FarTerrace, farLevels, farTerraceReady, FAR_ERR, FAR_MIN, FAR_PX } from '../src/render/far_terrace';

beforeAll(async () => { await farTerraceReady(); });
const tris = (g: THREE.BufferGeometry) => g.index!.count / 3;

describe('far levels (D-361)', () => {
  it('index-only: attributes shared with the near geometry, triangles fall level by level, bounds kept', () => {
    const g = new THREE.TorusKnotGeometry(4, 1.2, 400, 48); // ~38 k triangles, smooth normals and UVs
    const { levels, err } = farLevels(g, false);
    expect(levels.length).toBe(FAR_ERR.length);
    let prev = tris(g);
    levels.forEach((L, k) => { if (!L) return; for (const n of Object.keys(g.attributes)) expect(L.getAttribute(n)).toBe(g.getAttribute(n));
      expect(tris(L)).toBeLessThan(prev); prev = tris(L); expect(err[k]).toBeLessThanOrEqual(FAR_ERR[k] * 1.001); });
    expect(tris(levels[0]!)).toBeLessThan(tris(g) * 0.6);
  });
  it('levels switch by distance and lens; nothing changes nearer than FAR_MIN; reset and re-read', () => {
    const root = new THREE.Group(), m = new THREE.Mesh(new THREE.TorusKnotGeometry(4, 1.2, 400, 48), new THREE.MeshStandardNodeMaterial()); root.add(m);
    const near = m.geometry, far = new FarTerrace([root], () => 1080, false), cam = new THREE.PerspectiveCamera(60, 16 / 9, 0.1, 1e5);
    const at = (d: number) => { cam.position.set(d, 0, 0); cam.lookAt(0, 0, 0); cam.updateMatrixWorld(); far.update(cam, 1e9, 0); return m.geometry; };
    expect(at(FAR_MIN - 10)).toBe(near);
    expect(far.switchAt(cam, 1)).toBeGreaterThanOrEqual(FAR_MIN);
    const d2 = far.switchAt(cam, 2); expect(d2).toBeCloseTo(FAR_ERR[1] / (FAR_PX * 2 * Math.tan(Math.PI / 6) / 1080), 0);
    const g2 = at(d2 * 1.2 + 6); expect(g2).not.toBe(near); expect(g2.userData.farLevel).toBeGreaterThanOrEqual(2);
    cam.fov = 15; cam.updateProjectionMatrix(); expect(far.switchAt(cam, 2)).toBeGreaterThan(d2 * 3); // a long lens: further out
    cam.fov = 60; cam.updateProjectionMatrix();
    far.reset(); expect(m.geometry).toBe(near);
    const other = new THREE.SphereGeometry(5, 64, 48); m.geometry = other; at(d2 * 1.2 + 6); // the owner swapped the near geometry
    expect(m.geometry.getAttribute('position')).toBe(other.getAttribute('position'));
  });
  it('instanced meshes: the far level carries the instanced attributes (shared) and the instances keep their places', () => {
    const g = new THREE.CylinderGeometry(0.8, 0.8, 19, 96, 40); const seed = new THREE.InstancedBufferAttribute(new Float32Array(20 * 2), 2); g.setAttribute('colSeed', seed);
    const im = new THREE.InstancedMesh(g, new THREE.MeshStandardNodeMaterial(), 20); const m4 = new THREE.Matrix4();
    for (let i = 0; i < 20; i++) im.setMatrixAt(i, m4.makeTranslation(i * 9, 0, 0));
    const root = new THREE.Group(); root.add(im); const far = new FarTerrace([root], () => 1080, false), cam = new THREE.PerspectiveCamera(60, 16 / 9, 0.1, 1e5);
    cam.position.set(-2000, 0, 0); cam.lookAt(0, 0, 0); cam.updateMatrixWorld(); far.update(cam, 1e9, 0);
    expect(im.geometry).not.toBe(g); expect(im.geometry.getAttribute('colSeed')).toBe(seed); expect(tris(im.geometry)).toBeLessThan(tris(g) / 4);
    expect(far.stats.tris).toBe(tris(im.geometry) * 20);
  });
});
