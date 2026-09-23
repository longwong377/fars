# PROGRESS (problems first)

## Broken / placeholder / weak (read first)
- **Photorealism is not established.** The §8.2 rubric review and the independent Phase 3 and Phase 4 reviews have not run. The §1.1 moments have not been re-rendered at high quality since the session 2 fixes.
- **Calibration scene (§8.1):** blocked (NEEDS #13). Stone and light values are C estimates.
- **People:**
  - On screen they are still the placeholder procedural rigs with abstract faces.
  - D-020 built MakeHuman CC0 bodies, but the runtime does not use them yet. A session 3 agent is integrating them.
- **Speech (D-011):** a placeholder formant synthesiser, not yet rated for intelligibility. The lexicons are thin.
- **Carving (improved in session 3 by the stone agent, D-029 to D-032; still C):**
  - The sculpted columns and colossi (D-018) and the carved reliefs (D-019) are procedural reconstructions of the type, not measured carving (licensed scans: NEEDS #10).
  - Now fixed:
    - joints are 0.8 mm hairlines on a joint-free carved surface;
    - reliefs use mineral pigments as a matte film with wear, though every value is C (Q-074);
    - curls are spiral locks and the horns are longer;
    - the Gate door leaves hang at the inner end and the wall is cut in the parts;
    - the dark door frames are Munsell N3, not black;
    - Treasury members have their own materials;
    - the reliefs are verified on WebGL2.
  - Still weak:
    - the running-bond block layout is uniform (the polygonal retaining walls are not modelled, Q-071);
    - capital curls come out as noisy pits, and the lower LOD shows no curls;
    - volutes are faceted;
    - the lamassu face is rudimentary;
    - the relief colour fields still dominate at register distance;
    - no garment patterns are painted;
    - "gold" is drawn as a yellow paint film;
    - Treasury shafts are bare plaster (the colours are unknown), flagged as a placeholder;
    - the door-leaf position is inferred (Q-073).
- **Phase 5 (session 3; merged, D-021 to D-024):** `npm run soak` PASSES all eight gates for the full year, seed 1, court absent.
  - Variety: all 43,348 people measured, worst 0.099; detailed agents worst 0.031.
  - Events: 13–19 kinds a week against a floor of 8.
  - No stuck agents, stocks bounded, construction advancing every week.
  - The Phase 5 gate is still NOT passed:
    - **Activity coverage FAILS the brief's rule:** 25 simulated activities have no visible performance. They are marked placeholder/abstractOnly and are used only off-Terrace (haul, weave, brew, herd, field work, plough, reap …).
    - **About 550 people on the Terrace by day are simulated but not rendered**, counted as a PLACEHOLDER in the F3 overlay.
    - Construction geometry hook: done (D-062). The hall's columns follow the simulated drums, fluting and capitals (tested, not yet seen in a render); walls, reliefs, the yard and ramps stay at day 0.
    - **Rendered floors (≥ 300 visible, ≥ 50 close) are not met:** the crowd still builds one placeholder rig per detailed agent (135).
    - Newborns under one year (3,104) are reported, not gated (178 would fail in their first days). This is a scope decision in D-021, to be judged by the independent review.
    - **The §13.11 shadow review FAILED:** 10 of 20 people scored below 4 (REVIEWS/shadow_phase5.md). The causes are systemic:
      - heavy workers eat once;
      - plain children who follow their mother never sleep;
      - infants are nursed only at the mother's meals;
      - marriage takes mothers from young children;
      - households are not synchronised and schedules run like clockwork.
      The population agent is fixing them. A fresh independent reviewer will re-run the review.
    - Every day-plan weight is C. The grain deliveries in the read texts cannot feed the ration groups (Q-056). Workers other than guards have no regular rest days (Q-057).
- **Phase 6 (settlement; merged in session 3, D-041 to D-044):**
  - Built: 10 town quarters (maze lanes, courtyard houses, workshops, pens), compounds, gardens, Tol-e Ajori (plan from the 2017 report, B/C), Takht-e Rustam, roads, canal and way-station. It is walkable (131 m lane walk offline) and adds only 17–43 draw calls.
  - Weak or unverified:
    - **The dusk-smoke moment does not land from the Terrace:** the town is a thin band and the haze is barely visible. The slope view meant to show it was never rendered.
    - Several views were not re-rendered after the final fixes, and WebGL2 is untested.
    - Trees and houses are placeholders (boxes and low-poly crowns); street doors never move.
    - Every layout is C: the house type is the Babylonian courtyard analogue (Q-082).
    - **People are not connected to the houses:** the sim still sends them to an off-map "town" point, and there is no NPC walkable grid for the town.
    - The Akhor Rostam niches are not built (Q-085).
- **Phase 7 (plain; merged in session 3, D-037 to D-040):**
  - Built: the Pulvar and Kur carved into the terrain, 37 canals, field plots with a crop calendar, orchards and woodland, 33 villages, tracks, quarries, Naqsh-e Rustam (tombs, Ka'ba, cliff carve). It adds +8 to +21 draw calls and 0.7–0.9 M triangles in the three budget views.
  - **Not seen on screen:** the last three visual fixes (smooth tree crowns, colliders around the test camera, the rugged cliff and crest). The river bank close view and the May, August and January field views have never been judged with a correct camera.
  - Weak:
    - the dawn vista from the Grand Stair reads as a mottled brown-green plain; no trees, villages or rivers can be made out at 960×540;
    - from the Apadana looking north almost none of the plain shows;
    - grey dome shapes at the bases of orchard trees in village P22 (cause not found);
    - the east end of the Naqsh-e Rustam cliff is probably still a sheer slab;
    - the edge of the near-crop radius is visible (18 m test, 30 m high);
    - dark specks on the ground, probably the earth material's stone chips.
  - Placeholders (flagged in F3): the Naqsh-e Rustam and Neo-Elamite relief figures are schematic silhouettes. DNa and DNb now carry their Old Persian text from the CC0 edition (D-061; not yet seen in a render); their Elamite and Babylonian versions are not carved.
  - Every placement is C (Q-076 to Q-080); the rivers follow their modern courses. Qadamgah and the 18 "possible" sites are not built.
  - The out-of-world map now has town and plain scales (Z), drawn from what the world builds (not yet seen in a render).
- **King absent by default (D-003):** no evidence places Xerxes at Persepolis in 467. The court appears only in the C-tier "seasonal pattern" setting.
- **No primary sources reachable (B6):** SITE_SPEC is tier B/C, nothing is A, and the plan overlay compares against OSM, not Schmidt.
- **Sky calibration (D-060, not yet seen in a render):** the sky dome is scaled to the skylight's irradiance, and the fog, far cloud haze and rain shafts converge to the calibrated horizon. This changes the look of every distant view and every daytime sky. The twilight and overcast values rest on the C hemisphere light.
- **Sky and bench:**
  - The Milky Way and airglow are implemented (D-047: position A, structure C) but not yet seen in a render.
  - The volumetric clouds are now seen: drawn behind all geometry (D-046). They read as soft, blurry stratocumulus smears, not crisp cumulus. A texture-based rework was in progress (not yet verified).
  - Bench numbers from session 2, and the first session 3 run, are **void**. Frames rendered outside the animation loop never advanced the node frame, so the scene pass was skipped: 1 draw call and sub-millisecond "frames". Fixed (D-047); a re-run is needed.

## Fixed / verified in session 3 (2026-09-23)
- **Reliefs:** rendered in a browser for the first time. Under WebGPU/SwiftShader, 143 figures were generated by the worker pool (0.82 M triangles at arm's length), with no errors.
- **Step-up (D-034):** Rapier's autostep did not lift the player (measured: 0.24 m head-on, 0.12 m at 60°). The player now has an explicit step-up to `NAV.maxStep` (0.42 m) at any approach angle, covered by a regression test.
- **Walkthroughs:** the bot's waypoint tolerance was tightened. The walkthrough bot now passes all six Phase 4 areas (77 legs, including Hadish) and the Phase 3 slice (28 legs) in the browser, with no falls, pop-ins or errors. `tools/dev/botcheck.ts` runs the same bot offline in seconds.
- **Test camera (D-034):** `view()` and `teleport()` no longer land on roofs. They had landed on top of every roofed space.
- **Translation layer (D-036):** the e2e passes: XPa transliteration and glosses, map, chronicle. Each inscription panel has a pick rectangle.
- **Horizon (D-035, Q-053):** the far terrain ring is now ±71.7 km, with Earth curvature and refraction. The far skyline matches the independent SRTM profile within 0.15° in all 36 sectors, and the missing W/SW/SSE ranges are restored.
- **Phase 6/7 bookkeeping (D-033):** settlement and plain features are in the chronology, and the chronology lint is fail-closed on them. The blocklist is synced (37 entries). Q-047 is decided: the Xerxes tomb is present, façade cut (C).
- **E2E isolation:** each tree runs on its own Vite port (`E2E_PORT`), and no existing server is reused.

## Phase status
| Phase | Status | Gate |
|---|---|---|
| 0 | Research bible. The review failed, was fixed, and passed on re-review (REVIEWS/phase0.md). | **Passed with logged exceptions:** no primary sources (B6); king absent (B9); footprints single-source |
| 1 | Engine foundation: renderer (WebGPU + WebGL2), terrain rings, sky, weather, Rapier player, shell, save/load, overlay, bench, test harness | **Passed with logged exceptions:** real frame rate not measurable (REAL_HARDWARE_TODO); sky is Preetham analytic |
| 2 | Terrace greybox from the parametric generators | **Passed with logged exceptions:** footprints are OSM traces (B6); the overlay mostly checks footprints against themselves |
| 3 | Vertical slice: materials, reliefs, fire, weather VFX, audio, 65 people, speech/murmur, walkthrough bot (28 legs, re-verified session 3) | **Not passed:** rubric and independent review not run; calibration blocked; people placeholder; bench to re-run |
| 4 | Rest of the Terrace: stairs, doors, frames, corrected outlines, floors, fires, acoustics, guard posts; overlay + dimension tests; walkthrough e2e passes all six areas (session 3) | **In progress:** reliefs on the new stairs and jambs, windows and niches, furnishings, people beyond guards, Phase 4 review |
| 5 | Two-tier simulation of 46,590 people: events calendar, town life, rota, construction state, memory, persistence; soak PASSES (session 3); birds and jackals visible (D-054) | **Not passed:** activity coverage (25 placeholders), rendered floors, unrendered Terrace workforce, construction geometry, shadow review pending |
| 6 | Settlement built (session 3): quarters, houses (1,456 homes / 7,830 people), workshops, gardens, Tol-e Ajori, roads; lints pass, layout sourced and tiered (C) | **Gate items met on paper (lints pass; layout sourced and tiered)**; smoke moment and people-to-houses link open |
| 7 | Plain built (session 3): rivers, canals, fields, crop calendar, orchards, villages, quarries, Naqsh-e Rustam; horizon fixed (D-035); +8–21 draws | **Not passed:** last fixes unrendered, dawn vista weak, relief figures and DNa/DNb schematic or textless, review not run |
| 8 | Translation layer built and e2e-verified; speech and murmur from Phase 3 (placeholders) | — |
| 9 | Not started | — |
