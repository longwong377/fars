# V2 materials (D-490..D-499, Q-1420..Q-1429, B520..B529; branch s17-materials)
The player sees, by tonight: every surface real at 1-30 m. One material system: CC0 scans lead pattern and local colour,
a per-material mean albedo from the palette (season-aware via season.ts; never hard-code straw/green/haze), wear and grime
(feet of walls, thresholds, drip lines, soot over doors), no visible tiling (stochastic/detile, macro variation), no flat
colour fields. Classes in order of screen share: mud-brick and plaster walls, ground (lanes, courts, paths, field edges),
roofs, Terrace limestone (grey-cream, sun-bleached; V4 owns the Terrace's geometry, you its surface shading), doors and wood,
thresholds, cloth. New downloads only where branch assets-archive lacks a material; ship KTX2 (the uncommitted KTX2 set in
C:/Users/Administrator/fars-wt/load/public/textures/ may be copied from if useful; do not edit that tree).
Owns: src/render/materials.ts, scans.ts, grime.ts, masonry.ts, blockface.ts, src/world/settlement/surfaces.ts,
src/terrain/terrainDetail.ts, detail_worker.ts, public/textures/**.
Judge under V1's light once "light v1" lands on origin/s17-light (merge it into your branch then). Iterate on surface_probe,
ground_probe, blockface_probe, house_lab. Done line: walls, ground, roofs and stone at 2 m and 20 m read as photographed
surfaces in probe frames; no tiling visible at 20-80 m; first pass pushed by ~hour 3, second by ~hour 6.
