# Audit A: intent and process (requirements traceability)

**Scope:** PERSEPOLIS_BRIEF.md §0 Settings, §1 Mission, §1.1 The feeling (every bullet), §2 When, §3 Binding rules, §14 Phases
(every gate), §15 How to run this. Added at the lead's request: USER_DIRECTIONS.md UD-06 to UD-14, and D-233 and D-236.

**Auditor:** an independent subagent (Claude Opus 5.5) that did not see the build process. **Date:** 2026-09-26.
**Tree:** branch `claude/amazing-fermi-40ds7j`, HEAD `cc052dd`. The main working tree was clean. The agent worktrees
`agent-a77ac…` (D-229, Phase 5 fixes), `agent-af2da…` and `agent-af3e6…` (D-234 houses and D-235 coverage) hold unmerged work.
They are cited only where marked.

**Read:** the whole brief; CLAUDE.md; USER_DIRECTIONS.md; PROGRESS.md; TASKS.md; BLOCKERS.md; HANDOFF.md; NEEDS_FROM_ME.md;
REAL_HARDWARE_TODO.md; handoff/review_briefs.md. From DECISIONS: D-001, D-003, D-207, D-231, D-233, D-236 and the D-2xx
headings. From REVIEWS: phase5.md, phase6-7.md, rubric_s7_pass2.md (heads and moment verdicts), gap_audit.md, and the head of
shadow_days_input_seed1_pick181.txt. Source I read in the relevant parts: src/core/settings.ts, src/main.ts,
src/player/{player,physics}.ts, src/ui/{shell,translation}.ts, src/world/world.ts (address, LOD), src/people/{sim,crowd,
impostors,looks,population}.ts, tools/{soak,lint_chrono,lint_activity}.ts, tools/dev/person_census.ts,
tests/e2e/{moments,audio,walkthrough_terrace}.spec.ts, tests/e2e/lib/routes.ts, playwright.config.ts, .gitignore.

**Ran:** no Playwright.
- `npx vitest run tests/sky.horizons.test.ts tests/sky.test.ts tests/weather.test.ts tests/terrain.test.ts tests/arch.test.ts
  tests/language.test.ts --maxWorkers=1`: 77 passed, 1 skipped. The skipped test is the JPL Horizons check: data/horizons/sun.csv is absent (B2).
- `npx tsx tools/dev/botcheck.ts` and `… slice`: 97 legs pass over the six Terrace areas, plus the slice. This is node only,
  with no people and no rendering.
- `npm run lint:all`: OK. `npx tsc --noEmit -p .`: clean.
- An audit probe, `scratchpad/scene_probe.ts`: scene-level repetition at 10:00 over 13 spring days, from the population's day plans.
  Summarised under M7.

Status words: **VERIFIED** (the evidence is fresh on this tree), **BUILT-UNVERIFIED**, **PARTIAL**, **MISSING**, and **PROXY-ONLY**
(verified only through something narrower than the brief means). **SCOPE-GAP** says what the verification leaves out.

---

## 1. Major misses, ranked

Each miss is either a **method miss** (a check that can pass while the intent fails, the class the user caught) or a **requirement miss**
(the thing is absent or broken). The rank is by how directly a player walking the world today would feel it, and by how
completely the existing checks would stay green while it happens.

### M1 (method). Every photoreal and "moment lands" judgement is made on a frame the player never sees
The rubric, the moments and the D-233 coverage plan all judge **still 960 × 540 frames at a photographic lens**. The player
plays at a 14 mm-equivalent lens, at 1440p, moving, with sound, on any date and in any weather.
- **Resolution.** `playwright.config.ts:11` sets `viewport: { width: 960, height: 540 }`, and every scored image is 960 × 540
  (rubric_s7_pass2.md l. 26). That is 1/7 of the pixels of the §0 target, 1440p. DECISIONS l. 3448 admits it: "a face is under
  16 px there… Why the faces read as mannequins… is a measurement question". §8 "stable anti-aliasing, so fine detail doesn't shimmer"
  and §8.3 "detail at 1 m" cannot be judged at that size.
- **Lens.** `moments.spec.ts:8` uses `IN = 46, OUT = 40` degrees of vertical FOV (24–28 mm). The player's default is
  `fov: 70` (settings.ts:21, vertical, about 102° horizontal at 16:9). The spec itself calls that "a 14 mm lens". `FOV=game`
  exists, but no rubric pass has ever scored a frame at the player's FOV (grep of both rubric reviews). §1.1 promises that
  "scale is felt… how small a person is at the foot of a gate", and scale is exactly what an ultra-wide lens distorts.
- **Motion.** Every frame is frozen (`?test`, 8 frames of TRAA convergence). Nothing checks TRAA ghosting, shimmer, LOD popping
  on the mountain silhouettes (H4), impostor switching, or the eye adaptation actually experienced while walking. The
  exception is the one carried-eye entry sequence.
- **Time, season and weather.** Of the 43 rig moments, 38 fall on days 0–32 (April–May) and 40 are in clear weather. There is one rain,
  one snow and one "auto" frame. There is no dust storm, mist, overcast or lightning frame, and no summer, autumn or winter
  landscape. Phase 6-7 review M6 says the seasons across the year are node-checked only.
- **Quality level.** The frames are rendered at `high`. Ultra, the "full target", has three plain views on disk. WebGL2 at high times out (HANDOFF).
- **Could it pass while the intent fails?** Yes, in each of the five axes. **D-233 fixes only the "where" axis.** Its coverage spec is
  still still-frame, 960 × 540, rig-lens, one world state per view. **The fix:** a coverage matrix over place × time/date/season ×
  weather × lens (player FOV) × motion (short walk clips, frame-to-frame flicker and pop metrics) × quality (ultra), sampled
  but gated per cell, plus a 1440p crop pass for detail and faces.

### M2 (method). Nobody has ever listened to the world
Half of §1.1 is sound: "silence, wind, distant voices and empty moments… matter", "you find your way by… sound". §1 also asks
for "a soundscape true to the place".
- `tests/e2e/audio.spec.ts` (last touched 2026-09-24) asserts only that the AudioContext is `running` and that the reverb
  space name switches between three places.
- No offline render of the mix exists: there is no OfflineAudioContext anywhere in src, tools or tests.
- H8 (voices, the §10 human rating) is open. The Phase 8 review r3 says "nothing heard or seen on a GPU", and the magus's chant
  and the court music are "never heard" (PROGRESS).
- **No existing check could catch** a looping bird bed, a crowd murmur that drowns the silence, voices in the wrong place, a
  music cue that reads as score, or dead air. Sound is also missing from "judge the moments as scenes" (review_briefs l. 21 and l. 46).
  The reviewer gets PNGs.
- **The fix:** render 60–120 s of binaural audio per coverage cell (OfflineAudioContext, or capture from the page), then
  measure loudness, the layer mix and the repetition period, and add a listening review with a rubric.

