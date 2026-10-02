# s17 load (C4, D-580): the built site's cold load on the cloud's 4-core box

## Broken or not met first
- **UD-31's < 60 s is met only on the page's own clock.** Cold ready on the s17 tip (329bbbb1) with everyone's work in: **57-60 s
  on the page's clock, 70-74 s as the harness sees it** (earlier today ~70 s / 80-85 s) (the main thread is busy for ~10 s after ready: the first frames). The day began at 79.1 s (harness;
  a smaller world). The main thread is the bottleneck: 58-71 CPU-s of JS and native work to ready, ~90 % busy, spread over the
  builders of other owners (table below). Nothing measured here is on a GPU: Vagon's T4 numbers are asked for.
- **Page memory 5.5-5.7 GB (target 5).** The page's main-thread JS heap is 3.3 GB at ready, even after a full GC; 1.4 GB of it is
  typed arrays found by allocation site (below); the largest is the ground's 12 scan layers packed by hand into a 192 MB array
  (src/render/scans.ts), because the site has no KTX2 ground (tools/bake_world/ktx_ground.ts needs KTX-Software: asked of Vagon).
- **The run-to-run spread on this box is +-8 s** (the same dist: 64.7-80.0 s). Single runs prove nothing; the A/Bs below are
  n=3 where it matters.
- The loading screen's animations (C5's src/ui/shell.css) cost the GPU process's compositor ~1 core for the whole load in a
  software-composited browser (62 CPU-s by ready; 1 CPU-s with them off, ready ~6 s sooner): sent to C5.
- Stale world cache trap: a merge that touches a world unit's sources leaves a SKIP_BAKE dist's baked units stale; that load
  then builds them live (+40-50 s: navcore 21 s, fauna/vsites/fill 13 s, arch). The Pages build always bakes; always bake
  before measuring.

