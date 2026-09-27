# Brief: every inch real: the interiors (D-301; session 11)

You are a worker agent on PĀRSA (repo /home/user/fars, your own worktree branch; do not push). Read USER_DIRECTIONS.md,
MASTER_PLAN.md and CLAUDE.md first. The standard is every walkable area, at the player's lens and quality,
in motion, with sound, at every hour, season and weather. Your work serves the user directions UD-17, UD-06, UD-08 and the thresholds T-A7 ("share of the coverage sample's surface pixels drawn by a surface for which a scan exists (src/render/scans.ts SCAN_USE) but none is applied: a procedural stand-in" <= 0 %); T-A4 ("lowest rubric category score in any judged view" >= 4 score 1-5); T-A4cg ("judged views that read as CG" <= 0 count).

1. Say before you start how your change could pass its tests while the intent fails, and measure against that, not only the test.
2. Prefer the world-wide fix to the per-view fix. A fix proved in one view is not proved everywhere.
3. Evidence: node previews and CPU mirrors first; at most 3 browser runs through tools/dev/queue_e2e.sh.
4. Records: your reserved numbers are D-301, Q-790..Q-799, B103..B105; rows are appended, never renumbered.
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
- **Task:** make every roofed room read real at arm's length: the halls (floors: the glossy uniform red of breath-dawn; column shafts, bases and capitals; walls, ceilings, beams, doors and hangings), the Treasury store rooms (the faceted low-poly jars, the untextured goods, the flat red floor, jars standing in the walking line: shots/rooms-treasury-store-high-d276wip.png in the main tree), the garrison quarters (sleepers interpenetrating on shared mats, Q-732; black smears on the walls), the Harem apartments, the kitchens. Use the wood, plaster, clay, textile, leather, reed/matting, terracotta and metal scans; give props real geometry where their silhouette is the tell (jars, baskets, bales).
- **Context:** Scans: 13 CC0 scans are wired (src/render/scans.ts SCAN_USE, src/data/scans.json, public/textures/). 90 more CC0 materials (Poly Haven, ambientCG; 2K diff/nor/arm|rough/ao/disp) wait in C:\Users\Administrator\fars-assets\textures\ with manifest.json and contact sheets (sheet_1..3.png): copy what you use into public/textures/<id>/ (diff.jpg and arm.jpg, or build an arm from rough+ao), add it to src/data/scans.json with its measured means (as the first 13 were measured) and to ASSET_LEDGER.md. Mind WebGPU's 16 samplers per fragment stage (each scan texture costs one; D-295). Normal maps are not wired yet: wiring them (triplanar, UDN blend) is in scope if you need them. Reference photos: references/ (INDEX.md) and, once the photo download finishes, C:\Users\Administrator\fars-assets\photos\ (Wikimedia, with manifest.json). Photo #24 targets (display sRGB luma): wall 86.7 (rgb 109/82/66), ground 118, sky 170; ratios wall/ground 0.73, wall R/B 1.65 (the Now view; 467's stone was fresher: D-285).
- **Areas:** every roofed room of the Terrace (D-276's rooms included)
- **Files in scope:** src/render/scans.ts, src/render/materials.ts, src/data/scans.json, src/world/furnish.ts, src/arch/rooms.ts, src/arch/terrace_rooms.ts, the props under src/world/, public/textures/, ASSET_LEDGER.md
- **Done means:** T-A7 0 inside; the treasury-store, garrison-quarters-night and breath-dawn views re-rendered with each named fault fixed or logged; a blind reviewer's materials score >= 3 on the interior frames
- **Reserved numbers:** D-301, Q-790..Q-799, B103..B105.
- **Render budget:** 3 browser runs, every view of a run in one page load (BATCH=1); at the player's lens (FOV=game) and Q=high, plus the calib views at their own lens where the photo comparison needs it.
