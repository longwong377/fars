# Brief s14/surfaces: No single-colour surface anywhere: grime, wear and large-scale variation on every material

## Fixed clauses (copy verbatim)

You are a worker agent on PĀRSA (repo /home/user/fars, your own worktree branch; do not push). Read USER_DIRECTIONS.md,
MASTER_PLAN.md and CLAUDE.md first. The standard is every walkable area, at the player's lens and quality,
in motion, with sound, at every hour, season and weather. Your work serves the user directions UD-19, UD-06 and the thresholds T-R12: "whole asset classes replaced in a GPU session by real modelled (Blender, the D-305 pipeline) or scanned 3D assets across the world (e.g. every rock, every jar, every house wall kit), counted from the session log" >= 5 asset classes.

1. Say before you start how your change could pass its tests while the intent fails, and measure against that, not only the test.
2. Prefer the world-wide fix to the per-view fix. A fix proved in one view is not proved everywhere.
3. Evidence: node previews and CPU mirrors first; at most 2 browser runs through tools/dev/queue_e2e.sh.
4. Records: your reserved numbers are D-366, Q-1200..Q-1209, B370..B379; rows are appended, never renumbered.
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
**Your tree:** C:/Users/Administrator/fars-wt/surfaces (branch s14-surfaces; the fixed clause's /home/user path is the cloud's).

**Goal (as the player meets it):** Every big surface the player sees (Terrace paving, stone walls, mudbrick and plaster, lanes, courts, roofs, terrain near the eye) carries the variation of a real place: large-scale colour drift and patches over tens of metres, dirt and damp rising at wall feet, run-off streaks under sills and parapets, soot above doors and hearths, wear polish and dust along the paths people walk, edge chipping and lichen on old stone. No flat single-colour plane at any distance.

**Time box:** 6 h. **Needs:** gpu. **Reserved:** D-366, Q-1200..Q-1209, B370..B379.

**Files you own:**
- src/render/scans.ts
- src/render/masonry.ts
- src/render/blockface.ts
- src/render/materials.ts
- new src/render/grime*.ts
- new tools/dev/surface_probe*

**Read-only, for context:**
- src/arch/** (the walls agent owns the geometry; you own how it is shaded)
- src/render/probes/** (the light field)
- src/render/toneLook.ts
- references/
- ASSET_LEDGER.md (add any new CC0 scan)

**Start here (entry points):**
- src/render/materials.ts: every material factory; add one shared world-space grime layer (TSL nodes): low-frequency colour drift (100 m, 10 m, 1 m octaves), height-from-ground dirt and damp band, AO-driven crevice dirt, a run-off mask from the surface normal and the height above the next ledge
- src/render/scans.ts: the CC0 scan layer; add 1-2 grime/dirt/plaster-stain scans from ambientCG/Poly Haven (CC0) as detail masks; record them in ASSET_LEDGER.md
- paths: wear polish and dust along walked routes (the nav/route data the people use; read-only), soot above every fire place (src/world/firePlaces.ts read-only)
- keep sampler counts under 16 per pipeline (SAMPLERDBG=1) and the fragment shader size from growing more than ~20 % (frame agent cut it to 156 KB, D-355)

**Decisions and blockers that matter (grep these ids, do not read the files whole):** D-309, D-355, D-357, B113, B260

**Commands:**
- node tools/dev/mkwt.mjs surfaces
- iterate on tools/dev/ground_probe.* and a surface probe page of your own through gpu_slot.mjs (seconds a load)
- npx vitest run <your tests>

**Done line:** In train views of a Terrace court, a palace wall, a town lane and the plain near the eye, no surface reads as one flat colour: dirt bands at wall feet, streaks, soot and path wear visible at walking distance; frame time not worse by more than 2 ms; samplers < 16.

**Render-train views to request:** apadana-nw-court, gate-w-day, lane-with-child, town-smoke-dusk, dawn-stair-top, terrace-wall-near
