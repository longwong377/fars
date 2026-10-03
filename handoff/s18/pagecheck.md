# Page check (D-772): what the page draws vs what its simulation holds

Tree /home/user/fars-pc gitdir: /home/user/fars/.git/worktrees/fars-pc; built site (vite build, base /fars/), headless Chromium, ?test&norender&webgl=1&quality=test&court=seasonal; 2026-10-03T07:35:29.157Z.
Per view: objects effectively visible (every ancestor visible) and meeting the camera frustum, their instances and triangles;
hidden = present in the scene but visible=false somewhere up the chain. sim<60 m = population view + detailed agents within 60 m of the camera.

## Run 4 (C12, s17-int ebf72036: C5's doorstep life and popview catch-up; build_site.mjs SKIP_BAKE=1; 2026-10-03 ~07:55 UTC)

**No flags: every in-frustum person not walled off is drawn.** The lift against run 3 (eb6f768f), out of doors within 60 m:

| view | run 3 | run 4 | notes |
|---|---|---|---|
| q_s1 lane, d0 10:00 | 140 | 201 | 37 on the lane, as C5 measured; 75 at workshops; 244 skinned drawn |
| lanes cov-142, d88 13:48 | 141 | 144 | 40 now on open ground (doorsteps), 104 in courts, 0 walking |
| court cov-037 | 59 | 60 | 33 on open ground; 155 skinned drawn (was 21) |
| Terrace, court day d40 10:00 | 28 | 83 | 64 in the frustum, 227 skinned |
| Apadana cov-294, d200 08:48 | 2 | 146 | apadana_hall 56, forecourt_wait 88 |
| night Terrace, d5 22:30 | 9 | 98 | forecourt_wait 88; 400 skinned |
| fields at dawn | 0 | 0 | 202 within 250 m |
| night town, d310 03:27 | 73 | 77 | all in courts |

Questions this run raises:
- **To C13:** 88 people in `forecourt_wait` at 22:30 on day 5. A party queueing for an audience at night?
- **To C13:** the Apadana hall full (56) on day 200, outside the residence (days ~6-117). Is the off-season Terrace now staffed with audiences, or is the residence window wrong?
- **To C12 itself:** "walking 0" at every view. The tool steps with a frozen clock (step(n, dt, 0)), so whether ViewPerson.moving can be read at a frozen moment is unverified. Do not read 0 walking as fact until the tool steps with the clock running.

## Flags

- none

Page errors (unique): 1
- 1x Failed to load resource: the server responded with a status of 404 (Not Found)

## town20: the town from 20 m up (roofs vs walls) (day 88, 13.805 h)

