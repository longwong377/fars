# Independent review: Phase 8, round 3 (language, speech, music, translation layer, writing)

Reviewer: an independent subagent that did not see the build process. Date: 2026-09-24. Tree: `f8882b5`, branch
`claude/amazing-fermi-40ds7j`, clean working tree. Since round 2 (`5d9af62`), the tree adds D-184 (carving round 2,
merge `b91dfe5`) and D-185 (voices, merge `7cec867`). The music, writing-on-objects, lexicon, speech-line and exchange
code is unchanged since round 2 (`git diff --stat 5d9af62..HEAD`): only `src/audio/speech.ts`, `src/audio/phonemes.ts`
and `src/ui/translation.ts` changed in the Phase 8 source.

**Gate (§14, Phase 8):** "Language lint passes; every translation is sourced".
**Rule for passing (§13.9):** no open CRITICAL finding.

**Read:**
- the brief: §1.1, §3, §9.4, §10, §11, §12, §13 and §14;
- CLAUDE.md, PROGRESS.md, TASKS.md (Phase 8), BLOCKERS.md (B17, B18, B20), NEEDS_FROM_ME.md, ASSET_LEDGER.md and
  REAL_HARDWARE_TODO H8;
- DECISIONS D-167, D-168, D-176, D-177, D-184 and D-185. D-165 and D-166 do not exist: D-177's heading says they were
  never written;
- OPEN_QUESTIONS Q-287, Q-288, Q-289, Q-290, Q-301 and Q-320; research/OP_SIGNS.md;
- REVIEWS/phase8.md, phase8_b.md and phase8_r2.md.

**Code read:** `src/lang/oldPersian.ts`, `src/arch/inscription_text.ts`, `src/arch/carving.ts`,
`src/render/incision.ts`, `src/ui/translation.ts`, `tools/build_cun_lines.py`, `tools/build_inscriptions.py`
(`atf_to_cun`), the `speech.ts`/`phonemes.ts` diff, the `speech_lines.ts` header and glosses, `audio/tuning.ts` and
`audio/instruments.ts` (headers), and `tests/lang.test.ts` (its own edition parser).

**Limits.**
- Playwright was not run, as instructed.
- Nothing in this scope has been seen or heard on a GPU or in a browser. Unverified: the incision shader, the music
  worker and mix, occlusion by ear, the clay relief, the voices by ear, and the translation-layer e2e (last passed in
  session 3; not re-run since D-168).

## Verdict: **PASS** (no open CRITICAL finding). Five MAJOR findings stay open, three of them honestly logged blockers.

**The round-2 CRITICAL (C1) is fixed.** I checked it independently of the build and of its test:
- I downloaded `ario.catf` again: 166,028 bytes, sha256 `eb8de252…fe9c`, the value the ledger records;
- `data/corpus/ario_catf.json` holds its lines verbatim for all 15 texts (every stored line was found in the file);
- my own parser turned the Old Persian lines into sign streams (script: scratchpad `r3/opcmp.py`, method below);
- I compared every carved `op_signs` line with it, line by line.

The result: all 12 carved Old Persian texts (and DPh) are identical, line for line, sign for sign and divider for
divider. My counts reproduce the builder's figures exactly:
- 5,258 signs, plus 18 uncut blanks, give the builder's 5,276 positions;
- 1,029 dividers;
- 146 restored signs, 6 extra signs and 1 extra divider carved;
- 43 omitted signs and 7 omitted dividers not carved.

**The gate text holds.**
- `npm run lint:all` passes: lang 26/26.
- No English translation is shown anywhere in the world or the layer, and the layer states why (B17a).
- Every English gloss the layer shows names its lexicon source.
- Every subtitle names its line's source passage.

**What stays open** is MAJOR, not CRITICAL:
- a small new instance of the C1 class in the **Elamite**: 2 signs the scribe omitted are carved, and 65 restored signs
  carry tier A/B;
- the records are stale about D-184 and D-185, in the conservative direction;
- the bundled lexicon's share-alike and unchecked licences;
- the voice acceptance, which is only machine-measured;
- the music placeholders and the tablets' placeholder text, both blocked and logged.

