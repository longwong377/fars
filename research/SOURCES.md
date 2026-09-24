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

## Visitor mode (research agent, 2026-09-23): 11 keys added to `src/data/sources.json`
Scope: `research/ACCESS.md` and `src/data/access.json`. Access key: SX = search extract (host blocked, B6); FT = read in
full. GitHub raw was reachable. So this pass read four sets of texts in full: the CDLI dump (the 67 PF texts),
Herodotus and Xenophon's *Cyropaedia* (Perseus TEI; new passages HDT 1.99, 1.123, 3.72, 3.77, 3.84, 3.118, 3.128,
3.140, 5.35, 5.52, 7.239 and XEN-CYR 4.5.14, 7.5.25–29, 7.5.65–68, 8.1.6), and the King James Bible.

| key | cite (short) | access | used for |
|---|---|---|---|
| KJV-BIBLE | King James Bible (public domain), JSON edition | FT | Nehemiah 2:7–9 (letters to governors, escort); Ezra 5:9–10 (officials ask who authorised and write down names), 6:1–2 (records kept where the treasures were); Esther (late, C) |
| ARSHAMA-TA | Aršāma's travel authorisation for Nakhthor (Bodleian leather letters) | SX | the only surviving halmi: addressees on the route, daily rations, no rations for extra days |
| HALMI-SX | search summaries of Henkelman on the halmi and Aršāma's seal, and of Iranica "Persepolis administrative archives" | SX; **page attribution uncertain** | halmi senses; leather with a bulla; the Susa satrap's halmi; Ziššawiš as an issuer |
| MDPI-ARACH2025 | *Religions* 16/8 (2025) 965 | SX | NN 0859, a halmi of the king (Maudadda, to Arachosia) |
| HUNARA2024 | "One Person, Several Names", *Hunara* 2/1 (2024) | SX | Kaudama with a halmi of Ziššawiš, a journey from Persepolis |
| POTTS2024 | Potts, *barrišdama* and *mihmāndār*, *Ktèma* 49 (2024) | SX (abstract) | guides escorting travellers |
| HENK2002 | Henkelman, "Exit der Posaunenbläser", ARTA 2002.007 | SX (abstract) | PF lance-bearers were labour inspectors and escorts, not guards |
| SEALDOC2018 | "El documento sellado en la Persia aqueménida" (2018) | SX | *miyatukkaš* = \*viyātika-, used interchangeably with halmi |
| AZZONI2019 | Azzoni, ARTA 2019.003 | SX | Aramaic *ptp* "rations" (PF 0999) |
| PFA-ISAC | ISAC PFA pages; ARTA 2007.001; Wikipedia | SX | the PF find-spot in the NE bastion, bricked up in antiquity (the key was named in PEOPLE.md but missing from sources.json) |
| ALEX-HIST | Diodorus 17.70–71; Arrian 6.29 (via extracts) | SX | "gates … for security" (the triple wall is not adopted); guardians of Cyrus' tomb |

