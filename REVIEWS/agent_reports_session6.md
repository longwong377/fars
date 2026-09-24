# Agent reports, session 6 (copied by the lead from the agents' final messages; agents cannot write outside their worktrees)

## Music and audio occlusion (branch p8-music-s6, head 3b38ee9, D-178) — merged 02f0947
**Broken, unverified or placeholder (read first)**
- Not heard: no browser run. Untested: the pieces rendering in a Web Worker, the Web Audio chain (panner → low-pass → gain
  → channel), the mix by ear, whether the court musicians face the right way.
- Visual placeholders (flagged in F3, PROGRESS, D-178): singers keep their work pose, the speaking jaw stands in for
  singing; the court women sit in the working women's dress, with no harp model and no playing animation.
- Missing: the magus's chant (Herodotus 1.132 gives no words; a living religion's liturgy; three approaches tried; offerings
  stay silent: B20, Q-301). Herders' pipes (herders not rendered: B20, Q-302).
- Instruments never used: lyre, lute, double pipe, frame drum, clappers exist as sound code, but no source for who played
  them here, so no one does.
- Occlusion gaps: town and plain buildings, columns, people, roofs as barriers, paths through two doorways in a row; birds,
  wind and rain are not occluded.
- Timings noisy (shared, loaded box: ±2×).

**What plays, where and when** (src/audio/performers.ts; SOUNDSCAPE §8, M-01..M-17)
- Quern song (C): a work-camp woman at her quern sings in daylight, fair weather; ~30 % of 20-minute stretches, 3–6 min,
  Babylonian tuning; basis Athenaeus 14.618 (Greek millstone song) as an analogy.
- Mason's song (C): only Ionian stonecutters dressing stone, 12.5 % of stretches, a Greek mode.
- Court supper (practice B, details C): court setting on and court resident; 0.5–2.5 h after sunset in the Hadish; four
  women sing with two angular harps (Heracleides via Athenaeus 4.145c; Athenaeus 13.608a).
- Night watch (B): half the half-hour blocks until 0.5 h before sunrise, one voice and one harp (Athenaeus 12.514b).
- Songs have no words (no text attested): vocalise on open vowels, sung by the speech synthesiser; a sung note within 10
  cents of its pitch. A performance citing no claim, anything at an offering, and court music without the court are
  refused. Tuning fixes (Kilmer; Greek Phrygian/Lydian had been mislabelled; Q-300).

**Occlusion** (src/audio/occlusion.ts): 0.5 m plan grid of the Terrace's solids with two height intervals per cell
(doorways and windows stay open), built at load in 70–270 ms; per source the paths through doorways and over wall tops by
Maekawa's barrier formula (≤ 25 dB per edge) plus −55 dB through walls; a closed door leaf −22 dB; the strongest path sets
the low-pass. Applies to speech, murmur, music, fires, tool strikes. Measured at the Hadish: through walls −52..−55 dB; on a
doorway's line 0 dB; off axis at ~22 m −16..−19 dB, low-pass ~2.1 kHz. Plain → Terrace: −9.7 dB, 2.7 kHz 15 m in; −13.2 dB
45 m in. Cost 85–105 µs per query, 3 sources re-checked per frame (~0.3 ms).

**Tests:** tsc clean; full vitest 581 passed / 1 skipped (63 files; new occlusion, performers tests); lint:all incl. new
lint:music. Records: D-178, B20, Q-300..Q-304, SOUNDSCAPE §8.

## Writing on objects (branch p8-writing-s6, head 068bc35, D-179) — merged c65ae31
**Placeholders, gaps and unverified parts (read first)**
1. The Elamite text on every tablet is a placeholder: no Persepolis Treasury (PT) text reachable (ISAC, archive.org,
   JSTOR, academia.edu, ORACC, Livius: 403; the CDLI dump on GitHub has only PF 1–60, 400–406). Tablets have the right
   form, lines of wedge impressions and a sealed left edge, no readable text and no invented signs. B18, NEEDS #15.
