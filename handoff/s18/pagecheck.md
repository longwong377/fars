# Page check (D-772): what the page draws vs what its simulation holds

Tree /home/user/fars-pc gitdir: /home/user/fars/.git/worktrees/fars-pc; built site (vite build, base /fars/), headless Chromium, ?test&norender&webgl=1&quality=test&court=seasonal; 2026-10-03T07:50:30.822Z.
Per view: objects effectively visible (every ancestor visible) and meeting the camera frustum, their instances and triangles;
hidden = present in the scene but visible=false somewhere up the chain. sim<60 m = population view + detailed agents within 60 m of the camera.

## Run 5 (C12, s17-int 409bf63c: C5's HumanGPU pre-grow, C13's banquet, C1's fields; clock running 2 s before counting; 2026-10-03 ~08:15 UTC)

**No flags.** Out of doors within 60 m, against run 4:

| view | run 4 | run 5 | notes |
|---|---|---|---|
| q_s1 lane | 201 | 232 | 40 on the lane, 86 at workshops; 306 skinned drawn |
| court cov-037 | 60 | 106 | 30 on the lane; 137 skinned drawn |
| Terrace noon (no court) | 19 | 28 | work_hearth 9, worksite 3; 139 skinned drawn |
| Terrace court day | 83 | 88 | 249 skinned drawn |
| Apadana d200 | 146 | 104 | apadana_hall 58, forecourt_wait 44 (still off-season: question to C13 open) |
| night Terrace 22:30 | 98 | 54 | forecourt_wait 44 at night (question to C13 open) |
| lanes cov-142 13:48 | 144 | 144 | still all 'h' (at home): 33 on doorsteps, 111 in courts, 0 walking |
| fields at dawn | 0 | 0 | 150 within 250 m |

New observations:
- **Walkers are now counted with the clock running, and they are rare everywhere:** 1 at q_s1 at 10:00, 5 on the Terrace at noon, 0 in every town view. People sit, stand and work, but nobody goes anywhere at the moments sampled. For a busy city that is the next gap after the lanes (C1: errands; C5: the view's walks).
- **The crowd's attach cap is saturated in two views:** at the fields (attached 401, skinned 400, all LOD3) and the night Terrace (400). POOL_MAX 400 is full there, so in a busier scene far people may take the slots of near ones (C5).

## After run 5: C13's answer (07:54): the Apadana and night forecourt counts are a time-jump fault

- C13 checked in node (seed 1): no plan holds anyone at 'apadana_hall' or 'forecourt_wait' on day 200 at 08:48 or day 5 at
  22:30. The residence is days 14-117.
- The page shows them because the views share one load: day 200 comes right after the day-40 court view. People the view
  placed before a setTime jump stay at their places after it, even with sim.catchingUp false.
- Sent to C5 (popview) and C1 (the jump).
- Until it is fixed, pagecheck's counts at a view that follows a jump across the residence can carry stale people (the
  Apadana and night-Terrace rows of runs 4 and 5).

## Flags

- none

Page errors (unique): 1
- 1x Failed to load resource: the server responded with a status of 404 (Not Found)

## town20: the town from 20 m up (roofs vs walls) (day 88, 13.805 h)

