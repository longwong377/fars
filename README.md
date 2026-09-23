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
| Budget | Target (top quality, RTX 3070-class, 1440p) | Current measured (SwiftShader, test quality) |
|---|---|---|
| Frame time | ≤ 16.7 ms (60 fps) | not measurable headless (software rasteriser); bench mode records it on hardware |
| Draw calls per frame | ≤ 3,000 | 99 (terrain + sky, approach view) |
| Triangles per frame | ≤ 12 M | 1.11 M (approach view) |
| JS heap | ≤ 1.5 GB | ~125 MB after boot |
| GPU memory (textures + buffers) | ≤ 3.5 GB | tracked via `renderer.info.memory` counts |
| First playable load (download) | ≤ 60 MB | ≈ 14 MB (JS about 2 MB, terrain 11.8 MB, stars 0.2 MB) |
| Total download (streamed) | ≤ 2.5 GB | ≈ 14 MB so far |

## Layout
`research/`: evidence bible (SITE_SPEC, CHRONOLOGY, …). `src/data/`: machine-readable spec, chronology, sources, climate,
calendar, blocklist, asset registry. `tools/`: data pipelines and lints. `src/`: engine and world. `tests/`: unit and e2e.
Licences and credits: `research/SOURCES.md`, `ASSET_LEDGER.md`.
