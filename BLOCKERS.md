# BLOCKERS
| # | Blocked | Why / evidence | Fallback in use | What unblocks it |
|---|---|---|---|---|
| B1 | Direct download of ISAC/archive.org PDFs (Schmidt plan plates) | proxy 403 on isac.uchicago.edu, archive.org (preflight 2026-09-22) | Text extraction via web-fetch-to-text; plan geometry from published dimensions; independent check from Copernicus DEM + Sentinel-2 | user drops `data/sources/oip68.pdf` (NEEDS #1) |
| B2 | JPL Horizons API | proxy 403 on ssd.jpl.nasa.gov | astronomy-engine (VSOP87/Meeus-class, validated by its authors vs Horizons to ~arcsec) as reference | NEEDS #5 |
| B3 | NOAA GHCN/ISD station data | proxy 403 on ncei.noaa.gov | published monthly normals (sourced in LANDSCAPE.md climate table) | NEEDS #6 |
| B4 | STAC search (earth-search) | proxy 403 | direct S3 listing of sentinel-cogs bucket works | — (resolved by workaround) |
| B5 | No GPU in sandbox | — | SwiftShader correctness tests + proxy perf budgets | user runs `npm run bench` (REAL_HARDWARE_TODO.md) |
