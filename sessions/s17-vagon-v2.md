# Session 17 (Vagon, ONE DAY), revised: every inch AAA and filled in. START HERE

Supersedes the schedule, scoreboard, machine limits and ownership of sessions/s17-vagon.md (the why is in
sessions/s17-audit.md). Kept from it unchanged: the goal (UD-36), the bar (a top modern AAA open world, UD-35), nothing on
screen procedural (UD-33), real assets in bulk with no per-object research (UD-34), libraries only for what has no culture and
everything culturally shaped built to the period kit in Blender (UD-37), reject on sight, the done line's spirit.

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

## Step 0 (before the box starts; the cloud can do these now, node-only)
1. `tests/data/scoreboard_s17.json`: the ids above, with a tiny `tools/dev/scoreboard.mjs` that runs coverage.spec on just
   those ids (it already takes START/END/STRIDE/OFFSET; add `IDS=`) and writes `shots/scoreboard/<stamp>/` + an index.
2. render_train.mjs: accept coverage ids (run coverage.spec, not only moments.spec) and drop `now` views by default.
3. boxguard / gpu_slot / mkwt: limits from one file per box (`gates/box.json`: cores, RAM, MAX_AGENTS, GPU_SLOTS,
   MIN_FREE_GB, TRAIN_WHILE_AGENTS), read at start, so the lead sets the box's numbers once and records them in DECISIONS.
4. Reserve numbers in handoff/reserved_numbers.md (table at the end) and write each agent's brief to handoff/briefs/s17/
   (short: what the player sees by tonight, files owned, files read-only, done line, the art direction, the box rules).
If the cloud has not done them, the lead does 1, 3 and 4 in the first 30 minutes and runs the scoreboard through coverage.spec
directly (2 can wait).

## Minute 0-15: which box is this? (the plan forks here)
`node -e "const o=require('os');console.log(o.cpus().length, (o.totalmem()/2**30).toFixed(0)+' GB')"`, `nvidia-smi`.
- **BIG (16 cores, 63 GB, T4):** MAX_AGENTS=6, GPU_SLOTS=2 (one train or budget load + one short probe/bake job), MIN_FREE_GB=6,
  train allowed while agents build (the session-15 rule was for the 4-core box; record the override in DECISIONS with the
  measured free memory and CPU). Raise to 7 agents only if, after the first train, free memory stays above 12 GB and CPU
  under 75 % with a train running; never above 8. The watchdog (CPU > 90 %) still stops new work at once.
- **SMALL (4 cores, 16 GB):** the user's cap: 2 agents, 1 GPU slot, no render while agents build. Run the queue below two at
  a time, the train between pairs. Say in the first report that "every inch in a day" will not be reached on this box and
  which classes are left; do not pretend.
