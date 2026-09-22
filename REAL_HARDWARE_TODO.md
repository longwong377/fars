# REAL_HARDWARE_TODO — things only a real GPU run can verify
Run `npm run build && npm run preview`, then open `http://localhost:4173/?bench=all` in desktop Chrome/Edge with WebGPU, or
run `npm run bench`. The run writes `bench-reports/<date>.json`, or the report is offered for download in the browser.

| # | Gate item | Proxy used in sandbox | What to check on hardware |
|---|---|---|---|
| H1 | 60 fps @ 1440p top quality (brief §0) | draw calls, triangles, CPU frame time under SwiftShader | median / p1 frame time on each bench route |
| H2 | Instancing vs merging vs per-object draws for repeated elements | SwiftShader is bound by rasterisation, so the micro-bench (`bench/subsystems.html`, shots/subsystems-*.json) shows no draw-call signal: 2000 columns take 131–170 ms per frame in all three modes | re-run `bench/subsystems.html` on a GPU. The decision (instancing for repeated elements, merging for static architecture per building) follows standard GPU practice (B) |
| H3 | Shadow cost | 2k shadow map doubles SwiftShader frame time | frame time at 4k shadows + cascades |
| H4 | Terrain LOD error | the step is chosen at ~0.004 rad per vertex spacing | visible popping, and whether triangles stay under budget at the vista |
