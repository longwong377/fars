# s17 V7 report: shader compile at a world-state change (D-473)

**Broken or unmeasured first.** A validation error was seen in run b (after merging s17-int): "samplers (17/18) in the Fragment
stage exceed 16" on a MeshStandardNodeMaterial pipeline (that object is not drawn). It is not traced; nothing I changed adds
samplers. Run b was stopped at the 01:45 cut-off before the "before" night step (old sun switch) finished; it had been running
more than 9 min with no result, against 34-40 s for every state change with the fix.

**Measured** (tools/dev/state_compile.mjs, full world at quality high on the T4, one view, warm-up rounds until no frame asks
for a pipeline; ../load-out/state_compile_{a,b}.json). GPU pipelines created per state change, with the fix:
0,12 -> 0,21: 1 | -> 0,12: 0 | -> rain: 0 | -> day 180: 2-12 | -> 90,17 overcast: 4 | -> 0,21 rain: 0. No render object
was rebuilt by a state change (rebuilt = 0 everywhere). Before: the sun was switched invisible below -1 deg, and every lit
pipeline was rebuilt and recompiled at each sunset and sunrise (the sun light is part of every lit shader's key).

**The big remaining cost is not shaders:** the jump to day 180 spent **723 s in one world tick** (CPU: the world's and
people's update for a new day) and 74 s in warm-up for 2 pipelines. That is the ~770 s per state the trains see. Next owner:
profile `__parsa.tick()` after setTime to a new day.

**Changed:** skySystem.ts: the sun stays in the scene at intensity 0 below the horizon (A/B flag `__parsaSunKept`);
sunShadows.ts + skySystem.ts: its shadows are not redrawn at night but drawn once at load (a night load used to leave ~200
shadow pipelines for the first sunrise: run a 199, run b 27); shareInstancing.ts: on by default (one vertex program per
instanced mesh whatever its instance count) with a vertex-buffer fit check; ?shaderlog logs why each pipeline was made and
counts the GPU device's modules/pipelines (src/dev/shaderLog.ts).
