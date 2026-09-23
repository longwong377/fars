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

## Phase 5 (2026-09-23): people, economy and events
Scope: `research/PEOPLE.md` §P5, `research/EVENTS.md`, `src/data/population.json`, `src/data/events_calendar.json`.
**Every scholarly host is still blocked**, for both curl and WebFetch (B6). This phase also tried achemenet,
cambridge, pazand.ir, elamit.net, trivent-publishing, archaeopress, cordis and worldhistory.

| key | what | access | new? |
|---|---|---|---|
| CDLI-PF | Hallock PF 1–60, 400–406 with Hallock's translations (CDLI dump) | **FT**: 67 texts, the only primary texts read in full | key new; data already used for NAMES |
| HDT | Herodotus (Perseus TEI): 1.132, 1.133, 1.135, 1.136, 1.140, 7.41, 7.81, 8.98, 9.110 | **FT** (Greek claims) | key new; file read in Phase 3 |
| XEN-CYR | Xenophon, *Cyropaedia* (Perseus TEI): 8.5.21, 8.5.26, 8.6.17–18, 8.6.22 | **FT** (Greek claims) | **new** |
| EWB | Hinz & Koch lemma/sense base: month-name and term glosses | **FT** (glosses) | key new; used for NAMES |
| IR-PET, IR-WOMEN, RATION-30, ATH4, HENK2023, PT-WAGE | earlier-phase sources, now keyed in sources.json | SX | no |
| IR-ADMIN | Iranica "Persepolis Administrative Archives" | SX | **new** |
| HENK2008 | Henkelman, *The Other Gods Who Are* (2008) | SX | **new** |
| HENK2011 | Henkelman, "Parnakka's Feast" (2011) | SX | **new** |
| HYLAND2022 | Hyland, ARTA 2022.002 (Lycian work force; travel rations) | SX | **new** |
| POTTS2023 | Potts, "Pain et vin" (*Cheiron* 2023) | SX | **new** |
| LIVIUS-TREAS | Livius "Persepolis, Treasury" (1,348 treasury people in 467) | SX | **new** |
| SELOPERSE | Gondet et al., SELOPerse project | SX | **new** |
| WP-CAL | Wikipedia calendar articles + Basello 2006 (month names) | SX | **new** |
| FARS-CROP | modern Fars crop calendar (PMC12318503; FAO GIEWS) | SX | **new** |
| BF1994 | Bagnall & Frier 1994 (demography analogue) | SX | **new** |
| LANDSCAPE-R, EVENTS-R | project files | – | keys only |

New sources this phase: **11** (cap ≈ 10; the extra one is the BF1994 demography analogue).
