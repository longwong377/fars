# PĀRSA: A Living, 1:1 Reconstruction of Persepolis
### Master brief for Claude Code. Read all of it before doing anything.

> **One-shot autonomous run.** Execute Phases 0–9 (§14) end to end without asking me anything or waiting for approval. Where this brief leaves a choice open, decide from the evidence, log it, and continue (§15). The run may span several sessions. The build must be runnable at every gate, so an interrupted run still leaves something playable.

---

## 0. Settings

```
YEAR          = chosen in Phase 0   # the height of Persepolis, court in residence (§2)
ENGINE        = Three.js      # latest stable; WebGPURenderer + WebGL2 fallback; TypeScript; Vite
TARGET        = desktop Chrome/Edge, WebGPU, RTX 3070-class GPU, 60 fps @ 1440p at the top quality setting
USE           = personal, non-commercial   # governs which asset licences are allowed (§12)
RESEARCH      = lean          # capped, just-in-time (§4.2)
LANGUAGE      = period-only   # no modern language in the world (§10)
TRANSLATION   = off           # optional out-of-world English layer, toggled in settings
PLAYER_MODE   = observer      # observer | visitor (§1)
LLM_DIALOGUE  = off           # optional (§9.4)
WORLD_SEED    = 1             # one seed drives weather, NPCs and everything random (§6)
```

Repo folders I use: `references/` (my images, §15.5) and `data/` (files I supply, e.g. `data/dem/`).

---

## 1. Mission

Build the most faithful, walkable, living reconstruction of Persepolis (Old Persian *Pārsa*) ever made:

- the Terrace at true 1:1 scale on its real terrain, with the settlement, gardens and Marvdasht plain out to the horizon;
- people with their own homes, jobs and schedules, dressed as the evidence shows;
- real sky, seasons, weather, fire and smoke, and a soundscape true to the place;
- **photoreal**: a frame should read as a photograph of a real place.

The player walks in first person at human scale and sees and hears only what was there. There is no English in the world: people speak their own languages, and inscriptions are in their original scripts. The player can talk to people, inspect things, and change the time, date (within the chosen year) and weather. An optional translation layer, off by default, adds subtitles, translations of inscriptions, and a map.

- **Observer mode** (default): people notice and react (step aside, glance, respond when addressed). Nothing is barred.
- **Visitor mode:** the player is a traveller carrying a sealed travel authorisation. Access follows period-plausible rules, and guards stop you where they would have.

**"Best ever made" means:** every measurable thing is measured, every claim is sourced, every guess is labelled, it looks real, and it feels inhabited. Spectacle comes from correct scale, light, material, weather and life, never from invention.

### 1.1 The feeling: a time capsule

This is the point of everything else. It should feel like stepping through a door into a place that was real, and is gone. You should be able to get lost in it and feel the weight of where you are. Accuracy is how we earn that feeling; it isn't the goal on its own.

- **Presence through the body.** Scale is felt, not shown:
  - the long climb of the stairway at true walking pace;
  - the moment the Apadana's columns close overhead and the light drops;
  - how small a person is at the foot of a gate;
  - how far the plain stretches, and how long it takes to walk across it.

  No sprinting across the world, no fast travel, no camera tricks.
- **Restraint.** The world never performs for the player:
  - no narrator, tutorial prompts, swelling score or cinematic framing;
  - silence, wind, distant voices and empty moments are allowed, and they matter;
  - nothing tells you how to feel.
- **Getting lost is allowed.** No minimap, compass or waypoints in the world. You find your way by landmarks, the sun, the mountain and sound, the way people did. The settlement's lanes can be a maze. (The out-of-world map exists only in the translation layer.)
- **Weight comes from ordinary lives.** Empire is felt through the specific, not the grand: a scribe pressing a tablet, a ration jar, a child's game in a workshop yard, a mason's mark on a block (verify which marks are attested), dust worn into a threshold, work left unfinished. Many of these people are **real and named** in tablets that survive.
- **Real objects in their moment.** Where an object survives today, show it at the point in its life you're witnessing, placed and used as the evidence shows. Examples:
  - specific attested tablets being written and sealed with real, attested seals;
  - the Apadana foundation plates in their stone boxes;
  - the reliefs, freshly painted;
  - objects from the Treasury.

  You're seeing things that still exist, before anyone knew they would be the ones to last.
- **The loss is carried by knowledge, not shown.** The world itself never hints at its fate; the people living in it don't know. The player does, and that is the weight.
- **Now view** (stretch goal, out-of-world, off by default): from any spot on the Terrace, switch to the ruin as it stands today (built from survey data and photographs, the same work as the §8 calibration scene) and back again.
- **Moments that must land.** Capture these as fixed camera-rig scenes (§13.4), and judge them in the §8 rubric review as scenes, not only as images:
  - dawn from the top of the Grand Stairway, looking over the plain;
  - entering the Apadana hall from bright sun;
  - the procession reliefs in raking light, in full colour;
  - smoke rising from the town at dusk as lamps are lit;
  - night on the Terrace with only fire, moon and stars;
  - rain moving across the plain toward the columns;
  - a scribe's room, mid-work;
  - the court in full assembly on the Terrace.

---

## 2. When

