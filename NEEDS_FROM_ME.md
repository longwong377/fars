# NEEDS_FROM_ME — what the user should supply
Written in the first hour of session 1 (2026-09-22). The build uses no-login fallbacks until these arrive.
Drop files into the named folders; every phase starts by checking `data/` and `references/`.

## Network situation in this sandbox (measured, preflight)
Reachable: registry.npmjs.org, pypi.org, AWS S3 (copernicus-dem-30m, sentinel-cogs), raw.githubusercontent.com.
Blocked for direct download (HTTP 403 at proxy): isac.uchicago.edu, archive.org, www.ncei.noaa.gov,
ssd.jpl.nasa.gov (Horizons API), achemenet.com, iranicaonline.org, fonts.google.com, cdn.jsdelivr.net,
download.blender.org, wikipedia, github.com release downloads. (Web *search/fetch-to-text* works for research.)

| # | What | Exact files / URL | Put it in | Why |
|---|------|-------------------|-----------|-----|
| 1 | Schmidt, *Persepolis I* (OIP 68) PDF | https://isac.uchicago.edu/research/publications/oip/oip-68-persepolis-i-structures-reliefs-inscriptions → `oip68.pdf` | `data/sources/oip68.pdf` | Authoritative site plan (the plan plates) for georeferenced plan-overlay IoU test (§13.2). I cannot download the PDF here, only read text excerpts. |
| 2 | Schmidt, *Persepolis II* (OIP 69) and *III* (OIP 70) PDFs | same ISAC OIP pages → `oip69.pdf`, `oip70.pdf` | `data/sources/` | Furnishings, objects, tombs. |
| 3 | Schmidt, *Flights Over Ancient Cities of Iran* (1940) | ISAC → `flights.pdf` | `data/sources/` | 1930s aerial photos for pre-modern landscape layer (§5.2.2). |
| 4 | Hallock OIP 92 and Cameron OIP 65 PDFs | ISAC OIP pages | `data/sources/` | Named people, rations, calendar (Phase 5). |
| 5 | JPL Horizons sun ephemeris check file (optional) | Horizons web UI: target Sun, observer 52.889E 29.934N 1620 m, dates listed in `tests/sky/horizons_request.txt`, output az/el CSV | `data/horizons/sun.csv` | Independent §13.6 check; until then the sun test is validated against the Meeus/VSOP87 reference implementation (astronomy-engine) — logged in BLOCKERS. |
| 6 | NOAA GHCN-Daily for Shiraz (IR000040848) | https://www.ncei.noaa.gov/data/global-historical-climatology-network-daily/access/IR000040848.csv | `data/climate/IR000040848.csv` | Weather-generator calibration; fallback uses published IRIMO 1991–2020 normals. |
| 7 | (optional) Copernicus CDS API key | https://cds.climate.copernicus.eu/ | `.env` as `CDS_API_KEY=` (never committed) | ERA5 hourly wind/cloud statistics. |
| 8 | (optional) USGS EarthExplorer account → CORONA frames over Marvdasht (e.g. DS1102-*, DS1105-* covering 29.9N 52.9E) | https://earthexplorer.usgs.gov | `data/corona/` | Restore pre-modern watercourses. |
| 9 | Noto fonts: Noto Sans Old Persian, Noto Sans Cuneiform, Noto Sans Imperial Aramaic (OFL) | https://fonts.google.com/noto (TTF) | `public/fonts/` | Inscriptions/tablets. Fallback: try npm `@fontsource/*` packages. |
| 10 | Licensed 3D scans of reliefs (Sketchfab CC-BY/CC-BY-NC) and a Sketchfab account | sketchfab.com | `data/scans/` + licence text | Relief carving at arm's length (§7). Until then reliefs are reconstructed (C-tier) and flagged. |
| 11 | A real GPU run | `npm run bench` on your RTX 3070-class machine | writes `bench-reports/*.json` | Real frame-rate gates (see `REAL_HARDWARE_TODO.md`). |
| 12 | Hosting | Cloudflare Pages or Netlify account | — | COOP/COEP headers; `public/_headers` already provided. |
| 13 | A dated, credited photograph of the ruin (column base / stair / doorway) with known date+time | your own photo or a CC one | `references/calibration/` + `notes.md` with date/time | §8 calibration scene. |
| 14 | A published English translation of the inscriptions carved in the world, XPa, XPb, XPc, XPd, XPe, DPa–DPe, DPf (Elamite) and DPg (Babylonian), DNa and DNb (and DPh, shown for the sealed deposit), under a licence allowed by USE (public domain, e.g. H. C. Tolman, *Ancient Persian Lexicon and the Texts of the Achaemenidan Inscriptions*, 1908; or CC-BY/CC-BY-NC, e.g. the ORACC ARIo translations if their licence says so) | a PDF/text of the translation, with its licence | `data/sources/translations/` | The translation layer shows the transliteration of the version looked at (ARIo, CC0) and word glosses from the lexicons only. **Corrected in D-167:** the Livius.org translations were read in full (the GitHub scrape is reachable), but every Livius page says "All content copyright © 1995–2024 Livius.org. All rights reserved.", and the scrape's CC-BY-NC cannot relicense that, so §12 does not allow them in the build. ORACC (its ARIo translations) and archive.org (Tolman 1908) are blocked here; the ORACC ARIo CATF on GitHub holds no translations. No translation is paraphrased from memory (§4.1). BLOCKERS B17. **Session 7 (D-198):** until this arrives, the layer shows the project's own English translation of every carved text and seal text, made from the ARIo transliterations, tier C and labelled "Translation by the project from the ARIo edition; not a published translation; verify against Schmitt 2009 / Kent 1953". With a licensed translation the project's renderings would be checked line by line or replaced (Q-363). |
| 15 | The Persepolis Treasury texts in transliteration: Cameron, *Persepolis Treasury Tablets* (OIP 65, 1948), and Cameron, "Persepolis Treasury Tablets Old and New", JNES 17 (1958), and "New Tablets from the Persepolis Treasury", JNES 24 (1965) (ISAC publishes OIP 65 free as a PDF); optionally Bowman, *Aramaic Ritual Texts from Persepolis* (OIP 91, free PDF) | ISAC OIP pages | `data/sources/oip65.pdf`, `data/sources/oip91.pdf` | **Session 7 (D-198):** the tablets in the Treasury scribes' room now carry memoranda RECONSTRUCTED by the project on the published formulary from sourced words only (labelled "not a surviving text (C)"; B18, Q-362). With these PDFs the reconstructions are replaced by real, dated Xerxes-year-19 payment texts, impressed sign by sign (writing.json; the per-tablet layout exists), and the chert vessels of the store can carry their ink texts. |
| 14 | A published English translation of the inscriptions carved in the world, XPa, XPb, XPc, XPd, XPe, DPa–DPe, DPf (Elamite) and DPg (Babylonian), DNa and DNb (and DPh, shown for the sealed deposit), under a licence allowed by USE (public domain, e.g. H. C. Tolman, *Ancient Persian Lexicon and the Texts of the Achaemenidan Inscriptions*, 1908; or CC-BY/CC-BY-NC, e.g. the ORACC ARIo translations if their licence says so) | a PDF/text of the translation, with its licence | `data/sources/translations/` | The translation layer shows the transliteration of the version looked at (ARIo, CC0) and word glosses from the lexicons only. **Corrected in D-167:** the Livius.org translations were read in full (the GitHub scrape is reachable), but every Livius page says "All content copyright © 1995–2024 Livius.org. All rights reserved.", and the scrape's CC-BY-NC cannot relicense that, so §12 does not allow them in the build. ORACC (its ARIo translations) and archive.org (Tolman 1908) are blocked here; the ORACC ARIo CATF on GitHub holds no translations. No translation is paraphrased from memory (§4.1). BLOCKERS B17. |
| 15 | The Persepolis Treasury texts in transliteration: Cameron, *Persepolis Treasury Tablets* (OIP 65, 1948), and Cameron, "Persepolis Treasury Tablets Old and New", JNES 17 (1958), and "New Tablets from the Persepolis Treasury", JNES 24 (1965) (ISAC publishes OIP 65 free as a PDF); optionally Bowman, *Aramaic Ritual Texts from Persepolis* (OIP 91, free PDF) | ISAC OIP pages | `data/sources/oip65.pdf`, `data/sources/oip91.pdf` | The tablets in the Treasury scribes' room carry a PLACEHOLDER text (B18): with these, a few dated Xerxes-year-19 payment texts can be impressed sign by sign (writing.json), and the chert vessels of the store can carry their ink texts. |
| 16 | The plates of the Apadana delegations: Walser, *Die Völkerschaften auf den Reliefs von Persepolis* (1966), Taf. 5-30, and Schmidt, *Persepolis I* (OIP 68, 1953) pls. 27-49 (or dated, credited photographs of each delegation of the E stair) | a library copy / ISAC OIP 68 PDF | `data/sources/walser1966/`, `data/sources/oip68.pdf` | D-199 dressed the 23 delegations from a recollection of these plates (NOT SEEN): each people's headgear, garments, footwear and gifts (src/data/delegations.json), and the disputed rows XVII and XXI (Q-370) are to be checked row by row and raised from 'recollection' to a cited plate. |

