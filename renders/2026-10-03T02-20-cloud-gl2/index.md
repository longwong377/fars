# 2026-10-03T02-20-cloud-gl2 (cloud eyes: headless Chromium, SwiftShader, the app's WebGL2 path ?webgl=1, Q=test, 1280x720, player lens)

Rendered from 329bbbb1. CRUDE software frames, not the T4's look: quality=test and the WebGL2 backend (SwiftShader's WebGPU caps a fragment stage at 16 textures, so the terrain and hills pipelines fail there; WebGL2 has 32 units and draws the whole world). Judge placement, presence, scale, floating or sunk objects, empty ground; not tone, exposure or surface quality. Server: vite dev with NOHMR=1; world-cache puts over 100 MB dropped in the page (Playwright's pipe cannot carry them).

| view | asked by | cam e,n,eye,az,pitch | day hour weather | why | what I see |
|---|---|---|---|---|---|
| [ask-c5-1](ask-c5-1.jpg) | C5 | 935,3788,2.6,56,-2 | 0 5.27 clear | C5: intro shot 1 'river' (midpoint): the Pulvar before sunrise, water and far bank; judge the first frame of the opening | Reads: the Pulvar as a straight channel with reeds, a big tree silhouetted against the dawn, a tree line along the far bank, ranges either side. Broken: the river is a ruler-straight canal with hard parallel banks, and its reeds stand IN the water as a uniform fence; the water is a flat mirror strip; the foreground is uniform dark grass cards, no bank detail, stones or path; the tree crown is a cluster of flat leaf blobs. |
| [ask-c5-2](ask-c5-2.jpg) | C5 | 710,3290,88,178,-6 | 0 5.52 clear | C5: intro shot 2 'plain' (midpoint): the plain from 88 m, the Terrace and Rahmat ahead | Framing: NO Terrace in frame. From 88 m at heading 178 the camera sits beside a hill flank (left half), looking S along it, with fields on the right; check the heading or position. Content: the hill reads well (scrub, shrubs, a track, rock ledges); fields are flat saturated-green rectangles with hard edges, all one tone, no crop texture, a few lone trees; two long dark trench-like strips run down the slope (ledge meshes, or a quarry/terrace cut?). |
| [ask-c5-7](ask-c5-7.jpg) | C5 | -322,90,5,51,5 | 0 5.22 clear | C5: the title's drifting backdrop (midpoint): the Terrace W face against the dawn on the right of the frame, the menu's glass on the left | Reads: the Terrace W face and a palace portico at right against Kuh-e Rahmat and a dawn glow, the drum road running in. Broken: the left 2/3 (the menu glass side) is an empty dark plain with sparse dots; a thin bright vertical streak runs down the mountain face (a gully decal or a seam); the Terrace reads as a low flat wall with no stair or detail at this distance; the hills are smooth untextured mounds. |

## Render log

```
ask-c5-3 997s {"dc":590,"tri":9443680,"be":"WebGL2"}
ask-c1-1 634s {"dc":418,"tri":8744997,"be":"WebGL2"}
errors: []
ask-c5-7 802s {"dc":405,"tri":6685622,"be":"WebGL2"}
ask-c5-1 136s {"dc":165,"tri":2613343,"be":"WebGL2"}
ask-c5-2 431s {"dc":574,"tri":7580166,"be":"WebGL2"}
errors: []

```