Persepolis at the height of its glory. Choose the exact year in Phase 0 and justify it in `DECISIONS.md`. The year is fixed; the **date** can move through it, and seasons change crops, trees, river flow, work and weather. The default start date is one on which the evidence places the court at Persepolis, preferably in spring.
- **The trade-off.** Most named, real people come from the Fortification Archive (c. 509–493 BCE) and the Treasury Archive (c. 492–458 BCE), under Darius I, Xerxes and early Artaxerxes I. That is **before the Terrace was finished** (the Hall of a Hundred Columns was completed under Artaxerxes I). A later date gives more buildings and fewer names.
- **Construction is an asset.** An active building site, with scaffolds, stone-cutters and rationed work gangs, is honest.
- **The king.** The court moved between capitals, so the king is present only on dates the evidence supports. Otherwise he is absent, and the world shows it.
- **The Apadana reliefs.** Whether they show a real annual New Year procession is debated; don't stage it as settled fact.

Every structure, object, person and practice must pass the chronology filter in `research/CHRONOLOGY.md`.

---

## 3. Binding rules

My last big build failed because agents modelled from a vague mental image instead of measurements, and couldn't judge their own visuals. So:

1. **Numbers before pictures.** Geometry comes only from `research/SITE_SPEC.md`, where every value has a source and tier.
2. **Evidence tiers everywhere:**
   - **A, attested:** excavated remains, measured drawings, primary texts.
   - **B, inferred:** strong same-period analogy or scholarly consensus.
   - **C, reconstructed:** an informed guess.

   Every data row, asset, NPC, word and piece of music carries a tier in its data, visible in the dev overlay.
3. **Primary sources win.** Popular sources quote the Apadana's columns at anywhere from ~19 to 25 m, and its footprint as "1,000 m²", which is impossible for a ~60 m square hall. Resolve against the excavation reports and log conflicts in `research/OPEN_QUESTIONS.md`.
4. **Verify by measurement** (§13). Screenshots find problems; they never prove correctness.
5. **Fidelity is fixed.** Three.js is a renderer, not an engine, so build the engine systems (§6). No target may be quietly reduced. If one can't be met in the browser:
   - measure it and try at least three approaches;
   - then ship the most faithful version that runs, keeping the full target available as the top quality setting;
   - log the numbers in `BLOCKERS.md`.

   Lower quality presets for weaker hardware are fine, as long as the top one is the full target.
6. **Accuracy beats beauty.** A photoreal wrong column is still wrong.
7. **Honesty.** A phase is done only when its gate passes. Placeholders are flagged in the dev overlay, `PROGRESS.md` and reports. Never describe intent as achievement, and never quietly substitute something weaker. Every report leads with what is broken or placeholder.

**Priority order** (the sequence that guarantees the most value if the run ends early; it is not permission to cut anything):
1. Terrace geometry
2. Terrain
3. Sky, time and weather
4. The vertical-slice route with people, fire and sound
5. The rest of the Terrace
6. People at scale, with day-to-day variety, events and memory (§9.5)
7. Settlement and plain
8. Language, speech and music
9. Stretch features: the Now view, path-traced photo mode, cloth simulation, LLM dialogue

---

## 4. Research

### 4.1 Where to look (a map, not a reading list)
- **Architecture:**
  - Schmidt, *Persepolis I–III* (OIP 68–70) and *Flights Over Ancient Cities of Iran* (1940 aerial photos). All are free PDFs from the University of Chicago's ISAC. **The authoritative site plan is Schmidt's in *Persepolis I*.**
  - Tilia, *Studies and Restorations at Persepolis*.
- **People, economy and calendar:**
  - Hallock, *Persepolis Fortification Tablets* (OIP 92); Cameron, *Persepolis Treasury Tablets* (OIP 65).
  - Persepolis Fortification Archive Project publications; ARTA papers (achemenet.com).
  - Henkelman on the royal table; Briant; Kuhrt's *Corpus of Sources*.
- **Colour:**
  - Nagel, *Color and Meaning in the Art of Achaemenid Persia* (2023).
  - Pigment analyses: Egyptian blue; copper-carbonate green; iron-oxide reds and yellows; calcite-dolomite white; lazurite and magnetite on some samples.
  - Askari Chaverdi & Callieri on surface finishing.
- **Settlement and landscape:** Sumner's Marvdasht surveys; the Iranian-Italian "From Palace to Town" project (Persepolis West, the Tol-e Ajori gate); Boucharlat et al.
- **Dress:** Encyclopaedia Iranica (clothing, candys); Walser and Gropp on the 23 delegations; Stronach on court vs riding dress.
- **Greek sources** (Herodotus, Ctesias, Xenophon, Athenaeus and others) are read as Greek literature about Persia, not neutral records.

If a source is unreachable, log it. Never paraphrase from memory as if you had read it. Record licence terms and credits for everything you download, including reference photos.

### 4.2 Budget: build, don't write a thesis
- **Just-in-time.** Phase 0 covers only what Phases 1–2 need: the date, the chronology, Terrace dimensions and terrain sources. Every other topic is researched at the start of the phase that uses it.
- **Caps.**
  - Phase 0: ≤ ~25 sources and ≤ 3 parallel research subagents.
  - Later phases: ≤ ~10 new sources each.
  - A disputed number gets ≤ 2 extra sources. Then pick the best-supported value, tier it, log it, and move on.
  - Deep extraction within one source is encouraged; for example, mining Hallock and Cameron for names, rations, jobs and routes.
- **Tables, not essays.** Output is rows: value, unit, source, page, tier, note.
- **Good enough beats complete.** A labelled C-tier value that the build uses beats another hour of searching.

