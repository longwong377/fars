# PLAIN AND HORIZON (Phase 7): the Marvdasht plain in 467 BCE

**Read this first: what is weak.**
- **River courses are modern.** They are the OSM lines in Pleiades (FT); the 467 course is C.
- **Reconstructed (C):** monthly flows, crop heights, and the field layout.
- **Village positions** come from Barrington Atlas map 94 via Pleiades. They are map-scale, with accuracy up to 10 km. Only 6 of Sumner's 39 secure sites could be located; the rest are placed procedurally.
- **Blocked (B6):** every scholarly full text. Sumner 1986 is on archive.org, which is also blocked.
- **Horizon finding (measured).** The 40.96 km far terrain ring truncates the W/WSW and SSE skyline. Ranges 55–66 km out rise 0.1–0.4° above the in-ring horizon in those sectors. The DEM tiles already cover them (§6).

Machine-readable file: `src/data/plain.json`, with the same frame and fields as `settlement.json`, plus a `crops` calendar and per-river `flow_by_month`.

## 1. Rivers
| Item | Value | Source | Access | Tier | Note |
|---|---|---|---|---|---|
| Pulvar (Sivand; Araxes?) course | modern OSM line, 181 km in total; nearest approach to the Apadana 3.3 km. W of the Terrace it runs at grid y ≈ +2.3 to +3.8 km, and it enters the plain from the Istakhr gorge (grid x ≈ 10–11 km) | PLEIADES-FARS (922701) | FT | B (modern) / C (467) | Holocene course changes upstream (LANDSCAPE.md) |
| Pulvar bed elevation (DEM mid ring) | 1,640 m at the gorge mouth, 1,626 m at 5.6 km, 1,618 m N of the Terrace, 1,600 m at 10 km W | COP-DEM | FT | B | bare-earth smoothed DSM |
| Kur course | modern OSM line; nearest approach 13.7 km W; confluence with the Pulvar ≈ (−13.5, −4.3) km | PLEIADES-FARS (922672) | FT | B / C | |
| Kur basin | ~9,700 km², mean rain 344 mm (130–753); "never completely dry because it is fed by the snowmelt of Zagros" | KOR-HSJ2023 | SX | B | modern |
| Pulvar today | intermittent, often dry in summer and autumn; Sivand dam (modern, blocked) | LANDSCAPE.md | SX | B | |
| Pulvar in 467 | perennial, with a low summer trickle | inference from Maharlou "wet" 3800–2000 BP (BRISSET2019, B) | – | C | |
| Monthly flow index, Pulvar (Jan→Dec) | 0.45, 0.60, 0.90, **1.00**, 0.75, 0.40, 0.20, 0.12, **0.10**, 0.12, 0.25, 0.35 (peak Apr, low Sep); width up to 18 m, depth up to 1.2 m | reconstruction from WMO rain (A) + snowmelt | – | C | JSON `flow_by_month` |
| Monthly flow index, Kur | 0.50, 0.65, 0.90, 1.00, 0.85, 0.55, 0.35, 0.25, 0.20, 0.22, 0.30, 0.40; width up to 35 m | same | – | C | |

## 2. Canals, dams, irrigation
| Item | Value | Source | Access | Tier | Present 467 |
|---|---|---|---|---|---|
| Sumner: irrigation systems | 2 "probably of Achaemenid construction", a third possibly | SUMNER1986 | SX | B | yes (positions not retrieved; procedural rule in JSON, C) |
| "Large earthen channel networks branch out from these rivers near the main Achaemenid sites" | – | SHOBAIRI2018 | SX | B | yes |
| Kuh-e Rahmat canal (Pulvar → Persepolis, "4 km") | settlement.json | MAYS2010; BOUCHARLAT2012 | SX | B / C course | yes |
| Named Achaemenid hydraulic traces: Sang-e Dokhtar, Bard-e Burideh II, Rud-i Main aqueduct, Band-e Bas I/II, Asiyab dam, Qondashloo canal | names only; Band-e Dokhtar and Bard Burideh are dated by carved blocks and dovetail clamps | KURHYDRO2024; BOUCHARLAT2012 | SX | B | yes |
| Sang-i Dokhtar dam | 30.1725, 52.43611 (51 km NW, **outside the extent**), Classical | PLEIADES-FARS | FT | B | yes |
| Band-e Amir weir (10th c. CE), Doroodzan and Mulla Sadra dams, Sivand dam | – | brief §12; KOR-HSJ2023 | – | – | **no (blocklist)** |
| Qanats | no dated Achaemenid qanat | QANAT-WH2018 | SX | – | **not placed** (Q-052) |

