# Brief s14/walls: The walls stop being boxes: Terrace, palaces and town houses as modelled masonry and mudbrick

## Fixed clauses (copy verbatim)

You are a worker agent on PĀRSA (repo /home/user/fars, your own worktree branch; do not push). Read USER_DIRECTIONS.md,
MASTER_PLAN.md and CLAUDE.md first. The standard is every walkable area, at the player's lens and quality,
in motion, with sound, at every hour, season and weather. Your work serves the user directions UD-19, UD-20, UD-06 and the thresholds T-R12: "whole asset classes replaced in a GPU session by real modelled (Blender, the D-305 pipeline) or scanned 3D assets across the world (e.g. every rock, every jar, every house wall kit), counted from the session log" >= 5 asset classes.

1. Say before you start how your change could pass its tests while the intent fails, and measure against that, not only the test.
2. Prefer the world-wide fix to the per-view fix. A fix proved in one view is not proved everywhere.
3. Evidence: node previews and CPU mirrors first; at most 2 browser runs through tools/dev/queue_e2e.sh.
4. Records: your reserved numbers are D-364, Q-1180..Q-1189, B350..B359; rows are appended, never renumbered.
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
**Your tree:** C:/Users/Administrator/fars-wt/walls (branch s14-walls; the fixed clause's /home/user path is the cloud's).

**Goal (as the player meets it):** Every wall, floor, step and parapet the player walks past reads as built: dressed stone blocks with real chipped arrises, joints and weathering in the geometry, stepped merlons with worn edges, palace wall faces with depth, and town house walls of mudbrick and plaster with sag, repairs and eroded feet; not bevelled boxes with a texture.

**Time box:** 6 h. **Needs:** blender. **Reserved:** D-364, Q-1180..Q-1189, B350..B359.

**Files you own:**
- src/arch/terrace.ts
- src/arch/meshes.ts
- src/arch/parts.ts
- src/arch/partsKey.ts
- src/arch/arris.ts
- src/arch/arris_joints.ts
- src/arch/arris_prism.ts
- src/arch/palacekit.ts
- src/arch/roofedge.ts
- src/arch/plan_walls.ts
- src/arch/decor.ts (merlons only)
- src/world/settlement/houses.ts
- src/world/settlement/kit.ts
- src/world/settlement/compounds.ts
- tools/blender/housekit.*
- tools/blender/palacekit.py
- tools/blender/palacebake.py
- tools/blender/decor_merlon.py
- new tools/blender/terracekit*

**Read-only, for context:**
- src/render/blockface.ts
- src/render/masonry.ts
- src/render/materials.ts (the surfaces package owns these next)
- src/render/probes/outdoor*.ts (the light field just merged: geometry changes must keep its walls; re-bake it with its own tool if the plan changes)
- research/BLENDER_PLAN.md rows 8, 17
- references/

**Start here (entry points):**
- src/arch/terrace.ts + meshes.ts: 3,681 bevelled boxes are the Terrace walls, floors and steps, the biggest share of every frame: a Blender kit of dressed blocks (several sizes, chipped arrises in geometry within ~12 m, B145) instanced along the measured courses, with LODs; floors as laid slabs with joints and wear along paths
- B186: palace wall faces are planar with vertex AO: kit wall panels with depth, baked normals for the roof-edge joists
- settlement/houses.ts + kit.ts: the house kit (D-311, D-324) put trims on box wall bodies: make the wall bodies themselves kit meshes (plaster, mudbrick showing through, sag, repairs, eroded foot) with three LODs and an impostor for far houses
- village compounds (B64) live in src/world/plain/** (the plain agent): leave them; note the hook for after plain merges

**Decisions and blockers that matter (grep these ids, do not read the files whole):** D-311, D-321, D-324, D-330, D-334, B145, B186, B64

**Commands:**
- node tools/dev/mkwt.mjs walls
- iterate on tools/dev/terrace_probe.html, palace_probe.html and tools/dev/house_probe.ts through gpu_slot.mjs
- node tools/blender/build.mjs <ids> (headless; one Blender process at a time)
- the light field: node src/render/probes/outdoor_probe.mjs or its bake tool if your geometry moves walls

**Done line:** In train views of the Terrace courts and stairs, a palace exterior and a town lane at the player's lens, no wall, floor, step or parapet reads as a box: chipped block edges and joints visible at 2-10 m, house walls irregular and weathered; triangles and draws within the frame agent's budget (frame time not worse by more than 2 ms); the light field still matches the walls.

**Render-train views to request:** stair-climb, apadana-nw-court, gate-w-day, terrace-wall-near, lane-with-child, tachara-s-stair, harem-portico

**Notes:** RESUME (session 15): your branch s14-walls already has stair/landing joint grooves within 12 m, palace mudbrick faces bowed (mudface.ts) and near merlons from Blender (f387992d, uncommitted nothing). First: fix decor_assets trim (`node tools/blender/decor.mjs trim`), tsc on your files. Then the big untouched share: TOWN HOUSE WALL BODIES as kit meshes (plaster, mudbrick showing through, sag, repairs, eroded foot) with 3 LODs + far impostor, then Terrace floors as laid slabs. Bulk across every house, not one showcase.
