# C6 far land (cloud, s17) — report (D-600; B630)

**Broken, placeholder or unseen first.** Nothing here is judged on the T4: no s17-renders frames exist yet (views asked in
asks_vagon.md). The SwiftShader/WebGL probe (ground_probe) shows the new shaders compile and the hills draw; the per-pixel
ring normals' gain is subtle in that probe's back light and needs a side-lit T4 frame. Past ~1 km the hills' surface is still
the terrain shader alone (terrainPlain.ts, C2's). B630: the world's end (±71.7 km) is in the skyline from the 70 km-out
coverage points (up to 18 px); within 10 km of the Terrace < 1 px. The far Terrace (B175) is in place (D-361; far levels
switch under 1/4 px; tests/far_terrace 3/3); its look as "one mass" is unjudged, and it has NO sun shadow past 600 m (the cascades' maxFar,
sunShadows.ts, V1's): flat-lit from the plain; asked V1 for a static Terrace cascade (asks_vagon.md). The quarries are probe-checked only, and the
whole far ring under them is 80 m cells (no finer DEM in git). tests/plain passes 33/33 on the merged int (329bbbb1).

**What a player now sees differently**
- No terrain LOD pop: geomorphing (CDLOD) — before 32 of 2,873 level switches over 2 px (worst 2.5 px) along 515 coverage
  walks; after 0.00 px, triangles unchanged. Seams worst 1.58 px. (A stricter error bound also fixed it at +41 % triangles.)
- Far hills keep their gullies and ridges at every distance: each ring's full-res normal is read per pixel (was vertex normals
  ~19 px apart: "smooth dune"). +14.7 MB texture, ~0.2 s at the first frame (C4: load keeper, note it). `?ringnormals=0` A/B.
- Hill rock and ledges fade in the vertex shader (no 20-25 m rebuild steps): ledge relief faded out before the coarse switch
  (was ~8 px at 70 m), ledges sink at 1.6 km (was cut, ~3 px), rocks sink at their reach.
- Ground rock (outcrops, talus) on the slopes to 1 km (was 260 m), each to where it spans 4 px; levels switch where their
  measured gap spans 2 px (was 50/260 m: up to ~8 px). Mountain views 0.03-0.13 M tris (budget 0.25 M); tiles 10x cheaper.

- The quarries (assigned mid-day): were merged boxes, Sivand missing, Majdabad 1.45 km off its point. Now both at their points:
  a scanned-rock outcrop cut back in three 2 m benches with half-cut blocks in their channels, rubble spoil heaps in the fresh
  stone's colour, chips, blocks waiting, column drums (lying, one half-freed on its bench), the huts. Not done: the
  quarrymen's worn paths (C2's ground), the sledges (C3's hauls). Drums and rock sit in their own group beside the plain (its <= 40-mesh gate passes with C2 3bff516c). Hauls and quarrymen tests pass; village frame budget kept.

**Files:** src/terrain/terrainMesh.ts, src/world/hills/bedrock.ts, ledges.ts; tools/dev/far_pop.ts, far_skyline.ts,
rock_lod_gap.mjs; src/world/plain/quarries.ts (+ one call in plain/index.ts); tests/terrain_morph.test.ts, tests/hills.test.ts; bench-reports/far-pop*.txt; DECISIONS D-600; B630.

**Tests:** terrain_morph, terrain_lod_quality, terrain, terrain_walk, hills, horizon, horizonmap: 49/49; guards 25/25; tsc clean
for the touched files.