## 3. Fields and crops (JSON `crops`)
| Crop | Evidence for Fars / PF | Calendar | Height (m) | Source | Access | Tier |
|---|---|---|---|---|---|---|
| Barley | staple grain of the rations; "most frequently sown cereal in the empire" | sow Nov; harvest May–Jun (Iranica: winter barley sown Nov, harvested May–Jul) | 0.3 in Mar → 0.85 in May | IR-FOODAG | SX | B calendar / C height (NS) |
| Wheat | "other grains … probably including wheat" | sow Nov–Dec (normal 11 Nov–1 Dec in Fars); harvest Jun–Jul | to 1.1 | IR-FOODAG; FARS-WHEAT | SX | B / C |
| Spelt/emmer | "less frequently sown" | as wheat | to 1.1 | IR-FOODAG | SX | C |
| Sesame | in PF (sesame rations to 560 Assyrian workers) | summer, irrigated: sow May, harvest Sep | to 1.2 | IR-FOODAG; HDT 3.117 (analogy) | SX / FT | B presence / C calendar |
| Vines / wine | "wine of several kinds" | leaf-out Apr, vintage Sep–Oct | 1.5 | IR-FOODAG | SX | B / C |
| Fruit | figs, dates, pears, apples, mulberries, pistachios, sesame are among the PF commodities; pollen: olive, pomegranate, plane, cypress | blossom Mar–Apr, fruit Jun–Oct | trees | IR-FOODAG; SAEIDI2021 | SX | B |
| Dates | PF commodity, but **not grown on the plain** (1,600 m, 44 frost days a year, WMO A); they arrive by pack train | – | – | inference | – | C |
| Rice, cotton, citrus, sugar beet | not grown (blocklist; Q-013) | – | – | – | – | C |
| Field layout | irregular small plots along canals; stubble grazed Jun–Oct; fallow share 20–60 % | – | – | reconstruction | – | C |

Zones (JSON):
- `fields_irrigated_pulvar`: a 1.5 km buffer of the Pulvar.
- `fields_irrigated_kur`: a 2 km buffer of the Kur.
- `fields_rainfed`: a rule, < 1,660 m asl and < 3 % slope.
- `orchards_gardens`: a rule, a 300 m ring around each village.
- `steppe`: *Artemisia*, grasses and Amaranthaceae (pollen B), 1,660–1,900 m.
- `woodland`: *Quercus brantii* with pistachio–almond scrub, > 1,800 m and > 6 % slope, 10–30 % cover (pollen B, cover C).

## 4. Villages and sites
The Barrington "Classical" period is 550–330 BCE, so a Classical site is Achaemenid-period.

