// D-331 (BLENDER_PLAN row 19, far buildings): what the Terrace's architecture costs from the town and the plain, drawn as it
// is now (the merged building meshes, the columns' and colossi's distance levels, the carved reliefs' far chunks, the stair
// merlons), in node: triangles and draws per class for cameras at 150 m to 4 km from the Terrace. The measurement behind the
// decision whether a far-level mesh or impostor of the Terrace is needed (DECISIONS D-331).
//   npx tsx tools/dev/far_terrace_cost.ts
import * as THREE from 'three/webgpu';
import { readFileSync } from 'node:fs';
import { buildTerrace } from '../../src/arch/terrace';
import { buildMeshes } from '../../src/arch/meshes';
import { loadSculpt } from '../../src/arch/sculpt';
import { buildReliefs, buildPhase4Reliefs, buildStairCrenellations } from '../../src/arch/decor';
import { updateReliefs, reliefStats } from '../../src/arch/reliefs';

await loadSculpt(async p => { const b = readFileSync('public/' + p); return b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength) as ArrayBuffer; });
const T = buildTerrace() as any, arch = buildMeshes(T.parts), cren = buildStairCrenellations(T.parts);
const rel = [buildReliefs(T.manifest), buildPhase4Reliefs(T.doorways).group];
const root = new THREE.Group(); root.add(arch.group); if (cren) root.add(cren);
const tris = (g: THREE.BufferGeometry) => (g.index ? g.index.count : g.getAttribute('position').count) / 3;
const cam = new THREE.PerspectiveCamera(60, 16 / 9, 0.1, 1e5);
// the Terrace's centre is near (e, n) = (-20, 0): cameras on its west (the town, the plain) at the court datum's foot, 1.6 m up
for (const [what, e, n] of [['west 150 m', -170, 20], ['west 400 m (the town)', -420, 20], ['west 1 km', -1020, 20], ['south-west 2 km', -1440, -1400], ['west 4 km', -4020, 0]] as const) {
  cam.position.set(e, -12 + 1.6, -n); cam.lookAt(-20, 0, 0); cam.updateMatrixWorld();
  root.traverse(o => { if ((o as any).isLOD) (o as any).update(cam); });
  const by: Record<string, { tris: number; draws: number }> = {};
  const add = (k: string, t: number) => { const q = by[k] ??= { tris: 0, draws: 0 }; q.tris += t; q.draws++; };
  root.traverse(o => { const m = o as THREE.Mesh; if (!m.isMesh || !m.visible) return; let p: THREE.Object3D | null = m; while (p) { if (!p.visible) return; p = p.parent; }
    const im = m as THREE.InstancedMesh, n = im.isInstancedMesh ? im.count : 1; if (!n) return;
    add(im.isInstancedMesh ? (m.name.includes('column') ? 'columns' : 'instanced') : 'buildings', tris(m.geometry) * n); });
  updateReliefs(cam.position, 1e9); const rs = reliefStats(); by.reliefs = { tris: rs.tris, draws: rs.draws };
  const tot = Object.values(by).reduce((s, q) => s + q.tris, 0);
  console.log(`${what.padEnd(24)} total ${(tot / 1e6).toFixed(2)} M tris, ${Object.values(by).reduce((s, q) => s + q.draws, 0)} draws: ${Object.entries(by).map(([k, q]) => `${k} ${(q.tris / 1e3).toFixed(0)} k / ${q.draws}`).join(', ')}`);
}
void rel;
