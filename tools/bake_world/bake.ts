// s14/load (D-354), s15 (D-392): bake the world cache in node: every unit computed and written to public/world-cache/ with
// its source hash (like `npm run terrain`: regenerable, not in git). Two passes:
//  1. the units node builds on their own (units.ts: the hills' landform maps, the fitted costumes);
//  2. the world's whole build run in node (node_build.ts with WORLDCACHE=bake): every unit the build reads from the cache
//     (the mud-brick faces, the town plan, the zones, the fill, the grime, the core routes, ...) computed and written, for
//     the page's default world (the first visit's seed and settings). Run by tools/deploy/build_site.mjs (GitHub Actions).
//   npx tsx tools/bake_world/bake.ts [unit,...]      (a list: pass 1 only, those units)
import { execFileSync } from 'node:child_process';
import { rmSync } from 'node:fs';
import { resolve } from 'node:path';
import { sourceHashes } from './srchash.mjs';
import { writeEntry, CACHE_DIR } from './vite_plugin.mjs';
import { nodeUnits } from './units';
import { pack } from '../../src/world/cache/pack';
import { WORLD_SEED_POOL } from '../../src/core/seed';
const only = process.argv[2]?.split(','), root = process.cwd(), src = sourceHashes(root) as Record<string, string>;
if (!only && process.env.BAKE_CLEAN) rmSync(resolve(root, CACHE_DIR), { recursive: true, force: true }); // (CI starts clean anyway)
for (const u of nodeUnits(root)) { if (only && !only.includes(u.unit)) continue;
  const t0 = performance.now(), v = await u.compute(), t1 = performance.now(), b = pack(v);
  console.log(`${u.unit}|${u.key}: built ${(t1 - t0).toFixed(0)} ms, ${(b.length / 1048576).toFixed(1)} MB -> ${writeEntry(root, u.unit, u.key, src[u.unit], b)}`); }
// pass 2, once per world of the pool (src/core/seed.ts WORLD_SEED_POOL: a first visit draws one of them): the first world baked
// whole (mode bake), the rest read what they share with it and write only their own seeded units (mode read: a miss is
// computed and written). BAKE_SEEDS=n bakes the first n worlds only. One after another (one manifest).
if (!only) {
  const n = Math.max(1, Math.min(WORLD_SEED_POOL.length, +(process.env.BAKE_SEEDS ?? WORLD_SEED_POOL.length)));
  let fails = 0;
  for (const [i, seed] of WORLD_SEED_POOL.slice(0, n).entries()) {
    const t0 = performance.now();
    try { execFileSync(process.execPath, ['--max-old-space-size=7168', '--import', 'tsx', 'tools/bake_world/node_build.ts', `bench-reports/bake_world_trace_${seed}.json`],
      { stdio: ['ignore', process.env.BAKE_VERBOSE ? 'inherit' : 'ignore', 'inherit'], cwd: root, env: { ...process.env, WORLDCACHE: i === 0 ? 'bake' : 'read', SEED: String(seed) } }); }
    catch (e) { fails++; console.warn(`world ${seed}: the bake failed (${(e as Error).message.slice(0, 200)}); that world builds live`); }
    console.log(`world ${seed} (${i + 1}/${n}) baked in ${((performance.now() - t0) / 1000).toFixed(0)} s`);
  }
  if (fails === n) process.exit(1);
}
process.exit(0);
