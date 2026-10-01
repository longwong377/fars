# Brief s14/animalmotion: Animals and birds move like living things (3c)

## Fixed clauses (copy verbatim)

You are a worker agent on PĀRSA (repo /home/user/fars, your own worktree branch; do not push). Read USER_DIRECTIONS.md,
MASTER_PLAN.md and CLAUDE.md first. The standard is every walkable area, at the player's lens and quality,
in motion, with sound, at every hour, season and weather. Your work serves the user directions UD-27, UD-11 and the thresholds T-E15: "distinct drawn bodies: share of the drawn population whose body and face shape vector (continuous, seeded from the person and their life) differs from every other person's, with garments draped over that body and the day's wardrobe choice shown" >= 99 % unique.

1. Say before you start how your change could pass its tests while the intent fails, and measure against that, not only the test.
2. Prefer the world-wide fix to the per-view fix. A fix proved in one view is not proved everywhere.
3. Evidence: node previews and CPU mirrors first; at most 2 browser runs through tools/dev/queue_e2e.sh.
4. Records: your reserved numbers are D-362, Q-1160..Q-1169, B330..B339; rows are appended, never renumbered.
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
   files, bots, Blender bakes on the CPU) through `node tools/dev/cpu_slot.mjs <label> -- <cmd>`. Tests: only the files you
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
**Your tree:** C:/Users/Administrator/fars-wt/animalmotion (branch s14-animalmotion; the fixed clause's /home/user path is the cloud's).

**Goal (as the player meets it):** Every animal has secondary motion: bellies and dewlaps sway, ears flick, tails swing as chains, pack loads sway with the gait; birds take off without a pop and their wings shade correctly in flight.

**Time box:** 4 h. **Needs:** blender. **Reserved:** D-362, Q-1160..Q-1169, B330..B339.

**Files you own:**
- src/people/animals.ts
- src/people/animalForm.ts
- src/people/animalRig.ts
- src/people/animalModels.ts
- tools/blender/animals.mjs
- tools/blender/animals.py
- tools/blender/life_birds.py
- src/world/wildlife.ts

**Read-only, for context:**
- src/world/fauna.ts (the plain agent owns it)
- src/world/beasts.ts
- research/BLENDER_PLAN.md rows 4, 20
- tools/dev/animal_probe.*

**Start here (entry points):**
- animals.ts:12: the only motion is a procedural tail swish; add spring-damper jiggle bones (belly, dewlap, ears, tail chain, load) in Blender weights on the vertex rig, solved per frame on the GPU or a worker, faded with distance
- B179: birds pop at take-off (separate stand and fly levels) and flying wings keep rest normals: blend the rigs, recompute normals

**Decisions and blockers that matter (grep these ids, do not read the files whole):** D-326, D-332, B179

**Commands:**
- node tools/dev/mkwt.mjs animalmotion
- iterate on tools/dev/animal_probe.html: node tools/dev/gpu_slot.mjs animalmotion -- node tools/dev/animal_probe.mjs

**Done line:** In the animal probe and in train views, donkeys, oxen, sheep, goats, dogs, horses and camels show visible belly, ear, tail and load motion while walking and settle when standing; birds take off without a pop; cost <= 0.5 ms for 200 animals.

**Render-train views to request:** drum-road, small-spring-field, ford-pulvar-sep
