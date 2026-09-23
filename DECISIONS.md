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

## D-010 People navigation and simulation (Phase 3)
- **Navigation: walkable grid generated from the physics colliders, not a Recast navmesh (for now).** `tools/build_nav.ts` flood-fills a 0.5 m grid over the plain W of the Grand Stair and the whole Terrace. A neighbour cell is walkable when it is within one step (0.42 m) and two clearance rays (0.6 m and 1.6 m above the ground) hit nothing. The grid is then eroded by one cell. It runs in 4 s, and a test fails if the grid is older than the architecture (parts hash). NPCs therefore can never walk through anything the player cannot. A* (8-connected, no corner cutting, with a climb penalty) plus string pulling finds paths; they are cached by 5 m buckets. A Recast/Detour build with crowd steering stays the Phase 5 option once the population and settlement need it.
- **Simulation:** pure TypeScript with no renderer dependency, so it can move into a worker in Phase 5. Every decision draws from `Rng(seed, person:day:decision#)`, so outcomes don't depend on frame rate. Tested: identical for the same step size, and >85 % the same between 2 s and 5 s steps.
- **Time jumps** (a date change, load, or a gap of more than 15 minutes): everyone is placed where their schedule puts them at that time (`jumpTo`), rather than being simulated step by step. This follows the continuity rule in §9.2. The full catch-up simulation is Phase 5.
- **Names:** only attested names (`src/data/names.json`: PF tablets, tier A; the EWB lexicon, tier B). Workers of origins with no attested names in the pool (Ionian, Lydian, most Egyptians) are left **unnamed**, as the tablets often record workers by group. Their out-of-world note says so.
- **Doors cut into the garrison and Treasury enclosures** (`r_doors`, tier C): the garrison's W door faces the masons' yard, and the Treasury's single entrance is at the NE, reached through the garrison court. The Hall of 100 Columns floor (+0.5 m) and the other raised palaces have no stairs yet, so they are not walkable until Phase 4.
- **The stair-head braziers moved** to flank the way to the Gate at x = −33.4. They previously stood in the middle of the upper-flight lane.
## D-011 Minimal speech + crowd-murmur pipeline and language lint (Phase 3)
- **Synthesiser:** a Klatt-type formant synthesiser in TypeScript (src/audio/speech.ts) renders lexicon IPA to PCM, which plays through Web Audio (AudioBuffer → HRTF panner → `voices` channel). No external TTS and no network call. PCM rather than a live node graph so it is measurable in node (tests/speech.test.ts measures formant regions, fricative centroids, stop closures, F0 declination) and can be pre-rendered at build time later. Tier C, placeholder quality until the reviewer rates it (brief §10 acceptance).
- **Swappable:** `VoiceBackend` interface; backends are tried in order, so a `RecordingBackend` (local files only; network URLs refused) or a better TTS replaces the formant voice line by line.
- **Lines:** src/people/speech_lines.ts holds lexicon ids only; English glosses are subtitle-layer data. Missing words → line omitted, gap logged (Q-022 … Q-025). Persians greet in Aramaic because Old Persian has no attested greeting.
- **Murmur:** phonotactics counted from each lexicon (onsets, nuclei, codas, syllables per word); pseudo-words that romanise to a common modern word are rejected; languages without a lexicon use the Aramaic profile, flagged C.
- **Language lint:** tests/language.test.ts (`npm run lint:lang`, part of `lint:all`): speech-line fields classified in/out-of-world, heard IPA scanned against a modern-word list (English, modern Persian/Arabic/Hebrew/European greetings, placeholder words) with an explicit homograph allowlist tied to lexicon entries; carved text must be period script only; text-rendering call sites must be registered. The modern-word check is a heuristic (a curated list, not a full dictionary or phonetic matcher) — logged as a known limit.
## D-012 GI composite (high/ultra) and the SSGI washout (Phase 3, session 2)
- **Root cause of the washout:** in three r186 the SSGI node's own output is the **AO texture** (red-only); GI moved to `getGINode()`. The pipeline read `gi.rgb` = (AO, 0, 0) and `gi.a` = 1, so it added albedo-red × AO to every pixel and applied no occlusion. Mean luminance rose 88 → 161 and the darkest pixel 5 → 55 (HANDOFF item 1).
- **Composite now:** `out = scene − (1 − AO) · skylightDiffuse + albedo · bounce`. `skylightDiffuse = albedo · hemiIrradiance(n) / π` is recomputed in the composite from the hemisphere light's own uniforms, so AO darkens only the skylight (never the sun, whose occlusion is the shadow map) and the one-bounce GI is added once.
- **Sky excluded from SSGI:** a patched copy of the node (`src/render/ssgi.ts`, MIT) skips samples whose depth is the clear value (the sky writes no depth, D-007), so the sky is neither an occluder nor a light source (skylight is the analytic hemisphere light; counting sky pixels again would double it). The centre-pixel sky test is reversed-Z aware.
- **GI scale π/2 (C):** with uniform sectors weighted by the receiver cosine, a surface fully enclosed by radiance L accumulates 2L/π per slice, while a Lambert surface under that enclosure reflects albedo·L. Derivation only; judged on hardware (REAL_HARDWARE_TODO H5).
- Alternatives: three's `builtinGIContext` with a pre-pass (GI applied inside the materials) needs a second scene render or last-frame GI; rejected for cost. Keeping the example's `col·AO + albedo·GI` would darken sunlit crevices by AO and double the skylight.
## D-013 Phase 4 access geometry applied (session 2)
- `research/_phase4_spec_patch.json` applied to `site_spec.json` by `tools/apply_phase4_patch.py` (idempotent). Colliding keys renamed (`portico` → `portico_layout` for the Hadish and Harem); new source keys added to `sources.json`.
- **Generator changes** (`src/arch/terrace.ts`; polygon booleans via polygon-clipping, MIT, `src/arch/poly.ts`):
  - **Tachara:** platform stops at the building front (y −99.2); S stair = two flights of 26 × 0.10 m rising to a central landing, outer parapet; hall centre y −80 (between the S doorway at −88 and the N pair at −72 on REF-PLAN), which gives the N rooms their ~15 m depth; N doorway pair ±6 m.
  - **Hadish:** hall 27 m square at 3.9 m pitch (both plans; replaces the 38 m reconstruction, Q-P4-06). Portico rows y −136.5/−140.5. W and E double-reversed stairs, 4 × 25 × 0.12 m each, cut out of the platform. The upper flights are widened by the 0.3 m the patch left between them and the platform edge, because that slot cut the stair off from the N court. The lane divider is as thick as the gap between the lanes. Doors N pair, S, E, W.
  - **Tripylon:** hall 15.46 m; doorways N/E/S only. The platform gains the N portico and stair-head terrace, the S court and the E corridor. N stair 2 × 26 × 0.10 m; small S stair (C); narrow E stair of 20 risers. It **starts at the court (0), not 0.5**: the proposed foot level has no source and no passage floor is modelled, so the riser is 0.13.
  - **Hall of 100 Columns:** eight doorways at ±12.5 m on the aisles. N portico floor to y 27 between anta towers, plus a 3-step band down to the forecourt (C). Portico column rows at ¼ and ¾ of its depth. 3-step thresholds outside the W, E and S doors (C).
  - **Treasury:** N wall at y −78 (both plans), which reopens the street S of the Hall of 100 Columns; doorways N (206.6, −78) and E (217.5, −134.5).
  - **Harem:** enclosure = traced outline ∪ main wing extent (N to y −73). Main hall 16.5 × 16 m with 4 doorways, walls and a roof; 8-column portico. Entrances N (from the passage) and W, each with 7 low steps down from the 1.0 m floor (C).
  - **Not built** (logged, PROGRESS): the Hadish balcony stairs to the Harem (existence B, geometry unknown); the Harem portico step band (court and portico share the wing floor); the Tachara's unidentified third small stair (Q-P4-03).
- **Plan overlay:** the five corrected outlines are compared with the OSM trace plus the documented correction (the test prints each reason). Tachara and Hall 100 are still compared with the plain trace.
- **Walkable grid (D-010 addendum):** erosion is now 4-neighbour. A kept cell centre stays ≥ 0.35 m from anything blocking a neighbour, which is more than the 0.25 m body radius. 8-neighbour erosion (≥ 0.5 m) sealed real ~1.2 m gaps, such as the one between the Tachara S doorway and the first hall column on the axis.
## D-014 Surfaces (session 2): wall paint, floors, court fill, seasonal ground; literal lint fixed
- **Mud-brick walls:** mud plaster with a greyish yellow-green clay paint, attested at Pasargadae and, per Schmidt, on the Treasury walls (Stein et al. 2016, search extract): B for the coating, C for tone and extent (Q-028). Previously a warm brown (C).
- **Floors:** red lime-plaster finish (global.interior_floor) now also in the Tachara hall (B: the flooring-plaster study names the Tachara), the Treasury enclosure (B) and the Hadish, Tripylon and Harem halls (C).
- **Open courts:** no source for their surface (Q-027). Compacted fill with limestone chips (`court_fill`, C) on the Terrace platform top and the garrison/Harem enclosures; the platform's retaining walls stay ashlar.
- **Plain:** loam with stones and a seasonal herb layer. `src/world/season.ts` keys green/dry to the solar day of year, from the winter-rain/dry-summer regime (C).
- **Relief in shading:** each surface has a procedural height field that perturbs the normal (surface gradient from screen-space derivatives): trowelled plaster, sunk ashlar joints, raised chips, herbs. The geometry is unchanged.
- **Literal lint repaired:** its string stripping paired quotes wrongly (a double-quoted string containing apostrophes flipped inside/outside), which had hidden literals since Phase 2: −35 (Grand Stair recess test), 0.03/0.06 (Gate frieze), 0.01 (floor finish), dw/4. Those are now spec rows or derived values (`global.r_floor_finish`, `gate_nations.r_frieze.thickness/offset`, the E lane centreline). The lint now tokenises strings left to right.
- **Garrison W door** moved from y 22.5 to 32 (C): the Hall of 100 Columns portico and its E anta tower (REF-PLAN) now occupy y 8.3–27 there. The tower is clipped at the garrison's traced W edge.
## D-015 Door frames, fires and acoustics beyond the slice (Phase 4, session 2)
- **Stone door frames** (`global.r_door_frame`, C sizes): jambs lining the opening, a lintel and a projecting cornice block (the cavetto cornice: NOT SEEN, verify) at the Apadana, Tachara, Hadish, Tripylon, Hall of 100 Columns and Harem doorways; polished stone (`limestone_dark`). In the two unfinished buildings the frames stand complete above the low walls, since stone was set before brick (C). The Gate keeps its colossi and frieze without frames.
- **Fires** (all C placements): torches on the Tachara, Hadish and Harem hall walls; portico braziers midway between columns; a cooking hearth in the Harem court; torches at the Treasury N doorway. Positions are derived from the spec and manifest rows.
- **Acoustics:** each roofed hall's measured box is recorded in the manifest (`room`), and the world registers one Sabine space per hall (absorption `ROOM_ALPHA`, C). Previously only the Apadana and the Gate had literal dimensions.
- **D-012 addendum (session 2, the high-quality boot hang):** the first high-quality frame locked the main thread and crashed the page after ~120 s. Bisected with `?trace` boot markers and `?post=` variants: any runtime `select()` in the composite hung the node build, whether on the depth texture or on the debug uniform. That composite is the input TRAA renders to a texture. Root cause inside three not isolated; recorded as a limit. Fix: sky pixels now leave the patched SSGI with AO 1 and GI 0, so the composite needs no sky test. The debug views (`?post=scene|ao|gi|plain`) are chosen when the pipeline is built.
## D-016 Treasury Hall of 99 Columns and its stored goods (Phase 4, session 2)
- The hall now has walls one bay outside the column grid, a N doorway toward the Treasury entrance and a timber roof (C). It is registered as an acoustic room.
- Mud-brick benches run along the inner walls (C) and carry 854 instanced objects of the types reported among the Treasury finds (ISAC-FINDS, B): Egyptian alabaster bottles, Egyptian-blue bowls, green-chert mortar-and-pestle sets, bundles of bronze-tipped arrows, clay-sealed jars. Shares, forms and placement are C.
- Alternative rejected: leaving the hall as a colonnade in the open enclosure. The hall was roofed and its contents are among the best-attested objects on the Terrace.
## D-017 Simulation LOD and the §13.11 soak harness (Phase 5 start, session 2)
- **LOD:** each agent is `full` (walks nav-grid routes) or `abstract` (makes the same decisions but travels as a timed straight-line move: distance × 1.3 detour / walking speed, C). `PeopleSim.updateLod(player, radius)` promotes and demotes. A promoted agent is re-routed from where it is, so nobody jumps. A demoted agent keeps its remaining route time.
- **Soak (`npm run soak [days dt seed]`, tools/soak.ts):** one year headless, everyone abstract. Gates, justified here:
  - **Variety:** a day's signature is the (place, activity) in each half-hour bucket. Two days are a near-copy when they agree in ≥ 90 % of buckets; coarse buckets mean minutes of jitter do not count as variety. Pass: for every person, < 10 % of all pairs of days are near-copies. A strict "no two days alike" would fail any real rota: a guard's watch hours repeat by design, so the variety has to come from everything else.
  - **Events:** ≥ 6 distinct kinds per week (ration issue, deliveries, couriers, travellers, offerings, sickness/births, weather stoppages…). A lower floor would pass a world where only caravans and water runs happen.
  - **Stuck:** no task unchanged for > 30 h. **Stocks:** stay in [0, 5000].