Also used, with existing keys: CDLI-PF (new readings, FT: *hal-mi* PF 15; *du-iš-da* in 26 texts; *hu-ut-lak* PF 45;
*kur-min* in 47 texts), HDT, XEN-CYR, IR-ADMIN, IR-PET, IR-TREAS, IR-PERS, IR-FORT, HYLAND2022, RATION-30 (the
Aššašturrana travel text), PT-WAGE, ISAC-PA (the Gate as "the only entrance"; the garrison quarters), ISAC-FINDS,
IRANTOUR-TREAS, LIVIUS (the S approach blocked by Xerxes; the garrison quarters' "conventional" name), LIVIUS-TR,
LIVIUS-TREAS, ROYALROAD-GIS, REF-PLAN, GONDET2009, GONDET2018, TOLAJORI2017, PW2017, BAKER2014, QANAT-WH2018,
POTTS2023, RELIEF-R, EVENTS-R, PEOPLE-R.

New sources this pass: **11** (cap ≈ 10). The extra one is KJV-BIBLE, the only full-text source for the biblical gate
and letter analogies.
Tried and blocked this pass: pazand.ir (the Q-text article), docdroid (a copy of Hallock's glossary),
achemenet, mdpi, hunara.org, academia, ResearchGate, cabinet.ox.ac.uk, arshama.bodleian, blogs.bodleian,
achaemenica, Wikipedia, antigonejournal, dokumen.pub, ephe.psl.eu, scholar.colorado.edu, bradford-delong.
## Phase 8 (language agent, session 3): lexicons for five languages — 20 keys added to `src/data/sources.json`
Access key: SX = search extract (host blocked, B6); FT = downloaded or read in full. Only GitHub (raw and media) was
reachable for files; livius.org, iranicaonline, archive.org, lrc.la.utexas.edu, cal.huc.edu, oracc.museum.upenn.edu,
wiktionary and theswissbay were refused by the egress proxy (2026-09-23).

| key | cite (short) | access | used for |
|---|---|---|---|
| LIVIUS-AI | Livius, Achaemenid Royal Inscriptions pages (scrape on GitHub, Electronic-Old-Persian-Library) | FT | OP glosses (DSf, DNa, DNb, XPh, DZc, XPa). Licence (D-167): each page says "All content copyright © 1995–2024 Livius.org. All rights reserved."; the scrape repository's CC-BY-NC cannot relicense it, so no translation is shown (B17) |
| EIEOL-OI | UT Austin EIEOL, Old Iranian Online | SX (earlier FT via a GitHub copy) | key for existing OP gloss sources |
| KENT-OCR | Kent 1953 lexicon lines, OCR quoted in sfmqrb/rishe | SX | key for existing OP gloss sources |
| OP-SX | ResearchGate on *bandaka*; EIEOL base-form dictionary (dargam, jīvā-) | SX | OP bandaka, dargam, jīvā |
| STRONGS | Strong's Concise Dictionary (1894), openscriptures/strongs JSON | FT | Aramaic glosses |
| OSHB | Open Scriptures Hebrew Bible (WLC + morphology), Ezra and Daniel | FT | Aramaic forms with verse refs |
| IR-CORR | Iranica, "Correspondence i. In pre-Islamic Persia" | SX | Aramaic letter formulas šlm ʿlyk, ʿl ʾḥy |
| ARSHAMA-BOD | Tuplin & Ma, Arshama Letters vol. 3 (Bodleian) | SX | letter formulas (existing entries) |
| ELEPH-OST | "Hi Aḥuṭab: Aramaic Letter Ostraca from Elephantine" | SX | letter formulas |
| HDT-GRC | Herodotus, Greek text (Godley; Perseus perseus-grc2) | FT | Greek forms (book.chapter.section) |
| HOM-OD | Homer, Odyssey, Greek text (Perseus) | FT | χαῖρε, ξεῖνε (Od. 1.123) |
| LSJ | Liddell–Scott–Jones, Perseus TEI | FT | Greek gloss check |
| IONIC-SX | Britannica "Ionic alphabet"; Wikipedia "Ionic Greek", "Eta" | SX (tertiary) | psilosis; Ionic letter set |
| RIBO | ORACC RIBo (NB royal inscriptions) via SLAB-NLP/Akk | FT (text only) | Babylonian everyday words (logograms, B) |
| CAMS-ORACC | ORACC CAMS via SLAB-NLP/Akk | FT (text only) | kurummatu (LB letter P348888) |
| HBTIN | ORACC HBTIN via SLAB-NLP/Akk | FT (text only) | aḫu "brother" (LB, Hellenistic) |
| HACKL-JURSA | Hackl & Jursa on Late Babylonian letters; AOAT 414/1 | SX | the LB greeting formula šulmu [u balāṭu] |
| PF-LETTER-SX | Hallock's rendering of the PF letter formula (via Henkelman / Iranica search results) | SX | Elamite tiriš / nanri |
| IR-ELAM | Iranica, "Elam v. Elamite language" | SX | key for existing Elamite sources |
| MESSENGER-SX | "The Achaemenid Messenger Service and the Ionian Revolt" (ResearchGate) | SX | key for existing Elamite sources |

Also used, with existing keys: ARIO (DB, DSf, DNa, DNb, DNe labels, XPa–XPh, DZc, the Cyrus Cylinder), CDLI-PF (Hallock PF 1–60,
400–406 with Hallock's translations), EWB (sense base `js/data/senses.js`: German/English glosses with volume:page), WP-CAL,
IR-PET, IR-FOODAG, LIVIUS, RECON. Downloaded but not used: the PROIEL Herodotus treebank (CC BY-NC-SA). Searched without result: the
CDLI dump for Achaemenid-period Babylonian archival texts (none with ATF in the unblocked dump).

## Twilight light, sky and exposure (twilight agent, session 3): 11 keys added to `src/data/sources.json`
Scope: `src/sky/illuminance.ts`, `src/sky/atmosphere.ts`, `src/sky/exposure.ts` (D-115 … D-119). Raw GitHub was the only
reachable host; DTIC, Optica, Wikipedia, ResearchGate, arXiv, nature.com, the MPI and Ferwerda pages, atoptics and
scialert were refused by the egress proxy (2026-09-23). Tiers of use: **B** = a published model or measurement applied
to Pārsa (another site, a standard atmosphere); **C** = our choice.

| key | what | access | used for | tier of use |
|---|---|---|---|---|
| USNO-C171 | Janiczek & DeYoung 1987, USNO Circular 171 (fit to Brown 1952): clear-sky sun, sky and moon illuminance vs altitude, −18° … 90° | FT via SKYLIGHT-R (the circular itself blocked) | sun, skylight and moon intensities (ratios to the zenith sun) | B |
| SKYLIGHT-R | Hufkens, `skylight` R package: verbatim transcription of USNO-C171 (`atmos`, `refr`, moon routines) | FT | the formulas | – |
| BRUNETON17 | Bruneton 2017 precomputed atmospheric scattering (demo constants, CIE CMFs, ASTM G-173, ozone cross-sections, transmittance parametrisation) | FT (code) | the twilight dome's atmosphere and colour conversion | B |
| HILLAIRE20 | Hillaire 2020 sky/atmosphere rendering (multiple-scattering LUT) | FT (code) | multiple scattering in the twilight dome | B |
| FERWERDA96 | Ferwerda et al. 1996, visual adaptation (cone and rod TVI) | FT via BANTERLE-HDRT (paper blocked) | the rods' absolute-threshold plateau (limit of adaptation) | B data, C use |
| BANTERLE-HDRT | Banterle's HDR Toolbox (Ferwerda TMO, TVI, Walraven–Valeton k) | FT | the TVI formulas | – |
| KRAWCZYK05 | Krawczyk, Myszkowski & Seidel 2005, key value vs adapting luminance | SX | displayed brightness vs adaptation | B formula, C use |
| LEE15-BOV | Lee 2015, Belt of Venus hyperspectral measurements and model | SX (abstract) | test: dark segment ≈ colour of the sky above the arch; vivid for modest aerosol | B (qualitative) |
| RICHTSMEIER17 | Antitwilight I and II (Applied Optics 2017) | SX (abstracts) | "rapid rising of the Belt of Venus"; dark segment origin | B (qualitative) |
| WP-TWILIGHT-SX | Wikipedia Belt of Venus / Earth's shadow / Lux table; visualexpert "twilight envelope" | SX (tertiary) | belt ~10–20° high, shadow over ~180° and rising; 400 lx at sunrise, 3.4 lx at −6°, 0.002 lx airglow night, full moon 0.05–0.3 lx | C (tertiary) |
| IRAN-ILLUM-SX | Iranian clear-sky illuminance study (2009): 129 klx maximum | SX | test: the zenith-sun total | B |

Not reached (would upgrade the tiers): Lee 2015 full text (measured heights and chromaticities of the dark segment and
the arch vs solar depression); Rozenberg 1966 *Twilight*; Brown 1952; Spitschan et al. 2016 (measured outdoor
illuminance vs solar elevation); CIE 191:2010 (mesopic photometry); ISO 2720 (meter calibration).

## Phase 8 review fixes (session 5, layer workstream; D-167, D-168)
Fetched through raw GitHub content (the only reachable host for files); nothing below is bundled with the app unless said.

| what | where | licence | used for |
|---|---|---|---|
| Livius inscription pages, scraped (XPa–XPe, DNa, DNb, DPh re-read) | Electronic-Old-Persian-Library/Old-Persian-Dataset `textdata/web_scraping/*.txt`; repository `LICENSE-CC-BY-NC` read | the repository says CC-BY-NC; the pages it copies say "All rights reserved" (Livius.org) | the licence finding (D-167, B17); not bundled |
| Dataset translations sample `textdata/eng_transcription_to_english/eng_transcription_to_english_001.json` | same repository | as above; the English follows Kent's style ("an Achaemenian"), source not named | checked: no licensed alternative there |
| ORACC ARIo in CATF, sign by sign with the edition's line numbers (`ario.catf`, 166,028 bytes, sha256 prefix eb8de252) | oracc/catf `ario.catf` | CC0 (ORACC ARIo) | checked for translations: none (0 `#tr` lines); it holds the published Old Persian SIGN SEQUENCE (e.g. `θ-a-t-i-y`) and lineation that the carving workstream needs (reported to the lead) |
| Open Scriptures Hebrew Bible, WLC with lemma and morphology: Ezra, Daniel, Jeremiah, Genesis XML | openscriptures/morphhb `wlc/*.xml`; README read | lemma and morphology CC BY 4.0; WLC text public domain | Aramaic verse citations for 42 Strong's-only lexicon entries (aramaic.json `attested`, key OSHB) |
| Hillenbrand, Getty, Clark & Wheeler 1995 vowel measurements (`vowdata.csv`, 1,668 tokens) | compi1234/spchlab `data/hillenbrand/vowdata.csv` (a CSV rendering of the published vowdata.dat) | © J. Hillenbrand, redistributed with the paper's data; measurement reference only, not bundled | voice acceptance: F0 and F1/F2 norms (B17) |
| pocketsphinx 5 with its bundled US-English acoustic model and CMU dictionary | PyPI (scratch venv) | BSD-2-Clause | voice acceptance: offline phone recognition (B17); a measurement tool, not bundled |
| allosaurus with its universal phone model `uni2005` | PyPI; model from its GitHub release | GPL-3.0 (tool and model) | voice acceptance: universal phone recognition (B17); a measurement tool, not bundled |
| openai/whisper test clip `tests/jfk.flac` and `tests/test_transcribe.py` | openai/whisper | MIT repository; the clip is a 1961 US-government speech | natural-speech control for the recognisers (the test file asserts "my fellow americans", "your country"); not bundled |


## Writing on objects (session 6, writing workstream; D-179, research/WRITING_ON_OBJECTS.md)
Only GitHub raw content was reachable; every scholarly host tried (ISAC, archive.org, JSTOR, academia.edu, otgateway.com,
center-for-decipherment.ch, oracc.museum.upenn.edu, livius.org) answered 403 at the proxy (B6).

| key / what | access | used for |
|---|---|---|
| ARIO (existing): ARIo Q007203 (SDa, trilingual royal-name seal formula of Darius) and Q009270 (Old Persian royal-name seal formula of Xerxes), from `data/corpus/ario.jsonl` | FT (CC0) | the two seal inscriptions impressed in clay (writing.json) |
| OSL (existing) | FT | Elamite and Babylonian ATF → signs, as for the carved inscriptions |
| CDLI dump (cdli-gh/data `cdliatf_unblocked.atf`, fetched again; 86.9 MB) | FT | searched for Persepolis Treasury texts: none (only PF 1–60, 400–406 and BM 108963, JNES 77); the PF texts are not used (dated 509–493, archived elsewhere) |
| WRITING-SX (new): search summaries of Iranica "Persepolis Elamite Tablets", "Persepolis Administrative Archives ii" and "Documents" | SX; page attribution uncertain | PT date range and the Xerxes years 19–20 peak; the royal seal with a trilingual Darius inscription used under Xerxes by the chief of the Treasury; royal seal iconography; shared seals between Treasury tablets and sealings; cord holes at a corner of the PT tablets (Cameron's leather-scroll inference); Aramaic scribes on clay and parchment |
| ISAC-FINDS (existing): "Contents of the Treasury" caption "Hero Triumphant with Xerxes Inscription" | SX | the Xerxes hero seal of the door sealings (design and wording C) |
| Seen as titles only, not keyed: Garrison, Jones and Stolper, "Achaemenid Elamite Administrative Tablets, 4: BM 108963", JNES 77 (2018) 1–14; Garrison 1991, "Seals and the Elite at Persepolis"; Bowman 1970, OIP 91; Cameron 1948, OIP 65; "PT 005 – the new edition of Persepolis Treasury Tablets" | — | leads for B18 |

## The court in residence (session 6, court workstream; D-182, research/COURT.md): 8 keys added to `src/data/sources.json`
Web search summaries only: attalus.org, iranicaonline.org, achemenet.com and isac.uchicago.edu were refused by the
egress proxy (B6). Greek claims about the Persian court are capped at B; their numbers are for other kings.

| key / what | access | used for |
|---|---|---|
| IR-HERACL (new): Iranica "Heracleides of Cyme" | SX | the thousand apple-bearers; the 300 women; the king's dinner |
| IR-IMM (new): Iranica "Immortals" (HDT 7.41, 7.83; HDT itself FT) | SX | the thousand with golden pomegranates, the Ten Thousand |
| IR-COURT (new): Iranica "Courts and courtiers i" | SX | chiliarch, eunuchs, steward, table-companions |
| IR-CHIL (new): Iranica "Chiliarch" + "Hazarapatiš: commander or usher?" | SX | the screening of visitors, the usher |
| IR-HAREM (new): Iranica "Harem i" | SX | Parmenion's 329 concubines; royal women at court |
| TREAS-AUD (new): the Treasury audience relief (Iranica "Persepolis", achaemenica.org "Proskynesis") | SX | attendants' Persian robe; the audience's figures |
| APA-RELIEF (new): the Apadana stair reliefs (Livius, ISAC pages) | SX | delegations led by ushers; guard files; nobles |
| HENK2010 (new): Henkelman 2010 "Consumed before the King" | SX | PF 0701; the royal table redistributed to family, courtiers, guards |
| ATH4, ATH4-HERACL, ATH12-HERACL, ATH13-PARM, KING2022, HDT (existing) | as keyed | the 15,000 claim; the dinner; the women; Parmenion's list; trips to the king |
