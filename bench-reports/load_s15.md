# Load, node-side (session 15, cloud; D-386): world-build time and memory per unit, before and after

## How to merge with s14-load (read first)
- `cloud-s15-load` = origin/s14-load (63f8581e, the stopped agent's WIP) + origin/s14-int (merged twice, last after the ship work
  landed) + this work. It **contains every s14-load commit**, so merging it into s14-load is a fast-forward-like merge with no
  conflicts on s14-load's own files. On 2026-10-02 04:1x UTC origin/s14-load had nothing past 63f8581e; if the Vagon bake agent
  (D-392) has pushed since, merge `cloud-s15-load` into its branch and expect conflicts only in the files below.
- Files this branch owns or changed (where a D-392 change will meet it): `src/world/cache/{pack,worldCache,release}.ts`,
  `src/world/cache/units.json`, `tools/bake_world/{bake,node_build,node_fetch,node_env,node_worker,vite_plugin.mjs,loaders_mem}.ts`,
  `src/world/world.ts` (the preload, the mud-face hook, the fill hook, the grime call), `src/world/settlement/{plan,geom,site}.ts`,
  `src/render/grime.ts`, `src/world/plain/crossings.ts`, `src/arch/reliefs.ts` (buildReliefShadow), `src/arch/meshes.ts`
  (?bevelab), `src/people/humanScans.ts`, `src/render/{models,monuments}.ts` (KTX2 dispose), `.github/workflows/world-bake.yml`,
  `package.json` (`bake:world`), `tests/world_cache.test.ts`.
- The merge of s14-int resolved: `src/main.ts` boot keeps **ship's progressive compile** (D-368) and drops the WIP's boot-time
  warm-up call (`__parsa.warmUp()` still exists); `src/render/scans.ts` keeps the WIP's KTX2 scans when encoded and ship's
  low-first jpg (`loadScanTexture`) otherwise; `worldCache.ts` uses ship's `BASE` (src/core/base.ts).
- Where this differs from what D-392 may do: the bake is **a node build of the whole world with a collector** (any unit the
  build computes is written; no per-unit node re-implementation), entries are **gzipped**, synchronous units are **preloaded**
  and taken with `cacheTake`/`cachedSync`. If D-392 baked the same units another way, keep one mechanism: the check is
  `WORLDCACHE=1 npx tsx tools/bake_world/node_build.ts` giving the same `sceneHash` as a live run.
- The Pages build (`tools/deploy/build_site.mjs`, s14-int) already runs `tools/bake_world/bake.ts` before `vite build` with
  NODE_OPTIONS=--max-old-space-size=8192 (pages.yml): nothing else to wire. `world-bake.yml` runs the bake + the identity test on
  pushes to s14-int and cloud-s15-* (and as `workflow_call`).

## Broken / not done (first)
- **Nothing here was rendered or loaded in a browser** (no GPU in the cloud). Page memory is measured in node: the page adds the
  GPU copies, render targets, pipelines and the workers; the 5 GB page target is **not verified**.
- Two test failures on the touched suites are **pre-existing on the base** (verified on 4bc74fc): arch.test.ts "no dimensional
  literals" (`terrace_rooms.ts` 276) and reliefs.test.ts "triangle budget" (1,570,294 > 1.5 M).
- Not done: streaming far units by distance (the plain's villages, orchards, Naqsh-e Rustam are still built at start); releasing
  static geometry's CPU copies after upload (469 MB in node, the same on the GPU) is unsafe: the translation layer's picks, the eye
  rays and F3 raycast that geometry on the CPU; normal quantisation (Int8) needs a browser check (WebGPU snorm8x4 into vec3).
- Not bakeable from node identically: the tree kit's impostors (2 s; built from leaf image pixels node does not decode) and the
  far people's CPU atlas (the Cycles atlas replaces it anyway).

## The measurement (node, this 4-core cloud box, tools/bake_world/node_build.ts)
Before this session node's build skipped every GLB model (node's `Request` rejected relative URLs), crashed at the settlement
(no canvas) and transcoded KTX2 to RGBA (no adapter). Now (`node_env.ts`, `node_worker.ts`): models Draco-decoded in-thread,
KTX2 transcoded to BC as on the T4, canvases/images as sized stand-ins; the report adds memory by unit, by array kind, by
allocation site (`MEMSITES=1`), V8 heap sampling (`HEAPSAMPLE=1`), live wasm heaps, and a **scene hash** (every mesh's arrays
and transform). "Before" = the WIP tree with that faithful harness; "after" = this branch, live and from the baked cache.

| | before | after, live | after, from the cache |
|---|---|---|---|
| node build time (`buildWorld` + loads) | 93.1 s | 98.1 s (box load ±5 s) | **61.4 s** (55.6 s after the merge) |
| JS heap at the end | 532 MB | 534 MB | 515 MB |
| ArrayBuffers at the end | 1,936 MB | 1,611 MB | **1,557 MB** |
| process RSS | 2,725 MB | 2,451 MB | **2,363 MB** |
| scene arrays (geometry, instances, data textures: also on the GPU) | 469 MB | 469 MB | 469 MB |
| scene hash | — | 7c9d0d8cd3a50f47 | **7c9d0d8cd3a50f47** (identical) |

