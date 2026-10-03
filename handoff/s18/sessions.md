# s18 cloud sessions (the cloud lead's list; ids for send_message). Integration: s17-int (= cloud-s17-int, kept equal).
| agent | owns (src) | branch | session |
|---|---|---|---|
| cloud lead | merges, records, src/world/world.ts | s17-int, cloud-s17-int | session_01JNSEZTcqarLMRgqNU97TUk |
| C1 the new-day tick | src/people/(population,popgeo,sim,aims,calendar,camps,construction,court,courtYear,roofs,history).ts, src/people/living/, src/core/(clock,calendar,newGame,save).ts | cloud-s18-c1-tick | session_01TCmiCNLpccQXVw4kTNTFHs |
| C2 town roofs and lane fill | src/world/settlement/ (not surfaces.ts), src/world/(fill,fillPlan,roadLitter).ts | cloud-s18-c2-town | session_01RGjJPi9t8WReu1nyCPdtcP |
| C3 river and plain | src/world/plain/, src/world/(groundRocks,groundFlora).ts, src/world/trees/ | cloud-s18-c3-plain | session_01E16PQ59QUzWsnjBYjgoLUu |
| C4 sky, night, far light | src/sky/, src/render/(pipeline,toneLook,ssgi,sunShadows,airlight,envmap).ts, src/render/probes/, src/terrain/(terrainMesh,horizonMap,horizonShadow,heightfield).ts, src/world/hills/ | cloud-s18-c4-sky | session_01NjLcVA9YREZ1bBLn9GNZ8F |
| C5 crowds, doors, walk | src/people/(popview,crowd,react,sightline,navgrid).ts, src/player/, src/core/input.ts, src/world/solids.ts | cloud-s18-c5-walk | session_01JDPGeSnnf5uu2dUit7yf9E |
| C6 cloud eyes | renders/ on s18-renders-cloud (no src) | s18-renders-cloud | session_018ycMyuCSEaqVuPj6qhVJNt |
| C7 CI, old failing tests | tests/, handoff/s18/ci.md, src no s18 agent owns | cloud-s18-c7-ci | session_0116XCoSb7vcKjGSMZ6fkX7d |
| C8 the people's depth | src/people/(converse,mind,deeds,relations,economy,asks)/, src/people/(memory,persona,overheard,exchanges,activities).ts, src/audio/(speech,voices,phonemes).ts | cloud-s18-c8-depth | session_014tMypeZL5wmdJQy6viCiLn |