2. The reachable Fortification texts (509–493, archived) were not used: anachronistic in the Treasury in 467.
3. The only real texts in clay are two ARIo seal inscriptions (CC0): SDa (Q007203) and Q009270 (Xerxes). Which wording
   stood on which Treasury seal is C (Q-320).
4. Seal figures are crude C compositions (SDF hero and lions); no licensed seal image.
5. No Aramaic shown: leather scrolls are rolled, tied and sealed; the Bowman chert ink texts unreachable; the Imperial
   Aramaic font still never loaded (review M4).
6. Not rendered in a browser (node raking-light previews only): scribes' room, Treasury E / Hall 99 door sealings.
7. Atlas bake ~1–1.2 s on the main thread at load.
8. New lint rule: a source file calling charToGlyph/getPath/stringToGlyphs/forEachGlyph must be registered as an in-world
   text site (the carving branch's carving.ts / incision.ts must be registered when they merge).
9. Seal sizes and wedge layout are C values in writing.json/writing.ts, not SITE_SPEC (tablet and lump sizes are).

**Built:** src/world/writing.ts (one 1024² height field in mm baked into a tangent-space normal map on the clay; signs from
Noto glyph outlines), src/data/writing.json (tools/build_writing.py); scribes' room: filed tablets written on both faces,
fresh tablets, one unfinished unsealed tablet, 3 leather scrolls with bullae; the door sealing a flattened lump with a
rolled impression (F3 says "NOT impressed" if fonts did not load); the carried tablet prop uses the same geometry at LOD 2.
**Cost (node):** scribes' room 6 → 9 draws, ~13 k → 37,288 triangles; door lump 252 → 520 triangles; one 4 MB texture.
**Tests:** tests/writing.test.ts 10 pass; lint:lang 26/26; full vitest 557 passed, 1 failed (performances timing test under
load; passes alone), 1 skipped. Records: D-179, B18, NEEDS #15, Q-320..Q-322, research/WRITING_ON_OBJECTS.md, ASSET_LEDGER.

## Crowd merge fix round (branch crowd-s6, head 2d3af09, D-143 merge addendum) — merged in session 6
**Still broken or unverified (read first)**
- Two CPU timing tests fail on the loaded box (load 7–13 on 4 cores); limits not lowered. The D-142 crowd-CPU test (300
  performers, limit 10 ms) measured 10.6–16.7 ms; an A/B at the same load gave the pre-merge D-142 crowd.ts 16.7/14.8/11.7
  ms and crowd-s6 14.2/15.1/10.6 ms (load, not the merge). The crowd half of the view-cost test (limit 12 ms) measured
  8.0–12.9 ms. Both need a quiet machine. Lead re-run after the merge (load 7): 10.66 ms against 10.
- No browser render of the merged crowd (tests/e2e/crowd_scale.spec.ts to run). B11–B13 stand; their numbers predate the merge.
- A threshing floor or drum no longer jumps, but where it stands depends on history (anchored while anyone still performs
  there; deterministic for the same history; C).
- Not done: impostors use the base activity's animation, not the variant's; impostors within 60 m make no tool sounds; the
  population's bearers are not a group (Q-196); the population's grinders have no quern.

**Changed:** shared work objects keep their anchor while their place has a performer (a bier passes to the lowest id left
only when its bearer leaves; a time jump re-anchors; drawn when any performer is within 400 m) — test: camera turns at fov
70/25, anchors become impostors or leave, LOD caps to 0: every object within 3 cm (0 m measured over 44 frames, 16 drawn
sets); real-data test (v_masumabad threshing floor, worksite drums): worst move 0.0000 m over 24 turns + 300 s. The view
cost: `collect()` refilled all 7,692 outdoor people every update (4–5 ms), not slow plans; each person now keeps its view
object and is refilled only on change: 0.83–1.05 ms; view test 2.39–4.64 ms at 1×. Walking phase advances out of view.
`Math.hypot` → sqrt in per-person loops. `crowd.stats().placeholderActs` 0 in the five busiest scenes.
**Tests:** tsc clean; full suite 540 passed, 2 failed (the timing tests), 1 skipped; lint:all OK; botcheck 97/97.
