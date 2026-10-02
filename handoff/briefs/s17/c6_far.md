# C6 far land (cloud) — branch cloud-s17-c6-far; D-600, Q-1530..Q-1539, B630..B639
Read handoff/briefs/s17/cloud_common.md first.
**The player sees by tonight:** the hills and mountains behind and around Pārsa, the skyline, the far plain and the far
Terrace read as a real landscape at every distance, with no pop-in, seams or blank slopes: rock outcrops, scree, scrub and
terraces on the slopes, villages and fields visible far off, the far Terrace (B175) as one convincing mass.
**Owns:** src/world/hills/**, src/terrain/terrainMesh.ts, horizonMap.ts, horizonShadow.ts, heightfield.ts (the far levels;
terrainDetail.ts and detail_worker.ts are V2's near ground shading).
**Start at:** src/world/hills/bedrock.ts, ledges.ts; src/terrain/terrainMesh.ts; tools/dev/terrain_seams.ts,
far_terrace_cost.ts, court_popin.ts (the pop-in check's method). Measure first: seams, LOD switch distances against screen
error, pop-in events along a walked route (node), far draw cost.
**Done:** no LOD pop or seam over 2 px at 1080p along the coverage routes (node check); the far Terrace in place; the train's
far views read as real hills.