### 4.3 Research files (`research/`)
- `SOURCES.md`
- `SITE_SPEC.md`: every structure's outline, heights, stairs (step count, riser, tread), walls, openings, column grids and heights, base/shaft/capital profiles, doors and fittings, roofs, parapets and drains; georeferenced.
- `CHRONOLOGY.md`
- `LANDSCAPE.md`: terrain, rivers, canals, vegetation, crops by season, roads, climate.
- `PEOPLE.md`
- `MATERIAL_CULTURE.md`: dress, furnishings, tools, vessels, food, transport and tack, animals.
- `CALENDAR_AND_UNITS.md`: the period calendar with its month names and regnal years; ration and silver units.
- `LANGUAGES.md` and `LEXICON/`
- `SOUNDSCAPE.md`: including the music evidence.
- `ANACHRONISM_BLOCKLIST.md`
- `OPEN_QUESTIONS.md`
- `SUMMARY.md`

### 4.4 Seed facts to verify, not trust
- **Terrace:** ~450 × 300 m, up to ~18 m above the plain; begun under Darius I c. 518 BCE.
- **Apadana:** 72 columns (36 in a ~60 m square hall, 6 × 6; the rest in three porticoes). Column height is disputed.
- **Tachara:** main room ~15.15 × 15.42 m; 12 columns; monolithic door and window frames.
- **Hall of a Hundred Columns:** ~70 × 70 m; completed under Artaxerxes I.
- **Grand Stairway:** often quoted as 111 low steps per flight, ~6.9 m wide.
- **Tol-e Ajori:** a mud-brick gate ~39 × 29 m with walls over 10 m thick, ~3 km west, modelled on Babylon's Ishtar Gate, early Achaemenid. Check whether it still stands at your date.
- **People:**
  - Parnakka, head of the Persepolis economy, and his deputy Ziššawiš.
  - The royal women Irdabama and Irtašduna.
  - Baratkama, the treasurer.

  Most are from the reign of Darius I.

---

## 5. The world

### 5.1 Extent (concentric rings, all georeferenced)
1. **The Terrace, at 1:1.** Every interior that exists and is enterable at the chosen date is walkable: the Grand Stairway, Gate of All Nations, Apadana, Tachara, Hadish, Hall of a Hundred Columns, Tripylon, Treasury, "Harem of Xerxes", Unfinished Gate and the rest, as the chronology allows. Also the fortifications, storerooms, drains and cisterns, and the mountain slope with its tomb façades (sealed tombs stay sealed).
   - **Interiors are furnished:** thrones, hangings, carpets, vessels, stored goods (per *Persepolis II* and period analogues).
   - **Doors are timber with metal fittings.** They open, close and lock plausibly, and stores are sealed.
2. **The settlement.** The lower town and palace-and-garden zones (Persepolis West, Bagh-e Firuzi, Tol-e Ajori), with workshops, housing, storehouses, stables, gardens (*paradises*), roads and way-stations. The evidence here is patchy, so layout is partly C-tier; label it.
3. **The plain.** Fields, villages, orchards, canals, the Pulvar and Kur rivers with seasonal flow, roads, and Naqsh-e Rustam (Achaemenid features only).
4. **The horizon.** Real mountain silhouettes out to ~40 km.

### 5.2 Terrain: layered, because no single dataset is exact
At ~30 m spacing, the whole Terrace is only ~15 samples wide. Build the ground in layers of increasing precision and log every correction in `LANDSCAPE.md`:

1. **Plain and horizon: Copernicus DEM GLO-30** (~30 m, free, no login).
   - **Where:** AWS bucket `s3://copernicus-dem-30m/`, folders `Copernicus_DSM_COG_10_<N##_00>_<E###_00>_DEM`.
   - **Tiles:** for ~40 km around ≈29.93°N, 52.89°E you need **N29 E052, N29 E053, N30 E052 and N30 E053**.
   - **Withheld tiles:** check `tileList.txt`; some countries' tiles are held back. If any are missing, fall back to GLO-90, ALOS AW3D30 or SRTM.
   - **Bare earth:** it is a surface model, so strip modern buildings, trees and roads (bare-earth products if the licence allows, land-cover masks, manual correction).
2. **The pre-modern landscape.**
   - Sources: 1960s–70s CORONA imagery (USGS login), Schmidt's 1930s aerial photos, and Sentinel-2 (no login, on AWS).
   - Use them to restore watercourses, remove modern fields and roads, and place ancient mounds.
3. **The Terrace and its foot.** Build this ground from the excavation plans, contours and elevations. Georeference by control points, restore **ancient ground level**, and blend into the DEM through a documented transition.
4. **Validate.** Spot-check known elevations, and derive all distances and bearings from coordinates.

Check `data/dem/` first. If no host is reachable:
- build the pipeline to auto-ingest tiles from `data/dem/`;
- meanwhile, run it on an interim heightfield built from published contours and spot heights (C-tier);
- list the exact files needed in `NEEDS_FROM_ME.md`.

### 5.3 Sky, time and weather
- **Sky.** A physically based sun and atmosphere for Pārsa's coordinates and date (proleptic Julian calendar, with ΔT handled). Correct moon phase, and stars precessed to the period.
- **Time.** A full day/night cycle with an adjustable time scale (default: real time), plus date control within the chosen year.
- **Weather.** No one knows the actual weather on a given day in 500 BCE, so build a **climate-driven weather generator** for temperature, cloud, wind, humidity, precipitation and dust:
  - **Calibration.** Match modern Shiraz/Marvdasht observations (NOAA GHCN/ISD station data, which needs no login; ERA5 if I supply a key). Adjust where there is paleoclimate evidence for the late first millennium BCE, and tier those adjustments.
  - **Reproducible.** The weather is seeded, and it can also be set from the settings.
