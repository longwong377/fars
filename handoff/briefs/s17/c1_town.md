# C1 town fill (cloud) — branch cloud-s17-c1-town; D-550, Q-1480..Q-1489, B580..B589
Read handoff/briefs/s17/cloud_common.md first.
**The player sees by tonight:** no empty lane, bare roof or blank court in the town. Every lane, court, threshold and flat roof
dressed as a lived-in place of 467 BCE: jars and storage pots, baskets, reed mats, firewood and dung-cake stacks, drying
laundry and fleeces, querns, tools leaned at doors, tethered goats and donkeys (placement; their looks are Vagon's), awnings,
straw and litter in the lanes, worn thresholds; house variety from the kit (not the same house twice in view). The market's
stalls full in the mornings (places `market:<q>:<hid>`); leaking roofs (`sim.deeds.joint.roofOf('h:<id>', day) < 0.45`)
shown as slumped dark plaster and a drip jar, fresh pale plaster after a repair (handoff/briefs/s16/deeds_render.md).
**Owns:** src/world/settlement/** except surfaces.ts (V2's), src/world/fill.ts, fillPlan.ts, furnish.ts, roadLitter.ts,
tools/blender/housekit*, fill_props*; new files in those areas.
**Start at:** src/world/settlement/build.ts, houses.ts, quarter.ts; src/world/fill.ts + fillPlan.ts; tools/blender/fill_props.py
and housekit.py (kit pieces: new variants as scripts, built with the bpy shim). Write a census tool first
(tools/dev/fill_census.ts: per lane / court / roof, props per 10 m², the longest bare stretch, identical props within 15 m) and
measure the baseline; that is your number. Culturally shaped props only from the period kit (no pack pot or barrel; no
iron-banded barrels, glass, fired-brick house walls: research/ANACHRONISM_BLOCKLIST.md).
**Done:** the census shows no lane stretch > 6 m bare, every court and roof dressed, no identical prop within 15 m in view;
draw calls and triangles per town view within the budget (instancing; ask C4 for the number); the Vagon train's town views
read as lived in.
