# PROGRESS (problems first)

## Broken / placeholder / weak (read first)
- The player body is a PLACEHOLDER figure. Ground colour is procedural (C). No weather is rendered yet except cloud cover, haze and fog (Phase 3).
- The night sky has no Milky Way or airglow. Star brightness is perceptual (C).
- No primary sources reachable (B6). The whole SITE_SPEC is tier B/C; nothing is A. The plan overlay compares against OSM, not Schmidt.
- No evidence places Xerxes at Persepolis in 467, so the king is ABSENT by default (D-003). The court appears only in the C-tier "seasonal pattern" setting.

- **People (Phase 3, in progress):** bodies and animation are PLACEHOLDERS. They are procedural rigid-skinned rigs with hand-authored pose cycles, not photoreal humans, and faces are abstract. The Phase 3 slice has 65 people: 30 guards on three watches at 10 posts, a mason gang of 12 plus a foreman, 6 porters, 2 scribes, 2 bakers, 4 grinders, 3 children, 2 couriers and 3 officials. The town is off the map (Phase 6), so the edge of the plain stands in for home. There is no Recast navmesh yet (D-010).

- **Speech (D-011) is a PLACEHOLDER formant synthesiser** (robotic; not yet rated for intelligibility). The lexicons are thin: Old Persian has no greeting, so Persians greet in Aramaic or by gesture. The murmur is built from lexicon sound patterns, and languages with no lexicon (Greek, Egyptian, Lydian, Babylonian) fall back to C-tier profiles.
- **Columns and Gate colossi are procedural sculpture (D-018, tier C), not measured carving.** They are reconstructed from the type (recollection), not from drawings, scans or photographs. Licensed scans would replace them (NEEDS #10). Known weak points:
  - The first renders (shots/sculpt-*.png) show three faults. The limestone wall material's ashlar joint lines are drawn across capitals, protomes and colossi, so the carving reads as brickwork; carved members need a joint-free surface (not done). The curls are plain bosses, not spirals, and read as "bubble wrap": on the lamassu they run unbroken from the beard down the chest.
  - The protome's bull heads are generic, and the horns are too small (they read as ears).
  - The volute scrolls are coarse (2.5 k triangles).
  - The colossi's leg count and proportions are not verified.
  - The protome axis is always grid E–W (the beam direction is unknown).
  - The Gate's open door leaves stand against the reveals over the front of the colossus flanks (layout).
  - The Gate wall ring still overlaps the jamb volume in the colliders; only the render cuts it out.
  - Treasury columns render with one material (timber) for the stone base, the plastered shaft and the capital.
- **Calibration scene (§8.1) not done:** no dated photo of the ruin is reachable (NEEDS #13). Stone and light values remain C estimates, and the Phase 3 gate can pass only with this logged exception.

- **High quality (session 2):** the washout is fixed (D-012: r186 SSGI outputs AO and GI separately; the old composite added albedo-red × AO everywhere). A boot hang on the new composite is fixed too (D-012 addendum). The moments are **not yet re-judged at high quality**, and the GI scale (π/2) is a derivation, not a calibration.
- **Phase 4 (session 2, in progress):**
  - Stairs, doors, corrected outlines and frames are built for the Tachara, Hadish, Tripylon, Hall of 100 Columns, Treasury and Harem (D-013, D-015).
  - Every stair geometry is C inside B plan zones, and every court level is C.
  - **Not built:** the Hadish balcony stairs to the Harem, the Harem portico step, the Tachara's third small stair, windows and niches, furnishings (thrones, hangings, stored goods), and reliefs on the new stairs and door jambs (the relief agent's figures come first).
  - The Phase 4 walkthrough routes validate offline; the **e2e run is pending**.
- **Phase 5 (started):** abstract simulation LOD, load-time catch-up and the soak harness exist (D-017). **The soak test FAILS** (near-copy days; 3 event kinds a week). There is no events calendar, town life, rota rotation or construction progress yet.
- **Translation layer:** subtitles, inscription transliteration with lexicon glosses (no published translation: NEEDS #14), map and chronicle. The e2e check has not run.
- **Volumetric clouds:** implemented (C shapes and optics) but **not yet seen in a render**.
- **Bench:** the high-quality numbers from session 2 are invalid (draw calls accumulated across post passes; fixed, re-run needed).
- **Surfaces (D-018):** walls are clay-painted mud plaster (B/C); floors are red plaster (B Tachara/Treasury, C elsewhere); the open courts are compacted fill (C, Q-027); the plain has a seasonal herb layer (C). All procedural, no photo calibration.

## Phase status
| Phase | Status | Gate |
|---|---|---|
| 0 | research bible; review FAIL → fixes → re-review PASS (REVIEWS/phase0.md). Logged exceptions: no primary sources (B6); king absent by default (B9); footprints single-source (GEOMETRY_DIFF) | **passed with logged exceptions** |
| 1 | Engine foundation: renderer (WebGPU + WebGL2 fallback, both verified headless), terrain rings (Copernicus, bare-earth, terrace foot), sky/sun/moon/stars (astronomy-engine, HYG with proper motion), seeded weather generator + runtime, Rapier player (walk/run/step-up/fall), placeholder body, shell (title, click-to-start, pause, settings, controls, key remap), save/load, dev overlay, bench mode, Playwright + vitest harness | **passed with logged exceptions**: terrain spot checks 7/7 (self-consistency with the Copernicus DSM and by-construction values; review MJ-4), plus an independent check against SRTM-derived AWS Terrain Tiles on 39 points: plain bias −5.3 m (a dataset-level difference that the raw DSM shows too), LE90 < 5 m; §13.6 sun 0.041° vs an independent Meeus implementation (Horizons blocked, B2); monthly T within 0.81 °C; wet days 29 vs 29.8. Budgets recorded (README). Exceptions: real frame rate not measurable (REAL_HARDWARE_TODO); sky is Preetham analytic (C for twilight/night); no volumetric clouds, rain or snow rendering yet (Phase 3) |
| 2 | Terrace greybox from parametric generators (src/arch): Terrace platform + stair recess, Grand Stair (111 steps/side), Gate of All Nations, Apadana (72 columns, towers, N/E stairs), Tachara, Hadish, Hall of 100 Columns (under construction), Tripylon (under construction), Treasury, Harem, garrison, E fortification | **passed with logged exceptions**: plan overlay IoU ≥ 0.95 and offset < 0.5 m for all 11 structures on both render paths (rendered, 0.25 m/px) and geometrically; dimension tests 19/19; chronology lint covers generated parts; walk bot climbs the Grand Stair and passes through the Gate. Exceptions (corrected after review phase1-2 MJ-3):
- The footprints are OSM ruin traces, not Schmidt's plan (B6).
- For every building except the Grand Stair, the overlay mostly checks the footprint against itself. Platform-type buildings are built *from* their footprint polygon, and the Gate and Hall of 100 Columns are built from their footprint's bounding box, so their IoU only measures how rectangular the traced ruin is.
- Only the Grand Stair (0.962) is partly independent, because its flights come from spec rows.
- The overlay's real value is verifying the grid→world→render transform on both backends (10 structures rendered, 11 checked geometrically). |
| 3 | Vertical slice: materials, reliefs, fire, weather VFX, audio, 65 people, speech/murmur, walkthrough bot (28 legs pass). Open: SSGI washout, rubric + independent review, bench, calibration (blocked) | **not passed** |
| 4 | Rest of the Terrace (session 2): Phase 4 patch applied; stairs, doorways with stone frames, corrected Treasury/Harem outlines, floors, fires, acoustic rooms, guard posts; overlay + dimension tests pass (overlay vs trace + documented corrections); nav grid reaches every palace floor | **in progress**: walkthrough e2e, reliefs on the new stairs/jambs, windows/niches, furnishings, people beyond guards |
| 5 | started: simulation LOD, catch-up persistence, soak harness (baseline fails) | — |
| 6–7 | research agent (session 2): see HANDOFF | — |
| 8 | translation layer built (e2e pending); speech/murmur from Phase 3 | — |
| 9 | not started | — |
