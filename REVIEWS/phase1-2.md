# Independent review: Phase 1 (engine foundation) and Phase 2 (Terrace greybox)

Reviewer: an independent subagent that did not see the build process. Date: 2026-09-22.

**What was audited**
- The committed gate state `e515f28` ("Phase 2 gate"). It was exported to a clean directory and every check was run there.
- The working tree holds uncommitted Phase 3 edits: `src/render/materials.ts`, `src/render/pipeline.ts`, CSM, and changes to `main.ts`, `meshes.ts` and `terrainMesh.ts`. They are not part of either gate. The same checks also pass on the working tree.

**Documents read:** brief §3, §5.2, §5.3, §6, §7, §13, §14 (Phases 1–2); PROGRESS, DECISIONS, BLOCKERS, REAL_HARDWARE_TODO, README; REVIEWS/phase0.md.

**Code read:**
- `src/arch/*`, `src/terrain/*`, `tools/build_terrain.py`, `src/sky/*`, `src/weather/*`, `src/player/*`, `src/main.ts`
- `src/core/{geo,calendar,clock,save,rng,settings}.ts`, `src/world/*`, `src/ui/overlay.ts`, `tools/lint_chrono.ts`
- all of `tests/*.test.ts` and `tests/e2e/*.spec.ts`, plus the `shots/*.json` outputs

Playwright was not run, as instructed.

## Commands run (on `e515f28`)
| Command | Result |
|---|---|
| `npx vitest run` | **39 passed, 1 skipped** (Horizons test, skipped because `data/horizons/sun.csv` is absent, B2). Exit 0 |
| `npx tsx tools/lint_chrono.ts` | `lint:chrono OK — 26 structures, 0 registered assets, 1117 generated parts in 12 buildings, 66 blocklist terms`. Exit 0 |
| `npx tsc --noEmit` | clean. Exit 0 |

**Printed values**
- Sun vs the Meeus reference: worst error 0.0410°.
- Monthly mean temperature errors: −0.18 −0.46 0.49 −0.22 0.04 −0.14 −0.46 0.02 0.05 0.08 0.46 −0.81 °C.
- Wet days: **28** for seed 1, against a target of 29.8.
- Ring seams: near/mid 0.01 m, mid/far 0.02 m.
- Geometric IoU: terrace 0.9998, apadana 1.0000, gate 0.9516, tachara 1.0000, hadish 1.0000, hall100 **0.9901**, tripylon 1.0000, treasury 1.0000, harem 1.0000, garrison 1.0000, grand_stair 0.9638.
- Rendered IoU (shots/plan-overlay-*.json, both backends, 10 buildings): gate 0.9516, grand_stair 0.9605–0.9623, the rest 0.997 or higher.

---

## CRITICAL (gate text false)
None. Both gate texts are literally true:
- **Phase 1** ("Terrain spot-checks and §13.6 pass; budgets recorded"): the spot checks and §13.6 tests pass, with the Horizons exception logged (B2), and budgets are in the README.
- **Phase 2** ("Plan overlay and dimension tests pass"): both pass on both backends.

The MAJOR findings below show that several of these checks are much weaker than PROGRESS.md implies.

## MAJOR

### MJ-1 Magic numbers throughout the generators (brief §3.1 "Geometry comes only from SITE_SPEC", §7 "No magic numbers")
Many dimensions in `src/arch/terrace.ts` are neither SITE_SPEC rows nor derived from them. Most are tagged `C`/`RECON` on the part, so the dev overlay shows "C". But none of them has a spec row, a basis or a note, so they cannot be audited or upgraded later. Grid counts are also hard-coded, even where SITE_SPEC has the row. Editing the spec therefore does not change the model, so the generators are only partly spec-driven. The list, by line (all in `src/arch/terrace.ts` unless stated):

