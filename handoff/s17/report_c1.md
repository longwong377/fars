# C1 town fill (cloud) — final report (D-550; branch cloud-s17-c1-town)

## Broken, placeholder or unseen first
- **Unseen on the GPU.** No town frame exists yet: s17-renders holds one baseline frame (cov-000, the plain at night). My only
  pictures are crude SwiftShader/WebGL frames from the house probe (tools/dev/house_lab ?fill&webgl, SWIFT=1): a lane with the
  tethered donkey, a leaned tool, fuel and a sack. Four town views are asked in handoff/s17/asks_vagon.md (lane + tether, market
  at 8 h, reed-mat awning, litter). Everything below is measured by node censuses, not judged by eye.
- **First cloud frame (cloud eyes, ask-c1-1, 01:36, SwiftShader WebGL2 Q=test):** the lane, tethered donkey, washing line
  and leaned firewood read, but of the ~10 fill things the plan puts within 10 m of that camera (bolts, dung cakes, broom,
  litter, fodder, hoe, sack) only the firewood bundles show. Cause unknown: not drawn in that page, or sunk at terrain height
  where the nav calls the wall foot unwalkable (world.ts groundAt falls back to terrain.heightAt). The "floating pale strip" at
  the left wall foot is most likely the stone footing's top ledge over its face in shade, not a detached mesh (unverified).
- **B580 open: two houses nobody can enter**, q_s4-0074 and q_s4-0161 (pre-existing plan geometry: lane frontages pinched at
  both jambs). Three of five were reopened (clear-jamb doors, corners cut back to the lane, a door through the cut corner);
  measurements and the next steps in BLOCKERS.md.
- **Placeholder-ish:** the goatskin bag is a simple metaball form; roof washing lines reuse the lane line (its wall pegs float at
  the ends); wall-wear decals (soot, splash, fresh coat) use a plain transparent material V2 may swap; tethered animals use the
  rig's looks as they are (Vagon's).
- **Cost (C4: fine to land; no per-view gate in git):** the fill at a lane point ~96 draws mean / ~121 max, ~100-145 k instanced
  triangles (all seasons drawn); +3 draws for 6 door leaves, a few for the tether rig, 3 for the wall decals. House tiles: worst
  48.9 k of the 60 k gate. The baked fill JSON was trimmed (town 2.51 -> 1.54 MB; village walls sparser); the full unit with
  villages was not measured in node.
- **Approximate:** the sellers' spreads lie within 14-28 m of the sim's market points, not at popgeo's exact per-household stall
  cells (that needs a public popgeo hook: V3's file).
- **Failing on the merged tree, not mine:** model_props "palace furnishings" (furnish.ts, C7's: 462 773 >= 450 000), people_children
  and crafts (fail on the base too), fire_occ (the Terrace bake's stale parts hash).

## What a player now sees differently
- **Lanes:** a household thing every ~3.8 m along every wall (jars, pots, basins, stools, mats rolled and leaned, tall baskets,
  winnowing trays, tools leaned on walls, dung cakes drying, fuel, repair mud and bricks), litter in the open middle (straw,
  droppings, sherds, ash), no two identical within 15 m. About 1 spot in 3 changes with the year (sheaves and grain after the
  harvest, more fuel in the cold).
- **Doors:** six leaf forms (three new kit pieces), so no lane shows the same door twice in a row; reed-mat or cloth shades; tools,
  stools and goatskins beside them; smoke-blackened door heads and splashed feet by age, plaster and trade.
- **Animals:** 256 donkeys/goats tied at pegs by the doors by day (straw by the peg, droppings behind), 682 in the courts at night.
- **Houses:** no two neighbours with the same street face (66 pairs -> 0); height follows the household's standing (r 0.61).
- **Courts and roofs:** every court >= 3 things, every roof dressed in every season; 4252 roof things (jars, dung cakes or wool
  drying on mats, washing lines), drawn to 120 m.
- **From the sim:** leaking roofs dark and slumped with a drip jar in the room; a fresh pale coat on roof, door head and parapet
  after a replastering; all 7 sim market grounds dressed (stalls, reed stalls, sellers' mats), fullest in the morning.
- **Night:** 558 saucer lamps at street doors (the fire system lights them at dusk); washing, stools, drying wool taken in.
- **Reach:** no person or bot is placed where a body cannot walk from the plot's door (C9's pen fixed).

## Census (tools/dev/fill_census.ts, house_census.ts; tests/fill_census.test.ts)
| | before | after |
|---|---|---|
| lane cells with nothing within 3 m | 20.1 % | 0.0 % |
| longest bare lane run | 147 m | 1 m |
| courts with >= 3 things | 1340 / 1447 (fixtures only) | 1447 / 1447 (fixtures + fittings) |
| roofs with something | 1336 / 1447 | 1447 / 1447 (mean 2.8) |
| identical same-model pairs within 15 m | 230 | 0 |
| neighbouring houses with the same street face | 66 / 1463 | 0 |
| plots with spots unreachable from their door | (unmeasured; C9 found one) | 2 (B580) |

## Hooks in files I do not own
src/world/world.ts: TownTethers (construct, tap, update), RoofWear source after the sim, townFill's market points,
settlement.roofFill() into WorldFill, fill.update's day argument. tests/houses.test.ts: the roof-kind exemption reads ROOF_FIX.
tools/dev/house_lab.ts/.mjs: ?fill, ?webgl, SWIFT=1.

## Files touched
src/world/fillPlan.ts, fill.ts; src/world/settlement/{houseplan,houses,build,towndoors,site,access,walk}.ts and new
{tethers,roofwear,wallwear}.ts; tools/blender/fill_props.py/.mjs (7 new props), housekit.py (leaf3-5) + src/data/housekit.json;
public/models/props/m_fill_{litter,matlean,basket_tall,winnow,reed_awning,skin,stall_reed}.glb (force-added) + manifest;
src/data/town_plots.json (regenerated); tools/dev/fill_census.ts, house_census.ts; tests/fill_census.test.ts, roofwear.test.ts;
ASSET_LEDGER, DECISIONS (D-550), BLOCKERS (B580), handoff/s17/asks_vagon.md.

## Tests (merged tree, origin/cloud-s17-int at b9c44423)
fill, fill_census, roofwear, houses, houselod, settlement, visitor_access, fauna, door_sounds: 70/71 (the one failure is
model_props' palace furnishings, C7's); guards 25/25; lint:chrono OK; tsc clean on my files.
