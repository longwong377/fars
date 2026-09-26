# Audit D: engine, language, sound, licences and verification (brief §6, §10, §11, §12, §13), requirements traceability

- **Auditor:** an independent auditor subagent (Claude Opus 5.5). I did not see the build process.
- **Date:** 2026-09-26. **Tree:** branch `claude/amazing-fermi-40ds7j`, HEAD b8afeac at the start, a8cba80 at the end (records
  only in between: audit B, USER_DIRECTIONS UD-14, MASTER_PLAN rev 1). No source or record file edited.
- **Scope:** every requirement sentence of §6 Engine, §10 Language and writing, §11 Sound and music, §12 Licences, ethics and
  blocklist, §13 Verification, read against the user's later directions UD-06 … UD-14 (USER_DIRECTIONS.md), D-233 and D-236.
- **Read:** PERSEPOLIS_BRIEF.md (all), CLAUDE.md, USER_DIRECTIONS.md, PROGRESS.md (problems, phase table, sessions 3–8),
  README.md (budgets), REAL_HARDWARE_TODO.md, BLOCKERS.md, HANDOFF.md, TASKS.md, ASSET_LEDGER.md, DECISIONS D-001, D-007 … D-009,
  D-143 (player collisions), D-233, D-236; REVIEWS/phase5.md; the heads of audits A, B and C; the source of src/main.ts (save,
  restore, simStep, bench), src/world/world.ts (simulate, murmur, colliders), src/world/bench.ts, src/player/*.ts,
  src/audio/*.ts (engine, soundscape, murmur), src/core/save.ts, src/ui/shell.ts, tools/dev/botcheck.ts, tools/build_nav.ts,
  tests/e2e/{walkthrough,walkthrough_terrace,audio,phase1,bench,plan}.spec.ts, tests/sky.horizons.test.ts.
- **Run by me (on the current tree, 4 shared cores, load 4–6 from other auditors and a render):**
  | what | result |
  |---|---|
  | `npx tsc --noEmit -p .` | clean |
  | `npm run lint:all` | OK: chrono (78 structures, **0 registered assets**, 2,709 parts, 98 blocklist terms), lang 26/26, activity 65 / 0 placeholders, music 21 claims |
  | `npx vitest run` sky.horizons, weather, physics, audio, sky, arch, occlusion, music `--maxWorkers=1` | 78 passed, **1 skipped (the JPL Horizons test: no data)** |
  | `npx tsx tools/dev/botcheck.ts` and `… slice` (offline walkthrough bot) | 97/97 legs, 0 falls (6 Phase 4 areas + the slice) |
  | `npx vite build --outDir <scratchpad>` | builds; dist 39 MB (main JS 7.3 MB, 2.40 MB gzipped; generated data 28 MB; voices 2.4 MB) |
  | probe: physics collider vs rendered terrain, and walking across the terrain-ring collider edges (node, the same Physics, Player and Terrain classes and the same call order as `main.ts simStep`) | **the player falls through the ground at the near-ring edge on the mountain: 12 of 24 crossings** (see M1) |
  | probe: 1,324 random walkable targets on the Terrace top, reached with the player controller over the nav grid's route (offline, Terrace colliders only) | 1,317 reached, 5 stuck, 2 no route, 0 falls > 0.6 m |
  | probe: share of the walkable nav grid within 5 m of any walkthrough-bot route | Terrace top 13.4 % of 10.2 ha; whole nav grid 4.5 % of 35.4 ha; everything outside the nav grid 0 % |
  | probe: save size (`PeopleSim.save()`, court absent / resident) | 0.03 MB both (135 detailed agents; the other 46,775 / 76,103 are regenerated from seed and time) |
  | probe: where the 135 detailed agents are (day 25 11:00) | all inside e −53 … 216, n −126 … 134 (the Terrace) |
  Probe scripts: `/tmp/claude-0/-home-user-fars/ac6caaff-37cb-51fc-aea7-1f0f1d8e5ae0/scratchpad/auditD/*.mts` (scratch, not
  committed; the key one is reproduced in the appendix).
- **Not run:** Playwright (by instruction), the full vitest suite, the soak.

---

## 1. MAJOR MISSES, ranked (worst first)

### M1. The player falls through the world where the terrain collider changes ring, on the mountain. No test or bot goes there.
- **What happens.** `Physics.updateTerrain` (src/player/physics.ts:25-29) keeps ONE heightfield collider: the near ring (4 m
  cells) while the player is within 2,048 − 64 = 1,984 m of the origin on both axes, the mid ring (16 m) out to 9,984 m, then the
  far ring (80 m). The rendered height (`Terrain.heightAt`, src/terrain/heightfield.ts:48-51) switches with different margins
  (near to 2,040 m, mid to 10,208 m). On steep ground the coarser ring's surface lies above the player's feet when it is swapped
  in, the capsule ends up under a one-sided heightfield, and falls without end. Nothing rescues it (no ground check in
  `simStep`, src/main.ts:308-321).
- **Measured** (node; same classes and call order as `simStep`; walking at 1.35 m/s):
  | crossing | fell through the ground |
  |---|---|
  | east edge outward (e = 1,984, Kuh-e Rahmat), 24 lines 160 m apart | **12 of 24** (13 of 24 with update-then-swap order) |
  | east edge inward (coming down off the mountain) | 4 of 16 |
  | north edge outward | 3 of 16 |
  | west and south edges (the plain) | 0 of 16 each |
  | mid → far edge (e = 9,984) | 0 of 16 (but collider vs rendered height differs by up to 5.97 m there) |
  Collider vs rendered height, 200 samples per band: 0–1,900 m worst 0.02 m; **1,984–2,040 m worst 2.56 m**; 2,100–9,900 m
  worst 0.47 m (feet visibly sinking or floating on slopes); 9,984–10,200 m worst 5.97 m; 10–30 km worst 4.31 m.
- **Why it was missed.** tests/physics.test.ts samples collider vs render only within ±1,500 m; the walkthrough bots (M2) never
  leave the Terrace. The places beyond the edge include Tol-e Ajori (2.4 km), Bagh-e Firuzi (3.3 km), Takht-e Rustam (4.1 km),
  Dasht-e Gohar (4.6 km), the roads to Naqsh-e Rustam and Pasargadae, and all of Kuh-e Rahmat above ~2 km.
- **Status:** BROKEN; never tested. Against UD-06 ("nowhere I go takes me out of the illusion") this is the worst kind of miss.

### M2. "Automated routes through every walkable area" (§13.8) cover one sliver of the world, and the browser runs are three sessions stale
- **Routes:** the Phase 3 slice (28 legs) and six Terrace areas (tachara, hadish, tripylon, hall100, treasury, harem; 69 legs).
  Nothing in the town (1,456 houses, lanes, workshops, gardens), the sacred precinct, the burial ground, Tol-e Ajori, the camps,
  the plain, rivers and canals, villages, Naqsh-e Rustam, Kuh-e Rahmat, the Apadana E stair, the fortification. The nav grid
  itself covers only the Terrace and 480 m of plain (e −620 … 262, n −245 … 185; 35.4 ha).
- **Measured coverage:** 13.4 % of the Terrace top's walkable area lies within 5 m of a bot route; 0 % of everything else.
- **In the browser:** last passed in **session 3 (2026-09-23)**, before the population view (D-143), the court, the palace
  furnishings' colliders (D-212), the inscription solids and cistern kerbs (D-214), the doors' crowd opening, and every later
  geometry change (HANDOFF: "walkthrough e2e (18x) not re-run"). The offline bot (run today, 97/97) builds only the Terrace
  colliders: no people, furnishings, waterworks, inscription solids, doors or town/plain colliders, so it is not the same world.
- **Pop-in probe covers people only** (`crowd.onPopIn`, src/people/crowd.ts:402). Trees, relief LOD swaps, town and village
  meshes, furnishings, props and animals are not watched, although §13.8 says "objects popping in within 50 m".
- **Good news (offline):** 1,317 of 1,324 random Terrace targets reached with the real controller (5 stuck at the Apadana N
  portico, S of the Tripylon and near (160, −65); 2 no route); no fall. But random targets in the nav grid's strip on the
  mountain E and N of the Terrace were unreachable for the player (the grid's step rule marks slopes walkable that the
  controller's 42° limit does not climb): NPCs can be routed where the player cannot follow.
- **Status:** PARTIAL (Terrace, offline, no people); SCOPE-GAP everywhere else.

### M3. There is no evidence at all that the game runs at 60 fps at 1440p, within memory, or loads in reasonable time; and the benchmark that would show it measures the wrong thing
- **The benchmark has never produced a valid report.** Session 2's numbers are void (D-047); no run since. There is no
  bench-*.json anywhere on the disk; `bench-reports/*.json` is gitignored, so even a run would leave no committed evidence.
- **The benchmark excludes the simulation.** `api.view()` sets `freeCam` (src/main.ts:175-177), and `simStep` returns at
  `if (freeCam) return;` (l. 310) before physics, `world.simulate` (the population step, doors, simulation LOD, collider sync).
  A user running `?bench=all` on an RTX 3070 gets a frame time with the main-thread simulation left out. Its four routes
  (approach, a Kuh-e Rahmat vista, a Terrace loop, the palaces; 20–40 s each, spring day 0/25) include no town lane, no walk on
  the plain, no court assembly (the heaviest scenes, B13), no night, rain, dust or smoke, and no ×60 time scale.
- **The proxies cannot see the likely bottleneck.** README's proxies are draw calls and triangles (session 7, at `high`, three
  views). The renderer's per-pixel work at 1440p (SSGI + TRAA, volumetric clouds at 32–48 steps × 4–5 light steps, probe
  lookups of 10 fetches × 7 volumes in every lit fragment, the relief-shadow march D-226, SSR, SSS, the smoke layer, fog) is
  invisible to both. Even the triangle proxy fails in 3 of 7 busiest views (B13: 13.51, 12.52, 12.64 M against 12 M) and the
  court views have no browser count since session 6 (Phase 5 review C1).
- **Memory:** "JS heap ~125 MB after boot (Phase 1); not re-measured with the full population" (README). GPU memory is "tracked
  via renderer.info.memory counts": no byte figure exists against the 3.5 GB budget (the relief-shadow atlas alone is 43 MiB of
  GPU and as much heap, D-226). The memory HUD shows `performance.memory` (Chrome-only JS heap) and object counts.
- **Load time** has no budget (README sets download size only: 39 MB measured today against 60 MB). The only measurements are
  SwiftShader page loads: 35 s idle, 244 s under contention (CLAUDE.md, session 8). The world (town, outfits for every body
  variant, trees, reliefs, the relief-shadow atlas at ~8 s of worker time) is generated at load.
- **REAL_HARDWARE_TODO.md is stale:** last edited 2026-09-24; its newest item cites D-185. None of the session 6–8 GPU features
  (SSS D-188, fire-light shadows D-222, rain shafts and cell shadow D-219, smoke layer D-220, relief-shadow atlas D-226, the
  masonry shaders D-230/D-232) has an entry, although §6 says each performance gate "leaves an entry".
- **Status:** PROXY-ONLY with blind proxies; the one instrument meant for real hardware is incomplete.

### M4. The engine cannot yet carry a "true sprawling simulation" (UD-07): the simulation is on the main thread and the world's state is 135 agents
- §6: "NPCs, animals and the economy run in Web Workers." `PeopleSim` is built and stepped in `world.ts:184, 324-337` on the
  main thread (Phase 5 review M3; D-001's "can move into a worker in Phase 5" never happened; no BLOCKERS entry).
- Measured step cost (Phase 5 review, soak): ×1 max 73–84 ms (4–5 dropped frames at a day rollover); ×60 mean 15.9–17.6 ms, p99
  359–497 ms, max 665–675 ms. The settings offer ×600 (shell.ts); never measured.
- Only 135 detailed agents walk real routes (all on the Terrace); the other 46,775 (76,103 with the court) are deterministic day
  plans looked up from (seed, day). The save is 0.03 MB because nothing else holds state. That makes "the world keeps running
  while you're away" a replay of a schedule, and the town's cause and effect a calendar, not a simulation (see audit C M-8).
- **Status:** MISSING (workers); PROXY-ONLY (the soak's headless step times stand in for frame cost).

### M5. Nobody has ever heard the world, and no check can hear it
- The only browser audio test (tests/e2e/audio.spec.ts) calls `audioUnlock()` directly (not the click-to-start) and asserts
  `ctx === 'running'` and three reverb-space ids. It records nothing. No test renders the mix (e.g. an OfflineAudioContext
  capture or a MediaRecorder tap), measures loudness, clipping, layer balance or repetition, or checks that a source is
  audible where it is placed.
- Unheard, per PROGRESS: the soundscape, the 372 voice clips (H8 open since session 3; B17b), the 11 Babylonian formant lines,
  the murmur, all music and the magus's wordless chant (D-209), occlusion (D-178), the D-210 animal voices.
- There is no master limiter or compressor (src/audio/engine.ts:18-28); dense scenes can clip. Node tests cover pieces
  (Sabine RT60, instrument pitch, "renders without clipping" for one music piece), never the sum.
- **Status:** BUILT-UNVERIFIED throughout §11; the §10 voice acceptance (a reviewer rates intelligibility and naturalness) is NOT
  MET (machine measures only).

### M6. Outside the Terrace nobody makes a human sound
- `murmur.update` and the scripted `conversations.update` take their speakers from `sim.agents` only (world.ts:456-468): the 135
  detailed agents, all on the Terrace (probe: e −53 … 216, n −126 … 134). The population view's people (the town's 7,830, the
  plain's, the camps', the court's thousands) can strike tools, bleat and bark through `crowd.onHit`, but `'murmur'` is a
  layer, not a strike kind: an eating or talking townsperson is silent.
- So the lanes, the market, the villages, the court assembly and the camps have no voices, no murmur and no conversations
  (audit C M-3 reaches the same conclusion from the people side). "Crowds in period languages" (§11) and "distant voices"
  (§1.1) exist on the Terrace slice only.
- The murmur is also capped at 10 voices within 40 m: a court assembly of thousands would sound like ten people; there is no
  distant crowd bed.
- **Status:** SCOPE-GAP (Terrace only).

### M7. Cloned and looping sounds everywhere (UD-08 "nothing copy pasted", UD-09 "not repetitive")
- **One noise for everything.** `AudioEngine.noiseBuffer` starts its generator from the constant seed 987654 on every call
  (engine.ts:97-103). So every footstep on a given surface is sample-identical (0.12 s, fixed filter and gain per surface:
  soundscape.ts:250-255); every fire's crackle bed is the same 3 s pink loop (l. 287), so two fires near each other play
  correlated copies (comb filtering); every crackle transient, chisel, hoe and quern burst starts from the same samples.
- **Short loops:** wind a 6 s pink loop, rain a 5 s white loop, the column whistle a 4 s loop (l. 210-218). Repetition in
  frozen noise at these periods is learnable by listeners (C: recollection of the psychoacoustics literature, not checked).
- **Voices:** 62 recorded lines × 6 voice classes = 372 clips for the whole population: Elamite (the everyday language of the
  staff) 12 lines, Old Persian 12, Aramaic 22, Greek 16; Babylonian 11 lines by the formant synthesiser. Every man of one voice
  class in a language has the same voice.
- **Murmur:** a pool of at most 6 pseudo-phrases per (language, voice class), rendered once and reused for the whole session
  (murmur.ts:147-155), with ±2 % rate jitter. Egyptian, Lydian and every other language without a lexicon falls back to
  "Aramaic rhythm" (`murmurLangFor`).
- **Birds** are sine sweeps (`chirp`: one sine oscillator); several calls have fixed pitches and timing (hoopoe three identical
  480→450 Hz notes; see-see partridge 1,500→1,900 Hz; house sparrow 3,000→2,600 Hz), i.e. the same call every time.
- **Status:** MISSING against UD-08/UD-09; no repetition metric exists (MASTER_PLAN axis G now names one).

### M8. Every new game is the same world; the court is still absent by default
- The seed is `?seed` or 1 (main.ts:45). The title screen offers "Continue saved visit" or a start; there is no "new world"
  seed, and no seed in Settings (D-236 and UD-09 require a new seed per game, shown, and reproducible). MISSING.
- The court is read once at boot from `settings.courtCalendar` (default `'evidence'`, settings.ts:21) and passed to the
  `PeopleSim` constructor; UD-10 (the court comes and goes by default, in real time, with arrival and departure as witnessed
  events) is not built: court.ts says "no procession is staged". And with the court on, the soak's plansWellFormed gate fails
  (Phase 5 review C1), so making it the default makes a failing gate the default (audit A M6).

### M9. Persistence works only if the player remembers to press Save; the browser round trip is old and shallow
- `save()` is called only from the pause menu's Save button (shell.ts:58); there is no autosave and no save on
  `beforeunload`/`visibilitychange` (grep: none). Close the tab and the world, the memory of the player and the catch-up are
  lost. §9.5 "The world keeps running while you're away. On load, a fast catch-up" therefore needs a manual save first.
- The browser round trip (tests/e2e/phase1.spec.ts l. 33-39) asserts clock, weather override and player position only, not NPC
  state, memory, doors or the visitor; its last recorded run is sessions 1–3 (REVIEWS/phase1-2.md MJ-5, D-009). The NPC part is
  node-tested (people.test.ts, population.test.ts). The catch-up is capped at 30 days (older time "placed by schedule").
- Settings persist separately (localStorage); the save is tiny (0.03 MB), so storage quota is not a risk.
- **Status:** PARTIAL.

### M10. Most §13 checks have not run on the current tree, and two never ran at the scope they name
| §13 check | last run | on the current tree? |
|---|---|---|
| full `npm test` | session-8 baseline: 923 passed, **12 failed** (11 timeouts or CPU budgets "not yet re-run alone"), before the D-218 … D-232 merges | **no** |
| `npm run test:e2e` as a suite | never as a whole; walkthrough, audio, visitor, translation, phase1 (save/load) and plan specs last in sessions 1–3 | **no** |
| `npm run soak` | 2026-09-25 20:02, court absent, 8/8 gates; sim.ts changed at 20:41 (S1 fix, 02d254c); the court soak fails plansWellFormed | **no** |
| §13.6 sun vs JPL Horizons | `tests/sky.horizons.test.ts` is **skipped** (no data/horizons/sun.csv; B2): the sun is checked only against astronomy-engine, the library that computes it | never |
| §13.1 independent digitising of Schmidt | never: both extractions came from web-search summaries (B6); the independent check is the DEM edge | never at the named scope |
| §13.2 plan overlay | node arch.test passes today, against OSM footprints the geometry was built from (self-reference, B6) | yes, but circular |
| §13.9 independent reviews | Phase 5 (session 8) FAIL; Phases 3+4 and 6+7 never | partly |
| WebGL2 fallback "tested separately" | last WebGL2 render at test quality, session 5; at high it times out | **no** |
- `lint:all` and tsc are current (run today: OK). The CPU-timing tests are waived "under load" session after session and no
  idle-box re-run is recorded for the current tree.

### M11. "The build fails on any modern-language text or audio" is not true: the lint is not in the build
- `npm run build` = `tsc --noEmit && vite build` (package.json). `lint:lang` is a separate vitest file; there is no CI
  (`.github/` absent) and no pre-commit hook. A modern-language string or clip can ship in a build. The lint itself passes
  (26/26 today) and covers audio, data and carved signs (D-167). **Status:** PARTIAL (check exists, gate does not).
- Similarly, the chronology lint reports "0 registered assets": its asset branch (period, source and tier on every asset,
  §13.5) checks nothing; ASSET_LEDGER.md has no completeness test.

### M12. Clipping: animals are not solid, and only the 48 nearest people are
- world.ts:229-235: "48 capsules follow the nearest of them within 20 m … Their animals are not solid (C)". §6 asks for
  "player collision with crowds and animals": the player walks through sheep, oxen, donkeys, camels and dogs. Some tree species
  have no trunk collider by design (plain/index.ts:47). In a packed court, only the 48 nearest people collide.
- **Status:** PARTIAL.

### M13. The acoustics stop at the Terrace
- Occlusion rasterises only the Terrace's architecture: "the town's and the plain's buildings are not in the field (C)"
  (occlusion.ts:7). Reverb spaces are open air, one portico and the Terrace's roofed halls: town rooms, courtyards, lanes,
  workshops, Tol-e Ajori, the Naqsh cliff (echo) and the mountain have none. Rain is one high-passed noise loop (not "on stone,
  timber and cloth"); footsteps have three surfaces (stone, earth, plaster: no mud, wet stone, snow, gravel, timber, water);
  there is no continuous water sound for rivers or canals (only a 'water' strike). **Status:** PARTIAL / SCOPE-GAP.

### M14. Streaming and compression do not exist
- "texture and building streaming with LOD chains; compressed meshes and textures (e.g. Meshopt, KTX2)": nothing is streamed
  (README: "nothing is streamed yet"), no KTX2 or Meshopt at runtime (meshoptimizer is used only to simplify LODs at build),
  terrain GPU displacement deferred to Phase 9 (D-008). At 39 MB this does not hurt today; it caps how far the world can grow.
  **Status:** MISSING (logged only as deferral, no BLOCKERS row).

### Smaller findings
- **Determinism:** 11 `Math.random()` calls in fauna.ts, crowd.ts and soundscape.ts (dog barks, cock crows, bleats, fire gain)
  break "one seed drives all randomness" for sound timing (not for the simulation).
- **Stale or thin records:** BLOCKERS has no row for the sim-on-main-thread, the bench, streaming, the ring edge or the walk
  scope; B5 ("No GPU") is the only performance row. TASKS still ticks "[x] Save/load (world state + settings)" and "[x] Walkthrough
  e2e over all six areas (session 3 …)" as gate-verified.
- **Language coverage:** "craftsmen and delegations: their own languages (Ionian Greek, Lydian, Egyptian)": only Greek has
  lines and a lexicon; Lydian, Egyptian and the delegations' languages fall back to Aramaic murmur.

---

## 2. The user's later directions, read for this scope

| direction | what it asks of the engine and sound | state |
|---|---|---|
| UD-06 "nowhere I go takes me out of the illusion" | every walkable place walkable: no fall-through, no stuck, no invisible walls | **fails**: M1 (fall-through on the mountain), M2 (no walk coverage outside the Terrace), nav/controller mismatch on slopes |
| UD-07 "a true sprawling simulation/sandbox" | the simulation carried by the engine at scale | main thread (M4); 135 stateful agents; bench excludes the sim (M3); memory and load unmeasured |
| UD-08 "nothing copy pasted" | no cloned sounds or voices | cloned noise, 6-phrase murmur pools, 12 Elamite lines × 6 voices, fixed bird calls (M7) |
| UD-09 "all in real time … not repetitive … some sort of seed element" | a new seed per new game, reproducible; live events | seed fixed at 1 (M8); events are scheduled from (seed, day); ambience loops of 3–6 s (M7) |
| UD-10 the court comes and goes by default | a runtime court, arriving and leaving | boot-time setting, default absent, no procession, court soak fails (M8) |
| UD-11 "a world full of surprises" | the unscheduled, heard as well as seen | sound events are scheduled or Poisson per species; nothing unscripted in audio |
| UD-12 scope preserved | a ledger that can't shrink | MASTER_PLAN.md and tests/scope_ledger.test.ts landed during this audit (a8cba80); not checked by me |
| UD-14 extrapolate every gap | acoustic life of the town and plain | M6, M13: the town and plain have no voices, no occlusion, no rooms |
| D-233 every inch | coverage everywhere | the coverage idea is visual only; walk coverage and audio coverage absent (M2, M5) |
| D-236 never the same twice | scene-level variety; new seed | no audio variety measure; no new seed (M7, M8) |

---

## 3. Traceability table

Status: VERIFIED (measured on the current tree or recently, at the named scope) · BUILT-UNVERIFIED · PARTIAL · MISSING ·
PROXY-ONLY · BROKEN · SCOPE-GAP (verified in part of the world only). "node" = measured in node/vitest, never in a browser.

### §6 Engine

| # | Requirement (quoted) | Where | Verification, latest evidence | Status |
|---|---|---|---|---|
| 6.0 | "For every subsystem, choose a technique, justify it in DECISIONS.md and benchmark it in Phase 1" | D-001, D-007, D-008 | subsystem micro-bench on SwiftShader shows no draw-call signal (H2); GPU cost never benchmarked | PROXY-ONLY |
| 6.1 | "WebGPURenderer with TSL materials" | src/render, main.ts:65 | every render session 3–8 (SwiftShader) | VERIFIED (software) |
| 6.2 | "GPU instancing and culling" | InstancedMesh/BatchedMesh per element; frustum culling | draw calls 408–671 (README, B13) | VERIFIED (proxy) |
| 6.3 | "a LOD system that holds carved detail up close and scales to the horizon" | relief LODs (D-049, D-217), terrain chunk LOD (D-046), human LOD bands | relief budgets (bench-reports/relief_budget_*.txt), terrain LOD test; popping on hardware = H4 | PARTIAL (no object pop-in probe, M2) |
| 6.4 | "high-quality shadows" | CSM + PCF; relief shadow atlas (D-226); fire shadows (D-222) | contact hardening missing (audit B M7) | PARTIAL |
| 6.5 | "A WebGL2 fallback path, tested separately" | forceWebGL; log-depth path | last WebGL2 render session 5 at test quality; high times out | PARTIAL (stale) |
| 6.6 | "terrain with GPU displacement" | CPU chunk LOD instead (D-008, deferred) | — | MISSING (deferred) |
| 6.7 | "texture and building streaming with LOD chains" | none ("nothing is streamed yet") | — | MISSING (M14) |
| 6.8 | "compressed meshes and textures (e.g. Meshopt, KTX2)" | none at runtime | — | MISSING (M14) |
| 6.9 | "strict memory budgets against browser tab limits" | README: heap ≤ 1.5 GB, GPU ≤ 3.5 GB | heap 125 MB Phase 1 only; GPU bytes never measured | PROXY-ONLY / unmeasured (M3) |
| 6.10 | "a memory HUD in dev builds" | overlay.ts:12, 27 (JS heap, Chrome only; object counts) | — | PARTIAL (no GPU bytes) |
| 6.11 | "Characters: full detail near the player; cheaper animated crowds mid-range; impostors far away" | D-143 crowd, impostors | browser census session 7 (B11); frozen far workers (audit C M-4) | PARTIAL |
| 6.12 | "VFX: fire, smoke, dust, rain, snow, insects" | fire, smoke layer, rain shafts, snow, flies (audio only) | fire and smoke rendered s8; dust never rendered; rain curtains unverified; snow does not lie; insects not seen | PARTIAL |
| 6.13 | "NPCs, animals and the economy run in Web Workers, with simulation LOD" | sim on the main thread (world.ts:184); LOD radius yes | Phase 5 review M3; soak step times | **MISSING** (workers) (M4) |
| 6.14 | "If SharedArrayBuffer is used, the host must send COOP/COEP headers" | not used; public/_headers sets them | — | VERIFIED (n/a) |
| 6.15 | "navmesh and crowd steering (e.g. a Recast/Detour WASM build)" | 0.5 m walkable grid + A* (NavGrid), popgeo steering; Recast not used | people.test, botcheck | PARTIAL (Terrace + 480 m of plain only; slopes marked walkable the player can't climb) |
| 6.16 | "a WASM physics engine (e.g. Rapier)" | @dimforge/rapier3d-compat | physics.test (3 tests pass today) | VERIFIED (node) |
| 6.17 | "player collision with crowds and animals" | 48 kinematic capsules + 135 agent capsules | not tested in a browser since session 3; animals not solid | PARTIAL (M12) |
| 6.18 | "one seed drives all randomness" | Rng(seed, stream) | weather.test determinism; 11 Math.random in sound/fauna | PARTIAL |
| 6.19 | "save/load covers world state (time, weather, NPC state) and settings" | core/save.ts, main.ts:125-145, sim.save() | node round trips (people, population, visitor); browser e2e session 1–3, clock/weather/player only | PARTIAL (M9) |
| 6.20 | "tests freeze the seed, time, weather and NPC state so comparisons are meaningful" | `?test` (clock.scale 0, frozen world) | camera rig and bots use it | VERIFIED |
| 6.21 | "Body: visible, in period dress, with a shadow" | player/body.ts (Median riding dress, D-093) | no recorded render of the player's own body and shadow in the current tree | BUILT-UNVERIFIED |
| 6.22 | "walk and run" | player.ts: 1.35 / 3.2 m/s | physics.test (walk pace) | VERIFIED (node) |
| 6.23 | "correct step-up for the Terrace's shallow stairs" | explicit step-up to 0.42 m (D-034) | physics.test; botcheck 97/97 today | VERIFIED (node, Terrace) |
| 6.24 | "you can fall off the Terrace edge" | falling tracked (maxFall) | no deliberate edge-fall test | BUILT-UNVERIFIED |
| 6.25 | "no flying or clipping" | capsule controller | **falls through the ground at the near-ring edge on the mountain (12/24)**; walks through animals | **BROKEN** (M1, M12) |
| 6.26 | "title and loading screens; a click-to-start that unlocks audio" | ui/shell.ts; hooks.start → audio.unlock | audio.spec calls audioUnlock() directly, not the click | BUILT-UNVERIFIED |
| 6.27 | "pause menu, controls help, a sensible spawn point on the approach from the plain" | shell.ts; spawn (−175, 122) W of the stair | phase1.spec (old) | BUILT (old e2e) |
| 6.28 | "no in-world HUD" | overlay only on F3 | lint/visual | VERIFIED |
| 6.29 | "Settings: quality, time, date, weather, player mode, translation layer, field of view, head-bob off, key remapping, per-channel volume, subtitle size, a lightning-flash warning, and colour-blind-safe UI" | shell.ts:90-120 (all present, plus court calendar, Now view, time scale to ×600) | no e2e of the settings panel since session 3 | BUILT-UNVERIFIED (no world seed setting: M8) |
| 6.30 | "procedural generation from the spec; headless Blender (bpy) for asset processing; licensed scans, base meshes and motion capture" | procedural from SITE_SPEC; MakeHuman CC0 base mesh; no Blender, no scans (B7), no mocap (IK cycles) | lints, arch tests | PARTIAL (by blocker) |
| 6.31 | "npm run dev for local play" | vite | — | VERIFIED |
| 6.32 | "a production build as a static site … on a host that can set COOP/COEP headers" | vite build; public/_headers | builds today (39 MB); never deployed | BUILT-UNVERIFIED |
| 6.33 | "budgets: first playable load and total download size, set in Phase 1 and documented in README.md" | README table | download 39 MB (today) ≤ 60 MB; **no load-time budget** | PARTIAL (M3) |
| 6.34 | "large binaries are kept out of git history" | .gitignore (data/dem, *.bin) | — | VERIFIED |
| 6.35 | "a benchmark mode that flies set routes and writes a report file" | world/bench.ts, bench.spec.ts | never a valid report; excludes the sim step; 4 routes, none in town, plain walk, court, night, rain | **PARTIAL / never produced** (M3) |
| 6.36 | "Correctness and visual checks run in headless Chromium with software rendering (SwiftShader) at a low-resolution test profile, with timeouts. Record which path, WebGPU or WebGL2, each test actually ran on." | playwright configs; specs log `backend` | render runner logs | VERIFIED |
| 6.37 | "Performance is judged against proxy budgets you set in Phase 1: draw calls, triangles, memory, and CPU and GPU timings where available" | README budgets | draws met; triangles over in 3/7 (B13); memory unmeasured; CPU timings waived under load | PARTIAL (M3) |
| 6.38 | "Real-hardware frame rates come from benchmark mode … Performance gates pass on the proxies, and each one leaves an entry in REAL_HARDWARE_TODO.md" | REAL_HARDWARE_TODO H1–H9, HP7 | last edited 2026-09-24; nothing for sessions 6–8 GPU features | PARTIAL (stale) |

### §10 Language and writing

| # | Requirement (quoted) | Where | Verification, latest evidence | Status |
|---|---|---|---|---|
| 10.1 | "No modern language is heard or seen in the rendered world. English exists only in the out-of-world layers" | lang lint over text, data, audio manifests, carved signs (D-167) | lint:lang 26/26 today | VERIFIED (node) |
| 10.2 | "Who speaks what (verify in LANGUAGES.md before assigning languages to NPCs)" — Old Persian, Elamite, Aramaic, Akkadian scribal, own languages | research/LANGUAGES.md; agent langs | detailed agents: OP 73, El 10, Arc 5, Grc 3, Egyptian 2, Lydian 1 (probe) | PARTIAL: Egyptian/Lydian/delegations fall back to Aramaic murmur; the population beyond the 135 agents speaks no language at all (M6) |
| 10.3 | "Code-switching where plausible" | lines per language; `langs[]` per agent | not measured | BUILT-UNVERIFIED |
| 10.4 | "Old Persian, Elamite and Babylonian cuneiform on the real royal inscriptions (published texts only, never invented)" | inscriptions.json from ARIo CATF (CC0) | OP 0 differences over 5,276 positions (D-184); 10 copies not carved (Q-290) | VERIFIED (node) / PARTIAL (coverage) |
| 10.5 | "Elamite on clay tablets; Aramaic ink on leather; seal impressions" | writing.ts, writing.json | tablets' Elamite is wedge texture or project reconstructions (B18); leather carries no writing; seals: ARIo SDa, Q009270 | PARTIAL |
| 10.6 | "carved text is modelled into the stone" | incised signs (D-184) | no recorded GPU render of the incised signs as such (node preview) | BUILT-UNVERIFIED |
| 10.7 | "fonts: Noto Sans Old Persian, Noto Sans Cuneiform and Noto Sans Imperial Aramaic (OFL)" | @fontsource packages | ledger | VERIFIED |
| 10.8 | "research/LEXICON/<language>.json lists every usable word with its attested form, source, reconstructed IPA and tier" | 5 lexicons: OP 116, El 79, Arc 99, Bab 71, Grc 82 entries | speech.test (IPA mapped); licences D-192 | VERIFIED (node) |
| 10.9 | "Old Persian lines are short and draw only on the lexicon. Everyday talk leans on Elamite, Aramaic and gesture." | speech_lines.ts: 12 OP lines | lint | VERIFIED (node) — but the detailed agents are 78 % Old Persian speakers (guards), so the Terrace's talk leans on OP |
| 10.10 | "speech is synthesised from the lexicon's IPA, converted to the synthesiser's own phoneme format" | tools/build_speech.py (espeak-ng), FormantBackend | IPA round trip 0 mismatches at build (D-185) | VERIFIED (build time) |
| 10.11 | "pre-rendered at build time where possible, with varied voices, ages and sexes; post-processed; spatialised" | 372 clips = 62 lines × 6 voice classes; HRTF panner | node; unheard | PARTIAL (6 voices for the whole population: M7) |
| 10.12 | "Crowd murmur: synthesised from each language's sounds and rhythm" | audio/murmur.ts | node tests; unheard | PARTIAL (6-phrase pools; Terrace agents only; fallback to Aramaic: M6, M7) |
| 10.13 | "Acceptance: the reviewer subagent rates intelligibility and naturalness" | voice_acceptance.json (machine measures) | not met (B17b, H8, Q-138) | **MISSING** |
| 10.14 | "Swappable: the pipeline accepts better voices or my own recordings later" | RecordingBackend with a manifest; FormantBackend fallback | code | BUILT |
| 10.15 | "Language lint. The build fails on any modern-language text or audio that would be rendered or played in the world." | tests/language.test.ts | passes; **not wired into `npm run build`**, no CI | PARTIAL (M11) |

### §11 Sound and music

| # | Requirement (quoted) | Where | Verification, latest evidence | Status |
|---|---|---|---|---|
| 11.1 | "Web Audio with HRTF panning" | engine.ts:86-88 | audio.spec: context running (session ≤ 3 era spec) | BUILT-UNVERIFIED (never heard: M5) |
| 11.2 | "reverb from impulse responses generated for each space's real dimensions and materials" | engine.ts makeIR (Sabine RT60, statistical noise IR); SPACES | audio.test RT60; audio.spec space ids | PARTIAL (Terrace rooms and one portico only; no town/plain spaces: M13) |
| 11.3 | "occlusion" | occlusion.ts (Maekawa, built Terrace) | occlusion.test (passes today) | SCOPE-GAP (Terrace geometry only) |
| 11.4 | "a mixer for dense ambience" | 4 channel gains + master; murmur cap 10 voices | — | PARTIAL (no limiter, no crowd bed: M5, M6) |
| 11.5 | "streaming by zone" | all procedural; nothing to stream | — | n/a (by design) |
| 11.6 | "Layers vary by zone, time, season and weather" | soundscape.ts (hour, month, rain, place) | audio.test (bee-eater months, jackals at night) | BUILT-UNVERIFIED |
| 11.7 | "wind off the mountain and through the columns" | 6 s pink loop, 4 s column whistle loop | — | PARTIAL (short cloned loops: M7) |
| 11.8 | "birds, insects and animals" | BIRDS (sine sweeps), D-210 animals, crickets, cicadas, flies | node schedule tests | PARTIAL (synthetic, several fixed calls: M7) |
| 11.9 | "water; rain on stone, timber and cloth; crackling fires" | 'water' strike only; one rain loop; fire loop + transients | — | PARTIAL (no river/canal sound, rain not by surface, identical fires: M7, M13) |
| 11.10 | "tools, kilns and grinding" | work strikes from performers (chisel, quern, hoe …) | lint:activity checks each performance has a sound | PARTIAL (no kilns; identical noise bursts) |
| 11.11 | "crowds in period languages" | murmur from the 135 agents | — | SCOPE-GAP (Terrace only: M6) |
| 11.12 | "footsteps that change with the surface" | 3 surfaces (stone, earth, plaster) | — | PARTIAL (sample-identical steps: M7) |
| 11.13 | "Sources: CC0/permissive recordings and procedural synthesis only" | all procedural | ledger | VERIFIED |
| 11.14 | "Music: only what someone in the world is playing. No background score" | music.ts, performers.ts, musicDirector.ts | music.test ("never without a position") | VERIFIED (node) |
| 11.15 | "Court: music at the king's meals" | court_supper, court_night (court setting only) | lint:music gig sweep | BUILT-UNVERIFIED (default world has no court: M8) |
| 11.16 | "Sacrifice: no pipes (Herodotus 1.132); a magus chants, unaccompanied, with text from the lexicon" | no pipes (test); chant wordless by the ethics rule (D-209, B20a) | music.test | PARTIAL (deliberate, logged) |
| 11.17 | "Work and street: work songs and herders' pipes; tier C, used sparingly" | quern songs, masons' songs, herder pipe (D-200) | lint:music | BUILT-UNVERIFIED |
| 11.18 | "Foreigners: their own traditions" | Greek modes for Ionian masons | music.test | PARTIAL (Greeks only) |
| 11.19 | "Instruments: only from period and regional evidence … modelled at true size and played with matching animation" | instruments.ts, instrumentForms.ts, playing.ts (D-200) | node; four instruments modelled but played by nobody; never rendered | BUILT-UNVERIFIED |
| 11.20 | "Tuning: the seven-note string tuning recorded on Mesopotamian cuneiform tablets; Greek modes for Greeks" | tuning.ts | music.test (Pythagorean ratios, Kilmer's equation) | VERIFIED (node) |
| 11.21 | "Banned: equal-temperament harmony, and oud, duduk, santur or orchestral clichés" | test "no banned instrument exists" | music.test | VERIFIED (node) |
| 11.22 | "Production: physical-modelling synthesis, with generative variation so repeat performances differ" | Karplus-Strong-type strings, seeded composition | music.test (seeded variety, pitch ±3 cents) | VERIFIED (node), unheard |
| 11.23 | "Evidence: verify each claim and record it in SOUNDSCAPE.md" | SOUNDSCAPE.md, musicClaims.ts, lint:music | 21 claims, all gigs sourced (today) | VERIFIED |

### §12 Licences, ethics and blocklist

| # | Requirement (quoted) | Where | Verification | Status |
|---|---|---|---|---|
| 12.1 | "record every asset in ASSET_LEDGER.md with its source, licence and credit" | ASSET_LEDGER.md (35 rows) | no completeness test; lint_chrono's asset registry empty ("0 registered assets") | PARTIAL (M11) |
| 12.2 | "CC0, CC-BY and CC-BY-NC are fine" | ledger | HYG stars CC BY-SA 4.0 and OSM ODbL used; BY-SA accepted by decision (D-192) | PARTIAL (a licence outside the brief's list, decided and logged) |
| 12.3 | "Check each Sketchfab or Fab licence individually" | none used (B7) | — | n/a |
| 12.4 | "If no usable licensed scan exists for a relief or a human, reconstruct it and tier it" | procedural reliefs (C, NEEDS #10), MakeHuman CC0 | F3 tiers | VERIFIED |
| 12.5 | "Religion: … ritual is shown only as attested, respectfully, with nothing invented for spectacle" | D-209 (wordless chant, killing not shown) + D-207 gap rule | religion.test (node); never rendered or heard | BUILT-UNVERIFIED |
| 12.6 | "Faces: no scans of real people's faces without a licence that covers it" | procedural faces on the CC0 base mesh | ledger | VERIFIED |
| 12.7 | "Hard subjects: dependent labour (kurtaš), children and punishment are shown as the evidence describes them, not sensationalised" | D-103 (no punishment shown), rations, children (D-215) | shadow reviews | BUILT (node) |
| 12.8 | Blocklist items (later religious sites, modern landscape, the ruin's later life, anachronistic objects, Hollywood tropes, later women's dress) | src/data/blocklist.json, lint_chrono (98 terms) | lint OK today, textual only (names, ids, tags): a blocklisted object built without a blocklisted name would pass | PARTIAL |
| 12.9 | "The blocklist applies to the ancient world only; the calibration scene and the out-of-world Now view are exempt" | `exempt: 'calibration' | 'nowview'` | lint code | VERIFIED |

### §13 Verification ("Build these tools in Phases 1–2 and run them at every gate")

| # | Check (quoted) | Tool | Last run / on current tree | Status |
|---|---|---|---|---|
| 13.1 | "Two subagents independently digitise Schmidt's plan … At least one check uses a source independent of Schmidt" | research/_extract_A/B, GEOMETRY_DIFF.md, DEM_EDGE_CHECK.md | Phase 0; Schmidt never reached (B6) | PARTIAL (never at the named scope) |
| 13.2 | "Plan overlay … Pass: ≥ 0.95 footprint IoU per building and < 0.5 m offset" | arch.test (node), plan.spec (render) | node passes today; the reference is OSM, the geometry's own source; plan.spec not since sessions 1–2 | PROXY-ONLY (circular) |
| 13.3 | "Dimension tests … against SITE_SPEC.md" | arch.test and others | pass today | VERIFIED (node) |
| 13.4 | "A Playwright script renders fixed viewpoints matching known photographs and drawings, with the world state frozen" | moments.spec (~40–46 views) | session 8 pass 3 renders queued/partial; only calib-24 matches a photograph | PARTIAL (audit B M1) |
| 13.5 | "Chronology and anachronism, using the period, source and tier metadata on every asset; and language" | lint:chrono, lint:lang | OK today; asset branch empty; not in the build | PARTIAL (M11) |
| 13.6a | "The sun position is within 0.1° of JPL Horizons" | sky.horizons.test | **skipped** (no Horizons data, B2) | MISSING (only self-consistency with astronomy-engine) |
| 13.6b | "monthly mean temperatures within ±1 °C" / "Precipitation-day counts within ±20%" | weather.test | pass today | VERIFIED (node) |
| 13.7 | "Realism. The checks in §8" | calibration, rubric, luminance, detail | calibration photometry fails (B55); rubric pass 2 FAILED; pass 3 not scored | PARTIAL (audit B) |
| 13.8 | "Automated routes through every walkable area. They fail on errors, falls, stuck states, or objects popping in within 50 m in view." | walkthrough(_terrace).spec, botcheck | browser session 3; offline today 97/97; Terrace only; people-only pop-in; ring-edge fall | **SCOPE-GAP / BROKEN beyond** (M1, M2) |
| 13.9 | "Independent review … Pass: no open critical findings" | subagent reviews | Phase 5 FAIL (s8); 3+4, 6+7 never | PARTIAL |
| 13.10 | "Proxy budgets at every gate, plus benchmark mode (§6)" | README, bench | draws/tris session 7 at high; B13 over; bench never valid; excludes sim | PROXY-ONLY (M3) |
| 13.11a | "Variety … No NPC's days are near-copies … distinct event types per week above a floor" | tools/soak.ts | 8/8 on 2026-09-25 20:02, court absent; sim.ts changed after; court soak fails | PARTIAL (not current; court fails) |
| 13.11b | "Stability: no stuck agents; stores and rations don't collapse to zero or grow unbounded" | soak | as above (headless, 60 s steps) | PARTIAL |
| 13.11c | "Visible change: construction progress and seasonal change are measurable" | soak visibleChange | as above | PARTIAL |
| 13.11d | "Shadow review: … 20 random NPCs … no score below 4" | shadow_days.ts + reviewers | round 10 PASSED (session 8) on text day logs, not on screen (audit C M-1) | VERIFIED (text) / PROXY-ONLY (screen) |
| — | CLAUDE.md §13: `npm test`, `npm run test:e2e`, `npm run lint:all`, `npm run soak` | package.json | npm test not on the current tree (12 failures at session start); e2e never as a suite; lint:all today; soak not current | PARTIAL (M10) |

---

## 4. What would close these (in order of payoff)
1. **Terrain collider:** keep the finer ring's collider over a hysteresis band that contains the rendered switch (e.g. near
   ring until 2,040 m and back at 1,980 m), or build the collider from the same function the renderer samples (a local
   heightfield tile around the player from `Terrain.heightAt`, re-centred every ~200 m); add a rescue (feet > 2 m below
   `heightAt` → place on the ground, log it); add a node test that walks across every ring edge on the mountain.
2. **Walk bots everywhere walkable, in the browser with the population drawn:** routes sampled from each area's walkable set
   (Terrace nav grid, the town's walking grid, the plain within reach, the mountain paths), the offline bot given the same
   colliders as the browser (furnishings, waterworks, inscription solids, doors, town, villages, camps), and an object-level
   pop-in probe (any mesh or instance appearing inside 50 m in view).
3. **Bench that measures the game:** drive the player (not freeCam) so `simStep` runs; add routes through the town, the court
   assembly, the plain on foot, night, rain and ×60; write heap and (where exposed) GPU memory; commit the reports.
   Update REAL_HARDWARE_TODO with every GPU feature since D-185.
4. **Audio renders:** tap the master into a MediaRecorder or run the graph in an OfflineAudioContext per coverage cell; measure
   loudness, clipping, layer presence and repetition (autocorrelation of the ambience, clip-identity counts); then a listening
   rubric. Seed `noiseBuffer` per call; lengthen or crossfade the loops; refresh the murmur pools; voices from the whole
   population near the listener, in every zone.
5. **Simulation in a worker** (or at least time-sliced with a frame budget), and a heap measurement with the full population.
6. **A new seed per new game** in the shell and Settings; autosave and save on `visibilitychange`.
7. **Wire lint:all into `npm run build`**, give the chronology lint real asset rows, and re-run `npm test` and the soak on the
   current tree on an idle box before any gate claim.

---

## Appendix: the ring-edge probe (node; run from the repo root with `npx tsx <file>.mts`)
```ts
import { readFileSync } from 'node:fs';
const { Ring, Terrain } = await import('/home/user/fars/src/terrain/heightfield');
const { Physics } = await import('/home/user/fars/src/player/physics');
const { Player } = await import('/home/user/fars/src/player/player');
const meta: any = JSON.parse(readFileSync('public/generated/terrain.json', 'utf8'));
const ring = (k: string) => new Ring(meta.rings[k], new Uint16Array(readFileSync(`public/${meta.rings[k].file}`).buffer.slice(0)), meta.court_asl);
const T = new Terrain(meta, ring('near'), ring('mid'), ring('far')); const P = await Physics.create();
let falls = 0;
for (let k = 0; k < 24; k++) {                       // 24 lines crossing east = 1,984 m (Kuh-e Rahmat), 160 m apart
  const x0 = 1930, z0 = -1900 + k * 160; P.updateTerrain(T, { x: x0, y: 0, z: z0 }); P.step(1e-4);
  const pl = new Player(P, x0, (P.castRayDown(x0, z0, 6000) ?? T.heightAt(x0, z0)) + 0.05, z0);
  for (let i = 0; i < 30; i++) { P.updateTerrain(T, pl.position); pl.update(1 / 30, { forward: 0, right: 0, run: false, yaw: 0, pitch: 0 }); P.step(1 / 30); }
  for (let i = 0; i < 30 * 120; i++) {                // main.ts simStep order: swap ring, move, step
    P.updateTerrain(T, pl.position); pl.update(1 / 30, { forward: 1, right: 0, run: false, yaw: -Math.PI / 2, pitch: 0 }); P.step(1 / 30);
    if (pl.feetY - T.heightAt(pl.position.x, pl.position.z) < -3) { falls++; break; }
  }
}
console.log(`fell through on ${falls} of 24 crossings`);   // 2026-09-26, a8cba80: 12 of 24
```