Not visible in node (no renderer, so nothing is "uploaded"): the human scans array (80 MB) and the DataTexture mip chains now
released after upload; the KTX2 transcoder workers now disposed (models.ts, monuments.ts: up to 4 workers each, ~36 MB wasm heap
per worker, alive for the page's life before).

### Per build stage: time (s) and memory retained (heap + ArrayBuffers, MB)
| stage | before s | live s | cache s | before MB | live MB | cache MB |
|---|---|---|---|---|---|---|
| parts, manifest, doorways | 3.1 | 3.2 | 0.1 | +162 | +162 | +152 |
| arch (asset loads + Terrace meshes) | 33.7 | 35.2 | 30.9 | +1,064 | +1,019 | +1,117 |
| reliefs | 1.9 | 2.2 | 1.3 | -69 | -56 | -62 |
| p4 | 0.7 | 0.8 | 0.8 | +28 | +28 | +26 |
| insc (incl. the relief shadow atlas) | 9.4 | 9.2 | **1.2** | +71 | +72 | +30 |
| palace | 0.6 | 0.6 | 0.6 | +71 | +70 | +68 |
| settlement | 13.6 | 13.8 | **7.4** | +379 | **+222** | +210 |
| plain | 12.5 | 13.4 | **9.0** | +428 | **+343** | +353 |
| fire.build (incl. grime) | 3.3 | 3.1 | **0.3** | +30 | +30 | -8 |
| nav, sim, crowd, view | 1.5 | 1.7 | 1.9 | +78 | +78 | +100 |
| fauna (incl. the fill plan) | 7.7 | 7.6 | **0.5** | +161 | +112 | +22 |
| crowd.imp | 2.6 | 2.8 | 2.8 | +60 | +61 | +60 |
| nowView, occl | 0.7 | 1.1 | 1.1 | +8 | +7 | +7 |
(The cache run's arch stage holds the preloaded entries until they are taken; the time left in arch is the asset loads in node
(humans' outfits 5.4 s on the main thread: the page takes them from the cache in a worker; relief atlas transcoding 3.9 s, in
the page a worker) and the Terrace meshes without the mud faces (~5 s).)

### Per scene unit (arrays the GPU also holds, MB; unchanged by this work)
plain 122.4 · settlement 109.8 · architecture 98.5 · people 40.2 · palace furnishings 30.0 · phase-4 reliefs 16.3 · apadana
reliefs 6.7 · fill 5.4 · inscriptions 4.7 · doors 4.4 · the rest < 3 each. By kind: positions 95.5, normals 78.7, colours 52.5,
indices 41.7 (three's WebGPU backend widens Uint16 indices to Uint32 on upload and keeps the wide copy), the rest per-vertex extras.

### Per asset loader (`tools/bake_world/loaders_mem.ts`; retained after GC, MB, after the fixes)
reliefAtlas 171 (BC; was 682 when node transcoded to RGBA) · humans 205 · trees 103 · animals 82 · monuments 55 · models 50 ·
life 43 · probes 44 · terrain 23 · decor 15 · scanProps 15 · fireOcc 7 · the hills' kits 6.

### What was cut (memory)
| cut | where | saved (node) |
|---|---|---|
| settlement/village batches hand their trimmed arrays to the geometry (they kept their doubling buffers for as long as their cluster) | settlement/geom.ts | ~240 MB |
| the bevel A/B's flat copy of every architecture mesh only with `?bevelab` | arch/meshes.ts | 66 MB |
| Site rasters (cell, room) 16-bit | settlement/site.ts | ~55 MB |
| human scans array released after upload; DataTexture mip chains released with `userData.release` | humanScans.ts, release.ts | 80 MB (page) |
| KTX2 transcoders disposed after their loads | render/models.ts, monuments.ts | up to ~8 workers + wasm heaps (page) |
| the fill plan from the cache: its village rasters are not built at load | world.ts | part of fauna's 161 → 22 MB |

## What is baked (public/world-cache/, gzipped, regenerated by `npm run bake:world`; 8 entries, 41 MB on disk)
| unit | what | node time saved | entry (gz) |
|---|---|---|---|
| townplan | the whole town plan (Sites restored with their methods: pack.ts registered classes, shared refs, Map/Set) | 6.5 s | 0.8 MB |
| mudface | the mud-brick faces (D-364), each by its input geometry's hash (node-baked now; was dev-server only) | 7.2 s | 2.2 MB |
| reliefshadow | the relief shadow atlas, every field stamped (the page: 3 workers for minutes, shadows arriving piecemeal) | 7.3 s | 4.2 MB |
| fill | the town's and villages' fill plan (D-367) | 3.5 s | 1.3 MB |
| grime | the grime map's index and atlas (D-366) | 3.0 s | 0.4 MB |
| crossings | the road/river fords | 3.5 s | 0.003 MB |
| detail, outfits | (s14) the hills' landform maps, the fitted costumes | 3 s, 5.6 s | 4.8, 29.3 MB |
A unit's entry is used only when its source hash (its modules' import closure + data inputs, units.json) equals the served
tree's; otherwise the page builds it live (and on the dev server posts it back). Every cache module is in every unit's closure,
so a change to the cache code makes everything stale (safe: rebuilt live) until the next bake. The deploy bakes on every build.

## What the Vagon lead must verify in the browser
1. A dev-server load after `npm run bake:world`: `__parsa` trace shows `world-cache` hits for townplan, mudface, reliefshadow,
   fill, grime, crossings, detail, outfits, no misses; `?worldcache=verify` logs `identical` per unit.
2. The relief shadows are complete at the first frame (no piecemeal fill), and the town, the fords, the grime and the fill look
   as before (A/B with `?worldcache=0`).
3. Page memory with tools/bake_world/mem_probe.mjs against the 10 GB baseline (expected: less, by the cuts above and the
   disposed transcoders; the 5 GB target unverified).
4. Load time to walkable on the static build (tools/deploy/build_site.mjs → dist) cold and warm.
