# PROGRESS (problems first)

## Broken / placeholder / weak (read first)
- The player body is a PLACEHOLDER figure. Ground colour is procedural (C). No weather is rendered yet except cloud cover, haze and fog (Phase 3).
- The night sky has no Milky Way or airglow. Star brightness is perceptual (C).
- No primary sources reachable (B6). The whole SITE_SPEC is tier B/C; nothing is A. The plan overlay compares against OSM, not Schmidt.
- No evidence places Xerxes at Persepolis in 467, so the king is ABSENT by default (D-003). The court appears only in the C-tier "seasonal pattern" setting.

## Phase status
| Phase | Status | Gate |
|---|---|---|
| 0 | research bible; review FAIL → fixes → re-review PASS (REVIEWS/phase0.md). Logged exceptions: no primary sources (B6); king absent by default (B9); footprints single-source (GEOMETRY_DIFF) | **passed with logged exceptions** |
| 1 | Engine foundation: renderer (WebGPU + WebGL2 fallback, both verified headless), terrain rings (Copernicus, bare-earth, terrace foot), sky/sun/moon/stars (astronomy-engine, HYG with proper motion), seeded weather generator + runtime, Rapier player (walk/run/step-up/fall), placeholder body, shell (title, click-to-start, pause, settings, controls, key remap), save/load, dev overlay, bench mode, Playwright + vitest harness | **passed with logged exceptions**: terrain spot checks 7/7; §13.6 sun 0.041° vs an independent Meeus implementation (Horizons blocked, B2); monthly T within 0.81 °C; wet days 29 vs 29.8. Budgets recorded (README). Exceptions: real frame rate not measurable (REAL_HARDWARE_TODO); sky is Preetham analytic (C for twilight/night); no volumetric clouds, rain or snow rendering yet (Phase 3) |
| 2 | Terrace greybox from parametric generators (src/arch): Terrace platform + stair recess, Grand Stair (111 steps/side), Gate of All Nations, Apadana (72 columns, towers, N/E stairs), Tachara, Hadish, Hall of 100 Columns (under construction), Tripylon (under construction), Treasury, Harem, garrison, E fortification | **passed with logged exceptions**: plan overlay IoU ≥ 0.95 and offset < 0.5 m for all 11 structures on both render paths (rendered, 0.25 m/px) and geometrically; dimension tests 19/19; chronology lint covers generated parts; walk bot climbs the Grand Stair and passes through the Gate. Exceptions: footprints are OSM ruin traces, not Schmidt's plan (B6), and for platform-type buildings the IoU is 1.0 by construction (platform = footprint), so only the Grand Stair (0.962), Gate (0.952) and Hall of 100 Columns (0.997) test generator geometry non-trivially |
| 3–9 | not started | — |
