# s18 cloud C2: the town (D-660..D-674)

Branch cloud-s18-c2-town. Frames: crude cloud software frames (SwiftShader WebGL2, quality=test, 1280x720 at the player's
lens), in handoff/s18/c2_frames/: `_base` = d2ef51b (the session's start), `_after2` = 9522767b (D-660..D-662). The head's
frames (the plaster, D-668/669; the life objects, D-670) are rendering; they are added below when done.

## Broken, placeholder or unseen (read first)
- **The plastered town is unseen.** D-668 (the wash as a coat: 94.7 % of street faces plastered, was 0 %) and D-669 (the
  material's damp foot no longer pulls the lower half of every wall back to tan) have no frame yet; every frame below still
  shows the tan walls. The T4 must confirm the colour reads in noon sun.
- **The first frame is still an empty field.** The lower-city belt (D-661) has to stay outside the people's nav grid box
  round the Terrace (e −620…262, n −245…185: the nav grid holds no town walls, so houses inside it would be walked through),
  so from the stair top the belt is a line on the horizon 450 m+ out (c2-approach-high). Bringing the town to the Terrace's
  foot needs tools/build_nav.ts to take the town's colliders (asked of the lead), then the belt can move in.
- **The nav grid holds none of the new doors** (the B580 cut corners, the belt): people do not route into those houses
  until it is rebuilt (asked).
- **The neighbourhood shrine is not built** (C12 row 19): src/world/settlement/precinct.ts is locked by
  tests/religion.test.ts:47 (not mine); the household niches are in (D-670).
- **Fewer, busier market squares** (C12 4-12) not done; the seasonal goods are (D-670).
- **The kit's repair patches and rain rills** stay as drawn (D-660 feathered them); whether the T4's black streaks
  (cov-037) are those, the material's streaks (halved, D-667) or something else is unseen.
- **Cost:** the town plan builds in ~37 s in node (19 s at the start; baked in the browser, live in tests and the bake);
  plots 1,505 → 2,016.
- **tests/population.test.ts was not seen to pass after the belt**: it ran past its 50-min timeout twice on this loaded 4-core box (a render alongside); CI (C7) must run it. The belt changes which houses households take (the nearest of their zone), not their number.
- **Vagon's Poly Haven props** (s18-face-assets) not converted: the lane and court fill draws the project's own modelled props (m_*.glb), which already hold hand-made stools, brooms, ladders and baskets; the scan-prop system already holds the wicker baskets, the bowl and the crate; the buckets (coopered, iron-hooped) read modern. Plaster001 is taken (D-674).

## What a player now meets (measured, node)
- **Roofs** (D-660, D-662): the town was never roofless (a ray down every house room: the far level roofs 92 % of 6,878
  rooms, the near levels ~97 %); it read as open boxes because the roofs were the walls' tone inside 0.22-0.62 m parapets.
  Now a straw-and-clay coat on every roof, a lip of 0.05-0.39 m, the roofs' jars, mats, fleeces and dung cakes on the far
  level too (c2-town20_after2: roofs read as roofs with their things on them).
- **The lanes' things above ground** (D-660, D-662): the lane's earth is drawn 10 cm over the terrain while the fill stood on
  the terrain: 1,250 of 1,273 litter pieces and 709 mats wholly under it, every other item 10 cm sunk; now the town's fill
  is lifted onto it: 0 buried (c2-lanefeet_after2: dung cakes, cloth, broom, jars, sacks at the wall foot).
- **Street doors drawn again** (D-660: no leaf had been drawn since s15, the draw sat inside a comment), 40 % painted.
- **Every house entered** (D-660, D-666): shut houses 6 → 0, lane cells reached 100 %, plot cells 99.83 %.
- **The lower-city belt** (D-661, D-666): five quarters (q_b1, q_b3, q_b4 beside the road south, q_b5, q_b6 along the road
  west), 2,016 plots, all reached, settlement.test 11/11.
- **The town plastered** (D-668, D-669): every walled plot washed (lime white, cream, warm ochre, pink, red ochre by
  standing; estates and compounds gypsum-white), the court faces full and the street faces 0.84-0.95; a painted dado and
  framed windows on the better houses; painted doors; the mud at the worn foot only. Unseen.
- **Houses lived in** (D-664, D-665, D-670): a hearth in 1,711 of 1,931 houses (1,259 indoors), a quern in 1,889, an oven
  (own or a neighbour's) in 1,929; interiors/ring.ts houseWorkObjects(plotId) for the people; a house being built in q_b1
  (q_b1-0015); summer bedding and harvest fruit on the roofs, an ash heap and a latrine screen in every court, a niche lamp
  and offering in every living room, seasonal stall goods, washing in the courts not across the lanes.
- **The paradise garden** (D-666, D-671): raised beds under every tree, an understorey, stone-edged walks, an inlet and sluice.
- **Neighbourhood shrines** (D-672): one walled shrine court per quarter (15), offering table, bowls, figurines, a lamp lit at night.
- **Dawn view census** (D-672): at C6's intro-town camera no ray reaches a room's floor: every room roofed; the dark holes are the courts' inner faces (washed full now, D-668).
- **Walls** (D-673, D-674): the footing's ledge toned so it no longer floats; the plaster's grain a lime-plaster scan (ambientCG Plaster001, CC0).
- **Budgets:** settlement_build 5/5 (meshes 45, was 51 at the start; 1.04 M triangles ≤ 1.2 M), houses 9/9 (far level
  < 800 k), the village P22 frame inside 2.0 M (no halos in villages).

## Frames (crude, cloud)
| view | camera (e, n, eye, az true, pitch; day 0 10 h) | base (d2ef51b) | after (9522767b) |
|---|---|---|---|
| town from 20 m | -478,-870,20,189,-28 | c2-town20_base.jpg | c2-town20_after2.jpg: roofs read, things on them |
| town from afar | -320,862,20,135,-11 | c2-townfar_base.jpg | c2-townfar_after2.jpg |
| a lane | -478,-881,1.6,189,-4 | c2-lane_base.jpg: empty | c2-lane_after2.jpg: people, jars, sacks, baskets |
| a lane at the feet | -478,-881,1.6,189,-25 | c2-lanefeet_base.jpg | c2-lanefeet_after2.jpg: the fill at the wall foot |
| the approach from the stair top | -70,60,25,251,-9 | c2-approach-high_base.jpg | c2-approach-high_after2.jpg: still empty (see above) |
