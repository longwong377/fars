// s14/load (D-354): bake the world cache in node: every unit node can build (units.ts) computed and written to
// public/world-cache/ with its source hash (like `npm run terrain`: regenerable, not in git). The units only the page can
// build (the far people's atlas needs the props' models) bake themselves on the first dev-server load.
//   npx tsx tools/bake_world/bake.ts [unit,...]
import { sourceHashes } from './srchash.mjs';
import { writeEntry } from './vite_plugin.mjs';
import { nodeUnits } from './units';
import { pack } from '../../src/world/cache/pack';
const only = process.argv[2]?.split(','), root = process.cwd(), src = sourceHashes(root) as Record<string, string>;
for (const u of nodeUnits(root)) { if (only && !only.includes(u.unit)) continue;
  const t0 = performance.now(), v = await u.compute(), t1 = performance.now(), b = pack(v);
  console.log(`${u.unit}|${u.key}: built ${(t1 - t0).toFixed(0)} ms, ${(b.length / 1048576).toFixed(1)} MB -> ${writeEntry(root, u.unit, u.key, src[u.unit], b)}`); }
