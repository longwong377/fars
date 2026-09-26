# HANDOFF — end of session 8 (2026-09-26); branch claude/amazing-fermi-40ds7j, tag ratchet/s08

**Read first, in this order:** `USER_DIRECTIONS.md` (the user's own words, UD-01..UD-14, append-only), `MASTER_PLAN.md` (rev 2.1,
governs everything), `gates/thresholds.json` (169 locked thresholds), then PROGRESS.md (problems first), this file, BLOCKERS.md.
The user wants no interventions: decide, log in DECISIONS, proceed. Every report leads with what is broken.

## What session 8 changed (the big picture)
- **The standard changed** (UD-06, D-233): not chosen camera views but **every inch the player can walk**, at every hour, season
  and weather, in motion, with sound. The user then asked for a living sandbox (UD-07..UD-11, UD-14): everyone a name, home,
  family, job and history; the court coming and going by default; never repetitive; surprises; every gap filled from the period.
- **Four independent audits** (REVIEWS/audit_A..D) found the chosen-views miss was one of many: 6 % of the Terrace ever judged,
  copy-paste everywhere (23 bodies, 209 names for 46,910 people), people drawn in the rain their plan sheltered, frozen distant
  workers, a silent town, the player falling through Kuh-e Rahmat at the terrain LOD seam, no autosave, seed always 1.
- **MASTER_PLAN rev 1 → 2 → 2.1**, critiqued twice by independent adversaries (REVIEWS/master_plan_critique*.md): the Walker Test
  on axes A–K + R, an illusion-break log as the headline measure, 169 thresholds that only tighten, seeded sampling the agent can't
  choose, an area registry over the whole walkable envelope, a generated board where NOT-MEASURED and STALE count as FAIL.
- **Guards that run themselves** (rev 2.1): `npm run guards` = tests/gates_ratchet.test.ts + tests/scope_ledger.test.ts +
  tests/defaults.test.ts; in the pre-commit hook (`.githooks`, installed by `npm ci`), at the start of `npm run build`, and in
  GitHub Actions (`.github/workflows/guards.yml`). They fail closed. All 13 of the second critic's attacks re-run: all caught.
