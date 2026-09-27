# Brief: the carving: capitals and the Gate colossi from the photographs (Blender) (D-306; session 11)

You are a worker agent on PĀRSA (repo /home/user/fars, your own worktree branch; do not push). Read USER_DIRECTIONS.md,
MASTER_PLAN.md and CLAUDE.md first. The standard is every walkable area, at the player's lens and quality,
in motion, with sound, at every hour, season and weather. Your work serves the user directions UD-17, UD-06, UD-01, UD-05 and the thresholds T-A4 ("lowest rubric category score in any judged view" >= 4 score 1-5); T-A4cg ("judged views that read as CG" <= 0 count); T-A5 ("paired photo test: blind reviewer pick accuracy (render vs site photograph from its solved camera)" <= 100 %).

1. Say before you start how your change could pass its tests while the intent fails, and measure against that, not only the test.
2. Prefer the world-wide fix to the per-view fix. A fix proved in one view is not proved everywhere.
3. Evidence: node previews and CPU mirrors first; at most 3 browser runs through tools/dev/queue_e2e.sh.
4. Records: your reserved numbers are D-306, Q-840..Q-849, B118..B120; rows are appended, never renumbered.
5. Never lower or reword a threshold (tests/gates_ratchet.test.ts); a threshold you cannot meet goes to BLOCKERS with ≥ 3
   approaches measured.
6. Lead your final report with what is broken, placeholder or unverified on screen; list tests run with results; run
   `git checkout bench-reports/` before committing.
7. Heavy CPU work (soaks, bots, audio renders, bakes, long test runs) goes through `tools/dev/cpu_slot.sh`, one process at a
   time: the four cores are shared with the render lane.

## Machine
On the GPU machine (session 11 on: Windows, NVIDIA T4, 16 cores, 63 GB, open internet), this clause governs where it
   differs from 3 and 7. Render with Playwright directly on the real GPU (`PW_CHANNEL=chrome --project=gpu`, your own
   E2E_PORT), at the player's lens and quality; a page load is ~11 min, a warm frame 0.1 s, so put all your views in one
   load (moments.spec.ts `BATCH=1`). Never edit files in a tree whose dev server is serving a render (it reloads the page).
   Run node jobs directly (no cpu_slot.sh, flock or python here). Surfaces must read as real at arm's length: use CC0
   scans and assets (Poly Haven, ambientCG; src/render/scans.ts; each recorded in ASSET_LEDGER.md) over the procedural
   base, keeping the measured tints and layouts; a procedural stand-in where a scan exists is a placeholder.

## Slots
- **Task:** Q-830 (D-305): the baked protome still reads as CG because the model lacks the carving the real capitals show: bead rows, harness bands, rosettes, ridged locks. Using the photographs (C:UsersAdministratorars-assetsphotoscolumns_capitals, apadana, gate_of_all_nations, reliefs; references/ INDEX.md; the ISAC Schmidt volumes in C:UsersAdministratorars-assetssourcesoip68..70 for measured drawings, read only) and SITE_SPEC's dimensions, model the carving of: the protome capitals (bull; and the other protome types the Terrace uses), the volute and bell members of the column orders (BLENDER_PLAN rows 1), and the Gate of All Nations' colossi (row 2: human-headed bulls and bulls), as procedural-parametric Blender scripts (displacement/sculpt layers driven by measured profiles; tier B where a drawing gives the dimension, C where a photo is matched by eye, the reasoning in each script). Switch KTX2 on. Use the D-305 pipeline (research/BLENDER_PLAN.md, tools/blender/build.mjs, src/render/models.ts, tests/blender_assets.test.ts): every asset a script driven by project data, reproducible, within budget, provenance in ASSET_LEDGER; KTX-Software 4.4.2 is now installed (C:/Program Files/KTX-Software/bin/ktx.exe): switch the pipeline's KTX2 path on and verify it in the game. Iterate on a probe page that loads only your assets (CLAUDE.md: probe pages ~10 s; the full world 11-30 min), and spend full-world renders on the final check only, through tools/dev/gpu_slot.mjs.
- **Context:** Scans: 13 CC0 scans are wired (src/render/scans.ts SCAN_USE, src/data/scans.json, public/textures/). 90 more CC0 materials (Poly Haven, ambientCG; 2K diff/nor/arm|rough/ao/disp) wait in C:\Users\Administrator\fars-assets\textures\ with manifest.json and contact sheets (sheet_1..3.png): copy what you use into public/textures/<id>/ (diff.jpg and arm.jpg, or build an arm from rough+ao), add it to src/data/scans.json with its measured means (as the first 13 were measured) and to ASSET_LEDGER.md. Mind WebGPU's 16 samplers per fragment stage (each scan texture costs one; D-295). Normal maps are not wired yet: wiring them (triplanar, UDN blend) is in scope if you need them. Reference photos: references/ (INDEX.md) and, once the photo download finishes, C:\Users\Administrator\fars-assets\photos\ (Wikimedia, with manifest.json). Photo #24 targets (display sRGB luma): wall 86.7 (rgb 109/82/66), ground 118, sky 170; ratios wall/ground 0.73, wall R/B 1.65 (the Now view; 467's stone was fresher: D-285).
- **Areas:** the column capitals (all orders) and the Gate colossi
- **Files in scope:** tools/blender/**, public/models/**, src/render/models.ts, src/arch/sculpt.ts and meshes.ts hooks (small), tests/blender_assets.test.ts, research/BLENDER_PLAN.md, ASSET_LEDGER.md
- **Done means:** the capitals and colossi carved and in the game within budget with KTX2 textures; before/after renders at the player's lens beside the photographs; a blind reviewer's score >= 3 on them (from 1-2); T-A5 photo pairs where a photograph matches a view
- **Reserved numbers:** D-306, Q-840..Q-849, B118..B120.
- **Render budget:** 3 browser runs, every view of a run in one page load (BATCH=1); at the player's lens (FOV=game) and Q=high, plus the calib views at their own lens where the photo comparison needs it.
