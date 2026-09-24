# Independent review: Phase 8, round 2 (language, speech, music, translation layer, writing)

Reviewer: an independent subagent that did not see the build process. Date: 2026-09-24. Tree: `5d9af62`, branch
`claude/amazing-fermi-40ds7j`, clean working tree. It includes the session-6 merges of D-176/D-177 (carving, `ba92e95`),
D-178 (music and occlusion, `02f0947`), D-179 (writing on objects, `c65ae31`) and the session-5 layer workstream
(D-167/D-168, `de3ae7a`).

**Gate (§14, Phase 8):** "Language lint passes; every translation is sourced".
**Rule for passing (§13.9):** no open CRITICAL finding.

**Read:**
- PERSEPOLIS_BRIEF.md (all of it), CLAUDE.md, PROGRESS.md, TASKS.md (Phase 8), BLOCKERS.md (B17, B18, B20),
  NEEDS_FROM_ME.md (#14, #15), ASSET_LEDGER.md;
- DECISIONS D-167, D-168, D-176, D-177, D-178 and D-179. D-165 and D-166 do not exist: D-177 says they were never
  written;
- OPEN_QUESTIONS Q-284 to Q-290; research/OP_SIGNS.md; research/SOUNDSCAPE.md §8; research/SOURCES.md:175;
- REVIEWS/phase8.md and REVIEWS/phase8_b.md.

**Code read:**
- `src/lang/oldPersian.ts`, `src/arch/carving.ts`, `src/render/incision.ts`, `src/arch/inscription_text.ts`,
  `src/ui/translation.ts`;
- `src/audio/{music,musicDirector,performers}.ts`, and `src/world/world.ts` (the music wiring);
- `src/people/speech_lines.ts` (the line sources);
- the data: `data/corpus/op_translit.json`, `data/corpus/op_sign_decisions.json`, `src/data/{inscriptions,royal_inscriptions,writing}.json`,
  and the five lexicons;
- the test lists of `tests/{language,lang,inscriptions,writing,translation_layer}.test.ts`.

**Limits.** Playwright was not run, as instructed. Nothing here has been seen or heard on a GPU or in a browser.

## Verdict: **FAIL** (one open CRITICAL)

**What now holds, and was not true in round 1:**
- The gate text holds literally. `lint:lang` passes 26/26 and `lint:all` passes.
- Every English gloss the layer shows names its source. No translation is shown, and the layer states the licence
  reason (B17a).
- The session-5 CRITICAL, 22 % of carved Old Persian words misspelled, is fixed in substance. I checked every carved Old
  Persian sign stream against an independent, CC0, sign-by-sign edition (method in C1):
  - XPb, XPc, XPe and DPc agree sign for sign, with 0 differences;
  - the other texts differ in only a handful of places.
- Music now comes only from performers.
- Occlusion exists.
- All 73 lines are reachable.
- Writing on objects exists, and its placeholders are honestly flagged.

**What blocks the gate.** The builder's headline claim is "every carved Old Persian word is the published sign sequence
(1043 corpus words, 0 mismatches)". It is contradicted by the published CC0 sign-by-sign edition, which the project
itself lists in SOURCES.md and handed to the carving workstream:
- two of the builder's own "corrections of slips of the copy" remove a sign that the stone has, according to both
  sources;
- about seven further sign or divider differences are nowhere logged.

The fix is small (C1).

---

## CRITICAL

### C1. Two carved words are "corrected" against the stone, and the carving was never checked against the CC0 sign-by-sign edition the project already lists (§10 "published texts only, never invented"; §3.3; §3.7)

**Method (reproducible).**
- Downloaded `https://raw.githubusercontent.com/oracc/catf/master/ario.catf`. It is 166,028 bytes, the same size that
  research/SOURCES.md:175 records. Its README reads: "Canonical ATF version of Oracc data which is permitted to be
  released under CC0".
- Took the Old Persian version of each carved text by its ARIo number (XPa Q007209 … DPe Q007161).
- Mapped the CATF sign notation to sign names:
  - consonant letter → Ca; `disz` → ma; `munus` → fa; `sz` → ša; `xsz` → XŠ;
  - the Ci and Cu signs as written.
- Applied ATF's editorial marks:
  - `<<x>>` (excised, but on the stone) was kept;
  - `<x>` (supplied by the editor, not on the stone) was dropped.
- Compared the resulting sign-and-divider stream with `op_signs` in `src/data/inscriptions.json` using difflib. Scripts:
  the session scratchpad, `catf.py`, `cmp.py`, `cmp2.py`; output in `diffs_nonDNb.txt`.

**Result (signs in ARIo / as carved / differing spans):**

| Text | ARIo signs | carved signs | differing spans |
|---|---|---|---|
| XPa | 605 | 605 | 2 |
| XPb | 456 | 456 | **0** |
| XPc | 442 | 442 | **0** |
| XPd | 423 | 422 | 1 |
| XPe | 75 | 75 | **0** |
| DNa | 1,376 | 1,388 | 9 |
| DNb | 1,654 | 1,681 | 45 (mostly Kent vs XPl readings, logged as Q-288) |
| DPa | 100 | 100 | 1 |
| DPb | 39 | 46 | 2 |
| DPc | 38 | 38 | **0** |
| DPd | 530 | 529 | 4 |
| DPe | 555 | 557 | 2 |

**Carved against the stone by the builder's own "correction"** (`data/corpus/op_sign_decisions.json:5` and `:10`). In
both cases the scraped copy and ARIo's sign line agree with each other. The correction removes a sign both show:
- **XPa Hāxāmanišiya.**
  - ARIo XPa line 10 reads `h-<<a>>-x-a-disz-n-i-sz-`. The excised `a` is cut in the stone: an engraver's extra sign.
  - The copy has `Hâxâmaniš|iya`.
  - The builder "corrected" it to `Haxâmaniš|iya`, as "a stray length mark". So the stone's ha-**a**-xa is carved ha-xa.
- **DNa adāraiya.**
  - ARIo DNa line 22 reads `a-d-a-r-i-y`, with no editorial mark.
  - The copy has `adâraiya`.
  - The builder "corrected" it to `adâraya` (a-da-a-ra-ya), as "a stray i". So the stone's **i** is not carved.
- **Why the method missed both.** The `ario` evidence class (`tools/build_op_signs.ts:118-121`) compares against Kent's
  rules applied to Schmitt's *normalised* word. A normalised transcription cannot show an engraver's orthographic
  peculiarities. That is exactly what a sign-by-sign edition records.

**Other differences from the sign-by-sign edition, logged nowhere** (Q-288 and OP_SIGNS.md list the others):
1. **DPb:** the stone writes the logogram **XŠ** (`_%peo xsz_`, DPb line 1). The carving spells out
   xa-ša-a-ya-θa-i-ya, 7 signs instead of 1. OP_SIGNS.md counts DPb as "6 same, 0 logogram".
2. **DNa Auramazdā(ma)iy:** ARIo line 50 has `a-u-r-disz-z-d-a-<disz>-i-y`, where the ma is *supplied*, i.e. the
   engraver omitted it. The corpus's "(ma)" is carved as a sign. The code treats "(…)" as a restoration of damage
   (`oldPersian.ts:63`), but here it marks an omission.
3. **DPe Suguda:** ARIo `s-u-gu-<u>-d`: the stone has no u after gu. The Kent-convention speller always writes gu-**u**.
4. **Word dividers, a sign 𐏐 on the stone:**
   - XPa has one extra, inside *paruv:zanānām*. ARIo XPa line 8 has none; XPc has one, which may be where the copy took
     it from;
   - DNa has an extra one in *ariya:ciça*, and in *dadātuv : martiyā*;
   - one is missing at the end of XPd;
   - one is extra at the end of DPb.

**The records contradict themselves.**
- **Q-288** (`research/OPEN_QUESTIONS.md:220`) and **D-177** (`DECISIONS.md:2586`) say "Schmitt's sign-by-sign edition
  not read … a slip the copy shares with no other evidence cannot be seen". But:
  - `research/SOURCES.md:175` lists that edition ("ORACC ARIo in CATF, sign by sign … it holds the published Old Persian
    SIGN SEQUENCE … that the carving workstream needs (reported to the lead)");
  - D-167 (`DECISIONS.md:2456`) handed it over.
- **D-177** (`DECISIONS.md:2568`) says "DPd *visai̯biš* by rule (vi-i-sa-…) where **the stone** and Kent have
  vi-θa-i-ba-i-ša". ARIo's sign line reads **vi-i-s**-i-b-i-sz. This is an edition dispute (logged as a reading in
  Q-288), not what "the stone has".
- **PROGRESS.md:41-42** says "Done: every carved Old Persian word is the published sign sequence (1043 corpus words, 0
  mismatches …)". The "0 mismatches" is the carving measured against its own corrected copy.