| id | Site | lat, lon | Grid (x, y) | ± m | Barrington type / period | Refs (Pleiades) | Present 467 | Pop. est. (C) |
|---|---|---|---|---|---|---|---|---|
| village_masumabad_west | Masumabad West | 29.96187, 52.76689 | −10222, 6663 | 3000 | settlement / Classical–Hellenistic | BAtlas 94 | yes | 600 |
| village_saidun | Saidun | 29.97035, 53.01633 | 12848, −286 | 3000 | settlement / Classical | BAtlas 94 | yes | 600 |
| village_tukrash | Band-e Amir area = Tukrash? (Achaemenid buildings and embankments) | 29.75809, 52.84162 | −10767, −17046 | 1500 | settlement / Classical | Sumner 1986 9–10, 22–23; RGTC Tikri(š) | yes | 1,500 |
| village_rakkan | Mansurabad East = Rakkan? (Sumner site R) | 29.88920, 52.65423 | −23137, 2608 | 3000 | settlement / Classical | Sumner 1986 9–10, 23–26 | yes | 1,000 |
| (settlement.json) | Firuzi 2 = Matezziš? / Humadešu? / Uvadaicaya? | map-scale point on the Terrace | – | – | settlement / Classical | BAtlas 94 | yes | town |
| (settlement.json) | Dasht-i Gohar / Takht-i Rustam | – | – | – | settlement / Classical | Tilia 1978 73–80 | yes | – |
| quarry_sivand | Sivand quarry | 30.07921, 52.92087 | 8060, 14119 | 100 | quarry / Classical | Mostafavi 1978 11 | yes | – |
| quarry_majdabad | Majdabad quarry | 29.86377, 52.69237 | −20578, −1261 | 3000 | quarry / Classical | Tilia 1978 88; Calmeyer 1990 | yes | – |
| qadamgah | Qadamgah | 29.68830, 53.13156 | 13252, −33474 | 3000 | "temple" / Classical | Kleiss 1993 | yes | – |
| villages_unlocated | the other ~33 secure + 18 possible sites | procedural | – | – | – | SUMNER1986 | yes | 150–3,000 each; total ≤ 44,000 |

Conflict: Iranica (IR-ARCH2) gives "100–150 Achaemenid settlements within the Persepolis plain", against Sumner's 39 secure + 18 possible (Q-050).

**Absent in 467** (Barrington Roman/Late Antique = Sasanian or later; FT):
- Istakhr (the Istakhr mission found "no evidence … of the pre-Sasanian history", SX);
- Naqsh-e Rajab;
- Darre-ye Barre, Hajjiabad, Maqsudabad, Kuh-i Ayyub and Kuh-i Shahrak ("temples");
- Naqsh-i Bahram and Barm-i Dilak.