## Photographs of the site (expands #13; session 8). Optional; nothing is blocked without them
**THE EASY VERSION (the user's choice; enough to be useful):** download 10–30 ordinary daytime photos of Persepolis from
Wikimedia Commons (category "Persepolis"; our proxy blocks it, a normal browser does not) or use your own holiday photos:
the columns and stairs, the relief carvings close up, the Gate of All Nations, the mountain behind the Terrace, the plain,
Naqsh-e Rustam. Unedited if possible. Just drop them in `references/photos/`; no notes or links needed (the lead
catalogues them in references/INDEX.md; they are reference only, never in the build). The detailed list below is optional.
They calibrate what has not changed since 467 BCE: the stone, the hills, the plain, the light. Content still comes from the
scholarship. Drop them in `references/calibration/` (the calibration shots) or `references/photos/` (the rest), with one line
each in `references/notes.md`: what, where you stood, and the licence.
**Requirements:** original files with EXIF intact (date, time, GPS if possible; say if the camera clock was not on Iran time);
no filters, HDR or "enhance"; ideally RAW or straight-from-camera JPEG, 12 MP or more. Your own photos, or CC0 / CC-BY /
CC-BY-NC with author and URL. A grey card or colour checker in shots 1–4 is a bonus, not required.
**Priority 1: the calibration scene (brief §8.1; blocked since session 1)**
1. A standing column or column base in full sun, 5–10 m away, lit side and shade side both visible, some sky in frame.
2. The Grand Stair's lower flight from its foot, in sun.
3. A doorway with dark polished stone jambs (Tachara or Hadish) in sun, 3–5 m away.
4. Any one of 1–3 again at a different time of day (morning vs afternoon), same spot.
**Priority 2: stone surfaces (B40: how much the limestone really varies)**
5. The Terrace's W retaining wall: one shot from 10–20 m, one from 1–2 m, in sun.
6. Stair treads close (the worn centres and the ends).
7. The dark polished door-frame stone close, showing its gloss and reflections.
8. A column shaft's fluting close, and a fallen capital fragment.
9. Reliefs in raking light at 0.5–2 m: a guard, a delegation figure, the lion-and-bull (Apadana E stair; early morning sun from
   the E rakes it).
10. Any surviving or restored mud-brick and mud plaster (Treasury, Area B, the Gate's walls).
**Priority 3: landscape and sky**
11. Kuh-e Rahmat from the Terrace: the whole slope (bedding, scree, shrubs), midday and near sunset.
12. The Marvdasht plain looking W from the stair top, midday (April if you can choose).
13. The ground at the Terrace foot close (earth, herbs, stones).
14. Naqsh-e Rustam: the cliff from ~200 m and the rock surface close.
15. The distant ranges at sunrise or sunset (first light colour, haze).
16. An overcast or rainy sky over the plain.
17. Snow on the Terrace, if you ever have it.
**Priority 4: the Now view (the ruin today, out of world)**
18. The Apadana's standing columns from the N court.
19. The Gate of All Nations from the W (the stair top).
20. The view from the stair top toward the Gate.
**Also useful:** traditional mud-brick houses and courtyards in a Fars village (the town's houses are placeholders).
