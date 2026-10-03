# Page check (D-772): what the page draws vs what its simulation holds

Tree /home/user/fars-pc gitdir: /home/user/fars/.git/worktrees/fars-pc; built site (vite build, base /fars/), headless Chromium, ?test&norender&webgl=1&quality=test&court=seasonal; 2026-10-03T09:42:24.981Z.
Per view: objects effectively visible (every ancestor visible) and meeting the camera frustum, their instances and triangles;
hidden = present in the scene but visible=false somewhere up the chain. sim<60 m = population view + detailed agents within 60 m of the camera.

## Run 9 (C12, s17-int 82544b5c: C1 c83555ae out-of-doors day, C3 e6cac08b herders, C5 b4e90ff2; clock running; 2026-10-03 ~10:00 UTC)

**No flags.** Against run 8, out of doors within 60 m (on a lane / walking):

| view | run 8 | run 9 |
|---|---|---|
| lanes cov-142, d88 13:48 | 142 (2 / 0) | 140 (**23** / 0); 117 at home |
| town20 (same spot, eye 20 m) | 140 (0 / 0) | 138 (23 / 0) |
| court cov-037, d14 11:04 | 106 (41 / 0) | 105 (**57** / 0) |
| q_s1 lane, d0 10:00 | 204 (48 / 2) | 169 (42 / 2) |
| Terrace noon | 28 (- / 5) | 28 (- / 6) |
| Terrace court day | 82 (- / 4) | 81 (- / 4) |
| Apadana d200 (T1) | 121: hall 31, forecourt 88 | 90: hall 0, forecourt 88 |
| fields cov-096 / cov-387 | 1 / 0 within 250 m | 0 / 0 within 250 m |
| night town / night Terrace | 87 / 99 | 87 / 99 (forecourt 88: T1) |

What changed:
- **C1's out-of-doors day now shows: 23 people on the lane at 13:48** (was 2), and 57 on the court's lane (was 41).
- **Nobody walks in town at the sampled moments** (0 at every town view, with the clock running). The lanes fill with people
  standing or sitting, not passing.
- **The stale 'apadana_hall' people are gone; the stale forecourt_wait 88 stays** (T1) on days 200 and 5.
- **The real field views hold nobody within 250 m** (C3 herders and field work happen elsewhere).

## Flags

- none

Page errors (unique): 1
- 1x Failed to load resource: the server responded with a status of 404 (Not Found)

## town20: the town from 20 m up (roofs vs walls) (day 88, 13.805 h)

