# Session 18 (Vagon, T4), 2026-10-03 ~05:30-08:00 UTC: what is broken first

## Broken (by what a player sees)
- **The player sees a BLACK SCREEN on the T4**, built site, cold, Chrome WebGPU. Head s17-int 9700b06d: black from Enter on
  (0 draw calls). The DEPLOYED c3bde8ab: draws on Enter (107 calls), black after ~8 s of walking. Two faults (asks_cloud.md):
  1. Render throws abort the frame: `plain-stone` (plain-crossings fords mesh, crossings.ts:178, drawn in the sun shadow map)
     binds a uniform buffer that no longer exists (writeBuffer(undefined)); `plain-tracks` (ribbons.ts tracksMesh, groundScan
     textures) uploads a DataTexture whose image.data is null (writeTexture throws). Intermittent on the head (a race between a
     release/swap and the draw). Found with tools/dev/culprit_probe.mjs (GPUQueue guarded, onBeforeRender tags the object).
  2. Even with those calls skipped, the LIVE page's frames are black: the exposure meter never reads back (meterEV -1,
     meterMean -1 at noon), renderer toneMapping 0 on the live path vs 6 under ?test. ?test + renderOnce draws (final2's method).
- **The s17 "empty" frames are not the people stages:** the F3 overlay on the T4 reports cov-252 "drawn 435 skinned + 163
  impostors" (Terrace: 0/100/333/0 full/mid/far/farthest + 162), cov-037 "395 skinned + 1363 impostors"; humans:*:lod1/lod2 and
  shadow-far visible. The frames lose them to the render abort above.
- **No deploy:** s14-int untouched (black screen + settle, download and ready worse than c3bde8ab, below).
- **Not done:** C11's title film at full quality: 1920x804, 64 samples, OptiX = ~12 s a frame on the T4 (~12 h for 3,500
  frames); stopped after 16 frames (the box has ~1 h left). tools/score/fetch_vagon.mjs never landed. carve.ts needed two
  Windows fixes (asks_cloud.md; applied only in the T:/s18-film worktree, not committed: C11 owns the file).

## Measurements (T4, built site, cold, measure.mjs --mbps 100, head and deployed run side by side)
| | deployed c3bde8ab | head 9700b06d |
|---|---|---|
| page ready | 47.4 s | 48.4 s |
| first frames | 54.8 s | 49.6 s |
| all shaders settled | 611 s | 1266 s |
| page memory | 10.21 GB | 9.15 GB |
| frame time | 136 ms | 70 ms |
| download before ready | 372 MB | 413 MB |
| dist | 704 MB | 870 MB (Pages limit 1 GB) |
C9 checks on the head: lowFirst() at ready+60 s = 30 of 46 upgraded, 15 pending, no "does not match"; ?shaderlog: no starling/dove
errors, one destroyed-buffer submit (MeshBasicNodeMaterial_608); census: 218 programs, worst inputs 16 (at the limit), buffers 8, samplers 11.

## Done
- Sound: the 6 failed sets (worksite, chisel, loom, trowel, drill, chukar) fetched with wider queries; Freesound API throttled to
  60/min (the later searches came back empty); spoken-word rejects (Commons pronunciation clips said "loom", "grey partridge" in
  English) and per-item rejects; credited in ASSET_LEDGER. Caution: `fetch.mjs --only` left 541 tracked files of other sets
  deleted on disk (restored from git); check before committing after an --only run.
- Tools: tools/dev/empty_frames.mjs (a view set on the built site at the player's lens with F3 census; --guard, --test),
  player_probe.mjs, blank_probe.mjs, culprit_probe.mjs, c9_checks.mjs (the last on T:/s18-head only).
- My own fault, ~20 min lost: throwaway Chrome profiles in %TEMP% filled C: to 0 bytes mid-run; temp now on T:.