### M3 (requirement and method). Depth before breadth was not kept; the slice was never finished, and later phases were built on it
- §14 says: "Depth before breadth: perfect one route before spreading out". The Phase 3 slice is to be "built after the calibration scene
  matches its photo", and its gate is "all §13 checks pass for the slice; a walkthrough bot completes the route; the §1.1 moments on this
  route land in review".
- **Phase 3 has never passed.**
  - The §8.1 calibration was first attempted in session 8 (D-230) and fails photometry (B55).
  - Rubric pass 2: 0 of 8 moments land.
  - The browser walkthrough of the slice was last run in session 3, before the population was drawn.
  - The Phase 3+4 independent review has never run.
- Phases 4–8 were built anyway. Phase 4's own target ("at slice fidelity") is therefore undefined.
- §15.7 allows continuing past a failed gate only "if later phases don't depend on the failing item". Every later phase
  inherits the materials, light and people of the slice.
- **Gate scoreboard today:**
  - 0, 1, 2: passed with logged exceptions.
  - 3, 4: not passed, reviews never run.
  - 5: FAIL (REVIEWS/phase5.md, C1).
  - 6+7: FAIL (REVIEWS/phase6-7.md, C1). The code fix is a4dc698; the vista has not been re-measured at ultra on disk.
  - 8: "PASSED" in session 6, but stale (M8).
  - 9: not started.
- No phase from 3 onward has a current pass.

### M4 (requirement). People's lives are thin and copy-pasted, and every people gate is green
Sources: UD-08, §1.1 "weight comes from ordinary lives… many of these people are real and named", §1 "people with their own homes,
jobs and schedules", §9.1 and §9.2.
- **Names.** 209 distinct names for 46,910 people; 27 names for 20,736 Persian men, about 766 people each
  (bench-reports/person-census.txt, 400716e). The pool is CDLI PF 1–60 and 400–406 plus recalled names (Q-221).
- **Bodies and faces.** `public/generated/humans/humans.json` has **23 variants for the whole population**: 12 adult men,
  3 old men, 4 adult women, 1 old woman and 3 children. Each variant has one fixed `face` record (humanFormat.ts:83). About 20,000
  women share four adult faces. The 50 close-up people near the player will show twins.
- **History.** None. The census says "no per-person history", and D-236 only plans one.
- **Real named individuals: none placed.** `names.json` has 0 `notable` rows, and the code never uses a notable name. Baratkama,
  Herdkama "the Egyptian" and Budkama are in research/PEOPLE.md §1a but not in the world. D-003 chose 467 *because* of Baratkama
  and the Treasury names. Q-032 logs "office only, no name". PROGRESS nowhere says that §1.1's "real and named" is unmet.
- **Only 135 people can be talked to or remember you.**
  - `world.ts` `address()` loops over `sim.agents`, the fixed Terrace slice, and skips `offmap` agents.
  - Everyone in the town, the villages and the plain (46,775 people, 99.7 %) cannot be addressed. They only turn their heads (crowd.ts:685).
  - Memory ("a baker you watched nods") exists only for the 135.
  - "Full behaviour" (decisions on the grid) is bound to the Terrace, not to the player's surroundings. sim.ts:7–10 says so; LOD_RADIUS = 1e9.
- **Jobs.** 26 job types.
- **Why the checks stay green.** The soak's per-person variety, the shadow review (20 text timelines), lint:activity (a registry
  check) and the soak's "renderedHonest" (a registry check) all pass. None of them measures identity uniqueness, visual uniqueness,
  history, addressability, or whether the promised real people are present.

### M5 (method). The people checks verify the simulation's text, not what is on screen
- **Shadow review.** It reads text timelines (tools/shadow_days.ts). §9.5 says the shadow review "confirms that what a person
  is doing on screen matches what the simulation says". That has never been done on screen.
- **renderedHonest.** soak.ts:81 counts an activity as rendered when it is in `PeopleSim.EMITS` and not flagged placeholder. It
  covers only the 135 detailed agents.
- **The impostor stand fallback is still on main.** `impostors.ts:41–50`, `default: return FR.stand`. About 30 work animations
  (hoe, reap, plough, herd, shear, weave, haul, lay, butcher, cook, harp, and more) are drawn standing for everyone outside the
  448-person skinned pool, at any distance. The placeholder counter cannot see this (Phase 5 M4). The fix, D-229, sits unmerged in
  `agent-a77ac…`. Even the frames that exist are frozen single poses: a distant reaper does not reap.
- **Pop-in.**
  - The browser probe counts only people (crowd.ts:402; walkthrough_terrace.spec.ts:6, "no people popping in"). §13.8 says
    "objects popping in within 50 m in view". Trees, houses, relief LODs, terrain chunks, props and animals are not probed in the
    browser. There is one node check for reeds.
  - No browser walkthrough with the population has ever run (Phase 5 M5).
- **Walkthrough routes.** They cover the six Terrace areas and the slice only (tests/e2e/lib/routes.ts). The town lanes, the plain,
  the villages, Tol-e Ajori, Naqsh-e Rustam, the mountain slope, the tomb façades and the fortifications have no route. §13.8 says
  "every walkable area". I re-ran the offline botcheck today: 97 legs plus the slice pass. It runs without people, doors in motion or furniture.

### M6 (requirement). The court (UD-10) is a decision, not a build; turning it on makes a failing gate the default
- `settings.ts:21` still reads `courtCalendar: 'evidence'`. D-236 (0d0be41) changed only DECISIONS and BLOCKERS.
- The existing "seasonal" court is static: in residence from Nisannu 1 to the end of Du'uzu (D-003). It has no arrival or departure event.
  UD-09 and UD-10 ask for comings and goings.
- **The court-year soak fails.** plansWellFormed has 2,786 festival issues on day 10 (REVIEWS/phase5.md C1). No court-year soak
  has passed since D-211. B12 still claims one passes.
- The court is also the only configuration that meets the ≥ 300 visible floor on the Terrace. That evidence file,
  shots/crowd-scale.json, no longer exists (Phase 5 M1).
- **What this means:** implementing D-236 makes Phase 5 C1 a defect of the default world, and it moves the default world's
  budget into B13 territory: 12.1 M+ triangles at court-apadana-n before shadows (Phase 5 M2).

### M7 (method). The UD-07, UD-09, UD-11 and UD-14 directions have no measure at all
**UD-09, "every moment happens the same way again and again".** The soak measures per-person day similarity. No gate measures
the scene: the same place at the same hour on different days. D-236 names this gap and does not build a test for it.
- My probe (population plans, 10:00, days 20–47 of spring) found no near-identical scenes.
- The lanes change people day to day: Jaccard about 0.2 of the persons present.
- The work sites keep the same gangs: Hall 100 walls 0.63–0.90, worksite_capital 0.77. That is plausible.
- The activity mix is 0.90–0.99 constant almost everywhere.
- So the plans are not the problem. What the player sees repeating is the visual layer (M4: 23 bodies, frozen impostor poses)
  and the calendar (the year replays identically after 354 days: `W.conditions(d % W.days.length)`).

