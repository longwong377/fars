# Load s15: the world's build baked at site build time (D-392)

## What is broken or unmeasured (read this first)
- **Ready is not under 60 s yet.** It's 84.6 s cold at 100 Mbit (built site, `?norender&seed=1`). The world build's main-thread
  CPU is now well under 20 s, but the wall time is waiting on downloads and decodes: 323 MB before ready at 12.5 MB/s is 26 s on
  its own, and assets resolve about 24 s into the build.
- **The shared KTX2/Draco loader (cb3f0389, 601f5b60) is not measured in a browser.** The first build with it hung: one module's
  `dispose()` stopped every other module's loads. 601f5b60 removes every dispose of the shared decoders, but its site build was
  still queued for a CPU slot when I handed back (box at 96 %). Run one built-site load with it before the next deploy.
- **The CI bake of all 8 pool worlds has not been run.** Locally I baked 1 world, and 2 once (world 1: 223 s, world 467: 116 s).
  In Actions, 8 worlds is about 15-20 min of the site build. `BAKE_SEEDS=n` cuts that down.
- **The node bake equals the live build in shape, not bit for bit** (`?worldcache=verify`). The architecture has 8,653 of 21.4M
  numbers one float32 ulp apart (max relative 1e-6): node's and Chrome's `Math.sin` differ in the last bit, in the arris seeds.
  The fill has 4,869 of 279k numbers one double ulp apart (4e-16). Both have the same shape, keys, lengths and integers. Detail,
  zones and outfits are identical. The town plan, navcore, grime and village rasters are not verified in the browser. The node
  test checks the town plan's restore.
- **Page memory is 5.54 GB with `?norender`** (was 5.85 GB on the same build with the cache off, and 6.3 GB in ship's run).
  That is not yet the 5 GB target.
- `tests/court_view.test.ts` "no pop-in" fails on origin/s14-int too (1 person at 13.5 m). It is not caused by this work.

## Measured (this box: 4 threads, T4; built site served by tools/deploy/serve.mjs, cold empty profile, 100 Mbit/s)
| | before: ship, s15 03:30 (fresh clone) | before: same build, `?worldcache=0` | after (24423bd5) |
|---|---|---|---|
| ready (cold) | 162 s | 166 s | **84.6 s** |
| world build, wall | 113 s | 130 s | 62 s |
| world build, main-thread busy | — | ~78 s | ~26 s |
| first world.update before ready | — | 4.6 s | 3.4 s |
| fetched before ready | 444 MB | 288 MB | 323 MB (+35 MB of baked units) |
| page memory (all Chrome processes) | 6.3 GB | 5.85 GB | 5.54 GB |

Per stage (ms; cache off → on, same build, cold 100 Mbit): arch 11,537 → 1,702 · settlement 12,477 → 5,863 · plain 6,964 → 5,543 ·
fire/grime 856 → 37 · view (the court's route warm-up) 26,040 → 70 · fauna/fill 8,467 → 895 · crowd 12,664 → 2,689 ·
nav 10,776 → 8,668 (a download) · sculpt/assets 31.8 s → 28.0 s (downloads and decodes). The "before" column with the cache off
already includes this work's exact algorithmic fixes (crossings, grime bands, cloud volume once, impostors baked once).

Main-thread CPU profile of the build (non-minified built site, 100 Mbit, CDP, tools/bake_world/browser_prof.mjs): `buildWorld`
is 12.9 s inclusive. The rest of the 80 s is idle (37 s) or boot work (scans, sky).

Unthrottled loopback (same box): the world build went from 97 s to 48.5 s, and ready from 117.6 s to 73 s.

## What moved out of the browser
At site build, `tools/deploy/build_site.mjs` runs `tools/bake_world/bake.ts`. That runs the world's whole build in node
(`node_build.ts`, mode `bake`) once per pool world, and writes every unit the build reads to `public/world-cache/`. Each unit is
gzipped (the architecture goes from 83 MB to 5.5 MB) and carries the hash of its sources. The page reads a unit only when that
hash matches. Otherwise it builds the unit live and keeps a copy in Cache Storage for the next visit. The units:
- arch: the parts' bevelled, mud-faced and merged render geometry, the arris edges, the joint faces
- townplan: the sites after the door, access and house passes
- navcore: the Terrace's core routes (the court's warm-up and its ~150 days of economy are skipped when the world's own entry
  is there)
- per world: zones, fill, grime, village rasters
- from before: detail, outfits, impostors

Other fixes:
- Exact algorithmic fixes: road/river crossings through a segment grid (7 s → ms), and grime road bands in 4 m pieces (5 s → ms).
- The cloud noise volume is computed once (it was computed twice).
- Tree impostors: the first day is baked in a worker while the world builds. It was baked twice on the main thread.
- The bevelled parts' plain twins are built only with `?bevelswap` (nothing else drew them).
- Seed pool (the lead's decision): a first visit draws one of 8 baked worlds. A new game still draws a fresh seed, which builds
  live and is then kept by the browser.

## Tools
- `node_env.ts`: browser globals for node.
- `node_cache.ts`: the bake's file backend.
- `browser_prof.mjs`: CPU and heap sampling of one load.
- `site_probe.mjs`: one built-site load, its console and its failures.
