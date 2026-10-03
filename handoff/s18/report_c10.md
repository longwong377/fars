# s18 C10 report: the Terrace at 100-300 m (D-750, branch cloud-s18-c10-terrace)

## Broken, placeholder or unseen (first)
- **Unseen on the T4.** Every frame here is the cloud's software renderer (SwiftShader WebGL2, Q=test, 1280x720): crude
  light, the Terrace's retaining walls draw black (a known cloud-renderer fault, lit on the T4). Nothing here proves the look.
- **The tower windows are unseen** (dressings.ts `towerWindows`, 52 blind windows on the Apadana towers): committed after
  the last render. Node-tested only.
- **Triangles: +0.3-0.8 M per view, +27-41 draws** (table below). The merlons are the bulk (~2,900 at 204 tris each, the
  Blender merlon's far level, shared geometry and material: no new shader). The counts are upper bounds (the far levels
  arrive from a worker after the 3-frame test renders), but on the Terrace itself the merlons are within 150 m and draw at
  full detail. If the T4 budget run shows a frame-time cost: drop CROWN_SCALE pitch density, or give the roof merlons a
  simplified base (the far level 1 index) - both one-line changes in decor.ts / roofedge.ts.
- **The banners are static** (no wind shader: they droop downwind in a fixed pose). Cloth that does not move at 20 m may read
  as sheet metal on the T4; a vertex-wave in the textile material is the fix (not mine: materials.ts).
- **Not done (outside my files, asks below):** people and guards on the Terrace, trees in planters, carts, scaffolding at the
  Tripylon (built 0.5) and wall-face plaster/colour variation at distance (materials.ts). The Hall of 100 Columns is absent
  from the parts in 467 (not crowned or hung).
- Camera points: "town300" (-320,-30) is open field, not the town (the town's nearest lane, cov-097 at 600 m, sees no Terrace
  over its walls); "terracetop" (20,60) stood inside the Apadana N stair: its frame is unusable (only its counts are used);
  plain1k (-1000,-20) stood inside a house (run 1).

## What a player now meets (measured, crude frames in handoff/s18/c10/, top = before, bottom = after, same page)
- From the stair foot (~80-250 m, stairfoot.jpg, stairfoot-zoom-apadana.jpg): the Gate and the Apadana crowned with stepped
  merlons, the glazed rosette band under the Gate's roof line, purple-red standards over the Gate's corners and the Apadana
  towers, and the Apadana west portico hung with white/green/blue curtains and valances; the Terrace's edge parapet
  crenellated end to end.
- From the west field (~350 m, town350-run1.jpg, run 1: merlons and bands only): the roof lines serrated.
- From the Rahmat slope (~350 m above, rahmat.jpg, rahmat-zoom.jpg): every palace roof crowned, the Apadana east portico's
  hangings, the standards.
- From the approach (~700 m) and the plain (~930 m): a fine crest and specks of flags; little changes at that range.

| view (cloud, Q=test) | triangles before -> after | draws |
|---|---|---|
| stair foot | 11.83 -> 12.48 M | 560 -> 599 |
| approach 700 m | 7.80 -> 8.15 M | 538 -> 565 |
| plain 930 m | 11.09 -> 11.37 M | 623 -> 650 |
| Rahmat 350 m | 14.99 -> 15.40 M | 668 -> 698 |
| on the Terrace (Apadana N stair) | 14.88 -> 15.70 M | 680 -> 721 |

## What changed (src/arch only; render geometry, no part, collider, grid or plan changed)
- roofedge.ts: `crowns` (merlons on every crowned roof line: not fortification/garrison/Treasury), `bands` (palace wall runs
  under the string course), `porches` (portico fronts); results cached per parts array.
- decor.ts: `crownPlan` (+ the Terrace edge parapet, deduplicated), instanced in 128 m chunks under the stair merlons' mesh
  (so world.ts needed no change), MerlonNear per chunk.
- glazed.ts: `palaceBandFaces` (1.62 m bands), and carries the dressings group (world.ts already adds the frieze mesh).
- dressings.ts (new): portico hangings (Esther 1:6), royal standards (Xenophon), Apadana tower blind windows.
- tests/terrace_dressing.test.ts (new). Passing: terrace_dressing, roofedge, crenellation, merlon_near, paint_glaze,
  samplers_d300.

## Asks (outside my files)
- Lead/world.ts: a proper line for `buildDressings(parts)` instead of riding under the glazed frieze (cosmetic).
- People owner: guards at the Gate and on the Apadana stairs' landings, and court traffic on the Terrace's open courts.
- Trees owner: planter trees (cypress, plane) along the Terrace's courts (TreeKit layer); I can export the planter places.
- Construction owner: scaffolding and ramps at the Tripylon (built 0.5).
- Materials owner: a wind wave for the textile material (banners, hangings).
