# Full-run task list (kept current; [x] = gate-verified, [~] = in progress / partial, [ ] = not started)

## Phase 0 — Lean research bible + preflight
- [x] Preflight: tools, disk, network probe (PREFLIGHT.md)
- [x] NEEDS_FROM_ME.md in first hour
- [~] Independent geometry extractions A and B (research subagents) → diff → SITE_SPEC.md
- [~] Chronology + date decision → CHRONOLOGY.md, DECISIONS.md
- [~] Terrain/landscape + climate sources → LANDSCAPE.md, CALENDAR_AND_UNITS.md (climate table)
- [ ] ANACHRONISM_BLOCKLIST.md, SOURCES.md, OPEN_QUESTIONS.md, SUMMARY.md; stubs for the rest
- [ ] Phase 0 independent review (subagent) → REVIEWS/phase0.md

## Phase 1 — Engine foundation
- [ ] Vite + TS + Three.js WebGPURenderer (WebGL2 fallback) scaffold, dev overlay (tiers, memory HUD)
- [ ] Subsystem benchmarks (renderer path, instancing, terrain) → DECISIONS.md + budgets in README
- [ ] Terrain pipeline: Copernicus GLO-30 ingest → local ENU heightfield, multi-ring; Terrace foot layer
- [ ] Terrain spot-check tests
- [ ] Sky: sun/moon/stars for date (proleptic Julian, ΔT) via astronomy-engine; physically based atmosphere
- [ ] Time + date control; seeded climate-driven weather generator; §13.6 tests (sun 0.1°, monthly ±1°C, precip days ±20%)
- [ ] Player: first person, walk/run, step-up, falling, visible body (placeholder flagged)
- [ ] Shell: title, click-to-start, pause, settings, controls help
- [ ] Save/load (world state + settings); seeded determinism
- [ ] Test harness: vitest + Playwright (SwiftShader), camera rig, benchmark mode
## Phase 2 — Terrace greybox from SITE_SPEC via parametric generators; plan overlay + dimension tests
## Phase 3 — Vertical slice (plain → Grand Stairway → Gate of All Nations → Apadana), calibration scene, NPCs 50–100
## Phase 4 — Rest of Terrace at slice fidelity
## Phase 5 — Population + economy sim in workers, events, memory, persistence, soak test
## Phase 6 — Settlement
## Phase 7 — Plain and horizon
## Phase 8 — Language, speech, music, translation layer, map, Now view, photo mode
## Phase 9 — Polish, optimisation, FINAL_REPORT.md
