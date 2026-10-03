# Page check (D-772): what the page draws vs what its simulation holds

Tree /home/user/fars-pc gitdir: /home/user/fars/.git/worktrees/fars-pc; built site (vite build, base /fars/), headless Chromium, ?test&norender&webgl=1&quality=test&court=seasonal; 2026-10-03T06:50:32.697Z.
Per view: objects effectively visible (every ancestor visible) and meeting the camera frustum, their instances and triangles;
hidden = present in the scene but visible=false somewhere up the chain. sim<60 m = population view + detailed agents within 60 m of the camera.

## Reading of this run (C12, s17-int 92d6a6bf built; 2026-10-03 ~06:55 UTC)

1. **The town lanes are empty in the SIMULATION, not only in the frames (C1).**
   - At the lane view cov-142 (day 88, 13:48), all 140 out-of-doors people within 60 m stand inside walled courts
     (place 'h', at home). None is on the lane, none is walking.
   - From 20 m up, the same: 127, all in courts.
   - At night, the lanes have 16 on open ground.
   - Day 88 is mid-July, so a midday rest is plausible, but a lane with nobody passing for 60 m is not.
   - The crowd is right not to draw people hidden behind 2 m walls from a lane-level eye.
2. **Seen from above, people in courts are not drawn (C5).**
   - At town20 (the eye 18 m higher than the lane view), 127 people in courts within 60 m become 2 skinned (LOD1) plus 25
     impostors of 161 candidates.
   - From the Terrace edge, Rahmat or any roof the courts should be full: the wall-sightline cull looks too strict for an
     eye above the wall tops.
