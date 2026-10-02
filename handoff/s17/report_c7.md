# C7 interiors everywhere: report (s17, cloud; D-610)

**Broken, placeholder or unseen first**
- Unseen in the real renderer: the furnished rooms were judged only in a crude cut-away probe (tools/dev/interior_probe.*, headless
  WebGL on SwiftShader, flat light, no roofs). The six interior views are asked of Vagon (handoff/s17/asks_vagon.md, C7 lines).
  The rooms are dark until V6's interior light lands; judge the composition.
- The rooms are furnished only within 22 m of the eye (interiors/ring.ts, <= 60 k triangles, two draw calls). Beyond it a room
  is empty; seen only through a doorway, this should not show, but a long view down a court into a far doorway could.
- Carpets and woven mats in the houses are vertex-coloured grids (a pattern in the palace carpets' scheme), not the palace
  carpet's pile texture. Textiles are flat vertex colours (the household's palette), no weave map.
- Palaces (now in the census): in residence 37-79 things a hall; with the court away the Hadish and harem halls keep a keeper's
  corner and their stores (15-25 things); the Apadana stands empty and the Tachara hall keeps only its steward's corner (the
  earlier decision, tests/palace_furnish.test.ts); the Tachara's small side rooms stay thin while stored (7 of 10 under 8 things).
- Workrooms of one craft standing side by side still share their set of things 4 % of the time; ridge tents 16 % (the same set,
  never the same layout).

**What a player now sees differently**
Every room of every town and village house, the Terrace's ranges and the court's standing tents is furnished for who lives
there: the poor sparse, the rich full; mats, carpets, fleeces; bedding rolled, quilts piled, cushions, chests, low tables,
stools; jars, sacks, bins; querns, troughs, pots; onions and herbs hung from the poles, clothes on pegs; looms, spinning,
cradles, toys, tools in the corners; the smith's anvil and bellows, the potter's turntable; a guard's kit at each sleeping mat,
the squad's spears and shields; the Treasury's goods on its benches. Nothing in a doorway; a body can cross every room.

**Census** (tools/dev/interior_census.ts, 23 008 rooms; --baseline = houses.ts before): bare rooms 66.9 % -> 1.1 %, things
per room 4.6 -> 10.8 (a living room: 10.5 for the poorest households, 17.3 for the richest), same set as a neighbour within 15 m 57 % -> 1.6 %, same set and layout 19.7 % -> 0.0 %, things in a
doorway's sweep 1604 -> 0, rooms a body cannot cross 1.9 % -> 0 %. Houses' worst near tile 59.9 k -> 49.2 k triangles.

**Files**: src/world/interiors/** (plan, household, town, terrace, tents, draw, ring, census), furnish.ts (1 call),
furnish_palaces.ts (keepers' corners), tools/blender/interior_props.{py,mjs} + 6 m_i_*.glb, tools/dev/interior_census.ts,
interior_probe.*, tests/interiors.test.ts. Hooks in others' files (one call each): settlement/houses.ts (registerHouses;
furnish() returns early), settlement/build.ts (the ring's group; its update in nearUpdate), world.ts (setInteriorPeople),
courtCamps.ts (registerTentInteriors).

**Tests**: tests/interiors.test.ts 6/6 (incl. the walking grid: the ring adds no solid to a site; 0 of 1381 Terrace sleeping and
working places under a thing); tests/palace_furnish.test.ts 10/10; tests/houses.test.ts 9/9 (worst tile 49.2 k); guards pass. tests/scribes_room.test.ts: 2 of 4
fail here (the Aramaic secretary's year plan, 'ws:1' vs 'treasury_desk'), sim assertions my files do not touch (furnish.ts only gained
one import); the comparison run on the pre-C7 base was lost to a container restart, so not proven pre-existing.
**For C4**: the ring adds two draw calls (interiors:clay, interiors:cloth) and up to 60 k triangles near houses; the houses' near
tiles lost ~50 k in exchange.
