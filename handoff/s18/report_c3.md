# s18 C3 report: the river and the plain (D-670, branch cloud-s18-c3-plain)

## Broken, placeholder or unseen (first)
- **Everything here is unseen on the T4.** Judged only in crude SwiftShader WebGL2 frames (handoff/s18/c3_frames, before_ vs
  after_) and by node measurement. Check on the T4: the terrain shader's new field work (vigour, headlands, irrigation basins,
  drill rows, soil moisture) for compile time and frame cost; the wind's vertex cost on crops, reeds and trees.
- **A dotted line still crosses the near plain** in the 20 m town frames (after_encl, after_ask-c5-3). The plot bunds and
  district tracks are now drawn by pixel coverage (they were cut at a width in metres and aliased), and the after frames
  lost the straight seam in ask-c5-3, but a faint dotted line remains in encl (day 70) and a curved green dotted one near
  the town in ask-c5-3. Source unresolved (candidates: a bund on the boundary between a field plot and natural ground; the
  town ground's lush/path layer). Unseen on the T4.
- **The walled enclosure W/N of the town** (flat grey box) is settlement.json's `north_official_complex` (100 x 100 m), built by
  src/world/settlement/plan.ts: roofless from above like the town's houses (C2's roof fault). Unchanged by me.
- **Flora at 12-60 m draws black** (groundFlora lod1, after_plain-far). Likely the life models' KTX2 textures in the WebGL2
  path (a missing mip level reads black); not fixed.
- **The water** reads as a patchy blue/yellow sheet in the SwiftShader frames (waterShade ripples); the river course and banks
  are right, the surface look is unjudged.
- **Generated data changed:** public/generated/terrain_mid.u16, terrain_far.u16, rivers.json, horizon_map.* (tools/plain/
  meander.ts; re-run after tools/build_terrain.py or when roads/canals/villages change: it undoes and redoes itself, and
  re-blends the mid/far seam). C7's terrain-seam failure (ef9df75f) is fixed in a21ef81f.
- **Tests edited (C7's dir):** tests/plain.test.ts (the course test reads the base course and requires the meander belt; the
  banned-name list loses 'qanat'), tests/plain_fill.test.ts (the new land models; works and qanat tests).
- **Records outside my files:** src/data/blocklist.json (qanat entry removed), research/ANACHRONISM_BLOCKLIST.md, Q-052 in
  OPEN_QUESTIONS (qanats unblocked, D-207). settlement.json and lives.json still say "no qanats" in notes (not mine).
- Not done: millet (W19: needs a crop row); a ferry/bridge on the royal road's Kur crossing exists as the ford's boat
  (fordDetail.ts) but no bridge; the brickyard/works are unrendered.
- 7 of 37 canals (seed 1) are shortened where a bend reaches them; seeds outside the pool may see a bend near a village.

## What a player now meets (measured)
- **The river** meanders: the Pulvar x1.17 longer than its OSM chord line, bends >= 34 m radius, a belt <= 250 m off the
  OSM course; the old straight trench filled, the new channel carved under the bed everywhere. Point bars (gentle, gravel and
  sand) inside the bends, steep raised cut banks outside, slopes and bank tops varying along every reach, calm at fords;
  the water's edge follows each side's slope. Reeds in clumps with gaps on the margins (no fence), few on bars and cut banks;
  bank trees back of the bars. Villages identical (all 37, seed 1); canals keep their routes, heads joined to the water.
- **Fields:** a hue per plot, greyer olive greens, patchy vigour, drill rows near, a ragged weedy headland on every plot at any
  distance, irrigation basins with ridges and their own wetness; soil dark and damp in spring, pale dust in late summer.
- **The plain at 0.3-2 km and beyond:** field-edge trees and a new fallow scrub stand to the horizon within 8 km (static far
  set; they ended at the 900 m mid ring); crop guards' reed shelters and herders' wattle pens with huts to 2.2 km; village
  floors, stacks, heaps and folds to 2.2 km; 45 qanat lines (~2,300 shaft mounds, tier C) on the hill-foot fans.
- **The works** (C1's facilities) built: brickyard with ~600 brick moulds drying, mixing pits, stacks, straw; a drying field at
  the Terrace's N foot (94,279); walled stockyard, tannery, press house, mill, bakery-brewery; clay pit. 55 work spots for
  C1 (worksLayout(plan).spots).
- **Wind:** one wind for every plant (lean downwind, gusts travelling across fields and reed beds, flutter): crops, reeds,
  bank grass, near trees, ground cover (flutter only). Impostors stay still.
- **Names:** Pulvar = the Medos, Kur = the Araxes (Strabo 15.3.6) in plain.json; the second Naqsh-e Rustam tomb "being cut,
  later attributed to Xerxes".
- **Budgets:** plain meshes 40 (<= 40); the village-well frames under 2 M again after the merge's +80 k door leaves (the fords'
  shared stone mesh cast its 361 k shadow triangles in every frame: the castShadow line sat inside a comment; river apron in
  two steps; canal banks at 25 m). Tree day re-bake moved to the worker (C1's 1.7 s frame). Census (plain_census, 18 Apr):
  bare 3.0 %, repeats 0.0 % (as s17); field trees near paths 25 -> 77. terrain, terrain_walk, horizon, plain, plain_look,
  plain_fill, crossings, villages, trees, ground_cover tests green.
