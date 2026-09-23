# HANDOFF — end of session 4 (2026-09-23, late evening)

Read `CLAUDE.md` first (the resume procedure), then this file, then `PROGRESS.md` (problems first), `TASKS.md`,
`DECISIONS.md` and `BLOCKERS.md`. Session 4 decisions: D-140 … D-159 (D-140, D-150 sim; D-142 performances; D-143 crowd;
D-149 plain look; D-151 carving; D-155 faces; D-156 atmosphere; D-157 surfaces; the rest lead). Open questions up to
Q-269.
**Branch:** `claude/amazing-fermi-40ds7j` (sessions 2–4). Never force-push. **Every session-4 agent branch is merged except the crowd agent's (D-143)**, which conflicts with the merged
performances work (D-142) in `src/people/crowd.ts` (10 hunks: the Person fields, `resolve()` for population people, the
per-frame position loop, the carried-prop system — D-142's multi-mesh `carried[]` vs D-143's single mesh + `carriedKind` —
and the impostor/walled-off pass). It is saved intact as `handoff/branches/crowd_D143.bundle` (13 commits, head e12e5f3):
`git fetch handoff/branches/crowd_D143.bundle worktree-agent-ac3b77001e4e485c0:crowd-d143 && git merge crowd-d143`, then
resolve crowd.ts by keeping D-142's props/work objects/animals/`resolve()`/paths and adding D-143's view positions (`vp`),
`attachPop`/`byPid`, walled-off LOD, `drawnKeys`, `K.shadow` and `drawImpostors`; `resolve()` must take a population
person's act/why from `p.vp`. Its report is `REVIEWS/agent_crowd_scale.md` inside the bundle. No background agents run.

**Session start:** `git fetch origin claude/amazing-fermi-40ds7j && git status -sb` — session 4 began 218 commits behind
the remote. Then `npm ci`.

**State at the end of session 4 (merged tree):** `tsc` clean; full `vitest --maxWorkers=2` **519 passed, 1 skipped (57
files)**; `npm run lint:all` OK (chronology, language, activity coverage with 0 placeholders); offline walkthrough bot 97
legs pass (run before the last merges). No browser render of the merged tree.

## What is broken, unverified or placeholder (read first)
1. **No gate after Phase 2 has passed.** The §8.2 rubric and the independent Phase 3–8 reviews have still not run (briefs
   in `handoff/review_briefs.md`). A preliminary photoreal triage (`REVIEWS/prelim_photoreal_triage.md`, a vision
   subagent, not the gate) scored the session-4 renders **light 2, materials 2, scale 2, detail 2, atmosphere 2–3**:
   as a set they read as CG. Much of its list was worked on after it (below), **none of it re-rendered at high yet.**
2. **Nothing merged in the last two hours has been seen in a full high-quality render**: the lighting fixes (D-152, D-153,
   D-158, D-159), the photographic capture lenses and reframed moments, and every agent branch merged at the end
   (D-149 plain look, D-150 sim, D-151 carving, D-155 faces, D-156 atmosphere, D-157 surfaces). First job of session 5: the full pass (`handoff/render_jobs/`, below).
3. **Soak and shadow review:** the soak passed all 8 gates on the session-4 sim (D-140); round 4 of the §13.11 shadow
   review FAILED (1 of 20 below 4). The round-4 fixes (D-150) are merged but **the final commit is not soak-verified** (the last soak, one commit earlier, failed `plansWellFormed` with 15 issues that the final commit fixes on the failing days only); the round-5 input `REVIEWS/shadow_days_input_seed1_pick97.txt` is generated, not scored. Round 5 (pick seed 97) has not run.
4. **Crowd at scale (D-143, PARTIAL):** the whole simulated population is now drawn (skinned pool nearest-first,
   impostors to 5 km, no pop-in on the probe walk), but the floor "≥ 300 visible in the busiest scene" is met in 1 view
   of 7 (B11), the court in full assembly is not simulated (685 people on the Terrace on day 0 at 10:00 with the court
   setting; population.json says 3,000–8,000: B12), and 3 of 7 views exceed 12 M triangles at high (B13).
5. **Every simulated activity is performed (D-142)** — 36 IK cycles, tools, work objects, animals; `lint:activity` has 0
   placeholders — but they were seen only in the lab and node previews; in the world only once the crowd merge draws
   the population (check `crowd.stats().placeholderActs` after the merge: it should be 0).
6. **New shader code never compiled on a GPU backend** (only in node): the atmosphere (D-156: horizon colour nodes, aerial
   fog node, cloud march, hall light shafts), the faces (D-155: skin/eyes/hair) and parts of the surfaces (D-157: env map,
   SSR, contact shadows; one render run before its last fix). A compile failure in the sun's colour node or the fog node
   would break every lit material. **Bisect switches:** `?air=0` (no horizon colour nodes, no aerial fog: FogExp2 at its
   fixed density), `?airlight=0` (no light shafts), `?post=scene` (no composite). Reports:
   `REVIEWS/agent_reports_session4.md` (surfaces, atmosphere, faces, sim), `REVIEWS/agent_plain_look.md`,
   `REVIEWS/agent_performances.md`, D-151 (carving).
