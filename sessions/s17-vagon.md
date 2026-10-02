# Session 17 (Vagon only, ONE DAY): every inch AAA and filled in. START HERE

> **Revised (cloud audit, 2026-10-02): run sessions/s17-vagon-v2.md instead; why: sessions/s17-audit.md.** This page is kept as written.

The user, 2026-10-02: "by the end of this day I want every inch of the world to look AAA and I want every inch of the world
filled in ie; this needs to be a beautiful lived in gorgeous world by the end of today whatever you need to adjust to get us
there you're the boss" (UD-36). The bar: the look of a top modern AAA open-world game (RDR2, Ghost of Tsushima, AC Origins),
not "a photograph" (UD-35). Nothing on screen may read as procedural (UD-33); fill the blanks in bulk with ready-made real
assets, no per-object research (UD-34) — but never a pack object whose shape belongs to another culture or period (UD-37:
"that's how you get roman buildings in iran"). The cloud does not run today (asset libraries are blocked there; Vagon has them).

## Why it looks bad now (read once, then act)
The scans and the Blender wave exist but were proven by node tests, almost never judged in whole views (7+ BLOCKERS rows: "not
seen in the game's renderer"); the scans only add grain under the old procedural tint (src/render/scans.ts); the light was never
tuned; and what fills the screen (town walls, ground, people at 2-30 m) is the weakest part. Empty space reads as unfinished:
lanes, roofs, courtyards, fields and roadsides are under-dressed.

## The art direction (one page; every agent follows it; the lead re-tints anything that breaks it)
- **Light:** late-summer Fars: hard high sun, warm key (5200-5800 K), cool sky fill, deep but not black shadows, a dusty
  haze that lifts the distance to a pale ochre-blue; golden mornings and evenings. Tone like AC Origins / RDR2: rich, warm,
  controlled highlights, never washed grey, never neon.
- **Palette:** sun-bleached grey-cream limestone (the Terrace), warm ochre and khaki mud brick and plaster (town, villages),
  pale straw and dusty olive greens (fields, poplars, willows by water), terracotta and smoke-dark wood, undyed wool and linen
  with madder red, indigo and saffron accents on people and textiles. Nothing saturated except dyes and glazed brick.
- **Wear:** everything lived in: worn thresholds, grime at wall feet, sooted hearths, patched plaster, dust in corners, mud
  splash, tool marks, footpaths beaten bare, straw and dung in the lanes. New only where the sim says new (fresh plaster on a
  mended roof).
- **Scale:** doors and walls from research/SITE_SPEC.md (house doors ~1.8-2 m, the Terrace as measured); people 1.55-1.75 m.
- **Era limits:** research/ANACHRONISM_BLOCKLIST.md: no fired-brick house walls, no glass, no iron-banded barrels, no
  medieval or modern objects, no Islamic-era tiles or arches.
- **Reject on sight:** anything that reads modern, of another culture or period, at the wrong scale, floating or not grounded,
  or visibly repeated (the same rock, pot or wall patch within view). Vary every repeated asset (scale, rotation, tint, wear)
  after import; re-tint and re-roughen imports to the palette so packs never look like a collage.

## The plan for the day
**Hour 0-1: verify and baseline (lead).**
- Load the live site (s14-int) with the fixed harness (`node tools/deploy/measure.mjs dist --visits cold --params norender`)
  and once with rendering; walk a lane, talk to three people, try five free deeds. Note what breaks.
- Baseline render in ONE load (`node tools/dev/render_train.mjs`): the coverage points over every walkable area
  (tools/dev/coverage_points.ts) + the moments, at the player's lens, morning / late afternoon / overcast, plus a night (moon,
  hearths and torches), a rain or dust day and a winter day (calendar, src/world/season.ts). This set is the scoreboard. Rank by screen share what reads as CG or as empty.

**Hours 1-9: bulk, many agents at once** (the 16-core box; UD-28: no cap on agents; at most two heavy renders at once through
gpu_slot). Each agent owns a class, iterates on probe pages (seconds per load), and gets whole-world views only on the train.