**Why CRITICAL.** The category is the one that failed round 1: carved text that is not the published text. The builder
introduced these two errors itself, after a review, against two agreeing sources, and PROGRESS states the opposite.
The scale is small (2 signs, plus about 7 unlogged differences in about 5,000 non-DNb signs). So is the fix:
1. Revert the XPa and DNa corrections.
2. Add a test that diffs every carved stream against `ario.catf`. It is CC0 and already listed, and it avoids the
   D-176 licence question altogether (M1). Every remaining difference should then be an entry in Q-288.
3. Decide XŠ for DPb, and decide how supplied (`<…>`) signs are handled.
4. Correct Q-288, D-177 and PROGRESS.

---

## MAJOR

### M1. The carving rests on a scraped web copy when the project holds a CC0 published sign-by-sign edition. D-176's licence reasoning is partly wrong (§12, §3.3)
- **D-176** (`DECISIONS.md:2547-2566`) argues that Kent-convention transliteration is "a mechanical rendering … every
  letter but the inherent a stands for one sign". The corpus shows this is not strictly so:
  - the convention is not invertible: Cu and Cu-u are both written "Cu" (DPe Suguda, above);
  - "(…)" marks both a restoration and an engraver's omission (DNb `ayâu(ma)iniš` against DNa `Auramazdâ(ma)iy`);
  - the file holds editorial restorations and word division, and 17 of Livius' own typing slips.

  Restorations are the part of an edition most likely to be protected. D-176 also does not consider a database-type
  right in the Livius compilation, since the whole OP set was extracted.
