# Writing on objects (Phase 8, session 6; D-179; session 7, D-198)

Brief §10: "Elamite on clay tablets; Aramaic ink on leather; seal impressions". Brief §1.1: "specific attested tablets
being written and sealed with real, attested seals". Review REVIEWS/phase8.md M4.

**Read first: what is reconstructed.** No Persepolis Treasury (PT) text could be read from this sandbox (BLOCKERS B18).
Since D-198 the Elamite on every tablet in the world is a memorandum RECONSTRUCTED by the project on the Treasury tablets'
published formulary: NOT a surviving text (C), labelled so in the data, the dev overlay (F3) and the translation layer (§7
below). Every word of it is a sourced lexicon word (silver, KU₃.BABBAR, is the one C word), every name an attested PF name,
every numeral in the PF notation; the build and the tests check this. The only published texts in clay are the two seal
inscriptions below, and which seal carried which wording is itself a C-tier reconstruction (Q-320). The seal figures are
C-tier compositions, crude at arm's length. (Session 6 had wedge impressions with no text; D-179.)

Access keys as in SOURCES.md: FT = read in full, SX = search-engine extract only (host blocked, B6).

## 1. Which texts belong in 467 BCE

| Corpus | Date | Where in 467 | Script / medium | Reachable here? | Tier / use |
|---|---|---|---|---|---|
| Persepolis Treasury tablets, PT (Cameron 1948, 1958, 1965; collations Hallock 1960, Arfaʿi 2008) | year 30 of Darius I to year 7 of Artaxerxes I (492–457); **most dated texts from Xerxes years 19 and 20** | a north-eastern room of the Treasury (the scribes' room, D-067) | Elamite on clay; 139 Elamite + 1 Akkadian published | **No.** ISAC (OIP 65), archive.org, JSTOR, academia.edu blocked (B6); the CDLI dump (cdli-gh/data, cdliatf_unblocked.atf, FT) carries no PT text; web search summaries give no sign sequence | the right texts for the scene (A as texts) but not reachable: **stood in for by the project's reconstructions on their formulary** (C; §7; B18, NEEDS #15) |
| Fortification tablets, PF (Hallock 1969) | 509–493 | bricked up in the north-east fortification (PFA-ISAC) | Elamite on clay | 67 texts (PF 1–60, 400–406) in the CDLI dump (FT) | **not used**: archived for 26 years by 467 and not in the Treasury; putting one in a scribe's hands would be an anachronism |
| BM 108963 (Garrison, Jones and Stolper, JNES 77, 2018) | Darius year 35 (487) | provenance not established | Elamite on clay, with a seal bearing an Old Persian inscription | ATF in the CDLI dump (FT) | not used (not shown to be from the Treasury) |
| Aramaic Fortification texts, PFAT; Aramaic glosses on Elamite tablets | 509–493 | Fortification | Aramaic ink or incised on clay | no | not used |
| Aramaic ritual texts on green chert (Bowman 1970, OIP 91) | Xerxes to Artaxerxes I | the Treasury | Aramaic ink on stone mortars, pestles, plates | no (ISAC, archive.org blocked; no transliteration in any reachable source) | not used; the chert sets in the store stay uninscribed (open): the Aramaic lexicon has none of the formula's words (byrtʾ "fortress", sgnʾ "segan", znh "this", qdm "before", the vessel names), so no text is composed (D-198) |
| Aramaic letters on leather (Arshama, Bodleian) | late 5th c. | Egypt | Aramaic ink on leather, with a bulla | — | **type only** (B/C): no text of them is placed at Persepolis |
| Seal inscriptions in ARIo (Schmitt 2009, ORACC; CC0 mirror SLAB-NLP/Akk, FT) | Darius I, Xerxes | on seals and their impressions | Old Persian / Elamite / Babylonian | **yes** | **used** (below) |

## 2. The texts used (src/data/writing.json, built by tools/build_writing.py)

| id | ARIo | versions (transliteration stored verbatim from ARIo) | identification | tier |
|---|---|---|---|---|
| SDa | Q007203 | OP `adam Dārayava.uš xšāyaθiya`; El `DIŠ.u₂ DIŠ.da-ri-ia-ma-u-iš DIŠ.EŠŠANA`; Bab `ana-ku {m}da-ri-ia₂-muš LUGAL GAL-u₂` | by content: the trilingual royal-name formula of Darius' seal SDa (BM 89132) | text A; version split B (each piece occurs verbatim in the record); identification B |
| XSeal | Q009270 | OP `adam Xšayaṛšā xšāyaθiya` | by content: an Old Persian royal-name seal formula of Xerxes | text A; identification B |

Sign sequences: Old Persian stored sign by sign (a-da-ma | da-a-ra-ya-va-u-ša | xa-ša-a-ya-θa-i-ya; a-da-ma |
xa-ša-ya-a-ra-ša-a | …), the standard spellings of these words, converted to code points by the Unicode sign names (B;
not through the runtime spelling rules, which the Phase 8 review found wrong for Xerxes' name). Elamite and Babylonian ATF →
signs through the ORACC Sign List exactly as for the carved inscriptions (B; 0 unmapped). No translation is stored or shown
(B17a); the translation layer shows the ids and the transliterations.

Licence: ARIo is CC0; a mechanical sign-by-sign conversion of an ancient text is the ancient text. No modern translation or
commentary is stored.

## 3. The seals (C reconstructions of attested seals)

| id | attested (tier) | wording used (tier) | design (C) |
|---|---|---|---|
| PTS-treasurer-Darius | B: a royal seal with a trilingual royal-name inscription of Darius was still used under Xerxes and was at the disposal of the chief of the Treasury (WRITING-SX, IR-TREAS) | C: SDa (Q-320) | the royal hero holding two rampant lions (royal seals of Darius and Xerxes show the king victorious over animals or monsters: WRITING-SX, B); a framed trilingual panel; ground line. Height 26 mm, one turn 62 mm (C) |
| PTS-Xerxes-hero | B: a Treasury seal impression captioned "Hero Triumphant with Xerxes Inscription" (ISAC Photographic Archives, Contents of the Treasury, SX: ISAC-FINDS); Treasury sealings share seals with the Treasury tablets (WRITING-SX) | C: Q009270 (Q-320) | the royal hero stabbing a rampant lion; an Old Persian panel. Height 24 mm, one turn 58 mm (C) |

No licensed image of either seal was available (B6, B7): the figures are simple signed-distance silhouettes, recognisable as
a hero and lions but schematic; they read as C at arm's length.

## 4. The objects

| object | where | what is impressed | tier | placeholder? |
|---|---|---|---|---|
| PT tablet, filed (`pt_letter`) | scribes' room: benches (two rows) | obverse: the reconstructed memorandum PTR-1 (8 lines; Xerxes year 18, months 11–12), reverse uninscribed; the treasurer's seal rolled along the left edge (SITE_SPEC: sealed on the left edge, C); a cord hole at a corner (B: holes and cord remnants at a corner of the PT tablets, taken to show they were tied to leather scrolls with an Aramaic duplicate, Cameron's inference, WRITING-SX). Every filed tablet shows the same text (one atlas face) | C | no: **reconstructed text (C)** |
| PT tablet, fresh (`pt_letter_fresh`) | the drying board | obverse: PTR-2 (8 lines; year 19, month 1), reverse uninscribed; sealed on the left edge | C | no: **reconstructed text (C)** |
| the tablet being written (`pt_letter_unfinished`) | on the floor by the desk | obverse: the first four lines of PTR-3, the last one short; not yet sealed; reverse blank | C | no: **reconstructed text (C)** |
| leather scrolls (3) | by the drying board | rolled, tied with a cord at three points, a clay bulla on the middle tie rolled with the treasurer's seal; the Aramaic text is inside the roll and not shown | C (B: Aramaic on parchment at Persepolis and the tablet-to-scroll link; the scroll's form and the bulla C) | no (no text claimed) |
| door sealing (Treasury E door, Hall of 99 Columns store) | on the cord between the leaf knobs | the Xerxes hero seal rolled once across the flattened face of the lump | C (practice B; Q-089) | no, when the fonts loaded (the record reads the bake: F3 shows "NOT impressed" otherwise) |
| the carried tablet (prop) | scribes' hands | the same tablet's form and size at its LOD (12 triangles, no relief at that size) | C | no text at that size (the scribes' room text is reconstructed, C) |

Tablet signs (D-198, C): the Noto Sans Cuneiform outlines of the text's signs, sunk 0.5 mm into the clay with a soft
edge (a stylus impression is a hollow); one sign height per text, the largest ≤ 4 mm at which the longest line fits
(4.0 mm for all three); line pitch 1.4 × the sign height; no word spaces; no ruling lines (C, Q-321). (Session 6's
modelled wedge impressions without a text are gone.)

## 5. How it is built (D-179)

`src/world/writing.ts`: one 1024² height field in millimetres (regions: two obverses, reverse, sealed edge, door-sealing
face, plain clay) baked at load into a tangent-space normal map; the clay materials sample it, so every wedge and sign is
relief lit by the scene, never a painted mark. Seal inscriptions are drawn from the Noto Sans Old Persian / Cuneiform outlines
(the same fonts as the carved inscriptions), rasterised with exact coverage and raised in the rolled band (a seal cut in
intaglio leaves its design in relief). Bake ≈ 1 s under tsx on this loaded box.

Cost (measured, node): scribes' room 9 draws (was 6), 37,288 triangles (filed tablets 379 × 76, fresh 11 × 464, the
unfinished tablet 464, scrolls 3 × 420, bullae 3 × 252; was about 13 k); each door sealing 520 triangles (was 252), same
draw count; one 1024² RGBA8 texture (4 MB, 5.3 MB with mips). Carried tablet 12 triangles (unchanged).

## 6. Sources (keys in src/data/sources.json)

ARIO (FT), OSL (FT), NOTO, CDLI-PF (FT, the PF texts not used), WRITING-SX (new: search extracts of Iranica "Persepolis Elamite
Tablets", "Persepolis Administrative Archives ii" and "Documents"; page attribution uncertain), IR-TREAS, IR-PET, ISAC-FINDS,
HALMI-SX, ARSHAMA-BOD, MATCULT-R, RECON. Also seen as search results only: Garrison, Jones and Stolper, JNES 77 (2018) 1–14
(BM 108963); Garrison 1991, "Seals and the Elite at Persepolis" (archive.org, blocked); Bowman 1970 (OIP 91, blocked);
Cameron 1948 (OIP 65, blocked); "PT 005 – the new edition of Persepolis Treasury Tablets" (academia.edu, blocked).

## 7. The reconstructed Treasury memoranda (D-198)

**What they are.** The Treasury texts are known here only as summaries (IR-TREAS, IR-PET, SX): silver paid in lieu of all
or part of the rations of named groups of kurtaš, in letters ordering the treasurer to pay and in memoranda, most dated in
Xerxes years 19–20. The receipt formulary of the Fortification texts is read in full (CDLI-PF). The three texts below are
composed in that receipt formulary, with nothing but sourced parts, and are shown everywhere as "reconstructed on the
Treasury tablets' published formulary — not a surviving text (C)". This is in tension with §10 ("only published texts"),
resolved in D-198 by the label, the strict formulary and B18 staying open (Q-362).

| id | where | Elamite (ATF, the scribal lines joined) | the project's English (C) |
|---|---|---|---|
| PTR-1 | the filed tablets | 6(diš) kur-ša-um KU₃.BABBAR kur-min₂ {hal}ir-še-na-na {aš}ka₄-ap-nu-iš-ki-ma {hal}man-ma-ak-ka₄ a-ak {hal}ak-ka₄-ia-še du-iš-da {hal}kur-taš gal-li {aš}be-ul 1(u) 8(diš)-na {an}ITI.MEŠ {an}sa-mi-ia-maš a-ak {an}mi-ia-kan₂-na-iš-na PAP 2(diš) {an}ITI.MEŠ ha-tu-ma | 6 karša of silver, at the disposal of Iršena, in the treasury: Manmakka and his companions received (it), (as) rations (of) workers. 18th year (of Xerxes), the eleventh and the twelfth month: in total a period of two months. |
| PTR-2 | the fresh tablets | 3(diš) 1/2(diš) kur-ša-um KU₃.BABBAR kur-min₂ {hal}ir-še-na-na {aš}ka₄-ap-nu-iš-ki-ma {hal}ba-ka₄-du-iš-da a-ak {hal}kar-ki-iš du-iš-da {hal}kur-taš gal-li {an}ITI.MEŠ {an}ha-du-kan₂-nu-ia-na {aš}be-ul 1(u) 9(diš@v)-na | 3½ karša of silver, at the disposal of Iršena, in the treasury: Bakadušda and Karkiš received (it), (as) rations (of) workers. First month, 19th year (of Xerxes). |
| PTR-3 | the tablet being written | 2(diš) kur-ša-um KU₃.BABBAR kur-min₂ {hal}ir-še-na-na {aš}ka₄-ap-nu-iš-ki-ma {hal}ir-ti-ma | 2 karša of silver, at the disposal of Iršena, in the treasury: Irtima … (the scribe has written no further). |

**Where each part comes from.** kur-ša-um "karša": ARIo, the Elamite of Darius' weight stones (A). KU₃.BABBAR "silver": the
logogram in ARIo's Babylonian (A there); as an Elamite word C. kur-min₂ PN-na "at the disposal of PN", {aš}ka₄-ap-nu-iš-ki-ma
"in the treasury", du-iš-da "received", {hal}kur-taš gal-li "(for) rations of workers", a-ak "and", {hal}ak-ka₄-ia-še "his
companions", {aš}be-ul "year", {an}ITI.MEŠ "month", the month names, PAP "total", ha-tu-ma "for a period": Hallock PF via CDLI
(A), each spelled as the lexicon entry or its quoted attestation spells it (checked by tools/build_writing.py and
tests/writing.test.ts). "Bakadušda and Karkiš received (it)" is PF 13's wording with the same names; "19th year" is spelled
as in PF 59. Names: src/data/names.json (A as names; these persons of 467 are the project's, C). Signs: the words' ATF → OSL
(B), no word spaces.

**Dates (C).** The world runs from 1 Nisannu of Xerxes year 19 to the end of the year and the tablets do not change with
it, so each date is chosen to stand on every day shown: the archive's text is of the last two months of year 18; the fresh
tablets' of the first month of year 19 (fresh only near the start); the tablet being written has not reached its date.

**Not written, because not sourced.** The letter-order (the address "Tell PN, the treasurer: PN says", Elamite tiriš, removed
with the EWB data in D-192, and the imperative "give"); the shekel (amounts are in whole and half karša); the rate per head
and the ration the silver replaces (sheep, wine, grain). **What upgrades it:** Cameron OIP 65, JNES 17, JNES 24 (NEEDS #15).

