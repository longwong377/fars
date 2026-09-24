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
- [~] MakeHuman bodies in period dress, crowd pooling (D-090..D-093); impostors, rendering the population beyond the Terrace agents, rendered floors ≥ 300 / ≥ 50 still open (crowd agent D-143 running)
- [x] Every simulated activity has a performance (D-142, session 4): 36 IK work cycles, 32 tools, 32 work objects, 5 animal species; `lint:activity` (0 placeholders) in `lint:all`. Seen only in the lab until the population is drawn (D-143)
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
- [~] Lexicons in five languages (Babylonian, Ionic Greek new), 73 lines, 372 voice clips (D-105..D-109); voices re-rendered (D-185): the machine pitch and contour thresholds met, machine phone recovery not improved, the Babylonian formant voice and the murmur not re-tuned; the §10 human rating (listening test H8) open; bundled lexical sources' licences checked, EWB data removed (D-192)
- [~] Writing on objects (D-179): tablets with wedge relief (text PLACEHOLDER, B18), rolled seals with ARIo seal texts, sealed leather scrolls; carved Old Persian = the CC0 ARIo sign-by-sign edition, 0 differences (D-184; round-2 C1 fixed, round 3 PASS), incised; Elamite and Babylonian in the edition's lines, omissions not carved, restorations tiered C (D-184)
- [ ] Now view (stretch, §14 Phase 8)
- [ ] Photo mode (stretch, §14 Phase 8)
- [~] Music in the world from performers only (quern songs, Ionian masons' songs, court supper/night music with the setting; D-178, lint:music) and audio occlusion (D-178, Q-304): node-tested, unheard in a browser; PLACEHOLDER visuals (no harp model, no playing/singing animation, no court dress); no magus's chant and no herders' pipes (B20)
## Session 4 (ended; HANDOFF.md)
- [x] Interiors adapt (D-141); shadow bias (D-146); dome cover (D-145); detail at 1 m (D-147); block tone (D-148)
- [x] Probe leaks through thin walls (D-152); ground bounce in the hemisphere light (D-153); herb layer (D-154); probe tints above/below (D-158); frame meter (D-159)
- [x] Camera rig: page reuse per world state, photographic lenses, reframed moments, WebGL2 forcing, no aiming dot
- [~] Photoreal triage (REVIEWS/prelim_photoreal_triage.md): merged D-149 plain, D-150 sim, D-151 carving, D-155 faces, D-156 atmosphere, D-157 surfaces — all unrendered at high; crowd D-143 NOT merged (handoff/branches/crowd_D143.bundle)
- [ ] Smoke render (new shaders), crowd bundle merge, soak on the final sim, full high-quality pass (handoff/render_jobs/), §8.2 rubric, independent Phase 3–8 reviews (handoff/review_briefs.md), shadow review round 5 (input generated), bench × 4
## Session 5 (ended; HANDOFF.md)
- [x] Baseline (tsc, vitest, lint:all, bot 97/97); soak on the D-150 code passes all 8 gates
- [x] Smoke renders at test and high on WebGPU; effect-material compile failure fixed (D-174); WebGL2 at test renders
- [~] Indoor aerial perspective and no-rain-under-roofs fixes (D-174): node-tested, unrendered; Hadish floor blotches undiagnosed
- [x] Shadow review round 5 (two reviewers): FAILED; Phase 8 review (two lenses): FAILED
- [~] Crowd merge D-143 (s5_crowd-merge-s5-fixr1.bundle: merged, fixed, reviewed; last fix round WIP)
- [~] Sim round-5 fixes (s5_sim-r5.bundle, WIP) → soak → shadow round 6 on an unseen pick seed
- [~] Phase 8 fixes: layer (s5_p8-layer.bundle, done + WIP tail), carving (s5_p8-carving.bundle, WIP; licence check); music/occlusion and writing on objects not started
- [~] Session 6: writing on objects (D-179, branch p8-writing-s6): seal impressions, tablets, leather, door sealing, F3/layer/lint done; PT text placeholder (B18, NEEDS #15); browser render not looked at
- [ ] Court in full assembly (B12): simulate the court-resident population on the Terrace; moment + soak --court
- [ ] Full high-quality pass (handoff/render_jobs, 050/051 first), §8.2 rubric, Phase 3+4 / 5 / 6+7 reviews; look fix list (plain and Naqsh read as CG)
## Session 6 (ended; HANDOFF.md)
- [x] Merged: crowd at scale (D-143), sim rounds 5–7 (D-175, D-186, D-191, D-193), court in full assembly (D-182), Phase 8 layer/music/occlusion/writing/carving/voices (D-167, D-168, D-176..D-179, D-184, D-185, D-192)
- [x] Phase 8 gate PASSED (review round 3); majors M1, M2, M6 fixed
- [x] Lead render fixes: probe denoise and bake leak (D-180), floor blotches (D-181), G-buffer blending (D-183)
- [x] §8.2 rubric pass 1 (FAIL) → look workstreams merged: bugs and framing (D-187), surfaces and light (D-188), people (D-189), landscape (D-190)
- [~] Phase 5 shadow review: rounds 6 and 7 FAIL; round-7 fixes and year-wide invariants merged (D-191); round 8 input pick 149
- [ ] Render pass 2 (handoff/render_jobs/2*.job) and rubric pass 2; outdoor AO; Phase 3/4, 5, 6/7 reviews; bench; walkthrough e2e
## Phase 9 — Polish, optimisation, FINAL_REPORT.md