- **The conclusion is defensible under USE = personal, non-commercial.** The ancient text is public domain, the stored
  file holds transliteration lines only (tested, `tests/lang.test.ts:105`), and the ledger row is honest
  (ASSET_LEDGER "Old Persian transliteration corpus").
- **The whole question was avoidable.** `oracc/catf` is "permitted to be released under CC0". It is Schmitt's current
  sign-by-sign edition with lineation and editorial marks, and it is already in SOURCES.md.
- **DNb carves Kent's 1953 text.** Q-288 says that in 39 words (§§ 8–11) this text is superseded by readings from the
  XPl duplicate. It also leaves 26 signs uncut that ARIo restores (flagged PLACEHOLDER). §3.3 says primary sources win.
  The newer standard edition is in hand, and carving the older, superseded restorations needs a stated reason. None is
  given beyond "the corpus is carved".

### M2. PROGRESS and TASKS do not describe the tree (§3.7, §15.8)
- **PROGRESS.md:4** says music is "not merged by this workstream". It is merged (`02f0947`).
- **PROGRESS.md:37** says the carving is "branch `p8-carving-s6`; unmerged". It is merged (`ba92e95`).
  PROGRESS was last committed at `519641d`, before that merge.
- **PROGRESS.md:121** still says "The new intents (affirm, refuse, ration) are not yet called: visitor mode will use
  them". All 14 intents are now called (D-168; `tests/exchanges.test.ts` passes). D-168 asked the lead to correct this.
  This was round-1 A-C2: the code is fixed, the text is not.
- **PROGRESS.md:223** says "the Gate guard … asks for the halmi (Elamite *halmi*)". Guards ask in Aramaic
  (`arc.ask_document.igra`, D-168). This is an overclaim flagged in round 1 (A-minor 7) and still uncorrected.
- **The Phase 8 row (PROGRESS.md:284)** is session-3 text:
  - it omits D-167, D-168, D-176 to D-179;
  - it omits the measured voice-acceptance failure (B17b);
  - it omits the music and writing placeholders.
