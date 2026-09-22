# DECISIONS (decision · alternatives · evidence · reversible?)

## D-001 Engine stack (Phase 0, provisional until Phase 1 benchmarks)
- **Three.js r186 WebGPURenderer + TSL**, automatic WebGL2 backend fallback (`forceWebGL` for the separate test path).
  Alt: Babylon.js (brief mandates Three.js). Evidence: both paths verified available in headless Chromium (PREFLIGHT.md).
- **TypeScript + Vite**; tests: **Vitest** (unit/dimension/sky/weather/soak) + **Playwright** (camera rig, walkthrough bots, bench).
- **Sky/ephemeris: astronomy-engine** (MIT; VSOP87 truncated + ΔT model of Espenak–Meeus; supports dates back to −2000s,
  proleptic Julian handling via our own calendar layer). Alt: hand-rolled Meeus (more error-prone), JPL Horizons (blocked, B2).
- **Physics: Rapier (`@dimforge/rapier3d-compat`)** for character controller (step-up, slopes, falls). Alt: custom capsule vs BVH
  (three-mesh-bvh) — kept as fallback if WASM init fails in tests.
- **Navigation: recast-navigation-js** (Recast/Detour WASM, crowd). Alt: grid A* (C-tier fallback for sim-LOD agents).
- **Randomness: one seeded PRNG tree** (sfc32 streams derived from WORLD_SEED + subsystem name) — deterministic tests.
- **Fonts: @fontsource Noto Sans Old Persian / Cuneiform / Imperial Aramaic** (OFL).

## D-002 Georeference and world frame (revised in Phase 0/1; review MJ-6)
- **Grid frame:** the origin is the Apadana OSM centroid (29.9351174 N, 52.8894969 E). The axes follow the Persepolis building grid: grid north = 341° true, i.e. rotated 19° W of true north.
- **World frame:** +X = grid east, +Y = up, −Z = grid north. Heights are metres relative to the court datum (1625.0 m asl, EGM2008 geoid, the Copernicus vertical datum).
- **Data processing:** a transverse Mercator centred on the origin, then rotated −19° (tools/osm_to_grid.py, tools/build_terrain.py). The browser uses an ellipsoidal tangent-plane approximation (src/core/geo.ts), tested against the pyproj-derived control to under 3 m.
- The earlier UTM/ENU plan was superseded by the rotated grid so that the architecture is axis-aligned.

## D-003 YEAR = 467 BCE (Xerxes I regnal year 19; astronomical year −466). Default start: 1 Nisannu = 17 April 467 BCE (proleptic Julian), JDN 1550958
**Alternatives:**
- 498 BCE (Darius I yr 24): the Fortification Archive peak, recommended by research subagent C (`research/_date_decision_C.md`).
- 466 BCE: the other Treasury peak year.

**Why 467:**
1. §3 priority 4 and Phase 3 require the route plain → Grand Stairway → **Gate of All Nations** → Apadana. The Gate of All Nations is Xerxes' (XPa, tier A), so it did not exist in 498. The Grand Stairway's builder is disputed (Darius vs Xerxes), so it too may be absent in 498. The 498 date would break the brief's core route.
2. "Height of its glory": the Apadana (completed by Xerxes), Tachara (completed, XPc), Hadish, Gate of All Nations, Harem and final Treasury all stand (tier A/B).
3. Construction is an asset: the Hall of a Hundred Columns is a live building site (begun by Xerxes, finished by Artaxerxes I; tier B).
4. The Treasury Archive peaks in Xerxes yrs 19–20 (Iranica, via extract; B), so this is the best-documented year of the Treasury period for named people. Examples are the treasurer Baratkama and the Treasury workmen paid partly in silver.

**Cost, accepted and logged:** far fewer named people than 498 (128 of 753 Treasury tablets published vs 2,120+ PF texts). The Fortification-era individuals named in brief §4.4 do not appear in person: Parnakka died c. 497/6, and Irdabama and Irtašduna are Darius-era. Irtašduna may still be alive (C). Earlier PF names may be reused only for *unnamed* NPC names, never as the same person (§9.1).

**Default start:** 1 Nisannu yr 19 falls in spring. It is 17 Apr 467 BCE per Parker & Dubberstein, via the machine-readable transcription seanredmond/parker_and_dubberstein (row `1550958 -466 4 17 1 Nisanu 30`), tier A for the Babylonian calendar. It is tier B for its Persian equivalence: Adukanaiša ≈ Nisannu. Year 19 has 12 months. The intercalary Addaru II (18 Mar 467) closes Xerxes year 18, so the regnal year runs 17 Apr 467 – 5 Apr 466 (354 days). (Corrected after the Phase 0 review, M-9.)

**Court presence (revised after Phase 0 review C-1).** No source places Xerxes at Persepolis on any date in 467 BCE (Q-005). The brief (§2) says the king is present only on dates the evidence supports. So:
- **Default (evidence-strict): the king is ABSENT all year.** A reduced garrison keeps watch, especially on the Treasury (§9.1). The world shows the absence: the Apadana is closed, the court tents are struck, and the Terrace is a working building site and treasury.
- The out-of-world setting **Court calendar = "seasonal pattern"** (tier C) models the B-tier general pattern: Persepolis as a spring/summer residence of a mobile court (WP-PERS-SEASON, RESIDENCE2021), with New Year court traffic (KING2022, Darius period). In that mode the court is in residence from 1 Nisannu to the end of Du'uzu. The §1.1 "court in full assembly" camera scene uses this mode and is labelled C.
- Conflict with brief §0 ("court in residence") is logged in BLOCKERS B9: §2's evidence rule wins by default.
- The default start date stays at 1 Nisannu: it is the start of the regnal year and the New Year. No date in 467 is better evidenced, so moving the start would not satisfy "evidence places the court" either.