- **What weather renders:**
  - volumetric clouds;
  - rain: darkened wet stone, puddles, running drains, mud;
  - snow on the mountain in winter, and on the Terrace and plain when the climate allows, with accumulation and melt;
  - wind in plants, cloth, dust and smoke;
  - haze, morning mist and dust storms;
  - lightning where the climate allows.
- **Weather also changes behaviour and sound** (§9.2, §11).

### 5.4 Fire, smoke and water
- **Fire is everywhere in a pre-modern city.** Hearths, bread ovens, kilns, smithies, torches, oil lamps and braziers as real objects, plus attested ritual fire.
  - **Light:** each fire is a flickering light source with correct colour temperature, and the only light at night besides the moon and stars.
  - **Smoke:** plumes that drift with the wind, a haze over the town at dusk, and soot staining near fires.
- **Water.** Moving and still water rendered properly: rivers, canals, cisterns, drains, wells, garden pools and rain run-off.

### 5.5 The life of the place (all tiered)
- **Wildlife:** birds (including seasonal migrants and raptors), insects and flies, jackals, rats, scavenging dogs, and game in the paradises.
- **Dirt and wear:** dung and animal pens, middens, drainage filth, flies, spilled grain, tanning and dye works, dust on feet and hems, soot. Grime is concentrated where work happens, not smeared evenly everywhere.
- **Transport:** carts and wagons, chariots (shown on the reliefs), litters, pack animals with tack and loads, courier way-stations.
- **Food chain:** grinding, baking, brewing, wine and dates arriving, slaughter for the royal table, mealtimes, storage jars.
- **Life events:** children at play as well as at work, sickness, old age, festivals and offerings. Death practice only as the evidence shows it.

---

## 6. Engine (Three.js)

For every subsystem, choose a technique, justify it in `DECISIONS.md` and **benchmark it in Phase 1** before building on it. The techniques named below are examples, not mandates; the outcome is what's required.

- **Rendering:** WebGPURenderer with TSL materials; GPU instancing and culling; a LOD system that holds carved detail up close and scales to the horizon; high-quality shadows. A WebGL2 fallback path, tested separately.
- **Streaming:** terrain with GPU displacement; texture and building streaming with LOD chains; compressed meshes and textures (e.g. Meshopt, KTX2); strict memory budgets against browser tab limits; a memory HUD in dev builds.
- **Characters:** full detail near the player; cheaper animated crowds mid-range; impostors far away.
- **VFX:** fire, smoke, dust, rain, snow, insects.
- **Simulation:** NPCs, animals and the economy run in Web Workers, with simulation LOD. If `SharedArrayBuffer` is used, the host must send COOP/COEP headers (see Delivery).
- **Navigation and physics:**
  - navmesh and crowd steering (e.g. a Recast/Detour WASM build);
  - a WASM physics engine (e.g. Rapier);
  - player collision with crowds and animals.
- **Determinism and saves:**
  - one seed drives all randomness;
  - save/load covers world state (time, weather, NPC state) and settings;
  - tests freeze the seed, time, weather and NPC state so comparisons are meaningful.
- **The player:**
  - **Body:** visible, in period dress, with a shadow.
  - **Movement:** walk and run; correct step-up for the Terrace's shallow stairs; you can fall off the Terrace edge; no flying or clipping.
- **The shell:**
  - title and loading screens; a click-to-start that unlocks audio (browsers require a user gesture);
  - pause menu, controls help, a sensible spawn point on the approach from the plain;
  - no in-world HUD.
- **Settings:** quality, time, date, weather, player mode, translation layer, field of view, head-bob off, key remapping, per-channel volume, subtitle size, a lightning-flash warning, and colour-blind-safe UI.
- **Content pipeline:** procedural generation from the spec; headless Blender (`bpy`) for asset processing; licensed scans, base meshes and motion capture (§12).
- **Delivery:**
  - `npm run dev` for local play;
  - a production build as a static site plus an asset bucket or CDN, on a host that can set COOP/COEP headers (e.g. Cloudflare Pages or Netlify);
  - budgets: first playable load and total download size, set in Phase 1 and documented in `README.md`;
  - large binaries are kept out of git history (gitignored, or Git LFS if a remote supports it);
  - a **benchmark mode** that flies set routes and writes a report file.

**Testing without my GPU.** The sandbox has no real GPU:
- **Correctness and visual checks** run in headless Chromium with software rendering (SwiftShader) at a low-resolution test profile, with timeouts. Record which path, WebGPU or WebGL2, each test actually ran on.
- **Performance** is judged against proxy budgets you set in Phase 1: draw calls, triangles, memory, and CPU and GPU timings where available.
- **Real-hardware frame rates** come from benchmark mode, which I'll run after the build. Performance gates pass on the proxies, and each one leaves an entry in `REAL_HARDWARE_TODO.md`.

---

## 7. Architecture and materials

- **Parametric construction.** Every structure is generated in code from `SITE_SPEC.md`: column grids, stairs, walls, openings, doors, bases and capitals with true profile curves. No magic numbers.
- **Construction truth.**
  - Stone columns, stairs, and door and window frames.
  - Plastered, painted mud-brick walls.
  - Timber roofs on beams (the timbers named in the inscriptions).
  - Double-animal capitals, per building as attested.
