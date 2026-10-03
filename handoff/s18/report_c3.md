# s18 C3 report: the river and the plain (D-670, branch cloud-s18-c3-plain)

## Broken, placeholder or unseen (first)
- **Unseen on the T4.** Every look change here was judged only in crude SwiftShader WebGL2 frames (before/after below) and by
  node measurement. The field shader additions (vigour, headlands, basins, rows) add noise and fwidth work to the terrain
  material: check its compile time and frame cost on the T4 (budget run).
- **The walled enclosure W of the town (flat grey box)** is settlement.json's `north_official_complex` (100 x 100 m, GONDET2018,
  built by src/world/settlement/plan.ts ringCompound): it draws roofless/flat from above like the town's houses. Not plain
  code: it is C2's roof fault (asked).
- **The dark dotted seam** across the near plain was the terrain shader's plot bunds and district-edge tracks (terrainPlain.ts):
  cut at a fixed width in metres, they aliased into dotted lines once under a pixel wide (seen plainly in the before frame
  `encl`). Now drawn by pixel coverage. Fixed after the after-render started: the after frames still show it (unverified).
- **Flora cards at 12-60 m draw black** in the SwiftShader frames (groundFlora lod1: camelthorn, thistle). Same as s17's report;
  could be the WebGL2 path's texture or the models' far level. Not fixed (unseen on the T4).
- **Generated data changed:** public/generated/terrain_mid.u16, terrain_far.u16 and rivers.json (tools/plain/meander.ts). If
  tools/build_terrain.py is ever re-run, run `npx tsx tools/plain/meander.ts` after it. The baked world caches key on the plain
  sources, so they re-bake.
- **Tests edited outside my files:** tests/plain.test.ts (the course test reads the base course; the river must meander in a
  250 m belt) and tests/plain_fill.test.ts (the two new land models registered; spring counts exclude them). C7 owns tests/.
- 7 of 37 canals (seed 1) are shortened where a bend reaches them (none lost); the Kur meanders little (x1.04), hemmed by
  canals. Seeds outside the pool may see a bend near a village (the meander avoids the 8 pool seeds' villages only).

## What a player now meets (measured)
- The Pulvar meanders: length x1.17 over the base course, bends of radius >= 34 m, never > 250 m off the OSM line; the old
  straight trench filled, the new channel carved under the bed everywhere (plain.test). Banks: point bars (gravel/sand, gentle)
  on inner bends, raised steep cut banks outside, slopes and tops varying along every reach, calm at fords.
- Reeds: clumps with gaps, own heights, on the margins, few on bars and cut banks. Bank trees back of the bars.
- Fields: plot hues, patchy vigour, headlands at any distance, irrigation basins, drill rows near.
- Standing on the plain: field-edge trees + fallow scrub within 8 km now drawn to the horizon (~19k in the static far set;
  were cut at the 900 m mid ring); crop guards' reed shelters and herders' pens with huts to 2.2 km; village floors, stacks and
  folds to 2.2 km.
- Budgets: plain meshes 40 (<= 40), worst static triangles under 2 M; river banks 266k -> 192k tris; every plain/village/
  crossing/tree/fill test green. Census (plain_census, 18 Apr): bare 3.0 % and repeats 0.0 % (as s17), field trees near paths
  25 -> 77. Villages identical (seed 1, all 37).

## Frames
Before/after crude frames: see the lead message (renders on this branch: handoff/s18/c3_frames/).