---

## CRITICAL

None open.

**Checked and not found:**
- no gate text is false;
- no §3 rule is broken outright;
- no chronology or anachronism breach: every carved text is Darius I or Xerxes, and A1P, A2 and A3 are absent by rule;
- no modern language is rendered or heard in the world (lint 26/26, plus the checks below);
- no PROGRESS claim of achievement is contradicted.

**Two PROGRESS status phrases are contradicted by the tree**, in the direction of understatement (M2). Its Phase 8 row
still says "fix in progress" and "re-render in progress" for work that is merged. I did not grade these as CRITICAL.
The §3.7 rule this category protects is "never describe intent as achievement", and these phrases describe achievement
as intent. The phase is still marked **Not passed**, so the gate is not overclaimed.

---

## MAJOR

### M1 (new). The Elamite panels carve 2 signs the scribe omitted, and the carved El/Bab restorations are not tiered C: D-184's "as the stone stood in 467" rule is applied to the Old Persian only (§10 "published texts only", §3.2 tiers)
- **The two omitted signs.** ARIo marks two Elamite signs as *supplied by the editor* (`<…>`, not on the stone), in
  the same notation D-184 uses to leave 43 Old Persian signs uncut:
  - XPa El line 11 `{d}u-ra-mas-da-<na>` (`data/corpus/ario_catf.json:40`);
  - XPd El line 8 `sza2-ak-<ri>` (`:235`).
- **Both are carved.**
  - `tools/build_inscriptions.py:42` strips `<>` from each token: `tok.strip('[]<>#!?*')`.
  - `tools/build_cun_lines.py:23` does the same by keeping the token.
  - XPa's carved `el_lines[10]` reads …𒀭𒌋𒊏𒈦𒁕**𒈾**𒄭…, and XPd's `el_lines[7]` ends …𒃻𒀝**𒊑**.
- **Why it matters.** This is the error class of round-2 C1: DNa's omitted *ma* was carved there and counted in that
  CRITICAL. It is graded MAJOR here because:
  - there are only 2 signs among roughly 5,000 Elamite and Babylonian signs;
  - D-184 and PROGRESS claim the 467 rule for the Old Persian only, and describe the El/Bab signs as "unchanged", so no
    stated claim is false;
  - the fix is one line: drop `<…>` content in `atf_to_cun`, then rebuild.
- **The restorations.** About 65 El/Bab sign values that the editor restored (`[…]`) are carved:
  - XPa El 12 and Bab 14;
  - XPb El 5;
  - XPd El 10 and Bab 5;
  - DPb Bab 10;
  - DPc El 2;
  - DPg Bab 7.

  Carving them is consistent with D-184. But their tier is `el_bab_signs: "B (ATF indices → OSL)"`, and `el_lines` is
  "A (the edition's lines…)". The panel note (`src/arch/decor.ts:179`) counts restorations as C for the Old Persian
  only. Under §3.2 these signs are C and should be counted in the F3 note, as the Old Persian ones are.
- **Stale tier label.** `version_split` is still "C (heuristic split of the ARIo running text)", and the layer shows
  it (`src/ui/translation.ts:122`). But `build_cun_lines.py` now shows that all 20 carved El/Bab versions equal the
  CATF lines exactly, so the split is verified.
- **Unresolved.** The CATF writes parentheses in some Elamite lines, for example XPa `{DISZ}(LU2.MESZ-)ir-ra` and
  DPf `(LU2.)`. `build_cun_lines.py:26` drops them and carves the signs. DPf stands in a single copy, so these are
  probably not copy variants. What ARIo means by them is not stated anywhere in the repository. I could not check it:
  oracc.org does not answer.

### M2 (round-2 M2, partially fixed). PROGRESS, TASKS and NEEDS do not yet describe D-184 and D-185 (§3.7, §15.8)
**Fixed since round 2:**
- the music and carving merge status (PROGRESS.md:10, :43);
- the "intents not yet called" line (PROGRESS.md:131 now says they are called);
- the halmi line, reworded to "asks, in Aramaic, for the halmi (… the word is Elamite *halmi*)" (PROGRESS.md:232). This
  is defensible: the Aramaic line is `arc.ask_document.igra`, and an Elamite speaker asks with `el.ask_document.halmi`;
