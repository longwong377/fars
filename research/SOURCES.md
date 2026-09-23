# SOURCES
Canonical machine-readable list: `src/data/sources.json` (keys are used in every data row).
Access status is recorded per source. As of session 1, **no primary publication could be opened** (BLOCKERS B6).

Phase 0 count: 21 keyed sources. Research subagent files list about 30 more pages seen only as search extracts:
`_extract_A.md`, `_extract_B.md`, `_chronology_C.md`, `_landscape_C.md`, `_climate_C.md`.

## Licences and credits for downloaded data
| Data | Licence | Credit |
|---|---|---|
| Copernicus GLO-30 DSM | Copernicus DEM licence (free, attribution) | © DLR e.V. 2010–2014 and © Airbus Defence and Space GmbH 2014–2018, provided under COPERNICUS by the European Union and ESA |
| Sentinel-2 L2A | Copernicus open licence | Contains modified Copernicus Sentinel data 2024 |
| OSM footprints via Overture | ODbL | © OpenStreetMap contributors; Overture Maps Foundation |
| Pleiades outlines | CC-BY 3.0 | Pleiades gazetteer (pleiades.stoa.org), via ryanfb/pleiades-geojson |
| Parker & Dubberstein TSV | facts from a 1956 publication; transcription by S. Redmond (no licence file) | Parker & Dubberstein 1956 |
| WMO CLINO normals | WMO open data | WMO / IRIMO |

## Phases 6–7 (settlement, plain, horizon): 25 keys added to `src/data/sources.json`
Access key: SX = search extract (the host is blocked, B6); FT = downloaded or read in full.

| key | cite (short) | access | used for |
|---|---|---|---|
| TOLAJORI2017 | Askari Chaverdi, Callieri & Matin 2017, Tol-e Ajori 2014 season | SX | gate size, plan, date |
| AJORI-BRICK2018 | *Applied Clay Science* 152 (2018), Tol-e Ajori bricks | SX | "3.5 km NW"; glazed brick |
| AJORI2013 | Askari Chaverdi, Callieri & Gondet, ARTA 2013.006 | SX | building and context, 3.5 km |
| PW2017 | *Persepolis West* 2008–2009, BAR IS 2870; AJA 2019 review | SX | Areas A/B/C, kiln, bone pits |
| PW-PIGMENT2021 | *Microchemical Journal* 167 (2021) 106304 | SX | pigment workshop, Egyptian blue |
| GONDET2009 | Gondet et al., *ArcheoSciences* 33 suppl. (2009) | SX | 50 ha geomagnetic survey; garden complexes |
| BOUCHARLAT2012 | Boucharlat, De Schacht & Gondet 2012, *Series Minor* 77 | SX | Achaemenid hydrological traces |
| GONDET2018 | Gondet, Mohammadkhani & Askari Chaverdi, ARTA 2018.003 | SX | 1 ha building N of the Terrace |
| DASHTESTAN2021 | "The Achaemenid Settlement of Dashtestan: A View from Persepolis" | SX | Bagh-e Firuzi 3.5 km W/NW, S of the Pulvar; Matezziš |
| KURHYDRO2024 | *Motaleat-e Bastanshenasi-e Parseh* 8(28), 2024 | SX | Kur-basin dams and canals |
| MAYS2010 | Mays & Gorokhovich 2010 (Springer) | SX | 4 km canal from the Pulvar |
| SHOBAIRI2018 | Shobairi 2018, 10th ICAANE | SX | earthen channel networks |
| PLEIADES-FARS | Pleiades JSON and GeoJSON, Barrington map 94 | FT | coordinates, periods, refs, river lines |
| OVERTURE-2026 | Overture 2026-08-19.0 places and base | FT | modern anchors (parking, Firuzi village, Istakhr polygon, Kuh-e Rahmat) |
| LIVIUS-TR | Livius, "Takht-e Rostam" | SX | 12.5 m platform, 2 km S of Naqsh-e Rustam |
| ROYALROAD-GIS | *Antiquity* GIS paper on the Susa–Persepolis road; Potts 2009 | SX | 23 stages; way-stations |
| IR-ARCH2 | Iranica "Archaeology ii" | SX | Spring Cemetery, rock tombs, 100–150 sites |
| IR-FOODAG | Iranica "Cooking", "Barley", "Economy iii", "Persepolis Elamite Tablets" | SX | crops, fruits, barley calendar |
| SAEIDI2021 | Maharlou pollen (Saeidi Ghavi Andam 2021; Djamali 2009) | SX | vegetation, garden trees |
| KOR-HSJ2023 | *Hydrological Sciences Journal* 2023, Kor basin | SX | basin size, snowmelt regime |
| FARS-WHEAT | CERES-Wheat Fars study (PMC12318503) | SX | wheat sowing dates |
| ISTAKHR2018 | Fontana (ed.), *Istakhr 2011–2016*, QVO XIII | SX | no pre-Sasanian Istakhr |
| QANAT-WH2018 | *Water History* 2018, qanat dating | SX | qanats undated |
| WP-NR | Wikipedia, surfiran, CAIS (tertiary) | SX | Ka'ba date, Ctesias story, Husain Kuh |
| HDT | Herodotus (Godley), Perseus TEI | FT | 1.140 burial; 3.117 irrigation gates |

Also used, with existing keys: SUMNER1986, LIVIUS-NR, ALVAREZMON, WMO-CLINO, COP-DEM, SRTM-TILES (the AWS terrarium z10 tiles, fetched again for the horizon check), PEOPLE-R.

Seen as titles only (not keyed): D. T. Potts 2023, "Pain et vin: equine rations of bread and wine" (*Cheiron*), a lead for stables; "The fruits of Pārsa", *Paleopersepolis* (2021), pp. 133–67, a lead for orchards.
