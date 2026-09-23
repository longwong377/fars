# Phase 8 independent review, lens B: the out-of-world layer and sound

Reviewer: an independent subagent that has not seen the build process. Date: 2026-09-23. Tree: `claude/amazing-fermi-40ds7j`
at cd83211, two commits ahead of origin, with untracked files. Scope: the translation layer (subtitles; inscription
transliteration, glosses and translations; the map M/Z; the chronicle J; the visitor log); the speech pipeline; the
listening test (H8); music (research/SOUNDSCAPE.md); and the status of the Now view and photo mode against the gate.

Phase 8 gate (§14): "Language lint passes; every translation is sourced". Phase 8 deliverable: "Full language,
dialogue and speech; music; translation layer and map; Now view (stretch); photo mode".

## Verdict: FAIL

- **What passes literally.** Both items of the gate text:
  - `lint:lang` passes (15/15).
  - Every English string the layer shows as a translation traces to lexicon rows that carry source keys.
- **Why the verdict is FAIL.** §13.9 requires no open critical findings, and two are open:
  - the Old Persian text carved in the world is not the published sign sequence;
  - the stated blocker for inscription translations is contradicted by the project's own records.
- **The deliverable is also far from complete:**
  - no music plays anywhere in the world;
  - 45 of 73 scripted lines can never be heard;
  - the Elamite and Babylonian panels show the Old Persian text in the translation layer;
  - the voice acceptance (§10) was not attempted;
  - there is no audio occlusion, no photo mode and no Now view.
- **PROGRESS.md itself says Phase 8 is "Not passed".** This review agrees, but PROGRESS understates the gaps.

---

## CRITICAL

### C1. The carved Old Persian inscriptions are not the published text (§10: "published texts only, never invented")
- **The mismatch.** Every Old Persian panel in the world is carved from `toCuneiform(<id>.op_translit)`:
  - src/arch/decor.ts:207 (XPa), :222 (XPb), :238 (XPc, XPd, XPe);
  - src/world/plain/naqsh.ts:31 (DNa, DNb).

  `op_translit` is ARIo's normalised transcription (Schmitt): `θāti`, `pātu`, `dūrai̯`, `vasai̯`, `nai̯`, `Xšayaṛšā`. The
  speller in src/lang/oldPersian.ts:13-42 implements Kent's orthographic rules for Kent-style input (`θātiy`, `pātuv`,
  `dūraiy`, `Xšayāršā`). Its only test, tests/lang.test.ts:5-13, feeds Kent forms (`XPA_TRANSLIT`, oldPersian.ts:44),
  so the tested path is not the shipped path.
- **Result, measured with a scratch script over the carved words** (DNb with its lacunae removed, as naqsh.ts does):
  - every word-final *-i/-u* loses its glide sign (*-ya/-va*);
  - Xerxes' name loses its *a* sign. It is carved XA-ŠA-YA-RA-ŠA-A; the stone and Kent have xa-ša-ya-a-ra-ša-a.

  | text | carved signs | word-final i/u without -ya/-va | Xšayaṛš- |
  |---|---|---|---|
  | XPa | 488 | 14 | 4 |
  | XPb | 371 | 7 | 3 |
  | XPc | 406 | 9 | 3 |
  | XPd | 345 | 6 | 3 |
  | XPe | 65 | 0 | 1 |
  | DNa | 1,131 | 27 | 0 |
  | DNb | 1,311 | 83 | 0 |
  | **total** | **4,117** | **146** | **14** |

  At least 160 signs are missing, about 3.9 % of the carved Old Persian.
- **The Kent-form comparison.** For XPa alone, the Kent-form text (`XPA_TRANSLIT`) spells 508 signs; the carving has 488.
- **The project's own lexicon contradicts the carving:**

  | word | `sign_spelling` in research/LEXICON/old_persian.json | carved |
  |---|---|---|
  | θāti | θa-a-ta-i-ya | THA-A-TA-I |
  | pātu | pa-a-tu-u-va | PA-A-TU-U |
  | vasai̯ | va-sa-i-ya | VA-SA-I |
  | nai̯ | na-i-ya | NA-I |
