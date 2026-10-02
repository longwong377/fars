# C2 plain fill (cloud) — branch cloud-s17-c2-plain; D-560, Q-1490..Q-1499, B590..B599
Read handoff/briefs/s17/cloud_common.md first.
**The player sees by tonight:** the plain is farmed, grazed and travelled, never a blank field or naked roadside: fields by
season (the world opens 17 April: young green wheat and barley; straw and stubble from June; ploughing in autumn; season.ts
and plain/seasonal.ts set the tint, you set what stands there), field margins and bunds, orchards and vines, village yards,
threshing floors in season, irrigation channels with reeds and willows, roadside weeds, stones, ruts and dung, dense ground
cover near the walker that sits IN the ground.
**Owns:** src/world/plain/** except seasonal.ts (Vagon V5's), src/world/groundRocks.ts, groundFlora.ts, src/world/trees/**,
tools/blender/land_*. Ground SHADING (scans, materials, terrainDetail.ts) is Vagon V2's: you place, they surface.
**Start at:** src/world/plain/index.ts, fields.ts, groundCover.ts, villages.ts, villagehouses.ts, riparian.ts, trees.ts;
src/world/groundFlora.ts, groundRocks.ts. Write tools/dev/plain_census.ts first (per plain area of data/areas.json: share of
ground within 30 m of a path with no cover object, bare roadside length, repeated tree/rock instance within 20 m) and measure
the baseline. Nature assets: the archive's scans for surfaces; plants and rocks from the project's Blender land_* scripts and
src/world/trees kit (vary scale, rotation, tint, wear on every instance).
**Done:** the census: no bare stretch > 15 m along roads, every field reads as the season's crop, no repeated instance within
20 m; frame time and memory within budget (ask C4); the train's plain views read as farmed and lived in.
