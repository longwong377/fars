# Persepolis Terrace site specification: independent extraction B

Compiled 2026-09-22 by research subagent B. It is independent of the other `_extract_*.md` files, which were not read.

## READ FIRST: access limits and what they mean for the tiers
- **Egress was almost entirely blocked.** WebFetch and curl both refused iranicaonline.org, whc.unesco.org, archive.org (Schmidt OIP 68), isac.uchicago.edu, wikipedia.org, livius.org, pleiades.stoa.org, arxiv.org, mdpi, copernicus, core.ac.uk, dokumen.pub and newworldencyclopedia.org (403 policy denial). The only reachable sources were **WebSearch result extracts** and **GitHub** (raw.githubusercontent.com and the GitHub API).
- Every Iranica, Wikipedia or UNESCO value below therefore comes from **search-engine extracts** of those pages. I did not read the full article text. No page numbers were seen, so every such row says "page not verified". A value from a search extract is capped at **tier B** (scholarly secondary) or **tier C** (popular/wiki), even when the underlying source is good. Before the build treats these as final, re-verify them against the full text.
- **Schmidt, *Persepolis I* was NOT cross-checked**, because archive.org and isac.uchicago.edu are blocked. No Schmidt numbers appear here as read.
- **Independent control data that I did get and computed myself:**
  1. The Copernicus GLO-30 DSM tiles already in `data/dem/`, sampled locally.
  2. OpenStreetMap outlines of the Terrace, the Apadana platform and the Tomb of Artaxerxes III, taken from Pleiades via the GitHub mirror `ryanfb/pleiades-geojson` (Pleiades places 922695, 774842748 and 658615446). I computed edge lengths and azimuths from these on a local spherical ENU frame (R = 6,371,008.8 m).

Tier key: A = attested/measured. B = scholarly secondary or measured modern survey. C = popular, wiki or literary. "Grid" means the Persepolis building grid, whose north is about 341° true (see G-3).

---

## 1. Georeference and control points

| structure | parameter | value | unit | source | tier | note |
|---|---|---|---|---|---|---|
| Terrace | OSM outline, bbox | lon 52.8883245–52.8925743; lat 29.9331302–29.9372026 | deg WGS84 | OSM via Pleiades 922695 (`ryanfb/pleiades-geojson/geojson/922695.geojson`) | B | 64-vertex closed LineString traced from imagery. It is not known whether it follows the wall top or the wall foot. |
| Terrace | OSM polygon area | 120,629 | m² | computed from OSM outline above | B | Compare 125,000 m² (Iranica Fortifications; Wikipedia) and 300×455 = 136,500 (Iranica Persepolis). |
| Terrace | OSM extent in grid frame (grid N = 341°) | 318 (E–W) × 474 (N–S) | m | computed from OSM outline | B | 316×472 at 342°; 322×477 at 340°. |
| Terrace | area centroid | 29.935239 N, 52.890407 E | deg | computed from OSM outline | B | |
| Terrace | Pleiades representative point | 29.9351973 N, 52.8904279 E | deg | Pleiades 922695 | B | |
| Terrace | Wikipedia site coordinate | 29°56′06″N 52°53′24″E (29.93500, 52.89000) | deg | Wikipedia "Persepolis", via search extract; UNESCO extract gives the same | C | 50 m E and 13 m S of the Apadana OSM centroid. |
| Terrace | DARE point | 29.935945 N, 52.88841 E | deg | Pleiades 922695 (DARE location) | C | 69 m W and 121 m N of the Apadana centroid in the grid frame, i.e. at the NW edge. Probably marks the Grand Stairway or Gate area; unverified. |
| Terrace | CIGS point | 29.9343 N, 52.8925 E | deg | Pleiades 922695 (CIGS) | C | About 290 m E of the Apadana, i.e. on the hillside. Coarse; **do not use**. |
| Apadana | OSM platform centroid (vertex mean) | 29.9351174 N, 52.8894969 E | deg | OSM via Pleiades 774842748 | B | **Recommended primary control point.** |
| Apadana | Wikipedia/Wikidata coordinate | 29°56′6.5″N 52°53′22.5″E | deg | Wikipedia/Wikidata Q5961812, via search extract | C | 8.3 m E and 2.4 m N of the OSM centroid. Agrees within about 9 m. |
| Apadana | OSM platform edges | 115.4 @ 341.1°, 126.7 @ 251.1°, 96.5+11.6 @ 160–162°, 111.0+14.4 @ 71.1° (with a 7.3 m jog) | m, deg | computed from OSM 774842748 | B | Platform about 116.7 (grid N–S) × 126.7 (grid E–W) m. Likely includes the stair projections; not the hall. |
| Tachara | Wikipedia coordinate | 29°56′04″N 52°53′22″E | deg | Wikipedia "Tachara", via search extract | C | 29 m W and 69 m S of the Apadana centroid (grid). Direction is plausible (south of the Apadana); the ±1″ rounding means about ±30 m. |
| Gate of All Nations | Wikipedia coordinate | 29°56′04″N 52°53′29″E | deg | Wikipedia "Gate of All Nations", via search extract | C | **Wrong.** Puts the Gate 148 m E and 130 m S of the Apadana, but the Gate lies NW of the Apadana. Rejected; see conflict C-6. |
| Tomb of Artaxerxes III | OSM representative point | 29.935871634 N, 52.892457868 E | deg | OSM via Pleiades 658615446 | B | 297 m E and 14 m S of the Apadana centroid (grid), i.e. about 40 m beyond the terrace east edge, in the Kuh-e Rahmat face. |
| Tomb of Artaxerxes III | OSM outline | quadrilateral about 36.5 × 21.4 m (edges at 50.9°/141° and 231°/321°) | m | computed from OSM 658615446 | B | This is the cut or forecourt footprint, not the façade. It is rotated about 70° from the terrace grid, following the rock face. |
| Tomb of Artaxerxes II | position | not obtained | – | – | – | North of Artaxerxes III, above the Hall of 100 Columns area (general knowledge; **unverified, not used**). |

