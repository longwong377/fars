# Audit C: people and the life of the place, traced requirement by requirement

**Auditor:** an independent subagent (Claude Opus 5.5). I did not build any of this. **Date:** 2026-09-26.
**Tree:** HEAD `cc052dd` on `claude/amazing-fermi-40ds7j`. No `src` change since `9a3b709`, where the probes ran.
**Scope:** brief §9.1–§9.5, every clause; brief §5.5; the §1 observer and visitor modes; and the people/life directions
UD-07, UD-08, UD-09, UD-10, UD-11 and UD-14 (USER_DIRECTIONS.md, D-236).
**Method:** I read the brief, CLAUDE.md, PROGRESS.md, BLOCKERS.md, HANDOFF.md, USER_DIRECTIONS.md, D-229/D-233/D-236,
REVIEWS/phase5.md, shadow_phase5_r10(_b).md and gap_audit.md. I read the code paths that decide what a walker sees and
hears: world.ts, crowd.ts, popview.ts, popgeo.ts, impostors.ts, exchanges.ts, memory.ts, sim.ts and visitor/*.
I looked at every people render on disk (`shots/`).

The central method is new here. **Six read-only node probes** stand where a walker stands and sample the population view
once a second, exactly as the renderer receives it. They measure what a walker would see: overlaps, jumps, standing
performers, rain, repetition across days, carried things and impostor frames. The scripts are in the session scratchpad
(`walk_probe.ts`, `why_probe.ts`, `variety_probe.ts`, `treadmill.ts`, `carry.ts`, `masons.ts`), and each is run as
`npx tsx <script> <args>`. I ran no Playwright and changed no source or record file.

**How to read the status column:**
- **VERIFIED:** measured where the player meets it (browser, or a node measure of exactly what is drawn), recently.
- **BUILT-UNVERIFIED:** the code exists, but nothing shows it working where the player is.
- **PARTIAL:** part of the clause is met.
- **PROXY-ONLY:** a data or text measure passes, but what the player sees or hears is not measured, or contradicts it.
- **MISSING:** not built.
- **SCOPE-GAP:** the project never treated this as a requirement (no task, no test, no gate).

---

## 1. MAJOR MISSES, ranked (worst first)

### M-1. No check of what a walker SEES or HEARS among people exists. The brief's own on-screen check was never run.
- **The clause.** §9.5 says: "The shadow review (§13.11) confirms that what a person is doing on screen matches what the
  simulation says."
- **What was run instead.** Every round, including the passed round 10, scored text timelines only. Reviewer A: "I scored
  from the day timelines and the research files only" (shadow_phase5_r10.md l. 7). The sample generator
  (tools/shadow_days.ts) prints the plan's words. It does not print where the population view actually puts the person
  (open court or room), what frame an impostor shows, or whether the person is heard.
- **No moving picture of people exists.**
  - Every people render is a frozen single frame: `renderOnce` with `settle`, the world clock stopped.
  - No browser run has let people move in time since session 3. That covers people.spec "people move with world time",
    visitor.spec, walkthrough.spec and audio.spec. The population view (D-143), the court, D-168 exchanges, D-210 animals
    and D-215 children all came later.
  - The §13.8 walkthrough bot has never run in a browser with the population (Phase 5 review M5).
- **No street-level render of the town is on disk.** `lane-q_s1` was not rendered this session. The only close town view
  is `settlement-workshop-area-b` (M-5).
- **Consequence.** Misses M-2 to M-7 below are year-wide contradictions between the simulation's words and the drawn world.
  A text review cannot see any of them. Each was found in minutes by standing a probe where a walker stands.
- **SCOPE-GAP.** Nothing in the gates asks what a person on screen is doing next to what the plan says. Nothing asks
  whether a talking person makes a sound.

### M-2. People "shelter from the rain" in the plan and stand in the open rain on screen
- **The probe.** `why_probe.ts -422 -941 12 10.1 60`: day 12 at 10:06, rain 1.00 (the heaviest), 60 m around the q_s1
  main street.
  - **445 people are drawn out of doors, all of them in open walled courts.** On a dry day (day 25) the same spot has 386.
  - What the plans say they are doing there:
    - 66 "playing indoors";
    - 27 "playing indoors out of the rain";
    - 8 "minding … indoors out of the rain";
    - 11 "at home: storm: no garden work";
    - 5 "storm: no work on the Terrace today";
    - 4 "storm: no work on the building site today";
    - 32 spinning, 60 weaving, 45 working wood and 46 "handling treasury supplies", all in open courts.
- **The cause.**
  - `popgeo.ts:76`: `INDOOR = sleep, lie_ill, offmap`.
  - `inPlot()` (l. 202–209) puts every other act at home in an OPEN cell when the plot has one.
  - So the simulation's weather response is drawn as its opposite.
  - The crowd has no rain posture and no cloak over the head. `shelter` is `idle` (activities.ts:122 says "the cloak drawn
    over the head", but no garment piece exists for it). Garments have no wet state. Only the cold changes dress
    (`outfits.weatherMask`, < 8 °C).
- **By day, no house room is ever occupied.** Rooms hold only sleepers and the sick, and those are hidden (M-7).
- **Brief clauses broken:**
  - §9.2 "People shelter from rain … stop work in storms";
  - §9.5 "what's simulated is what you see";
  - §1.1 "rain moving across the plain" (the people under it).

### M-3. 99.7 % of the population cannot be addressed, never speaks, is never heard and never remembers the player
- **Only the 135 detailed agents are wired to speech and memory** (100 guards, 12 masons, 6 porters, 4 grinders,
  3 officials, 3 children, 2 scribes, 2 bakers, 2 couriers, 1 foreman). The following loop over `sim.agents` only:
  - `world.address()` (world.ts l. 339–352 of the build fn);
  - `Conversations.update(…, sim.agents …)`;
  - the murmur talkers (`sim.agents.filter(… sound === 'murmur')`);
  - `PlayerMemory` (`sim.notice` and `noteAddressed`);
  - the visitor-mode guards.
- **The other 46,775 people, the whole town and plain, are mute.** Pressing E beside a townsman returns nothing. The
  population's `talk`, `exchange`, dispute ("raised voices"), wedding and play acts make no sound, and no jaw moves.
  - The town soundscape has no human layer (soundscape.ts: dogs, cocks, donkeys, kites). Tool strikes are the only human
    sound there (crowd.onHit).
  - A lane with 386 people within 60 m, 117 of them children playing, is silent of voices.
- **"A baker you watched nods"** (§9.5) is possible for 2 people. There are 12 brewers, 40 millers and 30 camp women, and
  every townswoman grinds.
- **"Step aside" (§1 observer mode) is MISSING outright.** grep finds nothing.
  - The 48 population capsules within 20 m are kinematic (world.ts `syncPopBodies`). A walker pushes the player aside, not
    the reverse.
  - Plans and routes never see the player.
- **Gesture (§9.4 "with gesture and tone").** Speaking moves only the jaw (`crowd.speaking`), with a head turn. There is
  no gesture animation. The fallback when no line exists returns the words "nods" to the console.
- **Voices.** "Nobody has listened to the voices" (PROGRESS). The §10 acceptance is open (H8, B17b).

### M-4. At distance about half the working population is frozen, and hundreds walk on the spot
- **Impostors on HEAD.** `impostors.ts` FRAMES has 13 static frames; `frameOf` falls to `stand` for every other animation.
  Impostors are everyone outside the nearest 448, at any distance.
- **The probe.** `treadmill.ts 25 45`: every awake person's plan at 10:00 and at 15:00, halved to one moment.
  - **Day 25: about 22,500 people's work is drawn as a standing figure.** Plough ~8,400; spin ~4,200; ball games ~2,400;
    mend ~2,300; archery ~1,500; hoe ~1,200; then groom, irrigate, fodder, gather, stoke, polish, herd, weave, adze, pick
    and lay.
  - **Day 45 (harvest): about 25,000.** Reap ~6,300; drive ~5,100; winnow ~2,400; bind ~2,400.
  - This is the Phase 5 review's M4, still open on HEAD. **The fix (D-229: 42 measured frames, fallbacks counted as
    placeholders) sits on the unmerged branch `worktree-agent-a77ac53305a706d11`** (f746922, 385b2e3;
    `git merge-base --is-ancestor f746922 HEAD` → not merged). D-229's C1 fix (the court's festival day) and the B53/B54
    measurements are on the same branch.
- **Walking on the spot, near the player, in full detail.** A "moving" activity (carry_sack, carry_jar, carry_bread) given
  at a standing spot is performed as walking in place (`crowd.ts` IN_PLACE_RATE, l. 60–63).
  - At any daytime moment **~380 (day 25) to ~710 (day 45) people walk on the spot with a jar or sack.** Examples:
    - "carrying the water jar along the rows to the reapers": ~350 on day 45;
    - "carrying water for the mortar": 85–130;
    - "handling treasury supplies": 42–46 in the Treasury workshop courts beside the q_s1 main street, every morning.
  - The funeral bearers walk in place for 1.5 h at the burial ground (Q-196).
  - `lint:activity` and the overlay's placeholder counter do not count either the walk in place or the stand fallback. The
    counter checks only the registry's `placeholder` flag (crowd.ts ~l. 616).
- **Brief clauses broken:** §9.5 "No placeholder 'working' loop", "Distance never breaks it", and §6 "cheaper animated
  crowds mid-range".

### M-5. Copy-pasted people: faces, bodies, idles, crowds and scenes (UD-08 "nothing copy pasted")
- **Bodies and faces.** `humans.json` has **23 variants for 46,910 people**:
  - 12 adult men;
  - 4 adult women (about 3,500 women on each face);
  - 3 elder men and 1 elder woman (every old woman is one woman);
  - 3 children: 2 boys and **1 girl**, so every girl in the world has one face and body.
  - No per-person face shape exists: looks.ts varies stature, skin, hair, beard, garment colour and pieces only.
- **Names.** 209 distinct names; Persian men have 27, about 766 each (person_census.ts; D-236, known to the lead).
- **Idle and queue.** One `idle` cycle with per-person sine fidgets. The ration `queue` and `shelter` are that idle.
- **The only close town render** (`settlement-workshop-area-b-high-webgpu.png`, 2026-09-25 22:43, looked at): about 40
  men in the same crouch, in near-identical off-white tunics and the same haircut, on bare ground among scattered sticks. It
  reads as a cloned crowd.
- **Scene-level repetition** (`variety_probe.ts -422 -941 10 60 25,26,27,32,60`). Compared with day 25 at 10:00, the same
  person doing the same act within the same metre makes up:
  - day 26: 49 % of the scene;
  - day 27: 42 %;
  - day 32: 43 %;
  - day 60: 39 %.

  The act mix stays within ±10 % (weave 50–68, play 110–122, carry_sack 39–46, work_wood 38–46). Workers at their own
  looms are right. Nothing in this lane changes with the calendar, though: no arrival, no event, no market, no weather
  sign. D-236's "the same place at the same hour on different days must differ" has no measure yet, and this is its
  baseline.

### M-6. Bodies pass through each other, slide and hurry
- **The probe.** `walk_probe.ts -422 -941 25 10 30 60`: 30 min on the q_s1 main street, 1 s steps. Found:
  - **10 walker–walker pairs and 16 walker–stander pairs closer than 0.45 m, down to 0.00 m.** Porters on identical
    routes (the storehouse → workshop q_s1-0058, -0038, -0120) walk the same polyline at the same time, one inside the
    other.
  - Population walkers have no local steering at all. Only standing people are separated (`popview.separate`).
  - 36 jumps over 3 m in 1 s within 60 m: children "walking with the mother" dragged at 3–5 m/s (Q-439, known).
  - A man "out to the garden channels" at 3.1 m/s in walk gait. `MAX_PACE` 1.8 is counted (`hurried`: 53 in 30 min) but
    not capped.
- **The render.** `moment-court-assembly-webgpu.png` (2026-09-26 03:39, the newest) still shows the foreground carrier's
  jar covering his head (R1; Phase 5 review m6). The player's capsule is not the problem here: the carry pose is.

### M-7. Nobody is ever seen indoors, asleep or ill. Following a person home ends at the door.
- **Sleep and illness are never drawn.** `sleep`, `lie_ill` and dark `rest` are hidden in rooms (popgeo INDOOR). The q_s1
  street at 23:00 on day 25 has 0 people within 60 m (probe). A walker who enters any house at night finds no sleeper. By
  day a walker finds no one in any room (M-2).
- **Sickness (§5.5, §9.5 "sickness") is visible only as absence.** A sick person lies hidden. Only the D-211 healer's
  walk shows.
- **"Follow anyone … waking to sleeping" (§9.5).** The person disappears at the room door at bedtime and appears there at
  dawn. No one wakes, dresses or eats indoors.
- **The houses.** They are PLACEHOLDER boxes with street doors fixed open (D-228; D-234 in progress). No household
  furnishings are drawn in rooms: only court fittings (oven, quern, loom, jars).

### M-8. Cause and effect happens in the chronicle, not in the world
- **Short rations** (E-01, CE-02/03: "grain short; made up in flour", "only 60 % issued") change nothing a walker sees.
- **"A storehouse's visible contents are its actual stock"** holds for two sack piles only: the depot at the stair foot and
  the Treasury store (crowd.ts `sacks`, from `sim.stock`). These stay static:
  - the town storehouse (stores-0001), whose stock the calendar keeps;
  - the Treasury goods (`buildTreasuryGoods`);
  - the palace stores (furnish_palaces.ts l. 301);
  - the granaries, wine and beer.
- **The ration issue.** People "queuing and receiving real jars" is a standing idle clump at the issue place. No issuer and
  no measuring out are drawn, and the queue is ring-separated, not a line. The grain carried home depends on the plan's
  carry words.
- **"A delegation arriving means feasting preparations, crowded roads and guards doubled."** Delegations exist only in the
  court setting (D-199). D-236 makes the court default, but the arrival and departure are not built. The only guard
  doubling is E-81 at the Treasury door.
- **"A late grain delivery".** Deliveries are plan and traffic data. No late event is staged where it can be seen.
- **Construction** (§9.5 "courses laid, columns raised, reliefs carved"): only the Hall of 100 Columns' columns follow
  the simulation. "Walls and relief carving stay at their day-0 geometry" (construction.ts l. 7). The newest render of the
  site (`moment-hall100-site-webgpu.png`, 2026-09-26 03:26) shows the masons' yard empty in frame. The masons are 25 m out
  of frame (masons.ts), and the frame shows no work in progress.

### M-9. At distance, and in the plain, animals vanish; much of §5.5 is not built
- **Working animals are placed only for performers within 400 m** (`THINGS_DIST`). Beyond that, the flocks of 908 herders,
  the plough oxen and the threshing animals are not drawn at all. From the Terrace a walker sees ploughmen standing (M-4)
  with no oxen. `plain-stair-noon-plain-d227r2` (looked at) shows people and tethered strings at the stair foot to about
  400 m, and nothing working beyond.
- **Movement.** Walk gait only, no reins, and wheels do not turn (PROGRESS D-210).
- **Not built:**
  - rats, bats and storks; flies that can be seen (they are heard);
  - litters;
  - the delegations' animals;
  - the stockyard, the mill, tanning and dye works (gap audit 19 and 20 open), which leaves "dung and animal pens" and
    "slaughter for the royal table" on open ground;
  - dates arriving (no hit).
- **Carried tools.** In 60,789 of 286,912 carried segments (3 days sampled; 5,001 person-hours; `carry.ts`) the tool is
  not drawn on the way to or from work: a winnowing fork, sickle, "the plough and the yoke, driving the oxen", hoe, driving
  stick or mattock. propOf maps only jar, sack, basket, tablet and spear.

### M-10. The sandbox the brief promises is thin, and was last seen working in session 3
- **Visitor mode.**
  - One errand ("a sealed letter for the treasurer").
  - Guards only at Terrace posts, and only the 100 detailed guards. There are no town or road checks.
  - The escort is a phantom crowd extra (`id -4670`), not a person of the simulation.
  - "The town part has not been walked in the browser" (PROGRESS). The e2e dates from session 3, before the population
    view.
- **"Inspect things"** (§1): the interact key opens doors or addresses a detailed agent. Objects cannot be inspected; only
  inscriptions are read, in the translation layer.
- **Being noticed.** A head glance within 7 m for every skinned person, and a nod for the familiar (crowd.ts l. 685–696).
  "The greeting nod [is] not yet seen" in any render (PROGRESS). Nobody reacts beyond the head: no pause, no stop, no step
  back.
- **Not built:** "small goals" (§9.2; 0 hits for "goal"), and a per-person history (UD-08, D-236). NPC relationships
  change (`pop.relate`, affinity), but they surface only through the 135 agents' exchanges: PROXY-ONLY.

### M-11. Gate and process holes that let these misses pass
- **The Phase 5 gate is still FAIL** (REVIEWS/phase5.md: C1, M1–M6). Its fixes are unmerged (M-4).
- **Floors.**
  - Default world: the browser floor of ≥ 300 visible is not met at ground level (B11).
  - Court setting: the browser evidence file is gone (M1), and the only court render shows a loose crowd.
  - B13: over the triangle budget in 3 of 7 views.
- **The simulation runs on the main thread** (M3; B53 exists only on the unmerged branch). The world is slowest exactly at
  the adjustable time scale that makes "weeks of in-game time" watchable.
- **"Faces first. Fix uncanny close-up faces before adding more people"** (§9.3). The people score has been 2 since
  session 6 (rubric s6 pass 1 and s7 pass 2). Meanwhile the court (9,310), the retinue (16,500), babies, delegations and
  animals were added.
- **The activity-coverage lint** passes on registry flags, not on what is drawn. It is blind to M-4 and to M-7 (sleep is
  "performed" but never drawn in the town).

---

## 2. Traceability table

Evidence dates are 2026-09-2x. "probe" means my node probe on HEAD, 2026-09-26. The file references are in src/ unless
stated.

### §9.1 Who

| # | Requirement (quoted) | Where implemented | Verification and latest evidence | Status | Note / scope gap |
|---|---|---|---|---|---|
| 1 | "Named individuals from the evidence appear only in their documented role, place and period. Behaviour beyond the evidence is tiered C." | research/PEOPLE.md §1; names.json `notable` kept out of the pools; the king as a person in the court setting (D-199) | No named 467 official is placed. PEOPLE.md: the treasurer succession has no years, and there is "no name" for the governor | PARTIAL (the evidence gap is honest) | §1.1 "many of these people are real and named" is not felt anywhere. No attested individual (e.g. a PT workforce chief such as Herdkama, even as C) is placed in role |
| 2 | "officials and scribes (Elamite on clay, Aramaic on leather)" | sim roles official ×3 and scribe ×2; population 15 officials and 27 scribes; the scribes' room D-221 | court-assembly and scribe renders (2026-09-26 01:06); the Aramaic sheet carries no writing (D-221) | PARTIAL | The scribes read as bare-chested in renders (Q-544); the lamp is never lit |
| 3 | "treasury workers and storekeepers" | population treasury 1,038, storekeeper 20 | plans only; the workshop courts (probe) | BUILT-UNVERIFIED | 42–46 "handling treasury supplies" walk in place (M-4) |
| 4 | "guards, including the royal guard with spears and their documented butt ornaments" | 100 detailed guards; D-215 butts; court spearmen D-182/D-221 | court-assembly render: "spearmen's files not legible at eye level" (PROGRESS) | PARTIAL | |
| 5 | "craftsmen from across the empire, stone-cutters, carpenters" | builders 645, craftsmen 305; masons ×12 detailed | hall100 renders; workshop-area-b | PARTIAL | Clone crowd (M-5); smiths and potters never seen at work (gap 20) |
| 6 | "bakers and brewers, grooms, camel and mule handlers" | camp bakers, brewers 12, grooms 24; traffic strings (D-210) | node only | BUILT-UNVERIFIED | brew is performed at a vat; never rendered |
| 7 | "couriers carrying sealed travel authorisations" | E-20 couriers (traffic riders); 2 detailed couriers; E-21 parties show a halmi (event text) | node only | PROXY-ONLY | The halmi is a text event; the courier's document is not visible |
| 8 | "priests performing the offerings attested in the tablets" | D-209 precinct, magi, lan, offerings, wordless chant | node tests (religion.test.ts); "never rendered in a browser, the chant never heard" | BUILT-UNVERIFIED | |
| 9 | "farmers and herders" | farmer 12,077, herder 908, shepherd 32 | probe: at 10:00 the plough and hoe fall to the `stand` frame at distance; flocks not drawn beyond 400 m | PARTIAL | M-4, M-9 |
| 10 | "women and children in work groups (the tablets record their rations, including maternity rations)" | camp women and children; E-04 mother's ration | plans; event text | PROXY-ONLY | The maternity ration is a chronicle line only |
| 11 | "envoys and delegations" | court setting D-199 (23 peoples) | node only; D-236 makes the court default (not built) | BUILT-UNVERIFIED | Their animals are not drawn |
| 12 | "Soldiers and guards are a constant, visible presence" | GUARD_POSTS rota (16 posts) | people.spec (session 3): 16 posts held | VERIFIED (Terrace, old) / MISSING (town, roads) | No guard in the town, at Tol-e Ajori or on the roads |
| 13 | Royal guard "with the king and at the palaces … spear, bow and quiver, short sword (akinaka), wicker shield" | outfits (quiver, bow, akinaka, shield for a share); court.ts | humanlab renders; court render | PARTIAL | Files not legible; laid aside when seated |
| 14 | Fortress/gate guards "stand at gates and stairways, work shifts with changeovers, patrol, and are housed in the garrison quarters" | sim.ts rota, watches, `patrol`; garrison places; E-80 change of watch | node tests; shadow reviews (text) | PROXY-ONLY | A guard's round at the post is walked in place (crowd.ts IN_PLACE_RATE note) |
| 15 | "Other units: cavalry and horse lines, archers, and couriers of the royal road" | court horse lines (court.ts l. 699); `train` archery; traffic riders | node only | PARTIAL | No cavalry unit in the default world |
| 16 | "scale armour worn under tunics … B-tier. Drill and training scenes are C-tier" | `train` (archery at a target) | node only | BUILT-UNVERIFIED | Armour is hidden by definition |
| 17 | "guard, escort, check travel authorisations (this drives access in visitor mode), carry signals, eat, sleep, gamble and idle. They do not fight" | visitor controller; gamble (dice); eat; sleep | visitor e2e session 3 | PARTIAL | "carry signals": no hit. The escort is a phantom extra |
| 18 | "With the king present, they are at full ceremonial strength; when he's away, a smaller garrison keeps watch, especially on the Treasury" | court.ts 1,000 spearmen (setting); the 100-man garrison; E-81 Treasury doubling | node | BUILT-UNVERIFIED | Default court per D-236 is not built yet |
| 19 | "The king, when present, follows attested court protocol: seclusion, audiences, parasol and fly-whisk bearers. His face is reconstructed and tiered C" | D-199 king as a person; audiences 2 mornings in 5; `crowd.ts` the king does not turn | node; the court render does not show him | BUILT-UNVERIFIED | Bearers not locked in step (B12) |
| 20 | "Names for unnamed NPCs come from names attested in the tablets, matched to origin. Never invent 'Persian-sounding' names" | names.json, names_recalled.json; D-213 composed women's names; D-236 supersedes "never invent" | person_census.ts: 209 names; Persian men 27 names for 20,736 | PARTIAL | UD-08 "nothing copy-pasted" not met (M-5) |

### §9.2 Lives

| # | Requirement (quoted) | Where implemented | Verification and latest evidence | Status | Note / scope gap |
|---|---|---|---|---|---|
| 21 | "Every NPC has: a home, household, job, ration entitlement, daily and seasonal schedule, social ties and small goals" | population.ts households, jobs, groups, plans, ties | census: household 100 %, job 100 %, living with others 99.3 % | PARTIAL | **Small goals: MISSING** (0 hits). **History: MISSING** (UD-08) |
| 22 | "Needs: food, water, rest, warmth, shelter, company, and duty … Each person's planned routine bends to these, to events and to weather" | plans (meals, water trips, heat rest, cold dress, shelter); sim.ts hunger and fatigue for the 135 | soak 2026-09-25 8/8; shadow r10 PASS (text) | PROXY-ONLY | Shelter contradicted on screen (M-2) |
| 23 | "People make decisions; they don't follow fixed paths" | population plans are pure functions of (seed, person, day, calendar); decisions are runtime only for the 135 | — | PARTIAL | 46,775 people cannot react to anything outside the calendar: the player, a blocked lane, a door |
| 24 | "What drives schedules: the documented economy (rations issued, goods moved, gangs assigned, travellers arriving, the royal table supplied), plus time, season and weather" | calendar.ts E-01…E-81 | soak events 14–20 kinds a week | VERIFIED (data) / PROXY-ONLY (seen) | |
| 25 | "People shelter from rain, cover up in cold, change routes, and stop work in storms" | plans; outfits.weatherMask (cold) | probe day 12: 445 drawn in open courts in rain 1.00 | **PROXY-ONLY (contradicted)** | M-2. "Change routes": no evidence. Cold dress: BUILT-UNVERIFIED |
| 26 | "Fires are lit at dusk" | hearthSmoke.ts follows the households (D-220) | town-smoke-dusk renders 2026-09-26; B49: 0 flames in line of sight from the §1.1 cameras | PARTIAL | |
| 27 | "Animals have owners, jobs and routines; wildlife follows time and season" | fauna.ts closed-form; traffic; animals with performers; swallows seasonal; jackals dusk to dawn | fauna and wildlife tests (node); "never rendered in a browser" (D-210) | BUILT-UNVERIFIED | Beyond 400 m no working animal is drawn (M-9) |
| 28 | "Continuity: simulation LOD keeps everyone where they should be when you arrive" | popview pure plans; sim LOD (D-017) | node pop-in walks 1.6 km and 634 m, 0 pop-ins (Phase 5 review) | VERIFIED (node) | Browser walk never run (M5) |
| 29 | "Population: everyone who lived there exists. No arbitrary cap. Estimate the real population per zone, season and time in PEOPLE.md" | PEOPLE.md P5.6; 46,910 people (court absent) | Phase 5 review: holds | VERIFIED | |
| 30 | "When the court is resident, expect thousands on and around the Terrace and tens of thousands across the plain" | court setting: 76,238 people | node; the court-year soak fails plansWellFormed on HEAD (C1; fix unmerged) | PARTIAL | Default court (D-236) not built |
| 31 | "Simulate them all … only people near the player get full behaviour" | two tiers (D-021) | soak | VERIFIED (sim) | "Full behaviour" (speech, memory, reaction) exists only for the 135 (M-3) |
| 32 | "≥ 300 visible in the busiest scenes" | crowd, popview, impostors | B11: default not met at ground level; court browser evidence missing (Phase 5 M1) | PARTIAL | |
| 33 | "≥ 50 at full close-up detail near the player" | MAX_FULL 50 | court-view.json, hall site | VERIFIED (node) | |
| 34 | "distant crowds on roads and in fields read as people, not dots" | impostors to 5 km | plain-stair-noon render: read at 100–400 m | PARTIAL | They read as people but frozen (M-4) |

### §9.3 Appearance

| # | Requirement (quoted) | Where implemented | Verification and latest evidence | Status | Note / scope gap |
|---|---|---|---|---|---|
| 35 | "the Persian court robe with its pleats and fluted headgear" | outfits D-206/D-225 (pleats baked) | humanlab 2026-09-25; rubric people 2 | PARTIAL | No cloth simulation; the robe swings rigidly |
| 36 | "Median riding dress (tunic, trousers, the kandys worn draped with empty sleeves, soft cap)" | outfits | "the kandys hangs like a flat cape" (PROGRESS) | PARTIAL | |
| 37 | "delegation dress by people; working dress; weather clothing" | delegations.json (setting); worker dress; cold mask | node only (delegations); cold only | PARTIAL | No rain clothing; the plan's `wear` (face wrapped against the dust, best clothes for festivals) is never drawn (sim.ts Task.wears "not drawn yet"; no reader in crowd/popview) |
| 38 | "Women … reconstructed from other Achaemenid-period evidence and tiered B or C" | woman dress; court women D-215 | node | BUILT-UNVERIFIED | 4 adult and 1 elder female body for about 18,000 women (M-5) |
| 39 | "subsurface-scattering skin, proper hair, refractive eyes, cloth with correct weave, drape and weight, and grime that matches each person's work" | humanMaterial.ts; looks grime | humanlab D-225 renders; rubric s7 pass 2 people 2 | PARTIAL | |
| 40 | "The physical variety of a cosmopolitan imperial centre" | skin cline, stature, 23 variants | census of humans.json | **PARTIAL (weak)** | 12 male, 4 female and 3 child faces (M-5) |
| 41 | "Faces first. Fix uncanny close-up faces before adding more people" | — | people 2 while the population grew by tens of thousands | MISSING as a process rule | |

### §9.4 Interaction

| # | Requirement (quoted) | Where implemented | Verification and latest evidence | Status | Note / scope gap |
|---|---|---|---|---|---|
| 42 | "approach and address people. They respond in their own language (§10), with gesture and tone … Dialogue is scripted" | world.address (sim.agents only, 3.5 m); exchanges.ts addressIntents | people.spec "addressing a guard" (session 3–5); voices never listened to | **PARTIAL (0.3 % of people)** | M-3. Gesture MISSING; tone machine-measured only |
| 43 | "LLM_DIALOGUE (optional): … server proxy … cost cap … scripted fallback" | — | — | MISSING (optional stretch) | |
| 44 | "Translation (layer on): subtitles for speech; look at an inscription to see its transliteration and translation" | translation.ts; lastSubtitle | translation.spec (session 3); B17a translations are the project's own | BUILT (old e2e) | No subtitle e2e (phase8_b) |

### §9.5 A world, not a diorama

| # | Requirement (quoted) | Where implemented | Verification and latest evidence | Status | Note / scope gap |
|---|---|---|---|---|---|
| 45 | "you could spend weeks of in-game time here and keep seeing new things, because the world changes whether or not you're watching" | calendar; persistence | soak 354 days; scene probe 39–49 % identical | PROXY-ONLY | M-5 scene repetition; M3 main-thread cost at speed |
| 46 | "What's simulated is what you see. The simulation is never hidden bookkeeping behind generic walking crowds" | popview; crowd | probes | **PROXY-ONLY (contradicted)** | M-2, M-4, M-7, M-8 |
| 47 | "Every activity is performed … right animation, tools, props and sound" | activities.ts 65 activities; lint:activity 0 placeholders | lint passes; probes show sound only for the 135 (murmur) and missing tools on walks | PARTIAL | Sound for talk and exchange is missing in the population (M-3); tools not carried (M-9) |
| 48 | "No placeholder 'working' loop" | — | ~22–25 k `stand` impostors; ~380–710 walking in place (probe) | **MISSING in effect** | M-4; the D-229 fix is unmerged |
| 49 | "Goods are physical objects. Sacks, jars, tablets, timber, animals and silver are carried, loaded, stacked and stored" | props (sack, jar, basket, tablet, spear, bowl, cloth); strings of donkeys | carry.ts: 21 % of carried segments have no drawn prop | PARTIAL | No timber or silver carried |
| 50 | "A storehouse's visible contents are its actual stock" | crowd sacks (the depot and Treasury store only) | node | PARTIAL | M-8 |
| 51 | "a ration issue is people queuing and receiving real jars" | `queue` = idle; issue place | plans | PROXY-ONLY | No issuer and no hand-over; not a line |
| 52 | "construction progress is real geometry" | ConstructionView (hall100 columns only) | construction_view.test; the columns "not yet seen in a render" per PROGRESS | PARTIAL | Walls and reliefs are static |
| 53 | "Distance never breaks it. Beyond full-detail range, people are cheaper to draw but still doing their real activity. When you arrive, everything is exactly where the simulation says it is" | impostors; popview | position: node VERIFIED; activity: probe fails | **PARTIAL** | Position holds; activity is broken (M-4) |
| 54 | "Test: an activity-coverage check fails the build if any simulated activity lacks a visible performance or uses a placeholder" | lint:activity | passes on the registry | PROXY-ONLY | Blind to the stand fallback, walking in place, hidden sleepers and the silent population |
| 55 | "The shadow review (§13.11) confirms that what a person is doing on screen matches what the simulation says" | — | r10 PASS on text timelines only | **MISSING** | M-1 (SCOPE-GAP) |
| 56 | "No two days alike. Schedules vary with the calendar, weather, rations, arrivals, illness, mood and chance. People run errands, visit, argue, trade, idle and change plans" | plans; the soak variety gate | soak worst share 0.089 (limit 0.10); scene-level 39–49 % identical | PROXY-ONLY | "Argue" is silent; "trade" is a talk pose with a basket; "mood": no evidence of a mood state |
| 57 | "monthly ration issues" | E-01 | soak | PROXY-ONLY | Queue is idle (51) |
| 58 | "caravans, couriers and delegations arriving and leaving" | E-06, E-20, E-21; traffic.ts; delegations (setting) | node; traffic.txt | PARTIAL | Delegations not in the default world; the arrival as a scene is not built (D-236) |
| 59 | "the court coming and going" | court setting only (D-003); D-236 decided, not built | — | MISSING (default) | UD-10 |
| 60 | "harvest, shearing and planting" | E-43, E-47; plough, reap, thresh | probe day 45: 123 people thresh on one village floor | PARTIAL | They thresh on the spot as `stand` impostors beyond 448; 71 "driving the animals" on one floor is implausible |
| 61 | "festivals and offerings" | D-211 festivals; D-209 precinct | node only | BUILT-UNVERIFIED | |
| 62 | "births, marriages, sickness and deaths" | E-70…E-73; weddings (D-211); funerals (D-209) | node | PARTIAL | Sickness invisible (M-7); bearers walk in place (M-4); births are text only |
| 63 | "disputes" | E-74 | text | PROXY-ONLY | Silent (M-3); no justice (gap 24) |
| 64 | "stores filling and emptying" | calendar stores; two sack piles | soak stocks in bounds | PROXY-ONLY | M-8 |
| 65 | "construction advances week by week (courses laid, columns raised, reliefs carved), with named work gangs" | construction.ts; E-60 | soak visibleChange 51/51 weeks | PARTIAL | Only columns are geometry; the gang names are in the chronicle only |
| 66 | "fields ripen; the river rises and falls; stored goods move" | plain phenology; E-51 river | field-april/may/august renders (session 4–5) | PARTIAL | River level: not checked visually |
| 67 | "a late grain delivery means short rations" | CE-02/03 | chronicle text | PROXY-ONLY | M-8 |
| 68 | "a storm halts work" | plans ("storm: no work") | probe day 12 | **PROXY-ONLY (contradicted)** | M-2 |
| 69 | "a delegation arriving means feasting preparations, crowded roads and guards doubled" | — (the setting has delegations but no arrival consequence) | — | MISSING | M-8 |
| 70 | "Follow anyone … It should make sense from waking to sleeping: where they go, who they meet, what they eat, what they carry" | popview; plans | shadow r10 (text) | PARTIAL | Vanish at the room door (M-7); tools not carried (M-9); meetings silent (M-3) |
| 71 | "People remember the player: a guard who stopped you yesterday recognises you today; a baker you watched nods" | memory.ts (sim.agents); crowd nod | visitor e2e session 3; the nod never seen rendered | PARTIAL (135 people) | M-3 |
| 72 | "Relationships between NPCs also change over time" | pop.relate / affinity | node | PROXY-ONLY | Not surfaced in behaviour except the 135's exchanges |
| 73 | "Persistence. The world keeps running while you're away. On load, a fast catch-up simulates the elapsed time" | main.ts l. 142 → world.catchUp (cap 30 days); plans pure | sim_lod.test, people.test | VERIFIED (node) | |
| 74 | "watching crafts, work and ritual up close; following people and events; in visitor mode, period-plausible errands" | crafts; one errand | visitor e2e session 3 | PARTIAL | One errand; ritual never rendered |
| 75 | "No quest markers, no combat, no game mechanics that didn't exist" | — | — | VERIFIED (by absence) | |
| 76 | "A chronicle (translation layer only): a log of notable events and where they're happening" | translation.ts chronicle from sim.events | translation.spec session 3 | BUILT (old e2e) | |

### §5.5 The life of the place

| # | Requirement (quoted) | Where implemented | Verification and latest evidence | Status | Note / scope gap |
|---|---|---|---|---|---|
| 77 | "Wildlife: birds (including seasonal migrants and raptors), insects and flies, jackals, rats, scavenging dogs, and game in the paradises" | wildlife.ts (swallows, raptors, sparrows, crows, kites); jackals; fauna (strays, deer, gazelle, boar); insects and flies heard | node; "never rendered in a browser" (D-210) | PARTIAL | Rats, bats and storks MISSING; flies not seen; insects as VFX MISSING |
| 78 | "Dirt and wear: dung and animal pens, middens, drainage filth, flies, spilled grain, tanning and dye works, dust on feet and hems, soot. Grime is concentrated where work happens" | refuse mesh; hem soil; grime by work; dung litter on plain paths; soot near fires | node; renders of the stair foot | PARTIAL | Stockyard and pens, tannery and dye works unbuilt (gap 19, 20); spilled grain and drainage filth: no evidence |
| 79 | "Transport: carts and wagons, chariots (shown on the reliefs), litters, pack animals with tack and loads, courier way-stations" | traffic.ts (ox carts, donkey strings, riders); court chariot and wagons (setting); station | node; traffic.txt; the stair foot render | PARTIAL | Litters MISSING; wheels do not turn; no reins; beyond 400 m nothing (M-9) |
| 80 | "Food chain: grinding, baking, brewing, wine and dates arriving, slaughter for the royal table, mealtimes, storage jars" | grind, knead, bake, brew; E-02 wine; E-12 slaughter; eat; jars | node; the querns in people.spec (session 3) | PARTIAL | Dates MISSING; slaughter on open ground (stockyard unbuilt); the royal table only with the court |
| 81 | "Life events: children at play as well as at work, sickness, old age, festivals and offerings. Death practice only as the evidence shows it" | play variants (D-211, D-215); lie_ill; elders, lame, blind; D-209 | node; never rendered | PARTIAL | Sickness hidden (M-7); the old are 3 male bodies and 1 female |

### §1 modes, §6 people systems, §13 people checks

| # | Requirement (quoted) | Where implemented | Verification and latest evidence | Status | Note / scope gap |
|---|---|---|---|---|---|
| 82 | Observer mode: "people notice and react (step aside, glance, respond when addressed). Nothing is barred" | glance (crowd.ts l. 685); address (135 people) | gaze_check (node); the nod never rendered | PARTIAL | **Step aside MISSING** (M-3) |
| 83 | Visitor mode: "a sealed travel authorisation. Access follows period-plausible rules, and guards stop you where they would have" | visitor/access.ts, controller.ts; access.json | visitor.spec (session 3) | PARTIAL | Terrace posts only; the town was never walked; phantom escort (M-10) |
| 84 | §5.1 "Doors … open, close and lock plausibly, and stores are sealed" (people use them) | doors.ts (22 Terrace doors; people open them) | doors.test, phase4_doors e2e (session 3) | PARTIAL | Town doors PLACEHOLDER, fixed open (D-228) |
| 85 | §6 "Characters: full detail near the player; cheaper animated crowds mid-range; impostors far away" | crowd LOD 25/90/600 m; impostors | — | PARTIAL | Impostors are static frames (M-4) |
| 86 | §6 "NPCs, animals and the economy run in Web Workers, with simulation LOD" | main thread (world.ts) | Phase 5 M3: 60× mean 15.9 ms, p99 497 ms | MISSING | B53 only on the unmerged branch |
| 87 | §6 "player collision with crowds and animals" | 135 agent capsules + 48 population capsules within 20 m | people.spec (session 3) | PARTIAL | Animals not solid; walkers push the player |
| 88 | §13.8 walkthrough bots "fail on … objects popping in within 50 m" (with people) | botcheck (node, no people); walkthrough e2e (session 3, before the population) | — | MISSING (with population) | Phase 5 M5 |
| 89 | §13.11 soak | tools/soak.ts | 2026-09-25 soak 8/8 (default); court year soak fails on HEAD | PARTIAL | C1 fix unmerged |
| 90 | §13.11 shadow review, 20 people × 1 day | shadow_days.ts → text | r10 PASS (A 7×5, 13×4; B 9×5, 11×4) | PROXY-ONLY | See 55 |

### The user's directions on people and life (UD-07 … UD-14, D-236)

| # | Direction | Where / state | Status | Note |
|---|---|---|---|---|
| 91 | UD-07 "people having their own lives, many different systems at play, a true sprawling simulation/sandbox" | the systems exist in data (calendar, economy, religion, weddings, animals); they are visible and audible only partly | PROXY-ONLY | M-1 to M-10 |
| 92 | UD-08 "every person needs a home and a life and a family maybe and a job and a name and a history" | home, family, job 99–100 %; names 209; history none | PARTIAL / history MISSING | D-236 planned |
| 93 | UD-08 "nothing copy pasted" | 23 bodies; one idle; clone crowd render; walking in place | MISSING | M-5, M-4 |
| 94 | UD-09 "people visiting, coming and going, king coming and leaving, different events, all in real time, some random elements … not repetitive … some sort of seed element" | visits and errands in plans; seed 1 fixed (WORLD_SEED); the court not default yet | PARTIAL | Scene repetition 39–49 % (M-5); a new seed per game not built (D-236) |
| 95 | UD-10 the king and court come and go by default | D-236 decided; court.ts still a setting | MISSING (in progress) | |
| 96 | UD-11 "a world full of surprises … doing what I want but I do not know yet" | — | SCOPE-GAP | The probes above are the kind of discovery nobody was asked to run |
| 97 | UD-14 "fill in every single gap that needs to be filled to make it a real world" | gap_audit items 19, 20, 30, 32–36, 39–41 open; M-7 (life indoors), M-9 (§5.5 gaps) | PARTIAL | |

---

## 3. What a walker meets in an hour (the probes, for re-running)

| probe (args) | place, day, hour | result |
|---|---|---|
| `walk_probe.ts -422 -941 25 10 30 60` | q_s1 main street, day 25, 10:00, 30 min, r 60 m | 422 people seen, mean 386 in view, 1 % walking; 10 walker–walker and 16 walker–stander overlaps (< 0.45 m); 36 jumps > 3 m/s; 53 hurried walks |
| `walk_probe.ts -422 -941 12 10 10 60` | same, day 12, rain 1.00 | 445 in view (more than the dry day), 1 % walking |
| `walk_probe.ts -422 -941 25 23 10 60` | same, 23:00 | 0 in view (all asleep indoors, never drawn) |
| `why_probe.ts -422 -941 12 10.1 60` | same, rain | the plan's "indoors out of the rain" drawn in open courts (M-2) |
| `why_probe.ts -973 3287 45 10 400 1200` / `walk_probe … 45 10 20 250` | village P22, day 45 | 123 threshing on one floor; 0 walking at 10:00; 209 in view |
| `variety_probe.ts -422 -941 10 60 25,26,27,32,60` | q_s1, 10:00 on five days | 39–49 % of the scene identical to day 25 |
| `treadmill.ts 25 45` | whole population, 10:00 and 15:00 | ~22.5 k / ~25 k work drawn as a standing impostor; ~380 / ~710 walking in place |
| `carry.ts` | days 25, 45, 150 | 60,789 of 286,912 carried segments with no drawn prop |
| `masons.ts` | hall100 site, day 25, 09:30 | the masons are at work 25 m E of the moment's frame (the frame is empty, the simulation is not) |

**Not measured here:**
- anything in a browser;
- the court setting's scenes;
- the D-229 branch (its fix for M-4 should be merged and re-probed with `treadmill.ts`).