- **L50, L280:** `a[0] > 200` selects the E side (a hard-coded coordinate threshold).
- **L54:** terrace parapet thickness `0.6`. The box is also centred on the edge line, so it overhangs the wall face by 0.3 m.
- **L65:** `wW = 6.2`, the W-lane flight width. It appears only in the prose note of `flight_width` and is not a row.
- **L85–88:** stair parapets are stepped "per 7 steps" (`7`). They are tagged 'C','RECON' as literals.
- **L104–113, Gate of All Nations:**
  - `roofY = H + 2.0`;
  - floor `-0.3..0.02`;
  - roof thickness `1.2`;
  - colossus offset `0.7`, width `1.4` and height `5.5` (and the colossi are tagged **B** / IR-PERS despite these invented sizes);
  - L113 `side === 'W' ? tx : tx` is a no-op branch.
- **L125:** Apadana `doorW = 4.0, doorH = 10.0` ("C: not obtained", but no spec row).
- **L130, L134:** Apadana `grid(6, 6 …)` and the portico loop `6 × 2` are literals. `hall_columns` and `porticoes` exist in the spec but are not read.
- **L142:** Apadana tower height `bh + 2`.
- **L143:** storerooms height `8`.
- **L150:** Apadana stair tread `stTr = 0.38` and width `stW = 7.0`.
- **L182–192, Tachara:**
  - hall offset `+3`;
  - `wt = 2.4`;
  - wall top `+1.5`;
  - doors `2.4/5.5` and `1.8/4.5`;
  - `shaftD 0.9`;
  - portico offset `4.5` and spacing `4.2`;
  - roof `+12`, `-2`, `1.5`.
- **L200–210, Hadish:**
  - **`ia = 5.4`** (the interaxial of a 36-column hall, entirely invented);
  - `+2`;
  - `hs = 7*ia`;
  - wall `2.8`;
  - top `+1.8`;
  - doors at `±8`, `2.6 × 6`;
  - `shaftD 0.9`;
  - grids `6×6` and `6×2` hard-coded;
  - portico offset `4.5` and spacing `4.6`;
  - roof `+5`, `+10`, `1.8`.
- **L221–227, Hall of 100 Columns:**
  - wall height `(H + 2)/3` (the `+2` is unsourced);
  - door width `3.2`;
  - grids `10×10` and `8×2` hard-coded;
  - portico at `y1 + 4.5` with row spacing `5.5`;
  - construction probabilities `0.55`, `0.35 + 0.3·u` (only the `0.3` traces to `construction_state`).
- **L237–240, Tripylon:**
  - hall `12 × 12`;
  - wall `2.2`;
  - wall height `H*0.5`;
  - doors `2.2`;
  - `shaftD 0.8`;
  - spacing `5`;
  - `built 0.5`.
- **L257–261, Treasury:**
  - floor `+0.3`;
  - wall `2.5 × 7`;
  - `shaftD 0.55`;
  - grid `9×11` (99 traces to `hall99`, but the factorisation is invented);
  - offset `+20`;
  - spacing `4.2`;
  - column y0 `0.3` duplicated as a literal.
- **L265–269, Harem:**
  - wall `2.2 × 7`;
  - `shaftD 0.6`;
  - grids `3×4` and `4×2` hard-coded, although spec rows exist;
  - offsets `+8` and `-14`;
  - spacing `4.5` and `4`.
- **L272, Garrison:** floor `+0.2`, wall `1.2 × 4`.
- **L288, fortification towers:** `[7, t + 2]`.
- **`src/arch/orders.ts`:**
  - L8 `capH = H*0.18` fallback;
  - L9 `shaftD = max(0.6, H/12)`;
  - L10 `baseH = min(1.6, H*0.075)`, `baseW = shaftD*1.55`, flutes default `40`.
