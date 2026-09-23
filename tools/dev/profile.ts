// dev: ground profile along a polyline from the physics colliders (same rays as tools/build_nav.ts) + nav walkability
import { readFileSync } from 'node:fs';
import { Ring, Terrain, TerrainMeta } from '../../src/terrain/heightfield';
import { Physics } from '../../src/player/physics';
import { buildTerrace } from '../../src/arch/terrace';
import { buildMeshes } from '../../src/arch/meshes';
import { NavGrid } from '../../src/people/navgrid';
const meta: TerrainMeta = JSON.parse(readFileSync('public/generated/terrain.json', 'utf8'));
const ring = (k: 'near' | 'mid' | 'far') => new Ring(meta.rings[k], new Uint16Array(readFileSync(`public/${meta.rings[k].file}`).buffer.slice(0)), meta.court_asl);
const T = new Terrain(meta, ring('near'), ring('mid'), ring('far'));
const P = await Physics.create(); P.updateTerrain(T, { x: 0, y: 0, z: 0 });
buildMeshes(buildTerrace().parts, P); P.step(1 / 60);
const nav = await NavGrid.load(async p => { const b = readFileSync('public/' + p); return b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength); });
const pts = JSON.parse(process.argv[2]) as [number, number][]; const step = +(process.argv[3] ?? 0.5);
for (let s = 0; s < pts.length - 1; s++) { const [a, b] = [pts[s], pts[s + 1]]; const L = Math.hypot(b[0] - a[0], b[1] - a[1]);
  const row: string[] = [];
  for (let d = 0; d <= L + 1e-6; d += step) { const e = a[0] + (b[0] - a[0]) * d / L, n = a[1] + (b[1] - a[1]) * d / L; const g = P.castRayDown(e, -n, 50); row.push(`${e.toFixed(1)},${n.toFixed(1)}:${g === null ? '—' : g.toFixed(2)}${nav.walkable(e, n) ? '' : '✗'}`); }
  console.log(row.join('  ')); }
