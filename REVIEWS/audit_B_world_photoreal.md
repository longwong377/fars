# Audit B: the world and photorealism (brief §5, §7, §8), requirements traceability

**Auditor:** an independent subagent (Claude Opus 5.5). I did not see the build process. **Date:** 2026-09-26.
**Tree:** `claude/amazing-fermi-40ds7j` at HEAD `b8afeac` (the D-232 merge, 04:48). Three agent worktrees are in flight and
are not on this tree: D-234 town houses, D-235 coverage harness (`tools/dev/coverage_points.ts`, uncommitted) and D-229.
**Scope:** PERSEPOLIS_BRIEF §5.1–5.5, §7 and §8 (every clause, including the calibration scene and the rubric). The lead
added the user's directions UD-06…UD-14 (USER_DIRECTIONS.md) and D-233/D-236 to the scope: every inch at the photoreal bar,
nothing copy-pasted, every gap filled from knowledge of the period, and a world full of surprises.

**Read:** the brief (all of it), CLAUDE.md, USER_DIRECTIONS.md, PROGRESS.md, TASKS.md, BLOCKERS.md, HANDOFF.md,
references/INDEX.md (§6 the site photographs), and DECISIONS D-006…D-009, D-230…D-233 and D-236. Also REVIEWS/rubric_s7_pass2.md,
calib24.md, phase6-7.md, phase5.md (head), gap_audit.md and handoff/review_briefs.md, plus the code listed in the table.
**Ran:** `npx vitest run` on sky, sky.horizons, weather, terrain and weather_visible (`--maxWorkers=1`): 32 passed, 1 skipped
(the JPL Horizons check). Four scratchpad scripts (not committed):
1. `cov.py`: camera positions of every rig view against the Terrace walkable grid.
2. `rel.ts`: distinct relief geometries.
3. `ecl.mjs`: eclipses in 467 BCE from Persepolis.
4. A tree and human variant census.

**Looked at (Read tool):**
- `settlement-workshop-area-b`, `settlement-tol-ajori-50m` and `settlement-slope-s-dusk`;
- `moment-rain-approach`, `moment-rain-columns`, `moment-snow-terrace`, `moment-court-assembly`, `moment-stair-climb`,
  `moment-hall100-site` and `moment-hadish-hall`;
- `plain-stair-foot-east-ultra` and `plain-stair-dawn-plain-high`.

I did not run Playwright.

---

## Read first: what is broken, unverified or placeholder (ranked MAJOR MISSES)

The ranking follows the user's standard ("nowhere I go takes me out of the illusion"). Each miss below is either a proxy that
passes while the intent fails, or a requirement that is not met at all.

### M1. No frame of the current tree has been judged or even rendered. The photoreal gate has never passed.
- Every one of the 77 PNGs in `shots/` predates HEAD (the files are dated 09-25 13:56 to 09-26 04:51; the D-232 merge is 04:48).
- D-232 changed the ground albedo everywhere and re-baked the probes. By its own account, the sky's ground bounce rose ~35 %
  in every view (DECISIONS D-232). Most moment renders (09-26 00:09–03:48) also predate the D-230 stone-tone merge (02:51).
- **The Terrace wall layout of D-232 has never been seen in a correct render.** Render 1 was flat and render 2 was black. The
  fix is in node only (PROGRESS line 4).
- **The last rubric (s7 pass 2, 2026-09-25) FAILED:** light 2, materials 1, scale 3, detail 2, people 2, weather 1,
  atmosphere 2, and 0 of the 8 §1.1 moments land.
- **Rubric pass 3 has never run** (TASKS l.111). Everything merged since (D-218…D-232) is "not judged by a rubric"
  (PROGRESS l.22).
- **What I saw in the latest renders:**
  - walls read as flat tan boxes (`court-assembly`, `hall100-site`);
  - Kuh-e Rahmat reads as smooth pale dunes (`court-assembly`);
  - the construction blocks are flat boxes (`hall100-site`);
  - the plain is a featureless sheet (`rain-approach`, `plain-stair-dawn-plain-high`);
  - the Tol-e Ajori gate is a box with a flat frieze strip (`settlement-tol-ajori-50m`);
  - the Area B yard is a bare tan plane (`settlement-workshop-area-b`).
- In `moment-court-assembly-webgpu.png` (09-26 03:39) a carried jar still sits where the head is. R1 was "fixed and tested" in
  D-217, so this is a node-passes, render-fails case (outside my scope; recorded for the lead).

### M2. Coverage: the renders sample a sliver of the walkable world. The player can walk 143 km × 143 km.
- **Rig views:** 73 are defined (moments 44, plain 17, settlement 8, crowd 9, phase4 4). 42 have a PNG on disk: 37 moments,
  5 plain.
- **Measured against the Terrace walkable grid** (`public/generated/nav.i16`: 353,609 m² at 0.5 m):

  | camera within | views with a PNG on disk | every view ever defined |
  |---|---|---|
  | 10 m | 1.6 % of cells | 2.2 % |
  | 25 m | 6.1 % | 8.8 % |
  | 50 m | 16.0 % | 21.9 % |

