# Agent: perf (D-337; Q-925, B193..B195). Worktree T:/fars-wt/perf, branch s12d-perf, E2E_PORT=5349. Scratch: T:/fars-assets-s12/perf/.
Serves UD-17 (every limit of the old machine revisited), the playability of the world (T-K6, T-K7 and the frame-time thresholds in gates/thresholds.json; quote them in your report), and all the look work of session 12, which is worthless unplayable.
TASK: the world runs at 209-287 ms a frame at Q high, 1920x1080, on the T4 with everything merged (the lighting agent's FRAMETIME=1 in tests/e2e/moments.spec.ts: town-smoke-dusk 287 ms, night-moon-fire 209 ms, 204 draws, 4.0 M triangles; CPU and GPU not split, B125). Make it playable at high on the T4 (target: 33 ms, 30 fps; say what is measured) without removing the session's assets or lowering fidelity: 1. split CPU and GPU time per frame (WebGPU timestamp queries where available; performance marks on the CPU side: the simulation, crowd, popview, arris bands, relief batches, skyVis, reflections, SSGI, TRAA, shadows); 2. profile by pass and by object class in the heaviest views (town lane, court with the crowd, the plain at dusk, Apadana hall, the Gate); 3. fix the biggest costs world-wide: culling (frustum, distance, occlusion where available), instancing and batching of the new models (props, rocks, flora, animals, trees), LOD distances, shadow casters per cascade (only what can cast into that cascade), the post passes' resolution and sample counts per quality, CPU work moved off the frame (workers) or amortised; 4. re-measure; commit each win with its numbers. Coordinate by files: other agents own their asset classes; you may change LOD distances and culling in their files with small, measured edits, noted in DECISIONS. Never lower a threshold.

## As sent

 (the lead adapted clauses 3 and 7 to the GPU machine and this session; slots are filled in the task above)

You are a worker agent on PĀRSA (your own worktree and branch, named below; commit there, do not push, do not touch the main
tree C:/Users/Administrator/fars). Read USER_DIRECTIONS.md (UD-19 above all), MASTER_PLAN.md and CLAUDE.md first — skim, you
have little time. The standard is every walkable area, at the player's lens and quality, in motion, with sound, at every hour,
season and weather. Your work serves the user directions UD-19 (build en masse, not verify small details), UD-17, D-233 (every
inch) and the threshold T-R12, quoted verbatim from gates/thresholds.json: "whole asset classes replaced in a GPU session by real
modelled (Blender, the D-305 pipeline) or scanned 3D assets across the world (e.g. every rock, every jar, every house wall kit),
counted from the session log" >= 5; anti_proxy: "a class counts only when every instance in the world is replaced (not one hero
or one room) and one batched render shows it; tuning, verification and records do not count".

1. Say before you start how your change could pass its tests while the intent fails, and measure against that, not only the test.
2. Prefer the world-wide fix to the per-view fix. A fix proved in one view is not proved everywhere.
3. Evidence: node previews, probe pages and Blender previews first; NO full-world render (the lead does one batched world render
   for all agents at the end).
4. Records: your reserved numbers are below; rows are appended, never renumbered.
5. Never lower or reword a threshold (tests/gates_ratchet.test.ts); a threshold you cannot meet goes to BLOCKERS with >= 3
   approaches measured.
6. Lead your final report with what is broken, placeholder or unverified on screen; list tests run with results; run
   `git checkout bench-reports/` before committing.
7. (Machine section governs heavy work, below.)

Machine section (GPU machine: Windows, NVIDIA T4, 16 cores, 63 GB, open internet). Render with Playwright directly on the real
GPU (`PW_CHANNEL=chrome npx playwright test … --project=gpu`) with YOUR OWN E2E_PORT (below); a world page load is ~11 min, so
iterate only on probe pages (tools/dev/ground_probe.*, tools/dev/terrace_probe.*, townlab.html, humanlab.html, treelab.html,
tools/blender/probe/*) or a small probe page of your own that loads only your asset class (seconds). Never edit files in a tree
whose dev server is serving a render. Run node jobs directly. Surfaces must read as real at arm's length: CC0 scans and assets
(Poly Haven, ambientCG, Smithsonian Open Access CC0; each recorded in ASSET_LEDGER.md) over the procedural base, keeping the
measured tints, sizes and layouts; a procedural stand-in where a real asset exists is a placeholder.
Blender 5.0.1: `"C:/Program Files/Blender Foundation/Blender 5.0/blender.exe" -b --factory-startup --python tools/blender/<script>.py`;
pipeline `node tools/blender/build.mjs [id]` (research/BLENDER_PLAN.md, D-305); KTX: `C:/Program Files/KTX-Software/bin/ktx.exe`.
Every GPU-heavy job (a Cycles bake, a Playwright run) goes through `node tools/dev/gpu_slot.mjs <label> -- <command>` (two slots;
the Windows watchdog resets the card if >2 heavy jobs run; never change TDR settings). Keep Cycles bakes small per dispatch.

SESSION RULES (this session only, the lead's decisions):
- TIME (the user, session 12: ALL the Blender work must get done): work until your class is DONE world-wide, not to a clock. Commit wired-in working states every ~15 minutes (the Vagon machine can stop at any moment; uncommitted work is lost). When done, report; the lead may send more.
- DISK: C: has ~6 GB free. Your worktree is on T:. Put ALL downloads and scratch in T:/fars-assets-s12/<your agent name>/ (each
  download with a manifest.json entry: url, licence, sha256). Commit to git ONLY what the game loads (public/models/…, Draco
  geometry, KTX2 or compressed JPG/WebP textures at the size the game needs); keep your committed additions under ~100 MB.
- The WHOLE class, everywhere: find every place in the code that draws your class (grep the generators) and route all of them
  to the new assets; keep placement, counts, sizes and evidence tiers from the simulation and SITE_SPEC. Keep LODs/impostors
  so the triangle and draw budgets tests still pass. The dev overlay flags (PLACEHOLDER) must be updated honestly.
- Tests before each commit: `npx tsc --noEmit -p .`, the vitest files covering the files you touched (`npx vitest run <files>`),
  and the pre-commit guards (never bypass the hook). Timing tests under load are not failures.
- Other agents run at the same time on other classes (lighting; CC0 models for rocks/plants/props; Blender house kit; monument
  forms; people's garments and hair). Stay in your files; if you must touch a shared file (materials.ts, scans.ts, ASSET_LEDGER.md,
  DECISIONS.md) make small appended edits.
- Final report (your last message): what is broken/placeholder/unverified first; which classes are now replaced EVERYWHERE
  (with the list of code paths switched), what is committed (commit hashes, MB added), what is only on T:, tests run and results,
  and exactly what the lead's one world render should look at to show your class (moments/views, env vars).



## The template (verbatim, as the guards require)

## Fixed clauses (copy verbatim)

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

## Machine section (session 11 on; copy into every brief after the fixed clauses)
On the GPU machine (session 11 on: Windows, NVIDIA T4, 16 cores, 63 GB, open internet), this clause governs where it
   differs from 3 and 7. Render with Playwright directly on the real GPU (`PW_CHANNEL=chrome --project=gpu`, your own
   E2E_PORT), at the player's lens and quality; a page load is ~11 min, a warm frame 0.1 s, so put all your views in one
   load (moments.spec.ts `BATCH=1`). Never edit files in a tree whose dev server is serving a render (it reloads the page).
   Run node jobs directly (no cpu_slot.sh, flock or python here). Surfaces must read as real at arm's length: use CC0
   scans and assets (Poly Haven, ambientCG; src/render/scans.ts; each recorded in ASSET_LEDGER.md) over the procedural
   base, keeping the measured tints and layouts; a procedural stand-in where a scan exists is a placeholder.
