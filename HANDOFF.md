# HANDOFF — end of session 7 (2026-09-25)

Read `CLAUDE.md` first (the resume procedure; its §12 now carries the **gap rule, D-207**), then this file, then `PROGRESS.md`
(problems first), `TASKS.md`, `DECISIONS.md` (session 7: D-194 … D-217) and `BLOCKERS.md`. Agent reports:
`REVIEWS/agent_reports_session7.md`. **Branch:** `claude/amazing-fermi-40ds7j` (sessions 2–7). Never force-push.

**Session start:** `git fetch origin claude/amazing-fermi-40ds7j && git status -sb`, `npm ci`, `pip install pillow numpy scipy`.

## State at the end of session 7
- **Everything is merged and pushed.** No agent branch or worktree carries unmerged work. The session's merges: gap fills under
  the user's direction "fill the gaps to the best of your educated ability" (D-207: fill silent gaps with the most probable
  reconstruction, tier C, reasoning in F3; keep out only what the evidence says was NOT there; no invented liturgical words):
  translations and tablets (D-198), court (D-199), instruments and pipes (D-200), Now view (D-201), recalled and composed names
  (D-202, D-213), relief panel (D-204), garments (D-206), gap audit (D-208, `REVIEWS/gap_audit.md`), religion: open-air fire
  precinct, magi, sacrifices, funerals, wordless chant (D-209), animals (D-210), festivals/weddings/lanes/healer/hearings and
  the scheduled receipts (D-211), palace furnishings and masons' marks (D-212), inscriptions/glazed brick/paint/drains (D-214),
  people's look: babies in arms, toys, jewellery, shields, court women's dress, the lame and blind (D-215); rubric pass-2
  fixes: light and materials (D-216), geometry and reliefs (D-217); lead fixes listed under PROGRESS "session 7".
- **Checks at handoff:** `tsc` clean; `npm run lint:all` OK (chrono; lang 26/26; activity 65 activities 0 placeholders;
  music 21 claims, all gigs sourced). **The full `npm test` was NOT run on the final merged tree** (each branch ran its own
  suites; the last three merges — D-211, D-217, D-216 — were checked by tsc and lints only). Known on branches:
  `people_days_r8` "a child alone by the water" failed on two agents' full runs (not investigated); CPU-timing tests
  (performances 300 performers, popview costs, humans_runtime) fail under load and pass alone.