- **Reliefs.** Figure count, order and placement match the documented programme (e.g. the 23 delegations on the Apadana stairs, in order). Carving comes from licensed 3D scans where they exist; otherwise from measured drawings and photographs, tiered. It must hold up at arm's length.
- **Polychromy.** Paint and gilding follow the pigment evidence and documented traces, applied by zone. Inferred colour is tiered in the data. Polished dark stone where attested. Neither a bleached ruin nor a toy.
- **Materials.** Calibrated PBR for every surface, built from measured or photographic sources, never generic "game stone":
  - stone, plaster, paint, timber, glazed brick, metals, textiles, skin, hair, earth, water, plants;
  - paint has thickness, wear and edge damage;
  - surfaces are clean where a working palace was kept clean, and worn where feet, hands and weather wear them.

---

## 8. Photorealism

**Required outcomes:**
- **Light:** light that bounces realistically, including indoors; soft shadows with contact hardening.
- **Air:** volumetric light and haze.
- **Camera:** exposure and eye adaptation like a real camera; filmic tone mapping.
- **Image quality:** stable anti-aliasing, so fine detail doesn't shimmer.
- **Interiors:** the hypostyle halls are dim, lit from doors, windows and porticoes.
- **Photo mode:** a progressive path tracer for stills (stretch goal).

**Verification:**
1. **Calibration scene.** Build a column base, stair flight and doorway in their **present-day ruined state**. It is test-only and exempt from the blocklist.
   - Light it with the sun position of a real, dated, credited photograph of the site.
   - Match the photo on stone colour, luminance, specular response, shadow softness and ambient occlusion.
   - Then apply the calibrated setup to the ancient state.
2. **Rubric review.** A vision-capable reviewer subagent scores camera-rig screenshots against real photographs with similar light, stone, landscape and dress. Seven categories, 1–5 each: light, materials, scale cues, detail, people, weather, atmosphere.
   - **Pass:** no category below 4.
   - Anything scored "reads as CG" goes on the fix list.
3. **Measurements.**
   - Luminance: plausible ranges for sky, sunlit stone and shade; no clipping in normal exposure.
   - Detail: minimum texel and triangle density at 1 m.

---

## 9. People and animals

### 9.1 Who
- **Named individuals** from the evidence appear only in their documented role, place and period. Behaviour beyond the evidence is tiered C.
- **Roles from the evidence:**
  - officials and scribes (Elamite on clay, Aramaic on leather);
  - treasury workers and storekeepers;
  - guards, including the royal guard with spears and their documented butt ornaments;
  - craftsmen from across the empire, stone-cutters, carpenters;
  - bakers and brewers, grooms, camel and mule handlers;
  - couriers carrying sealed travel authorisations;
  - priests performing the offerings attested in the tablets;
  - farmers and herders;
  - women and children in work groups (the tablets record their rations, including maternity rations);
  - envoys and delegations.
- **Soldiers and guards** are a constant, visible presence, tiered as usual:
  - **The royal guard.** Herodotus calls the elite unit the "Immortals"; the Persian name is uncertain. Among them, the spearmen whose spears end in apple- or pomegranate-shaped counterweights. They appear with the king and at the palaces, dressed and armed as on the Persepolis reliefs and the glazed-brick archers of Susa: spear, bow and quiver, short sword (*akinaka*), wicker shield.
  - **Fortress and gate guards.** The tablets attest guards at Persepolis. They stand at gates and stairways, work shifts with changeovers, patrol, and are housed in the garrison quarters Schmidt identified on the Terrace.
  - **Other units:** cavalry and horse lines, archers, and couriers of the royal road, as the evidence supports.
  - **Hidden gear:** scale armour worn under tunics (Herodotus) is B-tier. Drill and training scenes are C-tier and kept plausible.
  - **What they do:** guard, escort, check travel authorisations (this drives access in visitor mode), carry signals, eat, sleep, gamble and idle. They do not fight; there is no combat.
  - **With the king present,** they are at full ceremonial strength; when he's away, a smaller garrison keeps watch, especially on the Treasury.
- **The king**, when present, follows attested court protocol: seclusion, audiences, parasol and fly-whisk bearers. His face is reconstructed and tiered C.
- **Names** for unnamed NPCs come from names attested in the tablets, matched to origin. Never invent "Persian-sounding" names.

### 9.2 Lives
- **Every NPC has:** a home, household, job, ration entitlement, daily and seasonal schedule, social ties and small goals.
- **Needs:** food, water, rest, warmth, shelter, company, and duty to masters and work gangs. Each person's planned routine bends to these, to events and to weather. People make decisions; they don't follow fixed paths.
- **What drives schedules:** the documented economy (rations issued, goods moved, gangs assigned, travellers arriving, the royal table supplied), plus time, season and weather.
  - People shelter from rain, cover up in cold, change routes, and stop work in storms.
  - Fires are lit at dusk.
- **Animals** have owners, jobs and routines; wildlife follows time and season.
- **Continuity:** simulation LOD keeps everyone where they should be when you arrive.
- **Population: everyone who lived there exists.** No arbitrary cap. Estimate the real population per zone, season and time in `PEOPLE.md`:
  - **Sources:** ration tablets, work-group sizes, household evidence, settlement area and density analogues, and court size. Greek sources claim the king's table fed 15,000 a day; treat that as a claim, not a fact.
  - **When the court is resident,** expect thousands on and around the Terrace and tens of thousands across the plain; when it's absent, far fewer.
  - **Simulate them all.** Everyone is simulated at an abstract level (home, job, schedule, location), and only people near the player get full behaviour.
