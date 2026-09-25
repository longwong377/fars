# PĀRSA — a living 1:1 reconstruction of Persepolis, 467 BCE
**Read first:** `PROGRESS.md` gives the honest state (what is broken, placeholder or C-tier). `FINAL_REPORT.md` is written at the end.

## Run
```
npm install
npm run dev            # http://localhost:5173  (desktop Chrome/Edge with WebGPU; falls back to WebGL2)
npm test               # unit, dimension, sky and weather tests (vitest)
npm run test:e2e       # headless Chromium (SwiftShader), WebGPU and WebGL2 projects
npm run lint:all       # chronology / anachronism lint (language and activity lints are added in Phases 3–5)
npm run terrain        # regenerate public/generated/terrain_* from data/dem/*.tif (needs python3 + rasterio, scipy, shapely, pyproj)
npm run build && npm run preview   # production build with COOP/COEP headers
```
URL parameters for tools: `?quality=test|low|medium|high|ultra`, `&webgl=1`, `&seed=1`, `&day=0..353&hour=0..24`,
`&weather=auto|clear|overcast|rain|storm|snow|dust|mist`, `&overlay`, `&test` (frozen world), `&bench=all|approach|vista|terrace`.
F3 toggles the dev overlay, which shows the evidence tier and source of whatever is under the crosshair, plus the performance and memory HUD.

## Deploy
Static site (`dist/`) on a host that can set COOP/COEP headers. `public/_headers` covers Cloudflare Pages and Netlify.
Large source data (`data/dem/*.tif`, raw imagery) stays out of git. Derived terrain rings (11.8 MB) are committed so a fresh
clone runs without the DEM.

## Budgets (set in Phase 1; proxies measured headless, real numbers from `?bench=all` — see REAL_HARDWARE_TODO.md)
| Budget | Target (top quality, RTX 3070-class, 1440p) | Current measured (SwiftShader, quality high, session 7) |
|---|---|---|
| Frame time | ≤ 16.7 ms (60 fps) | not measurable headless (software rasteriser); bench mode records it on hardware |
| Draw calls per frame | ≤ 3,000 | 408 / 557 / 647 (stair at dawn over the plain, Apadana N court, Grand Stair foot; `shots/plain-stats.json`); the plain adds 10–20, the town 11–27 |
| Triangles per frame | ≤ 12 M | 7.47 M / 8.57 M / 8.65 M (same views; terrain 4.5–4.6 M of it) |
| JS heap | ≤ 1.5 GB | ~125 MB after boot (Phase 1); not re-measured with the full population |
| GPU memory (textures + buffers) | ≤ 3.5 GB | tracked via `renderer.info.memory` counts |
| First playable load (download) | ≤ 60 MB | ≈ 36 MB `dist/` (JS 6.7 MB, 2.29 MB gzipped; generated data 26 MB) |
| Total download (streamed) | ≤ 2.5 GB | ≈ 36 MB (nothing is streamed yet) |

## Layout
`research/`: evidence bible (SITE_SPEC, CHRONOLOGY, …). `src/data/`: machine-readable spec, chronology, sources, climate,
calendar, blocklist, asset registry. `tools/`: data pipelines and lints. `src/`: engine and world. `tests/`: unit and e2e.
Licences and credits: `research/SOURCES.md`, `ASSET_LEDGER.md`.