- **Every threshold starts at to-build.** Status is earned only by an evidence file (`REVIEWS/evidence/**/<id>.json` written by
  the row's tool). First earned: T-G1, T-G2 (failing), T-G2b, T-G2f, T-G3, T-G3e (partial, from D-245).

## Merged this session (on claude/amazing-fermi-40ds7j)
- D-222 fire-light occlusion (B24 on the Terrace), D-226 relief self-shadows, D-228 village budget, D-229 Phase 5 fixes (court
  soak 8/8, impostor work frames), D-232 masonry layout (renders: no longer flat or black, but fails photo #24 plainly), terrain
  quality scale fixed, the moon moment.
- Stop the bleeding (MASTER_PLAN §6 step 1): no Math.random in src; per-call audio noise; a new world seed per new game (settings
  shows it, "New world"); villages and Tol-e Ajori flagged placeholder; lint:all in the build; the court by default (UD-10; rigs
  with ?test pin court=evidence unless &court=seasonal); FOV 60 / bob 1.8 cm (D-238); TASKS ticks removed.
- D-245 the town is not mute: limiter, voices from everyone within 60 m, non-looping beds, rivers audible. **Never heard in a
  browser** (B65); T-G2 fails (2 repeats: the Old Persian lexicon is ~114 words, B66).
- `tools/dev/cpu_slot.sh`: heavy node jobs run in 2 low-priority slots (load 11 on 4 cores starved renders for hours).

## Agent branches at close (see handoff/reserved_numbers.md for fates)
All six agent branches of the session are merged (handoff/reserved_numbers.md): D-229, D-245, D-237, D-244, D-234, D-235.
Their worktrees under .claude/worktrees/ can be removed (`git worktree remove -f -f <path>`).
- **D-237 walkability:** terrain colliders from the drawn chunks (0 of 24 mountain crossings fall, was 12; T-H1 built), controller
  fixes, rescue net, solid people/animals near the player, autosave (IndexedDB, byte-identical round trip in node), walk bots
  (tools/dev/walkers.ts, lib/offline_world.ts). Town fails: 61.7 % of targets reached, 27.5 % stuck; 767 house doors too narrow
  (Q-640); lane routes clip walls (Q-641). 7 of 14 areas never bot-walked. persistence.spec and the walkthrough never ran.
- **D-244 indoor truth:** the indoors drawn inside rooms or not at all (T-D3 0, T-D3s 100 %, T-D4 4.6 % worst area, 3 seeds);
  tools/dev/people_trace.ts. Never seen on screen; garrison/mill/camps have no rooms so their people vanish (B63).
- **D-234 town houses:** 1,447 distinct houses, near/far levels, 1,494 street doors, lamps, seasons. Rendered once before its
  last fixes (lane view timed out); near tiles built on the main thread (B59); drawn people walk through shut doors (B60).
- **D-235 coverage harness:** commit-seeded sampler, ID pass, gate metrics, coverage.spec, coverage_report.ts (evidence and
  COVERAGE.md). No evidence yet; a pass is ~30 lane-hours at test quality. How to run: PROGRESS.md (D-235 entry).

## What is broken, unverified or placeholder (read first)
- Photo #24 side by side: the Terrace wall reads as grey concrete, no polygonal foot, smooth ground, featureless mountain (B57).
- Nothing on the board is measured yet except the six audio rows; the instruments of §6 step 2 are TO-BUILD (renderless mode,
  area registry, Tier 0, walker bots, Tier-1 sampler, generated board, anchor set, escapes log, event kinds).
- The court's arrival is not simulated (present from day 0); D-239 (start before the arrival) and T-F8 wait on it.
- The simulation still runs on the main thread (B53); long route searches stall 150–650 ms (B54).
- Impostor work frames, the new voices, the houses after their fixes, indoor drawing, solid crowds and autosave have never been
  seen or heard in a browser. **The first job of session 9 is to render and listen to what session 8 merged.**
- The town walk fails (doors too narrow, routes clip walls); the town's tiles hitch the main thread (B59).
- Villages are box compounds; interiors unbuilt; faces are a few variants; one voice synthesiser.
- The random-seed year soak (seed 362095439) was stopped for CPU at 25k/46k people: re-run it idle via cpu_slot.
- D-246 (the perpetual 467) and D-247 (a fall off the Terrace) are decided, not implemented.

## Next steps, in order (MASTER_PLAN §6)
1. Session start: `git fetch --unshallow --tags` if shallow; `npm ci`; `npm run guards`; merge or record any agent branch left
   in handoff/reserved_numbers.md.
2. Verify session 8 on screen: one grouped render job for the town (lane-q_s1, court-q_s1, town-smoke-dusk), the persistence
   and walkthrough specs, a crowd view at distance (work frames), then the first coverage chunk (D-235 command in PROGRESS).
   Listen: town lane, forecourt, village, Pulvar bank, rain by a fire, a close conversation.
3. Finish step 1: town doors wide enough (Q-640) and lanes off the walls (Q-641); the court's arrival simulated (D-239, T-F8);
   the random-seed soak (seed 362095439) via cpu_slot.
4. Step 2, time-boxed: **the renderless mode first** (measure bot-hours per core-hour into gates/budget.json), then the area
   registry, Tier 0, walker bots (five policies), the Tier-1 sampler, the generated board, anchors, escapes, event kinds.
5. At close: sessions/s09.md, fates in reserved_numbers.md, tag `ratchet/s09` pushed.

## Tools (session 8 additions)
- `npm run guards`; `tools/dev/cpu_slot.sh <cmd>` (always, for soaks/bots/audio/bakes/long vitest); `tools/dev/audio_render.ts
  --evidence <pass>` (D-245); `tools/dev/plan_dump.ts <pid> <day0> [day1] [seed] [--court]`; `tools/dev/sim_cost.ts`;
  `tools/dev/load_probe.mjs`; `tools/dev/person_census.ts`; audit probes in tools/dev/audit_c and audit_d; `tools/build_fire_occ.ts`
  after any architecture or fire change (tests/fire_occ.test.ts checks the parts hash).
- Briefs from handoff/agent_template.md and handoff/review_template.md, saved to handoff/briefs/sNN/; reserve numbers in
  handoff/reserved_numbers.md first.

## Gotchas (session 8)
- **Check the render queue, not just CPU:** `ps -eo pid,etime,args | grep "[q]ueue_e2e"` shows every job waiting on the one
  flock lane. A job with an empty log is usually waiting, not stuck. Cancel low-value jobs before they block agents' renders.
- Load above 6 on 4 cores: queue, don't start. Four parallel bot processes starved a render for ~2 h.
- The pre-commit hook runs the guards in every worktree (shared git config); branches older than the guards skip it.
- Templates' fixed clauses may only grow: append a new numbered clause, never renumber (the scope test caught this).
- Tests rewrite bench-reports/*.txt under load: `git checkout bench-reports/` before every commit.
- `vitest run $(ls tests/*x*)` with an empty glob runs the whole suite; `grep -c $(git diff --name-only --diff-filter=U)` hangs
  when there are no conflicts (guard with `[ -n "$U" ]`).
- The camera rig takes a TRUE azimuth; a near brazier sets the exposure.

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

