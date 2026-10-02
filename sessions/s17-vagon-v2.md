# Session 17 (ONE DAY, cloud + Vagon together), revised: every inch AAA and filled in. START HERE

Supersedes the schedule, scoreboard, machine limits and ownership of sessions/s17-vagon.md (the why is in
sessions/s17-audit.md). Kept from it unchanged: the goal (UD-36), the bar (a top modern AAA open world, UD-35), nothing on
screen procedural (UD-33), real assets in bulk with no per-object research (UD-34), libraries only for what has no culture and
everything culturally shaped built to the period kit in Blender (UD-37), reject on sight, the done line's spirit.
The user (2026-10-02, cloud): one day, a cloud session and a Vagon session working at the same time.
## The goal and what "done tonight" means
The user: "by the end of this day I want every inch of the world to look AAA and ... filled in" (UD-36). One lead cannot judge
~3,000 views in a day, so the day is judged on a **frozen scoreboard** that stands for every inch, and measured on the whole
coverage set where a machine can measure it:
- **The scoreboard (judged by eye, same views at dawn of the day and at its end):** ~36 views = tests/data/coverage_points.json
  at STRIDE 14 (they already span every area, month, hour band and weather: the file's meta.time), minus any `now` view
  (UD-20), plus the six first-minute views a new player sees (spawn, the first lane, the first person, the Terrace stair, the
  town from the plain, a night). Frozen in `tests/data/scoreboard_s17.json` for the whole day: no reseeding mid-day.
- **Done:** every scoreboard view judged "a top modern open world, filled" by the lead against the AAA bar and the references;
  coverage.spec's measurements (placeholder share, flat/blank pixels, tiling, identical instances, life in view) better than
  the baseline in every area; the live site still meets the load and memory budget (below); talking still on. What the day
  does not reach is listed first in sessions/s17.md, by area, with its share of the coverage set.

## The split: Vagon only for what needs the GPU's eyes; the cloud builds everything else
What each side can do (measured 2026-10-02 in the cloud):
- **Cloud:** 4 cores / 15 GB per container, no GPU (headless Chromium on SwiftShader: slow, crude pictures only). It cannot reach
  Poly Haven, ambientCG, Hugging Face or GitHub release downloads, but it **has what was already downloaded**: branch
  assets-archive (~2.2 GB: 57 Poly Haven and 33 ambientCG material sets, MakeHuman CC0, audio IRs, climate data, the reference
  photos), branch models-archive (~9 GB, the language and voice models), and public/ (85 textures, ~600 models). **Blender
  5.0.1 runs here** (`pip install bpy`, the same version as Vagon's), CPU only. npm is reachable. Each sibling cloud session
  (create_session) is its own container, so cloud agents do not share the 4 cores.
- **Vagon:** the T4 (renders, probe pages at full quality, Cycles bakes on the GPU), new library downloads, KTX-Software,
  and the only place the look can be judged.
So: **Vagon runs the light, the surfaces, the people, the stone, the interiors and the weather (the classes you cannot do
without seeing them), the trains, the judging, the merges and the deploy. The cloud builds the rest in parallel**, verified by
node tests, census tools and bpy, and sees its work in the Vagon trains' frames.

## How the two sides talk (git only)
- Vagon's lead keeps **s17-int** (the integration branch) and pushes it after every train, with the train's frames on
  branch **s17-renders** (`renders/<stamp>/<view>.jpg` at 1280 px + index.md; ~5 MB a train). Cloud agents read the frames
  (they can view images) and judge their own classes from them.
- The cloud lead merges its agents into **cloud-s17-int** (records as unions) and keeps it merged with s17-int, so Vagon
  merges ONE cloud branch before each train. Nothing on either side pushes s14-int except Vagon's lead at the end.
- Asks across the line: `handoff/s17/asks_vagon.md` (the cloud writes, Vagon reads) and `handoff/s17/asks_cloud.md` (the
  reverse); one line each, owner and file named. Each side writes only its own file, so they never conflict.
- **The cloud is also Vagon's CI:** on every s17-int push the cloud lead runs `npm test` (the sim tiers included), guards and
  the headless built-site load (`measure.mjs dist --visits cold --params norender`) and writes the result to asks_vagon.md
  within ~30 min. Vagon's CPU stays on renders.

## Cloud, starting now (before the box starts)
Step 0 (the cloud lead, first ~2 h; Vagon pulls it at its minute 0):
1. `tests/data/scoreboard_s17.json` + `tools/dev/scoreboard.mjs` (coverage.spec on those ids: add `IDS=`; output
   `shots/scoreboard/<stamp>/` + index), and a `--push-frames` step that commits the jpgs to s17-renders.
2. render_train.mjs: accept coverage ids (coverage.spec, not only moments.spec); drop `now` views by default (UD-20).
3. `gates/box.json`: the box's limits (MAX_AGENTS, GPU_SLOTS, MIN_FREE_GB, TRAIN_WHILE_AGENTS) read by boxguard, gpu_slot, mkwt.
4. A Blender shim so `tools/blender/build.mjs` runs in the cloud: `BLENDER=tools/blender/bpy_cli.sh` (a `blender -b --python
   x.py -- args` front end over the bpy module; DEVICE=CPU). Prove it on one housekit and one fill_props asset; byte-compare
   against the Vagon build where one exists. KTX2: try the npm `ktx2-encoder` (basis WASM); if it fails, leave the textures
   uncompressed on the branch and list them in asks_vagon.md for Vagon's ktx.exe.
5. Reserved numbers (table below) into handoff/reserved_numbers.md; each brief to handoff/briefs/s17/ (short: what the player
   sees by tonight, files owned, files read-only, done line, the art direction, the sync rules above).
6. Fetch assets-archive and models-archive into each cloud container that needs them (shallow, only the paths it uses).

Then the cloud agents, each a sibling cloud session on its own branch `cloud-s17-<name>` (at most 2 subagents per container;
heavy node jobs through tools/dev/cpu_slot): 

| # | cloud agent | the player sees by tonight | owns |
|---|---|---|---|
| C1 | town fill | every lane, court and roof dressed: house variants from the kit, jars, baskets, mats, firewood, laundry, dung cakes, tools, tethered animals, awnings, litter; the market's stalls and mended roofs from the sim's hooks (deeds_render.md); new kit pieces as bpy scripts in tools/blender/ | src/world/settlement/** except surfaces.ts, src/world/fill*.ts, furnish.ts, roadLitter.ts, tools/blender/housekit*, fill_props* |
| C2 | plain fill | fields by season, orchards, villages, threshing floors, roadsides, canal banks and reeds, scatter density near the walker; an empty-ground census (no bare 10 m patch near a path) | src/world/plain/** except seasonal.ts, src/world/groundRocks.ts, groundFlora.ts, src/world/trees/**, tools/blender/land_* |
| C3 | life on the roads | caravans, visitors, traffic, herds on the move, the building site's gangs and ramps, the court's camps and tents; who goes where and when (the animals' looks stay Vagon's) | traffic.ts, visitor/**, construction.ts, courtCamps.ts, tentForms.ts, terraceFoot.ts, fauna.ts, wildlife.ts, smallLife.ts |
| C4 | load keeper (UD-31) | under a minute and under 5 GB while both sides add assets; the shared decoder (871d8aab) re-landed with a passing headless load; animals and far models after walkable; Pages under 1 GB | src/render/models.ts, a new src/render/loaders.ts, the boot sequence in src/main.ts, public/sw.js, tools/deploy/**, .github/workflows/pages.yml |
| C5 | screens and intro | loading screen, title, menus, settings, subtitles, translation-layer text, the chronicle (J); the wordless intro (starts when walkable, skippable, nothing hints at the fate, §1.1) written as a camera path, judged in Vagon's train | src/shell/**, src/ui/**, src/shell/intro.ts (hook in main.ts via C4) |
| C6 | far land | hills, skyline, far terrain levels and the far Terrace (B175), no pop-in (node pop-in checks; looks judged on the train) | src/world/hills/**, src/terrain/terrainMesh.ts, horizonMap.ts, horizonShadow.ts, heightfield.ts (the far levels) |
The cloud lead: Step 0, then merging C1-C6 into cloud-s17-int, the CI runs, and answering Vagon's asks.

## Vagon (the day)
### Minute 0-15: which box is this? (the plan forks here)
`node -e "const o=require('os');console.log(o.cpus().length, (o.totalmem()/2**30).toFixed(0)+' GB')"`, `nvidia-smi`.
- **BIG (16 cores, 63 GB, T4):** MAX_AGENTS=5, GPU_SLOTS=2 (a train or budget load + one short probe/bake job), MIN_FREE_GB=6,
  train allowed while agents build (the session-15 rule was for the 4-core box; record the override in DECISIONS with the
  measured free memory and CPU). A 6th agent only if, with a train running, free memory stays above 12 GB and CPU under 75 %.
  The watchdog (CPU > 90 %) still stops new work at once.
- **SMALL (4 cores, 16 GB):** the user's cap: 2 agents, 1 GPU slot, no render while agents build: run V1 and V2 below, then
  V3 and V4; the train between pairs. Say in the first report what will not be reached; do not pretend.
Then: `git config core.autocrlf false`, `npm ci`, pull the cloud's Step 0 from cloud-s17-int, create **s17-int** from
s14-int + cloud-s17-int + s14-monuments (713ed04: the Gate colossi's scan route and lamassu source).

### Hour 0-1.5: baseline (lead); V1-V3 start at minute 20
1. Rendered: walk a lane, talk to three people, try five free deeds. (The headless load numbers come from the cloud's CI.)
2. **The budget's first baseline:** `node tools/dev/gpu_slot.mjs budget -- node tools/dev/budget.mjs --accept`
   (gates/budgets.json has `baseline: null` today).
3. The scoreboard, one load (~36 views x ~2 min + the load: ~85 min, sessions/s11.md:22's rate); push the frames to
   s17-renders so the cloud sees them. Judge, rank what reads as CG or empty by share of the screen, re-point both sides.
4. coverage.spec at Q=test over the whole set in the second slot if the box is BIG (the per-area baseline; CHUNK=40).

### The Vagon agents (a queue; at most MAX_AGENTS at once; each iterates on probe pages, never its own full-world load)
| # | Vagon agent | the player sees by tonight | owns | starts |
|---|---|---|---|---|
| V1 | light | the art direction's light and tone in every band: sun, sky, haze, exposure, bounce, contact shadow, AO; then night (moon, stars, fire light levels, night exposure); the outdoor light re-bake | src/render/pipeline.ts, toneLook.ts, ssgi.ts, sunShadows.ts, airlight.ts, envmap.ts, src/sky/**, src/render/probes/** | min 20 |
| V2 | materials | one material system: scans lead pattern and local colour, a per-material mean albedo from the palette, wear and grime; walls, roofs, doors, thresholds, ground, limestone, plaster, wood, cloth; new downloads only where the archive lacks a material | src/render/materials.ts, scans.ts, grime.ts, masonry.ts, blockface.ts, src/world/settlement/surfaces.ts, src/terrain/terrainDetail.ts, detail_worker.ts (near ground shading), public/textures/** | min 20 |
| V3 | people | bodies, skin, cloth, hair, motion at 2-30 m; crowds read as people; marks and wounds from the sim's hooks; new performances from the CMU mocap route (D-333) | src/people/** except animal*.ts and converse/** | min 20 |
| V4 | terrace | stone, capitals, reliefs, colossi, block joints off CG; s14-monuments finished; Blender GPU bakes for the Terrace | src/arch/** except rooms.ts, terrace_rooms.ts; src/render/monuments.ts, reliefAtlas.ts | hour 1.5 |
| V5 | animals and weather | the animals' looks and motion (src/people/animal*.ts, beasts.ts, lifeModels.ts); rain, wet ground, dust, smoke, breath; the season's look (season.ts, plain/seasonal.ts) | as listed + src/world/weatherVfx.ts, rainShafts.ts, dust*.ts, *Smoke.ts, breath.ts, src/weather/** | hour 1.5 |
| V6 | interiors and fire | rooms lit by doors, hearths, lamps, torches, furnished and lived in | src/arch/rooms.ts, terrace_rooms.ts, src/world/furnish_palaces.ts, fire.ts, fireOcc.ts, firePlaces.ts | when V1 lands light v1 |

## Rules for both sides
- **One owner per file**, across both sides (the two tables). A change in someone else's file goes through the asks files.
- **The light lands first:** V1 pushes "light v1" to s17-int by hour 2.5; colour is judged only under it. Re-bake the outdoor
  light (src/render/probes/outdoor_bake.ts, D-357) after light v1, after V2's first pass and before the final train.
- **Season-aware palette:** the world opens on 17 April (season.ts); nobody hard-codes straw, green or haze outside season.ts.
- **Blender:** variants of the existing kit first; every job a script in tools/blender/; the cloud builds geometry and CPU
  bakes, Cycles GPU bakes are Vagon's (through gpu_slot). A new culturally shaped object only if it fills a lot of screen.
- **Sources (UD-37):** libraries for materials, nature and motion only; every asset in ASSET_LEDGER.md as it lands.
- **What must not break (the depth):** talking on by default, the sim's hooks, people's activities and homes; the cloud's CI
  runs the sim tests on every s17-int push and a red result holds the next merge.

## The rhythm
- **Focus train (~45 min, every ~90 min from hour 2.5):** the views both sides asked for + the 5 worst scoreboard views.
  Before it: merge the ready Vagon branches and cloud-s17-int into s17-int, `npm run guards`, the budget (a metric worse than
  baseline by > 5 % holds those merges back until the cloud's load keeper finds which). After it: push s17-int and the frames.
- **Scoreboard train (3 times: baseline, ~hour 6, final):** the frozen ~36 views, the only before/after evidence.
- Trains run from their own worktree of s17-int (never edit a tree whose dev server serves a render). The watchdog every 30 min.

## Last 90 minutes
1. T-120: the cloud's last cloud-s17-int. T-90: no new merges. Re-bake the outdoor light; final scoreboard train; coverage.spec
   at Q=test over the whole set.
2. `npm run build`; the built-site cold load and the budget (ready, memory, Pages size, talking on); the cloud's CI green on the
   same commit. Only then merge s17-int into s14-int and push (it deploys). If anything fails: push s17-int only, leave
   s14-int, and say so first.
3. sessions/s17.md (Vagon lead) with the cloud's report appended: what is still broken or placeholder first (by area, with its
   share of the coverage set), the before/after scoreboard frames, the measurements, every branch's fate.

## The art direction (unchanged in substance; two corrections)
- **Light:** Fars, hard high sun, warm key (5200-5800 K), cool sky fill, deep but not black shadows, a haze that lifts the
  distance to pale ochre-blue (cleaner after the spring rain, dustier from June); golden mornings and evenings. Tone like AC
  Origins / RDR2: rich, warm, controlled highlights, never washed grey, never neon.
- **Palette, by season (season.ts drives it):** sun-bleached grey-cream limestone (the Terrace), warm ochre and khaki mud brick
  and plaster (town, villages), terracotta and smoke-dark wood, undyed wool and linen with madder red, indigo and saffron
  accents. Spring (the player's arrival, April-May): young green wheat and barley, green field margins, willows and poplars in
  new leaf by the water. Summer: straw, stubble, dusty olive. Autumn: bare earth and ploughed fields. Winter: wet dark earth,
  snow on the heights. Nothing saturated except dyes, glazed brick and spring green.
- **Wear, scale, era limits, reject on sight:** as in sessions/s17-vagon.md, except people: the body system's seeded spread
  (UD-27) stands; doors and walls from research/SITE_SPEC.md.

## Reserved numbers (write into handoff/reserved_numbers.md in Step 0)
Ten each (D-x0..D-x9, and the matching Q and B blocks): Vagon lead D-470, V1 D-480, V2 D-490, V3 D-500, V4 D-510, V5 D-520,
V6 D-530; cloud lead D-540, C1 D-550, C2 D-560, C3 D-570, C4 D-580, C5 D-590, C6 D-600. Q from Q-1400 and B from B500 in the
same order (Vagon lead Q-1400..1409 / B500..B509, V1 Q-1410 / B510, ...).

## If an agent frees up (in order)
The sim hooks nothing draws yet (handoff/briefs/s16/deeds_render.md); the Blender backlog (B342 people atlas, relief atlases,
the lamassu's head, griffin and lion capitals Q-843, carving in silhouettes B166-B167, far Terrace B175, far people with tools
B176, birds B179, flora cards B180, shoreline B188); the talk model on the GPU (Qwen2.5-1.5B and Mind.readDeed in the page,
Kokoro fp16 vs fp32 by ear).
