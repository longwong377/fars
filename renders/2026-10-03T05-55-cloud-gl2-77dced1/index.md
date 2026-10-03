# 2026-10-03T05-55-cloud-gl2-77dced1 (cloud eyes: headless Chromium, SwiftShader, the app's WebGL2 path ?webgl=1, Q=test, 1280x720, player lens)

Rendered from 77dced10. PARTIAL ROUND: 5 of 20 views; stopped to re-shoot on c7dcb652. CAVEAT (C10): before c7dcb652 every KTX2-scanned surface drew BLACK in these WebGL2 frames (BC7 picked from the WebGPU adapter), so dark or black surfaces here are void. People counts per view: life.jsonl. CRUDE software frames, not the T4's look: quality=test and the WebGL2 backend (SwiftShader's WebGPU caps a fragment stage at 16 textures, so the terrain and hills pipelines fail there; WebGL2 has 32 units and draws the whole world). Judge placement, presence, scale, floating or sunk objects, empty ground; not tone, exposure or surface quality. Server: vite dev with NOHMR=1; world-cache puts over 100 MB dropped in the page (Playwright's pipe cannot carry them).

| view | owner | cam e,n,eye,az,pitch | day hour weather | why | what I see |
|---|---|---|---|---|---|
| town-20m (MISSING) | C2 | -320,862,20,135,-11 | 25 10 clear | the town from 20 m over its roofs, looking SE to the Terrace |  |
| lane-q_s1 (MISSING) | C2 | -478,-881,1.6,189,-4 | 25 10 clear | a lane in q_s1 (C1-1 view) |  |
| lane-n (MISSING) | C2 | -484.18,413.75,1.6,125.2,2.1 | 25 10 clear | a lane in the N town (cov-097) |  |
| market-q_s1 (MISSING) | C2 | -444.3,-990.7,1.6,279,-6 | 25 10 clear | a q_s1 market square |  |
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
| [dawn-sunrise](dawn-sunrise.jpg) | C4 | -36.4,135.5,1.6,281,-5 | 0 5.85 clear | dawn: sunrise over the W plain from the stair top | More life below the stair than round 1: coloured figures walking the plain and a larger herd (popVisible 7924 near, 268 skinned + 3348 impostors drawn). Still broken: the guard stands inside the camera (spear and hand cut down the left edge); the plain is one flat khaki-green sheet (~40%) with no field pattern; the stair parapet, merlons and steps are unpainted bare grey stone with no colour; no warm sunrise light. |
| [dusk-gate](dusk-gate.jpg) | C4 | -40,124.6,1.6,90,15 | 0 19.25 clear | dusk: the Gate of All Nations as the fires are lit | As round 1: the Gate with C10 merlons and rosette frieze; guards in red at the colossi. Still: the wall below the frieze (~45%) is a blank unpainted mud slab (no glazed brick, colour bands or hangings); full night with stars at 19.25 h, ~35 min after sunset (should be blue hour with afterglow); the hall at right is black, no lamp or fire; one brazier only. 91 skinned people drawn near, 6 sim agents within 60 m, but the frame shows only 2 guards. |
| [night-terrace](night-terrace.jpg) | C4 | 0,92,1.6,161,6 | 5 22.5 clear | night on the Terrace | New: the corner towers now have window frames (C10). Still: the court floor (~40%) empty and dark at 22.5 h with no guard, fire or lamp; the portico unlit inside behind its hangings; the left tower face a flat blue-grey slab; walls bare and unpainted. People: 8 sim agents within 60 m, 8 skinned + 2083 impostors drawn somewhere, none in frame. |
| face-0.5m (MISSING) | C14 | -444.3,-990.7,1.5,279,0 | 25 10 clear | a face at 0.5 m: the nearest still simulated person to the q_s1 market (a talker first), camera at face height |  |
| [terrace-gift-day](terrace-gift-day.jpg) | C13 | 1.9,75,1.6,161,2 | 19 8.5 clear | the Terrace on the first gift day (C13 D-780: day 19, procession Gate -> forecourt -> N stair) at 8.5 h, from the Apadana's N court | THE GIFT DAY IS EMPTY: day 19, 8.5 h, the first gift day (C13: the delegations go Gate -> forecourt -> the N stair -> the throne from 7.4-7.8 h) and the Apadana N court shows ONE person (a man in red at the right edge) and a bundle of poles. The counts say the world holds them: 445 skinned + 8,587 impostors drawn, 27,763 of the population visible near, 7 sim agents within 60 m and 29 within 150 m, nothing pending; none are on the court, the stair or the portico. The court floor is an empty grey sheet (~45%). New and good: the portico hung with white, blue and green curtains and a zigzag valance (C10). The stair reliefs and parapets are unpainted grey stone. |
| [banquet-night](banquet-night.jpg) | C13 | 1.9,12,1.6,161,6 | 19 21 clear | a great banquet night in the Apadana hall (C13 D-780: seed 1 banquet nights include day 19, from 18.6-19.1 h for 3-4 h) | Reads: a crowd of people inside the Apadana at 21 h (the banquet population is there: 401 skinned + 4,515 impostors drawn). Broken: it is NOT a banquet: everyone STANDS in rows with their backs to the camera facing the dark throne end; no tables, no seated diners, no food, cups or servers; the hall is ~70% black: the lamp stands are unlit (C13 notes C4 fire.ts) and the only light is a warm wash on the near columns; the bodies at the front wear short skirts and look like a theatre audience; a pale white bald head at centre. |
| intro-stars-a (MISSING) | C11 | -720,70,1.9,86,17 | 0 4.43 clear | C11 opening shot 'stars' (92d6a6bf), first key: sunrise-1.15 h, the stars over Kuh-e Rahmat |  |
| intro-stars-b (MISSING) | C11 | -706,72,2.2,88,8 | 0 4.43 clear | C11 opening shot 'stars', last key |  |
| intro-town (MISSING) | C11 | -320,862,20,154,-11 | 0 5.93 clear | C11 opening shot 'town' (92d6a6bf), middle key: sunrise+0.35 h, the town waking |  |

## Render log

```
dawn-sunrise 946s (shot 665s) {"dc":429,"tri":8555192,"be":"WebGL2"} life {"skinned":268,"imp":3348,"popKept":47863,"popVisible":7924,"popPending":0,"agents60":6,"agents150":8,"simT":5.85,"waitS":279,"target":5.85}
dusk-gate 355s (shot 348s) {"dc":447,"tri":7934975,"be":"WebGL2"} life {"skinned":91,"imp":44,"popKept":47863,"popVisible":8012,"popPending":0,"agents60":6,"agents150":9,"simT":19.25,"waitS":5,"target":19.25}
night-terrace 464s (shot 419s) {"dc":442,"tri":8094744,"be":"WebGL2"} life {"skinned":8,"imp":2083,"popKept":47863,"popVisible":7749,"popPending":0,"agents60":8,"agents150":8,"simT":142.5,"waitS":43,"target":142.5}
terrace-gift-day 583s (shot 503s) {"dc":723,"tri":16599989,"be":"WebGL2"} life {"skinned":445,"imp":8587,"popKept":47863,"popVisible":27763,"popPending":0,"agents60":7,"agents150":29,"simT":464.5,"waitS":75,"target":464.5}
banquet-night 616s (shot 611s) {"dc":438,"tri":13345477,"be":"WebGL2"} life {"skinned":401,"imp":4515,"popKept":47863,"popVisible":28486,"popPending":0,"agents60":0,"agents150":16,"simT":477,"waitS":3,"target":477}
errors: []

```
