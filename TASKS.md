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
- [~] Materials (procedural TSL, wetness/snow, relief normals), post (SSGI fixed D-012, TRAA/bloom), CSM, eye adaptation — C values, uncalibrated
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
- [ ] Walkthrough e2e over all six areas; camera-rig views of the new areas at high quality
- [ ] Reliefs on the Tachara/Hadish/Tripylon stairs and door jambs (after the relief agent); windows, niches, furnishings
- [ ] Phase 4 independent review
## Phase 5 — Population + economy sim in workers, events, memory, persistence, soak test
## Phase 6 — Settlement
## Phase 7 — Plain and horizon
## Phase 8 — Language, speech, music, translation layer, map, Now view, photo mode
## Phase 9 — Polish, optimisation, FINAL_REPORT.md
