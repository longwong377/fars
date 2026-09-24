# Writing on objects (Phase 8, session 6; D-179)

Brief §10: "Elamite on clay tablets; Aramaic ink on leather; seal impressions". Brief §1.1: "specific attested tablets
being written and sealed with real, attested seals". Review REVIEWS/phase8.md M4.

**Read first: what is placeholder.** No Persepolis Treasury (PT) text could be read from this sandbox, so the Elamite on
every tablet in the world is a PLACEHOLDER: wedge impressions laid out in lines, with no readable text and no invented sign
sequence (BLOCKERS B18). The only real texts in clay are the two seal inscriptions below, and which seal carried which
wording is itself a C-tier reconstruction (Q-320). The seal figures are C-tier compositions, crude at arm's length.

Access keys as in SOURCES.md: FT = read in full, SX = search-engine extract only (host blocked, B6).

## 1. Which texts belong in 467 BCE

| Corpus | Date | Where in 467 | Script / medium | Reachable here? | Tier / use |
|---|---|---|---|---|---|
| Persepolis Treasury tablets, PT (Cameron 1948, 1958, 1965; collations Hallock 1960, Arfaʿi 2008) | year 30 of Darius I to year 7 of Artaxerxes I (492–457); **most dated texts from Xerxes years 19 and 20** | a north-eastern room of the Treasury (the scribes' room, D-067) | Elamite on clay; 139 Elamite + 1 Akkadian published | **No.** ISAC (OIP 65), archive.org, JSTOR, academia.edu blocked (B6); the CDLI dump (cdli-gh/data, cdliatf_unblocked.atf, FT) carries no PT text; web search summaries give no sign sequence | the right texts for the scene (A as texts) but **not used: placeholder** (B18, NEEDS #4) |
| Fortification tablets, PF (Hallock 1969) | 509–493 | bricked up in the north-east fortification (PFA-ISAC) | Elamite on clay | 67 texts (PF 1–60, 400–406) in the CDLI dump (FT) | **not used**: archived for 26 years by 467 and not in the Treasury; putting one in a scribe's hands would be an anachronism |
| BM 108963 (Garrison, Jones and Stolper, JNES 77, 2018) | Darius year 35 (487) | provenance not established | Elamite on clay, with a seal bearing an Old Persian inscription | ATF in the CDLI dump (FT) | not used (not shown to be from the Treasury) |
| Aramaic Fortification texts, PFAT; Aramaic glosses on Elamite tablets | 509–493 | Fortification | Aramaic ink or incised on clay | no | not used |
| Aramaic ritual texts on green chert (Bowman 1970, OIP 91) | Xerxes to Artaxerxes I | the Treasury | Aramaic ink on stone mortars, pestles, plates | no (ISAC, archive.org blocked; no transliteration in any reachable source) | not used; the chert sets in the store stay uninscribed (open) |
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
| PT letter-order tablet (filed, fresh) | scribes' room: benches (two rows), the drying board | obverse 13 lines and reverse 5 lines of wedge impressions (no text); the treasurer's seal rolled along the left edge (SITE_SPEC: sealed on the left edge, C); a cord hole at a corner (B: holes and cord remnants at a corner of the PT tablets, taken to show they were tied to leather scrolls with an Aramaic duplicate, Cameron's inference, WRITING-SX) | C | **yes (text)** |
| the tablet being written | on the floor by the desk | six lines of wedges, the last broken off; not yet sealed; reverse blank | C | **yes (text)** |
| leather scrolls (3) | by the drying board | rolled, tied with a cord at three points, a clay bulla on the middle tie rolled with the treasurer's seal; the Aramaic text is inside the roll and not shown | C (B: Aramaic on parchment at Persepolis and the tablet-to-scroll link; the scroll's form and the bulla C) | no (no text claimed) |
| door sealing (Treasury E door, Hall of 99 Columns store) | on the cord between the leaf knobs | the Xerxes hero seal rolled once across the flattened face of the lump | C (practice B; Q-089) | no, when the fonts loaded (the record reads the bake: F3 shows "NOT impressed" otherwise) |
| the carried tablet (prop) | scribes' hands | the same tablet's form and size at its LOD (12 triangles, no relief at that size) | C | **yes (text)** |

Wedge impressions (C): a stylus corner makes a triangular head, deepest near the apex, with a tail groove; horizontals,
verticals and oblique Winkelhaken in clusters; line pitch 4.6 mm, head 1.4–1.6 mm (C). No ruling lines are drawn (C, Q-321).

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
