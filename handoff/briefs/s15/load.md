# Brief s14/load: Load time: from ~15 min to about a minute

## Fixed clauses (copy verbatim)

You are a worker agent on PĀRSA (repo /home/user/fars, your own worktree branch; do not push). Read USER_DIRECTIONS.md,
MASTER_PLAN.md and CLAUDE.md first. The standard is every walkable area, at the player's lens and quality,
in motion, with sound, at every hour, season and weather. Your work serves the user directions UD-15, UD-28 and the thresholds T-R14: "views rendered per full-world page load in the session (the render train batches every agent's views into one load), session mean" >= 10 views per load.

1. Say before you start how your change could pass its tests while the intent fails, and measure against that, not only the test.
2. Prefer the world-wide fix to the per-view fix. A fix proved in one view is not proved everywhere.
3. Evidence: node previews and CPU mirrors first; at most 2 browser runs through tools/dev/queue_e2e.sh.
4. Records: your reserved numbers are D-354, Q-1080..Q-1089, B250..B259; rows are appended, never renumbered.
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

## Operating model (session 14 on; UD-28; governs where it differs from the clauses and machine section above)
The box is now 4 cores, 16 GB, one T4 (two GPU slots). An agent's own thinking costs the box nothing; its jobs do. Work so
that no hour is spent reading, waiting or polishing.
1. **Setup in one command:** `node tools/dev/mkwt.mjs <name>` (branch `s14-<name>` off `s14-int`, node_modules and models
   linked, your port in `.wtport`; use it as E2E_PORT). No `npm ci`. Work only in that tree.
2. **Read the context pack, not the records.** Your brief names the entry files and lines, the decisions and blockers that
   matter, the commands and the done line. Never read DECISIONS.md, PROGRESS.md, HANDOFF.md, TASKS.md or BLOCKERS.md whole:
   grep an id when you need one.
3. **You own your files.** Edit only the files your pack lists as owned (new files in your area are yours). A needed change in
   a file you do not own: make the smallest hook (an import, one call) and say so in the report; never refactor it.
4. **Iterate fast, verify once.** Iterate on probe pages and node checks (seconds). Never load the full world yourself:
   request your views on the render train (`node tools/dev/render_train.mjs request <name> <moment,...> [views.json]`); the
   lead runs it on `s14-int` after merging you and puts the frames in fars-train/out/<run>/<name>/. While you wait, do your
   next item; never sit idle on a slot.
5. **Slots:** every GPU job (probe pages too) through `node tools/dev/gpu_slot.mjs`; every heavy node job (soak, long vitest
   files, bots, Blender bakes on the CPU) through `node tools/dev/cpu_slot.mjs <label> -- <cmd>`; a job of more than ~10 min
   with `LONG=1` (it may take one slot only; the other stays for short checks), and hours-long runs queued for the night.
   Memory: one browser or Blender process of yours at a time (16 GB is shared; the session crashed once from it). Tests: only the files you
   touched or that import them (`npx vitest run <files>`); the lead runs the full suite overnight.
5b. **Box safeguards (session 15):** the slot tools wait while free memory is under 4 GB; mkwt refuses a 5th active agent;
   when you finish, run `node tools/dev/mkwt.mjs --done <name>`. A blocking resource problem (a stalled slot, memory) goes in
   your report's first line with the pids; never kill another agent's job.
6. **Done line and stop rules.** Your pack's done line is what a player would see (or a named threshold). Stop when it is
   met: no polish past it. A sub-goal that fails three measured approaches goes to BLOCKERS (your numbers) and you move on.
   Time box: the pack's hours; at the box's end, commit and report whatever state you are in.
7. **Commit hourly** to your branch (the guards run in the hook); before the final report, merge `s14-int` into your branch,
   re-run your tests, and commit. The lead merges you into `s14-int`; do not push.
8. **Records:** one DECISIONS row (your reserved D number) for the package; BLOCKERS rows only for real blocks; no edits to
   PROGRESS, HANDOFF, TASKS or COVERAGE (the lead's).
9. **Report ≤ 250 words:** broken/placeholder first; what a player now sees differently; train views requested; files
   touched; tests run with results. No questions mid-run: decide, log, proceed.

## Your context pack
**Your tree:** C:/Users/Administrator/fars-wt/load (branch s14-load; the fixed clause's /home/user path is the cloud's).

**Goal (as the player meets it):** The game opens in about a minute instead of ~15, so the player (and every render this week) is not waiting. This multiplies everything else this week does.

**Time box:** 5 h. **Needs:** gpu. **Reserved:** D-354, Q-1080..Q-1089, B250..B259.

**Files you own:**
- src/world/world.ts (the build path and its timing marks only)
- new src/world/cache/** (the baked world loader)
- new tools/bake_world/**
- src/main.ts warmUp (D-353) only

**Read-only, for context:**
- src/render/pipeline.ts
- src/render/materials.ts
- src/world/fire.ts
- tools/dev/load_probe.mjs
- tools/dev/renderless_probe.mjs

**Start here (entry points):**
- src/world/world.ts: its 11 performance.now marks; log them as one load trace first and split world build (~9 min on 4 cores) from pipeline compiles
- src/main.ts: __parsa.warmUp() (D-353, batches of pipelines; the T4 watchdog)
- the CPU impostor fallback (~12 s; src/people/impostors.ts) and the SDF/marching-cubes paths (sdf.ts, relief_figures.ts, outfits.ts, hills/bedrock.ts): bake their outputs to disk

**Decisions and blockers that matter (grep these ids, do not read the files whole):** D-250, D-253, D-299, D-353, B125, B228

**Commands:**
- node tools/dev/mkwt.mjs load
- node tools/dev/gpu_slot.mjs load -- node tools/dev/load_probe.mjs (a load trace; ?norender for build-only timing)
- a node bake script: node tools/bake_world/bake.mjs -> public/world-cache/*.bin + manifest (gitignored if > 50 MB; regenerable, like npm run terrain)

**Done line:** A cold page load to the first rendered frame at high on this T4 in <= 120 s (measured, trace committed), the baked world identical to the built one (a node test compares placements/bounds hashes), and a fallback to the live build when the cache is stale (hash of the sources).

**Render-train views to request:** dawn-stair-top, lane-with-child

**Notes:** RESUME (session 15): branch s14-load (merged with s14-int at 3e8cb596; tests/world_cache.test.ts being run by the lead) caches only 3 units (outfits, impostors, terrain detail: src/world/cache/units.json). The world build is still ~9 min on this 4-core box and the shaders ~5 min. Do the whole thing: (1) a load trace (tools/bake_world/load_trace.mjs) to rank where the 9 min go; (2) bake EVERY pure-CPU build step over ~2 s to the cache (settlement plan and houses geometry, the Terrace meshes, merged instance buffers, the population start state, fill/grime maps, probe tables), stale entries rebuilt live; (3) cut shader compile time (fewer material variants sharing pipelines, parallel compile via ?warm=async made default if it holds); (4) measure cold and warm loads at the end. Done line: a warm load (cache filled) of the full world <= 120 s to first frame on the T4, measured. NO browser or full-world load of yours until the lead says the current render train is finished (a render is running now; memory is tight); node work, the trace analysis from code and node-side timings first. The cloud session owns src/people/** except the render-side files: for people state, only cache what you read, do not edit people sim files (smallest hook, reported).
