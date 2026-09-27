// D-324: where the houses' triangles go, per level and part (houses.ts HOUSE_PARTS), at the three lane spots of the budget
// test (tests/houses.test.ts: q_s1, q_w1, q_s3, near tiles within NEAR_R, each at the level nearUpdate gives it; LOD=0|1 forces one) and over the far level. `npx tsx tools/dev/house_parts.ts`
import { loadTerrain } from '../../tests/plainLib';
import { registerScanStandIns } from '../../tests/lib/scanStandIns';
import { loadModelsNode } from '../../tests/lib/models_node';
import { FireSystem } from '../../src/world/fire';
import { Settlement } from '../../src/world/settlement/build';
import { newHB, HOUSE_PARTS, P, NEAR_R, NEAR0 } from '../../src/world/settlement/houses';

if (process.env.SCAN !== '0') console.log('scan stand-ins', registerScanStandIns(), 'models', loadModelsNode().length);
const T = loadTerrain(), town = new Settlement(null, T, new FireSystem(0), 'test');
const names = Object.fromEntries(Object.entries(P).map(([k, v]) => [v, k])) as Record<number, string>;
for (const id of (process.argv[2] ?? "q_s1,q_w1,q_s3").split(",").filter(x => x !== "none")) {
  const s = town.plan.sites.find(x => x.id === id)!, x = s.frame.c[0], z = -s.frame.c[1];
  const by = new Map<string, number>(); let all = 0;
  for (const hs of town.houses) for (const [t, info] of hs.tiles) { if (Math.hypot(info.x - x, info.z - z) >= NEAR_R) continue;
    const d = Math.hypot(info.x - x, info.z - z), lod = process.env.LOD === "0" ? 0 : process.env.LOD === "1" ? 1 : d < NEAR0 ? 0 : 1; const B = newHB(); hs.buildTile(t, B, 0, lod as 0 | 1);
    for (const [k, b] of Object.entries(B)) { const own = b.owner; for (let f = 0; f < b.tris; f++) { const key = `${k}:${names[own[f] & 31] ?? own[f] & 31}`; by.set(key, (by.get(key) ?? 0) + 1); all++; } } }
  console.log(`${id}: ${(all / 1e3).toFixed(1)} k (houses only, without the fittings)`);
  for (const [k, n] of [...by].sort((a, b) => b[1] - a[1]).slice(0, 24)) console.log(`  ${k.padEnd(18)} ${(n / 1e3).toFixed(1)} k`);
}
{ let far = 0; const by = new Map<string, number>();
  town.group.traverse((o: any) => { if (!o.isMesh || !o.geometry?.getAttribute?.('tileId')) return; const n = o.geometry.index.count / 3; far += n;
    for (let f = 0; f < n; f++) { const d = o.userData.describe({ faceIndex: f }); const k = names[d?.part ?? 0] ?? String(d?.part); by.set(k, (by.get(k) ?? 0) + 1); } });
  console.log(`far: ${(far / 1e3).toFixed(1)} k`); for (const [k, n] of [...by].sort((a, b) => b[1] - a[1])) console.log(`  ${k.padEnd(18)} ${(n / 1e3).toFixed(1)} k`); }
void HOUSE_PARTS;
// WORST=1: the costliest tiles of the whole town at the full near level (tests/houses.test.ts: worst tile < 60 k), by part
if (process.env.WORST) { const rows: { t: number; id: string; n: number; by: Map<string, number> }[] = [];
  for (const hs of town.houses) for (const t of hs.tiles.keys()) { const B = newHB(); hs.buildTile(t, B, 0, 0); let n = 0; const by = new Map<string, number>();
    for (const [k, b] of Object.entries(B)) { n += b.tris; const own = b.owner; for (let f = 0; f < b.tris; f++) { const key = `${k}:${names[own[f] & 31] ?? own[f] & 31}`; by.set(key, (by.get(key) ?? 0) + 1); } }
    rows.push({ t, id: hs.s.id, n, by }); }
  rows.sort((a, b) => b.n - a.n); const n = rows.length, sum = rows.reduce((a, r) => a + r.n, 0);
  console.log(`tiles ${n}, mean ${(sum / n / 1e3).toFixed(1)} k, over 60 k: ${rows.filter(r => r.n >= 60e3).length}`);
  for (const r of rows.slice(0, +(process.env.WORST) || 3)) console.log(`  ${r.id} tile ${r.t}: ${(r.n / 1e3).toFixed(1)} k — ${[...r.by].sort((a, b) => b[1] - a[1]).slice(0, 8).map(([k, v]) => `${k} ${(v / 1e3).toFixed(1)}`).join(', ')}`); }
