# HANDOFF — end of session 5 (2026-09-24, ~01:00)

Read `CLAUDE.md` first (the resume procedure), then this file, then `PROGRESS.md` (problems first), `TASKS.md`,
`DECISIONS.md` and `BLOCKERS.md`. Session 5 decisions: D-174 (lead); the agents' D-143 addendum, D-160..D-168 live only
in the bundles below until merged. Open questions up to Q-269 on the branch (the bundles add Q-270..Q-287).
**Branch:** `claude/amazing-fermi-40ds7j` (sessions 2–5). Never force-push.

**Session start:** `git fetch origin claude/amazing-fermi-40ds7j && git status -sb`, then `npm ci`, then
`pip install pillow numpy scipy` (for tools/dev/*.py and pixel checks).

## State at the end of session 5 (the pushed branch)
- tsc clean; vitest: 519 passed / 1 skipped at session start, plus the session's new files (fx_shader, roofs, aerial
  additions: all pass); lint:all OK; offline walkthrough bot 97/97 legs.
- **Soak PASSES all 8 gates on the session-4 (D-150) simulation** (bench-reports/soak-2026-09-24T00-01-47-708Z.json).
- **Nothing from the agents is merged.** All session-5 agent work is in `handoff/branches/*.bundle` (below).

## What is broken, unverified or placeholder (read first)
1. **No gate after Phase 2 has passed.** §8.2 rubric, Phase 3+4 / 5 / 6+7 reviews still not run. The full high-quality
   render pass has NOT run (only smoke renders; see 5).
2. **Shadow review round 5 FAILED** (REVIEWS/shadow_phase5_r5.md A: 1/20 < 4; _b.md B: 3/20 < 4). Blocking: outdoor field
   work starts into rain and people "shelter" for hours in open fields; planners use the start-of-year age; the camp's
   flour/grain are not real goods. Fixes are WIP in `s5_sim-r5.bundle` (unverified).
3. **Phase 8 review FAILED** (REVIEWS/phase8.md, phase8_b.md). Critical: carved Old Persian misspelled vs the published
   sign sequence (22 % of words); translation status contradicted by the records. Fixes WIP in `s5_p8-carving.bundle` and
   `s5_p8-layer.bundle`. **The music/occlusion and writing-on-objects workstreams never started** (majors: no music in the
   world, no audio occlusion, blank tablets, no Aramaic leather, sealing not flagged).
4. **Crowd at scale (D-143) still not on the branch.** Merged + fixed + reviewed in `s5_crowd-merge-s5-fixr1.bundle`;
   the last fix round is WIP. B11 (≥ 300 visible met in 1 of 7 views), B12 (court in full assembly not simulated), B13
   (3 of 7 views > 12 M triangles) stand.
5. **Renders this session:** smoke at test and high (stair-climb-pm, tripylon-n-stair) — WebGPU, no shader error at high
   after the fix below. Plain2 (village-p22, naqsh-200m, naqsh-200m-am, naqsh-kaba-40m) at high: **reads as CG** (the
   Naqsh cliff a smooth sheet with vertical streaks, flat grey tomb façades, the Ka'ba a white box; village walls flat
   boxes; orchard trees sparse). Tripylon relief figures read as flat painted cut-outs at high. WebGL2 at quality test
   renders; **WebGL2 at high timed out** (8 frames of one view > 23 min). shots/ is gitignored: re-render to see them.
6. **Unverified lead fixes (D-174, node-tested only):** effect materials at test/low (fixed a real compile failure),
   aerial perspective inside the halls (the white veil), no rain/wetness under roofs. **Undiagnosed:** white blotches on
   the Hadish red floor (WebGL2, quality test; not puddles). Jobs 050/051 compare the two backends.
7. **Licence check before merging `p8-carving`:** it adds `data/corpus/livius_op.json` (a Livius-derived OP corpus), while
   the layer workstream established that Livius pages are "All rights reserved" (B17a). Decide whether a sign-by-sign
   transliteration copied from Livius may be stored, or rebuild the corpus from a licensed source / the lexicon, and record
   it in ASSET_LEDGER.md.
8. Carried over from session 4 and still open: probe blotches in the Apadana hall; trees' oak impostor r3 miss; calibration
   scene blocked (NEEDS #13); bench numbers void since D-047; stretch goals not started.

## The bundles (`handoff/branches/`, each verified with `git bundle verify`)
Fetch one: `git fetch handoff/branches/<file>.bundle <branch>:<branch>` (the prerequisite commit is on the pushed branch).
| bundle | branch | base | state |
|---|---|---|---|
| s5_crowd-merge-s5-fixr1.bundle | crowd-merge-s5-fixr1 | ab2949e | crowd-d143 merged onto D-142 (91f4ea6), fixes + tests (ca5d6e3), CPU addendum (ebd1e2f): tests/lint/bot were run by the merge agent; reviewers (3 lenses) then found issues (e.g. a shared work object anchored to the lowest drawn pid jumps 20–28 m when the camera turns); fix round 1 is the **WIP commit 2e34fc9, not re-tested or re-reviewed**. The view-cost timing test fails under load (population plans now p50 145–202 µs). |
| s5_sim-r5.bundle | sim-r5 | 7a09285 | one **WIP commit 23b605e**: round-5 fixes across population.ts, sim.ts, planCheck.ts, calendar.ts (sunTimes), lives.json, new tests/people_days_r6.test.ts; stopped mid-work: tests not run to completion, no verifier, no soak |
| s5_p8-carving.bundle | p8-carving | 7a09285 | one **WIP commit a56a128**: carving from a sign-by-sign transliteration, incised signs (src/render/incision.ts, src/arch/carving.ts), inscription data, research/OP_SIGNS.md; unvalidated; see licence item 7 |
| s5_p8-layer.bundle | p8-layer | 7a09285 | de3ae7a + bd6d483 complete (every line reachable via exchanges.ts, layer shows the looked-at version, lint sees audio/data/carved signs, Aramaic citations, voice acceptance measured and NOT met: B17b; Livius all rights reserved: B17a; D-167, D-168, Q-284..Q-287), then **WIP 7b1f1ee** (small edits to world.ts, language.test.ts, DECISIONS) not verified |
| crowd_D143.bundle | (session 4) | — | superseded by s5_crowd-merge-s5-fixr1 (it contains it) |

## Next steps, in order
1. Session start (above); tsc; `npx vitest run --maxWorkers=2`; lint:all; `npx tsx tools/dev/botcheck.ts`.
2. **Crowd:** fetch `s5_crowd-merge-s5-fixr1`, review the WIP 2e34fc9 diff, run the people/crowd/popview/performance tests
   (timing tests alone), lint:all, botcheck; fix; merge into the branch. Then one crowd render (tests/e2e/crowd_scale.spec.ts).
3. **Sim:** fetch `s5_sim-r5`, finish it against both round-5 reviews (the WIP commit message lists the areas), run the
   people tests and `npm run soak` (~50 min under load); then shadow review **round 6 on a new, unseen pick seed** (not
   7/11/23/37/53/71/89/97) with two fresh reviewers (round-3 protocol, as in session 5's workflow).
4. **Phase 8:** merge `p8-layer` (verify the WIP commit), resolve the licence question (item 7) and finish `p8-carving`;
   start the two workstreams that never ran: music in the world + audio occlusion (Phase 8 A-M3/B-M2, B-M5, B-M7) and
   writing on objects (A-M4). Then a fresh Phase 8 review.
5. **Court in full assembly (B12; §1.1 moment; Phase 5 gate):** population.json gives the Terrace 5,000 by day with the
   court resident, the town +13,000 retinue, the plain +6,000; the population does not use them. Model the court's people
   (guards at full ceremonial strength, officials, servants, table staff, petitioners, delegations) as C-tier plans on the
   Terrace places once the crowd merge draws population people; add a camera-rig moment and `soak --court`. This also
   lifts B11 (≥ 300 visible).
6. **Full high-quality pass:** `tools/dev/render_runner.sh <work dir>` and `LIMIT=1500 tools/dev/e2e_watchdog.sh` in the
   background (start the watchdog with LIMIT=3600 while job 170 runs), copy `handoff/render_jobs/*.job` into
   `<work dir>/jobs/` (050/051 first: they check D-174; then the 1xx moments; walkthroughs 18x and bench 19x last).
   ~6 h of queue. Look at every PNG.
7. §8.2 rubric and the Phase 3+4, 5, 6+7 reviews (`handoff/review_briefs.md`). The look is weak across the board (item 5):
   expect a long fix list; prioritise by how many moments each fault touches.
8. Phase 9: README budgets, FINAL_REPORT.md (problems first).

## Tools and gotchas (additions in session 5; the session-4 list below still applies)
- **Workflows have a concurrency cap of min(16, CPUs − 2) = 2 agents** on this 4-core box. Run 2–3 workflows at once at
  most; each agent's vitest must use `--maxWorkers=1`. Workflow agents with `isolation: 'worktree'` cannot check out a
  branch that another worktree holds: tell a fix agent to `git checkout -b <new> <branch>` instead.
- **Stopping a session:** agent work lives in `.claude/worktrees/*` and is lost with the container. Commit each worktree
  (WIP) and `git bundle create handoff/branches/<name>.bundle claude/amazing-fermi-40ds7j..<branch> <branch>`.
- `tests/e2e/moments.spec.ts` takes `FRAMES` and `TIMEOUT` (s) env overrides.
- A render at quality high takes 10–25 min per job; at test ~12–20 min per page load under load.
- The round-5 shadow input `REVIEWS/shadow_days_input_seed1_pick97.txt` was regenerated on the merged tree: it differs
  from the saved copy only by the placeholder tags D-142 removed.

## Gotchas (sessions 2–4, still true)
- **`pkill -f <pattern>`:** never with a pattern in your own command line; it kills your own shell. Use PIDs.
- **Long Playwright runs:** don't pipe them through `head`.
- **TSL:** no runtime `select()` under TRAA; `pow()` of a negative base is NaN; reversed-edge `smoothstep` is undefined;
  r186 binds a `Data3DTexture` through a 2-D view and fails; colour uniforms type-check only against floats.
- **Frames outside three's animation loop** must advance `renderer._nodes.nodeFrame` (D-047); use `__parsa.setTime`.
- **`world.update` ctx:** `ctx.sky` is `sky.state`; the SkySystem is `ctx.skyLight`.
- **Vitest console output is suppressed:** write debug dumps to a file. Timing tests fail under load: re-run alone.
- **Removing old agent worktrees** is refused by the permission classifier. Leave them.
- **The runner snapshots the tree when a job takes the lock**, not when queued: never leave code and generated data out
  of step while a job may start.
- **Light probes:** rebuild with `WORKERS=3 npx tsx tools/build_probes.ts` after architecture or SURFACES albedo changes;
  `npx tsx tools/build_nav.ts` after architecture changes; `npx tsx tools/build_horizon.ts` for the horizon map.
- **Effect materials** must use `colourOnly()`; **small indoor objects must receive shadows**.
- **Subagents cannot write report files outside their worktree:** ask for the report in the final message.
