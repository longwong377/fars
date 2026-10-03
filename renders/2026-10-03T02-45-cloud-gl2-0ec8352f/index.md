# 2026-10-03T02-45-cloud-gl2-0ec8352f (cloud eyes: headless Chromium, SwiftShader, the app's WebGL2 path ?webgl=1, Q=test, 1280x720, player lens)

Rendered from 0ec8352f. CRUDE software frames, not the T4's look: quality=test and the WebGL2 backend (SwiftShader's WebGPU caps a fragment stage at 16 textures, so the terrain and hills pipelines fail there; WebGL2 has 32 units and draws the whole world). Judge placement, presence, scale, floating or sunk objects, empty ground; not tone, exposure or surface quality. Server: vite dev with NOHMR=1; world-cache puts over 100 MB dropped in the page (Playwright's pipe cannot carry them).

| view | asked by | cam e,n,eye,az,pitch | day hour weather | why | what I see |
|---|---|---|---|---|---|
| [ask-c5-3b](ask-c5-3b.jpg) | C5 | -320,862,20,135,-11 | 0 5.97 clear | C5: intro shot 3 town, re-framed W (88d54313); lead: does the town still show roofless houses? | Lead question answered: YES, the town still reads ROOFLESS on 0ec8352f. From 20 m it is a grid of open-top mud boxes with dark room interiors showing from above (a few roof-like slabs on the right block only); it sits on a bare featureless plain like a model on a table: no fields, gardens, trees, paths or spoil around the town edge. The re-framing works: the town is centred, with Rahmat, the Terrace and the white tent camp behind. Also: a flat grey walled enclosure (left, mid-distance) is still a bare box, and a thin white line runs along the foot of Rahmat (a wall or road drawn bright). |
| [ask-c1-2](ask-c1-2.jpg) | C1 | -444.3,-990.7,1.6,279,-6 | 0 8 clear | C1: town fill: a q_s1 market square at 8 h (stalls fullest in the morning); judge the goods and the awnings | A small square, not a market: ONE stall (a cream scalloped awning on four poles over two sacks/baskets and a white bundle), a big octagonal stone well-head, blue laundry on a line, a red rolled mat by the left wall, a few jars far down the lane, two people (a woman standing, a child crouching). Broken: the stall stands empty, with no seller, goods heap or second stall; the shade under the awning is a dark smudge rectangle painted on the back wall (a shadow decal hanging in the air); the well-head is oversized and smooth, like a CG prop; the walls are tall blank planes with no doors, openings or roofs facing the square; the floor is bare, with no litter, straw or sherds. |
| ask-c1-1 (MISSING) | C1 | -478,-881,1.6,189,-4 | 0 10 clear | C1: town fill (D-550): a lane in q_s1 at 10 h: a donkey tethered by a door, tools leaned, jars, mats, litter; does the lane read lived in, anything floating or  | Reads: a narrow lane, mud plaster with crack lines, a tethered donkey, laundry poles and a sagging line/awning, firewood bundles leaned at the left wall foot, stone plinth at right. Broken: the left wall foot has a floating pale strip/ledge (a plinth or gutter mesh) detached from the wall with a black gap; no litter, jars or mats visible at the feet; walls are flat-shaded and very dark on the shade side; the far end of the lane is a blank wall. |
| lead-plain-noon (MISSING) | - | -800,200,1.6,251,-4 | 12 12 clear | cloud lead: the plain at noon in April (plain_probe small-spring-field spot) |  |
| sb-stair-climb (MISSING) | scoreboard | -43.9,128,1.6,341,12 | 25 8.5 clear | moments.spec stair-climb: the great stair as the player climbs it |  |
| ask-c7-1 (MISSING) | C7 | -503.4,-1028.7,1.6,69,-12 | 30 10.5 clear | C7: a town living room seen from its court through the doorway: furnished for its household by the interiors ring (D-610)? (q_s1-0003) |  |

## Render log

```
ask-c5-3b 836s {"dc":573,"tri":9298780,"be":"WebGL2"}
ask-c1-2 480s {"dc":474,"tri":10102721,"be":"WebGL2"}

```