- **Why nothing flagged it.** The dev-overlay label "Old Persian, signs by Kent rules — C" (decor.ts:191) and the
  inscriptions.json tier "op_signs: C (Kent orthographic rules)" do not disclose a known, systematic misspelling. No
  OPEN_QUESTIONS row exists. The lint (tests/language.test.ts:100-115) checks only Unicode blocks and modern words, so it
  cannot see this.
- **A genuine word is also dropped.** DNb loses *avākaram-ci-mai̯*, because naqsh.ts:31 discards every hyphenated token
  as a lacuna.
- **Scope note.** This finding sits at the edge of lens B. It is listed because the translation layer presents these
  panels as ARIo's text (translation.ts:103), and §10 makes it a rule.

### C2. The blocker for inscription translations is contradicted by the project's own records (§3.7)
- **The claims:**
  - PROGRESS.md:233 (Phase 8): "translations need NEEDS #14".
  - NEEDS_FROM_ME.md:26 (#14): "ORACC, Livius and archive.org are blocked here, and no translation is paraphrased from
    memory". It asks for a public-domain or "CC-BY/CC-BY-NC" translation.
  - The panel text, src/ui/translation.ts:104: "A published English translation is not available in this build
    (NEEDS_FROM_ME #14)".
- **The evidence:**
  - `src/data/sources.json:587` (LIVIUS-AI): "Livius.org, 'Achaemenid Royal Inscriptions' pages (DSf, DNa, DNb, XPh,
    DZc, XPa-XPm …; translations after Kent/Lecoq) … read in full via the scraped GitHub copy (FT; CC-BY-NC repository)".
    research/SITE_SPEC.md:480 repeats this.
  - ASSET_LEDGER.md:27: "Livius translations via the Electronic-Old-Persian-Library scrape (CC-BY-NC) … all compatible
    with personal non-commercial use (§12)".
  - DECISIONS.md:926 (D-108): "Glosses come from the Livius translations (read in full via the GitHub scrape)". 116
    Old Persian and about 30 Babylonian lexicon rows cite LIVIUS-AI.
  - The repository README, fetched from raw.githubusercontent.com (reachable here): "This repository is under CC-BY-NC",
    with `textdata/eng_transliteration_to_english/`.
- **What this means.** By the project's own ledger, a published English translation of at least XPa–XPm, DNa and DNb,
  under a licence USE allows, was read in full and used as a source. It is withheld from the layer on a stated reason
  (host blocked) that the project's own records refute.
- **The legitimate alternative is not recorded.** The builder may doubt the licence of scraped Livius or Kent content.
  If so, that belongs in BLOCKERS.md and DECISIONS.md, and NEEDS #14 should state it. None of them do: BLOCKERS.md has
  no row for translations at all.
- **The fix is one of:**
  - show the LIVIUS-AI translation per inscription, sourced and tiered;
  - record the real reason and correct NEEDS #14, PROGRESS and the panel text.

---

## MAJOR

### M1. The translation layer shows the Old Persian text when you look at the Elamite or Babylonian version
- **The cause.** Panels are named `inscription:<id>:<version>` (decor.ts:195, 201). The Gate's four XPa panels are
  op/el/bab/op (decor.ts:208), and XPe stacks all three versions. The layer keeps only the id
  (`name.split(':')[1]`, translation.ts:73). `inscriptionView` always renders `op_translit` with Old Persian glosses
  (translation.ts:96-105).
- **Effect 1.** A reader at the Elamite or Babylonian panel gets another text's transliteration and glosses, headed only
  "XPa — Xerxes, Gate of All Nations … Transliteration: ARIo".
- **Effect 2.** The Elamite and Babylonian transliterations (`el_atf`, `bab_atf`, already in inscriptions.json) are
  never shown, and the Elamite (78) and Babylonian (71) lexicons are never used for glosses.
- The gloss rows are sourced, but they are attached to the wrong text.

### M2. No music plays in the world, and PROGRESS/TASKS do not say so (§11; §3.7)
- **The code is never used.** `MusicSystem` (src/audio/music.ts:89-113) is never instantiated: a grep of src finds no
  other reference. There is:
  - no performer, and no instrument modelled at true size;
  - no court music, work song, herders' pipe or foreign tradition;
  - no magus chant.
- **Offerings are silent.** The simulation holds the lan offering every sunrise (src/people/calendar.ts:240) and other
  offerings monthly (:233-238), and the chronicle lists them, but you hear nothing. §11 asks for "a magus chants,
  unaccompanied, with text from the lexicon".
- **Where it is and is not recorded:**
  - D-045 (DECISIONS.md:455) records "No performer plays in the world", and src/audio/soundscape.ts:5 says "(none yet)".
  - PROGRESS.md (the problems-first block and the Phase 8 row) never mentions music.
  - TASKS.md has no music task under Phase 8 (TASKS.md:65-67).
- **What exists** (the DSP is sound and tested): the tunings, the physical-model instruments, the evidence rules
  (no instrument at an offering; court music only with the court resident) and seeded variation.

### M3. "Dialogue and speech": 45 of 73 scripted lines, and 228 of 372 clips, can never play
- **Where lines are chosen.** `pickLine` is called in only two places:
  - `address()`, for greet and reply (world.ts:202);
  - the visitor controller's guard reactions, for ask_document, refuse, affirm and greet (world.ts:218;
    controller.ts:74, 87).
