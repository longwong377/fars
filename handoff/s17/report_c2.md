# C2 plain fill — report (s17, cloud, branch cloud-s17-c2-plain, D-560)

**Broken / placeholder / unseen first**
- SEEN ONLY CRUDELY: the cloud's WebGPU loses its device; the ground probe now takes `?webgl` (three's WebGL2 backend on
  SwiftShader), which gave crude frames: the track verge (worn tread, denser verge), the grass, and (22:07) the stooks
  standing on a cut barley plot in mid-June (166 field items drawn, no model missing). Not seen at all: the threshing floors,
  straw stacks, field-edge trees, anything on the T4. Views asked in asks_vagon.md.
- FOUND AND FIXED: the plain's grass tufts drew black flames (uncut alpha cards on a black atlas) in every render since s12.
- Residual copies: 67 of ~260,000 instances near the paths still have a twin within 20 m (cross-plot orchard chains, cells
  whose own bump collides); not zero.
- Draw calls: fieldFill adds up to ~27 instanced draws in the harvest weeks (3 models x 3 parts x 3 levels); not measured on
  the T4 (C4 / Vagon budget).
- Beyond ~35 m the plain is still the terrain shader's paint (fields, bunds); objects there are trees, folds, floors, stacks.

**What a player now sees differently**
- Roads and village tracks are worn: no grass, wheat or thistle stands on the tread; dung lies on it; a strip of sward runs
  between the ruts of the village tracks; the verges are the rankest ground (dense grasses standing dry after June,
  thistles, camelthorn, stones thrown to the edge). Before, tufts and young wheat grew on the tracks and one verge was bare
  for 88 m; now no bare verge run exceeds 2 m in any area, January to October.
- No copies: plants lean and vary in spread, stones in height, and any copy within 20 m is turned (variety.ts). Repeats near
  paths ~11,000 -> 67. Fixed a real bug with it: orchard plots whose Voronoi seed lay in a neighbour drew the neighbour's
  trees twice on two grids (overlapping trunks) and stood empty themselves.
- Grass at the feet reads as grass (no black flames); the verges are a dense strip (6-10 tufts a 2 m cell).
- Lone trees on the field bunds (~35/km2, by irrigation) break the crop sheet at mid distance.
- The farm year: sheaves in the rows and stooks on every cut cereal plot in its own harvest weeks (late May-July), threshing
  floors in use doy 150-250 (trodden sheaves, sledge, grain heaps growing), straw stacks to March, an ard at plots being
  ploughed, a thorn fold by every village.

**Census** (tools/dev/plain_census.ts, 146 km of paths within 14 km, 18 Apr): plain bare 2 m cells 3.4% -> 3.2%; verge bare
2.8% -> 0.0%; longest bare verge 88 m -> 2 m; fields 85.5% green crop (Apr), 72.9% stubble (Jul).

**Files**: src/world/plain/{verge,variety,fieldFill}.ts (new), groundCover.ts, crops.ts, trees.ts, townGround.ts, index.ts;
src/world/groundFlora.ts, groundRocks.ts; tools/dev/plain_census.ts (new), ground_probe.ts; tests/plain_fill.test.ts (new).

**Tests**: plain_fill 7/7, ground_flora, ground_cover, scan_props, life_models, roses, plain, landscape: all pass (60+);
tsc clean for touched files; guards 25/25.
