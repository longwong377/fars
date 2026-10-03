# V3 people (D-500..D-509, Q-1430..Q-1439, B530..B539; branch s17-people)
The player sees, by tonight: people who read as people at 2-30 m: bodies (the seeded spread, UD-27, stays), skin
(subsurface, pores, sun, dirt), cloth (draped wool and linen, folds, madder/indigo/saffron accents, wear), hair, faces that do
not read as dolls, motion that is weight-bearing (no sliding feet, no T-pose, no robotic loops); crowds read as people, not
clones; marks and wounds from the sim's hooks (handoff/briefs/s16/deeds_render.md); new performances from the CMU mocap
route (D-333) for the commonest activities without one.
Owns: src/people/** except animal*.ts and converse/** (talking and the sim's state are not yours: never change what people
do or say, only how they look and move). humanlab.html, tools/dev/body_probe.ts and motion_probe.* are your probe pages.
Done line: at 2 m, 10 m and 30 m in probe frames under daylight the people read as AAA-game characters, not mannequins; first
pass pushed by ~hour 3, second by ~hour 6. Do not regress load or memory (bodies are many: share textures, atlas, LOD).