- **What is never spoken.** The intents pious (6), farewell (6), remark (5), call_workers (7), identify (6), count (6),
  ration (6) and offer (3) are never called. There are no NPC-to-NPC scripted exchanges, no foreman's call and no
  ration call.
- **Observer mode.** In the default mode, only the 15 greet and reply lines can be heard.
- **PROGRESS is stale and understates the gap.** PROGRESS.md:70 says "The new intents (affirm, refuse, ration) are not
  yet called: visitor mode will use them". In fact affirm and refuse are called (in visitor mode), and eight intents are
  not.

### M4. The voice acceptance (§10) was not attempted and is not logged as a blocker (§3.5)
- **What the brief asks.** §10: "the reviewer subagent rates intelligibility and naturalness".
- **What was done.** It was handed to the user as REAL_HARDWARE_TODO H8, which asserts "no speech recogniser is
  available offline". The session records no measured attempt:
  - pypi.org is reachable (NEEDS_FROM_ME network table);
  - no phoneme recogniser, spectrogram/formant review by a vision subagent or F1/F2 plot against the lexicon IPA was
    tried.
- **What §3.5 requires.** At least three approaches and a BLOCKERS.md row. There is none: only Q-138 and H8.
- **The other two voice paths are also unheard:**
  - the formant synthesiser, which voices all crowd murmur and all 11 Babylonian lines, is labelled
    "PLACEHOLDER-QUALITY" (speech.ts:14-16);
  - the eSpeak clips use modern Persian (`fa`) and Arabic (`ar`) phoneme tables (build_speech.py:37).

### M5. No audio occlusion (§11: "occlusion")
- `grep -i occlu` over src/audio and src/world/world.ts finds nothing audio-related.
- Speech, murmur, fires and tools are heard through walls, attenuated only by distance: an inverse-distance HRTF panner
  (engine.ts:49-52) plus one global convolver per space.
- It is not listed as missing in PROGRESS. TASKS.md:29 ticks "spatial audio + soundscape".

### M6. Photo mode (a Phase 8 deliverable) and the Now view (stretch) are not started, and the task list has no items for them
- PROGRESS.md:233 reports both honestly as "not started (stretch)".
- But TASKS.md:65 names them only in the heading, with no task lines and no BLOCKERS row.
- §8 calls only the path tracer a stretch goal, and §14 lists "photo mode" as a Phase 8 deliverable.

