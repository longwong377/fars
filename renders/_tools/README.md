# cloud eyes (s17): full-world frames headless in a cloud container

1. `NOHMR=1 npx vite --port 5191 --strictPort` (HMR off: vite would otherwise reload the page after ready)
2. `node renders/_tools/asks_views.mjs handoff/s17/asks_vagon.md --out asks.json`, then build a SET json {ids, extra}
3. `WEBGL=1 FRAMES=2 node renders/_tools/render.mjs set.json outdir` (one page load; ready ~18 min, a view 3-16 min on 4 cores)
4. `node renders/_tools/publish.mjs set.json outdir <stamp> <commit> notes.json` -> renders/<stamp>/*.jpg + index.md

Why WebGL2: SwiftShader's WebGPU adapter caps sampled textures per fragment stage at 16 (Chrome flags do not lift it); the
app asks for 48, and the terrain/hills materials use 17-18, so they fail validation and the ground and hills vanish. The
WebGL2 path has 32 units and draws everything. Why the fetch stub: in dev the page POSTs every world-cache unit it computed
to vite (vsites 140 MB); CDP's Network event carries the body and Playwright's pipe dies (ERR_STRING_TOO_LONG).
