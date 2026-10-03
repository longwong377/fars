# s18 C3 report: the river and the plain (D-670, branch cloud-s18-c3-plain)

## Broken, placeholder or unseen (first)
- **Unseen on the T4:** the terrain shader's field work (vigour, headlands, irrigation basins, drill rows, soil moisture,
  wandering bunds, earthwork relief, holdings at 0.3-2 km, steppe patches and Artemisia stands), the calmer river surface,
  the wind on crops/reeds/trees, the river works and shore models. Judged only in crude SwiftShader WebGL2 frames
  (handoff/s18/c3_frames) and by node tests; check compile time and frame cost on the T4.
- **The plain's static triangles sit at 1.99 M of 2 M** (plain.test): the merged Naqsh relief figures added ~0.5 M; I bought
  the margin back with coarser far river sections. The next addition to the plain group trips it.
- **Failing, not mine (fail on head without my last changes):** plain_d223 field share 0.397 < 0.4 (the town's growth: irrigated
  census px -4.1 k, town site and trodden +3.6 k; passes at the pre-C3 base), plain_d223 radial worn path (townGround),
  land_work planCheck and timber carts.
- **The walled enclosure W/N of the town** (flat grey box) is settlement.json's `north_official_complex` (C2's roofs); unchanged.
- **The water** was a patchwork of sky-blue and bank-brown blotches in riv-a (cloud frame); the long ripples are calmer now
  (2afe00cb), unrendered.
- **People in the far fields** depend on C1 reading plain.fieldWork (the API is there: 16 worked plots within 250 m of cov-096
  on its day; herders on the open range within 4.5 km of a village, e.g. cov-387).
- **Generated data changed:** public/generated/terrain_mid.u16, terrain_far.u16, rivers.json, horizon_map.* (tools/plain/
  meander.ts; re-run after tools/build_terrain.py or when roads/canals/villages change; it undoes and redoes itself).
- **Records outside my files:** src/data/blocklist.json (qanat), research/ANACHRONISM_BLOCKLIST.md, Q-052; tests/plain.test.ts,
  tests/plain_fill.test.ts, tests/ground_flora.test.ts edited.
- 7 of 37 canals (seed 1) are shortened where a bend reaches them.

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
- **Since the first report:** the dotted seam found and fixed (a bund the length of a straight plot edge: bunds now wander and
  come and go); real plant scans on the open ground (shrubs, bunch grasses, dead wood, spring flowers); the Kur bridge of boats
  riding the river's level, 127 shadufs, field ditches; the fishermen's shore (traps, skiffs, nets; 'fish'/'mend' spots);
  qanats; millet; holdings vary the far plain and the range before the Terrace is patchy; plain.fieldWork(e, n, r, day) for
  C1 (each plot's village, crop, stage and workers' spots; herders on the range); planted trees for C10 (trees/planted.ts).

