# 2026-10-03T04-34-cloud-gl2-5820c0d (cloud eyes: headless Chromium, SwiftShader, the app's WebGL2 path ?webgl=1, Q=test, 1280x720, player lens)

Rendered from 5820c0d5. PARTIAL ROUND: 8 of 17 views; stopped at the lead's word to move to 77dced10 (the rest are MISSING below). CRUDE software frames, not the T4's look: quality=test and the WebGL2 backend (SwiftShader's WebGPU caps a fragment stage at 16 textures, so the terrain and hills pipelines fail there; WebGL2 has 32 units and draws the whole world). Judge placement, presence, scale, floating or sunk objects, empty ground; not tone, exposure or surface quality. Server: vite dev with NOHMR=1; world-cache puts over 100 MB dropped in the page (Playwright's pipe cannot carry them).

| view | owner | cam e,n,eye,az,pitch | day hour weather | why | what I see |
|---|---|---|---|---|---|
| [town-20m](town-20m.jpg) | C2 | -320,862,20,135,-11 | 25 10 clear | the town from 20 m over its roofs, looking SE to the Terrace | STILL ROOFLESS after the wave-1 merge of C2 roofs: the same open-top mud grid as round 0, room floors seen from above (~15%); if C2 roofs are in this head they do not draw here (quality=test, WebGL2: a quality gate, a far-LOD cut or a lazy load?). New: a road with a cart runs to the town from the left and tree rows line the far roads (C3). Still: the town sits on a bare uniform plain (~55%) with no fields, gardens, threshing floors or spoil around it; the walled enclosure at left is a blank grey box; the Terrace is a pale unpainted block. |
| [lane-q_s1](lane-q_s1.jpg) | C2 | -478,-881,1.6,189,-4 | 25 10 clear | a lane in q_s1 (C1-1 view) | Small change: brick losses now show through the plaster at the left wall foot (C2 D-660). Otherwise as round 0: two blank plaster walls fill ~65% (no doors, windows, beams, drains; one slot window); the pale wall-foot strip at left still floats with a dark gap; nobody in the lane at 10 h; clean swept ground, no litter, jars or mats; blank wall at the far end. |
| [lane-n](lane-n.jpg) | C2 | -484.18,413.75,1.6,125.2,2.1 | 25 10 clear | a lane in the N town (cov-097) | As round 0 with brick courses now showing through the left wall plaster (C2). Still: the laundry is flat stiff white cards (~12%) with no sag or pegs; the flat bread-like slab still floats on the left wall at mid-height; a black square window hole and a sky-coloured gap in the parapet top; the wall-foot strip floats; nobody in the lane at 10 h. |
| [market-q_s1](market-q_s1.jpg) | C2 | -444.3,-990.7,1.6,279,-6 | 25 10 clear | a q_s1 market square | Changed: the man in front no longer clips a basket ring and the seated woman is gone (C5 crowd spacing), brick losses show in the walls (C2). New break: a pale green rectangular strip crosses the whole square at mid-frame (~12%), a hard-edged ground decal or lane-fill patch with a straight edge, reading as a painted floor mark. Still: the market at 10 h holds one stall with two grain jars, no goods, sellers or buyers; the walls (~35%) are blank with no doors or shopfronts; the well is a raw untextured grey octagon; the man looks down with his mouth open, arm outflung. |
| town-court (MISSING) | C2 | -535.43,401.14,1.6,29.5,-3.8 | 25 10 clear | a house court (cov-037) |  |
| house-interior (MISSING) | C2 | -532.06,410.4,1.6,119.4,2 | 25 10 clear | inside a town room (cov-204, town:rooms) |  |
| field-500m (MISSING) | C3 | -800,200,1.6,251,-6 | 25 10 clear | a spring field on the plain 0.8 km W (small-spring-field) |  |
| plain-1.5km (MISSING) | C3 | -1500,100,1.6,251,-2 | 25 10 clear | the open plain 1.5 km W, looking away from the Terrace |  |
| river-pulvar (MISSING) | C3 | 859.1,3775.1,1.6,334.7,-7 | 25 10 clear | the Pulvar at the ford |  |
| apadana-court (MISSING) | lead | 1.9,75,1.6,161,2 | 25 10 clear | the Apadana from its N court |  |
| apadana-hall (MISSING) | lead | 1.9,12,1.6,161,6 | 25 10 clear | inside the Apadana hall on its axis |  |
| terrace-court-people (MISSING) | C5 | -35,85,1.6,71,-2 | 32 9.5 clear | a Terrace court with people (court-assembly) |  |
| terrace-from-plain-16h (MISSING) | C3/C4 | -600,60,1.6,75,4 | 25 16 clear | the Terrace from the plain 0.6 km W at 16 h |  |
| terrace-from-2km-16h (MISSING) | C3/C4 | -2000,150,1.6,86,1 | 25 16 clear | the Terrace and Rahmat from the plain 2 km W at 16 h |  |
| [dawn-sunrise](dawn-sunrise.jpg) | C4 | -36.4,135.5,1.6,281,-5 | 0 5.85 clear | dawn: sunrise over the W plain from the stair top | Same as round 0 almost pixel for pixel: the guard still stands inside the camera (spear and hand at the left edge); the plain is still one flat khaki-green sheet (~40%); tree rows now line the far road (C3) but too small to read; the ox plough is gone; the parapet, merlons and stair are unpainted bare grey stone; no warm sunrise glow. |
| [dusk-gate](dusk-gate.jpg) | C4 | -40,124.6,1.6,90,15 | 0 19.25 clear | dusk: the Gate of All Nations as the fires are lit | Better than round 0: the Gate now has stepped merlons and a rosette frieze along its top (C10). Still broken: the wall face (~45%) is one blank unpainted mud slab below the frieze: no glazed brick, no colour bands, no hangings; full night with stars at 19.25 h (~35 min after sunset: should be blue hour with afterglow); the hall at right is a black silhouette with no lamp or fire; the guards at the colossi are tiny and unlit. |
| [night-terrace](night-terrace.jpg) | C4 | 0,92,1.6,161,6 | 5 22.5 clear | night on the Terrace | Better than round 0: hangings now drape between the portico columns (white and blue swags) and merlons line the roof (C10). Still broken: the court floor (~40%) is empty and dark, no guard, no fire, no lamp; the portico is unlit inside (no torch or lamp in frame at 22.5 h); the left tower is a flat blue-grey slab; the walls are bare unpainted plaster. |
| face-0.5m (MISSING) | C14 | -444.3,-990.7,1.5,279,0 | 25 10 clear | a face at 0.5 m: the nearest still simulated person to the q_s1 market (a talker first), camera at face height |  |
| terrace-gift-day (MISSING) | C13 | 1.9,75,1.6,161,2 | 19 8.5 clear | the Terrace on the first gift day (C13 D-780: day 19, procession Gate -> forecourt -> N stair) at 8.5 h, from the Apadana's N court |  |
| banquet-night (MISSING) | C13 | 1.9,12,1.6,161,6 | 19 21 clear | a great banquet night in the Apadana hall (C13 D-780: seed 1 banquet nights include day 19, from 18.6-19.1 h for 3-4 h) |  |

## Render log

```
dawn-sunrise 638s (shot 466s) {"dc":413,"tri":8487498,"be":"WebGL2"}
dusk-gate 345s (shot 340s) {"dc":429,"tri":8136945,"be":"WebGL2"}
night-terrace 424s (shot 398s) {"dc":428,"tri":8187164,"be":"WebGL2"}
town-20m 495s (shot 465s) {"dc":645,"tri":10851111,"be":"WebGL2"}
lane-q_s1 409s (shot 359s) {"dc":437,"tri":9490832,"be":"WebGL2"}
lane-n 412s (shot 406s) {"dc":764,"tri":11022426,"be":"WebGL2"}
market-q_s1 394s (shot 389s) {"dc":488,"tri":10680939,"be":"WebGL2"}
errors: []

```