- **`src/arch/meshes.ts`** (column profile): L37–50 use `1.25`, `0.45`, `1.02`, `0.14`, `0.93`, `1.5`, `0.95`, `3.4`, `1.1`, `0.23/0.33/0.44`. These are greybox proportions. They are acceptable only if they are recorded as C rows, and brief §7 requires "true profile curves" by Phase 3.

Also traceable but brittle: L38 and L41 hard-code OSM node coordinates. They are checked against the footprint at runtime, which is acceptable.

**Fix:** move every such value into `site_spec.json` as a C row with a basis, and read grid counts from the existing rows.

### MJ-2 Apadana N stair is detached from the podium, and half of its flights are buried
The stair is placed from `f.bounds` (`py1 = 59.71`, the tip of the NW tower projection). The N platform edge along the stair's whole x-range (−38.7…42.5) is at **y = 52.0** (footprint polygon).

**Consequences** (probed on `e515f28`):
- **Detached landing.** The N landing and flights sit at y 59.71–66.71, leaving a **7.7 m court-level trench** between the stair and the podium. A player who climbs the stair reaches a free-standing 3 m block and must then drop 3 m and face a 3 m wall.
- **Buried flights.** The landing box (x ±29.4 about cx, from FOUND to 3.0 m) completely encloses the two central converging flights: **60 of the 120 N-stair steps are inside a solid box**. The same happens on the E stair.
- **E stair gap.** The E stair uses `px1 = 65.35`, the SE corner. The E edge is slanted, so a 0.1–1.5 m slot opens between the stair and the podium.

This is on the Phase 3 vertical-slice route (Apadana forecourt). No dimension test covers the Apadana stairs: the manifest echoes `stairLength` and nothing checks it.

### MJ-3 The plan overlay is circular for 10 of 11 structures, and PROGRESS overstates the exceptions
PROGRESS says platform-type buildings get IoU 1.0 by construction, and that "only the Grand Stair (0.962), Gate (0.952) and Hall of 100 Columns (0.997) test generator geometry non-trivially". The Gate and Hall 100 claims are false:
- **Gate:** walls = `footprint.bounds`, with the wall thickness derived as `(bounds − hall_side)/2` (terrace.ts L99–101).
- **Hall 100:** floor = `footprint.bounds` (L217–220).

Their IoU therefore measures only how rectangular the OSM polygon is. Treasury, Harem and Garrison "floors" and all platforms are the footprint polygon itself. Only the Grand Stair is partly independent, and even there the lane x-coordinates are OSM values.

The overlay also checks no interior layout: hall position, porticoes, towers and stairs. That is why MJ-2 passes.

Also:
- PROGRESS says the overlay passes "for all 11 structures on both render paths (rendered)". The rendered test (`plan.spec.ts`) has **10** cases; the terrace is geometric-only.
- The geometric Hall 100 IoU is 0.990, not 0.997; 0.997 is the rendered value.

### MJ-4 Terrain "spot checks 7/7" are self-consistency checks, not checks against known elevations (brief §5.2.4)
Every elevation reference in `tests/terrain.test.ts` comes from the same Copernicus DSM (LANDSCAPE.md: "DEM at the point"), or holds by construction:
- **Plain W = 1613.5:** this is the DSM value (subagent B).
- **Terrace relief ≈ 12 m:** circular. `court_asl` is *defined* as `plain_at_stair_asl`(DSM) + 12 (`site_spec` global.court_asl, DERIVED). The test then checks court − DSM foot ≈ 12.
- **"Under the platform below the court":** forced by `build_terrain.py` L89 (`h[inside] = min(h, COURT − 1)`).
- **Kuh-e Rahmat 2163:** this is the DSM maximum (subagent C).
- **Naqsh-e Rustam 1630:** "DEM at the point". The distance/bearing check uses hard-coded coordinates.
- **Grid round-trip and seam agreement:** internal checks.

