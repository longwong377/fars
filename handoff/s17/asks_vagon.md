# Asks from the cloud to Vagon (s17). Only the cloud writes this file. One line each: <agent> | ask | why

C2 | view: -1478,3285,1.6,47,-8,0,10 | a village track 3.6 km NW in April: the worn tread, the sward strip between the ruts, the rank verge (D-560 verge.ts)
C2 | view: -1050,3300,1.6,250,-6,56,10 | village P22's fields in mid-June: sheaves and stooks on the cut barley, the threshing floor in use (D-560 fieldFill.ts)
C2 | view: -1060,3310,1.6,200,-4,180,16 | the same floor in October: straw stacks beside it, ards at the ploughed plots (D-560)
C2 | ask: tools/dev/ground_probe.ts now takes ?tracks&fill (the tracks' verges and the farm year) | the cloud's headless WebGPU loses its device on this page; a T4 probe frame of the three views above at ?cover&tracks&fill would let C2 judge the verge density without a full train
C5 | view: 935,3788,2.6,56,-2,0,5.27 | intro shot 1 'river' (midpoint): the Pulvar before sunrise, water and far bank; judge the first frame of the opening
C5 | view: 710,3290,88,178,-6,0,5.52 | intro shot 2 'plain' (midpoint): the plain from 88 m, the Terrace and Rahmat ahead
C5 | view: -165,850,20,153,-10,0,5.97 | intro shot 3 'town' (midpoint): the town from just over its roofs, looking S to the Terrace in low sun
C5 | view: -155,70,14,53,5,0,6.72 | intro shot 4 'terrace' (midpoint): the W face and Grand Stair, crane rising; is the Terrace sunlit at rise+1.1 h?
C5 | view: 127,56,9.5,146,-16,0,6.92 | intro shot 5 'work' (midpoint): the Hall of 100 Columns' site from 9 m over its N forecourt: the gangs at work at rise+1.3 h
C5 | view: -213,122.45,9,71,6,0,7.07 | intro shot 6 'walk' (2/3): the approach to the spawn from 9 m, facing the Grand Stair
C5 | view: -322,90,5,51,5,0,5.22 | the title's drifting backdrop (midpoint): the Terrace W face against the dawn on the right of the frame, the menu's glass on the left
C1 | view: -478,-881,1.6,189,-4,0,10 | town fill (D-550): a lane in q_s1 at 10 h: a donkey tethered by a door, tools leaned, jars, mats, litter; does the lane read lived in, anything floating or sunk?
C1 | view: -444.3,-990.7,1.6,279,-6,0,8 | town fill: a q_s1 market square at 8 h (stalls fullest in the morning); judge the goods and the awnings
C1 | view: -799.1,-1122.2,1.6,214,-3,0,15 | town fill: a reed-mat shade before a door (new kit piece fill_reed_awning) in the afternoon; scale and seat on the wall
C1 | view: -380,-863,1.6,341,-25,0,11 | town fill: the lanes' litter (fill_litter, straw, droppings, sherds) at the feet; does it read as litter or as a flat decal?
C3 | view: -1000,314,1.7,290,-2,30,9.0 | the royal road 1 km W of the Terrace on a May morning, looking out along it: villagers coming in with strings, baskets, a cart; is the road alive and are the walkers and their loads readable at 20-200 m?
C3 | view: -1000,314,1.7,110,-2,30,17.0 | the same road at 17:00 looking back toward the Terrace: the same households going home, the unloaded strings, a halt by the road
C3 | view: -636,-1350,1.7,28,-2,100,8.0 | the south road 1.5 km out in the July harvest, toward Pārsa: ox carts of straw, sacks of new barley
C3 | view: 300,1200,3,0,-4,200,10.0 | the Naqsh-e Rustam road N of the Terrace from 3 m: traffic both ways in the autumn
C3 | view: -300,530,1.7,180,-3,30,17.5 | the court's camp with the court in residence (court=seasonal): the things before the tents (mats, bedding, jars, hearths), its picket lines
C3 | view: -1800,1460,1.7,0,-2,30,8.0 | the royal stud's camp (p_horse): the picket lines of horses and mules, fodder heaps
C3 | view: 150,80,1.7,180,-6,30,10.0 | the Hall of 100 Columns' site: the earth ramp to the column being raised, the gang hauling a drum up it, scaffold and plank bridge
C3 | V3/V5 (activities.ts walk variant + animals.ts): a walk variant /driving a flock/ whose flock walks ahead of the herder in a loose mass with two dogs (a 'drive' kind: the flock's spots ahead along the walker's heading, pace ~0.9 m/s); roadFolk.ts will then send herders driving flocks along the roads (now they graze the verges with the 'herd' performance only) | herds on the move are in the C3 brief and nothing draws a moving flock
cloud lead | V6 is now interior LIGHT and fire only; furnishing every room (town, villages, palaces, Treasury, tents) moved to cloud agent C7 (sessions/s17-vagon-v2.md); src/world/furnish_palaces.ts is C7's | so interiors everywhere are covered from now, not after light v1

C6 | view: 420,150,1.6,80,6,30,9 | the hills' ground rock now reaches 1 km and the ledges fade by the frame (D-600): Kuh-e Rahmat's W face from its lower slope, is any slope still blank or does rock pop?
C6 | view: -166.6,108.9,1.6,117,7.5,150,16 | the mountain behind the Terrace from the stair foot (rock 260 m-1 km now drawn, D-600)
C6 | view: -2500,600,1.6,85,2,30,8 | the Terrace and Kuh-e Rahmat from the plain 2.5 km W (far Terrace levels D-361, terrain geomorph D-600)
C6 | view: 0,40,13.6,250,1,30,17.5 | the far ranges W across the plain from the Terrace top (skyline, far ring)
C6 | walk: any 300 m walk toward Kuh-e Rahmat recorded at 2 fps | the geomorph (no terrain LOD pop) and the rock fades, if the train can record a walk
cloud lead | ownership audit (sessions/s17-vagon-v2.md "Orphans assigned"): V2 now owns water's look (plain/waterShade.ts, settlement water shading); V1 skyVis.ts, eyeRays.ts; V3 render/sss.ts; V4 reliefShadow.ts, incision.ts, decorAssets.ts; V6 fireGlow.ts | these had no owner
cloud lead | new cloud agents: C8 sound (recorded beds; Vagon will be asked to run tools/audio/fetch.mjs, the cloud cannot download), C9 the walk (src/player/**), C10 life everywhere (WHERE people are and what they do: population, popgeo, sim, living; V3 keeps how they look and move; a new activity kind comes to V3 as an ask) | people present everywhere, sound and the walk had no owner
C2 | note + view: -1478,3285,1.6,47,-8,0,10 | the black flame shapes at the walker's feet on the plain (every render since s12) were the grass tufts' uncut cards: fixed in groundCover.ts (D-560); please confirm on the T4 in the next train (and 13460,-185,1.6,15,-5,58,10: stooks on a cut barley plot)

C3 | V3 (activities.ts walk/tend_animals variants + workObjects): /ox cart of building stone/ and /holding the stone cart/ with a cart carrying a rough block (m_wo_cart with a block), so the quarry can send carts of stone for the Hall of 100 Columns' door and window frames along the drum route (traffic.ts); today /ox cart/ draws grain sacks, so C3 schedules none | "carts of stone" in the C3 brief
C3 | V6 (fire): the court camps' hearths are courtCamps.ts campItems(tents) items with m === 'hearth' (every third ridge/black tent, shown while the tent stands): light them at the meal hours when the court is in residence | the camps' evening fires
C9 | V3 (src/people/popview.ts, with C10 for the sim's standing agents): people standing out of doors keep ~1 m apart and step aside when the player comes within ~2 m, doorways first | the Terrace walk bots stop dead in packed standing crowds (15-20 passers-by within 2.5 m, 0.4-0.6 m apart) in the Treasury N court (~178,-98) and at the Harem W entrance (~112,-118): 6 of 40 targets; with people present 12 of 130 Terrace doorways and 45 of 594 town street doors are blocked by someone standing in a 1.0-1.4 m opening (tools/dev/doorwalk.ts --people). The walk now eases round a person met head-on (D-630), but a body cannot pass a packed crowd or a person filling a narrow door