- **Rendered floors** (raise them where hardware allows):
  - ≥ 300 visible in the busiest scenes (e.g. a court day in the Apadana forecourt), using animated crowds and impostors;
  - ≥ 50 at full close-up detail near the player;
  - distant crowds on roads and in fields read as people, not dots.

### 9.3 Appearance
- **Dress** follows `MATERIAL_CULTURE.md`:
  - the Persian court robe with its pleats and fluted headgear;
  - Median riding dress (tunic, trousers, the *kandys* worn draped with empty sleeves, soft cap);
  - delegation dress by people; working dress; weather clothing.
- **Women.** The reliefs show essentially no women, so women's dress is reconstructed from other Achaemenid-period evidence and tiered B or C.
- **Photoreal humans:** subsurface-scattering skin, proper hair, refractive eyes, cloth with correct weave, drape and weight, and grime that matches each person's work. The physical variety of a cosmopolitan imperial centre.
- **Faces first.** Fix uncanny close-up faces before adding more people.

### 9.4 Interaction
- **Talking:** approach and address people. They respond in their own language (§10), with gesture and tone that make simple exchanges readable without translation. Dialogue is scripted.
- **`LLM_DIALOGUE`** (optional): runtime lines constrained to the NPC's knowledge, role, date and lexicon.
  - Calls go through a server proxy, so no API key ever sits in the browser.
  - A cost cap and a latency budget apply.
  - Scripted fallback when unavailable.
- **Translation** (layer on): subtitles for speech; look at an inscription to see its transliteration and translation.

### 9.5 A world, not a diorama

The test: you could spend weeks of in-game time here and keep seeing new things, because the world changes whether or not you're watching. Since dialogue in dead languages is short, depth has to come from **what people do**, not what they say.

- **What's simulated is what you see.** The simulation is never hidden bookkeeping behind generic walking crowds:
  - **Every activity is performed.** Each activity in the simulation has a visible performance with the right animation, tools, props and sound: grinding grain, kneading and baking, drawing water, pressing and sealing tablets, carving stone, loading mules, herding, weaving, eating, sleeping.
  - **No placeholder "working" loop.**
  - **Goods are physical objects.** Sacks, jars, tablets, timber, animals and silver are carried, loaded, stacked and stored. A storehouse's visible contents are its actual stock; a ration issue is people queuing and receiving real jars; construction progress is real geometry.
  - **Distance never breaks it.** Beyond full-detail range, people are cheaper to draw but still doing their real activity. When you arrive, everything is exactly where the simulation says it is.
  - **Test:** an activity-coverage check fails the build if any simulated activity lacks a visible performance or uses a placeholder. The shadow review (§13.11) confirms that what a person is doing on screen matches what the simulation says.
- **No two days alike.** Schedules vary with the calendar, weather, rations, arrivals, illness, mood and chance. People run errands, visit, argue, trade, idle and change plans.
- **A year of events,** driven by the calendar and the tablets where possible:
  - monthly ration issues;
  - caravans, couriers and delegations arriving and leaving;
  - the court coming and going;
  - harvest, shearing and planting;
  - festivals and offerings;
  - births, marriages, sickness and deaths;
  - disputes;
  - stores filling and emptying.
- **Long-term change you can watch:**
  - construction advances week by week (courses laid, columns raised, reliefs carved), with named work gangs;
  - fields ripen; the river rises and falls; stored goods move.
- **Cause and effect.** Events have consequences:
  - a late grain delivery means short rations;
  - a storm halts work;
  - a delegation arriving means feasting preparations, crowded roads and guards doubled.
- **Follow anyone.** Pick any person and shadow them for a whole day. It should make sense from waking to sleeping: where they go, who they meet, what they eat, what they carry.
- **Memory.** People remember the player: a guard who stopped you yesterday recognises you today; a baker you watched nods. Relationships between NPCs also change over time.
- **Persistence.** The world keeps running while you're away. On load, a fast catch-up simulates the elapsed time.
- **Things to do** without breaking realism:
  - watching crafts, work and ritual up close;
  - following people and events;
  - in visitor mode, period-plausible errands (e.g. carrying a sealed document to an official and waiting for it to be processed).

  No quest markers, no combat, no game mechanics that didn't exist.
- **A chronicle** (translation layer only): a log of notable events and where they're happening, so you can go and see them.

---

## 10. Language and writing

**No modern language is heard or seen in the rendered world.** English exists only in the out-of-world layers: translation, settings and menus.

- **Who speaks what** (verify in `LANGUAGES.md` before assigning languages to NPCs):
  - Persians: Old Persian.
  - Administrative and local staff: Elamite.
  - Everyone across the empire: Aramaic, the lingua franca and language of correspondence.
  - Babylonians: spoken Aramaic had largely overtaken Akkadian by this period, and Akkadian was mainly scribal. Verify this.
  - Craftsmen and delegations: their own languages as attested (e.g. Ionian Greek, Lydian, Egyptian).
  - Code-switching where plausible.
- **Writing.** Period scripts only, in period places:
  - Old Persian, Elamite and Babylonian cuneiform on the real royal inscriptions (published texts only, never invented);
  - Elamite on clay tablets; Aramaic ink on leather; seal impressions;
  - carved text is modelled into the stone;
  - fonts: Noto Sans Old Persian, Noto Sans Cuneiform and Noto Sans Imperial Aramaic (OFL), or better.
- **Dead languages, handled honestly.**
  - Old Persian survives almost entirely in royal inscriptions, with little everyday vocabulary. Elamite is better attested in the tablets.
  - `research/LEXICON/<language>.json` lists every usable word with its attested form, source, reconstructed IPA and tier.
  - Old Persian lines are short and draw only on the lexicon. Everyday talk leans on Elamite, Aramaic and gesture.
