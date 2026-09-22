# LANDSCAPE (terrain, rivers, settlement survey). Phase 0 content from subagent C; extended in Phases 1, 6, 7

"DEM" means the local Copernicus GLO-30 DSM tiles in `data/dem/`, 1 arc-second, EPSG:4326, sampled with rasterio. They are a **surface** model: modern vegetation and structures are included, and the heights are modern ground.

## Points

| Feature | Lat | Lon | Elev. (m asl) | Source | Tier | Note |
|---|---|---|---|---|---|---|
| Persepolis Terrace (reference point) | 29.9350 N (29°56′06″) | 52.8900 E (52°53′24″) | 1627 (DEM at the point) | Coordinates: Wikipedia/Wikidata via search extract ([Wikidata Q129072](https://www.wikidata.org/wiki/Q129072)); elevation: DEM | B (coords, search extract); B (elev) | |
| Terrace footprint (29.931–29.938 N, 52.886–52.8925 E) | – | – | p10 1612, median 1616, p90 1628, max 1664 | DEM | B | The box includes plain edges; the p90 is roughly the terrace top |
| Plain immediately W of the Terrace | 29.935 | 52.880–52.884 | 1612–1616 | DEM | B | |
| Marvdasht plain, 52.84–52.885 E | – | – | min 1601, median 1610 | DEM | B | |
| Terrace height above plain | – | – | **8–18 m** (published); DEM profile about 12–20 m | [ECO chamber news article](https://ecocci.org/eco_chamber_news/item/5896-persepolis-a-beautiful-architectural-masterpieces) via search extract; DEM | B | The site spec should use the excavation survey values |
| Published site elevation | – | – | "1,770 m" and "1,620 m" both appear in popular sources; "about 1,600 m" also appears | search extracts (travel sites) | C | **Conflict.** The DEM supports **about 1,610–1,630 m**. Reject 1,770 m |
| Kuh-e Rahmat, ridge crest directly E of the Terrace | 29.9457 | 52.9133 | 2163 | DEM (max within about 2.3 km E) | B | A search extract giving "1,627 m" for Kuh-e Rahmat matches the *Terrace* DEM value and is probably mis-assigned. Reject it |
| Kuh-e Rahmat massif, higher summits to the SE | ≤29.84 | ≈53.05 | >2585 (search box edge) | DEM | B | The true summit was not located; the box needs widening |
| Naqsh-e Rustam | 29.9889 N (29°59′20″) | 52.8747 E (52°52′29″) | 1630 (DEM at the point; cliff foot) | Coordinates: [Wikipedia, Naqsh-e Rostam](https://en.wikipedia.org/wiki/Naqsh-e_Rostam) via search extract | B | **6.2 km** NNW of the Terrace (haversine). Popular "12–13 km" figures are road distances or errors |
| Tol-e Ajori gate (Bagh-e Firuzi) | ≈29.957 | ≈52.864 | – | Derived from "3.5 km NW of the Terrace" ([ScienceDirect](https://www.sciencedirect.com/science/article/abs/pii/S0169131717304994)) and "3 km NW" ([Tehran Times](https://www.tehrantimes.com/news/461555/Persepolis-once-awe-inspiring-gateway-opens-to-public-after)) | **C** | The mound is 30 × 40 m and 3 m above its surroundings. Get the true position from the mission's plans or satellite imagery |
| Persepolis West / Bagh-e Firuzi zone | W and NW of the Terrace, between it and Tol-e Ajori | – | – | [AJA review: Persepolis West 2008–2009 report](https://ajaonline.org/book-review/3891/); Gondet et al. map ([ResearchGate fig.](https://www.researchgate.net/figure/Map-of-the-Persepolis-area-After-Gondet-Mohammadkhani-Askari-Chaverdi-2018-fig-8_fig4_361108776)) | B | The French geomagnetic survey (from 2003) covered 50 ha in 23 areas of the plain near the Terrace |
| Shiraz synoptic station (WMO 40848) | 29.5614 (29°33′41″) | 52.6025 (52°36′09″) | **1488.0** | [WMO CLINO 1991–2020, Shiraz_40848.csv](https://github.com/wmo-im/WMO-climatological-normals-CLINO/blob/main/data/Region-2-WMO-Normals-9120/Iran/CSV/Shiraz_40848.csv) | A | 50 km SSW of the Terrace |
| Zarghan synoptic station | – | – | 1596.0 | [Wikipedia, Zarqan](https://en.wikipedia.org/wiki/Zarqan) (cites IRIMO) via search extract | B | Closest station in elevation to Persepolis |

## Rivers

| Item | Value | Source | Tier |
|---|---|---|---|
| Pulvar (Polvar, Sivand) | About 150 km long; main tributary of the Kur; flows past Naqsh-e Rustam and joins the Kur in the Marvdasht plain; today intermittent and often dry in summer and autumn; impounded by the Sivand Dam (modern) | [Wikidata Q5680617](https://www.wikidata.org/wiki/Q5680617); [Kor River (Wikipedia)](https://en.wikipedia.org/wiki/Kor_River) via extracts | B |
| Kur and Pulvar as the main water sources of the plain since antiquity | – | [academia.edu: names of the Kur and Pulvar](https://www.academia.edu/39002696) (abstract) | B |
| Pulvar course changes during the Holocene (Pasargadae plain); water management in the 1st millennium BCE | – | [ResearchGate 351615246](https://www.researchgate.net/publication/351615246) | B (title only) |
| Ancient course of the Pulvar near Persepolis | **Not retrieved.** Trace it from the DEM plus the geoarchaeology literature | – | – |

## Ancient versus modern ground level at the Terrace foot
- **Not found in any reachable source.** The ancient ground level is not the modern DEM surface. Alluvial build-up and modern land subsidence both affect it: subsidence is reported in the plain less than 0.5 km from the Terrace ([JPost](https://www.jpost.com/archaeology/article-869881)).
- Until excavation data (Schmidt 1953; Tilia) are obtained, use modern DEM minus 0 m, tier **C**, and add it to OPEN_QUESTIONS.

## Sumner's Marvdasht survey
Sumner, "Achaemenid Settlement in the Persepolis Plain", *AJA* 90.1 (1986) ([JSTOR/UChicago](https://www.journals.uchicago.edu/doi/10.2307/505980); full text on [archive.org](https://archive.org/details/Sumner1986AchaemenidSettlementInThePersepolisPlain), blocked here).

| Finding | Value | Tier |
|---|---|---|
| Secure Achaemenid habitation sites | 39 | B (survey result, seen via search extract) |
| Possible additional sites | 18 | B |
| Other features | Bridges, weirs, canals, and parts of the Royal Road | B (via search extract) |
| Aggregate settled area | about 675 ha | B |
| Sedentary population | ≤ about 44,000 | B |
| Settlement hierarchy | Five levels, organised in districts around Persepolis; matched to PF toponyms | B |

Summary values come via search extract.

## Unreachable
- archive.org (Sumner full text)
- Wikipedia (Persepolis, Kuh-e Rahmat pages)
- Iranica "Persepolis"
- ScienceDirect remote-sensing paper on site boundaries

## Climate
See `_climate_C.md` (WMO CLINO 1991–2020 Shiraz 40848, tier A) and DECISIONS D-004 for the Persepolis adjustment.

## Terrain layer corrections log
(filled by the terrain pipeline, Phase 1)
