// The villages as built (D-254): counts, load and lazy build times, far triangles, doors' clear widths, the near level at a
// village.   npx tsx tools/dev/village_count.ts [village_id] [--all]
import { loadTerrain, loadRiversFile } from '../../tests/plainLib';
import { buildCanals } from '../../src/world/plain/canals';
import { placeVillages, villageCompounds } from '../../src/world/plain/villages';
import { VillageHouses } from '../../src/world/plain/villagehouses';
import { ROOM } from '../../src/world/settlement/site';
const T = loadTerrain(), R = loadRiversFile(), C = buildCanals(T, R.rivers, 1), V = placeVillages(T, R.rivers, C, 1);
let t0 = performance.now();
const comps = V.map(v => villageCompounds(v, T, 1));
console.log(`compounds ${comps.reduce((a, c) => a + c.length, 0)} planned in ${(performance.now() - t0).toFixed(0)} ms`);
t0 = performance.now();
const vh = new VillageHouses(V, comps, T, null, null, 1);
console.log(`VillageHouses (load: far level, gates, fires) in ${(performance.now() - t0).toFixed(0)} ms`, JSON.stringify(vh.info));
const id = process.argv[2]?.startsWith('village') ? process.argv[2] : 'village_p22', vi = V.findIndex(v => v.id === id), v = V[vi];
const which = process.argv.includes('--all') ? V.map((_, i) => i) : [vi];
let narrow = 0, doors = 0, minClear = 9, roomCells = 0;
for (const i of which) { t0 = performance.now(); const hs = vh.ensure(i); const s = hs.s; const ms = performance.now() - t0;
  for (const e of s.doors) { doors++; const c = s.doorClear(e); minClear = Math.min(minClear, c); if (c < 0.8) narrow++; }
  for (let k = 0; k < s.cell.length; k++) if (s.cell[k] >= 0 && s.sub[k] === ROOM) roomCells++;
  if (which.length === 1) console.log(`${V[i].id}: raster + houses in ${ms.toFixed(0)} ms (${s.W} x ${s.H} cells, ${hs.walls.length} walls, ${hs.rooms.length} rooms)`); }
console.log(`doors ${doors}, narrower than 0.8 m: ${narrow}, least clear ${minClear.toFixed(2)} m; room cells ${roomCells}; lazy ${JSON.stringify({ built: vh.info.built, lazyMs: Math.round(vh.info.lazyMs), lazyMaxMs: Math.round(vh.info.lazyMaxMs), colliders: vh.info.colliders })}`);
t0 = performance.now(); vh.nearUpdate(v.x, -v.y, 0, true);
console.log(`near round the centre of ${id}: ${JSON.stringify(vh.nearInfo)} in ${(performance.now() - t0).toFixed(0)} ms`);
const mem = process.memoryUsage(); console.log(`heap ${(mem.heapUsed / 1e6).toFixed(0)} MB, rss ${(mem.rss / 1e6).toFixed(0)} MB`);