- **Never rendered at high on this tree, or with no render on disk at all:** listed in "Areas never rendered at high quality"
  below. They include:
  - every town lane, court and room (1,456 homes; the town's only high render was one crowd shot in session 4/5, not kept);
  - all 33 villages (P22 was last rendered in session 4), the Kur, the fields in any season, the quarries and Naqsh-e Rustam
    (none on disk);
  - on the Terrace: the Treasury beyond the scribes' room, the Harem, the garrison, the fortification, the Gate hall's
    interior, the Tachara rooms and the Tripylon.
- **The player's reach is unbounded by content.** `src/player/physics.ts` swaps to the far ring's heightfield collider, so the
  player can walk the whole ±71.7 km far ring (80 m cells). The fields are built only to ±40.96 km (`fields.ts` ZONE). No test
  or record defines where the world ends, or what a walker 20–70 km out sees.
- **The planned fix repeats part of the proxy.** The in-flight D-235 sampler (worktree
  `agent-af3e66fbfe7229375/tools/dev/coverage_points.ts`) takes about 400 still points.
  - Reach is 7 km. The plain gets 85 points for about 150 km², roughly 1 per 1.8 km².
  - Each point gets one world state. A given place is judged at one time, one weather and one season.
  - It measures "the share of pixels drawn by objects flagged placeholder in F3". The villages are not flagged (M6), so their
    boxes would pass that measure.

### M3. Time, season and weather: one spring, clear skies, stills
- **Days:** the 44 moments use 12 days.
  - Days 0–32 (17 April – 19 May 467 BCE) cover 9 of them.
  - Day 280, 299 and 303 (late January – mid February) cover the rest: one snow moment, one rain moment and the calibration
    frame.
  - **No Terrace, town or palace frame is set in summer or autumn.** The plain spec has day 120/150 field and Pulvar views,
    but none is on disk.
- **Weather:** clear 41, rain 1, snow 1, auto 1. The generator also offers overcast, storm, dust and mist, and
  lightning, wind and dust storms are listed in §5.3. **None has ever been rendered.**
- **No motion anywhere.** Every judged frame is 8 TRAA frames of a frozen world.
  - No test moves the camera to measure shimmer, ghosting, LOD popping of the look (not only pop-in) or smearing under TRAA.
  - The walkthrough bots walk at quality `test` (`tests/e2e/walkthrough*.spec.ts`), with no post-processing and no AO. They
    check falls and pop-in, not the image.
- **§8 "stable anti-aliasing" and §1.1 "presence through the body" have no evidence in motion.**

### M4. The judged camera is not the player's camera
- **Lens:** the rig uses a 40–46° vertical field of view (moments.spec `IN`/`OUT`). The player plays at 70°
  (`DEFAULT_SETTINGS.fov`).
- **Resolution:** 960×540, against the 1440p target.
- **People near the lens:** `__parsa.view()` sets `crowd.rigClear = 2.5` (main.ts:182), so nobody is drawn within 2.5 m of
  the lens. The player's camera never has this.
- **Quality:** the moments run at `high`, while the top preset (the brief's full target) is `ultra`. They differ in terrain
  LOD, which was inverted until a4dc698. Only three plain views (04:15–04:22) were rendered at ultra.
- **Effect:** the player's near field is under-sampled by every judged frame: the ground at their feet, the 70° periphery,
  people brushing past. §8.3 computes "detail at 1 m" for 1440p at 70° (`tests/detail.test.ts`), but no image at that setting
  has ever been judged.

### M5. Most enterable interiors are not built, and the ones that are built stand empty
§5.1: "Every interior that exists and is enterable at the chosen date is walkable"; "Interiors are furnished".
- **Treasury** (`src/arch/terrace.ts:546–606`): an enclosure, the Hall of 99 Columns and a four-room N range. Nothing else of
  a complex SITE_SPEC gives as 120 × 60 m in its first phase alone (`treasury.phase1`, IR-PERS, B). The rest of the floor
  inside the walls is open ground.
- **Harem** (`:607–633`): an enclosure, one hall and a portico. SITE_SPEC's own tier-B row `harem.apartments` = 22 (6 in the
  main wing and 16 in the W wing, each a 4-column hall) is not built.
- **Hadish:** the apartments and the S balcony are not built (gap audit item 30, Q-087).
- **Apadana:** the S storerooms are "solid in the build" (`furnish_palaces.ts:18`).
- **Garrison:** a ring of walls around empty ground ("modest rooms only (C)", with no rooms).
- **Furnishings:** in the default world they are "rolled, covered and stored in the side rooms" that do not exist, so "with
  the court away the Apadana stands empty". `moment-hadish-hall` shows a bare hall. Since D-236 the court comes by default,
  but no furnished hall has ever been rendered (D-212 is node only).
- **Interior light:** there are 7 probe volumes (gate, apadana, tachara, hadish, treasury ×2, harem; `probes.json`). The
  town's and villages' rooms and the garrison have no interior light model, so their rooms take the open-sky hemisphere.
  §8 asks for "light that bounces realistically, including indoors".

### M6. Unflagged placeholders: the villages and Tol-e Ajori
- **Villages:** 3,983 compounds in 33 villages are merged vertex-coloured boxes.
  - They total 324,070 triangles (`plain-stats.json` villageTris), about 81 triangles per compound.
  - Each box has 5 faces, and one colour ±4 % (`villages.ts:143–166`).
  - Nothing in `villages.ts` sets `placeholder`. The town's identical kind of box houses has been flagged since D-228
    (`build.ts:22`).
- **Tol-e Ajori** (`settlement/ajori.ts`) renders as a box with box merlons and flat frieze strips. It is not flagged either.
- **Why it matters:** §3.7 requires placeholders to be flagged. The D-233 coverage metric reads the F3 flag, so these would
  count as finished.

### M7. "Soft shadows with contact hardening" (§8): MISSING, and silently degraded
- `src/main.ts:77` sets `renderer.shadowMap.type = THREE.PCFSoftShadowMap`. On WebGPU three r186 replaces this with
  `PCFShadowMap` and prints only a warning (`node_modules/three/src/renderers/common/Renderer.js:902–904`).
- DECISIONS D-007 (session 1) logged this: "Soft and contact-hardening shadows are Phase 3 work (§8)". No later decision
  implements them. There is no PCSS or blocker-search anywhere in `src/`.
- What exists is fixed-width PCF on 4 CSM cascades to 600 m, plus 0.6 m screen-space sun contact shadows (pipeline.ts:64).
- Neither BLOCKERS nor PROGRESS lists it: a quiet reduction (§3.5). The §8.1 "shadow softness" match was never measured
  (M8).

### M8. The §8.1 calibration scene is a geometry check, not a calibration
- **Scene:** the brief asks for "a column base, stair flight and doorway in their present-day ruined state". `calib-24` is
  the Terrace's W retaining wall seen from 100–310 m (REVIEWS/calib24.md). It contains none of the three objects at a scale
  where specular response, shadow softness or ambient occlusion can be read.
- **Match:** stone colour, luminance, specular, shadow softness and AO are all NOT matched.
  - Sun : shade is 3.9 in the photo against 7.0 in the render.
  - The photo is a Lightroom JPEG of weathered stone (B55).
  - D-231 then re-based the stone yardstick on near-fresh stone.
- **"Then apply the calibrated setup to the ancient state":** not done ("the renderer's lighting unchanged; light values stay
  C").
- **§14 Phase 3 was to be "built after the calibration scene matches its photo".** The whole look rests on uncalibrated C
  values.

### M9. Snow cannot lie on the mountains without lying on the plain
- `weatherState.ts:28–53` keeps one world snow bucket (a degree-day melt). `main.ts:389` feeds it to a single uniform,
  `WEATHER.snow`.
- `materials.ts finish()` (l.942) masks snow by slope, roof and noise only, with no altitude term. The terrain uses the same
  material (`terrainMesh.ts:36`).
- The ranges of 2,160–3,640 m on every winter horizon (terrain.json far ring max 3,646 m) are therefore bare whenever the
  plain is bare, and the whole plain whitens whenever the mountain does.
- §5.3's first snow clause, "snow on the mountain in winter", is not met. `weather_visible.test.ts` checks only the forced snow
  moment on the Terrace.

### M10. Weather renders that are absent or never seen
- **Running drains and rain run-off:** the 12 drain mouths are geometry (`waterworks.ts`). No water flows from them and no
  run-off exists anywhere (grep: none).
- **Morning mist:** mist raises only the uniform aerosol haze (`weatherState.ts:56,69`). It never forms ground fog.
- **Dust storms:** only haze. The dust volume (`dust.ts`) is work and foot dust, and it has never been seen in a render
  (PROGRESS l.54).
- **Lightning:** a sky flash and a directional light, with no bolt.
- **Wind in cloth:** none. There is no cloth simulation, and the pleats are baked (D-225).
- **Rain:** the rain-approach moment's curtains remain faint. The frame holds a flat, empty plain and no columns, so
  "rain moving across the plain toward the columns" is not in the frame (`moment-rain-approach-webgpu.png`, looked at).

### M11. Fire light passes through the town's walls ("B24 RESOLVED" covers only the Terrace)
- `fireOcc.ts:8` says so itself: "Only the Terrace's fixed fires are baked; the town's hearths and anything that moves cast no
  fire shadow".
- The 12 (high) or 16 (ultra) nearest lit fires get point lights (`world.ts:154`). In a town lane at night, the hearths behind
  the court walls light the lane through them.
- **No oil lamps in houses:** one lamp exists in the whole world, the scribes' lamp (`firePlaces.ts:60`).
- **Villages draw no flame or fire light** (`villages.ts` places none; only the smoke layer implies them).
- The §1.1 dusk moment is logged as not landing (B49).

### M12. Copy-paste: nothing measures repetition, and the counts are high (UD-08, D-236)
| what | distinct models | instances | measured |
|---|---|---|---|
| trees (15 species × 3 variants, `trees/model.ts` VARIANTS = 3) | 45 | 43,469 line trees + 3,595 town trees + 88,386 orchard rows | ≥ 1,000 instances per model; yaw, scale and tint vary only |
| human bodies (`humans.json` variants) | 23 (15 men, 5 women, 3 children) | ~46,900 people | ~2,000 people per body (out of scope, §9; recorded) |
| relief figures (927) | 357 distinct kind + seed + mirror | cypress 234 from 3, lion-and-bull 12 from 2, Persian nobles 64 from 16, Medes 60 from 16, guards 92 from 40 | `rel.ts` over buildReliefs + buildPhase4Reliefs |
| village compounds | one box kit, one colour ±4 % | 3,983 | `villages.ts` |
| merlons, column orders, ceiling timbers | one mesh per type | hundreds, instanced identically | parts / instancing |
| surface texture | one procedural noise field per material | every surface of that material | the rubric called the floor "one colour and a speckle stamp" |

- No test measures scene-level or object-level repetition. D-236's "the same place at the same hour on different days must
  differ" has no measure either.

### M13. Terrain layers §5.2.2 and §5.2.3 are not done
- **Pre-modern landscape:** not done. The rivers follow modern OSM courses (C; B6 blocks CORONA and Schmidt's aerials). The
  user's own 1930s aerial #27 ("the most valuable landscape image", INDEX §6) was used only for soil colour (D-232).
  Watercourses, modern fields and ancient mounds were never restored from it.
- **Ancient ground level:** "modern bare-earth, with no correction" (D-006, Q-003). The only exception is Naqsh-e Rustam's
  −5 m foot.
- **Modern reservoirs:** not handled in the bare-earth step (Phase 6+7 review minor 3).

### M14. Real sky events of 467 BCE are not in the sky (UD-11 "surprises"; §5.3 "correct moon")
- astronomy-engine (`ecl.mjs`) finds a **partial lunar eclipse** on about day 100: the night of about 25/26 July 467 BCE
  (Julian), peak 21:36 UT, about 01:06 local time. The moon stands 36° up over Persepolis. The eclipse is C because of the
  ΔT uncertainty; the moon's height makes it robust to a shift of an hour or two.
- The sky has no eclipse model (grep "eclips" and "umbra" in `src/sky`: none), so that night renders a full moon.
- The same holds for meteor showers, halos, rainbows after the rain moments, frost on winter mornings, summer heat shimmer
  and dust devils: none is modelled (grep).

### M15. Records overstate or are stale
- **B24** is marked "RESOLVED" but covers only the Terrace (M11).
- **B11's** browser crowd file is gone (Phase 5 review M1).
- **README** budget rows are stale (Phase 6+7 review M1).
- **PROGRESS l.22** says "render pass 3 queued (jobs 4xx)". The pass-3 moment PNGs exist (09-26 00:09–03:48) but were
  never scored, and they already predate D-232.
- **Missing records:** no record says the rig is judged at 40–46° with a 2.5 m clearance, or at `high` rather than the top
  preset (M4). No record notes that snow has no altitude term (M9) or that the villages are unflagged (M6).

---

## World-completeness inventory (UD-14): what a real 467 royal city and its countryside held that this world lacks
Tier C unless noted. These are my knowledge of the period and the project's own records; each needs sourcing before building.

- **On the Terrace**
  - The Treasury's other halls, courts, corridors and storerooms, and the Harem's 22 apartments (SITE_SPEC B).
  - The Hadish apartments.
  - Open, enterable Apadana storerooms and garrison rooms (M5).
  - **The quarries on Kuh-e Rahmat.** The Terrace's own stone source was active in 467 for the Hall of 100 Columns, and photo
    #11 marks quarries with two unfinished capitals. It is not built (Q-565).
  - Spoil heaps and the haul road from the quarries.
  - Rain gutters and spouts on the palace roofs.
  - Stone-cutters' waste chips at the building site.
  - Scaffolding and ramps at the Tripylon.
- **Town and palace zones**
  - Real houses (in flight, D-234), with lamps, roof terraces used for sleeping in summer, and household storage on the roofs.
  - Brick-making yards and moulding pits by the canals (the construction consumed millions of mud bricks).
  - Lime kilns.
  - Tanneries and dye works (§5.5 names them; gap audit 20 lists them as not built); a mill; a stockyard; latrines (gap audit
    19, 35).
  - Bridges or fords where the royal road crosses the Pulvar and Kur. None exists: no hit for "bridge" or "ford".
  - The paradises' walls, gates, pavilions and water channels at eye level (garden-paradise was last rendered in session 4).
- **The plain**
  - Village houses beyond boxes, with village hearths and fires.
  - Threshing floors and winnowing in summer, stubble after the harvest and burning stubble.
  - Dung cakes drying on walls, animal folds and the transhumant bands' tents on the plain.
  - Reed beds, and the canal head-works and weirs on the Kur (the Kuh-e Rahmat canal's dam is in data only).
  - Spring flowers on Kuh-e Rahmat and the plain in April, as snapshots of real phenology.
  - Snow-capped Zagros in winter (M9).
  - Frost and dew mornings, and heat shimmer and dust devils in summer (both common in Marvdasht).
- **Life (§5.5)**
  - Flies are heard but not seen; there are no rats, storks or bats (PROGRESS D-210).
  - The delegations' animals and chariots are not drawn.
  - Wheels do not turn and animals wear no reins.
  - No gait faster than a walk.
- **Sky:** the July partial lunar eclipse, meteors (the Perseids in August) and planetary conjunctions, all computable from
  the existing ephemeris (M14).

## Surprises (UD-11): what the world could hold that nobody asked for
Every item below is computable or probable, and none needs invented words:
- the 467 eclipse and a meteor night;
- a rainbow opposite a clearing rain cell;
- frost on the merlons at a January dawn;
- a dust devil crossing the stubble in August;
- the Kur in spring flood over its banks;
- the day a caravan's dust is seen from the Terrace an hour before it arrives;
- swallows' nests under the porticoes;
- a stork's nest on a village roof;
- the first snow on Kuh-e Rahmat seen from the court.

None exists today, and nothing in the plan (MASTER_PLAN.md does not exist on this tree) tracks a discovery backlog.

---

## Areas of the world never rendered at high quality (on this tree, or with no render on disk)
- **Terrace**
  - The Treasury: the Hall of 99 Columns, the store rooms, the vestibule and the courts.
  - The Harem's hall and portico: `harem-portico` has no PNG; a debug `surf-harem-portico` existed in session 7.
  - The garrison quarters.
  - The E fortification and its towers.
  - The Gate of All Nations' interior: `gate-dusk` looks at its W face from outside.
  - The Tachara's N and E rooms: "unrendered" since session 3. `tachara-lance-bearers` and `-close` are not in pass 3.
  - The Tripylon: `tripylon-n-stair` is not in pass 3.
  - The Apadana's E and N porticoes and towers, apart from the E stair raking views.
  - The S courts and the S retaining wall.
  - The drain mouths and cistern heads (D-214, never rendered).
  - The furnished palaces (D-212).
  - The Hadish exterior and courts.
  - The Terrace wall from below on the N and S (only the W: calib-24, stair-foot-east).
  - The Terrace wall's D-232 masonry in any correct render.
- **Settlement**
  - Every town lane, court and room of the 10 quarters. `lane-q_s1` and `lane-q_w1-dusk` have no PNG.
  - The gardens: `garden-paradise` was last rendered in session 4.
  - Bagh-e Firuzi, Dasht-e Gohar, the N official complex, Takht-e Rustam and the way-station.
  - The sacred precinct and the burial ground (D-209, never rendered).
  - The court camps' 1,946 tents (never rendered).
  - The stables and the storehouse.
- **Plain**
  - All 33 villages. P22 was rendered in session 4 and "read as cabbages".
  - The fields in any season (`field-april`, `field-may`, `field-august` and `field-january`: never judged with a correct camera).
  - The Pulvar bank (session 4, black water; the fix was rendered but is not on disk).
  - The Kur: never.
  - Naqsh-e Rustam: none on disk.
  - The quarries (Sivand, Majdabad).
  - The roads and tracks at eye level beyond 1 km.
  - The plain 7–71.7 km out.
  - The river in flood or low water.
- **Weather and time**
  - Any summer or autumn frame of the Terrace or town.
  - Overcast, storm, dust, mist and lightning.
  - Night in the town, as distinct from the town seen from afar at dusk.

## Placeholders (grep `PLACEHOLDER|placeholder` in src/ and data/)
**Flagged in code or data:**
- the town houses (`settlement/build.ts:22,156–158`: box walls, roofs and doors, with street doors that never move);
- the reliefs, carving procedural (`arch/reliefs.ts:19` RELIEF_META `placeholder: true`, NEEDS #10);
- the Phase 4 relief programmes (`arch/decor.ts:62`);
- the uncarved royal-inscription copies (`decor.ts:349–350`, Q-290);
- the six uncut stretches of DNb (`decor.ts:213`, `royal_inscriptions.json:21`);
- the Neo-Elamite relief figures at Naqsh-e Rustam and the DNa/DNb Elamite and Babylonian versions (`plain/naqsh.ts:8,334,343`,
  `plain.json:4447`);
- the Now view's museum roof and columns, capital fragments, steel shelter, fallen capitals, basin and plain
  (`now_view.json:25–134`, `nowview.ts:51`);
- the Babylonian formant voice (`audio/speech.ts:15,317`: placeholder quality);
- the hand-authored animation cycles, not motion capture (`people/anim.ts:5`, `workAnims.ts:9`: "PLACEHOLDER quality");
- a silver-in-lieu rate (`events_calendar.json:86`, "C placeholder").

**Placeholders by content, NOT flagged:**
- the 3,983 village compounds (M6);
- Tol-e Ajori's box massing (M6);
- the Hall of 100 Columns site's foreground blocks: still flat boxes in `moment-hall100-site` (rubric R8, "fixed" in D-217 as
  quarry-rough, but the render shows flat boxes);
- the Treasury, Harem and garrison interiors (M5);
- the ceiling timbers as "render-only boxes" (`ceilings.ts:16`).

---

## Traceability table

**Status key:**
- **VERIFIED:** checked fresh on the current tree.
- **BUILT-UNVERIFIED:** code exists, never checked in a render.
- **PARTIAL:** part of the requirement is built.
- **MISSING:** not built.
- **PROXY-ONLY:** verified only through a narrower proxy (chosen views, a few days, one season or weather, one quality, stills,
  node not browser).

**Scope-gap column:** does the verification cover all places, times, weathers, the player's quality and motion?

### §5.1 Extent
| # | requirement (quoted) | where implemented | how verified, latest evidence | status | scope gap |
|---|---|---|---|---|---|
| 5.1a | "concentric rings, all georeferenced" | `data/geo`, `terrain.json` (grid frame), `tests/terrain.test.ts` (grid transform vs pyproj/OSM control) | vitest today: pass | VERIFIED (node) | Georeferencing of the town and villages is rule-placed C (Q-050); no plan check beyond the Terrace |
| 5.1b | "The Terrace, at 1:1." | `src/arch/terrace.ts` from `site_spec.json`; plan overlay and dimension tests | Phase 2 passed with exceptions (B6: OSM footprints, no Schmidt plan); calib-24 camera solve rms 8.9 px (D-230) | PARTIAL (footprints single-source, B6) | Not re-run this audit |
| 5.1c | "Every interior that exists and is enterable at the chosen date is walkable: the Grand Stairway, Gate of All Nations, Apadana, Tachara, Hadish, Hall of a Hundred Columns, Tripylon, Treasury, 'Harem of Xerxes', Unfinished Gate and the rest, as the chronology allows." | terrace.ts builders; the nav grid (`nav.json`, 1,414,437 cells); chronology marks the Unfinished Gate, Palace H and the later tombs absent | Walkthrough bots at quality `test` (session 3, 77 + 28 legs); Tachara SW room unreachable on the grid | PARTIAL: Treasury, Harem, Hadish apartments, Apadana storerooms and garrison rooms not built (M5) | Walkable ≠ rendered: 6 % of walkable cells have a rendered camera within 25 m (M2) |
| 5.1d | "Also the fortifications, storerooms, drains and cisterns, and the mountain slope with its tomb façades (sealed tombs stay sealed)." | `fortification_e` (terrace.ts); `waterworks.ts` (12 drain mouths, 2 cistern heads, D-214); the tombs on Kuh-e Rahmat are 4th c., absent (chronology) | Node tests (waterworks.test); nothing rendered | BUILT-UNVERIFIED (fortification, drains); storerooms PARTIAL/MISSING | Never rendered at any quality |
| 5.1e | "Interiors are furnished: thrones, hangings, carpets, vessels, stored goods" | `furnish.ts` (Treasury goods), `furnish_palaces.ts` (D-212), scribes' room (D-221) | Node only (palace_furnish.test); scribes' room rendered, stale; `hadish-hall` render shows a bare hall | PARTIAL / BUILT-UNVERIFIED | The default world keeps the palaces empty; court-state furnishing never rendered; not in the probe bake |
| 5.1f | "Doors are timber with metal fittings. They open, close and lock plausibly, and stores are sealed." | `arch/doors.ts` (22 working doors, bands, bosses, sealings) | doors.test, phase4_doors e2e (session 3) | PARTIAL: the town's street doors are placeholder slabs that never move; village doors are dark boxes | Town and village doors not working; the doors' look never judged close up |
| 5.1g | "The settlement. The lower town and palace-and-garden zones (Persepolis West, Bagh-e Firuzi, Tol-e Ajori), with workshops, housing, storehouses, stables, gardens (paradises), roads and way-stations. The evidence here is patchy, so layout is partly C-tier; label it." | `world/settlement/*`, `settlement.json` (22 features, all C), `town_plots.json` | Phase 6+7 review: lints pass, layout tiered (M3 tier inflation); 4 settlement renders (Tol-e Ajori, Area B, slope ×2) | PARTIAL: houses placeholder (D-234 in flight); Tol-e Ajori box unflagged | No lane render; one season; no night-in-town render |
| 5.1h | "The plain. Fields, villages, orchards, canals, the Pulvar and Kur rivers with seasonal flow, roads, and Naqsh-e Rustam (Achaemenid features only)." | `world/plain/*`, `plain.json`; `rivers.ts` monthly flow uniforms; `naqsh.ts` | plain.test, plain_d223 (node); renders: the three ultra Terrace views and older vistas | PARTIAL: villages are boxes (M6); rivers on modern courses; Neo-Elamite figures placeholder | No eye-level plain render on disk beyond 1 km except rain-approach; the seasons never judged; the Kur never rendered |
| 5.1i | "The horizon. Real mountain silhouettes out to ~40 km." | Far ring ±71.7 km at 80 m, curvature and refraction (D-035) | terrain.test today: the skyline within 0.15° of SRTM in 36 sectors | VERIFIED (geometry) | The look of the far ranges (DEM-smooth) was scored weak in rubric pass 2; winter snow caps impossible (M9) |

### §5.2 Terrain
| # | requirement | where | verified | status | scope gap |
|---|---|---|---|---|---|
| 5.2a | "Build the ground in layers of increasing precision and log every correction in LANDSCAPE.md" | `tools/build_terrain.py` layers 1–5; LANDSCAPE.md | Read | PARTIAL: the pre-modern layer is missing (5.2d) | – |
| 5.2b | "Plain and horizon: Copernicus DEM GLO-30 … N29 E052, N29 E053, N30 E052 and N30 E053 … check tileList.txt" | Six tiles N29–N30 × E051–E053 (D-035) | terrain.test pass today; `data/dem/` absent in this container, so `npm run terrain` cannot be re-run here | VERIFIED (derived files) | – |
| 5.2c | "Bare earth: … strip modern buildings, trees and roads" | D-006 opening/closing r 110 m where slope < 3–6 % | SRTM bias and scatter test pass | PARTIAL: reservoirs and dams not handled (Phase 6+7 review minor 3) | Far-ring reservoirs unchecked |
| 5.2d | "The pre-modern landscape … restore watercourses, remove modern fields and roads, and place ancient mounds." | Not implemented; rivers on OSM courses (C) | B6 blocks CORONA and Schmidt's aerials; the user's 1930s aerial #27 is not used for this | MISSING (logged B6) | M13 |
| 5.2e | "The Terrace and its foot … Georeference by control points, restore ancient ground level, and blend into the DEM through a documented transition." | Laplace infill 90 m band (D-006); platform held below the architecture | terrain.test (the court and plain levels) | PARTIAL: ancient ground level not restored (Q-003); the transition is documented | – |
| 5.2f | "Validate. Spot-check known elevations, and derive all distances and bearings from coordinates." | `tests/terrain.test.ts` | Pass today (7 spot checks plus SRTM and skyline) | VERIFIED | – |
| 5.2g | "Check data/dem/ first … auto-ingest … interim heightfield … NEEDS_FROM_ME.md" | `npm run terrain`; NEEDS_FROM_ME | Read | VERIFIED (records) | – |

### §5.3 Sky, time and weather
| # | requirement | where | verified | status | scope gap |
|---|---|---|---|---|---|
| 5.3a | "A physically based sun and atmosphere for Pārsa's coordinates and date (proleptic Julian calendar, with ΔT handled)." | `sky/ephemeris.ts` (astronomy-engine), `skySystem.ts` (Preetham analytic by day; a spherical-atmosphere model below +10°), `atmosphere.ts` | sky.test: sun within 0.1° of an independent Meeus (pass today); **the JPL Horizons test is skipped** (B2) | PARTIAL: the daytime sky is analytic Preetham (Phase 1 exception) | Proxy reference (Meeus, not Horizons); B43/B44 twilight colour gates fail |
| 5.3b | "Correct moon phase, and stars precessed to the period." | ephemeris; `stars_hyg41_m65.f32`; Milky Way frame | sky.test (moon near new at 1 Nisannu, stars vs astronomy-engine 0.05°, Polaris) pass; `night-moon-fire` render shows the moon (stale) | VERIFIED (node) / PROXY in render | **No eclipse:** the 467 July partial lunar eclipse renders as a full moon (M14) |
| 5.3c | "A full day/night cycle with an adjustable time scale (default: real time), plus date control within the chosen year." | `settings.ts` timeScale 1; the date setting | Read; e2e phase1 (session 1) | BUILT-UNVERIFIED this session | Only the hours of 12 chosen days rendered |
| 5.3d | "climate-driven weather generator for temperature, cloud, wind, humidity, precipitation and dust" | `weather/generator.ts`, `climate.json` | weather.test pass today (±1 °C monthly means, ±20 % precipitation days, 10 seeds) | VERIFIED (node) | – |
| 5.3e | "Calibration. Match modern Shiraz/Marvdasht observations (NOAA GHCN/ISD …). Adjust where there is paleoclimate evidence …, and tier those adjustments." | WMO CLINO 1991–2020 Shiraz via search summaries (B3, B8); adjust −1.5 °C, dust ×0.5 (D-004, C) | Tiered in data | PROXY-ONLY: no station data; the adjustments are not from paleoclimate evidence (C by choice) | – |
| 5.3f | "Reproducible. The weather is seeded, and it can also be set from the settings." | seed; `WeatherOverride` (auto/clear/overcast/rain/storm/snow/dust/mist) | weather.test determinism pass | VERIFIED (node) | 4 of 8 overrides never rendered |
| 5.3g | "volumetric clouds" | `sky/clouds.ts`, cloudLight, cloudCover | Seen in many renders (stale); cover curve calibrated (D-145) | PROXY-ONLY (spring clear days; overcast never rendered) | No overcast or storm render |
| 5.3h | "rain: darkened wet stone, puddles, running drains, mud" | `materials.ts finish()` wet, puddles; `rainShafts.ts` | weather_visible.test (node, forced rain); `rain-columns` render: streaks, the floor's wetness not measured | PARTIAL: **running drains MISSING**; mud only as wet earth darkening | One forced rain day; wetness never measured in a render |
| 5.3i | "snow on the mountain in winter, and on the Terrace and plain when the climate allows, with accumulation and melt" | `weatherState.ts` global bucket; `finish()` snow mask | weather_visible.test (forced snow moment); `snow-terrace` render (stale) | PARTIAL: **no altitude dependence** (M9); melt is one bucket for the whole world | Mountain snow never rendered |
| 5.3j | "wind in plants, cloth, dust and smoke" | trees sway (`trees/render.ts:163`); smoke `windWorld`; dust | Stills only | PARTIAL: **cloth has no wind** (no simulation, D-225); grass and crops unverified | Motion never observed (M3) |
| 5.3k | "haze, morning mist and dust storms" | `aerial.ts` haze and aerosol; mist and dust as haze scalars | Haze in renders (stale); mist and dust never rendered | PARTIAL: mist is not ground fog; dust storm is haze only | M10 |
| 5.3l | "lightning where the climate allows" | `weatherVfx.ts` flash + directional light, Poisson rate from thunder days | Node only | BUILT-UNVERIFIED (no bolt) | Never rendered |
| 5.3m | "Weather also changes behaviour and sound (§9.2, §11)" | sim shelter rules; soundscape | Soak and shadow reviews (node) | out of scope, not audited | – |

### §5.4 Fire, smoke and water
| # | requirement | where | verified | status | scope gap |
|---|---|---|---|---|---|
| 5.4a | "Hearths, bread ovens, kilns, smithies, torches, oil lamps and braziers as real objects, plus attested ritual fire." | `fire.ts` FireKind (torch, brazier, hearth, oven, lamp, kiln, altar); `firePlaces.ts` (Terrace 51); `settlement/build.ts` (town 1,304, forges as hearth fires) | fires_place.test (node); renders of braziers and torches (stale) | PARTIAL: **1 oil lamp in the world**; no village fires; the precinct altar never rendered | Town fires never seen close |
| 5.4b | "each fire is a flickering light source with correct colour temperature, and the only light at night besides the moon and stars" | 12/16 nearest point lights; `fireOcc.ts` (Terrace only) | night-terrace, brazier-close, night-moon-fire renders (stale); B24 resolved on the Terrace | PARTIAL: **town fire light leaks through walls** (M11) | Night in the town never rendered |
| 5.4c | "plumes that drift with the wind, a haze over the town at dusk, and soot staining near fires" | `hearthSmoke.ts`, `landSmoke.ts`, soot in furnish and hearthSmoke | town-smoke-dusk renders: a pale band +10 % Weber; no plume visible (D-220, B49) | PARTIAL | Only calm spring dusks |
| 5.4d | "Moving and still water rendered properly: rivers, canals, cisterns, drains, wells, garden pools and rain run-off." | `waterShade.ts` (advected ripples, sky Fresnel only), `rivers.ts` seasonal level, `settlement/water.ts` | R3 (black water) "fixed and rendered", but no water render on disk | PARTIAL: **no rain run-off, no flowing drains**; the water reflects only sky radiance (no banks or architecture) | No render of water on disk; flood and low water unseen |

### §5.5 The life of the place
| # | requirement | where | verified | status | scope gap |
|---|---|---|---|---|---|
| 5.5a | "Wildlife: birds (including seasonal migrants and raptors), insects and flies, jackals, rats, scavenging dogs, and game in the paradises." | `wildlife.ts`, `fauna.json` (D-054, D-210) | Node; "never rendered in a browser" (D-210) | PARTIAL: no rats, storks or bats; flies heard, not seen | Never rendered |
| 5.5b | "Dirt and wear: dung and animal pens, middens, drainage filth, flies, spilled grain, tanning and dye works, dust on feet and hems, soot. Grime is concentrated where work happens, not smeared evenly everywhere." | middens (settlement.json), hem soil (D-225), traffic-scuffed floors (D-216), dung at the stair foot (D-227) | Node; partially seen | PARTIAL: tanning and dye works not built | Distribution never judged across areas |
| 5.5c | "Transport: carts and wagons, chariots (shown on the reliefs), litters, pack animals with tack and loads, courier way-stations." | D-210 carts, court chariot, donkey strings, way-station | Node only | BUILT-UNVERIFIED: no litters; wheels don't turn; no reins; walk gait only | Never rendered |
| 5.5d | "Food chain: grinding, baking, brewing, wine and dates arriving, slaughter for the royal table, mealtimes, storage jars." | activities (D-142), lint:activity 0 placeholders | Lint; shadow review r10 passed (sim) | PROXY-ONLY (sim and lint; little rendered) | – |
| 5.5e | "Life events: children at play as well as at work, sickness, old age, festivals and offerings. Death practice only as the evidence shows it." | D-209, D-211, D-215 | Node; "never rendered" | BUILT-UNVERIFIED | – |

### §7 Architecture and materials
| # | requirement | where | verified | status | scope gap |
|---|---|---|---|---|---|
| 7a | "Every structure is generated in code from SITE_SPEC.md: column grids, stairs, walls, openings, doors, bases and capitals with true profile curves. No magic numbers." | terrace.ts; the MJ-1 literal test (D-009) | Test exists (not re-run) | VERIFIED (Terrace); the settlement and plain are rule-generated C, not SITE_SPEC | Village and town geometry from rules, not spec |
| 7b | "Stone columns, stairs, and door and window frames." | arch/*, sculpt | Renders (stale) | BUILT | – |
| 7c | "Plastered, painted mud-brick walls." | `mudbrick_painted` (Treasury clay paint, B), mud plaster elsewhere (D-188) | Renders show flat tan planes (court-assembly, hall100-site) | PARTIAL (look fails) | – |
| 7d | "Timber roofs on beams (the timbers named in the inscriptions)." | `ceilings.ts` ("cedar beams" SITE_SPEC) as render-only boxes | apadana-hall-in (stale) | PARTIAL: one timber material, box beams; the named timbers (yakā, cedar) are not differentiated | – |
| 7e | "Double-animal capitals, per building as attested." | site_spec capitals; sculpt SDF protomes | detail.test, sculpt.test; renders | BUILT (C carving) | Identical instanced capitals (M12) |
| 7f | "Figure count, order and placement match the documented programme (e.g. the 23 delegations on the Apadana stairs, in order)." | `relief_figures.ts`, `delegations.json` | reliefs.test ("the programme": registers, ushers, cypresses) | PARTIAL: identifications are "recollections of Walser, NOT SEEN" (D-199); no count test against a published tally | – |
| 7g | "Carving comes from licensed 3D scans where they exist; otherwise from measured drawings and photographs, tiered. It must hold up at arm's length." | procedural heightfield (RELIEF_META placeholder), D-226 self-shadow atlas | Rubric pass 2: "clay cut-outs"; D-226 renders (raking) stale; no undercut | MISSING (scans, NEEDS #10) / placeholder | 927 figures from 357 geometries (M12) |
| 7h | "Paint and gilding follow the pigment evidence and documented traces, applied by zone. Inferred colour is tiered in the data." | `polychromy.json`, polychromy.test | Pass (node) | VERIFIED (data) / look unjudged since D-226 | – |
| 7i | "Polished dark stone where attested. Neither a bleached ruin nor a toy." | `limestone_dark` (N3) | Rubric pass 2 said the Tachara should be glossy near-black | PARTIAL | – |
| 7j | "Calibrated PBR for every surface, built from measured or photographic sources, never generic 'game stone'" | procedural TSL (B7); stone tone from photos (D-230) | calib-24: not photometrically matched (B55); B40 open | PARTIAL: only block tone photo-derived; everything else C | – |
| 7k | "stone, plaster, paint, timber, glazed brick, metals, textiles, skin, hair, earth, water, plants" | materials.ts SURFACES; glazed.ts; humanMaterial; waterShade; trees | detail.test covers only 10 architectural surfaces | PARTIAL / PROXY | Metals, glazed brick and textiles not in any calibration or detail test |
| 7l | "paint has thickness, wear and edge damage" | D-017/D-226 paint film worn on arrises | polychromy.test (worn along arrises) | PARTIAL (node) | – |
| 7m | "surfaces are clean where a working palace was kept clean, and worn where feet, hands and weather wear them" | trafficMap (door-to-door scuff), weathering | Node | BUILT-UNVERIFIED across areas | – |

### §8 Photorealism
| # | requirement | where | verified | status | scope gap |
|---|---|---|---|---|---|
| 8a | "Required outcome: a frame should read as a photograph" (§1) and the §8 outcomes as a whole | – | Rubric pass 2 FAIL; pass 3 never run | **NOT MET** | M1–M4 |
| 8b | "Light: light that bounces realistically, including indoors" | 7 baked probe volumes (year-mean sun, C), SSGI, envmap | Interiors rendered at one hour (day 25 11:00) | PARTIAL: no indoor light model in town, village or garrison rooms; furnishings not baked | One day, one hour, spring |
| 8c | "soft shadows with contact hardening" | PCF (PCFSoft downgraded), CSM ×4 to 600 m, 0.6 m SS contact shadows | None | **MISSING** (M7) | – |
| 8d | "Air: volumetric light and haze" | `aerial.ts`, `airlight.ts` (hall shafts D-156) | Renders (stale) show door haze | PARTIAL / PROXY | Dust and mist air never rendered |
| 8e | "Camera: exposure and eye adaptation like a real camera; filmic tone mapping" | `exposure.ts`, `meter.ts`, AgX; `carryEye` for the entry sequence | exposure.test; the entry sequence renders (stale) | BUILT; PROXY (eye adaptation only across a scripted still sequence) | AgX's slope flattens stone (B40); adaptation in motion never observed |
| 8f | "Image quality: stable anti-aliasing, so fine detail doesn't shimmer" | TRAA; band-limited procedural detail (fwidth) | Node band-limit tests (humans_faces, people_drape, materials comments) | **PROXY-ONLY: no motion test** | M3 |
| 8g | "Interiors: the hypostyle halls are dim, lit from doors, windows and porticoes" | probes, eye adaptation (D-141) | apadana-hall-in ×307, hadish-hall (stale) | PROXY-ONLY | Tachara, Harem, Treasury, Gate halls never rendered |
| 8h | "Photo mode: a progressive path tracer for stills (stretch goal)" | – | – | MISSING (stretch; TASKS [ ]) | – |
| 8i | "Calibration scene. Build a column base, stair flight and doorway in their present-day ruined state. It is test-only and exempt from the blocklist." | Now view + calib-24 (a wall at 100–310 m) | REVIEWS/calib24.md | PARTIAL: wrong objects (M8) | – |
| 8j | "Light it with the sun position of a real, dated, credited photograph of the site." | Photo #24, EXIF 2019-02-08 15:59:34, sun az 238.8° / alt 19.3° | calib24.md | VERIFIED | – |
| 8k | "Match the photo on stone colour, luminance, specular response, shadow softness and ambient occlusion." | – | Ratios recorded, not matched (B55); specular, softness and AO not measured | **MISSING** | – |
| 8l | "Then apply the calibrated setup to the ancient state." | – | "Light values stay C" | **MISSING** | – |
| 8m | "Rubric review. A vision-capable reviewer subagent scores camera-rig screenshots against real photographs with similar light, stone, landscape and dress. Seven categories, 1–5 each." | `handoff/review_briefs.md` (pairs references per moment since D-231) | Pass 2 FAIL (09-25), judged against no site photograph (B6 then); pass 3 not run | PROXY-ONLY (chosen views; D-233 moves it to coverage, not built) | M1, M2 |
| 8n | "Pass: no category below 4." | – | light 2, materials 1, scale 3, detail 2, people 2, weather 1, atmosphere 2 | **FAIL** | – |
| 8o | "Anything scored 'reads as CG' goes on the fix list." | rubric_s7_pass2 fix list; workstreams D-216…D-226 | Merged; "not judged" | BUILT-UNVERIFIED | – |
| 8p | "Luminance: plausible ranges for sky, sunlit stone and shade; no clipping in normal exposure." | `moments-lum.json` stats; exposure.test | Recorded, not asserted (moments.spec asserts only WebGPU validation); apadana-hall-out clips 7.7 %, hadish 1.4 % (door blow-outs) | PROXY-ONLY (no range gate; chosen views) | – |
| 8q | "Detail: minimum texel and triangle density at 1 m." | `tests/detail.test.ts` | 10 architectural surfaces and column lathes | PROXY-ONLY | Town, village, people, cloth, trees, props and reliefs excluded; computed for 1440p at 70° but no image is rendered at that setting |
| 8r | §1.1: "judge them in the §8 rubric review as scenes, not only as images" | the entry sequence with carryEye | Pass 2: "partly lands" (entry only) | PROXY-ONLY (stills) | No moving sequence judged |

---

## What would close the biggest gaps (ordered)
1. Render the current tree before any claim (M1).
2. Make the coverage harness sample the player's camera: 70°, the player's quality, no rigClear, 1440p crops or a
   resolution-scaled measure. It also needs every season, weather and hour at each place over time, a motion clip per
   stratum, and reach to the world's edge or a defined edge (M2–M4).
3. Flag the villages and Tol-e Ajori (M6).
4. Build the missing interiors and give them light (M5).
5. Contact-hardening shadows (M7).
6. An altitude-aware snow line (M9).
7. A repetition metric (M12).
8. Real calibration objects under a raw photograph (M8, NEEDS #13).
9. A discovery backlog (the eclipse and the other items above, M14).