Then: `git config core.autocrlf false`, `npm ci`, clone s14-int into the lead's tree, create the integration branch
**s17-int** (agents merge here; s14-int, which deploys, is pushed once at the end). Merge s14-monuments (713ed04: the Gate
colossi's licensed-scan route and lamassu source) into s17-int first or hand it to the terrace agent as its starting branch.

## Hour 0-1.5: baseline (lead), agents 1-3 start at minute 20
1. Built-site cold load, headless, no GPU: `node tools/deploy/measure.mjs dist --visits cold --params norender`. Record ready s,
   bytes before ready, page memory. Then once rendered on the GPU: walk a lane, talk to three people, try five free deeds.
2. **Set the budget's first baseline:** `node tools/dev/gpu_slot.mjs budget -- node tools/dev/budget.mjs --accept`
   (gates/budgets.json has `baseline: null` today, so nothing is gated until this runs).
3. The scoreboard, one load (~36 views x ~2 min + the load: ~85 min, sessions/s11.md:22's rate). Judge, rank what reads as CG or
   empty by share of the screen, and re-point the queue below if the ranking disagrees with it.
4. Run coverage.spec at Q=test over the whole set in the background slot only if the box is BIG and the GPU slot is free (its
   numbers are the per-area baseline for the done line; CHUNK=40 keeps each run under the watchdog).

## Hours 0.5-10: the agent queue (not 13 at once; a queue in order of screen share and dependency)
At most MAX_AGENTS run at once; when one finishes (`mkwt.mjs --done`), the next in the list starts. Each agent iterates on
probe pages (seconds per load; surface_probe, ground_probe, plain_probe, house_lab, humanlab, terrace_probe, palace_probe,
animal_probe, treelab), never its own full-world load, and asks the train for whole views.

| # | agent | the player sees by tonight | owns (no one else edits these) | starts |
|---|---|---|---|---|
| 1 | light | the art direction's light and tone in every band: sun, sky, haze, exposure, bounce, contact shadow, AO; **then night** (moon, star, fire light levels, night exposure) | src/render/pipeline.ts, toneLook.ts, ssgi.ts, sunShadows.ts, airlight.ts, envmap.ts, src/sky/**, src/render/probes/** (the outdoor bake) | min 20 |
| 2 | materials | one material system everywhere: scans lead the pattern and local colour, a per-material mean albedo from the palette, wear and grime; town walls, roofs, doors, thresholds, ground surfaces, limestone, plaster, wood, cloth weaves | src/render/materials.ts, scans.ts, grime.ts, masonry.ts, blockface.ts, src/world/settlement/surfaces.ts, public/textures/** | min 20 |
| 3 | town | every lane, court and roof built and dressed: house variety from the kit, jars, baskets, mats, firewood, laundry, dung cakes, tools, tethered animals, awnings, litter; the market's stalls | src/world/settlement/** (except surfaces.ts), src/world/fill*.ts, furnish.ts, roadLitter.ts | min 20 |
| 4 | people | bodies, skin, cloth, hair, motion at 2-30 m; crowds read as people; marks and wounds from the sim's hooks; new performances from the CMU mocap route (D-333) | src/people/** except animal*.ts and src/people/converse/** (talk is not touched today) | hour 1.5 (after the baseline) |
| 5 | ground and plain | earth, paths, rocks, weeds that sit in the ground; fields, orchards, villages, threshing floors, roadsides; the river Pulvar, canals, banks and reeds | src/terrain/**, src/world/groundRocks.ts, groundFlora.ts, src/world/plain/**, src/world/trees/** | hour 1.5 |
| 6 | load keeper (UD-31) | the site stays under a minute and under 5 GB while the others add assets: KTX2/Draco/LOD/impostor for everything landed, the shared decoder retried (cloud-s16-boot / 871d8aab), animals and far models streamed after walkable, Pages size under 1 GB | src/render/models.ts (the model loader), a new src/render/loaders.ts (the shared KTX2/Draco decoder), the boot sequence in src/main.ts (screens asks for its intro hook), public/sw.js, tools/deploy/**, .github/workflows/pages.yml; runs the budget before every train | hour 1.5 |
| 7 | terrace | stone, capitals, reliefs, colossi and block joints off CG; the Blender wave placed and judged; s14-monuments finished | src/arch/** except rooms.ts and terrace_rooms.ts, src/render/monuments.ts, reliefAtlas.ts | when 1 or 2 frees a slot |
| 8 | atmosphere and seasons | rain shafts, wet ground, dust and dust devils, hearth and land smoke, breath in winter; the season's look from season.ts (spring green on arrival, straw from June, autumn, winter) | src/world/weatherVfx.ts, rainShafts.ts, dust*.ts, *Smoke.ts, breath.ts, season.ts, plain/seasonal.ts (handed over by 5), src/weather/** | next free slot |
| 9 | life on the roads | herds, flocks, oxen, donkeys, horses, dogs, birds, wildlife; caravans, visitors, traffic; the Hall of a Hundred Columns' building site; the court's camps and tents | src/world/fauna.ts, beasts.ts, wildlife.ts, smallLife.ts, lifeModels.ts, src/people/animal*.ts, traffic.ts, visitor/**, construction.ts, courtCamps.ts, tentForms.ts, terraceFoot.ts | next free slot |
| 10 | interiors and fire | rooms lit by doors, hearths, lamps and torches, furnished and lived in; the fire's light and its places (night outdoors reads from these too) | src/arch/rooms.ts, terrace_rooms.ts, src/world/furnish_palaces.ts, fire.ts, fireOcc.ts, firePlaces.ts | next free slot |
| 11 | far land | hills, mountains, the skyline, far terrain levels and far Terrace, no pop-in | src/world/hills/**, far levels in src/terrain (handed over by 5 when it finishes) | next free slot |
| 12 | screens and intro | loading screen (honest progress, beautiful), title, menus, settings, translation-layer text, subtitles, the chronicle (J); a wordless in-engine intro that **starts when the world is walkable** (plain at dawn, river, town waking, the Terrace in first sun, people at work, ending where the walk begins; skippable; covers the streaming of animals, far models and the talk model; nothing that hints at the fate, §1.1) | src/shell/**, src/ui/**, src/shell/intro.ts (its hook in src/main.ts through the load keeper) | last; drop first if the day runs short |

Rules that make the queue work:
- **Hand-overs, not overlaps.** A file has one owner at a time. When an agent finishes, its files pass to the agent named in the
  table (or back to the lead). Anyone who needs a change in a file it does not own writes one line to the owner's
  `handoff/briefs/s17/asks.md` row; the owner does it or says no within its next commit.
- **The light lands first.** The light agent pushes a "light v1" to s17-int by hour 2.5 (one tone, exposure and haze per band;
  then it only fine-tunes, and announces each change). Materials, town and ground judge colour only under light v1 or later.
- **Re-bake the outdoor light** (src/render/probes/outdoor_bake.ts, D-357) after light v1, after the materials' first pass and
  before the final train: it holds the sky past the walls and the bounce off the surfaces.
- **Season-aware palette.** The world opens on 17 April (season.ts: green peaks at doy 105). The art direction below applies by
  season; no agent hard-codes straw, green or haze colour outside season.ts.
- **Blender.** Variants of the kit that exists (house kit, jars, baskets, garments, tents, capitals, the s12 wave) come before
  any new object type; every Blender job is a script in tools/blender/ (reproducible) and every Cycles bake goes through
  gpu_slot. A culturally shaped object the kit lacks is built only if it fills a lot of screen in the scoreboard.
- **Sources (UD-37).** Libraries (Poly Haven, ambientCG, CMU mocap) for materials, nature and motion only; no pack building,
  pot, chair, tool or costume. Every asset in ASSET_LEDGER.md as it lands.
- **What must not break (the depth):** talking on by default, the sim's hooks (marks, wounds, roofs, stalls), people's
  activities and homes. Each merge runs `npm run guards` and `npm test`'s fast tier; a merge that breaks a sim test waits.

## The rhythm: two kinds of train, one budget, merges on s17-int
- **Focus train (~45 min each, every ~90 min, from hour 2.5):** the ~12 views the agents asked for + the 5 worst scoreboard
  views. One load. The lead judges, re-points agents, merges.
- **Scoreboard train (3 times: baseline, ~hour 6, final):** the frozen ~36 views. The only before/after evidence.
- **Before every train:** merge what is ready into s17-int (records as unions of appended rows), `npm run guards`, then the
  budget (`budget.mjs` on s17-int). A metric worse than the baseline by more than 5 % holds back the merges since the last
  train until the load keeper finds which one.
- Never edit a tree whose dev server serves a render: the trains run from their own worktree of s17-int.
- Lead's clock: `node tools/dev/watchdog.mjs` every 30 min (CLAUDE.md); act on any alert at once.

## Last 90 minutes
1. Stop new merges at T-90. Re-bake the outdoor light. Final scoreboard train and coverage.spec at Q=test over the whole set.
2. `npm run build`, then the built-site cold load (`measure.mjs dist --visits cold --params norender`) and the budget:
   ready, memory and Pages size within the budget, talking on. Only then merge s17-int into s14-int and push (it deploys).
   If it fails: push s17-int only, leave s14-int as it is, and say so first.
3. sessions/s17.md: what is still broken or placeholder first (by area, with its share of the coverage set), then the
   before/after scoreboard frames, the measurements, every agent branch's fate in handoff/reserved_numbers.md.

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

## Reserved numbers (write these into handoff/reserved_numbers.md before launching)
D-470..D-479 lead; then ten each in table order: light D-480, materials D-490, town D-500, people D-510, ground and plain D-520,
load keeper D-530, terrace D-540, atmosphere D-550, life on the roads D-560, interiors D-570, far land D-580, screens D-590
(each D-x0..D-x9). Q-1400.. and B500.. in the same order, ten each (lead Q-1400..1409 / B500..B509, light Q-1410 / B510, ...).

## If an agent frees up (in order)
The sim hooks nothing draws yet (handoff/briefs/s16/deeds_render.md); the Blender backlog (B342 people atlas, relief atlases,
the lamassu's head, griffin and lion capitals Q-843, carving in silhouettes B166-B167, far Terrace B175, far people with tools
B176, birds B179, flora cards B180, shoreline B188); the talk model on the GPU (Qwen2.5-1.5B and Mind.readDeed in the page,
Kokoro fp16 vs fp32 by ear).