- the TASKS legend (the lexicon line is `[~]`, no longer `[x]`);
- photo mode and the Now view are now listed in TASKS (round-1 B-M6).

**Still stale:**
- **PROGRESS.md:293 (Phase 8 row)** says:
  - "C1 … fix in progress": D-184 is merged (`b91dfe5`) and measured, with 0 differences, which I confirmed;
  - "voice acceptance measured and not met (B17b; re-render in progress)": D-185 is merged (`7cec867`), and its machine
    thresholds are met, which I re-measured.

  Neither D-185 nor its remaining gaps appear anywhere in PROGRESS: `grep D-185 PROGRESS.md` finds nothing. Those gaps
  are that no human has rated the voices, machine phone recovery did not improve, and the Babylonian and murmur voices
  are unchanged. The top "Broken / placeholder" block has no session-6 voice entry.
- **TASKS.md:67** says "voice acceptance measured and NOT met (…; re-render session 6)", and **TASKS.md:68** says
  "carved OP … (D-176, D-177; re-review C1 open)". Both predate D-184 and D-185, and both name the superseded D-176/D-177
  basis.
- **NEEDS_FROM_ME #14** (NEEDS_FROM_ME.md:26) lists the texts needing a translation as "XPa … DPa–DPe, DNa and DNb
  (and DPh)". DPf (Elamite) and DPg (Babylonian) are carved on the south wall too (royal_inscriptions.json `carved`).

### M3 (round-2 M3, partially fixed). §10 voice acceptance: the named fix was done and its machine targets are met, but the brief's acceptance (a rating of intelligibility and naturalness) is still not done (logged, B17b, H8)
**Fixed.** D-185 did what round 2 asked:
- the library build (libespeak-ng 1.52 through espeakng-loader);
- word stress;
- pitch per class inside Hillenbrand 1995;
- a contour per utterance type;
- PSOLA final lowering;
- an echo ablation, measured and reverted.

That is well over the three approaches §3.5 asks for.

**I re-measured it independently.**
- **Method:** a scratch venv with soundfile 1.2.2 and praat-parselmouth 0.4.7, and my own script (`r3/f0.py`).
- **Hashes:** all 372 shipped clips match the report's sha256.
- **Class median F0:** m1 114.7 Hz, m2 133.2, m3 120.6, f1 216.5, f2 203.9, c1 244.2. The report gives 114.8, 133.2,
  120.6, 216.5, 203.9 and 244.2.
- **F0 range:** median 5–95 % range 6.43 st (report 6.44), with 100 % of clips ≥ 2 st.
- **Agreement:** no clip differs from the report by more than 5 % in F0 or 1 st in range.