## Measured (built site via tools/deploy/serve.mjs, 100 Mbit/s cap, cold empty profile, `?norender&seed=1`, headless
Chromium 141 on the cloud container: 4 cores, 15 GB, no GPU)
| build | ready (harness) | ready (page clock) | before ready | memory | notes |
|---|---|---|---|---|---|
| day start (7d89b76), 8-seed bake, pool seed | 79.1 s | (68.3 s: world built, from the trace) | 328 MB | 5.53 GB | every byte in at 80 s; network idle 5-20 s |
| + SW prefetch (same tree) | 68.8 s | 57.6 s | 328 MB | 5.59 GB | every byte in at 34 s |
| s17 tip (C1, C2, C3, C5 merged) + C4, prefetch on, n=3 | 76.8-93.5 | 64.7 / 70.2 / 80.0 | 337 MB | 5.53-5.63 | |
| same dist, `?prefetch=0`, n=3 | 79.3-86.3 | 65.4 / 73.4 / 73.6 | 337 MB | 5.64-5.71 | no measurable difference now |
| s17 tip 329bbbb1 (C5's lighter loading screen, C10, C9 merged) + C4, n=2 | 73.5 / 70.5 | 60.2 / 57.7 | 339 MB | 5.68-5.77 | compositor 62 -> 5 CPU-s |
| + the talk's start at the first idle moment, n=2 | 73.7 / 70.8 | 60.3 / 57.4 | 339 MB | 5.76-5.80 | the gap after ready is the first frames (C10) |
| shared decoder + reaper, n=2 | 82.7 / 86.5 | 68.8 / 73.7 | 334 MB | 5.55 / 5.59 | renderer 4.9 GB (5.0-5.05 before) |
| loading screen animations off (`--css`) | 76.7 | 63.7 | 337 MB | 5.64 | compositor 62 -> 1 CPU-s |
| a never-answering file (HANG=models/trees/manifest.json, `?softs=40`) | 127.5 | 114.8 | | | reached ready (stale bake); before: waited forever |

Pages: dist 628 MB (1,321 files; the world cache with 8 baked worlds ~86 MB); limit 1 GB, target < 900 MB.

## Where the main thread goes (tools/deploy/boot_profile.mjs --stages, a SOURCEMAP=1 dist; JS self time by source file)
| stage | JS | the largest (owner) |
|---|---|---|
| scans (15 s wall) | 2.6 s + ~7 s native | scans.ts ground packing: 24 x 2048² drawImage/getImageData of the low copies (V2) |
| sculpt (the wait for the Terrace's set) | 3.3 s | terrainMesh.ts 2.3 s: the spawn's chunks, moved here from frame 0 on purpose (C4) |
| assets awaited | 3.8 s | GLTFLoader 1.6 s, humanScans.ts 0.7 s (V3), probes/field.ts 0.5 s |
| late assets (the wait for trees) | 4.4 s | trees/atlas.ts 2.0 s, trees/assets.ts 1.2 s (C2) |
| settlement | 4.5 s | settlement/geom.ts 1.0, site.ts 0.7, houses.ts 0.6, quarter.ts 0.5 |
| plain | 8.1 s | plain/fields.ts 2.5 s (C2), settlement/geom.ts 1.1, plain/trees.ts 0.6 |
| sim, crowd, fauna, crowd.imp | 4.8 s | population.ts 1.0 (C10), cache/pack.ts 0.9, relief_shadow.ts 0.5 |
| the first ~10 s after ready | 10.9 s | population.ts 2.5, relations/world.ts 1.4, navgrid.ts 1.0, popview.ts 1.0 (C10), fire.ts 0.9 |
Sent to C2, C10 and the cloud lead (with the ask: cache what is deterministic in the world cache, D-392; spread the first
plans over frames).

## Where the memory is (tools/deploy/boot_mem.mjs: live ArrayBuffers >= 2 KB by allocation site, after a full GC)
192 MB scans.ts loadGround (the ground array); 133 + 90 + 10 + 6 MB world-cache units (outfits, detail rings: zero-copy
views, in use); 80 MB humanScans; 105 MB terrain chunks; 64 MB relief atlases' mip chains; 44 MB relief shadow plan; 34 MB
tree bark; 34 MB tree impostor bakers; 26 MB outdoor lightmap; ~100 MB town and village geometry (Batch.toGeometry slices).
Total live typed arrays 1.4 GB of the 3.3 GB heap; JS objects ~0.5 GB (sampling heap profile); the rest is not attributed.

## What C4 changed (D-580)
- public/sw.js + src/core/prefetch.ts: the service worker fetches a cold visit's files (dist/boot-files.json, in the order the
  page asks for them: tools/deploy/boot_list.mjs) three at a time from the first second, while the scans decode; the loaders
  find them in its cache (in flight: they wait for it). In the worker: read on the page's main thread it stalled while the
  page decoded. Replaces shell/warm.ts's opt-in warming (main.ts no longer calls it).
- src/render/loaders.ts: the shared KTX2 transcoder and Draco decoder (871d8aab) re-landed, with an idle reaper (workers end
  after 4 s idle; three remakes them on demand) so the shared pools do not keep their memory (s16's +0.19 GB).
- main.ts: the spawn's terrain chunks are built in the build's first idle wait (they were 2.8 s of frame 0).
- world.ts: a stand-in-able asset set that has not answered in 300 s is left to its stand-ins, said in the console.
- tools/deploy: measure.mjs (page-clock ready, memory by process type at ready and peak, heaps, the heap after GC, the
  scene's arrays, CPU by thread, --css), boot_profile.mjs (--stages, --heap), boot_mem.mjs, boot_list.mjs, serve.mjs HANG=,
  build_site.mjs (NOMINIFY, SOURCEMAP, '*' and '{seed}' in boot_files.txt).
- public/sw.js + build_site.mjs (site-files.json: every file's content hash): a new deploy takes the files it has unchanged from
  the previous build's cache. Measured: a cold visit, a rebuild, the same profile again: 34.5 MB in 9 requests (the full-size
  scans the first visit had not upgraded to yet) instead of the whole site (~350 MB).
- src/world/cache/pack.ts: the world cache's units are decoded in place (fill and village sites ~0.15 s less in all).
- Tried and reverted: decoding the town's/plain's sets from the start (no gate): the Terrace's set then waited 18 s instead of
  8 s on 4 cores; starting the Terrace's set during the scans: the scans took 39 s instead of 17 s.
