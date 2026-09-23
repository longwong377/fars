# Independent review: Phase 8, lens A (the world side: language, writing, speech)

Reviewer: an independent subagent that did not see the build process. Date: 2026-09-23. Tree: `cd83211` (branch
`claude/amazing-fermi-40ds7j`; only two untracked shadow-review files in the working tree).

**Gate (brief §14, Phase 8):** "Language lint passes; every translation is sourced". **Deliverable:** "Full language, dialogue and
speech; music; translation layer and map; Now view (stretch); photo mode".

**Scope (lens A):** modern language rendered or heard in the world; what the language lint covers and misses; the carved
inscriptions (published text, script, lineation, placement); tablets, leather and seals; who speaks what; the lexicons; whether
dialogue comes only from the lexicon.

**Read:** PERSEPOLIS_BRIEF.md (all of it), CLAUDE.md, PROGRESS.md, BLOCKERS.md, NEEDS_FROM_ME.md, TASKS.md (Phase 8),
research/LANGUAGES.md, D-036, D-045, D-061, D-066, Q-022/025/090/134/135/138, ASSET_LEDGER rows 9/26/27.
**Code read:** `src/lang/*`, `src/people/speech_lines.ts`, `src/audio/{speech,murmur,music,tuning,soundscape}.ts`,
`src/arch/decor.ts`, `src/world/plain/naqsh.ts`, `src/ui/{translation,shell,overlay}.ts`, `src/world/world.ts` (speech and
visitor wiring), `src/world/visitor/controller.ts`, `src/people/sim.ts` (roster languages), `src/world/furnish.ts`,
`src/arch/doors.ts` (sealings), `src/people/props.ts`, `tools/build_speech.py`, `tools/build_inscriptions.py`,
`tests/language.test.ts`, `tests/lang.test.ts`, `src/data/inscriptions.json`, `public/voices/manifest.json`, the five lexicons.
Playwright was not run, as instructed. Reviewer scripts ran from the session scratchpad (not the repo); the key one is quoted in C1.

## Verdict: **FAIL**

The builder does not claim the gate (PROGRESS.md:233 says "Not passed"), and that is correct. The lint passes as written, and
I found **no modern-language text or speech reaching the world**. But the carved Old Persian is not the published text sign
for sign. PROGRESS's only statement about which lines are spoken is contradicted by the code. Music, writing on objects and
most of the royal inscription programme are absent, and PROGRESS does not list them.

---

## CRITICAL

### C1. The carved Old Persian is not the published text: 179 of 832 carved words (22 %) are misspelled, including Xerxes' own name on every Xerxes inscription
- **Rule:** §10 "Old Persian … cuneiform on the real royal inscriptions (published texts only, never invented)"; §3.6.
- **What is carved:** `src/arch/decor.ts:207,222,238` and `src/world/plain/naqsh.ts:307` carve `toCuneiform(op_translit)`, where
  `op_translit` is the ARIo/Schmitt *normalisation* (e.g. `θāti`, `pātu`, `nai̯`, `vasai̯`, `Xšayaṛšā`). `spellWord`
  (`src/lang/oldPersian.ts:23-37`) turns each letter into a sign and misses four of Kent's spelling rules:
  1. word-final *i*/*u* is written with a following *y*/*v*;
  2. a nasal before a consonant is not written;
  3. initial *ṛ* is written *a-r*;
  4. the king's name is spelled x-š-y-**a**-r-š-a.
