# Agent: people (D-313; Q-900..Q-909, B136..B138). Worktree T:/fars-wt/people, branch s12-people, E2E_PORT=5305.
TASK: the people's FORMS in Blender, every class and the crowd (reviewers: hair "helmets", "boxy dress"; B121, B123).
1. Garments: cloth simulation of each costume's pattern on the MakeHuman body (tools/blender/cloth.py, people.json; the D-307 route),
   baked to meshes with fold normal maps, skin weights transferred; real belts and sashes (knotted, hanging ends); the Persian
   court robe with its sleeve and front pleats, the riding dress (tunic, trousers, cloak), the workers' tunics, women's dress and
   veils per the evidence tiers in src/people/outfits.ts. Every one of the 8 costumes x 4 LODs replaced: src/people/outfits.ts,
   drape.ts consume the baked meshes.
2. Hair and beards from Blender hair curves converted to hair cards with alpha + normal atlases (tools/blender/hair_atlas.py; the
   fillet-bound curled hair and the squared curled beard of the reliefs; women's hair; children's), every person (src/people/looks.ts).
3. Posed drapes (B123) where the rig allows; the crowd LODs keep the same silhouettes.
Keep the people triangle budgets [42 k, 7 k, 3.2 k, 800]. Iterate in humanlab.html. Do not touch houses, props, monuments, lighting.

## As sent (the lead adapted clauses 3 and 7 to the GPU machine and this session; slots are filled in the task above)

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
- TIME: you have ~75 minutes wall-clock from launch. Commit working, wired-in states at least every 20 minutes (a class that is
  built but not placed in the world counts for nothing). At ~70 minutes stop building, make the final commit and report.
- DISK: C: has ~6 GB free. Your worktree is on T:. Put ALL downloads and scratch in T:/fars-assets-s12/<your agent name>/ (each
  download with a manifest.json entry: url, licence, sha256). Commit to git ONLY what the game loads (public/models/…, Draco
  geometry, KTX2 or compressed JPG/WebP textures at the size the game needs); keep your committed additions under ~80 MB.
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