## 5. Naqsh-e Rustam in 467
| Feature | State | Source | Access | Tier |
|---|---|---|---|---|
| Tomb of Darius I (DNa/DNb), 29.98913, 52.87462 | standing, sealed; cut and in use in Darius' lifetime (Ctesias story, via WP-NR) | LIVIUS-NR; WP-NR; OVERTURE-2026 | SX / FT | B |
| Tomb attributed to Xerxes (ENE of Darius') | uninscribed; attributed by elimination. Kings prepared their tombs in life, so it **may be cut or being cut in 467** | LIVIUS-NR; WP-NR | SX | C (Q-047; chronology.json currently says absent) |
| Tombs of Artaxerxes I (WSW) and Darius II (westernmost) | absent: those kings reign after 465 | LIVIUS-NR | SX | B |
| Ka'ba-ye Zardosht, 29.98804, 52.87452 | standing. Dovetail clamps and black-on-white stone point to Darius I or Xerxes I; the Pasargadae twin is a few decades older | WP-NR | SX | C (Q-006) |
| Neo-Elamite relief | intact (the Bahram II overcarving is blocked) | ALVAREZMON | SX | B |
| Takht-e Rustam platform, 2 km S | unfinished, early Achaemenid | LIVIUS-TR | SX | B / C position |
| Sasanian reliefs and inscriptions, Naqsh-e Rajab, "fire altars" of disputed date | **blocked** | brief §12; PLEIADES-FARS | FT | B |
| Mountain | Kuh-e Hossein (Husain Kuh); cliff top ~2,110 m; ridge high point 2,665 m at 30.03235, 52.90628 (10.9 km, 9° true) | WP-NR (name, tertiary); COP-DEM | SX / FT | B |

## 6. Horizon (measured this phase)
- **Data.** The DEM far ring (`public/generated/terrain_far.u16`, ±40.96 km, 80 m cells) was checked against AWS Terrain Tiles (SRTM, z10), with 1° rays out to 120 km from the Apadana court (eye 1,626.6 m, refraction k = 0.13). The full table is in `plain.json` → `horizon_check.sectors`.
- **Near horizon (E):** Kuh-e Rahmat. The ridge behind the Terrace is 2,216 m at 3.1 km E. The massif high point is 2,554 m at 11.2 km, bearing 117°. From 0° to 140° true it fills the view at 5–12° elevation.
- **Far horizon:** 0.3–2.8° elevation to the S, W and N, formed by ranges 16–40 km away (2,100–2,750 m).
- **Truncation.** In the sectors 150–160°, 230–250° and 270–290° true, ranges 55–66 km away (2,670–2,960 m) stand 0.1–0.4° above the in-ring horizon, so they are **missing from the current skyline**. The WNW gap over the Kur valley (in-ring horizon only 0.32–0.36°) is the most visible.
- **Fix.** Extend the far ring to about 70 km (`tools/build_terrain.py`); tiles N29–N30 and E052–E053 already cover it. This is not changed here, as it is outside this agent's remit (Q-053).

## 7. Vegetation and wildlife
- **Vegetation:** see §3 zones. Pollen evidence is in `_climate_C.md`: *Quercus brantii* woodland and *Pistacia–Amygdalus* scrub on the slopes; *Artemisia*/grass steppe; Achaemenid arboriculture (*Olea*, *Punica*, *Platanus*, cypress). Tier B.
- **Wildlife by season:** use SOUNDSCAPE.md §4–6, which is not duplicated here. Winter: waterfowl and cranes moving between the Kur lakes. Apr–Sep: bee-eaters and rollers along the Pulvar. All year: jackals at dusk, wolves on Kuh-e Rahmat in winter, gazelle on the open plain, and see-see partridge and chukar on the slopes (B species / C seasonality).

## 8. Biggest gaps
1. Sumner's site list, with sizes, coordinates, districts, irrigation systems and the paved road (archive.org is blocked; NEEDS: the PDF).
2. The Pulvar and Kur courses in 467, and the canal courses (Boucharlat et al. 2012 map; CORONA imagery).
3. Measured monthly discharge for either river (only the regime is sourced).
4. Positions of Band-e Bas, Asiyab, Rud-i Main and Qondashloo.
5. The first way-station on each road (PF Q texts: Hallock 1969).

## 9. As built (Phase 7, session 3; D-037 to D-040)
**Placeholder or weak, read first:** the Naqsh-e Rustam relief figures are schematic silhouettes and the DNa/DNb panels are dressed but not inscribed (both flagged PLACEHOLDER in the dev overlay); the Xerxes tomb spacing (60 m) and the façade's arm widths, recess, columns and door are C (Q-076, Q-077); the Ka'ba stair/door side and window layout are C (Q-078); 33 of the 37 villages, all 37 canals, all field plots, tracks and orchards are placed by rule (C).

Data added to `src/data/plain.json` (each with tier, source and note):
- `river_*.channel`: trapezoid fitted to the flow table (bed, side slope, bank height; C); `river_*.riparian`: species (IR-RIPARIAN analogy + SAEIDI2021 Platanus), band, spacing and gaps (C).
- `irrigation_systems_sumner.procedural_rule`: gradient 0.5 m/km, lengths 2.5-7 km, bank crest 0.45 m (C).
- `villages_unlocated.layout` (household 6, compound and room sizes, 65 persons/ha, 30,000 people for the 33 unlocated sites; C) and `.tracks` (C).
- `orchards_gardens.rule` fill, tree spacing, vine share; `woodland.rule` crown and height ranges, thinning near the capital (C).
- `nr_xerxes_tomb.xy` (C, Q-076) and a top-level `naqsh_e_rustam` block: cliff line and height, ancient ground (-5 m at the foot, B), façade registers (B) and C proportions, Ka'ba dimensions (C), Elamite relief size (B).
- New source keys: NR-ACHAEMENICA, NR-IRANICA, IR-RIPARIAN (all search extracts).

What the build does with them: `src/world/plain/` (rivers carved into the heightfield and drawn with a date-driven water level; fields, crops, orchard floors and woodland in the terrain material; near crop tufts; trees near/far; 37 villages; 37 canals; tracks; two quarries; Naqsh-e Rustam). Tests: `tests/plain.test.ts`; renders and measured budgets: `tests/e2e/plain.spec.ts`.

## 10. Trees as built (session 3, trees agent; D-120 to D-123)
**Read this first: what is weak.**
- Every form value is C and recalled (source key BOTANY-GEN): heights, crown width and base, trunk, stems, crown shape, branching, leaf size, bark colour.
- The poplar's narrow form (Q-170) and the garden cypress's upright form (Q-171) may be later cultivated forms.
- The orchard mix of one species per plot, and its shares, is C (Q-172). Leaf and blossom colours and the phenology dates are chosen, not measured (Q-173).

Species and where they grow (`src/data/trees.json`; placement in `src/world/plain/trees.ts` and the town plan):

| Species | Where | Presence (tier, source) | Height (m) | Crown width / height | Crown base / height | Habit (C) |
|---|---|---|---|---|---|---|
| Oriental plane (*Platanus orientalis*) | river banks (35 % behind the water's edge), canals (40 %), town garden axes | B: IR-RIPARIAN analogy, SAEIDI2021 pollen | 14-24 (canals 14-19) | 0.7-0.9 | 0.22-0.32 | broad dome on a short thick bole, 4-5 limbs |
| White willow (*Salix alba*) | river banks (30 %), canals (40 %) | B: IR-RIPARIAN | 7-14 | 0.6-0.8 | 0.18-0.28 | rounded, upswept limbs, hanging outer shoots, 1-2 stems |
| Poplar (*Populus*) | river banks (20 %) | B: IR-RIPARIAN (genus) | 13-21 | 0.26-0.36 | 0.12-0.2 | narrow: a leader with steep short branches (Q-170) |
| Tamarisk (*Tamarix ramosissima*) | the water's edge (45 %) and banks | B: IR-RIPARIAN | 2.5-5 | 0.9-1.2 | 0.08-0.15 | 4-8 stems, feathery drooping sprays |
| Mulberry | canals (20 %), orchards (13 % of plots), town gardens | B: IR-FOODAG | 6-9 | 0.85-1.05 | 0.25-0.32 | dense dome |
| Fig | orchards (22 %), town gardens | B: IR-FOODAG | 3.5-6 | 1.05-1.35 | 0.1-0.2 | 2-4 stems, wider than tall, no blossom |
| Apple | orchards (20 %), town gardens | B: IR-FOODAG | 4-7 | 0.9-1.1 | 0.22-0.3 | rounded, open; blossom in April |
| Pear | orchards (18 %), town gardens | B: IR-FOODAG | 5-8 | 0.55-0.72 | 0.2-0.28 | upright, with a leader; blossom from late March |
| Pomegranate | orchards (27 %), town gardens | B: SAEIDI2021, IR-FOODAG | 3-5 | 0.9-1.15 | 0.08-0.16 | 3-6 stems; scarlet flowers from May |
| Brant's oak (*Quercus brantii*) | woodland (65 % of trees) | B: SAEIDI2021 | 4-8 | 1.0-1.3 (woodland rule: crowns 5-9 m) | 0.18-0.3 | open, irregular, 1-3 stems |
| Wild almond (*Amygdalus*) | woodland scrub (19 %) | B: SAEIDI2021 | 2-4 | 0.8-1.0 | 0.08-0.14 | broom-like, sparse leaves; pale-pink blossom in Feb-Mar |
| Wild pistachio (*Pistacia atlantica*) | woodland scrub (16 %) | B: SAEIDI2021, IR-FOODAG | 3.5-7 | 0.95-1.2 | 0.2-0.28 | stout, dense dome; red in autumn |
| Cypress | town garden axes | B: SAEIDI2021 | 9-15 | 0.16-0.24 | 0.02-0.05 | narrow cone, evergreen (Q-171) |
| Olive | town gardens only (the plain has 44 frost days a year: WMO, A) | B: SAEIDI2021 | 4-6.5 | 0.95-1.2 | 0.25-0.35 | broad, irregular, evergreen grey-green |
| Grape vine | town gardens (head-trained, C); vineyards stay in the terrain layer | B: IR-FOODAG | 1.2-1.8 | 1.0-1.3 | 0.3-0.42 | low, spreading canes |

Seasons: the foliage groups of `src/world/plain/seasonal.ts`. Planes leaf out on day 82-108 of the year (late March to mid-April). Apple and pear blossom falls on days 75-108, wild almond on days 45-72, pomegranate on days 130-175. Evergreens keep their leaves. Leaves fall in October and November (C).
