# SETTLEMENT (Phase 6): lower town and palace-and-garden zones, 467 BCE

**Read this first: what is weak.**
- **No scholarly source was read in full.** Every host that holds these papers is blocked (BLOCKERS B6: academia, ResearchGate, achemenet, openedition, ScienceDirect, unibo/unimi/uniurb repositories, archaeology.org, ensani.ir, PMC, irangazetteer). Scholarly rows are search extracts (SX), capped at B.
- **Full-text data sources:** the Pleiades per-place JSON (periods and references) and the Overture 2026-08 places/base themes were downloaded, as were SRTM terrain tiles and Herodotus (Perseus TEI).
- **Layout is C.** Only these are sourced:
  - Tol-e Ajori: size and date (B);
  - Persepolis West Area B: its activities (B);
  - Takht-e Rustam: size (B);
  - existence of the garden zones, a ~1 ha official building N of the Terrace, and a Pulvar–Persepolis canal (B).

  **Every position is C**, with its uncertainty given.
- **Not placed, for lack of evidence:** storehouses, stables, a garrison outside the Terrace, qanats. A burial ground in use in 467 is placed since D-209 as the most probable reconstruction (C; section 6). See the gaps below.

Machine-readable file: `src/data/settlement.json`. Its frame is the project grid: pyproj tmerc about the Apadana origin, rotated −19°, as in `tools/osm_to_grid.py`. `src/core/geo.ts` agrees to within 2 m at 6 km and about 80 m at 40 km.

Access: `SX` = search extract, `FT` = full text or dataset downloaded, `NS` = not seen (recollection, C).

## 1. Elements

