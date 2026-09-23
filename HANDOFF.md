# HANDOFF — state at the end of session 1 (2026-09-23)

Read `CLAUDE.md` first (the resume procedure), then this file. Then read `PROGRESS.md`, `TASKS.md`, `DECISIONS.md` and `BLOCKERS.md`.

## What is broken or placeholder (read first)
1. **High-quality renders are washed out. Root cause found, not yet fixed.**
   - A same-view comparison at the same exposure (2.75) shows the SSGI composite in `src/render/pipeline.ts` lifts every pixel:

     | quality | mean luminance | darkest pixel |
     |---|---|---|
     | test | 88 | 5 |
     | medium | 88 | 5 |
     | high | 161 | 55 |
     | high, shadows off | 162 | 54 |

   - Shadows are not the cause.
   - Suspect `add(col.rgb.mul(gi.a), dif.rgb.mul(gi.rgb))`: GI is added at full strength on top of direct light, or the SSGI output is not in the space assumed.
   - Fix it, then re-render the moments with `Q=high`.
   - Repro: `QS=test,medium,high npx playwright test tests/e2e/dbg_quality.spec.ts --project=webgpu` (screenshots go to `shots/dbgq-*.png`).
2. **The calibration scene (§8.1) is blocked.** No dated photograph of the ruin is reachable; every photo host is blocked (B6, B7). Stone and light values are uncalibrated C estimates.
   - Unblock with NEEDS #13: a dated photo plus date and time in `references/calibration/`.
   - The user asked what this is for. It is a renderer check against a real photo of today's surviving stone, not content shown in the game.
3. **The rubric review (§8.2) and the independent review (§13.9) for the Phase 3 gate have not run.** They should run after fix 1.
   - Expect scores below 4 on materials, detail and people: flat procedural surfaces, placeholder bodies, a featureless court floor and plain.
   - The one real photo reference, the calibration shot, is missing. The rubric can only compare against the user's reconstruction references (`references/INDEX.md`), which are renders and paintings, not photographs.
4. **Other placeholders:**
   - People bodies and animation: rigid-skinned rigs with hand-made poses.
   - Speech voice: a formant synthesiser, not rated.
   - Reliefs: extruded silhouettes.
   - No volumetric clouds.
   - The town (Phase 6) and the plain's fields (Phase 7) do not exist yet. Workers come from an off-map edge 600 m out on the plain.

## Phase status
- Phases 0–2 passed with logged exceptions (see `PROGRESS.md`).
- **Phase 3 is not passed.** Done and tested:
  - materials, post, CSM, eye adaptation;
  - reliefs and inscriptions;
  - fire and smoke, weather VFX;
  - spatial audio and soundscape;
  - 65 living people (D-010);
  - speech, crowd murmur and the language lint (D-011);
  - the walkthrough bot over the whole slice: 28 legs, no falls, no pop-in, no errors.

  Open: fix 1 above, the moments at high quality, the rubric and independent reviews, the performance proxy with people (`npm run bench`), and the calibration scene (blocked).
- **Phase 4 research is ready but not applied.**
  - `research/PHASE4_ACCESS.md` and `research/_phase4_spec_patch.json` hold the stairs and doors of the Tachara, Hadish, Tripylon, Hall of 100 Columns, Harem and Treasury, measured on the registered plans (zones B, geometry C).
  - It found model discrepancies:
    - the Treasury N wall is at y ≈ −78, so the current NE door at (201.8, −66.3) sits in a street;
    - the Harem main wing is missing its northern part;
    - the Hadish hall is about 26 m square, not 38 m;
    - the Tripylon hall is 15.46 m square, not 12 m;
    - the Tachara W stair postdates 467.
  - Apply the patch to `src/data/site_spec.json`, extend `src/arch/terrace.ts`, then rebuild the walkable grid.

## How things fit together (new this session)
- **People:**
  - `src/people/` holds `sim.ts` (roster, schedules, needs, goods, save/load), `navgrid.ts` (walkable grid, A*), `body.ts`, `anim.ts`, `crowd.ts` and `activities.ts` (the registry the activity lint checks), plus `speech_lines.ts`.
  - Places are in `src/data/people_places.json`; names in `src/data/names.json` (583 attested; built by `tools/build_names.py`, method in `research/NAMES.md`).
- **Walkable grid:**
  - `npx tsx tools/build_nav.ts` (about 25 s) writes `public/generated/nav.i16` and `nav_edges.u8`, generated from the physics colliders.
  - `tests/people.test.ts` fails if the grid is older than the architecture: **rerun it after any change to `terrace.ts` or `site_spec.json`.**
- **Audio:** `src/audio/` holds `speech.ts`, `murmur.ts` and `phonemes.ts`. The language lint is `tests/language.test.ts` (`npm run lint:lang`).
- **Test API:** on `window.__parsa`: `people()`, `advanceWorld(s, dt)`, `navPath(a, b)`, `address()`, `popins`, `resetFalls()`, `exposureInfo()`.
- **E2E specs:**
  - `people.spec.ts`: work renders, movement and collision, speech.
  - `walkthrough.spec.ts`: the §13.8 bot.
  - `moments.spec.ts`: run one shot at a time with `ONLY=<name>` and optionally `Q=high`; all shots together time out under SwiftShader.

## Verification status (last run)
- `npx vitest run`: 91 passed, 1 skipped.
- `tsc --noEmit`: clean.
- E2E: the people, speech and walkthrough specs pass on WebGPU (SwiftShader).
- Screenshots live in `shots/`, which is gitignored.

## Next steps, in order
1. Fix the SSGI composite (item 1 above). Re-render the §1.1 moments on the route at `Q=high`, then measure luminance ranges (§8.3: no clipping, plausible ranges for sky, sunlit stone and shade).
2. Improve surfaces the renders show as flat:
   - the Terrace court floor (currently uniform grey; surface C);
   - mud-brick wall plaster;
   - the plain's ground cover (at least near the approach).
3. Run the rubric review and the independent Phase 3 review as fresh subagents that have not seen the build. Log the findings in `REVIEWS/phase3.md` and fix the critical ones.
4. Run `npm run bench` with people for the performance proxy, and update the README budgets.
5. Record the Phase 3 gate honestly in `PROGRESS.md` (the calibration exception stays logged). Then start Phase 4 from the research patch.

## Repository
- There is a single branch, `claude/new-session-lfjkbn`, which is also the remote's default branch. All work, including the speech agent's branch, is merged into it and pushed.
- The agent worktree was removed.
