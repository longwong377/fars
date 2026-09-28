// dev (D-337): the cost of main.ts's upward eye rays (skyVisibility: 9 rays × 60 m against the architecture group) in node
import * as THREE from 'three/webgpu';
import { buildTerrace } from '../../src/arch/terrace';
import { buildMeshes } from '../../src/arch/meshes';
const t0 = performance.now(); const arch = buildMeshes(buildTerrace().parts).group; arch.updateMatrixWorld(true);
let meshes = 0, tris = 0, inst = 0; arch.traverse((o: any) => { if (o.isMesh) { meshes++; const g = o.geometry; tris += (g.index ? g.index.count : g.attributes.position.count) / 3 * (o.isInstancedMesh ? o.count : 1); if (o.isInstancedMesh) inst += o.count; } });
console.log('built', ((performance.now() - t0) / 1000).toFixed(1), 's; meshes', meshes, 'instances', inst, 'tris', (tris / 1e6).toFixed(2), 'M');
const dirs = [[0, 1, 0], [0.5, 0.85, 0], [-0.5, 0.85, 0], [0, 0.85, 0.5], [0, 0.85, -0.5], [0.35, 0.6, 0.35], [-0.35, 0.6, -0.35], [0.35, 0.6, -0.35], [-0.35, 0.6, 0.35]];
const rc = new THREE.Raycaster();
for (const [n, p] of [['court', [-35, 1.6, -85]], ['apadana-hall', [1.9, 1.6, -12]], ['gate', [-40, 1.6, -124.6]], ['plain', [-400, -12, -122]]] as const) {
  const reps = 5; const t = performance.now(); let open = 0;
  for (let r = 0; r < reps; r++) for (const d of dirs) { rc.set(new THREE.Vector3(...p), new THREE.Vector3(d[0], d[1], d[2]).normalize()); rc.far = 60; if (rc.intersectObject(arch, true).length === 0) open++; }
  console.log(n, 'one skyVisibility()', ((performance.now() - t) / reps).toFixed(1), 'ms; open', open / reps / dirs.length);
}
