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

## Phase 8 carving (branch p8-carving-s6, head 519641d, D-176, D-177) — merged in session 6
**Still broken, unverified or placeholder (read first)**
- No GPU or e2e render of the incised signs: node preview only (tools/incision_preview.ts, XPa in OP and Elamite): wedges
  cut in and lit as cuts, with fine stepped banding on the cut walls (8-bit depth atlas, one-texel gradients).
- The stone mesh is not cut (a sign seen edge-on leaves no notch); the sun's shadow map does not resolve millimetre walls.
- 10 copies or versions of the royal programme not carved (Q-290, flagged in F3 data): XPc and XPd pillar copies (no anta
  face in the model); the DPb one-line copy and XPk (on royal garments: no garment surface on the procedural figures); XPg
  (glazed bricks, not modelled); XPj, XPm (which column bases not established); the Elamite and Babylonian versions of DNa
  and DNb and the tomb captions DNc–DNe (not in the corpus read).
- DNb's 26 lost signs are cut as blank spaces one sign wide (the stone was complete in 467: placeholder).
- 48 words where the two editions differ (Q-288): the world carves Kent's sign sequence; the translation layer shows
  Schmitt's words (ARIo) and says how many differ (39 of the 48 in DNb).
- 17 typing slips in the scraped corpus corrected in data/corpus/op_sign_decisions.json, each with evidence the tests check;
  neither Kent's print nor Schmitt's sign-by-sign edition was read.
**Done:** D-176 (corpus renamed data/corpus/op_translit.json, transliteration lines only, `_meta` basis, ASSET_LEDGER row,
source key OP-TRANSLIT; a test checks no English); build_op_signs.ts carves the corpus itself (word division and lines);
V-shaped incision, nothing proud (a test shows the wall normal lights the far wall of a stroke under a low sun); every
carved mesh records its signs and the language lint requires them to equal the data; src/data/royal_inscriptions.json lists
every copy standing in 467 (14 carved, 10 missing, hidden texts DPh, XPf, XPh, XPl). **Spelling check:** 1,043 corpus
words across 12 carved OP texts, 0 mismatches; Xerxes' name xa-ša-ya-a-ra-ša-a in all 14 places.
**Tests:** tsc clean; language/lang/inscriptions/translation/plain 85/85; lint:all OK; full vitest 618 passed, 1 failed
(humans_runtime CPU timing, passes alone), 1 skipped.

