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
cloud lead | V6 is now interior LIGHT and fire only; furnishing every room (town, villages, palaces, Treasury, tents) moved to cloud agent C7 (sessions/s17-vagon-v2.md); src/world/furnish_palaces.ts is C7's | so interiors everywhere are covered from now, not after light v1

C6 | view: 420,150,1.6,80,6,30,9 | the hills' ground rock now reaches 1 km and the ledges fade by the frame (D-600): Kuh-e Rahmat's W face from its lower slope, is any slope still blank or does rock pop?
C6 | view: -166.6,108.9,1.6,117,7.5,150,16 | the mountain behind the Terrace from the stair foot (rock 260 m-1 km now drawn, D-600)
C6 | view: -2500,600,1.6,85,2,30,8 | the Terrace and Kuh-e Rahmat from the plain 2.5 km W (far Terrace levels D-361, terrain geomorph D-600)
C6 | view: 0,40,13.6,250,1,30,17.5 | the far ranges W across the plain from the Terrace top (skyline, far ring)
C6 | walk: any 300 m walk toward Kuh-e Rahmat recorded at 2 fps | the geomorph (no terrain LOD pop) and the rock fades, if the train can record a walk