**Still open:**
- **No rating of intelligibility or naturalness.** D-185's thresholds T1–T4 were set by the builder, and T3 was
  redefined after the first render (stated in D-185). They are preconditions, not the §10 acceptance ("the reviewer
  rates intelligibility and naturalness"), and nobody has listened (H8).
- **Machine phone recovery did not improve** (D-185 table). For Greek, the median error went from 0.83 to 1.00, and the
  share of clips beating the shuffled control from 34 % to 28 %. That means no recoverable phones at all. D-185 calls
  the instrument noisy, which is plausible, but the regression is not investigated further.
- **The acceptance does not cover all voices.** It measures the 372 eSpeak clips only. It leaves out:
  - the 11 Babylonian lines, voiced by the runtime formant synthesiser (weak F2/F3 in D-167, and not re-tuned in
    D-185);
  - the crowd murmur.

  `src/audio/speech.ts:15` still calls that voice "PLACEHOLDER-QUALITY": honest, but open.

### M4 (round-2 M4, unchanged). §11 music: placeholders and missing deliverables (logged, B20)
- **Unchanged code.** No file under `src/audio` except `speech.ts`/`phonemes.ts` has changed since round 2.
- **Still met:**
  - `lint:music` OK: 13 claims, 3,450 gig-minutes, all sourced;
  - tunings are Pythagorean ratios, with no equal temperament (`tuning.ts`);
  - no banned instruments (`instruments.ts`).
- **Still placeholder or missing:**
  - no harp model and no playing or singing animation;
  - court women in working dress;
  - no magus's chant (declined as an invented liturgy of a living religion; Q-301, a user-level decision);
  - no herders' pipes (Q-302);
  - "foreigners: their own traditions" only for the Ionians.
- **Honest.** All of this is flagged in F3 and in PROGRESS.md:10-15. Unheard in a browser.

### M5 (round-2 M5, unchanged; external blocker). The scribes' tablets carry no readable text (B18, NEEDS #15)
- **Unchanged since round 2.** The central §1.1 object is still wedge relief with no text. It is flagged
  PLACEHOLDER in `writing.json`, F3, the layer and PROGRESS.md:16-22. `tests/writing.test.ts` passes.
- **What is blocked on sources.** The Treasury texts (Cameron, OIP 65) are unreachable here (B6/B18).
- **The Aramaic.** It is still not visible anywhere: the leather is rolled, with its text inside.

### M6 (round-2 minor 2, raised). Bundled lexicon data under share-alike and unchecked licences, while the layer tells the user §12 allows "only CC0, CC-BY or CC-BY-NC" (§12)
- **What is bundled.** `ASSET_LEDGER.md:27` records that the app bundles words and glosses from:
  - Strong's (openscriptures JSON, CC BY-SA);
  - Perseus Herodotus, Homer and LSJ (CC BY-SA);
  - "ORACC RIBo/CAMS/HBTIN text via the SLAB-NLP/Akk mirror (**ORACC project licences not checked**)";
  - the EWB sense base ("no licence file");
  - glosses "aligned with the Livius.org translations" (all rights reserved; single words only).
- **The contradiction.** The translation layer shows every user `TRANSLATION_STATUS` (`src/ui/translation.ts:53`),
  which reads §12 as permitting "only CC0, CC-BY or CC-BY-NC". Under that reading, the BY-SA material is excluded too.
- **Two rounds deferred.** D-167 deferred the share-alike question "for the lead". There is still no decision:
  `grep -i "BY-SA\|share-alike" DECISIONS.md` finds only that deferral.
- **§12 requires more.** It asks that every asset be recorded "with its source, licence and credit". "Licences not
  checked" does not meet that for a bundled source.
- **Why not CRITICAL.** It is almost certainly harmless for USE = personal, non-commercial. ORACC project data is
  commonly released under a share-alike licence, which I could not confirm: oracc.org does not answer here. But it has
  now stayed undecided for two rounds.
- **What is needed:** one decision (BY-SA acceptable under USE, or not) and a checked ORACC licence, recorded in the
  ledger.

---

## MINOR
1. **Carved signs are a parallax effect, not cut geometry.**
   - Each sign is a quad 0.5 mm off the face, shaded by a 16-step depth march (`src/render/incision.ts:1-10`,
     `carving.ts:131-150`). The file states this: no notch in the silhouette, and no shadow-map resolution.
   - Node tests show a V-section at 45°, the far wall lit and nothing proud (`tests/inscriptions.test.ts:54-113`).
   - Never compiled or seen on a GPU: z-fighting at range, grazing angles and the silhouette are unverified.
   - §10 "carved text is modelled into the stone" is met in shading only.
2. **One edition text on every copy.** The same composite edition line is carved on each copy of a multi-copy text:
   XPa ×4, XPe ×4, DPc ×4, DPa ×2, XPb ×2.
   - Copy-level readings (Schmitt's apparatus) are not in the CATF. For example, whether each XPa colossus copy has the
     engraver's extra *a* is not known.
   - The per-copy tier should say so. Q-289 covers only the arrangement.
3. **Composed English in subtitles** (round-2 minor 5, still open).
   - Subtitles of tier-A inscription phrases show composed English: "A great god is Ahuramazda." and "By the favour of
     Ahuramazda." (`speech_lines.ts:37`, `:46`). They are sourced to the Old Persian passage and the lexicon.
   - The layer's status line says "Nothing is paraphrased from memory". D-167 still does not state that composed English
     glosses are shown for speech while no inscription translation is.
4. **The layer's note for DPf/DPg's missing version is wrong.** `src/ui/translation.ts:109` says the missing version is
   "not in the corpus mirror read … unavailable". DPf has no Old Persian version and DPg has none but Babylonian: the
   texts are monolingual, not unavailable.
5. **Audio integrity.** The audio lint's hash check is stamped from the shipped files (round-2 minor 3). It is now
   partly mitigated: `tests/voice_acceptance.test.ts` ties the acoustic report to those exact hashes. Still no check
   that a clip says its line, beyond the IPA round trip done at build time.
6. **The Livius copy stays in git history.** The removed Livius-derived copy (`data/corpus/op_translit.json`, "All rights
   reserved" upstream) is still in the branch's history (`bcde6bb`, removed in `01a3c24`). It matters only if the
   repository is ever made public.
7. **Carried over.**
   - Chronicle E-31 still reads "offering to a named mountain" without the name (`events_calendar.json:265`; its
     `town.json:30` note explains why).
   - Egyptian and Lydian speakers still murmur with Aramaic phonotactics (Q-025, C).
   - The translation-layer e2e has not been re-run since D-168.
8. **XPc and XPd stacked for fit.** D-184 changed XPc/XPd from side by side to stacked because three columns no longer
   fitted the 2.4 m field. The arrangement is tier C and sourced to the pillar copies' description ("NOT SEEN" for
   this copy, SITE_SPEC `r_stair_inscription`). That is honest. But the decision was driven by fit, and a
   photograph of the Tachara S stair would settle it.

---

## Round-2 findings, re-checked

| Round-2 finding | Status | Evidence |
|---|---|---|
| C1 carved OP vs the CC0 sign-by-sign edition (XPa ha-a-xa, DNa adāraiya, DPb XŠ, DNa <ma>, DPe Sugu<u>da, 5 dividers) | **Fixed** | My parser on a fresh `ario.catf` (sha256 eb8de252…): 0 differing lines in all 12 carved texts and DPh; the named words carved as the stone has them. `tests/lang.test.ts:52` (own parser, EXCEPTIONS empty) passes. `op_translit.json` and `op_sign_decisions.json` deleted (`lang.test.ts:129`). Q-288, D-176, D-177 and OP_SIGNS.md corrected. Carried into the Elamite: M1 |
| M1 carving on a scraped copy; D-176 reasoning | **Fixed** (carving basis); residue in M6 (lexicon licences) | D-184; ASSET_LEDGER "ARIo CATF" (CC0, README confirmed via raw.githubusercontent); DNb now Schmitt/XPl, 146 restorations carved as C, 6 lost stretches blank (PLACEHOLDER) |
| M2 stale PROGRESS/TASKS/NEEDS | **Partially fixed** | See M2 |
| M3 voice acceptance not met, fix not tried | **Partially fixed** | D-185 done and re-measured by me (F0, range, hashes); human rating open (H8); Greek machine recovery worse; Babylonian and murmur outside the acceptance |
| M4 music placeholders, chant, pipes | **Unchanged, logged** | B20, Q-301, Q-302; `lint:music` OK |
| M5 tablets without text | **Unchanged, blocked** | B18, NEEDS #15 |
| minor 1: El/Bab word spaces, lineation | **Fixed** | `el_lines`/`bab_lines` for all 20 versions, the CATF lines joined equal the running text (`build_cun_lines.py`); `panelText` carves them with no spaces (`inscription_text.ts:19-22`) |
| minor 2: BY-SA sources | **Open, raised to M6** | no decision in DECISIONS |
| minor 3: audio hash self-referential | **Partly mitigated** | MINOR 5 |
| minor 4: incision unverified on a GPU | **Open** | MINOR 1 |
| minor 5: composed subtitle English | **Open** | MINOR 3 |
| minors 6, 7, 8 (E-31, Egyptian/Lydian murmur, layer e2e) | **Open** | MINOR 7 |

## What I verified, and how

| Check | How | Result |
|---|---|---|
| Gate: language lint | `npm run lint:all` | chrono OK; lang **26/26**; activity OK (0 placeholders); music OK (13 claims, 3,450 gig-minutes sourced) |
| Scope unit tests | `npx vitest run tests/{lang,inscriptions,writing,music,performers,occlusion,translation_layer,voice_acceptance,exchanges,speech}.test.ts --maxWorkers=1` | 10 files, **119 passed** |
| Types | `npx tsc --noEmit` | exit 0 |
| Edition file is the CC0 original, verbatim | curl `raw.githubusercontent.com/oracc/catf/master/ario.catf`; sha256; every stored line looked up in the original | 166,028 bytes, sha256 matches; all lines verbatim; README "permitted to be released under CC0" |
| Carved OP = the edition as on the stone in 467 | my own CATF → sign converter (consonant → Ca, Ci/Cu as written, disz ma, munus fa, sz ša, `_%peo xsz_` XŠ; `<<…>>` kept, `<…>` dropped, `[…]` kept, `[...]` lost) vs `op_signs`, per line (difflib) | **0 differing lines** in XPa–XPe, DNa, DNb, DPa–DPe, DPh; counts equal D-184's (5,276 positions, 1,029 dividers, 146 / 6 / 43 / 1) |
| OP sign → code point | `SIGN` table (`oldPersian.ts:15-21`) vs Python `unicodedata` names U+103A0–103CF | all 36 syllabic signs, 8 logograms and the divider correct |
| Supplied / restored / lost marks in El/Bab | regex over `ario_catf.json` El/Bab lines; `atf_to_cun` read | 2 supplied signs carved; ~65 restored carved as A/B; no lost signs (M1) |
| El/Bab sign mapping (spot) | 87 of 181 distinct values against Unicode sign names (e.g. ka₄ SILA3, az PIRIG×ZA, uk PIRIG×UD, taš UR, ul U.GUD, ʾ 𒀪, ina AŠ) | no wrong mapping found in those checked; values like pe₃, pir₂, ten, sa₁₅ rest on OSL, which I did not check independently |
| Signs cut, not raised | read `carving.ts`, `incision.ts`; tests `inscriptions.test.ts:54-113` | cut in node (V-section depth field, parallax march, discard outside); GPU unverified |
| Voices: D-185 numbers | independent Praat re-measure of all 372 clips (scratch venv) | matches the report (MAJOR M3 for what the numbers do not cover) |
| No modern language in the world | lint scope (`language.test.ts` 26 tests: canvas sources, data fields, SVG/CSS, images, carved-mesh read-back, clay atlas read-back, audio manifest, murmur 20,000 phrases); grep of `fillText`/`textContent` outside `src/ui` (only bench mode and the boot-failure message, both out of world) | none found; audio not audited by ear |
| Every translation sourced / flagged | `translation.ts` `inscriptionReading`, `writingReading`, subtitle meta line (`tier · src`); `speech_lines.ts` `src` per line; lexicon lint (fail-closed sources) | no inscription or writing translation shown, reason stated (B17a); glosses and subtitles carry sources; MINOR 3 on wording |
| Records | PROGRESS, TASKS, NEEDS, BLOCKERS B17, Q-287, Q-288, H8 against the tree | B17, Q-287, Q-288, H8 current; PROGRESS/TASKS/NEEDS stale (M2) |
| Licences | ASSET_LEDGER rows for voices, lexicons, ARIo CATF, seal texts; D-167, D-176, D-184 | carving CC0; voices generated with GPL tools only (no code or data shipped); lexicon BY-SA and unchecked ORACC (M6) |

**Not verified:**
- anything rendered or heard (see Limits);
- the meaning of the CATF parentheses in the Elamite (M1);
- the full El/Bab OSL value table;
- the copy-by-copy readings of multi-copy texts (MINOR 2);
- the DPb placement.