## Court in full assembly (branch court-s6, head 5d1c126, D-182) — merged in session 6
**Broken, unverified or placeholder (read first)**
- No browser render: every visible count and triangle figure is node (2.5-D sightlines, the crowd's main-pass counts).
  To run: tests/e2e/crowd_scale.spec.ts COURT scenes (4 views: court-forecourt, court-from-hillside, court-forecourt-w,
  court-apadana-n) and moments.spec `court-assembly` (day 30 10:00, `&court=seasonal`).
- Placeholders (court.json `_meta.placeholders`, PROGRESS, D-182): delegates and petitioners in the generic Median riding
  dress; no tents in the court camp (people drawn in the open, asleep too); the spearmen's apple butts are the ordinary
  spear; the royal women's night music (Heracleides) not performed.
- The king is not a person (B9); delegations wait "to be led before the king" and the audience happens out of sight (Q-335).
- Not simulated: the town's +13,000 retinue and the plain's +5,000 (only ~1,900 court people lodge in the court camp
  below the Terrace); the court's food does not draw on the calendar's stores.
- The 30-day court soak fails variety and population variety; the 30-day soak WITHOUT the court fails the same two gates
  with the same 88 people (the gate is set for a full year). Every court person passes; a road-station groom 0.085 →
  0.106 (the court's couriers). The year soak with the court was not run.
- Frame budget: the hillside view is over 12 M triangles on the world alone; the new Terrace views' world-only baselines
  are unmeasured.
- Load cost with the court setting: ~150 route pairs searched up front, 6.6–8 s on the loaded box (`view.stats.warmMs`).

**Composition** (src/data/court.json, research/COURT.md; counts C, Greek sources capped at B): 1,000 spearmen (Hdt 7.41,
7.83; Heracleides), 300 women of the royal household (Q-334), 200 attendants, 700 palace servants, 800 at the king's table
(Athenaeus 4.145–146; PF 0701), 450 porters, 60 butchers (PF 58–60), 320 officials, 550 Persians of rank, 537 parties /
4,230 petitioners and delegates (Apadana reliefs B for type, timing C). Total 9,310 (seed 1). Spearmen in 10 hundreds on a
five-day watch cycle at 21 stretches of 10 ceremonial posts. Present day 0 (Q-330) to day 116.
**Terrace by hour, day 30:** 00h 2,294 · 06h 3,198 · 08h 4,385 · 10h 4,448 · 12h 4,255 · 16h 3,229 · 20h 2,427 (target
~5,000 by day, 2,500 by night; without the court 758 at 10:00).
**Views (node):** court-forecourt-w 745 visible (day 30: 878), people 2.96 M tris; court-apadana-n 1,025 visible, 2.98 M;
hillside 2,305–3,699 visible. B11's ≥ 300 met by node estimate. Pop-in 0 over 1,811 frames / 633 m after route warm-up.
**Tests:** tsc clean; full vitest 625 passed, 1 skipped; new tests/court.test.ts (7), court_view.test.ts (3); lint:all OK;
botcheck 97/97. Q-330..Q-336.

## Simulation round-5 fixes (branch sim-s6, head be174b0, D-175) — merged in session 6
**Still broken, placeholder or unverified (read first)**
- The dust veil is not drawn: plans and tasks say "the face wrapped against the dust" (`Seg.wear` / `Task.wears`); the
  renderer ignores it (a new attribute with no performance behind it).
- The camp's flour piles up at the ovens: 479 sacks carried over the year, 203 kneaded, 282 left at year end (inside the
  stock gate; the kneading rate is C, Q-296).
- Two working values rest on memory, not a source read: the saddle-quern rate ~1 kg/h (Q-296), apprenticeship at home (Q-298).
- The new tests were written against the reviewers' measured numbers, not run against the round-5 code (7a09285).
- The village cap re-sorts the plain: households fall in different villages (named people keep their ids; kin and
  neighbour links rebuilt).
- Two tests fail under load (performances CPU budget; people.test determinism 300 s timeout); both pass when quieter.
**Each round-5 finding → done:** rain in the open field (no field work started into rain covering half the window; morning
showers waited out; rain during work sends people home within 0.5 h; Terrace work shelters under the Gate; the Treasury's
and palaces' inside work roofed; test: no shelter in the open over 0.5 h on rain days, was ~40,100 person-days/yr); the
start-of-year age (age on the day everywhere; infants in days; no child planned as an infant after its first birthday, was
up to 1,446); minding without the little one (planned from the little one's side, one schedule `mindDay`, `planCheck`
minding check); the camp's flour (barley depot → querns → ovens, every sack from one stock into another; the stock gate
covers all stocks); the guard's second breakfast (no meal within an hour of another); the lane in heat and dust (under 1 %
of men 2 h in the lane 13–17 h on 38–41 °C days, was 5–5.8 %; walking 0.7× in dust); home hours blind to standing and
light; the servant's estate day and the scribe's son; labels; names (no name covers more than a quarter of Egyptian men,
was 229 of 230); the sun (apparent sun, h0 −0.833°, within 1.5 min of astronomy-engine); villages capped at 3,000 (291–2,966,
was 219–8,491); pick coverage (leader of ten, rain-day field worker, child past a birthday, baby under four months, herder,
traveller, man by the grain heap).
**Soak (branch, on 499a55e): PASS all 8 gates** (bench-reports/soak-2026-09-24T04-33-22-283Z.json in the agent's worktree):
variety worst 0.019; populationVariety 43,245 measured, worst 0.067; events 14–20 kinds/week; stuck none; stocks sacks
0–283, no shortfall; renderedHonest pass; plansWellFormed 15,462,938 person-days, 0 issues, 118 checked days, 0 issues;
visibleChange 51/51 weeks. (The first run on d3d2dc1 failed plansWellFormed with 30 issues; fixed.)
**Tests:** tsc clean; people_days_r6 32/32; people and sim suites 108/108; full vitest 557 passed, 1 skipped; lint:all OK;
botcheck 97/97. Round-6 input REVIEWS/shadow_days_input_seed1_pick113.txt (not scored). Q-296..Q-299.

## Carving fix after the Phase 8 re-review (branch p8-carving-r2, head 01a3c24, D-184) — merged in session 6
**Still placeholder, broken or unverified:** no GPU render (incised signs, new Elamite/Babylonian lineation, the stacked
XPc/XPd panels are node-verified only); 146 carved OP signs are the editor's restorations of damage since antiquity (C;
carved because the stone was whole in 467; counted in each panel's F3 note: XPd 14, DNa 24, DNb 89, DPb 5, DPd 13, DPe 1);
DNb's 6 lost, unrestored stretches carved as 3 uncut blanks each (count unknown, C); XPc and XPd now stacked (OP above
Elamite above Babylonian, C: three columns no longer fitted the 2.4 m field; site_spec `r_stair_inscription` changed; a
check fails if a carved field does not fit); the Q-290 list (10 copies not carved) unchanged.
**Before/after:** before, against ario.catf, differing spans XPa 2, XPd 1, DNa 9, DNb 45, DPa 1, DPb 2, DPd 4, DPe 2; after,
a test with its own parser compares every carved text sign by sign (dividers and logograms): 5,276 signs and 1,029
dividers in 12 texts, 0 differences, empty EXCEPTIONS list. Named cases carved as the stone has them (XPa ha-a-xa; DNa
a-da-a-ra-i-ya; DPb logogram XŠ; DNa without the omitted ma; DPe sa-u-gu-da). Engraver's extra signs carved (6 + 1
divider); omitted signs not carved (43); restorations carved.
**Records:** data/corpus/ario_catf.json (166,028 B, CC0, ASSET_LEDGER, source key ARIO-CATF) via tools/extract_ario_catf.py;
op_translit.json and op_sign_decisions.json deleted with their ledger row and key; D-176/D-177 superseded in their sign
basis; Q-288 rewritten (Kent's rules vs the stone differ in 56 of 1,040 words, classed); PROGRESS carving entry rewritten.
Elamite/Babylonian panels in the edition's lines without word spaces (tools/build_cun_lines.py; 20 versions match).
**Tests:** tsc clean; 116/116 targeted; lint:all OK; full vitest 635 passed, 1 skipped, 1 failed (performances timing,
passes alone).