| id | Element | Position (grid x, y m / lat, lon) | ± m | Size | Date vs 467 | Present 467 | Source | Access | Tier | Note |
|---|---|---|---|---|---|---|---|---|---|---|
| tol_ajori_gate | Tol-e Ajori monumental gate, Bagh-e Firuzi | −2381, 2290 / 29.94766, 52.85846 | 700 | 39.07 m (NW–SE) × 29.05 m (NE–SW); ~12 m high (press) | built c. 539–518 (Cyrus/Cambyses), before the Terrace | yes (state C) | TOLAJORI2017; AJORI-BRICK2018; AJORI2013; DASHTESTAN2021 | SX | size B; height C; position C | Mud brick with baked and glazed brick. Plan copies the inner Ishtar Gate of Babylon but is larger; two entrance corridors. Glazed relief bricks copy the Babylonian panels "down to the smallest detail" (bulls, dragons). "3.5 km NW" / "3 km" / "almost 3.5 km W/NW, S side of the Pulvar"; placed at 3.3 km, 295° true, 440 m S of the modern Pulvar. The 2014 report traces it "from construction to destruction", but the **date of destruction was not retrieved** (Q-004, Q-051). Working value: standing, old and unrepaired (C). The earlier LANDSCAPE.md estimate (29.957, 52.864; 3.46 km at 315°) lies 1.2 km NE, about 170 m N of the modern river, so it is superseded |
| zone_bagh_e_firuzi | Bagh-e Firuzi palace-and-garden zone | polygon around the gate, 1.7 × 1.5 km | 500 | – | Achaemenid | yes | GONDET2009; DASHTESTAN2021 | SX | B existence / C extent | "Very low-density elite-royal occupation established in large green spaces with Achaemenid complexes dedicated to a garden." Column bases and foundations were seen beyond the gate (press, C) |
| zone_persepolis_west | Persepolis West = Sumner's Firuzi mounds | polygon x −1700…−100, y −700…1100 | 400 | 50 ha surveyed in 23 areas | Achaemenid and post-Achaemenid | yes | PW2017; GONDET2009; SUMNER1986; PLEIADES-FARS | SX / FT | B / C extent | Low mounds W of the Terrace with dense sherds (Sumner). Geophysics: strong magnetism read as kilns and crafts, plus "levelled remains of a settlement with mud-brick structures". Barrington's "Firuzi 2 / Matezziš? / Humadešu? / Uvadaicaya?" is Classical, 550–330 BCE (FT); its point is map-scale |
| pw_area_a | Area A, W of the modern parking lot | −590, 375 / 29.93658, 52.88246 | 200 | – | ? | yes | PW2017; OVERTURE-2026 | SX / FT | C | Area A was chosen for strong geomagnetic anomalies; its findings were not retrieved |
| pw_area_b_craft | **Area B craft zone** | −1063, 538 / 29.93658, 52.87727 (500 m W of Area A) | 250 | – | "possible Achaemenid" | yes | PW2017; PW-PIGMENT2021 | SX | activity B; position C | A kiln and industrial remains. Pits of bone, read as raw material for the **fluorapatite used to whiten the grey limestone of the Terrace**. Pigment lumps of azurite, malachite, **Egyptian blue** (local production: diopside, and a bronze scrap with a blue crust), glauconite, and red and yellow ochre. The palette matches the Terrace |
| pw_area_c_garden | Area C garden | −1300, 200 | 600 | – | Achaemenid? | yes | PW2017 | SX | C | A grid of ditches with a fencing wall, read as a garden |
| north_official_complex | ~1 ha official building N of the "Frataraka" complex | −50, 650 | 300 | ~100 × 100 m (C) | Achaemenid | yes | GONDET2018 | SX | B existence / C position | Geophysics and pedestrian survey, 2012–14 |
| frataraka_complex | "Frataraka" pedestal temple complex | −50, 430 | 250 | – | post-Achaemenid (Callieri) | **no** | GONDET2018 | SX | B | Blocklisted: `frataraka` |
| takht_e_rustam | Takht-e Rustam, an unfinished stepped platform | 818, 4099 / 29.97248, 52.88368 | 400 | ~12.5 × 12.5 m | early Achaemenid; attribution to Cambyses C | yes | LIVIUS-TR | SX | B size / C position | "2 km S of Naqsh-e Rustam, on the road to Naqsh-e Rajab". Barrington's DARMC point lies 0.8 km S of the Terrace (accuracy 10 km); conflict Q-048 |
| zone_dasht_e_gohar | Dasht-e Gohar palace-and-garden zone | 1.4 × 1.1 km around Takht-e Rustam | 600 | – | Achaemenid | yes | GONDET2009; PLEIADES-FARS | SX / FT | B / C | Garden complexes. A hypostyle hall was reburied behind the platform (extract, C). Tilia 1978, pp. 73–80, is cited by Pleiades |
| canal_kuh_e_rahmat | Kuh-e Rahmat canal, from the Pulvar to Persepolis | polyline (4446, 3351) → (260, 300) | 500 | ~5.4 km; 2 × 0.8 m (C) | probably Achaemenid | yes | MAYS2010; BOUCHARLAT2012; KURHYDRO2024 | SX | B existence / C course | "The 4-km canal began at the Pulvar and followed a steep, but declining, slope toward Persepolis", with a small dam and an entrance reservoir (engineering overview). DEM check: Pulvar about 1,626 m at the take-off, Terrace foot about 1,616 m, a fall of about 0.2 % |
| zone_lower_town_south | Lower town S/SW of the Terrace (Matezziš?) | polygon x −1700…−100, y −1600…−700 | 600 | settled zone ~20 km², very low density | Achaemenid | yes | DASHTESTAN2021; GONDET2009 | SX | C | Houses: mud-brick courtyard houses with flat roofs, by regional analogy (**C, no excavated house**) |
| roads (4) | to Naqsh-e Rustam; to Pasargadae up the Pulvar valley; the royal road W toward Susa; S to Tukrash? and Tirazziš | polylines in JSON | – | 6–8 m earth (C) | Achaemenid | yes | LIVIUS-TR; ROYALROAD-GIS; SUMNER1986; PLEIADES-FARS | SX / FT | C course | Sumner's "paved road" and parts of the Royal Road exist in the plain, but their location was not retrieved (Q-054). Susa–Persepolis: 23 stages, ~552 km (one summary) |
| waystation_kur_west | Way-station at the Kur crossing | −11000, 500 | 3000 | walled court, store, stable (C) | Achaemenid | yes | ROYALROAD-GIS | SX | C | By analogy with the Jinjun and Qaleh-ye Kali way-stations (B). The first station out of Persepolis is not identified |
| akhor_rostam_niches | Akhor Rostam rock-cut burial niches | 29.86553, 52.948606 (9.6 km SE) | 3000 | – | Achaemenid (Vanden Berghe) vs Roman/Late Antique (Barrington) | uncertain (modelled yes, C) | IR-ARCH2; PLEIADES-FARS | SX / FT | C | Q-049 |
| spring_cemetery | "Spring Cemetery" near Persepolis | not retrieved | – | slipper coffins, extended burials | late 4th c. BCE or later | **no** | IR-ARCH2 | SX | B | |
| private_rock_tombs | Private rock-cut tombs near Persepolis (Herzfeld) | not retrieved | – | slab-closed | undated | not placed | IR-ARCH2 | SX | C | |