| agent | the player sees by tonight | owns |
|---|---|---|
| light | the art direction's light and tone everywhere: sun, sky, haze, exposure, bounce, contact shadows, AO | src/render/pipeline.ts, toneLook.ts, ssgi.ts, sunShadows.ts, airlight.ts, envmap.ts, src/sky/** |
| ground | earth, dust, paths, rocks, grass and weeds that sit IN the ground, real scans, no tiling, dense near the walker | src/terrain/**, src/world/groundRocks.ts, groundFlora.ts, plain/terrainPlain.ts |
| town surfaces | walls, roofs, doors and thresholds from real scans, worn per the sheet; houses varied | src/world/settlement/surfaces.ts, kit.ts, houses.ts, src/render/grime.ts, materials.ts, scans.ts |
| town fill | every lane, courtyard and roof dressed: jars, baskets, mats, firewood, drying laundry and dung cakes, tools, tethered animals, awnings, litter | src/world/settlement/build.ts, src/world/fill*.ts, furnish.ts, roadLitter.ts |
| plain fill | fields, canals, orchards, villages, threshing floors, camps and roadsides dressed and alive | src/world/plain/**, src/world/trees/** |
| terrace | stone, capitals, reliefs and colossi off CG; block joints, weathering, paint; the Blender wave placed and judged | src/arch/**, src/render/masonry.ts, monuments.ts, blockface.ts, reliefAtlas.ts |
| people | bodies, skin, cloth, hair, motion at 2-30 m; crowds read as people; marks and wounds; the new performances (drink, dance, hunt_bow, wrestle, swim, plaster_roof) | src/people/human*.ts, body*.ts, drape.ts, looks.ts, outfits.ts, impostors.ts, popview.ts, anim.ts, activities.ts |
| interiors | rooms lit by doors and hearths, furnished, lived in | src/arch/rooms.ts, terrace_rooms.ts, src/world/furnish_palaces.ts |
| land and water far | the hills and mountains, the skyline, the river Pulvar and the canals (water, banks, reeds), the far distance with no pop-in | src/world/hills/**, src/terrain far levels, water in src/world/plain/canals.ts, riparian.ts, solids.ts |
| animals and life | herds, flocks, draught oxen, donkeys, horses, dogs, birds, wildlife and small life that look and move right | src/world/fauna.ts, beasts.ts, wildlife.ts, smallLife.ts, lifeModels.ts, src/people/animal*.ts |
| atmosphere and night | weather that reads: rain shafts, wet ground, dust and dust devils, hearth and land smoke, breath in winter; night lit by moon, hearths, lamps and torches; the seasons (winter, harvest) | src/world/weatherVfx.ts, rainShafts.ts, dust*.ts, *Smoke.ts, breath.ts, fire.ts, fireOcc.ts, firePlaces.ts, season.ts, src/weather/** |
| screens and cinematic | the out-of-world layer at the AAA standard: the loading screen (honest progress, beautiful), the title and menus, settings, the translation-layer text and subtitles, the chronicle (key J); and a gorgeous wordless intro cinematic: the plain at dawn, the river, the town waking, the Terrace in the first sun, the people at their work, ending where the player's walk begins (no narrator, no title card that hints at the place's fate, §1.1; in-engine, skippable, streamed while the world loads) | src/shell/**, src/ui/**, src/main.ts (the intro), a new src/shell/intro.ts |
| works and camps | the Hall of a Hundred Columns' building site (gangs, scaffolds, stone, ramps), the court's camps and tents, visitors, the roads' traffic and caravans | src/world/construction.ts, courtCamps.ts, tentForms.ts, visitor/**, traffic.ts, terraceFoot.ts |

**Where assets come from (UD-37).**
- **Scan libraries (Poly Haven, ambientCG and the like) supply only what has no culture:** materials and nature: earth, sand,
  rock, mud brick and plaster surfaces, limestone, wood grain, wool and linen weaves, grass, weeds, reeds, trees, sky. Every
  one in ASSET_LEDGER.md; the scan's own colour and pattern lead (flip the scans.ts rule), re-tinted to the palette.
- **Everything whose SHAPE carries a culture is ours, built in Blender (tools/blender/) to the project's period kit:**
  buildings, walls, roofs, doors, stairs, columns, furniture, pottery, baskets, tools, weapons, clothing, jewellery, tents,
  carts, people. Built fast, in bulk, from the kit the project already has (the house kit, column and capital models, the jar
  and prop forms, the garments) and research/SITE_SPEC.md's measures, then surfaced with the scanned materials. No pack
  building, pot, chair or costume, however good it looks: a Roman arch, a Moroccan tagine, a medieval barrel or a Greek
  amphora is rejected on sight.
- Everything compressed as it lands (KTX2, Draco, LODs, impostors).

**Every ~45 min: the render train** re-renders the scoreboard with every merge in. The lead judges by eye against the AAA bar
and the art direction, re-points agents at whatever still reads worst, merges (records as unions) and runs the merge budget.

**Last hour:** the final train; push s14-int only after a cold built-site load reaches ready; sessions/s17.md with the
before/after frames and what still breaks first.

## Done (tonight)
Every coverage view, morning, evening, night, rain or dust and winter, looks like a top modern AAA open-world game and is filled: no empty lane, bare roof,
blank field, naked roadside, empty hill or still water; people and animals at work everywhere the sim puts them. Not one showcase view.

## Also on the list if an agent frees up (all GPU/Blender)
- Hooks the simulation exposes that nothing renders yet: visible marks `marksOf(pop, pid, day)[].look`; wounds
  `sim.deeds.injuryOf(pid, day)`; leaking roofs `sim.deeds.joint.roofOf('h:<id>', day) < 0.45`; the market's stalls (places
  `market:<q>:<hid>`, full in the mornings). Details: handoff/briefs/s16/deeds_render.md.
- Blender backlog: B342 people atlas re-bake; relief atlases and block-face detail; the lamassu's head; griffin and lion
  capitals (Q-843); carving in silhouettes (B166-B167); far levels for the Terrace (B175); far people with tools (B176);
  birds (B179); flora cards alpha-to-coverage and wind (B180); the shoreline water (B188).
- Load and memory (owed by D-464): page memory 5.83 GB -> under 5; ready ~100 s -> under 60 (stream the animals after
  walkable); retry the shared KTX2/Draco decoder (cherry-pick 871d8aab from cloud-s16-boot) on 16 cores.
- The voice on the GPU: Qwen2.5-1.5B and the deed reading (Mind.readDeed) in the page; Kokoro fp16 vs fp32 by ear.

## State at hand-off
s14-int (deployed to https://longwong377.github.io/fars/) has everything: the bake and boot fix (D-392, D-463) and all of the
cloud's depth (D-455..D-464: open deeds and minds, goals, law, physical deeds, market stallholders, names, brides). The report:
sessions/s15-cloud-report.md. Rules: CLAUDE.md "The GPU machine" and "Box safeguards"; never edit a tree whose dev server
serves a render; the merge budget after each merge.