These checks do validate that the pipeline (reprojection, rotation, bare-earth, infill) does not corrupt the DSM, and that has value. But no independently known elevation (survey benchmark, published spot height, excavation contour) is checked, and PROGRESS reports "7/7" without saying so. Log this as an exception tied to B6, or add at least one independent control.

### MJ-5 The "save/load round trip" e2e test asserts nothing
`tests/e2e/phase1.spec.ts`, "save / load round trip":
- It calls `setTime(40, 15.5)`, reads the clock label, and stores `JSON.stringify(localStorage)` in a variable.
- It never calls the `save`/`load` hooks (`writeSave`/`readSave`/`restore`) and never compares restored state.
- `shots/phase1-*.json` records only `savedLabel`.

No unit test covers save/load either. `restore()` also ignores the saved `seed` and `timeScale`: loading a save made with another seed silently shows different weather. Save/load is a Phase 1 deliverable, and it is unverified.

### MJ-6 Phase 0 review N-2 (phantom scripts) is still open, and m6 is unaddressed
- **N-2:** REAL_HARDWARE_TODO.md and BLOCKERS B5 still tell the user to "run `npm run bench`… The run writes `bench-reports/<date>.json`". There is no `bench` script in package.json, no `bench-reports/` directory, and `src/world/bench.ts` only offers a browser download. The Phase 0 review listed N-2 as "must fix before Phase 1 gate".
- **m6** (also "before Phase 2 generators"): DECISIONS D-002 still describes an ENU frame with +X east via UTM 39N. The code (`geo.ts`, `build_terrain.py`, SITE_SPEC) uses a tmerc grid rotated by 19° (grid north = 341° true, +X = *grid* east). The code is internally consistent (checked below), but the recorded decision is wrong.

## MINOR
- **m-1 Tautological or weak tests** (`tests/arch.test.ts`):
  - The chronology test (L86–89) checks ids (`palace_g`, `palace_a3`, `tombs_rahmat`, `modern`, `modern_roof`) that the generator can never emit, because building names are literals. It cannot fail. The real check is `lint_chrono.ts`, which is sound.
  - The Hall 100 test title claims "10 × 10 grid at 68.5/11 m" but checks only the count (116) and `10 < raised < 90`. The actual raised count is 38 %, against the spec's "~30 %".
  - The Tachara/Hadish test checks `manifest.*.floor`, which is the spec value echoed back. The platform prism's y1 is never measured.
  - The Gate test checks `manifest.hallInteriorX` (an echo), not wall positions.
  - Unchecked spec rows: Apadana stairs, portico depth and wall/building height; fortification thickness and height; Treasury's 99 columns; Tripylon floor.
  - "Dimension tests 19/19" counts the 11 overlay tests and one sanity test; there are 7 dimension-type tests.
- **m-2 Gate colossi are invisible.** The four placeholder colossus boxes lie entirely inside the wall boxes (for example, y 121.29–122.69 inside the wall segment 112.2–122.69, and 5.5 m tall inside an 18.5 m wall). They can never be seen or hit by the overlay ray. They are the only parts flagged `placeholder`.
- **m-3 Garrison chronology.** chronology.json says the OSM garrison footprint "also covers a later 32-column hall, excluded". But `perimeter('garrison', …)` walls and floors the *whole* 186 m OSM polygon, so the outline of a post-467 structure is rendered as garrison enclosure.
- **m-4 Harem columns use the modern museum footprint.** They are positioned from the bounds of `museum_modern` (absent in 467, blocklisted) via `FOUNDPRINT('museum_modern')`. This is defensible, since the museum stands on the Harem hall, but it is undocumented and invisible to the lint.
- **m-5 Unreachable platforms.**
  - The Tachara (2.6 m), Hadish (6.0 m) and Tripylon (2.6 m) platforms are extruded from OSM outlines that include their stairs, so the stairs are rendered as sheer solid blocks and nothing can be climbed.
  - The Treasury enclosure has no entrance ("not yet cut").
  - This is acceptable for a greybox, but must be fixed before §13.8 bots cover every walkable area (Phase 4).
