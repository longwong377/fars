// D-329: the Blender-built monuments (tools/blender/monuments.mjs -> public/models/monuments/): every file the manifest lists is
// the one built (sha256), within its budgets, and the builders draw them, not their stand-ins; the geometry faces out.
import { describe, it, expect, beforeAll } from 'vitest';
import { readFileSync, existsSync } from 'node:fs';
import { createHash } from 'node:crypto';
import * as THREE from 'three/webgpu';
import { loadMonumentsNode } from './lib/monuments_node';
import { monument, clearMonuments } from '../src/render/monuments';
import { buildAjori } from '../src/world/settlement/ajori';
import { buildTownPlan } from '../src/world/settlement/plan';

const MAN = JSON.parse(readFileSync('public/models/monuments/manifest.json', 'utf8'));
const sha = (p: string) => createHash('sha256').update(readFileSync(p)).digest('hex');
const tris = (g: THREE.BufferGeometry) => (g.index ? g.index.count : g.getAttribute('position').count) / 3;
/** share of triangles whose winding agrees with their vertex normals */
function windingAgrees(g: THREE.BufferGeometry) {
  const P = g.getAttribute('position'), N = g.getAttribute('normal'), I = g.index!; let ok = 0; const a = new THREE.Vector3(), b = new THREE.Vector3(), c = new THREE.Vector3(), n = new THREE.Vector3();
  for (let t = 0; t < I.count; t += 3) { a.fromBufferAttribute(P, I.getX(t)); b.fromBufferAttribute(P, I.getX(t + 1)).sub(a); c.fromBufferAttribute(P, I.getX(t + 2)).sub(a);
    n.fromBufferAttribute(N, I.getX(t)).add(new THREE.Vector3().fromBufferAttribute(N, I.getX(t + 1))).add(new THREE.Vector3().fromBufferAttribute(N, I.getX(t + 2)));
    if (b.cross(c).dot(n) > 0) ok++; }
  return ok / (I.count / 3);
}
// budgets (triangles per mesh, bytes per asset): set from the build (D-329), with the plain's and the town's totals as the limits they count against
const BUDGET: Record<string, { tris: Record<string, number>; mb: number }> = {
  ajori: { tris: { body: 20000, glaze: 52000 }, mb: 12 },
  naqsh: { tris: { facade: 17000, kaba_white: 5000, kaba_dark: 2000 }, mb: 16 },
};

describe('the Blender-built monuments (D-329)', () => {
  beforeAll(() => { clearMonuments(); loadMonumentsNode(); });
  for (const id of Object.keys(BUDGET)) {
    it(`${id}: built, its files the ones recorded, within budget, geometry facing out`, () => {
      const e = MAN.assets[id]; expect(e, `${id} not built`).toBeTruthy();
      expect(sha('public/' + e.file)).toBe(e.sha256);
      let bytes = e.bytes;
      for (const [k, m] of Object.entries<any>(e.maps)) { expect(existsSync('public/' + m.file), k).toBe(true); expect(sha('public/' + m.file), k).toBe(m.sha256); bytes += m.bytes; }
      expect(bytes / 1e6).toBeLessThan(BUDGET[id].mb);
      const M = monument(id)!; expect(M).toBeTruthy();
      for (const [name, lim] of Object.entries(BUDGET[id].tris)) {
        const g = M.meshes[name]; expect(g, name).toBeTruthy(); expect(tris(g), name).toBeLessThanOrEqual(lim); expect(tris(g), name).toBe(e.tris[name]);
        expect(g.getAttribute('uv'), name).toBeTruthy(); expect(g.getAttribute('normal'), name).toBeTruthy();
        expect(windingAgrees(g), name).toBeGreaterThan(0.99);
      }
    });
  }
  it('Tol-e Ajori is drawn from the model (no placeholder), both meshes with the light map UVs, in the gate\u2019s frame', () => {
    const { gate } = buildTownPlan(), A = buildAjori(gate, () => 1600);
    const body = A.group.getObjectByName('settlement:tol_ajori:body') as THREE.Mesh, glaze = A.group.getObjectByName('settlement:tol_ajori:glaze') as THREE.Mesh;
    expect(body.userData.placeholder).toBe(false); expect(glaze.userData.placeholder).toBe(false);
    expect(body.geometry.getAttribute('uv1')).toBeTruthy(); expect(glaze.geometry.getAttribute('uv1')).toBeTruthy();
    expect(A.meshes).toBe(2); expect(A.tris).toBe(tris(body.geometry) + tris(glaze.geometry));
    const bb = new THREE.Box3().setFromObject(A.group), c = bb.getCenter(new THREE.Vector3());
    expect(Math.hypot(c.x - gate.c[0], c.z + gate.c[1])).toBeLessThan(1.0);   // centred on the plan's point
    expect(bb.min.y).toBeCloseTo(1600 - 0.6, 1); expect(bb.max.y).toBeGreaterThan(1600 + 12.5);   // foundation 0.6 m, merlons above 12 m
    // the glazed fields face out of the walls: their normals point away from the gate's long axis or along it at the façades
    expect(windingAgrees(glaze.geometry)).toBeGreaterThan(0.99);
  });
});
