// Shared loader for the plain tests: the generated terrain rings and river profiles, read from public/generated.
import { readFileSync } from 'node:fs';
import { Ring, Terrain, TerrainMeta } from '../src/terrain/heightfield';
import { parseRivers } from '../src/world/plain/data';
import * as THREE from 'three/webgpu';

export function loadTerrain(): Terrain {
  const meta: TerrainMeta = JSON.parse(readFileSync('public/generated/terrain.json', 'utf8'));
  const ring = (k: 'near' | 'mid' | 'far') => new Ring(meta.rings[k], new Uint16Array(readFileSync(`public/${meta.rings[k].file}`).buffer.slice(0) as ArrayBuffer), meta.court_asl);
  return new Terrain(meta, ring('near'), ring('mid'), ring('far'));
}
export const loadRiversFile = () => parseRivers(JSON.parse(readFileSync('public/generated/rivers.json', 'utf8')));

/** What one frame draws of `root` (D-228), counted the way renderer.info counts it (index count / 3 × instance count
 *  per draw): the main pass (objects outside the view frustum culled unless frustumCulled is off, hidden objects skipped)
 *  plus the shadow passes: `cascades` CSM cascades as main.ts builds them (practical split to maxFar), each shadow caster
 *  drawn into each cascade after its own onBeforeShadow hook ran with that cascade's camera (the tree sets and the people
 *  draw nothing into far cascades), every caster in every cascade otherwise (an upper bound: the cascades' own frustum
 *  culling is not modelled). A BatchedMesh counts its visible instances. At village P22
 *  (before D-228) this gives 2.560 M, the browser's +2.560 M of D-190. The sun must be registered (registerShadowLight)
 *  before the tree sets are built; its CSM node is faked here. */
export function frameTriangles(root: THREE.Object3D, cam: THREE.PerspectiveCamera, sun: THREE.DirectionalLight | null, o: { cascades?: number; maxFar?: number } = {}) {
  const C = o.cascades ?? 4, far = Math.min(cam.far, o.maxFar ?? 600), breaks: number[] = [];
  for (let i = 1; i < C; i++) breaks.push(THREE.MathUtils.lerp((cam.near + (far - cam.near) * i / C) / far, cam.near * (far / cam.near) ** (i / C) / far, 0.5));
  breaks.push(1);
  const lights = Array.from({ length: C }, () => ({ shadow: { camera: new THREE.OrthographicCamera() } }));
  if (sun) (sun.shadow as any).shadowNode = { lights, camera: cam, breaks, maxFar: o.maxFar ?? 600 };
  cam.updateMatrixWorld(); root.updateMatrixWorld(true);
  const fr = new THREE.Frustum().setFromProjectionMatrix(new THREE.Matrix4().multiplyMatrices(cam.projectionMatrix, cam.matrixWorldInverse));
  const sp = new THREE.Sphere(), im = new THREE.Matrix4();
  // a BatchedMesh is one draw per visible instance (WebGPUBackend: info.update per multi-draw range), culled per object
  const batched = (m: any, cull: boolean) => { let t = 0;
    for (let i = 0; i < m._instanceInfo.length; i++) { const ii = m._instanceInfo[i]; if (!ii.active || !ii.visible) continue;
      if (cull && m.perObjectFrustumCulled) { m.getBoundingSphereAt(ii.geometryIndex, sp); m.getMatrixAt(i, im); sp.applyMatrix4(im).applyMatrix4(m.matrixWorld); if (!fr.intersectsSphere(sp)) continue; }
      const gi = m._geometryInfo[ii.geometryIndex]; t += (gi.indexCount >= 0 ? gi.indexCount : gi.vertexCount) / 3; }
    return t; };
  const count = (m: THREE.Mesh, cull = false) => { if ((m as any).isBatchedMesh) return batched(m, cull); const g = m.geometry as any, n = g.index ? g.index.count : g.getAttribute('position').count;
    const inst = g.isInstancedBufferGeometry ? g.instanceCount : (m as any).isInstancedMesh ? (m as any).count : 1; return (Math.min(n, g.drawRange?.count ?? Infinity) / 3) * inst; };
  // draws: one per mesh with something to draw (a zero-instance draw is skipped: RenderObject.getDrawParameters), one per
  // visible BatchedMesh instance
  const draws = (m: THREE.Mesh, t: number, cull: boolean) => (t <= 0 ? 0 : (m as any).isBatchedMesh ? batchedDraws(m, cull) : 1);
  const batchedDraws = (m: any, cull: boolean) => { let k = 0; for (let i = 0; i < m._instanceInfo.length; i++) { const ii = m._instanceInfo[i]; if (!ii.active || !ii.visible) continue;
    if (cull && m.perObjectFrustumCulled) { m.getBoundingSphereAt(ii.geometryIndex, sp); m.getMatrixAt(i, im); sp.applyMatrix4(im).applyMatrix4(m.matrixWorld); if (!fr.intersectsSphere(sp)) continue; } k++; } return k; };
  let main = 0, shadow = 0, calls = 0; const rows: { name: string; main: number; shadow: number; calls: number }[] = [];
  root.traverseVisible(obj => { const m = obj as THREE.Mesh; if (!m.isMesh) return;
    const a = m.frustumCulled && !fr.intersectsObject(m) ? 0 : count(m, true); let s = 0, k = draws(m, a, true);
    if (sun && m.castShadow) for (const L of lights) { m.onBeforeShadow(null as any, m as any, cam, L.shadow.camera as any, m.geometry, m.material as any, null as any); const t = count(m); s += t; k += draws(m, t, false); m.onAfterShadow(null as any, m as any, cam, L.shadow.camera as any, m.geometry, m.material as any, null as any); }
    main += a; shadow += s; calls += k; rows.push({ name: m.name, main: a, shadow: s, calls: k }); });
  if (sun) delete (sun.shadow as any).shadowNode;
  return { main, shadow, total: main + shadow, calls, rows };
}
