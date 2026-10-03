# Page check (D-772): what the page draws vs what its simulation holds

Tree /home/user/fars-pc gitdir: /home/user/fars/.git/worktrees/fars-pc; built site (vite build, base /fars/), headless Chromium, ?test&norender&webgl=1&quality=test&court=seasonal; 2026-10-03T09:10:32.587Z.
Per view: objects effectively visible (every ancestor visible) and meeting the camera frustum, their instances and triangles;
hidden = present in the scene but visible=false somewhere up the chain. sim<60 m = population view + detailed agents within 60 m of the camera.

## Flags

- none

Page errors (unique): 1
- 1x Failed to load resource: the server responded with a status of 404 (Not Found)

## field_spring: plain fields, day 58 08:24 (cov-096) (day 58, 8.402 h)

camera -5806.8, 1649.7, -20.2; sim people within 60 m: 0, within 250 m: 0; crowd stats: {"draws":0,"triangles":0,"people":0,"byLod":[0,0,0,0],"shadowDraws":0,"shadowTriangles":0,"propDraws":0,"props":0,"propTriangles":0,"propsDropped":0,"placeholderActs":0,"motionCapture":0,"motionAuthored":0,"things":{"draws":0,"instances":0,"triangles":0,"kinds":{},"dropped":0},"animals":{"draws":0,"

| class | meshes visible / hidden | instances in frustum | of them < 60 m | triangles in frustum |
|---|---|---|---|---|
| people (skinned, any LOD) | 0 / 50 | 0 | 0 | 0 |
| people LOD3 (far) | 0 / 0 | 0 | 0 | 0 |
| people impostors | 1 / 0 | 1 | 0 | 2 |
| house roofs | 11 / 7 | 0 | 0 | 0 |
| house walls | 4 / 0 | 0 | 0 | 0 |
| ground fill / props | 10 / 328 | 29 | 0 | 15912 |
| trees | 22 / 0 | 16 | 0 | 181066 |
| crops / flora | 83 / 42 | 116 | 91 | 25830 |
| fires / lamps | 10 / 4 | 3857 | 0 | 7714 |
| water | 13 / 6 | 56 | 1 | 309299 |
| animals | 131 / 14 | 8 | 7 | 6737 |
| terrace architecture | 118 / 219 | 927 | 0 | 1690000 |

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

people: sim out of doors within 60 m 0 (open ground 0, inside walled courts 0, walking 0; places {}; 250 m 0); crowd attached 5, skinned drawn 0 by LOD [0,0,0,0], impostors drawn 308 of 723 candidates

town roofs (150 m round [-5955,1673]): up-facing area above 1.8 m 0 m², wall area 0 m², ratio null (0 triangles)

<details><summary>all classes (top 60 by triangles)</summary>

| object key | vis / hidden | inst in frustum | < 60 m | tris | mats | tiers |
|---|---|---|---|---|---|---|
| world / relief:figures | 9 / 3 | 927 | 0 | 1690000 | MeshStandardNodeMaterial | C |
| terrain | 208 / 0 | 27 | 2 | 774400 | MeshStandardNodeMaterial | C |
| world / plain-villages--#,# | 4 / 0 | 3 | 1 | 211930 | MeshStandardNodeMaterial | C |
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
| world / flora-grass:grass_bermuda_#_v#:lod# | 6 / 0 | 3 | 3 | 50 | scan:grass_bermuda_01_v1, scan:grass_bermuda_01_v2, scan:grass_bermuda_01_v3 |  |
| world / plain-crops-near | 1 / 0 | 1 | 0 | 34 | MeshStandardNodeMaterial |  |
| world / settlement:smoke-plumes | 1 / 0 | 1 | 0 | 16 | MeshBasicNodeMaterial |  |
| world / plain-margins | 1 / 0 | 1 | 0 | 14 | MeshStandardNodeMaterial |  |

</details>

## field_autumn: plain fields, day 272 07:19 (cov-387) (day 272, 7.322 h)

camera 4193.5, 1809.4, 72.8; sim people within 60 m: 0, within 250 m: 0; crowd stats: {"draws":0,"triangles":0,"people":0,"byLod":[0,0,0,0],"shadowDraws":0,"shadowTriangles":0,"propDraws":0,"props":0,"propTriangles":0,"propsDropped":0,"placeholderActs":0,"motionCapture":0,"motionAuthored":0,"things":{"draws":0,"instances":0,"triangles":0,"kinds":{},"dropped":0},"animals":{"draws":0,"

| class | meshes visible / hidden | instances in frustum | of them < 60 m | triangles in frustum |
|---|---|---|---|---|
| people (skinned, any LOD) | 0 / 50 | 0 | 0 | 0 |
| people LOD3 (far) | 0 / 0 | 0 | 0 | 0 |
| people impostors | 1 / 0 | 1 | 0 | 2 |
| house roofs | 11 / 7 | 1425 | 0 | 18252 |
| house walls | 4 / 0 | 1 | 0 | 300 |
| ground fill / props | 4 / 334 | 2 | 0 | 92 |
| trees | 22 / 0 | 16 | 0 | 181066 |
| crops / flora | 87 / 38 | 919 | 231 | 152719 |
| fires / lamps | 10 / 4 | 13471 | 0 | 153090 |
| water | 13 / 6 | 105 | 2 | 369267 |
| animals | 135 / 10 | 306 | 3 | 161202 |
| terrace architecture | 118 / 219 | 4197 | 0 | 2005948 |

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
| world / people:impostors | 1 / 0 | 1 | 1 | 0 |
| player-body / humans:median:lod# | 0 / 2 | 2 | 0 | 0 |

people: sim out of doors within 60 m 0 (open ground 0, inside walled courts 0, walking 0; places {}; 250 m 0); crowd attached 0, skinned drawn 0 by LOD [0,0,0,0], impostors drawn 341 of 585 candidates

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
| world / plain-villages--#,# | 4 / 0 | 4 | 0 | 252456 | MeshStandardNodeMaterial | C |
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
| world / settlement:ground | 1 / 0 | 1 | 0 | 88536 | MeshStandardNodeMaterial | C |
| world / treasury:bitumen_jar | 1 / 0 | 284 | 0 | 87472 | MeshStandardNodeMaterial | C |
| world / treasury:silver_phiale | 1 / 0 | 244 | 0 | 87352 | MeshStandardNodeMaterial | C |
| world / plain-stone | 1 / 0 | 1 | 1 | 84008 | MeshStandardNodeMaterial | C |
| world / treasury:blue_vessel | 1 / 0 | 244 | 0 | 81984 | MeshStandardNodeMaterial | C |
| world / doors:bands | 1 / 0 | 432 | 0 | 81216 | MeshStandardNodeMaterial | C |
| world / plain-villages--#,-# | 2 / 0 | 1 | 0 | 79164 | MeshStandardNodeMaterial | C |
| world / crown-merlons:harem|#|-# | 4 / 0 | 962 | 0 | 78884 | decor:merlon:limestone_merlon | C |
| world / animals:sheep:lod# | 1 / 0 | 80 | 0 | 78400 | MeshStandardNodeMaterial |  |
| world / plain-tracks | 1 / 0 | 1 | 0 | 75768 | MeshStandardNodeMaterial | C |
| world / treasury:sealed_jar | 1 / 0 | 244 | 0 | 75152 | MeshStandardNodeMaterial | C |
| world / treasury:shield | 1 / 0 | 162 | 0 | 70956 | MeshStandardNodeMaterial | C |
| world / goods:sacks | 1 / 0 | 150 | 0 | 69000 | MeshStandardNodeMaterial |  |
| world / settlement:q_n#:far | 1 / 0 | 1 | 0 | 64558 | MeshStandardNodeMaterial | C |
| world / ledges:far | 1 / 0 | 1 | 0 | 61090 | ledges |  |
| world / plain-canal-banks | 1 / 0 | 1 | 0 | 55524 | MeshStandardNodeMaterial | C |
| world / doors:shoes | 1 / 0 | 108 | 0 | 55296 | MeshStandardNodeMaterial | C |
| world / animals:goat:lod# | 1 / 0 | 56 | 0 | 54880 | MeshStandardNodeMaterial |  |
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
| world / plain-villages-#,# | 2 / 0 | 1 | 1 | 33122 | MeshStandardNodeMaterial | C |
| world / rock-stone:namaqualand_stones_#_v#:lod# | 10 / 0 | 116 | 116 | 32965 | scan:namaqualand_stones_01_v1, scan:namaqualand_stones_01_v2, scan:namaqualand_stones_01_v3, scan:namaqualand_stones_01_v4 |  |
| world / ledges:mid | 1 / 0 | 1 | 0 | 32250 | ledges |  |
| world / settlement:gardens:far | 1 / 0 | 1 | 0 | 31796 | MeshStandardNodeMaterial | C |
| world / bedrock-ground:outcrop#:lod# | 2 / 1 | 113 | 2 | 31154 | bedrock:ground |  |
| world / harem:room_fittings:jars | 1 / 0 | 70 | 0 | 31080 | MeshStandardNodeMaterial | C |
| world / scribes:tablets_filed | 1 / 0 | 354 | 0 | 26904 | clay-writing |  |
| world / flora-cushion:shrub_#_v#:lod# | 8 / 0 | 62 | 62 | 25797 | scan:shrub_03_v1, scan:shrub_03_v2, scan:shrub_03_v3, scan:shrub_03_v4 |  |
| world / crown-merlons:terrace|-#|-# | 2 / 0 | 311 | 0 | 25502 | decor:merlon:limestone_merlon | C |

</details>

