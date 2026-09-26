// D-234: the town's houses built headless: far level size, near tiles at a lane spot (build time, triangles, meshes), the
// variety of the houses. Usage: npx tsx tools/dev/house_probe.ts [site] [x z]
import { readFileSync } from 'node:fs';
import { Ring, Terrain, type TerrainMeta } from '../../src/terrain/heightfield';
import { FireSystem } from '../../src/world/fire';
import { Settlement } from '../../src/world/settlement/build';

const meta: TerrainMeta = JSON.parse(readFileSync('public/generated/terrain.json', 'utf8'));
const ring = (k: 'near' | 'mid' | 'far') => new Ring(meta.rings[k], new Uint16Array(readFileSync(`public/${meta.rings[k].file}`).buffer.slice(0)), meta.court_asl);
const T = new Terrain(meta, ring('near'), ring('mid'), ring('far'));
const t0 = performance.now();
const town = new Settlement(null, T, new FireSystem(0), 'high');
console.log(`build ${(performance.now() - t0).toFixed(0)} ms; phases ${JSON.stringify(town.info.phases)}`);
let far = 0, other = 0, meshes = 0;
town.group.traverse((o: any) => { if (!o.isMesh || o.isInstancedMesh) return; meshes++; const t = (o.geometry.index ? o.geometry.index.count : o.geometry.attributes.position.count) / 3; if (/:far$/.test(o.name)) far += t; else other += t; });
console.log(`far level ${(far / 1e6).toFixed(3)} M tris; other settlement meshes ${(other / 1e6).toFixed(3)} M; ${meshes} meshes`);
const siteId = process.argv[2] ?? 'q_s1';
const s = town.plan.sites.find(x => x.id === siteId)!;
const x = process.argv[3] ? +process.argv[3] : s.frame.c[0], z = process.argv[4] ? +process.argv[4] : -s.frame.c[1];
const t1 = performance.now(); town.nearUpdate(x, z, 0);
console.log(`near at (${x.toFixed(0)}, ${z.toFixed(0)}): ${town.nearInfo.tiles} tiles, ${(town.nearInfo.tris / 1e3).toFixed(1)} k tris, ${town.nearInfo.meshes} meshes, built in ${(performance.now() - t1).toFixed(0)} ms (last tile ${town.nearInfo.lastBuildMs.toFixed(0)} ms)`);
const by: Record<string, number> = {};
town.group.traverse((o: any) => { if (!o.isMesh || !/settlement:near:/.test(o.name) || !o.visible) return; const k = o.name.split(':').pop(); by[k] = (by[k] ?? 0) + o.geometry.index.count / 3; });
console.log('near tris by material', JSON.stringify(by));
const parts: Record<string, number> = {};
town.group.traverse((o: any) => { if (!o.isMesh || !/settlement:near:.*:(timber|plaster)/.test(o.name) || !o.visible) return; const own = o.userData.describe; const n = o.geometry.index.count / 3; for (let f = 0; f < n; f += 3) { const d = own({ faceIndex: f }); const k = o.name.split(':').pop() + ':' + (d?.part === 12 ? d.note.split(': ')[1]?.slice(0, 18) : d?.part); parts[k] = (parts[k] ?? 0) + 3; } });
console.log(Object.entries(parts).sort((a, b) => b[1] - a[1]).slice(0, 25).map(([k, v]) => k + ' ' + v).join('\n'));