## 2. Crafts evidenced (for workshops)
| Craft | Evidence | Where | Source | Access | Tier |
|---|---|---|---|---|---|
| Pigment making, including Egyptian blue synthesis | pigment lumps, diopside, blue-crusted bronze scrap | Persepolis West Area B | PW-PIGMENT2021 | SX | B |
| Firing (kiln; product not retrieved) | kiln and industrial remains | Area B | PW2017 | SX | B (date possible Achaemenid) |
| Bone processing for fluorapatite (stone whitening) | pits of bone fragments | Area B | PW2017 | SX | B |
| Glazed-brick production in Babylonian technique | Tol-e Ajori bricks (Babylonian model; differs from Susa/Persepolis bricks) | Tol-e Ajori | AJORI-BRICK2018; AJORI2013 | SX | B for the technique; C that it continues in 467 (the gate is 50–70 years old) |
| Stone quarrying | Sivand (Classical, ±100 m) and Majdabad quarries | plain.json | PLEIADES-FARS | FT | B |
| Metal, wood, textiles, gold | PT craftsmen: woodworkers, goldsmiths, stonecutters (PEOPLE.md) | location unknown | IR-TREAS | SX | B existence / C place |

## 3. Proposed zoning (grid polygons; all positions C)
| Zone | Polygon (grid m) | Tier | Content in 467 |
|---|---|---|---|
| Terrace | `footprints.json` terrace (x −61…256, y −239…235) | B | Phases 1–5 |
| Persepolis West / Firuzi mounds | (−1700, −700) (−100, −700) (−100, 900) (−1700, 1100) | C (B existence) | Craft zone (Area B), scattered mud-brick houses and yards, a garden (Area C), middens by the kiln |
| Lower town S/SW | (−1700, −1600) (−100, −1600) (−100, −700) (−1700, −700) | C | Houses, pens, stores, bakeries; the densest part of the town (C) |
| N official zone | 100 × 100 m at (−50, 650) | C (B existence) | 1 ha official building. The "Frataraka" complex site at (−50, 430) is **empty** in 467 |
| Bagh-e Firuzi | around (−2381, 2290), 1.7 × 1.5 km, S of the Pulvar | C (B existence) | The Tol-e Ajori gate, walled gardens, pavilions (C), canals |
| Dasht-e Gohar | around (818, 4099), 1.4 × 1.1 km | C (B existence) | Takht-e Rustam platform, hypostyle hall (C), gardens |
| Kuh-e Rahmat canal | polyline (4446, 3351) → (260, 300) | C (B existence) | Earth canal feeding the Terrace foot and the N zone |
| Roads | see JSON | C | Earth roads, 6–8 m |

Population, with the court absent: 3,000–6,000 in the town and palace zones (PEOPLE.md, C). The plain density derived from Sumner is 44,000 / 675 ha ≈ 65 persons/ha of settled area (C, derived).

