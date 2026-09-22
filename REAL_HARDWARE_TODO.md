# REAL_HARDWARE_TODO — things only a real GPU run can verify
Run `npm run build && npm run preview`, then open `http://localhost:4173/?bench=all` in desktop Chrome/Edge with WebGPU, or
run `npm run bench`. The run writes `bench-reports/<date>.json`, or the report is offered for download in the browser.

| # | Gate item | Proxy used in sandbox | What to check on hardware |
|---|---|---|---|
| H1 | 60 fps @ 1440p top quality (brief §0) | draw calls, triangles, CPU frame time under SwiftShader | median / p1 frame time on each bench route |