- **Baseline (21 days, 83 people, 0.8 s): FAIL.** Near-copy share: couriers 1.0, scribes 0.84, masons 0.70, bakers 0.53, grinders 0.43, guards 0.14. Only 3 event kinds per week (caravan, issue, water). Stuck and stock gates pass; the seasonal ground state varies. Cause: town life (Phase 6) is a single `offmap` state, and there is no events calendar, rota rotation, days off, errands or visits. This is the Phase 5 work list.
## D-018 Sculpted column orders and colossi (procedural sculpture, tier C)
- **What:** the greybox columns (box/cylinder bases and shafts, capitals as three boxes) and the Gate of All Nations colossus blocks are replaced by parametric sculpture. `src/arch/sculpt.ts` builds the orders, `src/arch/sculpt_models.ts` holds the signed-distance models, `src/arch/sdf.ts` is the kit (SDF primitives, marching cubes, quadric simplification, crease normals). Every proportion is a row of `src/data/sculpture.json` with its basis in the note: tier C for shapes, B only where the type is attested (IR-COL/IR-PERS/RELIEF-R). SITE_SPEC order dimensions (height, shaft diameter, flute count, base and capital type, `capital_height`) are used as given; no column height is hard-coded.
- **Architectural members are lathes with relief, built at startup.** Square two-stepped plinth; inverted-bell base with a band of pendant leaves; drum; horizontally fluted torus; tapered shaft with N true concave flutes (circular-arc section, samples on every arris so the arrises stay sharp, sphere-ended terminations leaving plain bands at both ends); drooping-palm bell; ribbed calyx; bull collar; plain bolster and abacus. All 9 orders at both LODs, plus the Hall of 100 Columns construction states, take ≈160 ms in node and are cached per order.
- **Organic members are SDF models, precomputed offline.** The double-bull protome and the vertical double-volute member (unit = shaft diameter, fitted to each order's box) and the two colossus types (metres) are built from ellipsoids, round cones, rounded boxes, smooth unions, extruded 2D ornament and staggered lattices of bosses for curls. They are polygonised by marching cubes (tables from three/addons MarchingCubes, MIT) and simplified by quadric edge collapse. The collapse checks the link condition, folds and needles, and a clean-up pass collapses or flips slivers, so every mesh stays a closed 2-manifold with no degenerate triangle (tested). LOD1 is polygonised on its own coarser grid. `tools/build_sculpt.ts` (`npm run sculpt`, ≈60 s) writes `public/generated/sculpt_*.bin`: 16-bit positions, 8-bit normals, 1.4 MB for all 8 pieces, plus `sculpt.json`. The `.bin` files are re-included in git (`.gitignore` exception). The browser loads them before `buildMeshes` (≈25 ms decode). If they are missing, the pieces are generated on the spot (seconds), so a block is never shown. `tests/sculpt.test.ts` fails when an input changed since the last build: sculpture.json, the model sources, the SITE_SPEC capital boxes, or the colossus fore-part length measured from the layout.
- **Why precompute:** marching cubes plus simplification take 10–19 s per piece in node, which is far over the ~300 ms startup budget.
- **Alternatives rejected:**
  - three's `MarchingCubes` object: a dynamic metaball buffer, not an SDF polygoniser. Only its tables are reused.
  - Unsimplified marching-cubes meshes: 230–530 k triangles per piece.
  - LOD1 by simplifying LOD0 further: spiky, broken silhouettes.
  - Normal or displacement maps: there is no texture pipeline, and the brief wants real geometry at arm's length.
  - Licensed scans: none available (NEEDS #10).
- **LOD:**
  - Columns stay instanced. `InstancedLOD` keeps one InstancedMesh per level. Each instance switches on its distance to its own axis segment, at 32 m ± 2 m hysteresis.
  - The renderer calls `update(camera)` on objects flagged `isLOD`. Only perspective cameras switch levels, so the orthographic shadow pass draws what the view draws and there is no self-shadow mismatch.
  - Colossi use `MeshLOD`, switching at 40 m.
  - Budgets (tested): column LOD0 ≤ 25 k (composite orders 20.0–23.5 k, bull 12.3–16.6 k), LOD1 ≤ 3 k (2.1–3.0 k); colossus 50 k / 5 k.
- **Order and layout data changed:**
  - `apadana.portico_capitals` is a new SITE_SPEC row (IR-PERS search extract, B): hall and N/E porticoes have composite capitals, the W portico has double bulls set on the shaft. Until now all 72 Apadana columns were `bull`, although the `capital` row says composite.
  - Capital heights: `capital_height` now applies only to the building's own capital type (the Apadana composite, 7.8 m). The Gate's composite keeps the Apadana capital/shaft-diameter ratio: 6.70 m, DERIVED C (was 2.97 m, the 0.18 × height greybox default, too short for four members). Bull capitals are 2.2 D and the Treasury plain capital 0.9 D (C). Column heights and shaft diameters are unchanged.
  - Treasury timber shafts are unfluted (RELIEF-R, B: plaster-sheathed). Hall of 100 Columns shafts still under construction are unfluted drums, because fluting was cut after erection (recollection, C).
  - Colossus parts carry `sculpt`: the model comes from SITE_SPEC `guardians`, the head faces out of the doorway and the relief faces the passage. The box stays the collider and the plan footprint.
  - The render cuts the colossus and plinth volume out of the Gate's mud-brick wall (`cutWall`, render only). In the parts and colliders the wall ring still overlaps the jamb; that is a layout follow-up.
  - The walkable grid is byte-identical; only its parts hash changed.
- **Honesty:** these are procedural reconstructions of the type from general knowledge of Achaemenid carving, not from measured drawings, scans or photographs read in this project. They are tier C, with notes in the dev overlay pointing at NEEDS #10. `placeholder` is false because none of them is a block any more.
## D-019 Carved low-relief figures (session 2, relief agent)
- **Problem:** the stair reliefs were flat extruded 2-D silhouettes (ExtrudeGeometry of simple polygons) and read as paper cut-outs.
- **Technique (src/arch/relief_field.ts, relief_figures.ts, reliefs.ts):** each figure is a list of *masses* (body, near/far arm, sleeve, beard, hair, headgear, spear, gift, animal parts), each a union of exact 2-D SDF primitives (ellipses, tapered capsules, polygons, Catmull-Rom outlines and strokes) in the figure frame (x walking direction, y up, 1 unit = figure height). A mass is carved as a rounded pad: a crisp step at the outline (cut-back background), a quarter-round falloff, broad doming from a blurred coverage mask, surface detail (pleat sawtooth, snail-curl rows, flutes, feathers, mane tufts, strands), and a contour groove where it lies over another mass; masses are composited back to front (a front part rides above what it crosses and keeps its own height beyond it). Incised lines (almond eye, brow, lips, straps, muscle arcs) are cut last. Detail is band-limited (dropped when the grid has < 2.5 cells per period; sub-cell incisions widened with less depth).
- **Meshing:** the field is sampled on a (2^k+1)² grid and triangulated with a right-triangulated irregular network (RTIN, Evans et al. 2001 / mapbox martini): error-driven, crack-free; empty background triangles dropped; normals from the field by central differences; paint as vertex colours. Polygons rasterise by scanline sign + per-edge distance bands (cost ∝ perimeter, not area × vertices).
- **LOD (per figure):** L0 1.6 mm cells ≤ 513², within 1.2 m of the figure's bounding sphere; L1 3.2 mm ≤ 257², ≤ 4 m; L2 6.4 mm ≤ 129², ≤ 14 m; L3 12.8 mm ≤ 65² beyond; 12 % hysteresis. Bands chosen for ≳ 4 px per triangle at 1080p/70°. One `THREE.BatchedMesh` per relief set (one render object; identical figures share one geometry per kind+seed+grid+mirror, i.e. they are instanced; per-instance culling). Rosettes (5,000 on the Apadana) are instanced separately: carved within 2 m, a 40-triangle painted boss to 40 m, none beyond.
- **Generation:** browser: a Web Worker pool (≤ 3) generates every LOD, nearest first; the main thread only builds the batch skeleton and uploads meshes (figures appear as meshes arrive). node/tests: synchronous. `renderOnce` (tests) now waits for `world.settle()`. Measured (node, cold JIT, sync path): Apadana set 534 figures / 79 unique, coarse LOD for all in ~0.6–0.8 s; warm cost ~2 ms (65²), ~13 ms (257²), ~50 ms (513²) per figure.
- **Budget:** ≤ 1.5 M relief triangles from any camera position along the Apadana façades (tests/reliefs.test.ts walks both façades at 1.2 / 4 / 15 m); measured worst ≈ 0.8 M (L0 ~0.23 M, L1 ~0.3 M, L2 ~0.06 M, L3 ~0.08 M, rosettes ~0.1 M).
- **Alternatives rejected:** (1) ExtrudeGeometry with bevels (the old look; no internal modelling); (2) displaced uniform grids (4–10× the triangles for the same outline fidelity); (3) marching squares + extrusion (crisp outline, no rounded modelling or internal detail); (4) normal-map atlas on a coarse mesh (needs a custom TSL material per atlas and per mirror; deferred); (5) precomputed `public/generated/*.bin` (L0/L1 would be tens of MB); (6) chunk-merged meshes (per-chunk LOD overshoots the budget near the viewer) and InstancedMesh per kind × LOD (100–200 render objects).
- **Tiers:** every kind in `FIGURE_KINDS` carries the motif tier and sources (B where RELIEFS_AND_COLOUR / MATERIAL_CULTURE / SITE_SPEC attest the motif; C where NOT SEEN / RECOLLECTION: flower held by nobles, soft cap, gorytos, shield form, crown form, lion-bull composition, delegation dress). The carving itself is always C: meshes carry `tier C, placeholder: true, note 'procedural low relief; licensed scans would replace (NEEDS #10)'`. Paint: hair/beard dark blue (B), royal robe purple with blue hem (B), garments from the attested palette (per-figure choice C), faces, animals and background unpainted (no evidence).
- **Programme notes:** 23 delegations with per-delegation gifts from the research (`DELEGATIONS`); each is cypress, usher (Persian/Median alternating, C) leading the first delegate by the hand, an animal handler with the animal where attested, gift bearers. The modelled outer landings (15.8 m) hold 15 of the 23 per façade (pre-existing stair geometry; the real wings are ~27 m); order is row-first from the centre (C; Schmidt's column order is a RECOLLECTION). The audience panel adds two incense stands (NS, C).
- **New SITE_SPEC row:** `apadana.r_relief_carving` (C): depth range 0.03–0.08 m, figure fill 0.95, panel depth factor 1.5, embed 1 mm.
## D-020 Human bodies from MakeHuman CC0 assets (session 2; pipeline built, runtime NOT yet switched)
- **Technique:** `tools/build_humans.ts` downloads MakeHuman's CC0 data (base mesh hm08, macro + face targets, default rig + weights, eye proxies and brown eye texture; MPFB2's game-engine rig + weights and base-mesh vertex groups) into `data/makehuman/` (ignored) and derives `public/generated/humans/` (3.0 MB: humans.bin 2.59 MB, humans.json, skin.png, hair.png, eye.png). Only data formats are read (OBJ, .target, MHCLO, rig/weight JSON); no MakeHuman/MPFB program code is used (AGPL/GPL).
- **Skeleton (59 bones, `src/people/humanFormat.ts`):** MakeHuman's game-engine rig minus its ground bone, plus jaw, eyes and four eyelids from the default rig, so faces can talk, blink and look. Weights: game-engine weights everywhere; each vertex's head weight is split among head/jaw/eyes/lids by the default rig's face weights (bones mapped to their nearest face-bone ancestor); top-4, normalised, bytes summing to 255 (tested).
- **Bodies:** 23 variants (15 men 20–62 y, 5 women 22–52 y, 3 children 8–10 y) from the macro targets plus a seeded set of 15 face modifiers each. MakeHuman's three population morphs are blended only as a source of variety and are labelled "variant" in data and overlay, never as an ethnic claim (C). Men's height macro is lowered by 0.10 (period statures below modern defaults, C; morphed heights 1.50–1.79 m); the runtime will still scale to each person's stature.
- **Bind pose:** re-posed at build time by LBS from MakeHuman's A-pose (upper arm 40° from vertical) to arms hanging (6° abduction, elbows 10° flexed, palms toward the thighs) and ankles under the hips; bones keep identity orientation so `anim.ts` conventions (+Z forward, +X left) hold.
- **LODs:** index-only simplification (meshoptimizer, MIT) on the reference body, shared by all variants: full 29,804 tris (body 26,756 + lashes + mouth + high-poly eyes), mid 5,372, far 1,272 (low-poly eyes). Impostors beyond ~150 m are planned, not built.
- **Skin (C):** MakeHuman's skin textures, proxies, eyebrows, eyelashes and hair live in its separate asset repository (makehuman-assets), which the sandbox cannot reach (403/404). The skin albedo is baked in UV space from 3-D procedural functions on the reference body (mottling, pores, lips with cupid's bow, cheek/nose/ear redness, lids, palms/soles, nails, knuckles), with eyebrow density in alpha and beard/scalp/cavity masks in hair.png; cavity occlusion is ray-cast (≤ 3.5 cm) per vertex.
- **Alternatives considered:** MakeHuman's own skins/proxies/hair (CC0 but unreachable); hand-modelled heads (no likeness data, slower); keeping the procedural rigs (the rubric's weakest area).
- **NOT DONE (honest status):** the runtime still renders the PLACEHOLDER rigs (`src/people/body.ts`, `crowd.ts`, `player/body.ts` unchanged). Not yet written: the runtime loader/geometry assembly, garments (coverage + inflation of body regions, skirt tubes, sleeves, belts), hair/beard shells and volumes (Persian nape bun, long curled beard), hats (fluted hat, soft cap, band, veil), the TSL human material (wrap-lighting SSS approximation, per-object colours via userData), the animation retarget to the 59-bone skeleton (face: jaw/blink/eye look-at; finger curl axes are already in the asset), crowd/player integration, the per-frame CPU budget test and the in-engine close-up renders. Cloth simulation is not planned (garments will follow the skeleton). **Update (session 3):** the runtime, garments, hair and beards, headgear, material, retarget with face, pooled crowd and player body are done: D-090…D-093. Still not built: impostors beyond 600 m, the wicker shield and the elite women's veil.
## D-021 People simulation in two tiers: an abstract population with day plans, and the detailed Terrace agents (Phase 5)
- **Population (`src/people/population.ts`):** every person of the Terrace, the town and the plain is generated deterministically from `population.json`, `town.json` (7 quarters, facilities, 39 villages: 4 located, 35 rank-size) and `lives.json` (rates and choices, each tiered): 46,590 persons over the year (incl. the year's ~1,550 newborns, travellers with a halmi, transhumant bands and transferred groups), in households with kin, neighbours and work groups (ration groups with issue places). Names only from `names.json`, drawn by sex and origin, `notable` and uncertain readings excluded (A form / C assignment); names recur as they do in the tablets.
- **Day plans:** a person's day is a pure function of (seed, person, day) and the calendar's day context: a list of (t0, t1, place, activity, why, where) segments. Nothing is stored per person except the relationship deltas (below), so the population costs nothing per frame, is deterministic, and saves as a few kB. A plan costs ~20 µs (measured over 26,624 plans).
- **Detailed agents (`src/people/sim.ts`):** the 135 people of the Terrace slice (100 guards in 10 files, a foreman and 12 masons, 6 porters, 2 scribes, 2 bakers, 4 grinders, 3 children, 2 couriers, 3 officials) are persons of the population (`agent.pid`) and follow their plan; on the Terrace the plan's segment is resolved into nav-grid spots and fine behaviour (posts, reliefs, rounds, queues, loads, meals). Off the Terrace an agent is hidden (`offmap`, `task.off`) and resumes from the town edge.
- **Event calendar (`src/people/calendar.ts`):** `events_calendar.json` rows and CE rules drive a day context (issues, special rations, payments, deliveries, couriers, parties, milling, brewing, slaughter, offerings only as attested, agriculture, construction, weather) and the stores (grain, flour, tarmu, beer, wine, figs, sesame, sheep, hides, poultry, silver paid, tablets), each with bounds (`STORE_BOUNDS`). The court is absent by default (D-003); court rows run only with the setting. **E-06b** (new row, C, Q-056): the read grain consignments (~57 a year, 6-3,000 BAR, median 100-400) cannot feed the ~2,700 people in ration groups (~7,400 BAR a month), so the ration store is also filled in the E-06 seasonal shape, sized to the outlays × the year's harvest factor (0.9-1.1), from a 4.5-month carry-over.
- **Life:** births, deaths (incl. infants), sickness (1-7 days, seasonal), marriage (the woman moves), mourning, postpartum rest, disputes (E-74, placed where people meet), kin visits at births, deaths and birthday meals (HDT 1.133, Persians only), harvest drafts (C). Rates are C (Q-039) and produce ~1,550 births, ~1,470 deaths, ~420 marriages a year.
- **Where the variety comes from (no jitter):** the calendar (issue days and queues, deliveries, parties, couriers, milling, drum arrivals, harvest, weather, stoppages); the rota; the life events; the job's real alternatives with weights (`lives.json job_tasks`, C), drawn separately for the morning and the afternoon where the job involved both (workshops, mill, stores, gardens, brick squads, labour gang, grooms, scribes); the household's hours at home (the quern, spinning, mending tools, the animals, a sleep in the heat); visits weighted by affinity; small children with whoever is minding them (mother, grandparent, kinswoman, older sibling) and following that person's plan.
- **Open questions:** Q-056 (the store balance), Q-057 (rest days), Q-058 (household time use), Q-059 (construction rates), Q-060 (the watches), Q-061 (care of small children). All the day-plan weights live in `lives.json` with tiers.
- **Relationships:** base affinity by tie (household 0.8, kin 0.6, work 0.3, neighbour 0.2) plus dated deltas that decay with τ = 30 days (disputes −0.35, shared meals and talk of detailed agents +0.01). A plan reads only deltas dated before its day, so plans stay pure. `sim.relationship(a, b)`.
- **Memory of the player (`src/people/memory.ts`):** met / addressed / stopped at a check post / watched at work add familiarity, half-life 6 days; `sim.greeting(id)` is none / nod / recognise.
- **Soak (tools/soak.ts, extends D-017):** (a) the detailed agents step by step; (b) EVERY person of the population from the plans (a random sample is available as `--sample N` for quick runs; the gate run measures everyone). Gates: variety (unchanged: < 10 % near-copy pairs per person, near-copy ≥ 90 % of 48 half-hour buckets equal); events ≥ **8** kinds per week over the research taxonomy only (raised from D-017's 6 as EVENTS.md §10 proposes); nobody stuck > 30 h (tasks and plan states); sacks in [0, 5000] and every store within its bounds, no group short two issues running (CE-03); no detailed agent on the Terrace performs a placeholder or an activity outside `PeopleSim.EMITS`; plans well formed (contiguous 0-24 h, registered activities, no walk > 3.1 h for residents); construction advances in ≥ 3 weeks of 4.
- **Scope decision (for review):** infants in their first year (the year's newborns and those aged 0 on day 0, ~3,100) are measured and REPORTED, not gated. They have no day of their own: their place is their mother's and their activity is nursed / asleep / carried / on her back, so a newborn's first days are necessarily alike. Their mothers are gated like everyone. Children from one year up are gated.
- **Result (`npm run soak`, seed 1, 354 days, everyone measured, court absent): PASS, all eight gates.** Detailed agents (135, step by step): worst near-copy share 0.031 (a mason); guards 0.001 (worst 0.003). Population (43,348 people measured over 15.4 M plans; 3,104 infants reported): no one at or over 0.10; worst 0.099 (a plain child present 14 days before dying), then Treasury storekeepers 0.087; by job the worst are child 0.099, treasury 0.087, builder 0.075, traveller 0.067, farmer 0.065. Infants: 178 of 3,104 would fail (newborns' first days; mean 0.032). Event kinds per week 13-19 (floor 8). Nobody stuck; plans well formed; no placeholder or unlisted activity performed on the Terrace. Stores within bounds all year (grain 7,938-66,567 BAR, flour 455-2,065 with a low-flour milling trigger; sacks 0-258), no ration shortfall, no collapse; harvest factor 0.945. Life: 1,552 births, 1,471 deaths, 417 marriages, 66,350 sickness onsets. Construction advanced in 51 of 51 weeks: 34 drums set, shafts raised 38 -> 46, 7 shafts fluted, capitals 38 -> 40, 35 wall courses (walls at 52-53 courses), 0.52 of a doorway's reliefs. Cost: 0.2 s to build the population, 0.75 s for the year's calendar, ~20 µs a plan; step() at 60 fps across midnight 0.038 ms mean, 0.086 ms p99, 11.3 ms max (midnight frame 1.6 ms) with the route budget on; at 60x (one game minute a frame) 4.7 ms mean, 127 ms p99, 156 ms max (single cold route searches). The full soak takes ~7.5 min (430 s for the population).
## D-022 The Hall of 100 Columns under construction as simulation state
- `src/people/construction.ts` starts from exactly the state the geometry draws (`terrace.ts` draws each column's `built` fraction from `Rng(1, 'hall100-construction')`; the draw is replicated and tested against the parts) and advances each day from the labour the population actually puts in: builders present (sickness, mourning, winter halves, rain, storms, heat rest, short rations × 0.8 by CE-03).
- Work items and costs (all C, `BUILD`): drums arrive from the quarry ~0.9 a week (not in rain or storm); a drum is dressed in 30 stonecutter-days and raised in 40 labour-days; a shaft of 9 drums (1.15 m, NOT SEEN) is then fluted (600 days, ≤ 20 cutters) and receives a double-bull capital (1,800 days carving, 60 to set); walls rise by 0.12 m courses (600 brick-gang days per side-course; not on frost or rain days; in the brick-mould months 2-5 the squads alternate between the brickyard and the walls); the eight doorway reliefs take 40,000 cutter-days each. The rates are calibrated so the year's output matches E-61 (~5 shafts a year); nothing here is from a PT memorandum.
- Stonecutters get a week's task from what the building needs (fluting the column last raised, dressing drums, the capital, a doorway); the labour gang goes where the building needs it (unload, raise, water for mortar, ramp), morning and afternoon; brick squads alternate yard and walls and share out laying, carrying and mortar. The gangs are named after their chiefs (names.json).
- Exposed as `sim.construction`: `columns[i].drums / drumsTotal`, `built(i)`, `raised`, `walls{N,S,E,W}` (courses), `reliefs{door: fraction}`, `log` (dated events), `daily` (per-day output). **No geometry hook:** the rendered hall stays at its 467 start state; a hook would re-read `built(i)` when a shaft completes (not done, to keep `src/arch/` untouched).
## D-023 The Terrace garrison's rota
- 100 guards in 10 files of 10 (decimal files: HDT 7.81, a claim about the army, B; the garrison size is Q-043, C). Five-day forward cycle A (06-14), B (14-22), C (22-06), off, off: two files per watch fill the 16 posts (`GUARD_POSTS`) plus a patrol pair, the two leaders of ten go the rounds; men move three posts along each cycle.
- A sick man's post is covered from an off file: for A and B the fully rested file, for the night watch the file that came off it that morning, never twice. Off-duty men double the Treasury door while silver is weighed out or a letter comes in (E-81), carry the garrison's ration up from the Terrace depot, visit wives and children in the town (60 of 100 have a family there, C), gamble and idle at the three hearths.
- Relief is a handshake in the detailed tier: the man on a post leaves when his relief arrives (no empty post at changeover).
## D-024 Renderer interface; the abstract Terrace workforce; placeholders
- `sim.visibleAgents(centre, radius, max)` returns the detailed agents on the Terrace (not off-map) within the radius, nearest first, capped: the crowd renderer should draw these through a pool of rigs instead of one rig per agent (135 detailed people: 100 on the Terrace at night, 110-121 by day; at 10:00 on day 25 there are 13 within 60 m of the Gate, 47 within 60 m of the Hall of 100 Columns site, 19 by the Treasury, 38 within 150 m of the Terrace centre). `sim.performance(a)` gives the pose (`act`, `moving`); `sim.greeting(id)` / `familiarity(id)` give the head turn and the reply; `ACTIVITIES[act]` gives anim and prop.
- **Route searches:** a long route on the 0.5 m nav grid costs 20-200 ms (A* plus string pulling), and a watch change asks for many at once; `sim.routeSearchesPerStep` (world: 1 per frame) makes the others wait a frame where they stand. Measured at 60 fps across midnight: see the soak's `frameCost`. A single long search still costs up to ~200 ms on a cold cache (the cache fills as routes repeat); a time-sliced or hierarchical search is the fix (not done).
- **Not materialised:** the population also puts ~550 people on the Terrace by day (Treasury staff, stonecutters, labour and brick gangs, camp women, porters, caretakers, officials; `sim.abstractOnTerrace()` counts them by place and activity). They are simulated but not rendered: detailed agents for them need spots on the nav grid and performances for their activities. The dev overlay (F3) shows the population and this count, marked PLACEHOLDER.
- **Placeholders (abstract only):** 25 activities have no performance: haul, mould_brick, lay_brick, polish_metal, work_wood, weave, brew, tend_animals, herd, shear, slaughter, offer, clean, garden_work, field_work, irrigate, plough, reap, thresh, dig_canal, pick_fruit, craft, carry_bier, wash, train. They are flagged `placeholder: true, abstractOnly: true` with a PLACEHOLDER note in `ACTIVITIES` (dev overlay), and the soak's rendered-honesty gate proves no detailed agent performs one on the Terrace.
## D-090 People's bodies switched to the MakeHuman variants; fitted costumes (session 3, humans agent)
- **Runtime:** `src/people/humanAssets.ts` decodes humans.json/.bin into per-variant render-vertex positions and smooth normals (seams share a normal). `src/people/outfits.ts` fits every costume to all 23 variants at load, in a Web Worker (`outfit_worker.ts`) that runs while the Terrace is built. Everything is written into one RGBA32F "vertex source" texture: xyz = bind position, w = an octahedral 12+12-bit normal packed as an exact integer. Each vertex of a costume mesh carries only an index (`tid`) into that texture, so one mesh serves all 23 bodies.
- **Pieces:** three kinds.
  - *Shells:* a copy of the body surface over a region (neck to hips, arms to a cut, the beard region, the scalp), pushed out along the normal. Triangles are clipped exactly at the region's iso-line, so hems, necklines, boot tops and hairlines are clean contours rather than stair-stepped triangle edges (the first version's edges were jagged). Loose garments are relaxed by Laplacian smoothing that is kept outside the body.
  - *Tubes:* rings swept along an axis (skirts with pleats and a front cascade, wide sleeves, belts, the fluted hat, the beard mass, the nape bun, the quiver, the bow, the akinaka, the gorytos). Their radius comes from the body's support function in each ring's plane, plus ease, flare and pleats. They are lined, so they can be seen from inside.
  - *The body itself:* body triangles deep under an always-worn piece are dropped. Nothing can poke through, and the robe costume loses a third of its body triangles.
  - Skirts are skinned to the pelvis, then the thighs, then the calves, blended left/right. Wide sleeves carry a "slack" value, and the shader lets them sag under gravity as the forearm turns horizontal.
- **Costumes (6 dresses, 5 built costumes × 4 LODs):** persian, guard, median, worker, woman, child. Guards wear the Persian costume's meshes with the bow and quiver bits always set (one draw fewer per LOD and per shadow cascade). Optional pieces (hair, bun, long or short beard, fluted hat, fillet, soft cap, headband, headcloth, bobbed hair, torque, trousers, shoes, akinaka, gorytos) are bits in a per-person mask; hidden pieces collapse to a point in the vertex shader. Every piece has a tier and source key (`PIECES`), printed by the dev overlay (F3) for the person under the crosshair.
- **Bug found and fixed on the way:** MakeHuman's high-poly eye has a second, transparent cornea layer mapped to the corner disc of the eye texture. Drawn opaque, it covered every iris with a pale blue shell; it is now left out (`isCornea`). The D-020 skin bake bounded the beard mask by the height of the jaw *joint* (near the ear), which left the chin bare; the beard region is rebuilt from face measurements (`beardMask`). The same bake took the mouth line to be the most recessed midline point, which on MakeHuman's closed neutral mouth is the mentolabial sulcus, 1.7 cm below the lips. The lower lip colour was painted on the chin and read as an open mouth in the first close-ups. The mouth line is now where the midline changes from head-weighted (upper lip) to jaw-weighted (lower lip): 1.507 m on the reference body, against 1.490 before. skin.png and hair.png were re-baked from humans.bin (`tools/humans/rebake_skin.ts`, no download; nail positions come from extrapolated finger tails) with lip, cheek and ear tints toned down. A test samples the texture at the lips and on the chin.
- **Alternatives rejected:** one SkinnedMesh per person (the old way: 1 draw per person per pass, and three's skinning is one skeleton per mesh); BatchedMesh (one GPU draw per instance in the WebGPU backend, and no skinning); per-variant garment meshes (23 × 18 geometries); cloth simulation (not planned, D-020).

## D-091 The human material: texture-fetch GPU skinning, packed attributes, wrap-lit skin
- One `HumanMaterial` (`src/people/humanMaterial.ts`) for every body, garment, hair and worn object. The vertex stage fetches the bind position and normal (source texture) and 4 × 3 texels of the person's skin palette (RGBA32F, one row per person slot, character space). It then applies the per-instance root (`iRoot`: feet position and yaw), so root motion updates every frame even when distant people's bones are refreshed less often. Colours come from the person's row (10 texels: variant, piece mask, pattern, grime, skin tone + stubble, main, second, trim, hair, leather, grime level + scale + flags, felt).
- **Previous-frame skinning** (`iRootPrev` and the previous palette) feeds `positionPrevious` when the pipeline renders velocity (TRAA at medium and above). Without it, people would ghost.
- **WebGPU vertex-buffer limit:** the first build used 11 attributes and failed pipeline validation ("Vertex buffer count (10) exceeds the maximum number of vertex buffers (8)"). Attributes are now three interleaved buffers: per-vertex floats (position, normal, uv, tid), per-vertex bytes (skin indices and weights, material class, colour slot, piece bit, parameter, AO, slack, beard region) and per-instance floats (slot, root, previous root).
- **Fragment:** material classes by arithmetic masks. There is no runtime `select()` (D-012). Skin uses the baked albedo rescaled to the person's tone (linear), eyebrows from its alpha and stubble from the beard region. A custom `PhysicalLightingModel` adds wrap lighting (w = 0.35, tinted red) as a subsurface-scattering approximation (C). Hair uses ridged-noise curls and strands in bind space. Cloth has mottling, drape folds, Susa-style rosettes on patterned guard robes (B pattern, C layout) and grime by work (C). Leather, felt, metal (gold/silver/bronze), wood and wicker are the other classes. The shading normal comes from a procedural height field (screen-space surface gradient).
- **Alternatives:** three's `MeshSSSNodeMaterial` (a thickness map per mesh; one material per person); per-person uniforms (one draw per person).

## D-092 Looks: stature, body variant, colours and optional pieces (all C unless the piece is attested)
- `src/people/looks.ts`, deterministic from the person's seed, so the same person looks the same each time the pool attaches them.
- **Stature (C, Q-066):** men N(1.66, 0.055) m, women N(1.54, 0.05) m, clamped at ±2.2 sd. The nearest of three suitable variants (sex, adult/elder/child) is chosen, then scaled by the remainder (clamped 0.93–1.07).
- **Tones:** one skin-tone range and one hair range for everyone, dark hair greying with age (C). Nothing is tied to origin: no evidence was read. The reliefs' dark blue hair is a paint convention (RELIEFS_AND_COLOUR §3b); natural dark tones are rendered.
- **Palette:** madder red and purple (B for robes and the kandys), woad, weld, green, undyed wool and linen, brown, grey (C). 60 % of Persian-dress guards wear patterned robes in the Susa guard colours (turquoise, yellow, brown: B).
- **Pieces:** Persian dress: bun, long beard (90 %), fluted hat (85 %), torque (30 %). Guards: fluted hat 70 % or twisted fillet 30 % (after the Susa archers, C), bow and quiver (B). Median dress: soft cap (C), long beard; guards add the akinaka (B) and gorytos (C). Workers: short or long beard; none for Egyptians, who shaved (C). Trousers 40 %, shoes 60 %, headband or cap. Women: headcloth 80 % (C, not a chador; no hair is worn under it, it poked through), otherwise bobbed hair (B for the elite statuette). Children: tunic, mostly barefoot.
- **Felt (C):** undyed, tan to dark brown. Cream and light tan were dropped: a pale fluted cylinder in sunlight read as a modern cook's hat in the close-ups.
- **Hair and beard regions (from the close-ups):** the baked scalp mask stopped at the temples, so men looked shaven at the sides under hats and bands. Hair now comes down in front of the ear (sideburns to the ear canal) and behind it. The beard region stopped 1 cm below the nose, which left a clean upper lip; it now starts under the nose, so bearded men have the moustache the reliefs show (A for the convention).
- **Grime (C):** masons carry limestone dust, grinders and bakers flour, porters dust.

## D-093 Animation retarget, face, crowd pooling and LOD, the player's body
- **Retarget (`src/people/humanRig.ts`):** the 17 pose channels of `anim.ts` map onto the 59 bones. Both skeletons have identity bind orientations, so an Euler rotation means the same on both. The old spine channel is split over spine_01/02, and hips offsets scale with the pelvis height. Finger curl comes from the asset's curl axes: a relaxed rest, blended to a grip for held props, cached per grip level. Standing and walking poses are **planted**: the lowest heel/ball/toe point is kept on the ground (the cycles were authored on another rig; unplanted, the walking foot sank 6 cm). Seated, kneeling and lying poses rest their lowest flesh point (buttocks, thighs, knees, shins, feet, back, head; radii C) on the ground: the high-quality render showed seated porters 0.2–0.3 m in the air. Tested for every seated cycle (±3 cm).
- **Face:** jaw while speaking (world.address → crowd.speaking, for the line's duration), in 'talk' and chewing in 'eat'. Blinks every 2–6 s (150 ms). Small saccades. Eyes (clamped) and head turn toward a stranger within 7 m. Tested: the chin drops ≥ 6 mm at 0.2 rad, the upper lid ≥ 4 mm, and the gaze follows a target.
  - **Bug found in the close-ups and fixed:** the rig solves in character space (the root is applied per instance on the GPU), but the crowd passed gaze targets in world space, so everyone looked past the camera. Targets are now converted (`toChar`). A test places people at three roots and yaws and requires both eyes within 4° of a world target 0.8 m away (the old code: 18.6° off).
- **Crowd (`src/people/crowd.ts`):** the pool is fed by the simulation's `visibleAgents(centre, 620 m, 400)` (D-024: the detailed agents on the Terrace, nearest first, capped). A person is **attached** (a palette slot plus a look) when they enter that set and **detached** beyond 660 m (hysteresis 40 m; the far band ends at 600 m) or when they leave for the town. A newcomer within 50 m in view is reported as a pop-in (§13.8). The per-frame loop costs O(attached), not O(roster). `attach()`, `detach()`, `allocSlot()` and `writePerson()` are public, and `autoPool = false` hands the pool to another roster.
  - **Performance:** `sim.performance(a)` → `ACTIVITIES[act]` gives the animation and prop. An abstract-only activity (a PLACEHOLDER with no performance) that ever reaches a rendered person is shown standing, counted in `crowd.stats().placeholderActs`, and flagged PLACEHOLDER in the dev overlay (F3) with the activity's name. Nothing loops a made-up performance. Tested.
  - **Greeting:** `sim.greeting(id)` sets the head turn toward the player within 7 m. `none` gives a stranger's glance (80 % of the angle); `nod` or `recognise` turns the head fully and nods once within 4 m (0.18 rad over 0.8 s, C).
  - **Bug found and fixed:** the overlay's person picking was dead. The line that installs the proxy's raycast had been swallowed by the comment before it. The instanced people meshes and the carried-prop union no longer answer raycasts: their CPU geometry sits in bind pose at the origin. A test now picks a person and reads their overlay note.
- **LOD:** four bands. The full body is drawn within 25 m for the nearest 64 people (≥ 50 required). The mid body runs to 90 m and the far body to 200 m. From 200 to 600 m the far costume is simplified by meshoptimizer to a fifth of its triangles (about 450–560 triangles, the same vertices). Nothing is drawn beyond 600 m: **impostors are NOT built.**
  - Poses are refreshed every frame within 30 m, every 2 frames to 90 m, every 4 to 200 m and every 8 beyond. Root motion is refreshed every frame for everyone.
  - People outside a 3 m-widened frustum are not drawn, so they cast no shadow. Their tool sounds continue.
  - **Shadows:** the drawn meshes cast none. Each costume has two shadow-only casters on their own layer (`SHADOW_LAYER`). The sun's shadow cameras and CSM cascades see that layer; the view camera does not, so casters cost nothing in the view pass.
    - The near caster uses the far-body geometry (about 2.5k triangles) and carries the full-detail people. The far caster uses the farthest, simplified geometry (about 0.5k) and carries everyone else within 90 m (`SHADOW_DIST`). A cascade texel is 1–12 cm, so fingers and eyelids add nothing.
    - An instanced caster is drawn whole in every cascade its bounds touch. The first measurement found each caster drawn into all four cascades. Casters now skip the cascades whose slice starts beyond 130 m (`SHADOW_CASCADE_REACH`): with slices starting at 0, 75, 154 and 258 m, that keeps two of four. Skipping works by setting 0 instances in `onBeforeShadow`, a draw the backend drops.
    - Far people cast no shadow; at 90 m a person's shadow is a few pixels.
  - **Caps:** full detail for at most the nearest 50 (`MAX_FULL`, the brief's floor), mid detail for at most the next 100 (`MAX_MID`), and the far body beyond that even within 90 m.
    - The first caps were 64 full and no mid cap. With 300 people within 20 m at high quality, that cost 3.55 M view triangles and 0.79 M per cascade in shadows: 15.7 M for the frame (budget 12 M; the scene alone is 8.83 M there).
    - With 50 full + 160 mid, two-tier casters and two cascades, the frame was 12.33 M. Hence a mid cap of 100 (the people moved to the far body are 10–20 m away, mostly behind the front rows).
  - **Things:** carried props, sack piles and work objects are also drawn only into the near cascades (`nearCascadesOnly`).
  - **Measured at quality=high** (backend draw commands counted per mesh and pass, people shown vs hidden, same frame; `tests/e2e/humans_cost.spec.ts`; day 0, 09:00; 50 + 160 caps, before the things' cascade limit):
    - **Grand Stair foot** (−60, 122): 108 people in view (6 full, 11 mid, 11 far, 80 farthest).
      - People add 32 draws (14 view, 18 shadow) and 0.52 M triangles.
      - Frame: 2,806 draw calls and 9.66 M triangles (2,775 and 9.15 M without people).
    - **Apadana N court** (0, 60): 10 people in view.
      - People add 21 draws and 0.11 M triangles.
      - Frame: 2,862 draw calls and 9.47 M triangles.
    - **300 extras within 20 m of the forecourt camera, plus the simulation:** 325 people in view.
      - People add 52 draws and 3.51 M triangles.
      - Frame: 3,213 draw calls (3,161 without people) and 12.33 M triangles.
    - The frame's draw budget is already exceeded without people at the two crowded views: reliefs, D-029…, being fixed separately.
    - **After the mid cap of 100** (quality=test, the same 300-person view): 2.71 M view triangles (was 2.88 M) and 0.26 M per shadow map. At high, the frame is estimated at about 12.1 M. **This was not re-measured:** the shared render queue allows one high-quality check.
    - **WebGL2 fallback:** verified in the lab (`--project=webgl2`, no errors). The frames match the WebGPU ones.
  - **Props:** every carried prop (spear, sack, jar, tablet, mallet, basket) is one instanced mesh over a union geometry (432 triangles; the sack and the spear butt were made lower-poly). A per-instance kind index keeps that kind's vertices and collapses the rest (arithmetic, no `select`). Both sack piles are one instanced mesh; the static work objects (blocks, querns, mats, trough) are merged into one mesh. People, props and goods together: at most 5 costumes × 4 LODs in the view pass, 5 casters per cascade, and 3 prop/goods draws per pass.
- **Seated or asleep:** people lay aside the kandys and back-carried weapons (and hats, when asleep) by clearing those piece bits. Otherwise they would pass through the ground.
- **Player (`src/player/body.ts`):** the same system. A man in undyed-wool Median riding dress with a soft cap and a short beard (C), scaled so his eyes are at EYE_HEIGHT. The visible copy collapses the head (person flag). A shadow-only copy (the mid body, on the shadow layer) keeps the head's shadow. The player adds 1 view draw and 1 caster per cascade. Walk and idle are blended by whether the step phase advances.

## D-029 Carved stone: hairline joints, a joint-free carved surface, snail curls, horns, rolled volutes, Treasury members (session 3, stone agent)
- **Problem (renders):** the limestone material drew procedural *sunk* ashlar joints by world position on every limestone surface, capitals, protomes, colossi and relief figures included (the reliefs used that same material with vertex colours). The joints were soft dark bands about 0.1 m wide, darkened 35 % and sunk 4 mm in the bump field.
- **Evidence for the joints:** the Terrace walls are "dressed grey limestone blocks, dry-laid, metal clamps" (SITE_SPEC terrace.wall_material, IR-PERS, B); the Grand Stair blocks are "dry-jointed" (Iranica, _extract_B, B). No mortar, so no mortar joint. Fitting by anathyrosis to hairline joints is recollection (C, Q-071).
- **Joints now (materials.ts `HAIRLINE`, C):** 0.8 mm wide, on vertical faces only, never in the height field. Each joint is box-filtered over the pixel footprint (`fwidth`), so it fades with distance instead of aliasing or widening. It darkens the albedo inside the line by 60 % (a shadowed slot). At 1080p and 70° the pixel footprint is 1.3 mm per metre of distance, so a joint darkens its pixel column by about 37 % at 1 m and about 4 % at 10 m. The course pattern (1.05 × 2.2 m running bond) is unchanged and still C: the Terrace walls' polygonal block layout is not modelled (Q-071). Bed joints no longer paint horizontal treads that happen to lie on a course line.
- **Carved stone (`limestone_carved`, C):** the same stone albedo, no joints, a finer rubbed finish (roughness 0.55; bump 0.4 mm at 14 /m). Column members in limestone, the Gate colossi and the relief figures use it (`meshes.carvedMaterial`, `materials.paintedStoneMaterial`). Walls, stairs, plinths and pavements keep the ashlar surface. A joint may cross a carving only as a hairline. The figures are joint-free because their block layout is unknown.
- **Treasury columns (sculpture.json `shaft.members`, B):** "wooden plastered and painted shafts on stone bases" (ISAC-PA, RELIEF-R). Each member now has its own surface: a carved-limestone base, a lime-plaster shaft and a timber capital (the bearing block under the beams; only the shafts are reported plastered, C). The shaft paint ("bright colours", B) has no known colours or pattern, so the shafts show bare plaster, flagged `placeholder` in the dev overlay (Q-020). `meshes.ts` builds one InstancedLOD per member surface: 3 for the Treasury, 1 for every stone order, so draw calls elsewhere are unchanged.
- **Curls:** the lattice of plain domes ("bubble wrap") is replaced by **snail curls** (`sculpt_models.snail`). Each lock is a boss cut by an Archimedean spiral groove; neighbouring locks coil in opposite senses. The locks are larger, so the groove survives the simplifier: protome 0.12 D pitch with 1 turn (was 0.075 D), colossus chest 0.14 m with 1.5 turns.
  - **Lamassu:** the beard is its own mass. Horizontal bands of curls alternate with bands of long wavy locks (`colossus.beard`), and the hair bunch at the nape is in curls. The chest curls stop 0.14 m below the beard (`chest_gap`). Measured by rays along the front: the gap band's profile roughness is below a third of the curl band's (test).
  - **Wing coverts:** overlapping scale feathers (rounded rims, tips down), not domes.
- **Features keep their edges:** horns, ears, eyes, lids, nose, brows, moustache, beard and hair join the head with a 0.025 m blend (protome: 0.03 D). The 0.12 m body blend had melted them into the skull, so the lamassu had no readable face.
- **Horns:** the protome horns sweep out, forward and up: 0.55 D along the curve, root 0.078 D (were 0.3 D, 0.055 D, and read as ears). The W bulls' horns have a 0.14 m root and are about 0.75 m long. Ears are smaller, lower and set further back.
- **Volutes:** each scroll is a rolled band, a half-round cushion between V channels over 1.75 turns. It was a flat disc cut by a 2 cm groove, which the simplifier cut into jagged polygons. There are fewer reeds, 0.08 D apart (was 0.055 D).
- **Budgets kept (measured, `tests/sculpt.test.ts`):**
  - Protome 6,966 / 1,000 triangles (was 6,156 / 1,000); volute 3,800 / 296 (was 2,472 / 296).
  - To pay for them, the shaft's flute terminations take 3 rows instead of 4.
  - Worst column LOD0: Apadana bell-base composite 24,510 ≤ 25,000 (was 23,140). Worst LOD1: 2,840 ≤ 3,000 (unchanged).
  - Colossi: bull 49,244 / 4,892 and lamassu 49,336 / 4,886 (≤ 50 k / 5 k), polygonised on a 0.014 m grid (was 0.02) so the spiral grooves span more than one cell.
  - `npm run sculpt` now takes 95–125 s (it was about 60 s). All pieces are closed 2-manifolds with no degenerate triangles (test).
- **Tests made robust, not looser:** the colossus relief check now casts 49 rays at the passage face (all hit, fewer than half on the box face) instead of counting vertices in a band. The simplifier now spends fewer vertices on the smooth flank, and the vertex count there had dropped from above 8 to 5.
- **Honesty:** every form is still a reconstruction of the type (C, RECOLLECTION), not measured carving (NEEDS #10). Curl forms, horn forms (at Persepolis probably inserted separately) and the lamassu's chest are Q-075.

## D-030 Relief paint: mineral pigments as a matte film, with thickness, losses and worn arrises (session 3, stone agent)
- **Problem (renders `relief-close-*.png`):** flat, saturated, full-coverage colour with the stone's uniform sheen. The palette was hand-picked sRGB display colours: Egyptian blue linear (0.016, 0.064, 0.34); the hair blue (0.006, 0.010, 0.051), nearly black.
- **Pigments (`src/data/polychromy.json`):** the ones identified at Persepolis (RELIEFS_AND_COLOUR §3a, B). Each is a CIELAB (D65) row for the pure pigment as a matte film on a light ground (C: reasoned from the published ranges; no reflectance was reachable, Q-074). Code converts each row to linear albedo (`src/core/colour.ts`: Lab → XYZ → linear sRGB).
  - Measured linear albedo (luminance Y): Egyptian blue (0.047, 0.199, 0.436), Y 0.18; dark blue of hair and beard (0.014, 0.064, 0.189), Y 0.06; malachite (0.043, 0.302, 0.191), Y 0.24; cinnabar (0.457, 0.054, 0.041), Y 0.14; red ochre (0.312, 0.086, 0.055), Y 0.13; yellow ochre (0.527, 0.294, 0.079), Y 0.33; purple (a red and blue mixture; no purple pigment is identified) (0.136, 0.071, 0.148), Y 0.09; calcite white Y 0.81; carbon black Y 0.03.
  - "Gold" is a bright yellow matte film, not metal. The renderer has no environment specular, so a metal would read black on the shaded N façade (C).
- **Zones unchanged:** hair and beard dark blue (B); the royal robe purple with a blue hem (B); per-figure garment colours from the attested palette (C); faces, animals and background unpainted (no evidence).
- **Paint coverage per vertex (`relief_field.paintCoverage`, new `paint` attribute):** 0 on unpainted stone. On painted masses it is 1 − 0.7 · smoothstep(0.035, 0.2, convexity). Convexity is height minus the mean height within 0.006 figure heights, from a summed-area table, so the paint thins on outline arrises and curl tops. The wear is scaled by min(1, radius / cell), so coarse LODs do not look paler.
  - Measured at LOD0: persian, guard, delegate and king have 75–84 % of vertices painted, mean coverage 0.86–0.97, and 4–20 % of painted vertices below 0.7 (worn).
- **Paint film (`materials.paintedStoneMaterial`, C):**
  - Film thickness varies at brush scale (2 cm) between 0.45 and 1.
  - Opacity is 1 − exp(−2.3 t), 0.65–0.90, so the light stone shows through thin brushing.
  - Small flaked losses (7 mm) scatter over the film, more on worn arrises.
  - Pigment grain modulates the albedo by ±6 %; the film is dull (roughness 0.88) where the stone is rubbed (0.55).
  - The film stands 0.15 mm proud of the stone, visible at the edge of a loss.
  - Arithmetic masks only, no `select()` (D-012).
- **Alternatives rejected:** keep display colours and just lower the saturation (no basis); gilding as metal (reads black without environment specular); per-pixel wear from curvature in the shader (the batch transform hides the figure frame; the vertex term is exact and LOD-aware).
- **Also fixed:** the worker path gave outline vertices a grey 0.5 background colour and the sync path the stone colour. Both now use the stone colour; coverage 0 makes the colour moot anyway.

## D-031 Door-frame limestone albedo; relief paint on the WebGL2 path (session 3, stone agent)
- **limestone_dark:** "dark grey limestone from Majdabad" (Iranica via RELIEFS_AND_COLOUR §4, B). "Dark grey" is N3 on the GSA rock-colour chart. Its luminous reflectance by ASTM D1535 is 6.4 %: linear albedo 0.064, sRGB 0.28 (C). The old value, sRGB 0.12 (linear 0.013), was black, and the Apadana N doorway read as a black block. Polish (roughness 0.18) is unchanged. Whether the frames carried the whitish fluorapatite–calcite finishing coat found on the dark stone (Askari Chaverdi et al. 2016, B) is open (Q-072).
- **Measured in the render** (sculpt-apadana-n-door-test.png, WebGPU, day 60 09:00, N-facing, in shade): the jambs render at sRGB 46–50, luminance 0.03. The mud-plaster wall beside them is at sRGB 117 (0.17). The old albedo would have given about sRGB 21 in the same light.
- **WebGL2 (fault 7):** the relief close-ups (`playwright.relief.config.ts --project=webgl2`, backend logged as "WebGL2") render the carved figures through the same BatchedMesh and Web Worker pool with no relief errors.
  - The per-LOD triangle counts are identical to WebGPU (nobles 821,745; delegations 448,000).
  - The image differs from the WebGPU one by a mean of 0.44/255, with 0.3 % of pixels differing by more than 16.
  - three's WebGL backend draws BatchedMesh with WEBGL_multi_draw, or one draw per instance with a draw-id uniform when the extension is missing, so no fallback was needed. The new `paint` attribute and the `fwidth`/`exp` nodes work on both paths.
- **High quality:** the Gate bull flank and Apadana N door views at `?quality=high` (SSGI/TRAA) render without page errors. The volumetric clouds, however, are drawn over the architecture at medium and high quality, even with `weather=clear`. That is not a stone fault; it is reported to the lead. The judging views were rendered at `quality=test`.

## D-032 Gate of All Nations: door leaves hung at the inner end; wall ring cut around the colossus jambs (session 3, stone agent)
- **Problem:**
  - The open door leaves stood against the reveals from the outer wall face inward, 1.9 m long and 0.25 m in front of the colossi's carved flanks. The colossus boxes are 5.0 m long: the 4.15 m wall plus a 0.85 m projection, so they fill the W and E passages from face to face. The leaves hid the front half of each relief.
  - The mud-brick wall ring overlapped the colossus and plinth boxes in the parts and the colliders. Only the render cut them out.
- **Leaves (SITE_SPEC gate_nations.r_door_leaves `hang: "inner"`, C):** the pivots sit at the inner (hall-side) end of each passage. The leaves open 90° into the hall and stand against the inner wall face beside the opening: W and E leaves at x −12.24…−11.98 / 12.25…12.50, S leaves at n 112.22…112.47.
  - The carved flanks are now fully visible. The leaves touch only the plain back end of the jamb block, which lies in the plane of the inner wall face, behind the 0.3 m relief frame.
  - Pivot-socket positions were not read (RECOLLECTION: sockets on the hall side), so this is C (Q-073). The S doorway follows the same rule. `hang: "reveal"` restores the old layout.
- **Walls:** `parts.cutWall` (moved from the render) subtracts every colossus and plinth box from the Gate's wall boxes at build time. Parts, colliders and render agree: no overlap (test, ≤ 1e-6 m³), and a wall piece stands on each colossus from its top (6.7 m) to the wall top. The fore-part length measured from the layout is unchanged (0.845 m), because `colossusFrontProjections` now takes the wall face from plan overlap at any height.
- **Walkability:** the nav grid was rebuilt (the leaves moved). The offline bot (tools/dev/botcheck.ts with a Gate route) walks top landing → W door → W passage → hall → beside the W leaf → E passage → E door → hall → S passage → S door with no stuck leg and maxFall 0. The six Phase 4 routes validate (`tools/dev/routecheck.ts`), and the offline bot passes all 77 targets (`tools/dev/botcheck.ts`). The walkable grid changed in 28 cells: 19 cells at the edges of the three passages are now walkable (8 W, 6 E, 5 S), and 9 cells along the inner face of the S wall are now blocked by the S leaves. The W and E passages are now 3.8 m clear between the colossus faces (were 3.3 m between the leaves).
## D-033 Phase 6/7 bookkeeping: settlement and plain in the chronology; blocklist synced; Q-047 decided (session 3)
- **Chronology, fail-closed:** every feature in `src/data/settlement.json` and `src/data/plain.json` now names its chronology row (`chrono`). Features already covered reuse the row (`tol_ajori_gate` → `tol_ajori`, `nr_darius_tomb` → `nr_darius`, `nr_kaba`, `nr_elamite_relief`); the other 50 got rows with the research agent's tier, sources and date range. `present_467: null` (not placed; e.g. the undated private rock tombs) is absent.
- **Lint:** `tools/lint_chrono.ts` fails when a feature has no chronology row, when its `present_467` disagrees with the row, on unknown source keys or bad tiers, and when a present feature's id, name or kind matches a blocklist term. Notes are not matched, because they cite blocklisted things as negatives. A match is exempt only with a written reason in `blocklist_ok`. Three are exempt: the Persepolis West garden's "fence wall" (the excavated enclosure), the building "N of the Frataraka complex" (a location), and the road through the Naqsh-e Rajab gap (the natural gap; the Sasanian reliefs stay absent).
- **Blocklist:** the 9 Phase 6/7 rows of `research/ANACHRONISM_BLOCKLIST.md` are now in `src/data/blocklist.json` (37 entries, 98 terms): Frataraka, Istakhr, later plain sites, the Spring Cemetery, the later Naqsh-e Rustam tombs, modern dams, the modern plain, date palms on the plain, qanats.
- **Q-047 (Xerxes' tomb at Naqsh-e Rustam in 467):** modelled **present, façade cut, uninscribed (C)**, as a separate row `nr_xerxes_tomb`. Kings prepared their tombs in life, and Darius I finished his (Ctesias via WP-NR, a search extract). Xerxes is in his 19th regnal year. The attribution is by elimination (LIVIUS-NR). The Artaxerxes I and Darius II tombs stay absent (`nr_later_tombs`, B).
  - Alternatives: keep it absent (it would erase a probable work in progress); show it as a working quarry face (no evidence for the stage reached).
  - Reversible: yes, one row.
## D-034 Player step-up, the bot's waypoint tolerance and the test camera's floor (session 3)
- **Found:** the Hadish walkthrough failed at the W stair head, reproduced offline in seconds by `tools/dev/botcheck.ts`. That tool is new: it runs the §13.8 bot in node with the same colliders, controller, grid and steering as the e2e run.
- **Step-up:** Rapier's autostep (`enableAutostep(0.4, 0.12)`) did not lift the capsule. Measured on synthetic steps, the player climbed only what the round capsule bottom slides over: 0.24 m head-on, 0.2 m at 30°, 0.12 m at 60°. The walkable grid, meanwhile, lets people and bots route over steps up to `NAV.maxStep` = 0.42 m.
  - The player now tries an explicit step when a grounded move is blocked (less than 90 % progress along the wished direction). It shape-casts up by `STEP_UP`, then across the blocking face's normal by radius + skin + 0.12 m of standing depth, then down onto the top. It accepts the step when the landing is ≤ 42° and the rise is ≤ `STEP_UP`.
  - `STEP_UP` = `NAV.maxStep`, so every route people take is walkable by the player.
  - The camera eases the lift over about 0.08 s instead of popping.
  - Measured: every step from 0.12 m to 0.42 m is climbed head-on, at 30°, 45° and 60°; a 0.6 m ledge is not. This is a regression test in `tests/physics.test.ts`.
- **Bot steering:** intermediate waypoints are now reached within 0.2 m (was 0.5 m; the final one stays at 0.5 m). With 0.5 m, the next straight leg could start beside the planned line, and at a narrow opening it clipped the corner. All 77 legs of the six Phase 4 areas pass offline.
- **Test camera and teleport:** `view()` and `teleport()` found the floor by casting down from 400 m. Every part is a collider, so under a roof or lintel they landed on top of the building. The translation e2e looked at the sky from above the Gate for this reason. They now cast from 1.2 m above the walkable grid's floor where the grid knows it. Earlier camera-rig shots taken under roofs may have come from the roof; re-render them.
## D-035 Far terrain ring to ±71.7 km, with Earth curvature and refraction (session 3; Q-053)
- **Problem:** the Phase 7 research measured the far ring (±40.96 km) cutting off ranges 55–66 km away. At 150–160°, 230–250° and 270–290° true they rise 0.1–0.4° above the in-ring skyline. The terrain was also flat: at 40 km a flat earth lifts ground by 0.16°, and at 66 km by 0.26°. That is as large as the effect being fixed.
- **Change:**
  - The far ring is ±71.68 km at 80 m (1,793²; 6.4 MB), from six GLO-30 tiles.
  - The far ring is drawn in 256-cell chunks: 48 draw calls, where the old ring had 60 and 128-cell chunks at the new size would have 192.
  - The camera far plane is 110 km, since the ring's corners lie 101 km out.
  - Rendered and walked heights include the apparent curvature drop d²(1 − k)/(2R), with k = 0.13 (B, the conventional terrestrial refraction coefficient) and R = 6,371 km (A). The drop is taken relative to the grid origin: 1 cm at 0.4 km and 0.27 m at 2 km, so the Terrace is unaffected.
  - `aslAt()` returns true elevation.
- **Verified:** the far skyline agrees with the independent SRTM profile within 0.15° in all 36 sectors, and the four missing ranges now appear (tests in `tests/terrain.test.ts`). Terrain spot checks and seam tests are unchanged.
- **Cost:** terrain download 6.7 → 11.8 MB, well inside the 60 MB first-load budget. There are more far-ring triangles at LOD 1 inside 40 km; the bench must re-measure.
- **Alternatives:**
  - A camera-relative curvature in the vertex shader: exact for any eye, but the physics, the walkable grid and placed objects would disagree with the drawn ground.
  - A separate horizon silhouette mesh or impostor ring beyond 41 km: cheaper, but a second terrain representation to keep consistent.
  - Leaving curvature out: a systematic 0.1–0.3° error on every distant range.
- The walkable grid (built from the physics terrain) differs from the flat build by ≤ 3 cm at its W edge, 620 m out. It will be rebuilt at the next nav rebuild.
## D-036 Translation layer: inscriptions picked by panel, not by sign (session 3)
- The translation e2e (never run in session 2) failed for two reasons:
  1. Its camera sat on the Gate roof (D-034).
  2. The carved mesh is only the signs, so a ray through a panel often passes between wedges.
  (A suspected third cause, a timestamp of 0 in test frames, was wrong: `frame()` always takes `performance.now()`. The change made for it is reverted.)
- **Fix for 2:** each panel now has an invisible rectangle over its bounding box plus 5 cm, on a layer no camera renders (`INSCRIPTION_PICK_LAYER`). The translation layer raycasts only that layer. A reader looking at the panel now gets the text wherever the view centre falls on it.
- **Still wrong (found here, not fixed):** the Gate's open door leaves stand 0.24 m in front of the XPa panels and hide them up to 7.7 m. This is the known door-leaf layout fault, now with the sculpture agent (D-018 follow-up). The layer shows the text through the leaf because its raycast ignores occluders; that is acceptable only for an out-of-world layer.
- The e2e passes: XPa transliteration with glosses, map (M), chronicle (J).
## D-041 The settlement's layout: separate quarters of courtyard houses in lane mazes, generated (Phase 6, session 3)
- **What:** the town is built by `src/world/settlement/` from `src/data/settlement.json`. Zones, named features, roads and the canal keep the research positions and tiers. Everything inside them is reconstruction (C), and every generated plot, fitting and prop names its basis row (`town_elements`, 21 rows) and a present feature. `tools/lint_chrono.ts` checks this fail-closed.
- **Garden city, not one block:** SELOPERSE (search extract, B) describes the urban zone as separate blocks of housing among gardens, parks, fields and orchards. So the town is 8 dense quarters (1.3–3.6 ha each), 2 hamlets, the official building, a storehouse, a stable, 4 estates, 3 gardens and 8 walled orchards, 0.3–1 km apart (C; Q-084).
- **House type:** the first-millennium Babylonian courtyard house (BAKER2014, with Reuther 1926 on Babylon's Merkes quarter; search extracts). It is a court with rooms on two to four sides, and one street door into a vestibule set so the court cannot be seen from the street. The analogue is B; using it here is C. Babylon lay inside the empire and was lived in through the Achaemenid period. No house has been excavated at Persepolis (Q-082).
  - Sizes (C): plots 8–16 × 10–20 m; rooms 3–4 m deep (the span of poplar roof poles); roof tops 3.1–3.6 m.
- **Lanes:** a maze by construction. Through streets (4 m) run with jogs, then lanes (3 m) and alleys (2 m) branch off them until no ground lies more than 16 m from a lane. Branches end in blind alleys or close into loops, and small squares hold wells.
  - The Merkes quarter had wide and narrow streets and blind alleys (B analogue).
  - Tests: every home's door opens onto ground connected to the plain; every large quarter has blind alleys.
- **Capacity:** a house holds its roofed area ÷ 13 m² in people, 3–10 (large houses 6–16, C). The town zones hold 7,830 people (another 138 in the Dasht-e Gohar hamlet and the way-station), against the court-absent working value of 7,000 (range 5,000–10,000, population.json). The house plots go to the simulation in `src/data/town_plots.json` (1,505 plots, 1,456 homes; 30 animal pens at the quarter edges).
- **Kept clear:**
  - the Terrace approach, 480 m W of the Grand Stair (the walkable grid e −620…262, n −245…185). The Phase 3–5 people and bot routes stay valid, and the approach reads as open ground before the Terrace (C).
  - the empty Frataraka site (80 m).
  - the roads, except that the road south is q_s1's main street.
- **Alternatives:**
  - one continuous town over the zone polygons: contradicts "very low density" and "separate blocks";
  - a regular grid of streets: modern;
  - recursive block splitting: T-junctions only, no blind alleys;
  - Voronoi or organic plots: staircase walls, and thousands more collider boxes.
- Reversible: the generator is seeded (467) and data-driven; quarters are one row each in `plan.ts`.
## D-042 Tol-e Ajori built to the 2017 report's plan (Phase 6, session 3)
- **New evidence (search extract of the TOLAJORI2017 abstract, B):** the plan is 39.07 × 29.05 m, "oriented from WNW to ESE, with a 20° shift to N from the E-W axis". A massive wall 10.47 m thick encloses an inner room of 8.00 × 14.36 m with low benches along its walls, reached by two corridors on the NW and SE short sides.
  - So the passage runs along the LONG axis, at 110°/290° true. This supersedes the research file's C guess of a NE–SW passage; settlement.json now carries `plan_2026`.
  - Glazed reliefs: aurochs and mušḫuššu on an originally blue ground, with the colours now paler (WP-ISHTAR search extract, B).
- **Built (C where not stated):**
  - 12 m high (a press figure);
  - corridors 4.2 m wide and 7.5 m high, the room 9 m high, all with flat ceilings (vault or roof unknown, Q-081);
  - benches 0.45 × 0.6 m;
  - stepped crenellations;
  - baked-brick facing over the mud-brick core (B material);
  - relief rows: three on each short façade and two in each corridor wall, with the animals walking toward the passage (C);
  - glaze weathered 0–28 % per panel (C), because the gate is 50–70 years old and unrepaired (Q-051).
  - The figures are drawn from the Babylonian type, not traced from the fragments.
- **Setting (C):** the gate stands in the ESE wall of a 330 × 260 m walled garden, with a spur road from the royal road to its ESE mouth ("column bases and foundations beyond the gate", press; garden complexes in the zone, B).
- **Alternatives:** two parallel NE–SW passages (the earlier guess, now contradicted); a free-standing gate with no enclosure (possible; Q-081).
## D-043 One storehouse and one state stable placed (C), although the research listed them as not placed (Phase 6, session 3)
- The research file lists storehouses and stables as "not placed" because none has been excavated outside the Terrace. The build places one of each as C, each a `town_elements` row with its basis:
  - **the storehouse** (magazines round a court) by the road south: PF 2–8 send grain, flour and loaves to Persepolis "for the royal stores" (A, Darius-era);
  - **the state stable** by the royal road W of the town: horse rations for months at a time in 76 PF texts (POTTS2023, B).
- **Why:**
  - Their existence is attested.
  - The population model counts people working at "mills, breweries, stores, stables" (population.json), who need places to work.
  - The scope of Phase 6 names storehouses and stables.
- Only one of each, so the town does not suggest a known layout. Both are flagged C in the overlay and in town_plots.json.
- **Alternative:** leave them unplaced and the workers placeless. Reversible: two rows.
## D-044 Settlement rendering, colliders and fire (Phase 6, session 3)
- **Meshes:** each quarter is merged into one mesh per material, together with any compound within 60 m of its edge. Gardens with orchards share one mesh, and so do the four estates. Every face keeps an owner id, so the dev overlay (F3) names the plot or object under the view centre with its tier, sources and basis (`userData.describe`, a small additive hook in `ui/overlay.ts`).
  - The whole settlement is 39 meshes, 10 of them instanced (trees and haze). It holds 0.88 M triangles if everything were drawn once.
  - Shared meshes: trodden ground, refuse, water, roads and canal banks are one mesh each; none casts a shadow.
- **Shadows:** a town mesh casts shadows only while its bounds are within 150 m of the camera. Far trees never cast. The near-tree level's bounds follow its instances. So from the Terrace no town content enters the shadow cascades.
- **Colliders:** walls, props, kilns, troughs, mangers and well heads are Rapier cuboids (25,134 boxes). They stream per site: added within 200 m of the player, at most 1,500 per frame; dropped beyond 300 m.
  - Roofs are not colliders. The test camera's ground cast lands in the lane, and nobody walks on roofs without a stair.
- **Fires:** 1,303 town hearths, bread ovens, forges and kilns join the fire system with schedules (`fire.ts` `scheduleLit`, C):
  - hearths (`home`) light as the sun sinks from +6° to −4°, staggered per fire, and are banked 2–4 h after dark; they are relit before dawn;
  - ovens (`bake`) burn before dawn into the morning;
  - kilns and forges (`day`) burn in working hours.
  - Their bodies are drawn in the town meshes (`fire.add(..., { body: false })`), not the fire system's instanced bodies. That saves ~130 k triangles per pass.
  - Smoke puffs come only from fires within 300 m of the camera (`SMOKE_RANGE`). From further away the town's smoke is `TownHaze`: soft sheets per quarter whose opacity follows the lit share of that quarter's fires, thicker in the still evening air.
- **Trees:** 3,595 instanced trees in 4 forms, at two distance levels (near < 160 m). Deciduous species go bare in winter (`LEAF_TABLE`, C). They are PLACEHOLDER-grade.
- **Measured (SwiftShader, `?test&quality=test`, same view with and without the town):**
  - Terrace W edge, looking SW over the town: +16 draw calls and +0.72 M triangles at dusk; +19 draw calls and +0.79 M triangles by day.
  - High quality (fixed counters, D-047; the same frame with the settlement group hidden, and a separate `?notown` page load that agrees):
    - Terrace W edge: +17 draw calls and +0.64 M triangles at dusk and by day. Frame totals: 121 draws / 2.46 M at dusk, 308 / 4.42 M by day.
    - Inside q_s1's main street, looking up the road at the Terrace: +43 draw calls and +0.99 M triangles, including the local quarter's shadows. The frame total is 1,611 / 8.68 M, most of it the Terrace at the end of the street; nothing occludes it, because there is no occlusion culling.
    - All within the settlement's budget of ≤ 150 draw calls and ≤ 2 M triangles.
- **Alternatives:**
  - instancing house types: every house differs;
  - impostor cards for far quarters: not needed at < 1 M triangles;
  - a trimesh collider per quarter: slower to build and cannot stream;
  - the fire system's smoke for every hearth: its 400-puff pool would starve the Terrace's fires.
## D-045 Music: tunings, physically modelled instruments and a performer-only music system (Phase 8 start, session 3)
- **Rule (brief §11):** only what someone in the world is playing, with no background score. `MusicSystem.perform()` needs a finite world position and plays through an HRTF panner on the `music` channel. `update()` stops any performance whose performer is no longer present.
- **Evidence rules in code (research/SOUNDSCAPE.md):**
  - No instrument at an offering. At sacrifice a magus chants unaccompanied (Herodotus 1.132, B); `context: 'offering'` is refused.
  - Court music plays only when the court is resident (Heracleides via Athenaeus, B for the court in general; D-003 court setting).
  - Work songs and herders' pipes are C, and the caller keeps them sparing.
- **Tunings (`src/audio/tuning.ts`):**
  - Mesopotamian heptatonic: tuning by alternating fifths and fourths (CBS 10996, UET VII 74/126, B) gives the Pythagorean diatonic. The interval sizes are an inference (C).
  - Seven modes as rotations. The Akkadian names follow the Kilmer cycle as recalled; they were not seen in an extract (C).
  - Greek modes for the Ionian masons, on the Philolaan diatonic tetrachord (B ratios, C use).
  - Tests: every step is a 2^a·3^b ratio, and none is equal temperament.
- **Instruments (`src/audio/instruments.ts`, pure DSP, node-tested):**
  - Vertical angular harp (9 strings), round-bodied lyre and long-necked lute: Karplus–Strong waveguides with a fractional-delay allpass. Measured pitch is within ±3 cents of the tuning.
  - Double pipe: an STK-clarinet-type reed and cylindrical bore with in-loop bore loss (0.3), which stops overblowing to the 3rd/7th mode, and a fractional bore. Measured within ±2 cents from 220 to 880 Hz, plus a drone pipe.
  - Frame drum: a modal membrane. Clappers: filtered noise.
  - No oud, duduk, santur or orchestral instrument exists.
- **Composition (`src/audio/music.ts`, C):** a seeded motif is stated, shifted, ornamented and reversed. Phrases cadence on the 1st or 5th degree. Plucked strings add string-pair dyads (fourths and fifths) at cadences. Drums play 4–7-beat seeded cycles. The same seed gives the same piece, and another seed gives a different one (tested).
- **Not yet done:**
  - No performer plays in the world. Performers need the population sim (who plays, when: herders, work songs, off-duty leisure) and the human animation (instruments at true size, played with matching animation).
  - No title-screen piece: audio unlocks only on the Enter click, which starts the game.
  - The magus's chant is speech-synthesis work (`src/audio/speech.ts`).
- **Alternatives:** sampled instruments (no CC0 recordings reachable, and they would not vary); additive synthesis (not physical modelling as the brief asks).
## D-046 Clouds drawn behind the world; terrain LOD by geometric error (session 3)
- **Clouds:** the first render of the volumetric clouds (high quality, overcast) showed the cloud deck laid over a wall. The cloud dome was a transparent material with the depth test off, so it was drawn after all opaque geometry and covered every surface above the horizon (the Apadana tower read as sky-grey; at test quality the same wall is olive plaster).
  - It is now drawn like the sky, stars and moon: in the opaque pass by render order (−7), with no depth test or write, so every later object covers it.
  - Custom src-alpha blending keeps its alpha. A non-transparent NormalBlending material would force the alpha to 1.
  - Verified: the wall is back to its plaster colour under the overcast deck, and the image's mean luminance fell from 171 to 152.
- **Terrain LOD:** the far ring widening (D-035) left 8.3 M terrain triangles across all chunks, because LOD was chosen from vertex spacing alone (0.004 rad) and kept the flat plain at full resolution.
  - Each chunk now precomputes the worst height error of each decimation step (geomipmapping, de Boer 2000). The coarsest step is used whose error, seen from the camera, subtends ≤ 0.0013 rad (≈ 1.5 px at 1440p) and whose vertex spacing subtends ≤ 0.02 rad.
  - Measured over all chunks: 4.6 M triangles (near 2.1 → 0.5 M, mid 2.5 → 0.8 M, far 3.7 → 3.3 M).
  - The far ring keeps 256-cell chunks because draw calls are the tighter budget. 128-cell chunks would save a further 1 M triangles for 144 more draw calls.
  - The skyline and seam tests still pass.
## D-047 Bench and test renders that really render; Milky Way and airglow; cloud density from noise volumes (session 3)
- **Bench and `renderOnce()` measured nothing.**
  - three r186 advances its node frame only inside its own animation loop. The post pipeline's scene pass updates once per node frame. A frame rendered outside the loop (bench, `renderOnce()`) therefore skipped the scene pass and drew only the final quad.
  - Measured by instrumenting the backend: 1 draw call, 1 `render()` call per frame, sub-millisecond "frames".
  - The session 2 draw-call numbers came from the animation loop's frames interleaved with this. Every bench report so far is void.
- **Fix:**
  - `frame()` advances the node frame itself when it is not called from the animation loop.
  - The bench waits for the GPU after each frame (WebGPU `onSubmittedWorkDone`; a 1-pixel readback on WebGL2). It reports serialised frame time, CPU time and, where Chrome exposes timestamp queries, GPU pass time (`trackTimestamp` in bench mode).
  - It also stopped flooding the GPU queue: the old bench submitted about 200,000 unsynchronised frames and hung SwiftShader at teardown.
- **Milky Way and airglow:**
  - An additive sky layer between the sky and the stars. Its position is exact (A): the J2000→galactic rotation composed with the epoch's precession and Earth rotation, the same astronomy-engine matrix as the stars. It is tested: the galactic centre maps to l = b = 0, the pole to b = 90°, and Deneb to its catalogue l/b.
  - Brightness structure is procedural (C): a disk thinning with latitude, brighter toward Sagittarius, a bulge, the Great Rift and the Coalsack as absorbing lanes, and mottling. Airglow uses a van Rhijn horizon brightening.
  - Extinction by air mass. Visible only in full darkness, and washed out by moonlight and cloud.
- **Clouds:** density comes from precomputed tileable 3-D noise volumes (`src/sky/cloudNoise.ts`: Perlin–Worley base and Worley fbm erosion, 64³ RGBA, about 0.5 s to build, tileability tested), sampled in world coordinates so the field no longer follows the camera. This is the standard real-time method (Schneider 2015). Before, fractal noise was evaluated about 160 times per pixel per frame, which is unlikely to hold 60 fps at 1440p (REAL_HARDWARE_TODO H6).
  - A large-scale weather field modulates the cover.
  - Tops rise with the cell.
  - A per-pixel start jitter lets TRAA average away the banding.
  - Shapes and optics remain C.
## D-048 Relief far representation, shadow proxies and the finest relief grid (session 3, phase-4b agent)
- **Problem (the lead's measurement at quality high, Grand Stair foot):** ~3,200 GPU draws per frame against a budget of 3,000, of which the Apadana relief BatchedMesh `relief:figures` alone was 2,274 (0.45 M triangles; per-object tally, `tests/e2e/dbg_draws.spec.ts`). WebGPU issues one draw per figure instance per pass, so the 534 Apadana figures cost one draw each in the view pass and again in each shadow cascade, even 60 m away at L3.
- **Far chunks** (`reliefs.ts`, `RELIEF_CHUNK` 12 m):
  - A relief set's figures are grouped by position into chunks. When a chunk's bounds are beyond `RELIEF_FAR` (the L2 range, 14 m, with the 1.12 hysteresis), it is drawn as ONE merged mesh of its figures at L3 (the same geometry the figures would show there), and its figures leave the batch.
  - Near chunks keep per-figure LOD.
  - **Whole set:** while every chunk of a set is far, the set is drawn as ONE mesh (its far chunks merged, built once on first use), so a set seen from afar is one draw whatever its size.
  - A hidden batch instance is parked on its L3 geometry, because `BatchedMesh.deleteGeometry` also deletes the instances that still reference a geometry. The first version lost instances this way (caught by tests/reliefs.test.ts).
- **Shadows:**
  - The batch and the far meshes cast none. Low relief loses little: the sun's shadow normal bias (5 cm) already erases a 4.5 cm relief's self-shadow.
  - Within `RELIEF_SHADOW_RANGE` (8 m) a chunk casts through a proxy: its merged L3 mesh with a material that writes neither colour nor depth in the view passes, drawn two-sided into the shadow maps, and not raycastable.
  - So a relief set costs one draw per chunk per cascade near the camera, and nothing in the shadow passes elsewhere.
- **Finest grid:** the L0 cap is 1025² (was 513²), for the Phase 4 jamb figures (D-049). Figures under 0.82 m, which is every Apadana register figure, are unchanged.
- **Measured (node, tests/reliefs.test.ts):**
  - Apadana worst case unchanged: 0.76 M triangles.
  - All nine relief sets (889 figures), probed in front of every framed jamb and along every Phase 4 stair face: worst 0.95 M ≤ 1.5 M (at the Hall of 100 Columns N1 jamb).
  - Relief draw ranges before culling, view pass (node probe of the nine sets, three views):
    - Grand Stair foot: 9 (one mesh per set; no batch figure, no proxy), 0.23 M triangles. Before, the 534 Apadana figures alone were one draw each per pass.
    - Apadana N court (0, 60): 195 (Apadana 187: the figures within 14 m of the N stair in the batch, the rest of its chunks merged; 2 proxies), 0.53 M triangles.
    - Tachara S court (-21, -112): 42 (Tachara stair 34 near; every other set one mesh), 0.25 M triangles.
- **Measured (e2e, quality high, WebGPU on SwiftShader, day 0 09:00 clear; `tests/e2e/phase4_draws.spec.ts`):** before = the lead tip 6172b33 without this work; after = this work merged on it, which also adds 355 relief figures, 22 doors, the windows and the niches. Draw calls and triangles are `__parsa.stats()` over one frame, view and shadow passes together. "Relief draws" is the per-object tally of relief objects over the same frame, as `dbg_draws`.

  | view | draw calls before → after | triangles before → after | relief draws before → after |
  |---|---|---|---|
  | Grand Stair foot (-60, 122, 1.6, 71, 10) | 3,361 → 1,120 | 9.82 M → 9.58 M | 2,278 → 9 |
  | Apadana N court (0, 60, 1.6, 161, 5) | 3,225 → 991 | 9.80 M → 9.69 M | 2,304 → 40 |
  | Tachara S court (-21, -112, 1.6, 341, 6) | 3,120 → 1,018 | 10.21 M → 10.40 M | 2,163 → 39 |

  - All three views are now under the 3,000-draw and 12 M-triangle budgets. Before, the Apadana set's BatchedMesh alone was 2,158–2,293 draws.
- **Alternatives rejected:**
  - One merged mesh per whole set as the only far form: a set is 80 m long, so standing at one end would put the whole set in the batch. Used only when every chunk is far.
  - A second BatchedMesh with chunks as instances: the same draw count as meshes on WebGPU.
  - Batch shadows within a range: hundreds of draws per cascade.
  - A shadow-only layer: the CSM cascade cameras copy the view camera's layers.
## D-049 Phase 4 relief programmes: the other palaces' stairs and door jambs (session 3, phase-4b agent)
- **Where from:** the SITE_SPEC relief rows (research/PHASE4_ACCESS.md: search extracts of SI-ARCH captions, ISAC-PA, FARROKH/Iranica, BRIT-H100; all capped at B). New programme rows: `door_jamb_reliefs` (Tachara, Hadish, Tripylon, Hall 100, Harem) and `relief_state_467` (Tripylon, Hall 100); sizes in `global.r_stair_relief` and `global.r_jamb_relief` (C). Planner: `src/arch/relief_programmes.ts`; one ReliefSet per programme (`decor.buildPhase4Reliefs`). 355 figures in 8 sets.
- **Attested motifs placed** (motif B; composition, count and size C):
  - Tachara S stair: servants climbing the flight parapets with kids, wineskins, covered dishes and bowls, in alternating Persian and Median dress (24). Persian guards flank XPc on the central landing (4 + 4, count C), with the XPc panel (Old Persian; placement C). A lion attacking a bull sits in the triangle under each flight ("corner angles"; position C).
  - Hadish W stair: servants on the lower flights (B). Guards flank XPd on the lane divider's face above the meeting of the lower flights, standing on their slope (position C), with the XPd panel. Guards stand on the platform face beside the stair ("wings", B; placement C).
  - Hadish E stair: guards on the N and S end faces, where they stand clear of the platform ("South Facade of South Wing", B). Servants on the flights (C, from Iranica's "similar to the Tachara").
  - Tripylon N stair: Persian and Median nobles ascending both flights. The central panel has a winged disc between seated sphinxes with palms, above two groups of 4 guards flanking a blank field (Q-P4-08: 4 per group chosen). The lion-and-bull corners are NOT SEEN: placed as C, with the analogue named (Apadana, Tachara).
  - Jambs:
    - Tachara: the S door has the king under a parasol with a fly-whisk bearer; the N-W door the royal hero vs a lion and vs the monster; the N-E door attendants with towel and flask. The assignment of motifs to the modelled doors is C.
    - Hadish: the NW door has the king with parasol and towel bearers ("Darius the king", B); the E door the king and attendants (B).
    - Tripylon: the E door has the king and crown prince enthroned on a platform carried by three rows of bearers of the subject peoples (B; 9 per jamb, C). Each lower tier holds up a plain ledge on which the tier above stands, and the top tier holds the platform: the ledge is RECOLLECTION, NOT SEEN (C). The first render had no ledge, so the bearers held up the feet of the tier above. The N and S doors the king with attendants (B).
    - Hall of 100 Columns: the N doors have the king enthroned over 5 registers of guards ("5 registers" NOT SEEN, C); the S doors the throne carried by the nations (B); the E and W doors the royal hero vs a lion, a bull or the monster (B).
    - Harem: the S door has Xerxes with fly-whisk and parasol bearers (B); the E door the hero stabbing the lion-headed monster (B; drawn as a horned, winged lion, C); the W door the hero vs a lion (B).
- **Reconstructed with the analogue named (C):** Hadish NE (as NW); Hadish W (figures as E; XPe is attested but not carved); Harem N (as S); Tripylon corners (as Apadana and Tachara).
- **Left plain (no programme found):** the Hadish S (balcony) doorway, the Apadana hall doorways, the Tripylon S stair and the "inner faces" (which stair is uncertain), the Gate and the Treasury.
- **Not placed:** the Tachara lance-bearers (their W-room doorways are not modelled), XPe (not in inscriptions.json), and the crenellations of the Phase 4 stairs.
- **Carving state in 467 (Q-086):**
  - Tripylon: carved and painted. Iranica dates it to Darius I, and the E-jamb king is captioned as Darius I with crown prince Xerxes, which puts the carving before 486. Stone was set before brick (D-015).
  - Hall of 100 Columns: blocked out. Every jamb figure is the `~rough` variant of its kind: outline cut back, masses roughed as planes, claw-chisel marks, no detail, incisions or paint. The hall was completed by Artaxerxes I, and its shafts are ~30 % raised in 467. Construction is left visible, as the brief asks.
- **New figure kinds** (relief_figures.ts, each with tier, sources and note):
  - `king_attendants`: the king, a parasol bearer and an optional second attendant, at hierarchic scale 0.78 (= r_jamb_relief.attendant_scale).
  - `bearer`: arms raised; dress after DELEGATIONS, chosen by seed.
  - `dais`: the throne platform; `rail`: the ledge between tiers of bearers (C).
  - `hero` seed 2: the monster.
  - `kind~rough`: the blocked-out variant of any kind.
- **Sizes and fit (C):** jamb figures stand 0.15 m above the floor and walk into the hall. The leading royal figure is 0.4 × the door height, or smaller to fit the reveal between 0.12 m margins. Relief depth is 0.054 m (1.2 × r_relief_depth).
  - Tested: every jamb figure lies on its reveal within the frame depth, above the floor, below the lintel, and walks into the hall. All depths are within r_relief_carving. Blocked-out figures carry no paint.
- **Arm's length:** the L0 grid cap is now 1025² (was 513², D-048). The 2.2 m Tachara king's cells go from 5.1 mm to 2.6 mm (141 k triangles at L0).
- **Alternatives rejected:**
  - Placing Apadana-style registers of nobles on every stair: not what the extracts say.
  - Leaving the unfinished buildings' jambs plain, or fully finished: neither extreme is supported. Blocked out shows the programme and the state of the work.
  - Inventing programmes for doorways without evidence.
## D-050 Windows and niches; door frames replace the brick (session 3, phase-4b agent)
- **Windows and blind niches** in monolithic dark-limestone frames (jambs, sill block, lintel, and a cornice as r_door_frame; `src/arch/openings.ts`):
  - Tachara: 2 windows, either side of the main doorway, and 5 niches (N wall between the doorways; E and W walls on the aisles).
  - Hadish: 9 of its 19 windows (count B), in the hall walls facing the portico and the balcony, on the aisle axes where the door frames leave room. Its 4 niches (count B) are on the walls to the apartments. The other 10 windows belong to the unmodelled apartments.
  - Sizes: width half the main door, sill 1.2 m, head level with the door head of that wall, niches 0.5 m deep. All C (`global.r_window`, `r_niche`, per-building `r_windows` / `r_niches`; Q-087).
  - No glazing (blocklist). Shutters are not modelled.
- **The wall is cut where a frame stands** (`parts.cutWall`), so no frame face is coplanar with a brick face.
  - The same fix for doorways: wall gaps are now as wide as the frame (width + 2 jambs). Before, the jamb's reveal face lay in the plane of the wall end, and the two z-fought on every reveal, exactly where the jamb reliefs now sit.
- **Walkability:** sills (1.2 m) are above the step-up and the walkable-grid rays, so windows are not passages. The grid lost no cells to them.
- **Tests:** counts per building (manifest); the Tachara N wall is still three runs at floor level, with a lintel zone over each doorway. The literal lint now covers openings.ts.
## D-051 Working timber doors with metal fittings; barred and sealed doors (session 3, phase-4b agent)
- **Which doorways (22 doors, 44 leaves):** every stone-framed doorway of the finished palaces (Apadana 4, Tachara 3, Hadish 5, Harem 4), the Gate of All Nations (3; the D-032 leaves), and the Treasury (the N and E enclosure doors and the Hall of 99 Columns store).
  - None in the unfinished Tripylon and Hall of 100 Columns: joinery is fitted last (C).
  - None on the unframed gaps of the Harem and garrison enclosures (entrances C, no door evidence).
  - Palace doors exist here as C, by analogy with the Gate's pivot sockets (Q-088).
- **Leaves** (`global.r_door_leaf`, C):
  - 0.12 m timber (the Gate keeps 0.25 m). Each leaf turns on a post at the opening edge, just in front of the frame.
  - Closed, the pair spans the opening, with a 1 cm gap at the meeting stiles.
  - Open, a leaf swings 180° through the hall to lie against the inner wall face (the D-032 rule, so the jamb reliefs stay visible). Where a corner or another frame leaves less than its length, it opens 90° instead: the W leaf of the Tachara N-W door and the E leaf of the N-E door.
  - Fittings: four bronze bands studded with bosses (0.2 m pitch, drawn within 40 m of the camera), and a bronze shoe on each post foot. The bronze is drawn with metalness 0.35, because the renderer has no environment reflection (the D-030 precedent).
  - The Hall of 99 Columns store door swings out, because benches line its inner wall.
  - The Treasury enclosure doorways now have a 4.5 m head with brick above (they ran to the wall top).
- **Door system** (`src/arch/doors.ts`):
  - Leaves are drawn as instanced slabs, bands, posts, shoes and bosses: 5 draws, ~19 k triangles near a palace. Each leaf has one kinematic collider, turning about its post.
  - E (main.ts) works the door the camera faces within 2.2 m (the look ray hits a leaf, or the doorway between the posts); otherwise it addresses a person, as before.
  - The swing takes 1.5 s, eased. A leaf does not move while the visitor stands in its arc, and a closing leaf waits for people.
  - Barred (`locked`) and sealed doors do not open. `door.id` and `door.locked` are the visitor-mode hooks (brief §1).
  - State (progress, target, barred, sealed, moved by the visitor) is saved with the world (`SaveGame.doors`, core/save.ts) and restored with the colliders snapped.
- **Barred and sealed doors (C, Q-089):**
  - The Treasury E door is barred and sealed (a secondary door in 467).
  - The Hall of 99 Columns store is open in working hours (people place treasury_store) and sealed with clay outside them.
  - The Treasury N entrance is open in working hours and barred at night.
  - Sealing: bronze knobs on both leaves, a cord between them and an impressed clay lump on the approach face. A barred door has a timber bar inside (`global.r_door_sealing`; sealing practice B, door sealing C).
  - Hours: `global.r_door_schedule` (6.5–17.5, C). People at a scheduled door are let through. The doorkeeper lets the visitor through the barred entrance (observer mode: nothing is barred). The store keeper does not seal the store while the visitor is inside, and a sealed store never opens for the visitor from outside.
- **People:**
  - The walkable grid is built with every usable door open (leaves in their open pose, as static colliders, in tools/build_nav.ts and the offline bot) and every permanently barred or sealed door shut.
  - People open a closed, unbarred door as they pass (anyone within reach of the passage axis), so a door the visitor closed never strands the simulation.
  - Palace doors stand open by day (C). There is no night closing schedule for the palaces.
- **Measured (tests/doors.test.ts):**
  - A leaf is half-way at 0.75 s and shut at 1.5 s.
  - A ray through a shut Tachara S door stops at the leaf, 3.98 m from its start 1.5 m outside the wall face, as the geometry predicts; it passes when the door is open.
  - The player walking at a shut Hadish E door stops at the leaf, and walks into the hall when it is open.
  - E out of reach does nothing. Save/load round-trips. The Treasury E door answers "sealed".
  - The schedules, the keeper and the visitor rules behave as above. Every open leaf is clear of every frame, wall and column.
- **Alternatives rejected:**
  - Leaves as static parts moved by rebuilding colliders: no swing, no per-frame collider.
  - Leaves in the reveal, opening against it: that covers the jamb reliefs (D-032).
  - Sealing the Hall of 99 Columns permanently: its people place would become unreachable.
  - Letting the visitor break seals.
## D-052 Walkable grid, routes and verification after the Phase 4b architecture (session 3, phase-4b agent)
- **Walkable grid rebuilt** (`npx tsx tools/build_nav.ts`): 1,417,114 walkable cells (43 fewer). The lost cells are at the two 90° leaves of the Tachara N doors, the Apadana leaves along the inner wall faces, and the passage of the sealed Treasury E door. Windows, niches and the wider frame gaps changed no cell.
- **Offline bots:** all six Phase 4 areas pass (`tools/dev/botcheck.ts`: 77 targets, max fall 0). The Phase 3 slice route passes with the door leaves in place: 28 targets, from the plain through the Gate and the Apadana hall doors and back.
  - The slice targets now live in `tests/e2e/lib/routes.ts` (`SLICE`, shared with walkthrough.spec.ts), so `npx tsx tools/dev/botcheck.ts slice` checks that route offline in seconds.
- **Renders (e2e, SwiftShader, quality test; queue rules: at most four views per spec, runs under 15 min):**
  - `tests/e2e/phase4.spec.ts` has the jamb king at 0.95 m, the Tachara S stair, the Tripylon bearers and a blocked-out Hall of 100 Columns jamb.
  - `tests/e2e/phase4_doors.spec.ts` has the Tachara S door open, half and shut, and the Treasury sealing.
  - The helper (`tests/e2e/lib/p4views.ts`) stops the animation loop after load. With it running, each screenshot waited about 3 min behind loop frames and both runs hit the 14-minute test timeout. With it stopped, the door run takes 2.4 min and two relief views 3.9 min.
  - Judged: the Tripylon bearers first held up the feet of the tier above, fixed with ledges (D-049). Everything else reads as intended: the leaves swing into the hall; the sealed store shows knobs, cord and clay on the meeting stiles; the blocked-out figures are unpainted with claw marks.
## D-053 Rain cells as moving objects: distant rain shafts (session 3; §1.1 "rain moving across the plain toward the columns")
- **Timeline:** each wet day's rain episode at the Terrace (a start hour and duration from the weather generator) is the anchor. `WeatherSystem.rainCell(day, hour)` models the cell that brings it:
  - before onset, it stands upwind at the steering wind × time to onset, and approaches at constant speed;
  - during the episode it is overhead;
  - after the episode it recedes downwind.
  - Steering wind = 2.5 × the surface wind, at least 5 m/s. This is the same factor the cloud drift uses (C).
  - The cell radius is 2.5–6.5 km with precipitation (C).
  - Unit-tested: approach speed, bearing from the wind, overhead, recession, and nothing under a weather override (which has no timeline).
- **Rendering (`src/world/rainShafts.ts`):**
  - A cluster of 5 vertical open cylinders from the ground to the cloud base.
  - Opacity is analytic with no raymarch: 1 − exp(−σ·chord), where the chord through a cylinder at a side point seen horizontally is 2R·|cos θ|. σ = 3·10⁻⁴ m⁻¹ (C), which gives a 6 km core about 0.85 opacity.
  - Streaks drift down, the top fades into the cloud base, and scene fog supplies the aerial perspective. Snow cells are paler.
  - Hidden when the player is inside the rain (local streaks and fog take over) or when the cell is beyond 70 km.
- **Moment:** day 12's episode arrives at 06:01 from the WSW (245°), straight across the plain at the W façade. `tests/e2e/moments.spec.ts` `rain-approach` looks from the Apadana W portico at 05:40.
- **Alternatives:** raymarched rain volumes (cost); billboards (they rotate visibly); rain only at the camera (the moment cannot exist).
## D-054 Visible birds (Phase 5 wildlife, part 1; session 3)
- **Why:** brief §5.5 asks for birds including seasonal migrants and raptors. Until now only their calls existed (the soundscape). No agent owned wildlife.
- **What (`src/world/wildlife.ts`):**
  - swallows and swifts: C, expected but not sourced. Summer migrants, Mar–Sep by day, hawking 2–25 m over eight court anchors at 4–20 m/s;
  - buzzards and golden eagles: B, raptors of the Zagros, extract; C on site. Two soar in 40–90 m circles 120–450 m above the Kuh-e Rahmat slope, 8:30–17:30, on thermals drifting at 0.3 × the wind;
  - house sparrows: C. Forty on the court floors by day, hopping every ~7 s. They fly 8–15 m off in 1.2 s when someone comes within 3 m.
  - None fly in rain ≥ 0.4.
- **Determinism:** every flight path is a closed-form function of (seed, species, index, world time), so birds need no saved state and stay continuous across time skips and loads. Only the sparrows' flush is reactive.
- **Cost:** one InstancedMesh per species (3 draw calls), no shadows. Wingbeats run in the vertex shader from a per-instance phase and flap amount.
- **Tested:** determinism, flight speed and height ranges, season and hour gating, the sparrow flush.
- **Jackals (part 2):** golden jackal, B for Fars (SOUNDSCAPE.md §5); range and behaviour C. A pack of 2–4 each night, from dusk (18:36) to dawn (05:48), on the plain 130–970 m W or S of the walls (tested never to enter the Terrace polygon). They walk or trot at a mean of 1.2–3 m/s and pause about a fifth of the time. It is 1 draw call, with the trot animated in the vertex shader.
- **Not yet:** dogs, rats, flies, bee-eaters by the rivers (the plain), game in the paradises (the settlement), livestock. Birds do not yet avoid architecture (swallows' loops are 2–25 m above the court's walkable floor, and some pass through walls and roofs: C, to fix).
## D-055 Speech voiced by eSpeak-NG from the lexicon IPA, pre-rendered (Phase 8; session 3)
- **Brief §10:** "speech is synthesised from the lexicon's IPA, converted to the synthesiser's own phoneme format (e.g. … eSpeak-NG)", "pre-rendered at build time where possible, with varied voices, ages and sexes; post-processed; spatialised", and "Swappable".
- **`tools/build_speech.py`:**
  - Converts each scripted line's IPA (words from `research/LEXICON` only) to eSpeak-NG phoneme mnemonics.
  - **Verifies the conversion by round trip:** eSpeak's own IPA reading of the mnemonic string must equal the lexicon IPA, allowing only the listed approximations (ʕ → ɣ, since the phoneme tables have no voiced pharyngeal; emphatic ˤ dropped; ç → x; ɛ → e). The build fails otherwise. All 14 lines pass.
  - Renders six voice classes with eSpeak variants, pitch and speed (C): man low and mid, old man, woman, older woman, child.
  - Post-processes: trim, 80 Hz high-pass, −3 dBFS, fades, Ogg Opus. 84 clips, 527 KB.
  - Base prosody rules: Persian (`fa`) for Old Persian and Elamite, Arabic (`ar`) for Aramaic (C).
- **Runtime:** the existing swappable `RecordingBackend` plays a clip when one exists for the line and the speaker's voice class (`voiceKeyFor`). The formant synthesiser (D-011) remains the fallback. Recordings dropped into the manifest later replace the eSpeak clips line by line.
- **Honesty:** eSpeak-NG is itself a formant-plus-rules synthesiser. It is more intelligible than our placeholder but not natural. Nobody has listened: the reviewer subagent cannot hear, so intelligibility and naturalness are **unrated** (brief §10 acceptance open). The lexicons stay thin (14 lines).
- **Alternatives:**
  - A neural phoneme-input TTS (e.g. Piper/VITS): its models are hosted on blocked sites.
  - The eSpeak WASM build at runtime: 2+ MB of GPL code shipped, for no gain over pre-rendering.
## D-037 Rivers carved into the heightfield; the Naqsh-e Rustam ground restored (Phase 7)
- **Problem:** the bare-earth filter (D-006: opening/closing r 110 m) fills the Pulvar and Kur channels, and the 16/80 m rings cannot hold an 8-42 m channel or a 64 m vertical cliff. A river ribbon laid on that surface would float on the floodplain, and a tomb façade set on the smoothed Naqsh-e Rustam slope would be half buried.
- **Rivers (tools/build_terrain.py layer 4, `public/generated/rivers.json`):**
  - The channel is the trapezoid fitted to each river's own flow table (plain.json `channel`: width = bed + 2 x slope x depth, residual <= 0.10 m; Pulvar bed 2.38 m, slope 1:6.52; Kur 4.72 m, 1:8.40). Bank height = April depth + 0.4 m (1.6 / 2.2 m, C).
  - Bank-top level = the bare-earth floodplain on the centreline (mid ring; far ring after a 240 m opening that removes riparian trees), smoothed (sigma 200 m) and made non-increasing downstream by a running minimum, so it is never above the local floodplain and water never runs uphill. Where the floodplain has a dip the channel downstream is incised deeper (up to 7 m on the Pulvar for ~1 km N of the Terrace; median 0 m, p95 1.9 m). Alternatives: isotonic least squares (puts the bank on a levee where the DSM dips), no carve (river floats on the plain).
  - The OSM Pulvar line stops ~340 m short of the Kur; it is joined to the nearest Kur point (C), and its last 1.5 km of bed converge on the Kur's level (step < 0.5 m, tested).
  - Every sample within (top/2 + one cell) of the centreline is lowered to bed - (0.3 m + the bed's fall over two cells). The river corridor mesh (`src/world/plain/rivers.ts`: bed, banks, and an apron out to where the carve's influence ends) is drawn over the trough; river-corridor trimesh colliders are created lazily within 600 m of the player, so what is walked is what is drawn.
  - The water surface is one mesh whose width and level follow the date through uniforms (flow_by_month interpolated at mid-month, C): the river rises and falls without rebuilding geometry. Canal water shares the mesh.
  - Distance lift: beyond 1.2-2.5 km the corridor, water and draped ribbons are raised in the vertex shader by up to 3 m (0.07 deg at 2.5 km), because the terrain's coarse far LODs can bridge the trough. Colliders are not lifted.
- **Naqsh-e Rustam (layer 5):** "the original floor at the foot of the cliff was, at least, 5 m below the present-day ground" (NR-IRANICA, B): the talus against the cliff is removed down to a surface rising 1 % outward from an ancient foot 5 m below the present foot, out to 250 m (C; the plain beyond the talus is already at or below it and is left alone: a first version lowered the whole 250 m apron by a tapered 5 m and dug a 3 m pit into the plain, measured and rejected); two cells behind the face are held at the ancient level, under the cliff mesh's top (the face may be displaced up to 2 m into the rock). Ancient foot 1,622.5 m asl (present 1,627.5 m). The face line (grid y 6,124, x 432-932) is read off the raw DSM's 1,635-1,660 m contours (C, +-10 m).
- **Verified (tests/plain.test.ts, tests/terrain.test.ts):** trapezoid vs table; terrain under the channel at 480+ sampled centreline points; bank monotone and never above the floodplain; confluence step; Naqsh-e Rustam ground; all terrain spot checks, seams and the SRTM skyline still pass. Terrain changes only inside the carved corridors and the Naqsh-e Rustam precinct (near ring unchanged).
- Reversible: yes (the pipeline layers are separate functions; `npm run terrain` regenerates).

## D-038 Fields, crops, orchards and woodland in the terrain material; trees by distance (Phase 7)
- **Fields are drawn by the terrain's own material** (`surfaceMaterial('earth', { modify })`, a small hook added to materials.ts; `src/world/plain/terrainPlain.ts`): zero extra draw calls for ~2,700 km2 of land use. Per pixel: an 800 m "district" (jittered-grid Voronoi; strips of one orientation, bounded by a track), a plot inside it (anisotropic Voronoi, strips 22-52 x 90-210 m, C), the plot's land use read at its seed from a 64 m zone texture (irrigated polygons, rain-fed rule, village orchard rings, woodland cover; settlement zones, the Terrace, river corridors, village cores and the Naqsh-e Rustam precinct left natural), the crop chosen from the data mix by a hash, and its state read from a crop-state texture (365 days x 8 rows) at today's date +- the plot's own phenology offset (+-12 days). Bunds, district tracks, furrows and vineyard rows near; beyond ~3-10 m per pixel the plot fades to the zone's mean colour for the date (no shimmer).
- **One hash on both sides:** a 32-bit PCG integer hash (three's TSL `hash` recipe) with 24-bit float outputs, identical in WGSL and JS (tested against a BigInt reference), so the near crop instances, orchard trees and woodland trees stand exactly on the plots and crowns the shader draws.
- **Crop calendar (`src/world/plain/seasonal.ts`, C on B calendars):** barley sown mid-Nov, table heights, golden from late April, cut ~30 May (+-12 d), grazed stubble to the autumn ploughing; wheat/emmer sown ~22 Nov, cut ~27 Jun; sesame May-Sep; fallow and orchard floors follow the herb curve (season.ts); vines leaf out in April. Trees: leaf-out, autumn colour and bare winters per group; fruit blossom Mar-Apr, almond Feb-Mar (C).
- **Crops near the camera:** one instanced mesh of 6-blade tufts within 26-60 m (by quality); height and colour read in the vertex shader from the same texture, so nothing is rebuilt when the date changes.
- **Trees:** riparian (plane, willow, poplar, tamarisk; IR-RIPARIAN analogy B, placement C), canal lines, orchards (7 m grid in orchard plots), woodland (10 m jittered cells, cover from the woodland rule thinned to 10 % within 2 km of the Terrace). Within R3 (160-400 m by quality) every tree is a 3D instance (wood + crown: 2 draw calls, shadows; crowns shrink to bare branches in winter); beyond, the 43,000 riparian and canal trees are camera-facing billboards (1 call) and the 4,200 orchard plots are row impostors (vertical quads along the rows with a scalloped crown line, 1 call); woodland beyond R3 is the crown pattern the terrain shader draws at the same hash positions. Trunk colliders within 40 m of the player.
- Alternatives: field polygons as meshes (10^5 plots: memory and draw calls), a baked field texture (a 20 km x 20 km area at 2 m = 10^8 texels), decals (z-fighting, draw calls). All C-tier layout either way.

## D-039 Villages, canals, tracks, quarries and Naqsh-e Rustam as built (Phase 7)
- **Villages (`villages.ts`):** the four Barrington villages at their data points (map-scale, +-3 km, C); Rakkan is moved 900 m to the nearest suitable ground (the point falls where no village can stand), recorded in its note. The other 33 of Sumner's 39 secure sites (2 are settlement.json zones) by the `villages_unlocated` rule: on low rises within 1.5 km of a river or canal, >= 2 km apart, below 1,660 m, outside the settlement zones; populations log-uniform in 150-3,000 scaled to 30,000 (C; with the four located, 33,700 <= Sumner's 44,000). Area from Sumner's density (65 persons/ha, B derived). Houses: courtyard compounds of mud brick (household 6, compounds 14-24 m, rooms on the N side and sometimes a wing, 2 m yard walls, gates, a timber door on each room's courtyard side; C), about 4,000 compounds, merged per 8 km cell (12-13 draw calls, frustum-culled per cell); cuboid colliders created within 500 m of the player.
- **Canals (`canals.ts`):** off-takes every 2-4 km on the side where the irrigated polygon lies; each follows the contour of the bare-earth DEM at 0.5 m/km for 2.5-7 km (stopping where it would need a cutting > 2.5 m or an embankment > 1.2 m, reaches a settlement zone, another canal or leaves its polygon). 37 canals. Water at ground level between 0.45 m spoil banks (C); tree lines along them.
- **Tracks (`ribbons.ts`):** a minimum spanning tree over the villages plus each village's link to its nearest settlement.json road, meandering +-12 m, cut where the ground is steeper than 10 % (C).
- **Quarries:** Sivand (B, +-100 m) and Majdabad (+-3 km, C), moved to the nearest rock (regional slope > 25 %) within their uncertainty; stepped benches, cut blocks, spoil (C).
- **Naqsh-e Rustam (`naqsh.ts`, plain.json `naqsh_e_rustam`):** a 64 m cliff face (B height; C line and rock surface: vertical jointing, bedding ledges, ~3.4° lean-back, a crest varying ±10 m and lowered to the DEM ridge behind the face where that is lower, so the west end runs down with the hill instead of ending as a sheer slab) with the tomb of Darius I and, 60 m ENE on the same line, the uninscribed tomb attributed to Xerxes (D-033; spacing C, Q-076). Façade 22.93 m, foot 15 m above the ancient ground, median register 14 x 7.60 m, upper arm 8.50 m (B, search extracts); arm width 10.9 m, recess 1.2 m, four engaged columns 5.3 m with schematic double-bull capitals, three-fascia architrave, dentils, cornice, a sealed doorway 1.4 x 2.8 m (C). Upper register: 28 throne-bearers in two tiers under the dais, the king on a three-stepped podium before the fire altar, the winged figure, the moon, guards on the side panels (programme B; silhouettes C, flagged PLACEHOLDER). The DNa/DNb panels are dressed but not inscribed (PLACEHOLDER: the published text is not in inscriptions.json). Ka'ba-ye Zardosht: 12 m tower on a triple-stepped base (14.12 m), base 7.30 m, 30-step stair to a 1.7 x 0.87 m door, dark blind windows (C, WP-NR); stair facing the cliff (C, Q-078). Neo-Elamite relief 7 x 2.5 m on the face (B size; schematic figures, PLACEHOLDER). Colliders: the cliff trimesh and the Ka'ba boxes and steps. Nothing of the later tombs, the Sasanian reliefs or Naqsh-e Rajab is built (tested by name).

## D-040 The plain's budget at the vista; ownership boundary with Phase 6 (Phase 7)
- **Budget design:** the plain adds a fixed set of meshes, not per-feature objects: 33 meshes in all (terrain layer 0; river banks + water 2; canal banks 1; tracks 1; villages 12 cells; far trees 1; orchard rows 1; near trees 4 (wood + crown, shadow-casting and not); near crops 1; Naqsh-e Rustam 9; quarries 1). Worst-case triangles with nothing culled: 1.01 M (tests/plain.test.ts). Shadow casters are only the near trees, villages, Naqsh-e Rustam and quarries (the CSM cascades end at 600 m, so far casters are culled from the shadow passes).
- **Measured in the browser** (tests/e2e/plain.spec.ts, headless Chromium + SwiftShader WebGPU, after merging the fixed `__parsa.stats()` counters; the plain group shown vs hidden, same view, same frame state; renderer.info counts every pass of the frame, so the CSM shadow passes are included):

  | view (quality=high) | frame without plain | frame with plain | plain adds |
  |---|---|---|---|
  | Grand Stair top, looking W at dawn (-36.4, 122.45, eye 13.6 m) | 1,472 calls, 4.36 M tris | 1,486 calls, 5.23 M | **+14 calls, +0.87 M** |
  | Apadana, looking N toward Naqsh-e Rustam (1.9, 40) | 2,573 calls, 9.36 M | 2,594 calls, 10.23 M | **+21 calls, +0.87 M** |
  | Grand Stair foot, looking E (the lead's baseline view, -60, 122) | 3,112 calls, 9.47 M | 3,120 calls, 10.18 M | **+8 calls, +0.71 M** |

  At quality=test (run 4, same method): Kuh-e Rahmat slope +20 / +0.89 M; Pulvar bank +24 / +0.78 M; field (April, crops near) +14 / +0.91 M; village P22 +26 / +1.24 M (the worst case measured: 976 near trees, 400 of them shadow-casting, plus the village's shadow cell); Naqsh-e Rustam at 200 m +20 / +0.78 M; the Ka'ba at 40 m +18 / +0.73 M. All inside the Phase 7 limits (<= 150 calls, <= 2 M triangles). At the three high-quality vista views the plain casts no shadows at all (no near trees; villages farther than 900 m, Naqsh-e Rustam farther than 1,200 m). The whole frame at the Grand Stair foot is over the 3,000-call frame budget before the plain (3,112): not the plain's; the reliefs are being fixed separately. The river/cliff carve in the terrain rings adds <= 0.03 M terrain triangles at bias 1 and none at high-quality bias (counted in the `without` column, measured headless).
- **Ownership with Phase 6 (settlement.json):** the plain reads settlement.json but draws nothing of it: its zone polygons are kept free of plain fields, villages and orchards; its four roads are not drawn here (`PLAIN_DRAWS_SETTLEMENT_ROADS = false` in src/world/plain/index.ts: flip it at merge if the settlement agent draws only the roads inside its zones); village tracks end on those roads. The Kuh-e Rahmat canal is settlement.json's.
- **Shared-file edits (small, additive):** `materials.ts`: `export interface Layer` and an optional `modify`/`variant` on `surfaceMaterial` (any other ground layer, e.g. the settlement's, can compose into the same hook); `world.ts`: build and update the plain; `tools/build_terrain.py`: restructured into per-ring functions plus layers 4-5 (D-037). The plain swaps the terrain chunks' material by name ('terrain' group) instead of editing terrainMesh.ts.

## D-060 — Sky dome calibrated against the skylight; the distance converges to the sky at the horizon (session 3)
- **Measured problem:** the first rain-approach render showed the rain shafts brighter than the sky beside them (sRGB 227 against 209; horizon band 194). The cause is general. The fog colour and the cloud layer's far haze were a fixed hand-set blue-grey (0.62, 0.66, 0.74) scaled only by twilight. A CPU port of three's SkyMesh (`src/sky/horizon.ts`, same constants and steps as its colour node) shows that this was never the sky's horizon radiance:
  - At 35° sun, the uncalibrated dome's horizon is 1.6–3.3 renderer units, 12× the radiance of sunlit ground. Its horizontal irradiance is 9–15× the scene's skylight (the hemisphere light). The tone mapper hid this as a pale, washed-out sky.
  - At −2° sun, the dome is 35× darker than the skylight, while the fog was 500× the dome's horizon. The pre-dawn frame therefore looked like daytime overcast.
- **Decision:** one calibration, applied alike to everything that fades into the sky:
  - The dome is scaled so that its horizontal irradiance equals the hemisphere light's (three's diffuse radiance is albedo · I · colour / π, so I is the sky irradiance): `scale = E_hemi / ∫ L cosθ dω`, a 16 × 32 quadrature within 2 % of a fine reference.
  - At night the scale blends back to 1, so the night sky, airglow and Milky Way keep their own perceptual values (D-047).
  - The fog colour, the cloud layer's far haze and the rain shafts' tint all derive from the calibrated horizon radiance: the scaled dome 1.5° up, averaged over a 90° fan across the view, capped at 2.5× the all-round mean so a low sun's aureole does not light the whole distance.
  - The river reflection takes the fog colour directly.
- **Result, by construction and tested (`tests/horizon.test.ts`):**
  - Fog, far cloud and the sky at the horizon agree.
  - The calibrated clear horizon is 0.5–3× the radiance of sunlit ground of albedo 0.25, as a clear sky is (C). The measured ratio is about 1.3 at 35° sun, against 3 for the old fog and 12 for the raw dome.
  - The daytime sky becomes a deeper blue relative to the ground.
- **Tiers:**
  - The dome's shape is B (Preetham).
  - The scale is only as good as the hemisphere light it is tied to. Its daytime value is C, its twilight curve (smoothstep −14° to 4°) is C, and the calibration scene is blocked (NEEDS #13).
  - The aureole cap and the 90° fan are C.
  - Under cloud the dome is not reshaped to the CIE overcast distribution. It is only scaled with the reduced skylight.
- **Rain shafts, same session:**
  - Each column now has a Gaussian density profile. The mesh has twice the core radius, and the optical depth is σ·R·√π·exp(−4 sin²θ), so the edges fade out instead of a hard rim.
  - The top fades over the upper 60 %. The streaks are softer.
  - The tint is 0.7 of the calibrated horizon (C: a curtain shaded under the deck reads darker than the horizon behind it).
  - The moment moves to day 241, 13:24, looking 300°: the cell is 23 km NW over the plain, 1.3 h before the episode, cloud 0.78. The old pre-dawn slot (day 12, 05:40) was under full overcast with the far ranges hidden.

## D-061 — DNa and DNb carved at Naqsh-e Rustam from the edition text (session 3)
- **Before:** the Phase 7 panels on Darius I's tomb were dressed but blank (D-039 placeholder), because the text was believed missing.
- **Found:** it is in the project's own CC0 ARIo mirror (`data/corpus/ario.jsonl`, Schmitt 2009), identified by content:
  - Q007152 = DNa ("Ariyaciça", the throne-bearers passage "patikarā … gāθum");
  - Q007153 = DNb ("haya adadā ima frašam … upari Dārayava.um").
  - The neighbouring Q007172 is DSf, not DNa.
  - These ARIo entries carry the Old Persian versions only.
- **Built:**
  - `tools/build_inscriptions.py` adds both; XPa–XPd come out byte-identical.
  - The Old Persian is carved on the two panels with the Terrace pipeline (glyph outlines, sign forms by Kent's rules, C), fitted to fill each panel: DNa 1,358 signs, 3.2 cm glyphs, 43 lines; DNb 1,585 signs, 4.2 cm, 42 lines.
  - Modern lacunae (ARIo "x" and hyphenated damaged groups) are left out. In 467 those words were intact, but they are unknown to us, so no signs are invented for them.
  - The glyphs are flat faces (`textPanelGeometry(…, flat = true)`). Extruded, bevelled glyphs cost 2.6 M triangles; flat faces cost 98 k. From 15–25 m below, an incision reads as a dark stroke.
  - The carving is drawn only within 600 m of the cliff.
  - Pick rectangles let the translation layer read both texts from up to 80 m (the Terrace panels: 15 m).
- **Tiers:**
  - Text A (standard edition).
  - Sign forms C.
  - Panel position, size and line layout C (the real OP columns run to more lines than the C-sized panels hold at this glyph size).
  - Elamite and Babylonian versions not carved (not in the mirror): still a placeholder, flagged in the mesh note.

## D-062 — The Hall of 100 Columns follows the simulated construction (session 3; Phase 5 gate item)
- **Before:** the simulation advanced construction every week (D-022: drums arrive, are dressed and set; shafts are fluted; capitals set), but the hall was drawn at its day-0 state.
- **Now:** `src/world/construction.ts` (ConstructionView) replaces the architecture's static hall columns with instances grouped by each column's state: drums set, fluting done, capital set. It rebuilds only when that state changes, a few times a week, so frames cost nothing extra.
  - `columnMesh` takes an explicit `{ fluted, capital }`. Defaults are unchanged: fluted and capped only when complete.
  - So the geometry can show the sim's intermediate states: a complete shaft still plain (fluting follows erection, C) and a fluted shaft waiting for its capital.
- **Verified (`tests/construction_view.test.ts`):**
  - At day 0 the view draws the same 116 columns as the architecture, shaft tops within half a drum (worst 0.55 m; drum 1.15 m). The static geometry's fractions are continuous, the simulation counts whole drums.
  - After 120 simulated days of work, 7 drums are set and 2 columns stand visibly taller.
  - It rebuilds only on change.
- **Side effect:** 19 static column groups become 5 state groups, so fewer draw calls at the hall.
- **Not done (C, noted in the module):**
  - Colliders keep their day-0 height. A shaft stump sits above the bell base, which is already beyond the step-up, so walking is unaffected.
  - Walls, relief carving, the yard (drum stacks, capital blocks) and ramps stay at day-0 geometry.
- **Addendum (same session): the building site.** The view also draws the site the simulation counts (brief §1.2: "an active building site, with scaffolds, stone-cutters and rationed work gangs, is honest"):
  - quarry-rough drums waiting and dressed drums ready to raise, up to 36 each, in rows in the masons' yard (`worksite`);
  - finished double-bull capitals (the real capital mesh) and the block being carved (a roughed-out box of its size) at `worksite_capital`;
  - timber scaffolds (four poles, ledgers every 2 m, a plank deck a man's height below the shaft top) at the column receiving drums and the shaft being fluted.
  - It rebuilds when the yard counts or the working columns change.
  - Scaffold form, stacking and layout are C: no evidence of the method was retrieved (D-022).
- **Addendum (same session): smoke follows the same light.** The town haze sheets (settlement/haze.ts) were a hand-set grey scaled by a daylight ramp. The fire smoke puffs (fire.ts) were a constant unlit grey, which glowed on a moonless night. Both now use single scattering: ω · (the calibrated horizon radiance across the view + the sun's irradiance × a Henyey–Greenstein phase, g 0.6). The puffs add their fire's glow as they leave the flame (power × 0.6 × e^(−1.5·age), orange). ω 0.9, g and the glow are C.
## D-100 — Visitor mode: access rules on the Terrace and in the town (research agent, session 3; `src/data/access.json`, research/ACCESS.md)
- **Four rule levels per zone,** read only with PLAYER_MODE = visitor. Observer mode still bars nothing.
  - **open:** free.
  - **business:** the halmi is shown and a stated business belongs to this place.
  - **escort:** only with a guard or official beside the visitor.
  - **closed:** no entry, and no escort offered.
- **Terrace, court absent (D-003):**
  - Grand Stair: **open** by day; the stair heads watch.
  - **The Gate of All Nations W door is the one check** (business). The visitor waits on the Gate's bench for an escort.
  - The courts beyond the Gate: **escort** (business once recognised on the same errand, D-103).
  - The street N of the Treasury: **business**. The letter is handed over there, at the N door posts.
  - **Closed:** the Apadana, the Tachara, the Hadish, the Harem, the Tripylon, the Hall of 100 Columns site and camp,
    the Treasury interior, the garrison quarters, the E fortification and the PF find-spot.
  - **Night:** the whole Terrace is closed to the visitor. He is turned back at the stair heads.
  - **Court resident:** the Apadana and the palaces stay closed except by summons; the Gate stays the check.
- **Town:**
  - Open: lanes, wells, roads and open ground.
  - Closed: houses (unless invited), yards and pens, walled gardens and orchards, the Bagh-e Firuzi paradise and
    estates, and the Dasht-e Gohar walled garden and hall.
  - Business: workshops (the visitor may watch from the door), the storehouse, the stable, the official building, the
    Area B craft yard and the way-station.
- **Posts:** the 18 existing people_places posts get a kind:
  - **check:** gate_w1/w2, gate_s1/s2 and treas_1–4;
  - **watch:** stair_n/s, which bar at night;
  - **bar:** apa, tachara, hadish and harem.

  Proposed posts, all unplaced and all on existing door coordinates: the garrison W and S doors, the Treasury E door,
  the Harem N passage, the Tripylon narrow E stair foot and the Gate E door. The keepers of the town places are not
  soldiers.
- **Why:**
  - "All visitors had to pass through [the Gate], the only entrance to the terrace" (ISAC-PA, SX, B).
  - The S approach was blocked by Xerxes (LIVIUS, SX).
  - The palace guard goes with the king (XEN-CYR 7.5.68, a claim).
  - Everything else is by analogy with gate and road practice at other palaces (HDT, XEN-CYR, Ezra; B claims).
- **Tier:** C for every rule and post kind. No text describes anyone being checked at Persepolis (Q-121, Q-123, Q-129).
- **Alternatives rejected:**
  - Checks at the stair heads *and* the Gate: the visitor would be stopped three times on one climb, and nothing
    supports a double check.
  - The courts open to anyone once through the Gate: a stranger would roam the royal Terrace alone with the court away.
- **Note for the lead:** `sim.ts` CHECK_POSTS currently includes the stair heads. access.json proposes they watch.

## D-101 — The visitor's documents: a halmi of the satrap at Susa and a sealed letter for the treasurer (research agent, session 3)
- **The halmi:**
  - Issued by "the satrap at Susa", named by office only: no 467 holder is known (Q-120). It follows the Darius-era
    pattern that the issuer belongs to the place the journey starts from (HALMI-SX, HUNARA2024, HYLAND2022; B pattern).
  - Route Susa → Pārsa.
  - Scale: 1.5 qa flour and 1 qa wine or beer a day (HYLAND2022, B).
  - The visitor travels alone, on foot, with no guide. He is a messenger (Elam. *hutlak*, PF 45, A Darius-era).
- **Form:** folded leather, tied, with a clay bulla (HALMI-SX, ARSHAMA-TA; B form, C instance). **It is never opened in
  the world, and no text is rendered on it.** The only surviving halmi (Aršāma's) names other people and is later, and
  brief §10 allows only published texts.
- **The letter:** a sealed letter for the treasurer at Pārsa, in Aramaic on leather with a bulla. Its content is unknown
  to the visitor and never shown. Treasury letters are orders from officials addressed to the treasurer (PT-WAGE,
  IR-PET; B); the instance is C.
- **What the documents do:** they entitle the visitor to rations at the storehouse and the way-station (B practice). They
  give him a reason to be let through the Gate and escorted to the Treasury door (C). They open nothing else.
- **Alternatives:**
  - A halmi "of the king": attested (NN 0859), but it implies travel to or from the court, and the court is away.
  - A named Darius-era issuer: rejected, because it would place a Darius-era person in 467 (§9.1).

## D-102 — The errand "a sealed letter for the treasurer at Pārsa" (research agent, session 3)
- **Steps** (access.json `errand.steps`; every place id and coordinate is from existing data):
  - 0 (optional) way-station on the royal road: rations;
  - 1 storehouse `stores-0001`: rations;
  - 2 the stair;
  - 3 the stop at the Gate W door, then the wait on the bench;
  - 4 escorted to the Treasury street;
  - 5 hand-over at the N door posts; the letter goes to the scribes (`treasury_desk`); word comes back: tomorrow;
  - 6 the night at `stables-0001` (D-104);
  - 7 next morning: recognised at the Gate, he receives the Treasury's sealed answer at the door;
  - 8 `official-0001`: a halmi for the return journey;
  - 9 the storehouse: the first day's ration;
  - 10 out by the royal road.
- **Timing (C):**
  - Letter handed in before midday: answer the next morning from sunrise + 1 h. After midday: the morning after next.
  - One day more if silver is weighed out that day (E-05).
  - The return halmi: the same day if asked before midday, otherwise next morning.
  - The Terrace is open to the visitor from sunrise + 0.5 h to sunset − 0.5 h.
- **Why this errand:**
  - The Treasury archive is the one archive that is live in 467: its dated texts peak in Xerxes years 19–20
    (IR-TREAS, B).
  - Its letters are addressed to the treasurer, and the tablets were kept in a NE room of the Treasury (B).
  - Journeys that start from Pārsa carry a halmi of the Pārsa administration (HUNARA2024, B).
  - Each link is B, and the chain, the places and the waits are C.
- **The Fortification archive is not a destination:** Darius-era, stored in the NE bastion, bricked up (PFA-ISAC; D-104).
- **Variant B** (the lead chooses): the visitor is escorted into the scribes' room for the hand-over instead of
  waiting outside.
- **Words:** only lexicon ids.
  - The guard: `el:halmi` (the existing line).
  - The visitor: `arc:ʾgrh` + `arc:gdbr` ("letter … treasurer").
  - The scribe: `arc:ywm` + `arc:ḥd` ("one day").

  The phrases are composed, C. There is no Elamite sentence, and everything else is gesture (Q-127).

## D-103 — The stop: gesture first, no combat, no punishment; recognition (research agent, session 3)
- **The sequence** (access.json `stop_procedure`):
  - The guard faces the visitor, steps half a pace into the way and raises an open hand.
  - The spear stays upright, butt to the ground, as the relief guards stand. It is **never levelled**.
  - He asks "halmi?" (`el.ask_document.halmi`) and looks at the bulla. He does not read the leather.
  - The business is shown by the letter's bulla.
  - He sends for an escort, or makes a flat-hand gesture back.
- **If the visitor walks on:** the two men of the post close the way with their bodies, the patrol pair comes, and
  they walk him to the zone's edge. **No blows, no weapons used, no arrest, no punishment shown** (brief §9.1 and §12).
- **Recognition,** from lives.json `familiarity` (stopped 0.5, recognise ≥ 0.25, half-life 6 days):
  - Last stop admitted and the same errand still open: a nod, no question, and the courts relax from escort to
    business.
  - Last stop turned back: he bars the way at once.
  - The errand closed: the full check again.
- **Basis:**
  - B practice, all claims: HDT 3.77 (known men pass unquestioned; the court messengers ask why they have come), 3.118,
    3.128 and 3.140 (the doorkeeper carries word in); XEN-CYR 7.5.25; Ezra 5:9–10.
  - C for the build.
- **Not used:** HDT 3.118's mutilation of the gatekeepers; Esther 4:11's death penalty; Diodorus' triple wall.

## D-104 — Places of the errand in the town; the PF find-spot is not an office (research agent, session 3)
- **The office that issues the return halmi:** `official-0001`, the ~1 ha building N of the Terrace with "an official
  function" (GONDET2018, B existence). Its use as this office is C (Q-126).
- **Rations:** the storehouse `stores-0001` (D-043), where the storekeeper checks the halmi. This is the only halmi check
  that is attested in practice (B). The place is C.
- **Lodging:** `stables-0001`, the state stable by the royal road, serves as the post station (relay horses: HDT 8.98, B
  claim). The reason: the town's `station` in town.json (−1800, 600) is abstract and not rendered, and the rendered
  Kur way-station is 11.0 km from the stair foot, 2.2–2.5 h each way on foot at 1.2–1.4 m/s (lives.json
  walk_ms), which is not playable daily. Tier C. **It does
  not move the simulation's abstract `station`.**
- **The PF archive find-spot** (NE bastion; terrace outline vertices 31–36) is **closed**. Its tablets are Darius-era;
  its entrance was bricked up in antiquity at an unknown date (PFA-ISAC, SX). In 467 it is a dead store, not an office
  (C).
- **Conflict logged, not resolved:** Aršāma's "no rations for extra days" against the simulation's multi-day station
  rations (Q-128). The visitor's waiting day's keep comes from the storekeeper against the halmi (C).
