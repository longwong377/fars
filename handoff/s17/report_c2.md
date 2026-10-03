# C2 plain fill — report (s17, cloud, branch cloud-s17-c2-plain, D-560)

**Broken / placeholder / unseen first**
- SEEN ONLY CRUDELY: the cloud's WebGPU loses its device; the ground probe now takes `?webgl` (three's WebGL2 backend on
  SwiftShader), which gave crude frames: the track verge (worn tread, denser verge), the grass, and (22:07) the stooks
  standing on a cut barley plot in mid-June (166 field items drawn, no model missing). Not seen at all: the threshing floors,
  straw stacks, field-edge trees, the quarry path. On the T4: the only published frame (cov-000, the plain at a moonless
  01:26) shows the ground pitch black (night light, V1's, flagged by the lead), so nothing of the plain's fill can be judged
  from it. Views asked in asks_vagon.md (track verge in April, stooks in June, floor and straw in October).
- FOUND AND FIXED: the plain's grass tufts drew black flames (uncut alpha cards on a black atlas) in every render since s12.
- Residual copies: 155 of ~340,000 instances near the paths (0.05%) still have a twin within 20 m (a cell is checked against
  its neighbours' unturned items, so a turned neighbour can collide; cross-plot orchard chains); not zero.
- Draw calls: fieldFill is its own group beside the plain (the plain's <= 40-mesh gate was full: it broke the gate once its
  models loaded; now at most 16 meshes, 1-2 drawn in April, ~6 in the harvest weeks); outside the plain gate, not measured on
  the T4 (C4 / Vagon budget).
- Beyond ~35 m the plain is still the terrain shader's paint (fields, bunds); objects there are trees, folds, floors, stacks.

**What a player now sees differently**
- Roads and village tracks are worn: no grass, wheat or thistle stands on the tread; dung lies on it; a strip of sward runs
  between the ruts of the village tracks; the verges are the rankest ground (dense grasses standing dry after June,
  thistles, camelthorn, stones thrown to the edge). Before, tufts and young wheat grew on the tracks and one verge was bare
  for 88 m; now no bare verge run exceeds 2 m in any area, January to October.
- No copies: plants lean and vary in spread, stones in height, and any copy within 20 m is turned (variety.ts). Repeats near
  paths ~11,000 -> 155 (of ~340,000, with the denser verges). Fixed a real bug with it: orchard plots whose Voronoi seed lay in a neighbour drew the neighbour's
  trees twice on two grids (overlapping trunks) and stood empty themselves.
- Grass at the feet reads as grass (no black flames); the verges are a dense strip (6-10 tufts a 2 m cell, thistles and
  camelthorn from 24 candidates an 8 m cell).
- A worn quarrymen's path from the Majdabad quarry to a village track (4.1 km, routed round the slopes; C6's ask).
- Load (C4's boot profile): the orchard plots and town ground baked with the zones (~2.7 s on a cache hit), the leaf atlas
  assembled in a worker (~2 s off the main thread).
- Lone trees on the field bunds (~35/km2, by irrigation) break the crop sheet at mid distance.
- The farm year: sheaves in the rows and stooks on every cut cereal plot in its own harvest weeks (late May-July), threshing
  floors in use doy 150-250 (trodden sheaves, sledge, grain heaps growing), straw stacks to March, an ard at plots being
  ploughed, a thorn fold by every village.

**Census** (tools/dev/plain_census.ts, 146 km of paths within 14 km, 18 Apr): plain bare 2 m cells 3.4% -> 3.2%; verge bare
2.8% -> 0.0%; longest bare verge 88 m -> 2 m; fields 85.5% green crop (Apr), 72.9% stubble (Jul).

**Files**: src/world/plain/{verge,variety,fieldFill}.ts (new), groundCover.ts, crops.ts, trees.ts, townGround.ts, ribbons.ts,
index.ts; src/world/trees/{atlas_worker.ts (new), assets.ts}; src/world/groundFlora.ts, groundRocks.ts; tools/dev/plain_census.ts
(new), ground_probe.ts (?tracks&fill&webgl); tests/plain_fill.test.ts (new). The plain's sources changed: the world-cache bake
is stale until the next bake (the Pages build bakes).

**Tests** (final, on cloud-s17-int b9c44423 with Vagon's s17-int in it): plain_fill 10/10 and plain, landscape, ground_cover,
ground_flora, tree_assets, world_cache, scan_props, life_models, roses: 95/95; tsc clean for the touched files; guards 25/25.