- **Voice.**
  - **Method:** speech is synthesised from the lexicon's IPA, converted to the synthesiser's own phoneme format (e.g. a neural TTS that takes phonemes, or eSpeak-NG).
  - **Rendering:** pre-rendered at build time where possible, with varied voices, ages and sexes; post-processed; spatialised.
  - **Crowd murmur:** synthesised from each language's sounds and rhythm.
  - **Acceptance:** the reviewer subagent rates intelligibility and naturalness.
  - **Swappable:** the pipeline accepts better voices or my own recordings later.
- **Language lint.** The build fails on any modern-language text or audio that would be **rendered or played in the world**. Code, data keys, research files and out-of-world UI are excluded.

---

## 11. Sound and music

- **Spatial audio:**
  - Web Audio with HRTF panning;
  - reverb from impulse responses generated for each space's real dimensions and materials;
  - occlusion; a mixer for dense ambience; streaming by zone.
- **Layers** vary by zone, time, season and weather:
  - wind off the mountain and through the columns;
  - birds, insects and animals;
  - water; rain on stone, timber and cloth; crackling fires;
  - tools, kilns and grinding;
  - crowds in period languages;
  - footsteps that change with the surface.

  Sources: CC0/permissive recordings and procedural synthesis only.
- **Music: only what someone in the world is playing.** No background score; a title-screen piece is allowed. No Achaemenid music survives, so every piece is a C-tier composition from B-tier ingredients:
  - **Court:** music at the king's meals.
  - **Sacrifice:** no pipes (Herodotus 1.132); a magus chants, unaccompanied, with text from the lexicon.
  - **Work and street:** work songs and herders' pipes; tier C, used sparingly.
  - **Foreigners:** their own traditions.
  - **Instruments:** only from period and regional evidence (harps, lyres, long-necked lutes, double pipes, frame drums, clappers), modelled at true size and played with matching animation.
  - **Tuning:** the seven-note string tuning recorded on Mesopotamian cuneiform tablets; Greek modes for Greeks.
  - **Banned:** equal-temperament harmony, and oud, duduk, santur or orchestral "ancient Persia" clichés.
  - **Production:** physical-modelling synthesis, with generative variation so repeat performances differ.
  - **Evidence:** verify each claim and record it in `SOUNDSCAPE.md`.

---

## 12. Licences, ethics and blocklist

**Licences.** `USE` in §0 decides which asset licences are allowed; record every asset in `ASSET_LEDGER.md` with its source, licence and credit. For personal, non-commercial use:
- CC0, CC-BY and CC-BY-NC are fine.
- Check each Sketchfab or Fab licence individually.
- If no usable licensed scan exists for a relief or a human, reconstruct it and tier it.

**Ethics.**
- **Religion:** Zoroastrianism is a living religion, so ritual is shown only as attested, respectfully, with nothing invented for spectacle.
- **Faces:** no scans of real people's faces without a licence that covers it.
- **Hard subjects:** dependent labour (*kurtaš*), children and punishment are shown as the evidence describes them, not sensationalised.

**Blocklist** (seed; extend it). The blocklist applies to the ancient world only; the calibration scene and the out-of-world Now view are exempt.
- **Later religious sites:** Sasanian reliefs and inscriptions at Naqsh-e Rustam and Naqsh-e Rajab; Sasanian domed fire temples.
- **Modern landscape:** Band-e Amir and other later waterworks; modern roads, fields, villages and plantations.
- **The ruin's later life:** traveller graffiti, restoration concrete and steel, 1971 celebration remnants, signage.
- **Anachronistic objects and styles:** stirrups; paper; everyday coin use (payment was largely in kind or weighed silver; check against your date); Islamic-era dress; Safavid motifs; onion domes; pointed arches.
- **Hollywood tropes:** bare-chested slave-soldiers, harem clichés, gold on everything, Greek hoplite gear on Persians.
- **Women's dress** from later periods.

---

## 13. Verification

Build these tools in Phases 1–2 and run them at every gate:

1. **Independent geometry.** Two subagents independently digitise Schmidt's plan and extract the spec. Diff their results and resolve every disagreement against the source. At least one check uses a source independent of Schmidt: an orthophoto or published coordinates.
2. **Plan overlay.** A top-down render against the georeferenced plan. Pass: ≥ 0.95 footprint IoU per building and < 0.5 m offset, or a documented reason.
3. **Dimension tests.** Automated checks that measure the built scene against `SITE_SPEC.md`.
4. **Camera rig.** A Playwright script renders fixed viewpoints matching known photographs and drawings, with the world state frozen.
5. **Lints.** Chronology and anachronism, using the period, source and tier metadata on every asset; and language (§10).
6. **Sky and weather.**
   - The sun position is within 0.1° of JPL Horizons for sampled dates and times.
   - A simulated year's monthly mean temperatures are within ±1 °C of the climate target.
   - Precipitation-day counts are within ±20%.