- **TASKS.md:67** marks "Lexicons … 73 lines, 372 voice clips" as `[x]`, which the file's own legend defines as
  "gate-verified". But the §10 voice acceptance was measured and **not met** (D-167, B17b).
- **TASKS.md** has no Phase 8 line for the carving (D-176/D-177), photo mode or the Now view. Round-1 B-M6 is still open.
- **NEEDS_FROM_ME #14** lists only XPa–XPe, DNa, DNb and DPh as the texts needing a translation. DPa–DPg are now carved
  too.

### M3. §10 voice acceptance measured and not met; the identified fix was not tried (§3.5)
- D-167 measured it three ways plus spectrograms, and the verdict is **NOT accepted**:
  - machine phone recovery is near chance;
  - men's F0 is 83 Hz, about 2 SD below Hillenbrand's norm;
  - the pitch range is 0.6–1.5 semitones, nearly monotone.
- Both faults are synthesis parameters. D-167 names a build path (PyPI `espeakng-loader`, libespeak-ng 1.52) but says
  "it was not built here".
- §3.5 asks for at least three *approaches to meeting the target*. Three ways of *measuring* it are not the same thing.
- It is honestly logged (B17b, Q-287), and the 372 clips still ship.

### M4. §11 music is partly delivered, and the rest is placeholder or declined (logged)
- **Instruments.** §11 says instruments are "modelled at true size and played with matching animation". There is no
  harp model and no playing or singing animation: singers move the speech jaw. The court women wear working dress.
  All of this is flagged PLACEHOLDER in F3 (`performers.ts` `visual.note`) and in PROGRESS.md:4-9.
- **The magus's chant.** The brief says: "a magus chants, unaccompanied, with text from the lexicon".
  - D-178 and B20 decline it as an invented liturgy of a living religion.
  - But the brief itself prescribes exactly this C-tier composition from lexicon words, and the practice is attested
    (Herodotus 1.132, SOUNDSCAPE M-06).
  - This is a user-level decision, correctly routed to B20. Meanwhile a §11 deliverable is missing.
- **Also missing:**
  - herders' pipes (herders are not rendered, Q-302);
  - "foreigners: their own traditions" beyond the Ionians.
- **Unverified in a browser:** the worker render path, the node chain and the mix (D-178).

### M5. Writing on objects: the central §1.1 object is still a placeholder (B18)
- The scribes' room tablets carry wedge impressions with no readable text. This is flagged in writing.json
  (`pt_letter.placeholder: true`), F3, the layer and PROGRESS.md:10-16.
- The only real texts in clay are two seal formulas: SDa and Q009270.
  - Which wording stood on which Treasury seal is C (Q-320).
  - These two texts are not in `ario.catf`, so I could not check their signs against a sign-by-sign edition. They are
    spelled by rule (tier B, as stated).
- No Aramaic is rendered anywhere. The leather is rolled, with its text inside. This is honest, but §10 "Aramaic ink on
  leather" is not visible.

---

## MINOR
1. **Elamite and Babylonian panels are laid out with modern word spaces** (`carving.ts:116-119`: a space advances by a
   glyph width). The texts also flow to the panel width, so the published lineation is not kept
   (`inscription_text.ts:17-18`, `lined: false`). Achaemenid Elamite and Babylonian royal texts do not space words.
   The Old Persian now keeps the corpus lineation.
2. **Licences, share-alike.** The app bundles Strong's and Perseus (CC BY-SA). The ORACC RIBo/CAMS/HBTIN text is
   "licences not checked" (ASSET_LEDGER lexicon row). D-167 deferred the decision "for the lead", and no decision exists
   (grep of DECISIONS for BY-SA).
   - TRANSLATION_STATUS (`translation.ts:53`) reads §12 as permitting "only CC0, CC-BY or CC-BY-NC".
   - Under that reading, the bundled BY-SA lexicon sources would also be excluded.
   - The reading should be one or the other.
3. **The audio lint's hash check is self-referential.** The manifest was stamped from the files that ship (D-167). The
   only content check on audio is 0.05–0.8 s per phone (`tests/language.test.ts:339-340`). A swapped clip with a
   regenerated manifest passes. This is structural; no acoustic check is possible here.
