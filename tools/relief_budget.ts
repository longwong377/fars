// Relief cost probe (D-204): reliefStats (triangles submitted, per LOD, draws) for all relief sets at fixed camera
// positions: before each Apadana audience panel, the walk along both Apadana façades used by tests/reliefs.test.ts (the
// worst case), the Phase 4 jamb probes, and the Grand Stair foot. Node, synchronous generation (no workers).
//   npx tsx tools/relief_budget.ts
import * as THREE from 'three/webgpu';
import { buildTerrace } from '../src/arch/terrace';
import { buildReliefs, apadanaFacades, buildPhase4Reliefs } from '../src/arch/decor';
import { ReliefSet, updateReliefs, reliefStats, genStats } from '../src/arch/reliefs';
import { buildReliefMarks } from '../src/arch/marks';
import { PalaceFurnishings } from '../src/world/furnish_palaces';
import { v } from '../src/arch/spec';

const t0 = performance.now();
const { manifest, doorways } = buildTerrace() as any;
const ap = buildReliefs(manifest), p4 = buildPhase4Reliefs(doorways).group;
const sets = [...ap.children, ...p4.children].filter(c => c instanceof ReliefSet) as ReliefSet[];
const apSet = sets[0];
console.log(`built ${sets.length} sets, ${sets.reduce((s, q) => s + q.items.length, 0)} figures (Apadana ${apSet.items.length}) in ${(performance.now() - t0).toFixed(0)} ms`);
const at = (e: number, y: number, n: number) => new THREE.Vector3(e, y, -n);
const line = (what: string, cam: THREE.Vector3) => {
  updateReliefs(cam, 1e9); const s = reliefStats();
  console.log(`${what.padEnd(34)} tris ${String(s.tris).padStart(8)}  L0..L3 ${s.byLod.join(' / ')}  far ${s.farTris}  draws ${s.draws} (far ${s.farDraws}, proxies ${s.proxies})`);
  return s;
};
for (const f of apadanaFacades(manifest)) for (const off of [2, 4, 6, 10, 16, 25]) line(`${f.id} audience panel, ${off} m`, at(f.origin[0] + f.normal[0] * off, 1.6, f.origin[1] + f.normal[1] * off));
let worst = 0, where = '';
for (const f of apadanaFacades(manifest)) for (let a = -f.length / 2; a <= f.length / 2; a += 4) for (const off of [1.2, 4, 15]) {
  updateReliefs(at(f.origin[0] + f.along[0] * a + f.normal[0] * off, 1.6, f.origin[1] + f.along[1] * a + f.normal[1] * off), 1e9);
  if (apSet.stats.tris > worst) { worst = apSet.stats.tris; where = `${f.id} a=${a} off=${off} L0..L3 ${apSet.stats.byLod.join(' / ')}`; }
}
console.log(`Apadana walk worst (tests/reliefs.test.ts): ${worst} at ${where}`);
let w2 = 0, wh2 = '';
const probe = (e: number, n: number, y: number, what: string) => { updateReliefs(at(e, y, n), 1e9); const t = sets.reduce((s, q) => s + q.stats.tris, 0); if (t > w2) { w2 = t; wh2 = what; } };
for (const d of doorways.filter((q: any) => q.framed)) for (const off of [0, 1.2]) for (const s of [-1, 1]) probe(d.c[0] + d.u[0] * s * (d.width / 2 - 0.4) - d.n[0] * off, d.c[1] + d.u[1] * s * (d.width / 2 - 0.4) - d.n[1] * off, d.y0 + 1.6, `${d.id} jamb ${s} off ${off}`);
console.log(`Phase 4 jambs worst (all sets): ${w2} at ${wh2}`);
line('Grand Stair foot (all far)', at(-60, 1.6, 122));
console.log(`meshes generated ${genStats.generated}, ${genStats.ms.toFixed(0)} ms generating; total ${(performance.now() - t0).toFixed(0)} ms`);
{ // D-212: what the masons' marks and the palace furnishings add (draws = meshes; the marks are one incised quad each)
  const { parts } = buildTerrace() as any; const mk = buildReliefMarks(manifest, parts); let draws = 0, tris = 0, n = 0;
  mk.traverse(o => { const m = o as THREE.Mesh; if (m.isMesh) { draws++; tris += m.geometry.index!.count / 3; n += m.userData.marks; } });
  console.log(`masons' marks on the Apadana stair reliefs: ${n} marks, ${draws} draw(s), ${tris} tris (+ one mesh of ≤ 72 tris on the Hall of 100 Columns' yard when dressed drums wait there)`);
  for (const court of [false, true]) { const pf = new PalaceFurnishings(parts, manifest, doorways, { court });
    for (const st of court ? ['use', 'stored'] as const : ['stored'] as const) {
      const per = [...pf.group.children].filter(g => g.name.endsWith(':' + st)).map(g => { let t = 0; g.traverse(o => { const m = o as THREE.Mesh; if (m.isMesh) t += m.geometry.getAttribute('position').count / 3; }); return `${g.name.split(':')[1]} ${g.children.length} draws ${(t / 1e3).toFixed(1)} k`; });
      console.log(`palace furnishings (court setting ${court ? 'on' : 'off'}, ${st}): ${pf.info.items[st]} pieces, ${pf.info.meshes[st]} draws, ${(pf.info.tris[st] / 1e3).toFixed(1)} k tris, ${pf.info.colliders[st]} colliders — ${per.join('; ')} (a building's group is drawn within ${v<any>('global', 'r_palace_furnishings').cull} m)`); } }
}
