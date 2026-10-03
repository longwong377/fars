# s18 C10 report: the Terrace at 100-300 m, its polychromy, tower stairs and the drum road (D-750..D-754)

Branch cloud-s18-c10-terrace (origin/s17-int merged in). Frames: handoff/s18/c10/ (all from the cloud's software renderer).

## Broken, placeholder or unseen (first)
- **Nothing here is seen on the T4.** Every frame is SwiftShader WebGL2 at Q=test, or a probe page (parts and models only, no
  sky, no environment map: gilding reads dark there). Frame time, memory and the new pipelines' compile cost are unmeasured:
  the T4 budget run decides. New pipelines: ~5 (model_paint: protome x2, volute x2, the two colossi's levels), 2 surfaces
  (palace_plaster, frame_coat); the dressings and the road reuse compiled materials.
- **Triangles:** the merlons +0.27 to 0.81 M per view (D-750, measured); the dressings ~30 k, the road ~10 k, the tower stairs a
  few thousand boxes (merged).
- **Three Blender asset checks still fail** (tests/blender_assets): capital_protome and colossus_bull not --verify'd,
  colossus_lamassu's inputs hash changed. Their sources are the licensed sculpts on huggingface.co, which the cloud proxy refuses
  (403). Vagon: `node tools/blender/build.mjs --verify capital_protome colossus_bull` and `node tools/blender/build.mjs
  colossus_lamassu`. (The fourth, column_shaft_plaster's occlusion of exactly 1, is fixed in the test: a convex shaft is right.)
- **Paint not done:** the relief backgrounds (the façade stone round the figures) are bare stone; the ceilings are one plain
  red; the lamassu's wing bands and crown are crude position zones (C), and the protomes' eyes and collars are not painted.
- **The drum road ends at the drum ground:** traffic.ts's movers (C1) still stop there; the sledges, gangs and oxen on the road
  and the ramp are not animated. The ramp follows the heightfield's 4 m bank along the N edge (probably the ruin's debris, not
  467's ground): if C3 or the terrain owner lowers it, rebake drum_road_profile.json and the ramp's head height (DR.ramp.top).
- **Tower stairs:** walkable by the player (colliders); the people's walkable grid now reaches the tower tops and roofs (nav
  rebaked), but nobody is sent up. Unseen in a T4 frame: the hatch, the tower tops and the roofs.
- **Asks still open:** people on the Terrace, planter trees, scaffolding at the Tripylon, a wind wave for cloth, a world.ts line
  for the dressings and the drum road (they ride under the glazed frieze mesh).
- tests/court.test.ts "every sealed letter" timed out twice under load (re-run alone: see the lead message); "plans are well
  formed" fails on the base too.

## What a player now meets
- **From the stair, the town side and Rahmat (100-350 m), D-750:** stepped merlons on every palace roof line and the Terrace's
  edge, 1.62 m glazed bands, 12 royal standards, the porticoes hung with white, green, blue and purple, blind windows on the
  Apadana towers.
- **Everywhere on the Terrace, D-752:** the palaces painted inside and out (palace_plaster: red ochre dado with white and blue
  bands, a lime-ochre ground, a red frieze under the head), no fallen plaster; frames under their whitish coat; fresh pale stone
  (no lichen); painted cedar; the capitals' horns and the colossi gilded and painted; every relief figure painted (faces, hands,
  eyes and pupils, animals in their coats); the inscriptions' signs in blue. (paint-*.jpg)
- **Tower stairs, D-753:** a door from each Apadana portico into its corner tower, a stair round the inside to the top, a flight
  down onto the hall roof (walkable). (tower-stair-inside.jpg)
- **The drum road, D-754:** from the drum ground, 104 m of sledge road (ruts, bedded sleepers, kerbs; drums waiting, two sledges)
  to the N edge, and an earth ramp down to the court. (drum-road-ramp.jpg)
- **The cloud's eyes, D-751:** the black walls in every cloud frame since D-354 were BC7 scans SwiftShader's WebGL2 cannot upload;
  the KTX2 target now comes from the WebGL2 context under ?webgl=1. (black-walls-fix.jpg)

## Measured
| change | measure |
|---|---|
| merlons (D-750) | stair foot 11.83 -> 12.48 M tris, 560 -> 599 draws; approach 700 m +0.35 M; Rahmat +0.41 M; on the Terrace +0.81 M |
| relief triangle gate | 1.57 M (failing on the base) -> 1.39 M (cypress ERR_K 1.6) |
| relief paint atlas | 221 definitions repainted on the index's grid (0 refused), paint.ktx2 3.96 -> 4.99 MB |
| nav | 34.9 ha walkable (1,395,972 cells) |
| tests | 147 targeted pass after the merge (arch, people, probes, fire_occ, polychromy, reliefs, relief_atlas, samplers_d300, surfaces_s6, roofedge, terrace_dressing) |

## Files
src/arch: roofedge, decor, glazed, dressings, model_paint, tower_stairs, drum_road(+_path, _profile.json), terrace, meshes,
relief_figures, reliefs, arris_slabs, mudface, parts; src/render: materials, scans, grime, loaders (D-751); tools/blender:
relief_paint.ts, drum_road_profile.ts; tests changed: polychromy, surfaces_s6, roofedge, arch, paint_glaze, blender_assets;
new: terrace_dressing.
