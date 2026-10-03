# Session 18: START HERE (written by the s17 cloud lead, 2026-10-03 ~02:30 UTC)

Read first: USER_DIRECTIONS.md, CLAUDE.md, sessions/s17-cloud.md (the cloud's report, broken first), sessions/s17.md (Vagon's
report, when it exists), handoff/s17/asks_vagon.md and asks_cloud.md (the last lines are the open asks).

## Where things stand
- **Branches.** s14-int deploys the live site. s17-int is Vagon's integration; cloud-s17-int the cloud's (it holds all of s17-int
  up to ~01:30 plus every cloud agent). Whether s17-int reached s14-int tonight: see sessions/s17.md / `git log origin/s14-int`.
  Start the next integration from whichever is newest: s14-int if the deploy happened, else s17-int after merging cloud-s17-int.
- **The honest picture (crude cloud frames + 2 T4 frames):** the world does NOT yet read as AAA or filled in. Known faults, in the
  order to fix (each is in asks_vagon.md with its owner):
  1. The town seen from above draws ROOFLESS (walls only): a house far-LOD / roof draw-distance fault. Check on the T4 first.
  2. Town lanes: the ground fill along the walls (jars, mats, litter, tools) did not show in the lane frame: not drawn or sunk.
  3. The river Pulvar is a ruler-straight canal with a fence of reeds standing in the water.
  4. The plain reads as a smeared khaki sheet; fields are flat saturated-green rectangles; little stands on it at 0.3-2 km.
  5. Far views have no sun shadow past 600 m (sunShadows.ts maxFar): add a static far cascade for the Terrace and town.
  6. Night: a magenta band on the horizon, a fan of light streaks from one horizon point, clouds as dark blobs; a bright streak on
     Kuh-e Rahmat by day.
  7. People standing in doorways and packed Terrace crowds block the walk (V3 step-aside, C10 spacing); 2 houses cannot be
     entered (B580).
- **The bottleneck of s17 was seeing, not building:** the T4 needs 10-13 min of shader compiles per new time/weather state, so only
  2 frames were published all day and ten agents built blind. Vagon's V7 (branch s17-compile, report_compile.md) worked on it.

## The next session, in order
1. **Fix the per-state shader compile first** (V7's findings), so a whole view set renders in one load in minutes, not hours.
2. **Render before building:** one batched set of views over town, lanes, plain, river, Terrace, interiors, night, at the
   player's lens on the T4, published to s17-renders (`node tools/dev/scoreboard.mjs run` + `publish`). Judge by eye.
3. **Bulk-fix what the frames show**, worst screen share first (the list above is the starting guess), with agents that can SEE
   their class: on Vagon for the look; the cloud's software renderer (`?webgl=1`, the cloud eyes driver on branch
   s17-renders-cloud renders/_tools) for crude checks of placement and emptiness.
4. Keep what worked in s17: the ownership audit before launch (tools/dev/owners_s17.py: every file one owner, plus the player's
   experience listed against owners), merges pushed at once when guards and owners pass, CI in its own cloud session, built assets
   `git add -f` (public/models is in .gitignore), the asks files read every round.

## Tools that exist now
- Blender and KTX2 in the cloud: `BLENDER=$PWD/tools/blender/bpy_cli.sh KTX=$PWD/tools/blender/ktx_cli.sh node tools/blender/build.mjs <id>`
  (pip bpy 5.0.1; npm ktx2-encoder).
- The frozen scoreboard: tests/data/scoreboard_s17.json; coverage.spec takes SET= and FULL_DIR=; tools/dev/scoreboard.mjs.
- Cloud installs: `npm ci --ignore-scripts && git config core.hooksPath .githooks` (onnxruntime's download is blocked in the cloud).
- Sound recordings: Vagon runs `node tools/audio/fetch.mjs` once (internet + ffmpeg) and pushes public/audio (asks_vagon C8 line).