**Why 467, not 466 (the other Treasury peak year):** this is a tie-break, not an evidence-based choice (corrected after re-review M-9). Both years are Treasury peak years, both lie before Xerxes' murder (465), and neither has evidence of court presence. 467 was taken as the first of the two peak years. Named Treasury individuals (e.g. Baratkama) are **not yet** shown to be attested in year 19 specifically; that is checked in Phase 5 before any named person is placed.

**Early Artaxerxes I years (464–458):** rejected. The Hall of 100 Columns would be further along (B), but the Treasury tablets thin out (a few per year to year 7), the king's presence is equally unevidenced, and the new reign's building programme (Palace H) is unknown in extent.

## D-004 Climate target
WMO CLINO 1991–2020 Shiraz 40848 (tier A, modern). Persepolis adjustment: Tmean and Tmin −1.5 °C, Tmax −1.0 °C, precipitation unchanged (tier C; lapse rate plus the Zarghan comparison). No paleoclimate temperature correction is applied (none sourced). A precipitation multiplier of 1.0 applies, with at most +10% as a C tunable (Maharlou cores: wet 3800–2000 BP; B). Modern dust and haze day counts are scaled ×0.5 for pre-modern (C) because modern pollution is excluded.

## D-005 Weather generator calibration (§13.6 interpretation)
- The gate "a simulated year's monthly mean temperatures within ±1 °C" is tested on the WORLD_SEED=1 year and, for robustness, on 10 more seeds.
- Precipitation-day counts are tested two ways: the annual count of the simulated year against the climate target, and a 50-year monthly climatology for months with ≥3 wet days. Both must be within ±20%.
- To keep a single year inside these tolerances while keeping realistic day-to-day variability, monthly means and wet-day counts are re-centred toward the normals. 35% of each month's sampled anomaly is kept, which corresponds to interannual variability of about 1 °C (C).

## D-006 Terrain pipeline
- Rings, in the grid frame: near 4 km at 4 m, mid 16 km at 16 m, far 82 km at 80 m. Storage is Uint16 quantised to 1–3 cm.
- Bare-earth approximation: an alternating grey opening/closing (r = 110 m) plus Gaussian smoothing, applied where the 150 m-smoothed regional slope is below 3–6%. This removes trees, buildings, the 1971 tent city, canals and embankments from the plain, and keeps the mountain (C).
- Terrace foot: Laplace infill in a 90 m band on the W, N and S sides. Under the platform the height is held at plain level during the infill, so no DSM smear leaks out. The platform itself is geometry.
- Ancient ground level: modern bare-earth, with no correction (Q-003).

## D-007 Render-path compatibility (measured in the sandbox)
- **Headless WebGPU** needs `--use-vulkan=swiftshader`. Without it, even a raw WebGPU clear loses its device ("A valid external Instance reference no longer exists"). Flags are in playwright.config.ts.
- **three r186** sets `swizzle:'rgba'` on texture views, which Chromium 141 rejects. `src/render/compat.ts` retries without the field. It does nothing on newer browsers.
- **Reversed-Z** is used on WebGPU. SkyMesh pins depth to 1.0, which is the *near* plane under reversed-Z, so the sky, moon and stars are drawn first without depth testing. The WebGL2 fallback cannot use reversed-Z without clip control, so it uses a logarithmic depth buffer.
- **PCFSoftShadowMap** was removed in r186 WebGPU; PCF is used instead. Soft and contact-hardening shadows are Phase 3 work (§8).

## D-008 Phase 1 subsystem choices (benchmarked where the sandbox can measure)
- **Terrain:** CPU-built chunk LOD with skirts, three rings. GPU displacement (brief example) is deferred: the CPU chunks already cost < 1.2 M triangles and 99 draws at the approach view, and a geomorph/clipmap version is a Phase 9 optimisation (logged).
- **Repeated architecture elements:** InstancedMesh per element type per building. Static walls are merged per building. SwiftShader cannot show draw-call cost (REAL_HARDWARE_TODO H2), so the choice rests on standard GPU practice (B).
- **Shadows:** a single 4k directional map following the player (high); CSM arrives in Phase 3. Shadow cost doubles SwiftShader frame time (H3).
- **Physics:** Rapier heightfield per ring plus trimesh per building. The character controller has autostep 0.4 m and snap 0.35 m, verified by vitest (walk speed, grounding, collider orientation vs render heightfield).
- **Bots and soak:** use `simulate(seconds, dt)`, a fixed-step simulation without rendering, so results don't depend on software-renderer speed.

## D-009 Review phase1-2 responses
- **MJ-1:** every generator dimension is now a SITE_SPEC row. Reconstruction choices are `r_*` rows (tier C, each with a note). A test fails if a numeric literal other than structural constants appears in src/arch/terrace.ts.
- **MJ-2:** the Apadana N and E stairs now attach to the podium's measured edge at the stair span, and landings no longer contain steps (tested).
- **MJ-3 / MJ-4:** PROGRESS wording is corrected. An independent SRTM-derived elevation check has been added (tests/data/srtm_points.json).
- **MJ-5:** the save/load round trip is now asserted in e2e. A save made with a different seed reloads the world with that seed.
- **MJ-6:** `npm run bench` exists (tests/e2e/bench.spec.ts, writing bench-reports/). D-002 now describes the actual rotated grid frame.
- **GTAO** fails shader compilation under SwiftShader, so the medium profile uses TRAA without AO. SSGI and TRAA convergence can only be judged on hardware (REAL_HARDWARE_TODO H5).