**UD-11, surprise and discovery.** No mechanism and no metric. Nothing counts "witnessable distinct events within X m per in-game hour"
or rare-event frequency by place.

**UD-14 and D-207, world completeness.** The only instrument is the one-off D-208 gap audit, written by one agent in session 7.
- Its items 19, 20, 30, 32–36 and 39–41 are still open.
- Other gaps are known and unfixed: delegation animals, animals' walk gait only, no rats, bats or visible flies, wheels that do not turn.
- No test fails when a category of the world (crafts, animals, rites, food chain, transport, dirt) is empty or only a placeholder.

**UD-12.** The scope ledger `tests/scope_ledger.test.ts` and `MASTER_PLAN.md` are named as governing by USER_DIRECTIONS.md and
CLAUDE.md l. 3, and **neither exists at HEAD `cc052dd`**. A session that restarts now is told to read a file that is not there.

**Seeds.** D-236 wants a new seed per game. Every soak, shadow-review and plan gate has been run on seed 1 only, apart from the
weather test's 10 seeds. Under D-236 those gates become single-sample proxies.

### M8 (method). Evidence is not kept, and the records overclaim
**Evidence is deleted.** `.gitignore` excludes `shots/` and `bench-reports/*.json`. Browser claims rest on files that vanish:
- `shots/crowd-scale.json` is gone (Phase 5 M1);
- `shots/plain-stats.json` was missing at the Phase 6-7 review (its M1).

No PNG under REVIEWS is committed. A claim cannot be re-checked once the working tree turns over.

**TASKS.md defines `[x] = gate-verified`**, yet ticks items that are not:
- "65 living NPCs";
- "Reliefs (placeholder silhouettes…)";
- "Every simulated activity has a performance… Seen only in the lab";
- "Walkthrough bot over the whole slice", from session 3.

It still lists "Calibration scene — BLOCKED" after D-230. §3.7 says "never describe intent as achievement".

**Phase 8 "PASSED"** (review r3, session 6) predates three changes, and the gate has not been re-reviewed:
- D-198: the translation layer now shows the project's own unchecked English. The gate reads "every translation is sourced".
- D-202 and D-213: recalled and composed names. Phase 5 M6 says the composed names are against §9.1 without the user's ruling
  (now given, UD-08 and D-236).
- D-209: the wordless chant.

**Stale claims:** B12 ("the year soak with the court… passes"); B11's headline, whose evidence file is gone; the PROGRESS Phase 5
row, which understates.

**Test failures that are never followed up.** CLAUDE.md's rule "timing tests under load are not failures until re-run alone"
has let three things stand across sessions 6–8:
- CPU gates never re-measured on an idle box: performances median < 10 ms, popview, humans_runtime;
- the baseline, 923 passed and 12 failed, with 11 failures not re-run alone;
- the full `npm test`, never run clean on a merged tree this session.

The rule is reasonable. Having no follow-through is not: nothing forces the re-run.

**CLAUDE.md compresses §13 into tool names.** It reads: "`npm run test:e2e` (camera rig + walkthrough bots…)". The scope words
are lost: "every walkable area", "objects popping in", "as scenes", "whole Terrace". CLAUDE.md is what every session re-reads.
This is the plausible root of the camera-rig-as-standard miss, and the same compression hides M1, M2 and M5.

### M9 (requirement). §1.1 "real objects in their moment" is mostly reconstruction, and shown as such
- **Tablets.** "Specific attested tablets being written and sealed with real, attested seals": no Treasury text is available (B18).
  The scribes' room shows three memoranda the project composed (D-198, labelled "not a surviving text (C)"). The seals are real
  ARIo seal texts.