### Elevations: Copernicus GLO-30 DSM, EGM2008 orthometric heights, sampled bilinearly by me

| structure | parameter | value | unit | source | tier | note |
|---|---|---|---|---|---|---|
| Terrace | surface at Apadana centroid | 1627.3 (3×3 median 1627.3) | m asl | `data/dem/Copernicus_DSM_COG_10_N29_00_E052_00_DEM.tif` | A (modern surface) | DSM, so it includes standing columns and modern roofs. The 30 m posting smooths edges; expect ±2–4 m. |
| Terrace | surface at area centroid | 1625.8 | m asl | same DSM | A | |
| Terrace | N part (29.9365, 52.8900) and Hall of 100 Columns area (29.9362, 52.8908) | 1626.7 / 1624.7 | m asl | same DSM | A | |
| Terrace | S part (29.9340, 52.8905) | 1628.5 (3×3 max 1630.5) | m asl | same DSM | A | Hadish/south terrace is higher; consistent with the bedrock platform. |
| Plain | 150 m W of W façade (29.9360, 52.8870) | 1613.5 | m asl | same DSM | A | |
| Plain | 400 m W (29.9360, 52.8845) | 1610.1 | m asl | same DSM | A | |
| Terrace vs plain | relief at the west façade | about 12–16 | m | derived: 1625–1628 minus 1610–1614 | A/B | Consistent with Iranica's upper stair landing "12 m above the ground" and with 111 × 0.10 m = 11.1 m. |
| Tomb of Artaxerxes III | DSM at OSM point | 1655 (3×3 range 1639–1676) | m asl | same DSM | A | Cliff pixel, so noisy. Roughly 28 m above the terrace surface; compare the popular "about 40 m above the platform" (C). |
| Site | popular altitude "1,770 m" | 1770 | m asl | search extract (travel sites) | C | **Rejected** by the DSM (about 1,625 m). Marvdasht town at "1,620 m" (Wikipedia) is consistent. |

### Orientation, measured by me from the OSM outlines