camera -871.9, -150.4, 4.4; sim people within 60 m: 142, within 250 m: 360; crowd stats: {"draws":3,"triangles":18276,"people":3,"byLod":[0,3,0,0],"shadowDraws":3,"shadowTriangles":1823,"propDraws":0,"props":0,"propTriangles":0,"propsDropped":0,"placeholderActs":0,"motionCapture":1,"motionAuthored":2,"things":{"draws":0,"instances":0,"triangles":0,"kinds":{},"dropped":0},"animals":{"dra

| class | meshes visible / hidden | instances in frustum | of them < 60 m | triangles in frustum |
|---|---|---|---|---|
| people (skinned, any LOD) | 6 / 44 | 0 | 0 | 0 |
| people LOD3 (far) | 0 / 0 | 0 | 0 | 0 |
| people impostors | 1 / 0 | 1 | 0 | 2 |
| house roofs | 13 / 5 | 0 | 0 | 0 |
| house walls | 4 / 0 | 1 | 1 | 300 |
| ground fill / props | 108 / 231 | 4 | 0 | 26138 |
| trees | 16 / 0 | 16 | 0 | 181066 |
| crops / flora | 25 / 38 | 71 | 66 | 13444 |
| fires / lamps | 13 / 1 | 2775 | 0 | 5550 |
| water | 12 / 4 | 4 | 1 | 274876 |
| animals | 133 / 8 | 183 | 51 | 96808 |
| terrace architecture | 118 / 219 | 927 | 0 | 1690000 |

shadow-casting lights: [{"name":"","far":2000,"size":[240]}]

page: backend WebGL2, norender true, catch-up ticks 0 (still catching up: false), crowd looks pending 0

people in the frustum: within 40 m 0 of 60; within 60 m 0 of 142 (behind court walls for this eye: 0; to be drawn: 0)

| people mesh | visible / hidden meshes | instances (count) | in frustum | < 60 m |
|---|---|---|---|---|
| world / humans:persian:shadow | 0 / 1 | 1 | 0 | 0 |
| world / humans:persian:shadow-far | 0 / 1 | 1 | 0 | 0 |
| world / humans:persian:lod# | 0 / 4 | 4 | 0 | 0 |
| world / humans:median:shadow | 0 / 1 | 1 | 0 | 0 |
| world / humans:median:shadow-far | 0 / 1 | 1 | 0 | 0 |
| world / humans:median:lod# | 0 / 4 | 4 | 0 | 0 |
| world / humans:worker:shadow | 0 / 1 | 1 | 0 | 0 |
| world / humans:worker:shadow-far | 1 / 0 | 1 | 0 | 0 |
| world / humans:worker:lod# | 1 / 3 | 4 | 0 | 0 |
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
| world / people:reins | 0 / 1 | 0 | 0 | 0 |
| world / people:hit | 0 / 1 | 1 | 0 | 0 |
| world / people:impostors | 1 / 0 | 1 | 1 | 0 |
| player-body / humans:median:lod# | 0 / 2 | 2 | 0 | 0 |

people: sim out of doors within 60 m 142 (open ground 39, inside walled courts 103, walking 0; places {"h":142}; 250 m 360); crowd attached 363, skinned drawn 3 by LOD [0,3,0,0], impostors drawn 43 of 498 candidates

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
| world / nr-life | 1 / 0 | 1 | 1 | 9792 | MeshStandardNodeMaterial | C |
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

</details>

## lanes: a town lane, afternoon (cov-142) (day 88, 13.805 h)

camera -871.9, -150.4, -14; sim people within 60 m: 144, within 250 m: 582; crowd stats: {"draws":4,"triangles":76387,"people":5,"byLod":[2,0,0,3],"shadowDraws":1,"shadowTriangles":5280,"propDraws":1,"props":5,"propTriangles":20280,"propsDropped":0,"placeholderActs":0,"motionCapture":1,"motionAuthored":4,"things":{"draws":0,"instances":0,"triangles":0,"kinds":{},"dropped":0},"animals":{

| class | meshes visible / hidden | instances in frustum | of them < 60 m | triangles in frustum |
|---|---|---|---|---|
| people (skinned, any LOD) | 5 / 45 | 5 | 4 | 41745 |
| people LOD3 (far) | 0 / 0 | 0 | 0 | 0 |
| people impostors | 1 / 0 | 1 | 0 | 2 |
| house roofs | 13 / 5 | 0 | 0 | 0 |
| house walls | 4 / 0 | 1 | 1 | 300 |
| ground fill / props | 109 / 230 | 52 | 46 | 52707 |
| trees | 16 / 0 | 16 | 0 | 181066 |
| crops / flora | 25 / 38 | 66 | 60 | 14516 |
| fires / lamps | 13 / 1 | 2913 | 4 | 5826 |
| water | 12 / 4 | 4 | 1 | 274876 |
| animals | 134 / 8 | 185 | 52 | 104761 |
| terrace architecture | 118 / 219 | 927 | 0 | 1690000 |

shadow-casting lights: [{"name":"","far":2000,"size":[240]}]

page: backend WebGL2, norender true, catch-up ticks 0 (still catching up: false), crowd looks pending 0

people in the frustum: within 40 m 4 of 61; within 60 m 4 of 144 (behind court walls for this eye: 2; to be drawn: 2)

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
| world / humans:woman:shadow | 1 / 0 | 1 | 1 | 1 |
| world / humans:woman:shadow-far | 0 / 1 | 1 | 0 | 0 |
| world / humans:woman:lod# | 2 / 2 | 4 | 2 | 1 |
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

people: sim out of doors within 60 m 144 (open ground 40, inside walled courts 104, walking 0; places {"h":144}; 250 m 582); crowd attached 425, skinned drawn 5 by LOD [2,0,0,3], impostors drawn 80 of 699 candidates

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
| world / humans:woman:lod# | 2 / 2 | 2 | 1 | 37995 | human |  |
| world / interiors:cloth | 1 / 0 | 1 | 0 | 37403 | MeshStandardNodeMaterial | C |
| world / animals:goat:lod# | 2 / 0 | 38 | 0 | 37240 | MeshStandardNodeMaterial |  |
| world / settlement:near:items | 1 / 0 | 1 | 0 | 36105 | MeshStandardNodeMaterial | C |
| world / plain-villages-#,# | 2 / 0 | 1 | 1 | 35002 | MeshStandardNodeMaterial | C |
| world / ledges:far | 1 / 0 | 1 | 0 | 28850 | ledges |  |
| plain-qanats / qanat-tile:#,-# | 2 / 13 | 318 | 0 | 28620 | MeshStandardNodeMaterial | C |
| world / settlement:near:props | 1 / 0 | 1 | 0 | 24302 | MeshStandardNodeMaterial | C |
| world / settlement:refuse | 1 / 0 | 1 | 1 | 22368 | MeshStandardNodeMaterial | C |
| world / settlement:roads | 1 / 0 | 1 | 1 | 20956 | MeshStandardNodeMaterial | C |
| world / props:carried | 1 / 0 | 5 | 4 | 20280 | MeshStandardNodeMaterial |  |
| world / settlement:gardens:far | 1 / 0 | 1 | 1 | 15864 | MeshStandardNodeMaterial | C |
| world / settlement:near:stone | 1 / 0 | 1 | 0 | 14130 | MeshStandardNodeMaterial | C |
| world / interiors:clay | 1 / 0 | 1 | 0 | 12332 | MeshStandardNodeMaterial | C |
| world / nr-life | 1 / 0 | 1 | 1 | 9792 | MeshStandardNodeMaterial | C |
| world / rock-stone:namaqualand_stones_#_v#:lod# | 10 / 0 | 33 | 33 | 9385 | scan:namaqualand_stones_01_v1, scan:namaqualand_stones_01_v2, scan:namaqualand_stones_01_v3, scan:namaqualand_stones_01_v4 |  |
| world / settlement:water | 1 / 0 | 1 | 1 | 9148 | MeshStandardNodeMaterial | C |
| world / rock-stone:namaqualand_rocks_#_v#:lod# | 8 / 0 | 24 | 24 | 8843 | scan:namaqualand_rocks_01_v1, scan:namaqualand_rocks_01_v2, scan:namaqualand_rocks_01_v3, scan:namaqualand_rocks_01_v4 |  |
| world / flora-camelthorn:model:lod# | 2 / 0 | 23 | 23 | 6648 | life:camelthorn |  |
| world / animals:donkey:lod# | 3 / 0 | 1 | 1 | 5879 | MeshStandardNodeMaterial |  |
| world / fire | 1 / 0 | 2230 | 3 | 4460 | MeshBasicNodeMaterial |  |
| world / bird-chukar:stand# | 2 / 0 | 24 | 0 | 4224 | life:chukar |  |
| world / flora-cushion:model:lod# | 2 / 0 | 20 | 20 | 3760 | life:cushion |  |
| world / rock-boulder:namaqualand_boulder_#:lod# | 10 / 0 | 8 | 2 | 3048 | scan:namaqualand_boulder_02, scan:namaqualand_boulder_03, scan:namaqualand_boulder_04, scan:namaqualand_boulder_05 |  |
| Points | 1 / 0 | 1 | 0 | 2973 | PointsNodeMaterial |  |
| world / court-camps:ridge:shell | 1 / 0 | 179 | 0 | 2864 | MeshStandardNodeMaterial | C |
| world / humans:woman:shadow | 1 / 0 | 1 | 1 | 2640 | human |  |
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

</details>

## qs1: a q_s1 lane on the road south at day 0, 10:00 (cov-381's spot) (day 0, 10 h)

camera -397, -894.7, -16.2; sim people within 60 m: 201, within 250 m: 586; crowd stats: {"draws":12,"triangles":643629,"people":244,"byLod":[10,30,0,204],"shadowDraws":8,"shadowTriangles":37979,"propDraws":4,"props":146,"propTriangles":496750,"propsDropped":0,"placeholderActs":0,"motionCapture":77,"motionAuthored":167,"things":{"draws":9,"instances":184,"triangles":603642,"kinds":{"bea

| class | meshes visible / hidden | instances in frustum | of them < 60 m | triangles in frustum |
|---|---|---|---|---|
| people (skinned, any LOD) | 20 / 30 | 18 | 14 | 108980 |
| people LOD3 (far) | 0 / 0 | 0 | 0 | 0 |
| people impostors | 1 / 0 | 1 | 0 | 2 |
| house roofs | 13 / 5 | 6 | 2 | 1662 |
| house walls | 4 / 0 | 1 | 1 | 300 |
| ground fill / props | 118 / 221 | 635 | 281 | 614099 |
| trees | 16 / 0 | 16 | 0 | 181066 |
| crops / flora | 33 / 30 | 59 | 47 | 11836 |
| fires / lamps | 13 / 1 | 3919 | 55 | 8278 |
| water | 13 / 3 | 54 | 18 | 281172 |
| animals | 137 / 7 | 265 | 51 | 169174 |
| terrace architecture | 118 / 219 | 927 | 0 | 1690000 |

shadow-casting lights: [{"name":"","far":2000,"size":[240]}]

page: backend WebGL2, norender true, catch-up ticks 0 (still catching up: false), crowd looks pending 0

people in the frustum: within 40 m 55 of 105; within 60 m 96 of 201 (behind court walls for this eye: 63; to be drawn: 33)

| people mesh | visible / hidden meshes | instances (count) | in frustum | < 60 m |
|---|---|---|---|---|
| world / humans:persian:shadow | 0 / 1 | 1 | 0 | 0 |
| world / humans:persian:shadow-far | 1 / 0 | 1 | 1 | 0 |
| world / humans:persian:lod# | 1 / 3 | 4 | 1 | 0 |
| world / humans:median:shadow | 0 / 1 | 1 | 0 | 0 |
| world / humans:median:shadow-far | 1 / 0 | 1 | 1 | 0 |
| world / humans:median:lod# | 2 / 2 | 4 | 2 | 1 |
| world / humans:worker:shadow | 1 / 0 | 1 | 0 | 0 |
| world / humans:worker:shadow-far | 1 / 0 | 1 | 1 | 1 |
| world / humans:worker:lod# | 3 / 1 | 4 | 2 | 2 |
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

people: sim out of doors within 60 m 201 (open ground 79, inside walled courts 122, walking 0; places {"h":79,"lane":37,"ws":75,"well":1,"ws_textile":9}; 250 m 586); crowd attached 443, skinned drawn 244 by LOD [10,30,0,204], impostors drawn 130 of 1412 candidates

town roofs (150 m round [-455,-1033]): up-facing area above 1.8 m 25956 m², wall area 95175 m², ratio 0.273 (199185 triangles)

<details><summary>all classes (top 60 by triangles)</summary>

| object key | vis / hidden | inst in frustum | < 60 m | tris | mats | tiers |
|---|---|---|---|---|---|---|
| world / relief:figures | 9 / 3 | 927 | 0 | 1690000 | MeshStandardNodeMaterial | C |
| terrain | 208 / 0 | 55 | 3 | 740608 | MeshStandardNodeMaterial | C |
| world / work:loom | 1 / 0 | 156 | 26 | 564720 | MeshStandardNodeMaterial |  |
| world / props:carried | 1 / 0 | 81 | 37 | 328536 | MeshStandardNodeMaterial |  |
| world / settlement:q_s#:far | 4 / 0 | 3 | 1 | 298284 | MeshStandardNodeMaterial | C |
| world / settlement:near:plaster | 1 / 0 | 1 | 0 | 190069 | MeshStandardNodeMaterial | C |
| world / plain-orchards-far | 1 / 0 | 1 | 0 | 176772 | MeshStandardNodeMaterial |  |
| world / river-banks | 1 / 0 | 1 | 0 | 159880 | MeshStandardNodeMaterial | C |
| world / props:tools | 2 / 2 | 58 | 20 | 159100 | MeshStandardNodeMaterial |  |
| world / plain-villages--#,-# | 2 / 0 | 2 | 0 | 142112 | MeshStandardNodeMaterial | C |
| world / settlement:near:timber | 1 / 0 | 1 | 0 | 122887 | MeshStandardNodeMaterial | C |
| world / animals:hen:lod# | 1 / 0 | 157 | 16 | 98282 | MeshStandardNodeMaterial |  |
| world / settlement:ground | 1 / 0 | 1 | 1 | 95156 | MeshStandardNodeMaterial | C |
| world / settlement:near:items | 1 / 0 | 1 | 0 | 88724 | MeshStandardNodeMaterial | C |
| world / plain-stone | 1 / 0 | 1 | 1 | 84008 | MeshStandardNodeMaterial | C |
| world / plain-tracks | 1 / 0 | 1 | 0 | 75768 | MeshStandardNodeMaterial | C |
| world / plain-villages--#,# | 4 / 0 | 1 | 0 | 67086 | MeshStandardNodeMaterial | C |
| world / plain-canal-banks | 1 / 0 | 1 | 0 | 55524 | MeshStandardNodeMaterial | C |
| world / river-water | 1 / 0 | 1 | 0 | 50324 | MeshStandardNodeMaterial |  |
| world / settlement:near:props | 1 / 0 | 1 | 0 | 49361 | MeshStandardNodeMaterial | C |
| world / interiors:cloth | 1 / 0 | 1 | 0 | 47806 | MeshStandardNodeMaterial | C |
| world / humans:woman:lod# | 3 / 1 | 3 | 3 | 43862 | human |  |
| world / humans:child:lod# | 3 / 1 | 3 | 3 | 36304 | human |  |
| world / plain-villages-#,# | 2 / 0 | 1 | 1 | 35002 | MeshStandardNodeMaterial | C |
| world / ledges:far | 1 / 0 | 1 | 0 | 33710 | ledges |  |
| world / settlement:near:stone | 1 / 0 | 1 | 0 | 29820 | MeshStandardNodeMaterial | C |
| world / work:beam | 1 / 0 | 11 | 3 | 26004 | MeshStandardNodeMaterial |  |
| world / settlement-doors:# | 6 / 0 | 126 | 17 | 24948 | MeshStandardNodeMaterial | C |
| world / settlement:refuse | 1 / 0 | 1 | 1 | 22368 | MeshStandardNodeMaterial | C |
| world / settlement:roads | 1 / 0 | 1 | 1 | 20956 | MeshStandardNodeMaterial | C |
| world / animals:dog:lod# | 1 / 0 | 19 | 1 | 18582 | MeshStandardNodeMaterial |  |
| world / settlement:gardens:far | 1 / 0 | 1 | 1 | 15864 | MeshStandardNodeMaterial | C |
| world / animals:goat:lod# | 3 / 0 | 16 | 10 | 15680 | MeshStandardNodeMaterial |  |
| world / interiors:clay | 1 / 0 | 1 | 0 | 13386 | MeshStandardNodeMaterial | C |
| world / animals:cock:lod# | 1 / 0 | 19 | 2 | 11894 | MeshStandardNodeMaterial |  |
| world / animals:donkey:lod# | 3 / 0 | 6 | 3 | 11754 | MeshStandardNodeMaterial |  |
| world / nr-life | 1 / 0 | 1 | 1 | 9792 | MeshStandardNodeMaterial | C |
| world / settlement:water | 1 / 0 | 1 | 1 | 9148 | MeshStandardNodeMaterial | C |
| world / props:children | 1 / 0 | 7 | 4 | 9114 | MeshStandardNodeMaterial |  |
| world / humans:worker:lod# | 3 / 1 | 2 | 2 | 7581 | human |  |
| world / humans:median:lod# | 2 / 2 | 2 | 1 | 6611 | human |  |
| world / humans:persian:lod# | 1 / 3 | 1 | 0 | 6580 | human |  |
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
| world / fill:fill_stall:cloth:lod# | 3 / 0 | 1 | 1 | 2600 | MeshStandardNodeMaterial | C |
| world / work:knucklebones | 1 / 0 | 9 | 6 | 2520 | MeshStandardNodeMaterial |  |

</details>

## court: a town court, noon (cov-037) (day 14, 11.07 h)

camera -535.4, 401.1, -12; sim people within 60 m: 60, within 250 m: 328; crowd stats: {"draws":10,"triangles":170835,"people":155,"byLod":[1,5,0,149],"shadowDraws":4,"shadowTriangles":5243,"propDraws":4,"props":75,"propTriangles":271622,"propsDropped":0,"placeholderActs":0,"motionCapture":91,"motionAuthored":64,"things":{"draws":10,"instances":46,"triangles":47356,"kinds":{"beam":1,"

| class | meshes visible / hidden | instances in frustum | of them < 60 m | triangles in frustum |
|---|---|---|---|---|
| people (skinned, any LOD) | 14 / 36 | 14 | 10 | 63876 |
| people LOD3 (far) | 0 / 0 | 0 | 0 | 0 |
| people impostors | 1 / 0 | 1 | 0 | 2 |
| house roofs | 13 / 5 | 14 | 8 | 3878 |
| house walls | 4 / 0 | 1 | 1 | 300 |
| ground fill / props | 110 / 229 | 367 | 235 | 350264 |
| trees | 16 / 0 | 16 | 0 | 181066 |
| crops / flora | 25 / 38 | 60 | 14 | 8744 |
| fires / lamps | 13 / 1 | 2994 | 59 | 7614 |
| water | 13 / 3 | 93 | 22 | 360876 |
| animals | 141 / 9 | 309 | 39 | 251955 |
| terrace architecture | 120 / 217 | 928 | 0 | 1690036 |

shadow-casting lights: [{"name":"","far":2000,"size":[240]}]

page: backend WebGL2, norender true, catch-up ticks 0 (still catching up: false), crowd looks pending 0

people in the frustum: within 40 m 5 of 23; within 60 m 7 of 60 (behind court walls for this eye: 2; to be drawn: 5)

| people mesh | visible / hidden meshes | instances (count) | in frustum | < 60 m |
|---|---|---|---|---|
| world / humans:persian:shadow | 0 / 1 | 1 | 0 | 0 |
| world / humans:persian:shadow-far | 0 / 1 | 1 | 0 | 0 |
| world / humans:persian:lod# | 0 / 4 | 4 | 0 | 0 |
| world / humans:median:shadow | 0 / 1 | 1 | 0 | 0 |
| world / humans:median:shadow-far | 0 / 1 | 1 | 0 | 0 |
| world / humans:median:lod# | 1 / 3 | 4 | 1 | 0 |
| world / humans:worker:shadow | 0 / 1 | 1 | 0 | 0 |
| world / humans:worker:shadow-far | 1 / 0 | 1 | 1 | 1 |
| world / humans:worker:lod# | 2 / 2 | 4 | 2 | 2 |
| world / humans:woman:shadow | 1 / 0 | 1 | 1 | 1 |
| world / humans:woman:shadow-far | 1 / 0 | 1 | 1 | 1 |
| world / humans:woman:lod# | 3 / 1 | 4 | 3 | 3 |
| world / humans:child:shadow | 0 / 1 | 1 | 0 | 0 |
| world / humans:child:shadow-far | 1 / 0 | 1 | 1 | 1 |
| world / humans:child:lod# | 2 / 2 | 4 | 2 | 1 |
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

people: sim out of doors within 60 m 60 (open ground 33, inside walled courts 27, walking 0; places {"h":48,"lane":12}; 250 m 328); crowd attached 457, skinned drawn 155 by LOD [1,5,0,149], impostors drawn 14 of 2038 candidates

town roofs (150 m round [-423,500]): up-facing area above 1.8 m 18156 m², wall area 70488 m², ratio 0.258 (171658 triangles)

<details><summary>all classes (top 60 by triangles)</summary>

| object key | vis / hidden | inst in frustum | < 60 m | tris | mats | tiers |
|---|---|---|---|---|---|---|
| world / relief:figures | 9 / 3 | 927 | 0 | 1690000 | MeshStandardNodeMaterial | C |
| terrain | 208 / 0 | 71 | 2 | 847616 | MeshStandardNodeMaterial | C |
| world / props:carried | 1 / 0 | 53 | 4 | 214968 | MeshStandardNodeMaterial |  |
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
| world / settlement:near:items | 1 / 0 | 1 | 0 | 66328 | MeshStandardNodeMaterial | C |
| world / animals:sheep:lod# | 2 / 0 | 66 | 0 | 64680 | MeshStandardNodeMaterial |  |
| world / settlement:q_n#:far | 1 / 0 | 1 | 0 | 63066 | MeshStandardNodeMaterial | C |
| world / plain-canal-banks | 1 / 0 | 1 | 0 | 55524 | MeshStandardNodeMaterial | C |
| world / props:tools | 2 / 2 | 21 | 3 | 55352 | MeshStandardNodeMaterial |  |
| world / animals:goat:lod# | 2 / 1 | 55 | 6 | 53900 | MeshStandardNodeMaterial |  |
| world / river-water | 1 / 0 | 1 | 0 | 50324 | MeshStandardNodeMaterial |  |
| world / interiors:cloth | 1 / 0 | 1 | 0 | 47891 | MeshStandardNodeMaterial | C |
| plain-waterworks / works:wo_shaduf | 1 / 0 | 59 | 0 | 47436 | MeshStandardNodeMaterial | C |
| world / ledges:far | 1 / 0 | 1 | 0 | 44560 | ledges |  |
| world / humans:woman:lod# | 3 / 1 | 3 | 3 | 43862 | human |  |
| world / settlement:near:props | 1 / 0 | 1 | 0 | 36376 | MeshStandardNodeMaterial | C |
| world / nr-cliff | 1 / 0 | 1 | 0 | 33260 | MeshStandardNodeMaterial | C |
| world / animals:hen:lod# | 2 / 0 | 45 | 14 | 28170 | MeshStandardNodeMaterial |  |
| world / animals:dog:lod# | 1 / 0 | 26 | 2 | 25428 | MeshStandardNodeMaterial |  |
| world / settlement:channel_stones | 1 / 0 | 1 | 0 | 24588 | MeshStandardNodeMaterial | C |
| world / settlement:near:stone | 1 / 0 | 1 | 0 | 22748 | MeshStandardNodeMaterial | C |
| world / settlement:refuse | 1 / 0 | 1 | 1 | 22368 | MeshStandardNodeMaterial | C |
| world / animals:donkey:lod# | 4 / 0 | 11 | 6 | 22333 | MeshStandardNodeMaterial |  |
| world / settlement:roads | 1 / 0 | 1 | 1 | 20956 | MeshStandardNodeMaterial | C |
| world / animals:camel:lod# | 2 / 0 | 13 | 0 | 17836 | MeshStandardNodeMaterial |  |
| world / work:drying_rack | 1 / 0 | 8 | 0 | 16448 | MeshStandardNodeMaterial |  |
| world / settlement:gardens:far | 1 / 0 | 1 | 1 | 15864 | MeshStandardNodeMaterial | C |
| quarries-detail / plain-quarries:rock:quarry_sivand | 1 / 0 | 1 | 0 | 13745 | bedrock:ground |  |
| world / interiors:clay | 1 / 0 | 1 | 0 | 12818 | MeshStandardNodeMaterial | C |
| world / nr_darius_tomb | 1 / 0 | 1 | 0 | 11154 | MeshStandardNodeMaterial | C |
| world / nr_xerxes_tomb | 1 / 0 | 1 | 0 | 11154 | MeshStandardNodeMaterial | C |
| world / animals:horse:lod# | 2 / 0 | 8 | 0 | 10968 | MeshStandardNodeMaterial |  |
| world / animals:mule:lod# | 1 / 0 | 8 | 0 | 10968 | MeshStandardNodeMaterial |  |
| world / work:wash_stone | 1 / 0 | 8 | 0 | 10624 | MeshStandardNodeMaterial |  |
| world / nr-life | 1 / 0 | 1 | 1 | 9792 | MeshStandardNodeMaterial | C |
| world / settlement:water | 1 / 0 | 1 | 1 | 9148 | MeshStandardNodeMaterial | C |
| world / settlement:q_g#:far | 1 / 0 | 1 | 0 | 8980 | MeshStandardNodeMaterial | C |
| world / settlement-doors:# | 6 / 0 | 46 | 16 | 8668 | MeshStandardNodeMaterial | C |
| world / settlement:canal_banks | 1 / 0 | 1 | 0 | 7836 | MeshStandardNodeMaterial | C |
| world / humans:worker:lod# | 2 / 2 | 2 | 2 | 7581 | human |  |
| world / work:fodder | 1 / 0 | 14 | 0 | 6944 | MeshStandardNodeMaterial |  |
| world / fill:jar_water:clay:lod# | 3 / 0 | 28 | 21 | 6140 | MeshStandardNodeMaterial | C |
| world / work:basket_fruit | 1 / 0 | 5 | 0 | 6000 | MeshStandardNodeMaterial |  |
| world / humans:child:lod# | 2 / 2 | 2 | 1 | 5938 | human |  |
| world / bedrock-ground:talus#:lod# | 1 / 2 | 75 | 0 | 5925 | bedrock:ground |  |
| plain-works / works:wo_brick_stack | 1 / 0 | 18 | 0 | 4644 | MeshStandardNodeMaterial | C |
| world / animals:cock:lod# | 1 / 0 | 7 | 1 | 4382 | MeshStandardNodeMaterial |  |
| world / settlement:official:far | 1 / 0 | 1 | 0 | 4298 | MeshStandardNodeMaterial | C |
| world / fire | 1 / 0 | 2072 | 34 | 4144 | MeshBasicNodeMaterial |  |
| world / settlement:zone_dasht_e_gohar:mud | 1 / 0 | 1 | 0 | 4090 | MeshStandardNodeMaterial | C |
| plain-qanats / qanat-tile:#,# | 1 / 13 | 43 | 0 | 3870 | MeshStandardNodeMaterial | C |

</details>

## terrace: the Terrace, noon (cov-252) (day 168, 12.586 h)

camera 84.8, 9.8, 1.6; sim people within 60 m: 19, within 250 m: 577; crowd stats: {"draws":6,"triangles":220808,"people":92,"byLod":[0,26,0,66],"shadowDraws":3,"shadowTriangles":18018,"propDraws":3,"props":45,"propTriangles":178472,"propsDropped":0,"placeholderActs":0,"motionCapture":18,"motionAuthored":74,"things":{"draws":2,"instances":2,"triangles":2440,"kinds":{"knucklebones"

| class | meshes visible / hidden | instances in frustum | of them < 60 m | triangles in frustum |
|---|---|---|---|---|
| people (skinned, any LOD) | 9 / 41 | 9 | 9 | 22393 |
| people LOD3 (far) | 0 / 0 | 0 | 0 | 0 |
| people impostors | 1 / 0 | 1 | 0 | 2 |
| house roofs | 11 / 7 | 177 | 2 | 2712 |
| house walls | 4 / 0 | 8 | 2 | 888 |
| ground fill / props | 26 / 313 | 86 | 53 | 183821 |
| trees | 16 / 0 | 16 | 0 | 181066 |
| crops / flora | 19 / 44 | 186 | 0 | 24690 |
| fires / lamps | 10 / 4 | 2280 | 6 | 30272 |
| water | 11 / 5 | 58 | 4 | 325032 |
| animals | 126 / 25 | 53 | 1 | 6763 |
| terrace architecture | 137 / 200 | 1050 | 12 | 1826232 |

shadow-casting lights: [{"name":"","far":2000,"size":[240]}]

page: backend WebGL2, norender true, catch-up ticks 1 (still catching up: false), crowd looks pending 0

people in the frustum: within 40 m 0 of 0; within 60 m 19 of 19 (behind court walls for this eye: 0; to be drawn: 19)

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

people: sim out of doors within 60 m 19 (open ground 10, inside walled courts 0, walking 0; places {"h100_door_N1":5,"worksite":4,"querns":1}; 250 m 577); crowd attached 405, skinned drawn 92 by LOD [0,26,0,66], impostors drawn 3 of 2200 candidates

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
| world / props:carried | 1 / 0 | 42 | 11 | 170352 | MeshStandardNodeMaterial |  |
| world / river-banks | 1 / 0 | 1 | 0 | 159880 | MeshStandardNodeMaterial | C |
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
| plain-waterworks / works:wo_shaduf | 1 / 0 | 50 | 0 | 40200 | MeshStandardNodeMaterial | C |
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
| world / nr-life | 1 / 0 | 1 | 1 | 9792 | MeshStandardNodeMaterial | C |
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

## terrace_court: the Terrace at 10:00 with the court resident (day 40) (day 40, 10 h)

camera 84.8, 9.8, 1.6; sim people within 60 m: 83, within 250 m: 734; crowd stats: {"draws":7,"triangles":818555,"people":227,"byLod":[0,100,22,105],"shadowDraws":3,"shadowTriangles":86801,"propDraws":3,"props":154,"propTriangles":619324,"propsDropped":0,"placeholderActs":0,"motionCapture":32,"motionAuthored":195,"things":{"draws":2,"instances":2,"triangles":2440,"kinds":{"knuckle

| class | meshes visible / hidden | instances in frustum | of them < 60 m | triangles in frustum |
|---|---|---|---|---|
| people (skinned, any LOD) | 10 / 40 | 10 | 10 | 25319 |
| people LOD3 (far) | 0 / 0 | 0 | 0 | 0 |
| people impostors | 1 / 0 | 1 | 0 | 2 |
| house roofs | 11 / 7 | 177 | 2 | 2712 |
| house walls | 4 / 0 | 9 | 2 | 828 |
| ground fill / props | 26 / 313 | 190 | 96 | 605645 |
| trees | 16 / 0 | 16 | 0 | 181066 |
| crops / flora | 19 / 44 | 186 | 0 | 24690 |
| fires / lamps | 10 / 4 | 2280 | 6 | 30272 |
| water | 11 / 5 | 58 | 4 | 325032 |
| animals | 127 / 24 | 248 | 1 | 197627 |
| terrace architecture | 138 / 199 | 1050 | 12 | 1826232 |

shadow-casting lights: [{"name":"","far":2000,"size":[240]}]

page: backend WebGL2, norender true, catch-up ticks 0 (still catching up: false), crowd looks pending 0

people in the frustum: within 40 m 11 of 11; within 60 m 64 of 83 (behind court walls for this eye: 0; to be drawn: 64)

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

people: sim out of doors within 60 m 83 (open ground 66, inside walled courts 0, walking 0; places {"h100_door_N1":32,"h100_wall_W":28,"hall100_site":5,"querns":1}; 250 m 734); crowd attached 449, skinned drawn 227 by LOD [0,100,22,105], impostors drawn 4 of 2323 candidates

town roofs (150 m round [145,11]): up-facing area above 1.8 m 0 m², wall area 0 m², ratio null (0 triangles)

<details><summary>all classes (top 60 by triangles)</summary>

| object key | vis / hidden | inst in frustum | < 60 m | tris | mats | tiers |
|---|---|---|---|---|---|---|
| world / relief:figures | 9 / 3 | 927 | 0 | 1690000 | MeshStandardNodeMaterial | C |
| terrain | 208 / 0 | 72 | 2 | 752640 | MeshStandardNodeMaterial | C |
| world / props:carried | 1 / 0 | 146 | 54 | 592176 | MeshStandardNodeMaterial |  |
| world / garrison:room_fittings:bedrolls | 1 / 0 | 624 | 0 | 469248 | MeshStandardNodeMaterial | C |
| world / garrison:room_fittings:mats | 1 / 0 | 416 | 0 | 372320 | MeshStandardNodeMaterial | C |
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
| plain-waterworks / works:wo_shaduf | 1 / 0 | 50 | 0 | 40200 | MeshStandardNodeMaterial | C |
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
| world / humans:worker:lod# | 3 / 1 | 3 | 3 | 10507 | human |  |
| world / treasury:timber:ceiling | 1 / 0 | 1 | 0 | 10506 | MeshStandardNodeMaterial | C |
| world / treasury:scale_armour | 1 / 0 | 18 | 0 | 10224 | MeshStandardNodeMaterial | C |
| world / nr-life | 1 / 0 | 1 | 1 | 9792 | MeshStandardNodeMaterial | C |
| world / settlement:water | 1 / 0 | 1 | 1 | 9148 | MeshStandardNodeMaterial | C |
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
| plain-qanats / qanat-tile:#,-# | 3 / 12 | 72 | 0 | 6480 | MeshStandardNodeMaterial | C |

</details>

## apadana: the Apadana hall, morning (cov-294) (day 200, 8.809 h)

camera 14.3, 32.6, 4.6; sim people within 60 m: 146, within 250 m: 792; crowd stats: {"draws":9,"triangles":416255,"people":197,"byLod":[0,55,0,142],"shadowDraws":5,"shadowTriangles":32362,"propDraws":3,"props":116,"propTriangles":398382,"propsDropped":0,"placeholderActs":0,"motionCapture":57,"motionAuthored":140,"things":{"draws":4,"instances":88,"triangles":74288,"kinds":{"knuckle

| class | meshes visible / hidden | instances in frustum | of them < 60 m | triangles in frustum |
|---|---|---|---|---|
| people (skinned, any LOD) | 14 / 36 | 14 | 11 | 36664 |
| people LOD3 (far) | 0 / 0 | 0 | 0 | 0 |
| people impostors | 1 / 0 | 1 | 0 | 2 |
| house roofs | 11 / 7 | 160 | 18 | 2352 |
| house walls | 4 / 0 | 1 | 1 | 300 |
| ground fill / props | 16 / 323 | 121 | 10 | 379070 |
| trees | 16 / 0 | 16 | 0 | 181066 |
| crops / flora | 19 / 44 | 126 | 0 | 13790 |
| fires / lamps | 10 / 4 | 2041 | 0 | 20610 |
| water | 11 / 5 | 69 | 5 | 356944 |
| animals | 125 / 26 | 49 | 1 | 6600 |
| terrace architecture | 149 / 198 | 1957 | 669 | 1967199 |

shadow-casting lights: [{"name":"","far":2000,"size":[240]}]

page: backend WebGL2, norender true, catch-up ticks 1 (still catching up: false), crowd looks pending 0

people in the frustum: within 40 m 3 of 30; within 60 m 50 of 146 (behind court walls for this eye: 0; to be drawn: 50)

| people mesh | visible / hidden meshes | instances (count) | in frustum | < 60 m |
|---|---|---|---|---|
| world / humans:persian:shadow | 0 / 1 | 1 | 0 | 0 |
| world / humans:persian:shadow-far | 1 / 0 | 1 | 1 | 1 |
| world / humans:persian:lod# | 2 / 2 | 4 | 2 | 1 |
| world / humans:median:shadow | 0 / 1 | 1 | 0 | 0 |
| world / humans:median:shadow-far | 1 / 0 | 1 | 1 | 1 |
| world / humans:median:lod# | 1 / 3 | 4 | 1 | 1 |
| world / humans:worker:shadow | 0 / 1 | 1 | 0 | 0 |
| world / humans:worker:shadow-far | 0 / 1 | 1 | 0 | 0 |
| world / humans:worker:lod# | 1 / 3 | 4 | 1 | 1 |
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

people: sim out of doors within 60 m 146 (open ground 145, inside walled courts 0, walking 0; places {"palaces":1,"apadana_hall":56,"forecourt_wait":88}; 250 m 792); crowd attached 444, skinned drawn 197 by LOD [0,55,0,142], impostors drawn 9 of 2454 candidates

town roofs (150 m round [54,77]): up-facing area above 1.8 m 0 m², wall area 0 m², ratio null (0 triangles)

<details><summary>all classes (top 60 by triangles)</summary>

| object key | vis / hidden | inst in frustum | < 60 m | tris | mats | tiers |
|---|---|---|---|---|---|---|
| world / relief:figures | 9 / 3 | 927 | 0 | 1690000 | MeshStandardNodeMaterial | C |
| terrain | 208 / 0 | 71 | 3 | 785920 | MeshStandardNodeMaterial | C |
| world / props:carried | 1 / 0 | 57 | 1 | 231192 | MeshStandardNodeMaterial |  |
| world / plain-orchards-far | 1 / 0 | 1 | 0 | 176772 | MeshStandardNodeMaterial |  |
| world / garrison:room_fittings:bedrolls | 1 / 0 | 223 | 0 | 167696 | MeshStandardNodeMaterial | C |
| world / river-banks | 1 / 0 | 1 | 0 | 159880 | MeshStandardNodeMaterial | C |
| plain-works / works:wo_brick_field | 1 / 0 | 591 | 0 | 150114 | MeshStandardNodeMaterial | C |
| world / props:tools | 1 / 3 | 51 | 0 | 143004 | MeshStandardNodeMaterial |  |
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
| plain-waterworks / works:wo_shaduf | 1 / 0 | 59 | 0 | 47436 | MeshStandardNodeMaterial | C |
| world / work:brick_field | 1 / 0 | 29 | 0 | 46980 | MeshStandardNodeMaterial |  |
| world / crown-merlons:terrace|#|# | 2 / 0 | 246 | 0 | 44104 | decor:merlon:limestone_merlon | C |
| world / fortification_e:mudbrick | 2 / 0 | 2 | 2 | 42174 | MeshStandardNodeMaterial | B/C |
| world / nr-cliff | 1 / 0 | 1 | 0 | 33260 | MeshStandardNodeMaterial | C |
| world / relief:far | 15 / 43 | 4 | 4 | 31835 | MeshStandardNodeMaterial | C |
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
| world / work:mud_heap | 1 / 0 | 29 | 0 | 14152 | MeshStandardNodeMaterial |  |
| world / bedrock-ground:talus#:lod# | 1 / 2 | 177 | 0 | 13983 | bedrock:ground |  |
| quarries-detail / plain-quarries:rock:quarry_sivand | 1 / 0 | 1 | 0 | 13745 | bedrock:ground |  |
| world / work:jar | 1 / 0 | 29 | 0 | 12876 | MeshStandardNodeMaterial |  |
| world / bedrock-ground:outcrop#:lod# | 2 / 1 | 114 | 0 | 12678 | bedrock:ground |  |
| world / nr_darius_tomb | 1 / 0 | 1 | 0 | 11154 | MeshStandardNodeMaterial | C |
| world / nr_xerxes_tomb | 1 / 0 | 1 | 0 | 11154 | MeshStandardNodeMaterial | C |
| world / fire-body:hearth:stone | 1 / 0 | 5 | 0 | 11000 | MeshStandardNodeMaterial | C |
| world / apadana:limestone | 2 / 0 | 2 | 2 | 10875 | MeshStandardNodeMaterial | C |
| world / gate_nations:colossus:lamassu:lod# | 2 / 2 | 2 | 0 | 9794 | model-paint:colossus_lamassu:0:limestone_carved, model-paint:colossus_lamassu:1:limestone_carved | C |
| world / nr-life | 1 / 0 | 1 | 1 | 9792 | MeshStandardNodeMaterial | C |
| world / palace-furnishings:apadana:stored:bronze | 1 / 0 | 1 | 1 | 9440 | MeshStandardNodeMaterial | C |
| world / apadana:timber:ceiling | 1 / 0 | 1 | 1 | 9312 | MeshStandardNodeMaterial | C |
| world / settlement:water | 1 / 0 | 1 | 1 | 9148 | MeshStandardNodeMaterial | C |
| world / settlement:q_g#:far | 1 / 0 | 1 | 0 | 8980 | MeshStandardNodeMaterial | C |
| world / ledges:mid | 1 / 0 | 1 | 0 | 8390 | ledges |  |
| world / settlement:canal_banks | 1 / 0 | 1 | 0 | 7836 | MeshStandardNodeMaterial | C |
| world / crown-merlons:gate_nations|#|# | 2 / 0 | 37 | 0 | 7548 | decor:merlon:limestone_merlon | C |
| world / humans:persian:lod# | 2 / 2 | 2 | 1 | 7378 | human |  |
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
| people impostors | 1 / 0 | 1 | 0 | 2 |
| house roofs | 11 / 7 | 0 | 0 | 0 |
| house walls | 4 / 0 | 0 | 0 | 0 |
| ground fill / props | 3 / 336 | 0 | 0 | 0 |
| trees | 16 / 0 | 16 | 0 | 181066 |
| crops / flora | 24 / 39 | 136 | 135 | 10894 |
| fires / lamps | 10 / 4 | 3133 | 0 | 6266 |
| water | 10 / 6 | 4 | 1 | 274876 |
| animals | 122 / 29 | 6 | 6 | 3696 |
| terrace architecture | 118 / 229 | 927 | 0 | 1690000 |

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

people: sim out of doors within 60 m 0 (open ground 0, inside walled courts 0, walking 0; places {}; 250 m 0); crowd attached 0, skinned drawn 0 by LOD [0,0,0,0], impostors drawn 8 of 228 candidates

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
| world / people:impostors | 1 / 0 | 1 | 0 | 2 | MeshStandardNodeMaterial |  |
| world / relief:far | 0 / 58 | 0 | 0 | 0 | MeshStandardNodeMaterial | C |
| world / doors | 3 / 42 | 0 | 0 | 0 | MeshStandardNodeMaterial | C |
| plain-qanats / qanat-tile:#,-# | 0 / 15 | 0 | 0 | 0 | MeshStandardNodeMaterial | C |
| plain-qanats / qanat-tile:#,# | 0 / 14 | 0 | 0 | 0 | MeshStandardNodeMaterial | C |
| world / ford-cobbles:#:lod# | 0 / 9 | 0 | 0 | 0 | ford:cobbles |  |
| world / door-sealing:treasury:w_stores_#_E | 0 / 7 | 0 | 0 | 0 | clay-writing |  |
| world / writing:door_sealing:treasury:w_stores_#_E:pick | 0 / 7 | 0 | 0 | 0 | MeshBasicNodeMaterial |  |
| world / rain-shafts | 0 / 7 | 0 | 0 | 0 | MeshBasicNodeMaterial |  |
| world / hall#:construction:#|#|#:shaft:lod# | 7 / 7 | 0 | 0 | 0 | model:column_shaft_f40:0:limestone_carved, model:column_shaft_f40:1:limestone_carved, model:column_shaft_drums:0:limestone_carved, model:column_shaft_drums:1:limestone_carved | C |
| world / ford-steps:namaqualand_boulder_#:lod# | 0 / 6 | 0 | 0 | 0 | scan:namaqualand_boulder_02, scan:namaqualand_boulder_03, scan:namaqualand_boulder_04 |  |
| world / relief:shadow-proxy | 0 / 5 | 0 | 0 | 0 | MeshBasicNodeMaterial |  |

</details>

## fields: the approach fields, dawn (cov-196) (day 126, 5.635 h)

camera -491.3, -73.3, -12.5; sim people within 60 m: 0, within 250 m: 202; crowd stats: {"draws":4,"triangles":184590,"people":259,"byLod":[0,0,0,259],"shadowDraws":0,"shadowTriangles":0,"propDraws":3,"props":202,"propTriangles":660810,"propsDropped":0,"placeholderActs":0,"motionCapture":57,"motionAuthored":202,"things":{"draws":0,"instances":0,"triangles":0,"kinds":{},"dropped":0},"an

| class | meshes visible / hidden | instances in frustum | of them < 60 m | triangles in frustum |
|---|---|---|---|---|
| people (skinned, any LOD) | 4 / 46 | 4 | 0 | 2621 |
| people LOD3 (far) | 0 / 0 | 0 | 0 | 0 |
| people impostors | 1 / 0 | 1 | 0 | 2 |
| house roofs | 11 / 7 | 764 | 0 | 10464 |
| house walls | 4 / 0 | 18 | 1 | 1184 |
| ground fill / props | 7 / 332 | 206 | 0 | 662126 |
| trees | 16 / 0 | 16 | 0 | 181066 |
| crops / flora | 26 / 37 | 100 | 57 | 8679 |
| fires / lamps | 11 / 3 | 1553 | 0 | 57526 |
| water | 10 / 6 | 7 | 1 | 284744 |
| animals | 124 / 27 | 174 | 1 | 85420 |
| terrace architecture | 119 / 228 | 2566 | 0 | 1885484 |

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
| world / people:reins | 0 / 1 | 0 | 0 | 0 |
| world / people:hit | 0 / 1 | 1 | 0 | 0 |
| world / people:impostors | 1 / 0 | 1 | 1 | 0 |
| player-body / humans:median:lod# | 0 / 2 | 2 | 0 | 0 |

people: sim out of doors within 60 m 0 (open ground 0, inside walled courts 0, walking 0; places {}; 250 m 202); crowd attached 401, skinned drawn 259 by LOD [0,0,0,259], impostors drawn 781 of 2851 candidates

town roofs (150 m round [-448,-115]): up-facing area above 1.8 m 0 m², wall area 0 m², ratio null (0 triangles)

<details><summary>all classes (top 60 by triangles)</summary>

| object key | vis / hidden | inst in frustum | < 60 m | tris | mats | tiers |
|---|---|---|---|---|---|---|
| world / relief:figures | 9 / 3 | 927 | 0 | 1690000 | MeshStandardNodeMaterial | C |
| terrain | 208 / 0 | 76 | 3 | 712960 | MeshStandardNodeMaterial | C |
| world / treasury:arrow_bundle | 1 / 0 | 487 | 0 | 428560 | MeshStandardNodeMaterial | C |
| world / treasury:alabaster_vessel | 1 / 0 | 894 | 0 | 402300 | MeshStandardNodeMaterial | C |
| world / props:tools | 1 / 3 | 120 | 0 | 336480 | MeshStandardNodeMaterial |  |
| world / props:carried | 1 / 0 | 79 | 0 | 320424 | MeshStandardNodeMaterial |  |
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

</details>

## night: the town at night (cov-448) (day 310, 3.446 h)

camera -900.2, -1513.5, -18.1; sim people within 60 m: 77, within 250 m: 386; crowd stats: {"draws":5,"triangles":66594,"people":99,"byLod":[0,1,0,98],"shadowDraws":1,"shadowTriangles":390,"propDraws":1,"props":19,"propTriangles":24738,"propsDropped":0,"placeholderActs":0,"motionCapture":2,"motionAuthored":97,"things":{"draws":0,"instances":0,"triangles":0,"kinds":{},"dropped":0},"animals

| class | meshes visible / hidden | instances in frustum | of them < 60 m | triangles in frustum |
|---|---|---|---|---|
| people (skinned, any LOD) | 6 / 44 | 6 | 4 | 8537 |
| people LOD3 (far) | 0 / 0 | 0 | 0 | 0 |
| people impostors | 1 / 0 | 1 | 0 | 2 |
| house roofs | 13 / 5 | 10 | 4 | 2102 |
| house walls | 4 / 0 | 0 | 0 | 0 |
| ground fill / props | 80 / 259 | 142 | 71 | 56135 |
| trees | 16 / 0 | 16 | 0 | 181066 |
| crops / flora | 23 / 40 | 53 | 52 | 6912 |
| fires / lamps | 12 / 2 | 4933 | 13 | 9866 |
| water | 12 / 4 | 47 | 4 | 296864 |
| animals | 133 / 19 | 82 | 50 | 43286 |
| terrace architecture | 118 / 229 | 927 | 0 | 1690000 |

shadow-casting lights: [{"name":"","far":2000,"size":[240]}]

page: backend WebGL2, norender true, catch-up ticks 1 (still catching up: false), crowd looks pending 0

people in the frustum: within 40 m 5 of 34; within 60 m 17 of 77 (behind court walls for this eye: 17; to be drawn: 0)

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
| world / humans:child:shadow-far | 1 / 0 | 1 | 1 | 0 |
| world / humans:child:lod# | 2 / 2 | 4 | 2 | 1 |
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

people: sim out of doors within 60 m 77 (open ground 0, inside walled courts 77, walking 0; places {"h":77}; 250 m 386); crowd attached 448, skinned drawn 99 by LOD [0,1,0,98], impostors drawn 9 of 3178 candidates

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
| world / props:children | 1 / 0 | 15 | 1 | 19530 | MeshStandardNodeMaterial |  |
| plain-waterworks / works:wo_shaduf | 1 / 0 | 23 | 0 | 18492 | MeshStandardNodeMaterial | C |
| world / settlement:gardens:far | 1 / 0 | 1 | 1 | 15864 | MeshStandardNodeMaterial | C |
| world / ledges:far | 1 / 0 | 1 | 0 | 15180 | ledges |  |
| world / rock-stone:namaqualand_stones_#_v#:lod# | 10 / 0 | 38 | 38 | 14584 | scan:namaqualand_stones_01_v1, scan:namaqualand_stones_01_v2, scan:namaqualand_stones_01_v3, scan:namaqualand_stones_01_v4 |  |
| quarries-detail / plain-quarries:rock:quarry_majdabad | 1 / 0 | 1 | 0 | 13745 | bedrock:ground |  |
| world / settlement:near:stone | 1 / 0 | 1 | 0 | 13478 | MeshStandardNodeMaterial | C |
| world / animals:goat:lod# | 2 / 1 | 13 | 6 | 12740 | MeshStandardNodeMaterial |  |
| world / animals:sheep:lod# | 2 / 0 | 13 | 0 | 12740 | MeshStandardNodeMaterial |  |
| world / nr-life | 1 / 0 | 1 | 1 | 9792 | MeshStandardNodeMaterial | C |
| world / animals:dog:lod# | 1 / 0 | 10 | 4 | 9780 | MeshStandardNodeMaterial |  |
| world / settlement-doors:# | 6 / 0 | 46 | 6 | 9328 | MeshStandardNodeMaterial | C |
| world / settlement:water | 1 / 0 | 1 | 1 | 9148 | MeshStandardNodeMaterial | C |
| world / rock-stone:namaqualand_rocks_#_v#:lod# | 8 / 0 | 27 | 27 | 8643 | scan:namaqualand_rocks_01_v1, scan:namaqualand_rocks_01_v2, scan:namaqualand_rocks_01_v3, scan:namaqualand_rocks_01_v4 |  |
| world / fire | 1 / 0 | 3282 | 10 | 6564 | MeshBasicNodeMaterial |  |
| world / interiors:cloth | 1 / 0 | 1 | 0 | 6058 | MeshStandardNodeMaterial | C |
| world / humans:child:lod# | 2 / 2 | 2 | 1 | 5938 | human |  |
| world / interiors:clay | 1 / 0 | 1 | 0 | 5730 | MeshStandardNodeMaterial | C |
| Mesh | 3 / 1 | 3 | 0 | 4940 | MeshBasicNodeMaterial, NodeMaterial |  |
| world / small-snail:lod# | 2 / 0 | 30 | 30 | 4500 | life:snail |  |
| world / settlement:near:brick | 1 / 0 | 1 | 0 | 4071 | MeshStandardNodeMaterial | B/C |
| world / animals:cat:lod# | 1 / 0 | 6 | 0 | 3528 | MeshStandardNodeMaterial |  |
| world / fire:coals | 1 / 0 | 1651 | 3 | 3302 | MeshBasicNodeMaterial |  |
| Points | 1 / 0 | 1 | 0 | 2973 | PointsNodeMaterial |  |
| world / flora-thistle:model:lod# | 2 / 0 | 33 | 33 | 2838 | life:thistle |  |
| world / fill:wo_dung_cakes:dung:lod# | 2 / 1 | 22 | 10 | 2400 | MeshStandardNodeMaterial | C |
| plain-waterworks / works:wo_pontoon | 1 / 0 | 7 | 0 | 2352 | MeshStandardNodeMaterial | C |
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

</details>

## night_terrace: the Terrace at 22:30 (sb-night-terrace) (day 5, 22.5 h)

camera 0, 92, 1.6; sim people within 60 m: 98, within 250 m: 504; crowd stats: {"draws":11,"triangles":2297201,"people":400,"byLod":[48,29,0,323],"shadowDraws":6,"shadowTriangles":143396,"propDraws":4,"props":223,"propTriangles":742440,"propsDropped":0,"placeholderActs":0,"motionCapture":201,"motionAuthored":199,"things":{"draws":8,"instances":38,"triangles":55968,"kinds":{"wa

| class | meshes visible / hidden | instances in frustum | of them < 60 m | triangles in frustum |
|---|---|---|---|---|
| people (skinned, any LOD) | 17 / 33 | 13 | 6 | 65405 |
| people LOD3 (far) | 0 / 0 | 0 | 0 | 0 |
| people impostors | 1 / 0 | 1 | 0 | 2 |
| house roofs | 13 / 5 | 1138 | 131 | 14952 |
| house walls | 4 / 0 | 1 | 1 | 300 |
| ground fill / props | 20 / 319 | 231 | 4 | 744215 |
| trees | 16 / 0 | 16 | 0 | 181066 |
| crops / flora | 19 / 44 | 74 | 0 | 8216 |
| fires / lamps | 11 / 3 | 4791 | 12 | 88678 |
| water | 13 / 3 | 6 | 3 | 276908 |
| animals | 124 / 28 | 75 | 0 | 73500 |
| terrace architecture | 124 / 223 | 4253 | 951 | 2357375 |

shadow-casting lights: [{"name":"","far":2000,"size":[240]}]

page: backend WebGL2, norender true, catch-up ticks 0 (still catching up: false), crowd looks pending 0

people in the frustum: within 40 m 47 of 92; within 60 m 47 of 98 (behind court walls for this eye: 0; to be drawn: 47)

| people mesh | visible / hidden meshes | instances (count) | in frustum | < 60 m |
|---|---|---|---|---|
| world / humans:persian:shadow | 0 / 1 | 1 | 0 | 0 |
| world / humans:persian:shadow-far | 0 / 1 | 1 | 0 | 0 |
| world / humans:persian:lod# | 1 / 3 | 4 | 1 | 0 |
| world / humans:median:shadow | 1 / 0 | 1 | 0 | 0 |
| world / humans:median:shadow-far | 0 / 1 | 1 | 0 | 0 |
| world / humans:median:lod# | 2 / 2 | 4 | 1 | 0 |
| world / humans:worker:shadow | 0 / 1 | 1 | 0 | 0 |
| world / humans:worker:shadow-far | 1 / 0 | 1 | 1 | 0 |
| world / humans:worker:lod# | 2 / 2 | 4 | 2 | 1 |
| world / humans:woman:shadow | 0 / 1 | 1 | 0 | 0 |
| world / humans:woman:shadow-far | 1 / 0 | 1 | 1 | 0 |
| world / humans:woman:lod# | 2 / 2 | 4 | 2 | 1 |
| world / humans:child:shadow | 0 / 1 | 1 | 0 | 0 |
| world / humans:child:shadow-far | 0 / 1 | 1 | 0 | 0 |
| world / humans:child:lod# | 1 / 3 | 4 | 1 | 0 |
| world / humans:envoy:shadow | 1 / 0 | 1 | 1 | 1 |
| world / humans:envoy:shadow-far | 1 / 0 | 1 | 1 | 1 |
| world / humans:envoy:lod# | 2 / 2 | 4 | 2 | 2 |
| world / humans:envoy_short:shadow | 1 / 0 | 1 | 0 | 0 |
| world / humans:envoy_short:shadow-far | 0 / 1 | 1 | 0 | 0 |
| world / humans:envoy_short:lod# | 1 / 3 | 4 | 0 | 0 |
| world / humans:envoy_bare:shadow | 0 / 1 | 1 | 0 | 0 |
| world / humans:envoy_bare:shadow-far | 0 / 1 | 1 | 0 | 0 |
| world / humans:envoy_bare:lod# | 0 / 4 | 4 | 0 | 0 |
| world / people:reins | 0 / 1 | 0 | 0 | 0 |
| world / people:hit | 0 / 1 | 1 | 0 | 0 |
| world / people:impostors | 1 / 0 | 1 | 1 | 0 |
| player-body / humans:median:lod# | 0 / 2 | 2 | 0 | 0 |

people: sim out of doors within 60 m 98 (open ground 90, inside walled courts 0, walking 0; places {"palaces":1,"forecourt_wait":88,"stair_foot":1}; 250 m 504); crowd attached 400, skinned drawn 400 by LOD [48,29,0,323], impostors drawn 1429 of 3414 candidates

town roofs (150 m round [0,32]): up-facing area above 1.8 m 0 m², wall area 0 m², ratio null (0 triangles)

<details><summary>all classes (top 60 by triangles)</summary>

| object key | vis / hidden | inst in frustum | < 60 m | tris | mats | tiers |
|---|---|---|---|---|---|---|
| world / relief:figures | 9 / 3 | 927 | 0 | 1690000 | MeshStandardNodeMaterial | C |
| terrain | 208 / 0 | 85 | 2 | 963840 | MeshStandardNodeMaterial | C |
| world / props:carried | 1 / 0 | 99 | 0 | 401544 | MeshStandardNodeMaterial |  |
| world / treasury:arrow_bundle | 1 / 0 | 446 | 0 | 392480 | MeshStandardNodeMaterial | C |
| world / treasury:alabaster_vessel | 1 / 0 | 824 | 0 | 370800 | MeshStandardNodeMaterial | C |
| world / settlement:q_s#:far | 4 / 0 | 4 | 0 | 367500 | MeshStandardNodeMaterial | C |
| world / props:tools | 2 / 2 | 123 | 0 | 339594 | MeshStandardNodeMaterial |  |
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
| world / humans:envoy:lod# | 2 / 2 | 2 | 2 | 44739 | human |  |
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

</details>

