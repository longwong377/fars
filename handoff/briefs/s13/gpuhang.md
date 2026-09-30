# s13 agent: gpuhang

You are a worker agent on PĀRSA (repo /home/user/fars, your own worktree branch; do not push). Read USER_DIRECTIONS.md,
MASTER_PLAN.md and CLAUDE.md first. The standard is every walkable area, at the player's lens and quality,
in motion, with sound, at every hour, season and weather. Your work serves the user directions {UD ids} and the thresholds {T- ids, quoted
verbatim from gates/thresholds.json}.

1. Say before you start how your change could pass its tests while the intent fails, and measure against that, not only the test.
2. Prefer the world-wide fix to the per-view fix. A fix proved in one view is not proved everywhere.
3. Evidence: node previews and CPU mirrors first; at most {n ≤ 2} browser runs through tools/dev/queue_e2e.sh.
4. Records: your reserved numbers are D-{d}, Q-{q0}..Q-{q1}, B{b0}..B{b1}; rows are appended, never renumbered.
5. Never lower or reword a threshold (tests/gates_ratchet.test.ts); a threshold you cannot meet goes to BLOCKERS with ≥ 3
   approaches measured.
6. Lead your final report with what is broken, placeholder or unverified on screen; list tests run with results; run
   `git checkout bench-reports/` before committing.
7. Heavy CPU work (soaks, bots, audio renders, bakes, long test runs) goes through `tools/dev/cpu_slot.sh`, one process at a
   time: the four cores are shared with the render lane.
Machine note (session 13, this box): 4 cores, 16 GB RAM, T4. Node-only work; no browser runs (render budget 0). One heavy node process at a time; run vitest with --pool=forks --poolOptions.forks.maxForks=2. Weekly usage is at 84 %: work efficiently, target ~3 h, short final report.
On the GPU machine (session 11 on: Windows, NVIDIA T4, 16 cores, 63 GB, open internet), this clause governs where it
   differs from 3 and 7. Render with Playwright directly on the real GPU (`PW_CHANNEL=chrome --project=gpu`, your own
   E2E_PORT), at the player's lens and quality; a page load is ~11 min, a warm frame 0.1 s, so put all your views in one
   load (moments.spec.ts `BATCH=1`). Never edit files in a tree whose dev server is serving a render (it reloads the page).
   Run node jobs directly (no cpu_slot.sh, flock or python here). Surfaces must read as real at arm's length: use CC0
   scans and assets (Poly Haven, ambientCG; src/render/scans.ts; each recorded in ASSET_LEDGER.md) over the procedural
   base, keeping the measured tints and layouts; a procedural stand-in where a scan exists is a placeholder.

## Slots
- Task: THE GAME RENDERS BLACK ON THIS BOX; find why and fix it (UD-19, UD-06; every other visual goal waits for this). Facts: main (~d246ce87+) on the Vagon T4 box (4 cores, 16 GB, Windows, real T4, installed Chrome via Playwright). Command that failed twice: `PW_CHANNEL=chrome BATCH=1 TIMEOUT=5400 E2E_PORT=5190 ONLY=dawn-stair-top node tools/dev/gpu_slot.mjs look -- npx playwright test tests/e2e/moments.spec.ts --project=gpu --timeout=5400000`. World built ~9 min, the first frames compiled ~13 min, then "THREE.WebGPURenderer: WebGPU Device Lost ... DXGI_ERROR_DEVICE_HUNG (0x887A0006)" at ~9:22, every shot black (draws 0, tris 0; log C:/Users/Administrator/fars-wt/render2.log, first attempt render1.log). The last good renders in shots/ are from 2026-09-27 (session 11), none since: session 12's merges (Blender assets, D-337 perf, impostors, many scans, 10306 fires, crowd) were never rendered on this box. Log warnings seen: "[impostors] the Cycles atlas: laid out for other frames or dresses than this build (rebuild: node tools/blender/impostors...)", "AttributeNode: Vertex attribute 'ytop' not found on geometry". Known: B98 (a GPU job over ~2 s resets the card; do not change the TDR settings), B114 (a similar hang at the first 300-person crowd view); tests/e2e/dbg_hang.spec.ts exists. Do: reproduce ONCE with one view and FRAMES small; then BISECT cheaply with probe pages or URL switches (tools/dev/ground_probe.*, humanlab.html, treelab.html load in seconds and avoid the 20-minute world load): which pass or object class is the single dispatch over ~2 s (shadow maps, crowd/impostor, fire/smoke, scans, terrain, post)? Fix the cause (split the dispatch, cap counts, rebuild the stale impostor atlas with the Blender pipeline if that is it, fix the 'ytop' geometry) and prove it by ONE full-world shot that is not black (mean > 0, looks like the world); report its path, and leave the world loading in under the current time or note why not. Only one GPU job at a time (gpu_slot.mjs), nothing else renders. Commit on a branch, do not push. Reserved: D-353, Q-1070..Q-1071, B239..B240. Report under 100 words, broken first, with the image path.
