# C1 town fill (cloud) — report (D-550; branch cloud-s17-c1-town)

## Broken, placeholder or unseen first
- **Seen only crudely:** two SwiftShader/WebGL frames from the house probe (tools/dev/house_lab ?fill&webgl, SWIFT=1): a lane
  with the tethered donkey head-down by a door, a leaned tool, fuel, a sack; the wide lane then read sparse (fixed: things every
  ~3.8 m). No GPU frame yet: s17-renders absent at last fetch. Four views asked in handoff/s17/asks_vagon.md.
- **Placeholder-ish:** lane litter is modelled (fill_litter) but reads in the preview as a flat chaff patch with few visible
  straws; the goatskin bag is a simple metaball form; the washing line on roofs reuses the lane line (its wall pegs float at
  the ends). Tethered animals use the working animals' rig as is (their looks are Vagon's).
- **Cost:** the fill's draws at a lane point rose 51 -> ~96 mean (max ~122), instanced triangles 56 k -> ~143 k (roof things
  to 120 m included; 0 parts dropped at the instance caps); +3 draws for the 6 door-leaf meshes;
  no draw-count gate exists — C4/Vagon's budget run decides. The house tiles' triangle gate is untouched (worst tile 59.9 k,
  q_s3 589 k, as before), because the roof things are instanced fill, not house batches.
- **Partly done:** house variety: street doors in 6 forms (3 new kit leaves); no other new house kit pieces (walls, parapets and
  plaster are V2's). The sellers' spreads sit near the sim's market points, not at popgeo's exact per-household stall cells (that needs a public
  popgeo hook: V3's file).
- Pre-existing test failures (fail on the base commit too): court_fill (2), crafts (1), people_children (1).

## What a player now sees differently
- Every lane wall has something at its foot every few metres: jars, pots, basins, stools, rolled and leaned reed mats, tall
  baskets, winnowing trays, tools leaned on the wall (hoe, broom, fork, staff), dung cakes drying, fuel, repair mud and bricks;
  the open middle of wide lanes carries straw, droppings, sherds, ash dumps. No two identical things within 15 m.
- Street doors: tools leaned beside them, stools, goatskins on pegs, reed-mat shades on poles (55 % of house awnings), and the
  household's donkey (or goats) tethered by the door by day; in the court at night (682 court tethers, 256 lane pegs).
- Every court has >= 3 things, every roof something in every season; roofs now also hold jars, dung cakes or washed wool
  drying on mats, washing lines (4252 roof things).
- Doors differ along a lane (six leaf forms: ledged outside, a replaced pale plank, six narrow planks ...); a third of the
  stalls are the poorer reed-mat kind; things knee-high and over cast shadows near; straw and droppings by each tethered donkey.
- Markets: all 7 sim market grounds have stalls and spreads (the main exchange was 195 m from any stall); the goods are
  fullest in the morning and sell out through the afternoon.
- Roofs from the sim: a leaking roof (roofOf < 0.45) shows dark slumped plaster and a drip jar under it; a fresh coat shows pale.

## Census (tools/dev/fill_census.ts; tests/fill_census.test.ts)
| | before | after |
|---|---|---|
| lane cells with nothing within 3 m | 20.1 % | 0.0 % (6 of 51 725) |
| longest bare lane run | 147 m | 1 m |
| fill things (town) | 4 622 | 12 749 + 4 252 on roofs |
| courts with >= 3 things | 1340 / 1447 (fixtures only) | 1447 / 1447 (fixtures + fittings) |
| roofs with something | 1336 / 1447 | 1447 / 1447 (mean 2.8) |
| identical same-model pairs within 15 m | 230 | 0 |

## Hooks in files I do not own (smallest possible)
- src/world/world.ts: import TownTethers/RoofWear; `new TownTethers(...)` + `tap(tethers.animals)` + `tethers.update(...)`
  beside fauna; `settlement.roofWear.setSource(RoofWear.source(sim.pop.households, sim.deeds.joint.roofOf, day))` after the
  sim; `townFill(..., quarters' points)`; `settlement.roofFill()` appended to WorldFill's items.
- tests/houses.test.ts: the roof-kind exemption reads ROOF_FIX (adds the 3 new roof kinds; no threshold changed).
- tools/dev/house_lab.ts/.mjs: `?fill`, `?webgl`, `SWIFT=1` for probing (dev only).

## Files touched
src/world/fillPlan.ts, fill.ts, settlement/{houseplan,houses,build,tethers (new),roofwear (new)}.ts, world.ts (hooks);
tools/blender/fill_props.py/.mjs (7 new props), public/models/props/m_fill_{litter,matlean,basket_tall,winnow,reed_awning,skin,stall_reed}.glb,
tools/blender/housekit.py (leaf3-5, HOUSEKIT_ONLY) + src/data/housekit.json, src/world/settlement/towndoors.ts
+ manifest; tools/dev/fill_census.ts (new); tests/fill_census.test.ts, roofwear.test.ts (new), houses.test.ts; ASSET_LEDGER,
DECISIONS (D-550), handoff/s17/asks_vagon.md.

## Tests run
fill 6/6, fill_census 3/3, roofwear 2/2, houses 9/9, houselod, model_props, settlement, fauna, visitor_access, world_cache
green; guards 25/25; lint:chrono OK; tsc clean on touched files.
