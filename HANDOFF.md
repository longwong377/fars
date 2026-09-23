# HANDOFF — state during session 3 (2026-09-23)

Read `CLAUDE.md` first (the resume procedure), then this file, then `PROGRESS.md` (problems first), `TASKS.md`,
`DECISIONS.md` (session 3: D-033 … D-062) and `BLOCKERS.md`.
**Branch:** `claude/amazing-fermi-40ds7j` (sessions 2 and 3). Never force-push.

## What is broken, unverified or placeholder (read first)
1. **No gate after Phase 2 has passed.** The §8.2 rubric review and the independent Phase 3–7 reviews have not run. The §1.1 moments have not been rendered at high quality since the session 2 and 3 fixes. The rubric has no reference photographs: every photo host is blocked by the egress policy (B6, rechecked in session 3), so the reviewer can only judge from its knowledge of real photographs. That is a logged exception, not a pass.
2. **Changed but not yet seen in a render** (session 3):
   - the sky calibration and the fog/haze/smoke lighting (D-060);
   - the rain-approach moment's new slot (day 241, 13:24);
   - the Hall of 100 Columns construction view and building site (D-062);
   - the DNa/DNb carving (D-061);
   - the map's town and plain scales;
   - the plain agent's last three fixes (D-037 … D-040).
   One sky check was rendered (`shots/dbgq-high.png`: deep-blue sky, cumulus with structure, far terrain between the plain and the horizon sky in brightness). A runtime crash from D-060 (the smoke read `ctx.sky`, which is `sky.state`, not the SkySystem) was found by the e2e and fixed: the world now receives `ctx.skyLight`.
3. **People on screen** are still the placeholder rigs until the humans agent merges (D-020 runtime).
4. **Phase 5:**
   - activity coverage fails (25 placeholder activities);
   - about 550 Terrace workers are unrendered;
   - rendered floors are unmet;
   - the §13.11 shadow review FAILED; the sim agent is fixing it and a fresh reviewer must re-run it.
5. **Bench:** all earlier numbers are void (frames outside the animation loop skipped the scene pass, fixed in D-047). Re-run `QUALITY=high npm run bench`.
6. **Calibration scene (§8.1):** blocked (NEEDS #13).

## Background agents at the time of writing (worktrees under `.claude/worktrees/`)
They may not survive a restart. Each works on a `worktree-agent-<id>` branch; merge what is committed there.
- **Phase 4 (a48ca…):** reliefs on the new stairs and jambs, windows, doors, merging far relief sets (draw budget). Uses D-070 … D-079.
- **Humans (a7359…):** runtime loader, dress, crowd pool on `sim.visibleAgents`. Uses D-090 … D-099.
- **Sim (a7468…):** shadow-review fixes; households linked to `src/data/town_plots.json`. Uses D-080 … D-089.
- **Access research (abc85…):** `research/ACCESS.md` and `src/data/access.json` for visitor mode, docs only. Uses Q-120 … Q-129 and D-100 … D-104.

After each merge:
- renumber any colliding D- or Q- ids;
- run `npx tsc --noEmit`, `npx vitest run`, `npm run lint:all` and `npx tsx tools/dev/botcheck.ts`;
- rebuild the walkable grid (`npx tsx tools/build_nav.ts`) if the architecture changed; `tests/people.test.ts` checks the parts hash;
- update PROGRESS.md and push.

## Next steps, in order
1. Judge the queued sky-calibration render (`scratchpad/e2e_skycal2.log`: rain-approach, stair-climb, reliefs-raking at test quality, plus the translation e2e with the map scales). Measure pixels with `node tools/dev/px.mjs <png> x,y,label …`. Then render rain-approach at high quality.
2. Merge the agents as they hand back (above).
3. Implement visitor mode from `src/data/access.json`: guards stop you, the *halmi* check, the errand, guards' memory of you.
4. Render all moments at high quality (≤ 4 views per run), the dusk-smoke views (`tests/e2e/settlement.spec.ts` `ONLY=slope-s-dusk,terrace-w-dusk`), the plain views and the construction site. Then run the rubric and the independent reviews as fresh subagents (`REVIEWS/`), and record the gates honestly.
5. Run the bench, then Phase 8 (language and speech depth; translations need NEEDS #14) and Phase 9.

## Tools
- **Render queue:** `tools/dev/queue_e2e.sh <snapshotDir> <spec…> --project=webgpu` runs one Playwright job at a time against a frozen copy of the tree. The copy is taken when the job starts, not when it is queued.
  - Give every job its own snapshot dir and `E2E_PORT`.
  - `ONLY=` picks moment views, `Q=` the quality (test while iterating; high only for the final check).
  - The watchdog `tools/dev/e2e_watchdog.sh` kills any run older than 15 min.
- `tools/dev/botcheck.ts`: the offline walkthrough bot (seconds, all 77 legs).
- `tools/dev/px.mjs`: pixel measurements from a PNG (Playwright's bundled pngjs).
- `tests/e2e/dbg_quality.spec.ts` (`QS=`, `V=`, `DAY=`, `HOUR=`, `WEATHER=`), `dbg_stats.spec.ts` / `dbg_draws.spec.ts` (draw calls per object).
- `npm run terrain` regenerates the terrain from `data/dem/` (byte-identical after the Phase 7 merge).

## Gotchas (sessions 2–3)
- **`pkill -f <pattern>`:** never use it with a pattern that appears in your own command line; it kills your own shell (exit 144). Use PIDs.
- **Long Playwright runs:** don't pipe them through `head`; closing the pipe stalls the run.
- **TSL:**
  - never a runtime `select()` in a graph that TRAA renders (D-012);
  - `pow()` of a negative base is NaN on the GPU, so write x·x;
  - r186 binds a `Data3DTexture` through a 2-D view (validation error, black frame), so use a 2-D atlas (`src/sky/cloudNoise.ts`);
  - colour uniforms type-check only against floats, so cast to `any` to add vec3 nodes.
- **Frames outside three's animation loop** must advance `renderer._nodes.nodeFrame`, or the scene pass is skipped (`main.ts`, D-047).
- **`world.update` ctx:** `ctx.sky` is `sky.state` (sun and moon data); the SkySystem, with its horizon radiance and sun light, is `ctx.skyLight`.
- **Heavy unit tests** time out when renders share the 4 cores. Measure before calling anything a flake. The walkable-grid test now uses one flood fill (4 s).
- **Load contention:** SwiftShader renders take 4–15 min each; queue at most what you will look at.