4. **The incised signs are a parallax effect on quads lying 0.5 mm in front of the face**, not cut geometry
   (`incision.ts:9-10`). This is stated. Still unverified on a GPU:
   - z-fighting at range;
   - the silhouette;
   - shadow-map interaction.
5. **Subtitle glosses of tier-A lines** ("Live long!", "By the favour of Ahuramazda") are the builder's own English. They
   are sourced to the Old Persian passage and the lexicon, which is consistent with D-167. Composed English is shown
   for speech, while a single inscription phrase is never rendered. This is defensible and should be stated in D-167.
6. **Chronicle E-31** still reads "a named mountain" without the name (round-1 B-minor 6; sim calendar).
7. **Egyptian and Lydian speakers** still murmur with Aramaic phonotactics, flagged C (Q-025).
8. **The translation-layer e2e** has not been re-run since D-168 (PROGRESS "rerun pending"). The layer is unit-tested
   only.

---

## Round-1 findings, re-checked

| Round-1 finding | Status | Evidence |
|---|---|---|
| A-C1 / B-C1: carved OP misspelled (22 % of words; Xerxes' name) | **Fixed in substance; new narrow defect (C1)** | CATF diff above: XPb, XPc, XPe and DPc identical; Xerxes' name xa-ša-ya-a-ra-ša-a (14×, `tests/lang.test.ts:80`); 2 builder-introduced errors and about 7 unlogged differences remain |
| A-C2: 45 of 73 lines unreachable; PROGRESS contradicted | **Code fixed; PROGRESS text not** (M2) | `tests/exchanges.test.ts` passes (73 reachable); PROGRESS.md:121 unchanged |
| B-C2: translation blocker contradicted by own records | **Fixed** | D-167; `TRANSLATION_STATUS` (`translation.ts:53`); NEEDS #14 and B17a now state the licence reason; `tests/translation_layer.test.ts:60` |
| A-M1: lint blind to audio, DOM, data, spelling | **Fixed** (limit: MINOR 3) | `tests/language.test.ts` 26 tests: canvas sources, data fields, SVG/CSS, images, the carved signs read back from the meshes, audio manifest and hashes, 20,000 murmur phrases |
| A-M2 / B-M1: layer shows OP for El/Bab panels | **Fixed** | `translation.ts:107` reads `el_atf` / `bab_atf` per picked version; test `translation_layer.test.ts:44` |
| A-M3 / B-M2: no music in the world | **Partially fixed** (M4) | `world.ts:237-239` builds `MusicSystem` and `MusicDirector`; `performers.ts` schedule; `lint:music` OK (3,450 gig-minutes, all sourced); unheard |
| A-M4: tablets blank, no leather, false sealing note | **Partially fixed** (M5) | `writing.json`: real seal texts, tablets PLACEHOLDER, door sealing now impressed; `tests/writing.test.ts` passes |
| A-M5: most of the royal programme missing | **Largely fixed** | `royal_inscriptions.json` `carved`: XPa–XPe, DPa–DPg, DNa, DNb; 10 missing copies with reasons (Q-290), flagged in F3 (`inscriptions.test.ts:124`) |
| A-M6: signs raised, not cut | **Fixed in node; GPU unverified** | `carving.ts`, `incision.ts`; `inscriptions.test.ts:55-113` (on the face within 1 mm, V-section, far wall lit) |
| A-M7: Aramaic entries without attestation | **Fixed** | 97 of 99 attested (OSHB verses); `myn`, `śʿryn` tier C and kept out of the murmur |
| B-M4: voice acceptance not attempted | **Attempted; not met** (M3) | D-167, B17b |
| B-M5: no audio occlusion | **Fixed in node; unheard** | `src/audio/occlusion.ts`; `tests/occlusion.test.ts` passes |
| B-M6: photo mode / Now view absent from TASKS | **Not fixed** (M2) | TASKS.md:65-68 |
| B-M7: SOUNDSCAPE missing music claims | **Fixed** | SOUNDSCAPE §8 M-01…M-17; `lint:music` ties every cited claim to a row and tier; mode order open as Q-300 |
| A-minor 1: lineation re-flowed | **Fixed for OP; open for El/Bab** (MINOR 1) | `op_lined`; test "same number of lines" (`lang.test.ts:148`) |
| A-minor 2: XPa version per colossus | **Resolved** | Q-289; `royal_inscriptions.json` XPa op 4 / el 4 / bab 4 |
| A-minor 3: DNb drops avākaram-ci-mai̯ | **Fixed** (carved as Kent reads it: `avâkaram\|camaiy`, a Q-288 reading) | `inscriptions.json` DNb `op_words` |
| A-minor 4/5, B-minor 1/2: subtitle forms, "grc" | **Fixed** | D-168; `language.test.ts:120`; `LANG_NAMES` |
| A-minor 7: guard asks *halmi* | **Code unchanged (correct: Aramaic); PROGRESS still wrong** | PROGRESS.md:223 (M2) |
| A-minor 8 / B-minor 3: tiers not in F3 | **Fixed** | D-168 and D-178 `soundLines()`, `MusicDirector.lines()` |
| A-minor 11: share-alike sources | **Open, undecided** (MINOR 2) | D-167 deferred to the lead; no decision |
| B-minor 5/6/7 (backend, raw ids, layer-off test) | **Fixed** | D-168; `translation_layer.test.ts:27` |

## What I verified, and how

| Check | How | Result |
|---|---|---|
| Gate: language lint | `npm run lint:all` | chrono OK; lang **26/26**; activity OK (0 placeholders); music OK (13 claims, 4 never performed) |
| Scope unit tests | `npx vitest run tests/{lang,inscriptions,writing,music,performers,occlusion,translation_layer,exchanges,speech}.test.ts --maxWorkers=1` | 9 files, **116 passed** |
| Types | `npx tsc --noEmit` | exit 0 |
| Carved OP = published sign sequence | CATF diff (C1) | 4 of 12 texts identical; 2 wrong corrections; about 7 unlogged differences outside DNb |
| D-176 licence reasoning | read D-176, the corpus `_meta`, the ledger row; oracc/catf README | conclusion defensible for USE; reasoning partly wrong; a CC0 alternative exists (M1) |
| Every translation sourced / flagged | `translation.ts` `inscriptionReading`, `writingReading`, `TRANSLATION_STATUS`; `speech_lines.ts` `src` per line | no translation shown, the reason stated; glosses carry lexicon sources; subtitles carry the line's `src` |
| No modern language in the world | lint scope (`language.test.ts:178-270`); songs are wordless vocalise (`song.ts`, M-15); the layer is hidden when off (`translation.ts:176`) | none found in code; audio content not audited acoustically |
| Music diegetic and tiered | `music.ts` `refusal()` (offering, court absent, no claim, no position); `musicDirector.ts` (earshot 120 m, at the performer's position); `performers.ts` claims per gig | diegetic by construction; every gig cites tiered §8 claims; placeholders flagged |
| Director → performer mapping | `musicDirector.ts` `agents[p.agentId]` against `sim.ts:123` (`id = this.agents.length`) | ids are indices: correct |
| Placeholder honesty | writing.json flags; `performers.ts` `visual`; `royal_inscriptions.json` `missing`; PROGRESS top block | honest in data and F3; PROGRESS stale on merge status (M2) |
| El/Bab sign mapping | spot check of XPa/XPb ATF → Unicode (`{d}na-ap` 𒀭𒈾𒀊, `ir-ša₂-ir-ra` 𒅕𒃻𒅕𒊏, `{AŠ}mu-ru-un` 𒀸𒈬𒊒𒌦, `DINGIR GAL-u₂` 𒀭 𒃲𒌑) | correct where checked; not exhaustive |
| Seal texts | `writing.json` against `data/corpus/ario.jsonl` Q007203, Q009270 | verbatim; not in `ario.catf`, so the signs are by rule (B) |

**Not verified:**
- anything rendered or heard: the incision on a GPU, the music worker and mix, occlusion by ear, the clay relief in a
  browser, and the layer's e2e;
- the DNb differences one by one (Q-288 covers them in aggregate);
- the full Elamite and Babylonian sign mapping.
