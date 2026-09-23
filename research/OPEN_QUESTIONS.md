# OPEN QUESTIONS (conflicts and unknowns, with the working value in use)
| id | Question | Evidence | Working value | Tier | Unblock |
|---|---|---|---|---|---|
| Q-001 | Apadana column height | Iranica 19.50 / >19 m; popular 24–25 m. Hypothesis: the popular figures add podium and roof | 19.5 m | B | Schmidt 1953 |
| Q-002 | Grand Stair riser: 0.10 m (WP) vs total rise 12 m / 111 steps | WP tertiary; Iranica 12 m landing | 0.108 m | C | Schmidt / Tilia |
| Q-003 | Ancient ground level at the Terrace foot | not found; modern alluvium and subsidence | modern DSM, 0 m correction | C | Schmidt plan contours; Tilia |
| Q-004 | Tol-e Ajori standing in the 5th c.? | no source | standing, not a focus | C | Askari Chaverdi, Callieri & Matin 2017 |
| Q-005 | King at Persepolis in 467 BCE? | New Year court traffic (Darius, KING2022); seasonal spring/summer residence pattern (WP-PERS-SEASON, RESIDENCE2021); nothing for Xerxes yr 19 | ABSENT by default; 'seasonal pattern' setting = present Nisannu–Du'uzu | C | Henkelman 2010; Treasury tablets PT dated to Xerxes 19 |
| Q-006 | Ka'ba-ye Zartosht date | disputed (Darius I or earlier) per LIVIUS-NR (search extract) | standing | C | Schmidt, Persepolis III |
| Q-007 | Tripylon builder and state in 467 | Iranica: Xerxes + Artaxerxes I; Livius: Darius | under construction | C | Schmidt |
| Q-008 | Tachara hall 15.15 × 15.42 vs a 3×4 grid | WP extract | overall 30 × 40, grid 3×4 | C | Schmidt |
| Q-009 | Apadana hall side 58 / 60 / 60.5 m | Iranica "at least 58"; "60 × 60" | 60.5 | C | Schmidt |
| Q-010 | Apadana podium 2.5 m (popular) vs 3 m (Iranica) | — | 3.0 | B | Schmidt |
| Q-011 | Everyday coin use in 467 (darics exist) | brief blocklist | coins stored in the Treasury only, not used in the street | B | Treasury tablet studies |
| Q-012 | Hall of 100 Columns construction progress in 467 | begun by Xerxes; finished by Artaxerxes I | bases set, about 30% of shafts up | C | Schmidt; Roaf |
| Q-013 | Rice cultivation in Achaemenid Fars | — | blocked (not grown) | C | PF tablets (rice is attested in PF? check) |
| Q-014 | Apadana "portico 60 × 25 m" (A) | implausible | rejected | — | — |
| Q-015 | Stair direction (lower flights from centre outward) | OSM lane layout + Iranica turns | centre-outward | C | Schmidt plan |
| Q-016 | Apadana foundation deposits: 2 boxes (NE, SE) or 4 corners? | ISAC/WP extracts vs Iranica extract | modelled at NE and SE (the attested finds), with the other two corners unknown | B/C | Schmidt 1953 |
| Q-017 | Stated building sizes vs OSM platform footprints (Tachara 30×40 vs 33.4×44.1; Hadish 40×55 vs 57.3×73.8) | the OSM footprints include platforms and stairs | the plan overlay compares the built platform outline (which includes stairs) with the OSM footprint; the building sits on it | C | Schmidt plan |
| Q-018 | Hadish floor: formula gives +6.0 m; DSM gives +3.5–5.5 | Iranica "18 m above plain" (B); modern DSM | 6.0 | C | Schmidt sections |
| Q-019 | N terrace edge not confirmed by DSM (one profile, off by 97 m; cause not investigated) | research/DEM_EDGE_CHECK.md | OSM outline | B | orthophoto / Schmidt |
| Q-020 | Column shaft colour (pink-red in Getty's reconstruction, dark red at persepolis3D, cream elsewhere) | only reconstructions (references/INDEX.md); no pigment evidence for shafts found | stone/limestone unpainted shaft (C) until evidence; capitals painted per the capital research | C | Nagel 2010/2023 |
| Q-021 | Double horse-protome capitals at Persepolis: which building? | one 3D model in references; research not done | not used | C | Schmidt 1953 |
| Q-022 | Old Persian everyday speech: no greeting, reply, thanks, yes/no, "water", "bread", "come/go/give"; attested formulas need forms the lexicon lacks (gen. A.uramazdāhā for *vašnā A.uramazdāhā*, XPa 11) | ARIo word scan (LEXICON/old_persian.json records the absence) | OP speech lines limited to three inscription formulas (baga vazṛka A.uramazdā; A.uramazdā pātu; Pārsa uvaspā umartiyā); Persians greet in Aramaic when the sim gives them Aramaic, otherwise gesture only (src/people/speech_lines.ts LEXICON_GAPS) | A (absence) | add attested inflected forms from ARIo XPa/DPd to the lexicon |
| Q-023 | Elamite speech: no greeting/yes/no entries; gen. Uramasda-na (XPa El, *zaumin Uramasdana*) not in lexicon; ration words ŠE.BAR, ZÍD.DA, GEŠTIN, QA have no phonetic reading; halmi and dušda are "NOT SEEN" | LEXICON/elamite.json | lines: nap iršarra Uramasda; Uramasda nuškišni; halmi? (flagged C, unverified); kurtaš! (C) | B/C | Hallock 1969 glossary; Henkelman 2008 |
| Q-024 | Aramaic: the letter blessing ʾlhyʾ yšʾlw šlmk and the address mrʾy "my lord" need forms not in the lexicon; no yes/no/come/go/thanks (e.g. lʾ); all vocalisation is Biblical/Tiberian-derived (later than 467) | LEXICON/aramaic.json; Elephantine/Arshama letter formulas (extracts) | lines: šlm; šlm mrʾ (composed, C); ḥd trn tlt; lḥm; spr; ʾgrh | B words / C IPA | Porten & Yardeni TAD; Muraoka & Porten grammar |
| Q-025 | No lexicon for Babylonian (Akkadian), Greek, Egyptian, Lydian speakers in the sim | LANGUAGES.md §1 | no scripted lines (gesture); crowd murmur uses the Aramaic profile, flagged fallback C | C | build lexicons from published texts (Phase 8) |
| Q-026 | Accent and speech rate of Old Persian, Elamite and Imperial Aramaic | none found | synth rules: OP weight-sensitive penult/antepenult, Elamite initial, Aramaic final; rates 1.0/1.05/1.1 (src/audio/speech.ts STRESS_RULES) | C | Old Persian metrics/Avestan comparanda; Aramaic grammars |