### M7. SOUNDSCAPE.md does not record every music claim the code makes (§11: "verify each claim and record it in SOUNDSCAPE.md")
- **Greek modes.** The Philolaan diatonic ratios for Greeks (tuning.ts:119-120, 148-154; tier "B ratios (Philolaus)")
  have no SOUNDSCAPE row and no source key.
- **Mesopotamian mode names:**
  - they are "from general knowledge and were not seen" (SOUNDSCAPE.md:39);
  - the code's order differs from SOUNDSCAPE's: *nīš gabarîm* is 7th in tuning.ts:140 and 5th in SOUNDSCAPE.md:39;
  - so the name-to-rotation mapping is unverified twice over.
- **Instruments.** The instrument evidence rests on a Wikipedia extract whose "underlying source not seen"
  (SOUNDSCAPE.md:18).
- **Missing rows.** Work songs, herders' pipes and foreign traditions have none.

---

## MINOR
1. **Subtitle romanisation is not what is heard:**
   - the subtitle shows bare stems (`citationForm`, lexicon.ts:64): "uvaspa umartiya" is heard as /uwaspaː umartijaː/;
     likewise "naiba" /naibam/, "ai̯va" /aiwam/ and "hašiya" /haʃijam/;
   - Aramaic subtitles show consonant skeletons (šlm ʿlyk) while /ʃəlaːm/ is spoken; the lexicon has a `vocalized` field.
2. **Greek language name.** translation.ts:33 `LANG_NAME` lacks `grc`, so Greek subtitles read "grc · tier C".
   lexicon.ts:15 has the full name.
3. **Tiers and sources not shown:**
   - subtitles show the tier but not the source;
   - chronicle rows show neither, although each event carries a `tier` (calendar.ts:178);
   - speech and music tiers are never visible in the dev overlay (§3.2), only in the layer's subtitle.
4. **Interlinear glosses match exact forms only.** Coverage is 17–30 % (XPa 27/98, XPb 22/74, DNa 46/228, DNb 47/282), although
   the lexicon holds stems (būmi-, asmāna-, šiyāti-) of many words left as "·".
5. **Backend misreported.** `address()` returns `backend: 'formant'` unconditionally (world.ts:207), even when an eSpeak
   clip plays. The subtitle via `onSubtitle` is correct.
6. **Raw ids on the map and chronicle.** The Terrace-scale map labels footprints by data key ("hall100") and draws every
   footprint alike, with no tier. Chronicle place names are raw ids ("post treas 1"). E-31 reads "a magus made the
   offering to a named mountain", without the name.
7. **Tests:**
   - no test asserts the layer is off by default or hidden when off (tests/e2e/translation.spec.ts:3 says so, but the
     test does not check it);
   - there is no subtitle or visitor-log e2e;
   - no translation shots exist in `shots/`.
8. **Audio provenance is not linted:**
   - clips are keyed by line id only (the manifest carries no IPA hash);
   - the eSpeak round trip (build_speech.py:70-71, 97) runs only at build time and cannot be re-run here (espeak-ng is
     absent);
   - so a later lexicon IPA edit would leave stale audio that `lint:lang` does not see. Today every file involved is
     from one commit (ee4b644).
9. **DNb carving.** Lacunae are closed up silently, so words from either side of a gap stand adjacent. This is flagged
   in the mesh note (naqsh.ts:318). The hyphen filter also removes a real word (C1).
10. **Voice ages are drawn from the seed** (the simulation has no ages; speech_lines.ts:292-296). Tier C, flagged.

---

## What I verified, and how

