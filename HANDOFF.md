# HANDOFF — end of session 6 (2026-09-24, evening)

Read `CLAUDE.md` first (the resume procedure), then this file, then `PROGRESS.md` (problems first), `TASKS.md`,
`DECISIONS.md` and `BLOCKERS.md`. Session 6 decisions: D-175 … D-193. Agent reports: `REVIEWS/agent_reports_session6.md`.
**Branch:** `claude/amazing-fermi-40ds7j` (sessions 2–6). Never force-push.

**Session start:** `git fetch origin claude/amazing-fermi-40ds7j && git status -sb`, then `npm ci`, then
`pip install pillow numpy scipy` (pixel checks) and, for the voice tools only, `pip install espeakng-loader
praat-parselmouth soundfile` (D-185).

## State at the end of session 6
- **Everything from sessions 5–6 is merged** (no bundles pending): crowd at scale (D-143), sim rounds 5–7 (D-175, D-186,
  D-191, D-193), court in full assembly (D-182), Phase 8 layer/music/occlusion/writing/carving/voices (D-167, D-168,
  D-176..D-179, D-184, D-185, D-192), lead render fixes (D-180, D-181, D-183), and the four look workstreams from the
  §8.2 rubric first pass (D-187 bugs and framing, D-188 surfaces and outdoor light, D-189 people, D-190 landscape).
- tsc clean; targeted suites pass on the merged tree; lint:all OK (chrono, lang 26/26, activity 0 placeholders, music);
  botcheck 97/97. CPU timing tests (performances "300 performers" 10 ms, popview view-cost) fail under load on this shared
  box and pass or nearly pass alone — never loosened; they need a quiet machine.
- **Gates:** Phase 8 **PASSED** (REVIEWS/phase8_r3.md, round 3; majors M1, M2, M6 fixed afterwards; M3 voices by ear, M4
  music visuals, M5 tablets' text remain). Phase 5: the soak passes all 8 gates; the shadow review has NOT passed (round 7:
  A 2/20 below 4, B 1/20). Phases 3/4 and 6/7: independent reviews not run. §8.2 rubric first pass FAILED (light 2,
  materials 1, scale 2, detail 2, people 2, atmosphere 2); fixes merged, **not yet re-scored**.
- SIM STATUS: see the "Sim round 8" line at the end of this file.

## What is broken, unverified or placeholder (read first)
1. **Photorealism is the big gap.** Rubric pass 1 (REVIEWS/rubric_s6_pass1.md) scored every category 1–2 of 5 (pass = 4).
   The four look workstreams fixed a lot (limestone albedo was 15.5 % against the evidence's 'light grey' → 42 %; earthen
   plaster off the Treasury; timber ceilings; SSR blur; probe "facets"; natural-dye clothing; hill rock and gullies; plain
   fields at distance; re-posed moments incl. a sun → door → hall entry sequence), but only parts were rendered afterwards.
   **Render pass 2** (all 35 moments, plain, crowd, people lab) was part-way through at handoff: shots are gitignored and
   die with the container — re-render (`handoff/render_jobs/2*.job`), then run rubric pass 2 (brief: `handoff/review_briefs.md`
   §8.2). Known still open: **outdoor ambient occlusion** (contact AO ≈ 0.8 at column feet; cause not found, D-188); hair
   and beards as alpha shells (Q-361); skirts as skinned tubes; court robes still vivid (D-189); hills are shading only (DEM
   skylines); the dawn-horizon "comb" (unidentified, D-187); a black doorway reveal the probes cannot light (B23); paths
   from the stair may read like roads (D-190, last tweak unrendered).
2. **Phase 5 shadow review not passed** (7 rounds). Round 7's findings are fixed (D-191) and year-wide invariants now sweep
   classes of fault (weather, light, waits, labels, feeds, dress) in planCheck and the soak. Round 8 is next.