- **m-6 Single flat court.** The terrace top is one flat plane at the court datum. SITE_SPEC/Q-018 and the DSM (S terrace 1628.5–1630.5) indicate different levels.
- **m-7 Subsystem micro-bench counters.** `shots/subsystems-*.json` records `drawCalls: 0, tris: 0` for all modes, including 2000 individual meshes, which is impossible. The counters are read after `requestAnimationFrame`/reset. Nothing flags this. D-008 correctly rests its decision on standard practice instead.
- **m-8 Stale budgets.** README budgets (99 draws, 1.11 M tris "approach view") were recorded at 21:48, *before* the architecture existed. They were not re-measured after Phase 2 (1117 parts). PROGRESS says "wet days 29 vs 29.8"; the current run gives 28.
- **m-9 Shadow type mismatch.** `main.ts` still sets `PCFSoftShadowMap`, while D-007 says PCF is used. The e2e tests filter `/deprecated|PCFSoft/` console errors out of the error check.
- **m-10 Weather gate partly by construction.** The ±1 °C gate is met largely by construction (monthly re-centring keeps 35 % of the anomaly; expected monthly SD ≈ 0.3 °C). This is logged in D-005 and is acceptable, but it should be read as a calibration target rather than an independent validation.
- **m-11 Player movement untested.** Falling off the Terrace edge and running are claimed but not tested (`lastFall` is never asserted). The stair walk bot's result is printed to the console only and not recorded in `shots/`. I could not verify it without Playwright.
- **m-12 Star test not independent.** It compares our matrix path with astronomy-engine's own star path, so it tests usage, not precession accuracy. It is labelled honestly.

## Checks that found no problem
- **Frames and signs:**
  - `geo.ts` latLon↔grid (rotation −19°) matches `build_terrain.py` (TX = GX·c − GY·s).
  - `azAltToWorld` (true az − 341°, grid north = −Z) is correct.
  - Star azimuth from astronomy-engine HOR axes (x = N, y = W): `atan2(−hy, hx)`, with the matrix transposition matching `RotateVector`.
  - Heightfield row 0 = north matches world z = −north.
  - Rapier heightfield orientation is verified against bilinear samples to within 0.5 m.
  - `api.view`/`walkTo` yaw conversions and player forward/right vectors are correct.
- **Calendar and clock:**
  - JDN 1550958 = 17 Apr −466 (P&D).
  - 354-day year of 12 months.
  - `jdUT = JDN − 0.5 + t − LMT/24` is correct for local mean time.
  - Old Persian month equivalences 1–4 are correct.
  - Climate months are taken by solar longitude, so there is no Julian drift.
- **Sun:**
  - The Meeus reference is genuinely independent code. Its ΔT differs from astronomy-engine's, which only affects TT-dependent terms.
  - The equinox falls on 26–29 Mar (Julian), and 1 Nisannu is near new moon.
  - The Kasten–Young airmass formula is correct.
- **Chronology:** no generated part belongs to an absent structure (lint, fail-closed). No blocklisted item is rendered. Palace H, the unfinished gate, the A3 Tachara stair and the Rahmat tombs are all excluded.
- **Grand Stair:** 111 steps per side, uniform riser 12/111, the top step lands exactly at the court, and the L-shaped landing layout is consistent with the SITE_SPEC y-ranges.
- **Honesty:** the placeholder body and procedural ground are flagged in code and PROGRESS. PROGRESS leads with what is broken.

## Required before the Phase 3 gate
MJ-1 (spec rows for every dimension), MJ-2 (Apadana stairs, which are on the slice route), MJ-3 (correct the PROGRESS claim and add an interior-layout check), MJ-4 (relabel the spot checks or add an independent control), MJ-5 (a real save/load round-trip test), MJ-6 (bench docs and D-002).

VERDICT: PASS