| Claim or requirement | Result | Evidence |
|---|---|---|
| `lint:lang` passes | **yes**, 15/15 | `npx vitest run tests/language.test.ts --maxWorkers=1` |
| Related suites | **pass**, 60/60 | language, lang, speech, music, audio, maplayers and visitor_controller tests (7 files) |
| `tsc --noEmit` | **clean** | exit 0 |
| Translation layer off by default | **yes** | settings.ts:17 `translation: false`; the `?tl` URL flag turns it on for tests (main.ts:39) |
| English appears only out-of-world | **yes** for text | translation.ts:61 hides the root when off; the aiming dot needs the layer on (shell.ts:39); M/Z/J do nothing when off (translation.ts:54); the lint's text-API scan passes (language.test.ts:141-159); bench and shell text are out-of-world |
| No English in audio | **yes** by construction | clips come from lexicon IPA via eSpeak `[[…]]` mnemonics with `fa`/`ar`/`grc` bases; murmur pseudo-words are screened (language.test.ts:163-168). Not audited acoustically (M4) |
| Every subtitle gloss is sourced | **yes**, 73/73 | scratch script: every line resolves to lexicon entries whose `src` keys exist in sources.json; each line has a `src`; lint fail-closed at language.test.ts:130-138 |
| Every interlinear gloss is sourced | **yes** | GLOSS map (translation.ts:35) holds only old_persian.json rows; every row has tier and `src` |
| Translations blocked on NEEDS #14 flagged as blocked | **yes**, flagged, but the blocker is contradicted (C2) | translation.ts:104 |
| Inscriptions are published texts | **text yes, signs no** (C1) | inscriptions.json = ARIo Q007209–13, Q007164, Q007152–3 (CC0); sign spelling wrong |
| Map only in the layer; only features present in 467 | **yes** | translation.ts:54; mapLayers.ts:27; modern footprints excluded (translation.ts:116; scratch script over FOOTPRINTS) |
| Chronicle and visitor log only in the layer | **yes** | main.ts:363 merges the visitor log in visitor mode; controller.ts:122 |
| 73 lines, 10 verbatim (phrase tier A), 372 clips | **yes** | scratch count; manifest.json has 372 clips, 11 Babylonian lines formant-only |
| Lexicon sizes 116/78/99/71/82 | **yes** | JSON lengths |
| IPA → synthesiser phonemes | **yes**, not re-verified | build_speech.py:27-37, 47-61 (mnemonic map + round trip); eSpeak not installed here |
| Voices, ages, sexes | **yes**, 6 classes | build_speech.py:43-46; `voiceKeyFor` coverage tested (speech.test.ts:224-226) |
| Post-processing | **yes** | trim, 80 Hz high-pass, −3 dBFS, fades, Opus (build_speech.py:78-84) |
| Spatialisation | **yes** | HRTF panner per utterance (speech.ts:398; engine.ts:49-52); convolution reverb per room (engine.ts:32-47) |
| Occlusion | **no** (M5) | grep |
| Crowd murmur from each language's phonotactics | **yes** | murmur.ts:38-59; Egyptian and Lydian fall back to Aramaic, flagged C (language.test.ts:169-174) |
| Swappable voices | **yes** | `VoiceBackend`, `RecordingBackend` with local-URL guard (speech.ts:290-328) |
| Listening test H8 | **open**, not attempted (M4) | REAL_HARDWARE_TODO.md:14; Q-138 |
| No equal temperament; no oud, duduk or santur | **yes** | music.test.ts:22, :52; tuning.ts ratios are 2^a·3^b |
| Only diegetic music | **vacuously yes**: no music at all (M2) | no `MusicSystem` instance |
| No instrument at sacrifice; court music only with the court resident | **yes** in code | music.ts:95-96; music.test.ts:80 |
| Now view | **not started** | grep; HANDOFF.md:59 |
| Photo mode | **not started** | grep |

**Not verified:**
- the translation e2e (Playwright not run: its rerun is pending per PROGRESS, and no screenshot exists);
- the audio as heard;
- whether the scraped Livius files cover every one of XPa–XPe, DPh, DNa and DNb (GitHub API access is not enabled for
  this session; the project's records say "XPa-XPm", "DNa, DNb");
- the carved Elamite and Babylonian sign mapping (outside lens B).

Scratch scripts used: `/tmp/claude-0/-home-user-fars/65c34f06-6eff-54d4-8f72-6836b73e2179/scratchpad/`
(`opspell.ts`, `opmiss.ts`, `lines.ts`, `insc.ts`, `intents.ts`, `fp.ts`).
