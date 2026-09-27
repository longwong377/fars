// D-300 (T-A7, CPU mirror): which of the Terrace's surfaces are drawn with a CC0 scan applied, by the surface area each covers.
// T-A7 counts the pixels drawn by "a surface for which a scan exists (src/render/scans.ts SCAN_USE) but none is applied". In node
// no texture loads, so this reads what the page WOULD apply: every surface material carries userData.surface (its SURFACES key)
// and userData.scan (the scan applyScan lays over it at a strength that reads, alb >= 0.3; null otherwise), set by the builders
// themselves (surfaceMaterial, paintedStoneMaterial, incisedMaterial). A surface kind for which the library holds a fitting
// scan (SCANNABLE below) drawn without one is a procedural stand-in. The weight is the world-space area of the meshes (x their
// instances): an upper bound on any view's pixel share is not implied; a share of 0 by area is 0 in every view.
// Run: npx tsx tools/dev/scan_coverage_d300.ts
import * as THREE from 'three/webgpu';
import { buildTerrace } from '../../src/arch/terrace';
import { buildMeshes } from '../../src/arch/meshes';
import { buildStairCrenellations, buildReliefs, buildPhase4Reliefs } from '../../src/arch/decor';
import { SCAN_USE, SCANNABLE } from '../../src/render/scans';
import { surfaceMaterial, paintedStoneMaterial } from '../../src/render/materials';
import { footGeometry } from '../../src/arch/terrace_foot';

export function terraceScanCoverage() {
  const { parts, manifest, doorways } = buildTerrace();
  const root = new THREE.Group(), skipped: string[] = [];
  root.add(buildMeshes(parts).group);
  // the rest of the Terrace's stone as world.ts adds it (each optional in node: what does not build is listed, not hidden)
  const fg = footGeometry(parts); if (fg.geo) root.add(new THREE.Mesh(fg.geo, surfaceMaterial('terrace_foot'))); // D-300: the foot's blocks (world.ts)
  // the relief figures stream their meshes in workers (not in node): their material stands for them at the relief fields' area
  // (a nominal 1 % of the whole: the painted stone's own tag is what is checked)
  const relief = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), paintedStoneMaterial()); relief.name = 'relief-stand-in';
  for (const [name, f] of [['stair merlons', () => buildStairCrenellations(parts)], ['Apadana reliefs', () => buildReliefs(manifest)], ['Phase 4 reliefs', () => buildPhase4Reliefs(doorways).group]] as const) {
    try { const g = (f as () => THREE.Object3D | null)(); if (g) root.add(g); } catch (e) { skipped.push(`${name}: ${String(e).slice(0, 80)}`); }
  }
  const area = new Map<string, { a: number; scan: string | null; kind: string }>();
  const tri = new THREE.Triangle(), A = new THREE.Vector3(), B = new THREE.Vector3(), C = new THREE.Vector3();
  root.updateMatrixWorld(true);
  root.traverse((o: any) => {
    if (!o.isMesh || !o.geometry?.attributes?.position) return;
    const mats = Array.isArray(o.material) ? o.material : [o.material];
    const g = o.geometry, pos = g.attributes.position, idx = g.index, n = idx ? idx.count : pos.count;
    let a = 0;
    for (let i = 0; i + 2 < n; i += 3) {
      const i0 = idx ? idx.getX(i) : i, i1 = idx ? idx.getX(i + 1) : i + 1, i2 = idx ? idx.getX(i + 2) : i + 2;
      A.fromBufferAttribute(pos, i0); B.fromBufferAttribute(pos, i1); C.fromBufferAttribute(pos, i2); tri.set(A, B, C); a += tri.getArea();
    }
    const s = o.matrixWorld.getMaxScaleOnAxis(); a *= s * s * (o.isInstancedMesh ? o.count : 1);
    for (const m of mats) {
      const surf = m?.userData?.surface ?? `(unnamed: ${m?.type})`, scan = m?.userData?.scan ?? null;
      const kind = SCANNABLE[surf.split(' ')[0]] ? 'scannable' : 'no scan fits';
      const k = `${surf}|${scan}`, e = area.get(k) ?? { a: 0, scan, kind }; e.a += a / mats.length; area.set(k, e);
    }
  });
  { const t0 = [...area.values()].reduce((p, q) => p + q.a, 0), m = relief.material as any, k = `${m.userData.surface} (relief paint film)|${m.userData.scan}`;
    area.set(k, { a: t0 * 0.01, scan: m.userData.scan, kind: SCANNABLE[m.userData.surface] ? 'scannable' : 'no scan fits' }); }
  const total = [...area.values()].reduce((p, q) => p + q.a, 0);
  const rows = [...area.entries()].map(([k, v]) => ({ surface: k.split('|')[0], scan: v.scan, kind: v.kind, share: v.a / total, standIn: v.kind === 'scannable' && !v.scan }))
    .sort((p, q) => q.share - p.share);
  const standIn = rows.filter(r => r.standIn).reduce((p, q) => p + q.share, 0);
  return { rows, standIn, total, skipped, scanUse: Object.keys(SCAN_USE).length };
}
if ((process.argv[1] ?? '').replace(/\\/g, '/').endsWith('scan_coverage_d300.ts')) {
  const r = terraceScanCoverage();
  console.log('| surface | scan applied | kind | area share |'); console.log('|---|---|---|---|');
  for (const q of r.rows) console.log(`| ${q.surface} | ${q.scan ?? '—'} | ${q.kind}${q.standIn ? ' **STAND-IN**' : ''} | ${(q.share * 100).toFixed(2)} % |`);
  console.log(`\nT-A7 (CPU mirror, by area): ${(r.standIn * 100).toFixed(3)} % of the Terrace's surface drawn by a procedural stand-in`);
}