| structure | parameter | value | unit | source | tier | note |
|---|---|---|---|---|---|---|
| Terrace | west façade bearing (N→S) | 161.0 (length-weighted over 435 m of edges) | deg true | computed from OSM 922695 | B | The façade line runs at 341.0°/161.0°. Its outward normal (the direction the façade faces) is about **251° (WSW)**. |
| Terrace | south-side E–W edges | 72.0 (over 253 m) | deg true | same | B | 161.0 − 72.0 = 89.0°, so the grid is orthogonal within 1°. |
| Terrace | north-side edges | 261.9 (over 284 m) | deg true | same | B | About 10° off grid: the north edge is irregular or stepped. Do not use it for the grid. |
| Apadana | platform edges | 341.1 / 251.1 / 160.2 / 71.1 | deg true | computed from OSM 774842748 | B | Matches the terrace grid within 1°. |
| **Grid** | **grid north** | **341 ± 1 (i.e. rotated 19° ± 1° west of true north)** | deg true | derived from the two rows above | B | Independent control. Check this against the north arrow on Schmidt's plan. |

### UNESCO

| structure | parameter | value | unit | source | tier | note |
|---|---|---|---|---|---|---|
| Property | area | 116.78 | ha | whc.unesco.org/en/list/114, via search extract | B | Page unreachable. The extract also mentions an older 12.5 ha core. |
| Property | buffer zone | 7,338.31 | ha | same | B | |
| Property | inscription | 1979, criteria (i)(iii)(vi), ref. 114; "founded by Darius I in 518 B.C." | – | same | B | |

---

## 2. Structures

