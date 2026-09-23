# HANDOFF — state at the end of session 2 (2026-09-23)

Read `CLAUDE.md` first (the resume procedure), then this file, then `PROGRESS.md`, `TASKS.md`, `DECISIONS.md` (D-012 … D-020 are new) and `BLOCKERS.md`.
**Branch:** `claude/amazing-fermi-40ds7j`. Session 1 used `claude/new-session-lfjkbn`; this branch contains all of it. Push to whatever branch the new session designates, and never force-push.

## What is broken, unverified or placeholder (read first)
1. **The visuals are still far from photoreal.** The rubric review (§8.2) and the independent Phase 3 review (§13.9) have **not** run.
   - Merged at the end of the session, all tier C and not yet render-checked together: sculpted columns and colossi (with known look faults), carved reliefs (never seen in a browser) and the human asset pipeline.
   - People on screen are still the placeholder rigs. See "Agent results at handoff" below.
2. **The §1.1 moments have not been re-rendered at high quality** since the fixes. `tests/e2e/moments.spec.ts` now has 5 Phase 4 views and logs luminance to `shots/moments-lum.json`. Render them after the agent work is in.
3. **Bench numbers:** the high-quality bench run this session is **invalid**. `renderer.info` accumulated across post-processing passes; this is fixed in the last commit (`info.autoReset = false`, reset once per frame). **Re-run `QUALITY=high npm run bench`.**
   - The earlier per-frame numbers are also suspect: a 2,753 draw-call peak on the approach at high quality, near the ≤ 3,000 budget.
4. **The soak test fails** (baseline, D-017): near-copy days (couriers 1.0, scribes 0.84, masons 0.70…), and only 3 event kinds a week. This is expected and is the Phase 5 work list.
5. **Hadish walkthrough leg:** fixed (the stair side opening is now 3 steps), but **the e2e rerun has not completed**. The other five Phase 4 areas pass the walkthrough bot, with no falls, pop-ins or errors.
6. **Not yet verified in a render:** the volumetric clouds, the new surfaces (clay-painted walls, court fill, seasonal plain, relief normals), the door frames and the Treasury goods.
   - Only the Apadana view was rendered after the surfaces change. There, the Apadana N doorway frame reads as a black block: check the `limestone_dark` albedo.