- **Measured:** a reviewer script adds only those four rules plus *paru(v)zanānām* and compares the result with the project's
  own speller, word by word:

  | Text | Words spelled wrong | Share |
  |---|---|---|
  | XPa | 19 of 98 | 19 % |
  | XPb | 11 of 74 | 15 % |
  | XPc | 12 of 81 | 15 % |
  | XPd | 10 of 67 | 15 % |
  | XPe | 1 of 9 (the king's name, on 4 OP panels) | 11 % |
  | DNa | 34 of 228 | 15 % |
  | DNb | 92 of 275 | 33 % |
  | **All carved OP** | **179 of 832** | **22 %** |

  Examples as carved, with the correct spelling after the arrow:
  - `Xšayaṛšā` xa-ša-ya-ra-ša-a → xa-ša-ya-**a**-ra-ša-a (3× in XPa, and in every XP text);
  - `θāti` θa-a-ta-i → θa-a-ta-i-**ya**;
  - `pātu` pa-a-tu-u → pa-a-tu-u-**va**;
  - `nai̯` na-i → na-i-**ya**;
  - `paruzanānām` → pa-ru-u-**va**-za-…;
  - DNb `ṛštika` ra-ša-ta-i-ka → **a**-ra-ša-ta-i-ka;
  - DNa/DNb `Gandāra`, `hantaxšatai̯`, `handugām` carve their nasals.
- **The project's own data contradicts the carving.** `research/LEXICON/old_persian.json` spells these words correctly:
  - `θāti` θa-a-ta-i-ya, `pātu` pa-a-tu-u-va, `nai̯` na-i-ya;
  - `bandaka` ba-da-ka "Nasal unwritten";
  - `ṛštika` a-ra-ša-ta-i-ka;
  - its glosses even say "(Kent pātuv)" and "(Kent θātiy)".
- **The unit test does not cover the carved text.** `tests/lang.test.ts:11-15` checks `XPA_TRANSLIT`, a Kent-style text that
  already has the final y/v (`oldPersian.ts:44`) and that no world code uses. Using it would have fixed 18 of the 19 XPa
  errors, but `decor.ts` carves the ARIo string instead.
- **The labels are misleading.** Every panel's dev-overlay note says "signs by Kent rules — C" (`decor.ts:191`). Neither
  OPEN_QUESTIONS nor BLOCKERS records the fault. LANGUAGES.md §3 itself says the full XPa "was **not** generated: it needs
  Kent's sign-by-sign transliteration".
- **Fix:** carve from Kent-style transliterations, or apply the four rules. Add a test that compares every carved word with a
  sign-by-sign edition, or at least with the lexicon's own `sign_spelling`.

### C2. PROGRESS's statement about which speech is used is contradicted by the code: 45 of 73 lines can never be heard, and no Old Persian word is spoken in the default observer mode
- **What PROGRESS says** (PROGRESS.md:66, 70): "There are 73 scripted lines and 372 pre-rendered eSpeak clips … The new
  intents (affirm, refuse, ration) are not yet called: visitor mode will use them."
- **What the code does:** `pickLine` has only two callers.
  - `world.ts:202`, addressing an NPC: intents `greet` and `reply`.
  - `world.ts:218` via `visitor/controller.ts:74,87`: intents `ask_document`, `refuse` and `affirm`.
  - So `affirm` and `refuse` **are** called. `pious`, `farewell`, `remark`, `call_workers`, `count`, `offer`, `identify` and
    `ration` are never called.
- **Measured:** 28 of 73 lines can be reached; 45 lines never play, and 228 of the 372 clips belong to them.
  - Of the 10 verbatim (tier A) lines, only 3 can be reached: `arc.greet.slma_kla`, `grc.greet.khaire_xeine`,
    `grc.reply.ouk_oida`.
  - None of the Old Persian royal formulas can be reached (`baga vazṛka A.uramazdā`, `vašnā A.uramazdāha`, `dargam jīvā` …).
- **In observer mode (the default)**, Old Persian has no greet or reply line, so:
  - Persian guards, couriers and officials answer in Aramaic;
  - Persian porters and women (`['Old Persian','Elamite']`) return `null` and only nod.
  - Measured with `pickLine`: guard greet → `arc.greet.slm`; Persian grinder greet → `null`.
  - Old Persian is heard only as crowd-murmur pseudo-words, and in visitor mode as `nai̯`, `mā` and `hašiyam`.
- **Rules:** §3.7 "never describe intent as achievement"; the Phase 8 deliverable "full … dialogue and speech".

## MAJOR

### M1. The language lint cannot see audio at all, and its text checks have holes (`tests/language.test.ts`)
- **Audio (§10: "modern-language text or audio").**
  - No test reads `public/voices/manifest.json` (grep over `tests/`: only architecture manifests).
  - The manifest records no source IPA, hash or line version per clip.
  - A clip replaced by a recording in any language would pass. The brief's own "swappable voices or my own recordings" path is
    unlinted.
  - What the lint checks is the IPA the build *would* feed eSpeak (`language.test.ts:78-85`), not the files that play.
- **Registry, not content.**
  - Only `.ts` files are scanned (`:148`), and `src/ui/` is excluded wholesale (`:151`).
  - DOM text (`textContent`, `innerHTML`), SVG `<text>` in a data-URL texture and CSS `content:` are never scanned.
  - In the two registered files, a text API called with a *variable* passes. Tested with the lint's own regexes:
    `const msg='Welcome'; ctx.fillText(msg…)` and `textPanelGeometry('op', t…)` are not flagged.
- **Script, not spelling.** The inscription check only asks whether each character is in the right Unicode block (`:101-107`).
  So C1's misspellings pass.
- **Word list.** `MODERN_WORDS` (`src/lang/modern.ts:50`) holds about 520 words, matched on the spelling of romanised IPA.
  - 20,000 murmur phrases per language, checked against 169 extra common words the list lacks, produced:
    - modern Persian imperatives and common words: `bia` "come" (bab 2), `boro` "go" (grc 6), `bede` "give" (grc 3),
      `bāš` "be" (el 60, op 6), `kār` "work" (el 33, arc 45, grc 22);
    - English strings: `set`, `met`, `bet`, `map`, `bus`, `gun`, `sad`, `mad`, `dad` (arc/el/grc).
  - Several of these are real homophones (`set`, `met`, `bet`, `kār`, `bāš`). The murmur is low-passed and the rates are low
    (≤ 0.3 % of phrases), but it is exactly what the detector exists to reject.

### M2. For the Elamite and Babylonian panels, the translation layer shows the Old Persian transliteration
- `TranslationLayer.inscriptionView(id)` (`src/ui/translation.ts:99-104`) always uses `t.op_translit` and OP glosses, whatever
  the panel's `version` (the pick userData carries it: `decor.ts:191`).
- Looking at the Elamite or Babylonian XPa colossus panel, or the Elamite and Babylonian XPe stacks, shows an OP text headed
  "Transliteration: ARIo". That transliteration is of a different text from the one being read.
- Rule: brief §9.4 "look at an inscription to see its transliteration".

### M3. Music is not in the world, and PROGRESS does not say so
- `MusicSystem` (`src/audio/music.ts:89`) is never constructed anywhere in `src/`: grep finds no `new MusicSystem` and no
  `.perform(`. `soundscape.ts:5` says "none yet".
- No performer, instrument model, playing animation, court music or magus chant exists. D-045 states this honestly.
- PROGRESS's Phase 8 row and the "Broken / placeholder" list never mention music. TASKS Phase 8 has no music item.
- Rule: §3.7 "every report leads with what is broken or placeholder".

### M4. No writing on objects; one sealing note claims an impression that the geometry does not have
- §10 asks for "Elamite on clay tablets; Aramaic ink on leather; seal impressions". §1.1 asks for "specific attested tablets
  being written and sealed with real, attested seals". None of this exists:
  - the scribes' room tablets are blank rounded boxes (`src/world/furnish.ts:64`), and so is the carried prop
    (`src/people/props.ts:85`);
  - no leather document exists;
  - the Imperial Aramaic font is shipped but never loaded (`decor.ts` `loadInscriptionFonts` loads only `op` and `cun`).
- The door sealing is a smooth scaled sphere (`src/arch/doors.ts:160`). Its dev-overlay note nevertheless says "impressed with a
  seal", with `placeholder: false` (`doors.ts:146`).
- Neither PROGRESS nor TASKS lists any of this.

### M5. Most of the royal inscription programme is missing, and the gaps are not logged
- LANGUAGES.md §2 lists these texts as standing in 467. None is carved, and none is in PROGRESS, TASKS, SITE_SPEC or
  OPEN_QUESTIONS (grep):
  - DPa and DPb (Tachara);
  - DPc (the Tachara window frames);
  - DPd, DPe, DPf and DPg (the Terrace south wall, the largest display texts);
  - XPg (glazed bricks);
  - XPj/XPm (column bases);
  - XPk (garment).
- XPb, XPc and XPd are trilingual texts but are carved in Old Persian only (`decor.ts:222`, `relief_programmes.ts:88,114`).
  The translation layer does not say "Old Persian only" for them (`translation.ts` INSCRIPTION_INFO). It does say so for DNa
  and DNb.

### M6. Signs are modelled standing proud of the stone, not cut into it
- §10: "carved text is modelled into the stone". The panels are offset 2 mm out from the face and extruded outward, with a
  0.4 cm extrusion plus a 0.4 cm bevel (`decor.ts:146,195`), in a dark material (0.22 grey).
- The flat panels (XPe, DNa, DNb) are faces set 3 mm proud (D-066).
- The code comment calls this an "incised look" (`decor.ts:125`); the geometry is raised dark lettering.
- D-066 explains the cost for XPe. No decision covers XPa–XPd. The dark colour has no tier or source.

### M7. 44 of 99 Aramaic lexicon entries give no attestation, and 14 of the 22 Aramaic lines use one of them
- §10 asks for each word's "attested form, source … and tier".
- Entries with a Strong's number and no verse or document: `šlm`, `mrʾ`, `ḥd`, `trn`, `tlt`, `lḥm`, `spr`, `ʾgrh`, `mlḥ`, `ḥmr`,
  `mšḥ`, and 33 more. Strong's is an 1894 dictionary, not a text.
- `mrʾ` occurs only in Daniel in Biblical Aramaic, yet it is not marked, although LANGUAGES.md §6 says "Daniel-only forms
  marked". Its Achaemenid attestation, `mrʾy` in the letters, is cited in the gloss but not in `src`.
- `myn` "water" is tier C ("RECON (not seen)"). It is still a speakable entry and feeds the murmur phonotactics.

## MINOR
1. **Lineation is not the published one.** Every panel re-flows its text to the panel width (`textPanelGeometry`), so Kent's
   and ARIo's line divisions are not kept. D-061 admits this for DNa/DNb; it is not stated for XPa–XPe.
2. **XPa version per colossus.** The code carves one version per colossus, in the order OP, El, Bab, OP (`decor.ts:208`), so
   Old Persian appears twice and the other two once each. SITE_SPEC's own row reads "one trilingual per colossus pair side".
   The conflict is unresolved and not in OPEN_QUESTIONS.
3. **DNb.** `carvableTranslit` (`naqsh.ts:29-31`) drops every hyphenated token. That removes the genuine word
   `avākaram-ci-mai̯` along with the lacunae, and closes the gaps so that words on either side of a lacuna run together.
4. **Subtitle transliteration does not match what is heard.** Stem forms are shown (`uvaspa`, `umartiya`, `naiba`, `hašiya`,
   `ai̯va`) while inflected forms are voiced (`uwaspaː`, `naibam`, `haʃijam`, `aiwam`); `citationForm` strips the hyphen only.
5. **Greek subtitles** show `grc · tier C`, because `LANG_NAME` has no `grc` entry (`translation.ts:33`).
6. **Interlinear glosses** cover 27 of 98 XPa words. `A.uramazdā` and the `nai̯`-type forms miss because the lexicon uses a
   different normalisation (`Auramazdā`, `naiba-`).
7. **The guard does not say *halmi*.** PROGRESS.md:172 says "the Gate guard … asks for the halmi (Elamite *halmi*)". Guards
   speak `['Old Persian','Aramaic']`, so the line actually spoken is Aramaic `ʔiɡɡəraː` "letter?" (measured with `pickLine` over
   six seeds). `el.ask_document.halmi` can never be reached by a guard.
8. **The dev overlay (F3) does not show the tier of speech that is heard.** Only the translation layer shows it (§3.2: "visible
   in the dev overlay").
9. **The eSpeak base voices are modern Persian (`fa`) and Arabic (`ar`).** The input is phonemes (`[[…]]`, round-trip checked),
   but phone realisation and prosody are those of modern voices. Nobody has listened (Q-138, open).
10. **Egyptian and Lydian speakers** murmur with Aramaic phonotactics (flagged C, Q-025). There is no Egyptian lexicon, though
    Egyptian is well attested.
11. **Share-alike sources are bundled in the app** (Strong's, Perseus: CC-BY-SA). §12 lists CC0/CC-BY/CC-BY-NC; the ledger
    credits them.
12. **Stale PROGRESS text:** "the new intents … not yet called" (see C2).

## What holds up (verified)
- No modern-language text reaches the canvas in the code read. No modern word appears in any spoken line.
- Every line is built only from lexicon ids of its own language.
- Old Persian lines have at most 3 words. Every lexicon entry has a tier and resolving source keys, and all IPA is tiered C.
- The inscription texts are verbatim ARIo slices, split correctly into versions, with 0 unmapped signs.
- DPh stays sealed and uncarved.
- The clips are phoneme-driven and match the current lines exactly.

| Check | How | Result |
|---|---|---|
| Language lint | `npx vitest run tests/language.test.ts tests/lang.test.ts tests/speech.test.ts --maxWorkers=1` | 3 files, **41 passed** |
| In-world text APIs | grep `fillText\|strokeText\|TextGeometry\|CSS2D\|CanvasTexture\|getContext('2d')` over `src/` | only `decor.ts`, `naqsh.ts` (carving) and `ui/translation.ts` (map, out-of-world). `settlement/ajori.ts` canvas: frieze figures, no text |
| DOM text outside `src/ui` | grep `textContent\|innerHTML\|…` | `world/bench.ts:42,44` (bench mode), `main.ts:392` (boot error): out-of-world |
| Translation layer off | `translation.ts` `update()` sets `root.hidden` and returns; crosshair only with translation on (`shell.ts` `playing()`); no-line gesture goes to console (`main.ts:111`) | no English in world |
| Textures | viewed `public/generated/humans/{skin,eye,hair}.png`; no other raster files in `public/` except favicon | no text |
| Voice clips | parsed `manifest.json` and Ogg granules | 372 clips = 62 lines × 6 voices; 11 Babylonian lines formant-only; 0 missing, 0 orphan; 0.10–0.64 s per phone (consistent with phoneme input; eSpeak fed `[[mnemonics]]`, `tools/build_speech.py`) |
| Clips current? | `git log ee4b644..HEAD -- research/LEXICON src/people/speech_lines.ts src/lang/lexicon.ts tools/build_speech.py` | no change since the clips were built |
| Line counts | resolved `LINES` | 73 (op 12, el 12, arc 22, bab 11, grc 16); 10 tier-A. Checked against XPa 1, DB IV, Ezra 5:7, Od. 1.123, Hdt 4.195.2, 1.121.1, 5.105.2 |
| Lines reachable | callers of `pickLine` (`world.ts:202,218`) × intents | **28 of 73** (C2) |
| Who speaks what | `sim.ts:136-160` roster vs LANGUAGES.md §1 | guards OP+Aramaic; foreman and scribes Elamite+Aramaic; Ionians Greek+Aramaic; Babylonians Aramaic first (the brief's Akkadian claim is left open in Q-134); Egyptian and Lydian fall back to Aramaic (C). Consistent, but see C2 |
| Lexicons | field/tier census of the five JSON files | op 116, el 78, arc 99, bab 71, grc 82; every entry tiered; `tier_ipa` C except 5 absence entries; source keys resolve (lint); 44 Aramaic entries without `attested` (M7) |
| OP forms vs corpus | each OP form or stem searched in `data/corpus/ario.jsonl` | 94 of 114 found (2 absence entries skipped); the 20 misses are normalisation (`Auramazdā` vs `A.uramazdā`, `naiba-` vs `nai̯bam`) and B-tier month stems |
| Inscription texts | each `inscriptions.json` version against the ARIo raw text; XPa against LANGUAGES.md §3 | all 8 texts are verbatim slices; XPa identical to §3; `el_unmapped`, `bab_unmapped` empty; `EŠŠANA` → 𒁹𒁹𒁹𒎙 per OSL `|DIŠ.DIŠ.DIŠ.U.U|` |
| OP sign spelling | reviewer speller with Kent's rules vs `spellWord` | **179 of 832 words differ** (C1) |
| Translation sources | `translation.ts`; line `src` fields; lexicon glosses | no published translation shown (NEEDS #14, honest); subtitle glosses and word glosses are sourced in data (the layer shows tier, not source). Gate text "every translation is sourced" holds for what is shown, except M2 |
| Music | grep `MusicSystem`, `.perform(`; `tuning.ts` | tunings are ratios of 2 and 3 (no equal temperament), but nothing plays (M3) |
| Tablets, leather, seals | `furnish.ts`, `props.ts`, `doors.ts` | blank geometry (M4) |

**Reproducing C1:** apply to each word of `op_translit`, in this order:
1. `^Xšayaṛš` → `Xšayāṛš`;
2. `^paruzan` → `paruvzan`;
3. `^ṛ` → `aṛ`;
4. drop `n` before a consonant (not word-initial) and `m` before `b`/`p`;
5. run `spellWord`;
6. then append `YA` if the word ends in *i/ī* (incl. *ai̯*), and `VA` if it ends in *u/ū* (not *au̯*).

Compare the result with `spellWord(word)`. DNa/DNb use `carvableTranslit`.
