// D-361 (B175): the Terrace's cost from the town and the plain with and without its far levels (src/render/far_terrace.ts),
// in node, the relief atlas's geometry on (as the page draws it when the atlas loads). Per camera: the distance to the
// Terrace's nearest drawn surface, the triangles and draws drawn, near vs far, per class, and the largest simplification
// error of the levels in use in pixels at that camera (the "no visible change" bound: <= 0.25 px by construction, measured).
//   npx tsx tools/blender/far_terrace_cost.ts [heightPx=1080] [fov=60]
// Node draws the procedural columns (the page's model GLBs need the Draco decoder): their far levels are measured on the
// procedural twin (same triangle budgets, sculpture.json lod.budget).
import * as THREE from 'three/webgpu';
import { readFileSync } from 'node:fs';
import { buildTerrace } from '../../src/arch/terrace';
import { buildMeshes } from '../../src/arch/meshes';
import { loadSculpt } from '../../src/arch/sculpt';
import { buildReliefs, buildPhase4Reliefs, buildStairCrenellations } from '../../src/arch/decor';
import { updateReliefs, setReliefAtlas } from '../../src/arch/reliefs';
import { FarTerrace, farTerraceReady, FAR_ERR, FAR_PX } from '../../src/render/far_terrace';

const H = +(process.argv[2] ?? 1080), FOV = +(process.argv[3] ?? 60);
await loadSculpt(async p => { const b = readFileSync('public/' + p); return b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength) as ArrayBuffer; });
setReliefAtlas(true, () => new THREE.MeshStandardNodeMaterial());
const T = buildTerrace() as any, arch = buildMeshes(T.parts), cren = buildStairCrenellations(T.parts);
const root = new THREE.Group(); root.add(arch.group); if (cren) root.add(cren);
const rel = buildReliefs(T.manifest), p4 = buildPhase4Reliefs(T.doorways).group; root.add(rel, p4);
root.updateMatrixWorld(true);
await farTerraceReady();
const far = new FarTerrace([root], () => H, false);
const cam = new THREE.PerspectiveCamera(FOV, 16 / 9, 0.1, 1e5);
const tris = (g: THREE.BufferGeometry) => (g.index ? g.index.count : g.getAttribute('position').count) / 3;
function drawn() {
  const by: Record<string, { tris: number; draws: number }> = {}; const box = new THREE.Box3();
  root.traverse(o => { const m = o as THREE.Mesh; if (!m.isMesh || (m as any).isBatchedMesh) return; let p: THREE.Object3D | null = m; while (p) { if (!p.visible) return; p = p.parent; }
    const im = m as THREE.InstancedMesh, n = im.isInstancedMesh ? im.count : 1; if (!n) return;
    const k = m.name.startsWith('relief') ? 'reliefs' : im.isInstancedMesh ? (m.name.includes('column') ? 'columns' : 'instanced') : 'buildings';
    const q = by[k] ??= { tris: 0, draws: 0 }; q.tris += tris(m.geometry) * n; q.draws++; });
  return by;
}
// the Terrace's drawn extent (for the cameras' distances)
const ext = new THREE.Box3(); arch.group.traverse(o => { const m = o as THREE.Mesh; if (m.isMesh && !(m as any).isInstancedMesh) { m.geometry.computeBoundingBox(); ext.union(m.geometry.boundingBox!.clone().applyMatrix4(m.matrixWorld)); } });
console.log(`Terrace extent x ${ext.min.x.toFixed(0)}..${ext.max.x.toFixed(0)}, z ${ext.min.z.toFixed(0)}..${ext.max.z.toFixed(0)}; ${H} px, fov ${FOV}; levels ${FAR_ERR.map((e, k) => `L${k + 1} ${e} m from ${far.switchAt(cam, k + 1).toFixed(0)} m`).join(', ')}`);
const views: [string, number, number][] = [['W edge + 150 m', ext.min.x - 150, (ext.min.z + ext.max.z) / 2], ['W 400 m (the town)', -420, -20], ['W 1 km', -1020, -20], ['SW 2 km', -1440, 1400], ['W 4 km', -4020, 0]];
let worst = 0;
for (const [what, x, z] of views) {
  cam.position.set(x, -12 + 1.6, z); cam.lookAt(-20, 0, 0); cam.updateMatrixWorld();
  root.traverse(o => { if ((o as any).isLOD) (o as any).update(cam); });
  updateReliefs(cam.position, 1e9); updateReliefs(cam.position, 1e9);
  far.reset(); const before = drawn();
  far.update(cam, 1e9); far.update(cam, 1e9); const after = drawn(), S = far.stats;
  const sum = (b: typeof before) => Object.values(b).reduce((s, q) => s + q.tris, 0), dr = (b: typeof before) => Object.values(b).reduce((s, q) => s + q.draws, 0);
  const d = ext.distanceToPoint(cam.position), alpha = 2 * Math.tan(FOV * Math.PI / 360) / H;
  // the largest error among the levels drawn, at the nearest distance it is drawn from this camera (px)
  let e = 0; for (const en of far.entries()) { const lv = en.levels.indexOf(en.o.geometry) + 1; if (lv > 0) e = Math.max(e, FAR_ERR[lv - 1] / Math.max(1, en.box.distanceToPoint(cam.position)) / alpha); }
  worst = Math.max(worst, e);
  console.log(`${what.padEnd(20)} ${d.toFixed(0).padStart(5)} m: near ${(sum(before) / 1e6).toFixed(3)} M / ${dr(before)} draws -> far ${(sum(after) / 1e6).toFixed(3)} M / ${dr(after)} (${(100 * sum(after) / sum(before)).toFixed(1)} %); ` +
    `${Object.entries(after).map(([k, q]) => `${k} ${(before[k].tris / 1e3).toFixed(0)}->${(q.tris / 1e3).toFixed(0)} k`).join(', ')}; levels ${S.byLevel.map(t => (t / 1e3).toFixed(0)).join('/')} k; bound <= ${e.toFixed(2)} px; built ${S.built} in ${S.buildMs.toFixed(0)} ms`);
}
console.log(`worst error bound drawn: ${worst.toFixed(3)} px (target ${FAR_PX})`);
