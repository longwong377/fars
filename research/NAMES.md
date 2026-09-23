# NAMES: attested personal names for NPCs

Data file: `src/data/names.json` (583 names). Built 2026-09-23. Rule (brief §9.1): only attested names, matched to origin. Never invent a name.

## Read this first: what is weak
- **The CDLI dump has only 67 Persepolis texts transliterated.** They are Hallock PF 1–60 and PF 400–406 (OIP 92). CDLI catalogues 2,087 OIP 92 tablets, but the other ~2,020 have no ATF in the dump. **No Treasury text (Cameron PT, OIP 65) is in CDLI at all.** So the primary-text (tier A) layer is only **99 male names**, and it has **no female personal names**. The only `{munus}` word in these texts is the title *abbamuš*.
- To reach a usable pool, I added a **secondary layer (tier B): 484 names from Hinz & Koch, *Elamisches Wörterbuch* (EWB, 1987).** They come from a GitHub digitisation of its lemma list. These names are real, determinative-marked Achaemenid Elamite personal names. However, **the lemma base gives no text reference**, so each one says `texts: []` and `archive: "achE (PF/PT not distinguished)"`. Most are PF or PF-NN names, but some may come from PT or the inscriptions.
- `origin_guess` is **tier C throughout.** It comes from EWB's etymology, and Hinz often over-reads names as Iranian. Only one CDLI name carries an ethnic or gentilic label in its text (Badušduš, "the Mannaraziyan").

## Counts
| | CDLI (tier A, PF) | EWB (tier B, achE) | total |
|---|---|---|---|
| male | 99 | 372 | 471 |
| female | 0 | 112 | 112 |
| **total** | **99** | **484** | **583** |

| origin_guess | m | f | total |
|---|---|---|---|
| Iranian | 346 | 74 | 420 |
| Elamite | 45 | 4 | 49 |
| Babylonian | 16 | 0 | 16 |
| Indian ("Hinduka"-type ethnic names) | 3 | 1 | 4 |
| West Semitic (Aramaic-type; value added to the enum) | 3 | 0 | 3 |
| Egyptian (*Mudrāya* "the Egyptian") | 1 | 0 | 1 |
| Anatolian (Kubaba, goddess name) | 0 | 1 | 1 |
| Greek | 0 | 0 | 0 |
| unknown | 57 | 32 | 89 |

- CDLI by origin: Iranian 75, unknown 21, Elamite 3.
- CDLI names attested in 2 or more texts: 26. The top ones are Bakadušda and Karkiš (4 texts each), then Bakabada, Bakerabba, Irtuppiya, Iršena, Ušaya, Uštana and Šakada (3 each).
- EWB male names with lemma-base frequency ≥ 2: 321. All the others are non-Iranian names, which I kept whatever their frequency so that origin matching has something to draw on.
- Names flagged `reading_uncertain`: 24, mostly damaged female lemmas.
- Names flagged `notable`: 4 (Irdabama, Irtašduna, Barnakka/Parnakka, Ašbazana). These are royal women and top officials. **Do not use them for generic NPCs.**
- No Greek name survived the filters. The *yauna*-compounds (Yaunabarza and others) are Iranian formations and are labelled Iranian.

## Method
1. **CDLI.** I streamed the bulk dump and kept the catalogue rows whose provenience is "Pārśa (mod. Persepolis)" (2,247 rows). 95 of them have ATF: 67 PF texts and 28 royal inscriptions. I read every `{hal}` or `{munus}` token (146 + 3) in the 67 PF texts by hand, against the CDLI English translation, which is Hallock's.
   - I removed the genitive *-na* after *kurmin* ("supplied by").
   - I excluded role nouns written with the person determinative: *kurtaš* "workers", *sunki*/EŠŠANA "king", *mardam*, *kantira-ikkimar* "from the storekeeper", *akkayaše(-ikki)* "companion", and `{munus}`*abbamuš* (a title).
   - The name is Hallock's translation form. `texts` gives "PF n (P-number)" and `count` is the number of distinct texts. `role_in_text` records what the person does in those texts: supplier, receiver, apportioner (*šaramana*), wine carrier, grain handler (*tumara*), and so on.
   - Uncertain readings keep Hallock's own query and are flagged: Maratamkaš "(PN?)", Zirazabbe "or Ziraza persons", Mankeš(?), Iriššurra(?), Pirmayabadda(?), Badušduš(?).