3. **On the Terrace the page draws what the sim holds.**
   - The Terrace at noon (no court): 26 in the sim within 60 m, the crowd draws 104 skinned.
   - The Terrace with the court resident, 10:00: 62 within 60 m, 250 skinned (by LOD [0, 100, 42, 108]).
   - The Apadana at 08:48 (no court): the hall holds 2 people in the sim; 428 within 250 m, drawn as 111, mostly LOD3.
   - **So the "people simulated but not drawn" seen in the s17 frames is not in the scene graph at these views.** If
     rendered frames still show the Terrace empty, the loss is on the GPU side: draws skipped while their pipeline is
     not ready (three's isReady skip in the warm-up), the impostor atlas, or the coverage page's own load. That needs a
     rendered count (C6, Vagon), not a node one.
4. **Fields at dawn (day 126, 05:38) are empty in the sim:** nobody within 60 m, 102 within 250 m (C1, C3).
5. **Roofs are present in the geometry (C2: pass).** Within 150 m of the town views there are 18-20 k m² of up-facing
   surface standing 1.8 m or more above the local floor, against 76-87 k m² of wall faces (ratio 0.23 in every town view).
   If frames still show the town roofless, the fault is in drawing: material, side or depth.
6. **The far sun shadow reaches 2,000 m** (the s17 maxFar was 600): one shadow light, far 2,000, box 240 m.
7. **Night lamps are there:** 4,900 fire and lamp instances in the frustum at the town night view (13 within 60 m).

Not checked by this tool:
- **Anything about shading.** Painted surfaces read only as material names and tiers here; colour is a frame question.
- **Pipelines that fail validation.** Use `tools/dev/pipeline_census --check` (C9).

## Flags

- town20 [C5 people]: the sim holds 127 people out of doors within 60 m (0 on open ground, 127 in walled courts; 135 within 250 m); the crowd draws 2 skinned (by LOD [0,2,0,0]) + 25 impostors of 161 candidates, 144 attached
- lanes [C5 people]: the sim holds 140 people out of doors within 60 m (0 on open ground, 140 in walled courts; 282 within 250 m); the crowd draws 3 skinned (by LOD [0,0,0,3]) + 46 impostors of 184 candidates, 291 attached
- night [C5 people]: the sim holds 48 people out of doors within 60 m (16 on open ground, 32 in walled courts; 105 within 250 m); the crowd draws 29 skinned (by LOD [4,12,0,13]) + 0 impostors of 1196 candidates, 144 attached

Page errors (unique): 1
- 2x Failed to load resource: the server responded with a status of 404 (Not Found)

## town20: the town from 20 m up (roofs vs walls) (day 88, 13.805 h)

camera -871.9, -150.4, 4.4; sim people within 60 m: 127, within 250 m: 135; crowd stats: {"draws":2,"triangles":10911,"people":2,"byLod":[0,2,0,0],"shadowDraws":2,"shadowTriangles":1073,"propDraws":0,"props":0,"propTriangles":0,"propsDropped":0,"placeholderActs":0,"motionCapture":0,"motionAuthored":2,"things":{"draws":0,"instances":0,"triangles":0,"kinds":{},"dropped":0},"animals":{"dra

| class | meshes visible / hidden | instances in frustum | of them < 60 m | triangles in frustum |
|---|---|---|---|---|
| people (skinned, any LOD) | 4 / 46 | 0 | 0 | 0 |
| people LOD3 (far) | 0 / 0 | 0 | 0 | 0 |
| people impostors | 1 / 0 | 1 | 0 | 2 |
| house roofs | 13 / 5 | 0 | 0 | 0 |
| house walls | 3 / 0 | 0 | 0 | 0 |
| ground fill / props | 108 / 221 | 4 | 0 | 26138 |
| trees | 16 / 0 | 16 | 0 | 181066 |
| crops / flora | 25 / 38 | 71 | 66 | 13444 |
| fires / lamps | 13 / 1 | 2791 | 0 | 5582 |
| water | 10 / 4 | 4 | 1 | 274020 |
| animals | 131 / 12 | 182 | 51 | 96632 |
| terrace architecture | 113 / 221 | 927 | 0 | 1690000 |

shadow-casting lights: [{"name":"","far":2000,"size":[240]}]

people: sim out of doors within 60 m 127 (open ground 0, inside walled courts 127, walking 0; places {"h":127}; 250 m 135); crowd attached 144, skinned drawn 2 by LOD [0,2,0,0], impostors drawn 25 of 161 candidates

town roofs (150 m round [-852,-196]): up-facing area above 1.8 m 19681 m², wall area 84443 m², ratio 0.233 (214755 triangles)

<details><summary>all classes (top 60 by triangles)</summary>

| object key | vis / hidden | inst in frustum | < 60 m | tris | mats | tiers |
|---|---|---|---|---|---|---|
| world / relief:figures | 9 / 3 | 927 | 0 | 1690000 | MeshStandardNodeMaterial | C |
| terrain | 208 / 0 | 71 | 1 | 765952 | MeshStandardNodeMaterial | C |
| world / settlement:q_s#:far | 4 / 0 | 4 | 0 | 403750 | MeshStandardNodeMaterial | C |
| world / plain-orchards-far | 1 / 0 | 1 | 0 | 176772 | MeshStandardNodeMaterial |  |
| world / river-banks | 1 / 0 | 1 | 0 | 159880 | MeshStandardNodeMaterial | C |
| world / settlement:q_b#:far | 5 / 0 | 1 | 0 | 122486 | MeshStandardNodeMaterial | C |
| world / settlement:ground | 1 / 0 | 1 | 1 | 96532 | MeshStandardNodeMaterial | C |
| world / settlement:q_w#:far | 3 / 0 | 1 | 1 | 89292 | MeshStandardNodeMaterial | C |
| world / settlement:near:plaster | 1 / 0 | 1 | 0 | 86685 | MeshStandardNodeMaterial | C |
| world / plain-stone | 1 / 0 | 1 | 1 | 84008 | MeshStandardNodeMaterial | C |
| world / plain-tracks | 1 / 0 | 1 | 0 | 75768 | MeshStandardNodeMaterial | C |
| world / plain-canal-banks | 1 / 0 | 1 | 0 | 55524 | MeshStandardNodeMaterial | C |
| world / plain-villages--#,-# | 2 / 0 | 1 | 0 | 51428 | MeshStandardNodeMaterial | C |
| world / river-water | 1 / 0 | 1 | 0 | 50324 | MeshStandardNodeMaterial |  |
| world / settlement:near:timber | 1 / 0 | 1 | 0 | 50213 | MeshStandardNodeMaterial | C |
| world / animals:sheep:lod# | 2 / 0 | 47 | 0 | 46060 | MeshStandardNodeMaterial |  |
| world / settlement:gardens:far | 1 / 0 | 1 | 1 | 42334 | MeshStandardNodeMaterial | C |
| world / interiors:cloth | 1 / 0 | 1 | 0 | 37605 | MeshStandardNodeMaterial | C |
| world / animals:goat:lod# | 2 / 0 | 38 | 0 | 37240 | MeshStandardNodeMaterial |  |
| world / settlement:near:items | 1 / 0 | 1 | 0 | 36105 | MeshStandardNodeMaterial | C |
| world / plain-villages-#,# | 2 / 0 | 1 | 1 | 30688 | MeshStandardNodeMaterial | C |
| world / ledges:far | 1 / 0 | 1 | 0 | 28850 | ledges |  |
| plain-qanats / qanat-tile:#,-# | 2 / 14 | 318 | 0 | 28620 | MeshStandardNodeMaterial | C |
| world / settlement:near:props | 1 / 0 | 1 | 0 | 24302 | MeshStandardNodeMaterial | C |
| world / settlement:refuse | 1 / 0 | 1 | 1 | 22176 | MeshStandardNodeMaterial | C |
| world / settlement:roads | 1 / 0 | 1 | 1 | 20956 | MeshStandardNodeMaterial | C |
| world / settlement:near:stone | 1 / 0 | 1 | 0 | 14130 | MeshStandardNodeMaterial | C |
| world / interiors:clay | 1 / 0 | 1 | 0 | 12082 | MeshStandardNodeMaterial | C |
| world / settlement:water | 1 / 0 | 1 | 1 | 8292 | MeshStandardNodeMaterial | C |
| world / rock-stone:namaqualand_stones_#_v#:lod# | 10 / 0 | 34 | 34 | 6786 | scan:namaqualand_stones_01_v1, scan:namaqualand_stones_01_v2, scan:namaqualand_stones_01_v3, scan:namaqualand_stones_01_v4 |  |
| world / rock-stone:namaqualand_rocks_#_v#:lod# | 8 / 0 | 23 | 23 | 5745 | scan:namaqualand_rocks_01_v1, scan:namaqualand_rocks_01_v2, scan:namaqualand_rocks_01_v3, scan:namaqualand_rocks_01_v4 |  |
| world / flora-camelthorn:model:lod# | 2 / 0 | 22 | 22 | 5280 | life:camelthorn |  |
| world / flora-cushion:model:lod# | 2 / 0 | 23 | 23 | 4324 | life:cushion |  |
| world / fire | 1 / 0 | 2141 | 0 | 4282 | MeshBasicNodeMaterial |  |
| world / bird-chukar:stand# | 2 / 0 | 24 | 0 | 4224 | life:chukar |  |
| world / rock-boulder:namaqualand_boulder_#:lod# | 10 / 0 | 8 | 1 | 3048 | scan:namaqualand_boulder_02, scan:namaqualand_boulder_03, scan:namaqualand_boulder_04, scan:namaqualand_boulder_05 |  |
| Points | 1 / 0 | 1 | 0 | 2973 | PointsNodeMaterial |  |
| world / court-camps:ridge:shell | 1 / 0 | 179 | 0 | 2864 | MeshStandardNodeMaterial | C |
| world / bird-crow:stand# | 2 / 0 | 12 | 0 | 2112 | life:crow |  |
| world / settlement:near:brick | 1 / 0 | 1 | 0 | 2031 | MeshStandardNodeMaterial | B/C |
| world / rock-stone:rock_#:lod# | 4 / 0 | 16 | 16 | 1953 | scan:rock_07, scan:rock_09 |  |
| plain-field-fill / field:fill_stall_reed:lod# | 1 / 1 | 3 | 0 | 1836 | MeshStandardNodeMaterial | C |
| world / flora-thistle:model:lod# | 2 / 0 | 21 | 21 | 1806 | life:thistle |  |
| world / settlement:burial_ground_town:stone | 1 / 0 | 1 | 0 | 1740 | MeshStandardNodeMaterial | C |
| world / fauna:camp-lines:t_west | 1 / 0 | 1 | 0 | 1720 | MeshStandardNodeMaterial |  |
| world / court-camps:black:shell | 1 / 0 | 111 | 0 | 1554 | MeshStandardNodeMaterial | C |
| world / fire:coals | 1 / 0 | 650 | 0 | 1300 | MeshBasicNodeMaterial |  |
| world / rock-stone:stone_#:lod# | 2 / 0 | 10 | 10 | 1190 | scan:stone_01 |  |
| world / rock-boulder:rock_face_#:lod# | 2 / 0 | 2 | 2 | 1000 | scan:rock_face_02 |  |
| Mesh | 2 / 2 | 2 | 0 | 972 | MeshBasicNodeMaterial, NodeMaterial |  |
| world / settlement:trees-wood-lod# | 2 / 0 | 2 | 0 | 896 | MeshStandardNodeMaterial |  |
| world / plain-trees-wood-lod# | 2 / 0 | 2 | 0 | 896 | MeshStandardNodeMaterial |  |
| world / settlement:trees-leaves-lod# | 2 / 0 | 2 | 0 | 880 | MeshStandardNodeMaterial |  |
| world / plain-trees-leaves-lod# | 2 / 0 | 2 | 0 | 880 | MeshStandardNodeMaterial |  |
| world / cover-dung:dung_horse:lod# | 2 / 1 | 15 | 15 | 540 | ground-cover |  |
| world / small-lizard:lod# | 2 / 0 | 1 | 1 | 320 | life:lizard |  |
| world / bird-crow:fly# | 3 / 0 | 5 | 0 | 300 | life:crow |  |
| world / cover-dung:dung_sheep:lod# | 2 / 1 | 14 | 14 | 252 | ground-cover |  |
| world / settlement:trees-noshadow-leaves-lod# | 1 / 0 | 1 | 0 | 240 | MeshStandardNodeMaterial |  |
| world / plain-trees-noshadow-leaves-lod# | 1 / 0 | 1 | 0 | 240 | MeshStandardNodeMaterial |  |

</details>

## lanes: a town lane, afternoon (cov-142) (day 88, 13.805 h)

camera -871.9, -150.4, -14; sim people within 60 m: 140, within 250 m: 282; crowd stats: {"draws":3,"triangles":1793,"people":3,"byLod":[0,0,0,3],"shadowDraws":0,"shadowTriangles":0,"propDraws":1,"props":2,"propTriangles":8112,"propsDropped":0,"placeholderActs":0,"motionCapture":0,"motionAuthored":3,"things":{"draws":0,"instances":0,"triangles":0,"kinds":{},"dropped":0},"animals":{"draw

| class | meshes visible / hidden | instances in frustum | of them < 60 m | triangles in frustum |
|---|---|---|---|---|
| people (skinned, any LOD) | 3 / 47 | 2 | 2 | 1104 |
| people LOD3 (far) | 0 / 0 | 0 | 0 | 0 |
| people impostors | 1 / 0 | 1 | 0 | 2 |
| house roofs | 13 / 5 | 0 | 0 | 0 |
| house walls | 3 / 0 | 0 | 0 | 0 |
| ground fill / props | 109 / 220 | 46 | 41 | 32315 |
| trees | 16 / 0 | 16 | 0 | 181066 |
| crops / flora | 25 / 38 | 66 | 60 | 14516 |
| fires / lamps | 13 / 1 | 2929 | 4 | 5858 |
| water | 10 / 4 | 4 | 1 | 274020 |
| animals | 132 / 12 | 184 | 52 | 104585 |
| terrace architecture | 113 / 221 | 927 | 0 | 1690000 |

shadow-casting lights: [{"name":"","far":2000,"size":[240]}]

people: sim out of doors within 60 m 140 (open ground 0, inside walled courts 140, walking 0; places {"h":140}; 250 m 282); crowd attached 291, skinned drawn 3 by LOD [0,0,0,3], impostors drawn 46 of 184 candidates

town roofs (150 m round [-811,-287]): up-facing area above 1.8 m 1100 m², wall area 4920 m², ratio 0.224 (23932 triangles)

<details><summary>all classes (top 60 by triangles)</summary>

| object key | vis / hidden | inst in frustum | < 60 m | tris | mats | tiers |
|---|---|---|---|---|---|---|
| world / relief:figures | 9 / 3 | 927 | 0 | 1690000 | MeshStandardNodeMaterial | C |
| terrain | 208 / 0 | 74 | 2 | 775680 | MeshStandardNodeMaterial | C |
| world / settlement:q_s#:far | 4 / 0 | 4 | 0 | 403750 | MeshStandardNodeMaterial | C |
| world / plain-orchards-far | 1 / 0 | 1 | 0 | 176772 | MeshStandardNodeMaterial |  |
| world / river-banks | 1 / 0 | 1 | 0 | 159880 | MeshStandardNodeMaterial | C |
| world / settlement:q_b#:far | 5 / 0 | 1 | 0 | 122486 | MeshStandardNodeMaterial | C |
| world / settlement:ground | 1 / 0 | 1 | 1 | 96532 | MeshStandardNodeMaterial | C |
| world / settlement:q_w#:far | 3 / 0 | 1 | 1 | 89292 | MeshStandardNodeMaterial | C |
| world / settlement:near:plaster | 1 / 0 | 1 | 0 | 86685 | MeshStandardNodeMaterial | C |
| world / plain-stone | 1 / 0 | 1 | 1 | 84008 | MeshStandardNodeMaterial | C |
| world / plain-tracks | 1 / 0 | 1 | 0 | 75768 | MeshStandardNodeMaterial | C |
| world / plain-canal-banks | 1 / 0 | 1 | 0 | 55524 | MeshStandardNodeMaterial | C |
| world / plain-villages--#,-# | 2 / 0 | 1 | 0 | 51428 | MeshStandardNodeMaterial | C |
| world / river-water | 1 / 0 | 1 | 0 | 50324 | MeshStandardNodeMaterial |  |
| world / settlement:near:timber | 1 / 0 | 1 | 0 | 50213 | MeshStandardNodeMaterial | C |
| world / animals:sheep:lod# | 2 / 0 | 47 | 0 | 46060 | MeshStandardNodeMaterial |  |
| world / settlement:gardens:far | 1 / 0 | 1 | 1 | 42334 | MeshStandardNodeMaterial | C |
| world / interiors:cloth | 1 / 0 | 1 | 0 | 37605 | MeshStandardNodeMaterial | C |
| world / animals:goat:lod# | 2 / 0 | 38 | 0 | 37240 | MeshStandardNodeMaterial |  |
| world / settlement:near:items | 1 / 0 | 1 | 0 | 36105 | MeshStandardNodeMaterial | C |
| world / plain-villages-#,# | 2 / 0 | 1 | 1 | 30688 | MeshStandardNodeMaterial | C |
| world / ledges:far | 1 / 0 | 1 | 0 | 28850 | ledges |  |
| plain-qanats / qanat-tile:#,-# | 2 / 14 | 318 | 0 | 28620 | MeshStandardNodeMaterial | C |
| world / settlement:near:props | 1 / 0 | 1 | 0 | 24302 | MeshStandardNodeMaterial | C |
| world / settlement:refuse | 1 / 0 | 1 | 1 | 22176 | MeshStandardNodeMaterial | C |
| world / settlement:roads | 1 / 0 | 1 | 1 | 20956 | MeshStandardNodeMaterial | C |
| world / settlement:near:stone | 1 / 0 | 1 | 0 | 14130 | MeshStandardNodeMaterial | C |
| world / interiors:clay | 1 / 0 | 1 | 0 | 12082 | MeshStandardNodeMaterial | C |
| world / rock-stone:namaqualand_stones_#_v#:lod# | 10 / 0 | 33 | 33 | 9385 | scan:namaqualand_stones_01_v1, scan:namaqualand_stones_01_v2, scan:namaqualand_stones_01_v3, scan:namaqualand_stones_01_v4 |  |
| world / rock-stone:namaqualand_rocks_#_v#:lod# | 8 / 0 | 24 | 24 | 8843 | scan:namaqualand_rocks_01_v1, scan:namaqualand_rocks_01_v2, scan:namaqualand_rocks_01_v3, scan:namaqualand_rocks_01_v4 |  |
| world / settlement:water | 1 / 0 | 1 | 1 | 8292 | MeshStandardNodeMaterial | C |
| world / flora-camelthorn:model:lod# | 2 / 0 | 23 | 23 | 6648 | life:camelthorn |  |
| world / animals:donkey:lod# | 2 / 1 | 1 | 1 | 5879 | MeshStandardNodeMaterial |  |
| world / fire | 1 / 0 | 2241 | 3 | 4482 | MeshBasicNodeMaterial |  |
| world / bird-chukar:stand# | 2 / 0 | 24 | 0 | 4224 | life:chukar |  |
| world / flora-cushion:model:lod# | 2 / 0 | 20 | 20 | 3760 | life:cushion |  |
| world / rock-boulder:namaqualand_boulder_#:lod# | 10 / 0 | 8 | 2 | 3048 | scan:namaqualand_boulder_02, scan:namaqualand_boulder_03, scan:namaqualand_boulder_04, scan:namaqualand_boulder_05 |  |
| Points | 1 / 0 | 1 | 0 | 2973 | PointsNodeMaterial |  |
| world / court-camps:ridge:shell | 1 / 0 | 179 | 0 | 2864 | MeshStandardNodeMaterial | C |
| world / rock-stone:rock_#:lod# | 4 / 0 | 16 | 16 | 2513 | scan:rock_07, scan:rock_09 |  |
| plain-field-fill / field:fill_stall_reed:lod# | 1 / 1 | 4 | 0 | 2448 | MeshStandardNodeMaterial | C |
| world / settlement:near:brick | 1 / 0 | 1 | 0 | 2031 | MeshStandardNodeMaterial | B/C |
| world / bird-crow:stand# | 2 / 0 | 11 | 0 | 1936 | life:crow |  |
| world / rock-stone:stone_#:lod# | 2 / 0 | 12 | 12 | 1909 | scan:stone_01 |  |
| world / settlement:burial_ground_town:stone | 1 / 0 | 1 | 0 | 1740 | MeshStandardNodeMaterial | C |
| world / small-lizard:lod# | 2 / 0 | 2 | 2 | 1720 | life:lizard |  |
| world / fauna:camp-lines:t_west | 1 / 0 | 1 | 0 | 1720 | MeshStandardNodeMaterial |  |
| world / court-camps:black:shell | 1 / 0 | 111 | 0 | 1554 | MeshStandardNodeMaterial | C |
| world / flora-thistle:model:lod# | 2 / 0 | 17 | 17 | 1462 | life:thistle |  |
| world / fire:coals | 1 / 0 | 688 | 1 | 1376 | MeshBasicNodeMaterial |  |
| Mesh | 2 / 2 | 2 | 0 | 972 | MeshBasicNodeMaterial, NodeMaterial |  |
| world / settlement:trees-wood-lod# | 2 / 0 | 2 | 0 | 896 | MeshStandardNodeMaterial |  |
| world / plain-trees-wood-lod# | 2 / 0 | 2 | 0 | 896 | MeshStandardNodeMaterial |  |
| world / fill:mat:matting:lod# | 2 / 1 | 1 | 1 | 895 | MeshStandardNodeMaterial | C |
| world / settlement:trees-leaves-lod# | 2 / 0 | 2 | 0 | 880 | MeshStandardNodeMaterial |  |
| world / plain-trees-leaves-lod# | 2 / 0 | 2 | 0 | 880 | MeshStandardNodeMaterial |  |
| world / cover-dung:dung_horse:lod# | 2 / 1 | 14 | 14 | 816 | ground-cover |  |
| world / cover-dung:dung_sheep:lod# | 2 / 1 | 14 | 14 | 738 | ground-cover |  |
| world / humans:worker:lod# | 1 / 3 | 1 | 1 | 720 | human |  |
| world / fill:wo_spoil:earth:lod# | 1 / 2 | 4 | 4 | 704 | MeshStandardNodeMaterial | C |

</details>

## court: a town court, noon (cov-037) (day 14, 11.07 h)

camera -535.4, 401.1, -12; sim people within 60 m: 59, within 250 m: 70; crowd stats: {"draws":7,"triangles":52291,"people":17,"byLod":[1,1,0,15],"shadowDraws":2,"shadowTriangles":3168,"propDraws":4,"props":18,"propTriangles":64732,"propsDropped":0,"placeholderActs":0,"motionCapture":4,"motionAuthored":13,"things":{"draws":6,"instances":6,"triangles":5876,"kinds":{"beam":1,"anvil":1,

| class | meshes visible / hidden | instances in frustum | of them < 60 m | triangles in frustum |
|---|---|---|---|---|
| people (skinned, any LOD) | 9 / 41 | 9 | 7 | 49196 |
| people LOD3 (far) | 0 / 0 | 0 | 0 | 0 |
| people impostors | 1 / 0 | 1 | 0 | 2 |
| house roofs | 13 / 5 | 13 | 8 | 3434 |
| house walls | 3 / 0 | 0 | 0 | 0 |
| ground fill / props | 114 / 215 | 324 | 232 | 144914 |
| trees | 16 / 0 | 16 | 0 | 181066 |
| crops / flora | 25 / 38 | 60 | 14 | 8744 |
| fires / lamps | 13 / 1 | 2998 | 59 | 7622 |
| water | 11 / 3 | 33 | 21 | 307732 |
| animals | 136 / 8 | 283 | 35 | 221935 |
| terrace architecture | 115 / 219 | 928 | 0 | 1690012 |

shadow-casting lights: [{"name":"","far":2000,"size":[240]}]

people: sim out of doors within 60 m 59 (open ground 16, inside walled courts 43, walking 0; places {"h":47,"lane":12}; 250 m 70); crowd attached 323, skinned drawn 17 by LOD [1,1,0,15], impostors drawn 12 of 295 candidates

town roofs (150 m round [-423,500]): up-facing area above 1.8 m 18186 m², wall area 76312 m², ratio 0.238 (190540 triangles)

<details><summary>all classes (top 60 by triangles)</summary>

| object key | vis / hidden | inst in frustum | < 60 m | tris | mats | tiers |
|---|---|---|---|---|---|---|
| world / relief:figures | 9 / 3 | 927 | 0 | 1690000 | MeshStandardNodeMaterial | C |
| terrain | 208 / 0 | 71 | 2 | 847616 | MeshStandardNodeMaterial | C |
| world / plain-orchards-far | 1 / 0 | 1 | 0 | 176772 | MeshStandardNodeMaterial |  |
| world / river-banks | 1 / 0 | 1 | 0 | 159880 | MeshStandardNodeMaterial | C |
| world / settlement:near:plaster | 1 / 0 | 1 | 0 | 155812 | MeshStandardNodeMaterial | C |
| world / plain-villages-#,# | 2 / 0 | 2 | 1 | 108388 | MeshStandardNodeMaterial | C |
| world / settlement:ground | 1 / 0 | 1 | 1 | 96532 | MeshStandardNodeMaterial | C |
| world / settlement:near:timber | 1 / 0 | 1 | 0 | 89284 | MeshStandardNodeMaterial | C |
| world / plain-stone | 1 / 0 | 1 | 1 | 84008 | MeshStandardNodeMaterial | C |
| world / plain-tracks | 1 / 0 | 1 | 0 | 75768 | MeshStandardNodeMaterial | C |
| world / settlement:q_w#:far | 3 / 0 | 1 | 1 | 71056 | MeshStandardNodeMaterial | C |
| world / settlement:near:items | 1 / 0 | 1 | 0 | 66328 | MeshStandardNodeMaterial | C |
| world / animals:sheep:lod# | 2 / 0 | 66 | 0 | 64680 | MeshStandardNodeMaterial |  |
| world / props:carried | 1 / 0 | 14 | 4 | 56784 | MeshStandardNodeMaterial |  |
| world / plain-canal-banks | 1 / 0 | 1 | 0 | 55524 | MeshStandardNodeMaterial | C |
| world / animals:goat:lod# | 2 / 0 | 55 | 6 | 53900 | MeshStandardNodeMaterial |  |
| world / river-water | 1 / 0 | 1 | 0 | 50324 | MeshStandardNodeMaterial |  |
| world / settlement:q_b#:far | 5 / 0 | 1 | 0 | 49958 | MeshStandardNodeMaterial | C |
| world / interiors:cloth | 1 / 0 | 1 | 0 | 48801 | MeshStandardNodeMaterial | C |
| world / ledges:far | 1 / 0 | 1 | 0 | 44560 | ledges |  |
| world / settlement:gardens:far | 1 / 0 | 1 | 1 | 42334 | MeshStandardNodeMaterial | C |
| world / settlement:q_n#:far | 1 / 0 | 1 | 0 | 42278 | MeshStandardNodeMaterial | C |
| world / humans:woman:lod# | 2 / 2 | 2 | 2 | 36531 | human |  |
| world / settlement:near:props | 1 / 0 | 1 | 0 | 36376 | MeshStandardNodeMaterial | C |
| world / nr-cliff | 1 / 0 | 1 | 0 | 33260 | MeshStandardNodeMaterial | C |
| world / animals:hen:lod# | 1 / 0 | 44 | 13 | 27544 | MeshStandardNodeMaterial |  |
| world / animals:dog:lod# | 1 / 0 | 26 | 2 | 25428 | MeshStandardNodeMaterial |  |
| world / settlement:near:stone | 1 / 0 | 1 | 0 | 22748 | MeshStandardNodeMaterial | C |
| world / settlement:refuse | 1 / 0 | 1 | 1 | 22176 | MeshStandardNodeMaterial | C |
| world / settlement:roads | 1 / 0 | 1 | 1 | 20956 | MeshStandardNodeMaterial | C |
| world / settlement:channel_stones | 1 / 0 | 1 | 0 | 20180 | MeshStandardNodeMaterial | C |
| world / animals:donkey:lod# | 3 / 0 | 7 | 5 | 17633 | MeshStandardNodeMaterial |  |
| quarries-detail / plain-quarries:rock:quarry_sivand | 1 / 0 | 1 | 0 | 13745 | bedrock:ground |  |
| plain-qanats / qanat-tile:#,# | 3 / 13 | 151 | 0 | 13590 | MeshStandardNodeMaterial | C |
| world / settlement:q_g#:far | 1 / 0 | 1 | 0 | 12820 | MeshStandardNodeMaterial | C |
| world / interiors:clay | 1 / 0 | 1 | 0 | 11860 | MeshStandardNodeMaterial | C |
| world / nr_darius_tomb | 1 / 0 | 1 | 0 | 11154 | MeshStandardNodeMaterial | C |
| world / nr_xerxes_tomb | 1 / 0 | 1 | 0 | 11154 | MeshStandardNodeMaterial | C |
| world / animals:mule:lod# | 1 / 0 | 7 | 0 | 9597 | MeshStandardNodeMaterial |  |
| world / settlement-doors:# | 6 / 0 | 46 | 16 | 8668 | MeshStandardNodeMaterial | C |
| world / settlement:water | 1 / 0 | 1 | 1 | 8292 | MeshStandardNodeMaterial | C |
| world / animals:horse:lod# | 1 / 0 | 6 | 0 | 8226 | MeshStandardNodeMaterial |  |
| world / settlement:canal_banks | 1 / 0 | 1 | 0 | 7836 | MeshStandardNodeMaterial | C |
| world / humans:worker:lod# | 2 / 2 | 2 | 2 | 7581 | human |  |
| world / settlement:official:far | 1 / 0 | 1 | 0 | 6756 | MeshStandardNodeMaterial | C |
| world / props:tools | 2 / 1 | 3 | 2 | 6646 | MeshStandardNodeMaterial |  |
| world / bedrock-ground:talus#:lod# | 1 / 2 | 75 | 0 | 5925 | bedrock:ground |  |
| world / fill:jar_water:clay:lod# | 3 / 0 | 27 | 20 | 5696 | MeshStandardNodeMaterial | C |
| world / animals:cock:lod# | 1 / 0 | 7 | 1 | 4382 | MeshStandardNodeMaterial |  |
| world / fire | 1 / 0 | 2076 | 34 | 4152 | MeshBasicNodeMaterial |  |
| world / bedrock-ground:outcrop#:lod# | 1 / 2 | 35 | 0 | 3430 | bedrock:ground |  |
| world / fill:fill_line:cloth_a:lod# | 3 / 0 | 20 | 11 | 3360 | MeshStandardNodeMaterial | C |
| world / fill:fill_bundle:wood:lod# | 3 / 0 | 11 | 11 | 3339 | MeshStandardNodeMaterial | C |
| world / fill:wo_dung_cakes:dung:lod# | 2 / 1 | 23 | 14 | 3300 | MeshStandardNodeMaterial | C |
| Points | 1 / 0 | 1 | 0 | 2973 | PointsNodeMaterial |  |
| world / fill:mat:matting:lod# | 2 / 1 | 13 | 8 | 2945 | MeshStandardNodeMaterial | C |
| world / settlement:near:brick | 1 / 0 | 1 | 0 | 2856 | MeshStandardNodeMaterial | B/C |
| world / fill:fill_line:cloth_b:lod# | 3 / 0 | 20 | 11 | 2740 | MeshStandardNodeMaterial | C |
| world / roofwear:drip_jar:clay | 1 / 0 | 6 | 4 | 2664 | MeshStandardNodeMaterial | C |
| world / fill:jar_store:clay:lod# | 2 / 1 | 20 | 13 | 2648 | MeshStandardNodeMaterial | C |

</details>

## terrace: the Terrace, noon (cov-252) (day 168, 12.586 h)

camera 84.8, 9.8, 1.6; sim people within 60 m: 26, within 250 m: 140; crowd stats: {"draws":8,"triangles":249593,"people":104,"byLod":[0,30,0,74],"shadowDraws":4,"shadowTriangles":20478,"propDraws":3,"props":59,"propTriangles":232606,"propsDropped":0,"placeholderActs":0,"motionCapture":23,"motionAuthored":81,"things":{"draws":2,"instances":2,"triangles":2440,"kinds":{"knucklebones

| class | meshes visible / hidden | instances in frustum | of them < 60 m | triangles in frustum |
|---|---|---|---|---|
| people (skinned, any LOD) | 12 / 38 | 12 | 10 | 28989 |
| people LOD3 (far) | 0 / 0 | 0 | 0 | 0 |
| people impostors | 1 / 0 | 1 | 0 | 2 |
| house roofs | 11 / 7 | 177 | 2 | 2712 |
| house walls | 3 / 0 | 8 | 0 | 528 |
| ground fill / props | 26 / 303 | 98 | 58 | 232347 |
| trees | 16 / 0 | 16 | 0 | 181066 |
| crops / flora | 19 / 44 | 186 | 0 | 24690 |
| fires / lamps | 10 / 4 | 2280 | 6 | 30272 |
| water | 9 / 5 | 8 | 4 | 283976 |
| animals | 127 / 19 | 193 | 0 | 142923 |
| terrace architecture | 133 / 201 | 1049 | 11 | 1826232 |

shadow-casting lights: [{"name":"","far":2000,"size":[240]}]

people: sim out of doors within 60 m 26 (open ground 11, inside walled courts 0, walking 0; places {"h100_door_N1":7,"worksite":4}; 250 m 140); crowd attached 150, skinned drawn 104 by LOD [0,30,0,74], impostors drawn 8 of 507 candidates

town roofs (150 m round [145,11]): up-facing area above 1.8 m 0 m², wall area 0 m², ratio null (0 triangles)

<details><summary>all classes (top 60 by triangles)</summary>

| object key | vis / hidden | inst in frustum | < 60 m | tris | mats | tiers |
|---|---|---|---|---|---|---|
| world / relief:figures | 9 / 3 | 927 | 0 | 1690000 | MeshStandardNodeMaterial | C |
| terrain | 208 / 0 | 72 | 2 | 752640 | MeshStandardNodeMaterial | C |
| world / garrison:room_fittings:bedrolls | 1 / 0 | 624 | 0 | 469248 | MeshStandardNodeMaterial | C |
| world / garrison:room_fittings:mats | 1 / 0 | 416 | 0 | 372320 | MeshStandardNodeMaterial | C |
| world / props:carried | 1 / 0 | 54 | 17 | 219024 | MeshStandardNodeMaterial |  |
| world / garrison:room_fittings:mats_b | 1 / 0 | 208 | 0 | 186160 | MeshStandardNodeMaterial | C |
| world / plain-orchards-far | 1 / 0 | 1 | 0 | 176772 | MeshStandardNodeMaterial |  |
| world / river-banks | 1 / 0 | 1 | 0 | 159880 | MeshStandardNodeMaterial | C |
| world / plain-villages-#,# | 2 / 0 | 2 | 1 | 108388 | MeshStandardNodeMaterial | C |
| world / settlement:ground | 1 / 0 | 1 | 1 | 96532 | MeshStandardNodeMaterial | C |
| world / work:objects | 1 / 0 | 1 | 1 | 92036 | MeshStandardNodeMaterial |  |
| world / animals:sheep:lod# | 1 / 1 | 91 | 0 | 89180 | MeshStandardNodeMaterial |  |
| world / plain-stone | 1 / 0 | 1 | 1 | 84008 | MeshStandardNodeMaterial | C |
| world / plain-tracks | 1 / 0 | 1 | 0 | 75768 | MeshStandardNodeMaterial | C |
| world / ledges:far | 1 / 0 | 1 | 0 | 66670 | ledges |  |
| world / fortification_e:mudbrick | 2 / 0 | 2 | 2 | 66540 | MeshStandardNodeMaterial | B/C |
| world / plain-canal-banks | 1 / 0 | 1 | 0 | 55524 | MeshStandardNodeMaterial | C |
| world / relief:far-set | 8 / 1 | 1 | 1 | 52314 | MeshStandardNodeMaterial | C |
| world / river-water | 1 / 0 | 1 | 0 | 50324 | MeshStandardNodeMaterial |  |
| world / animals:goat:lod# | 1 / 1 | 48 | 0 | 47040 | MeshStandardNodeMaterial |  |
| world / hall#:construction:base_bell:lod# | 1 / 1 | 95 | 26 | 43320 | model:column_base_bell:0:limestone_carved, model:column_base_bell:1:limestone_carved | C |
| world / settlement:gardens:far | 1 / 0 | 1 | 1 | 42334 | MeshStandardNodeMaterial | C |
| world / treasury:arrow_bundle | 1 / 0 | 40 | 0 | 35200 | MeshStandardNodeMaterial | C |
| world / treasury:alabaster_vessel | 1 / 0 | 69 | 0 | 31050 | MeshStandardNodeMaterial | C |
| world / treasury:mudbrick | 1 / 0 | 1 | 0 | 24072 | MeshStandardNodeMaterial | B/C |
| world / c#:dressings:cloth | 1 / 0 | 1 | 1 | 23770 | MeshStandardNodeMaterial | C |
| world / scribes:tablets_filed | 1 / 0 | 294 | 0 | 22344 | clay-writing |  |
| world / settlement:refuse | 1 / 0 | 1 | 1 | 22176 | MeshStandardNodeMaterial | C |
| world / treasury:mudbrick_painted | 2 / 0 | 2 | 0 | 21544 | MeshStandardNodeMaterial | B/C |
| world / hall#:construction:#|#|#:shaft:lod# | 7 / 7 | 48 | 11 | 21504 | model:column_shaft_f40:0:limestone_carved, model:column_shaft_f40:1:limestone_carved, model:column_shaft_drums:0:limestone_carved, model:column_shaft_drums:1:limestone_carved | C |
| world / settlement:roads | 1 / 0 | 1 | 1 | 20956 | MeshStandardNodeMaterial | C |
| world / garrison:mudbrick | 1 / 0 | 1 | 1 | 20292 | MeshStandardNodeMaterial | B/C |
| world / fire-body:hearth:stone | 1 / 0 | 9 | 1 | 19800 | MeshStandardNodeMaterial | C |
| world / bedrock-ground:outcrop#:lod# | 2 / 1 | 123 | 0 | 18580 | bedrock:ground |  |
| world / apadana:mudbrick | 1 / 0 | 1 | 1 | 18212 | MeshStandardNodeMaterial | B/C |
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
| plain-qanats / qanat-tile:#,# | 3 / 13 | 99 | 0 | 8910 | MeshStandardNodeMaterial | C |
| world / treasury:chert_set | 1 / 0 | 30 | 0 | 8340 | MeshStandardNodeMaterial | C |
| world / settlement:water | 1 / 0 | 1 | 1 | 8292 | MeshStandardNodeMaterial | C |
| world / scribes:furnishings | 1 / 0 | 1 | 0 | 8096 | MeshStandardNodeMaterial | C |
| world / garrison:columns:base_square#:lod# | 1 / 1 | 36 | 0 | 8064 | model:column_base_square2:0:limestone_carved, model:column_base_square2:1:limestone_carved | C |
| world / props:tools | 2 / 1 | 3 | 0 | 7974 | MeshStandardNodeMaterial |  |
| world / settlement:canal_banks | 1 / 0 | 1 | 0 | 7836 | MeshStandardNodeMaterial | C |
| world / humans:worker:lod# | 2 / 2 | 2 | 2 | 7581 | human |  |
| world / bedrock-ground:talus#:lod#:cast | 1 / 0 | 89 | 0 | 7031 | bedrock:ground |  |
| world / treasury:silver_phiale | 1 / 0 | 19 | 0 | 6802 | MeshStandardNodeMaterial | C |
| world / treasury:bitumen_jar | 1 / 0 | 22 | 0 | 6776 | MeshStandardNodeMaterial | C |
| world / terrace-foot:blocks | 1 / 0 | 1 | 1 | 6745 | MeshStandardNodeMaterial | C |
| world / garrison:timber:ceiling | 1 / 0 | 1 | 1 | 6576 | MeshStandardNodeMaterial | C |
| world / humans:median:lod# | 2 / 2 | 2 | 1 | 6483 | human |  |
| world / hall#:mudbrick_bare | 1 / 0 | 1 | 1 | 6460 | MeshStandardNodeMaterial | C |

</details>

## terrace_court: the Terrace at 10:00 with the court resident (day 40) (day 40, 10 h)

camera 84.8, 9.8, 1.6; sim people within 60 m: 62, within 250 m: 306; crowd stats: {"draws":9,"triangles":877235,"people":250,"byLod":[0,100,42,108],"shadowDraws":4,"shadowTriangles":101118,"propDraws":3,"props":182,"propTriangles":731494,"propsDropped":0,"placeholderActs":0,"motionCapture":37,"motionAuthored":213,"things":{"draws":4,"instances":17,"triangles":17580,"kinds":{"knuc

| class | meshes visible / hidden | instances in frustum | of them < 60 m | triangles in frustum |
|---|---|---|---|---|
| people (skinned, any LOD) | 13 / 37 | 13 | 11 | 31915 |
| people LOD3 (far) | 0 / 0 | 0 | 0 | 0 |
| people impostors | 1 / 0 | 1 | 0 | 2 |
| house roofs | 11 / 7 | 177 | 2 | 2712 |
| house walls | 3 / 0 | 8 | 1 | 752 |
| ground fill / props | 26 / 303 | 213 | 92 | 698787 |
| trees | 16 / 0 | 16 | 0 | 181066 |
| crops / flora | 19 / 44 | 186 | 0 | 24690 |
| fires / lamps | 10 / 4 | 2280 | 6 | 30272 |
| water | 9 / 5 | 8 | 4 | 283976 |
| animals | 127 / 19 | 193 | 1 | 143147 |
| terrace architecture | 133 / 201 | 1049 | 11 | 1826232 |

shadow-casting lights: [{"name":"","far":2000,"size":[240]}]

people: sim out of doors within 60 m 62 (open ground 47, inside walled courts 0, walking 0; places {"h100_door_N1":23,"worksite":12,"hall100_site":7,"h100_wall_N":5}; 250 m 306); crowd attached 316, skinned drawn 250 by LOD [0,100,42,108], impostors drawn 8 of 518 candidates

town roofs (150 m round [145,11]): up-facing area above 1.8 m 0 m², wall area 0 m², ratio null (0 triangles)

<details><summary>all classes (top 60 by triangles)</summary>

| object key | vis / hidden | inst in frustum | < 60 m | tris | mats | tiers |
|---|---|---|---|---|---|---|
| world / relief:figures | 9 / 3 | 927 | 0 | 1690000 | MeshStandardNodeMaterial | C |
| terrain | 208 / 0 | 72 | 2 | 752640 | MeshStandardNodeMaterial | C |
| world / props:carried | 1 / 0 | 169 | 51 | 685464 | MeshStandardNodeMaterial |  |
| world / garrison:room_fittings:bedrolls | 1 / 0 | 624 | 0 | 469248 | MeshStandardNodeMaterial | C |
| world / garrison:room_fittings:mats | 1 / 0 | 416 | 0 | 372320 | MeshStandardNodeMaterial | C |
| world / garrison:room_fittings:mats_b | 1 / 0 | 208 | 0 | 186160 | MeshStandardNodeMaterial | C |
| world / plain-orchards-far | 1 / 0 | 1 | 0 | 176772 | MeshStandardNodeMaterial |  |
| world / river-banks | 1 / 0 | 1 | 0 | 159880 | MeshStandardNodeMaterial | C |
| world / plain-villages-#,# | 2 / 0 | 2 | 1 | 108388 | MeshStandardNodeMaterial | C |
| world / settlement:ground | 1 / 0 | 1 | 1 | 96532 | MeshStandardNodeMaterial | C |
| world / work:objects | 1 / 0 | 1 | 1 | 92036 | MeshStandardNodeMaterial |  |
| world / animals:sheep:lod# | 1 / 1 | 91 | 0 | 89180 | MeshStandardNodeMaterial |  |
| world / plain-stone | 1 / 0 | 1 | 1 | 84008 | MeshStandardNodeMaterial | C |
| world / plain-tracks | 1 / 0 | 1 | 0 | 75768 | MeshStandardNodeMaterial | C |
| world / ledges:far | 1 / 0 | 1 | 0 | 66670 | ledges |  |
| world / fortification_e:mudbrick | 2 / 0 | 2 | 2 | 66540 | MeshStandardNodeMaterial | B/C |
| world / plain-canal-banks | 1 / 0 | 1 | 0 | 55524 | MeshStandardNodeMaterial | C |
| world / relief:far-set | 8 / 1 | 1 | 1 | 52314 | MeshStandardNodeMaterial | C |
| world / river-water | 1 / 0 | 1 | 0 | 50324 | MeshStandardNodeMaterial |  |
| world / animals:goat:lod# | 1 / 1 | 48 | 0 | 47040 | MeshStandardNodeMaterial |  |
| world / hall#:construction:base_bell:lod# | 1 / 1 | 95 | 26 | 43320 | model:column_base_bell:0:limestone_carved, model:column_base_bell:1:limestone_carved | C |
| world / settlement:gardens:far | 1 / 0 | 1 | 1 | 42334 | MeshStandardNodeMaterial | C |
| world / treasury:arrow_bundle | 1 / 0 | 40 | 0 | 35200 | MeshStandardNodeMaterial | C |
| world / treasury:alabaster_vessel | 1 / 0 | 69 | 0 | 31050 | MeshStandardNodeMaterial | C |
| world / treasury:mudbrick | 1 / 0 | 1 | 0 | 24072 | MeshStandardNodeMaterial | B/C |
| world / c#:dressings:cloth | 1 / 0 | 1 | 1 | 23770 | MeshStandardNodeMaterial | C |
| world / scribes:tablets_filed | 1 / 0 | 294 | 0 | 22344 | clay-writing |  |
| world / settlement:refuse | 1 / 0 | 1 | 1 | 22176 | MeshStandardNodeMaterial | C |
| world / treasury:mudbrick_painted | 2 / 0 | 2 | 0 | 21544 | MeshStandardNodeMaterial | B/C |
| world / hall#:construction:#|#|#:shaft:lod# | 7 / 7 | 48 | 11 | 21504 | model:column_shaft_f40:0:limestone_carved, model:column_shaft_f40:1:limestone_carved, model:column_shaft_drums:0:limestone_carved, model:column_shaft_drums:1:limestone_carved | C |
| world / settlement:roads | 1 / 0 | 1 | 1 | 20956 | MeshStandardNodeMaterial | C |
| world / garrison:mudbrick | 1 / 0 | 1 | 1 | 20292 | MeshStandardNodeMaterial | B/C |
| world / fire-body:hearth:stone | 1 / 0 | 9 | 1 | 19800 | MeshStandardNodeMaterial | C |
| world / bedrock-ground:outcrop#:lod# | 2 / 1 | 123 | 0 | 18580 | bedrock:ground |  |
| world / apadana:mudbrick | 1 / 0 | 1 | 1 | 18212 | MeshStandardNodeMaterial | B/C |
| world / hall#:construction:#|#|#:protome:lod# | 1 / 1 | 30 | 6 | 16860 | model:capital_protome:0:limestone_carved, model:capital_protome:1:limestone_carved | C |
| world / garrison:room_fittings | 1 / 0 | 1 | 1 | 16124 | MeshStandardNodeMaterial | C |
| world / apadana-glazed-frieze | 1 / 0 | 1 | 1 | 14912 | MeshStandardNodeMaterial | C |
| world / palace-glazed-bands | 1 / 0 | 1 | 1 | 14532 | MeshStandardNodeMaterial | C |
| world / treasury:textile_bale | 1 / 0 | 24 | 0 | 13632 | MeshStandardNodeMaterial | C |
| world / work:brick_stack | 1 / 0 | 6 | 3 | 12960 | MeshStandardNodeMaterial |  |
| world / bedrock-ground:talus#:lod# | 1 / 2 | 153 | 0 | 12087 | bedrock:ground |  |
| world / apadana:limestone | 2 / 0 | 2 | 2 | 10875 | MeshStandardNodeMaterial | C |
| world / ledges:mid | 1 / 0 | 1 | 0 | 10840 | ledges |  |
| world / humans:worker:lod# | 3 / 1 | 3 | 3 | 10507 | human |  |
| world / treasury:timber:ceiling | 1 / 0 | 1 | 0 | 10506 | MeshStandardNodeMaterial | C |
| world / treasury:scale_armour | 1 / 0 | 18 | 0 | 10224 | MeshStandardNodeMaterial | C |
| plain-qanats / qanat-tile:#,# | 3 / 13 | 99 | 0 | 8910 | MeshStandardNodeMaterial | C |
| world / treasury:chert_set | 1 / 0 | 30 | 0 | 8340 | MeshStandardNodeMaterial | C |
| world / settlement:water | 1 / 0 | 1 | 1 | 8292 | MeshStandardNodeMaterial | C |
| world / scribes:furnishings | 1 / 0 | 1 | 0 | 8096 | MeshStandardNodeMaterial | C |
| world / garrison:columns:base_square#:lod# | 1 / 1 | 36 | 0 | 8064 | model:column_base_square2:0:limestone_carved, model:column_base_square2:1:limestone_carved | C |
| world / props:tools | 2 / 1 | 3 | 0 | 7974 | MeshStandardNodeMaterial |  |
| world / settlement:canal_banks | 1 / 0 | 1 | 0 | 7836 | MeshStandardNodeMaterial | C |
| world / bedrock-ground:talus#:lod#:cast | 1 / 0 | 89 | 0 | 7031 | bedrock:ground |  |
| world / treasury:silver_phiale | 1 / 0 | 19 | 0 | 6802 | MeshStandardNodeMaterial | C |
| world / treasury:bitumen_jar | 1 / 0 | 22 | 0 | 6776 | MeshStandardNodeMaterial | C |
| world / terrace-foot:blocks | 1 / 0 | 1 | 1 | 6745 | MeshStandardNodeMaterial | C |
| world / garrison:timber:ceiling | 1 / 0 | 1 | 1 | 6576 | MeshStandardNodeMaterial | C |
| world / humans:median:lod# | 2 / 2 | 2 | 1 | 6483 | human |  |

</details>

## apadana: the Apadana hall, morning (cov-294) (day 200, 8.809 h)

camera 14.3, 32.6, 4.6; sim people within 60 m: 2, within 250 m: 428; crowd stats: {"draws":6,"triangles":84388,"people":111,"byLod":[0,1,0,110],"shadowDraws":1,"shadowTriangles":771,"propDraws":4,"props":84,"propTriangles":328422,"propsDropped":0,"placeholderActs":0,"motionCapture":15,"motionAuthored":96,"things":{"draws":2,"instances":2,"triangles":3448,"kinds":{"cart_stone":1,"

| class | meshes visible / hidden | instances in frustum | of them < 60 m | triangles in frustum |
|---|---|---|---|---|
| people (skinned, any LOD) | 7 / 43 | 7 | 3 | 10395 |
| people LOD3 (far) | 0 / 0 | 0 | 0 | 0 |
| people impostors | 1 / 0 | 1 | 0 | 2 |
| house roofs | 11 / 7 | 160 | 18 | 2352 |
| house walls | 3 / 0 | 0 | 0 | 0 |
| ground fill / props | 17 / 312 | 84 | 10 | 288830 |
| trees | 16 / 0 | 16 | 0 | 181066 |
| crops / flora | 19 / 44 | 126 | 0 | 13790 |
| fires / lamps | 10 / 4 | 2041 | 0 | 20610 |
| water | 9 / 5 | 10 | 5 | 304244 |
| animals | 127 / 19 | 167 | 1 | 135100 |
| terrace architecture | 131 / 203 | 1955 | 668 | 2277636 |

shadow-casting lights: [{"name":"","far":2000,"size":[240]}]

people: sim out of doors within 60 m 2 (open ground 0, inside walled courts 0, walking 0; places {}; 250 m 428); crowd attached 453, skinned drawn 111 by LOD [0,1,0,110], impostors drawn 12 of 532 candidates

town roofs (150 m round [54,77]): up-facing area above 1.8 m 0 m², wall area 0 m², ratio null (0 triangles)

<details><summary>all classes (top 60 by triangles)</summary>

| object key | vis / hidden | inst in frustum | < 60 m | tris | mats | tiers |
|---|---|---|---|---|---|---|
| world / relief:figures | 9 / 3 | 927 | 0 | 1690000 | MeshStandardNodeMaterial | C |
| terrain | 208 / 0 | 71 | 3 | 785920 | MeshStandardNodeMaterial | C |
| world / props:carried | 1 / 0 | 68 | 1 | 275808 | MeshStandardNodeMaterial |  |
| world / plain-orchards-far | 1 / 0 | 1 | 0 | 176772 | MeshStandardNodeMaterial |  |
| world / garrison:room_fittings:bedrolls | 1 / 0 | 223 | 0 | 167696 | MeshStandardNodeMaterial | C |
| world / river-banks | 1 / 0 | 1 | 0 | 159880 | MeshStandardNodeMaterial | C |
| world / garrison:room_fittings:mats | 1 / 0 | 149 | 0 | 133355 | MeshStandardNodeMaterial | C |
| world / plain-villages-#,# | 2 / 0 | 2 | 1 | 108388 | MeshStandardNodeMaterial | C |
| world / palace-furnishings:apadana:use:furn_textile | 1 / 0 | 1 | 1 | 98775 | MeshStandardNodeMaterial | C |
| world / settlement:ground | 1 / 0 | 1 | 1 | 96532 | MeshStandardNodeMaterial | C |
| world / work:objects | 1 / 0 | 1 | 0 | 92036 | MeshStandardNodeMaterial |  |
| world / plain-stone | 1 / 0 | 1 | 1 | 84008 | MeshStandardNodeMaterial | C |
| world / palace-furnishings:apadana:use:furn_gilt | 1 / 0 | 1 | 1 | 79200 | MeshStandardNodeMaterial | C |
| world / plain-tracks | 1 / 0 | 1 | 0 | 75768 | MeshStandardNodeMaterial | C |
| world / animals:sheep:lod# | 1 / 1 | 73 | 0 | 71540 | MeshStandardNodeMaterial |  |
| world / relief:far-set | 9 / 0 | 1 | 1 | 68243 | MeshStandardNodeMaterial | C |
| world / garrison:room_fittings:mats_b | 1 / 0 | 74 | 0 | 66230 | MeshStandardNodeMaterial | C |
| world / ledges:far | 1 / 0 | 1 | 0 | 64090 | ledges |  |
| world / plain-canal-banks | 1 / 0 | 1 | 0 | 55524 | MeshStandardNodeMaterial | C |
| world / animals:goat:lod# | 1 / 1 | 56 | 0 | 54880 | MeshStandardNodeMaterial |  |
| world / palace-furnishings:apadana:use:bronze | 1 / 0 | 1 | 1 | 51424 | MeshStandardNodeMaterial | C |
| world / river-water | 1 / 0 | 1 | 0 | 50324 | MeshStandardNodeMaterial |  |
| world / palace-furnishings:apadana:use:furn_carpet | 1 / 0 | 1 | 1 | 50028 | MeshStandardNodeMaterial | C |
| world / crown-merlons:terrace|#|# | 2 / 0 | 246 | 0 | 44104 | decor:merlon:limestone_merlon | C |
| world / settlement:gardens:far | 1 / 0 | 1 | 1 | 42334 | MeshStandardNodeMaterial | C |
| world / fortification_e:mudbrick | 2 / 0 | 2 | 2 | 42174 | MeshStandardNodeMaterial | B/C |
| world / nr-cliff | 1 / 0 | 1 | 0 | 33260 | MeshStandardNodeMaterial | C |
| world / relief:rosettes | 1 / 0 | 608 | 608 | 24320 | MeshStandardNodeMaterial | C |
| world / c#:dressings:cloth | 1 / 0 | 1 | 1 | 23770 | MeshStandardNodeMaterial | C |
| world / apadana:columns:base_bell:lod# | 3 / 1 | 4 | 4 | 22880 | model:column_base_bell:0:limestone_carved, model:column_base_bell:1:limestone_carved | C |
| world / settlement:refuse | 1 / 0 | 1 | 1 | 22176 | MeshStandardNodeMaterial | C |
| world / settlement:roads | 1 / 0 | 1 | 1 | 20956 | MeshStandardNodeMaterial | C |
| world / garrison:mudbrick | 1 / 0 | 1 | 1 | 20292 | MeshStandardNodeMaterial | B/C |
| world / settlement:channel_stones | 1 / 0 | 1 | 0 | 20180 | MeshStandardNodeMaterial | C |
| world / arris-band:limestone | 25 / 0 | 11 | 11 | 19248 | MeshStandardNodeMaterial | C |
| world / apadana:mudbrick | 1 / 0 | 1 | 1 | 18212 | MeshStandardNodeMaterial | B/C |
| world / garrison:room_fittings | 1 / 0 | 1 | 0 | 16124 | MeshStandardNodeMaterial | C |
| world / apadana:columns:shaft:lod# | 5 / 1 | 4 | 4 | 15360 | model:column_shaft_f48:0:limestone_carved, model:column_shaft_f48:1:limestone_carved | C |
| world / apadana-glazed-frieze | 1 / 0 | 1 | 1 | 14912 | MeshStandardNodeMaterial | C |
| world / palace-glazed-bands | 1 / 0 | 1 | 1 | 14532 | MeshStandardNodeMaterial | C |
| world / bedrock-ground:talus#:lod# | 1 / 2 | 177 | 0 | 13983 | bedrock:ground |  |
| quarries-detail / plain-quarries:rock:quarry_sivand | 1 / 0 | 1 | 0 | 13745 | bedrock:ground |  |
| world / settlement:q_g#:far | 1 / 0 | 1 | 0 | 12820 | MeshStandardNodeMaterial | C |
| plain-qanats / qanat-tile:#,# | 3 / 13 | 142 | 0 | 12780 | MeshStandardNodeMaterial | C |
| world / bedrock-ground:outcrop#:lod# | 2 / 1 | 114 | 0 | 12678 | bedrock:ground |  |
| world / nr_darius_tomb | 1 / 0 | 1 | 0 | 11154 | MeshStandardNodeMaterial | C |
| world / nr_xerxes_tomb | 1 / 0 | 1 | 0 | 11154 | MeshStandardNodeMaterial | C |
| world / fire-body:hearth:stone | 1 / 0 | 5 | 0 | 11000 | MeshStandardNodeMaterial | C |
| world / apadana:limestone | 2 / 0 | 2 | 2 | 10875 | MeshStandardNodeMaterial | C |
| world / gate_nations:colossus:lamassu:lod# | 2 / 2 | 2 | 0 | 9794 | model:colossus_lamassu:0:limestone_carved, model:colossus_lamassu:1:limestone_carved | C |
| world / props:tools | 2 / 1 | 4 | 0 | 9450 | MeshStandardNodeMaterial |  |
| world / apadana:timber:ceiling | 1 / 0 | 1 | 1 | 9312 | MeshStandardNodeMaterial | C |
| world / ledges:mid | 1 / 0 | 1 | 0 | 8390 | ledges |  |
| world / settlement:water | 1 / 0 | 1 | 1 | 8292 | MeshStandardNodeMaterial | C |
| world / settlement:canal_banks | 1 / 0 | 1 | 0 | 7836 | MeshStandardNodeMaterial | C |
| world / crown-merlons:gate_nations|#|# | 2 / 0 | 37 | 0 | 7548 | decor:merlon:limestone_merlon | C |
| world / humans:persian:lod# | 2 / 2 | 2 | 1 | 7070 | human |  |
| world / settlement:official:far | 1 / 0 | 1 | 0 | 6756 | MeshStandardNodeMaterial | C |
| world / terrace-foot:blocks | 1 / 0 | 1 | 1 | 6745 | MeshStandardNodeMaterial | C |
| world / gate_nations:mudbrick | 1 / 0 | 1 | 0 | 6622 | MeshStandardNodeMaterial | B/C |

</details>

## plain: the open plain, dusk (cov-406) (day 284, 17.156 h)

camera -6308.4, -1906.9, -24.8; sim people within 60 m: 0, within 250 m: 0; crowd stats: {"draws":0,"triangles":0,"people":0,"byLod":[0,0,0,0],"shadowDraws":0,"shadowTriangles":0,"propDraws":0,"props":0,"propTriangles":0,"propsDropped":0,"placeholderActs":0,"motionCapture":0,"motionAuthored":0,"things":{"draws":0,"instances":0,"triangles":0,"kinds":{},"dropped":0},"animals":{"draws":0,"

| class | meshes visible / hidden | instances in frustum | of them < 60 m | triangles in frustum |
|---|---|---|---|---|
| people (skinned, any LOD) | 0 / 50 | 0 | 0 | 0 |
| people LOD3 (far) | 0 / 0 | 0 | 0 | 0 |
| people impostors | 0 / 1 | 0 | 0 | 0 |
| house roofs | 11 / 7 | 0 | 0 | 0 |
| house walls | 3 / 0 | 0 | 0 | 0 |
| ground fill / props | 3 / 326 | 0 | 0 | 0 |
| trees | 16 / 0 | 16 | 0 | 181066 |
| crops / flora | 24 / 39 | 136 | 135 | 10894 |
| fires / lamps | 10 / 4 | 3133 | 0 | 6266 |
| water | 8 / 6 | 4 | 1 | 274020 |
| animals | 122 / 24 | 6 | 6 | 3696 |
| terrace architecture | 113 / 225 | 927 | 0 | 1690000 |

shadow-casting lights: [{"name":"","far":2000,"size":[240]}]

people: sim out of doors within 60 m 0 (open ground 0, inside walled courts 0, walking 0; places {}; 250 m 0); crowd attached 0, skinned drawn 0 by LOD [0,0,0,0], impostors drawn 0 of 253 candidates

town roofs (150 m round [-6332,-1962]): up-facing area above 1.8 m 0 m², wall area 0 m², ratio null (0 triangles)

<details><summary>all classes (top 60 by triangles)</summary>

| object key | vis / hidden | inst in frustum | < 60 m | tris | mats | tiers |
|---|---|---|---|---|---|---|
| world / relief:figures | 9 / 3 | 927 | 0 | 1690000 | MeshStandardNodeMaterial | C |
| terrain | 208 / 0 | 31 | 4 | 698112 | MeshStandardNodeMaterial | C |
| world / plain-orchards-far | 1 / 0 | 1 | 0 | 176772 | MeshStandardNodeMaterial |  |
| world / river-banks | 1 / 0 | 1 | 0 | 159880 | MeshStandardNodeMaterial | C |
| world / plain-villages--#,-# | 2 / 0 | 2 | 0 | 124712 | MeshStandardNodeMaterial | C |
| world / settlement:ground | 1 / 0 | 1 | 1 | 96532 | MeshStandardNodeMaterial | C |
| world / plain-stone | 1 / 0 | 1 | 1 | 84008 | MeshStandardNodeMaterial | C |
| world / plain-tracks | 1 / 0 | 1 | 0 | 75768 | MeshStandardNodeMaterial | C |
| world / plain-villages--#,# | 4 / 0 | 1 | 1 | 59784 | MeshStandardNodeMaterial | C |
| world / plain-canal-banks | 1 / 0 | 1 | 0 | 55524 | MeshStandardNodeMaterial | C |
| world / river-water | 1 / 0 | 1 | 0 | 50324 | MeshStandardNodeMaterial |  |
| world / settlement:refuse | 1 / 0 | 1 | 1 | 22176 | MeshStandardNodeMaterial | C |
| world / settlement:roads | 1 / 0 | 1 | 1 | 20956 | MeshStandardNodeMaterial | C |
| world / cover-tuft:tuft_m#c:lod# | 6 / 0 | 81 | 81 | 12628 | ground-cover |  |
| world / settlement:water | 1 / 0 | 1 | 1 | 8292 | MeshStandardNodeMaterial | C |
| plain-qanats / qanat-tile:-#,-# | 6 / 3 | 76 | 0 | 6840 | MeshStandardNodeMaterial | C |
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
| world / relief:far | 0 / 55 | 0 | 0 | 0 | MeshStandardNodeMaterial | C |
| world / doors | 3 / 42 | 0 | 0 | 0 | MeshStandardNodeMaterial | C |
| plain-qanats / qanat-tile:#,-# | 0 / 16 | 0 | 0 | 0 | MeshStandardNodeMaterial | C |
| plain-qanats / qanat-tile:#,# | 0 / 16 | 0 | 0 | 0 | MeshStandardNodeMaterial | C |
| world / ford-cobbles:#:lod# | 0 / 9 | 0 | 0 | 0 | ford:cobbles |  |
| world / door-sealing:treasury:w_stores_#_E | 0 / 7 | 0 | 0 | 0 | clay-writing |  |
| world / writing:door_sealing:treasury:w_stores_#_E:pick | 0 / 7 | 0 | 0 | 0 | MeshBasicNodeMaterial |  |
| world / rain-shafts | 0 / 7 | 0 | 0 | 0 | MeshBasicNodeMaterial |  |
| world / hall#:construction:#|#|#:shaft:lod# | 7 / 7 | 0 | 0 | 0 | model:column_shaft_f40:0:limestone_carved, model:column_shaft_f40:1:limestone_carved, model:column_shaft_drums:0:limestone_carved, model:column_shaft_drums:1:limestone_carved | C |
| world / ford-steps:namaqualand_boulder_#:lod# | 0 / 6 | 0 | 0 | 0 | scan:namaqualand_boulder_02, scan:namaqualand_boulder_03, scan:namaqualand_boulder_04 |  |
| world / door-sealing:treasury:e_stores_n_#_W | 0 / 4 | 0 | 0 | 0 | clay-writing |  |

</details>

## fields: the approach fields, dawn (cov-196) (day 126, 5.635 h)

camera -491.3, -73.3, -12.5; sim people within 60 m: 0, within 250 m: 102; crowd stats: {"draws":4,"triangles":5607,"people":8,"byLod":[0,0,0,8],"shadowDraws":0,"shadowTriangles":0,"propDraws":2,"props":6,"propTriangles":23084,"propsDropped":0,"placeholderActs":0,"motionCapture":5,"motionAuthored":3,"things":{"draws":0,"instances":0,"triangles":0,"kinds":{},"dropped":0},"animals":{"dra

| class | meshes visible / hidden | instances in frustum | of them < 60 m | triangles in frustum |
|---|---|---|---|---|
| people (skinned, any LOD) | 4 / 46 | 4 | 0 | 2605 |
| people LOD3 (far) | 0 / 0 | 0 | 0 | 0 |
| people impostors | 1 / 0 | 1 | 0 | 2 |
| house roofs | 11 / 7 | 764 | 0 | 10464 |
| house walls | 3 / 0 | 17 | 0 | 884 |
| ground fill / props | 6 / 323 | 10 | 0 | 24400 |
| trees | 16 / 0 | 16 | 0 | 181066 |
| crops / flora | 26 / 37 | 99 | 57 | 8515 |
| fires / lamps | 11 / 3 | 1568 | 0 | 57556 |
| water | 8 / 6 | 7 | 1 | 283888 |
| animals | 124 / 22 | 164 | 1 | 133068 |
| terrace architecture | 114 / 224 | 2562 | 0 | 1874862 |

shadow-casting lights: [{"name":"","far":2000,"size":[240]}]

people: sim out of doors within 60 m 0 (open ground 0, inside walled courts 0, walking 0; places {}; 250 m 102); crowd attached 414, skinned drawn 8 by LOD [0,0,0,8], impostors drawn 207 of 749 candidates

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
| world / settlement:q_s#:far | 4 / 0 | 1 | 0 | 124300 | MeshStandardNodeMaterial | C |
| world / settlement:q_b#:far | 5 / 0 | 1 | 0 | 122486 | MeshStandardNodeMaterial | C |
| world / treasury:scale_armour | 1 / 0 | 203 | 0 | 115304 | MeshStandardNodeMaterial | C |
| world / plain-villages-#,# | 2 / 0 | 2 | 1 | 108388 | MeshStandardNodeMaterial | C |
| world / crown-merlons:harem|#|-# | 4 / 0 | 962 | 0 | 108258 | decor:merlon:limestone_merlon | C |
| world / harem:room_fittings:mats | 1 / 0 | 117 | 0 | 104715 | MeshStandardNodeMaterial | C |
| world / settlement:ground | 1 / 0 | 1 | 1 | 96532 | MeshStandardNodeMaterial | C |
| world / work:objects | 1 / 0 | 1 | 0 | 92036 | MeshStandardNodeMaterial |  |
| world / treasury:bitumen_jar | 1 / 0 | 284 | 0 | 87472 | MeshStandardNodeMaterial | C |
| world / treasury:silver_phiale | 1 / 0 | 244 | 0 | 87352 | MeshStandardNodeMaterial | C |
| world / animals:sheep:lod# | 1 / 1 | 89 | 0 | 87220 | MeshStandardNodeMaterial |  |
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
| world / animals:goat:lod# | 1 / 1 | 45 | 0 | 44100 | MeshStandardNodeMaterial |  |
| world / ledges:far | 1 / 0 | 1 | 0 | 42960 | ledges |  |
| world / treasury:room_fittings:jars | 1 / 0 | 96 | 0 | 42624 | MeshStandardNodeMaterial | C |
| world / settlement:gardens:far | 1 / 0 | 1 | 1 | 42334 | MeshStandardNodeMaterial | C |
| world / fortification_e:mudbrick | 2 / 0 | 2 | 0 | 41744 | MeshStandardNodeMaterial | B/C |
| world / treasury:glass_bowl | 1 / 0 | 122 | 0 | 40992 | MeshStandardNodeMaterial |  |
| plain-qanats / qanat-tile:#,-# | 3 / 13 | 381 | 0 | 34290 | MeshStandardNodeMaterial | C |
| world / harem:room_fittings:jars | 1 / 0 | 70 | 0 | 31080 | MeshStandardNodeMaterial | C |
| world / crown-merlons:terrace|-#|-# | 2 / 0 | 255 | 0 | 30600 | decor:merlon:limestone_merlon | C |
| world / scribes:tablets_filed | 1 / 0 | 354 | 0 | 26904 | clay-writing |  |
| world / treasury:gold_rhyton | 1 / 0 | 81 | 0 | 25434 | MeshStandardNodeMaterial | C |
| world / c#:dressings:cloth | 1 / 0 | 1 | 0 | 23770 | MeshStandardNodeMaterial | C |
| world / crown-merlons:terrace|#|-# | 2 / 0 | 223 | 0 | 23378 | decor:merlon:limestone_merlon | C |
| world / garrison:room_fittings:mats | 1 / 0 | 26 | 0 | 23270 | MeshStandardNodeMaterial | C |
| world / settlement:refuse | 1 / 0 | 1 | 1 | 22176 | MeshStandardNodeMaterial | C |
| world / settlement:roads | 1 / 0 | 1 | 1 | 20956 | MeshStandardNodeMaterial | C |
| world / doors:leaves | 1 / 0 | 94 | 0 | 20680 | MeshStandardNodeMaterial | C |
| world / garrison:room_fittings:bedrolls | 1 / 0 | 27 | 0 | 20304 | MeshStandardNodeMaterial | C |
| world / props:carried | 1 / 0 | 5 | 0 | 20280 | MeshStandardNodeMaterial |  |
| world / goods:sacks | 1 / 0 | 41 | 0 | 18860 | MeshStandardNodeMaterial |  |
| world / fire-body:hearth:stone | 1 / 0 | 8 | 0 | 17600 | MeshStandardNodeMaterial | C |
| world / garrison:room_fittings | 1 / 0 | 1 | 0 | 16124 | MeshStandardNodeMaterial | C |
| world / crown-merlons:hadish|#|-# | 1 / 0 | 129 | 0 | 15480 | decor:merlon:limestone_merlon | C |
| world / apadana-glazed-frieze | 1 / 0 | 1 | 0 | 14912 | MeshStandardNodeMaterial | C |
| world / harem:mudbrick | 1 / 0 | 1 | 0 | 14562 | MeshStandardNodeMaterial | B/C |
| world / harem:timber:ceiling | 1 / 0 | 1 | 0 | 14550 | MeshStandardNodeMaterial | C |
| world / palace-glazed-bands | 1 / 0 | 1 | 0 | 14532 | MeshStandardNodeMaterial | C |
| world / hadish:columns:protome:lod# | 1 / 1 | 48 | 0 | 13824 | model:capital_protome:0:limestone_carved, model:capital_protome:1:limestone_carved | C |
| world / crown-merlons:tachara|-#|-# | 1 / 0 | 113 | 0 | 13560 | decor:merlon:limestone_merlon | C |

</details>

## night: the town at night (cov-448) (day 310, 3.446 h)

camera -900.2, -1513.5, -18.1; sim people within 60 m: 48, within 250 m: 105; crowd stats: {"draws":8,"triangles":204639,"people":29,"byLod":[4,12,0,13],"shadowDraws":5,"shadowTriangles":15183,"propDraws":3,"props":24,"propTriangles":82572,"propsDropped":0,"placeholderActs":0,"motionCapture":10,"motionAuthored":19,"things":{"draws":2,"instances":4,"triangles":3804,"kinds":{"knucklebones":

| class | meshes visible / hidden | instances in frustum | of them < 60 m | triangles in frustum |
|---|---|---|---|---|
| people (skinned, any LOD) | 13 / 37 | 13 | 11 | 91347 |
| people LOD3 (far) | 0 / 0 | 0 | 0 | 0 |
| people impostors | 0 / 1 | 0 | 0 | 0 |
| house roofs | 13 / 5 | 10 | 6 | 2770 |
| house walls | 3 / 0 | 0 | 0 | 0 |
| ground fill / props | 79 / 250 | 147 | 76 | 105707 |
| trees | 16 / 0 | 16 | 0 | 181066 |
| crops / flora | 24 / 39 | 53 | 52 | 6912 |
| fires / lamps | 12 / 2 | 4933 | 13 | 9866 |
| water | 10 / 4 | 17 | 4 | 275164 |
| animals | 132 / 15 | 56 | 50 | 20158 |
| terrace architecture | 113 / 225 | 927 | 0 | 1690000 |

shadow-casting lights: [{"name":"","far":2000,"size":[240]}]

people: sim out of doors within 60 m 48 (open ground 16, inside walled courts 32, walking 0; places {"h":32,"lane":16}; 250 m 105); crowd attached 144, skinned drawn 29 by LOD [4,12,0,13], impostors drawn 0 of 1196 candidates

town roofs (150 m round [-957,-1534]): up-facing area above 1.8 m 20290 m², wall area 86562 m², ratio 0.234 (213391 triangles)

<details><summary>all classes (top 60 by triangles)</summary>

| object key | vis / hidden | inst in frustum | < 60 m | tris | mats | tiers |
|---|---|---|---|---|---|---|
| world / relief:figures | 9 / 3 | 927 | 0 | 1690000 | MeshStandardNodeMaterial | C |
| terrain | 208 / 0 | 52 | 2 | 837376 | MeshStandardNodeMaterial | C |
| world / plain-orchards-far | 1 / 0 | 1 | 0 | 176772 | MeshStandardNodeMaterial |  |
| world / river-banks | 1 / 0 | 1 | 0 | 159880 | MeshStandardNodeMaterial | C |
| world / plain-villages--#,-# | 2 / 0 | 2 | 0 | 124712 | MeshStandardNodeMaterial | C |
| world / plain-villages--#,# | 4 / 0 | 2 | 0 | 114198 | MeshStandardNodeMaterial | C |
| world / settlement:ground | 1 / 0 | 1 | 1 | 96532 | MeshStandardNodeMaterial | C |
| world / settlement:q_s#:far | 4 / 0 | 1 | 1 | 87934 | MeshStandardNodeMaterial | C |
| world / plain-stone | 1 / 0 | 1 | 1 | 84008 | MeshStandardNodeMaterial | C |
| world / settlement:near:plaster | 1 / 0 | 1 | 0 | 81757 | MeshStandardNodeMaterial | C |
| world / plain-tracks | 1 / 0 | 1 | 0 | 75768 | MeshStandardNodeMaterial | C |
| world / props:carried | 1 / 0 | 14 | 4 | 56784 | MeshStandardNodeMaterial |  |
| world / plain-canal-banks | 1 / 0 | 1 | 0 | 55524 | MeshStandardNodeMaterial | C |
| world / river-water | 1 / 0 | 1 | 0 | 50324 | MeshStandardNodeMaterial |  |
| world / settlement:near:timber | 1 / 0 | 1 | 0 | 45442 | MeshStandardNodeMaterial | C |
| world / settlement:gardens:far | 1 / 0 | 1 | 1 | 42334 | MeshStandardNodeMaterial | C |
| world / humans:woman:lod# | 3 / 1 | 3 | 3 | 42062 | human |  |
| world / settlement:near:items | 1 / 0 | 1 | 0 | 38863 | MeshStandardNodeMaterial | C |
| world / humans:child:lod# | 3 / 1 | 3 | 3 | 35554 | human |  |
| world / plain-villages-#,# | 2 / 0 | 1 | 1 | 30688 | MeshStandardNodeMaterial | C |
| world / settlement:refuse | 1 / 0 | 1 | 1 | 22176 | MeshStandardNodeMaterial | C |
| world / settlement:roads | 1 / 0 | 1 | 1 | 20956 | MeshStandardNodeMaterial | C |
| world / settlement:near:props | 1 / 0 | 1 | 0 | 20676 | MeshStandardNodeMaterial | C |
| plain-qanats / qanat-tile:-#,-# | 3 / 6 | 170 | 0 | 15300 | MeshStandardNodeMaterial | C |
| world / ledges:far | 1 / 0 | 1 | 0 | 15180 | ledges |  |
| world / rock-stone:namaqualand_stones_#_v#:lod# | 10 / 0 | 38 | 38 | 14584 | scan:namaqualand_stones_01_v1, scan:namaqualand_stones_01_v2, scan:namaqualand_stones_01_v3, scan:namaqualand_stones_01_v4 |  |
| quarries-detail / plain-quarries:rock:quarry_majdabad | 1 / 0 | 1 | 0 | 13745 | bedrock:ground |  |
| world / settlement:near:stone | 1 / 0 | 1 | 0 | 13478 | MeshStandardNodeMaterial | C |
| world / animals:dog:lod# | 1 / 0 | 10 | 4 | 9780 | MeshStandardNodeMaterial |  |
| world / settlement-doors:# | 6 / 0 | 46 | 6 | 9328 | MeshStandardNodeMaterial | C |
| world / rock-stone:namaqualand_rocks_#_v#:lod# | 8 / 0 | 27 | 27 | 8643 | scan:namaqualand_rocks_01_v1, scan:namaqualand_rocks_01_v2, scan:namaqualand_rocks_01_v3, scan:namaqualand_rocks_01_v4 |  |
| world / props:tools | 1 / 2 | 3 | 1 | 8412 | MeshStandardNodeMaterial |  |
| world / settlement:water | 1 / 0 | 1 | 1 | 8292 | MeshStandardNodeMaterial | C |
| world / humans:worker:lod# | 2 / 2 | 2 | 1 | 7581 | human |  |
| world / fire | 1 / 0 | 3282 | 10 | 6564 | MeshBasicNodeMaterial |  |
| world / interiors:cloth | 1 / 0 | 1 | 0 | 6036 | MeshStandardNodeMaterial | C |
| world / animals:goat:lod# | 2 / 0 | 6 | 6 | 5880 | MeshStandardNodeMaterial |  |
| world / interiors:clay | 1 / 0 | 1 | 0 | 5328 | MeshStandardNodeMaterial | C |
| Mesh | 3 / 1 | 3 | 0 | 4940 | MeshBasicNodeMaterial, NodeMaterial |  |
| world / small-snail:lod# | 2 / 0 | 30 | 30 | 4500 | life:snail |  |
| world / settlement:near:brick | 1 / 0 | 1 | 0 | 4071 | MeshStandardNodeMaterial | B/C |
| world / props:children | 1 / 0 | 3 | 1 | 3906 | MeshStandardNodeMaterial |  |
| world / fire:coals | 1 / 0 | 1651 | 3 | 3302 | MeshBasicNodeMaterial |  |
| Points | 1 / 0 | 1 | 0 | 2973 | PointsNodeMaterial |  |
| world / flora-thistle:model:lod# | 2 / 0 | 33 | 33 | 2838 | life:thistle |  |
| world / settlement:waystation:far | 1 / 0 | 1 | 0 | 2674 | MeshStandardNodeMaterial | C |
| world / humans:woman:shadow | 1 / 0 | 1 | 1 | 2448 | human |  |
| world / fill:wo_dung_cakes:dung:lod# | 2 / 1 | 22 | 10 | 2400 | MeshStandardNodeMaterial | C |
| world / roofwear:drip_jar:clay | 1 / 0 | 5 | 3 | 2220 | MeshStandardNodeMaterial | C |
| world / flora-camelthorn:model:lod# | 2 / 0 | 9 | 9 | 2160 | life:camelthorn |  |
| world / rock-stone:rock_#:lod# | 4 / 0 | 17 | 17 | 1970 | scan:rock_07, scan:rock_09 |  |
| world / humans:child:shadow | 1 / 0 | 1 | 1 | 1909 | human |  |
| world / flora-cushion:model:lod# | 2 / 0 | 10 | 10 | 1880 | life:cushion |  |
| world / fill:fill_awning:cloth:lod# | 1 / 2 | 7 | 2 | 1820 | MeshStandardNodeMaterial | C |
| world / fill:fill_awning:wood:lod# | 1 / 2 | 7 | 2 | 1680 | MeshStandardNodeMaterial | C |
| world / work:toy_wheeled | 1 / 0 | 1 | 0 | 1622 | MeshStandardNodeMaterial |  |
| world / fill:fill_bundle:wood:lod# | 2 / 1 | 3 | 3 | 1395 | MeshStandardNodeMaterial | C |
| world / cover-dung:dung_sheep:lod# | 3 / 0 | 16 | 16 | 1278 | ground-cover |  |
| world / rock-stone:stone_#:lod# | 2 / 0 | 10 | 10 | 1190 | scan:stone_01 |  |
| world / fill:jar_store:clay:lod# | 2 / 1 | 13 | 2 | 1170 | MeshStandardNodeMaterial | C |

</details>

## night_terrace: the Terrace at 22:30 (sb-night-terrace) (day 5, 22.5 h)

camera 0, 92, 1.6; sim people within 60 m: 15, within 250 m: 506; crowd stats: {"draws":6,"triangles":110228,"people":147,"byLod":[0,1,0,146],"shadowDraws":1,"shadowTriangles":771,"propDraws":4,"props":134,"propTriangles":524408,"propsDropped":0,"placeholderActs":0,"motionCapture":80,"motionAuthored":67,"things":{"draws":6,"instances":65,"triangles":82652,"kinds":{"knucklebone

| class | meshes visible / hidden | instances in frustum | of them < 60 m | triangles in frustum |
|---|---|---|---|---|
| people (skinned, any LOD) | 7 / 43 | 5 | 1 | 3325 |
| people LOD3 (far) | 0 / 0 | 0 | 0 | 0 |
| people impostors | 1 / 0 | 1 | 0 | 2 |
| house roofs | 13 / 5 | 1138 | 131 | 14952 |
| house walls | 3 / 0 | 0 | 0 | 0 |
| ground fill / props | 20 / 309 | 136 | 4 | 501847 |
| trees | 16 / 0 | 16 | 0 | 181066 |
| crops / flora | 19 / 44 | 74 | 0 | 8216 |
| fires / lamps | 11 / 3 | 4807 | 12 | 88710 |
| water | 11 / 3 | 6 | 3 | 276052 |
| animals | 130 / 19 | 79 | 0 | 80943 |
| terrace architecture | 119 / 219 | 4249 | 950 | 2344675 |

shadow-casting lights: [{"name":"","far":2000,"size":[240]}]

people: sim out of doors within 60 m 15 (open ground 0, inside walled courts 0, walking 0; places {}; 250 m 506); crowd attached 453, skinned drawn 147 by LOD [0,1,0,146], impostors drawn 331 of 1228 candidates

town roofs (150 m round [0,32]): up-facing area above 1.8 m 0 m², wall area 0 m², ratio null (0 triangles)

<details><summary>all classes (top 60 by triangles)</summary>

| object key | vis / hidden | inst in frustum | < 60 m | tris | mats | tiers |
|---|---|---|---|---|---|---|
| world / relief:figures | 9 / 3 | 927 | 0 | 1690000 | MeshStandardNodeMaterial | C |
| terrain | 208 / 0 | 85 | 2 | 963840 | MeshStandardNodeMaterial | C |
| world / props:carried | 1 / 0 | 121 | 0 | 490776 | MeshStandardNodeMaterial |  |
| world / settlement:q_s#:far | 4 / 0 | 4 | 0 | 403750 | MeshStandardNodeMaterial | C |
| world / treasury:arrow_bundle | 1 / 0 | 446 | 0 | 392480 | MeshStandardNodeMaterial | C |
| world / treasury:alabaster_vessel | 1 / 0 | 824 | 0 | 370800 | MeshStandardNodeMaterial | C |
| world / treasury:textile_bale | 1 / 0 | 382 | 0 | 216976 | MeshStandardNodeMaterial | C |
| world / plain-orchards-far | 1 / 0 | 1 | 0 | 176772 | MeshStandardNodeMaterial |  |
| world / river-banks | 1 / 0 | 1 | 0 | 159880 | MeshStandardNodeMaterial | C |
| world / harem:room_fittings:bedrolls | 1 / 0 | 176 | 0 | 132352 | MeshStandardNodeMaterial | C |
| world / treasury:chert_set | 1 / 0 | 455 | 0 | 126490 | MeshStandardNodeMaterial | C |
| world / plain-villages--#,-# | 2 / 0 | 2 | 0 | 124712 | MeshStandardNodeMaterial | C |
| world / relief:far-set | 9 / 0 | 9 | 1 | 123451 | MeshStandardNodeMaterial | C |
| world / settlement:q_b#:far | 5 / 0 | 1 | 0 | 122486 | MeshStandardNodeMaterial | C |
| world / crown-merlons:harem|#|-# | 4 / 0 | 962 | 0 | 115440 | decor:merlon:limestone_merlon | C |
| world / treasury:scale_armour | 1 / 0 | 185 | 0 | 105080 | MeshStandardNodeMaterial | C |
| world / harem:room_fittings:mats | 1 / 0 | 117 | 0 | 104715 | MeshStandardNodeMaterial | C |
| world / settlement:ground | 1 / 0 | 1 | 1 | 96532 | MeshStandardNodeMaterial | C |
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
| world / work:brick_stack | 1 / 0 | 23 | 0 | 49680 | MeshStandardNodeMaterial |  |
| world / doors:shoes | 1 / 0 | 96 | 0 | 49152 | MeshStandardNodeMaterial | C |
| world / crown-merlons:terrace|-#|-# | 2 / 0 | 311 | 0 | 47988 | decor:merlon:limestone_merlon | C |
| world / treasury:bead_bowl | 1 / 0 | 114 | 0 | 43776 | MeshStandardNodeMaterial | C |
| world / settlement:gardens:far | 1 / 0 | 1 | 1 | 42334 | MeshStandardNodeMaterial | C |
| world / fortification_e:mudbrick | 2 / 0 | 2 | 0 | 41744 | MeshStandardNodeMaterial | B/C |
| world / apadana:columns:protome:lod# | 3 / 3 | 72 | 11 | 40464 | model:capital_protome:0:limestone_carved, model:capital_protome:1:limestone_carved | C |
| world / animals:sheep:lod# | 1 / 1 | 40 | 0 | 39200 | MeshStandardNodeMaterial |  |
| world / treasury:room_fittings:jars | 1 / 0 | 88 | 0 | 39072 | MeshStandardNodeMaterial | C |
| world / treasury:glass_bowl | 1 / 0 | 111 | 0 | 37296 | MeshStandardNodeMaterial |  |
| world / relief:rosettes | 1 / 0 | 824 | 824 | 32960 | MeshStandardNodeMaterial | C |
| world / harem:room_fittings:jars | 1 / 0 | 70 | 0 | 31080 | MeshStandardNodeMaterial | C |
| world / plain-villages-#,# | 2 / 0 | 1 | 1 | 30688 | MeshStandardNodeMaterial | C |
| world / crown-merlons:apadana|#|-# | 1 / 0 | 141 | 0 | 28764 | decor:merlon:limestone_merlon | C |
| plain-qanats / qanat-tile:#,-# | 3 / 13 | 319 | 0 | 28710 | MeshStandardNodeMaterial | C |
| world / crown-merlons:apadana|-#|-# | 1 / 0 | 135 | 0 | 27540 | decor:merlon:limestone_merlon | C |
| world / crenellations | 1 / 0 | 134 | 68 | 27336 | decor:merlon:limestone_merlon | C |
| world / crown-merlons:terrace|#|-# | 2 / 0 | 223 | 0 | 26760 | decor:merlon:limestone_merlon | C |
| world / fire-body:torch:head | 1 / 0 | 28 | 0 | 26096 | MeshStandardNodeMaterial | C |
| world / treasury:gold_rhyton | 1 / 0 | 78 | 0 | 24492 | MeshStandardNodeMaterial | C |
| world / c#:dressings:cloth | 1 / 0 | 1 | 1 | 23770 | MeshStandardNodeMaterial | C |
| world / animals:goat:lod# | 1 / 1 | 24 | 0 | 23520 | MeshStandardNodeMaterial |  |
| world / settlement:refuse | 1 / 0 | 1 | 1 | 22176 | MeshStandardNodeMaterial | C |
| world / doors:leaves | 1 / 0 | 96 | 0 | 21120 | MeshStandardNodeMaterial | C |
| world / settlement:roads | 1 / 0 | 1 | 1 | 20956 | MeshStandardNodeMaterial | C |
| world / garrison:mudbrick | 1 / 0 | 1 | 0 | 20292 | MeshStandardNodeMaterial | B/C |
| world / stair-crenellations | 1 / 0 | 98 | 0 | 19992 | decor:merlon:limestone_merlon | C |

</details>