7. **Translation layer:** built; its e2e check (`tests/e2e/translation.spec.ts`) has **not run**. Inscription translations are not shown, because no published translation is reachable (NEEDS #14). Only the ARIo transliteration and the lexicon's word glosses (about 25 % of words) appear.
8. **Calibration scene (§8.1):** still blocked (NEEDS #13).

## Done this session (all committed and pushed)
- **SSGI washout fixed (D-012).**
  - Root cause: r186's SSGI node outputs AO and GI as separate textures (`getAONode` / `getGINode`), and the old composite added albedo-red × AO everywhere.
  - New composite: `scene − (1 − AO) · skylightDiffuse + albedo · bounce`. The sky is excluded from the SSGI through a patched copy of the node (`src/render/ssgi.ts`), and the GI scale is π/2 (C).
  - Also fixed: a WebGPU validation error (MSAA depth copied into TRAA's history), and a high-quality boot hang caused by any runtime `select()` in the TRAA-input composite.
  - Measured: high mean luminance 93.3 vs medium 99.6 (it was 161).
- **Phase 4 geometry (D-013, D-015, D-016):**
  - the research patch is applied (`tools/apply_phase4_patch.py`, idempotent; re-run it from a clean spec);
  - Tachara S stair, Hadish W and E double-reversed stairs, Tripylon N, S and narrow E stairs, Hall of 100 Columns doors, portico, step band and thresholds;
  - Treasury N wall moved to y −78 (the street reopens), and the Hall of 99 Columns has walls, a roof, benches and 854 instanced attested goods;
  - Harem main wing extended N to y −73, with a hall, doors and entrance steps;
  - stone door frames; fires; per-hall acoustic rooms; guard posts at the Tachara, Hadish and Harem.
- **Tests and tools:** the plan overlay compares against the trace plus documented corrections; there are new dimension tests. The nav grid uses 4-neighbour erosion. The literal lint's broken string tokeniser is fixed; it had hidden literals since Phase 2, which are now in the spec.
- **Surfaces (D-014):** clay-painted mud plaster (B/C); red plaster hall floors; court fill (C, Q-027); a seasonal herb layer on the plain (`src/world/season.ts`); procedural relief normals on every surface.
- **Translation layer** (`src/ui/translation.ts`): subtitles; inscription transliteration with glosses; map on M; chronicle on J. `?tl` forces it on.
- **Phase 5 start (D-017):**
  - abstract simulation LOD (`PeopleSim.updateLod`); promotion never teleports;
  - `npm run soak` (`tools/soak.ts`) with justified gates;
  - load-time catch-up of elapsed world time (`world.catchUp`, capped at 30 days).
- **Volumetric clouds** (`src/sky/clouds.ts`): a raymarched cumulus slab with cover and wind from the weather. Not yet seen in a render.
- **Tools:**
  - `tools/e2e_snapshot.sh`: runs e2e against a frozen copy, so edits can't hot-reload a long run;
  - `tools/dev/queue_e2e.sh`: serialises runs;
  - `tools/dev/{navcheck,routecheck,pathcheck,profile}.ts`: offline nav and physics probes;
  - `tests/e2e/dbg_boot.spec.ts` with `&trace`: boot-stage markers;
  - `tests/e2e/dbg_quality.spec.ts`: `QS=high,high+post=scene|ao|gi`, `WEATHER=`, `V=`.

## Agent results at handoff (all merged into this branch; 134 tests pass, tsc clean, lint:chrono OK)
- **Sculpted columns and Gate colossi (D-018), merged:**
  - lathe bases, true fluted shafts (48 flutes on the Apadana), composite and double-bull capitals, and SDF colossi, precomputed by `npm run sculpt` into `public/generated/sculpt_*.bin` (1.4 MB), with per-instance LODs;
  - new row `apadana.portico_capitals` (hall and N/E porticoes composite, W portico bulls);
  - **known look faults, not fixed:**
    - the limestone material draws ashlar joints across the carving (a joint-free "carved" material is needed);
    - the curls read as bubble wrap and the protome horns are too small (sheep-like);
    - the Gate door leaves hide the colossi, and the wall ring overlaps the jamb volume in the parts/colliders.
  - Everything is tier C.
- **Carved low-relief figures (D-019), merged, but NOT YET SEEN IN A BROWSER:** RTIN heightfield meshes, 30 figure kinds, BatchedMesh with a Web Worker pool, and the `buildRegister` API.
  - **Run `npx playwright test -c playwright.relief.config.ts --project=webgpu` first.** If BatchedMesh or the workers fail under WebGPU or WebGL2 there is no fallback, and the reliefs will be missing.
  - Only 15 of the 23 delegations fit the modelled landings (15.8 m vs about 27 m).
- **Humans from MakeHuman CC0 (D-020), merged as a pipeline only:**
  - `tools/build_humans.ts` produces 23 body variants, a 59-bone rig and 3 LODs (3 MB in `public/generated/humans/`).
  - **The game still uses the old placeholder rigs.** To do: the runtime loader, the fitted period dress, hair and beards, headgear, the skin material (use arithmetic masks, not `select()`, per D-012), retargeting the activity poses, crowd and player integration, and the CPU budget test.
- **Phase 5 research, merged:**
  - `research/EVENTS.md`, `src/data/population.json`, `src/data/events_calendar.json` (56 events, 20 cause-effect rules);
  - a P5 section in PEOPLE.md; Q-030–Q-046.
  - Headlines: Terrace by day about 575 (winter 425) and at night about 125; town 6,300–7,000; plain about 36,000.
  - Almost every rhythm is C: only 67 PF texts were read in full.
  - It proposes a soak floor of **8** event kinds a week (the harness currently uses 6; decide and log).
- **Phase 6/7 research, merged:**
  - `research/SETTLEMENT.md`, `research/PLAIN.md`, `src/data/settlement.json` (20 features), `src/data/plain.json` (34 features, a crop calendar, river flows); Q-047–Q-055 (renumbered).
  - **Actions it left for us:**
    - add its structure ids to `src/data/chronology.json` before any geometry uses them;
    - sync `src/data/blocklist.json` with the 9 new rows in `research/ANACHRONISM_BLOCKLIST.md`;
    - decide Q-047 (Xerxes' tomb at Naqsh-e Rustam, possibly cut by 467).
  - **Measured skyline gap:** the far terrain ring stops at 40.96 km, so mountains 55–66 km away (0.1–0.4° high at 150–160°, 230–250° and 270–290° true) are missing. Widen the ring to about 70 km in `tools/build_terrain.py`.
  - `src/core/geo.ts` drifts about 80 m at 40 km from the pyproj frame; use `tools/osm_to_grid.py` for far features.

## Next steps, in order
1. **Render-check the merged agent work** (reliefs first: no fallback). Then fix the known faults:
   - a joint-free carved-stone material for capitals and colossi;
   - the relief view;
   - the Gate door leaves.
   Re-run `npx tsc --noEmit`, `npx vitest run` and `npx tsx tools/build_nav.ts` after any change to the architecture or people.
   Finish the human runtime integration (D-020 to-do list).
2. Re-run the pending checks:
   - `AREA=hadish` walkthrough;
   - `tests/e2e/translation.spec.ts`;
   - a clouds render (`QS=high WEATHER=overcast DAY=25 HOUR=10 V=-20,72,1.6,251,22`);
   - `QUALITY=high npm run bench`.
   Use `tools/dev/queue_e2e.sh <snapshotDir> <spec> --project=webgpu`. SwiftShader is slow: one run at a time.
3. Phase 5 from the research (`src/data/population.json` and `events_calendar.json`, if merged):
   - town life at the abstract level (households, homes, the well, visits);
   - rota and post rotation, days off, errands;
   - the events calendar (rations, deliveries, couriers, offerings as attested);
   - construction progress that visibly changes the Hall of 100 Columns columns;
   - memory of the player; the population scale-up (`LOD_RADIUS` in world.ts);
   - crowd pooling for dynamic rosters (`crowd.ts` builds one rig per agent at start).
   Iterate until `npm run soak` passes.
4. Render all moments at `Q=high` and run the rubric plus the independent Phase 3 and Phase 4 reviews as fresh subagents (log them in `REVIEWS/`). Then record the Phase 3 and Phase 4 gates honestly in PROGRESS.md.
5. Then Phase 6 and 7 from the research agent's `research/SETTLEMENT.md` / `PLAIN.md`, if merged.

## Gotchas learned this session
- **Never `pkill -f <pattern>`** where the pattern appears in your own command line: it kills your own shell (exit 144). Use `tools/dev/kill_e2e.sh`, or PIDs.
- **Don't pipe a long Playwright run through `head`:** closing the pipe stalls the run.
- **TSL:** a runtime `select()` in a node graph that TRAA renders to a texture hung the node build. Choose variants when building the pipeline instead.
- **The walkable grid** must be rebuilt after any architecture change (`tests/people.test.ts` checks the parts hash). Validate routes offline with `tools/dev/routecheck.ts` before a slow e2e run.
- **`tools/apply_phase4_patch.py`** re-applies spec rows from the research patch plus the session-2 fixes. It is idempotent on the committed spec.
