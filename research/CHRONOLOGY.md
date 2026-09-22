# CHRONOLOGY — filter for YEAR = 467 BCE (Xerxes yr 19)
Generated from `src/data/chronology.json` by `tools/chrono_to_md.py`. The JSON is the source of truth; it is used by `npm run lint:chrono` and by the generators.
**Rule: fail-closed.** Anything not listed as present is absent. Tier = evidence class, capped at B when only a search extract was seen (BLOCKERS B6).

| id | Structure | Built by | State at 1 Nisannu 467 | Present | Tier | Sources | Basis |
|---|---|---|---|---|---|---|---|
| terrace | Terrace platform and retaining walls | Darius I from c. 518 | standing | yes | B | IR-PERS;CHRON-C | DPd–g foundation texts on S face (inscriptions attested; seen via extract) |
| grand_stair | Grand double stairway (NW) | disputed Darius/Xerxes | standing | yes | B | IR-PERS;WP-COPY | exists by Xerxes' reign either way (clamp type of Xerxes, Iranica) |
| gate_nations | Gate of All Nations | Xerxes | standing, complete | yes | B | IR-PERS;CHRON-C | inscription XPa names it (via extract) |
| apadana | Apadana, porticoes, N and E stairs | Darius I → Xerxes | standing, complete | yes | B | IR-APAD;CHRON-C | foundation deposit 519–510; completed under Xerxes |
| tachara | Tachara (Palace of Darius) | Darius I → Xerxes | standing, complete | yes | B | LIVIUS;CHRON-C | XPc: Xerxes completed it (via extract) |
| hadish | Hadish (Palace of Xerxes) | Xerxes | standing | yes | B | IR-PERS;CHRON-C | named hadiš in Xerxes' inscription |
| harem | 'Harem of Xerxes' | Xerxes | standing | yes | B | IR-PERS;CHRON-C | foundation tablet of Xerxes; built over W Treasury |
| treasury | Treasury (final phase) | Darius I, Xerxes | standing, in use | yes | B | IR-PERS;IR-TREAS | Treasury tablets 492–458 being written |
| tripylon | Tripylon / Central Palace | disputed; finished by Artaxerxes I | under construction | yes | C | IR-PERS;LIVIUS | Iranica: Xerxes + Artaxerxes I; completion state in 467 is reconstruction |
| hall100 | Hall of a Hundred Columns | Xerxes → Artaxerxes I | under construction | yes | C | IR-PERS;ISAC-PA | begun by Xerxes, completed by Artaxerxes I (stone plate); progress in 467 reconstructed |
| fortification_e | Mud-brick fortification wall, E side and mountain crest | Darius/Xerxes (builder not given) | standing | yes | B | IR-FORT;ISAC-PA | Schmidt-derived captions; date assumed with the Terrace (C) |
| garrison | Garrison quarters (E/SE foot of mountain) | not given | standing (modest rooms) | yes | C | ISAC-PA | ISAC: modest structures near SE corner housing garrison; OSM footprint also covers a later 32-column hall, excluded |
| palace_h | Palace H | Artaxerxes I (?) | absent | no | B | ISAC-PA;CHRON-C | after 465 |
| palace_g | Palace G | post-Achaemenid over older building | absent | no | B | ISAC-PA;CHRON-C | standing remains post-Achaemenid |
| palace_a3 | Palace of Artaxerxes III / 32-column hall | Artaxerxes III | absent | no | B | LIVIUS;CHRON-C | 358–338 |
| unfinished_gate | Unfinished Gate and Army Road | late Achaemenid | absent | no | B | LIVIUS;IR-PERS | unfinished at the sack; builder probably Artaxerxes III |
| tombs_rahmat | Kuh-e Rahmat tombs (Artaxerxes II/III, unfinished tomb) | 4th c. | absent (bare cliff) | no | B | LIVIUS;CHRON-C | attributions 4th c. |
| nr_darius | Tomb of Darius I, Naqsh-e Rustam | Darius I | standing, sealed | yes | B | LIVIUS-NR | DNa/DNb inscriptions |
| nr_later_tombs | Naqsh-e Rustam tombs attributed to Xerxes, Artaxerxes I, Darius II | later kings | absent (uncut cliff) | no | C | LIVIUS-NR | attributions are uncertain (B); all three are royal tombs of kings dying after 467, so cutting before death is not evidenced — reconstruction |
| nr_elamite_relief | Elamite rock relief, Naqsh-e Rustam (7 × 2.5 m) | Neo-Elamite | standing (intact, pre-Sasanian) | yes | B | ALVAREZMON | later overcarved by Bahram II (Sasanian) — the Sasanian relief is blocklisted |
| nr_kaba | Ka'ba-ye Zartosht tower, Naqsh-e Rustam | disputed (Darius I or earlier) | standing | yes | C | LIVIUS-NR | date disputed; OPEN_QUESTIONS Q-006 |
| nr_sasanian | Sasanian reliefs at Naqsh-e Rustam | Sasanian | absent | no | B | ALVAREZMON | 3rd c. CE+ (blocklist) |
| tol_ajori | Tol-e Ajori glazed-brick gate | Cyrus/Cambyses c. 539–518 | standing, not a focus | yes | C | CHRON-C | state in 5th c. unknown (Q-004) |
| tachara_a3_stair | Tachara W stair and inscription of Artaxerxes III | Artaxerxes III | absent | no | B | IR-PERS | A3Pa |
| modern | Modern roofs, museum (Krefter 1930s rebuild), ticket office, 1971 tent city, plantations | modern | absent | no | B | OSM;IR-PERS | blocklist |
| modern_roof | Modern protective roof over the Apadana E stair | modern | absent | no | B | OSM | blocklist (restoration) |

## Archives in use in 467 BCE
| Archive | State | Tier | Sources |
|---|---|---|---|
| Treasury Archive (492–458; peak Xerxes yrs 19–20) | active | B | IR-TREAS |
| Fortification Archive (509–493) | closed; tablets stored in the fortification | B | CHRON-C |

## King and court (brief §2)
- No source places Xerxes at Persepolis on any date in 467 BCE (Q-005).
- General pattern: Persepolis was a seasonal spring/summer residence of a mobile court (WP-PERS-SEASON, RESIDENCE2021; B for the pattern, C for any given year). Under Darius I, trips to the king peaked at the New Year (KING2022, B).
- **Default (evidence-strict): the king is ABSENT**, with a smaller garrison guarding the Treasury (§9.1). The setting *Court calendar = seasonal pattern* (out-of-world, tier C) puts the court in residence Nisannu–Du'uzu. See DECISIONS D-003.

## People filter
- Named NPCs must be attested around Xerxes yrs 15–20 (Treasury tablets) or be long-tenured. Darius-era Fortification Archive individuals are allowed only as tier C, and only if their life plausibly spans to 467.
