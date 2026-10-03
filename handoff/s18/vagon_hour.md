# One hour on the Vagon T4 (lead 4, s18): the bulk that only the GPU box can do
Pull s17-int (419ee465 or later). Rules: CLAUDE.md "The GPU machine" + "16-core T4 box": every browser/bake through
`node tools/dev/gpu_slot.mjs <label> -- ...`, at most 2 full-world pages, never edit a tree a dev server is serving.
No new features. Machines do the work; agents only read numbers and fix. Two agents at most.

## Minute 0, start three jobs at once (scripts, near-zero tokens)
1. RENDER (GPU slot 1, one page load, BATCH=1): the 13 review views (renders/_sets/review.json on s18-renders-cloud) +
   the coverage points (tests/e2e/coverage.spec.ts), at the player's lens and quality, on ab009bc8 (= live). In the SAME
   load: pagecheck counts per view (tools/dev/pagecheck.mjs: people within 60 m drawn / planned / walking) and the
   banquet hall at its banquet hour. Push frames + numbers to s18-renders-cloud renders/<time>-gpu-ab009bc8/.
2. BAKE (GPU slot 2): merge cloud-s18-c13-court 0f68c08c (the robe) into a worktree, then
   `node tools/blender/impostors.mjs` and the scans.ktx2 re-bake (ktx_fresh), `npx vitest run tests/impostor_assets
   tests/ktx_fresh tests/people_models` green -> push branch vagon-robe.
3. CI (CPU, below-normal priority): `npx vitest run` full suite on s17-int; reds with owner file into handoff/s18/ci.md.

## Minute ~15, when the frames land: two blind reviewers (subagents, ~30 s each)
Cycle-0 prompts (handoff/s18/reset.md): a blunt game-art critic 1-10, and an AC Origins/RDR2/KCD2 player 1-10, on the
GPU frames. Scores into reset.md. This is the first review of today's work as a player sees it.

## Minute ~20, two fix agents (worktrees via tools/dev/mkwt.mjs), on probe pages, one verification render each at the end
A. PEOPLE ON SCREEN (owns src/people/(popview,crowd,navgrid,sim).ts): pick one townsperson whose plan says "walking" at
   10:00 and follow them from plan -> route -> drawn instance; fix the first break. Done = pagecheck >= 5 % walking at
   the town views, banquet hall seated at its hour, town bot stuck < 1 %.
B. THE REVIEWERS' TOP ITEM that is not people (light/haze, faces, walls, whichever both reviewers rank first), in the
   owner files named in handoff/s18/sessions.md.

## Minute ~55: merge both + vagon-robe into s17-int, run `npm run guards` + the touched tests, push s17-int and
cloud-s17-int; deploy (`git push origin <head>:s14-int`) only if the live path is lit with 0 faults
(tools/dev/budget.mjs). One DECISIONS line. Update handoff/s18/STATUS.md.
