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
| C9 the budget | src/render/(models,loaders,shareInstancing,compat,progressive,lowfirst,scanProps,decorAssets).ts, src/main.ts, src/world/cache/, src/world/(wildlife,smallLife,fauna,fireOcc).ts, src/dev/, gates/budgets.json (tighten only) | cloud-s18-c9-budget | session_01HZDVcFsLpJxZXhbSEgB5FL |
| C10 the Terrace at 100-300 m | src/arch/ (not rooms, terrace_rooms, now), src/render/(monuments,reliefAtlas).ts | cloud-s18-c10-terrace | session_01VF48LTSeqX5SvZJDZWF8Xs |

Ownership added during the session: C4 + src/world/(fire,firePlaces).ts (night light on the Terrace); C5 + src/people/(props,poseKit,playing).ts (props clipping); C2 + the paradise garden (in settlement/).
| C11 the opening cinematic and its score (UD-38) | src/shell/intro.ts + cinematic files in src/shell/, src/audio/score*.ts, tools/score/, public/audio/score/ | cloud-s18-c11-cinematic | session_01Jf37fN3YK7tm9trGxq7J6p |
| C11 (s18) adds src/ui/ and src/shell/ (all) and two isolated lines in src/main.ts (startScore, mountTitleFilm) |
| C12 the giant-holes audit (finds, no src) | handoff/s18/holes.md | cloud-s18-c12-holes | session_01DVXLsjdyFMHLPUUQvCb4wp |
| C13 court, ceremony and dress | src/people/(court,courtYear,looks,outfits,wardrobe*).ts (court/courtYear moved from C1), src/world/furnish_palaces.ts | cloud-s18-c13-court | session_013XYfVtvyaLdsAkB76WYZn3 |

Ownership added after C12's audit (04:35): C2 + src/world/settlement/surfaces.ts and the town-shape rule (plan.ts:43 goes); C10 + src/render/(grime,scans).ts; C5 + src/core/settings.ts playerMode default (visitor) and the player's lamp.
