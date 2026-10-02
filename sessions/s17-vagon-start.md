# Vagon, session 17: START HERE (written by the cloud lead)

Branch: **cloud-s17-int** (= s14-int + the revised plan + the cloud's tooling). Read sessions/s17-vagon-v2.md (the plan; you
are the "Vagon" side and its lead), then CLAUDE.md and USER_DIRECTIONS.md.

## First 20 minutes
1. `git fetch origin && git checkout -B s17-int origin/cloud-s17-int && git push -u origin s17-int`; `git config
   core.autocrlf false`; `npm ci`. Merge origin/s14-monuments into s17-int (the Gate colossi's scan route; V4 finishes it).
2. Which box: `node -e "const o=require('os');console.log(o.cpus().length,(o.totalmem()/2**30).toFixed(0)+' GB')"`.
   BIG (16 cores, 63 GB): `setx MAX_AGENTS 5`, `setx GPU_SLOTS 2`, `setx MIN_FREE_GB 6` (boxguard, mkwt and gpu_slot read
   these; open a new shell after setx) and record it in DECISIONS (D-470). SMALL (4 cores, 16 GB): keep the defaults (2
   agents, 1 slot) and run V1+V2, then V3+V4, as the plan says.
3. Start V1 light, V2 materials, V3 people (briefs: write each from the plan's Vagon table into handoff/briefs/s17/v<n>_*.md,
   short; agent template operating model; reserved numbers already in handoff/reserved_numbers.md).

## The baseline (hour 0-1.5)
- Budget baseline: `node tools/dev/gpu_slot.mjs budget -- node tools/dev/budget.mjs --accept` (it is null today).
- Scoreboard, one load (46 views, ~1.5-2 h): `node tools/dev/scoreboard.mjs run --label baseline`, then
  `node tools/dev/scoreboard.mjs publish <the dir it prints>` (pushes 1280-px frames + index to branch s17-renders: the cloud
  agents judge their work from these). Run it from a worktree nobody edits (CLAUDE.md: never edit a tree a render serves).
- Judge the frames; write what reads as CG or empty, by screen share, into handoff/s17/asks_cloud.md for the cloud classes
  (town fill, plain fill, roads, far land, screens, load) and re-point your own agents.

## Every ~90 min
`git fetch origin cloud-s17-int && git merge origin/cloud-s17-int` into s17-int (the cloud's six agents, pre-merged), merge
your agents, `npm run guards`, budget, then a focus train: `node tools/dev/scoreboard.mjs focus <asks.json> --worst 5 --from
<last scoreboard dir>/coverage.json` and `scoreboard.mjs run --set tests/data/focus_s17.json --label focus`, publish, push
s17-int. The cloud reads handoff/s17/asks_vagon.md requests from its branch; turn them into the asks.json views.

## End of day
Per the plan's "Last 90 minutes": final scoreboard (`--label final`), publish, built-site load + budget, then and only then
s17-int -> s14-int (it deploys). sessions/s17.md leads with what is still broken.
