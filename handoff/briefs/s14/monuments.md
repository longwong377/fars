# Brief s14/monuments: The Gate colossi, protome capitals and column orders read as carved Achaemenid stone

## Fixed clauses (copy verbatim)

You are a worker agent on PĀRSA (repo /home/user/fars, your own worktree branch; do not push). Read USER_DIRECTIONS.md,
MASTER_PLAN.md and CLAUDE.md first. The standard is every walkable area, at the player's lens and quality,
in motion, with sound, at every hour, season and weather. Your work serves the user directions UD-19, UD-20, UD-01 and the thresholds T-R12: "whole asset classes replaced in a GPU session by real modelled (Blender, the D-305 pipeline) or scanned 3D assets across the world (e.g. every rock, every jar, every house wall kit), counted from the session log" >= 5 asset classes.

1. Say before you start how your change could pass its tests while the intent fails, and measure against that, not only the test.
2. Prefer the world-wide fix to the per-view fix. A fix proved in one view is not proved everywhere.
3. Evidence: node previews and CPU mirrors first; at most 2 browser runs through tools/dev/queue_e2e.sh.
4. Records: your reserved numbers are D-365, Q-1190..Q-1199, B360..B369; rows are appended, never renumbered.
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
**Your tree:** C:/Users/Administrator/fars-wt/monuments (branch s14-monuments; the fixed clause's /home/user path is the cloud's).

**Goal (as the player meets it):** Standing under the Gate of All Nations or in the Apadana, the colossi and the bull, lion and griffin capitals look like the carved originals in the photographs: correct heads, horns, curled beards, feather and hair carving, the double-bodied protome mass, and each column order its own member; no toys.

**Time box:** 8 h. **Needs:** blender. **Reserved:** D-365, Q-1190..Q-1199, B360..B369.

**Files you own:**
- src/arch/sculpt.ts
- src/arch/sculpt_models.ts
- src/arch/column_models.ts
- src/arch/orders.ts
- src/render/monuments.ts
- tools/blender/monuments.mjs
- tools/blender/mon_lib.py
- tools/blender/columns.json
- tools/blender/bake_cols.py
- tools/blender/carving.json
- new tools/blender/scans/**
- src/data/sculpture.json

**Read-only, for context:**
- research/BLENDER_PLAN.md rows 1, 2 and §8
- references/ and C:/Users/Administrator/fars-assets/photos/columns_capitals, gate_of_all_nations
- REVIEWS/review_carving_s11.md
- DECISIONS D-312, D-328, D-361 (grep)

**Start here (entry points):**
- APPROACH 1 (try first, 1 h max): licensed 3D scans. Search Sketchfab (CC0/CC-BY/CC-BY-NC), Smithsonian 3D, Scan the World, museum open-access (the Oriental Institute Chicago bull capital and protome, the British Museum, the Louvre lion/bull capital, the Met, Persepolis site scans) for photogrammetry of Achaemenid bull/lion/griffin protome capitals and the Gate lamassu/bulls. A usable scan is decimated, retopologised and baked in Blender, scaled to SITE_SPEC, recorded in ASSET_LEDGER.md with its licence (CLAUDE.md §12: personal non-commercial use allows CC-BY-NC).
- APPROACH 2: re-sculpt in Blender from the photographs: multires sculpt with displacement baked from the photo-derived heightfields (the relief pipeline already turns photographs into heightfields, D-320), the protome as a double-forepart with the correct head, horns and harness.
- B118: capitals 2/5, colossi 1/5; the previous agent left a rounded head, ball muzzle and thin antelope horns.
- columns2 (folded in): one member per order (B167), 2-3 shaft tile variants, carving in the silhouette near the eye (B166).
- build.mjs --verify ran out of memory in the protome BVH: build monument assets one at a time (one Blender process).

**Decisions and blockers that matter (grep these ids, do not read the files whole):** D-312, D-320, D-328, D-361, B118, B166, B167, B320

**Commands:**
- node tools/dev/mkwt.mjs monuments
- "C:/Program Files/Blender Foundation/Blender 5.0/blender.exe" -b --factory-startup --python <script> (one process at a time; LONG=1 cpu_slot or gpu_slot for Cycles bakes)
- iterate on tools/dev/terrace_probe.html and tools/blender/probe/*

**Done line:** Side by side with the reference photographs at the same angle (tools/blender/probe renders committed under REVIEWS/s14/monuments/), a colossus and each capital type read as the carved originals at 1-3 m; build.mjs --verify reproduces every monument asset; frame and triangle budgets within D-312's.

**Render-train views to request:** gate-w-day, gate-w-lens, apadana-nw-court, apadana-hall-axis, apadana-enter-portico
