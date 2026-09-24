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
| 14 | A published English translation of the inscriptions carved in the world, XPa, XPb, XPc, XPd, XPe, DNa and DNb (and DPh, shown for the sealed deposit), under a licence allowed by USE (public domain, e.g. H. C. Tolman, *Ancient Persian Lexicon and the Texts of the Achaemenidan Inscriptions*, 1908; or CC-BY/CC-BY-NC, e.g. the ORACC ARIo translations if their licence says so) | a PDF/text of the translation, with its licence | `data/sources/translations/` | The translation layer shows the transliteration of the version looked at (ARIo, CC0) and word glosses from the lexicons only. **Corrected in D-167:** the Livius.org translations were read in full (the GitHub scrape is reachable), but every Livius page says "All content copyright © 1995–2024 Livius.org. All rights reserved.", and the scrape's CC-BY-NC cannot relicense that, so §12 does not allow them in the build. ORACC (its ARIo translations) and archive.org (Tolman 1908) are blocked here; the ORACC ARIo CATF on GitHub holds no translations. No translation is paraphrased from memory (§4.1). BLOCKERS B17. |
