# C6 far land (cloud, s17) — final report (D-600; B630)

**Broken, placeholder or unseen first.** Nothing of D-600 has been judged on the T4: the one published frame (baseline
cov-000, commit 5fc087ea) predates all of it; the views asked are in asks_vagon.md (lines "C6 | view"). The far Terrace has NO
sun shadow past 600 m (sunShadows.ts maxFar, V1's): flat-lit from the plain; the ask for a static Terrace cascade is at the top
of asks_vagon.md. Past ~1 km the hills' surface is the terrain shader alone (C2's terrainPlain.ts). Quarries probe-checked
only (SwiftShader), on the far ring's 80 m terrain (no finer DEM in git). B630: the world's end (±71.7 km) stands in the
skyline from the 70 km-out coverage points (up to 18 px); < 1 px within 10 km of the Terrace. Not done: the quarrymen's worn
paths (C2's ground), the sledges (C3's hauls).

**What a player now sees differently**
- No terrain LOD pop: geomorphing (CDLOD). Before 32 of 2,873 level switches over 2 px (worst 2.5 px) along 515 coverage walks
  (tools/dev/far_pop.ts); after 0.00 px, triangles unchanged; seams worst 1.58 px. Done line met for the terrain.
- Far hills keep their gullies and ridges at every distance and level: each ring's full-res normal per pixel (RG8 atlas,
  +14.7 MB, ~0.2 s at the first frame; `?ringnormals=0` A/B).
- Hill rock and ledges fade in the vertex shader (no rebuild steps); rock levels switch where their measured gap spans 2 px.
- Ground rock on the slopes to 1 km (was 260 m); tiles 10x cheaper; mountain views 0.03-0.13 M tris (budget 0.25 M).
- Quarries: both at their points (Sivand was missing, Majdabad 1.45 km off): scanned-rock outcrop, three cut benches with
  half-cut blocks, rubble spoil heaps, chips, column drums, waiting blocks, huts; drums/rock in their own group.
- Far Terrace (B175): far levels in place (D-361, < 1/4 px switches).

**Files:** src/terrain/terrainMesh.ts; src/world/hills/bedrock.ts, ledges.ts; src/world/plain/quarries.ts (+ two lines in
plain/index.ts); tools/dev/far_pop.ts, far_skyline.ts, rock_lod_gap.mjs; tests/terrain_morph.test.ts, hills.test.ts;
bench-reports/far-pop*.txt; DECISIONS D-600; BLOCKERS B630; asks_vagon.md.

**Tests (on cloud-s17-int with light v1, b9c44423):** terrain_morph, terrain_lod_quality, terrain, terrain_walk, hills, horizon,
horizonmap, far_terrace, plain: 85/85; guards 25/25; tsc clean for the touched files.