- **Reliefs.** "Freshly painted": the paint follows the evidence by zone, but the carving is procedural (NEEDS #10), with no undercut.
  The lion-and-bull is "a poor drawing" (Q-552).
- **Foundation plates.** DPh boxes are built (D-068, tests/foundation.test.ts).
- **Treasury objects.** Stored goods are built (C).
- **Status:** PARTIAL. It is honest in the data. It is not listed among the broken §1.1 promises in PROGRESS.

### M10 (requirement). The places §1.1 names as the experience are the least built
**"The settlement's lanes can be a maze."**
- The 1,456 houses are PLACEHOLDER boxes with fixed doors (D-228). D-234 is running in a worktree with no commit yet.
- The town at dusk shows no fire point: line of sight to 0 of 420 flames (B49).
- The only settlement renders on disk are three views: slope, Tol-e Ajori at 50 m, workshop Area B.

**"How far the plain stretches, and how long it takes to walk across it."**
- PROGRESS calls the near plain "an empty sheet".
- The plain has no walk route, no pop-in probe and no season render.
- Walking the plain is the longest real-time activity in the brief, and it has the least verification.

**"The player can… inspect things" (§1).** E opens doors and addresses people. Nothing else can be inspected, apart from
inscriptions in the translation layer (main.ts:111–115).

### M11 (method; performance under the player's own controls)
- §6 wants NPCs in Web Workers. `PeopleSim` runs on the main thread (Phase 5 M3). The latest soak's frame cost at ×60:
  mean 17.6 ms, p99 359 ms, max 675 ms. At ×1 the maximum is 84 ms, at the day rollover. The time scale goes to ×600 in the
  settings (shell.ts:95), and that has never been measured.
- The real-GPU benchmark report has never been produced: there is no bench-*.json in bench-reports (NEEDS #11).
- §0's 60 fps @ 1440p is PROXY-ONLY by design (B5). But the proxies are measured at `high`, not `ultra` (Phase 6-7 C1), and the plain
  vista has not been re-measured at ultra since a4dc698.

---

## 2. The §1.1 feeling as a whole: what a player walking today could find broken, and whether a check would catch it

| Promise | What a player could meet today | Caught by an existing check? |
|---|---|---|
| "Stepping through a door into a place that was real" | Stone flat on screen (B40); rubric pass 2 FAILED (light 2, materials 1, people 2, weather 1); pass-3 renders not yet scored | Rubric: yes, but only for the ~43 rig stills (M1). D-233 coverage: not built |
| "Presence… scale is felt" | The default 70° vertical FOV (≈ 102° horizontal) shrinks gates and columns; people at arm's length share 23 bodies and faces | No. The rubric never scores the player's lens; nothing measures look uniqueness |
| "The long climb of the stairway at true walking pace" | Walk 1.35 m/s (C), run 3.2 m/s with no fatigue; the climb works (bot legs pass) | Botcheck (node): the route completes. Pace, bob and footfall sound are not judged |
| "The Apadana's columns close overhead and the light drops" | The entry sequence is the one "partly lands" moment (rubric pass 2) | Partly: the carried-eye stills |
| "How small a person is at the foot of a gate" | Judged at a 28 mm lens; played at 14 mm | No (M1) |
| "How far the plain stretches, how long to walk across it" | Near plain "an empty sheet"; no season render; distant work drawn standing | No route, no probe, no season or coverage render (M5, M10) |
| "No sprinting, no fast travel, no camera tricks" | Holds for the player: no teleport UI, the Now view keeps the camera. `__parsa.view/teleport` are on `window` in every build (console only) | No check; code reading holds |
| "Restraint: no narrator, tutorial, score, cinematic framing" | Holds: the crosshair shows only with the translation layer (shell.ts:39); music only from performers (lint:music) | lint:music, lint:lang: yes. The in-world HUD is by code reading |
| "Silence, wind, distant voices, empty moments matter" | Unknown: never listened to | **No** (M2) |
| "Nothing tells you how to feel" | Unknown for sound (music stings?); the visual side holds | No |
| "Getting lost is allowed… no minimap, compass or waypoints" | Holds: map and chronicle are gated on the translation layer (translation.ts:205) | No test, but a simple rule |
| "The settlement's lanes can be a maze" | Placeholder box houses | Phase 6 "gate items met on paper" does not look (M10) |
| "Weight comes from ordinary lives… many real and named" | 27 names for 20,736 men; no real named person; the town cannot be addressed; nobody but the 135 remembers you | **No** (M4) |
| "A scribe pressing a tablet… a ration jar… a child's game… a mason's mark… dust worn into a threshold… work left unfinished" | Built in node: scribes' room D-221, ration queues, toys D-215, marks D-212, threshold wear, Hall 100 site. Most never rendered ("node tests only") | lint:activity (registry); renders only for scribe-room and hall100-site; the scribes read bare-chested (Q-544) |
| "Real objects in their moment" | Composed tablets, procedural reliefs | Labelled; not a check of the intent (M9) |
| "The loss is carried by knowledge, not shown" | Holds by inspection: no fate hint in the UI, the Now view is off by default and never restored | No automated check (speech lines and the chronicle could hint; nothing scans them for it) |
| "Now view… from any spot on the Terrace" | Built from recollection (C); two now-* stills and calib-24-now rendered | Stills only |
| "Moments that must land… judge them as scenes" | 0 of 8 land (pass 2); town-dusk fails by measurement (B49); rain curtains unverified | Judged as stills without sound (M1, M2) |

**What the player feels most today, in order:** repeated people (names, faces, silence in the town), placeholder towns and an empty
near plain, flat stone, sound of unknown quality, and distant work drawn standing. Only the flat stone is inside an existing check,
and even that check covers stills only.

---

## 3. Full traceability table

Columns: **Requirement** (quoted) · **Implemented in** · **Verified by; latest evidence** · **Status** · **SCOPE-GAP / proxy risk**.
"s8" means session 8 (2026-09-25/26). "Today" means this audit's own run on `cc052dd`.

### §0 Settings
| # | Requirement | Implemented in | Verified by; latest evidence | Status | SCOPE-GAP / proxy risk |
|---|---|---|---|---|---|
| 0.1 | "YEAR = chosen in Phase 0 # the height of Persepolis, court in residence (§2)" | D-003: 467 BCE; `calendar_467.json` | Phase 0 review passed (REVIEWS/phase0.md) | PARTIAL | "Court in residence" is not the default (B9). UD-10/D-236 now says the court comes and goes by default; not implemented (settings.ts:21, M6) |
| 0.2 | "ENGINE = Three.js latest stable; WebGPURenderer + WebGL2 fallback; TypeScript; Vite" | package.json: three ^0.186, TS 7, Vite 8; `forceWebGL` | tsc clean today; WebGL2 renders at `test` only; "WebGL2 at high times out" (HANDOFF) | PARTIAL | The WebGL2 path is not verified at the quality people will use |
| 0.3 | "TARGET = desktop Chrome/Edge, WebGPU, RTX 3070-class GPU, 60 fps @ 1440p at the top quality setting" | quality presets (settings.ts:41–46), bench mode | Proxies only (B5, REAL_HARDWARE_TODO H1); no bench report file exists | PROXY-ONLY | The proxies are measured at `high`, not `ultra`; renders are 960 × 540; the sim on the main thread (M11) |
| 0.4 | "USE = personal, non-commercial" | ASSET_LEDGER.md (36 rows); D-192 licence checks | Phase 8 r3 (licences, M6) | BUILT-UNVERIFIED | `src/data/assets.json` has 0 assets registered, so lint:chrono's asset branch checks nothing |
| 0.5 | "RESEARCH = lean # capped, just-in-time (§4.2)" | research/ files | Phase 0 review | VERIFIED (s1) | — |
| 0.6 | "LANGUAGE = period-only # no modern language in the world (§10)" | lint:lang (tests/language.test.ts) | Passed today | VERIFIED | The lint covers text, data and audio names; nobody has listened to the audio (M2) |
| 0.7 | "TRANSLATION = off # optional out-of-world English layer, toggled in settings" | settings.ts:21 `translation: false`; translation.ts | Code; tests/translation_layer.test.ts | VERIFIED (code) | — |
| 0.8 | "PLAYER_MODE = observer # observer \| visitor (§1)" | settings.ts:21 | Code | VERIFIED (code) | — |
| 0.9 | "LLM_DIALOGUE = off # optional (§9.4)" | Not built (no setting, no proxy) | — | MISSING (optional) | Stretch |
| 0.10 | "WORLD_SEED = 1 # one seed drives weather, NPCs and everything random (§6)" | core/rng.ts; `?seed=` (main.ts:45) | weather.test (10 seeds), soak seed 1 | PARTIAL | 11 `Math.random()` calls for sound events (fauna.ts, crowd.ts, soundscape.ts). All people gates run on seed 1 only; D-236 wants a new seed per game (M7) |
| 0.11 | "Repo folders I use: references/ … and data/" | references/INDEX.md (s8 second upload catalogued); data/ | INDEX §6 | VERIFIED (s8) | `data/dem/` is absent here (the derived terrain is committed) |

### §1 Mission
| # | Requirement | Implemented in | Verified by; latest evidence | Status | SCOPE-GAP / proxy risk |
|---|---|---|---|---|---|
| 1.1 | "Build the most faithful, walkable, living reconstruction of Persepolis … ever made" | Whole build | Gates (M3) | PARTIAL | No phase from 3 onward has a current pass |
| 1.2 | "the Terrace at true 1:1 scale on its real terrain" | arch/* from site_spec.json; terrain from GLO-30 | arch.test and terrain.test pass today; plan overlay (Phase 2) | PROXY-ONLY | The plan overlay checks the OSM footprints the geometry was built from (Phase 2 exception, B6); the Schmidt plan was never read (B1) |
| 1.3 | "… with the settlement, gardens and Marvdasht plain out to the horizon" | world/settlement, world/plain, far ring ±71.7 km (D-035) | Phase 6+7 review FAIL (C1 code fixed a4dc698); lints pass | PARTIAL | Houses are placeholder boxes (D-234 open); near plain "empty sheet"; 3 settlement renders; seasons node-only |
| 1.4 | "people with their own homes, jobs and schedules, dressed as the evidence shows" | population.ts, sim.ts, outfits.ts | person_census (400716e): 100 % household and job; soak 8/8 (s8, seed 1, court absent) | PARTIAL | 26 jobs, 209 names, 23 bodies, no history (M4); delegation dress from recollection, NOT SEEN (Q-370) |
| 1.5 | "real sky, seasons, weather, fire and smoke, and a soundscape true to the place" | sky/, weather/, world/fire*, audio/ | sky/weather tests today; smoke renders D-220 | PARTIAL | Soundscape never heard (M2); rain curtains unverified; dust never rendered; snow does not lie (rubric pass 2); weather renders 2 of 43 |
| 1.6 | "photoreal: a frame should read as a photograph of a real place" | render/* | Rubric pass 2 FAIL (s7); pass 3 not scored | PROXY-ONLY, failing | Still, 960 × 540, rig lens, spring, clear (M1) |
| 1.7 | "The player walks in first person at human scale" | player/player.ts (WALK 1.35, RUN 3.2 m/s), Rapier capsule | botcheck 97 legs today (node); browser walkthrough s3 | PARTIAL | Browser walk not re-run since s3; Terrace routes only (M5) |
| 1.8 | "… and sees and hears only what was there" | lints (chrono, lang, music), blocklist | lint:all OK today | PROXY-ONLY | lint:chrono covers parts and settlement/plain rows, not dress, props, animals or furnishings (assets.json empty); "hears" never listened to |
| 1.9 | "There is no English in the world: people speak their own languages, and inscriptions are in their original scripts" | lang/, audio/speech, carved ARIo text (D-184) | lint:lang today; Phase 8 r3 | VERIFIED (lint) | Human intelligibility rating H8 open |
| 1.10 | "The player can talk to people" | world.ts `address()` | tests (speech, exchanges) | PARTIAL | **Only the 135 Terrace detailed agents** can be addressed; 99.7 % of people cannot (M4) |
| 1.11 | "… inspect things" | Doors (E); inscriptions (translation layer) | Code | PARTIAL | No inspection of objects, tablets or goods (M10) |
| 1.12 | "… and change the time, date (within the chosen year) and weather" | shell.ts:93–96 (day, hour, scale ×0–×600, weather incl. dust and mist) | Code; e2e dbg specs | VERIFIED (code) | ×60/×600 cost not budgeted (M11) |
| 1.13 | "An optional translation layer, off by default, adds subtitles, translations of inscriptions, and a map" | ui/translation.ts, mapLayers.ts | translation.spec e2e (s3, D-036); translation_layer.test | PARTIAL | Translations are the project's own, unchecked (D-198, B17a); e2e stale |
| 1.14 | "Observer mode (default): people notice and react (step aside, glance, respond when addressed). Nothing is barred." | crowd.ts:685 glance (everyone skinned); sim.notice (135); address (135) | node tests; no render review | PARTIAL | Response and memory only on the Terrace slice; "step aside" for the player not found as such (people avoid each other, popview STEP_S) |
| 1.15 | "Visitor mode: … sealed travel authorisation … guards stop you where they would have" | world/visitor, D-100..D-104 | visitor_access / visitor_controller tests; visitor.spec e2e | BUILT-UNVERIFIED (browser) | e2e queued since s3 (TASKS) |
| 1.16 | "'Best ever made' means: every measurable thing is measured, every claim is sourced, every guess is labelled, it looks real, and it feels inhabited" | Records, tiers, F3 | Mixed | PARTIAL | "Looks real": failing; "feels inhabited": no measure of the felt experience (M4, M7) |
| 1.17 | "Spectacle comes from correct scale, light, material, weather and life, never from invention" | D-207 gap rule (fills tier C) | Records | BUILT | UD-14 now asks for extrapolation; the line between probable fill and invention needs a per-item tier and reason (D-207 does this) |

### §1.1 The feeling
| # | Requirement | Implemented in | Verified by; latest evidence | Status | SCOPE-GAP / proxy risk |
|---|---|---|---|---|---|
| F.1 | "It should feel like stepping through a door into a place that was real, and is gone" | Everything | Rubric (FAIL); no experiential test | PROXY-ONLY | The feeling is never tested as an experience: walk, sound, time (M1, M2) |
| F.2 | "You should be able to get lost in it and feel the weight of where you are" | See F.14–F.17 | — | PARTIAL | — |
| F.3 | "Accuracy is how we earn that feeling; it isn't the goal on its own" | Process | — | — | The project's verification is almost all accuracy; the feeling side has no instrument (M7) |
| F.4 | "Presence through the body. Scale is felt, not shown" | 1:1 geometry, eye height, walk speed | arch.test today | PROXY-ONLY | Player FOV 70° never judged; rig at 40–46° (M1) |
| F.5 | "the long climb of the stairway at true walking pace" | player.ts step-up (D-034); stair.spec | botcheck slice today (node); stair.spec (s3) | PARTIAL | Pace on stairs, head-bob and footstep sound never judged together |
| F.6 | "the moment the Apadana's columns close overhead and the light drops" | probes, eye adaptation, carryEye entry sequence | Rubric pass 2: "partly lands" | PARTIAL | A sequence of stills with carried exposure, not a walk |
| F.7 | "how small a person is at the foot of a gate" | gate-dusk moment | Rubric pass 2: does not land | PROXY-ONLY, failing | Lens mismatch (M1) |
| F.8 | "how far the plain stretches, and how long it takes to walk across it" | Far ring; plain | plain-* stills (d223) | PARTIAL | No plain walk route or coverage; near plain empty (M10) |
| F.9 | "No sprinting across the world, no fast travel, no camera tricks" | RUN 3.2 m/s (a jog), no stamina; no teleport UI | Code | VERIFIED (code) | The test API (`__parsa.view/teleport/freeCam`) is on `window` in production builds (console only) |
| F.10 | "Restraint. The world never performs for the player" | — | — | — | — |
| F.11 | "no narrator, tutorial prompts, swelling score or cinematic framing" | No narrator; the crosshair only with translation (shell.ts:39); music only from performers (lint:music); title-screen piece | lint:music today | VERIFIED (code, lint) | Pause-menu controls help is allowed |
| F.12 | "silence, wind, distant voices and empty moments are allowed, and they matter" | audio/soundscape.ts, murmur.ts | **Never listened to**; audio.spec checks the context state only | BUILT-UNVERIFIED | M2 |
| F.13 | "nothing tells you how to feel" | — | None | BUILT-UNVERIFIED | Needs a listening review (music, stingers) |
| F.14 | "Getting lost is allowed. No minimap, compass or waypoints in the world" | Map and chronicle only when translation is on (translation.ts:205) | Code | VERIFIED (code) | — |
| F.15 | "You find your way by landmarks, the sun, the mountain and sound, the way people did" | Sky, horizon skyline (D-035), spatial audio | horizonmap test; sound unheard | PARTIAL | Sound as a wayfinding cue never tested |
| F.16 | "The settlement's lanes can be a maze" | town plan (plan.ts), house placeholders | Phase 6 "on paper" | PARTIAL | Placeholder houses (D-234 unmerged); no town walk route |
| F.17 | "(The out-of-world map exists only in the translation layer.)" | translation.ts | Code | VERIFIED (code) | — |
| F.18 | "Weight comes from ordinary lives … a scribe pressing a tablet, a ration jar, a child's game in a workshop yard, a mason's mark on a block (verify which marks are attested), dust worn into a threshold, work left unfinished" | D-221 scribes' room, ration queues, D-215 toys, D-212 marks (Roaf via search extract, the "double diamond" NOT SEEN), threshold wear (surfaces), Hall 100 site | Node tests; renders: scribe-at-work (reads bare-chested, Q-544), hall100-site | PARTIAL | Most items never rendered ("node tests only", PROGRESS); marks' attestation second-hand |
| F.19 | "Many of these people are real and named in tablets that survive" | None placed: names.json has 0 notable rows; names reused on unnamed people only | person_census (400716e) | **MISSING** | Baratkama and others in PEOPLE.md §1a are not in the world; not flagged in PROGRESS (M4) |
| F.20 | "Real objects in their moment … placed and used as the evidence shows" | writing.json, decor.ts (DPh), furnish.ts | tests/writing, foundation, palace_furnish | PARTIAL | M9 |
| F.21 | "specific attested tablets being written and sealed with real, attested seals" | Reconstructed memoranda PTR-1..3 (C, "not a surviving text"); real ARIo seal texts | writing.test | PARTIAL (blocked, B18) | Honest label; the intent (attested tablets) unmet |
| F.22 | "the Apadana foundation plates in their stone boxes" | decor.ts `buildFoundationDeposits` (D-068) | tests/foundation.test.ts | BUILT-UNVERIFIED (render) | Buried under the floor: when the player sees them is not stated |
| F.23 | "the reliefs, freshly painted" | reliefs.ts, polychromy.json, D-226 shadows | apadana-e-stair-raking, reliefs-raking at high (s8) | PARTIAL | Procedural carving (NEEDS #10), no undercut; pass 3 not scored |
| F.24 | "objects from the Treasury" | furnish.ts (stored goods, C) | Node | BUILT-UNVERIFIED | Not rendered in the review set |
| F.25 | "You're seeing things that still exist, before anyone knew they would be the ones to last" | Real-object tiering in F3 | — | PARTIAL | Depends on F.19–F.24 |
| F.26 | "The loss is carried by knowledge, not shown. The world itself never hints at its fate" | No fate content found (grep of UI and blocklist); the Now view off by default and never restored (settings.ts:12, :29) | Code reading | BUILT-UNVERIFIED | No lint scans speech lines or the chronicle for hints of the fate |
| F.27 | "Now view (stretch …): from any spot on the Terrace, switch to the ruin as it stands today … and back again" | arch/now.ts, world/nowview.ts, key N (D-201) | now_view.test; now-stair-top, now-apadana, calib-24-now renders | PARTIAL | Recollection, tier C; photos now exist (INDEX §6) but only the calib view used them |
| F.28 | "Moments that must land. Capture these as fixed camera-rig scenes (§13.4), and judge them in the §8 rubric review as scenes, not only as images" | moments.spec.ts (43 views) | Rubric pass 2: 0 of 8 land (s7); pass 3 queued | PROXY-ONLY, failing | "As scenes" is not done: stills, no sound, no motion (M1, M2) |
| F.29 | "dawn from the top of the Grand Stairway, looking over the plain" | dawn-stair-top(-nw), dawn-sunrise(-nw) | Pass 2: does not land; D-224 fixes rendered (stills) | Failing | Belt of Venus lilac (B44) |
| F.30 | "entering the Apadana hall from bright sun" | apadana-enter-* sequence (carryEye) | Pass 2: partly lands | PARTIAL | — |
| F.31 | "the procession reliefs in raking light, in full colour" | reliefs-raking, apadana-e-stair-raking | Pass 2: does not land; D-226 rendered s8, unscored | Failing, unscored | — |
| F.32 | "smoke rising from the town at dusk as lamps are lit" | town-smoke-dusk(-rahmat), D-220, D-227 | B49: 0 flames in line of sight; smoke +2.2 luma | **Failing by measurement** | — |
| F.33 | "night on the Terrace with only fire, moon and stars" | night-terrace, night-moon-fire (s8) | Pass 2: does not land; night-moon-fire rendered s8 (exposure 3.56, 0.02 % clipped) | Unscored | — |
| F.34 | "rain moving across the plain toward the columns" | rain-approach, rain-columns; D-219 shafts | Curtains "not yet seen in the re-framed rain-approach" (PROGRESS s8) | BUILT-UNVERIFIED | — |
| F.35 | "a scribe's room, mid-work" | scribe-at-work, scribe-room-ne (D-221) | Renders: "STILL READ AS BARE-CHESTED"; lamp never lit | Failing | — |
| F.36 | "the court in full assembly on the Terrace" | court-assembly (court setting, D-182/D-199/D-221) | Render d221r2: files not legible; 150–250 people in a loose crowd (Phase 5 M1) | Failing | Court soak failing (M6) |

### §2 When
| # | Requirement | Implemented in | Verified by; latest evidence | Status | SCOPE-GAP / proxy risk |
|---|---|---|---|---|---|
| 2.1 | "Persepolis at the height of its glory" | 467 BCE (D-003) | Phase 0 review | VERIFIED (s1) | The default is court-absent: a working site, not "glory" (B9; UD-10 now changes this) |
| 2.2 | "Choose the exact year in Phase 0 and justify it in DECISIONS.md" | D-003 | Phase 0 review | VERIFIED | — |
| 2.3 | "The year is fixed; the date can move through it" | clock, calendar_467, shell date slider | Code | VERIFIED (code) | After 354 days the year replays identically (M7) |
| 2.4 | "… seasons change crops, trees, river flow, work and weather" | season.ts, plain crops, trees phenology, river stage | Soak `season` rows (green, dry, river) s8; node tests | PROXY-ONLY | No render outside spring except one snow frame (Phase 6-7 M6) |
| 2.5 | "The default start date is one on which the evidence places the court at Persepolis, preferably in spring" | 1 Nisannu = 17 Apr 467 | D-003 | PARTIAL (logged conflict B9) | No 467 date places the court; the year choice cannot meet this. Now overridden by UD-10 |
| 2.6 | "The trade-off … A later date gives more buildings and fewer names" | D-003 cost paragraph | — | VERIFIED (record) | The "names" side delivers none in the world (F.19) |
| 2.7 | "Construction is an asset. An active building site, with scaffolds, stone-cutters and rationed work gangs, is honest" | Hall 100 site, construction.ts, masons | Soak construction 51/51 weeks (s8); hall100-site render | PARTIAL | Distant gangs drawn standing (M5, impostor fallback) |
| 2.8 | "The king … is present only on dates the evidence supports. Otherwise he is absent, and the world shows it" | Default absent (D-003); court setting | B9 | VERIFIED (to the brief) | **Superseded by UD-10/D-236** (comings and goings by default, C); not implemented (M6) |
| 2.9 | "The Apadana reliefs … don't stage it as settled fact" | court.ts:11 "no procession is staged"; events_calendar E-24 note | Code | VERIFIED (code) | — |
| 2.10 | "Every structure, object, person and practice must pass the chronology filter in research/CHRONOLOGY.md" | lint_chrono.ts | lint:chrono OK today (78 structures, 2,709 parts, settlement rows) | PROXY-ONLY | Objects, dress, animals and practices are not in the lint (assets.json empty; name-only blocklist test for outfits in humans_runtime.test) |

### §3 Binding rules
| # | Requirement | Implemented in | Verified by; latest evidence | Status | SCOPE-GAP / proxy risk |
|---|---|---|---|---|---|
| 3.1 | "Numbers before pictures. Geometry comes only from research/SITE_SPEC.md, where every value has a source and tier" | site_spec.json → arch generators | arch.test today; Phase 2 | PARTIAL | Every row is "page not verified", capped at B (B6); town and plain geometry come from their own json (C) |
| 3.2 | "Evidence tiers everywhere … Every data row, asset, NPC, word and piece of music carries a tier in its data, visible in the dev overlay" | tiers in json; F3 overlay | lint:chrono tier checks; Phase 6-7 M3 (tiers inflated, fixed D-228) | PARTIAL | NPC tiers: the "recalled" and "composed" names are flagged; assets.json empty; no test that F3 shows a tier for every drawn object |
| 3.3 | "Primary sources win … Resolve against the excavation reports and log conflicts in research/OPEN_QUESTIONS.md" | OPEN_QUESTIONS (Q-600+) | Records | PARTIAL (blocked B6) | Primary reports unreachable; many rows are search extracts or "RECOLLECTION, NOT SEEN" |
| 3.4 | "Verify by measurement (§13). Screenshots find problems; they never prove correctness" | Many node measures | — | PARTIAL | The photoreal gate rests on a vision reviewer's scores of screenshots; the only photometric ground truth (§8.1) fails (B55) |
| 3.5 | "Fidelity is fixed … keeping the full target available as the top quality setting; log the numbers in BLOCKERS.md" | ultra preset; BLOCKERS | Phase 6-7 C1 (ultra terrain inverted) fixed in code a4dc698; terrain-lod-quality.txt | PARTIAL | Ultra frames almost never rendered or measured (M1, M11); performances.test failing "under load" never re-measured |
| 3.6 | "Accuracy beats beauty" | D-231 (near-fresh stone yardstick) | Records | VERIFIED (record) | — |
| 3.7 | "Honesty. A phase is done only when its gate passes. Placeholders are flagged in the dev overlay, PROGRESS.md and reports. Never describe intent as achievement … Every report leads with what is broken or placeholder" | PROGRESS problems-first; F3 placeholder flags (D-228 houses) | PROGRESS and HANDOFF lead with problems | PARTIAL | TASKS `[x] = gate-verified` misused; Phase 8 PASS stale; B11/B12 stale; evidence files deleted (M8); §1.1 "real and named" gap not listed |
| 3.8 | "Priority order … it is not permission to cut anything" | TASKS order | — | PARTIAL | Order 4 (the slice) never completed before 5–9 (M3) |

### §14 Phases
| # | Requirement (gate) | Implemented in | Verified by; latest evidence | Status | SCOPE-GAP / proxy risk |
|---|---|---|---|---|---|
| P.0 | Phase 0: "Every filled row sourced and tiered; independent geometry extraction diffed; review passed" | research/, SITE_SPEC | REVIEWS/phase0.md (pass on re-review, s1) | Passed with exceptions | Both "independent" extractions came from web-search dimensions, not the Schmidt plan (B1) |
| P.1 | Phase 1: "Terrain spot-checks and §13.6 pass; budgets recorded" | terrain, sky, weather; README budgets (re-measured s7) | Today: terrain, sky, weather tests pass; the JPL test skipped | Passed with exceptions, PROXY-ONLY | Sun vs astronomy-engine, not JPL (B2); climate vs published normals, not NOAA (B3) |
| P.2 | Phase 2: "Plan overlay and dimension tests pass" | plan.spec, arch.test | arch.test today; overlay (s2–s3) | PROXY-ONLY | The overlay compares against the OSM footprints the build used (circular) |
| P.3 | Phase 3: "All §13 checks pass for the slice; a walkthrough bot completes the route; the §1.1 moments on this route land in review" + "Built after the calibration scene matches its photo" | Slice | Rubric FAIL; browser bot s3; calibration fails B55; review not run | **NOT PASSED** | M3 |
| P.4 | Phase 4: "§13 passes for the whole Terrace" | Rest of Terrace | Review never run; botcheck 97 legs today (node) | **NOT PASSED** | "Whole Terrace" photoreal never covered (D-233 not built) |
| P.5 | Phase 5: "Full evidence-based population simulated; rendered floors met within budget; no pop-in; soak test (§13.11) passes" | population, crowd, soak | REVIEWS/phase5.md (2026-09-25): **FAIL**, C1 + M1–M6 | **FAILED** | Floor only with the court; court soak fails; pop-in browser never; impostor stand fallback (M5, M6) |
| P.6 | Phase 6: "Lints pass; layout sourced and tiered" | settlement | REVIEWS/phase6-7.md: FAIL (C1, now code-fixed); lints OK today | Gate text met; review FAIL | The gate text can pass on a town of boxes: the proxy is too narrow for UD-06 |
| P.7 | Phase 7: "Lints pass; proxy performance at the plain vista" | plain | Same review; the vista not re-measured at ultra after a4dc698 (no file on disk) | NOT PASSED | Memory never measured at the vista (review M1) |
| P.8 | Phase 8: "Language lint passes; every translation is sourced" | lang, translation layer | phase8_r3 PASS (s6); lint:lang passes today | Stale PASS | D-198's own English is "not checked against any published translation": is "every translation sourced" still true? Needs re-review (M8) |
| P.9 | Phase 9: "Full §13 pass" | — | — | NOT STARTED | — |
| P.10 | "Every gate leaves a runnable build" | — | tsc clean today; no browser boot run by me | BUILT-UNVERIFIED | Full `npm test` not green on the merged tree (s8 baseline 923/12) |
| P.11 | "Depth before breadth: perfect one route before spreading out" | — | — | **Not followed** | M3 |

### §15 How to run this
| # | Requirement | Implemented in | Verified by; latest evidence | Status | SCOPE-GAP / proxy risk |
|---|---|---|---|---|---|
| R.1 | "No questions, no pauses. Decide … Record the decision and the alternatives in DECISIONS.md. Proceed" | DECISIONS (D-001..D-236) | Records | VERIFIED | — |
| R.2 | "Plan first. Before Phase 0, create a task list covering every phase and gate, and keep it current" | TASKS.md | — | PARTIAL | Stale ticks (M8); MASTER_PLAN.md named as governing but absent at cc052dd |
| R.3 | "Parallelise independent work with subagents … Research subagents return citations, not recollections" | Agents per workstream | Records | PARTIAL | Many rows are "RECOLLECTION, NOT SEEN" (D-199, D-201, D-212), labelled; the rule was bent under D-207 |
| R.4 | "Preflight (Phase 0). Check the Node, Chromium, Blender and Python versions … Set a disk budget … Probe network access" | PREFLIGHT.md | s1 | VERIFIED (s1) | — |
| R.5 | "NEEDS_FROM_ME.md. Within the first hour, list exactly what I should supply …" | NEEDS_FROM_ME.md (s1, updated s8) | — | VERIFIED | — |
| R.6 | "Use the no-login fallbacks until I do. … check for them at the start of every phase" | Fallbacks in BLOCKERS | — | VERIFIED (records) | — |
| R.7 | "References … Catalogue them in references/INDEX.md, and recheck the folder every session … Where they conflict with the evidence, the evidence wins" | INDEX.md §1–§6 | s8 (second upload catalogued); review_briefs pairs them | VERIFIED (s8) | — |
| R.8 | "Blockers never end the run … Log it in BLOCKERS.md … revisit blockers at the end of each phase" | BLOCKERS.md | — | PARTIAL | B11/B12 stale (M8) |
| R.9 | "Gates bind. Never lower a gate to pass it. If a gate still fails … mark the phase 'passed with logged exceptions'; continue only if later phases don't depend on the failing item" | — | — | PARTIAL | Gates were not lowered (D-231 kept the gate), but the dependency rule was not applied (M3) |
| R.10 | "Memory across sessions. CLAUDE.md (the intent in §1.1 and the rules in §3, §10, §12, §13 and §15), PROGRESS.md, DECISIONS.md, BLOCKERS.md and the task list are your memory. Update them after every task, and commit at every gate" | CLAUDE.md | — | PARTIAL | CLAUDE.md compresses §13 to tool names (scope lost; M8); §1.1 bullets "real objects", "moments as scenes" absent |
| R.11 | "Push only if a remote is configured, and never force-push" | — | branch up to date with origin | VERIFIED | — |
| R.12 | "After any compaction … reread this brief and those files, then resume from the first unfinished task" | CLAUDE.md top | — | PARTIAL | CLAUDE.md now points first to MASTER_PLAN.md, which does not exist |
| R.13 | "Finish. Write FINAL_REPORT.md, problems first …" | — | — | NOT STARTED | Phase 9 |

### The user's later directions (UD-06..UD-14, D-233, D-236)
| # | Direction | Implemented in | Verified by; latest evidence | Status | SCOPE-GAP / proxy risk |
|---|---|---|---|---|---|
| U.6 | UD-06 "nowhere I go that takes me out of the illusion … every inch" | D-233; D-235 coverage harness (worktree, untracked `_probe_cov.ts`) | Nothing committed | MISSING (in progress) | Even when built it is still-frame, 960 × 540, rig lens, one state per point (M1) |
| U.7 | UD-07 "every single inch … people having their own lives, many different systems at play, a true sprawling simulation/sandbox"; "find what else is missing" | MASTER_PLAN.md (absent) | — | MISSING | Sandbox: talk to 0.3 %, inspect nothing, no errands outside visitor mode (M4, M10) |
| U.8 | UD-08 "nothing should feel fake, nothing copy pasted … a home and a life and a family … a job and a name and a history" | D-236 (record only) | person_census baseline: home 100 %, family 99.3 %, job 100 %, names 209, history none | PARTIAL | Bodies and faces 23 variants: a copy-paste not in the census; add a look-uniqueness census |
| U.9 | UD-09 "people visiting, coming and going, king coming and leaving, different events, all in real time, some random elements … not repetitive … some sort of seed element" | events calendar (14–20 kinds a week); traffic.ts; D-236 plan | Soak events gate (s8); my scene probe | PARTIAL | No scene-level gate; the court's comings and goings not built; the year replays identically; seed per game not built |
| U.10 | UD-10 "the king and court come and go by default … labelled reconstructed" | D-236; B9 edited | settings.ts:21 still `'evidence'` | MISSING | Court soak fails (M6) |
| U.11 | UD-11 "going above and beyond … a world full of surprises" | — | — | MISSING | No discovery metric (M7) |
| U.12 | UD-12 "make sure that this scope is preserved and that the master plan is updated" | USER_DIRECTIONS.md (append-only) | `tests/scope_ledger.test.ts` **does not exist**; MASTER_PLAN.md absent | PARTIAL | The ledger claims a test that is not there |
| U.14 | UD-14 "use your knowledge of that time to extrapolate everything … fill in every single gap" | D-207 fills; gap audit D-208 | Gap audit items 19, 20, 30, 32–36, 39–41 open | PARTIAL | No completeness inventory that fails on an empty category (M7) |
| U.D233 | D-233 "coverage replaces chosen moments as the photoreal standard" | Plan only | — | MISSING (in progress) | Add the time, weather, season, lens, motion, sound and quality axes (M1, M2) |
| U.D236 | D-236 names / history / never the same twice / court default | Record only | — | MISSING | — |

---

## 4. Recommendations (the checks that would have caught these, in order of payoff)
1. **Rewrite CLAUDE.md §13 in the brief's scope words** ("every walkable area", "objects", "as scenes", "whole Terrace", "on
   screen"), and add UD-06 to UD-14 as measurable gates. Commit `MASTER_PLAN.md` and `tests/scope_ledger.test.ts` before any more
   feature work.
2. **Coverage matrix, not coverage points.** Sample place × hour × date × weather × lens (player FOV) × quality (ultra). Include
   short motion clips (flicker, pop and ghosting metrics) and a 1440p crop set for detail and faces. Store the frames and stats in
   git-tracked, compressed form, so that evidence survives.
3. **Audio coverage.** Offline renders per coverage cell, loudness and layer metrics, a repetition detector, and a listening rubric.
4. **People on screen.**
   - Look-uniqueness census: bodies, faces and garment combinations per 100 people in view.
   - Identity census: names, histories, real named people present.
   - Addressability share within 3 m of the player in every zone.
   - An on-screen shadow review: follow a person in the browser and compare pose and prop with the sim, frame by frame.
   - Merge D-229's impostor frames and count the stand fallback as a placeholder.
5. **Walk bots everywhere walkable**, with an object-level pop-in probe (any mesh or instance appearing inside 50 m in view)
   and the population on.
6. **Scene-level variety gate** (same place and hour across days, on screen) and a discovery metric (distinct witnessable event
   kinds per km² per hour). Run every people gate on ≥ 3 seeds before D-236's per-game seed ships.
7. **Close stale claims:**
   - Re-review Phase 8 after D-198, D-202 and D-213.
   - Correct B11, B12 and the TASKS ticks.
   - Re-run the timing tests on an idle box, with a date.
