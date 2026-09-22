# REAL_HARDWARE_TODO — things only a real GPU run can verify
Run `npm run build && npm run preview`, then open `http://localhost:4173/?bench=all&quality=ultra` in desktop Chrome/Edge with WebGPU. The page offers the report as a download. Alternatively run `npm run bench` (Playwright, with `QUALITY=ultra ROUTES=all`), which writes `bench-reports/<timestamp>.json`.

| # | Gate item | Proxy used in sandbox | What to check on hardware |
|---|---|---|---|
| H1 | 60 fps @ 1440p top quality (brief §0) | draw calls, triangles, CPU frame time under SwiftShader | median / p1 frame time on each bench route |
| H2 | Instancing vs merging vs per-object draws for repeated elements | SwiftShader is bound by rasterisation, so the micro-bench (`bench/subsystems.html`, shots/subsystems-*.json) shows no draw-call signal: 2000 columns take 131–170 ms per frame in all three modes | re-run `bench/subsystems.html` on a GPU. The decision (instancing for repeated elements, merging for static architecture per building) follows standard GPU practice (B) |
| H3 | Shadow cost | 2k shadow map doubles SwiftShader frame time | frame time at 4k shadows + cascades |
| H4 | Terrain LOD error | the step is chosen at ~0.004 rad per vertex spacing | visible popping, and whether triangles stay under budget at the vista |
| H5 | SSGI + TRAA convergence and look (high/ultra) | SwiftShader renders them but 30 frames do not converge; GTAO shader fails to compile under SwiftShader | visual check of noise, ghosting and GI plausibility in the Apadana hall and forecourt |