camera -871.9, -150.4, 4.4; sim people within 60 m: 144, within 250 m: 651; crowd stats: {"draws":3,"triangles":12114,"people":3,"byLod":[0,2,0,1],"shadowDraws":2,"shadowTriangles":1089,"propDraws":1,"props":1,"propTriangles":4056,"propsDropped":0,"placeholderActs":0,"motionCapture":1,"motionAuthored":2,"things":{"draws":0,"instances":0,"triangles":0,"kinds":{},"dropped":0},"animals":{"

| class | meshes visible / hidden | instances in frustum | of them < 60 m | triangles in frustum |
|---|---|---|---|---|
| people (skinned, any LOD) | 5 / 45 | 1 | 0 | 699 |
| people LOD3 (far) | 0 / 0 | 0 | 0 | 0 |
| people impostors | 1 / 0 | 1 | 0 | 2 |
| house roofs | 13 / 5 | 0 | 0 | 0 |
| house walls | 4 / 0 | 1 | 1 | 300 |
| ground fill / props | 109 / 230 | 5 | 0 | 32072 |
| trees | 16 / 0 | 16 | 0 | 181066 |
| crops / flora | 25 / 38 | 5 | 0 | 2034 |
| fires / lamps | 13 / 1 | 2351 | 0 | 4702 |
| water | 12 / 4 | 4 | 1 | 274866 |
| animals | 129 / 12 | 123 | 0 | 85132 |
| terrace architecture | 118 / 219 | 927 | 0 | 1690000 |

shadow-casting lights: [{"name":"","far":2000,"size":[240]}]

page: backend WebGL2, norender true, catch-up ticks 0 (still catching up: false), crowd looks pending 0

people in the frustum: within 40 m 0 of 61; within 60 m 0 of 144 (behind court walls for this eye: 0; to be drawn: 0)

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
| world / humans:woman:lod# | 2 / 2 | 4 | 1 | 0 |
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

people: sim out of doors within 60 m 144 (open ground 33, inside walled courts 111, walking 0; places {"h":144}; 250 m 651); crowd attached 419, skinned drawn 3 by LOD [0,2,0,1], impostors drawn 78 of 579 candidates

town roofs (150 m round [-852,-196]): up-facing area above 1.8 m 20945 m², wall area 83409 m², ratio 0.251 (210179 triangles)

<details><summary>all classes (top 60 by triangles)</summary>

| object key | vis / hidden | inst in frustum | < 60 m | tris | mats | tiers |
|---|---|---|---|---|---|---|
| world / relief:figures | 9 / 3 | 927 | 0 | 1690000 | MeshStandardNodeMaterial | C |
| terrain | 208 / 0 | 71 | 1 | 765952 | MeshStandardNodeMaterial | C |
| world / settlement:q_s#:far | 4 / 0 | 4 | 0 | 309062 | MeshStandardNodeMaterial | C |
| world / plain-orchards-far | 1 / 0 | 1 | 0 | 176772 | MeshStandardNodeMaterial |  |
| world / river-banks | 1 / 0 | 1 | 0 | 159880 | MeshStandardNodeMaterial | C |
| world / settlement:q_w#:far | 3 / 0 | 1 | 1 | 120848 | MeshStandardNodeMaterial | C |
| world / settlement:near:plaster | 1 / 0 | 1 | 0 | 92518 | MeshStandardNodeMaterial | C |
| world / settlement:ground | 1 / 0 | 1 | 1 | 88536 | MeshStandardNodeMaterial | C |
| world / plain-stone | 1 / 0 | 1 | 1 | 84008 | MeshStandardNodeMaterial | C |
| world / plain-tracks | 1 / 0 | 1 | 0 | 75768 | MeshStandardNodeMaterial | C |
| world / plain-villages--#,-# | 2 / 0 | 1 | 0 | 58588 | MeshStandardNodeMaterial | C |
| world / plain-canal-banks | 1 / 0 | 1 | 0 | 55524 | MeshStandardNodeMaterial | C |
| world / settlement:near:timber | 1 / 0 | 1 | 0 | 53210 | MeshStandardNodeMaterial | C |
| world / river-water | 1 / 0 | 1 | 0 | 50324 | MeshStandardNodeMaterial |  |
| world / animals:sheep:lod# | 2 / 0 | 46 | 0 | 45080 | MeshStandardNodeMaterial |  |
| world / settlement:near:items | 1 / 0 | 1 | 0 | 40299 | MeshStandardNodeMaterial | C |
| world / interiors:cloth | 1 / 0 | 1 | 0 | 37403 | MeshStandardNodeMaterial | C |
| world / plain-villages-#,# | 2 / 0 | 1 | 1 | 35002 | MeshStandardNodeMaterial | C |
| world / animals:goat:lod# | 2 / 0 | 34 | 0 | 33320 | MeshStandardNodeMaterial |  |
| world / settlement:gardens:far | 1 / 0 | 1 | 1 | 31796 | MeshStandardNodeMaterial | C |
| world / ledges:far | 1 / 0 | 1 | 0 | 28850 | ledges |  |
| plain-qanats / qanat-tile:#,-# | 2 / 13 | 318 | 0 | 28620 | MeshStandardNodeMaterial | C |
| world / settlement:near:props | 1 / 0 | 1 | 0 | 26180 | MeshStandardNodeMaterial | C |
| world / settlement:refuse | 1 / 0 | 1 | 1 | 21888 | MeshStandardNodeMaterial | C |
| world / settlement:roads | 1 / 0 | 1 | 1 | 20956 | MeshStandardNodeMaterial | C |
| world / settlement:near:stone | 1 / 0 | 1 | 0 | 15432 | MeshStandardNodeMaterial | C |
| world / interiors:clay | 1 / 0 | 1 | 0 | 12332 | MeshStandardNodeMaterial | C |
| world / nr-life | 1 / 0 | 1 | 1 | 9792 | MeshStandardNodeMaterial | C |
| world / settlement:water | 1 / 0 | 1 | 1 | 9138 | MeshStandardNodeMaterial | C |
| world / bird-chukar:stand# | 2 / 0 | 24 | 0 | 4224 | life:chukar |  |
| world / props:carried | 1 / 0 | 1 | 0 | 4056 | MeshStandardNodeMaterial |  |
| world / fire | 1 / 0 | 1798 | 0 | 3596 | MeshBasicNodeMaterial |  |
| world / rock-boulder:namaqualand_boulder_#:lod# | 10 / 0 | 8 | 1 | 3048 | scan:namaqualand_boulder_02, scan:namaqualand_boulder_03, scan:namaqualand_boulder_04, scan:namaqualand_boulder_05 |  |
| Points | 1 / 0 | 1 | 0 | 2973 | PointsNodeMaterial |  |
| world / court-camps:ridge:shell | 1 / 0 | 179 | 0 | 2864 | MeshStandardNodeMaterial | C |
| world / settlement:q_b#:far | 1 / 0 | 1 | 0 | 2246 | MeshStandardNodeMaterial | C |
| world / settlement:near:brick | 1 / 0 | 1 | 0 | 2103 | MeshStandardNodeMaterial | B/C |
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
| world / fire:coals | 1 / 0 | 553 | 0 | 1106 | MeshBasicNodeMaterial |  |
| Mesh | 2 / 2 | 2 | 0 | 972 | MeshBasicNodeMaterial, NodeMaterial |  |
| plain-works / works:quern | 1 / 0 | 8 | 0 | 960 | MeshStandardNodeMaterial | C |
| world / settlement:trees-wood-lod# | 2 / 0 | 2 | 0 | 896 | MeshStandardNodeMaterial |  |
| world / plain-trees-wood-lod# | 2 / 0 | 2 | 0 | 896 | MeshStandardNodeMaterial |  |
| world / settlement:trees-leaves-lod# | 2 / 0 | 2 | 0 | 880 | MeshStandardNodeMaterial |  |
| world / plain-trees-leaves-lod# | 2 / 0 | 2 | 0 | 880 | MeshStandardNodeMaterial |  |
| plain-works / works:oven | 1 / 0 | 3 | 0 | 780 | MeshStandardNodeMaterial | C |
| world / humans:woman:lod# | 2 / 2 | 1 | 0 | 699 | human |  |
| world / rock-boulder:rock_face_#:lod# | 2 / 0 | 1 | 1 | 500 | scan:rock_face_02 |  |
| world / bird-crow:fly# | 3 / 0 | 5 | 0 | 300 | life:crow |  |
| plain-works / works-walls | 1 / 0 | 1 | 1 | 300 | MeshStandardNodeMaterial | B/C |
| plain-works / works:wo_press | 1 / 0 | 1 | 0 | 292 | MeshStandardNodeMaterial | C |

</details>

## lanes: a town lane, afternoon (cov-142) (day 88, 13.805 h)

camera -871.9, -150.4, -14; sim people within 60 m: 144, within 250 m: 1069; crowd stats: {"draws":3,"triangles":2508,"people":4,"byLod":[0,0,0,4],"shadowDraws":0,"shadowTriangles":0,"propDraws":1,"props":1,"propTriangles":4056,"propsDropped":0,"placeholderActs":0,"motionCapture":1,"motionAuthored":3,"things":{"draws":0,"instances":0,"triangles":0,"kinds":{},"dropped":0},"animals":{"draw

| class | meshes visible / hidden | instances in frustum | of them < 60 m | triangles in frustum |
|---|---|---|---|---|
| people (skinned, any LOD) | 3 / 47 | 3 | 3 | 1809 |
| people LOD3 (far) | 0 / 0 | 0 | 0 | 0 |
| people impostors | 1 / 0 | 1 | 0 | 2 |
| house roofs | 13 / 5 | 0 | 0 | 0 |
| house walls | 4 / 0 | 1 | 1 | 300 |
| ground fill / props | 109 / 230 | 48 | 42 | 38361 |
| trees | 16 / 0 | 16 | 0 | 181066 |
| crops / flora | 25 / 38 | 6 | 0 | 2646 |
| fires / lamps | 13 / 1 | 2489 | 4 | 4978 |
| water | 12 / 4 | 4 | 1 | 274866 |
| animals | 130 / 12 | 123 | 1 | 90835 |
| terrace architecture | 118 / 219 | 927 | 0 | 1690000 |

shadow-casting lights: [{"name":"","far":2000,"size":[240]}]

page: backend WebGL2, norender true, catch-up ticks 0 (still catching up: false), crowd looks pending 0

people in the frustum: within 40 m 2 of 61; within 60 m 2 of 144 (behind court walls for this eye: 2; to be drawn: 0)

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

people: sim out of doors within 60 m 144 (open ground 33, inside walled courts 111, walking 0; places {"h":144}; 250 m 1069); crowd attached 421, skinned drawn 4 by LOD [0,0,0,4], impostors drawn 133 of 1070 candidates

town roofs (150 m round [-811,-287]): up-facing area above 1.8 m 1098 m², wall area 4661 m², ratio 0.236 (23046 triangles)

<details><summary>all classes (top 60 by triangles)</summary>

| object key | vis / hidden | inst in frustum | < 60 m | tris | mats | tiers |
|---|---|---|---|---|---|---|
| world / relief:figures | 9 / 3 | 927 | 0 | 1690000 | MeshStandardNodeMaterial | C |
| terrain | 208 / 0 | 74 | 2 | 775680 | MeshStandardNodeMaterial | C |
| world / settlement:q_s#:far | 4 / 0 | 4 | 0 | 309062 | MeshStandardNodeMaterial | C |
| world / plain-orchards-far | 1 / 0 | 1 | 0 | 176772 | MeshStandardNodeMaterial |  |
| world / river-banks | 1 / 0 | 1 | 0 | 159880 | MeshStandardNodeMaterial | C |
| world / settlement:q_w#:far | 3 / 0 | 1 | 1 | 120848 | MeshStandardNodeMaterial | C |
| world / settlement:near:plaster | 1 / 0 | 1 | 0 | 92518 | MeshStandardNodeMaterial | C |
| world / settlement:ground | 1 / 0 | 1 | 1 | 88536 | MeshStandardNodeMaterial | C |
| world / plain-stone | 1 / 0 | 1 | 1 | 84008 | MeshStandardNodeMaterial | C |
| world / plain-tracks | 1 / 0 | 1 | 0 | 75768 | MeshStandardNodeMaterial | C |
| world / plain-villages--#,-# | 2 / 0 | 1 | 0 | 58588 | MeshStandardNodeMaterial | C |
| world / plain-canal-banks | 1 / 0 | 1 | 0 | 55524 | MeshStandardNodeMaterial | C |
| world / settlement:near:timber | 1 / 0 | 1 | 0 | 53210 | MeshStandardNodeMaterial | C |
| world / river-water | 1 / 0 | 1 | 0 | 50324 | MeshStandardNodeMaterial |  |
| world / animals:sheep:lod# | 2 / 0 | 46 | 0 | 45080 | MeshStandardNodeMaterial |  |
| world / settlement:near:items | 1 / 0 | 1 | 0 | 40299 | MeshStandardNodeMaterial | C |
| world / interiors:cloth | 1 / 0 | 1 | 0 | 37403 | MeshStandardNodeMaterial | C |
| world / plain-villages-#,# | 2 / 0 | 1 | 1 | 35002 | MeshStandardNodeMaterial | C |
| world / animals:goat:lod# | 2 / 0 | 34 | 0 | 33320 | MeshStandardNodeMaterial |  |
| world / settlement:gardens:far | 1 / 0 | 1 | 1 | 31796 | MeshStandardNodeMaterial | C |
| world / ledges:far | 1 / 0 | 1 | 0 | 28850 | ledges |  |
| plain-qanats / qanat-tile:#,-# | 2 / 13 | 318 | 0 | 28620 | MeshStandardNodeMaterial | C |
| world / settlement:near:props | 1 / 0 | 1 | 0 | 26180 | MeshStandardNodeMaterial | C |
| world / settlement:refuse | 1 / 0 | 1 | 1 | 21888 | MeshStandardNodeMaterial | C |
| world / settlement:roads | 1 / 0 | 1 | 1 | 20956 | MeshStandardNodeMaterial | C |
| world / settlement:near:stone | 1 / 0 | 1 | 0 | 15432 | MeshStandardNodeMaterial | C |
| world / interiors:clay | 1 / 0 | 1 | 0 | 12332 | MeshStandardNodeMaterial | C |
| world / nr-life | 1 / 0 | 1 | 1 | 9792 | MeshStandardNodeMaterial | C |
| world / settlement:water | 1 / 0 | 1 | 1 | 9138 | MeshStandardNodeMaterial | C |
| world / animals:donkey:lod# | 3 / 0 | 1 | 1 | 5879 | MeshStandardNodeMaterial |  |
| world / bird-chukar:stand# | 2 / 0 | 24 | 0 | 4224 | life:chukar |  |
| world / props:carried | 1 / 0 | 1 | 0 | 4056 | MeshStandardNodeMaterial |  |
| world / fire | 1 / 0 | 1898 | 3 | 3796 | MeshBasicNodeMaterial |  |
| world / rock-boulder:namaqualand_boulder_#:lod# | 10 / 0 | 8 | 2 | 3048 | scan:namaqualand_boulder_02, scan:namaqualand_boulder_03, scan:namaqualand_boulder_04, scan:namaqualand_boulder_05 |  |
| Points | 1 / 0 | 1 | 0 | 2973 | PointsNodeMaterial |  |
| world / court-camps:ridge:shell | 1 / 0 | 179 | 0 | 2864 | MeshStandardNodeMaterial | C |
| plain-field-fill / field:fill_stall_reed:lod# | 1 / 1 | 4 | 0 | 2448 | MeshStandardNodeMaterial | C |
| world / settlement:q_b#:far | 1 / 0 | 1 | 0 | 2246 | MeshStandardNodeMaterial | C |
| world / settlement:near:brick | 1 / 0 | 1 | 0 | 2103 | MeshStandardNodeMaterial | B/C |
| plain-works / works:wo_hurdles | 1 / 0 | 3 | 0 | 2034 | MeshStandardNodeMaterial | C |
| plain-works / works:jar_store | 1 / 0 | 22 | 0 | 1980 | MeshStandardNodeMaterial | C |
| plain-works / works:vat | 1 / 0 | 6 | 0 | 1800 | MeshStandardNodeMaterial | C |
| world / settlement:burial_ground_town:stone | 1 / 0 | 1 | 0 | 1740 | MeshStandardNodeMaterial | C |
| world / fauna:camp-lines:t_west | 1 / 0 | 1 | 0 | 1720 | MeshStandardNodeMaterial |  |
| plain-works / works:sack | 1 / 0 | 14 | 0 | 1596 | MeshStandardNodeMaterial | C |
| world / court-camps:black:shell | 1 / 0 | 111 | 0 | 1554 | MeshStandardNodeMaterial | C |
| plain-works / works:manger | 1 / 0 | 4 | 0 | 1480 | MeshStandardNodeMaterial | C |
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
| world / fill:wo_spoil:earth:lod# | 1 / 2 | 4 | 4 | 704 | MeshStandardNodeMaterial | C |
| world / humans:woman:lod# | 1 / 3 | 1 | 1 | 699 | human |  |

</details>

## qs1: a q_s1 lane on the road south at day 0, 10:00 (cov-381's spot) (day 0, 10 h)

camera -397, -894.7, -16.2; sim people within 60 m: 232, within 250 m: 735; crowd stats: {"draws":11,"triangles":898134,"people":306,"byLod":[12,61,0,233],"shadowDraws":7,"shadowTriangles":58084,"propDraws":4,"props":225,"propTriangles":788340,"propsDropped":0,"placeholderActs":0,"motionCapture":114,"motionAuthored":192,"things":{"draws":16,"instances":215,"triangles":650744,"kinds":{"l

| class | meshes visible / hidden | instances in frustum | of them < 60 m | triangles in frustum |
|---|---|---|---|---|
| people (skinned, any LOD) | 18 / 32 | 16 | 16 | 101486 |
| people LOD3 (far) | 0 / 0 | 0 | 0 | 0 |
| people impostors | 1 / 0 | 1 | 0 | 2 |
| house roofs | 13 / 5 | 12 | 2 | 3324 |
| house walls | 4 / 0 | 1 | 1 | 300 |
| ground fill / props | 118 / 221 | 712 | 307 | 897577 |
| trees | 16 / 0 | 16 | 0 | 181066 |
| crops / flora | 26 / 37 | 23 | 11 | 4738 |
| fires / lamps | 13 / 1 | 3919 | 55 | 8278 |
| water | 13 / 3 | 54 | 18 | 281162 |
| animals | 132 / 12 | 244 | 35 | 161114 |
| terrace architecture | 118 / 219 | 927 | 0 | 1690000 |

shadow-casting lights: [{"name":"","far":2000,"size":[240]}]

page: backend WebGL2, norender true, catch-up ticks 0 (still catching up: false), crowd looks pending 0

people in the frustum: within 40 m 60 of 108; within 60 m 114 of 232 (behind court walls for this eye: 70; to be drawn: 44)

| people mesh | visible / hidden meshes | instances (count) | in frustum | < 60 m |
|---|---|---|---|---|
| world / humans:persian:shadow | 0 / 1 | 1 | 0 | 0 |
| world / humans:persian:shadow-far | 0 / 1 | 1 | 0 | 0 |
| world / humans:persian:lod# | 0 / 4 | 4 | 0 | 0 |
| world / humans:median:shadow | 0 / 1 | 1 | 0 | 0 |
| world / humans:median:shadow-far | 1 / 0 | 1 | 1 | 1 |
| world / humans:median:lod# | 2 / 2 | 4 | 2 | 2 |
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

people: sim out of doors within 60 m 232 (open ground 93, inside walled courts 139, walking 1; places {"h":95,"lane":40,"ws":86,"(walking)":1,"well":1,"ws_textile":9}; 250 m 735); crowd attached 447, skinned drawn 306 by LOD [12,61,0,233], impostors drawn 196 of 1925 candidates

town roofs (150 m round [-455,-1033]): up-facing area above 1.8 m 25956 m², wall area 95175 m², ratio 0.273 (199185 triangles)

<details><summary>all classes (top 60 by triangles)</summary>

| object key | vis / hidden | inst in frustum | < 60 m | tris | mats | tiers |
|---|---|---|---|---|---|---|
| world / relief:figures | 9 / 3 | 927 | 0 | 1690000 | MeshStandardNodeMaterial | C |
| terrain | 208 / 0 | 55 | 3 | 740608 | MeshStandardNodeMaterial | C |
| world / props:carried | 1 / 0 | 144 | 58 | 584064 | MeshStandardNodeMaterial |  |
| world / work:loom | 1 / 0 | 156 | 26 | 564720 | MeshStandardNodeMaterial |  |
| world / settlement:q_s#:far | 4 / 0 | 3 | 1 | 239846 | MeshStandardNodeMaterial | C |
| world / settlement:near:plaster | 1 / 0 | 1 | 0 | 190069 | MeshStandardNodeMaterial | C |
| world / props:tools | 2 / 2 | 68 | 25 | 181842 | MeshStandardNodeMaterial |  |
| world / plain-orchards-far | 1 / 0 | 1 | 0 | 176772 | MeshStandardNodeMaterial |  |
| world / river-banks | 1 / 0 | 1 | 0 | 159880 | MeshStandardNodeMaterial | C |
| world / plain-villages--#,-# | 2 / 0 | 2 | 0 | 142112 | MeshStandardNodeMaterial | C |
| world / settlement:near:timber | 1 / 0 | 1 | 0 | 122887 | MeshStandardNodeMaterial | C |
| world / animals:hen:lod# | 1 / 0 | 157 | 17 | 98282 | MeshStandardNodeMaterial |  |
| world / settlement:near:items | 1 / 0 | 1 | 0 | 88724 | MeshStandardNodeMaterial | C |
| world / settlement:ground | 1 / 0 | 1 | 1 | 88536 | MeshStandardNodeMaterial | C |
| world / plain-stone | 1 / 0 | 1 | 1 | 84008 | MeshStandardNodeMaterial | C |
| world / plain-tracks | 1 / 0 | 1 | 0 | 75768 | MeshStandardNodeMaterial | C |
| world / plain-villages--#,# | 4 / 0 | 1 | 0 | 67086 | MeshStandardNodeMaterial | C |
| world / work:beam | 1 / 0 | 24 | 7 | 56736 | MeshStandardNodeMaterial |  |
| world / plain-canal-banks | 1 / 0 | 1 | 0 | 55524 | MeshStandardNodeMaterial | C |
| world / river-water | 1 / 0 | 1 | 0 | 50324 | MeshStandardNodeMaterial |  |
| world / settlement:near:props | 1 / 0 | 1 | 0 | 49361 | MeshStandardNodeMaterial | C |
| world / interiors:cloth | 1 / 0 | 1 | 0 | 47241 | MeshStandardNodeMaterial | C |
| world / humans:woman:lod# | 3 / 1 | 3 | 3 | 43848 | human |  |
| world / humans:child:lod# | 3 / 1 | 3 | 3 | 36304 | human |  |
| world / plain-villages-#,# | 2 / 0 | 1 | 1 | 35002 | MeshStandardNodeMaterial | C |
| world / ledges:far | 1 / 0 | 1 | 0 | 33710 | ledges |  |
| world / settlement:gardens:far | 1 / 0 | 1 | 1 | 31796 | MeshStandardNodeMaterial | C |
| world / settlement:near:stone | 1 / 0 | 1 | 0 | 29820 | MeshStandardNodeMaterial | C |
| world / settlement-doors:# | 6 / 0 | 126 | 17 | 24948 | MeshStandardNodeMaterial | C |
| world / settlement:refuse | 1 / 0 | 1 | 1 | 21888 | MeshStandardNodeMaterial | C |
| world / settlement:roads | 1 / 0 | 1 | 1 | 20956 | MeshStandardNodeMaterial | C |
| world / animals:goat:lod# | 3 / 0 | 16 | 10 | 15680 | MeshStandardNodeMaterial |  |
| world / animals:dog:lod# | 1 / 0 | 16 | 1 | 15648 | MeshStandardNodeMaterial |  |
| world / props:children | 1 / 0 | 11 | 4 | 14322 | MeshStandardNodeMaterial |  |
| world / interiors:clay | 1 / 0 | 1 | 0 | 13722 | MeshStandardNodeMaterial | C |
| world / animals:cock:lod# | 1 / 0 | 19 | 2 | 11894 | MeshStandardNodeMaterial |  |
| world / animals:donkey:lod# | 3 / 0 | 6 | 3 | 11754 | MeshStandardNodeMaterial |  |
| world / nr-life | 1 / 0 | 1 | 1 | 9792 | MeshStandardNodeMaterial | C |
| world / settlement:water | 1 / 0 | 1 | 1 | 9138 | MeshStandardNodeMaterial | C |
| world / humans:worker:lod# | 3 / 1 | 2 | 2 | 7581 | human |  |
| world / humans:median:lod# | 2 / 2 | 2 | 2 | 6603 | human |  |
| world / work:toy_wheeled | 1 / 0 | 4 | 0 | 6488 | MeshStandardNodeMaterial |  |
| world / fill:jar_water:clay:lod# | 3 / 0 | 50 | 17 | 6296 | MeshStandardNodeMaterial | C |
| world / animals:cat:lod# | 1 / 0 | 10 | 2 | 5880 | MeshStandardNodeMaterial |  |
| world / fill:wo_dung_cakes:dung:lod# | 2 / 1 | 54 | 9 | 5600 | MeshStandardNodeMaterial | C |
| world / settlement:near:brick | 1 / 0 | 1 | 0 | 5466 | MeshStandardNodeMaterial | B/C |
| world / fire | 1 / 0 | 2715 | 33 | 5430 | MeshBasicNodeMaterial |  |
| world / fill:mat:matting:lod# | 2 / 1 | 32 | 6 | 4940 | MeshStandardNodeMaterial | C |
| world / fill:fill_bundle:wood:lod# | 2 / 1 | 12 | 12 | 4248 | MeshStandardNodeMaterial | C |
| world / work:knucklebones | 1 / 0 | 15 | 6 | 4200 | MeshStandardNodeMaterial |  |
| world / fill:fill_line:cloth_a:lod# | 2 / 1 | 31 | 7 | 3720 | MeshStandardNodeMaterial | C |
| world / fill:jar_store:clay:lod# | 2 / 1 | 41 | 9 | 3690 | MeshStandardNodeMaterial | C |
| world / road-litter | 1 / 0 | 15 | 15 | 3120 | MeshStandardNodeMaterial |  |
| world / fill:fill_line:cloth_b:lod# | 2 / 1 | 31 | 7 | 3100 | MeshStandardNodeMaterial | C |
| Points | 1 / 0 | 1 | 0 | 2973 | PointsNodeMaterial |  |
| world / roofwear:drip_jar:clay | 1 / 0 | 6 | 1 | 2664 | MeshStandardNodeMaterial | C |
| world / fill:fill_stall:cloth:lod# | 3 / 0 | 1 | 1 | 2600 | MeshStandardNodeMaterial | C |
| world / humans:woman:shadow | 1 / 0 | 1 | 1 | 2568 | human |  |
| world / fill:sack:cloth:lod# | 3 / 0 | 8 | 8 | 2490 | MeshStandardNodeMaterial | C |
| world / fill:fill_stall:wood:lod# | 3 / 0 | 1 | 1 | 2396 | MeshStandardNodeMaterial | C |

</details>

## court: a town court, noon (cov-037) (day 14, 11.07 h)

camera -535.4, 401.1, -12; sim people within 60 m: 106, within 250 m: 451; crowd stats: {"draws":10,"triangles":326887,"people":137,"byLod":[4,20,0,113],"shadowDraws":5,"shadowTriangles":18512,"propDraws":3,"props":60,"propTriangles":206024,"propsDropped":0,"placeholderActs":0,"motionCapture":68,"motionAuthored":69,"things":{"draws":11,"instances":32,"triangles":30648,"kinds":{"beam":2

| class | meshes visible / hidden | instances in frustum | of them < 60 m | triangles in frustum |
|---|---|---|---|---|
| people (skinned, any LOD) | 15 / 35 | 15 | 12 | 95573 |
| people LOD3 (far) | 0 / 0 | 0 | 0 | 0 |
| people impostors | 1 / 0 | 1 | 0 | 2 |
| house roofs | 13 / 5 | 10 | 7 | 2436 |
| house walls | 4 / 0 | 1 | 1 | 300 |
| ground fill / props | 109 / 230 | 352 | 250 | 284666 |
| trees | 16 / 0 | 16 | 0 | 181066 |
| crops / flora | 25 / 38 | 55 | 9 | 7544 |
| fires / lamps | 13 / 1 | 2994 | 59 | 7614 |
| water | 13 / 3 | 93 | 22 | 360866 |
| animals | 135 / 12 | 295 | 31 | 241031 |
| terrace architecture | 120 / 217 | 928 | 0 | 1690036 |

shadow-casting lights: [{"name":"","far":2000,"size":[240]}]

page: backend WebGL2, norender true, catch-up ticks 0 (still catching up: false), crowd looks pending 0

people in the frustum: within 40 m 19 of 62; within 60 m 25 of 106 (behind court walls for this eye: 8; to be drawn: 17)

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
| world / humans:worker:lod# | 2 / 2 | 4 | 2 | 1 |
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
| world / humans:envoy_short:lod# | 1 / 3 | 4 | 1 | 0 |
| world / humans:envoy_bare:shadow | 0 / 1 | 1 | 0 | 0 |
| world / humans:envoy_bare:shadow-far | 0 / 1 | 1 | 0 | 0 |
| world / humans:envoy_bare:lod# | 0 / 4 | 4 | 0 | 0 |
| world / people:reins | 0 / 1 | 0 | 0 | 0 |
| world / people:hit | 0 / 1 | 1 | 0 | 0 |
| world / people:impostors | 1 / 0 | 1 | 1 | 0 |
| player-body / humans:median:lod# | 0 / 2 | 2 | 0 | 0 |

people: sim out of doors within 60 m 106 (open ground 65, inside walled courts 41, walking 0; places {"h":76,"lane":30}; 250 m 451); crowd attached 454, skinned drawn 137 by LOD [4,20,0,113], impostors drawn 28 of 3141 candidates

town roofs (150 m round [-423,500]): up-facing area above 1.8 m 17233 m², wall area 66574 m², ratio 0.259 (168702 triangles)

<details><summary>all classes (top 60 by triangles)</summary>

| object key | vis / hidden | inst in frustum | < 60 m | tris | mats | tiers |
|---|---|---|---|---|---|---|
| world / relief:figures | 9 / 3 | 927 | 0 | 1690000 | MeshStandardNodeMaterial | C |
| terrain | 208 / 0 | 71 | 2 | 847616 | MeshStandardNodeMaterial | C |
| world / plain-orchards-far | 1 / 0 | 1 | 0 | 176772 | MeshStandardNodeMaterial |  |
| world / river-banks | 1 / 0 | 1 | 0 | 159880 | MeshStandardNodeMaterial | C |
| world / settlement:near:plaster | 1 / 0 | 1 | 0 | 154485 | MeshStandardNodeMaterial | C |
| world / props:carried | 1 / 0 | 33 | 15 | 133848 | MeshStandardNodeMaterial |  |
| world / plain-villages-#,# | 2 / 0 | 2 | 1 | 122620 | MeshStandardNodeMaterial | C |
| plain-works / works:wo_brick_field | 1 / 0 | 428 | 0 | 108712 | MeshStandardNodeMaterial | C |
| world / settlement:q_w#:far | 3 / 0 | 1 | 1 | 101436 | MeshStandardNodeMaterial | C |
| world / settlement:near:timber | 1 / 0 | 1 | 0 | 89284 | MeshStandardNodeMaterial | C |
| world / settlement:ground | 1 / 0 | 1 | 1 | 88536 | MeshStandardNodeMaterial | C |
| world / plain-stone | 1 / 0 | 1 | 1 | 84008 | MeshStandardNodeMaterial | C |
| world / plain-tracks | 1 / 0 | 1 | 0 | 75768 | MeshStandardNodeMaterial | C |
| world / props:tools | 2 / 2 | 27 | 8 | 72176 | MeshStandardNodeMaterial |  |
| world / settlement:near:items | 1 / 0 | 1 | 0 | 66328 | MeshStandardNodeMaterial | C |
| world / animals:sheep:lod# | 2 / 0 | 66 | 0 | 64680 | MeshStandardNodeMaterial |  |
| world / settlement:q_n#:far | 1 / 0 | 1 | 0 | 63066 | MeshStandardNodeMaterial | C |
| world / plain-canal-banks | 1 / 0 | 1 | 0 | 55524 | MeshStandardNodeMaterial | C |
| world / animals:goat:lod# | 2 / 1 | 55 | 6 | 53900 | MeshStandardNodeMaterial |  |
| world / river-water | 1 / 0 | 1 | 0 | 50324 | MeshStandardNodeMaterial |  |
| world / interiors:cloth | 1 / 0 | 1 | 0 | 49718 | MeshStandardNodeMaterial | C |
| plain-waterworks / works:wo_shaduf | 1 / 0 | 59 | 0 | 47436 | MeshStandardNodeMaterial | C |
| world / ledges:far | 1 / 0 | 1 | 0 | 44560 | ledges |  |
| world / humans:woman:lod# | 3 / 1 | 3 | 3 | 43848 | human |  |
| world / settlement:near:props | 1 / 0 | 1 | 0 | 36376 | MeshStandardNodeMaterial | C |
| world / humans:child:lod# | 3 / 1 | 3 | 3 | 36304 | human |  |
| world / nr-cliff | 1 / 0 | 1 | 0 | 33260 | MeshStandardNodeMaterial | C |
| world / settlement:gardens:far | 1 / 0 | 1 | 1 | 31796 | MeshStandardNodeMaterial | C |
| world / animals:hen:lod# | 1 / 0 | 45 | 14 | 28170 | MeshStandardNodeMaterial |  |
| world / animals:dog:lod# | 1 / 0 | 28 | 2 | 27384 | MeshStandardNodeMaterial |  |
| world / animals:donkey:lod# | 4 / 0 | 14 | 6 | 25858 | MeshStandardNodeMaterial |  |
| world / settlement:channel_stones | 1 / 0 | 1 | 0 | 24588 | MeshStandardNodeMaterial | C |
| world / settlement:near:stone | 1 / 0 | 1 | 0 | 22748 | MeshStandardNodeMaterial | C |
| world / settlement:refuse | 1 / 0 | 1 | 1 | 21888 | MeshStandardNodeMaterial | C |
| world / settlement:roads | 1 / 0 | 1 | 1 | 20956 | MeshStandardNodeMaterial | C |
| quarries-detail / plain-quarries:rock:quarry_sivand | 1 / 0 | 1 | 0 | 13745 | bedrock:ground |  |
| world / interiors:clay | 1 / 0 | 1 | 0 | 12108 | MeshStandardNodeMaterial | C |
| world / nr_darius_tomb | 1 / 0 | 1 | 0 | 11154 | MeshStandardNodeMaterial | C |
| world / nr_xerxes_tomb | 1 / 0 | 1 | 0 | 11154 | MeshStandardNodeMaterial | C |
| world / animals:mule:lod# | 1 / 0 | 8 | 0 | 10968 | MeshStandardNodeMaterial |  |
| world / nr-life | 1 / 0 | 1 | 1 | 9792 | MeshStandardNodeMaterial | C |
| world / animals:horse:lod# | 1 / 0 | 7 | 0 | 9597 | MeshStandardNodeMaterial |  |
| world / settlement:water | 1 / 0 | 1 | 1 | 9138 | MeshStandardNodeMaterial | C |
| world / settlement:q_g#:far | 1 / 0 | 1 | 0 | 8980 | MeshStandardNodeMaterial | C |
| world / settlement:canal_banks | 1 / 0 | 1 | 0 | 7836 | MeshStandardNodeMaterial | C |
| world / humans:worker:lod# | 2 / 2 | 2 | 1 | 7581 | human |  |
| world / settlement-doors:# | 6 / 0 | 37 | 16 | 6940 | MeshStandardNodeMaterial | C |
| world / fill:jar_water:clay:lod# | 3 / 0 | 28 | 21 | 6140 | MeshStandardNodeMaterial | C |
| world / bedrock-ground:talus#:lod# | 1 / 2 | 75 | 0 | 5925 | bedrock:ground |  |
| world / animals:camel:lod# | 2 / 0 | 4 | 0 | 5488 | MeshStandardNodeMaterial |  |
| world / work:basket_fruit | 1 / 0 | 4 | 0 | 4800 | MeshStandardNodeMaterial |  |
| world / work:beam | 1 / 0 | 2 | 0 | 4728 | MeshStandardNodeMaterial |  |
| plain-works / works:wo_brick_stack | 1 / 0 | 18 | 0 | 4644 | MeshStandardNodeMaterial | C |
| world / animals:cock:lod# | 1 / 0 | 7 | 1 | 4382 | MeshStandardNodeMaterial |  |
| world / settlement:official:far | 1 / 0 | 1 | 0 | 4298 | MeshStandardNodeMaterial | C |
| world / fire | 1 / 0 | 2072 | 34 | 4144 | MeshBasicNodeMaterial |  |
| world / work:drying_rack | 1 / 0 | 2 | 0 | 4112 | MeshStandardNodeMaterial |  |
| world / settlement:zone_dasht_e_gohar:mud | 1 / 0 | 1 | 0 | 4090 | MeshStandardNodeMaterial | C |
| plain-qanats / qanat-tile:#,# | 1 / 13 | 43 | 0 | 3870 | MeshStandardNodeMaterial | C |
| world / bedrock-ground:outcrop#:lod# | 1 / 2 | 35 | 0 | 3430 | bedrock:ground |  |

</details>

## terrace: the Terrace, noon (cov-252) (day 168, 12.586 h)

camera 84.8, 9.8, 1.6; sim people within 60 m: 28, within 250 m: 844; crowd stats: {"draws":6,"triangles":493579,"people":139,"byLod":[0,65,0,74],"shadowDraws":3,"shadowTriangles":46014,"propDraws":3,"props":73,"propTriangles":292040,"propsDropped":0,"placeholderActs":0,"motionCapture":30,"motionAuthored":109,"things":{"draws":2,"instances":2,"triangles":3100,"kinds":{"knucklebone

| class | meshes visible / hidden | instances in frustum | of them < 60 m | triangles in frustum |
|---|---|---|---|---|
| people (skinned, any LOD) | 9 / 41 | 9 | 8 | 22355 |
| people LOD3 (far) | 0 / 0 | 0 | 0 | 0 |
| people impostors | 1 / 0 | 1 | 0 | 2 |
| house roofs | 11 / 7 | 177 | 2 | 2712 |
| house walls | 4 / 0 | 9 | 2 | 940 |
| ground fill / props | 26 / 313 | 110 | 47 | 281165 |
| trees | 16 / 0 | 16 | 0 | 181066 |
| crops / flora | 19 / 44 | 186 | 0 | 24690 |
| fires / lamps | 10 / 4 | 2280 | 6 | 30272 |
| water | 11 / 5 | 58 | 4 | 325022 |
| animals | 126 / 22 | 56 | 1 | 7027 |
| terrace architecture | 137 / 200 | 1050 | 12 | 1826232 |

shadow-casting lights: [{"name":"","far":2000,"size":[240]}]

page: backend WebGL2, norender true, catch-up ticks 1 (still catching up: false), crowd looks pending 0

people in the frustum: within 40 m 0 of 0; within 60 m 27 of 28 (behind court walls for this eye: 0; to be drawn: 27)

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
| world / humans:worker:lod# | 2 / 2 | 4 | 2 | 1 |
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

people: sim out of doors within 60 m 28 (open ground 19, inside walled courts 0, walking 5; places {"worksite":3,"work_hearth":9,"(walking)":5,"h100_wall_W":1,"querns":1}; 250 m 844); crowd attached 449, skinned drawn 139 by LOD [0,65,0,74], impostors drawn 6 of 3253 candidates

town roofs (150 m round [145,11]): up-facing area above 1.8 m 0 m², wall area 0 m², ratio null (0 triangles)

<details><summary>all classes (top 60 by triangles)</summary>

| object key | vis / hidden | inst in frustum | < 60 m | tris | mats | tiers |
|---|---|---|---|---|---|---|
| world / relief:figures | 9 / 3 | 927 | 0 | 1690000 | MeshStandardNodeMaterial | C |
| terrain | 208 / 0 | 72 | 2 | 752640 | MeshStandardNodeMaterial | C |
| world / garrison:room_fittings:bedrolls | 1 / 0 | 624 | 0 | 469248 | MeshStandardNodeMaterial | C |
| world / garrison:room_fittings:mats | 1 / 0 | 416 | 0 | 372320 | MeshStandardNodeMaterial | C |
| world / props:carried | 1 / 0 | 66 | 5 | 267696 | MeshStandardNodeMaterial |  |
| world / garrison:room_fittings:mats_b | 1 / 0 | 208 | 0 | 186160 | MeshStandardNodeMaterial | C |
| world / plain-orchards-far | 1 / 0 | 1 | 0 | 176772 | MeshStandardNodeMaterial |  |
| world / river-banks | 1 / 0 | 1 | 0 | 159880 | MeshStandardNodeMaterial | C |
| world / plain-villages-#,# | 2 / 0 | 2 | 1 | 122620 | MeshStandardNodeMaterial | C |
| world / work:objects | 1 / 0 | 1 | 1 | 92036 | MeshStandardNodeMaterial |  |
| world / settlement:ground | 1 / 0 | 1 | 1 | 88536 | MeshStandardNodeMaterial | C |
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
| world / settlement:gardens:far | 1 / 0 | 1 | 1 | 31796 | MeshStandardNodeMaterial | C |
| world / treasury:alabaster_vessel | 1 / 0 | 69 | 0 | 31050 | MeshStandardNodeMaterial | C |
| world / treasury:mudbrick | 1 / 0 | 1 | 0 | 24072 | MeshStandardNodeMaterial | B/C |
| world / c#:dressings:cloth | 1 / 0 | 1 | 1 | 23770 | MeshStandardNodeMaterial | C |
| world / scribes:tablets_filed | 1 / 0 | 294 | 0 | 22344 | clay-writing |  |
| world / settlement:refuse | 1 / 0 | 1 | 1 | 21888 | MeshStandardNodeMaterial | C |
| world / treasury:mudbrick_painted | 2 / 0 | 2 | 0 | 21544 | MeshStandardNodeMaterial | B/C |
| world / hall#:construction:#|#|#:shaft:lod# | 7 / 7 | 48 | 11 | 21504 | model:column_shaft_f40:0:limestone_carved, model:column_shaft_f40:1:limestone_carved, model:column_shaft_drums:0:limestone_carved, model:column_shaft_drums:1:limestone_carved | C |
| world / settlement:roads | 1 / 0 | 1 | 1 | 20956 | MeshStandardNodeMaterial | C |
| world / garrison:mudbrick | 1 / 0 | 1 | 1 | 20292 | MeshStandardNodeMaterial | B/C |
| world / fire-body:hearth:stone | 1 / 0 | 9 | 1 | 19800 | MeshStandardNodeMaterial | C |
| world / bedrock-ground:outcrop#:lod# | 2 / 1 | 123 | 0 | 18580 | bedrock:ground |  |
| world / hall#:construction:#|#|#:protome:lod# | 1 / 1 | 30 | 6 | 16860 | model:capital_protome:0:limestone_carved, model:capital_protome:1:limestone_carved | C |
| world / apadana:palace_plaster | 1 / 0 | 1 | 1 | 16348 | MeshStandardNodeMaterial | B/C |
| world / garrison:room_fittings | 1 / 0 | 1 | 1 | 16124 | MeshStandardNodeMaterial | C |
| world / apadana-glazed-frieze | 1 / 0 | 1 | 1 | 14912 | MeshStandardNodeMaterial | C |
| world / palace-glazed-bands | 1 / 0 | 1 | 1 | 14532 | MeshStandardNodeMaterial | C |
| world / treasury:textile_bale | 1 / 0 | 24 | 0 | 13632 | MeshStandardNodeMaterial | C |
| world / bedrock-ground:talus#:lod# | 1 / 2 | 153 | 0 | 12087 | bedrock:ground |  |
| world / apadana:limestone | 2 / 0 | 2 | 2 | 10875 | MeshStandardNodeMaterial | C |
| world / ledges:mid | 1 / 0 | 1 | 0 | 10840 | ledges |  |
| world / treasury:timber:ceiling | 1 / 0 | 1 | 0 | 10506 | MeshStandardNodeMaterial | C |
| world / treasury:scale_armour | 1 / 0 | 18 | 0 | 10224 | MeshStandardNodeMaterial | C |
| world / nr-life | 1 / 0 | 1 | 1 | 9792 | MeshStandardNodeMaterial | C |
| world / settlement:water | 1 / 0 | 1 | 1 | 9138 | MeshStandardNodeMaterial | C |
| world / treasury:chert_set | 1 / 0 | 30 | 0 | 8340 | MeshStandardNodeMaterial | C |
| world / props:tools | 2 / 2 | 3 | 1 | 8120 | MeshStandardNodeMaterial |  |
| world / scribes:furnishings | 1 / 0 | 1 | 0 | 8096 | MeshStandardNodeMaterial | C |
| world / garrison:columns:base_square#:lod# | 1 / 1 | 36 | 0 | 8064 | model:column_base_square2:0:limestone_carved, model:column_base_square2:1:limestone_carved | C |
| world / settlement:canal_banks | 1 / 0 | 1 | 0 | 7836 | MeshStandardNodeMaterial | C |
| world / humans:worker:lod# | 2 / 2 | 2 | 1 | 7581 | human |  |
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

camera 84.8, 9.8, 1.6; sim people within 60 m: 88, within 250 m: 970; crowd stats: {"draws":7,"triangles":844825,"people":249,"byLod":[0,100,27,122],"shadowDraws":3,"shadowTriangles":90303,"propDraws":3,"props":176,"propTriangles":708556,"propsDropped":0,"placeholderActs":0,"motionCapture":47,"motionAuthored":202,"things":{"draws":5,"instances":41,"triangles":52820,"kinds":{"knuck

| class | meshes visible / hidden | instances in frustum | of them < 60 m | triangles in frustum |
|---|---|---|---|---|
| people (skinned, any LOD) | 10 / 40 | 10 | 10 | 25281 |
| people LOD3 (far) | 0 / 0 | 0 | 0 | 0 |
| people impostors | 1 / 0 | 1 | 0 | 2 |
| house roofs | 11 / 7 | 177 | 2 | 2712 |
| house walls | 4 / 0 | 9 | 2 | 940 |
| ground fill / props | 26 / 313 | 209 | 97 | 682709 |
| trees | 16 / 0 | 16 | 0 | 181066 |
| crops / flora | 19 / 44 | 186 | 0 | 24690 |
| fires / lamps | 10 / 4 | 2280 | 6 | 30272 |
| water | 11 / 5 | 58 | 4 | 325022 |
| animals | 127 / 21 | 251 | 1 | 198151 |
| terrace architecture | 138 / 199 | 1050 | 12 | 1826232 |

shadow-casting lights: [{"name":"","far":2000,"size":[240]}]

page: backend WebGL2, norender true, catch-up ticks 1 (still catching up: false), crowd looks pending 0

people in the frustum: within 40 m 12 of 12; within 60 m 65 of 88 (behind court walls for this eye: 0; to be drawn: 65)

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

people: sim out of doors within 60 m 88 (open ground 71, inside walled courts 0, walking 5; places {"h100_door_N1":32,"h100_wall_W":33,"hall100_site":5,"querns":1}; 250 m 970); crowd attached 448, skinned drawn 249 by LOD [0,100,27,122], impostors drawn 7 of 3419 candidates

town roofs (150 m round [145,11]): up-facing area above 1.8 m 0 m², wall area 0 m², ratio null (0 triangles)

<details><summary>all classes (top 60 by triangles)</summary>

| object key | vis / hidden | inst in frustum | < 60 m | tris | mats | tiers |
|---|---|---|---|---|---|---|
| world / relief:figures | 9 / 3 | 927 | 0 | 1690000 | MeshStandardNodeMaterial | C |
| terrain | 208 / 0 | 72 | 2 | 752640 | MeshStandardNodeMaterial | C |
| world / props:carried | 1 / 0 | 165 | 55 | 669240 | MeshStandardNodeMaterial |  |
| world / garrison:room_fittings:bedrolls | 1 / 0 | 624 | 0 | 469248 | MeshStandardNodeMaterial | C |
| world / garrison:room_fittings:mats | 1 / 0 | 416 | 0 | 372320 | MeshStandardNodeMaterial | C |
| world / garrison:room_fittings:mats_b | 1 / 0 | 208 | 0 | 186160 | MeshStandardNodeMaterial | C |
| world / plain-orchards-far | 1 / 0 | 1 | 0 | 176772 | MeshStandardNodeMaterial |  |
| world / river-banks | 1 / 0 | 1 | 0 | 159880 | MeshStandardNodeMaterial | C |
| world / plain-villages-#,# | 2 / 0 | 2 | 1 | 122620 | MeshStandardNodeMaterial | C |
| world / animals:sheep:lod# | 1 / 1 | 116 | 0 | 113680 | MeshStandardNodeMaterial |  |
| world / work:objects | 1 / 0 | 1 | 1 | 92036 | MeshStandardNodeMaterial |  |
| world / settlement:ground | 1 / 0 | 1 | 1 | 88536 | MeshStandardNodeMaterial | C |
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
| world / work:brick_stack | 1 / 0 | 18 | 1 | 38880 | MeshStandardNodeMaterial |  |
| world / treasury:arrow_bundle | 1 / 0 | 40 | 0 | 35200 | MeshStandardNodeMaterial | C |
| world / settlement:gardens:far | 1 / 0 | 1 | 1 | 31796 | MeshStandardNodeMaterial | C |
| world / treasury:alabaster_vessel | 1 / 0 | 69 | 0 | 31050 | MeshStandardNodeMaterial | C |
| world / treasury:mudbrick | 1 / 0 | 1 | 0 | 24072 | MeshStandardNodeMaterial | B/C |
| world / c#:dressings:cloth | 1 / 0 | 1 | 1 | 23770 | MeshStandardNodeMaterial | C |
| world / scribes:tablets_filed | 1 / 0 | 294 | 0 | 22344 | clay-writing |  |
| world / settlement:refuse | 1 / 0 | 1 | 1 | 21888 | MeshStandardNodeMaterial | C |
| world / treasury:mudbrick_painted | 2 / 0 | 2 | 0 | 21544 | MeshStandardNodeMaterial | B/C |
| world / hall#:construction:#|#|#:shaft:lod# | 7 / 7 | 48 | 11 | 21504 | model:column_shaft_f40:0:limestone_carved, model:column_shaft_f40:1:limestone_carved, model:column_shaft_drums:0:limestone_carved, model:column_shaft_drums:1:limestone_carved | C |
| world / settlement:roads | 1 / 0 | 1 | 1 | 20956 | MeshStandardNodeMaterial | C |
| world / garrison:mudbrick | 1 / 0 | 1 | 1 | 20292 | MeshStandardNodeMaterial | B/C |
| world / fire-body:hearth:stone | 1 / 0 | 9 | 1 | 19800 | MeshStandardNodeMaterial | C |
| world / bedrock-ground:outcrop#:lod# | 2 / 1 | 123 | 0 | 18580 | bedrock:ground |  |
| world / hall#:construction:#|#|#:protome:lod# | 1 / 1 | 30 | 6 | 16860 | model:capital_protome:0:limestone_carved, model:capital_protome:1:limestone_carved | C |
| world / apadana:palace_plaster | 1 / 0 | 1 | 1 | 16348 | MeshStandardNodeMaterial | B/C |
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
| world / nr-life | 1 / 0 | 1 | 1 | 9792 | MeshStandardNodeMaterial | C |
| world / settlement:water | 1 / 0 | 1 | 1 | 9138 | MeshStandardNodeMaterial | C |
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

camera 14.3, 32.6, 4.6; sim people within 60 m: 104, within 250 m: 1061; crowd stats: {"draws":6,"triangles":259140,"people":122,"byLod":[0,35,0,87],"shadowDraws":2,"shadowTriangles":20026,"propDraws":3,"props":60,"propTriangles":227086,"propsDropped":0,"placeholderActs":0,"motionCapture":51,"motionAuthored":71,"things":{"draws":1,"instances":1,"triangles":280,"kinds":{"knucklebones"

| class | meshes visible / hidden | instances in frustum | of them < 60 m | triangles in frustum |
|---|---|---|---|---|
| people (skinned, any LOD) | 8 / 42 | 8 | 4 | 16144 |
| people LOD3 (far) | 0 / 0 | 0 | 0 | 0 |
| people impostors | 1 / 0 | 1 | 0 | 2 |
| house roofs | 11 / 7 | 160 | 18 | 2352 |
| house walls | 4 / 0 | 1 | 1 | 300 |
| ground fill / props | 16 / 323 | 61 | 10 | 191550 |
| trees | 16 / 0 | 16 | 0 | 181066 |
| crops / flora | 19 / 44 | 126 | 0 | 13790 |
| fires / lamps | 10 / 4 | 2041 | 0 | 20610 |
| water | 11 / 5 | 69 | 5 | 356934 |
| animals | 125 / 23 | 48 | 1 | 6552 |
| terrace architecture | 149 / 198 | 1957 | 669 | 1967199 |

shadow-casting lights: [{"name":"","far":2000,"size":[240]}]

page: backend WebGL2, norender true, catch-up ticks 1 (still catching up: false), crowd looks pending 0

people in the frustum: within 40 m 3 of 30; within 60 m 30 of 104 (behind court walls for this eye: 0; to be drawn: 30)

| people mesh | visible / hidden meshes | instances (count) | in frustum | < 60 m |
|---|---|---|---|---|
| world / humans:persian:shadow | 0 / 1 | 1 | 0 | 0 |
| world / humans:persian:shadow-far | 1 / 0 | 1 | 1 | 1 |
| world / humans:persian:lod# | 2 / 2 | 4 | 2 | 1 |
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
| world / humans:envoy:shadow-far | 1 / 0 | 1 | 1 | 1 |
| world / humans:envoy:lod# | 1 / 3 | 4 | 1 | 1 |
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

people: sim out of doors within 60 m 104 (open ground 103, inside walled courts 0, walking 0; places {"palaces":1,"apadana_hall":58,"forecourt_wait":44}; 250 m 1061); crowd attached 415, skinned drawn 122 by LOD [0,35,0,87], impostors drawn 14 of 3538 candidates

town roofs (150 m round [54,77]): up-facing area above 1.8 m 0 m², wall area 0 m², ratio null (0 triangles)

<details><summary>all classes (top 60 by triangles)</summary>

| object key | vis / hidden | inst in frustum | < 60 m | tris | mats | tiers |
|---|---|---|---|---|---|---|
| world / relief:figures | 9 / 3 | 927 | 0 | 1690000 | MeshStandardNodeMaterial | C |
| terrain | 208 / 0 | 71 | 3 | 785920 | MeshStandardNodeMaterial | C |
| world / props:carried | 1 / 0 | 44 | 1 | 178464 | MeshStandardNodeMaterial |  |
| world / plain-orchards-far | 1 / 0 | 1 | 0 | 176772 | MeshStandardNodeMaterial |  |
| world / garrison:room_fittings:bedrolls | 1 / 0 | 223 | 0 | 167696 | MeshStandardNodeMaterial | C |
| world / river-banks | 1 / 0 | 1 | 0 | 159880 | MeshStandardNodeMaterial | C |
| plain-works / works:wo_brick_field | 1 / 0 | 591 | 0 | 150114 | MeshStandardNodeMaterial | C |
| world / garrison:room_fittings:mats | 1 / 0 | 149 | 0 | 133355 | MeshStandardNodeMaterial | C |
| world / plain-villages-#,# | 2 / 0 | 2 | 1 | 122620 | MeshStandardNodeMaterial | C |
| world / work:objects | 1 / 0 | 1 | 0 | 92036 | MeshStandardNodeMaterial |  |
| world / settlement:ground | 1 / 0 | 1 | 1 | 88536 | MeshStandardNodeMaterial | C |
| world / plain-stone | 1 / 0 | 1 | 1 | 84008 | MeshStandardNodeMaterial | C |
| world / plain-tracks | 1 / 0 | 1 | 0 | 75768 | MeshStandardNodeMaterial | C |
| world / garrison:room_fittings:mats_b | 1 / 0 | 74 | 0 | 66230 | MeshStandardNodeMaterial | C |
| world / ledges:far | 1 / 0 | 1 | 0 | 64090 | ledges |  |
| world / plain-canal-banks | 1 / 0 | 1 | 0 | 55524 | MeshStandardNodeMaterial | C |
| world / river-water | 1 / 0 | 1 | 0 | 50324 | MeshStandardNodeMaterial |  |
| plain-waterworks / works:wo_shaduf | 1 / 0 | 59 | 0 | 47436 | MeshStandardNodeMaterial | C |
| world / crown-merlons:terrace|#|# | 2 / 0 | 246 | 0 | 44104 | decor:merlon:limestone_merlon | C |
| world / fortification_e:mudbrick | 2 / 0 | 2 | 2 | 42174 | MeshStandardNodeMaterial | B/C |
| world / nr-cliff | 1 / 0 | 1 | 0 | 33260 | MeshStandardNodeMaterial | C |
| world / relief:far | 15 / 43 | 4 | 4 | 31835 | MeshStandardNodeMaterial | C |
| world / settlement:gardens:far | 1 / 0 | 1 | 1 | 31796 | MeshStandardNodeMaterial | C |
| world / settlement:channel_stones | 1 / 0 | 1 | 0 | 24588 | MeshStandardNodeMaterial | C |
| world / relief:rosettes | 1 / 0 | 608 | 608 | 24320 | MeshStandardNodeMaterial | C |
| world / c#:dressings:cloth | 1 / 0 | 1 | 1 | 23770 | MeshStandardNodeMaterial | C |
| world / apadana:columns:base_bell:lod# | 3 / 1 | 4 | 4 | 22880 | model:column_base_bell:0:limestone_carved, model:column_base_bell:1:limestone_carved | C |
| world / settlement:refuse | 1 / 0 | 1 | 1 | 21888 | MeshStandardNodeMaterial | C |
| world / settlement:roads | 1 / 0 | 1 | 1 | 20956 | MeshStandardNodeMaterial | C |
| world / garrison:mudbrick | 1 / 0 | 1 | 1 | 20292 | MeshStandardNodeMaterial | B/C |
| world / arris-band:limestone | 25 / 0 | 11 | 11 | 19248 | MeshStandardNodeMaterial | C |
| world / apadana:palace_plaster | 1 / 0 | 1 | 1 | 16348 | MeshStandardNodeMaterial | B/C |
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
| world / nr-life | 1 / 0 | 1 | 1 | 9792 | MeshStandardNodeMaterial | C |
| world / palace-furnishings:apadana:stored:bronze | 1 / 0 | 1 | 1 | 9440 | MeshStandardNodeMaterial | C |
| world / apadana:timber:ceiling | 1 / 0 | 1 | 1 | 9312 | MeshStandardNodeMaterial | C |
| world / settlement:water | 1 / 0 | 1 | 1 | 9138 | MeshStandardNodeMaterial | C |
| world / settlement:q_g#:far | 1 / 0 | 1 | 0 | 8980 | MeshStandardNodeMaterial | C |
| world / ledges:mid | 1 / 0 | 1 | 0 | 8390 | ledges |  |
| world / settlement:canal_banks | 1 / 0 | 1 | 0 | 7836 | MeshStandardNodeMaterial | C |
| world / crown-merlons:gate_nations|#|# | 2 / 0 | 37 | 0 | 7548 | decor:merlon:limestone_merlon | C |
| world / humans:persian:lod# | 2 / 2 | 2 | 1 | 7362 | human |  |
| world / terrace-foot:blocks | 1 / 0 | 1 | 1 | 6745 | MeshStandardNodeMaterial | C |
| plain-works / works:wo_brick_stack | 1 / 0 | 26 | 0 | 6708 | MeshStandardNodeMaterial | C |
| world / garrison:timber:ceiling | 1 / 0 | 1 | 1 | 6576 | MeshStandardNodeMaterial | C |
| world / crenellations | 1 / 0 | 32 | 32 | 6528 | decor:merlon:limestone_merlon | C |
| world / props:children | 1 / 0 | 5 | 0 | 6510 | MeshStandardNodeMaterial |  |
| world / hall#:mudbrick_bare | 1 / 0 | 1 | 0 | 6460 | MeshStandardNodeMaterial | C |
| world / gate_nations:palace_plaster | 1 / 0 | 1 | 0 | 6118 | MeshStandardNodeMaterial | B/C |

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
| water | 10 / 6 | 4 | 1 | 274866 |
| animals | 122 / 26 | 6 | 6 | 3696 |
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
| world / people:impostors | 0 / 1 | 1 | 0 | 0 |
| player-body / humans:median:lod# | 0 / 2 | 2 | 0 | 0 |

people: sim out of doors within 60 m 0 (open ground 0, inside walled courts 0, walking 0; places {}; 250 m 0); crowd attached 0, skinned drawn 0 by LOD [0,0,0,0], impostors drawn 0 of 287 candidates

town roofs (150 m round [-6332,-1962]): up-facing area above 1.8 m 0 m², wall area 0 m², ratio null (0 triangles)

<details><summary>all classes (top 60 by triangles)</summary>

| object key | vis / hidden | inst in frustum | < 60 m | tris | mats | tiers |
|---|---|---|---|---|---|---|
| world / relief:figures | 9 / 3 | 927 | 0 | 1690000 | MeshStandardNodeMaterial | C |
| terrain | 208 / 0 | 31 | 4 | 698112 | MeshStandardNodeMaterial | C |
| world / plain-orchards-far | 1 / 0 | 1 | 0 | 176772 | MeshStandardNodeMaterial |  |
| world / river-banks | 1 / 0 | 1 | 0 | 159880 | MeshStandardNodeMaterial | C |
| world / plain-villages--#,-# | 2 / 0 | 2 | 0 | 142112 | MeshStandardNodeMaterial | C |
| world / settlement:ground | 1 / 0 | 1 | 1 | 88536 | MeshStandardNodeMaterial | C |
| world / plain-stone | 1 / 0 | 1 | 1 | 84008 | MeshStandardNodeMaterial | C |
| world / plain-tracks | 1 / 0 | 1 | 0 | 75768 | MeshStandardNodeMaterial | C |
| world / plain-villages--#,# | 4 / 0 | 1 | 1 | 67086 | MeshStandardNodeMaterial | C |
| world / plain-canal-banks | 1 / 0 | 1 | 0 | 55524 | MeshStandardNodeMaterial | C |
| world / river-water | 1 / 0 | 1 | 0 | 50324 | MeshStandardNodeMaterial |  |
| world / settlement:refuse | 1 / 0 | 1 | 1 | 21888 | MeshStandardNodeMaterial | C |
| world / settlement:roads | 1 / 0 | 1 | 1 | 20956 | MeshStandardNodeMaterial | C |
| world / cover-tuft:tuft_m#c:lod# | 6 / 0 | 81 | 81 | 12628 | ground-cover |  |
| world / settlement:water | 1 / 0 | 1 | 1 | 9138 | MeshStandardNodeMaterial | C |
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
| world / door-sealing:treasury:e_stores_n_#_W | 0 / 4 | 0 | 0 | 0 | clay-writing |  |

</details>

## fields: the approach fields, dawn (cov-196) (day 126, 5.635 h)

camera -491.3, -73.3, -12.5; sim people within 60 m: 0, within 250 m: 150; crowd stats: {"draws":3,"triangles":286190,"people":400,"byLod":[0,0,0,400],"shadowDraws":0,"shadowTriangles":0,"propDraws":3,"props":218,"propTriangles":796318,"propsDropped":0,"placeholderActs":0,"motionCapture":120,"motionAuthored":280,"things":{"draws":0,"instances":0,"triangles":0,"kinds":{},"dropped":0},"a

| class | meshes visible / hidden | instances in frustum | of them < 60 m | triangles in frustum |
|---|---|---|---|---|
| people (skinned, any LOD) | 3 / 47 | 3 | 0 | 2201 |
| people LOD3 (far) | 0 / 0 | 0 | 0 | 0 |
| people impostors | 1 / 0 | 1 | 0 | 2 |
| house roofs | 11 / 7 | 764 | 0 | 10464 |
| house walls | 4 / 0 | 18 | 1 | 1184 |
| ground fill / props | 7 / 332 | 222 | 0 | 797634 |
| trees | 16 / 0 | 16 | 0 | 181066 |
| crops / flora | 26 / 37 | 100 | 57 | 8679 |
| fires / lamps | 11 / 3 | 1129 | 0 | 56678 |
| water | 10 / 6 | 7 | 1 | 284734 |
| animals | 125 / 24 | 168 | 1 | 84736 |
| terrace architecture | 119 / 228 | 2566 | 0 | 1885484 |

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
| world / humans:median:lod# | 0 / 4 | 4 | 0 | 0 |
| world / humans:worker:shadow | 0 / 1 | 1 | 0 | 0 |
| world / humans:worker:shadow-far | 0 / 1 | 1 | 0 | 0 |
| world / humans:worker:lod# | 1 / 3 | 4 | 1 | 0 |
| world / humans:woman:shadow | 0 / 1 | 1 | 0 | 0 |
| world / humans:woman:shadow-far | 0 / 1 | 1 | 0 | 0 |
| world / humans:woman:lod# | 1 / 3 | 4 | 1 | 0 |
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

people: sim out of doors within 60 m 0 (open ground 0, inside walled courts 0, walking 0; places {}; 250 m 150); crowd attached 401, skinned drawn 400 by LOD [0,0,0,400], impostors drawn 1039 of 3540 candidates

town roofs (150 m round [-448,-115]): up-facing area above 1.8 m 0 m², wall area 0 m², ratio null (0 triangles)

<details><summary>all classes (top 60 by triangles)</summary>

| object key | vis / hidden | inst in frustum | < 60 m | tris | mats | tiers |
|---|---|---|---|---|---|---|
| world / relief:figures | 9 / 3 | 927 | 0 | 1690000 | MeshStandardNodeMaterial | C |
| terrain | 208 / 0 | 76 | 3 | 712960 | MeshStandardNodeMaterial | C |
| world / props:carried | 1 / 0 | 149 | 0 | 604344 | MeshStandardNodeMaterial |  |
| world / treasury:arrow_bundle | 1 / 0 | 487 | 0 | 428560 | MeshStandardNodeMaterial | C |
| world / treasury:alabaster_vessel | 1 / 0 | 894 | 0 | 402300 | MeshStandardNodeMaterial | C |
| world / treasury:textile_bale | 1 / 0 | 406 | 0 | 230608 | MeshStandardNodeMaterial | C |
| world / props:tools | 1 / 3 | 68 | 0 | 190672 | MeshStandardNodeMaterial |  |
| world / plain-orchards-far | 1 / 0 | 1 | 0 | 176772 | MeshStandardNodeMaterial |  |
| world / river-banks | 1 / 0 | 1 | 0 | 159880 | MeshStandardNodeMaterial | C |
| world / treasury:chert_set | 1 / 0 | 487 | 0 | 135386 | MeshStandardNodeMaterial | C |
| world / harem:room_fittings:bedrolls | 1 / 0 | 176 | 0 | 132352 | MeshStandardNodeMaterial | C |
| world / plain-villages-#,# | 2 / 0 | 2 | 1 | 122620 | MeshStandardNodeMaterial | C |
| world / treasury:scale_armour | 1 / 0 | 203 | 0 | 115304 | MeshStandardNodeMaterial | C |
| world / settlement:q_s#:far | 4 / 0 | 1 | 0 | 111700 | MeshStandardNodeMaterial | C |
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
| world / fire-body:hearth:stone | 1 / 0 | 8 | 0 | 17600 | MeshStandardNodeMaterial | C |
| world / garrison:room_fittings | 1 / 0 | 1 | 0 | 16124 | MeshStandardNodeMaterial | C |
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

camera -900.2, -1513.5, -18.1; sim people within 60 m: 88, within 250 m: 563; crowd stats: {"draws":4,"triangles":77817,"people":125,"byLod":[0,0,0,125],"shadowDraws":0,"shadowTriangles":0,"propDraws":1,"props":21,"propTriangles":27342,"propsDropped":0,"placeholderActs":0,"motionCapture":2,"motionAuthored":123,"things":{"draws":0,"instances":0,"triangles":0,"kinds":{},"dropped":0},"animal

| class | meshes visible / hidden | instances in frustum | of them < 60 m | triangles in frustum |
|---|---|---|---|---|
| people (skinned, any LOD) | 4 / 46 | 4 | 4 | 2577 |
| people LOD3 (far) | 0 / 0 | 0 | 0 | 0 |
| people impostors | 1 / 0 | 1 | 0 | 2 |
| house roofs | 13 / 5 | 10 | 4 | 2102 |
| house walls | 4 / 0 | 0 | 0 | 0 |
| ground fill / props | 80 / 259 | 144 | 71 | 58739 |
| trees | 16 / 0 | 16 | 0 | 181066 |
| crops / flora | 23 / 40 | 12 | 11 | 1490 |
| fires / lamps | 12 / 2 | 4933 | 13 | 9866 |
| water | 12 / 4 | 47 | 4 | 296854 |
| animals | 129 / 21 | 44 | 16 | 32200 |
| terrace architecture | 118 / 229 | 927 | 0 | 1690000 |

shadow-casting lights: [{"name":"","far":2000,"size":[240]}]

page: backend WebGL2, norender true, catch-up ticks 1 (still catching up: false), crowd looks pending 0

people in the frustum: within 40 m 7 of 42; within 60 m 19 of 88 (behind court walls for this eye: 19; to be drawn: 0)

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

people: sim out of doors within 60 m 88 (open ground 0, inside walled courts 88, walking 0; places {"h":88}; 250 m 563); crowd attached 408, skinned drawn 125 by LOD [0,0,0,125], impostors drawn 36 of 4590 candidates

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
| world / settlement:ground | 1 / 0 | 1 | 1 | 88536 | MeshStandardNodeMaterial | C |
| world / plain-stone | 1 / 0 | 1 | 1 | 84008 | MeshStandardNodeMaterial | C |
| world / settlement:near:plaster | 1 / 0 | 1 | 0 | 81194 | MeshStandardNodeMaterial | C |
| world / plain-tracks | 1 / 0 | 1 | 0 | 75768 | MeshStandardNodeMaterial | C |
| world / settlement:q_s#:far | 4 / 0 | 1 | 1 | 62408 | MeshStandardNodeMaterial | C |
| world / plain-canal-banks | 1 / 0 | 1 | 0 | 55524 | MeshStandardNodeMaterial | C |
| world / river-water | 1 / 0 | 1 | 0 | 50324 | MeshStandardNodeMaterial |  |
| world / settlement:near:timber | 1 / 0 | 1 | 0 | 45442 | MeshStandardNodeMaterial | C |
| world / settlement:near:items | 1 / 0 | 1 | 0 | 38863 | MeshStandardNodeMaterial | C |
| world / plain-villages-#,# | 2 / 0 | 1 | 1 | 35002 | MeshStandardNodeMaterial | C |
| world / settlement:gardens:far | 1 / 0 | 1 | 1 | 31796 | MeshStandardNodeMaterial | C |
| world / props:children | 1 / 0 | 17 | 1 | 22134 | MeshStandardNodeMaterial |  |
| world / settlement:refuse | 1 / 0 | 1 | 1 | 21888 | MeshStandardNodeMaterial | C |
| world / settlement:roads | 1 / 0 | 1 | 1 | 20956 | MeshStandardNodeMaterial | C |
| world / settlement:near:props | 1 / 0 | 1 | 0 | 20676 | MeshStandardNodeMaterial | C |
| plain-waterworks / works:wo_shaduf | 1 / 0 | 23 | 0 | 18492 | MeshStandardNodeMaterial | C |
| world / ledges:far | 1 / 0 | 1 | 0 | 15180 | ledges |  |
| quarries-detail / plain-quarries:rock:quarry_majdabad | 1 / 0 | 1 | 0 | 13745 | bedrock:ground |  |
| world / settlement:near:stone | 1 / 0 | 1 | 0 | 13478 | MeshStandardNodeMaterial | C |
| world / animals:goat:lod# | 2 / 1 | 12 | 6 | 11760 | MeshStandardNodeMaterial |  |
| world / nr-life | 1 / 0 | 1 | 1 | 9792 | MeshStandardNodeMaterial | C |
| world / settlement-doors:# | 6 / 0 | 46 | 6 | 9328 | MeshStandardNodeMaterial | C |
| world / settlement:water | 1 / 0 | 1 | 1 | 9138 | MeshStandardNodeMaterial | C |
| world / animals:dog:lod# | 1 / 0 | 9 | 1 | 8802 | MeshStandardNodeMaterial |  |
| world / animals:sheep:lod# | 2 / 0 | 8 | 0 | 7840 | MeshStandardNodeMaterial |  |
| world / fire | 1 / 0 | 3282 | 10 | 6564 | MeshBasicNodeMaterial |  |
| world / interiors:cloth | 1 / 0 | 1 | 0 | 6058 | MeshStandardNodeMaterial | C |
| world / interiors:clay | 1 / 0 | 1 | 0 | 5730 | MeshStandardNodeMaterial | C |
| Mesh | 3 / 1 | 3 | 0 | 4940 | MeshBasicNodeMaterial, NodeMaterial |  |
| world / settlement:near:brick | 1 / 0 | 1 | 0 | 4071 | MeshStandardNodeMaterial | B/C |
| world / animals:cat:lod# | 1 / 0 | 6 | 0 | 3528 | MeshStandardNodeMaterial |  |
| world / fire:coals | 1 / 0 | 1651 | 3 | 3302 | MeshBasicNodeMaterial |  |
| Points | 1 / 0 | 1 | 0 | 2973 | PointsNodeMaterial |  |
| world / fill:wo_dung_cakes:dung:lod# | 2 / 1 | 22 | 10 | 2400 | MeshStandardNodeMaterial | C |
| plain-waterworks / works:wo_pontoon | 1 / 0 | 7 | 0 | 2352 | MeshStandardNodeMaterial | C |
| world / fill:fill_awning:cloth:lod# | 1 / 2 | 7 | 2 | 1820 | MeshStandardNodeMaterial | C |
| world / fill:fill_awning:wood:lod# | 1 / 2 | 7 | 2 | 1680 | MeshStandardNodeMaterial | C |
| world / settlement:waystation:far | 1 / 0 | 1 | 0 | 1542 | MeshStandardNodeMaterial | C |
| world / rock-stone:namaqualand_rocks_#_v#:lod# | 8 / 0 | 6 | 6 | 1498 | scan:namaqualand_rocks_01_v1, scan:namaqualand_rocks_01_v2, scan:namaqualand_rocks_01_v3, scan:namaqualand_rocks_01_v4 |  |
| world / fill:fill_bundle:wood:lod# | 2 / 1 | 3 | 3 | 1395 | MeshStandardNodeMaterial | C |
| world / roofwear:drip_jar:clay | 1 / 0 | 3 | 1 | 1332 | MeshStandardNodeMaterial | C |
| world / fill:jar_store:clay:lod# | 2 / 1 | 13 | 2 | 1170 | MeshStandardNodeMaterial | C |
| world / fill:mat:matting:lod# | 2 / 1 | 11 | 3 | 1155 | MeshStandardNodeMaterial | C |
| world / wallwear:splash | 1 / 0 | 16 | 2 | 1152 | MeshStandardNodeMaterial |  |
| world / fill:jar_water:clay:lod# | 2 / 1 | 13 | 3 | 1144 | MeshStandardNodeMaterial | C |
| world / fill:sack:cloth:lod# | 2 / 1 | 3 | 3 | 990 | MeshStandardNodeMaterial | C |
| world / flora-cushion:model:lod# | 2 / 0 | 5 | 5 | 940 | life:cushion |  |
| world / settlement:trees-wood-lod# | 2 / 0 | 2 | 0 | 896 | MeshStandardNodeMaterial |  |
| world / plain-trees-wood-lod# | 2 / 0 | 2 | 0 | 896 | MeshStandardNodeMaterial |  |
| world / settlement:trees-leaves-lod# | 2 / 0 | 2 | 0 | 880 | MeshStandardNodeMaterial |  |
| world / plain-trees-leaves-lod# | 2 / 0 | 2 | 0 | 880 | MeshStandardNodeMaterial |  |
| world / rock-stone:namaqualand_stones_#_v#:lod# | 10 / 0 | 4 | 4 | 799 | scan:namaqualand_stones_01_v1, scan:namaqualand_stones_01_v2, scan:namaqualand_stones_01_v3, scan:namaqualand_stones_01_v4 |  |
| world / wallwear:soot | 1 / 0 | 11 | 3 | 792 | MeshStandardNodeMaterial |  |
| world / roofwear:patch | 1 / 0 | 7 | 3 | 770 | MeshStandardNodeMaterial | C |

</details>

## night_terrace: the Terrace at 22:30 (sb-night-terrace) (day 5, 22.5 h)

camera 0, 92, 1.6; sim people within 60 m: 54, within 250 m: 574; crowd stats: {"draws":7,"triangles":1361790,"people":400,"byLod":[24,29,0,347],"shadowDraws":4,"shadowTriangles":79074,"propDraws":3,"props":134,"propTriangles":385502,"propsDropped":0,"placeholderActs":0,"motionCapture":227,"motionAuthored":173,"things":{"draws":8,"instances":124,"triangles":343488,"kinds":{"kn

| class | meshes visible / hidden | instances in frustum | of them < 60 m | triangles in frustum |
|---|---|---|---|---|
| people (skinned, any LOD) | 11 / 39 | 11 | 4 | 64195 |
| people LOD3 (far) | 0 / 0 | 0 | 0 | 0 |
| people impostors | 1 / 0 | 1 | 0 | 2 |
| house roofs | 13 / 5 | 1138 | 131 | 14952 |
| house walls | 4 / 0 | 1 | 1 | 300 |
| ground fill / props | 19 / 320 | 142 | 4 | 387277 |
| trees | 16 / 0 | 16 | 0 | 181066 |
| crops / flora | 19 / 44 | 74 | 0 | 8216 |
| fires / lamps | 11 / 3 | 4367 | 12 | 87830 |
| water | 13 / 3 | 6 | 3 | 276898 |
| animals | 124 / 26 | 75 | 0 | 73500 |
| terrace architecture | 124 / 223 | 4253 | 951 | 2357375 |

shadow-casting lights: [{"name":"","far":2000,"size":[240]}]

page: backend WebGL2, norender true, catch-up ticks 1 (still catching up: false), crowd looks pending 0

people in the frustum: within 40 m 31 of 48; within 60 m 31 of 54 (behind court walls for this eye: 0; to be drawn: 31)

| people mesh | visible / hidden meshes | instances (count) | in frustum | < 60 m |
|---|---|---|---|---|
| world / humans:persian:shadow | 0 / 1 | 1 | 0 | 0 |
| world / humans:persian:shadow-far | 0 / 1 | 1 | 0 | 0 |
| world / humans:persian:lod# | 1 / 3 | 4 | 1 | 0 |
| world / humans:median:shadow | 0 / 1 | 1 | 0 | 0 |
| world / humans:median:shadow-far | 0 / 1 | 1 | 0 | 0 |
| world / humans:median:lod# | 0 / 4 | 4 | 0 | 0 |
| world / humans:worker:shadow | 0 / 1 | 1 | 0 | 0 |
| world / humans:worker:shadow-far | 1 / 0 | 1 | 1 | 0 |
| world / humans:worker:lod# | 2 / 2 | 4 | 2 | 0 |
| world / humans:woman:shadow | 0 / 1 | 1 | 0 | 0 |
| world / humans:woman:shadow-far | 1 / 0 | 1 | 1 | 0 |
| world / humans:woman:lod# | 2 / 2 | 4 | 2 | 0 |
| world / humans:child:shadow | 0 / 1 | 1 | 0 | 0 |
| world / humans:child:shadow-far | 0 / 1 | 1 | 0 | 0 |
| world / humans:child:lod# | 0 / 4 | 4 | 0 | 0 |
| world / humans:envoy:shadow | 1 / 0 | 1 | 1 | 1 |
| world / humans:envoy:shadow-far | 1 / 0 | 1 | 1 | 1 |
| world / humans:envoy:lod# | 2 / 2 | 4 | 2 | 2 |
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

people: sim out of doors within 60 m 54 (open ground 46, inside walled courts 0, walking 0; places {"palaces":1,"forecourt_wait":44,"stair_foot":1}; 250 m 574); crowd attached 400, skinned drawn 400 by LOD [24,29,0,347], impostors drawn 2324 of 4743 candidates

town roofs (150 m round [0,32]): up-facing area above 1.8 m 0 m², wall area 0 m², ratio null (0 triangles)

<details><summary>all classes (top 60 by triangles)</summary>

| object key | vis / hidden | inst in frustum | < 60 m | tris | mats | tiers |
|---|---|---|---|---|---|---|
| world / relief:figures | 9 / 3 | 927 | 0 | 1690000 | MeshStandardNodeMaterial | C |
| terrain | 208 / 0 | 85 | 2 | 963840 | MeshStandardNodeMaterial | C |
| world / treasury:arrow_bundle | 1 / 0 | 446 | 0 | 392480 | MeshStandardNodeMaterial | C |
| world / treasury:alabaster_vessel | 1 / 0 | 824 | 0 | 370800 | MeshStandardNodeMaterial | C |
| world / props:tools | 1 / 3 | 124 | 0 | 347696 | MeshStandardNodeMaterial |  |
| world / settlement:q_s#:far | 4 / 0 | 4 | 0 | 309062 | MeshStandardNodeMaterial | C |
| world / treasury:textile_bale | 1 / 0 | 382 | 0 | 216976 | MeshStandardNodeMaterial | C |
| world / work:hearth_pot | 1 / 0 | 34 | 0 | 178432 | MeshStandardNodeMaterial |  |
| world / plain-orchards-far | 1 / 0 | 1 | 0 | 176772 | MeshStandardNodeMaterial |  |
| world / river-banks | 1 / 0 | 1 | 0 | 159880 | MeshStandardNodeMaterial | C |
| world / plain-villages--#,-# | 2 / 0 | 2 | 0 | 142112 | MeshStandardNodeMaterial | C |
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
| world / work:brushwood | 1 / 0 | 34 | 0 | 70992 | MeshStandardNodeMaterial |  |
| world / treasury:sealed_jar | 1 / 0 | 225 | 0 | 69300 | MeshStandardNodeMaterial | C |
| world / treasury:shield | 1 / 0 | 149 | 0 | 65262 | MeshStandardNodeMaterial | C |
| world / ledges:far | 1 / 0 | 1 | 0 | 64270 | ledges |  |
| world / plain-canal-banks | 1 / 0 | 1 | 0 | 55524 | MeshStandardNodeMaterial | C |
| world / apadana:columns:shaft:lod# | 3 / 3 | 72 | 12 | 55296 | model:column_shaft_f48:0:limestone_carved, model:column_shaft_f48:1:limestone_carved | C |
| world / work:drying_rack | 1 / 0 | 26 | 0 | 53456 | MeshStandardNodeMaterial |  |
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
| world / props:carried | 1 / 0 | 9 | 0 | 36504 | MeshStandardNodeMaterial |  |
| world / plain-villages-#,# | 2 / 0 | 1 | 1 | 35002 | MeshStandardNodeMaterial | C |
| world / work:wash_stone | 1 / 0 | 26 | 0 | 34528 | MeshStandardNodeMaterial |  |
| world / animals:sheep:lod# | 1 / 1 | 34 | 0 | 33320 | MeshStandardNodeMaterial |  |
| world / relief:rosettes | 1 / 0 | 824 | 824 | 32960 | MeshStandardNodeMaterial | C |
| world / settlement:gardens:far | 1 / 0 | 1 | 1 | 31796 | MeshStandardNodeMaterial | C |
| world / harem:room_fittings:jars | 1 / 0 | 70 | 0 | 31080 | MeshStandardNodeMaterial | C |
| world / crown-merlons:apadana|#|-# | 1 / 0 | 141 | 0 | 28764 | decor:merlon:limestone_merlon | C |
| plain-qanats / qanat-tile:#,-# | 3 / 12 | 319 | 0 | 28710 | MeshStandardNodeMaterial | C |
| world / crown-merlons:apadana|-#|-# | 1 / 0 | 135 | 0 | 27540 | decor:merlon:limestone_merlon | C |
| world / crenellations | 1 / 0 | 134 | 68 | 27336 | decor:merlon:limestone_merlon | C |
| world / crown-merlons:terrace|#|-# | 2 / 0 | 223 | 0 | 26760 | decor:merlon:limestone_merlon | C |
| world / fire-body:torch:head | 1 / 0 | 28 | 0 | 26096 | MeshStandardNodeMaterial | C |
| world / treasury:gold_rhyton | 1 / 0 | 78 | 0 | 24492 | MeshStandardNodeMaterial | C |
| world / c#:dressings:cloth | 1 / 0 | 1 | 1 | 23770 | MeshStandardNodeMaterial | C |
| world / settlement:refuse | 1 / 0 | 1 | 1 | 21888 | MeshStandardNodeMaterial | C |

</details>

