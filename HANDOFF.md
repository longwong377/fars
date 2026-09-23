# HANDOFF — state during session 3 (2026-09-23, afternoon)

Read `CLAUDE.md` first (the resume procedure), then this file, then `PROGRESS.md` (problems first), `TASKS.md`,
`DECISIONS.md` (session 3: D-033 … D-070, D-082 … D-087, D-130 … D-134; agents' ranges below) and `BLOCKERS.md`.
**Branch:** `claude/amazing-fermi-40ds7j` (sessions 2 and 3). Never force-push.

## What is broken, unverified or placeholder (read first)
1. **No gate after Phase 2 has passed.**
   - The §8.2 rubric review and the independent Phase 3–7 reviews have not run. They wait for the interior-light and twilight merges.
   - The rubric has no reference photographs (every photo host is blocked, B6): a logged exception, not a pass.
2. **Moments at high quality (rendered in session 3):**
   - interiors are near black;
   - dawn reads as midday;
   - the stair-climb is dark;
   - the trees are crude.
   - **Dusk smoke did not show:** it was drawn in the colour of its own background, lit by the horizon radiance of the view direction. D-070 lights it with the mean skylight and adds a `mountain-dusk` view. Not yet re-rendered.
   - Seen and reasonable: night on the Terrace, the Gate at dusk, the Tachara S stair, the Hall 100 site, the Tripylon N stair.
3. **Built in this session, not yet seen in a render:**
   - the stair crenellations (D-065);
   - XPe on the Hadish E and W doorways (D-066);
   - the Treasury N range and the scribes' room (D-067).
4. **Grey domes in orchards (village P22):** the cause is the far impostors' per-vertex distance fade. The tree agent is fixing it.
5. **Phase 5:**
   - activity coverage fails (25 placeholder activities);
   - about 550 Terrace workers are unrendered;
   - rendered floors are unmet;
   - the §13.11 shadow review failed rounds 1, 2 and 3 (10, 3 and 3 of 20 below 4). The sim agent is fixing the round-3 findings. Round 4 needs a new unseen seed: not 7, 11, 23, 37 or 53.
6. **Bench:** all numbers before D-047 are void. The per-route bench jobs are queued.
7. **Calibration scene (§8.1):** blocked (NEEDS #13).

## Background agents (worktrees under `.claude/worktrees/`, branches `worktree-agent-<id>`; merge what is committed)
| Agent | Scope | Id ranges |
|---|---|---|
| Sim, round 3 (a7468…) | round-2 fixes merged; now fixing round-3 findings S1–S11 (REVIEWS/shadow_phase5_r3.md) | D-088, D-089, D-135 … D-139, Q-146 … Q-149 |
| Interior lighting (ab5df…) | irradiance probes; dark interiors | D-110 … D-114, Q-150 … Q-159 |
| Twilight (aa071…) | light curves, exposure (`src/sky/exposure.ts`), Earth's shadow | D-115 … D-119, Q-160 … Q-169 |
| Trees (a1ae0…) | species trees, leaf clusters, impostors matched to near trees; fixes the grey domes | D-120 … D-129, Q-170 … Q-179 |
| ~~Tachara plan (a7b31…)~~ | MERGED (51f8dde): Tachara from REF-PLAN, IoU 0.84, lance-bearers | D-130 … D-134, Q-180 … Q-184 |

Merge order for the rest: interior → twilight → sim (round 3) → trees. The sim round 2 and the Tachara are merged. After each merge:
- renumber any colliding D- or Q- ids;
- run `npx tsc --noEmit -p .`, `npx vitest run`, `npm run lint:all`, `npx tsx tools/dev/botcheck.ts` and `… slice`;
- rebuild the walkable grid (`npx tsx tools/build_nav.ts`) if the architecture changed;
- update PROGRESS.md and push.

After the sim merge, run a fresh independent shadow review (round 4) on a seed the builder never saw (the input comes from `npx tsx tools/shadow_days.ts 1 <seed>`).

## Next steps, in order
1. Judge the queued renders (runner below): `scribe1` (the scribes' room), `dusk3` (mountain-dusk and terrace-w-dusk after D-070), `naqsh1` (NR reliefs D-069), `relief2` (reliefs-raking reframed), and the four bench routes. Record the bench numbers (draw calls, triangles) in PROGRESS.
2. (done) Dusk smoke: the cause was found and fixed in D-070; judge the re-render.
3. Merge the agents as they hand back (above).
4. Render all moments at high quality (≤ 2–3 high views per run). Then run the §8.2 rubric and the independent Phase 3/4/5/6/7 reviews as fresh subagents (`REVIEWS/`), and record the gates honestly.
5. Open items:
   - the court assembly moment (the seasonal setting's retinue);
   - camera-rig views of the Phase 4 areas at high quality;
   - Phase 8 translations (NEEDS #14);
   - listening to the voices (H8);
   - Phase 9 and FINAL_REPORT.md.

## Tools
- **Render runner** (`scratchpad/runner.sh`, started in the background):
  - It runs job files from `scratchpad/jobs/*.job` in name order, one at a time. A job file is three lines: name, spec, env (e.g. `E2E_PORT=5199 Q=test ONLY=scribe-at-work`).
  - Logs go to `scratchpad/e2e_<name>.log` and `scratchpad/runner.log`; screenshots to `shots/`.
  - It calls `tools/dev/queue_e2e.sh`, which serialises every queued run on `/tmp/parsa-e2e.lock` (agents use the same script). Never wrap it in another `flock`: that self-deadlocks.
- Debug specs `tests/e2e/dbg_*.spec.ts` run only with `DBG=1` (playwright.config testIgnore):
  - `dbg_plain` hides plain layers one by one at village P22;
  - `dbg_smoke` renders the dusk views with `?smokedbg`;
  - `dbg_rain`.
- **Snapshots** (`tools/e2e_snapshot.sh`) now leave out `.claude/`, about 0.3 GB each. Delete old `scratchpad/snap_*` by hand, never one that is running: check `ps` first. A mistaken delete killed the slope-s-dusk run.
- `tools/dev/botcheck.ts`: the offline walkthrough bot (all areas: 97 legs, including the scribes' room and the Tachara rooms; `slice`: 28 legs).
- `tools/dev/px.mjs` measures pixels; `tools/dev/pxdiff.mjs a.png b.png [thresholds]` counts pixels that differ between two shots.
- **REF-PLAN in the grid:** grid = s·R·[px, −py] + t with s 0.47284, R rot(−18.51°), t (−37.664, 300.563). Sample it with Pillow (`pip install pillow numpy scipy`). A pixel is wall if R+G+B < 420. This is how the Treasury N range was read (`tools/apply_treasury_rooms_patch.py`).
- Walkable grid (D-067): the grid keeps doorways down to about 1.1 m: in a narrow passage, a cell is kept when its centre is at least 0.3 m from the obstacles.

## Gotchas (sessions 2–3)
- **`pkill -f <pattern>`:** never use it with a pattern that appears in your own command line; it kills your own shell (exit 144). Use PIDs.
- **Long Playwright runs:** don't pipe them through `head`; closing the pipe stalls the run.
- **TSL:**
  - never a runtime `select()` in a graph that TRAA renders (D-012);
  - `pow()` of a negative base is NaN, so write x·x;
  - `smoothstep` with reversed edges is undefined, so use `1 − smoothstep(lo, hi, x)`;
  - r186 binds a `Data3DTexture` through a 2-D view and fails, so use a 2-D atlas;
  - colour uniforms type-check only against floats, so cast to `any`.
- **Frames outside three's animation loop** must advance `renderer._nodes.nodeFrame` (D-047). E2E specs stop the loop after load, and the test clock is frozen: use `__parsa.setTime(day, hour)`.
- **`world.update` ctx:** `ctx.sky` is `sky.state`; the SkySystem (horizon radiance, sun light) is `ctx.skyLight`.
- **Vitest console output is suppressed:** write debug dumps to a file.
- **Load contention:** SwiftShader renders take 4–15 min each, and agents share the queue. Queue only what you will look at.
- **Removing old agent worktrees** is refused by the permission classifier. Leave them; they cost about 55 MB each.