7. **Light probes:** leaks through walls thinner than the 2 m spacing fixed (D-152) except a ≤ 0.3 m band within ~1 m of a
   doorway's jamb; bounce tints from above and below (D-158); direct-light GI now also inside the volumes (D-157, triage
   item 6), unmeasured in a render; orange probe-scale blotches deep in the Apadana hall (2 m spacing, local contrast
   5–6.5×) open. The polished hall floors mirrored the sky in the surfaces agent's only render (fixed by specular occlusion
   in its last commit, unrendered).
8. **Dawn:** Kuh-e Rahmat's shadow is now modelled (D-156 horizon map: first sun on the Grand Stair landing 06:26 on day 0;
   exposure and the probes' eye test follow it), unrendered. The dawn moment is framed down the N upper flight
   (`dawn-stair-top-nw`, `dawn-sunrise-nw`: D-148 addendum).
9. **Trees:** the tree lab's r3 match fails for the oak at high (impostor 14–16/255 darker than LOD1, limit 14; willow
   11–13): proposed fix one leaf roughness ~0.92 (D-149 report). Village P22 adds +2.56 M triangles.
10. **Calibration scene (§8.1) blocked (NEEDS #13); translations (NEEDS #14); voices unheard (H8); bench numbers void since
   D-047** (the four bench jobs are in `handoff/render_jobs/`).
11. **Stretch goals not started:** Now view, path-traced photo mode, cloth simulation, LLM dialogue.

## Next steps, in order
1. `npm ci`; `npx tsc --noEmit`; `npx vitest run --maxWorkers=2` (re-run timing tests alone under load);
   `npm run lint:all`; `npx tsx tools/dev/botcheck.ts` (97 legs). Fix what the merges broke. Then **one smoke render at
   quality test and one at high** (e.g. `ONLY=stair-climb-pm`) before anything else: see item 6.
2. Merge the crowd bundle (above) and re-run the people tests, `lint:activity`, the pop-in probe and one crowd render.
3. `npm run soak` (~25–45 min): the sim's final commit is not soak-verified.
4. **Full high-quality pass:** start `tools/dev/render_runner.sh <work dir>` and `LIMIT=1500 tools/dev/e2e_watchdog.sh`
   in the background, copy `handoff/render_jobs/*.job` into `<work dir>/jobs/` (the 1xx jobs first; walkthroughs 18x and
   bench 19x last). ~6 h of queue in total with no agents competing; the moments/settlement/plain jobs (~3 h) are what
   the rubric needs. Look at every PNG.
5. Launch the §8.2 rubric reviewer and the independent Phase 3+4, 5, 6+7 and 8 reviewers (`handoff/review_briefs.md`),
   and shadow review round 5 on `REVIEWS/shadow_days_input_seed1_pick97.txt` (already generated on the final sim code;
   round-3 protocol). Record the gates honestly in PROGRESS.md.
6. Fix the critical findings; then Phase 9: README budgets (measured: production build 32 MB, JS 6.3 MB / 2.0 MB gzip;
   plain budget views 348–541 draws, 5.7–10.3 M triangles before the crowd), FINAL_REPORT.md (problems first).

## Tools
- **Render runner:** `tools/dev/render_runner.sh <work dir>`, started in the background. It runs `<work dir>/jobs/*.job` in name order.
  - A job file is three lines: name, spec, env.
  - Copy `handoff/render_jobs/*.job` into `<work dir>/jobs/` to run the pending ones.
  - It goes through `tools/dev/queue_e2e.sh`, which takes the shared lock `/tmp/parsa-e2e.lock`. Never wrap it in another `flock`: that self-deadlocks.
  - Start `tools/dev/e2e_watchdog.sh` in the background too (`LIMIT=1500`: moments.spec allows 23 min for ≤ 3 page loads).
  - **Page loads take ~5 min each at test quality:** keep a job to ≤ 2 page loads. settlement.spec loads once per view (twice for A/B views); moments.spec and plain.spec load once and step their views.
- Debug specs `tests/e2e/dbg_*.spec.ts` run only with `DBG=1`:
  - `dbg_plain` hides plain layers one by one;
  - `dbg_smoke` renders with `?smokedbg` (haze blue, plumes red);
  - `dbg_rain`.
- **Snapshots** (`tools/e2e_snapshot.sh`) are ~0.3 GB each. Delete finished `snap_*` directories by hand; check `ps` first.
- `tools/dev/botcheck.ts`: the offline walkthrough bot (all areas: 97 legs; `slice`: 28).
- `tools/dev/px.mjs` measures pixels; `tools/dev/pxdiff.mjs a.png b.png [thresholds]` counts pixels that differ.
- **REF-PLAN in the grid:** grid = s·R·[px, −py] + t with s 0.47284, R rot(−18.51°), t (−37.664, 300.563). A pixel is wall if R+G+B < 420 (`pip install pillow numpy scipy`). Examples: `tools/apply_treasury_rooms_patch.py`, `tools/apply_tachara_plan_patch.py`, `tools/dev/tachara_overlay.py`.
- **After any architecture change**, rebuild:
  - `npx tsx tools/build_nav.ts` (the walkable grid; the parts-hash test in people.test);
  - `npx tsx tools/build_probes.ts` (the light probes, 3–5 min; the parts-hash test in probes.test).
- `tools/relief_preview.ts`: node raking-light previews of relief kinds (`--sheet`).
- `tools/shadow_days.ts`: §13.11 review input (it now picks only the living; `tools/shadow_pick.ts`).

## Gotchas (sessions 2–4)
- **`pkill -f <pattern>`:** never use it with a pattern in your own command line; it kills your own shell (exit 144). Use PIDs.
- **Long Playwright runs:** don't pipe them through `head`; closing the pipe stalls the run.
- **TSL:**
  - no runtime `select()` under TRAA;
  - `pow()` of a negative base is NaN (write x·x);
  - reversed-edge `smoothstep` is undefined (use `1 − smoothstep(lo, hi, x)`);
  - r186 binds a `Data3DTexture` through a 2-D view and fails (use a 2-D atlas);
  - colour uniforms type-check only against floats (cast to `any`).
- **Frames outside three's animation loop** must advance `renderer._nodes.nodeFrame` (D-047). E2E specs stop the loop after load; the test clock is frozen, so use `__parsa.setTime(day, hour)`.
- **`world.update` ctx:** `ctx.sky` is `sky.state`; the SkySystem (horizon, hemi, sun, fireScale) is `ctx.skyLight`.
- **Smoke** is lit by `smokeSkyRadiance` (fire.ts, D-070), the mean skylight, not the horizon behind it.
- **Vitest console output is suppressed:** write debug dumps to a file.
- **Timing tests** (cloud-noise build, crowd posing) and heavy `beforeAll` builds fail under load (renders plus a soak share 4 cores). Re-run them alone before calling anything a regression.
- **Removing old agent worktrees** (`.claude/worktrees/`) is refused by the permission classifier. Leave them.
- **Session start (session 4 lesson):** compare the local branch with `origin/claude/amazing-fermi-40ds7j` before doing anything (`git fetch origin <branch> && git status -sb`). Session 4 began on a checkout 218 commits behind the remote; its first push was rejected.
- **Shared scratchpad:** agents and the lead write logs side by side; give every log a unique name (two vitest runs once wrote the same file).
- **The runner snapshots the tree when a job takes the lock, not when it is queued** (tools/dev/queue_e2e.sh → e2e_snapshot.sh after `flock`). Never leave code and generated data out of step (e.g. a new probe format before the re-bake): a job starting in that window renders garbage (session 4: the Tachara views came out green).
- **Camera rig (session 4):** `moments.spec` loads the page once per world state (day, hour, weather); views that share one reuse it. Group views by state when you queue jobs.
- **Light probes (D-152, D-158):** 18 values per probe (slots 12–15 reach along ±x/±z, 16–17 the tint from below), 5 atlas bands. Rebuild with `WORKERS=3 npx tsx tools/build_probes.ts` (~8 min on a shared box); rebuild also after an albedo change in `SURFACES` (the bounce colours). The runtime refuses data of another stride.
- **Horizon map (D-156):** `npx tsx tools/build_horizon.ts` regenerates `public/generated/horizon_map.*` from the terrain rings.
- **The shared render queue saturates with more than ~3 agents:** 6–8 waiters × 10–15 min each. Give agents node-side previews and ≤ 2 browser runs, and keep the lead's own checks for the full pass.
- **Subagents cannot write report files outside their worktree** (the harness refuses them): ask for the report in the final message and copy it into `REVIEWS/`.
- **Camera rig lenses (session 4):** captures use a photographic vertical FOV (46° indoors, 40° outdoors; `FOV=game` for the player's 70°); the plain.spec budget views keep the player's FOV for draw-call/triangle measurements. `WEBGL=1` forces the WebGL2 backend (shots suffixed `-webgl2-forced`).
- **Effect materials** (flames, smoke, rain, snow, haze) must use `colourOnly()` (src/render/fx.ts): their G-buffer writes corrupted the SSGI composite (the pale rectangle round brazier flames).
- **Small indoor objects must receive shadows** (`receiveShadow`): under a roof a mesh that ignores shadows is lit by the full sun (the scribes' room cloth glowed white).
