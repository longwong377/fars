# Full-run task list (kept current; [x] = gate-verified, [~] = in progress / partial, [ ] = not started)

## Phase 0 — Lean research bible + preflight
- [x] Preflight: tools, disk, network probe (PREFLIGHT.md)
- [x] NEEDS_FROM_ME.md in first hour
- [x] Independent geometry extractions A and B → diff → SITE_SPEC.md (+ DEM edge check)
- [x] Chronology + date decision → CHRONOLOGY.md, DECISIONS.md
- [x] Terrain/landscape + climate sources → LANDSCAPE.md, CALENDAR_AND_UNITS.md (climate table)
- [x] ANACHRONISM_BLOCKLIST.md, SOURCES.md, OPEN_QUESTIONS.md, SUMMARY.md; stubs for the rest
- [x] Phase 0 independent review → FAIL → fixes → re-review PASS (with logged exceptions)

## Phase 1 — Engine foundation
- [x] Vite + TS + Three.js WebGPURenderer (WebGL2 fallback) scaffold, dev overlay (tiers, memory HUD)
- [x] Subsystem benchmarks (renderer path, instancing, terrain) → DECISIONS.md + budgets in README
- [x] Terrain pipeline: Copernicus GLO-30 ingest → local ENU heightfield, multi-ring; Terrace foot layer
- [x] Terrain spot-check tests
- [x] Sky: sun/moon/stars for date (proleptic Julian, ΔT) via astronomy-engine; physically based atmosphere
- [x] Time + date control; seeded climate-driven weather generator; §13.6 tests (sun 0.1°, monthly ±1°C, precip days ±20%)
- [x] Player: first person, walk/run, step-up, falling, visible body (placeholder flagged)
- [x] Shell: title, click-to-start, pause, settings, controls help
- [x] Save/load (world state + settings); seeded determinism
- [x] Test harness: vitest + Playwright (SwiftShader), camera rig, benchmark mode
## Phase 2 — [x] Terrace greybox from SITE_SPEC via parametric generators; plan overlay + dimension tests (passed with logged exceptions)
## Phase 3 — Vertical slice (plain → Grand Stairway → Gate of All Nations → Apadana), calibration scene, NPCs 50–100
- [~] Materials (procedural TSL, wetness/snow, relief normals), post (SSGI fixed D-012, TRAA/bloom), CSM, eye adaptation — C values, uncalibrated; light probes for interiors (D-110 … D-114) and twilight/exposure (D-115 … D-119) merged; interiors black until adaptation follows indoor light (Q-153)
- [~] Sculpted columns/colossi, carved reliefs, MakeHuman CC0 humans (background agents, session 2)
- [ ] Calibration scene — BLOCKED: no dated photograph reachable (NEEDS #13, B6/B7)
- [x] Reliefs (placeholder silhouettes on the reference layout), inscriptions carved from published texts
- [x] Fire and smoke, weather VFX, lightning; spatial audio + soundscape
- [x] 65 living NPCs: roster, names, schedules, needs, goods, nav grid, bodies, props, animation (D-010)
- [x] Speech + crowd murmur + language lint (D-011); addressing people (E)
- [x] Walkthrough bot over the whole slice (28 legs, pop-in probe, falls, stuck)
- [~] §1.1 moments on the route in the camera rig; rubric review; independent review; performance proxy
## Phase 4 — Rest of Terrace at slice fidelity
- [x] Apply the access patch; stairs, doors, frames, corrected outlines (D-013, D-015); overlay + dimension tests
- [x] Nav grid over the whole Terrace; walkthrough routes validated offline
- [x] Walkthrough e2e over all six areas (session 3, after the step-up fix D-034)
- [ ] Camera-rig views of the new areas at high quality
- [x] Reliefs on the Tachara/Hadish/Tripylon/Harem/Hall-100 stairs and jambs (355 figures), 11 windows, 9 niches, 22 working doors; far relief chunks (draws ~1,000) — D-048..D-052
- [~] XPe (D-066) and stair crenellations (D-065) added; Treasury N range + scribes' room (D-067); Tachara rebuilt from REF-PLAN with side/N rooms and the lance-bearers (D-130..D-134); other furnishings open
- [ ] Phase 4 independent review
## Phase 5 — Population + economy sim in workers, events, memory, persistence, soak test
- [x] Simulation LOD (abstract/full) with non-teleporting promotion; load-time catch-up (persistence)
- [x] Soak harness + gates (`npm run soak`); baseline measured: FAILS variety/events
- [~] Events calendar, town life, rota/post rotation, days off, errands; memory of the player (agent, session 3); construction columns follow the sim (D-062)
- [~] MakeHuman bodies in period dress, crowd pooling (D-090..D-093); impostors, rendering the population beyond the Terrace agents, rendered floors ≥ 300 / ≥ 50 still open
- [~] Soak passes (all eight gates); shadow review FAILED rounds 1–3 (10, 3, 3 of 20 below 4); round-3 fixes merged (D-135 … D-139); round 4 with a new seed (not 7/11/23/37/53/71) next
## Cross-cutting (session 3)
- [x] Player step-up (D-034); offline walkthrough bot `tools/dev/botcheck.ts`; test camera floor fix
- [x] Translation layer e2e (D-036)
- [~] Stone/sculpture/relief look faults (agent): carved-stone material, relief paint, curls, horns, Gate door leaves, collider overlap, dark door frame, Treasury column materials, reliefs on WebGL2
- [x] Human runtime integration merged (D-090..D-093)
- [x] Sky calibrated against the skylight; fog, cloud haze, smoke and rain shafts follow the horizon radiance (D-060)
- [~] Visitor mode (D-063): zones, rules, stop, halmi, escort, errand; e2e queued
- [ ] Clouds render check; `QUALITY=high npm run bench` re-run
- [x] Rebuild the walkable grid after the merges (D-067: rebuilt; doorways under 1.3 m no longer sealed; bots 77 + 28 legs pass offline)
## Phase 6 — Settlement
- [x] Research (SETTLEMENT.md, settlement.json); chronology rows + fail-closed lint (D-033)
- [~] Town, gardens, workshops, Tol-e Ajori, Takht-e Rustam, roads, way-station; house plots for the simulation (agent)
## Phase 7 — Plain and horizon
- [x] Research (PLAIN.md, plain.json); horizon: far ring ±71.7 km + curvature, skyline matches SRTM (D-035)
- [x] Rivers, canals, fields by season, villages, orchards, Naqsh-e Rustam merged (D-037..D-040); DNa/DNb carved (D-061)
- [~] Plain look: dark specks fixed; grey domes fixed (D-121); species trees merged (D-120 … D-123, unrendered at high); NR tomb reliefs carved (D-069), NR cliff look open; dawn vista to re-judge after twilight (D-115 … D-119)
## Phase 8 — Language, speech, music, translation layer, map, Now view, photo mode
- [~] Translation layer: subtitles, inscriptions (transliteration + glosses; translations need NEEDS #14), map (M; Z: town and plain scales), chronicle (J; visitor log)
- [x] Lexicons in five languages (Babylonian, Ionic Greek new), 73 lines, 372 voice clips (D-105..D-109); listening test open (H8)
## Phase 9 — Polish, optimisation, FINAL_REPORT.md
