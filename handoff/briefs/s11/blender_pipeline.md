# Brief: the Blender asset pipeline: inventory, pipeline, a hero asset, the rollout plan (D-305; session 11)

You are a worker agent on PĀRSA (repo /home/user/fars, your own worktree branch; do not push). Read USER_DIRECTIONS.md,
MASTER_PLAN.md and CLAUDE.md first. The standard is every walkable area, at the player's lens and quality,
in motion, with sound, at every hour, season and weather. Your work serves the user directions UD-17, UD-06, UD-01 and the thresholds T-A7 ("share of the coverage sample's surface pixels drawn by a surface for which a scan exists (src/render/scans.ts SCAN_USE) but none is applied: a procedural stand-in" <= 0 %); T-A4 ("lowest rubric category score in any judged view" >= 4 score 1-5); T-A4cg ("judged views that read as CG" <= 0 count).

1. Say before you start how your change could pass its tests while the intent fails, and measure against that, not only the test.
2. Prefer the world-wide fix to the per-view fix. A fix proved in one view is not proved everywhere.
3. Evidence: node previews and CPU mirrors first; at most 3 browser runs through tools/dev/queue_e2e.sh.
4. Records: your reserved numbers are D-305, Q-830..Q-839, B115..B117; rows are appended, never renumbered.
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
- **Task:** Blender 5.0.1 is now available headless on this machine (CLAUDE.md, the GPU machine). (1) INVENTORY every geometry and asset the project builds by hand in code (src/arch/**, src/world/** props and furnishings, src/people/** bodies, garments, hair, animals, src/world/trees, the plain's objects, sculpt/reliefs, impostors) and rank each by the visual payoff of real modelled geometry and baked maps against effort and runtime budget (triangles, draw calls, GPU memory, download: gates/budget.json, the T-K rows). Name what Blender cannot help (simulation, sky, audio). (2) BUILD THE PIPELINE: tools/blender/ scripts driven by the project's own data (research/SITE_SPEC.md, src/data/*.json; numbers before pictures, CLAUDE.md §3: every dimension sourced or tier C with its reasoning in the script), exporting GLB with Draco and KTX2 (Basis) textures (the KTX tools installer is in C:UsersAdministratorars-assets	ools; ask the lead before installing anything), LODs and impostors, normal/AO bakes on the T4 (Cycles OptiX); a node loader path in the game (three GLTFLoader + DRACO/KTX2 decoders served locally), provenance per asset (the script, its inputs, ASSET_LEDGER row), and a test that every generated asset stays within its budget and is reproducible (hash of inputs → output). (3) PROVE IT on one hero asset end to end in the game at budget: the Treasury's stored goods (the faceted jars, bowls, rhyta, bales, baskets on the benches of D-276's store rooms; the interiors agent D-301 may be touching the same props: coordinate through the lead, do not edit its files) or, if that overlaps, one column capital type from SITE_SPEC; rendered before/after at the player's lens. (4) WRITE THE ROLLOUT PLAN: docs in research/BLENDER_PLAN.md: per area and asset class, what to model, the sources that drive it, the budget, the order by payoff; which area agents should use it and how.
- **Context:** Scans: 13 CC0 scans are wired (src/render/scans.ts SCAN_USE, src/data/scans.json, public/textures/). 90 more CC0 materials (Poly Haven, ambientCG; 2K diff/nor/arm|rough/ao/disp) wait in C:\Users\Administrator\fars-assets\textures\ with manifest.json and contact sheets (sheet_1..3.png): copy what you use into public/textures/<id>/ (diff.jpg and arm.jpg, or build an arm from rough+ao), add it to src/data/scans.json with its measured means (as the first 13 were measured) and to ASSET_LEDGER.md. Mind WebGPU's 16 samplers per fragment stage (each scan texture costs one; D-295). Normal maps are not wired yet: wiring them (triplanar, UDN blend) is in scope if you need them. Reference photos: references/ (INDEX.md) and, once the photo download finishes, C:\Users\Administrator\fars-assets\photos\ (Wikimedia, with manifest.json). Photo #24 targets (display sRGB luma): wall 86.7 (rgb 109/82/66), ground 118, sky 170; ratios wall/ground 0.73, wall R/B 1.65 (the Now view; 467's stone was fresher: D-285).
- **Areas:** the whole project (inventory), one hero asset (proof)
- **Files in scope:** tools/blender/** (new), a loader module under src/render/ or src/world/ (new), public/models/ (new), tests for budgets and reproducibility, research/BLENDER_PLAN.md, ASSET_LEDGER.md; read-only elsewhere
- **Done means:** the inventory ranked with numbers; the pipeline runs from a clean checkout (one command regenerates every asset); the hero asset in the game within budget, rendered before/after, a reviewer's read; research/BLENDER_PLAN.md; the budget and reproducibility tests passing
- **Reserved numbers:** D-305, Q-830..Q-839, B115..B117.
- **Render budget:** 3 browser runs, every view of a run in one page load (BATCH=1); at the player's lens (FOV=game) and Q=high, plus the calib views at their own lens where the photo comparison needs it.