3. **Nothing in Phase 8 has been heard or seen on a GPU**: incised signs, music, occlusion, clay tablets, re-rendered voices
   (H8 listening test open). Tablets' text is a placeholder (B18: no PT text reachable); translations blocked by licence
   (B17a, NEEDS #14); music visuals placeholder, no chant or pipes (B20).
4. **Court in full assembly**: rendered once (`court-assembly`: a real crowd), but the town +13,000 retinue and plain +5,000
   are not simulated; the king is not a person (B9); delegation dress placeholder; B13 (the hillside view is over 12 M
   triangles on the world alone).
5. Carried over: calibration scene blocked (NEEDS #13); bench numbers void since D-047 (jobs 19x); WebGL2 at high times out
   under SwiftShader; walkthrough e2e (18x) not re-run this session; Now view and photo mode not started (stretch).

## Next steps, in order
1. Session start (above); tsc; targeted vitest; lint:all; `npx tsx tools/dev/botcheck.ts`.
2. Start the render runner and watchdog (below) with `handoff/render_jobs/2*.job` (pass 2; ~6 h under load, less on a
   quiet box). Look at every PNG. Then **rubric pass 2** with a fresh vision reviewer; fix list by moments touched.
3. Shadow review round 8 on `REVIEWS/shadow_days_input_seed1_pick149.txt` (unless the status line says it was scored),
   two fresh reviewers, scores fixed before reading code (same prompt shape as rounds 6–7). If it fails: fix at the rule
   and add an invariant for the class of fault; round 9 on a new unseen pick seed (not 7/11/23/37/53/71/89/97/113/131/149).
4. Outdoor AO (D-188 next step: dump the contact AO's sector bits at one pixel), then the remaining rubric items.
5. Independent Phase 3+4, 5, 6+7 reviews (`handoff/review_briefs.md`); bench ×4 and walkthrough e2e (jobs 18x, 19x).
6. Phase 9: README budgets, FINAL_REPORT.md (problems first).

## Tools (session 6 additions; the earlier lists below still apply)
- **Render runner:** `tools/dev/render_runner.sh <work dir>` and `LIMIT=3700 tools/dev/e2e_watchdog.sh` in the background;
  copy job files into `<work dir>/jobs/`. Specs take `TIMEOUT` (s) and the Playwright config `PW_TIMEOUT` (s): high renders
  under load need `TIMEOUT=2900 PW_TIMEOUT=2900`. Keep ≤ 3 views per job; views sharing (day, hour, weather) share a page
  load. The entry sequence (`apadana-enter-court` … `apadana-hall-out`) must stay in ONE job: it carries eye adaptation
  (`__parsa.carryEye`).
- **Debug views:** `?envdbg=occ` (sky specular visibility red / occlusion green); `dbg_surf.spec.ts` takes `URLX` and
  `TIMEOUT` and has `dawn-glow-e`; `dbg_plain.spec.ts` takes `VIEW`, `DAY`, `HOUR`, `TAG`; `tools/dev/scene_lum.ts` undoes
  the tone map; `tests/lib/occ_check.ts` is a CPU mirror of the sky-specular occlusion at floor points.
- **Markdown table conflicts** (BLOCKERS, OPEN_QUESTIONS) when agents edit the same rows: resolve per row against the merge
  base (take the side that changed the row; flag rows changed on both).

## Gotchas (session 6)
- **Committing a worktree's `node_modules` symlink replaced the main tree's real node_modules** (git turned the directory into
  a self-loop). `.gitignore` now ignores `node_modules` as a symlink too. If node_modules vanishes: `npm ci`.
- **`pgrep -f` / `pkill -f` with a pattern** match your own shell's command line. Use PIDs from `ps -eo pid,args | grep "[p]attern"`.
- **three's MRTNode blends only `output`**; every other G-buffer attachment was written unblended (D-183). Any new MRT output
  must get `setBlendMode(name, new BlendMode(MaterialBlending))`.
- **Container restarts** kill agent sessions but keep the disk: an agent's worktree under `.claude/worktrees/` survives;
  resume it with SendMessage to its id.
- Agents cannot write outside their worktrees: copy their reports into `REVIEWS/agent_reports_session6.md`.

## Gotchas (sessions 2–5, still true)
- Timing tests and long `beforeAll` builds fail under load: re-run alone before calling a regression.
- Long Playwright runs: don't pipe through `head`. TSL: no runtime `select()` under TRAA; `pow()` of a negative base is NaN;
  reversed-edge `smoothstep` undefined; r186 binds a `Data3DTexture` through a 2-D view and fails; colour uniforms type-check
  only against floats. Frames outside three's loop must advance `renderer._nodes.nodeFrame` (D-047); use `__parsa.setTime`.
- The runner snapshots the tree when a job takes the lock: never leave code and generated data out of step.
- Light probes: `WORKERS=3 npx tsx tools/build_probes.ts` after architecture or SURFACES albedo changes (~20 min loaded);
  `npx tsx tools/build_nav.ts` after architecture changes; `npx tsx tools/build_horizon.ts` for the horizon map.
- Effect materials must use `colourOnly()`; small indoor objects must receive shadows.
- Removing old agent worktrees is refused by the permission classifier: leave them.

## Sim round 8
PENDING (filled in at handoff).