2. **EWB.** I took personal-name lemmas with period `achE` whose transliteration starts with the HAL (`hh.`) or MUNUS (`f.`) determinative. This drops `v.` (DIŠ, typical of the royal inscriptions), `hw.` and bracketed determinatives.
   - Men: undamaged readings with lemma-base frequency ≥ 2, plus all non-Iranian names.
   - Women: all lemmas, except illegible or broken-off ones (`x`, `…`) and *abbamuš*. Damaged readings are flagged.
   - Spelling variants with the same EWB etymon are merged into `spellings`. A lemma that matches a CDLI name by a spelling-insensitive key is merged into the CDLI record (the `ewb` field).
   - `ewb.ref` gives the EWB volume and page from the lemma base's `senses.js`, where available (297 of 574).
   - The name is normalised mechanically: determinative dropped; accents, sign indices and the `d.` divine determinative removed; q→k; CV-VC→CVC, which approximates Hallock's style. For example, hh.ba-rat-qa-ma becomes Baratkama.
3. **Origin.** The origin comes from the EWB etymon:
   - An Old Iranian etymon gives Iranian.
   - An Akkadian etymon gives Babylonian (*bēl-*, *nabû-*, *šamaš-*, *itti-*, *marduk-*).
   - An Aramaic-type etymon (*barīk-*) gives West Semitic.
   - An Elamite analysis gives Elamite (Humban-, Kiten-, Tempt-, Šati-, reduplication).
   - *Hinduka*, *Mudrāya* and *Yauna* give Indian, Egyptian and Greek.
   - With no etymon, onomastic elements decide (Humban/Umban, kitin, Napir, Šutur, Šati, Nabû, Marduk, Šamaš).
   - Otherwise the origin is `unknown`.
   - Manual overrides: Mardunuya is Iranian (Hallock gives "Mardonius"). Badušduš is unknown, with the text's gentilic label recorded.

## Caveats
- `count` is only the count within the 67-text CDLI sample. It is **not** the name's frequency in the archive.
- The EWB `ewb_freq` field is undocumented: Parnakka, who has hundreds of PF attestations, scores 10–12. Use it only for ranking.
- A name's first attestation date is not recorded. All CDLI texts are Darius-era PF, 509–493 BCE (regnal years 16–24 appear). For 467 BCE, treat every name as a name that was in use in the Persepolis region a generation earlier. Nothing here puts a specific person at Persepolis in 467.
- EWB forms follow Hinz & Koch readings, which differ from Hallock's in places (for example *qa* for Hallock's *ka4*).
- Neither source gives Greek, Lydian or Egyptian workers' own names with ethnic labels. Those need Hallock's and Cameron's indices, and the PT texts: NEEDS #1–#4 in `PEOPLE.md`.
- Female names are almost all tier B (EWB). No female personal name is attested in the CDLI sample.

## Sources, exact files, licences
| id | file / URL | notes | licence |
|---|---|---|---|
| CDLI ATF | `https://media.githubusercontent.com/media/cdli-gh/data/master/cdliatf_unblocked.atf` (Git LFS; sha256 `2896ec253767fa07fcaa5424af6fc25d6a047dc30b99c95f99d57ce75384d836`, 86.9 MB; the `raw.githubusercontent.com` URL returns only the LFS pointer) | repo `cdli-gh/data`, README says "last update August 2022" | The CDLI terms of use say text "may be freely copied, aggregated and re-used according to common and fair academic practice", and large-scale re-use should cite CDLI (https://cdli.earth/terms-of-use; **search extract only, host blocked**). The repo has no LICENSE file. Cite CDLI with the P-number and Hallock PF number. |
| CDLI catalogue | `https://media.githubusercontent.com/media/cdli-gh/data/master/cdli_cat.csv` (154.8 MB) | used for provenience and designation | same |
| Underlying edition | R. T. Hallock, *Persepolis Fortification Tablets* (OIP 92, 1969) | transliterations and translations as carried by CDLI | ISAC distributes OIP volumes as free PDFs; cite Hallock |
| EWB lemma base | `https://github.com/DigitalPasts/ALP-MEGA2024`, commit `3160b20f5cd84b387343d071749bb90419148743`: `Elamite_materials/EWB-EJSmithFiles/PN-EWB-EJSmith.csv` and `js/data/senses.js` | DANES-ALP "MEGA" working group digitisation of Hinz & Koch, *Elamisches Wörterbuch* (Berlin 1987) | **No licence in the repo.** Only bare facts are taken (name form, sex, etymon, EWB page). The CSV is not redistributed. **Flag for review before any public release.** |
