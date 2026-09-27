# Brief: every inch real: the people seen close (D-304; session 11)

You are a worker agent on PĀRSA (repo /home/user/fars, your own worktree branch; do not push). Read USER_DIRECTIONS.md,
MASTER_PLAN.md and CLAUDE.md first. The standard is every walkable area, at the player's lens and quality,
in motion, with sound, at every hour, season and weather. Your work serves the user directions UD-17, UD-08, UD-06 and the thresholds T-A7 ("share of the coverage sample's surface pixels drawn by a surface for which a scan exists (src/render/scans.ts SCAN_USE) but none is applied: a procedural stand-in" <= 0 %); T-A4 ("lowest rubric category score in any judged view" >= 4 score 1-5); T-A4cg ("judged views that read as CG" <= 0 count); T-E1d ("pairs of people within 15 m of the player closer than d* in the population-SD-scaled face and body parameter vector (head dimensions visible at 15 m); d* = distance at which blind reviewers say "same person" 50 % of the time on rendered head crops at 1 m and 5 m" <= 0 pairs).

1. Say before you start how your change could pass its tests while the intent fails, and measure against that, not only the test.
2. Prefer the world-wide fix to the per-view fix. A fix proved in one view is not proved everywhere.
3. Evidence: node previews and CPU mirrors first; at most 3 browser runs through tools/dev/queue_e2e.sh.
4. Records: your reserved numbers are D-304, Q-820..Q-829, B112..B114; rows are appended, never renumbered.
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
- **Task:** make the people read real at conversation distance (1-3 m) and in crowds: skin (the procedural skin, D-155, against MakeHuman's CC0 skins in C:UsersAdministratorars-assetshumansmakehuman_cc0: calibrate or replace albedo and detail, pores, age; varied, never identifiable face scans), eyebrows, lashes, hair (MakeHuman CC0 proxies), eyes, teeth; cloth (the procedural weave, D-155, against the linen, wool, felt, burlap, hessian and leather scans: weave, fibre, sheen, dirt, wear); the clothes' drape; the impostors at distance (no belly, flat). Evidence for dress: the reliefs and research/ (Achaemenid dress; the Iranica articles in C:UsersAdministratorars-assetssourcesiranica may be read, not copied into the repo). No modern hair or garments; nothing identifiable.
- **Context:** Scans: 13 CC0 scans are wired (src/render/scans.ts SCAN_USE, src/data/scans.json, public/textures/). 90 more CC0 materials (Poly Haven, ambientCG; 2K diff/nor/arm|rough/ao/disp) wait in C:\Users\Administrator\fars-assets\textures\ with manifest.json and contact sheets (sheet_1..3.png): copy what you use into public/textures/<id>/ (diff.jpg and arm.jpg, or build an arm from rough+ao), add it to src/data/scans.json with its measured means (as the first 13 were measured) and to ASSET_LEDGER.md. Mind WebGPU's 16 samplers per fragment stage (each scan texture costs one; D-295). Normal maps are not wired yet: wiring them (triplanar, UDN blend) is in scope if you need them. Reference photos: references/ (INDEX.md) and, once the photo download finishes, C:\Users\Administrator\fars-assets\photos\ (Wikimedia, with manifest.json). Photo #24 targets (display sRGB luma): wall 86.7 (rgb 109/82/66), ground 118, sky 170; ratios wall/ground 0.73, wall R/B 1.65 (the Now view; 467's stone was fresher: D-285).
- **Areas:** every person, near (conversation distance) and far (crowds, impostors)
- **Files in scope:** src/people/humanMaterial.ts, src/people/outfits.ts, src/people/humanGPU.ts, src/people/impostors.ts, public/generated/humans/, tools/build_humans*, src/render/scans.ts, public/textures/, ASSET_LEDGER.md
- **Done means:** a portrait set (20 people, every class, 1.5 m, day and fire light) and crowd views rendered before and after; a blind reviewer's score >= 3 on skin, hair and cloth; T-E1d not regressed; ASSET_LEDGER rows for every asset
- **Reserved numbers:** D-304, Q-820..Q-829, B112..B114.
- **Render budget:** 3 browser runs, every view of a run in one page load (BATCH=1); at the player's lens (FOV=game) and Q=high, plus the calib views at their own lens where the photo comparison needs it.