- **Music claims renumbered at the merge:** the women's frame drum is M-22 (D-211), the magus's chant M-23 (D-209).
- **Gates:** Phase 8 PASSED (session 6). Phase 5: soak passes 7/8 on the D-211 branch before its last fix (plansWellFormed 3
  issues in 15.46 M person-days, fixed in 2bc77c6, **not re-soaked**); shadow review round 9 FAILED (#76's jar, fixed D-213),
  **round 10 input `REVIEWS/shadow_days_input_seed1_pick181.txt` generated on the D-211 code but BEFORE the D-216/D-217
  merges — regenerate it first.** §8.2 rubric pass 2 FAILED (`REVIEWS/rubric_s7_pass2.md`: light 2, materials 1, scale 3,
  detail 2, people 2, weather 1, atmosphere 2); the R1–R12 bugs are mostly fixed but **not re-rendered as moments**.
  Phases 3+4, 5, 6+7 independent reviews: not run.

## What is broken, unverified or placeholder (read first)
1. **Nothing from the session-7 gap fills has been seen in a browser** (religion, animals, festivals, furnishings, inscriptions,
   glazed brick, paint, drains, babies, toys, jewellery, court women). All tier C, node-tested only; the chant never heard.
2. **Rain.** (a) FIXED, needs a render: the rain-columns moment hung its first frame for 58 min (a homemaker's `homeHours`
   asked for 24.5 h on a day of unbroken rain; 9e2c5e7; the cause upstream — a camp woman's ration issue pushed past every
   wet spell to 23:54 — is NOT fixed: cap the rain shift in `workBlock`). (b) OPEN: the rain-approach curtains are placed
   right (solid-red debug `moment-rain-approach-shaftdbg3`) but have **zero visible effect** (sky inside/outside the mask
   212/212). Next: run `handoff/render_jobs/300_shaftdbg4.job` (`?shaftdbg=4`: real tint at full strength, live uniforms
   logged by the spec) and find the factor that zeroes the opacity (TR, optic, fade or uStrength).
3. **Photorealism** (rubric pass 2): stone reads as concrete, reliefs are procedural (NEEDS #10), garments rigid, hills smooth,
   no smoke/dust, snow does not lie; the fix list is `REVIEWS/rubric_s7_pass2.md` items 2–10. Carved relief depth now
   4.5–6 cm with baked contour AO (D-217), no undercut.
4. **Light:** fire light passes through parapets and façades (B24: shadowed fire lights exceed WebGPU's 16 sampled
   textures); the Gate's orange at dusk is the braziers at their physical level (brazier 30 cd is C, Q-440); R7 at the
   0.5 m probe grid and R10 unrendered; Naqsh-e Rustam cliff moiré open (D-217, one of three approaches tried).
5. **Framing:** the slope-s-dusk view still stands at a tree (`treesNear` finds none there; `settlement.spec` logs the trees:
   run `303_slope.job` and read the log line). The far-flame fix (2 px minimum, light conserved) is correct but from the
   mountain the courtyard walls hide nearly every hearth, so the town still shows no fire points.
6. Carried over: calibration scene (NEEDS #13); bench void since D-047 (jobs 19x); WebGL2 at high times out; walkthrough
   e2e (18x) not re-run; photo mode not started; court + town retinue not simulated in the year soak.

## Next steps, in order
1. Session start; `npx tsc --noEmit -p .`; **the full `npm test` once** (`--maxWorkers=2`, re-run timing failures alone);
   investigate `people_days_r8` "child alone by the water" if it still fails.
2. Soak on the merged tree (`npm run soak`, ~2.5 h); fix any gate; regenerate the round-10 input
   (`npx tsx tools/shadow_days.ts 1 181 > REVIEWS/shadow_days_input_seed1_pick181.txt`) and run **shadow review round 10**
   (two fresh reviewers, scores fixed before reading code).
3. Start the render runner (below) with `handoff/render_jobs/30*.job` (verify the lead's fixes: rain shafts debug, rain
   columns, rain approach, slope, Tol-e Ajori and Area B), then re-render every moment the D-216/D-217 fixes touched
   (brazier-close, night-terrace, gate-dusk, pulvar, garden, scribe rooms, hadish-hall, apadana-hall-axis, reliefs-raking,
   apadana-enter-*, hall100-site, court-assembly, crowd-court-forecourt-w, plain-naqsh-200m) and new renders of the gap
   fills (precinct, burial ground, a wedding, the lanes at noon, babies, the palaces furnished). Then **rubric pass 3**.
4. Rubric fix list items 2–10 as workstreams (stone surface, reliefs, weather visible, smoke/dust, garments, court staging,
   mountains, scribe room).
5. Independent Phase 3+4, 5, 6+7 reviews (`handoff/review_briefs.md`); bench ×4 and walkthrough e2e (jobs 18x, 19x).
6. Phase 9: FINAL_REPORT.md (problems first). README budgets were re-measured this session (647 draw calls, 8.65 M
   triangles, 36 MB at high).
7. Remaining gap-audit items (`REVIEWS/gap_audit.md`): 19 (mill, stockyard, tannery, kitchen gardens built), 20 (smiths and
   potters seen at work), 30 (Hadish apartments: parts change, needs probe/nav re-bake), 32–36, 39–41.

## Tools (session 7 additions)
- **`tests/e2e/dbg_hang.spec.ts`** (DBG=1): when a frame never returns, it pauses the page through the DevTools protocol and
  prints the JS stack (found the homeHours hang in one run). Env: DAY, HOUR, W, V, Q, WAIT.
- **Rain shafts:** `?shaftdbg=1..4` (4 = real tint, uniforms logged; moments.spec prints `shaftdbg` console lines).
- **Camera rig:** `__parsa.view()` sets `crowd.rigClear = 2.5` (nobody drawn within 2.5 m of the lens; the player's camera
  never); `world.treesNear(e, n, r)` lists plain and town trees (slope view keeps off them).
- **`tests/e2e/dbg_light.spec.ts`** (D-216): light-group switches (fires, braziers, SSR) with before/after measurements.
- Music claims: the next free number is M-24; OPEN_QUESTIONS used up to Q-473; decisions up to D-217; blockers up to B24.

## Gotchas (session 7)
- **Never delete `/tmp/parsa-e2e.lock` or a running job's snapshot dir**: a runner holding the old lock's inode and a new one
  can overlap, and a deleted snapshot kills the page mid-run ("Execution context was destroyed").
- **After a container restart, check for a second render runner** (`ps -eo pid,args | grep [r]ender_runner`); one may already
  be running.
- **Resume stopped agents with SendMessage to their id** after a restart: their worktrees survive with uncommitted work.
- **Agents' merges collide on shared ids**: music claims (M-22 twice this session), OPEN_QUESTIONS rows, DECISIONS order.
  Reserve number ranges per agent in the prompt (done for Q-420..479 and D-214..217 this session).
- Merging markdown tables: `rowmerge.py`-style per-row resolution against the merge base (git's `:1:` stage).
- A heavy test run under 5 agents OOM'd a render once (session 7); keep ≤ 4 agents and one vitest at a time.

## Tools (session 6; still apply)
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
- Old agent worktrees: remove with `git worktree remove -f -f` once their branch is merged (session 7 did; earlier sessions were refused).

