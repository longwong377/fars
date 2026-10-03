# 2026-10-03T01-36-cloud-gl2 (cloud eyes: headless Chromium, SwiftShader, the app's WebGL2 path ?webgl=1, Q=test, 1280x720, player lens)

Rendered from 329bbbb1. CRUDE software frames, not the T4's look: quality=test and the WebGL2 backend (SwiftShader's WebGPU caps a fragment stage at 16 textures, so the terrain and hills pipelines fail there; WebGL2 has 32 units and draws the whole world). Judge placement, presence, scale, floating or sunk objects, empty ground; not tone, exposure or surface quality. Server: vite dev with NOHMR=1; world-cache puts over 100 MB dropped in the page (Playwright's pipe cannot carry them).

| view | asked by | cam e,n,eye,az,pitch | day hour weather | why | what I see |
|---|---|---|---|---|---|
| [ask-c5-3](ask-c5-3.jpg) | C5 | -165,850,20,153,-10 | 0 5.97 clear | C5: intro shot 3 'town' (midpoint): the town from just over its roofs, looking S to the Terrace in low sun | Reads: Kuh-e Rahmat, the Terrace W face, the plain and the town's roof grid all present, hills shaded. Broken: the plain is a uniform smeared khaki-green sheet with no visible fields/trees near the town; the walled enclosure at left (court camp wall?) is a bare flat-grey box; the town reads as an unroofed maze of open-top walls from 20 m (roofs missing or flat-dark); a dark dotted line crosses the plain (track decal?) like a seam; white tents far right read as blobs. |
| [ask-c1-1](ask-c1-1.jpg) | C1 | -478,-881,1.6,189,-4 | 0 10 clear | C1: town fill (D-550): a lane in q_s1 at 10 h: a donkey tethered by a door, tools leaned, jars, mats, litter; does the lane read lived in, anything floating or  | Reads: a narrow lane, mud plaster with crack lines, a tethered donkey, laundry poles and a sagging line/awning, firewood bundles leaned at the left wall foot, stone plinth at right. Broken: the left wall foot has a floating pale strip/ledge (a plinth or gutter mesh) detached from the wall with a black gap; no litter, jars or mats visible at the feet; walls are flat-shaded and very dark on the shade side; the far end of the lane is a blank wall. |

## Render log

```
ask-c5-3 997s {"dc":590,"tri":9443680,"be":"WebGL2"}
ask-c1-1 634s {"dc":418,"tri":8744997,"be":"WebGL2"}
errors: []

```
