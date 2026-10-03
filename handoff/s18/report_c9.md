# s18 C9 (the budget, D-740): report

## Round 3, broken first
- **The geometry release (4b6fdbe2) is unmeasured where uploads happen** (the cloud's SwiftShader rejects or stalls): needs a T4 or a real-GPU heap reading; ?keepgeo turns it off.
- **The JS heap is still ~3.3 GB at ready** (target 2.5): backing stores 2,637 MB after the settlement cuts.
- **The cloud cannot finish a 60 s walk at quality high** (WebGPU: sampled-texture cap; WebGL: frames > 2 min, then the browser closes).
- Dist 897.4 MiB (941 MB) after the unused-scan prune; the deploy ceiling is 950 MiB.

## Round 2, broken first
- **The T4 black screen:** fixed at its cause (the jpg ground array re-uploaded null after release) with a safety net; seen in the cloud (0 page errors, 0 skips) but NOT yet on the T4: Vagon's player_probe on 1c288a99 or later.
- **The 'writeMask' pipeline error:** not fixed; ?shaderlog now records the failing pipeline's targets and outputs (window.__pipeFail) for the next T4 run.
- **Frame time (135-170 ms on the T4): no cut made.** The cloud could not profile it (SwiftShader compiles one view's pipelines in > 40 min).
- **The leaf atlases (~90 MB RGBA8):** still uncompressed (computed on the page).
- **Dist ~915-931 MB** of the 950 MB ceiling (the score and film included).

## Broken, unseen or not done first
- **No T4 run yet.** Every number here is the cloud's: SwiftShader WebGPU, no GPU. Memory is a relative signal, and frame time and shader-compile seconds cannot be measured here. The T4 run is asked (below).
- **The UASTC swap into the ETC1S twin's texture has never run on a real GPU.** In the cloud the formats differ (ETC2 exposed), so the swap is refused there by design. The T4 run must confirm `__parsa.lowFirst().upgraded` reaches 46 with no "[lowfirst] … does not match" warning, and that the scans look sharp a minute after ready.
- **The doves:** the WGSL census finds no limit broken (9-16 inputs, <= 8 buffers, 3 node samplers). s17.md's "doves still fail" has no log behind it that I could find. The T4 should log its validation errors by pipeline label.
- **The bird take-off morph levels sit at exactly 16 vertex inputs** on the shared path (0 spare). The test guards <= 16.
- **The dist is 934 MB (Pages limit 1 GB, target < 900).** build_site.mjs (not mine) should drop the jpg fallbacks of listed KTX2 maps (-161 MB). Asked of the lead.
- **Frame time (170 ms contended) and shaders settled (931 s): not measurable here.** The 38 fewer programs should cut compile time. Not verified.

## What a player now meets (cloud measurements, n=2, built site, 100 Mbit/s, cold)
| | s17 tip bc1afaca | this branch (T4 path, ?twins=1) |
|---|---|---|
| ready (harness, ?norender) | 64.3 s | 52.3 s (V10's fixes also in) |
| bytes before ready | 370 MB | 371 MB |
| page memory at ready / peak | 5.35 / 5.87 GB | 4.55 / 5.15 GB |
| texture GPU bytes bound by the scene | 2,259 MB | 1,374 MB |
| scene-pass shader programs (vertex / fragment modules) | 254 (199 / 202) | 216 (160 / 203) |
| pipelines over 16 inputs / 8 buffers / 16 samplers | not counted (starling 17 in s17) | 0 (worst 16 / 8 / 11) |
| bird programs (flying) | 31 | 2 |
| dist | 704 MB | 934 MB (773 with the asked prune) |
Off-BC7 GPUs (cloud default): 339 MB before ready; memory as before.

## Files
src/world/wildlife.ts, src/render/{shareInstancing,lowfirst,loaders}.ts, src/main.ts (`census`), src/dev/pipelineCensus.ts, tools/dev/pipeline_census.mjs, tools/bake_world/ktx_low.ts, public/textures (45 KTX2 + 46 twins + ground array, ktx.json, ktx_low.json), tests/pipeline_limits.test.ts, tests/shader_share.test.ts (one case).