Unless a row says otherwise, Iranica rows are from Shahbazi, "Persepolis", *Encyclopaedia Iranica* online (https://www.iranicaonline.org/articles/persepolis/), read only through search extracts; **page not verified**. "Iranica APADĀNA" refers to https://www.iranicaonline.org/articles/apadana/. I did not see its author field, so the attribution is unverified.

### 2.1 Terrace overall
| structure | parameter | value | unit | source | tier | note |
|---|---|---|---|---|---|---|
| Terrace | plan | "roughly resembled a rectangle measuring some 300 x 455" | m | Iranica "Persepolis", page not verified | B | The OSM outline gives 318 × 474 m (grid). |
| Terrace | area | 125,000 | m² | Iranica "FORTIFICATIONS" (https://www.iranicaonline.org/articles/fortifications-/), page not verified | B | Also Wikipedia. OSM gives 120,629 m². |
| Terrace | ground plan | "approximately 450 by 300" | m | Iranica (the search engine attributed it to the Persepolis article), page not verified | B | |
| Terrace | east side | abuts Kuh-e Rahmat; the other three sides have retaining walls | – | Wikipedia "Persepolis" (GitHub text copy `anassalamah/nlp-project`) | C | |
| Terrace | retaining wall height | "5 to 13 metres on the west side" | m | Wikipedia, same copy | C | A popular source gives 4–12 m (13–41 ft) on the three walled sides. |
| Terrace | fill and joints | depressions filled with soil and rock, blocks joined with metal clamps | – | Wikipedia; Iranica (stair clamps under Xerxes) | C/B | |
| Terrace | drainage | "system of water conduits and drains hewn out of the rock" | – | Iranica "Persepolis" | B | No geometry given. |

### 2.2 Grand Stairway (Persepolitan double stair, NW, west façade)
| structure | parameter | value | unit | source | tier | note |
|---|---|---|---|---|---|---|
| Grand Stairway | form | double-reversed; each flight rises 63 steps to a landing, turns 90°, crosses an open space, turns 90° again and rises 48 steps to a common upper landing | – | Iranica "Persepolis", page not verified | B | |
| Grand Stairway | total steps per flight | 111 (63 + 48) | steps | Iranica "Persepolis" | B | |
| Grand Stairway | upper landing height | "12 m above the ground" | m | Iranica "Persepolis" | B | The DSM relief of 12–16 m is consistent. |
| Grand Stairway | flight width | 6.9 | m | Wikipedia "Persepolis" (text copy, line 35) | C | Unsourced there; verify against Schmidt/Tilia. |
| Grand Stairway | tread | 31 | cm | Wikipedia, same | C | |
| Grand Stairway | riser | 10 | cm | Wikipedia, same | C | 111 × 10 cm = 11.1 m, versus 12 m for the landing (see C-2). |
| Grand Stairway | construction | huge irregular limestone blocks, often 4–5 steps cut from one block, dry-jointed with rectangular metal clamps (Xerxes' reign) | – | Iranica "Persepolis" | B | |
| Grand Stairway | base | "pavement of huge well-polished gray limestone" | – | Iranica "Persepolis" | B | |
| Grand Stairway | date | begun about 519 BC (Wikipedia); clamp type of Xerxes' reign (Iranica) | – | Wikipedia / Iranica | C/B | These disagree; see C-8. |
| Grand Stairway | position | "towards the northwestern corner of the platform" | – | Iranica "Persepolis" | B | |

### 2.3 Gate of All Nations (Gate of Xerxes, "Gate of All Lands")
| structure | parameter | value | unit | source | tier | note |
|---|---|---|---|---|---|---|
| Gate | plan | four-column square hall of 612 m² (about 24.7 m side if square) | m² | Iranica "Persepolis" | B | Wikipedia: "approximately 25 m". |
| Gate | column height | "over 16.5" | m | Iranica "Persepolis" | B | |
| Gate | column order | bell base (fluted), discoid torus, fluted shaft, upper volute/palmette/rosette/lotus decor | – | Iranica "Persepolis" | B | |
| Gate | doorways | three stone doorways: W entrance, E and S exits | – | Iranica "Persepolis"; Wikipedia | B | Two-leaf doors, as shown by pivot sockets (Wikipedia, C). |
| Gate | guardian figures | bulls on the W doorway; human-headed winged bulls on the E doorway | – | Iranica "Persepolis" | B | |
| Gate | bench | stone bench along the walls, 52 cm high × 52 cm wide | cm | Iranica "Persepolis" | B | |
| Gate | usher platform | stepped platform opposite the S doorway | – | Iranica "Persepolis" | B | |
| Gate | wall finish | thick mud-brick walls faced with glazed tiles (green, blue, orange; rosettes, palm trees) | – | Iranica "Persepolis" | B | |
| Gate | date/king | Xerxes I (trilingual inscription XPa: "this Gate of All Lands I made") | – | Iranica "Persepolis" | A (inscription) / B | |
| Army Street | dimensions | 92 long × 9.70 wide, from the Gate's E doorway to the Unfinished Gate | m | Iranica "Persepolis" | B | |

### 2.4 Apadana
| structure | parameter | value | unit | source | tier | note |
|---|---|---|---|---|---|---|
| Apadana | main hall | "at least 58 m on each side" | m | Iranica APADĀNA, page not verified | B | Other extracts give "60 x 60" (Iranica or other) and Wikipedia gives 60 m. See C-3. |
| Apadana | hall columns | 36 (6 × 6) | count | Iranica APADĀNA; Wikipedia | B | |
| Apadana | porticoes | N, E and W porticoes, each 2 rows of 6 columns (12 each), each as tall as the hall | count | Iranica APADĀNA | B | 72 columns in total. |
| Apadana | column height | "more than 19 m"; also quoted as "19.50 m" | m | Iranica APADĀNA / Iranica "Persepolis" | B | Popular sources give 24 m (C), which is rejected. See C-4. |
| Apadana | hall column base | square two-stepped plinth plus discoid torus | – | Iranica | B | |
| Apadana | portico column base | circular bell-shaped base | – | Iranica | B | |
| Apadana | capital | three-part double-protome (composite) capital; "8 m high" quoted | m | Iranica CAPITALS/COLUMNS extract, page not verified | B | Unclear whether 8 m covers the whole composite (volute block plus protomes). Verify. |
| Apadana | building height | "nearly 22 m" | m | Iranica extract | B | |
| Apadana | podium | "3 m higher than the level of a spacious open court" | m | Iranica extract | B | |
| Apadana | walls | mud-brick, "well over 5 m thick", "over 20 m" high; one extract gives 5.32 m | m | Iranica APADĀNA | B | |
| Apadana | corner towers | 4 (one extract says "four-story") | count | Iranica / other | B | |
| Apadana | stairways | N and E double-reversed stairways, each 81.67 m long in 3 equal parts, crowned by four-stepped crenellations | m | Iranica "Persepolis"/APADĀNA | B | The E stair was found in 1933. Step count and riser were not obtained. |
| Apadana | foundation deposits | 4 stone boxes under the corners, each with gold and silver plates bearing a trilingual inscription | – | search extract (ISAC/Ashmolean pages) | B | |
| Apadana | dates | begun about 515 BC under Darius I, completed about 30 years later under Xerxes I | – | Wikipedia | C | Consistent with Iranica in outline. |
| Apadana | capacity (non-geometric) | "10,000 guests" | – | Iranica extract | C | Not geometry. |
| Apadana | footprint "1,000 m²" | – | – | popular sources | – | **Rejected**: impossible for a hall about 60 m square. |

### 2.5 Tachara (Palace of Darius)
| structure | parameter | value | unit | source | tier | note |
|---|---|---|---|---|---|---|
| Tachara | plan | 40 × 30, long axis N–S, facing a S courtyard | m | Iranica "Persepolis"; Wikipedia | B | Wikipedia gives 1,160 m², which is not 40×30 = 1,200 (C). |
| Tachara | platform | 2.20–3.00 higher than the Apadana level | m | Iranica "Persepolis" | B | |
| Tachara | hall | 12 columns (3 × 4) | count | Iranica; Wikipedia | B | |
| Tachara | hall size | 15.15 × 15.42 | m | Wikipedia "Tachara" (extract) | C | Suspicious: a square hall does not fit a 3×4 grid. Verify. |
| Tachara | north rooms | 2 rooms, 4 columns each | count | Wikipedia | C | |
| Tachara | portico | 8 columns on the S | count | Iranica; Wikipedia | B | |
| Tachara | column type | extract: "two-stepped square plinths, wooden shafts coated with gypsum plaster…, double-headed bull capitals" | – | Iranica extract | B? | The extract may conflate buildings. Verify. |
| Tachara | stairs | S double stair with servant reliefs; NW/W stair added by Artaxerxes III (inscription A3Pa), with a new doorway into the hall | – | Iranica | B | |
| Tachara | date | Darius I; completed by Xerxes I ("taçara" in the Xerxes inscription) | – | Wikipedia; Iranica ("oldest palace") | B | |

### 2.6 Hadish (Palace of Xerxes)
| structure | parameter | value | unit | source | tier | note |
|---|---|---|---|---|---|---|
| Hadish | plan | 55 × 40, "laid out east-west" | m | Wikipedia via extract | C | Iranica says "twice the size of the Tačara" (B), about 2,400 m². Consistent. |
| Hadish | platform | bedrock-hewn, "18 m higher than the level of the plain" | m | Iranica "Persepolis" | B | The DSM shows the S terrace at about 1,628–1,630 m versus a plain of 1,610–1,614 m, i.e. about 15–18 m. Consistent. |
| Hadish | hall | 36 columns, square | count | Iranica | B | Wikipedia: "wooden columns on round stone bases" (C). |
| Hadish | portico | 12 columns on the N, reached through 2 doorways | count | Wikipedia extract | C | |
| Hadish | S balcony | long balcony with a panoramic view behind four-stepped crenellations | – | Iranica | B | |
| Hadish | flanking suites | each: 4-column hall, storerooms, guardroom, tower | – | Wikipedia extract | C | |
| Hadish | king | Xerxes I (the name *hadiš* comes from its inscription) | – | Iranica | A/B | |

### 2.7 Hall of 100 Columns (Throne Hall)
| structure | parameter | value | unit | source | tier | note |
|---|---|---|---|---|---|---|
| H100 | hall | 68.50 × 68.50 | m | Iranica "Persepolis" | B | Popular sources give 70 × 70 (C). |
| H100 | columns | 10 × 10, "nearly 14 m high"; bell base, torus, fluted shaft, double-bull capital | m | Iranica | B | |
| H100 | N portico | 16 columns with double man-bull capitals; flanking pillars with bull protomes facing N | count | Iranica | B | 2 × 8 is my inference, not a quote. |
| H100 | N access | 2 monumental doorways from the portico | – | Iranica | B | |
| H100 | E doorway reliefs | throne-bearers (28 nations) | – | Iranica | B | |
| H100 | location | N of the Treasury, E of the Apadana courtyard | – | Iranica | B | |
| H100 | date | begun by Xerxes, completed by Artaxerxes I (stone plate found in 1933) | – | Iranica "Persepolis"; Iranica "Artaxerxes I" | A (plate) / B | |

### 2.8 Tripylon (Council Hall, Central Palace)
| structure | parameter | value | unit | source | tier | note |
|---|---|---|---|---|---|---|
| Tripylon | platform | 2.60 higher than the Apadana courtyard | m | Iranica "Persepolis" | B | |
| Tripylon | character | small, richly ornamented, in the centre of the terrace; stairs lead to the Hadish/Tachara courtyard and to the H100 courtyard | – | Iranica; Wikipedia | B/C | |
| Tripylon | hall size | "15.46 m on each side" | m | search extract | C | Attribution unclear (the extract may be the Tachara). Verify. |
| Tripylon | date | finished by Artaxerxes I | – | Iranica "Artaxerxes I" | B | Begun under Xerxes (not verified). |

### 2.9 Treasury
| structure | parameter | value | unit | source | tier | note |
|---|---|---|---|---|---|---|
| Treasury | first phase | Darius; W–E long axis, 120 × 60 | m | Iranica "Persepolis" | B | |
| Treasury | later phases | enlarged northward by Darius, then extended northward by Xerxes to its final fortress-like shape | – | Iranica "Persepolis" | B | Final dimensions not obtained. |
| Treasury | location | SE part of the terrace | – | Iranica "Persepolis Administrative Archives ii" | B | |
| Treasury | finds | about 198 cuneiform tablets and fragments plus 548 small fragments (1934–38) | – | Iranica "Persepolis Administrative Archives ii" | B | |

### 2.10 Harem of Xerxes
| structure | parameter | value | unit | source | tier | note |
|---|---|---|---|---|---|---|
| Harem | plan | two wings meeting at the SE angle; service quarter, rectangular court, identical apartments along a long corridor | – | Iranica "Persepolis" | B | |
| Harem | portico | 8 columns (2 × 4) | count | Iranica | B | |
| Harem | main hall | 12 columns (3 × 4) | count | Iranica | B | |
| Harem | enclosure | thick wall; small entrance at the SW corner | – | Iranica | B | |
| Harem | king | Xerxes I (foundation tablet) | – | Iranica | A/B | |
| Harem | modern state | E wing rebuilt in modified form by Krefter (1931–32, for the Herzfeld expedition); now the site museum | – | Iranica "Herzfeld iii" | B | **The modern fabric is not ancient geometry.** |
| Harem | location | W of the Treasury | – | Iranica | B | |

### 2.11 Unfinished Gate
| structure | parameter | value | unit | source | tier | note |
|---|---|---|---|---|---|---|
| Unfinished Gate | position | N of the H100 forecourt, E end of the 92 m Army Street | – | Iranica "Persepolis"; Livius extract | B/C | |
| Unfinished Gate | king | probably Artaxerxes III | – | Livius extract | C | |
| Unfinished Gate | dimensions | not obtained | – | – | – | |

### 2.12 Fortifications
| structure | parameter | value | unit | source | tier | note |
|---|---|---|---|---|---|---|
| Fortification | form | mainly mud-brick line along the unwalled sides and along the top of the Royal Hill (Kuh-e Rahmat) | – | Iranica "FORTIFICATIONS" | B | |
| Fortification | curtain wall height | about 7 | m | Iranica "FORTIFICATIONS" | B | |
| Fortification | towers | at intervals, "standing 5 m high" (as extracted) | m | Iranica "FORTIFICATIONS" | B? | Possibly means 5 m above the curtain. Verify. |
| Fortification | passage | runs through the whole line, connecting all towers | – | Iranica "FORTIFICATIONS" | B | |
| Fortification | three walls of 7 / 14 / 27 m | – | m | Diodorus, as given by Wikipedia | C | Literary source; **not for geometry**. |

### 2.13 Palace H and Palace G
| structure | parameter | value | unit | source | tier | note |
|---|---|---|---|---|---|---|
| Palace H | location | SW corner of the terrace, W of the Hadish | – | ISAC "Miscellaneous structures", via extract | B | |
| Palace H | nature | standing remains are post-Achaemenid, built from reused material; possibly the site of an Artaxerxes I palace | – | ISAC extract; Iranica ("Palace H … Artaxerxes I") | B | |
| Palace G | location | N of the Hadish | – | ISAC extract | B | |
| Palace G | nature | post-Achaemenid remains on a destroyed older building, perhaps of Artaxerxes III | – | ISAC extract | B | |
| Artaxerxes III | building activity | palace on the SW terrace, attested by his stairway inscription | – | Iranica "Artaxerxes III" | B | |
| Palaces G and H | dimensions | not obtained | – | – | – | |

### 2.14 Royal tombs on Kuh-e Rahmat
| structure | parameter | value | unit | source | tier | note |
|---|---|---|---|---|---|---|
| Tombs | attribution | two tombs: Artaxerxes II and Artaxerxes III, which is whose is uncertain | – | Livius extract | C | |
| Tombs | form | cruciform façade on the Naqsh-e Rostam model: colonnaded palace façade, throne-bearers and king at a fire altar above | – | extracts | C | Façade dimensions not obtained (Schmidt, *Persepolis III*, OIP 70, unreachable). |
| Tombs | height | "about 40 m above the platform level" | m | popular extract | C | The DSM at the OSM tomb point is about 28 m above the terrace surface (noisy cliff pixel). |
| Tomb of Artaxerxes III | position | see §1 | – | OSM via Pleiades | B | |

---

## 3. Conflicts

- **C-1 Terrace size.** Iranica gives 300 × 455 m (about 136,500 m²). Iranica Fortifications and Wikipedia give 125,000 m². OSM gives 318 × 474 m in the grid frame, with an area of 120,629 m². The dimensions differ because the outline is irregular (rectangle vs polygon) and because an outline traced at the wall foot or skirt differs from one traced at the parapet. **Resolve against Schmidt's plan.**
- **C-2 Terrace and stair height.** Iranica: upper stair landing at 12 m. Wikipedia: steps of 111 × 10 cm = 11.1 m, while the same article says the entrance is "20 metres above the ground". Walls are quoted at 5–13 m (Wikipedia) and 4–12 m (popular). The DSM relief is 12–16 m. The 20 m figure is **rejected**. The 0.9 m gap between 11.1 m and 12 m may be a threshold, a landing slab or an error in the 10 cm riser. **Needs Schmidt/Tilia.**
- **C-3 Apadana hall side.** Iranica APADĀNA gives "at least 58 m". Other extracts and Wikipedia give 60 m. Schmidt's figure was not seen.
- **C-4 Apadana column height.** Iranica gives ">19 m" and 19.50 m. Popular sources give 24 m, which is rejected. The brief notes a popular range of 19–25 m.
- **C-5 Hall of 100 Columns.** Iranica gives 68.50 m square; popular sources give 70 × 70 m.
- **C-6 Gate of All Nations coordinates.** The Wikipedia coordinate puts the Gate 148 m E and 130 m S of the Apadana. That is inconsistent with every description (Gate at the NW, at the top of the Grand Stairway, with its S door opening to the Apadana court). **Rejected.**
- **C-7 Tachara internals.** Wikipedia's 15.15 × 15.42 m hall conflicts with a 3×4 column grid. The Tachara area (1,160 m²) does not equal 40 × 30 m. The column-shaft material (wooden shafts?) is unclear from the extract.
- **C-8 Grand Stairway date.** Wikipedia: begun about 519 BC (Darius). Iranica: the clamp technique belongs to Xerxes' reign. Iranica frames it as a "new and grander entrance", which implies an earlier access route.
- **C-9 Site altitude.** Popular sources give 1,770 m. The DSM gives about 1,625 m (terrace) and 1,610–1,614 m (plain). Use the DSM.
- **C-10 Pleiades points.** The CIGS point (about 290 m E) and the DARE point (NW edge) are both far from the building centroid. Use only the OSM outlines.

## 4. Sources (about 12)

1. A. Sh. Shahbazi, "PERSEPOLIS", *Encyclopaedia Iranica* online. https://www.iranicaonline.org/articles/persepolis/ **UNREACHABLE** (policy 403); used via WebSearch extracts only.
2. "APADĀNA", *Encyclopaedia Iranica*. https://www.iranicaonline.org/articles/apadana/ **UNREACHABLE**; extracts only.
3. "FORTIFICATIONS", *Encyclopaedia Iranica*. https://www.iranicaonline.org/articles/fortifications-/ **UNREACHABLE**; extracts only.
4. "COLUMNS" and "CAPITALS", *Encyclopaedia Iranica*. https://www.iranicaonline.org/articles/columns-architectural/ and https://www.iranicaonline.org/articles/capitals/ **UNREACHABLE**; extracts only.
5. "ARTAXERXES I", "ARTAXERXES III", "HERZFELD, ERNST iii" and "PERSEPOLIS ADMINISTRATIVE ARCHIVES ii", *Encyclopaedia Iranica* (iranicaonline.org). **UNREACHABLE**; extracts only.
6. UNESCO WHC, Persepolis (114). https://whc.unesco.org/en/list/114 and map document https://whc.unesco.org/en/documents/104895 **UNREACHABLE**; extracts only.
7. Wikipedia, "Persepolis". Text copy read in full from GitHub: https://raw.githubusercontent.com/anassalamah/nlp-project/HEAD/wikipedia%20pages/Persepolis.txt (the snapshot date is unknown). Also "Gate of All Nations", "Tachara", "Apadana" and "Hadish Palace" (en.wikipedia.org, **UNREACHABLE**; extracts only).
8. Pleiades / OpenStreetMap geometry via the GitHub mirror https://github.com/ryanfb/pleiades-geojson (commit 9056429f): places 922695 (Persepolis), 774842748 (Apadana Palace), 658615446 (Tomb of Artaxerxes III). pleiades.stoa.org itself is **UNREACHABLE**. OSM data is © OpenStreetMap contributors (ODbL); Pleiades is CC-BY.
9. Copernicus GLO-30 DSM, tiles N29E052 and N30E052, local copies in `/home/user/fars/data/dem/` (© DLR/Airbus, provided under COPERNICUS by the EU and ESA).
10. ISAC (Oriental Institute) Persepolis photographic-archive pages: "Miscellaneous Structures", "Apadana" and "Plan of Persepolis Terrace", at isac.uchicago.edu/collections/photographic-archives/persepolis/… **UNREACHABLE**; extracts only.
11. Livius.org Persepolis pages (Unfinished Gate, Tomb of Artaxerxes II and III, Terrace). **UNREACHABLE**; extracts only.
12. **Not accessed:** E. F. Schmidt, *Persepolis I* (OIP 68; archive.org/details/oip68) and *Persepolis III* (OIP 70); A. B. Tilia, *Studies and Restorations at Persepolis* (1972/1978); A. Mousavi, *Persepolis: Discovery and Afterlife* (2012). All **UNREACHABLE**; none of their values appear here as read.

## 5. Recommendations for SITE_SPEC
- Georeference the model with the **Apadana OSM centroid (29.9351174 N, 52.8894969 E)** and **grid north = 341° true**. Check against the Tomb of Artaxerxes III point (grid E +297 m, N −14 m from the Apadana centroid) and the terrace outline.
- Take the terrace surface at about **1,625–1,628 m** and the west plain at about **1,610–1,614 m** (EGM2008), from the DSM.
- Every row marked "extract" must be re-verified against the full text, above all against Schmidt's plan, before it is promoted to tier A.