7. **Realism.** The checks in §8.
8. **Walkthrough bots.** Automated routes through every walkable area. They fail on errors, falls, stuck states, or objects popping in within 50 m in view.
9. **Independent review.** At each gate, a subagent that hasn't seen the build process audits it against the spec, chronology and screenshots. **Pass:** no open critical findings. Everything else is logged.
10. **Performance.** Proxy budgets at every gate, plus benchmark mode (§6).
11. **Soak test (the anti-diorama gate).** Run the simulation headless for **one full in-game year** and measure:
    - **Variety:** define a day-similarity measure over each NPC's places, activities and encounters. No NPC's days are near-copies of each other; trivial jitter doesn't count as variety. The number of distinct event types per week is above a floor you set and justify.
    - **Stability:** no stuck agents; stores and rations don't collapse to zero or grow unbounded.
    - **Visible change:** construction progress and seasonal change are measurable.
    - **Shadow review:** a reviewer subagent shadows 20 random NPCs for a full day each and scores plausibility. Pass: no score below 4 out of 5.

---

## 14. Phases

Depth before breadth: perfect one route before spreading out. **Every gate leaves a runnable build.**

| # | Deliverable | Gate |
|---|---|---|
| 0 | Lean research bible (date decision, `CHRONOLOGY`, Terrace `SITE_SPEC`, blocklist, sources, `SUMMARY`; other research files as stubs). Environment preflight. `NEEDS_FROM_ME.md` written in the first hour. | Every filled row sourced and tiered; independent geometry extraction diffed; review passed |
| 1 | Engine foundation with subsystem benchmarks; layered terrain; sky, time and weather; the player; game shell; save/load; test harness; benchmark mode | Terrain spot-checks and §13.6 pass; budgets recorded |
| 2 | Terrace greybox, built entirely by the parametric generators | Plan overlay and dimension tests pass |
| 3 | **Vertical slice:** plain → Grand Stairway → Gate of All Nations → Apadana forecourt and hall, at full fidelity: materials, reliefs, colour, light, weather, fire and smoke, sound, a minimal speech and crowd-murmur pipeline, 50–100 living NPCs. Built after the calibration scene matches its photo. | All §13 checks pass for the slice; a walkthrough bot completes the route; the §1.1 moments on this route land in review |
| 4 | The rest of the Terrace, at slice fidelity | §13 passes for the whole Terrace |
| 5 | People and animals at scale: economy-driven schedules, households, wildlife, simulation LOD; the §9.5 systems (events calendar, cause and effect, memory, persistence) | Full evidence-based population simulated; rendered floors met within budget; no pop-in; soak test (§13.11) passes |
| 6 | Settlement: lower town, gardens, workshops, Tol-e Ajori | Lints pass; layout sourced and tiered |
| 7 | Plain and horizon: fields, rivers, canals, roads, villages, Naqsh-e Rustam, seasons across the year | Lints pass; proxy performance at the plain vista |
| 8 | Full language, dialogue and speech; music; translation layer and map; Now view (stretch); photo mode | Language lint passes; every translation is sourced |
| 9 | Polish and optimisation | Full §13 pass |

---

## 15. How to run this

1. **No questions, no pauses.**
   - Decide from the evidence hierarchy.
   - Record the decision and the alternatives in `DECISIONS.md`.
   - Proceed. Decisions can be reversed later; stopping can't.
2. **Plan first.**
   - Before Phase 0, create a task list covering every phase and gate, and keep it current.
   - Parallelise independent work with subagents (by source set, building or asset category).
   - Research subagents return citations, not recollections.
3. **Preflight (Phase 0).**
   - Check the Node, Chromium, Blender and Python versions; install what's missing.
   - Set a disk budget and clean up intermediates as you go.
   - Probe network access to every host you'll need.
4. **`NEEDS_FROM_ME.md`.** Within the first hour, list exactly what I should supply, with file names, URLs, target folders and why:
   - blocked downloads;
   - logins and API keys (e.g. a USGS EarthExplorer account for CORONA, a Copernicus CDS key for ERA5, a Sketchfab account);
   - hosting.

   Use the no-login fallbacks until I do. I may drop files into `data/` mid-run, so check for them at the start of every phase.
5. **References.** My images live in `references/` (`mood/`, `mockups/`, `buildings/`, `people/`, `landscape/`, plus `notes.md`).
   - Catalogue them in `references/INDEX.md`, and recheck the folder every session.
   - They guide mood, composition and palette. Where they conflict with the evidence, the evidence wins and the conflict is logged.
6. **Blockers never end the run.**
   - Use this brief's fallback if there is one. Otherwise build the most faithful labelled substitute.
   - Log it in `BLOCKERS.md`: what's blocked, why, the evidence, and what would unblock it.
   - Move to unblocked work, and revisit blockers at the end of each phase.
7. **Gates bind.** Never lower a gate to pass it. If a gate still fails after a genuine fix attempt:
   - log the measurements;
   - mark the phase "passed with logged exceptions";
   - continue only if later phases don't depend on the failing item.
8. **Memory across sessions.** `CLAUDE.md` (the intent in §1.1 and the rules in §3, §10, §12, §13 and §15), `PROGRESS.md`, `DECISIONS.md`, `BLOCKERS.md` and the task list are your memory.
   - Update them after every task, and commit at every gate.
   - Push only if a remote is configured, and never force-push.
   - After any compaction, restart or usage-limit stop, reread this brief and those files, then resume from the first unfinished task. If I type only "continue", that's what it means.
9. **Finish.** Write `FINAL_REPORT.md`, problems first:
   - how to run and deploy the build;
   - what is complete, and what is placeholder or C-tier;
   - every blocker, with what I'd need to supply;
   - the `REAL_HARDWARE_TODO.md` items;
   - the top ten improvements for a next run.

---

**Begin now: write the full-run task list, run the preflight, then execute Phases 0–9 without stopping. No game code until the Phase 0 research bible exists.**
