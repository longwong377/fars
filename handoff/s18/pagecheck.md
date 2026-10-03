# Page check (D-772): what the page draws vs what its simulation holds

Tree /home/user/fars-pc gitdir: /home/user/fars/.git/worktrees/fars-pc; built site (vite build, base /fars/), headless Chromium, ?test&norender&webgl=1&quality=test&court=seasonal; 2026-10-03T07:25:38.665Z.
Per view: objects effectively visible (every ancestor visible) and meeting the camera frustum, their instances and triangles;
hidden = present in the scene but visible=false somewhere up the chain. sim<60 m = population view + detailed agents within 60 m of the camera.

## Run 3 (C12, s17-int eb6f768f built with build_site.mjs SKIP_BAKE=1; 2026-10-03 ~07:35 UTC)

**No flags.** The numbers are within a few people of run 2 at every view:
- the lanes at 13:48: 141 out of doors within 60 m, all in courts, 0 walking;
- the Terrace at noon: 18 within 60 m, 88 skinned drawn;
- the Terrace on a court day: 28 within 60 m, 108 skinned drawn.

This head does not yet carry C1's out-of-doors day. D-651's 74538bb3 (village fields) is in; the lane traffic is not.

The run-2 table below still describes this head.

## Flags

- none

Page errors (unique): 1
- 1x Failed to load resource: the server responded with a status of 404 (Not Found)

## town20: the town from 20 m up (roofs vs walls) (day 88, 13.805 h)