## 4. Gardens (paradises)
| Value | Source | Access | Tier |
|---|---|---|---|
| Estates and gardens appear in the tablets as *partetaš*; the tablets record workers hired to tend royal gardens | Iranica "Garden v" (search summary); PF literature | SX | B |
| Pasargadae: an excavated garden with quadrangular beds divided by flowing channels | same | SX | B (analogy) |
| Pasargadae watercourses: "limestone channels, 25 cm wide and punctuated with a deep square basin every 13 or 14 m ... The channels probably sat flush with the ground surface" (Stronach's excavation, 1961-63) | PASARGADAE-CHANNELS | SX | B (analogy). Built (D-149): dressed blocks ~1 m long with 2 cm joints (C), 13 cm lips (C), a basin 0.7 m square every 13.5 m (size C); the lip stands 7 cm proud of the ground because the heightfield cannot be cut (C) |
| Persepolis area: garden complexes at Bagh-e Firuzi and Dasht-e Gohar; Persepolis West Area C | GONDET2009; PW2017 | SX | B |
| Planting: plane, cypress, pomegranate, olive (Maharlou pollen, Achaemenid arboriculture), with fig, apple, pear and mulberry (PF fruits) | SAEIDI2021; IR-FOODAG | SX | B species / C mix |
| Game in the paradises (brief §5.5): no Persepolis-specific evidence retrieved | – | – | C |

## 5. Water
- **Canal:** the Pulvar canal (above).
- **Qanats: none placed.** No Achaemenid qanat is archaeologically dated. The debate is open (QANAT-WH2018: "no widely accepted hypothesis"; the earliest falaj in Oman is Iron Age II, c. 1000–800 BCE; Polybius describes qanats c. 200 BCE). Shobairi's "existing qanat systems" are undated. Use wells and river-fed canals (C). Q-052.
- **Royal control of irrigation water:** sluice gates opened on petition, with summer water for "millet and sesame" (Herodotus 3.117, read, FT). The story is set in Chorasmia, so it serves only as an analogy for canal gates (B practice / C here).

## 6. Death practice (only as evidenced)
- Herodotus 1.140 (FT, read): "the dead bodies of Persians are not buried before they have been mangled by birds or dogs. That this is the way of the Magi, I know for certain … before the Persians bury the body in earth they embalm it in wax." This is a Greek report, so tier B for practice.
- No burial ground in use near Persepolis in 467 is located. The Spring Cemetery is late 4th century or later. Akhor Rostam is disputed. ~~Nothing is placed in the town (C).~~ **D-209 (session 7, the user's direction D-207): a burial ground is placed as the most probable reconstruction (C)**: on dry untilled ground at the foot of Kuh-e Rahmat, 1.1 km S of the Terrace, 250 m E of the lower town (settlement.json burial_ground_town; 140 low earth mounds, some ringed with field stones). The funerals carry the dead there and bury them (E-71). No exposure platforms are invented, and exposure is never shown (a dead magus is only carried out to the hillside).
- **D-209: the open-air sacred precinct** (settlement.json sacred_precinct; C place, B forms): two plinths after the Pasargadae sacred precinct and a stepped fire altar after the Naqsh-e Rustam tomb reliefs, on the level bench at the mountain's foot 180 m S of the Terrace; a fire kept on the altar by the magi. No fire temple (Herodotus 1.131; none excavated; temple cults are later).

## 7. Biggest gaps (what would unblock them)
1. The Tol-e Ajori destruction date, and the gate's true coordinates and passage axis: Askari Chaverdi, Callieri & Matin 2017 (full text); the mission plans.
2. Persepolis West trench plans and dates: BAR IS 2870 (NEEDS: PDF).
3. Sumner 1986 site list, with coordinates, sizes, the paved road and the irrigation systems (archive.org full text is blocked).
4. Boucharlat et al. 2012 map (canal courses); Gondet 2018 plan (N complex position).
5. Evidence for Persepolis housing and storehouses: none found.
