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

## Settlement and plain (Phases 6–7)
Generated from `src/data/settlement.json` and `src/data/plain.json` (research/SETTLEMENT.md, research/PLAIN.md). Tier = the lower of existence and position. `open` = not placed pending a decision.

| id | Feature | Date | Present 467 | Tier | Sources | File |
|---|---|---|---|---|---|---|
| tol_ajori_gate | Tol-e Ajori gate (Bagh-e Firuzi) | c. 539-518 BCE (Cyrus/Cambyses), before the Terrace | yes | C | TOLAJORI2017; AJORI-BRICK2018; AJORI2013; DASHTESTAN2021 | settlement.json |
| zone_bagh_e_firuzi | Bagh-e Firuzi palace-and-garden zone | Achaemenid (from c. 539) | yes | C | GONDET2009; DASHTESTAN2021; AJORI2013 | settlement.json |
| zone_persepolis_west | Persepolis West (Sumner's Firuzi mounds; lower town) | Achaemenid and post-Achaemenid | yes | C | PW2017; GONDET2009; DASHTESTAN2021; SUMNER1986; PLEIADES-FARS | settlement.json |
| pw_area_a | Persepolis West Area A (strong geomagnetic anomalies) | Achaemenid?/post-Achaemenid | yes | C | PW2017; OVERTURE-2026 | settlement.json |
| pw_area_b_craft | Persepolis West Area B craft zone: kiln, bone pits, pigment workshop | possible Achaemenid | yes | B | PW2017; PW-PIGMENT2021 | settlement.json |
| pw_area_c_garden | Persepolis West Area C: garden (ditch grid + fence wall) | Achaemenid? | yes | C | PW2017; DASHTESTAN2021 | settlement.json |
| north_official_complex | ~1 ha building N of the "Frataraka" complex | Achaemenid | yes | C | GONDET2018 | settlement.json |
| frataraka_complex | "Frataraka" complex (pedestal temple) | post-Achaemenid (3rd-2nd c. BCE?) | no | B | GONDET2018; DASHTESTAN2021 | settlement.json |
| takht_e_rustam | Takht-e Rustam (unfinished stepped platform) | early Achaemenid (c. 530-522?) | yes | C | LIVIUS-TR; PLEIADES-FARS | settlement.json |
| zone_dasht_e_gohar | Dasht-e Gohar palace-and-garden zone | Achaemenid | yes | C | GONDET2009; PLEIADES-FARS | settlement.json |
| canal_kuh_e_rahmat | Kuh-e Rahmat canal (Pulvar to Persepolis) | Achaemenid (probable) | yes | C | MAYS2010; BOUCHARLAT2012; KURHYDRO2024 | settlement.json |
| zone_lower_town_south | Lower town S/SW of the Terrace (Matezziš?) | Achaemenid | yes | C | DASHTESTAN2021; GONDET2009; PEOPLE-R | settlement.json |
| road_naqsh_e_rustam | Road Terrace - Naqsh-e Rajab gap - Takht-e Rustam - Naqsh-e Rustam | Achaemenid (C) | yes | C | LIVIUS-TR | settlement.json |
| road_pasargadae | Road Persepolis - Pulvar valley - Sivand - Tang-e Bulaghi - Pasargadae | Achaemenid (C) | yes | C | PLEIADES-FARS; BOUCHARLAT2012 | settlement.json |
| road_royal_west | Royal road toward Susa (leaves the plain W/NW) | Achaemenid | yes | C | ROYALROAD-GIS; SUMNER1986 | settlement.json |
| road_south_tirazzish | Road S across the plain to the Kur crossing near Tukrash? and on to Tirazziš (Shiraz) | Achaemenid (C) | yes | C | PLEIADES-FARS; SUMNER1986 | settlement.json |
| waystation_kur_west | Way-station at the Kur crossing (royal road) | Achaemenid (C) | yes | C | ROYALROAD-GIS | settlement.json |
| akhor_rostam_niches | Akhor Rostam rock-cut burial niches | Achaemenid? / Sasanian? | yes | C | IR-ARCH2; PLEIADES-FARS | settlement.json |
| spring_cemetery | "Spring Cemetery" near Persepolis | late 4th c. BCE or later | no | B | IR-ARCH2 | settlement.json |
| private_rock_tombs | Rock-cut tombs of private people near Persepolis (Herzfeld) | undated | open | C | IR-ARCH2 | settlement.json |
| river_pulvar | Pulvar (Sivand; Araxes? of the Greeks) | natural | yes | C | PLEIADES-FARS; KOR-HSJ2023; WMO-CLINO | plain.json |
| river_kur | Kur (Kor; Cyrus/Araxes?) | natural | yes | C | PLEIADES-FARS; KOR-HSJ2023; WMO-CLINO | plain.json |
| dam_sang_e_dokhtar | Sang-i Dokhtar dam | Achaemenid | yes | B | PLEIADES-FARS; KURHYDRO2024; BOUCHARLAT2012 | plain.json |
| bard_burideh | Bard-e Burideh (I settlement; II dam) | Achaemenid | yes | B | PLEIADES-FARS; KURHYDRO2024 | plain.json |
| village_masumabad_west | Masumabad West | Achaemenid | yes | C | PLEIADES-FARS; SUMNER1986 | plain.json |
| village_saidun | Saidun | Achaemenid | yes | C | PLEIADES-FARS; SUMNER1986 | plain.json |
| village_tukrash | Tukrash? (Achaemenid buildings and embankments by the Kur, 20 km S) | Achaemenid | yes | C | PLEIADES-FARS; SUMNER1986 | plain.json |
| village_rakkan | Mansurabad East / Rakkan? (Sumner site R) | Achaemenid | yes | C | PLEIADES-FARS; SUMNER1986 | plain.json |
| quarry_sivand | Sivand quarry | Achaemenid | yes | B | PLEIADES-FARS | plain.json |
| quarry_majdabad | Majdabad quarry | Achaemenid | yes | B | PLEIADES-FARS | plain.json |
| qadamgah | Qadamgah (rock-cut site) | Achaemenid? | yes | B | PLEIADES-FARS | plain.json |
| nr_darius_tomb | Tomb of Darius I, Naqsh-e Rustam | c. 500-486 BCE | yes | B | LIVIUS-NR; OVERTURE-2026 | plain.json |
| nr_xerxes_tomb | Tomb attributed to Xerxes (ENE of Darius I) | c. 486-465 BCE? | open | C | LIVIUS-NR; WP-NR | plain.json |
| nr_kaba | Ka'ba-ye Zardosht | Darius I or Xerxes I | yes | C | LIVIUS-NR; WP-NR; OVERTURE-2026 | plain.json |
| nr_elamite_relief | Neo-Elamite rock relief (intact) | Neo-Elamite | yes | B | ALVAREZMON | plain.json |
| istakhr | Istakhr | Sasanian-Islamic | no | B | ISTAKHR2018; PLEIADES-FARS; OVERTURE-2026 | plain.json |
| naqsh_e_rajab | Naqsh-e Rajab (Sasanian reliefs) | Sasanian / later | no | B | PLEIADES-FARS | plain.json |
| darre_ye_barre | Darre-ye Barre (temple, Roman/Late Antique) | Sasanian / later | no | B | PLEIADES-FARS | plain.json |
| hajjiabad | Hajjiabad (temple, Roman) | Sasanian / later | no | B | PLEIADES-FARS | plain.json |
| maqsudabad | Maqsudabad (temple, Roman/LA) | Sasanian / later | no | B | PLEIADES-FARS | plain.json |
| kuh_i_ayyub | Kuh-i Ayyub (temple, Roman/LA) | Sasanian / later | no | B | PLEIADES-FARS | plain.json |
| kuh_i_shahrak | Kuh-i Shahrak (temple, Roman/LA) | Sasanian / later | no | B | PLEIADES-FARS | plain.json |
| mountain_kuh_e_rahmat | Kuh-e Rahmat | natural | yes | B | OVERTURE-2026; COP-DEM | plain.json |
| mountain_kuh_e_hossein | Kuh-e Hossein (Husain Kuh), the Naqsh-e Rustam mountain | natural | yes | B | WP-NR; COP-DEM | plain.json |