camera -871.9, -150.4, 4.4; sim people within 60 m: 139, within 250 m: 211; crowd stats: {"draws":2,"triangles":11415,"people":2,"byLod":[0,2,0,0],"shadowDraws":2,"shadowTriangles":1103,"propDraws":0,"props":0,"propTriangles":0,"propsDropped":0,"placeholderActs":0,"motionCapture":0,"motionAuthored":2,"things":{"draws":0,"instances":0,"triangles":0,"kinds":{},"dropped":0},"animals":{"dra

| class | meshes visible / hidden | instances in frustum | of them < 60 m | triangles in frustum |
|---|---|---|---|---|
| people (skinned, any LOD) | 4 / 46 | 0 | 0 | 0 |
| people LOD3 (far) | 0 / 0 | 0 | 0 | 0 |
| people impostors | 1 / 0 | 1 | 0 | 2 |
| house roofs | 13 / 5 | 0 | 0 | 0 |
| house walls | 4 / 0 | 1 | 1 | 300 |
| ground fill / props | 108 / 231 | 4 | 0 | 26138 |
| trees | 16 / 0 | 16 | 0 | 181066 |
| crops / flora | 25 / 38 | 71 | 66 | 13444 |
| fires / lamps | 13 / 1 | 2775 | 0 | 5550 |
| water | 10 / 4 | 4 | 1 | 274876 |
| animals | 132 / 11 | 183 | 51 | 96808 |
| terrace architecture | 118 / 219 | 927 | 0 | 1690000 |

shadow-casting lights: [{"name":"","far":2000,"size":[240]}]

page: backend WebGL2, norender true, catch-up ticks 0 (still catching up: false), crowd looks pending 0

people in the frustum: within 40 m 0 of 64; within 60 m 0 of 139 (behind court walls for this eye: 0; to be drawn: 0)

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
| world / humans:child:shadow-far | 1 / 0 | 1 | 0 | 0 |
| world / humans:child:lod# | 1 / 3 | 4 | 0 | 0 |
| world / humans:envoy:shadow | 0 / 1 | 1 | 0 | 0 |
| world / humans:envoy:shadow-far | 0 / 1 | 1 | 0 | 0 |
| world / humans:envoy:lod# | 0 / 4 | 4 | 0 | 0 |
| world / humans:envoy_short:shadow | 0 / 1 | 1 | 0 | 0 |
| world / humans:envoy_short:shadow-far | 0 / 1 | 1 | 0 | 0 |
| world / humans:envoy_short:lod# | 0 / 4 | 4 | 0 | 0 |
| world / humans:envoy_bare:shadow | 0 / 1 | 1 | 0 | 0 |
| world / humans:envoy_bare:shadow-far | 0 / 1 | 1 | 0 | 0 |
| world / humans:envoy_bare:lod# | 0 / 4 | 4 | 0 | 0 |
| world / people:hit | 0 / 1 | 1 | 0 | 0 |
| world / people:impostors | 1 / 0 | 1 | 1 | 0 |
| player-body / humans:median:lod# | 0 / 2 | 2 | 0 | 0 |

people: sim out of doors within 60 m 139 (open ground 0, inside walled courts 139, walking 0; places {"h":139}; 250 m 211); crowd attached 217, skinned drawn 2 by LOD [0,2,0,0], impostors drawn 27 of 162 candidates

town roofs (150 m round [-852,-196]): up-facing area above 1.8 m 19698 m², wall area 78463 m², ratio 0.251 (196451 triangles)

<details><summary>all classes (top 60 by triangles)</summary>

| object key | vis / hidden | inst in frustum | < 60 m | tris | mats | tiers |
|---|---|---|---|---|---|---|
| world / relief:figures | 9 / 3 | 927 | 0 | 1690000 | MeshStandardNodeMaterial | C |
| terrain | 208 / 0 | 71 | 1 | 765952 | MeshStandardNodeMaterial | C |
| world / settlement:q_s#:far | 4 / 0 | 4 | 0 | 367500 | MeshStandardNodeMaterial | C |
| world / plain-orchards-far | 1 / 0 | 1 | 0 | 176772 | MeshStandardNodeMaterial |  |
| world / river-banks | 1 / 0 | 1 | 0 | 159880 | MeshStandardNodeMaterial | C |
| world / settlement:q_w#:far | 3 / 0 | 1 | 1 | 120854 | MeshStandardNodeMaterial | C |
| world / settlement:ground | 1 / 0 | 1 | 1 | 95156 | MeshStandardNodeMaterial | C |
| world / settlement:near:plaster | 1 / 0 | 1 | 0 | 85791 | MeshStandardNodeMaterial | C |
| world / plain-stone | 1 / 0 | 1 | 1 | 84008 | MeshStandardNodeMaterial | C |
| world / plain-tracks | 1 / 0 | 1 | 0 | 75768 | MeshStandardNodeMaterial | C |
| world / plain-villages--#,-# | 2 / 0 | 1 | 0 | 58588 | MeshStandardNodeMaterial | C |
| world / plain-canal-banks | 1 / 0 | 1 | 0 | 55524 | MeshStandardNodeMaterial | C |
| world / river-water | 1 / 0 | 1 | 0 | 50324 | MeshStandardNodeMaterial |  |
| world / settlement:near:timber | 1 / 0 | 1 | 0 | 50213 | MeshStandardNodeMaterial | C |
| world / animals:sheep:lod# | 2 / 0 | 47 | 0 | 46060 | MeshStandardNodeMaterial |  |
| world / interiors:cloth | 1 / 0 | 1 | 0 | 37403 | MeshStandardNodeMaterial | C |
| world / animals:goat:lod# | 2 / 0 | 38 | 0 | 37240 | MeshStandardNodeMaterial |  |
| world / settlement:near:items | 1 / 0 | 1 | 0 | 36105 | MeshStandardNodeMaterial | C |
| world / plain-villages-#,# | 2 / 0 | 1 | 1 | 35002 | MeshStandardNodeMaterial | C |
| world / ledges:far | 1 / 0 | 1 | 0 | 28850 | ledges |  |
| plain-qanats / qanat-tile:#,-# | 2 / 13 | 318 | 0 | 28620 | MeshStandardNodeMaterial | C |
| world / settlement:near:props | 1 / 0 | 1 | 0 | 24302 | MeshStandardNodeMaterial | C |
| world / settlement:refuse | 1 / 0 | 1 | 1 | 22368 | MeshStandardNodeMaterial | C |
| world / settlement:roads | 1 / 0 | 1 | 1 | 20956 | MeshStandardNodeMaterial | C |
| world / settlement:gardens:far | 1 / 0 | 1 | 1 | 15864 | MeshStandardNodeMaterial | C |
| world / settlement:near:stone | 1 / 0 | 1 | 0 | 14130 | MeshStandardNodeMaterial | C |
| world / interiors:clay | 1 / 0 | 1 | 0 | 12332 | MeshStandardNodeMaterial | C |
| world / settlement:water | 1 / 0 | 1 | 1 | 9148 | MeshStandardNodeMaterial | C |
| world / rock-stone:namaqualand_stones_#_v#:lod# | 10 / 0 | 34 | 34 | 6786 | scan:namaqualand_stones_01_v1, scan:namaqualand_stones_01_v2, scan:namaqualand_stones_01_v3, scan:namaqualand_stones_01_v4 |  |
| world / rock-stone:namaqualand_rocks_#_v#:lod# | 8 / 0 | 23 | 23 | 5745 | scan:namaqualand_rocks_01_v1, scan:namaqualand_rocks_01_v2, scan:namaqualand_rocks_01_v3, scan:namaqualand_rocks_01_v4 |  |
| world / flora-camelthorn:model:lod# | 2 / 0 | 22 | 22 | 5280 | life:camelthorn |  |
| world / flora-cushion:model:lod# | 2 / 0 | 23 | 23 | 4324 | life:cushion |  |
| world / fire | 1 / 0 | 2130 | 0 | 4260 | MeshBasicNodeMaterial |  |
| world / bird-chukar:stand# | 2 / 0 | 24 | 0 | 4224 | life:chukar |  |
| world / rock-boulder:namaqualand_boulder_#:lod# | 10 / 0 | 8 | 1 | 3048 | scan:namaqualand_boulder_02, scan:namaqualand_boulder_03, scan:namaqualand_boulder_04, scan:namaqualand_boulder_05 |  |
| Points | 1 / 0 | 1 | 0 | 2973 | PointsNodeMaterial |  |
| world / court-camps:ridge:shell | 1 / 0 | 179 | 0 | 2864 | MeshStandardNodeMaterial | C |
| world / bird-crow:stand# | 2 / 0 | 13 | 0 | 2288 | life:crow |  |
| world / settlement:q_b#:far | 1 / 0 | 1 | 0 | 2246 | MeshStandardNodeMaterial | C |
| plain-works / works:wo_hurdles | 1 / 0 | 3 | 0 | 2034 | MeshStandardNodeMaterial | C |
| world / settlement:near:brick | 1 / 0 | 1 | 0 | 2031 | MeshStandardNodeMaterial | B/C |
| plain-works / works:jar_store | 1 / 0 | 22 | 0 | 1980 | MeshStandardNodeMaterial | C |
| world / rock-stone:rock_#:lod# | 4 / 0 | 16 | 16 | 1953 | scan:rock_07, scan:rock_09 |  |
| plain-field-fill / field:fill_stall_reed:lod# | 1 / 1 | 3 | 0 | 1836 | MeshStandardNodeMaterial | C |
| world / flora-thistle:model:lod# | 2 / 0 | 21 | 21 | 1806 | life:thistle |  |
| plain-works / works:vat | 1 / 0 | 6 | 0 | 1800 | MeshStandardNodeMaterial | C |
| world / settlement:burial_ground_town:stone | 1 / 0 | 1 | 0 | 1740 | MeshStandardNodeMaterial | C |
| world / fauna:camp-lines:t_west | 1 / 0 | 1 | 0 | 1720 | MeshStandardNodeMaterial |  |
| plain-works / works:sack | 1 / 0 | 14 | 0 | 1596 | MeshStandardNodeMaterial | C |
| world / court-camps:black:shell | 1 / 0 | 111 | 0 | 1554 | MeshStandardNodeMaterial | C |
| plain-works / works:manger | 1 / 0 | 4 | 0 | 1480 | MeshStandardNodeMaterial | C |
| world / fire:coals | 1 / 0 | 645 | 0 | 1290 | MeshBasicNodeMaterial |  |
| world / rock-stone:stone_#:lod# | 2 / 0 | 10 | 10 | 1190 | scan:stone_01 |  |
| world / rock-boulder:rock_face_#:lod# | 2 / 0 | 2 | 2 | 1000 | scan:rock_face_02 |  |
| Mesh | 2 / 2 | 2 | 0 | 972 | MeshBasicNodeMaterial, NodeMaterial |  |
| plain-works / works:quern | 1 / 0 | 8 | 0 | 960 | MeshStandardNodeMaterial | C |
| world / settlement:trees-wood-lod# | 2 / 0 | 2 | 0 | 896 | MeshStandardNodeMaterial |  |
| world / plain-trees-wood-lod# | 2 / 0 | 2 | 0 | 896 | MeshStandardNodeMaterial |  |
| world / settlement:trees-leaves-lod# | 2 / 0 | 2 | 0 | 880 | MeshStandardNodeMaterial |  |
| world / plain-trees-leaves-lod# | 2 / 0 | 2 | 0 | 880 | MeshStandardNodeMaterial |  |

</details>

## lanes: a town lane, afternoon (cov-142) (day 88, 13.805 h)

camera -871.9, -150.4, -14; sim people within 60 m: 141, within 250 m: 428; crowd stats: {"draws":3,"triangles":2536,"people":4,"byLod":[0,0,0,4],"shadowDraws":0,"shadowTriangles":0,"propDraws":1,"props":3,"propTriangles":12168,"propsDropped":0,"placeholderActs":0,"motionCapture":1,"motionAuthored":3,"things":{"draws":0,"instances":0,"triangles":0,"kinds":{},"dropped":0},"animals":{"dra

| class | meshes visible / hidden | instances in frustum | of them < 60 m | triangles in frustum |
|---|---|---|---|---|
| people (skinned, any LOD) | 3 / 47 | 3 | 3 | 1823 |
| people LOD3 (far) | 0 / 0 | 0 | 0 | 0 |
| people impostors | 1 / 0 | 1 | 0 | 2 |
| house roofs | 13 / 5 | 0 | 0 | 0 |
| house walls | 4 / 0 | 1 | 1 | 300 |
| ground fill / props | 109 / 230 | 48 | 42 | 36483 |
| trees | 16 / 0 | 16 | 0 | 181066 |
| crops / flora | 25 / 38 | 66 | 60 | 14516 |
| fires / lamps | 13 / 1 | 2913 | 4 | 5826 |
| water | 10 / 4 | 4 | 1 | 274876 |
| animals | 133 / 11 | 185 | 52 | 104761 |
| terrace architecture | 118 / 219 | 927 | 0 | 1690000 |

shadow-casting lights: [{"name":"","far":2000,"size":[240]}]

page: backend WebGL2, norender true, catch-up ticks 0 (still catching up: false), crowd looks pending 0

people in the frustum: within 40 m 2 of 64; within 60 m 2 of 141 (behind court walls for this eye: 2; to be drawn: 0)

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
| world / people:hit | 0 / 1 | 1 | 0 | 0 |
| world / people:impostors | 1 / 0 | 1 | 1 | 0 |
| player-body / humans:median:lod# | 0 / 2 | 2 | 0 | 0 |

people: sim out of doors within 60 m 141 (open ground 0, inside walled courts 141, walking 0; places {"h":141}; 250 m 428); crowd attached 422, skinned drawn 4 by LOD [0,0,0,4], impostors drawn 66 of 219 candidates

town roofs (150 m round [-811,-287]): up-facing area above 1.8 m 1098 m², wall area 4661 m², ratio 0.236 (23046 triangles)

<details><summary>all classes (top 60 by triangles)</summary>

| object key | vis / hidden | inst in frustum | < 60 m | tris | mats | tiers |
|---|---|---|---|---|---|---|
| world / relief:figures | 9 / 3 | 927 | 0 | 1690000 | MeshStandardNodeMaterial | C |
| terrain | 208 / 0 | 74 | 2 | 775680 | MeshStandardNodeMaterial | C |
| world / settlement:q_s#:far | 4 / 0 | 4 | 0 | 367500 | MeshStandardNodeMaterial | C |
| world / plain-orchards-far | 1 / 0 | 1 | 0 | 176772 | MeshStandardNodeMaterial |  |
| world / river-banks | 1 / 0 | 1 | 0 | 159880 | MeshStandardNodeMaterial | C |
| world / settlement:q_w#:far | 3 / 0 | 1 | 1 | 120854 | MeshStandardNodeMaterial | C |
| world / settlement:ground | 1 / 0 | 1 | 1 | 95156 | MeshStandardNodeMaterial | C |
| world / settlement:near:plaster | 1 / 0 | 1 | 0 | 85791 | MeshStandardNodeMaterial | C |
| world / plain-stone | 1 / 0 | 1 | 1 | 84008 | MeshStandardNodeMaterial | C |
| world / plain-tracks | 1 / 0 | 1 | 0 | 75768 | MeshStandardNodeMaterial | C |
| world / plain-villages--#,-# | 2 / 0 | 1 | 0 | 58588 | MeshStandardNodeMaterial | C |
| world / plain-canal-banks | 1 / 0 | 1 | 0 | 55524 | MeshStandardNodeMaterial | C |
| world / river-water | 1 / 0 | 1 | 0 | 50324 | MeshStandardNodeMaterial |  |
| world / settlement:near:timber | 1 / 0 | 1 | 0 | 50213 | MeshStandardNodeMaterial | C |
| world / animals:sheep:lod# | 2 / 0 | 47 | 0 | 46060 | MeshStandardNodeMaterial |  |
| world / interiors:cloth | 1 / 0 | 1 | 0 | 37403 | MeshStandardNodeMaterial | C |
| world / animals:goat:lod# | 2 / 0 | 38 | 0 | 37240 | MeshStandardNodeMaterial |  |
| world / settlement:near:items | 1 / 0 | 1 | 0 | 36105 | MeshStandardNodeMaterial | C |
| world / plain-villages-#,# | 2 / 0 | 1 | 1 | 35002 | MeshStandardNodeMaterial | C |
| world / ledges:far | 1 / 0 | 1 | 0 | 28850 | ledges |  |
| plain-qanats / qanat-tile:#,-# | 2 / 13 | 318 | 0 | 28620 | MeshStandardNodeMaterial | C |
| world / settlement:near:props | 1 / 0 | 1 | 0 | 24302 | MeshStandardNodeMaterial | C |
| world / settlement:refuse | 1 / 0 | 1 | 1 | 22368 | MeshStandardNodeMaterial | C |
| world / settlement:roads | 1 / 0 | 1 | 1 | 20956 | MeshStandardNodeMaterial | C |
| world / settlement:gardens:far | 1 / 0 | 1 | 1 | 15864 | MeshStandardNodeMaterial | C |
| world / settlement:near:stone | 1 / 0 | 1 | 0 | 14130 | MeshStandardNodeMaterial | C |
| world / interiors:clay | 1 / 0 | 1 | 0 | 12332 | MeshStandardNodeMaterial | C |
| world / rock-stone:namaqualand_stones_#_v#:lod# | 10 / 0 | 33 | 33 | 9385 | scan:namaqualand_stones_01_v1, scan:namaqualand_stones_01_v2, scan:namaqualand_stones_01_v3, scan:namaqualand_stones_01_v4 |  |
| world / settlement:water | 1 / 0 | 1 | 1 | 9148 | MeshStandardNodeMaterial | C |
| world / rock-stone:namaqualand_rocks_#_v#:lod# | 8 / 0 | 24 | 24 | 8843 | scan:namaqualand_rocks_01_v1, scan:namaqualand_rocks_01_v2, scan:namaqualand_rocks_01_v3, scan:namaqualand_rocks_01_v4 |  |
| world / flora-camelthorn:model:lod# | 2 / 0 | 23 | 23 | 6648 | life:camelthorn |  |
| world / animals:donkey:lod# | 2 / 1 | 1 | 1 | 5879 | MeshStandardNodeMaterial |  |
| world / fire | 1 / 0 | 2230 | 3 | 4460 | MeshBasicNodeMaterial |  |
| world / bird-chukar:stand# | 2 / 0 | 24 | 0 | 4224 | life:chukar |  |
| world / props:carried | 1 / 0 | 1 | 0 | 4056 | MeshStandardNodeMaterial |  |
| world / flora-cushion:model:lod# | 2 / 0 | 20 | 20 | 3760 | life:cushion |  |
| world / rock-boulder:namaqualand_boulder_#:lod# | 10 / 0 | 8 | 2 | 3048 | scan:namaqualand_boulder_02, scan:namaqualand_boulder_03, scan:namaqualand_boulder_04, scan:namaqualand_boulder_05 |  |
| Points | 1 / 0 | 1 | 0 | 2973 | PointsNodeMaterial |  |
| world / court-camps:ridge:shell | 1 / 0 | 179 | 0 | 2864 | MeshStandardNodeMaterial | C |
| world / rock-stone:rock_#:lod# | 4 / 0 | 16 | 16 | 2513 | scan:rock_07, scan:rock_09 |  |
| plain-field-fill / field:fill_stall_reed:lod# | 1 / 1 | 4 | 0 | 2448 | MeshStandardNodeMaterial | C |
| world / settlement:q_b#:far | 1 / 0 | 1 | 0 | 2246 | MeshStandardNodeMaterial | C |
| world / bird-crow:stand# | 2 / 0 | 12 | 0 | 2112 | life:crow |  |
| plain-works / works:wo_hurdles | 1 / 0 | 3 | 0 | 2034 | MeshStandardNodeMaterial | C |
| world / settlement:near:brick | 1 / 0 | 1 | 0 | 2031 | MeshStandardNodeMaterial | B/C |
| plain-works / works:jar_store | 1 / 0 | 22 | 0 | 1980 | MeshStandardNodeMaterial | C |
| world / rock-stone:stone_#:lod# | 2 / 0 | 12 | 12 | 1909 | scan:stone_01 |  |
| plain-works / works:vat | 1 / 0 | 6 | 0 | 1800 | MeshStandardNodeMaterial | C |
| world / settlement:burial_ground_town:stone | 1 / 0 | 1 | 0 | 1740 | MeshStandardNodeMaterial | C |
| world / small-lizard:lod# | 2 / 0 | 2 | 2 | 1720 | life:lizard |  |
| world / fauna:camp-lines:t_west | 1 / 0 | 1 | 0 | 1720 | MeshStandardNodeMaterial |  |
| plain-works / works:sack | 1 / 0 | 14 | 0 | 1596 | MeshStandardNodeMaterial | C |
| world / court-camps:black:shell | 1 / 0 | 111 | 0 | 1554 | MeshStandardNodeMaterial | C |
| plain-works / works:manger | 1 / 0 | 4 | 0 | 1480 | MeshStandardNodeMaterial | C |
| world / flora-thistle:model:lod# | 2 / 0 | 17 | 17 | 1462 | life:thistle |  |
| world / fire:coals | 1 / 0 | 683 | 1 | 1366 | MeshBasicNodeMaterial |  |
| Mesh | 2 / 2 | 2 | 0 | 972 | MeshBasicNodeMaterial, NodeMaterial |  |
| plain-works / works:quern | 1 / 0 | 8 | 0 | 960 | MeshStandardNodeMaterial | C |
| world / settlement:trees-wood-lod# | 2 / 0 | 2 | 0 | 896 | MeshStandardNodeMaterial |  |
| world / plain-trees-wood-lod# | 2 / 0 | 2 | 0 | 896 | MeshStandardNodeMaterial |  |

</details>

## qs1: a q_s1 lane on the road south at day 0, 10:00 (cov-381's spot) (day 0, 10 h)

camera -397, -894.7, -16.2; sim people within 60 m: 140, within 250 m: 240; crowd stats: {"draws":12,"triangles":328208,"people":115,"byLod":[5,18,0,92],"shadowDraws":7,"shadowTriangles":21677,"propDraws":4,"props":72,"propTriangles":240174,"propsDropped":0,"placeholderActs":0,"motionCapture":46,"motionAuthored":69,"things":{"draws":9,"instances":36,"triangles":72392,"kinds":{"beam":9,"

| class | meshes visible / hidden | instances in frustum | of them < 60 m | triangles in frustum |
|---|---|---|---|---|
| people (skinned, any LOD) | 19 / 31 | 19 | 15 | 109492 |
| people LOD3 (far) | 0 / 0 | 0 | 0 | 0 |
| people impostors | 1 / 0 | 1 | 0 | 2 |
| house roofs | 13 / 5 | 6 | 2 | 1662 |
| house walls | 4 / 0 | 1 | 1 | 300 |
| ground fill / props | 118 / 221 | 560 | 257 | 356221 |
| trees | 16 / 0 | 16 | 0 | 181066 |
| crops / flora | 33 / 30 | 59 | 47 | 11836 |
| fires / lamps | 13 / 1 | 3919 | 55 | 8278 |
| water | 11 / 3 | 54 | 18 | 281172 |
| animals | 136 / 10 | 259 | 50 | 163222 |
| terrace architecture | 118 / 219 | 927 | 0 | 1690000 |

shadow-casting lights: [{"name":"","far":2000,"size":[240]}]

page: backend WebGL2, norender true, catch-up ticks 0 (still catching up: false), crowd looks pending 0

people in the frustum: within 40 m 23 of 69; within 60 m 46 of 140 (behind court walls for this eye: 27; to be drawn: 19)

| people mesh | visible / hidden meshes | instances (count) | in frustum | < 60 m |
|---|---|---|---|---|
| world / humans:persian:shadow | 0 / 1 | 1 | 0 | 0 |
| world / humans:persian:shadow-far | 1 / 0 | 1 | 1 | 0 |
| world / humans:persian:lod# | 2 / 2 | 4 | 2 | 1 |
| world / humans:median:shadow | 0 / 1 | 1 | 0 | 0 |
| world / humans:median:shadow-far | 1 / 0 | 1 | 1 | 0 |
| world / humans:median:lod# | 2 / 2 | 4 | 2 | 1 |
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
| world / people:hit | 0 / 1 | 1 | 0 | 0 |
| world / people:impostors | 1 / 0 | 1 | 1 | 0 |
| player-body / humans:median:lod# | 0 / 2 | 2 | 0 | 0 |

people: sim out of doors within 60 m 140 (open ground 41, inside walled courts 99, walking 0; places {"h":85,"lane":39,"ws":14,"well":1,"ws_textile":1}; 250 m 240); crowd attached 301, skinned drawn 115 by LOD [5,18,0,92], impostors drawn 9 of 617 candidates

town roofs (150 m round [-455,-1033]): up-facing area above 1.8 m 25956 m², wall area 95175 m², ratio 0.273 (199185 triangles)

<details><summary>all classes (top 60 by triangles)</summary>

| object key | vis / hidden | inst in frustum | < 60 m | tris | mats | tiers |
|---|---|---|---|---|---|---|
| world / relief:figures | 9 / 3 | 927 | 0 | 1690000 | MeshStandardNodeMaterial | C |
| terrain | 208 / 0 | 55 | 3 | 740608 | MeshStandardNodeMaterial | C |
| world / settlement:q_s#:far | 4 / 0 | 3 | 1 | 298284 | MeshStandardNodeMaterial | C |
| world / settlement:near:plaster | 1 / 0 | 1 | 0 | 190069 | MeshStandardNodeMaterial | C |
| world / plain-orchards-far | 1 / 0 | 1 | 0 | 176772 | MeshStandardNodeMaterial |  |
| world / river-banks | 1 / 0 | 1 | 0 | 159880 | MeshStandardNodeMaterial | C |
| world / props:carried | 1 / 0 | 37 | 24 | 150072 | MeshStandardNodeMaterial |  |
| world / plain-villages--#,-# | 2 / 0 | 2 | 0 | 142112 | MeshStandardNodeMaterial | C |
| world / settlement:near:timber | 1 / 0 | 1 | 0 | 122887 | MeshStandardNodeMaterial | C |
| world / animals:hen:lod# | 1 / 0 | 155 | 16 | 97030 | MeshStandardNodeMaterial |  |
| world / settlement:ground | 1 / 0 | 1 | 1 | 95156 | MeshStandardNodeMaterial | C |
| world / settlement:near:items | 1 / 0 | 1 | 0 | 88724 | MeshStandardNodeMaterial | C |
| world / props:tools | 2 / 2 | 32 | 11 | 86196 | MeshStandardNodeMaterial |  |
| world / plain-stone | 1 / 0 | 1 | 1 | 84008 | MeshStandardNodeMaterial | C |
| world / plain-tracks | 1 / 0 | 1 | 0 | 75768 | MeshStandardNodeMaterial | C |
| world / plain-villages--#,# | 4 / 0 | 1 | 0 | 67086 | MeshStandardNodeMaterial | C |
| world / plain-canal-banks | 1 / 0 | 1 | 0 | 55524 | MeshStandardNodeMaterial | C |
| world / river-water | 1 / 0 | 1 | 0 | 50324 | MeshStandardNodeMaterial |  |
| world / settlement:near:props | 1 / 0 | 1 | 0 | 49361 | MeshStandardNodeMaterial | C |
| world / interiors:cloth | 1 / 0 | 1 | 0 | 47806 | MeshStandardNodeMaterial | C |
| world / humans:woman:lod# | 3 / 1 | 3 | 3 | 43862 | human |  |
| world / work:loom | 1 / 0 | 11 | 0 | 39820 | MeshStandardNodeMaterial |  |
| world / humans:child:lod# | 3 / 1 | 3 | 3 | 36304 | human |  |
| world / plain-villages-#,# | 2 / 0 | 1 | 1 | 35002 | MeshStandardNodeMaterial | C |
| world / ledges:far | 1 / 0 | 1 | 0 | 33710 | ledges |  |
| world / settlement:near:stone | 1 / 0 | 1 | 0 | 29820 | MeshStandardNodeMaterial | C |
| world / settlement-doors:# | 6 / 0 | 126 | 17 | 24948 | MeshStandardNodeMaterial | C |
| world / settlement:refuse | 1 / 0 | 1 | 1 | 22368 | MeshStandardNodeMaterial | C |
| world / work:beam | 1 / 0 | 9 | 3 | 21276 | MeshStandardNodeMaterial |  |
| world / settlement:roads | 1 / 0 | 1 | 1 | 20956 | MeshStandardNodeMaterial | C |
| world / animals:dog:lod# | 1 / 0 | 19 | 1 | 18582 | MeshStandardNodeMaterial |  |
| world / settlement:gardens:far | 1 / 0 | 1 | 1 | 15864 | MeshStandardNodeMaterial | C |
| world / animals:goat:lod# | 3 / 0 | 16 | 10 | 15680 | MeshStandardNodeMaterial |  |
| world / interiors:clay | 1 / 0 | 1 | 0 | 13386 | MeshStandardNodeMaterial | C |
| world / animals:cock:lod# | 1 / 0 | 19 | 2 | 11894 | MeshStandardNodeMaterial |  |
| world / settlement:water | 1 / 0 | 1 | 1 | 9148 | MeshStandardNodeMaterial | C |
| world / humans:worker:lod# | 2 / 2 | 2 | 2 | 7581 | human |  |
| world / humans:persian:lod# | 2 / 2 | 2 | 1 | 7250 | human |  |
| world / animals:donkey:lod# | 2 / 1 | 2 | 2 | 7054 | MeshStandardNodeMaterial |  |
| world / humans:median:lod# | 2 / 2 | 2 | 1 | 6483 | human |  |
| world / fill:jar_water:clay:lod# | 3 / 0 | 50 | 17 | 6296 | MeshStandardNodeMaterial | C |
| world / animals:cat:lod# | 1 / 0 | 10 | 2 | 5880 | MeshStandardNodeMaterial |  |
| world / fill:wo_dung_cakes:dung:lod# | 2 / 1 | 54 | 9 | 5600 | MeshStandardNodeMaterial | C |
| world / settlement:near:brick | 1 / 0 | 1 | 0 | 5466 | MeshStandardNodeMaterial | B/C |
| world / fire | 1 / 0 | 2715 | 33 | 5430 | MeshBasicNodeMaterial |  |
| world / fill:mat:matting:lod# | 2 / 1 | 32 | 6 | 4940 | MeshStandardNodeMaterial | C |
| world / flora-camelthorn:model:lod# | 2 / 0 | 9 | 9 | 4416 | life:camelthorn |  |
| world / fill:fill_bundle:wood:lod# | 2 / 1 | 12 | 12 | 4248 | MeshStandardNodeMaterial | C |
| world / fill:fill_line:cloth_a:lod# | 2 / 1 | 31 | 7 | 3720 | MeshStandardNodeMaterial | C |
| world / fill:jar_store:clay:lod# | 2 / 1 | 41 | 9 | 3690 | MeshStandardNodeMaterial | C |
| world / rock-stone:namaqualand_rocks_#_v#:lod# | 8 / 0 | 6 | 6 | 3399 | scan:namaqualand_rocks_01_v1, scan:namaqualand_rocks_01_v2, scan:namaqualand_rocks_01_v3, scan:namaqualand_rocks_01_v4 |  |
| world / rock-stone:namaqualand_stones_#_v#:lod# | 10 / 0 | 10 | 10 | 3396 | scan:namaqualand_stones_01_v1, scan:namaqualand_stones_01_v2, scan:namaqualand_stones_01_v3, scan:namaqualand_stones_01_v4 |  |
| world / road-litter | 1 / 0 | 15 | 15 | 3120 | MeshStandardNodeMaterial |  |
| world / fill:fill_line:cloth_b:lod# | 2 / 1 | 31 | 7 | 3100 | MeshStandardNodeMaterial | C |
| Points | 1 / 0 | 1 | 0 | 2973 | PointsNodeMaterial |  |
| world / humans:woman:shadow | 1 / 0 | 1 | 1 | 2640 | human |  |
| world / props:children | 1 / 0 | 2 | 2 | 2604 | MeshStandardNodeMaterial |  |
| world / fill:fill_stall:cloth:lod# | 3 / 0 | 1 | 1 | 2600 | MeshStandardNodeMaterial | C |
| world / work:knucklebones | 1 / 0 | 9 | 5 | 2520 | MeshStandardNodeMaterial |  |
| world / fill:sack:cloth:lod# | 3 / 0 | 8 | 8 | 2490 | MeshStandardNodeMaterial | C |

</details>

## court: a town court, noon (cov-037) (day 14, 11.07 h)

camera -535.4, 401.1, -12; sim people within 60 m: 59, within 250 m: 90; crowd stats: {"draws":7,"triangles":56483,"people":21,"byLod":[1,1,0,19],"shadowDraws":2,"shadowTriangles":3360,"propDraws":4,"props":24,"propTriangles":84798,"propsDropped":0,"placeholderActs":0,"motionCapture":5,"motionAuthored":16,"things":{"draws":6,"instances":6,"triangles":5120,"kinds":{"beam":1,"knucklebo

| class | meshes visible / hidden | instances in frustum | of them < 60 m | triangles in frustum |
|---|---|---|---|---|
| people (skinned, any LOD) | 9 / 41 | 9 | 7 | 50870 |
| people LOD3 (far) | 0 / 0 | 0 | 0 | 0 |
| people impostors | 1 / 0 | 1 | 0 | 2 |
| house roofs | 13 / 5 | 14 | 8 | 3878 |
| house walls | 4 / 0 | 1 | 1 | 300 |
| ground fill / props | 110 / 229 | 316 | 235 | 163440 |
| trees | 16 / 0 | 16 | 0 | 181066 |
| crops / flora | 25 / 38 | 60 | 14 | 8744 |
| fires / lamps | 13 / 1 | 2994 | 59 | 7614 |
| water | 11 / 3 | 34 | 22 | 313440 |
| animals | 137 / 11 | 290 | 37 | 227618 |
| terrace architecture | 120 / 217 | 928 | 0 | 1690036 |

shadow-casting lights: [{"name":"","far":2000,"size":[240]}]

page: backend WebGL2, norender true, catch-up ticks 0 (still catching up: false), crowd looks pending 0

people in the frustum: within 40 m 2 of 22; within 60 m 7 of 59 (behind court walls for this eye: 5; to be drawn: 2)

| people mesh | visible / hidden meshes | instances (count) | in frustum | < 60 m |
|---|---|---|---|---|
| world / humans:persian:shadow | 0 / 1 | 1 | 0 | 0 |
| world / humans:persian:shadow-far | 0 / 1 | 1 | 0 | 0 |
| world / humans:persian:lod# | 1 / 3 | 4 | 1 | 0 |
| world / humans:median:shadow | 0 / 1 | 1 | 0 | 0 |
| world / humans:median:shadow-far | 0 / 1 | 1 | 0 | 0 |
| world / humans:median:lod# | 1 / 3 | 4 | 1 | 0 |
| world / humans:worker:shadow | 0 / 1 | 1 | 0 | 0 |
| world / humans:worker:shadow-far | 1 / 0 | 1 | 1 | 1 |
| world / humans:worker:lod# | 2 / 2 | 4 | 2 | 2 |
| world / humans:woman:shadow | 1 / 0 | 1 | 1 | 1 |
| world / humans:woman:shadow-far | 0 / 1 | 1 | 0 | 0 |
| world / humans:woman:lod# | 2 / 2 | 4 | 2 | 2 |
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
| world / people:hit | 0 / 1 | 1 | 0 | 0 |
| world / people:impostors | 1 / 0 | 1 | 1 | 0 |
| player-body / humans:median:lod# | 0 / 2 | 2 | 0 | 0 |

people: sim out of doors within 60 m 59 (open ground 16, inside walled courts 43, walking 0; places {"h":47,"lane":12}; 250 m 90); crowd attached 339, skinned drawn 21 by LOD [1,1,0,19], impostors drawn 17 of 814 candidates

town roofs (150 m round [-423,500]): up-facing area above 1.8 m 18156 m², wall area 70488 m², ratio 0.258 (171658 triangles)

<details><summary>all classes (top 60 by triangles)</summary>

| object key | vis / hidden | inst in frustum | < 60 m | tris | mats | tiers |
|---|---|---|---|---|---|---|
| world / relief:figures | 9 / 3 | 927 | 0 | 1690000 | MeshStandardNodeMaterial | C |
| terrain | 208 / 0 | 71 | 2 | 847616 | MeshStandardNodeMaterial | C |
| world / plain-orchards-far | 1 / 0 | 1 | 0 | 176772 | MeshStandardNodeMaterial |  |
| world / river-banks | 1 / 0 | 1 | 0 | 159880 | MeshStandardNodeMaterial | C |
| world / settlement:near:plaster | 1 / 0 | 1 | 0 | 154485 | MeshStandardNodeMaterial | C |
| world / plain-villages-#,# | 2 / 0 | 2 | 1 | 122620 | MeshStandardNodeMaterial | C |
| world / settlement:q_w#:far | 3 / 0 | 1 | 1 | 110574 | MeshStandardNodeMaterial | C |
| plain-works / works:wo_brick_field | 1 / 0 | 428 | 0 | 108712 | MeshStandardNodeMaterial | C |
| world / settlement:ground | 1 / 0 | 1 | 1 | 95156 | MeshStandardNodeMaterial | C |
| world / settlement:near:timber | 1 / 0 | 1 | 0 | 89284 | MeshStandardNodeMaterial | C |
| world / plain-stone | 1 / 0 | 1 | 1 | 84008 | MeshStandardNodeMaterial | C |
| world / plain-tracks | 1 / 0 | 1 | 0 | 75768 | MeshStandardNodeMaterial | C |
| world / props:carried | 1 / 0 | 18 | 4 | 73008 | MeshStandardNodeMaterial |  |
| world / settlement:near:items | 1 / 0 | 1 | 0 | 66328 | MeshStandardNodeMaterial | C |
| world / animals:sheep:lod# | 2 / 0 | 66 | 0 | 64680 | MeshStandardNodeMaterial |  |
| world / settlement:q_n#:far | 1 / 0 | 1 | 0 | 63066 | MeshStandardNodeMaterial | C |
| world / plain-canal-banks | 1 / 0 | 1 | 0 | 55524 | MeshStandardNodeMaterial | C |
| world / animals:goat:lod# | 2 / 1 | 55 | 6 | 53900 | MeshStandardNodeMaterial |  |
| world / river-water | 1 / 0 | 1 | 0 | 50324 | MeshStandardNodeMaterial |  |
| world / interiors:cloth | 1 / 0 | 1 | 0 | 47891 | MeshStandardNodeMaterial | C |
| world / ledges:far | 1 / 0 | 1 | 0 | 44560 | ledges |  |
| world / humans:woman:lod# | 2 / 2 | 2 | 2 | 37995 | human |  |
| world / settlement:near:props | 1 / 0 | 1 | 0 | 36376 | MeshStandardNodeMaterial | C |
| world / nr-cliff | 1 / 0 | 1 | 0 | 33260 | MeshStandardNodeMaterial | C |
| world / animals:hen:lod# | 2 / 0 | 44 | 13 | 27544 | MeshStandardNodeMaterial |  |
| world / animals:dog:lod# | 1 / 0 | 26 | 2 | 25428 | MeshStandardNodeMaterial |  |
| world / settlement:channel_stones | 1 / 0 | 1 | 0 | 24588 | MeshStandardNodeMaterial | C |
| world / settlement:near:stone | 1 / 0 | 1 | 0 | 22748 | MeshStandardNodeMaterial | C |
| world / settlement:refuse | 1 / 0 | 1 | 1 | 22368 | MeshStandardNodeMaterial | C |
| world / settlement:roads | 1 / 0 | 1 | 1 | 20956 | MeshStandardNodeMaterial | C |
| world / animals:donkey:lod# | 3 / 0 | 7 | 5 | 17633 | MeshStandardNodeMaterial |  |
| world / settlement:gardens:far | 1 / 0 | 1 | 1 | 15864 | MeshStandardNodeMaterial | C |
| quarries-detail / plain-quarries:rock:quarry_sivand | 1 / 0 | 1 | 0 | 13745 | bedrock:ground |  |
| world / interiors:clay | 1 / 0 | 1 | 0 | 12818 | MeshStandardNodeMaterial | C |
| world / nr_darius_tomb | 1 / 0 | 1 | 0 | 11154 | MeshStandardNodeMaterial | C |
| world / nr_xerxes_tomb | 1 / 0 | 1 | 0 | 11154 | MeshStandardNodeMaterial | C |
| world / animals:mule:lod# | 1 / 0 | 8 | 0 | 10968 | MeshStandardNodeMaterial |  |
| world / props:tools | 2 / 2 | 5 | 3 | 10488 | MeshStandardNodeMaterial |  |
| world / animals:horse:lod# | 1 / 0 | 7 | 0 | 9597 | MeshStandardNodeMaterial |  |
| world / settlement:water | 1 / 0 | 1 | 1 | 9148 | MeshStandardNodeMaterial | C |
| world / settlement:q_g#:far | 1 / 0 | 1 | 0 | 8980 | MeshStandardNodeMaterial | C |
| world / settlement-doors:# | 6 / 0 | 46 | 16 | 8668 | MeshStandardNodeMaterial | C |
| world / settlement:canal_banks | 1 / 0 | 1 | 0 | 7836 | MeshStandardNodeMaterial | C |
| world / nr-life | 1 / 0 | 1 | 0 | 7788 | MeshStandardNodeMaterial | C |
| world / humans:worker:lod# | 2 / 2 | 2 | 2 | 7581 | human |  |
| world / fill:jar_water:clay:lod# | 3 / 0 | 28 | 21 | 6140 | MeshStandardNodeMaterial | C |
| world / bedrock-ground:talus#:lod# | 1 / 2 | 75 | 0 | 5925 | bedrock:ground |  |
| plain-works / works:wo_brick_stack | 1 / 0 | 18 | 0 | 4644 | MeshStandardNodeMaterial | C |
| world / animals:cock:lod# | 1 / 0 | 7 | 1 | 4382 | MeshStandardNodeMaterial |  |
| world / settlement:official:far | 1 / 0 | 1 | 0 | 4298 | MeshStandardNodeMaterial | C |
| world / fire | 1 / 0 | 2072 | 34 | 4144 | MeshBasicNodeMaterial |  |
| world / settlement:zone_dasht_e_gohar:mud | 1 / 0 | 1 | 0 | 4090 | MeshStandardNodeMaterial | C |
| plain-qanats / qanat-tile:#,# | 1 / 13 | 43 | 0 | 3870 | MeshStandardNodeMaterial | C |
| world / bedrock-ground:outcrop#:lod# | 1 / 2 | 35 | 0 | 3430 | bedrock:ground |  |
| world / fill:fill_bundle:wood:lod# | 3 / 0 | 11 | 11 | 3339 | MeshStandardNodeMaterial | C |
| world / fill:wo_dung_cakes:dung:lod# | 2 / 1 | 23 | 14 | 3300 | MeshStandardNodeMaterial | C |
| world / roofwear:drip_jar:clay | 1 / 0 | 7 | 4 | 3108 | MeshStandardNodeMaterial | C |
| Points | 1 / 0 | 1 | 0 | 2973 | PointsNodeMaterial |  |
| world / fill:mat:matting:lod# | 2 / 1 | 13 | 8 | 2945 | MeshStandardNodeMaterial | C |
| world / animals:cat:lod# | 1 / 0 | 5 | 2 | 2940 | MeshStandardNodeMaterial |  |

</details>

## terrace: the Terrace, noon (cov-252) (day 168, 12.586 h)

camera 84.8, 9.8, 1.6; sim people within 60 m: 18, within 250 m: 151; crowd stats: {"draws":6,"triangles":211052,"people":88,"byLod":[0,25,0,63],"shadowDraws":3,"shadowTriangles":17298,"propDraws":3,"props":41,"propTriangles":162248,"propsDropped":0,"placeholderActs":0,"motionCapture":16,"motionAuthored":72,"things":{"draws":2,"instances":2,"triangles":2440,"kinds":{"knucklebones"

| class | meshes visible / hidden | instances in frustum | of them < 60 m | triangles in frustum |
|---|---|---|---|---|
| people (skinned, any LOD) | 9 / 41 | 9 | 9 | 22363 |
| people LOD3 (far) | 0 / 0 | 0 | 0 | 0 |
| people impostors | 1 / 0 | 1 | 0 | 2 |
| house roofs | 11 / 7 | 177 | 2 | 2712 |
| house walls | 4 / 0 | 9 | 2 | 940 |
| ground fill / props | 26 / 313 | 82 | 52 | 167597 |
| trees | 16 / 0 | 16 | 0 | 181066 |
| crops / flora | 19 / 44 | 186 | 0 | 24690 |
| fires / lamps | 10 / 4 | 2280 | 6 | 30272 |
| water | 9 / 5 | 8 | 4 | 284832 |
| animals | 126 / 23 | 54 | 1 | 6815 |
| terrace architecture | 137 / 200 | 1050 | 12 | 1826232 |

shadow-casting lights: [{"name":"","far":2000,"size":[240]}]

page: backend WebGL2, norender true, catch-up ticks 1 (still catching up: false), crowd looks pending 0

people in the frustum: within 40 m 0 of 0; within 60 m 18 of 18 (behind court walls for this eye: 0; to be drawn: 18)

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
| world / people:hit | 0 / 1 | 1 | 0 | 0 |
| world / people:impostors | 1 / 0 | 1 | 1 | 0 |
| player-body / humans:median:lod# | 0 / 2 | 2 | 0 | 0 |

people: sim out of doors within 60 m 18 (open ground 9, inside walled courts 0, walking 0; places {"h100_door_N1":4,"worksite":4,"querns":1}; 250 m 151); crowd attached 163, skinned drawn 88 by LOD [0,25,0,63], impostors drawn 2 of 1003 candidates

town roofs (150 m round [145,11]): up-facing area above 1.8 m 0 m², wall area 0 m², ratio null (0 triangles)

<details><summary>all classes (top 60 by triangles)</summary>

| object key | vis / hidden | inst in frustum | < 60 m | tris | mats | tiers |
|---|---|---|---|---|---|---|
| world / relief:figures | 9 / 3 | 927 | 0 | 1690000 | MeshStandardNodeMaterial | C |
| terrain | 208 / 0 | 72 | 2 | 752640 | MeshStandardNodeMaterial | C |
| world / garrison:room_fittings:bedrolls | 1 / 0 | 624 | 0 | 469248 | MeshStandardNodeMaterial | C |
| world / garrison:room_fittings:mats | 1 / 0 | 416 | 0 | 372320 | MeshStandardNodeMaterial | C |
| world / garrison:room_fittings:mats_b | 1 / 0 | 208 | 0 | 186160 | MeshStandardNodeMaterial | C |
| world / plain-orchards-far | 1 / 0 | 1 | 0 | 176772 | MeshStandardNodeMaterial |  |
| world / river-banks | 1 / 0 | 1 | 0 | 159880 | MeshStandardNodeMaterial | C |
| world / props:carried | 1 / 0 | 38 | 10 | 154128 | MeshStandardNodeMaterial |  |
| world / plain-villages-#,# | 2 / 0 | 2 | 1 | 122620 | MeshStandardNodeMaterial | C |
| world / settlement:ground | 1 / 0 | 1 | 1 | 95156 | MeshStandardNodeMaterial | C |
| world / work:objects | 1 / 0 | 1 | 1 | 92036 | MeshStandardNodeMaterial |  |
| world / plain-stone | 1 / 0 | 1 | 1 | 84008 | MeshStandardNodeMaterial | C |
| world / plain-tracks | 1 / 0 | 1 | 0 | 75768 | MeshStandardNodeMaterial | C |
| world / ledges:far | 1 / 0 | 1 | 0 | 66670 | ledges |  |
| world / fortification_e:mudbrick | 2 / 0 | 2 | 2 | 66540 | MeshStandardNodeMaterial | B/C |
| world / plain-canal-banks | 1 / 0 | 1 | 0 | 55524 | MeshStandardNodeMaterial | C |
| world / relief:far-set | 8 / 1 | 1 | 1 | 52314 | MeshStandardNodeMaterial | C |
| world / river-water | 1 / 0 | 1 | 0 | 50324 | MeshStandardNodeMaterial |  |
| world / hall#:construction:base_bell:lod# | 1 / 1 | 95 | 26 | 43320 | model:column_base_bell:0:limestone_carved, model:column_base_bell:1:limestone_carved | C |
| world / treasury:arrow_bundle | 1 / 0 | 40 | 0 | 35200 | MeshStandardNodeMaterial | C |
| world / treasury:alabaster_vessel | 1 / 0 | 69 | 0 | 31050 | MeshStandardNodeMaterial | C |
| world / treasury:mudbrick | 1 / 0 | 1 | 0 | 24072 | MeshStandardNodeMaterial | B/C |
| world / c#:dressings:cloth | 1 / 0 | 1 | 1 | 23770 | MeshStandardNodeMaterial | C |
| world / settlement:refuse | 1 / 0 | 1 | 1 | 22368 | MeshStandardNodeMaterial | C |
| world / scribes:tablets_filed | 1 / 0 | 294 | 0 | 22344 | clay-writing |  |
| world / treasury:mudbrick_painted | 2 / 0 | 2 | 0 | 21544 | MeshStandardNodeMaterial | B/C |
| world / hall#:construction:#|#|#:shaft:lod# | 7 / 7 | 48 | 11 | 21504 | model:column_shaft_f40:0:limestone_carved, model:column_shaft_f40:1:limestone_carved, model:column_shaft_drums:0:limestone_carved, model:column_shaft_drums:1:limestone_carved | C |
| world / settlement:roads | 1 / 0 | 1 | 1 | 20956 | MeshStandardNodeMaterial | C |
| world / garrison:mudbrick | 1 / 0 | 1 | 1 | 20292 | MeshStandardNodeMaterial | B/C |
| world / fire-body:hearth:stone | 1 / 0 | 9 | 1 | 19800 | MeshStandardNodeMaterial | C |
| world / bedrock-ground:outcrop#:lod# | 2 / 1 | 123 | 0 | 18580 | bedrock:ground |  |
| world / hall#:construction:#|#|#:protome:lod# | 1 / 1 | 30 | 6 | 16860 | model:capital_protome:0:limestone_carved, model:capital_protome:1:limestone_carved | C |
| world / apadana:palace_plaster | 1 / 0 | 1 | 1 | 16348 | MeshStandardNodeMaterial | B/C |
| world / garrison:room_fittings | 1 / 0 | 1 | 1 | 16124 | MeshStandardNodeMaterial | C |
| world / settlement:gardens:far | 1 / 0 | 1 | 1 | 15864 | MeshStandardNodeMaterial | C |
| world / apadana-glazed-frieze | 1 / 0 | 1 | 1 | 14912 | MeshStandardNodeMaterial | C |
| world / palace-glazed-bands | 1 / 0 | 1 | 1 | 14532 | MeshStandardNodeMaterial | C |
| world / treasury:textile_bale | 1 / 0 | 24 | 0 | 13632 | MeshStandardNodeMaterial | C |
| world / bedrock-ground:talus#:lod# | 1 / 2 | 153 | 0 | 12087 | bedrock:ground |  |
| world / apadana:limestone | 2 / 0 | 2 | 2 | 10875 | MeshStandardNodeMaterial | C |
| world / ledges:mid | 1 / 0 | 1 | 0 | 10840 | ledges |  |
| world / treasury:timber:ceiling | 1 / 0 | 1 | 0 | 10506 | MeshStandardNodeMaterial | C |
| world / treasury:scale_armour | 1 / 0 | 18 | 0 | 10224 | MeshStandardNodeMaterial | C |
| world / settlement:water | 1 / 0 | 1 | 1 | 9148 | MeshStandardNodeMaterial | C |
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
| world / bedrock-ground:outcrop#:lod#:cast | 1 / 0 | 62 | 0 | 6076 | bedrock:ground |  |
| world / treasury:blue_vessel | 1 / 0 | 18 | 0 | 6048 | MeshStandardNodeMaterial | C |
| world / humans:woman:lod# | 1 / 3 | 1 | 1 | 5867 | human |  |

</details>

## terrace_court: the Terrace at 10:00 with the court resident (day 40) (day 40, 10 h)

camera 84.8, 9.8, 1.6; sim people within 60 m: 28, within 250 m: 170; crowd stats: {"draws":6,"triangles":266050,"people":108,"byLod":[0,32,0,76],"shadowDraws":3,"shadowTriangles":22001,"propDraws":3,"props":56,"propTriangles":221836,"propsDropped":0,"placeholderActs":0,"motionCapture":18,"motionAuthored":90,"things":{"draws":2,"instances":2,"triangles":2440,"kinds":{"knucklebones

| class | meshes visible / hidden | instances in frustum | of them < 60 m | triangles in frustum |
|---|---|---|---|---|
| people (skinned, any LOD) | 9 / 41 | 9 | 9 | 22363 |
| people LOD3 (far) | 0 / 0 | 0 | 0 | 0 |
| people impostors | 1 / 0 | 1 | 0 | 2 |
| house roofs | 11 / 7 | 177 | 2 | 2712 |
| house walls | 4 / 0 | 9 | 2 | 828 |
| ground fill / props | 26 / 313 | 96 | 59 | 224381 |
| trees | 16 / 0 | 16 | 0 | 181066 |
| crops / flora | 19 / 44 | 186 | 0 | 24690 |
| fires / lamps | 10 / 4 | 2280 | 6 | 30272 |
| water | 9 / 5 | 8 | 4 | 284832 |
| animals | 127 / 22 | 248 | 1 | 197627 |
| terrace architecture | 138 / 203 | 1050 | 12 | 1826232 |

shadow-casting lights: [{"name":"","far":2000,"size":[240]}]

page: backend WebGL2, norender true, catch-up ticks 0 (still catching up: false), crowd looks pending 0

people in the frustum: within 40 m 0 of 0; within 60 m 26 of 28 (behind court walls for this eye: 0; to be drawn: 26)

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
| world / people:hit | 0 / 1 | 1 | 0 | 0 |
| world / people:impostors | 1 / 0 | 1 | 1 | 0 |
| player-body / humans:median:lod# | 0 / 2 | 2 | 0 | 0 |

people: sim out of doors within 60 m 28 (open ground 11, inside walled courts 0, walking 0; places {"h100_door_N1":10,"querns":1}; 250 m 170); crowd attached 181, skinned drawn 108 by LOD [0,32,0,76], impostors drawn 3 of 996 candidates

town roofs (150 m round [145,11]): up-facing area above 1.8 m 0 m², wall area 0 m², ratio null (0 triangles)

<details><summary>all classes (top 60 by triangles)</summary>

| object key | vis / hidden | inst in frustum | < 60 m | tris | mats | tiers |
|---|---|---|---|---|---|---|
| world / relief:figures | 9 / 3 | 927 | 0 | 1690000 | MeshStandardNodeMaterial | C |
| terrain | 208 / 0 | 72 | 2 | 752640 | MeshStandardNodeMaterial | C |
| world / garrison:room_fittings:bedrolls | 1 / 0 | 624 | 0 | 469248 | MeshStandardNodeMaterial | C |
| world / garrison:room_fittings:mats | 1 / 0 | 416 | 0 | 372320 | MeshStandardNodeMaterial | C |
| world / props:carried | 1 / 0 | 52 | 17 | 210912 | MeshStandardNodeMaterial |  |
| world / garrison:room_fittings:mats_b | 1 / 0 | 208 | 0 | 186160 | MeshStandardNodeMaterial | C |
| world / plain-orchards-far | 1 / 0 | 1 | 0 | 176772 | MeshStandardNodeMaterial |  |
| world / river-banks | 1 / 0 | 1 | 0 | 159880 | MeshStandardNodeMaterial | C |
| world / plain-villages-#,# | 2 / 0 | 2 | 1 | 122620 | MeshStandardNodeMaterial | C |
| world / animals:sheep:lod# | 1 / 1 | 116 | 0 | 113680 | MeshStandardNodeMaterial |  |
| world / settlement:ground | 1 / 0 | 1 | 1 | 95156 | MeshStandardNodeMaterial | C |
| world / work:objects | 1 / 0 | 1 | 1 | 92036 | MeshStandardNodeMaterial |  |
| world / plain-stone | 1 / 0 | 1 | 1 | 84008 | MeshStandardNodeMaterial | C |
| world / animals:goat:lod# | 1 / 2 | 79 | 0 | 77420 | MeshStandardNodeMaterial |  |
| world / plain-tracks | 1 / 0 | 1 | 0 | 75768 | MeshStandardNodeMaterial | C |
| world / ledges:far | 1 / 0 | 1 | 0 | 66670 | ledges |  |
| world / fortification_e:mudbrick | 2 / 0 | 2 | 2 | 66540 | MeshStandardNodeMaterial | B/C |
| world / plain-canal-banks | 1 / 0 | 1 | 0 | 55524 | MeshStandardNodeMaterial | C |
| world / relief:far-set | 8 / 1 | 1 | 1 | 52314 | MeshStandardNodeMaterial | C |
| world / river-water | 1 / 0 | 1 | 0 | 50324 | MeshStandardNodeMaterial |  |
| world / hall#:construction:base_bell:lod# | 1 / 1 | 95 | 26 | 43320 | model:column_base_bell:0:limestone_carved, model:column_base_bell:1:limestone_carved | C |
| world / treasury:arrow_bundle | 1 / 0 | 40 | 0 | 35200 | MeshStandardNodeMaterial | C |
| world / treasury:alabaster_vessel | 1 / 0 | 69 | 0 | 31050 | MeshStandardNodeMaterial | C |
| world / treasury:mudbrick | 1 / 0 | 1 | 0 | 24072 | MeshStandardNodeMaterial | B/C |
| world / c#:dressings:cloth | 1 / 0 | 1 | 1 | 23770 | MeshStandardNodeMaterial | C |
| world / settlement:refuse | 1 / 0 | 1 | 1 | 22368 | MeshStandardNodeMaterial | C |
| world / scribes:tablets_filed | 1 / 0 | 294 | 0 | 22344 | clay-writing |  |
| world / treasury:mudbrick_painted | 2 / 0 | 2 | 0 | 21544 | MeshStandardNodeMaterial | B/C |
| world / hall#:construction:#|#|#:shaft:lod# | 7 / 7 | 48 | 11 | 21504 | model:column_shaft_f40:0:limestone_carved, model:column_shaft_f40:1:limestone_carved, model:column_shaft_drums:0:limestone_carved, model:column_shaft_drums:1:limestone_carved | C |
| world / settlement:roads | 1 / 0 | 1 | 1 | 20956 | MeshStandardNodeMaterial | C |
| world / garrison:mudbrick | 1 / 0 | 1 | 1 | 20292 | MeshStandardNodeMaterial | B/C |
| world / fire-body:hearth:stone | 1 / 0 | 9 | 1 | 19800 | MeshStandardNodeMaterial | C |
| world / bedrock-ground:outcrop#:lod# | 2 / 1 | 123 | 0 | 18580 | bedrock:ground |  |
| world / hall#:construction:#|#|#:protome:lod# | 1 / 1 | 30 | 6 | 16860 | model:capital_protome:0:limestone_carved, model:capital_protome:1:limestone_carved | C |
| world / apadana:palace_plaster | 1 / 0 | 1 | 1 | 16348 | MeshStandardNodeMaterial | B/C |
| world / garrison:room_fittings | 1 / 0 | 1 | 1 | 16124 | MeshStandardNodeMaterial | C |
| world / settlement:gardens:far | 1 / 0 | 1 | 1 | 15864 | MeshStandardNodeMaterial | C |
| world / apadana-glazed-frieze | 1 / 0 | 1 | 1 | 14912 | MeshStandardNodeMaterial | C |
| world / palace-glazed-bands | 1 / 0 | 1 | 1 | 14532 | MeshStandardNodeMaterial | C |
| world / treasury:textile_bale | 1 / 0 | 24 | 0 | 13632 | MeshStandardNodeMaterial | C |
| world / bedrock-ground:talus#:lod# | 1 / 2 | 153 | 0 | 12087 | bedrock:ground |  |
| world / apadana:limestone | 2 / 0 | 2 | 2 | 10875 | MeshStandardNodeMaterial | C |
| world / ledges:mid | 1 / 0 | 1 | 0 | 10840 | ledges |  |
| world / treasury:timber:ceiling | 1 / 0 | 1 | 0 | 10506 | MeshStandardNodeMaterial | C |
| world / treasury:scale_armour | 1 / 0 | 18 | 0 | 10224 | MeshStandardNodeMaterial | C |
| world / settlement:water | 1 / 0 | 1 | 1 | 9148 | MeshStandardNodeMaterial | C |
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
| world / bedrock-ground:outcrop#:lod#:cast | 1 / 0 | 62 | 0 | 6076 | bedrock:ground |  |

</details>

## apadana: the Apadana hall, morning (cov-294) (day 200, 8.809 h)

camera 14.3, 32.6, 4.6; sim people within 60 m: 2, within 250 m: 297; crowd stats: {"draws":6,"triangles":59844,"people":76,"byLod":[0,1,0,75],"shadowDraws":1,"shadowTriangles":783,"propDraws":3,"props":68,"propTriangles":262998,"propsDropped":0,"placeholderActs":0,"motionCapture":2,"motionAuthored":74,"things":{"draws":1,"instances":1,"triangles":280,"kinds":{"knucklebones":1},"d

| class | meshes visible / hidden | instances in frustum | of them < 60 m | triangles in frustum |
|---|---|---|---|---|
| people (skinned, any LOD) | 7 / 43 | 7 | 2 | 10617 |
| people LOD3 (far) | 0 / 0 | 0 | 0 | 0 |
| people impostors | 1 / 0 | 1 | 0 | 2 |
| house roofs | 11 / 7 | 160 | 18 | 2352 |
| house walls | 4 / 0 | 1 | 1 | 300 |
| ground fill / props | 16 / 323 | 74 | 10 | 247742 |
| trees | 16 / 0 | 16 | 0 | 181066 |
| crops / flora | 19 / 44 | 126 | 0 | 13790 |
| fires / lamps | 10 / 4 | 2041 | 0 | 20610 |
| water | 9 / 5 | 10 | 5 | 309508 |
| animals | 125 / 24 | 50 | 1 | 6764 |
| terrace architecture | 149 / 202 | 1957 | 669 | 1967199 |

shadow-casting lights: [{"name":"","far":2000,"size":[240]}]

page: backend WebGL2, norender true, catch-up ticks 1 (still catching up: false), crowd looks pending 0

people in the frustum: within 40 m 0 of 1; within 60 m 1 of 2 (behind court walls for this eye: 0; to be drawn: 1)

| people mesh | visible / hidden meshes | instances (count) | in frustum | < 60 m |
|---|---|---|---|---|
| world / humans:persian:shadow | 0 / 1 | 1 | 0 | 0 |
| world / humans:persian:shadow-far | 1 / 0 | 1 | 1 | 1 |
| world / humans:persian:lod# | 2 / 2 | 4 | 2 | 1 |
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
| world / people:hit | 0 / 1 | 1 | 0 | 0 |
| world / people:impostors | 1 / 0 | 1 | 1 | 0 |
| player-body / humans:median:lod# | 0 / 2 | 2 | 0 | 0 |

people: sim out of doors within 60 m 2 (open ground 1, inside walled courts 0, walking 0; places {"palaces":1}; 250 m 297); crowd attached 352, skinned drawn 76 by LOD [0,1,0,75], impostors drawn 8 of 978 candidates

town roofs (150 m round [54,77]): up-facing area above 1.8 m 0 m², wall area 0 m², ratio null (0 triangles)

<details><summary>all classes (top 60 by triangles)</summary>

| object key | vis / hidden | inst in frustum | < 60 m | tris | mats | tiers |
|---|---|---|---|---|---|---|
| world / relief:figures | 9 / 3 | 927 | 0 | 1690000 | MeshStandardNodeMaterial | C |
| terrain | 208 / 0 | 71 | 3 | 785920 | MeshStandardNodeMaterial | C |
| world / props:carried | 1 / 0 | 58 | 1 | 235248 | MeshStandardNodeMaterial |  |
| world / plain-orchards-far | 1 / 0 | 1 | 0 | 176772 | MeshStandardNodeMaterial |  |
| world / garrison:room_fittings:bedrolls | 1 / 0 | 223 | 0 | 167696 | MeshStandardNodeMaterial | C |
| world / river-banks | 1 / 0 | 1 | 0 | 159880 | MeshStandardNodeMaterial | C |
| plain-works / works:wo_brick_field | 1 / 0 | 591 | 0 | 150114 | MeshStandardNodeMaterial | C |
| world / garrison:room_fittings:mats | 1 / 0 | 149 | 0 | 133355 | MeshStandardNodeMaterial | C |
| world / plain-villages-#,# | 2 / 0 | 2 | 1 | 122620 | MeshStandardNodeMaterial | C |
| world / settlement:ground | 1 / 0 | 1 | 1 | 95156 | MeshStandardNodeMaterial | C |
| world / work:objects | 1 / 0 | 1 | 0 | 92036 | MeshStandardNodeMaterial |  |
| world / plain-stone | 1 / 0 | 1 | 1 | 84008 | MeshStandardNodeMaterial | C |
| world / plain-tracks | 1 / 0 | 1 | 0 | 75768 | MeshStandardNodeMaterial | C |
| world / garrison:room_fittings:mats_b | 1 / 0 | 74 | 0 | 66230 | MeshStandardNodeMaterial | C |
| world / ledges:far | 1 / 0 | 1 | 0 | 64090 | ledges |  |
| world / plain-canal-banks | 1 / 0 | 1 | 0 | 55524 | MeshStandardNodeMaterial | C |
| world / river-water | 1 / 0 | 1 | 0 | 50324 | MeshStandardNodeMaterial |  |
| world / crown-merlons:terrace|#|# | 2 / 0 | 246 | 0 | 44104 | decor:merlon:limestone_merlon | C |
| world / fortification_e:mudbrick | 2 / 0 | 2 | 2 | 42174 | MeshStandardNodeMaterial | B/C |
| world / nr-cliff | 1 / 0 | 1 | 0 | 33260 | MeshStandardNodeMaterial | C |
| world / relief:far | 15 / 45 | 4 | 4 | 31835 | MeshStandardNodeMaterial | C |
| world / settlement:channel_stones | 1 / 0 | 1 | 0 | 24588 | MeshStandardNodeMaterial | C |
| world / relief:rosettes | 1 / 0 | 608 | 608 | 24320 | MeshStandardNodeMaterial | C |
| world / c#:dressings:cloth | 1 / 0 | 1 | 1 | 23770 | MeshStandardNodeMaterial | C |
| world / apadana:columns:base_bell:lod# | 3 / 1 | 4 | 4 | 22880 | model:column_base_bell:0:limestone_carved, model:column_base_bell:1:limestone_carved | C |
| world / settlement:refuse | 1 / 0 | 1 | 1 | 22368 | MeshStandardNodeMaterial | C |
| world / settlement:roads | 1 / 0 | 1 | 1 | 20956 | MeshStandardNodeMaterial | C |
| world / garrison:mudbrick | 1 / 0 | 1 | 1 | 20292 | MeshStandardNodeMaterial | B/C |
| world / arris-band:limestone | 25 / 0 | 11 | 11 | 19248 | MeshStandardNodeMaterial | C |
| world / apadana:palace_plaster | 1 / 0 | 1 | 1 | 16348 | MeshStandardNodeMaterial | B/C |
| world / garrison:room_fittings | 1 / 0 | 1 | 0 | 16124 | MeshStandardNodeMaterial | C |
| world / settlement:gardens:far | 1 / 0 | 1 | 1 | 15864 | MeshStandardNodeMaterial | C |
| world / apadana:columns:shaft:lod# | 5 / 1 | 4 | 4 | 15360 | model:column_shaft_f48:0:limestone_carved, model:column_shaft_f48:1:limestone_carved | C |
| world / apadana-glazed-frieze | 1 / 0 | 1 | 1 | 14912 | MeshStandardNodeMaterial | C |
| world / palace-glazed-bands | 1 / 0 | 1 | 1 | 14532 | MeshStandardNodeMaterial | C |
| world / bedrock-ground:talus#:lod# | 1 / 2 | 177 | 0 | 13983 | bedrock:ground |  |
| quarries-detail / plain-quarries:rock:quarry_sivand | 1 / 0 | 1 | 0 | 13745 | bedrock:ground |  |
| world / bedrock-ground:outcrop#:lod# | 2 / 1 | 114 | 0 | 12678 | bedrock:ground |  |
| world / props:tools | 2 / 2 | 6 | 0 | 11526 | MeshStandardNodeMaterial |  |
| world / nr_darius_tomb | 1 / 0 | 1 | 0 | 11154 | MeshStandardNodeMaterial | C |
| world / nr_xerxes_tomb | 1 / 0 | 1 | 0 | 11154 | MeshStandardNodeMaterial | C |
| world / fire-body:hearth:stone | 1 / 0 | 5 | 0 | 11000 | MeshStandardNodeMaterial | C |
| world / apadana:limestone | 2 / 0 | 2 | 2 | 10875 | MeshStandardNodeMaterial | C |
| world / gate_nations:colossus:lamassu:lod# | 2 / 2 | 2 | 0 | 9794 | model-paint:colossus_lamassu:0:limestone_carved, model-paint:colossus_lamassu:1:limestone_carved | C |
| world / palace-furnishings:apadana:stored:bronze | 1 / 0 | 1 | 1 | 9440 | MeshStandardNodeMaterial | C |
| world / apadana:timber:ceiling | 1 / 0 | 1 | 1 | 9312 | MeshStandardNodeMaterial | C |
| world / settlement:water | 1 / 0 | 1 | 1 | 9148 | MeshStandardNodeMaterial | C |
| world / settlement:q_g#:far | 1 / 0 | 1 | 0 | 8980 | MeshStandardNodeMaterial | C |
| world / ledges:mid | 1 / 0 | 1 | 0 | 8390 | ledges |  |
| world / settlement:canal_banks | 1 / 0 | 1 | 0 | 7836 | MeshStandardNodeMaterial | C |
| world / nr-life | 1 / 0 | 1 | 0 | 7788 | MeshStandardNodeMaterial | C |
| world / crown-merlons:gate_nations|#|# | 2 / 0 | 37 | 0 | 7548 | decor:merlon:limestone_merlon | C |
| world / humans:persian:lod# | 2 / 2 | 2 | 1 | 7250 | human |  |
| world / terrace-foot:blocks | 1 / 0 | 1 | 1 | 6745 | MeshStandardNodeMaterial | C |
| plain-works / works:wo_brick_stack | 1 / 0 | 26 | 0 | 6708 | MeshStandardNodeMaterial | C |
| world / garrison:timber:ceiling | 1 / 0 | 1 | 1 | 6576 | MeshStandardNodeMaterial | C |
| world / crenellations | 1 / 0 | 32 | 32 | 6528 | decor:merlon:limestone_merlon | C |
| world / hall#:mudbrick_bare | 1 / 0 | 1 | 0 | 6460 | MeshStandardNodeMaterial | C |
| world / gate_nations:palace_plaster | 1 / 0 | 1 | 0 | 6118 | MeshStandardNodeMaterial | B/C |
| world / c#:dressings:tower-windows | 1 / 0 | 1 | 1 | 6032 | MeshStandardNodeMaterial | C |

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
| trees | 16 / 0 | 16 | 0 | 181066 |
| crops / flora | 24 / 39 | 136 | 135 | 10894 |
| fires / lamps | 10 / 4 | 3133 | 0 | 6266 |
| water | 8 / 6 | 4 | 1 | 274876 |
| animals | 122 / 27 | 6 | 6 | 3696 |
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
| world / people:hit | 0 / 1 | 1 | 0 | 0 |
| world / people:impostors | 0 / 1 | 1 | 0 | 0 |
| player-body / humans:median:lod# | 0 / 2 | 2 | 0 | 0 |

people: sim out of doors within 60 m 0 (open ground 0, inside walled courts 0, walking 0; places {}; 250 m 0); crowd attached 0, skinned drawn 0 by LOD [0,0,0,0], impostors drawn 0 of 208 candidates

town roofs (150 m round [-6332,-1962]): up-facing area above 1.8 m 0 m², wall area 0 m², ratio null (0 triangles)

<details><summary>all classes (top 60 by triangles)</summary>

| object key | vis / hidden | inst in frustum | < 60 m | tris | mats | tiers |
|---|---|---|---|---|---|---|
| world / relief:figures | 9 / 3 | 927 | 0 | 1690000 | MeshStandardNodeMaterial | C |
| terrain | 208 / 0 | 31 | 4 | 698112 | MeshStandardNodeMaterial | C |
| world / plain-orchards-far | 1 / 0 | 1 | 0 | 176772 | MeshStandardNodeMaterial |  |
| world / river-banks | 1 / 0 | 1 | 0 | 159880 | MeshStandardNodeMaterial | C |
| world / plain-villages--#,-# | 2 / 0 | 2 | 0 | 142112 | MeshStandardNodeMaterial | C |
| world / settlement:ground | 1 / 0 | 1 | 1 | 95156 | MeshStandardNodeMaterial | C |
| world / plain-stone | 1 / 0 | 1 | 1 | 84008 | MeshStandardNodeMaterial | C |
| world / plain-tracks | 1 / 0 | 1 | 0 | 75768 | MeshStandardNodeMaterial | C |
| world / plain-villages--#,# | 4 / 0 | 1 | 1 | 67086 | MeshStandardNodeMaterial | C |
| world / plain-canal-banks | 1 / 0 | 1 | 0 | 55524 | MeshStandardNodeMaterial | C |
| world / river-water | 1 / 0 | 1 | 0 | 50324 | MeshStandardNodeMaterial |  |
| world / settlement:refuse | 1 / 0 | 1 | 1 | 22368 | MeshStandardNodeMaterial | C |
| world / settlement:roads | 1 / 0 | 1 | 1 | 20956 | MeshStandardNodeMaterial | C |
| world / cover-tuft:tuft_m#c:lod# | 6 / 0 | 81 | 81 | 12628 | ground-cover |  |
| world / settlement:water | 1 / 0 | 1 | 1 | 9148 | MeshStandardNodeMaterial | C |
| world / cover-tuft:tuft_m#e:lod# | 3 / 0 | 35 | 35 | 4906 | ground-cover |  |
| world / cover-tuft:tuft_m#d:lod# | 3 / 0 | 39 | 39 | 4670 | ground-cover |  |
| world / cover-tuft:tuft_m#a:lod# | 3 / 0 | 32 | 32 | 4350 | ground-cover |  |
| world / fire | 1 / 0 | 2066 | 0 | 4132 | MeshBasicNodeMaterial |  |
| world / flora-camelthorn:model:lod# | 2 / 0 | 6 | 6 | 3696 | life:camelthorn |  |
| Points | 1 / 0 | 1 | 0 | 2973 | PointsNodeMaterial |  |
| world / rock-stone:namaqualand_rocks_#_v#:lod# | 8 / 0 | 4 | 4 | 2899 | scan:namaqualand_rocks_01_v1, scan:namaqualand_rocks_01_v2, scan:namaqualand_rocks_01_v3, scan:namaqualand_rocks_01_v4 |  |
| world / cover-sward:sward_bmj:lod# | 3 / 0 | 51 | 51 | 2886 | ground-cover |  |
| world / cover-tuft:tuft_m#b:lod# | 3 / 0 | 29 | 29 | 2851 | ground-cover |  |
| world / cover-sward:sward_bmk:lod# | 3 / 0 | 35 | 35 | 2160 | ground-cover |  |
| world / fire:coals | 1 / 0 | 1067 | 0 | 2134 | MeshBasicNodeMaterial |  |
| world / cover-sward:sward_bmm:lod# | 3 / 0 | 40 | 40 | 1860 | ground-cover |  |
| Mesh | 2 / 2 | 2 | 0 | 972 | MeshBasicNodeMaterial, NodeMaterial |  |
| world / settlement:trees-wood-lod# | 2 / 0 | 2 | 0 | 896 | MeshStandardNodeMaterial |  |
| world / plain-trees-wood-lod# | 2 / 0 | 2 | 0 | 896 | MeshStandardNodeMaterial |  |
| world / settlement:trees-leaves-lod# | 2 / 0 | 2 | 0 | 880 | MeshStandardNodeMaterial |  |
| world / plain-trees-leaves-lod# | 2 / 0 | 2 | 0 | 880 | MeshStandardNodeMaterial |  |
| world / rock-stone:rock_#:lod# | 4 / 0 | 2 | 2 | 599 | scan:rock_07, scan:rock_09 |  |
| world / rock-stone:namaqualand_stones_#_v#:lod# | 10 / 0 | 2 | 2 | 398 | scan:namaqualand_stones_01_v1, scan:namaqualand_stones_01_v2, scan:namaqualand_stones_01_v3, scan:namaqualand_stones_01_v4 |  |
| world / flora-thistle:model:lod# | 2 / 0 | 3 | 3 | 258 | life:thistle |  |
| world / settlement:trees-noshadow-leaves-lod# | 1 / 0 | 1 | 0 | 240 | MeshStandardNodeMaterial |  |
| world / plain-trees-noshadow-leaves-lod# | 1 / 0 | 1 | 0 | 240 | MeshStandardNodeMaterial |  |
| world / settlement:trees-noshadow-wood-lod# | 1 / 0 | 1 | 0 | 128 | MeshStandardNodeMaterial |  |
| world / plain-trees-noshadow-wood-lod# | 1 / 0 | 1 | 0 | 128 | MeshStandardNodeMaterial |  |
| world / rock-stone:stone_#:lod# | 2 / 0 | 1 | 1 | 119 | scan:stone_01 |  |
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
| world / relief:shadow-proxy | 0 / 7 | 0 | 0 | 0 | MeshBasicNodeMaterial |  |
| world / rain-shafts | 0 / 7 | 0 | 0 | 0 | MeshBasicNodeMaterial |  |
| world / hall#:construction:#|#|#:shaft:lod# | 7 / 7 | 0 | 0 | 0 | model:column_shaft_f40:0:limestone_carved, model:column_shaft_f40:1:limestone_carved, model:column_shaft_drums:0:limestone_carved, model:column_shaft_drums:1:limestone_carved | C |
| world / ford-steps:namaqualand_boulder_#:lod# | 0 / 6 | 0 | 0 | 0 | scan:namaqualand_boulder_02, scan:namaqualand_boulder_03, scan:namaqualand_boulder_04 |  |
| world / door-sealing:treasury:e_stores_n_#_W | 0 / 4 | 0 | 0 | 0 | clay-writing |  |

</details>

## fields: the approach fields, dawn (cov-196) (day 126, 5.635 h)

camera -491.3, -73.3, -12.5; sim people within 60 m: 0, within 250 m: 90; crowd stats: {"draws":4,"triangles":13325,"people":20,"byLod":[0,0,0,20],"shadowDraws":0,"shadowTriangles":0,"propDraws":3,"props":10,"propTriangles":33800,"propsDropped":0,"placeholderActs":0,"motionCapture":9,"motionAuthored":11,"things":{"draws":0,"instances":0,"triangles":0,"kinds":{},"dropped":0},"animals":

| class | meshes visible / hidden | instances in frustum | of them < 60 m | triangles in frustum |
|---|---|---|---|---|
| people (skinned, any LOD) | 4 / 46 | 4 | 0 | 2606 |
| people LOD3 (far) | 0 / 0 | 0 | 0 | 0 |
| people impostors | 1 / 0 | 1 | 0 | 2 |
| house roofs | 11 / 7 | 764 | 0 | 10464 |
| house walls | 4 / 0 | 18 | 1 | 1184 |
| ground fill / props | 7 / 332 | 14 | 0 | 35116 |
| trees | 16 / 0 | 16 | 0 | 181066 |
| crops / flora | 26 / 37 | 100 | 57 | 8679 |
| fires / lamps | 11 / 3 | 1553 | 0 | 57526 |
| water | 8 / 6 | 7 | 1 | 284744 |
| animals | 124 / 25 | 174 | 1 | 85420 |
| terrace architecture | 119 / 232 | 2566 | 0 | 1885484 |

shadow-casting lights: [{"name":"","far":2000,"size":[240]}]

page: backend WebGL2, norender true, catch-up ticks 0 (still catching up: false), crowd looks pending 0

people in the frustum: within 40 m 0 of 0; within 60 m 0 of 0 (behind court walls for this eye: 0; to be drawn: 0)

| people mesh | visible / hidden meshes | instances (count) | in frustum | < 60 m |
|---|---|---|---|---|
| world / humans:persian:shadow | 0 / 1 | 1 | 0 | 0 |
| world / humans:persian:shadow-far | 0 / 1 | 1 | 0 | 0 |
| world / humans:persian:lod# | 1 / 3 | 4 | 1 | 0 |
| world / humans:median:shadow | 0 / 1 | 1 | 0 | 0 |
| world / humans:median:shadow-far | 0 / 1 | 1 | 0 | 0 |
| world / humans:median:lod# | 0 / 4 | 4 | 0 | 0 |
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
| world / people:hit | 0 / 1 | 1 | 0 | 0 |
| world / people:impostors | 1 / 0 | 1 | 1 | 0 |
| player-body / humans:median:lod# | 0 / 2 | 2 | 0 | 0 |

people: sim out of doors within 60 m 0 (open ground 0, inside walled courts 0, walking 0; places {}; 250 m 90); crowd attached 441, skinned drawn 20 by LOD [0,0,0,20], impostors drawn 391 of 1007 candidates

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
| world / settlement:q_s#:far | 4 / 0 | 1 | 0 | 170138 | MeshStandardNodeMaterial | C |
| world / river-banks | 1 / 0 | 1 | 0 | 159880 | MeshStandardNodeMaterial | C |
| world / treasury:chert_set | 1 / 0 | 487 | 0 | 135386 | MeshStandardNodeMaterial | C |
| world / harem:room_fittings:bedrolls | 1 / 0 | 176 | 0 | 132352 | MeshStandardNodeMaterial | C |
| world / plain-villages-#,# | 2 / 0 | 2 | 1 | 122620 | MeshStandardNodeMaterial | C |
| world / treasury:scale_armour | 1 / 0 | 203 | 0 | 115304 | MeshStandardNodeMaterial | C |
| world / crown-merlons:harem|#|-# | 4 / 0 | 962 | 0 | 108258 | decor:merlon:limestone_merlon | C |
| world / harem:room_fittings:mats | 1 / 0 | 117 | 0 | 104715 | MeshStandardNodeMaterial | C |
| world / settlement:ground | 1 / 0 | 1 | 1 | 95156 | MeshStandardNodeMaterial | C |
| world / work:objects | 1 / 0 | 1 | 0 | 92036 | MeshStandardNodeMaterial |  |
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
| world / animals:sheep:lod# | 1 / 1 | 39 | 0 | 38220 | MeshStandardNodeMaterial |  |
| plain-qanats / qanat-tile:#,-# | 3 / 12 | 391 | 0 | 35190 | MeshStandardNodeMaterial | C |
| world / animals:goat:lod# | 1 / 2 | 34 | 0 | 33320 | MeshStandardNodeMaterial |  |
| world / harem:room_fittings:jars | 1 / 0 | 70 | 0 | 31080 | MeshStandardNodeMaterial | C |
| world / crown-merlons:terrace|-#|-# | 2 / 0 | 255 | 0 | 30600 | decor:merlon:limestone_merlon | C |
| world / props:carried | 1 / 0 | 7 | 0 | 28392 | MeshStandardNodeMaterial |  |
| world / scribes:tablets_filed | 1 / 0 | 354 | 0 | 26904 | clay-writing |  |
| world / treasury:gold_rhyton | 1 / 0 | 81 | 0 | 25434 | MeshStandardNodeMaterial | C |
| world / c#:dressings:cloth | 1 / 0 | 1 | 0 | 23770 | MeshStandardNodeMaterial | C |
| world / crown-merlons:terrace|#|-# | 2 / 0 | 223 | 0 | 23378 | decor:merlon:limestone_merlon | C |
| world / garrison:room_fittings:mats | 1 / 0 | 26 | 0 | 23270 | MeshStandardNodeMaterial | C |
| world / settlement:refuse | 1 / 0 | 1 | 1 | 22368 | MeshStandardNodeMaterial | C |
| world / settlement:roads | 1 / 0 | 1 | 1 | 20956 | MeshStandardNodeMaterial | C |
| world / doors:leaves | 1 / 0 | 94 | 0 | 20680 | MeshStandardNodeMaterial | C |
| world / garrison:room_fittings:bedrolls | 1 / 0 | 27 | 0 | 20304 | MeshStandardNodeMaterial | C |
| world / fire-body:hearth:stone | 1 / 0 | 8 | 0 | 17600 | MeshStandardNodeMaterial | C |
| world / garrison:room_fittings | 1 / 0 | 1 | 0 | 16124 | MeshStandardNodeMaterial | C |
| world / settlement:gardens:far | 1 / 0 | 1 | 1 | 15864 | MeshStandardNodeMaterial | C |
| world / crown-merlons:hadish|#|-# | 1 / 0 | 129 | 0 | 15480 | decor:merlon:limestone_merlon | C |
| world / apadana-glazed-frieze | 1 / 0 | 1 | 0 | 14912 | MeshStandardNodeMaterial | C |
| world / harem:timber:ceiling | 1 / 0 | 1 | 0 | 14550 | MeshStandardNodeMaterial | C |
| world / palace-glazed-bands | 1 / 0 | 1 | 0 | 14532 | MeshStandardNodeMaterial | C |
| world / hadish:columns:protome:lod# | 1 / 1 | 48 | 0 | 13824 | model-paint:capital_protome:0:limestone_carved, model-paint:capital_protome:1:limestone_carved | C |
| world / crown-merlons:tachara|-#|-# | 1 / 0 | 113 | 0 | 13560 | decor:merlon:limestone_merlon | C |
| world / fire-body:torch:head | 1 / 0 | 14 | 0 | 13048 | MeshStandardNodeMaterial | C |
| world / garrison:room_fittings:mats_b | 1 / 0 | 14 | 0 | 12530 | MeshStandardNodeMaterial | C |
| world / fire-body:brazier:bronze | 1 / 0 | 4 | 0 | 11952 | MeshStandardNodeMaterial | C |

</details>

## night: the town at night (cov-448) (day 310, 3.446 h)

camera -900.2, -1513.5, -18.1; sim people within 60 m: 73, within 250 m: 120; crowd stats: {"draws":4,"triangles":18500,"people":32,"byLod":[0,0,0,32],"shadowDraws":0,"shadowTriangles":0,"propDraws":2,"props":6,"propTriangles":9314,"propsDropped":0,"placeholderActs":0,"motionCapture":9,"motionAuthored":23,"things":{"draws":0,"instances":0,"triangles":0,"kinds":{},"dropped":0},"animals":{"

| class | meshes visible / hidden | instances in frustum | of them < 60 m | triangles in frustum |
|---|---|---|---|---|
| people (skinned, any LOD) | 4 / 46 | 4 | 4 | 2584 |
| people LOD3 (far) | 0 / 0 | 0 | 0 | 0 |
| people impostors | 1 / 0 | 1 | 0 | 2 |
| house roofs | 13 / 5 | 10 | 4 | 2102 |
| house walls | 4 / 0 | 0 | 0 | 0 |
| ground fill / props | 81 / 258 | 131 | 72 | 43315 |
| trees | 16 / 0 | 16 | 0 | 181066 |
| crops / flora | 23 / 40 | 53 | 52 | 6912 |
| fires / lamps | 12 / 2 | 4933 | 13 | 9866 |
| water | 10 / 4 | 17 | 4 | 276020 |
| animals | 133 / 17 | 82 | 50 | 43286 |
| terrace architecture | 118 / 233 | 927 | 0 | 1690000 |

shadow-casting lights: [{"name":"","far":2000,"size":[240]}]

page: backend WebGL2, norender true, catch-up ticks 1 (still catching up: false), crowd looks pending 0

people in the frustum: within 40 m 5 of 34; within 60 m 17 of 73 (behind court walls for this eye: 17; to be drawn: 0)

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
| world / people:hit | 0 / 1 | 1 | 0 | 0 |
| world / people:impostors | 1 / 0 | 1 | 1 | 0 |
| player-body / humans:median:lod# | 0 / 2 | 2 | 0 | 0 |

people: sim out of doors within 60 m 73 (open ground 0, inside walled courts 73, walking 2; places {"h":73}; 250 m 120); crowd attached 169, skinned drawn 32 by LOD [0,0,0,32], impostors drawn 3 of 1429 candidates

town roofs (150 m round [-957,-1534]): up-facing area above 1.8 m 20297 m², wall area 79948 m², ratio 0.254 (193353 triangles)

<details><summary>all classes (top 60 by triangles)</summary>

| object key | vis / hidden | inst in frustum | < 60 m | tris | mats | tiers |
|---|---|---|---|---|---|---|
| world / relief:figures | 9 / 3 | 927 | 0 | 1690000 | MeshStandardNodeMaterial | C |
| terrain | 208 / 0 | 52 | 2 | 837376 | MeshStandardNodeMaterial | C |
| world / plain-orchards-far | 1 / 0 | 1 | 0 | 176772 | MeshStandardNodeMaterial |  |
| world / river-banks | 1 / 0 | 1 | 0 | 159880 | MeshStandardNodeMaterial | C |
| world / plain-villages--#,-# | 2 / 0 | 2 | 0 | 142112 | MeshStandardNodeMaterial | C |
| world / plain-villages--#,# | 4 / 0 | 2 | 0 | 128916 | MeshStandardNodeMaterial | C |
| world / settlement:ground | 1 / 0 | 1 | 1 | 95156 | MeshStandardNodeMaterial | C |
| world / plain-stone | 1 / 0 | 1 | 1 | 84008 | MeshStandardNodeMaterial | C |
| world / settlement:near:plaster | 1 / 0 | 1 | 0 | 81194 | MeshStandardNodeMaterial | C |
| world / plain-tracks | 1 / 0 | 1 | 0 | 75768 | MeshStandardNodeMaterial | C |
| world / settlement:q_s#:far | 4 / 0 | 1 | 1 | 62408 | MeshStandardNodeMaterial | C |
| world / plain-canal-banks | 1 / 0 | 1 | 0 | 55524 | MeshStandardNodeMaterial | C |
| world / river-water | 1 / 0 | 1 | 0 | 50324 | MeshStandardNodeMaterial |  |
| world / settlement:near:timber | 1 / 0 | 1 | 0 | 45442 | MeshStandardNodeMaterial | C |
| world / settlement:near:items | 1 / 0 | 1 | 0 | 38863 | MeshStandardNodeMaterial | C |
| world / plain-villages-#,# | 2 / 0 | 1 | 1 | 35002 | MeshStandardNodeMaterial | C |
| world / settlement:refuse | 1 / 0 | 1 | 1 | 22368 | MeshStandardNodeMaterial | C |
| world / settlement:roads | 1 / 0 | 1 | 1 | 20956 | MeshStandardNodeMaterial | C |
| world / settlement:near:props | 1 / 0 | 1 | 0 | 20676 | MeshStandardNodeMaterial | C |
| world / settlement:gardens:far | 1 / 0 | 1 | 1 | 15864 | MeshStandardNodeMaterial | C |
| world / ledges:far | 1 / 0 | 1 | 0 | 15180 | ledges |  |
| world / rock-stone:namaqualand_stones_#_v#:lod# | 10 / 0 | 38 | 38 | 14584 | scan:namaqualand_stones_01_v1, scan:namaqualand_stones_01_v2, scan:namaqualand_stones_01_v3, scan:namaqualand_stones_01_v4 |  |
| quarries-detail / plain-quarries:rock:quarry_majdabad | 1 / 0 | 1 | 0 | 13745 | bedrock:ground |  |
| world / settlement:near:stone | 1 / 0 | 1 | 0 | 13478 | MeshStandardNodeMaterial | C |
| world / animals:goat:lod# | 2 / 1 | 13 | 6 | 12740 | MeshStandardNodeMaterial |  |
| world / animals:sheep:lod# | 2 / 0 | 13 | 0 | 12740 | MeshStandardNodeMaterial |  |
| world / animals:dog:lod# | 1 / 0 | 10 | 4 | 9780 | MeshStandardNodeMaterial |  |
| world / settlement-doors:# | 6 / 0 | 46 | 6 | 9328 | MeshStandardNodeMaterial | C |
| world / settlement:water | 1 / 0 | 1 | 1 | 9148 | MeshStandardNodeMaterial | C |
| world / rock-stone:namaqualand_rocks_#_v#:lod# | 8 / 0 | 27 | 27 | 8643 | scan:namaqualand_rocks_01_v1, scan:namaqualand_rocks_01_v2, scan:namaqualand_rocks_01_v3, scan:namaqualand_rocks_01_v4 |  |
| world / fire | 1 / 0 | 3282 | 10 | 6564 | MeshBasicNodeMaterial |  |
| world / interiors:cloth | 1 / 0 | 1 | 0 | 6058 | MeshStandardNodeMaterial | C |
| world / interiors:clay | 1 / 0 | 1 | 0 | 5730 | MeshStandardNodeMaterial | C |
| Mesh | 3 / 1 | 3 | 0 | 4940 | MeshBasicNodeMaterial, NodeMaterial |  |
| world / small-snail:lod# | 2 / 0 | 30 | 30 | 4500 | life:snail |  |
| world / settlement:near:brick | 1 / 0 | 1 | 0 | 4071 | MeshStandardNodeMaterial | B/C |
| world / props:children | 1 / 0 | 3 | 1 | 3906 | MeshStandardNodeMaterial |  |
| world / animals:cat:lod# | 1 / 0 | 6 | 0 | 3528 | MeshStandardNodeMaterial |  |
| world / fire:coals | 1 / 0 | 1651 | 3 | 3302 | MeshBasicNodeMaterial |  |
| Points | 1 / 0 | 1 | 0 | 2973 | PointsNodeMaterial |  |
| world / flora-thistle:model:lod# | 2 / 0 | 33 | 33 | 2838 | life:thistle |  |
| world / props:tools | 1 / 3 | 1 | 1 | 2804 | MeshStandardNodeMaterial |  |
| world / fill:wo_dung_cakes:dung:lod# | 2 / 1 | 22 | 10 | 2400 | MeshStandardNodeMaterial | C |
| world / flora-camelthorn:model:lod# | 2 / 0 | 9 | 9 | 2160 | life:camelthorn |  |
| world / rock-stone:rock_#:lod# | 4 / 0 | 17 | 17 | 1970 | scan:rock_07, scan:rock_09 |  |
| world / flora-cushion:model:lod# | 2 / 0 | 10 | 10 | 1880 | life:cushion |  |
| world / fill:fill_awning:cloth:lod# | 1 / 2 | 7 | 2 | 1820 | MeshStandardNodeMaterial | C |
| world / fill:fill_awning:wood:lod# | 1 / 2 | 7 | 2 | 1680 | MeshStandardNodeMaterial | C |
| world / settlement:waystation:far | 1 / 0 | 1 | 0 | 1542 | MeshStandardNodeMaterial | C |
| world / fill:fill_bundle:wood:lod# | 2 / 1 | 3 | 3 | 1395 | MeshStandardNodeMaterial | C |
| world / roofwear:drip_jar:clay | 1 / 0 | 3 | 1 | 1332 | MeshStandardNodeMaterial | C |
| world / cover-dung:dung_sheep:lod# | 3 / 0 | 16 | 16 | 1278 | ground-cover |  |
| world / rock-stone:stone_#:lod# | 2 / 0 | 10 | 10 | 1190 | scan:stone_01 |  |
| world / fill:jar_store:clay:lod# | 2 / 1 | 13 | 2 | 1170 | MeshStandardNodeMaterial | C |
| world / fill:mat:matting:lod# | 2 / 1 | 11 | 3 | 1155 | MeshStandardNodeMaterial | C |
| world / wallwear:splash | 1 / 0 | 16 | 2 | 1152 | MeshStandardNodeMaterial |  |
| world / fill:jar_water:clay:lod# | 2 / 1 | 13 | 3 | 1144 | MeshStandardNodeMaterial | C |
| world / cover-dung:dung_horse:lod# | 3 / 0 | 15 | 15 | 1060 | ground-cover |  |
| world / fill:sack:cloth:lod# | 2 / 1 | 3 | 3 | 990 | MeshStandardNodeMaterial | C |
| world / cover-dung:dung_pat:lod# | 3 / 0 | 14 | 14 | 926 | ground-cover |  |

</details>

## night_terrace: the Terrace at 22:30 (sb-night-terrace) (day 5, 22.5 h)

camera 0, 92, 1.6; sim people within 60 m: 9, within 250 m: 248; crowd stats: {"draws":6,"triangles":65431,"people":82,"byLod":[0,1,0,81],"shadowDraws":1,"shadowTriangles":720,"propDraws":4,"props":87,"propTriangles":323470,"propsDropped":0,"placeholderActs":0,"motionCapture":48,"motionAuthored":34,"things":{"draws":5,"instances":9,"triangles":15584,"kinds":{"knucklebones":1,

| class | meshes visible / hidden | instances in frustum | of them < 60 m | triangles in frustum |
|---|---|---|---|---|
| people (skinned, any LOD) | 7 / 43 | 7 | 0 | 10948 |
| people LOD3 (far) | 0 / 0 | 0 | 0 | 0 |
| people impostors | 1 / 0 | 1 | 0 | 2 |
| house roofs | 13 / 5 | 1138 | 131 | 14952 |
| house walls | 4 / 0 | 1 | 1 | 300 |
| ground fill / props | 20 / 319 | 92 | 4 | 313077 |
| trees | 16 / 0 | 16 | 0 | 181066 |
| crops / flora | 19 / 44 | 74 | 0 | 8216 |
| fires / lamps | 11 / 3 | 4791 | 12 | 88678 |
| water | 11 / 3 | 6 | 3 | 276908 |
| animals | 124 / 26 | 75 | 0 | 73500 |
| terrace architecture | 124 / 227 | 4253 | 951 | 2357375 |

shadow-casting lights: [{"name":"","far":2000,"size":[240]}]

page: backend WebGL2, norender true, catch-up ticks 0 (still catching up: false), crowd looks pending 0

people in the frustum: within 40 m 0 of 3; within 60 m 0 of 9 (behind court walls for this eye: 0; to be drawn: 0)

| people mesh | visible / hidden meshes | instances (count) | in frustum | < 60 m |
|---|---|---|---|---|
| world / humans:persian:shadow | 0 / 1 | 1 | 0 | 0 |
| world / humans:persian:shadow-far | 0 / 1 | 1 | 0 | 0 |
| world / humans:persian:lod# | 1 / 3 | 4 | 1 | 0 |
| world / humans:median:shadow | 0 / 1 | 1 | 0 | 0 |
| world / humans:median:shadow-far | 0 / 1 | 1 | 0 | 0 |
| world / humans:median:lod# | 1 / 3 | 4 | 1 | 0 |
| world / humans:worker:shadow | 0 / 1 | 1 | 0 | 0 |
| world / humans:worker:shadow-far | 1 / 0 | 1 | 1 | 0 |
| world / humans:worker:lod# | 2 / 2 | 4 | 2 | 0 |
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
| world / people:hit | 0 / 1 | 1 | 0 | 0 |
| world / people:impostors | 1 / 0 | 1 | 1 | 0 |
| player-body / humans:median:lod# | 0 / 2 | 2 | 0 | 0 |

people: sim out of doors within 60 m 9 (open ground 1, inside walled courts 0, walking 0; places {"stair_foot":1}; 250 m 248); crowd attached 369, skinned drawn 82 by LOD [0,1,0,81], impostors drawn 551 of 1302 candidates

town roofs (150 m round [0,32]): up-facing area above 1.8 m 0 m², wall area 0 m², ratio null (0 triangles)

<details><summary>all classes (top 60 by triangles)</summary>

| object key | vis / hidden | inst in frustum | < 60 m | tris | mats | tiers |
|---|---|---|---|---|---|---|
| world / relief:figures | 9 / 3 | 927 | 0 | 1690000 | MeshStandardNodeMaterial | C |
| terrain | 208 / 0 | 85 | 2 | 963840 | MeshStandardNodeMaterial | C |
| world / treasury:arrow_bundle | 1 / 0 | 446 | 0 | 392480 | MeshStandardNodeMaterial | C |
| world / treasury:alabaster_vessel | 1 / 0 | 824 | 0 | 370800 | MeshStandardNodeMaterial | C |
| world / settlement:q_s#:far | 4 / 0 | 4 | 0 | 367500 | MeshStandardNodeMaterial | C |
| world / props:carried | 1 / 0 | 73 | 0 | 296088 | MeshStandardNodeMaterial |  |
| world / treasury:textile_bale | 1 / 0 | 382 | 0 | 216976 | MeshStandardNodeMaterial | C |
| world / plain-orchards-far | 1 / 0 | 1 | 0 | 176772 | MeshStandardNodeMaterial |  |
| world / river-banks | 1 / 0 | 1 | 0 | 159880 | MeshStandardNodeMaterial | C |
| world / plain-villages--#,-# | 2 / 0 | 2 | 0 | 142112 | MeshStandardNodeMaterial | C |
| world / harem:room_fittings:bedrolls | 1 / 0 | 176 | 0 | 132352 | MeshStandardNodeMaterial | C |
| world / treasury:chert_set | 1 / 0 | 455 | 0 | 126490 | MeshStandardNodeMaterial | C |
| world / relief:far-set | 9 / 0 | 9 | 1 | 123451 | MeshStandardNodeMaterial | C |
| world / crown-merlons:harem|#|-# | 4 / 0 | 962 | 0 | 115440 | decor:merlon:limestone_merlon | C |
| world / treasury:scale_armour | 1 / 0 | 185 | 0 | 105080 | MeshStandardNodeMaterial | C |
| world / harem:room_fittings:mats | 1 / 0 | 117 | 0 | 104715 | MeshStandardNodeMaterial | C |
| world / settlement:ground | 1 / 0 | 1 | 1 | 95156 | MeshStandardNodeMaterial | C |
| world / work:objects | 1 / 0 | 1 | 0 | 92036 | MeshStandardNodeMaterial |  |
| world / plain-stone | 1 / 0 | 1 | 1 | 84008 | MeshStandardNodeMaterial | C |
| world / treasury:bitumen_jar | 1 / 0 | 262 | 0 | 80696 | MeshStandardNodeMaterial | C |
| world / treasury:silver_phiale | 1 / 0 | 224 | 0 | 80192 | MeshStandardNodeMaterial | C |
| world / plain-tracks | 1 / 0 | 1 | 0 | 75768 | MeshStandardNodeMaterial | C |
| world / treasury:blue_vessel | 1 / 0 | 225 | 0 | 75600 | MeshStandardNodeMaterial | C |
| world / doors:bands | 1 / 0 | 384 | 0 | 72192 | MeshStandardNodeMaterial | C |
| world / treasury:sealed_jar | 1 / 0 | 225 | 0 | 69300 | MeshStandardNodeMaterial | C |
| world / treasury:shield | 1 / 0 | 149 | 0 | 65262 | MeshStandardNodeMaterial | C |
| world / ledges:far | 1 / 0 | 1 | 0 | 64270 | ledges |  |
| world / plain-canal-banks | 1 / 0 | 1 | 0 | 55524 | MeshStandardNodeMaterial | C |
| world / apadana:columns:shaft:lod# | 3 / 3 | 72 | 12 | 55296 | model:column_shaft_f48:0:limestone_carved, model:column_shaft_f48:1:limestone_carved | C |
| world / harem:room_fittings:mats_b | 1 / 0 | 59 | 0 | 52805 | MeshStandardNodeMaterial | C |
| world / settlement:tol_ajori:glaze | 1 / 0 | 1 | 0 | 50440 | monument:ajori:glaze |  |
| world / river-water | 1 / 0 | 1 | 0 | 50324 | MeshStandardNodeMaterial |  |
| world / doors:shoes | 1 / 0 | 96 | 0 | 49152 | MeshStandardNodeMaterial | C |
| world / crown-merlons:terrace|-#|-# | 2 / 0 | 311 | 0 | 47988 | decor:merlon:limestone_merlon | C |
| world / treasury:bead_bowl | 1 / 0 | 114 | 0 | 43776 | MeshStandardNodeMaterial | C |
| world / fortification_e:mudbrick | 2 / 0 | 2 | 0 | 41744 | MeshStandardNodeMaterial | B/C |
| world / apadana:columns:protome:lod# | 3 / 3 | 72 | 11 | 40464 | model-paint:capital_protome:0:limestone_carved, model-paint:capital_protome:1:limestone_carved | C |
| world / animals:goat:lod# | 1 / 2 | 41 | 0 | 40180 | MeshStandardNodeMaterial |  |
| world / treasury:room_fittings:jars | 1 / 0 | 88 | 0 | 39072 | MeshStandardNodeMaterial | C |
| world / treasury:glass_bowl | 1 / 0 | 111 | 0 | 37296 | MeshStandardNodeMaterial |  |
| world / plain-villages-#,# | 2 / 0 | 1 | 1 | 35002 | MeshStandardNodeMaterial | C |
| world / animals:sheep:lod# | 1 / 1 | 34 | 0 | 33320 | MeshStandardNodeMaterial |  |
| world / relief:rosettes | 1 / 0 | 824 | 824 | 32960 | MeshStandardNodeMaterial | C |
| world / harem:room_fittings:jars | 1 / 0 | 70 | 0 | 31080 | MeshStandardNodeMaterial | C |
| world / crown-merlons:apadana|#|-# | 1 / 0 | 141 | 0 | 28764 | decor:merlon:limestone_merlon | C |
| plain-qanats / qanat-tile:#,-# | 3 / 12 | 319 | 0 | 28710 | MeshStandardNodeMaterial | C |
| world / crown-merlons:apadana|-#|-# | 1 / 0 | 135 | 0 | 27540 | decor:merlon:limestone_merlon | C |
| world / crenellations | 1 / 0 | 134 | 68 | 27336 | decor:merlon:limestone_merlon | C |
| world / crown-merlons:terrace|#|-# | 2 / 0 | 223 | 0 | 26760 | decor:merlon:limestone_merlon | C |
| world / fire-body:torch:head | 1 / 0 | 28 | 0 | 26096 | MeshStandardNodeMaterial | C |
| world / treasury:gold_rhyton | 1 / 0 | 78 | 0 | 24492 | MeshStandardNodeMaterial | C |
| world / c#:dressings:cloth | 1 / 0 | 1 | 1 | 23770 | MeshStandardNodeMaterial | C |
| world / settlement:refuse | 1 / 0 | 1 | 1 | 22368 | MeshStandardNodeMaterial | C |
| world / doors:leaves | 1 / 0 | 96 | 0 | 21120 | MeshStandardNodeMaterial | C |
| world / settlement:roads | 1 / 0 | 1 | 1 | 20956 | MeshStandardNodeMaterial | C |
| world / garrison:mudbrick | 1 / 0 | 1 | 0 | 20292 | MeshStandardNodeMaterial | B/C |
| world / stair-crenellations | 1 / 0 | 98 | 0 | 19992 | decor:merlon:limestone_merlon | C |
| world / apadana:columns:bells:lod# | 2 / 2 | 60 | 12 | 19200 | model:column_bells:0:limestone_carved, model:column_bells:1:limestone_carved | C |
| world / crown-merlons:apadana|-#|# | 1 / 0 | 89 | 25 | 18156 | decor:merlon:limestone_merlon | C |
| world / fire-body:brazier:bronze | 1 / 0 | 6 | 2 | 17928 | MeshStandardNodeMaterial | C |

</details>