camera -871.9, -150.4, 4.4; sim people within 60 m: 138, within 250 m: 396; crowd stats: {"draws":2,"triangles":16843,"people":3,"byLod":[0,3,0,0],"shadowDraws":2,"shadowTriangles":1493,"propDraws":0,"props":0,"propTriangles":0,"propsDropped":0,"placeholderActs":0,"motionCapture":1,"motionAuthored":2,"things":{"draws":0,"instances":0,"triangles":0,"kinds":{},"dropped":0},"animals":{"dra

| class | meshes visible / hidden | instances in frustum | of them < 60 m | triangles in frustum |
|---|---|---|---|---|
| people (skinned, any LOD) | 4 / 46 | 2 | 2 | 5938 |
| people LOD3 (far) | 0 / 0 | 0 | 0 | 0 |
| people impostors | 1 / 0 | 1 | 0 | 2 |
| house roofs | 13 / 5 | 0 | 0 | 0 |
| house walls | 4 / 0 | 1 | 1 | 300 |
| ground fill / props | 112 / 227 | 4 | 0 | 28016 |
| trees | 22 / 0 | 16 | 0 | 181066 |
| crops / flora | 85 / 40 | 5 | 0 | 2034 |
| fires / lamps | 13 / 1 | 2349 | 0 | 4698 |
| water | 15 / 4 | 4 | 1 | 274970 |
| animals | 139 / 12 | 123 | 0 | 85132 |
| terrace architecture | 118 / 219 | 927 | 0 | 1690000 |

shadow-casting lights: [{"name":"","far":2000,"size":[240]}]

page: backend WebGL2, norender true, catch-up ticks 0 (still catching up: false), crowd looks pending 0

people in the frustum: within 40 m 1 of 60; within 60 m 1 of 138 (behind court walls for this eye: 0; to be drawn: 1)

| people mesh | visible / hidden meshes | instances (count) | in frustum | < 60 m |
|---|---|---|---|---|
| world / humans:persian:shadow | 0 / 1 | 1 | 0 | 0 |
| world / humans:persian:shadow-far | 0 / 1 | 1 | 0 | 0 |
| world / humans:persian:lod# | 0 / 4 | 4 | 0 | 0 |
| world / humans:median:shadow | 0 / 1 | 1 | 0 | 0 |
| world / humans:median:shadow-far | 0 / 1 | 1 | 0 | 0 |
| world / humans:median:lod# | 0 / 4 | 4 | 0 | 0 |
| world / humans:worker:shadow | 0 / 1 | 1 | 0 | 0 |
| world / humans:worker:shadow-far | 0 / 1 | 1 | 0 | 0 |
| world / humans:worker:lod# | 0 / 4 | 4 | 0 | 0 |
| world / humans:woman:shadow | 0 / 1 | 1 | 0 | 0 |
| world / humans:woman:shadow-far | 1 / 0 | 1 | 0 | 0 |
| world / humans:woman:lod# | 1 / 3 | 4 | 0 | 0 |
| world / humans:child:shadow | 0 / 1 | 1 | 0 | 0 |
| world / humans:child:shadow-far | 1 / 0 | 1 | 1 | 1 |
| world / humans:child:lod# | 1 / 3 | 4 | 1 | 1 |
| world / humans:envoy:shadow | 0 / 1 | 1 | 0 | 0 |
| world / humans:envoy:shadow-far | 0 / 1 | 1 | 0 | 0 |
| world / humans:envoy:lod# | 0 / 4 | 4 | 0 | 0 |
| world / humans:envoy_short:shadow | 0 / 1 | 1 | 0 | 0 |
| world / humans:envoy_short:shadow-far | 0 / 1 | 1 | 0 | 0 |
| world / humans:envoy_short:lod# | 0 / 4 | 4 | 0 | 0 |
| world / humans:envoy_bare:shadow | 0 / 1 | 1 | 0 | 0 |
| world / humans:envoy_bare:shadow-far | 0 / 1 | 1 | 0 | 0 |
| world / humans:envoy_bare:lod# | 0 / 4 | 4 | 0 | 0 |
| world / people:reins | 0 / 1 | 0 | 0 | 0 |
| world / people:hit | 0 / 1 | 1 | 0 | 0 |
| world / people:impostors | 1 / 0 | 1 | 1 | 0 |
| player-body / humans:median:lod# | 0 / 2 | 2 | 0 | 0 |

people: sim out of doors within 60 m 138 (open ground 41, inside walled courts 97, walking 0; places {"h":115,"lane":23}; 250 m 396); crowd attached 399, skinned drawn 3 by LOD [0,3,0,0], impostors drawn 48 of 481 candidates

town roofs (150 m round [-852,-196]): up-facing area above 1.8 m 21102 m², wall area 83423 m², ratio 0.253 (208948 triangles)

<details><summary>all classes (top 60 by triangles)</summary>

| object key | vis / hidden | inst in frustum | < 60 m | tris | mats | tiers |
|---|---|---|---|---|---|---|
| world / relief:figures | 9 / 3 | 927 | 0 | 1690000 | MeshStandardNodeMaterial | C |
| terrain | 208 / 0 | 71 | 1 | 765952 | MeshStandardNodeMaterial | C |
| world / settlement:q_s#:far | 4 / 0 | 4 | 0 | 317074 | MeshStandardNodeMaterial | C |
| world / plain-orchards-far | 1 / 0 | 1 | 0 | 176772 | MeshStandardNodeMaterial |  |
| world / river-banks | 1 / 0 | 1 | 0 | 159880 | MeshStandardNodeMaterial | C |
| world / settlement:q_w#:far | 3 / 0 | 1 | 1 | 124026 | MeshStandardNodeMaterial | C |
| world / settlement:near:plaster | 1 / 0 | 1 | 0 | 90868 | MeshStandardNodeMaterial | C |
| world / settlement:ground | 1 / 0 | 1 | 1 | 88536 | MeshStandardNodeMaterial | C |
| world / plain-stone | 1 / 0 | 1 | 1 | 84008 | MeshStandardNodeMaterial | C |
| world / plain-tracks | 1 / 0 | 1 | 0 | 75768 | MeshStandardNodeMaterial | C |
| world / plain-canal-banks | 1 / 0 | 1 | 0 | 55524 | MeshStandardNodeMaterial | C |
| world / plain-villages--#,-# | 2 / 0 | 1 | 0 | 54984 | MeshStandardNodeMaterial | C |
| world / settlement:near:timber | 1 / 0 | 1 | 0 | 53210 | MeshStandardNodeMaterial | C |
| world / river-water | 1 / 0 | 1 | 0 | 50324 | MeshStandardNodeMaterial |  |
| world / animals:sheep:lod# | 2 / 0 | 46 | 0 | 45080 | MeshStandardNodeMaterial |  |
| world / settlement:near:items | 1 / 0 | 1 | 0 | 40299 | MeshStandardNodeMaterial | C |
| world / interiors:cloth | 1 / 0 | 1 | 0 | 37403 | MeshStandardNodeMaterial | C |
| world / animals:goat:lod# | 2 / 0 | 34 | 0 | 33320 | MeshStandardNodeMaterial |  |
| world / plain-villages-#,# | 2 / 0 | 1 | 1 | 32572 | MeshStandardNodeMaterial | C |
| world / settlement:gardens:far | 1 / 0 | 1 | 1 | 31796 | MeshStandardNodeMaterial | C |
| world / ledges:far | 1 / 0 | 1 | 0 | 28850 | ledges |  |
| plain-qanats / qanat-tile:#,-# | 2 / 13 | 318 | 0 | 28620 | MeshStandardNodeMaterial | C |
| world / settlement:near:props | 1 / 0 | 1 | 0 | 26180 | MeshStandardNodeMaterial | C |
| world / settlement:refuse | 1 / 0 | 1 | 1 | 21888 | MeshStandardNodeMaterial | C |
| world / settlement:roads | 1 / 0 | 1 | 1 | 20956 | MeshStandardNodeMaterial | C |
| world / nr-life | 1 / 0 | 1 | 1 | 19006 | MeshStandardNodeMaterial | C |
| world / settlement:near:stone | 1 / 0 | 1 | 0 | 15432 | MeshStandardNodeMaterial | C |
| world / interiors:clay | 1 / 0 | 1 | 0 | 12382 | MeshStandardNodeMaterial | C |
| world / settlement:compounds:far | 1 / 0 | 1 | 1 | 9482 | MeshStandardNodeMaterial | C |
| world / settlement:water | 1 / 0 | 1 | 1 | 9242 | MeshStandardNodeMaterial | C |
| world / humans:child:lod# | 1 / 3 | 1 | 1 | 5548 | human |  |
| world / bird-chukar:stand# | 2 / 0 | 24 | 0 | 4224 | life:chukar |  |
| world / fire | 1 / 0 | 1796 | 0 | 3592 | MeshBasicNodeMaterial |  |
| world / rock-boulder:namaqualand_boulder_#:lod# | 10 / 0 | 8 | 1 | 3048 | scan:namaqualand_boulder_02, scan:namaqualand_boulder_03, scan:namaqualand_boulder_04, scan:namaqualand_boulder_05 |  |
| Points | 1 / 0 | 1 | 0 | 2973 | PointsNodeMaterial |  |
| world / court-camps:ridge:shell | 1 / 0 | 179 | 0 | 2864 | MeshStandardNodeMaterial | C |
| plain-works / works:wo_hurdles | 1 / 0 | 3 | 0 | 2034 | MeshStandardNodeMaterial | C |
| plain-works / works:jar_store | 1 / 0 | 22 | 0 | 1980 | MeshStandardNodeMaterial | C |
| plain-field-fill / field:fill_stall_reed:lod# | 1 / 1 | 3 | 0 | 1836 | MeshStandardNodeMaterial | C |
| plain-works / works:vat | 1 / 0 | 6 | 0 | 1800 | MeshStandardNodeMaterial | C |
| world / settlement:burial_ground_town:stone | 1 / 0 | 1 | 0 | 1740 | MeshStandardNodeMaterial | C |
| world / fauna:camp-lines:t_west | 1 / 0 | 1 | 0 | 1720 | MeshStandardNodeMaterial |  |
| plain-works / works:sack | 1 / 0 | 14 | 0 | 1596 | MeshStandardNodeMaterial | C |
| world / bird-crow:stand# | 2 / 0 | 9 | 0 | 1584 | life:crow |  |
| world / court-camps:black:shell | 1 / 0 | 111 | 0 | 1554 | MeshStandardNodeMaterial | C |
| plain-works / works:manger | 1 / 0 | 4 | 0 | 1480 | MeshStandardNodeMaterial | C |
| world / settlement:near:brick | 1 / 0 | 1 | 0 | 1428 | MeshStandardNodeMaterial | B/C |
| world / fire:coals | 1 / 0 | 553 | 0 | 1106 | MeshBasicNodeMaterial |  |
| Mesh | 2 / 2 | 2 | 0 | 972 | MeshBasicNodeMaterial, NodeMaterial |  |
| plain-works / works:quern | 1 / 0 | 8 | 0 | 960 | MeshStandardNodeMaterial | C |
| world / settlement:trees-wood-lod# | 2 / 0 | 2 | 0 | 896 | MeshStandardNodeMaterial |  |
| world / plain-trees-wood-lod# | 2 / 0 | 2 | 0 | 896 | MeshStandardNodeMaterial |  |
| world / settlement:trees-leaves-lod# | 2 / 0 | 2 | 0 | 880 | MeshStandardNodeMaterial |  |
| world / plain-trees-leaves-lod# | 2 / 0 | 2 | 0 | 880 | MeshStandardNodeMaterial |  |
| plain-works / works:oven | 1 / 0 | 3 | 0 | 780 | MeshStandardNodeMaterial | C |
| world / rock-boulder:rock_face_#:lod# | 2 / 0 | 1 | 1 | 500 | scan:rock_face_02 |  |
| world / humans:child:shadow-far | 1 / 0 | 1 | 1 | 390 | human |  |
| world / bird-crow:fly# | 3 / 0 | 5 | 0 | 300 | life:crow |  |
| plain-works / works-walls | 1 / 0 | 1 | 1 | 300 | MeshStandardNodeMaterial | B/C |
| plain-works / works:wo_press | 1 / 0 | 1 | 0 | 292 | MeshStandardNodeMaterial | C |

</details>

## lanes: a town lane, afternoon (cov-142) (day 88, 13.805 h)

camera -871.9, -150.4, -14; sim people within 60 m: 140, within 250 m: 724; crowd stats: {"draws":3,"triangles":2536,"people":4,"byLod":[0,0,0,4],"shadowDraws":0,"shadowTriangles":0,"propDraws":1,"props":1,"propTriangles":4056,"propsDropped":0,"placeholderActs":0,"motionCapture":1,"motionAuthored":3,"things":{"draws":0,"instances":0,"triangles":0,"kinds":{},"dropped":0},"animals":{"draw

| class | meshes visible / hidden | instances in frustum | of them < 60 m | triangles in frustum |
|---|---|---|---|---|
| people (skinned, any LOD) | 3 / 47 | 3 | 3 | 1823 |
| people LOD3 (far) | 0 / 0 | 0 | 0 | 0 |
| people impostors | 1 / 0 | 1 | 0 | 2 |
| house roofs | 13 / 5 | 0 | 0 | 0 |
| house walls | 4 / 0 | 1 | 1 | 300 |
| ground fill / props | 113 / 226 | 48 | 42 | 38361 |
| trees | 22 / 0 | 16 | 0 | 181066 |
| crops / flora | 85 / 40 | 6 | 0 | 2646 |
| fires / lamps | 13 / 1 | 2487 | 4 | 4974 |
| water | 15 / 4 | 4 | 1 | 274970 |
| animals | 140 / 12 | 123 | 1 | 90835 |
| terrace architecture | 118 / 219 | 927 | 0 | 1690000 |

shadow-casting lights: [{"name":"","far":2000,"size":[240]}]

page: backend WebGL2, norender true, catch-up ticks 0 (still catching up: false), crowd looks pending 0

people in the frustum: within 40 m 2 of 61; within 60 m 2 of 140 (behind court walls for this eye: 2; to be drawn: 0)

| people mesh | visible / hidden meshes | instances (count) | in frustum | < 60 m |
|---|---|---|---|---|
| world / humans:persian:shadow | 0 / 1 | 1 | 0 | 0 |
| world / humans:persian:shadow-far | 0 / 1 | 1 | 0 | 0 |
| world / humans:persian:lod# | 0 / 4 | 4 | 0 | 0 |
| world / humans:median:shadow | 0 / 1 | 1 | 0 | 0 |
| world / humans:median:shadow-far | 0 / 1 | 1 | 0 | 0 |
| world / humans:median:lod# | 0 / 4 | 4 | 0 | 0 |
| world / humans:worker:shadow | 0 / 1 | 1 | 0 | 0 |
| world / humans:worker:shadow-far | 0 / 1 | 1 | 0 | 0 |
| world / humans:worker:lod# | 1 / 3 | 4 | 1 | 1 |
| world / humans:woman:shadow | 0 / 1 | 1 | 0 | 0 |
| world / humans:woman:shadow-far | 0 / 1 | 1 | 0 | 0 |
| world / humans:woman:lod# | 1 / 3 | 4 | 1 | 1 |
| world / humans:child:shadow | 0 / 1 | 1 | 0 | 0 |
| world / humans:child:shadow-far | 0 / 1 | 1 | 0 | 0 |
| world / humans:child:lod# | 1 / 3 | 4 | 1 | 1 |
| world / humans:envoy:shadow | 0 / 1 | 1 | 0 | 0 |
| world / humans:envoy:shadow-far | 0 / 1 | 1 | 0 | 0 |
| world / humans:envoy:lod# | 0 / 4 | 4 | 0 | 0 |
| world / humans:envoy_short:shadow | 0 / 1 | 1 | 0 | 0 |
| world / humans:envoy_short:shadow-far | 0 / 1 | 1 | 0 | 0 |
| world / humans:envoy_short:lod# | 0 / 4 | 4 | 0 | 0 |
| world / humans:envoy_bare:shadow | 0 / 1 | 1 | 0 | 0 |
| world / humans:envoy_bare:shadow-far | 0 / 1 | 1 | 0 | 0 |
| world / humans:envoy_bare:lod# | 0 / 4 | 4 | 0 | 0 |
| world / people:reins | 0 / 1 | 0 | 0 | 0 |
| world / people:hit | 0 / 1 | 1 | 0 | 0 |
| world / people:impostors | 1 / 0 | 1 | 1 | 0 |
| player-body / humans:median:lod# | 0 / 2 | 2 | 0 | 0 |

people: sim out of doors within 60 m 140 (open ground 41, inside walled courts 99, walking 0; places {"h":117,"lane":23}; 250 m 724); crowd attached 418, skinned drawn 4 by LOD [0,0,0,4], impostors drawn 94 of 851 candidates

town roofs (150 m round [-811,-287]): up-facing area above 1.8 m 1101 m², wall area 4657 m², ratio 0.236 (22824 triangles)

<details><summary>all classes (top 60 by triangles)</summary>

| object key | vis / hidden | inst in frustum | < 60 m | tris | mats | tiers |
|---|---|---|---|---|---|---|
| world / relief:figures | 9 / 3 | 927 | 0 | 1690000 | MeshStandardNodeMaterial | C |
| terrain | 208 / 0 | 74 | 2 | 775680 | MeshStandardNodeMaterial | C |
| world / settlement:q_s#:far | 4 / 0 | 4 | 0 | 317074 | MeshStandardNodeMaterial | C |
| world / plain-orchards-far | 1 / 0 | 1 | 0 | 176772 | MeshStandardNodeMaterial |  |
| world / river-banks | 1 / 0 | 1 | 0 | 159880 | MeshStandardNodeMaterial | C |
| world / settlement:q_w#:far | 3 / 0 | 1 | 1 | 124026 | MeshStandardNodeMaterial | C |
| world / settlement:near:plaster | 1 / 0 | 1 | 0 | 90868 | MeshStandardNodeMaterial | C |
| world / settlement:ground | 1 / 0 | 1 | 1 | 88536 | MeshStandardNodeMaterial | C |
| world / plain-stone | 1 / 0 | 1 | 1 | 84008 | MeshStandardNodeMaterial | C |
| world / plain-tracks | 1 / 0 | 1 | 0 | 75768 | MeshStandardNodeMaterial | C |
| world / plain-canal-banks | 1 / 0 | 1 | 0 | 55524 | MeshStandardNodeMaterial | C |
| world / plain-villages--#,-# | 2 / 0 | 1 | 0 | 54984 | MeshStandardNodeMaterial | C |
| world / settlement:near:timber | 1 / 0 | 1 | 0 | 53210 | MeshStandardNodeMaterial | C |
| world / river-water | 1 / 0 | 1 | 0 | 50324 | MeshStandardNodeMaterial |  |
| world / animals:sheep:lod# | 2 / 0 | 46 | 0 | 45080 | MeshStandardNodeMaterial |  |
| world / settlement:near:items | 1 / 0 | 1 | 0 | 40299 | MeshStandardNodeMaterial | C |
| world / interiors:cloth | 1 / 0 | 1 | 0 | 37403 | MeshStandardNodeMaterial | C |
| world / animals:goat:lod# | 2 / 0 | 34 | 0 | 33320 | MeshStandardNodeMaterial |  |
| world / plain-villages-#,# | 2 / 0 | 1 | 1 | 32572 | MeshStandardNodeMaterial | C |
| world / settlement:gardens:far | 1 / 0 | 1 | 1 | 31796 | MeshStandardNodeMaterial | C |
| world / ledges:far | 1 / 0 | 1 | 0 | 28850 | ledges |  |
| plain-qanats / qanat-tile:#,-# | 2 / 13 | 318 | 0 | 28620 | MeshStandardNodeMaterial | C |
| world / settlement:near:props | 1 / 0 | 1 | 0 | 26180 | MeshStandardNodeMaterial | C |
| world / settlement:refuse | 1 / 0 | 1 | 1 | 21888 | MeshStandardNodeMaterial | C |
| world / settlement:roads | 1 / 0 | 1 | 1 | 20956 | MeshStandardNodeMaterial | C |
| world / nr-life | 1 / 0 | 1 | 1 | 19006 | MeshStandardNodeMaterial | C |
| world / settlement:near:stone | 1 / 0 | 1 | 0 | 15432 | MeshStandardNodeMaterial | C |
| world / interiors:clay | 1 / 0 | 1 | 0 | 12382 | MeshStandardNodeMaterial | C |
| world / settlement:compounds:far | 1 / 0 | 1 | 1 | 9482 | MeshStandardNodeMaterial | C |
| world / settlement:water | 1 / 0 | 1 | 1 | 9242 | MeshStandardNodeMaterial | C |
| world / animals:donkey:lod# | 3 / 0 | 1 | 1 | 5879 | MeshStandardNodeMaterial |  |
| world / bird-chukar:stand# | 2 / 0 | 24 | 0 | 4224 | life:chukar |  |
| world / props:carried | 1 / 0 | 1 | 0 | 4056 | MeshStandardNodeMaterial |  |
| world / fire | 1 / 0 | 1896 | 3 | 3792 | MeshBasicNodeMaterial |  |
| world / rock-boulder:namaqualand_boulder_#:lod# | 10 / 0 | 8 | 2 | 3048 | scan:namaqualand_boulder_02, scan:namaqualand_boulder_03, scan:namaqualand_boulder_04, scan:namaqualand_boulder_05 |  |
| Points | 1 / 0 | 1 | 0 | 2973 | PointsNodeMaterial |  |
| world / court-camps:ridge:shell | 1 / 0 | 179 | 0 | 2864 | MeshStandardNodeMaterial | C |
| plain-field-fill / field:fill_stall_reed:lod# | 1 / 1 | 4 | 0 | 2448 | MeshStandardNodeMaterial | C |
| plain-works / works:wo_hurdles | 1 / 0 | 3 | 0 | 2034 | MeshStandardNodeMaterial | C |
| plain-works / works:jar_store | 1 / 0 | 22 | 0 | 1980 | MeshStandardNodeMaterial | C |
| plain-works / works:vat | 1 / 0 | 6 | 0 | 1800 | MeshStandardNodeMaterial | C |
| world / settlement:burial_ground_town:stone | 1 / 0 | 1 | 0 | 1740 | MeshStandardNodeMaterial | C |
| world / fauna:camp-lines:t_west | 1 / 0 | 1 | 0 | 1720 | MeshStandardNodeMaterial |  |
| plain-works / works:sack | 1 / 0 | 14 | 0 | 1596 | MeshStandardNodeMaterial | C |
| world / court-camps:black:shell | 1 / 0 | 111 | 0 | 1554 | MeshStandardNodeMaterial | C |
| plain-works / works:manger | 1 / 0 | 4 | 0 | 1480 | MeshStandardNodeMaterial | C |
| world / settlement:near:brick | 1 / 0 | 1 | 0 | 1428 | MeshStandardNodeMaterial | B/C |
| world / bird-crow:stand# | 2 / 0 | 8 | 0 | 1408 | life:crow |  |
| world / fire:coals | 1 / 0 | 591 | 1 | 1182 | MeshBasicNodeMaterial |  |
| Mesh | 2 / 2 | 2 | 0 | 972 | MeshBasicNodeMaterial, NodeMaterial |  |
| plain-works / works:quern | 1 / 0 | 8 | 0 | 960 | MeshStandardNodeMaterial | C |
| world / settlement:trees-wood-lod# | 2 / 0 | 2 | 0 | 896 | MeshStandardNodeMaterial |  |
| world / plain-trees-wood-lod# | 2 / 0 | 2 | 0 | 896 | MeshStandardNodeMaterial |  |
| world / fill:mat:matting:lod# | 2 / 1 | 1 | 1 | 895 | MeshStandardNodeMaterial | C |
| world / settlement:trees-leaves-lod# | 2 / 0 | 2 | 0 | 880 | MeshStandardNodeMaterial |  |
| world / plain-trees-leaves-lod# | 2 / 0 | 2 | 0 | 880 | MeshStandardNodeMaterial |  |
| plain-works / works:oven | 1 / 0 | 3 | 0 | 780 | MeshStandardNodeMaterial | C |
| world / humans:worker:lod# | 1 / 3 | 1 | 1 | 720 | human |  |
| world / humans:woman:lod# | 1 / 3 | 1 | 1 | 713 | human |  |
| world / fill:wo_spoil:earth:lod# | 2 / 1 | 4 | 4 | 704 | MeshStandardNodeMaterial | C |

</details>

## qs1: a q_s1 lane on the road south at day 0, 10:00 (cov-381's spot) (day 0, 10 h)

camera -397, -894.7, -16.2; sim people within 60 m: 169, within 250 m: 442; crowd stats: {"draws":12,"triangles":564698,"people":287,"byLod":[6,34,0,247],"shadowDraws":7,"shadowTriangles":31453,"propDraws":4,"props":167,"propTriangles":554354,"propsDropped":0,"placeholderActs":0,"motionCapture":66,"motionAuthored":221,"things":{"draws":10,"instances":182,"triangles":590346,"kinds":{"loo

| class | meshes visible / hidden | instances in frustum | of them < 60 m | triangles in frustum |
|---|---|---|---|---|
| people (skinned, any LOD) | 19 / 31 | 19 | 17 | 108630 |
| people LOD3 (far) | 0 / 0 | 0 | 0 | 0 |
| people impostors | 1 / 0 | 1 | 0 | 2 |
| house roofs | 13 / 5 | 7 | 3 | 1772 |
| house walls | 4 / 0 | 1 | 1 | 300 |
| ground fill / props | 120 / 219 | 668 | 288 | 673585 |
| trees | 22 / 0 | 16 | 0 | 181066 |
| crops / flora | 86 / 39 | 30 | 18 | 7038 |
| fires / lamps | 13 / 1 | 3917 | 54 | 8274 |
| water | 16 / 3 | 54 | 18 | 281266 |
| animals | 142 / 12 | 244 | 35 | 161114 |
| terrace architecture | 118 / 219 | 927 | 0 | 1690000 |

shadow-casting lights: [{"name":"","far":2000,"size":[240]}]

page: backend WebGL2, norender true, catch-up ticks 0 (still catching up: false), crowd looks pending 0

people in the frustum: within 40 m 48 of 89; within 60 m 87 of 169 (behind court walls for this eye: 51; to be drawn: 36)

| people mesh | visible / hidden meshes | instances (count) | in frustum | < 60 m |
|---|---|---|---|---|
| world / humans:persian:shadow | 0 / 1 | 1 | 0 | 0 |
| world / humans:persian:shadow-far | 1 / 0 | 1 | 1 | 0 |
| world / humans:persian:lod# | 2 / 2 | 4 | 2 | 1 |
| world / humans:median:shadow | 0 / 1 | 1 | 0 | 0 |
| world / humans:median:shadow-far | 1 / 0 | 1 | 1 | 1 |
| world / humans:median:lod# | 2 / 2 | 4 | 2 | 2 |
| world / humans:worker:shadow | 0 / 1 | 1 | 0 | 0 |
| world / humans:worker:shadow-far | 1 / 0 | 1 | 1 | 1 |
| world / humans:worker:lod# | 2 / 2 | 4 | 2 | 2 |
| world / humans:woman:shadow | 1 / 0 | 1 | 1 | 1 |
| world / humans:woman:shadow-far | 1 / 0 | 1 | 1 | 1 |
| world / humans:woman:lod# | 3 / 1 | 4 | 3 | 3 |
| world / humans:child:shadow | 1 / 0 | 1 | 1 | 1 |
| world / humans:child:shadow-far | 1 / 0 | 1 | 1 | 1 |
| world / humans:child:lod# | 3 / 1 | 4 | 3 | 3 |
| world / humans:envoy:shadow | 0 / 1 | 1 | 0 | 0 |
| world / humans:envoy:shadow-far | 0 / 1 | 1 | 0 | 0 |
| world / humans:envoy:lod# | 0 / 4 | 4 | 0 | 0 |
| world / humans:envoy_short:shadow | 0 / 1 | 1 | 0 | 0 |
| world / humans:envoy_short:shadow-far | 0 / 1 | 1 | 0 | 0 |
| world / humans:envoy_short:lod# | 0 / 4 | 4 | 0 | 0 |
| world / humans:envoy_bare:shadow | 0 / 1 | 1 | 0 | 0 |
| world / humans:envoy_bare:shadow-far | 0 / 1 | 1 | 0 | 0 |
| world / humans:envoy_bare:lod# | 0 / 4 | 4 | 0 | 0 |
| world / people:reins | 0 / 1 | 0 | 0 | 0 |
| world / people:hit | 0 / 1 | 1 | 0 | 0 |
| world / people:impostors | 1 / 0 | 1 | 1 | 0 |
| player-body / humans:median:lod# | 0 / 2 | 2 | 0 | 0 |

people: sim out of doors within 60 m 169 (open ground 72, inside walled courts 97, walking 2; places {"h":64,"lane":42,"ws":59,"(walking)":2,"well":1,"ws_textile":1}; 250 m 442); crowd attached 446, skinned drawn 287 by LOD [6,34,0,247], impostors drawn 15 of 1318 candidates

town roofs (150 m round [-455,-1033]): up-facing area above 1.8 m 26159 m², wall area 95202 m², ratio 0.275 (199449 triangles)

<details><summary>all classes (top 60 by triangles)</summary>

| object key | vis / hidden | inst in frustum | < 60 m | tris | mats | tiers |
|---|---|---|---|---|---|---|
| world / relief:figures | 9 / 3 | 927 | 0 | 1690000 | MeshStandardNodeMaterial | C |
| terrain | 208 / 0 | 55 | 3 | 740608 | MeshStandardNodeMaterial | C |
| world / work:loom | 1 / 0 | 149 | 26 | 539380 | MeshStandardNodeMaterial |  |
| world / props:carried | 1 / 0 | 78 | 34 | 316368 | MeshStandardNodeMaterial |  |
| world / settlement:q_s#:far | 4 / 0 | 3 | 1 | 246034 | MeshStandardNodeMaterial | C |
| world / props:tools | 2 / 2 | 86 | 20 | 234080 | MeshStandardNodeMaterial |  |
| world / settlement:near:plaster | 1 / 0 | 1 | 0 | 187967 | MeshStandardNodeMaterial | C |
| world / plain-orchards-far | 1 / 0 | 1 | 0 | 176772 | MeshStandardNodeMaterial |  |
| world / river-banks | 1 / 0 | 1 | 0 | 159880 | MeshStandardNodeMaterial | C |
| world / plain-villages--#,-# | 2 / 0 | 2 | 0 | 133082 | MeshStandardNodeMaterial | C |
| world / settlement:near:timber | 1 / 0 | 1 | 0 | 122887 | MeshStandardNodeMaterial | C |
| world / animals:hen:lod# | 1 / 0 | 157 | 17 | 98282 | MeshStandardNodeMaterial |  |
| world / settlement:near:items | 1 / 0 | 1 | 0 | 88870 | MeshStandardNodeMaterial | C |
| world / settlement:ground | 1 / 0 | 1 | 1 | 88536 | MeshStandardNodeMaterial | C |
| world / plain-stone | 1 / 0 | 1 | 1 | 84008 | MeshStandardNodeMaterial | C |
| world / plain-tracks | 1 / 0 | 1 | 0 | 75768 | MeshStandardNodeMaterial | C |
| world / plain-villages--#,# | 4 / 0 | 1 | 0 | 62844 | MeshStandardNodeMaterial | C |
| world / plain-canal-banks | 1 / 0 | 1 | 0 | 55524 | MeshStandardNodeMaterial | C |
| world / river-water | 1 / 0 | 1 | 0 | 50324 | MeshStandardNodeMaterial |  |
| world / settlement:near:props | 1 / 0 | 1 | 0 | 48732 | MeshStandardNodeMaterial | C |
| world / interiors:cloth | 1 / 0 | 1 | 0 | 47857 | MeshStandardNodeMaterial | C |
| world / humans:woman:lod# | 3 / 1 | 3 | 3 | 43166 | human |  |
| world / work:beam | 1 / 0 | 16 | 6 | 37824 | MeshStandardNodeMaterial |  |
| world / humans:child:lod# | 3 / 1 | 3 | 3 | 36304 | human |  |
| world / ledges:far | 1 / 0 | 1 | 0 | 33710 | ledges |  |
| world / plain-villages-#,# | 2 / 0 | 1 | 1 | 32572 | MeshStandardNodeMaterial | C |
| world / settlement:gardens:far | 1 / 0 | 1 | 1 | 31796 | MeshStandardNodeMaterial | C |
| world / settlement:near:stone | 1 / 0 | 1 | 0 | 29820 | MeshStandardNodeMaterial | C |
| world / settlement:refuse | 1 / 0 | 1 | 1 | 21888 | MeshStandardNodeMaterial | C |
| world / settlement-doors:# | 3 / 0 | 126 | 17 | 21276 | MeshStandardNodeMaterial | C |
| world / settlement:roads | 1 / 0 | 1 | 1 | 20956 | MeshStandardNodeMaterial | C |
| world / nr-life | 1 / 0 | 1 | 1 | 19006 | MeshStandardNodeMaterial | C |
| world / animals:goat:lod# | 3 / 0 | 16 | 10 | 15680 | MeshStandardNodeMaterial |  |
| world / animals:dog:lod# | 1 / 0 | 16 | 1 | 15648 | MeshStandardNodeMaterial |  |
| world / interiors:clay | 1 / 0 | 1 | 0 | 13908 | MeshStandardNodeMaterial | C |
| world / animals:cock:lod# | 1 / 0 | 19 | 2 | 11894 | MeshStandardNodeMaterial |  |
| world / animals:donkey:lod# | 3 / 0 | 6 | 3 | 11754 | MeshStandardNodeMaterial |  |
| world / settlement:compounds:far | 1 / 0 | 1 | 1 | 9482 | MeshStandardNodeMaterial | C |
| world / settlement:water | 1 / 0 | 1 | 1 | 9242 | MeshStandardNodeMaterial | C |
| world / humans:worker:lod# | 2 / 2 | 2 | 2 | 7581 | human |  |
| world / humans:persian:lod# | 2 / 2 | 2 | 1 | 7070 | human |  |
| world / humans:median:lod# | 2 / 2 | 2 | 2 | 6569 | human |  |
| world / fill:jar_water:clay:lod# | 3 / 0 | 50 | 17 | 6296 | MeshStandardNodeMaterial | C |
| world / animals:cat:lod# | 1 / 0 | 10 | 2 | 5880 | MeshStandardNodeMaterial |  |
| world / fill:wo_dung_cakes:dung:lod# | 2 / 1 | 54 | 9 | 5600 | MeshStandardNodeMaterial | C |
| world / fire | 1 / 0 | 2713 | 32 | 5426 | MeshBasicNodeMaterial |  |
| world / settlement:near:brick | 1 / 0 | 1 | 0 | 4692 | MeshStandardNodeMaterial | B/C |
| world / fill:fill_bundle:wood:lod# | 2 / 1 | 12 | 12 | 4248 | MeshStandardNodeMaterial | C |
| world / fill:mat:matting:lod# | 2 / 1 | 31 | 5 | 4045 | MeshStandardNodeMaterial | C |
| world / props:children | 1 / 0 | 3 | 2 | 3906 | MeshStandardNodeMaterial |  |
| world / fill:fill_line:cloth_a:lod# | 2 / 1 | 31 | 7 | 3720 | MeshStandardNodeMaterial | C |
| world / fill:fill_matlean:reed:lod# | 2 / 1 | 9 | 9 | 3700 | MeshStandardNodeMaterial | C |
| world / fill:jar_store:clay:lod# | 2 / 1 | 41 | 9 | 3690 | MeshStandardNodeMaterial | C |
| world / wallwear:soot | 1 / 0 | 51 | 24 | 3672 | MeshStandardNodeMaterial |  |
| world / work:toy_wheeled | 1 / 0 | 2 | 1 | 3244 | MeshStandardNodeMaterial |  |
| world / road-litter | 1 / 0 | 15 | 15 | 3120 | MeshStandardNodeMaterial |  |
| world / fill:fill_line:cloth_b:lod# | 2 / 1 | 31 | 7 | 3100 | MeshStandardNodeMaterial | C |
| Points | 1 / 0 | 1 | 0 | 2973 | PointsNodeMaterial |  |
| world / fill:fill_stall:cloth:lod# | 3 / 0 | 1 | 1 | 2600 | MeshStandardNodeMaterial | C |
| world / humans:woman:shadow | 1 / 0 | 1 | 1 | 2562 | human |  |

</details>

## court: a town court, noon (cov-037) (day 14, 11.07 h)

camera -535.4, 401.1, -12; sim people within 60 m: 105, within 250 m: 391; crowd stats: {"draws":11,"triangles":416568,"people":140,"byLod":[7,19,0,114],"shadowDraws":5,"shadowTriangles":25384,"propDraws":3,"props":84,"propTriangles":304620,"propsDropped":0,"placeholderActs":0,"motionCapture":65,"motionAuthored":75,"things":{"draws":11,"instances":48,"triangles":47818,"kinds":{"beam":1

| class | meshes visible / hidden | instances in frustum | of them < 60 m | triangles in frustum |
|---|---|---|---|---|
| people (skinned, any LOD) | 16 / 34 | 16 | 13 | 95476 |
| people LOD3 (far) | 0 / 0 | 0 | 0 | 0 |
| people impostors | 1 / 0 | 1 | 0 | 2 |
| house roofs | 13 / 5 | 6 | 5 | 1328 |
| house walls | 4 / 0 | 1 | 1 | 300 |
| ground fill / props | 112 / 227 | 388 | 273 | 367763 |
| trees | 22 / 0 | 16 | 0 | 181066 |
| crops / flora | 85 / 40 | 61 | 15 | 9664 |
| fires / lamps | 13 / 1 | 2992 | 59 | 7610 |
| water | 16 / 3 | 120 | 22 | 370609 |
| animals | 146 / 12 | 305 | 31 | 254555 |
| terrace architecture | 120 / 217 | 928 | 0 | 1690036 |

shadow-casting lights: [{"name":"","far":2000,"size":[240]}]

page: backend WebGL2, norender true, catch-up ticks 0 (still catching up: false), crowd looks pending 0

people in the frustum: within 40 m 18 of 52; within 60 m 28 of 105 (behind court walls for this eye: 8; to be drawn: 20)

| people mesh | visible / hidden meshes | instances (count) | in frustum | < 60 m |
|---|---|---|---|---|
| world / humans:persian:shadow | 0 / 1 | 1 | 0 | 0 |
| world / humans:persian:shadow-far | 0 / 1 | 1 | 0 | 0 |
| world / humans:persian:lod# | 0 / 4 | 4 | 0 | 0 |
| world / humans:median:shadow | 0 / 1 | 1 | 0 | 0 |
| world / humans:median:shadow-far | 0 / 1 | 1 | 0 | 0 |
| world / humans:median:lod# | 1 / 3 | 4 | 1 | 1 |
| world / humans:worker:shadow | 0 / 1 | 1 | 0 | 0 |
| world / humans:worker:shadow-far | 1 / 0 | 1 | 1 | 1 |
| world / humans:worker:lod# | 2 / 2 | 4 | 2 | 1 |
| world / humans:woman:shadow | 1 / 0 | 1 | 1 | 1 |
| world / humans:woman:shadow-far | 1 / 0 | 1 | 1 | 1 |
| world / humans:woman:lod# | 3 / 1 | 4 | 3 | 3 |
| world / humans:child:shadow | 1 / 0 | 1 | 1 | 1 |
| world / humans:child:shadow-far | 1 / 0 | 1 | 1 | 1 |
| world / humans:child:lod# | 3 / 1 | 4 | 3 | 3 |
| world / humans:envoy:shadow | 0 / 1 | 1 | 0 | 0 |
| world / humans:envoy:shadow-far | 0 / 1 | 1 | 0 | 0 |
| world / humans:envoy:lod# | 1 / 3 | 4 | 1 | 0 |
| world / humans:envoy_short:shadow | 0 / 1 | 1 | 0 | 0 |
| world / humans:envoy_short:shadow-far | 0 / 1 | 1 | 0 | 0 |
| world / humans:envoy_short:lod# | 1 / 3 | 4 | 1 | 0 |
| world / humans:envoy_bare:shadow | 0 / 1 | 1 | 0 | 0 |
| world / humans:envoy_bare:shadow-far | 0 / 1 | 1 | 0 | 0 |
| world / humans:envoy_bare:lod# | 0 / 4 | 4 | 0 | 0 |
| world / people:reins | 0 / 1 | 0 | 0 | 0 |
| world / people:hit | 0 / 1 | 1 | 0 | 0 |
| world / people:impostors | 1 / 0 | 1 | 1 | 0 |
| player-body / humans:median:lod# | 0 / 2 | 2 | 0 | 0 |

people: sim out of doors within 60 m 105 (open ground 73, inside walled courts 32, walking 0; places {"lane":57,"h":48}; 250 m 391); crowd attached 454, skinned drawn 140 by LOD [7,19,0,114], impostors drawn 16 of 1814 candidates

town roofs (150 m round [-423,500]): up-facing area above 1.8 m 17353 m², wall area 66594 m², ratio 0.261 (168770 triangles)

<details><summary>all classes (top 60 by triangles)</summary>

| object key | vis / hidden | inst in frustum | < 60 m | tris | mats | tiers |
|---|---|---|---|---|---|---|
| world / relief:figures | 9 / 3 | 927 | 0 | 1690000 | MeshStandardNodeMaterial | C |
| terrain | 208 / 0 | 71 | 2 | 847616 | MeshStandardNodeMaterial | C |
| world / props:carried | 1 / 0 | 54 | 19 | 219024 | MeshStandardNodeMaterial |  |
| world / plain-orchards-far | 1 / 0 | 1 | 0 | 176772 | MeshStandardNodeMaterial |  |
| world / river-banks | 1 / 0 | 1 | 0 | 159880 | MeshStandardNodeMaterial | C |
| world / settlement:near:plaster | 1 / 0 | 1 | 0 | 152189 | MeshStandardNodeMaterial | C |
| world / plain-villages-#,# | 2 / 0 | 2 | 1 | 115224 | MeshStandardNodeMaterial | C |
| plain-works / works:wo_brick_field | 1 / 0 | 428 | 0 | 108712 | MeshStandardNodeMaterial | C |
| world / settlement:q_w#:far | 3 / 0 | 1 | 1 | 104186 | MeshStandardNodeMaterial | C |
| world / settlement:near:timber | 1 / 0 | 1 | 0 | 89244 | MeshStandardNodeMaterial | C |
| world / settlement:ground | 1 / 0 | 1 | 1 | 88536 | MeshStandardNodeMaterial | C |
| world / plain-stone | 1 / 0 | 1 | 1 | 84008 | MeshStandardNodeMaterial | C |
| world / plain-tracks | 1 / 0 | 1 | 0 | 75768 | MeshStandardNodeMaterial | C |
| world / props:tools | 2 / 2 | 25 | 10 | 66568 | MeshStandardNodeMaterial |  |
| world / settlement:near:items | 1 / 0 | 1 | 0 | 66556 | MeshStandardNodeMaterial | C |
| world / animals:sheep:lod# | 2 / 0 | 66 | 0 | 64680 | MeshStandardNodeMaterial |  |
| world / settlement:q_n#:far | 1 / 0 | 1 | 0 | 64558 | MeshStandardNodeMaterial | C |
| world / plain-canal-banks | 1 / 0 | 1 | 0 | 55524 | MeshStandardNodeMaterial | C |
| world / animals:goat:lod# | 2 / 1 | 55 | 6 | 53900 | MeshStandardNodeMaterial |  |
| world / river-water | 1 / 0 | 1 | 0 | 50324 | MeshStandardNodeMaterial |  |
| world / interiors:cloth | 1 / 0 | 1 | 0 | 50085 | MeshStandardNodeMaterial | C |
| plain-waterworks / works:wo_shaduf | 1 / 0 | 59 | 0 | 47436 | MeshStandardNodeMaterial | C |
| world / ledges:far | 1 / 0 | 1 | 0 | 44560 | ledges |  |
| world / humans:woman:lod# | 3 / 1 | 3 | 3 | 43166 | human |  |
| world / humans:child:lod# | 3 / 1 | 3 | 3 | 36304 | human |  |
| world / settlement:near:props | 1 / 0 | 1 | 0 | 35849 | MeshStandardNodeMaterial | C |
| world / nr-cliff | 1 / 0 | 1 | 0 | 33260 | MeshStandardNodeMaterial | C |
| world / settlement:gardens:far | 1 / 0 | 1 | 1 | 31796 | MeshStandardNodeMaterial | C |
| world / animals:hen:lod# | 1 / 0 | 45 | 14 | 28170 | MeshStandardNodeMaterial |  |
| world / animals:dog:lod# | 1 / 0 | 28 | 2 | 27384 | MeshStandardNodeMaterial |  |
| world / animals:donkey:lod# | 4 / 0 | 14 | 6 | 25858 | MeshStandardNodeMaterial |  |
| world / settlement:channel_stones | 1 / 0 | 1 | 0 | 25128 | MeshStandardNodeMaterial | C |
| world / settlement:near:stone | 1 / 0 | 1 | 0 | 22748 | MeshStandardNodeMaterial | C |
| world / settlement:refuse | 1 / 0 | 1 | 1 | 21888 | MeshStandardNodeMaterial | C |
| world / settlement:roads | 1 / 0 | 1 | 1 | 20956 | MeshStandardNodeMaterial | C |
| world / nr-life | 1 / 0 | 1 | 1 | 19006 | MeshStandardNodeMaterial | C |
| world / animals:camel:lod# | 2 / 0 | 13 | 0 | 17836 | MeshStandardNodeMaterial |  |
| world / work:drying_rack | 1 / 0 | 7 | 0 | 14392 | MeshStandardNodeMaterial |  |
| quarries-detail / plain-quarries:rock:quarry_sivand | 1 / 0 | 1 | 0 | 13745 | bedrock:ground |  |
| world / interiors:clay | 1 / 0 | 1 | 0 | 12146 | MeshStandardNodeMaterial | C |
| world / nr_darius_tomb | 1 / 0 | 1 | 0 | 11154 | MeshStandardNodeMaterial | C |
| world / nr_xerxes_tomb | 1 / 0 | 1 | 0 | 11154 | MeshStandardNodeMaterial | C |
| world / animals:mule:lod# | 1 / 0 | 8 | 0 | 10968 | MeshStandardNodeMaterial |  |
| world / animals:horse:lod# | 1 / 0 | 7 | 0 | 9597 | MeshStandardNodeMaterial |  |
| world / settlement:compounds:far | 1 / 0 | 1 | 1 | 9482 | MeshStandardNodeMaterial | C |
| world / work:wash_stone | 1 / 0 | 7 | 0 | 9296 | MeshStandardNodeMaterial |  |
| world / settlement:water | 1 / 0 | 1 | 1 | 9242 | MeshStandardNodeMaterial | C |
| world / settlement:q_g#:far | 1 / 0 | 1 | 0 | 9204 | MeshStandardNodeMaterial | C |
| world / settlement:canal_banks | 1 / 0 | 1 | 0 | 7836 | MeshStandardNodeMaterial | C |
| world / humans:worker:lod# | 2 / 2 | 2 | 1 | 7581 | human |  |
| world / work:fodder | 1 / 0 | 13 | 0 | 6448 | MeshStandardNodeMaterial |  |
| world / settlement-doors:# | 3 / 0 | 37 | 16 | 6172 | MeshStandardNodeMaterial | C |
| world / fill:jar_water:clay:lod# | 3 / 0 | 28 | 21 | 6140 | MeshStandardNodeMaterial | C |
| world / bedrock-ground:talus#:lod# | 1 / 2 | 75 | 0 | 5925 | bedrock:ground |  |
| world / work:basket_fruit | 1 / 0 | 4 | 0 | 4800 | MeshStandardNodeMaterial |  |
| plain-works / works:wo_brick_stack | 1 / 0 | 18 | 0 | 4644 | MeshStandardNodeMaterial | C |
| world / animals:cock:lod# | 1 / 0 | 7 | 1 | 4382 | MeshStandardNodeMaterial |  |
| world / fire | 1 / 0 | 2070 | 34 | 4140 | MeshBasicNodeMaterial |  |
| world / settlement:zone_dasht_e_gohar:mud | 1 / 0 | 1 | 0 | 4090 | MeshStandardNodeMaterial | C |
| plain-qanats / qanat-tile:#,# | 1 / 13 | 43 | 0 | 3870 | MeshStandardNodeMaterial | C |

</details>

## terrace: the Terrace, noon (cov-252) (day 168, 12.586 h)

camera 84.8, 9.8, 1.6; sim people within 60 m: 28, within 250 m: 319; crowd stats: {"draws":6,"triangles":493727,"people":139,"byLod":[0,65,0,74],"shadowDraws":3,"shadowTriangles":46105,"propDraws":3,"props":72,"propTriangles":287984,"propsDropped":0,"placeholderActs":0,"motionCapture":29,"motionAuthored":110,"things":{"draws":2,"instances":2,"triangles":2440,"kinds":{"knucklebone

| class | meshes visible / hidden | instances in frustum | of them < 60 m | triangles in frustum |
|---|---|---|---|---|
| people (skinned, any LOD) | 9 / 41 | 9 | 9 | 22249 |
| people LOD3 (far) | 0 / 0 | 0 | 0 | 0 |
| people impostors | 1 / 0 | 1 | 0 | 2 |
| house roofs | 11 / 7 | 175 | 2 | 2880 |
| house walls | 4 / 0 | 9 | 2 | 940 |
| ground fill / props | 26 / 313 | 109 | 47 | 277109 |
| trees | 22 / 0 | 16 | 0 | 181066 |
| crops / flora | 78 / 47 | 186 | 0 | 24690 |
| fires / lamps | 10 / 4 | 2280 | 6 | 30272 |
| water | 14 / 5 | 76 | 4 | 331192 |
| animals | 136 / 23 | 56 | 1 | 7027 |
| terrace architecture | 137 / 200 | 1050 | 12 | 1891376 |

shadow-casting lights: [{"name":"","far":2000,"size":[240]}]

page: backend WebGL2, norender true, catch-up ticks 1 (still catching up: false), crowd looks pending 0

people in the frustum: within 40 m 0 of 0; within 60 m 28 of 28 (behind court walls for this eye: 0; to be drawn: 28)

| people mesh | visible / hidden meshes | instances (count) | in frustum | < 60 m |
|---|---|---|---|---|
| world / humans:persian:shadow | 0 / 1 | 1 | 0 | 0 |
| world / humans:persian:shadow-far | 0 / 1 | 1 | 0 | 0 |
| world / humans:persian:lod# | 1 / 3 | 4 | 1 | 1 |
| world / humans:median:shadow | 0 / 1 | 1 | 0 | 0 |
| world / humans:median:shadow-far | 0 / 1 | 1 | 0 | 0 |
| world / humans:median:lod# | 1 / 3 | 4 | 1 | 1 |
| world / humans:worker:shadow | 0 / 1 | 1 | 0 | 0 |
| world / humans:worker:shadow-far | 1 / 0 | 1 | 1 | 1 |
| world / humans:worker:lod# | 2 / 2 | 4 | 2 | 2 |
| world / humans:woman:shadow | 0 / 1 | 1 | 0 | 0 |
| world / humans:woman:shadow-far | 1 / 0 | 1 | 1 | 1 |
| world / humans:woman:lod# | 1 / 3 | 4 | 1 | 1 |
| world / humans:child:shadow | 0 / 1 | 1 | 0 | 0 |
| world / humans:child:shadow-far | 1 / 0 | 1 | 1 | 1 |
| world / humans:child:lod# | 1 / 3 | 4 | 1 | 1 |
| world / humans:envoy:shadow | 0 / 1 | 1 | 0 | 0 |
| world / humans:envoy:shadow-far | 0 / 1 | 1 | 0 | 0 |
| world / humans:envoy:lod# | 0 / 4 | 4 | 0 | 0 |
| world / humans:envoy_short:shadow | 0 / 1 | 1 | 0 | 0 |
| world / humans:envoy_short:shadow-far | 0 / 1 | 1 | 0 | 0 |
| world / humans:envoy_short:lod# | 0 / 4 | 4 | 0 | 0 |
| world / humans:envoy_bare:shadow | 0 / 1 | 1 | 0 | 0 |
| world / humans:envoy_bare:shadow-far | 0 / 1 | 1 | 0 | 0 |
| world / humans:envoy_bare:lod# | 0 / 4 | 4 | 0 | 0 |
| world / people:reins | 0 / 1 | 0 | 0 | 0 |
| world / people:hit | 0 / 1 | 1 | 0 | 0 |
| world / people:impostors | 1 / 0 | 1 | 1 | 0 |
| player-body / humans:median:lod# | 0 / 2 | 2 | 0 | 0 |

people: sim out of doors within 60 m 28 (open ground 19, inside walled courts 0, walking 6; places {"worksite":3,"work_hearth":10,"(walking)":6}; 250 m 319); crowd attached 449, skinned drawn 139 by LOD [0,65,0,74], impostors drawn 5 of 1904 candidates

town roofs (150 m round [145,11]): up-facing area above 1.8 m 0 m², wall area 0 m², ratio null (0 triangles)

<details><summary>all classes (top 60 by triangles)</summary>

| object key | vis / hidden | inst in frustum | < 60 m | tris | mats | tiers |
|---|---|---|---|---|---|---|
| world / relief:figures | 9 / 3 | 927 | 0 | 1690000 | MeshStandardNodeMaterial | C |
| terrain | 208 / 0 | 72 | 2 | 752640 | MeshStandardNodeMaterial | C |
| world / garrison:room_fittings:bedrolls | 1 / 0 | 624 | 0 | 469248 | MeshStandardNodeMaterial | C |
| world / garrison:room_fittings:mats | 1 / 0 | 416 | 0 | 372320 | MeshStandardNodeMaterial | C |
| world / props:carried | 1 / 0 | 65 | 5 | 263640 | MeshStandardNodeMaterial |  |
| world / garrison:room_fittings:mats_b | 1 / 0 | 208 | 0 | 186160 | MeshStandardNodeMaterial | C |
| world / plain-orchards-far | 1 / 0 | 1 | 0 | 176772 | MeshStandardNodeMaterial |  |
| world / river-banks | 1 / 0 | 1 | 0 | 159880 | MeshStandardNodeMaterial | C |
| world / plain-villages-#,# | 2 / 0 | 2 | 1 | 115224 | MeshStandardNodeMaterial | C |
| world / work:objects | 1 / 0 | 1 | 1 | 92036 | MeshStandardNodeMaterial |  |
| world / settlement:ground | 1 / 0 | 1 | 1 | 88536 | MeshStandardNodeMaterial | C |
| world / plain-stone | 1 / 0 | 1 | 1 | 84008 | MeshStandardNodeMaterial | C |
| world / plain-tracks | 1 / 0 | 1 | 0 | 75768 | MeshStandardNodeMaterial | C |
| world / ledges:far | 1 / 0 | 1 | 0 | 66670 | ledges |  |
| world / fortification_e:mudbrick | 2 / 0 | 2 | 2 | 66540 | MeshStandardNodeMaterial | B/C |
| world / apadana:mudbrick | 1 / 0 | 1 | 1 | 60020 | MeshStandardNodeMaterial | B/C |
| world / plain-canal-banks | 1 / 0 | 1 | 0 | 55524 | MeshStandardNodeMaterial | C |
| world / relief:far-set | 8 / 1 | 1 | 1 | 52314 | MeshStandardNodeMaterial | C |
| world / river-water | 1 / 0 | 1 | 0 | 50324 | MeshStandardNodeMaterial |  |
| world / hall#:construction:base_bell:lod# | 1 / 1 | 95 | 26 | 43320 | model:column_base_bell:0:limestone_carved, model:column_base_bell:1:limestone_carved | C |
| plain-waterworks / works:wo_shaduf | 1 / 0 | 50 | 0 | 40200 | MeshStandardNodeMaterial | C |
| world / treasury:arrow_bundle | 1 / 0 | 40 | 0 | 35200 | MeshStandardNodeMaterial | C |
| world / settlement:gardens:far | 1 / 0 | 1 | 1 | 31796 | MeshStandardNodeMaterial | C |
| world / treasury:alabaster_vessel | 1 / 0 | 69 | 0 | 31050 | MeshStandardNodeMaterial | C |
| world / c#:dressings:cloth | 1 / 0 | 1 | 1 | 23770 | MeshStandardNodeMaterial | C |
| world / treasury:mudbrick | 1 / 0 | 1 | 0 | 23536 | MeshStandardNodeMaterial | B/C |
| world / apadana:palace_plaster | 1 / 0 | 1 | 1 | 23144 | MeshStandardNodeMaterial | B/C |
| world / scribes:tablets_filed | 1 / 0 | 294 | 0 | 22344 | clay-writing |  |
| world / settlement:refuse | 1 / 0 | 1 | 1 | 21888 | MeshStandardNodeMaterial | C |
| world / treasury:mudbrick_painted | 2 / 0 | 2 | 0 | 21544 | MeshStandardNodeMaterial | B/C |
| world / hall#:construction:#|#|#:shaft:lod# | 7 / 7 | 48 | 11 | 21504 | model:column_shaft_f40:0:limestone_carved, model:column_shaft_f40:1:limestone_carved, model:column_shaft_drums:0:limestone_carved, model:column_shaft_drums:1:limestone_carved | C |
| world / settlement:roads | 1 / 0 | 1 | 1 | 20956 | MeshStandardNodeMaterial | C |
| world / garrison:mudbrick | 1 / 0 | 1 | 1 | 20292 | MeshStandardNodeMaterial | B/C |
| world / fire-body:hearth:stone | 1 / 0 | 9 | 1 | 19800 | MeshStandardNodeMaterial | C |
| world / nr-life | 1 / 0 | 1 | 1 | 19006 | MeshStandardNodeMaterial | C |
| world / bedrock-ground:outcrop#:lod# | 2 / 1 | 123 | 0 | 18580 | bedrock:ground |  |
| world / hall#:construction:#|#|#:protome:lod# | 1 / 1 | 30 | 6 | 16860 | model:capital_protome:0:limestone_carved, model:capital_protome:1:limestone_carved | C |
| world / garrison:room_fittings | 1 / 0 | 1 | 1 | 16124 | MeshStandardNodeMaterial | C |
| world / apadana-glazed-frieze | 1 / 0 | 1 | 1 | 14912 | MeshStandardNodeMaterial | C |
| world / palace-glazed-bands | 1 / 0 | 1 | 1 | 14532 | MeshStandardNodeMaterial | C |
| world / treasury:textile_bale | 1 / 0 | 24 | 0 | 13632 | MeshStandardNodeMaterial | C |
| world / bedrock-ground:talus#:lod# | 1 / 2 | 153 | 0 | 12087 | bedrock:ground |  |
| world / apadana:limestone | 2 / 0 | 2 | 2 | 10875 | MeshStandardNodeMaterial | C |
| world / ledges:mid | 1 / 0 | 1 | 0 | 10840 | ledges |  |
| world / treasury:timber:ceiling | 1 / 0 | 1 | 0 | 10506 | MeshStandardNodeMaterial | C |
| world / treasury:scale_armour | 1 / 0 | 18 | 0 | 10224 | MeshStandardNodeMaterial | C |
| world / settlement:water | 1 / 0 | 1 | 1 | 9242 | MeshStandardNodeMaterial | C |
| world / treasury:chert_set | 1 / 0 | 30 | 0 | 8340 | MeshStandardNodeMaterial | C |
| world / props:tools | 2 / 2 | 3 | 1 | 8120 | MeshStandardNodeMaterial |  |
| world / scribes:furnishings | 1 / 0 | 1 | 0 | 8096 | MeshStandardNodeMaterial | C |
| world / garrison:columns:base_square#:lod# | 1 / 1 | 36 | 0 | 8064 | model:column_base_square2:0:limestone_carved, model:column_base_square2:1:limestone_carved | C |
| world / settlement:canal_banks | 1 / 0 | 1 | 0 | 7836 | MeshStandardNodeMaterial | C |
| world / humans:worker:lod# | 2 / 2 | 2 | 2 | 7581 | human |  |
| world / bedrock-ground:talus#:lod#:cast | 1 / 0 | 89 | 0 | 7031 | bedrock:ground |  |
| world / treasury:silver_phiale | 1 / 0 | 19 | 0 | 6802 | MeshStandardNodeMaterial | C |
| world / treasury:bitumen_jar | 1 / 0 | 22 | 0 | 6776 | MeshStandardNodeMaterial | C |
| world / terrace-foot:blocks | 1 / 0 | 1 | 1 | 6745 | MeshStandardNodeMaterial | C |
| world / garrison:timber:ceiling | 1 / 0 | 1 | 1 | 6576 | MeshStandardNodeMaterial | C |
| plain-qanats / qanat-tile:#,-# | 3 / 12 | 72 | 0 | 6480 | MeshStandardNodeMaterial | C |
| world / hall#:mudbrick_bare | 1 / 0 | 1 | 1 | 6460 | MeshStandardNodeMaterial | C |

</details>

## terrace_court: the Terrace at 10:00 with the court resident (day 40) (day 40, 10 h)

camera 84.8, 9.8, 1.6; sim people within 60 m: 81, within 250 m: 418; crowd stats: {"draws":7,"triangles":826008,"people":229,"byLod":[0,100,25,104],"shadowDraws":3,"shadowTriangles":88968,"propDraws":3,"props":155,"propTriangles":623380,"propsDropped":0,"placeholderActs":0,"motionCapture":45,"motionAuthored":184,"things":{"draws":4,"instances":5,"triangles":5468,"kinds":{"knuckle

| class | meshes visible / hidden | instances in frustum | of them < 60 m | triangles in frustum |
|---|---|---|---|---|
| people (skinned, any LOD) | 10 / 40 | 10 | 10 | 25175 |
| people LOD3 (far) | 0 / 0 | 0 | 0 | 0 |
| people impostors | 1 / 0 | 1 | 0 | 2 |
| house roofs | 11 / 7 | 175 | 2 | 2880 |
| house walls | 4 / 0 | 9 | 2 | 940 |
| ground fill / props | 26 / 313 | 189 | 95 | 601589 |
| trees | 22 / 0 | 16 | 0 | 181066 |
| crops / flora | 78 / 47 | 186 | 0 | 24690 |
| fires / lamps | 10 / 4 | 2280 | 6 | 30272 |
| water | 14 / 5 | 76 | 4 | 331192 |
| animals | 137 / 22 | 251 | 1 | 198151 |
| terrace architecture | 138 / 203 | 1050 | 12 | 1891376 |

shadow-casting lights: [{"name":"","far":2000,"size":[240]}]

page: backend WebGL2, norender true, catch-up ticks 1 (still catching up: false), crowd looks pending 0

people in the frustum: within 40 m 12 of 12; within 60 m 64 of 81 (behind court walls for this eye: 0; to be drawn: 64)

| people mesh | visible / hidden meshes | instances (count) | in frustum | < 60 m |
|---|---|---|---|---|
| world / humans:persian:shadow | 0 / 1 | 1 | 0 | 0 |
| world / humans:persian:shadow-far | 0 / 1 | 1 | 0 | 0 |
| world / humans:persian:lod# | 1 / 3 | 4 | 1 | 1 |
| world / humans:median:shadow | 0 / 1 | 1 | 0 | 0 |
| world / humans:median:shadow-far | 0 / 1 | 1 | 0 | 0 |
| world / humans:median:lod# | 1 / 3 | 4 | 1 | 1 |
| world / humans:worker:shadow | 0 / 1 | 1 | 0 | 0 |
| world / humans:worker:shadow-far | 1 / 0 | 1 | 1 | 1 |
| world / humans:worker:lod# | 3 / 1 | 4 | 3 | 3 |
| world / humans:woman:shadow | 0 / 1 | 1 | 0 | 0 |
| world / humans:woman:shadow-far | 1 / 0 | 1 | 1 | 1 |
| world / humans:woman:lod# | 1 / 3 | 4 | 1 | 1 |
| world / humans:child:shadow | 0 / 1 | 1 | 0 | 0 |
| world / humans:child:shadow-far | 1 / 0 | 1 | 1 | 1 |
| world / humans:child:lod# | 1 / 3 | 4 | 1 | 1 |
| world / humans:envoy:shadow | 0 / 1 | 1 | 0 | 0 |
| world / humans:envoy:shadow-far | 0 / 1 | 1 | 0 | 0 |
| world / humans:envoy:lod# | 0 / 4 | 4 | 0 | 0 |
| world / humans:envoy_short:shadow | 0 / 1 | 1 | 0 | 0 |
| world / humans:envoy_short:shadow-far | 0 / 1 | 1 | 0 | 0 |
| world / humans:envoy_short:lod# | 0 / 4 | 4 | 0 | 0 |
| world / humans:envoy_bare:shadow | 0 / 1 | 1 | 0 | 0 |
| world / humans:envoy_bare:shadow-far | 0 / 1 | 1 | 0 | 0 |
| world / humans:envoy_bare:lod# | 0 / 4 | 4 | 0 | 0 |
| world / people:reins | 0 / 1 | 0 | 0 | 0 |
| world / people:hit | 0 / 1 | 1 | 0 | 0 |
| world / people:impostors | 1 / 0 | 1 | 1 | 0 |
| player-body / humans:median:lod# | 0 / 2 | 2 | 0 | 0 |

people: sim out of doors within 60 m 81 (open ground 64, inside walled courts 0, walking 4; places {"h100_door_N1":32,"h100_wall_W":26,"hall100_site":6}; 250 m 418); crowd attached 440, skinned drawn 229 by LOD [0,100,25,104], impostors drawn 6 of 2026 candidates

town roofs (150 m round [145,11]): up-facing area above 1.8 m 0 m², wall area 0 m², ratio null (0 triangles)

<details><summary>all classes (top 60 by triangles)</summary>

| object key | vis / hidden | inst in frustum | < 60 m | tris | mats | tiers |
|---|---|---|---|---|---|---|
| world / relief:figures | 9 / 3 | 927 | 0 | 1690000 | MeshStandardNodeMaterial | C |
| terrain | 208 / 0 | 72 | 2 | 752640 | MeshStandardNodeMaterial | C |
| world / props:carried | 1 / 0 | 145 | 53 | 588120 | MeshStandardNodeMaterial |  |
| world / garrison:room_fittings:bedrolls | 1 / 0 | 624 | 0 | 469248 | MeshStandardNodeMaterial | C |
| world / garrison:room_fittings:mats | 1 / 0 | 416 | 0 | 372320 | MeshStandardNodeMaterial | C |
| world / garrison:room_fittings:mats_b | 1 / 0 | 208 | 0 | 186160 | MeshStandardNodeMaterial | C |
| world / plain-orchards-far | 1 / 0 | 1 | 0 | 176772 | MeshStandardNodeMaterial |  |
| world / river-banks | 1 / 0 | 1 | 0 | 159880 | MeshStandardNodeMaterial | C |
| world / plain-villages-#,# | 2 / 0 | 2 | 1 | 115224 | MeshStandardNodeMaterial | C |
| world / animals:sheep:lod# | 1 / 1 | 116 | 0 | 113680 | MeshStandardNodeMaterial |  |
| world / work:objects | 1 / 0 | 1 | 1 | 92036 | MeshStandardNodeMaterial |  |
| world / settlement:ground | 1 / 0 | 1 | 1 | 88536 | MeshStandardNodeMaterial | C |
| world / plain-stone | 1 / 0 | 1 | 1 | 84008 | MeshStandardNodeMaterial | C |
| world / animals:goat:lod# | 1 / 2 | 79 | 0 | 77420 | MeshStandardNodeMaterial |  |
| world / plain-tracks | 1 / 0 | 1 | 0 | 75768 | MeshStandardNodeMaterial | C |
| world / ledges:far | 1 / 0 | 1 | 0 | 66670 | ledges |  |
| world / fortification_e:mudbrick | 2 / 0 | 2 | 2 | 66540 | MeshStandardNodeMaterial | B/C |
| world / apadana:mudbrick | 1 / 0 | 1 | 1 | 60020 | MeshStandardNodeMaterial | B/C |
| world / plain-canal-banks | 1 / 0 | 1 | 0 | 55524 | MeshStandardNodeMaterial | C |
| world / relief:far-set | 8 / 1 | 1 | 1 | 52314 | MeshStandardNodeMaterial | C |
| world / river-water | 1 / 0 | 1 | 0 | 50324 | MeshStandardNodeMaterial |  |
| world / hall#:construction:base_bell:lod# | 1 / 1 | 95 | 26 | 43320 | model:column_base_bell:0:limestone_carved, model:column_base_bell:1:limestone_carved | C |
| plain-waterworks / works:wo_shaduf | 1 / 0 | 50 | 0 | 40200 | MeshStandardNodeMaterial | C |
| world / treasury:arrow_bundle | 1 / 0 | 40 | 0 | 35200 | MeshStandardNodeMaterial | C |
| world / settlement:gardens:far | 1 / 0 | 1 | 1 | 31796 | MeshStandardNodeMaterial | C |
| world / treasury:alabaster_vessel | 1 / 0 | 69 | 0 | 31050 | MeshStandardNodeMaterial | C |
| world / c#:dressings:cloth | 1 / 0 | 1 | 1 | 23770 | MeshStandardNodeMaterial | C |
| world / treasury:mudbrick | 1 / 0 | 1 | 0 | 23536 | MeshStandardNodeMaterial | B/C |
| world / apadana:palace_plaster | 1 / 0 | 1 | 1 | 23144 | MeshStandardNodeMaterial | B/C |
| world / scribes:tablets_filed | 1 / 0 | 294 | 0 | 22344 | clay-writing |  |
| world / settlement:refuse | 1 / 0 | 1 | 1 | 21888 | MeshStandardNodeMaterial | C |
| world / treasury:mudbrick_painted | 2 / 0 | 2 | 0 | 21544 | MeshStandardNodeMaterial | B/C |
| world / hall#:construction:#|#|#:shaft:lod# | 7 / 7 | 48 | 11 | 21504 | model:column_shaft_f40:0:limestone_carved, model:column_shaft_f40:1:limestone_carved, model:column_shaft_drums:0:limestone_carved, model:column_shaft_drums:1:limestone_carved | C |
| world / settlement:roads | 1 / 0 | 1 | 1 | 20956 | MeshStandardNodeMaterial | C |
| world / garrison:mudbrick | 1 / 0 | 1 | 1 | 20292 | MeshStandardNodeMaterial | B/C |
| world / fire-body:hearth:stone | 1 / 0 | 9 | 1 | 19800 | MeshStandardNodeMaterial | C |
| world / nr-life | 1 / 0 | 1 | 1 | 19006 | MeshStandardNodeMaterial | C |
| world / bedrock-ground:outcrop#:lod# | 2 / 1 | 123 | 0 | 18580 | bedrock:ground |  |
| world / hall#:construction:#|#|#:protome:lod# | 1 / 1 | 30 | 6 | 16860 | model:capital_protome:0:limestone_carved, model:capital_protome:1:limestone_carved | C |
| world / garrison:room_fittings | 1 / 0 | 1 | 1 | 16124 | MeshStandardNodeMaterial | C |
| world / apadana-glazed-frieze | 1 / 0 | 1 | 1 | 14912 | MeshStandardNodeMaterial | C |
| world / palace-glazed-bands | 1 / 0 | 1 | 1 | 14532 | MeshStandardNodeMaterial | C |
| world / treasury:textile_bale | 1 / 0 | 24 | 0 | 13632 | MeshStandardNodeMaterial | C |
| world / bedrock-ground:talus#:lod# | 1 / 2 | 153 | 0 | 12087 | bedrock:ground |  |
| world / apadana:limestone | 2 / 0 | 2 | 2 | 10875 | MeshStandardNodeMaterial | C |
| world / ledges:mid | 1 / 0 | 1 | 0 | 10840 | ledges |  |
| world / humans:worker:lod# | 3 / 1 | 3 | 3 | 10507 | human |  |
| world / treasury:timber:ceiling | 1 / 0 | 1 | 0 | 10506 | MeshStandardNodeMaterial | C |
| world / treasury:scale_armour | 1 / 0 | 18 | 0 | 10224 | MeshStandardNodeMaterial | C |
| world / settlement:water | 1 / 0 | 1 | 1 | 9242 | MeshStandardNodeMaterial | C |
| world / treasury:chert_set | 1 / 0 | 30 | 0 | 8340 | MeshStandardNodeMaterial | C |
| world / props:tools | 2 / 2 | 3 | 1 | 8120 | MeshStandardNodeMaterial |  |
| world / scribes:furnishings | 1 / 0 | 1 | 0 | 8096 | MeshStandardNodeMaterial | C |
| world / garrison:columns:base_square#:lod# | 1 / 1 | 36 | 0 | 8064 | model:column_base_square2:0:limestone_carved, model:column_base_square2:1:limestone_carved | C |
| world / settlement:canal_banks | 1 / 0 | 1 | 0 | 7836 | MeshStandardNodeMaterial | C |
| world / bedrock-ground:talus#:lod#:cast | 1 / 0 | 89 | 0 | 7031 | bedrock:ground |  |
| world / treasury:silver_phiale | 1 / 0 | 19 | 0 | 6802 | MeshStandardNodeMaterial | C |
| world / treasury:bitumen_jar | 1 / 0 | 22 | 0 | 6776 | MeshStandardNodeMaterial | C |
| world / terrace-foot:blocks | 1 / 0 | 1 | 1 | 6745 | MeshStandardNodeMaterial | C |
| world / garrison:timber:ceiling | 1 / 0 | 1 | 1 | 6576 | MeshStandardNodeMaterial | C |

</details>

## apadana: the Apadana hall, morning (cov-294) (day 200, 8.809 h)

camera 14.3, 32.6, 4.6; sim people within 60 m: 90, within 250 m: 541; crowd stats: {"draws":10,"triangles":376127,"people":142,"byLod":[0,55,0,87],"shadowDraws":5,"shadowTriangles":32338,"propDraws":4,"props":67,"propTriangles":249442,"propsDropped":0,"placeholderActs":0,"motionCapture":70,"motionAuthored":72,"things":{"draws":1,"instances":1,"triangles":280,"kinds":{"knucklebones

| class | meshes visible / hidden | instances in frustum | of them < 60 m | triangles in frustum |
|---|---|---|---|---|
| people (skinned, any LOD) | 15 / 35 | 15 | 10 | 36946 |
| people LOD3 (far) | 0 / 0 | 0 | 0 | 0 |
| people impostors | 1 / 0 | 1 | 0 | 2 |
| house roofs | 11 / 7 | 159 | 17 | 2532 |
| house walls | 4 / 0 | 1 | 1 | 300 |
| ground fill / props | 17 / 322 | 68 | 10 | 213906 |
| trees | 22 / 0 | 16 | 0 | 181066 |
| crops / flora | 78 / 47 | 126 | 0 | 13790 |
| fires / lamps | 10 / 4 | 2040 | 0 | 20608 |
| water | 14 / 5 | 96 | 5 | 366677 |
| animals | 135 / 24 | 48 | 1 | 6552 |
| terrace architecture | 149 / 202 | 1955 | 667 | 2031935 |

shadow-casting lights: [{"name":"","far":2000,"size":[240]}]

page: backend WebGL2, norender true, catch-up ticks 1 (still catching up: false), crowd looks pending 0

people in the frustum: within 40 m 3 of 4; within 60 m 48 of 90 (behind court walls for this eye: 0; to be drawn: 48)

| people mesh | visible / hidden meshes | instances (count) | in frustum | < 60 m |
|---|---|---|---|---|
| world / humans:persian:shadow | 0 / 1 | 1 | 0 | 0 |
| world / humans:persian:shadow-far | 1 / 0 | 1 | 1 | 1 |
| world / humans:persian:lod# | 2 / 2 | 4 | 2 | 1 |
| world / humans:median:shadow | 0 / 1 | 1 | 0 | 0 |
| world / humans:median:shadow-far | 1 / 0 | 1 | 1 | 1 |
| world / humans:median:lod# | 2 / 2 | 4 | 2 | 1 |
| world / humans:worker:shadow | 0 / 1 | 1 | 0 | 0 |
| world / humans:worker:shadow-far | 0 / 1 | 1 | 0 | 0 |
| world / humans:worker:lod# | 1 / 3 | 4 | 1 | 0 |
| world / humans:woman:shadow | 0 / 1 | 1 | 0 | 0 |
| world / humans:woman:shadow-far | 1 / 0 | 1 | 1 | 1 |
| world / humans:woman:lod# | 2 / 2 | 4 | 2 | 1 |
| world / humans:child:shadow | 0 / 1 | 1 | 0 | 0 |
| world / humans:child:shadow-far | 0 / 1 | 1 | 0 | 0 |
| world / humans:child:lod# | 1 / 3 | 4 | 1 | 0 |
| world / humans:envoy:shadow | 0 / 1 | 1 | 0 | 0 |
| world / humans:envoy:shadow-far | 1 / 0 | 1 | 1 | 1 |
| world / humans:envoy:lod# | 1 / 3 | 4 | 1 | 1 |
| world / humans:envoy_short:shadow | 0 / 1 | 1 | 0 | 0 |
| world / humans:envoy_short:shadow-far | 1 / 0 | 1 | 1 | 1 |
| world / humans:envoy_short:lod# | 1 / 3 | 4 | 1 | 1 |
| world / humans:envoy_bare:shadow | 0 / 1 | 1 | 0 | 0 |
| world / humans:envoy_bare:shadow-far | 0 / 1 | 1 | 0 | 0 |
| world / humans:envoy_bare:lod# | 0 / 4 | 4 | 0 | 0 |
| world / people:reins | 0 / 1 | 0 | 0 | 0 |
| world / people:hit | 0 / 1 | 1 | 0 | 0 |
| world / people:impostors | 1 / 0 | 1 | 1 | 0 |
| player-body / humans:median:lod# | 0 / 2 | 2 | 0 | 0 |

people: sim out of doors within 60 m 90 (open ground 89, inside walled courts 0, walking 0; places {"palaces":1,"forecourt_wait":88}; 250 m 541); crowd attached 445, skinned drawn 142 by LOD [0,55,0,87], impostors drawn 7 of 2177 candidates

town roofs (150 m round [54,77]): up-facing area above 1.8 m 0 m², wall area 0 m², ratio null (0 triangles)

<details><summary>all classes (top 60 by triangles)</summary>

| object key | vis / hidden | inst in frustum | < 60 m | tris | mats | tiers |
|---|---|---|---|---|---|---|
| world / relief:figures | 9 / 3 | 927 | 0 | 1690000 | MeshStandardNodeMaterial | C |
| terrain | 208 / 0 | 71 | 3 | 785920 | MeshStandardNodeMaterial | C |
| world / props:carried | 1 / 0 | 49 | 1 | 198744 | MeshStandardNodeMaterial |  |
| world / plain-orchards-far | 1 / 0 | 1 | 0 | 176772 | MeshStandardNodeMaterial |  |
| world / garrison:room_fittings:bedrolls | 1 / 0 | 223 | 0 | 167696 | MeshStandardNodeMaterial | C |
| world / river-banks | 1 / 0 | 1 | 0 | 159880 | MeshStandardNodeMaterial | C |
| plain-works / works:wo_brick_field | 1 / 0 | 591 | 0 | 150114 | MeshStandardNodeMaterial | C |
| world / garrison:room_fittings:mats | 1 / 0 | 149 | 0 | 133355 | MeshStandardNodeMaterial | C |
| world / plain-villages-#,# | 2 / 0 | 2 | 1 | 115224 | MeshStandardNodeMaterial | C |
| world / work:objects | 1 / 0 | 1 | 0 | 92036 | MeshStandardNodeMaterial |  |
| world / settlement:ground | 1 / 0 | 1 | 1 | 88536 | MeshStandardNodeMaterial | C |
| world / plain-stone | 1 / 0 | 1 | 1 | 84008 | MeshStandardNodeMaterial | C |
| world / plain-tracks | 1 / 0 | 1 | 0 | 75768 | MeshStandardNodeMaterial | C |
| world / garrison:room_fittings:mats_b | 1 / 0 | 74 | 0 | 66230 | MeshStandardNodeMaterial | C |
| world / ledges:far | 1 / 0 | 1 | 0 | 64090 | ledges |  |
| world / apadana:mudbrick | 1 / 0 | 1 | 1 | 60020 | MeshStandardNodeMaterial | B/C |
| world / plain-canal-banks | 1 / 0 | 1 | 0 | 55524 | MeshStandardNodeMaterial | C |
| world / river-water | 1 / 0 | 1 | 0 | 50324 | MeshStandardNodeMaterial |  |
| plain-waterworks / works:wo_shaduf | 1 / 0 | 59 | 0 | 47436 | MeshStandardNodeMaterial | C |
| world / crown-merlons:terrace|#|# | 2 / 0 | 246 | 0 | 44104 | decor:merlon:limestone_merlon | C |
| world / fortification_e:mudbrick | 2 / 0 | 2 | 2 | 42174 | MeshStandardNodeMaterial | B/C |
| world / nr-cliff | 1 / 0 | 1 | 0 | 33260 | MeshStandardNodeMaterial | C |
| world / relief:far | 15 / 45 | 4 | 4 | 31835 | MeshStandardNodeMaterial | C |
| world / settlement:gardens:far | 1 / 0 | 1 | 1 | 31796 | MeshStandardNodeMaterial | C |
| world / settlement:channel_stones | 1 / 0 | 1 | 0 | 25128 | MeshStandardNodeMaterial | C |
| world / relief:rosettes | 1 / 0 | 608 | 608 | 24320 | MeshStandardNodeMaterial | C |
| world / c#:dressings:cloth | 1 / 0 | 1 | 1 | 23770 | MeshStandardNodeMaterial | C |
| world / apadana:palace_plaster | 1 / 0 | 1 | 1 | 23144 | MeshStandardNodeMaterial | B/C |
| world / apadana:columns:base_bell:lod# | 3 / 1 | 4 | 4 | 22880 | model:column_base_bell:0:limestone_carved, model:column_base_bell:1:limestone_carved | C |
| world / settlement:refuse | 1 / 0 | 1 | 1 | 21888 | MeshStandardNodeMaterial | C |
| world / settlement:roads | 1 / 0 | 1 | 1 | 20956 | MeshStandardNodeMaterial | C |
| world / garrison:mudbrick | 1 / 0 | 1 | 1 | 20292 | MeshStandardNodeMaterial | B/C |
| world / arris-band:limestone | 25 / 0 | 11 | 11 | 19248 | MeshStandardNodeMaterial | C |
| world / nr-life | 1 / 0 | 1 | 1 | 19006 | MeshStandardNodeMaterial | C |
| world / garrison:room_fittings | 1 / 0 | 1 | 0 | 16124 | MeshStandardNodeMaterial | C |
| world / apadana:columns:shaft:lod# | 5 / 1 | 4 | 4 | 15360 | model:column_shaft_f48:0:limestone_carved, model:column_shaft_f48:1:limestone_carved | C |
| world / apadana-glazed-frieze | 1 / 0 | 1 | 1 | 14912 | MeshStandardNodeMaterial | C |
| world / palace-glazed-bands | 1 / 0 | 1 | 1 | 14532 | MeshStandardNodeMaterial | C |
| world / bedrock-ground:talus#:lod# | 1 / 2 | 177 | 0 | 13983 | bedrock:ground |  |
| quarries-detail / plain-quarries:rock:quarry_sivand | 1 / 0 | 1 | 0 | 13745 | bedrock:ground |  |
| world / bedrock-ground:outcrop#:lod# | 2 / 1 | 114 | 0 | 12678 | bedrock:ground |  |
| world / nr_darius_tomb | 1 / 0 | 1 | 0 | 11154 | MeshStandardNodeMaterial | C |
| world / nr_xerxes_tomb | 1 / 0 | 1 | 0 | 11154 | MeshStandardNodeMaterial | C |
| world / fire-body:hearth:stone | 1 / 0 | 5 | 0 | 11000 | MeshStandardNodeMaterial | C |
| world / apadana:limestone | 2 / 0 | 2 | 2 | 10875 | MeshStandardNodeMaterial | C |
| world / gate_nations:colossus:lamassu:lod# | 2 / 2 | 2 | 0 | 9794 | model-paint:colossus_lamassu:0:limestone_carved, model-paint:colossus_lamassu:1:limestone_carved | C |
| world / settlement:compounds:far | 1 / 0 | 1 | 1 | 9482 | MeshStandardNodeMaterial | C |
| world / palace-furnishings:apadana:stored:bronze | 1 / 0 | 1 | 1 | 9440 | MeshStandardNodeMaterial | C |
| world / apadana:timber:ceiling | 1 / 0 | 1 | 1 | 9312 | MeshStandardNodeMaterial | C |
| world / settlement:water | 1 / 0 | 1 | 1 | 9242 | MeshStandardNodeMaterial | C |
| world / settlement:q_g#:far | 1 / 0 | 1 | 0 | 9204 | MeshStandardNodeMaterial | C |
| world / c#:drum-road:kerbs | 1 / 0 | 1 | 0 | 9164 | MeshStandardNodeMaterial | C |
| world / ledges:mid | 1 / 0 | 1 | 0 | 8390 | ledges |  |
| world / settlement:canal_banks | 1 / 0 | 1 | 0 | 7836 | MeshStandardNodeMaterial | C |
| world / props:tools | 2 / 2 | 4 | 0 | 7684 | MeshStandardNodeMaterial |  |
| world / crown-merlons:gate_nations|#|# | 2 / 0 | 37 | 0 | 7548 | decor:merlon:limestone_merlon | C |
| world / humans:persian:lod# | 2 / 2 | 2 | 1 | 7070 | human |  |
| world / terrace-foot:blocks | 1 / 0 | 1 | 1 | 6745 | MeshStandardNodeMaterial | C |
| plain-works / works:wo_brick_stack | 1 / 0 | 26 | 0 | 6708 | MeshStandardNodeMaterial | C |
| world / humans:envoy_short:lod# | 1 / 3 | 1 | 1 | 6593 | human |  |

</details>

## plain: the open plain, dusk (cov-406) (day 284, 17.156 h)

camera -6308.4, -1906.9, -24.8; sim people within 60 m: 0, within 250 m: 0; crowd stats: {"draws":0,"triangles":0,"people":0,"byLod":[0,0,0,0],"shadowDraws":0,"shadowTriangles":0,"propDraws":0,"props":0,"propTriangles":0,"propsDropped":0,"placeholderActs":0,"motionCapture":0,"motionAuthored":0,"things":{"draws":0,"instances":0,"triangles":0,"kinds":{},"dropped":0},"animals":{"draws":0,"

| class | meshes visible / hidden | instances in frustum | of them < 60 m | triangles in frustum |
|---|---|---|---|---|
| people (skinned, any LOD) | 0 / 50 | 0 | 0 | 0 |
| people LOD3 (far) | 0 / 0 | 0 | 0 | 0 |
| people impostors | 0 / 1 | 0 | 0 | 0 |
| house roofs | 11 / 7 | 0 | 0 | 0 |
| house walls | 4 / 0 | 0 | 0 | 0 |
| ground fill / props | 3 / 336 | 0 | 0 | 0 |
| trees | 22 / 0 | 16 | 0 | 181066 |
| crops / flora | 83 / 42 | 153 | 152 | 22048 |
| fires / lamps | 10 / 4 | 3133 | 0 | 6266 |
| water | 13 / 6 | 4 | 1 | 274970 |
| animals | 132 / 27 | 6 | 6 | 10803 |
| terrace architecture | 118 / 233 | 927 | 0 | 1690000 |

shadow-casting lights: [{"name":"","far":2000,"size":[240]}]

page: backend WebGL2, norender true, catch-up ticks 1 (still catching up: false), crowd looks pending 0

people in the frustum: within 40 m 0 of 0; within 60 m 0 of 0 (behind court walls for this eye: 0; to be drawn: 0)

| people mesh | visible / hidden meshes | instances (count) | in frustum | < 60 m |
|---|---|---|---|---|
| world / humans:persian:shadow | 0 / 1 | 1 | 0 | 0 |
| world / humans:persian:shadow-far | 0 / 1 | 1 | 0 | 0 |
| world / humans:persian:lod# | 0 / 4 | 4 | 0 | 0 |
| world / humans:median:shadow | 0 / 1 | 1 | 0 | 0 |
| world / humans:median:shadow-far | 0 / 1 | 1 | 0 | 0 |
| world / humans:median:lod# | 0 / 4 | 4 | 0 | 0 |
| world / humans:worker:shadow | 0 / 1 | 1 | 0 | 0 |
| world / humans:worker:shadow-far | 0 / 1 | 1 | 0 | 0 |
| world / humans:worker:lod# | 0 / 4 | 4 | 0 | 0 |
| world / humans:woman:shadow | 0 / 1 | 1 | 0 | 0 |
| world / humans:woman:shadow-far | 0 / 1 | 1 | 0 | 0 |
| world / humans:woman:lod# | 0 / 4 | 4 | 0 | 0 |
| world / humans:child:shadow | 0 / 1 | 1 | 0 | 0 |
| world / humans:child:shadow-far | 0 / 1 | 1 | 0 | 0 |
| world / humans:child:lod# | 0 / 4 | 4 | 0 | 0 |
| world / humans:envoy:shadow | 0 / 1 | 1 | 0 | 0 |
| world / humans:envoy:shadow-far | 0 / 1 | 1 | 0 | 0 |
| world / humans:envoy:lod# | 0 / 4 | 4 | 0 | 0 |
| world / humans:envoy_short:shadow | 0 / 1 | 1 | 0 | 0 |
| world / humans:envoy_short:shadow-far | 0 / 1 | 1 | 0 | 0 |
| world / humans:envoy_short:lod# | 0 / 4 | 4 | 0 | 0 |
| world / humans:envoy_bare:shadow | 0 / 1 | 1 | 0 | 0 |
| world / humans:envoy_bare:shadow-far | 0 / 1 | 1 | 0 | 0 |
| world / humans:envoy_bare:lod# | 0 / 4 | 4 | 0 | 0 |
| world / people:reins | 0 / 1 | 0 | 0 | 0 |
| world / people:hit | 0 / 1 | 1 | 0 | 0 |
| world / people:impostors | 0 / 1 | 1 | 0 | 0 |
| player-body / humans:median:lod# | 0 / 2 | 2 | 0 | 0 |

people: sim out of doors within 60 m 0 (open ground 0, inside walled courts 0, walking 0; places {}; 250 m 0); crowd attached 0, skinned drawn 0 by LOD [0,0,0,0], impostors drawn 0 of 200 candidates

town roofs (150 m round [-6332,-1962]): up-facing area above 1.8 m 0 m², wall area 0 m², ratio null (0 triangles)

<details><summary>all classes (top 60 by triangles)</summary>

| object key | vis / hidden | inst in frustum | < 60 m | tris | mats | tiers |
|---|---|---|---|---|---|---|
| world / relief:figures | 9 / 3 | 927 | 0 | 1690000 | MeshStandardNodeMaterial | C |
| terrain | 208 / 0 | 31 | 4 | 698112 | MeshStandardNodeMaterial | C |
| world / plain-orchards-far | 1 / 0 | 1 | 0 | 176772 | MeshStandardNodeMaterial |  |
| world / river-banks | 1 / 0 | 1 | 0 | 159880 | MeshStandardNodeMaterial | C |
| world / plain-villages--#,-# | 2 / 0 | 2 | 0 | 133082 | MeshStandardNodeMaterial | C |
| world / settlement:ground | 1 / 0 | 1 | 1 | 88536 | MeshStandardNodeMaterial | C |
| world / plain-stone | 1 / 0 | 1 | 1 | 84008 | MeshStandardNodeMaterial | C |
| world / plain-tracks | 1 / 0 | 1 | 0 | 75768 | MeshStandardNodeMaterial | C |
| world / plain-villages--#,# | 4 / 0 | 1 | 1 | 62844 | MeshStandardNodeMaterial | C |
| world / plain-canal-banks | 1 / 0 | 1 | 0 | 55524 | MeshStandardNodeMaterial | C |
| world / river-water | 1 / 0 | 1 | 0 | 50324 | MeshStandardNodeMaterial |  |
| world / settlement:refuse | 1 / 0 | 1 | 1 | 21888 | MeshStandardNodeMaterial | C |
| world / settlement:roads | 1 / 0 | 1 | 1 | 20956 | MeshStandardNodeMaterial | C |
| world / nr-life | 1 / 0 | 1 | 1 | 19006 | MeshStandardNodeMaterial | C |
| world / cover-tuft:tuft_m#c:lod# | 6 / 0 | 81 | 81 | 12628 | ground-cover |  |
| world / settlement:compounds:far | 1 / 0 | 1 | 1 | 9482 | MeshStandardNodeMaterial | C |
| world / settlement:water | 1 / 0 | 1 | 1 | 9242 | MeshStandardNodeMaterial | C |
| world / flora-camelthorn:didelta_spinosa_v#:lod# | 4 / 0 | 1 | 1 | 6903 | scan:didelta_spinosa_v1, scan:didelta_spinosa_v2 |  |
| world / cover-tuft:tuft_m#e:lod# | 3 / 0 | 35 | 35 | 4906 | ground-cover |  |
| world / cover-tuft:tuft_m#d:lod# | 3 / 0 | 39 | 39 | 4670 | ground-cover |  |
| world / cover-tuft:tuft_m#a:lod# | 3 / 0 | 32 | 32 | 4350 | ground-cover |  |
| world / fire | 1 / 0 | 2066 | 0 | 4132 | MeshBasicNodeMaterial |  |
| world / flora-camelthorn:shrub_#_v#:lod# | 8 / 0 | 5 | 5 | 3900 | scan:shrub_03_v1, scan:shrub_03_v2, scan:shrub_03_v3, scan:shrub_03_v4 |  |
| world / flora-grass:grass_medium_#_v#:lod# | 14 / 0 | 10 | 10 | 3239 | scan:grass_medium_01_v1, scan:grass_medium_01_v2, scan:grass_medium_01_v3, scan:grass_medium_01_v4 |  |
| Points | 1 / 0 | 1 | 0 | 2973 | PointsNodeMaterial |  |
| world / rock-stone:namaqualand_rocks_#_v#:lod# | 8 / 0 | 4 | 4 | 2899 | scan:namaqualand_rocks_01_v1, scan:namaqualand_rocks_01_v2, scan:namaqualand_rocks_01_v3, scan:namaqualand_rocks_01_v4 |  |
| world / cover-sward:sward_bmj:lod# | 3 / 0 | 51 | 51 | 2886 | ground-cover |  |
| world / cover-tuft:tuft_m#b:lod# | 3 / 0 | 29 | 29 | 2851 | ground-cover |  |
| world / cover-sward:sward_bmk:lod# | 3 / 0 | 35 | 35 | 2160 | ground-cover |  |
| world / fire:coals | 1 / 0 | 1067 | 0 | 2134 | MeshBasicNodeMaterial |  |
| world / cover-sward:sward_bmm:lod# | 3 / 0 | 40 | 40 | 1860 | ground-cover |  |
| world / flora-thistle:nettle_plant_v#:lod# | 8 / 0 | 3 | 3 | 982 | scan:nettle_plant_v1, scan:nettle_plant_v2, scan:nettle_plant_v5, scan:nettle_plant_v6 |  |
| Mesh | 2 / 2 | 2 | 0 | 972 | MeshBasicNodeMaterial, NodeMaterial |  |
| world / settlement:trees-wood-lod# | 2 / 0 | 2 | 0 | 896 | MeshStandardNodeMaterial |  |
| world / plain-trees-wood-lod# | 2 / 0 | 2 | 0 | 896 | MeshStandardNodeMaterial |  |
| world / settlement:trees-leaves-lod# | 2 / 0 | 2 | 0 | 880 | MeshStandardNodeMaterial |  |
| world / plain-trees-leaves-lod# | 2 / 0 | 2 | 0 | 880 | MeshStandardNodeMaterial |  |
| world / rock-stone:rock_#:lod# | 4 / 0 | 2 | 2 | 599 | scan:rock_07, scan:rock_09 |  |
| world / rock-stone:namaqualand_stones_#_v#:lod# | 10 / 0 | 2 | 2 | 398 | scan:namaqualand_stones_01_v1, scan:namaqualand_stones_01_v2, scan:namaqualand_stones_01_v3, scan:namaqualand_stones_01_v4 |  |
| world / settlement:trees-noshadow-leaves-lod# | 1 / 0 | 1 | 0 | 240 | MeshStandardNodeMaterial |  |
| world / plain-trees-noshadow-leaves-lod# | 1 / 0 | 1 | 0 | 240 | MeshStandardNodeMaterial |  |
| world / settlement:trees-noshadow-wood-lod# | 1 / 0 | 1 | 0 | 128 | MeshStandardNodeMaterial |  |
| world / plain-trees-noshadow-wood-lod# | 1 / 0 | 1 | 0 | 128 | MeshStandardNodeMaterial |  |
| world / rock-stone:stone_#:lod# | 2 / 0 | 1 | 1 | 119 | scan:stone_01 |  |
| world / flora-grass:grass_bermuda_#_v#:lod# | 6 / 0 | 7 | 7 | 84 | scan:grass_bermuda_01_v1, scan:grass_bermuda_01_v2, scan:grass_bermuda_01_v3 |  |
| world / plain-crops-near | 1 / 0 | 1 | 0 | 34 | MeshStandardNodeMaterial |  |
| world / settlement:smoke-plumes | 1 / 0 | 1 | 0 | 16 | MeshBasicNodeMaterial |  |
| world / plain-margins | 1 / 0 | 1 | 0 | 14 | MeshStandardNodeMaterial |  |
| world / landsmoke:outside | 1 / 0 | 1 | 0 | 12 | MeshBasicNodeMaterial |  |
| planets | 1 / 0 | 1 | 0 | 2 | PointsNodeMaterial |  |
| world / settlement:trees:far | 1 / 0 | 1 | 0 | 2 | MeshStandardNodeMaterial |  |
| world / plain-trees-far | 1 / 0 | 1 | 0 | 2 | MeshStandardNodeMaterial |  |
| world / plain-trees-mid | 1 / 0 | 1 | 0 | 2 | MeshStandardNodeMaterial |  |
| world / relief:far | 0 / 60 | 0 | 0 | 0 | MeshStandardNodeMaterial | C |
| world / doors | 3 / 42 | 0 | 0 | 0 | MeshStandardNodeMaterial | C |
| plain-qanats / qanat-tile:#,-# | 0 / 15 | 0 | 0 | 0 | MeshStandardNodeMaterial | C |
| plain-qanats / qanat-tile:#,# | 0 / 14 | 0 | 0 | 0 | MeshStandardNodeMaterial | C |
| world / ford-cobbles:#:lod# | 0 / 9 | 0 | 0 | 0 | ford:cobbles |  |
| world / door-sealing:treasury:w_stores_#_E | 0 / 7 | 0 | 0 | 0 | clay-writing |  |
| world / writing:door_sealing:treasury:w_stores_#_E:pick | 0 / 7 | 0 | 0 | 0 | MeshBasicNodeMaterial |  |

</details>

## approach_dawn: the Terrace approach at dawn (cov-196; area approach, not fields) (day 126, 5.635 h)

camera -491.3, -73.3, -12.5; sim people within 60 m: 0, within 250 m: 149; crowd stats: {"draws":5,"triangles":8617,"people":12,"byLod":[0,0,0,12],"shadowDraws":0,"shadowTriangles":0,"propDraws":1,"props":10,"propTriangles":40560,"propsDropped":0,"placeholderActs":0,"motionCapture":8,"motionAuthored":4,"things":{"draws":0,"instances":0,"triangles":0,"kinds":{},"dropped":0},"animals":{"

| class | meshes visible / hidden | instances in frustum | of them < 60 m | triangles in frustum |
|---|---|---|---|---|
| people (skinned, any LOD) | 5 / 45 | 5 | 0 | 3373 |
| people LOD3 (far) | 0 / 0 | 0 | 0 | 0 |
| people impostors | 1 / 0 | 1 | 0 | 2 |
| house roofs | 11 / 7 | 727 | 0 | 10212 |
| house walls | 4 / 0 | 18 | 1 | 1184 |
| ground fill / props | 5 / 334 | 14 | 0 | 41876 |
| trees | 22 / 0 | 16 | 0 | 181066 |
| crops / flora | 85 / 40 | 126 | 83 | 22696 |
| fires / lamps | 11 / 3 | 1128 | 0 | 56676 |
| water | 13 / 6 | 7 | 1 | 284838 |
| animals | 135 / 25 | 168 | 1 | 91399 |
| terrace architecture | 119 / 232 | 2566 | 0 | 1903528 |

shadow-casting lights: [{"name":"","far":2000,"size":[240]}]

page: backend WebGL2, norender true, catch-up ticks 1 (still catching up: false), crowd looks pending 0

people in the frustum: within 40 m 0 of 0; within 60 m 0 of 0 (behind court walls for this eye: 0; to be drawn: 0)

| people mesh | visible / hidden meshes | instances (count) | in frustum | < 60 m |
|---|---|---|---|---|
| world / humans:persian:shadow | 0 / 1 | 1 | 0 | 0 |
| world / humans:persian:shadow-far | 0 / 1 | 1 | 0 | 0 |
| world / humans:persian:lod# | 1 / 3 | 4 | 1 | 0 |
| world / humans:median:shadow | 0 / 1 | 1 | 0 | 0 |
| world / humans:median:shadow-far | 0 / 1 | 1 | 0 | 0 |
| world / humans:median:lod# | 1 / 3 | 4 | 1 | 0 |
| world / humans:worker:shadow | 0 / 1 | 1 | 0 | 0 |
| world / humans:worker:shadow-far | 0 / 1 | 1 | 0 | 0 |
| world / humans:worker:lod# | 1 / 3 | 4 | 1 | 0 |
| world / humans:woman:shadow | 0 / 1 | 1 | 0 | 0 |
| world / humans:woman:shadow-far | 0 / 1 | 1 | 0 | 0 |
| world / humans:woman:lod# | 1 / 3 | 4 | 1 | 0 |
| world / humans:child:shadow | 0 / 1 | 1 | 0 | 0 |
| world / humans:child:shadow-far | 0 / 1 | 1 | 0 | 0 |
| world / humans:child:lod# | 1 / 3 | 4 | 1 | 0 |
| world / humans:envoy:shadow | 0 / 1 | 1 | 0 | 0 |
| world / humans:envoy:shadow-far | 0 / 1 | 1 | 0 | 0 |
| world / humans:envoy:lod# | 0 / 4 | 4 | 0 | 0 |
| world / humans:envoy_short:shadow | 0 / 1 | 1 | 0 | 0 |
| world / humans:envoy_short:shadow-far | 0 / 1 | 1 | 0 | 0 |
| world / humans:envoy_short:lod# | 0 / 4 | 4 | 0 | 0 |
| world / humans:envoy_bare:shadow | 0 / 1 | 1 | 0 | 0 |
| world / humans:envoy_bare:shadow-far | 0 / 1 | 1 | 0 | 0 |
| world / humans:envoy_bare:lod# | 0 / 4 | 4 | 0 | 0 |
| world / people:reins | 0 / 1 | 0 | 0 | 0 |
| world / people:hit | 0 / 1 | 1 | 0 | 0 |
| world / people:impostors | 1 / 0 | 1 | 1 | 0 |
| player-body / humans:median:lod# | 0 / 2 | 2 | 0 | 0 |

people: sim out of doors within 60 m 0 (open ground 0, inside walled courts 0, walking 0; places {}; 250 m 149); crowd attached 394, skinned drawn 12 by LOD [0,0,0,12], impostors drawn 642 of 2491 candidates

town roofs (150 m round [-448,-115]): up-facing area above 1.8 m 0 m², wall area 0 m², ratio null (0 triangles)

<details><summary>all classes (top 60 by triangles)</summary>

| object key | vis / hidden | inst in frustum | < 60 m | tris | mats | tiers |
|---|---|---|---|---|---|---|
| world / relief:figures | 9 / 3 | 927 | 0 | 1690000 | MeshStandardNodeMaterial | C |
| terrain | 208 / 0 | 76 | 3 | 712960 | MeshStandardNodeMaterial | C |
| world / treasury:arrow_bundle | 1 / 0 | 487 | 0 | 428560 | MeshStandardNodeMaterial | C |
| world / treasury:alabaster_vessel | 1 / 0 | 894 | 0 | 402300 | MeshStandardNodeMaterial | C |
| world / treasury:textile_bale | 1 / 0 | 406 | 0 | 230608 | MeshStandardNodeMaterial | C |
| world / plain-orchards-far | 1 / 0 | 1 | 0 | 176772 | MeshStandardNodeMaterial |  |
| world / river-banks | 1 / 0 | 1 | 0 | 159880 | MeshStandardNodeMaterial | C |
| world / treasury:chert_set | 1 / 0 | 487 | 0 | 135386 | MeshStandardNodeMaterial | C |
| world / harem:room_fittings:bedrolls | 1 / 0 | 176 | 0 | 132352 | MeshStandardNodeMaterial | C |
| world / treasury:scale_armour | 1 / 0 | 203 | 0 | 115304 | MeshStandardNodeMaterial | C |
| world / plain-villages-#,# | 2 / 0 | 2 | 1 | 115224 | MeshStandardNodeMaterial | C |
| world / settlement:q_s#:far | 4 / 0 | 1 | 0 | 114540 | MeshStandardNodeMaterial | C |
| world / crown-merlons:harem|#|-# | 4 / 0 | 962 | 0 | 108258 | decor:merlon:limestone_merlon | C |
| world / harem:room_fittings:mats | 1 / 0 | 117 | 0 | 104715 | MeshStandardNodeMaterial | C |
| world / work:objects | 1 / 0 | 1 | 0 | 92036 | MeshStandardNodeMaterial |  |
| world / settlement:ground | 1 / 0 | 1 | 1 | 88536 | MeshStandardNodeMaterial | C |
| world / treasury:bitumen_jar | 1 / 0 | 284 | 0 | 87472 | MeshStandardNodeMaterial | C |
| world / treasury:silver_phiale | 1 / 0 | 244 | 0 | 87352 | MeshStandardNodeMaterial | C |
| world / plain-stone | 1 / 0 | 1 | 1 | 84008 | MeshStandardNodeMaterial | C |
| world / treasury:blue_vessel | 1 / 0 | 244 | 0 | 81984 | MeshStandardNodeMaterial | C |
| world / plain-tracks | 1 / 0 | 1 | 0 | 75768 | MeshStandardNodeMaterial | C |
| world / treasury:sealed_jar | 1 / 0 | 244 | 0 | 75152 | MeshStandardNodeMaterial | C |
| world / treasury:shield | 1 / 0 | 162 | 0 | 70956 | MeshStandardNodeMaterial | C |
| world / doors:bands | 1 / 0 | 376 | 0 | 70688 | MeshStandardNodeMaterial | C |
| world / plain-canal-banks | 1 / 0 | 1 | 0 | 55524 | MeshStandardNodeMaterial | C |
| world / harem:room_fittings:mats_b | 1 / 0 | 59 | 0 | 52805 | MeshStandardNodeMaterial | C |
| world / river-water | 1 / 0 | 1 | 0 | 50324 | MeshStandardNodeMaterial |  |
| world / doors:shoes | 1 / 0 | 94 | 0 | 48128 | MeshStandardNodeMaterial | C |
| world / treasury:bead_bowl | 1 / 0 | 122 | 0 | 46848 | MeshStandardNodeMaterial | C |
| world / ledges:far | 1 / 0 | 1 | 0 | 42960 | ledges |  |
| world / treasury:room_fittings:jars | 1 / 0 | 96 | 0 | 42624 | MeshStandardNodeMaterial | C |
| world / fortification_e:mudbrick | 2 / 0 | 2 | 0 | 41744 | MeshStandardNodeMaterial | B/C |
| world / treasury:glass_bowl | 1 / 0 | 122 | 0 | 40992 | MeshStandardNodeMaterial |  |
| world / props:carried | 1 / 0 | 10 | 0 | 40560 | MeshStandardNodeMaterial |  |
| world / animals:sheep:lod# | 1 / 1 | 39 | 0 | 38220 | MeshStandardNodeMaterial |  |
| plain-qanats / qanat-tile:#,-# | 3 / 12 | 391 | 0 | 35190 | MeshStandardNodeMaterial | C |
| world / animals:goat:lod# | 1 / 2 | 34 | 0 | 33320 | MeshStandardNodeMaterial |  |
| world / settlement:gardens:far | 1 / 0 | 1 | 1 | 31796 | MeshStandardNodeMaterial | C |
| world / harem:room_fittings:jars | 1 / 0 | 70 | 0 | 31080 | MeshStandardNodeMaterial | C |
| world / crown-merlons:terrace|-#|-# | 2 / 0 | 255 | 0 | 30600 | decor:merlon:limestone_merlon | C |
| world / scribes:tablets_filed | 1 / 0 | 354 | 0 | 26904 | clay-writing |  |
| world / treasury:gold_rhyton | 1 / 0 | 81 | 0 | 25434 | MeshStandardNodeMaterial | C |
| world / c#:dressings:cloth | 1 / 0 | 1 | 0 | 23770 | MeshStandardNodeMaterial | C |
| world / crown-merlons:terrace|#|-# | 2 / 0 | 223 | 0 | 23378 | decor:merlon:limestone_merlon | C |
| world / garrison:room_fittings:mats | 1 / 0 | 26 | 0 | 23270 | MeshStandardNodeMaterial | C |
| world / settlement:refuse | 1 / 0 | 1 | 1 | 21888 | MeshStandardNodeMaterial | C |
| world / settlement:roads | 1 / 0 | 1 | 1 | 20956 | MeshStandardNodeMaterial | C |
| world / doors:leaves | 1 / 0 | 94 | 0 | 20680 | MeshStandardNodeMaterial | C |
| world / garrison:room_fittings:bedrolls | 1 / 0 | 27 | 0 | 20304 | MeshStandardNodeMaterial | C |
| world / nr-life | 1 / 0 | 1 | 1 | 19006 | MeshStandardNodeMaterial | C |
| world / apadana:mudbrick | 1 / 0 | 1 | 0 | 18186 | MeshStandardNodeMaterial | B/C |
| world / fire-body:hearth:stone | 1 / 0 | 8 | 0 | 17600 | MeshStandardNodeMaterial | C |
| world / garrison:room_fittings | 1 / 0 | 1 | 0 | 16124 | MeshStandardNodeMaterial | C |
| world / apadana-glazed-frieze | 1 / 0 | 1 | 0 | 14912 | MeshStandardNodeMaterial | C |
| world / harem:timber:ceiling | 1 / 0 | 1 | 0 | 14550 | MeshStandardNodeMaterial | C |
| world / palace-glazed-bands | 1 / 0 | 1 | 0 | 14532 | MeshStandardNodeMaterial | C |
| world / hadish:columns:protome:lod# | 1 / 1 | 48 | 0 | 13824 | model-paint:capital_protome:0:limestone_carved, model-paint:capital_protome:1:limestone_carved | C |
| world / fire-body:torch:head | 1 / 0 | 14 | 0 | 13048 | MeshStandardNodeMaterial | C |
| world / garrison:room_fittings:mats_b | 1 / 0 | 14 | 0 | 12530 | MeshStandardNodeMaterial | C |
| world / crown-merlons:hadish|#|-# | 1 / 0 | 100 | 0 | 12000 | decor:merlon:limestone_merlon | C |

</details>

## field_spring: plain fields, day 58 08:24 (cov-096) (day 58, 8.402 h)

camera -5806.8, 1649.7, -20.2; sim people within 60 m: 0, within 250 m: 0; crowd stats: {"draws":0,"triangles":0,"people":0,"byLod":[0,0,0,0],"shadowDraws":0,"shadowTriangles":0,"propDraws":0,"props":0,"propTriangles":0,"propsDropped":0,"placeholderActs":0,"motionCapture":0,"motionAuthored":0,"things":{"draws":0,"instances":0,"triangles":0,"kinds":{},"dropped":0},"animals":{"draws":0,"

| class | meshes visible / hidden | instances in frustum | of them < 60 m | triangles in frustum |
|---|---|---|---|---|
| people (skinned, any LOD) | 0 / 50 | 0 | 0 | 0 |
| people LOD3 (far) | 0 / 0 | 0 | 0 | 0 |
| people impostors | 1 / 0 | 1 | 0 | 2 |
| house roofs | 11 / 7 | 0 | 0 | 0 |
| house walls | 4 / 0 | 0 | 0 | 0 |
| ground fill / props | 10 / 329 | 29 | 0 | 15912 |
| trees | 22 / 0 | 16 | 0 | 181066 |
| crops / flora | 83 / 42 | 116 | 91 | 25830 |
| fires / lamps | 10 / 4 | 3857 | 0 | 7714 |
| water | 13 / 6 | 56 | 1 | 309299 |
| animals | 131 / 29 | 9 | 7 | 6797 |
| terrace architecture | 118 / 233 | 927 | 0 | 1690000 |

shadow-casting lights: [{"name":"","far":2000,"size":[240]}]

page: backend WebGL2, norender true, catch-up ticks 0 (still catching up: false), crowd looks pending 0

people in the frustum: within 40 m 0 of 0; within 60 m 0 of 0 (behind court walls for this eye: 0; to be drawn: 0)

| people mesh | visible / hidden meshes | instances (count) | in frustum | < 60 m |
|---|---|---|---|---|
| world / humans:persian:shadow | 0 / 1 | 1 | 0 | 0 |
| world / humans:persian:shadow-far | 0 / 1 | 1 | 0 | 0 |
| world / humans:persian:lod# | 0 / 4 | 4 | 0 | 0 |
| world / humans:median:shadow | 0 / 1 | 1 | 0 | 0 |
| world / humans:median:shadow-far | 0 / 1 | 1 | 0 | 0 |
| world / humans:median:lod# | 0 / 4 | 4 | 0 | 0 |
| world / humans:worker:shadow | 0 / 1 | 1 | 0 | 0 |
| world / humans:worker:shadow-far | 0 / 1 | 1 | 0 | 0 |
| world / humans:worker:lod# | 0 / 4 | 4 | 0 | 0 |
| world / humans:woman:shadow | 0 / 1 | 1 | 0 | 0 |
| world / humans:woman:shadow-far | 0 / 1 | 1 | 0 | 0 |
| world / humans:woman:lod# | 0 / 4 | 4 | 0 | 0 |
| world / humans:child:shadow | 0 / 1 | 1 | 0 | 0 |
| world / humans:child:shadow-far | 0 / 1 | 1 | 0 | 0 |
| world / humans:child:lod# | 0 / 4 | 4 | 0 | 0 |
| world / humans:envoy:shadow | 0 / 1 | 1 | 0 | 0 |
| world / humans:envoy:shadow-far | 0 / 1 | 1 | 0 | 0 |
| world / humans:envoy:lod# | 0 / 4 | 4 | 0 | 0 |
| world / humans:envoy_short:shadow | 0 / 1 | 1 | 0 | 0 |
| world / humans:envoy_short:shadow-far | 0 / 1 | 1 | 0 | 0 |
| world / humans:envoy_short:lod# | 0 / 4 | 4 | 0 | 0 |
| world / humans:envoy_bare:shadow | 0 / 1 | 1 | 0 | 0 |
| world / humans:envoy_bare:shadow-far | 0 / 1 | 1 | 0 | 0 |
| world / humans:envoy_bare:lod# | 0 / 4 | 4 | 0 | 0 |
| world / people:reins | 0 / 1 | 0 | 0 | 0 |
| world / people:hit | 0 / 1 | 1 | 0 | 0 |
| world / people:impostors | 1 / 0 | 1 | 1 | 0 |
| player-body / humans:median:lod# | 0 / 2 | 2 | 0 | 0 |

people: sim out of doors within 60 m 0 (open ground 0, inside walled courts 0, walking 0; places {}; 250 m 0); crowd attached 3, skinned drawn 0 by LOD [0,0,0,0], impostors drawn 311 of 735 candidates

town roofs (150 m round [-5955,1673]): up-facing area above 1.8 m 0 m², wall area 0 m², ratio null (0 triangles)

<details><summary>all classes (top 60 by triangles)</summary>

| object key | vis / hidden | inst in frustum | < 60 m | tris | mats | tiers |
|---|---|---|---|---|---|---|
| world / relief:figures | 9 / 3 | 927 | 0 | 1690000 | MeshStandardNodeMaterial | C |
| terrain | 208 / 0 | 27 | 2 | 774400 | MeshStandardNodeMaterial | C |
| world / plain-villages--#,# | 4 / 0 | 3 | 1 | 208652 | MeshStandardNodeMaterial | C |
| world / plain-orchards-far | 1 / 0 | 1 | 0 | 176772 | MeshStandardNodeMaterial |  |
| world / river-banks | 1 / 0 | 1 | 0 | 159880 | MeshStandardNodeMaterial | C |
| world / settlement:ground | 1 / 0 | 1 | 1 | 88536 | MeshStandardNodeMaterial | C |
| world / plain-stone | 1 / 0 | 1 | 1 | 84008 | MeshStandardNodeMaterial | C |
| world / plain-tracks | 1 / 0 | 1 | 0 | 75768 | MeshStandardNodeMaterial | C |
| world / plain-canal-banks | 1 / 0 | 1 | 0 | 55524 | MeshStandardNodeMaterial | C |
| world / river-water | 1 / 0 | 1 | 0 | 50324 | MeshStandardNodeMaterial |  |
| plain-waterworks / works:wo_shaduf | 1 / 0 | 36 | 0 | 28944 | MeshStandardNodeMaterial | C |
| world / settlement:refuse | 1 / 0 | 1 | 1 | 21888 | MeshStandardNodeMaterial | C |
| world / settlement:roads | 1 / 0 | 1 | 1 | 20956 | MeshStandardNodeMaterial | C |
| world / nr-life | 1 / 0 | 1 | 1 | 19006 | MeshStandardNodeMaterial | C |
| plain-field-fill / field:fill_stall_reed:lod# | 1 / 1 | 24 | 0 | 14688 | MeshStandardNodeMaterial | C |
| quarries-detail / plain-quarries:rock:quarry_majdabad | 1 / 0 | 1 | 0 | 13745 | bedrock:ground |  |
| world / settlement:compounds:far | 1 / 0 | 1 | 1 | 9482 | MeshStandardNodeMaterial | C |
| world / settlement:water | 1 / 0 | 1 | 1 | 9242 | MeshStandardNodeMaterial | C |
| world / cover-stubble:stubble_c:lod# | 2 / 1 | 49 | 49 | 5978 | ground-cover |  |
| world / cover-tuft:tuft_m#c:lod# | 6 / 0 | 40 | 40 | 5392 | ground-cover |  |
| world / fire | 1 / 0 | 2545 | 0 | 5090 | MeshBasicNodeMaterial |  |
| world / flora-camelthorn:didelta_spinosa_v#:lod# | 4 / 0 | 1 | 1 | 4353 | scan:didelta_spinosa_v1, scan:didelta_spinosa_v2 |  |
| world / cover-stubble:stubble_a:lod# | 2 / 1 | 45 | 45 | 3510 | ground-cover |  |
| Points | 1 / 0 | 1 | 0 | 2973 | PointsNodeMaterial |  |
| world / cover-tuft:tuft_m#b:lod# | 2 / 1 | 21 | 21 | 2759 | ground-cover |  |
| world / fire:coals | 1 / 0 | 1312 | 0 | 2624 | MeshBasicNodeMaterial |  |
| plain-waterworks / works:wo_pontoon | 1 / 0 | 7 | 0 | 2352 | MeshStandardNodeMaterial | C |
| world / flora-camelthorn:shrub_#_v#:lod# | 8 / 0 | 3 | 3 | 2100 | scan:shrub_03_v1, scan:shrub_03_v2, scan:shrub_03_v3, scan:shrub_03_v4 |  |
| world / cover-tuft:tuft_m#e:lod# | 3 / 0 | 16 | 16 | 1524 | ground-cover |  |
| world / cover-tuft:tuft_m#a:lod# | 3 / 0 | 21 | 21 | 1500 | ground-cover |  |
| world / flora-grass:grass_medium_#_v#:lod# | 14 / 0 | 8 | 8 | 1438 | scan:grass_medium_01_v1, scan:grass_medium_01_v2, scan:grass_medium_01_v3, scan:grass_medium_01_v4 |  |
| world / cover-tuft:tuft_m#d:lod# | 3 / 0 | 14 | 14 | 1399 | ground-cover |  |
| plain-waterworks / works:wo_fish_trap | 1 / 0 | 3 | 0 | 1146 | MeshStandardNodeMaterial | C |
| world / cover-sward:sward_bmk:lod# | 3 / 0 | 26 | 26 | 1130 | ground-cover |  |
| world / cover-sward:sward_bmm:lod# | 2 / 1 | 25 | 25 | 1110 | ground-cover |  |
| plain-waterworks / works:wo_net_poles | 1 / 0 | 3 | 0 | 993 | MeshStandardNodeMaterial | C |
| Mesh | 2 / 2 | 2 | 0 | 972 | MeshBasicNodeMaterial, NodeMaterial |  |
| world / cover-sward:sward_bmj:lod# | 3 / 0 | 25 | 25 | 927 | ground-cover |  |
| world / settlement:trees-wood-lod# | 2 / 0 | 2 | 0 | 896 | MeshStandardNodeMaterial |  |
| world / plain-trees-wood-lod# | 2 / 0 | 2 | 0 | 896 | MeshStandardNodeMaterial |  |
| plain-waterworks / works:wo_skiff | 1 / 0 | 3 | 0 | 894 | MeshStandardNodeMaterial | C |
| world / settlement:trees-leaves-lod# | 2 / 0 | 2 | 0 | 880 | MeshStandardNodeMaterial |  |
| world / plain-trees-leaves-lod# | 2 / 0 | 2 | 0 | 880 | MeshStandardNodeMaterial |  |
| world / rock-stone:namaqualand_stones_#_v#:lod# | 10 / 0 | 4 | 4 | 799 | scan:namaqualand_stones_01_v1, scan:namaqualand_stones_01_v2, scan:namaqualand_stones_01_v3, scan:namaqualand_stones_01_v4 |  |
| world / rock-stone:namaqualand_rocks_#_v#:lod# | 8 / 0 | 3 | 3 | 748 | scan:namaqualand_rocks_01_v1, scan:namaqualand_rocks_01_v2, scan:namaqualand_rocks_01_v3, scan:namaqualand_rocks_01_v4 |  |
| plain-field-fill / field:wo_fodder:lod# | 1 / 1 | 2 | 0 | 376 | MeshStandardNodeMaterial | C |
| plain-field-fill / field:wo_grain_heap:lod# | 1 / 1 | 1 | 0 | 354 | MeshStandardNodeMaterial | C |
| plain-field-fill / field:wo_threshing_floor:lod# | 1 / 1 | 1 | 0 | 332 | MeshStandardNodeMaterial | C |
| quarries-detail / plain-quarries:drums:quarry_majdabad | 1 / 0 | 1 | 0 | 288 | MeshStandardNodeMaterial | C |
| world / settlement:trees-noshadow-leaves-lod# | 1 / 0 | 1 | 0 | 240 | MeshStandardNodeMaterial |  |
| world / plain-trees-noshadow-leaves-lod# | 1 / 0 | 1 | 0 | 240 | MeshStandardNodeMaterial |  |
| world / bird-crow:stand# | 2 / 0 | 1 | 0 | 176 | life:crow |  |
| plain-field-fill / field:wo_sledge:lod# | 1 / 1 | 1 | 0 | 162 | MeshStandardNodeMaterial | C |
| world / settlement:trees-noshadow-wood-lod# | 1 / 0 | 1 | 0 | 128 | MeshStandardNodeMaterial |  |
| world / plain-trees-noshadow-wood-lod# | 1 / 0 | 1 | 0 | 128 | MeshStandardNodeMaterial |  |
| world / rock-stone:stone_#:lod# | 2 / 0 | 1 | 1 | 119 | scan:stone_01 |  |
| world / cover-dung:dung_horse:lod# | 1 / 2 | 3 | 3 | 108 | ground-cover |  |
| world / bird-crow:fly# | 3 / 0 | 1 | 0 | 60 | life:crow |  |
| world / flora-grass:grass_bermuda_#_v#:lod# | 6 / 0 | 3 | 3 | 50 | scan:grass_bermuda_01_v1, scan:grass_bermuda_01_v2, scan:grass_bermuda_01_v3 |  |
| world / plain-crops-near | 1 / 0 | 1 | 0 | 34 | MeshStandardNodeMaterial |  |

</details>

## field_autumn: plain fields, day 272 07:19 (cov-387) (day 272, 7.322 h)

camera 4193.5, 1809.4, 72.8; sim people within 60 m: 0, within 250 m: 0; crowd stats: {"draws":0,"triangles":0,"people":0,"byLod":[0,0,0,0],"shadowDraws":0,"shadowTriangles":0,"propDraws":0,"props":0,"propTriangles":0,"propsDropped":0,"placeholderActs":0,"motionCapture":0,"motionAuthored":0,"things":{"draws":0,"instances":0,"triangles":0,"kinds":{},"dropped":0},"animals":{"draws":0,"

| class | meshes visible / hidden | instances in frustum | of them < 60 m | triangles in frustum |
|---|---|---|---|---|
| people (skinned, any LOD) | 0 / 50 | 0 | 0 | 0 |
| people LOD3 (far) | 0 / 0 | 0 | 0 | 0 |
| people impostors | 1 / 0 | 1 | 0 | 2 |
| house roofs | 11 / 7 | 1376 | 0 | 17856 |
| house walls | 4 / 0 | 1 | 0 | 300 |
| ground fill / props | 4 / 335 | 2 | 0 | 92 |
| trees | 22 / 0 | 16 | 0 | 181066 |
| crops / flora | 87 / 38 | 919 | 231 | 152719 |
| fires / lamps | 10 / 4 | 13471 | 0 | 153090 |
| water | 13 / 6 | 105 | 2 | 369267 |
| animals | 135 / 25 | 311 | 3 | 161918 |
| terrace architecture | 118 / 233 | 4157 | 0 | 2020712 |

shadow-casting lights: [{"name":"","far":2000,"size":[240]}]

page: backend WebGL2, norender true, catch-up ticks 0 (still catching up: false), crowd looks pending 0

people in the frustum: within 40 m 0 of 0; within 60 m 0 of 0 (behind court walls for this eye: 0; to be drawn: 0)

| people mesh | visible / hidden meshes | instances (count) | in frustum | < 60 m |
|---|---|---|---|---|
| world / humans:persian:shadow | 0 / 1 | 1 | 0 | 0 |
| world / humans:persian:shadow-far | 0 / 1 | 1 | 0 | 0 |
| world / humans:persian:lod# | 0 / 4 | 4 | 0 | 0 |
| world / humans:median:shadow | 0 / 1 | 1 | 0 | 0 |
| world / humans:median:shadow-far | 0 / 1 | 1 | 0 | 0 |
| world / humans:median:lod# | 0 / 4 | 4 | 0 | 0 |
| world / humans:worker:shadow | 0 / 1 | 1 | 0 | 0 |
| world / humans:worker:shadow-far | 0 / 1 | 1 | 0 | 0 |
| world / humans:worker:lod# | 0 / 4 | 4 | 0 | 0 |
| world / humans:woman:shadow | 0 / 1 | 1 | 0 | 0 |
| world / humans:woman:shadow-far | 0 / 1 | 1 | 0 | 0 |
| world / humans:woman:lod# | 0 / 4 | 4 | 0 | 0 |
| world / humans:child:shadow | 0 / 1 | 1 | 0 | 0 |
| world / humans:child:shadow-far | 0 / 1 | 1 | 0 | 0 |
| world / humans:child:lod# | 0 / 4 | 4 | 0 | 0 |
| world / humans:envoy:shadow | 0 / 1 | 1 | 0 | 0 |
| world / humans:envoy:shadow-far | 0 / 1 | 1 | 0 | 0 |
| world / humans:envoy:lod# | 0 / 4 | 4 | 0 | 0 |
| world / humans:envoy_short:shadow | 0 / 1 | 1 | 0 | 0 |
| world / humans:envoy_short:shadow-far | 0 / 1 | 1 | 0 | 0 |
| world / humans:envoy_short:lod# | 0 / 4 | 4 | 0 | 0 |
| world / humans:envoy_bare:shadow | 0 / 1 | 1 | 0 | 0 |
| world / humans:envoy_bare:shadow-far | 0 / 1 | 1 | 0 | 0 |
| world / humans:envoy_bare:lod# | 0 / 4 | 4 | 0 | 0 |
| world / people:reins | 0 / 1 | 0 | 0 | 0 |
| world / people:hit | 0 / 1 | 1 | 0 | 0 |
| world / people:impostors | 1 / 0 | 1 | 1 | 0 |
| player-body / humans:median:lod# | 0 / 2 | 2 | 0 | 0 |

people: sim out of doors within 60 m 0 (open ground 0, inside walled courts 0, walking 0; places {}; 250 m 0); crowd attached 0, skinned drawn 0 by LOD [0,0,0,0], impostors drawn 1079 of 1335 candidates

town roofs (150 m round [4134,1820]): up-facing area above 1.8 m 0 m², wall area 0 m², ratio null (0 triangles)

<details><summary>all classes (top 60 by triangles)</summary>

| object key | vis / hidden | inst in frustum | < 60 m | tris | mats | tiers |
|---|---|---|---|---|---|---|
| world / relief:figures | 9 / 3 | 927 | 0 | 1690000 | MeshStandardNodeMaterial | C |
| terrain | 208 / 0 | 121 | 2 | 784128 | MeshStandardNodeMaterial | C |
| world / garrison:room_fittings:bedrolls | 1 / 0 | 624 | 0 | 469248 | MeshStandardNodeMaterial | C |
| world / treasury:arrow_bundle | 1 / 0 | 487 | 0 | 428560 | MeshStandardNodeMaterial | C |
| world / treasury:alabaster_vessel | 1 / 0 | 894 | 0 | 402300 | MeshStandardNodeMaterial | C |
| world / garrison:room_fittings:mats | 1 / 0 | 416 | 0 | 372320 | MeshStandardNodeMaterial | C |
| world / settlement:q_s#:far | 4 / 0 | 4 | 0 | 317074 | MeshStandardNodeMaterial | C |
| world / settlement:q_w#:far | 3 / 0 | 3 | 0 | 286968 | MeshStandardNodeMaterial | C |
| world / plain-villages--#,# | 4 / 0 | 4 | 0 | 248574 | MeshStandardNodeMaterial | C |
| world / treasury:textile_bale | 1 / 0 | 406 | 0 | 230608 | MeshStandardNodeMaterial | C |
| world / garrison:room_fittings:mats_b | 1 / 0 | 208 | 0 | 186160 | MeshStandardNodeMaterial | C |
| world / plain-orchards-far | 1 / 0 | 1 | 0 | 176772 | MeshStandardNodeMaterial |  |
| world / river-banks | 1 / 0 | 1 | 0 | 159880 | MeshStandardNodeMaterial | C |
| plain-works / works:wo_brick_field | 1 / 0 | 591 | 0 | 150114 | MeshStandardNodeMaterial | C |
| world / treasury:chert_set | 1 / 0 | 487 | 0 | 135386 | MeshStandardNodeMaterial | C |
| world / harem:room_fittings:bedrolls | 1 / 0 | 176 | 0 | 132352 | MeshStandardNodeMaterial | C |
| world / treasury:scale_armour | 1 / 0 | 203 | 0 | 115304 | MeshStandardNodeMaterial | C |
| world / harem:room_fittings:mats | 1 / 0 | 117 | 0 | 104715 | MeshStandardNodeMaterial | C |
| world / work:objects | 1 / 0 | 1 | 0 | 92036 | MeshStandardNodeMaterial |  |
| world / goods:sacks | 1 / 0 | 200 | 0 | 92000 | MeshStandardNodeMaterial |  |
| world / settlement:ground | 1 / 0 | 1 | 0 | 88536 | MeshStandardNodeMaterial | C |
| world / treasury:bitumen_jar | 1 / 0 | 284 | 0 | 87472 | MeshStandardNodeMaterial | C |
| world / treasury:silver_phiale | 1 / 0 | 244 | 0 | 87352 | MeshStandardNodeMaterial | C |
| world / plain-stone | 1 / 0 | 1 | 1 | 84008 | MeshStandardNodeMaterial | C |
| world / treasury:blue_vessel | 1 / 0 | 244 | 0 | 81984 | MeshStandardNodeMaterial | C |
| world / doors:bands | 1 / 0 | 432 | 0 | 81216 | MeshStandardNodeMaterial | C |
| world / crown-merlons:harem|#|-# | 4 / 0 | 962 | 0 | 78884 | decor:merlon:limestone_merlon | C |
| world / animals:sheep:lod# | 1 / 1 | 80 | 0 | 78400 | MeshStandardNodeMaterial |  |
| world / plain-villages--#,-# | 2 / 0 | 1 | 0 | 78098 | MeshStandardNodeMaterial | C |
| world / plain-tracks | 1 / 0 | 1 | 0 | 75768 | MeshStandardNodeMaterial | C |
| world / treasury:sealed_jar | 1 / 0 | 244 | 0 | 75152 | MeshStandardNodeMaterial | C |
| world / treasury:shield | 1 / 0 | 162 | 0 | 70956 | MeshStandardNodeMaterial | C |
| world / settlement:q_n#:far | 1 / 0 | 1 | 0 | 64558 | MeshStandardNodeMaterial | C |
| world / ledges:far | 1 / 0 | 1 | 0 | 61090 | ledges |  |
| world / plain-canal-banks | 1 / 0 | 1 | 0 | 55524 | MeshStandardNodeMaterial | C |
| world / doors:shoes | 1 / 0 | 108 | 0 | 55296 | MeshStandardNodeMaterial | C |
| world / animals:goat:lod# | 1 / 2 | 56 | 0 | 54880 | MeshStandardNodeMaterial |  |
| world / harem:room_fittings:mats_b | 1 / 0 | 59 | 0 | 52805 | MeshStandardNodeMaterial | C |
| world / settlement:tol_ajori:glaze | 1 / 0 | 1 | 0 | 50440 | monument:ajori:glaze |  |
| world / river-water | 1 / 0 | 1 | 0 | 50324 | MeshStandardNodeMaterial |  |
| world / treasury:bead_bowl | 1 / 0 | 122 | 0 | 46848 | MeshStandardNodeMaterial | C |
| plain-waterworks / works:wo_shaduf | 1 / 0 | 57 | 0 | 45828 | MeshStandardNodeMaterial | C |
| world / flora-roses:lod# | 2 / 0 | 256 | 0 | 43520 | life:rose |  |
| world / treasury:room_fittings:jars | 1 / 0 | 96 | 0 | 42624 | MeshStandardNodeMaterial | C |
| world / treasury:glass_bowl | 1 / 0 | 122 | 0 | 40992 | MeshStandardNodeMaterial |  |
| world / fire-body:hearth:stone | 1 / 0 | 18 | 0 | 39600 | MeshStandardNodeMaterial | C |
| world / rock-boulder:namaqualand_boulder_#:lod# | 10 / 0 | 79 | 29 | 36079 | scan:namaqualand_boulder_02, scan:namaqualand_boulder_03, scan:namaqualand_boulder_04, scan:namaqualand_boulder_05 |  |
| world / flora-roses | 1 / 0 | 256 | 0 | 34304 | MeshStandardNodeMaterial |  |
| world / fire-body:torch:head | 1 / 0 | 36 | 0 | 33552 | MeshStandardNodeMaterial | C |
| world / nr-cliff | 1 / 0 | 1 | 0 | 33260 | MeshStandardNodeMaterial | C |
| world / rock-stone:namaqualand_rocks_#_v#:lod# | 8 / 0 | 106 | 106 | 33127 | scan:namaqualand_rocks_01_v1, scan:namaqualand_rocks_01_v2, scan:namaqualand_rocks_01_v3, scan:namaqualand_rocks_01_v4 |  |
| world / rock-stone:namaqualand_stones_#_v#:lod# | 10 / 0 | 116 | 116 | 32965 | scan:namaqualand_stones_01_v1, scan:namaqualand_stones_01_v2, scan:namaqualand_stones_01_v3, scan:namaqualand_stones_01_v4 |  |
| world / plain-villages-#,# | 2 / 0 | 1 | 1 | 32572 | MeshStandardNodeMaterial | C |
| world / ledges:mid | 1 / 0 | 1 | 0 | 32250 | ledges |  |
| world / settlement:gardens:far | 1 / 0 | 1 | 0 | 31796 | MeshStandardNodeMaterial | C |
| world / bedrock-ground:outcrop#:lod# | 2 / 1 | 113 | 2 | 31154 | bedrock:ground |  |
| world / harem:room_fittings:jars | 1 / 0 | 70 | 0 | 31080 | MeshStandardNodeMaterial | C |
| world / scribes:tablets_filed | 1 / 0 | 354 | 0 | 26904 | clay-writing |  |
| world / flora-cushion:shrub_#_v#:lod# | 8 / 0 | 62 | 62 | 25797 | scan:shrub_03_v1, scan:shrub_03_v2, scan:shrub_03_v3, scan:shrub_03_v4 |  |
| world / crown-merlons:terrace|-#|-# | 2 / 0 | 311 | 0 | 25502 | decor:merlon:limestone_merlon | C |

</details>

## night: the town at night (cov-448) (day 310, 3.446 h)

camera -900.2, -1513.5, -18.1; sim people within 60 m: 87, within 250 m: 473; crowd stats: {"draws":4,"triangles":81932,"people":130,"byLod":[0,0,0,130],"shadowDraws":0,"shadowTriangles":0,"propDraws":2,"props":22,"propTriangles":36906,"propsDropped":0,"placeholderActs":0,"motionCapture":5,"motionAuthored":125,"things":{"draws":0,"instances":0,"triangles":0,"kinds":{},"dropped":0},"animal

| class | meshes visible / hidden | instances in frustum | of them < 60 m | triangles in frustum |
|---|---|---|---|---|
| people (skinned, any LOD) | 4 / 46 | 4 | 4 | 2602 |
| people LOD3 (far) | 0 / 0 | 0 | 0 | 0 |
| people impostors | 1 / 0 | 1 | 0 | 2 |
| house roofs | 13 / 5 | 0 | 0 | 0 |
| house walls | 4 / 0 | 0 | 0 | 0 |
| ground fill / props | 82 / 257 | 151 | 77 | 69367 |
| trees | 22 / 0 | 16 | 0 | 181066 |
| crops / flora | 83 / 42 | 23 | 22 | 4879 |
| fires / lamps | 12 / 2 | 4933 | 13 | 9866 |
| water | 15 / 4 | 47 | 4 | 296958 |
| animals | 139 / 22 | 44 | 16 | 32200 |
| terrace architecture | 118 / 233 | 927 | 0 | 1690000 |

shadow-casting lights: [{"name":"","far":2000,"size":[240]}]

page: backend WebGL2, norender true, catch-up ticks 1 (still catching up: false), crowd looks pending 0

people in the frustum: within 40 m 7 of 41; within 60 m 19 of 87 (behind court walls for this eye: 19; to be drawn: 0)

| people mesh | visible / hidden meshes | instances (count) | in frustum | < 60 m |
|---|---|---|---|---|
| world / humans:persian:shadow | 0 / 1 | 1 | 0 | 0 |
| world / humans:persian:shadow-far | 0 / 1 | 1 | 0 | 0 |
| world / humans:persian:lod# | 0 / 4 | 4 | 0 | 0 |
| world / humans:median:shadow | 0 / 1 | 1 | 0 | 0 |
| world / humans:median:shadow-far | 0 / 1 | 1 | 0 | 0 |
| world / humans:median:lod# | 1 / 3 | 4 | 1 | 1 |
| world / humans:worker:shadow | 0 / 1 | 1 | 0 | 0 |
| world / humans:worker:shadow-far | 0 / 1 | 1 | 0 | 0 |
| world / humans:worker:lod# | 1 / 3 | 4 | 1 | 1 |
| world / humans:woman:shadow | 0 / 1 | 1 | 0 | 0 |
| world / humans:woman:shadow-far | 0 / 1 | 1 | 0 | 0 |
| world / humans:woman:lod# | 1 / 3 | 4 | 1 | 1 |
| world / humans:child:shadow | 0 / 1 | 1 | 0 | 0 |
| world / humans:child:shadow-far | 0 / 1 | 1 | 0 | 0 |
| world / humans:child:lod# | 1 / 3 | 4 | 1 | 1 |
| world / humans:envoy:shadow | 0 / 1 | 1 | 0 | 0 |
| world / humans:envoy:shadow-far | 0 / 1 | 1 | 0 | 0 |
| world / humans:envoy:lod# | 0 / 4 | 4 | 0 | 0 |
| world / humans:envoy_short:shadow | 0 / 1 | 1 | 0 | 0 |
| world / humans:envoy_short:shadow-far | 0 / 1 | 1 | 0 | 0 |
| world / humans:envoy_short:lod# | 0 / 4 | 4 | 0 | 0 |
| world / humans:envoy_bare:shadow | 0 / 1 | 1 | 0 | 0 |
| world / humans:envoy_bare:shadow-far | 0 / 1 | 1 | 0 | 0 |
| world / humans:envoy_bare:lod# | 0 / 4 | 4 | 0 | 0 |
| world / people:reins | 0 / 1 | 0 | 0 | 0 |
| world / people:hit | 0 / 1 | 1 | 0 | 0 |
| world / people:impostors | 1 / 0 | 1 | 1 | 0 |
| player-body / humans:median:lod# | 0 / 2 | 2 | 0 | 0 |

people: sim out of doors within 60 m 87 (open ground 0, inside walled courts 87, walking 0; places {"h":87}; 250 m 473); crowd attached 420, skinned drawn 130 by LOD [0,0,0,130], impostors drawn 20 of 2871 candidates

town roofs (150 m round [-957,-1534]): up-facing area above 1.8 m 20466 m², wall area 79970 m², ratio 0.256 (192502 triangles)

<details><summary>all classes (top 60 by triangles)</summary>

| object key | vis / hidden | inst in frustum | < 60 m | tris | mats | tiers |
|---|---|---|---|---|---|---|
| world / relief:figures | 9 / 3 | 927 | 0 | 1690000 | MeshStandardNodeMaterial | C |
| terrain | 208 / 0 | 52 | 2 | 837376 | MeshStandardNodeMaterial | C |
| world / plain-orchards-far | 1 / 0 | 1 | 0 | 176772 | MeshStandardNodeMaterial |  |
| world / river-banks | 1 / 0 | 1 | 0 | 159880 | MeshStandardNodeMaterial | C |
| world / plain-villages--#,-# | 2 / 0 | 2 | 0 | 133082 | MeshStandardNodeMaterial | C |
| world / plain-villages--#,# | 4 / 0 | 2 | 0 | 120868 | MeshStandardNodeMaterial | C |
| world / settlement:ground | 1 / 0 | 1 | 1 | 88536 | MeshStandardNodeMaterial | C |
| world / plain-stone | 1 / 0 | 1 | 1 | 84008 | MeshStandardNodeMaterial | C |
| world / settlement:near:plaster | 1 / 0 | 1 | 0 | 79740 | MeshStandardNodeMaterial | C |
| world / plain-tracks | 1 / 0 | 1 | 0 | 75768 | MeshStandardNodeMaterial | C |
| world / settlement:q_s#:far | 4 / 0 | 1 | 1 | 64060 | MeshStandardNodeMaterial | C |
| world / plain-canal-banks | 1 / 0 | 1 | 0 | 55524 | MeshStandardNodeMaterial | C |
| world / river-water | 1 / 0 | 1 | 0 | 50324 | MeshStandardNodeMaterial |  |
| world / settlement:near:timber | 1 / 0 | 1 | 0 | 45442 | MeshStandardNodeMaterial | C |
| world / settlement:near:items | 1 / 0 | 1 | 0 | 38863 | MeshStandardNodeMaterial | C |
| world / plain-villages-#,# | 2 / 0 | 1 | 1 | 32572 | MeshStandardNodeMaterial | C |
| world / settlement:gardens:far | 1 / 0 | 1 | 1 | 31796 | MeshStandardNodeMaterial | C |
| world / settlement:refuse | 1 / 0 | 1 | 1 | 21888 | MeshStandardNodeMaterial | C |
| world / settlement:roads | 1 / 0 | 1 | 1 | 20956 | MeshStandardNodeMaterial | C |
| world / settlement:near:props | 1 / 0 | 1 | 0 | 20676 | MeshStandardNodeMaterial | C |
| world / props:children | 1 / 0 | 15 | 1 | 19530 | MeshStandardNodeMaterial |  |
| world / nr-life | 1 / 0 | 1 | 1 | 19006 | MeshStandardNodeMaterial | C |
| plain-waterworks / works:wo_shaduf | 1 / 0 | 23 | 0 | 18492 | MeshStandardNodeMaterial | C |
| world / ledges:far | 1 / 0 | 1 | 0 | 15180 | ledges |  |
| quarries-detail / plain-quarries:rock:quarry_majdabad | 1 / 0 | 1 | 0 | 13745 | bedrock:ground |  |
| world / settlement:near:stone | 1 / 0 | 1 | 0 | 13478 | MeshStandardNodeMaterial | C |
| world / props:carried | 1 / 0 | 3 | 0 | 12168 | MeshStandardNodeMaterial |  |
| world / animals:goat:lod# | 2 / 1 | 12 | 6 | 11760 | MeshStandardNodeMaterial |  |
| world / settlement:compounds:far | 1 / 0 | 1 | 1 | 9482 | MeshStandardNodeMaterial | C |
| world / settlement:water | 1 / 0 | 1 | 1 | 9242 | MeshStandardNodeMaterial | C |
| world / animals:dog:lod# | 1 / 0 | 9 | 1 | 8802 | MeshStandardNodeMaterial |  |
| world / settlement-doors:# | 3 / 0 | 46 | 6 | 7864 | MeshStandardNodeMaterial | C |
| world / animals:sheep:lod# | 2 / 0 | 8 | 0 | 7840 | MeshStandardNodeMaterial |  |
| world / fire | 1 / 0 | 3282 | 10 | 6564 | MeshBasicNodeMaterial |  |
| world / interiors:cloth | 1 / 0 | 1 | 0 | 6074 | MeshStandardNodeMaterial | C |
| world / interiors:clay | 1 / 0 | 1 | 0 | 5730 | MeshStandardNodeMaterial | C |
| Mesh | 3 / 1 | 3 | 0 | 4940 | MeshBasicNodeMaterial, NodeMaterial |  |
| world / animals:cat:lod# | 1 / 0 | 6 | 0 | 3528 | MeshStandardNodeMaterial |  |
| world / settlement:near:brick | 1 / 0 | 1 | 0 | 3468 | MeshStandardNodeMaterial | B/C |
| world / fire:coals | 1 / 0 | 1651 | 3 | 3302 | MeshBasicNodeMaterial |  |
| Points | 1 / 0 | 1 | 0 | 2973 | PointsNodeMaterial |  |
| world / fill:wo_dung_cakes:dung:lod# | 2 / 1 | 22 | 10 | 2400 | MeshStandardNodeMaterial | C |
| plain-waterworks / works:wo_pontoon | 1 / 0 | 7 | 0 | 2352 | MeshStandardNodeMaterial | C |
| world / flora-thistle:nettle_plant_v#:lod# | 8 / 0 | 6 | 6 | 2039 | scan:nettle_plant_v1, scan:nettle_plant_v2, scan:nettle_plant_v5, scan:nettle_plant_v6 |  |
| world / wallwear:soot | 1 / 0 | 28 | 6 | 2016 | MeshStandardNodeMaterial |  |
| world / fill:fill_awning:cloth:lod# | 1 / 2 | 7 | 2 | 1820 | MeshStandardNodeMaterial | C |
| world / fill:fill_awning:wood:lod# | 1 / 2 | 7 | 2 | 1680 | MeshStandardNodeMaterial | C |
| world / flora-cushion:shrub_#_v#:lod# | 8 / 0 | 5 | 5 | 1500 | scan:shrub_03_v1, scan:shrub_03_v2, scan:shrub_03_v3, scan:shrub_03_v4 |  |
| world / rock-stone:namaqualand_rocks_#_v#:lod# | 8 / 0 | 6 | 6 | 1498 | scan:namaqualand_rocks_01_v1, scan:namaqualand_rocks_01_v2, scan:namaqualand_rocks_01_v3, scan:namaqualand_rocks_01_v4 |  |
| world / fill:wo_spoil:earth:lod# | 1 / 2 | 8 | 8 | 1408 | MeshStandardNodeMaterial | C |
| world / fill:fill_bundle:wood:lod# | 2 / 1 | 3 | 3 | 1395 | MeshStandardNodeMaterial | C |
| world / fill:jar_store:clay:lod# | 2 / 1 | 13 | 2 | 1170 | MeshStandardNodeMaterial | C |
| world / fill:mat:matting:lod# | 2 / 1 | 11 | 3 | 1155 | MeshStandardNodeMaterial | C |
| world / fill:jar_water:clay:lod# | 2 / 1 | 13 | 3 | 1144 | MeshStandardNodeMaterial | C |
| world / fill:sack:cloth:lod# | 2 / 1 | 3 | 3 | 990 | MeshStandardNodeMaterial | C |
| world / flora-grass:grass_medium_#_v#:lod# | 14 / 0 | 5 | 5 | 898 | scan:grass_medium_01_v1, scan:grass_medium_01_v2, scan:grass_medium_01_v3, scan:grass_medium_01_v4 |  |
| world / settlement:trees-wood-lod# | 2 / 0 | 2 | 0 | 896 | MeshStandardNodeMaterial |  |
| world / plain-trees-wood-lod# | 2 / 0 | 2 | 0 | 896 | MeshStandardNodeMaterial |  |
| world / settlement:trees-leaves-lod# | 2 / 0 | 2 | 0 | 880 | MeshStandardNodeMaterial |  |
| world / plain-trees-leaves-lod# | 2 / 0 | 2 | 0 | 880 | MeshStandardNodeMaterial |  |

</details>

## night_terrace: the Terrace at 22:30 (sb-night-terrace) (day 5, 22.5 h)

camera 0, 92, 1.6; sim people within 60 m: 99, within 250 m: 257; crowd stats: {"draws":10,"triangles":2074249,"people":178,"byLod":[48,18,0,112],"shadowDraws":5,"shadowTriangles":135502,"propDraws":3,"props":133,"propTriangles":490422,"propsDropped":0,"placeholderActs":0,"motionCapture":118,"motionAuthored":60,"things":{"draws":5,"instances":44,"triangles":71436,"kinds":{"bri

| class | meshes visible / hidden | instances in frustum | of them < 60 m | triangles in frustum |
|---|---|---|---|---|
| people (skinned, any LOD) | 15 / 35 | 13 | 8 | 103693 |
| people LOD3 (far) | 0 / 0 | 0 | 0 | 0 |
| people impostors | 1 / 0 | 1 | 0 | 2 |
| house roofs | 13 / 5 | 1093 | 131 | 14604 |
| house walls | 4 / 0 | 1 | 1 | 300 |
| ground fill / props | 19 / 320 | 138 | 5 | 480029 |
| trees | 22 / 0 | 16 | 0 | 181066 |
| crops / flora | 78 / 47 | 74 | 0 | 8216 |
| fires / lamps | 11 / 3 | 4365 | 12 | 87826 |
| water | 16 / 3 | 6 | 3 | 277002 |
| animals | 134 / 27 | 75 | 0 | 73500 |
| terrace architecture | 124 / 227 | 4217 | 951 | 2415175 |

shadow-casting lights: [{"name":"","far":2000,"size":[240]}]

page: backend WebGL2, norender true, catch-up ticks 1 (still catching up: false), crowd looks pending 0

people in the frustum: within 40 m 41 of 92; within 60 m 42 of 99 (behind court walls for this eye: 0; to be drawn: 42)

| people mesh | visible / hidden meshes | instances (count) | in frustum | < 60 m |
|---|---|---|---|---|
| world / humans:persian:shadow | 0 / 1 | 1 | 0 | 0 |
| world / humans:persian:shadow-far | 0 / 1 | 1 | 0 | 0 |
| world / humans:persian:lod# | 1 / 3 | 4 | 1 | 0 |
| world / humans:median:shadow | 1 / 0 | 1 | 0 | 0 |
| world / humans:median:shadow-far | 0 / 1 | 1 | 0 | 0 |
| world / humans:median:lod# | 2 / 2 | 4 | 1 | 0 |
| world / humans:worker:shadow | 0 / 1 | 1 | 0 | 0 |
| world / humans:worker:shadow-far | 1 / 0 | 1 | 1 | 1 |
| world / humans:worker:lod# | 2 / 2 | 4 | 2 | 1 |
| world / humans:woman:shadow | 0 / 1 | 1 | 0 | 0 |
| world / humans:woman:shadow-far | 0 / 1 | 1 | 0 | 0 |
| world / humans:woman:lod# | 1 / 3 | 4 | 1 | 0 |
| world / humans:child:shadow | 0 / 1 | 1 | 0 | 0 |
| world / humans:child:shadow-far | 0 / 1 | 1 | 0 | 0 |
| world / humans:child:lod# | 1 / 3 | 4 | 1 | 0 |
| world / humans:envoy:shadow | 1 / 0 | 1 | 1 | 1 |
| world / humans:envoy:shadow-far | 1 / 0 | 1 | 1 | 1 |
| world / humans:envoy:lod# | 2 / 2 | 4 | 2 | 2 |
| world / humans:envoy_short:shadow | 1 / 0 | 1 | 1 | 1 |
| world / humans:envoy_short:shadow-far | 0 / 1 | 1 | 0 | 0 |
| world / humans:envoy_short:lod# | 1 / 3 | 4 | 1 | 1 |
| world / humans:envoy_bare:shadow | 0 / 1 | 1 | 0 | 0 |
| world / humans:envoy_bare:shadow-far | 0 / 1 | 1 | 0 | 0 |
| world / humans:envoy_bare:lod# | 0 / 4 | 4 | 0 | 0 |
| world / people:reins | 0 / 1 | 0 | 0 | 0 |
| world / people:hit | 0 / 1 | 1 | 0 | 0 |
| world / people:impostors | 1 / 0 | 1 | 1 | 0 |
| player-body / humans:median:lod# | 0 / 2 | 2 | 0 | 0 |

people: sim out of doors within 60 m 99 (open ground 91, inside walled courts 0, walking 0; places {"palaces":2,"forecourt_wait":88,"stair_foot":1}; 250 m 257); crowd attached 397, skinned drawn 178 by LOD [48,18,0,112], impostors drawn 1194 of 3002 candidates

town roofs (150 m round [0,32]): up-facing area above 1.8 m 0 m², wall area 0 m², ratio null (0 triangles)

<details><summary>all classes (top 60 by triangles)</summary>

| object key | vis / hidden | inst in frustum | < 60 m | tris | mats | tiers |
|---|---|---|---|---|---|---|
| world / relief:figures | 9 / 3 | 927 | 0 | 1690000 | MeshStandardNodeMaterial | C |
| terrain | 208 / 0 | 85 | 2 | 963840 | MeshStandardNodeMaterial | C |
| world / props:carried | 1 / 0 | 112 | 0 | 454272 | MeshStandardNodeMaterial |  |
| world / treasury:arrow_bundle | 1 / 0 | 446 | 0 | 392480 | MeshStandardNodeMaterial | C |
| world / treasury:alabaster_vessel | 1 / 0 | 824 | 0 | 370800 | MeshStandardNodeMaterial | C |
| world / settlement:q_s#:far | 4 / 0 | 4 | 0 | 317074 | MeshStandardNodeMaterial | C |
| world / treasury:textile_bale | 1 / 0 | 382 | 0 | 216976 | MeshStandardNodeMaterial | C |
| world / plain-orchards-far | 1 / 0 | 1 | 0 | 176772 | MeshStandardNodeMaterial |  |
| world / river-banks | 1 / 0 | 1 | 0 | 159880 | MeshStandardNodeMaterial | C |
| world / plain-villages--#,-# | 2 / 0 | 2 | 0 | 133082 | MeshStandardNodeMaterial | C |
| world / harem:room_fittings:bedrolls | 1 / 0 | 176 | 0 | 132352 | MeshStandardNodeMaterial | C |
| world / treasury:chert_set | 1 / 0 | 455 | 0 | 126490 | MeshStandardNodeMaterial | C |
| world / relief:far-set | 9 / 0 | 9 | 1 | 123451 | MeshStandardNodeMaterial | C |
| world / crown-merlons:harem|#|-# | 4 / 0 | 962 | 0 | 115440 | decor:merlon:limestone_merlon | C |
| world / treasury:scale_armour | 1 / 0 | 185 | 0 | 105080 | MeshStandardNodeMaterial | C |
| world / harem:room_fittings:mats | 1 / 0 | 117 | 0 | 104715 | MeshStandardNodeMaterial | C |
| world / work:objects | 1 / 0 | 1 | 0 | 92036 | MeshStandardNodeMaterial |  |
| world / settlement:ground | 1 / 0 | 1 | 1 | 88536 | MeshStandardNodeMaterial | C |
| world / plain-stone | 1 / 0 | 1 | 1 | 84008 | MeshStandardNodeMaterial | C |
| world / treasury:bitumen_jar | 1 / 0 | 262 | 0 | 80696 | MeshStandardNodeMaterial | C |
| world / treasury:silver_phiale | 1 / 0 | 224 | 0 | 80192 | MeshStandardNodeMaterial | C |
| world / plain-tracks | 1 / 0 | 1 | 0 | 75768 | MeshStandardNodeMaterial | C |
| world / treasury:blue_vessel | 1 / 0 | 225 | 0 | 75600 | MeshStandardNodeMaterial | C |
| world / doors:bands | 1 / 0 | 384 | 0 | 72192 | MeshStandardNodeMaterial | C |
| world / treasury:sealed_jar | 1 / 0 | 225 | 0 | 69300 | MeshStandardNodeMaterial | C |
| world / treasury:shield | 1 / 0 | 149 | 0 | 65262 | MeshStandardNodeMaterial | C |
| world / ledges:far | 1 / 0 | 1 | 0 | 64270 | ledges |  |
| world / apadana:mudbrick | 1 / 0 | 1 | 1 | 60020 | MeshStandardNodeMaterial | B/C |
| world / plain-canal-banks | 1 / 0 | 1 | 0 | 55524 | MeshStandardNodeMaterial | C |
| world / apadana:columns:shaft:lod# | 3 / 3 | 72 | 12 | 55296 | model:column_shaft_f48:0:limestone_carved, model:column_shaft_f48:1:limestone_carved | C |
| world / harem:room_fittings:mats_b | 1 / 0 | 59 | 0 | 52805 | MeshStandardNodeMaterial | C |
| world / settlement:tol_ajori:glaze | 1 / 0 | 1 | 0 | 50440 | monument:ajori:glaze |  |
| world / river-water | 1 / 0 | 1 | 0 | 50324 | MeshStandardNodeMaterial |  |
| world / doors:shoes | 1 / 0 | 96 | 0 | 49152 | MeshStandardNodeMaterial | C |
| world / crown-merlons:terrace|-#|-# | 2 / 0 | 311 | 0 | 47988 | decor:merlon:limestone_merlon | C |
| world / humans:envoy:lod# | 2 / 2 | 2 | 2 | 44739 | human |  |
| world / treasury:bead_bowl | 1 / 0 | 114 | 0 | 43776 | MeshStandardNodeMaterial | C |
| world / humans:envoy_short:lod# | 1 / 3 | 1 | 1 | 41789 | human |  |
| world / fortification_e:mudbrick | 2 / 0 | 2 | 0 | 41744 | MeshStandardNodeMaterial | B/C |
| world / apadana:columns:protome:lod# | 3 / 3 | 72 | 11 | 40464 | model-paint:capital_protome:0:limestone_carved, model-paint:capital_protome:1:limestone_carved | C |
| world / animals:goat:lod# | 1 / 2 | 41 | 0 | 40180 | MeshStandardNodeMaterial |  |
| world / treasury:room_fittings:jars | 1 / 0 | 88 | 0 | 39072 | MeshStandardNodeMaterial | C |
| world / treasury:glass_bowl | 1 / 0 | 111 | 0 | 37296 | MeshStandardNodeMaterial |  |
| world / animals:sheep:lod# | 1 / 1 | 34 | 0 | 33320 | MeshStandardNodeMaterial |  |
| world / relief:rosettes | 1 / 0 | 824 | 824 | 32960 | MeshStandardNodeMaterial | C |
| world / plain-villages-#,# | 2 / 0 | 1 | 1 | 32572 | MeshStandardNodeMaterial | C |
| world / settlement:gardens:far | 1 / 0 | 1 | 1 | 31796 | MeshStandardNodeMaterial | C |
| world / harem:room_fittings:jars | 1 / 0 | 70 | 0 | 31080 | MeshStandardNodeMaterial | C |
| plain-qanats / qanat-tile:#,-# | 3 / 12 | 319 | 0 | 28710 | MeshStandardNodeMaterial | C |
| world / work:brick_stack | 1 / 0 | 13 | 0 | 28080 | MeshStandardNodeMaterial |  |
| world / crenellations | 1 / 0 | 134 | 68 | 27336 | decor:merlon:limestone_merlon | C |
| world / crown-merlons:terrace|#|-# | 2 / 0 | 223 | 0 | 26760 | decor:merlon:limestone_merlon | C |
| world / crown-merlons:apadana|#|-# | 1 / 0 | 130 | 0 | 26520 | decor:merlon:limestone_merlon | C |
| world / fire-body:torch:head | 1 / 0 | 28 | 0 | 26096 | MeshStandardNodeMaterial | C |
| world / crown-merlons:apadana|-#|-# | 1 / 0 | 124 | 0 | 25296 | decor:merlon:limestone_merlon | C |
| world / treasury:gold_rhyton | 1 / 0 | 78 | 0 | 24492 | MeshStandardNodeMaterial | C |
| world / props:tools | 2 / 2 | 18 | 1 | 23982 | MeshStandardNodeMaterial |  |
| world / work:weigh_table | 1 / 0 | 13 | 0 | 23868 | MeshStandardNodeMaterial |  |
| world / c#:dressings:cloth | 1 / 0 | 1 | 1 | 23770 | MeshStandardNodeMaterial | C |
| world / apadana:palace_plaster | 1 / 0 | 1 | 1 | 23144 | MeshStandardNodeMaterial | B/C |

</details>

