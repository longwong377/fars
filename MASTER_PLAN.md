# MASTER PLAN — how PĀRSA becomes a time machine

**Status:** governing document, **rev 2** (rev 1 critiqued by an independent adversarial reviewer,
`REVIEWS/master_plan_critique.md`, and every one of its ten changes, its thresholds and its error list folded in; §13).
Read `USER_DIRECTIONS.md` (the user's own words, append-only) and this plan at the start of every session, before PROGRESS,
TASKS or HANDOFF. Where an older task list, handoff or decision conflicts with this plan, this plan wins; where this plan
conflicts with the user's directions, the directions win and this plan is corrected. The plan may grow; it may not shrink
without a user direction (§13). Mechanical guards: `tests/scope_ledger.test.ts` (every UD traced, the axes A–K present, every
trace row measured by a real threshold or file) and `tests/gates_ratchet.test.ts` (thresholds only tighten, checked against git
history). Numbers quoted here are rev 2's; **`gates/thresholds.json` is authoritative** and can only be stricter.

---

## 1. The goal, in one paragraph (UD-01, UD-06 … UD-14)

Stepping into PĀRSA must feel like stepping through a door into Persepolis in 467 BCE: **nowhere the player walks, at any hour or
season, for as long as they stay, breaks the illusion** (UD-06). Every place is built, lit, weathered and heard as a real place
is. **Every person is someone**: a name not shared by half the town, a face and body of their own, a home, a family, a job, a
history that shows, a day that is theirs and not a loop (UD-08). **The world runs by itself in real time**: people arrive and
leave, the court comes and goes, caravans, delegations, festivals, quarrels, accidents, weather and its aftermath, births and
deaths, seeded but never the same twice, not in a day, not in a year, not on a return a month later (UD-09, UD-10). **Many systems
interlock, conserve what they move, and their causes show** on screen (UD-07). **Nothing is copy-pasted** (UD-08). **Every gap in
the evidence is filled** with the most probable reconstruction from knowledge of the period and its neighbours, labelled as
such; only what the evidence says was absent stays out (UD-02, UD-14). **The world surprises**: it holds things the user never
asked for, and after fifty hours there is still something new, and none of it is staged for the player (UD-11, brief §1.1).
All of it stays faithful: sourced, tiered, visible in F3, no anachronism (brief §3).

## 2. Why earlier sessions missed (the lessons this plan exists to prevent)

Four independent audits (session 8: `REVIEWS/audit_A_intent_process.md`, `audit_B_world_photoreal.md`, `audit_C_people_life.md`,
`audit_D_engine_sound_verification.md`) and the critique of rev 1 found that the chosen-views miss was one instance of a general
failure:

| Anti-pattern | What happened | Rule now |
|---|---|---|
| **Letter over intent** | Gates met as written (a rubric on camera-rig stills, a shadow review of text timelines) while the experience failed | Every threshold states its anti-proxy (how it could pass while the intent fails) in `gates/thresholds.json` |
| **A sample stood for the whole** | ~40 chosen views (6 % of the Terrace's walkable ground within 25 m), 20 people × 1 day, 12 days mostly April–May, 1 seed | Detection everywhere (Tier 0, bots); seeded random samples the agent does not choose (§4.2) |
| **Node instead of screen** | People standing in rain the plan sheltered, frozen impostors, treadmill walkers, a soundscape never heard | VERIFIED only on the player's screen/speakers, or by a detector proven to fail when the screen fails |
| **The judged frame was not the player's** | 40–46° lens at 960×540, `high` not `ultra`, nobody within 2.5 m, stills only | Judged at the player's FOV and quality, in motion, with sound (axis C) |
| **Breadth before depth** | Phases 4–8 built on a slice that never passed | A reference transect proves every standard before rollout (§6) |
| **Evidence evaporates, records overclaim** | shots/ and bench JSON gitignored; `[x]` on unverified items; stale "resolved" | A generated board with dependency hashes; STALE = FAIL; TASKS carries no verification ticks (§5, §8) |
| **Handoffs carry tasks, not the goal** | Each session inherited a to-do list | This plan and the ledger are read first; briefs come from templates with the scope words (§8) |
| **No one looked for the unasked** | 209 names, no histories, unflagged boxes, unbuilt interiors surfaced only when the user pushed | Discovery with outside taxonomies and two independent gap hunters, estimated by capture–recapture (§7) |
| **Numbers left for later** (critique) | Rev 1 said "threshold" ten times and gave almost none | Thresholds are data, locked, and only tighten (§4.1) |
| **The build defined its own world** (critique) | Walk coverage measured against a 35 ha nav grid in a 143 × 143 km walkable terrain | The area registry is generated from the physically walkable envelope (§4.3) |
| **Measuring places, not moments** (critique) | Falling through the mountain sat outside every axis until someone walked there | The illusion-break log is the headline measure (§3) |

## 3. The standard: the Walker Test, made mechanical

The project is done when a person can walk anywhere reachable, at any time of the year, for as long as they like, and find nothing
fake, repeated, dead, silent where it should speak, staged for them, or absent that a real 467 Persepolis would hold. Thresholds
are the gate; they are never lowered to pass (brief §3.7, CLAUDE.md, §4.1).

**The illusion-break log (the headline measure).** A fleet of walker bots (`tools/dev/walkers.ts`, TO-BUILD) plays the world
continuously in the renderless mode (§4.2), plus a low-resolution ID pass where a check needs pixels. Four policies: *wanderer*
(random walk over the whole walkable envelope), *tourist* (heads for sound, crowds and landmarks), *follower* (shadows a random
person for a whole day), *returner* (revisits yesterday's places at the same hour). Every **break event** is logged with place,
time, seed and commit.
- **Hard breaks:** feet more than 0.3 m below the drawn surface; stuck over 10 s; an invisible wall; an object or person appearing
  or vanishing inside 50 m in view; a NaN or black tile; a main-thread frame over 100 ms at ×1; interpenetration over 0.2 m
  (person–person or person–player); walking in place; a work plan drawn as a standing figure; a person drawn outdoors whose plan
  says indoors; a speaker within 10 m with no audible source; English or modern text or audio in the world; an event spawned
  because the player is near.
- **Soft breaks:** a frame over 33 ms at ×1; a twin face within 15 m; one voice line heard twice within 10 minutes; an identical
  audio segment within 60 s; a scene matching the same place and hour on another day (T-E6); a clipped highlight in a normal
  exposure; a placeholder in view.
- **Thresholds:** **T-H0** 0 hard breaks per 20 bot-hours per area; **T-H0w** 0 in 200 bot-hours world-wide; **T-H0s** ≤ 2 soft
  breaks per bot-hour per area. A break a reviewer or the user finds that the log missed is a **detector escape** (T-R0, §8).
- The log's rate per area is the **first column of COVERAGE.md**; PROGRESS.md leads with the ten worst.

## 4. The eleven axes

Each axis names its thresholds by id; each id's metric, operator, value, unit, minimum sample, tool, tool status and anti-proxy
are in `gates/thresholds.json`. Tools marked TO-BUILD there do not exist yet; a restart must not read them as working.

**A. Place coverage (UD-06).** The unit is the **area**, from the registry (§4.3), covering the whole walkable envelope: every
Terrace court, hall, room, stair and roof; every town lane, court and enterable room; the approach; the plain, its roads, fields,
canals, rivers and villages; Naqsh-e Rustam; the slopes of Kuh-e Rahmat; the land beyond the fields to the world's edge.
*Thresholds:* **T-A0** 0 hard fails in n ≥ 59 seeded random Tier-1 views per area or generator class (**T-A0t** n ≥ 150 in the
transect); **T-A1** 0 % untiered or placeholder pixels, **T-A1m** 100 % of drawn meshes tiered and sourced; **T-A2f** flat-region
share ≤ 3 % and **T-A2s** 100 % of frames inside the reference photographs' 5–95 % band of spectrum slope and 12 px Ystd/Y at the
same distance class; **T-A3c** clipped ≤ 0.5 %, **T-A3k** black crush by day ≤ 1 %, **T-A3n** 0 NaN or black tiles; **T-A4**
every rubric category ≥ 4 in every judged view and **T-A4cg** 0 "reads as CG"; **T-A5** the paired photo test's pick accuracy,
ratcheting down toward 50 %; **T-A6** the registry covers ≥ 99.5 % of the envelope, **T-A6x** no area over 1 km² (0.25 ha
indoors). *Anti-proxy:* flags lie (3,983 unflagged village boxes), so detail is measured directly; noise defeats a flatness check,
so image statistics are matched to photographs.

**B. Time coverage.** Every month, eight hour bands (pre-dawn, dawn, morning, noon, afternoon, dusk, moonlit and moonless night),
every weather the climate makes (clear, cloud, overcast, rain, storm, snow, dust, mist, lightning), fire-lit nights. Weather is
sampled by climate frequency with a floor for rare states (D-242). *Thresholds:* **T-B1m** 12 months, **T-B1h** 8 hour bands and
**T-B1w** 9 weathers hit per area within one rotation, **T-B1p** 100 % world-level pairwise coverage; **T-B2m** a moonless night
away from fire reads ≤ 20/255 mean luma after tone mapping, **T-B2f** full moon ≤ 45/255; **T-B3** a full rotation within 4
sessions, **T-B3a** carried evidence STALE after 4 sessions. *Anti-proxy:* one spring day per place is not coverage; night is
never brightened to pass A.

**C. The player's view.** Judged at the default FOV (60° vertical, D-238) **and** at the widest setting, at `ultra`, with 1440p
detail tiles, in motion, with nobody hidden near the lens; hard-break detectors also run at the default preset (`high`).
*Thresholds:* **T-C1** rigClear 0; **T-C1u** ≥ 16 ultra views, **T-C1t** ≥ 16 detail tiles (960×540 sub-rectangles of a 2560×1440
projection via `camera.setViewOffset`) and **T-C1c** ≥ 3 motion clips (48 frames, 480×270, walking 1.35 m/s, an ID pass per frame)
per session; **T-C2** 0 pops inside 50 m; **T-C2f** static-region flicker ≤ 1.5 × a static-camera baseline. *Anti-proxy:* a
flattering lens at 960×540 hides what the player sees.

**D. Life on screen (UD-07, UD-08, UD-09).** What a walker sees among people and animals matches the simulation and reads as
life: people visibly do what their plan says (with tools and loads), shelter, go indoors, sleep somewhere, are ill somewhere;
nobody frozen at distance, walking in place, sliding, clipping, dragged; animals with their people at every distance.
Measured from renderless traces of the **crowd's instance buffers** (what is drawn), not popview or plans. *Thresholds:* **T-D1**
0 interpenetrations > 0.2 m, **T-D1w** walking pairs < 0.4 m ≤ 0.1 per 1,000 person-s; **T-D2** 0 treadmill, **T-D2s** 0 stand
frames for active work, **T-D2g** 0 gaits > 2.0 m/s, **T-D2j** 0 jumps > 3 m in 1 s within 150 m; **T-D3** 0 drawn outdoors while
planned indoors, **T-D3s** 100 % of "asleep at home" drawn there at 23:00; **T-D4** in rain ≥ 0.5, people in the open (jobs
exempted by evidence) ≤ 10 % of the dry-day count, all with rain posture or cover; **T-D5** 0 herders or ploughmen without their
animals. *Anti-proxy:* a perfect text timeline can hide a frozen stand-in.

**E. Identity and variety: nothing copy-pasted (UD-08, UD-09).** *Thresholds:*
- **Faces and bodies** are continuous per-person parameters (shape, age, weight, asymmetry, skin, hair), not picks from variants:
  **T-E1** 0 twin pairs (closer than the face JND) among people within 15 m of the player; the JND set by **T-E1l**, a reviewer
  finds a twin in ≤ 1 of 10 lineups of 20 crops from one crowd.
- **Names:** **T-E2** no name held by more than 1 % of a (sex, origin) group over 2,000 people; **T-E2h** no two living members of
  a household share a name unless the evidence attests it; attested names first, then names built from attested elements, and
  the census reports each share (D-236).
- **Histories:** **T-E3** 100 % of people have ≥ 5 events consistent with age, kin and the archive's dates (birth order, mother
  14–45, arrival before job); **T-E3r** ≤ 1 % of pairs share an identical event-type sequence of length 4; **T-E3v** ≥ 30 % show a
  trace of their history a walker can see or hear (mourning dress, a limp, a foreign accent or dress, a craft mark, a keepsake,
  a greeting for an old friend); the translation layer shows every history, sourced and tiered.
- **Families on screen:** **T-E4** children follow their own mother or kin; households eat together at their mealtimes; an
  on-screen trace of 20 households over 7 in-game days matches the kin graph 100 %.
- **Perceptual repetition:** **T-E5** between two instances of one generator within 50 m (houses, trees, compounds, props,
  relief figures of one type), image-patch SSIM < 0.9 at matched view and light; architectural orders may share geometry, never
  wear.
- **Scene variety:** **T-E6** the same place (60 m) at the same hour on 7 days shares ≤ 50 % identical (person, act, metre);
  **T-E6e** every 2-hour daytime window per area holds a non-routine witnessable event within 100 m; measured on acts, events,
  weather signs, visitors and changes, never on who stands where.
- **T-E7** every people gate runs on ≥ 3 seeds, one of them a fresh random seed each run (logged).

**F. Systems visible, conserved and consequential (UD-07, UD-09).** Every system (households, rations and stores, work groups,
construction, Treasury and scribes, the court, delegations and petitioners, religion, festivals, weddings, funerals, exchange,
herding, farming, water, weather, animals, the post, travellers) lives in `data/systems.json` (TO-BUILD) with its places.
*Thresholds:* **T-F1** ≥ 3 witnessable stages per system, each at a registry place (grain: reaped, threshed, carried, stored,
issued, ground, baked, eaten); **T-F2** every drawn store equals the stock ± 1 display unit, **T-F2m** monthly flows balance within
2 %, and goods never appear or vanish without a carrier; **T-F3d** a delegation arrival at least doubles road density within
1 km and **T-F3g** guard posts, **T-F3s** a storm drops outdoor work within 5 minutes, short rations show a longer queue and fewer
jars carried home, all measured on screen; **T-F4** ≥ 15 kinds of emergent incident from system state, not the calendar (a cart
loses a wheel, a runaway donkey, a spilled jar, a kitchen fire put out, a lost child found, a quarrel at a canal gate, a sick
animal); **T-F5** news of an arrival travels by visible messengers before it, and crowds gather where the news went; **T-F6**
**the world does not perform**: at one seed the event log is identical whatever path the player walks (reactions addressed to
the player excepted; `tests/player_independence.test.ts`, TO-BUILD). *Anti-proxy:* a chronicle entry is not a sighting; a
simulation variable is not the screen.

**G. The senses.** Sound rendered (OfflineAudioContext, faster than real time, in the renderless mode) and listened to per area
and time. *Thresholds:* **T-G1** true peak ≤ −1 dBTP with a limiter, **T-G1l** 0 cells outside their place-class loudness band
(set once from references, then locked); **T-G2** no segment repeats within 60 s, **T-G2f** consecutive footsteps correlate
≤ 0.8, **T-G2b** no non-generative bed loop shorter than 30 s; **T-G3** 100 % of visible speakers within 15 m audible, **T-G3e**
every visible fire within 10 m and river within 50 m audible; **T-G4** every listening-rubric category ≥ 4 (presence, place,
variety, mix, language, restraint); **T-G5** night fields sit below the quiet floor ≥ 20 % of the time. Known failures (audit D):
the noise generator restarts from one seed (every footstep and fire identical), wind/rain/whistle are 4–6 s loops, the murmur
reuses 6 phrases per language and voice, no voice off the Terrace, acoustics stop at the Terrace, rivers are silent, no limiter.
Smell by proxy (smoke, dung, bread ovens, tanneries, middens) is tied to WORLD_INVENTORY rows placed where each is produced.

**H. It runs and holds together.** *Thresholds:* **T-H1** collider vs drawn ground ≤ 0.05 m at 10,000 samples per ring seam,
**T-H1r** ≥ 99 % of 200 random reachable targets per area reached, **T-H1s** stuck ≤ 0.5 %; **T-H2** no simulation frame over
33 ms at ×1 and **T-H2p** p99 ≤ 20 ms at ×60 (the simulation in a worker; route search made cheap first, B53/B54); **T-H3**
autosave every ≤ 5 real minutes and on `visibilitychange`, **T-H3r** save → load → save byte-identical (people, memory, doors,
events); **T-H4** first frame ≤ 60 s on an idle box. Known failures (audit D): the player falls through Kuh-e Rahmat at the
collider/draw LOD seam (12 of 24 crossings); animals and all but the nearest 48 people are not solid; no autosave; the bench has
never produced a valid report. *Anti-proxy:* triangles are not frame rates (T-K6).

**I. Faithful.** Sourced and tiered in data and F3; no anachronism; conflicts logged; the user's directions superseding the brief
recorded (D-236). *Thresholds:* **T-I1** 0 blocklist hits in the judged sample's visual checklist (stirrups, coins, arches …),
**T-I1f** 0 fate-hint strings (Alexander, 330, burning, ruin …) in speech, chronicle or translation layer; **T-I2** 0 modern-language
hits, with `lint:lang` inside `npm run build`; **T-I3** 0 untiered data records. The translation layer's own English is checked
(D-198): every history and every reconstruction note surfaced and tiered.

**J. Complete, surprising, and still new at hour fifty (UD-09, UD-11, UD-14).** *Thresholds:* **T-J1a** after 10 tourist
bot-hours at ×1, ≥ 3 new (event kind × place class × state) triples per hour, **T-J1b** ≥ 1 per hour after 50 (kinds in
`data/event_kinds.json`, TO-BUILD; a split needs a reviewer-confirmed visible difference); **T-J2** ≥ 20 rare-tail kinds rarer than
once per 10 hours (the July 467 partial lunar eclipse, a meteor night, a rainbow after a rain cell, frost on the merlons, a dust
devil over stubble, the Kur over its banks, a birth announced, a death mourned, a courier at a gallop); **T-J3** after 30 in-game
days away ≥ 60 % of areas show a visible change, and **T-J3c** any absence up to ten years is caught up deterministically (the
30-day cap goes); **T-J4** day d and day d + one year share no more than adjacent days (weather and events draw a new stream each
year; the label stays 467); **T-J5** ≥ 3 surprises shipped per session, verified on screen (a listed surprise does not count);
**T-J6** WORLD_INVENTORY's capture–recapture estimate of unfound gaps ≤ 5 % (§7).

**K. The player's experience (UD-07 "sandbox", UD-06).** The sandbox's verbs, within the brief (no quests, combat or invented
mechanics): address anyone, inspect any object (tier and story in the translation layer), follow and be followed, sit, wait or
sleep to pass time where a person of 467 could, carry a sealed document (visitor mode), watch any craft up close.
*Thresholds:* **T-K1** each verb works in 100 % of areas where it makes sense; **T-K1a** everyone within 3 m can be addressed and
answers in their language, with gesture; **T-K1r** ≤ 10 % repeated lines over 50 random addresses per area (depth from gesture,
action, memory and the translation layer: D-241); **T-K2** anyone addressed or obstructed remembers the player ≥ 7 days (not only
the 135), people step aside, visitor checks at the town gate and on the roads; **T-K3** head-bob ≤ 2 cm by default (1.8 cm, no
roll: D-238), **T-K3a** six comfort and access settings under e2e test; **T-K4** a 4-hour soak at ×1 and ×60: heap growth ≤ 2 %
per hour after warm-up, **T-K4a** 0 leaked audio nodes, no drift; **T-K5** each gate publishes a playable static build (COOP/COEP
host) with a one-page what-changed / still-broken note, linked in PROGRESS; **T-K6** a GPU cost model (per-pass ALU and texture
operations from the compiled shaders × pixel coverage at 1440p) predicts ≤ 16.6 ms on an RTX 3070 in the 10 heaviest board
views; the first real bench recalibrates it.

**R. Reviewers and records (thresholds on the process itself).** **T-R0** detector escapes ≤ 10 % of the last 30 judged views
(above it, Tier-2 judgement cannot award PASS); **T-R1** anchor scores within 0.5 of their pins or the session's scores are void;
**T-R2** a full independent audit round and a critique of this plan at least every third session; **T-R3** every session ships
≥ 1 change a player would notice, named first in PROGRESS.

### 4.1 Thresholds are data and only tighten

Every threshold is a row of `gates/thresholds.json`: `{id, axis, metric, op, value, unit, sample_min, sample, tool, status,
anti_proxy, ud, since}`. `tests/gates_ratchet.test.ts` reads every committed version (`git log -- gates/thresholds.json`, `git
show`) and fails if an id disappears, a value moves the loose way, `sample_min` falls, the operator changes, a tool's status
moves back (to-build → partial → built only), a partial or built row names a missing file, the plan fails to quote an id, or
the plan quotes an id the file lacks. The only loosening allowed carries `"loosened_by": "UD-nn"`, a user direction that says so.
New thresholds are added, never swapped for easier ones.

### 4.2 How coverage is measured (the budget is part of the gate)

- **Tier 0: every cell, every session, no render lane.** A node pass over every walkable cell of every area at 5 m spacing (4 m
  in the transect): placeholder or untiered objects in view distance, detail per steradian by distance class, instance
  repetition in the view cone, the people probes (overlap, treadmill, stand frames, indoor/outdoor, speed, silence), collider vs
  drawn height, offline reachability with the browser's full collider set.
- **Renderless world mode (`?norender`, TO-BUILD first).** The full world (simulation, physics, crowd instance buffers, audio
  graph) in headless Chromium with the renderer off, so it never takes the SwiftShader lock. Bots, audio renders and people traces
  run here in parallel with the render lane.
- **Tier 1: seeded random sample at test quality.** An unlit ID + depth + normal pass and one shaded frame per view, 960×540.
  `tools/dev/coverage_points.ts` draws the sample from a seed equal to the first 8 hex digits of the commit hash (the agent does
  not choose it), stratified over the registry and spread over month × hour band × weather by a pairwise covering array. n ≥ 59
  per area or generator class (T-A0; at least 8 per class member), n ≥ 150 in the transect. Up to 25 % more views may be chosen
  worst-first from Tier 0; they are reported apart and never counted in a pass rate. `coverage_report.ts` refuses evidence whose
  view ids differ from the sampler's output for that seed.
- **Tier 2: judged sample at the full target.** Per session: 16 ultra views drawn at random from the Tier-1 set, 16 detail tiles at
  1440p, 3 motion clips, 60 s binaural audio for each Tier-2 view. Tier 2 finds what the detectors miss; it is not the statistic
  (six passing views still allow ~40 % failure at 95 %).
- **Canary invalidation.** After any change to a global dependency (render, material, people drawing, audio engine), 3 fixed canary
  views per area re-render at test quality. An area whose canaries move less than ΔSSIM 0.02 with no worse detector score keeps its
  Tier-1 evidence as "carried" with its age; otherwise its sample re-queues. Carried evidence older than 4 sessions is STALE.
- **Session budget** (one lane; 16 lane-hours assumed until the first instrument session measures t_load, t_test, t_id, t_high,
  t_ultra on an idle lane into `gates/budget.json`, from which sample counts are derived): canaries ≤ 60 min, Tier 1 ≤ 300 min
  (~500–600 views), Tier 2 ≤ 400 min, agents' renders ≤ 6 × 15 min, 20 % reserve. With ~80 areas a full rotation takes ≤ 4
  sessions (T-B3).
- **Evidence retention:** stats JSON for every view; images for Tier-2 views, Tier-1 failures and canaries; 160×90 thumbnails for
  passing Tier-1 views; ≤ 25 MB per session in `REVIEWS/evidence/<pass>/` (a test checks the size; D-243); audio as short OGGs.

### 4.3 The world: the area registry, the envelope and the edge

`data/areas.json` is generated by `tools/dev/areas.ts` (TO-BUILD) from the terrain, the architecture and the settlement and plain
data, never from the nav grid. It covers the **walkable envelope**: every point the player's controller can physically reach
from the spawn (slope ≤ 42°, step-up, colliders on every terrain ring). Each Terrace building and court, town quarter, palace or
garden zone, village, river reach and ~1 km² plain sector is its own area (T-A6x); generator-made areas are sampled as a class.
`tests/areas.test.ts` (TO-BUILD) fails if the union covers < 99.5 % of the envelope (T-A6) or the count or total shrinks without a
DECISIONS entry citing a UD. **The world's edge is decided (D-240):** there are no invisible walls; everything the controller can
reach is in the registry and on the board, and land beyond the fields' 40.96 km zone is built to the bar by the landscape
generator (steppe, scrub, pastoral camps, tracks, the mountains) as generator-class areas, or made unreachable only by real
terrain.

## 5. The status board

`COVERAGE.md` is **generated only** by `tools/dev/coverage_report.ts` (TO-BUILD; D-235's harness is its start) from evidence files;
`tests/coverage_board.test.ts` regenerates it and fails on any difference, so a PASS cannot be typed. Columns: the illusion-break
rate first, then each axis. Every cell carries its evidence commit, age and a **dependency hash** of the source files it depends
on; a cell whose hash is out of date reads **STALE**, and STALE counts as FAIL. Brief §15.7's "passed with logged exceptions" shows
as **FAIL-EXCEPTION**, never PASS. The board replaces phase ticks as the measure of progress; PROGRESS.md leads with its worst cells.

## 6. How the work proceeds

**Order within the standard** (this order wins over any list below):
1. **Stop the bleeding (first, in parallel with 2).** The hard breaks already diagnosed: the terrain fall-through (one surface for
   drawing and walking at every LOD seam, plus a rescue: D-237); impostor work frames (D-229, merged); "indoors" drawn as indoors
   (rain, night, sickness, sleep); every unflagged placeholder flagged (villages, Tol-e Ajori), so the board is honest on day
   one; the noise generator seeded per call and the 11 `Math.random` removed; a new seed per new game, shown in settings;
   autosave and save on close; `lint:all` inside `npm run build`; a crowd murmur bed and voices from population speakers so the
   town is not mute.
2. **The cheapest honest instrument (time-boxed to one session).** Tier 0, the renderless mode, the walker bots, the area registry,
   the generated board, `gates/budget.json`. Tier-2 judgement starts only once the transect has 0 Tier-1 hard fails.
3. **The reference transect,** brought to PASS on every axis, every hour band, in clear weather, rain and dust, before techniques
   are rolled out: a village on the plain, the road through its fields and a canal crossing, one town quarter (a lane, a house
   interior by day and at night, a workshop yard, a hearth), the stair foot, the Grand Stair, the Gate, the Apadana and its courts.
4. **World-wide multipliers before area-by-area work,** proved in the transect then applied everywhere: per-person faces and
   bodies; animation and steering; voices and the audio engine everywhere; materials and contact-hardening shadows; night light
   and fire occlusion in the town and villages; house and village generators with per-instance variation (one kit replaced
   everywhere at once).
5. **Then area by area, worst first by the board.** Every session ships at least one change a player would notice (T-R3) and at
   least three verified surprises (T-J5).

**The session loop (every session):**
1. Start: fetch the branch; read USER_DIRECTIONS and this plan; `npm ci`; tsc, lints, the ratchet and scope tests; resume stopped
   agents; start the renderless bots (they run all session).
2. Measure: Tier 0; canaries if a global change landed; Tier 1 for the areas due (oldest evidence first, plus change-driven);
   then Tier 2.
3. Discover (§7).
4. Rank: the board's worst cells, the illusion-break log's worst areas, the inventory's biggest MISSING rows.
5. Work: ≤ 3 agents that render at once, each briefed from `handoff/agent_template.md` and `handoff/review_template.md` (UD ids,
   the axis thresholds quoted verbatim, "how could this pass while the intent fails"), reserved D/Q/B numbers, node previews
   first, ≤ 2 browser runs; world-wide fixes preferred.
6. Verify on the player's screen and speakers; regenerate the board; keep the evidence (§4.2).
7. Close: write `sessions/sNN.md` (breaks found, board delta, the visible change, surprises shipped with evidence paths, the gap
   hunters' lists and estimate); revise this plan if anything learned changes it (§13); write the handoff.

**The programme** (from the four audits and the critique; the board re-orders it within the order above):
- **Life and identity:** per-person faces and bodies; a names onomasticon (attested first, reconstructed from attested elements
  after, D-236) and per-person histories that surface (T-E3v); real named people from the evidence placed where attested;
  families that behave as families (T-E4); shelter and indoor occupancy; steering, no overlap, no treadmill, no dragging;
  addressability and speech for everyone (per-person voice parameters, a line pool per language and role, gesture first:
  D-241); the player remembered (T-K2); the court arriving and leaving by default (D-236, UD-10), its arrival simulated, not
  present from day 0, and a new game starting shortly before it (D-239); comings and goings, visitors, messengers and news
  (T-F5); emergent incidents (T-F4); a child's day (play, errands, apprentices, scribal pupils: tier C until sourced); social
  relations that show (friends greet, enemies avoid, disputes reach hearings); animals' lives (herds at every distance, pens at
  night, lambing, dogs that belong to someone, storks and swallows in season, animals solid).
- **Systems:** conservation of goods and visible issuers (T-F2); every system's stages placed (T-F1); cause → effect on screen
  (T-F3d, T-F3g, T-F3s); construction progress over weeks beyond Hall 100.
- **The world complete:** the town's houses (D-234) and villages built for real and varied (T-E5); interiors (Harem and Hadish
  apartments, storerooms, garrison, Treasury, furnished palaces); the missing places (quarries with unfinished capitals, brick
  yards, lime kilns, tanneries, dye works, the mill, stockyard, threshing floors, fords and bridges); the pre-modern landscape
  (rivers, ancient ground level, the plain from the 1930s aerial); the land to the world's edge (D-240).
- **Weather and its aftermath; sky:** overcast, storm, dust, mist, lightning bolts, snow by altitude; running drains, puddles, mud
  with tracks that dries over days, a storm flattening an awning, the Pulvar in spate, cloth in wind, heat rest at noon in July;
  the July 467 partial lunar eclipse, meteors, rainbows, frost, heat shimmer, dust devils; night truth (T-B2m, T-B2f), people sleeping on
  roofs in summer, dogs and jackals heard.
- **Festivals and rites,** rendered and heard at full scale: crowds, music with performers, food, weddings, funerals; ritual as
  action, fire, offering and wordless chant (CLAUDE.md §12).
- **Photoreal everywhere:** materials (stone, plaster, earth, wood, cloth, metal), reliefs (scans when the user supplies them;
  until then carved geometry), trees and plants with variety, soft contact-hardening shadows, the §8.1 calibration completed
  (a column base, a stair flight, a doorway), the tone-curve question (B40), faces and bodies up close.
- **Runs:** the simulation in a worker after route search is cheap (B53, B54); memory and load budgets (T-H4, T-K4); streaming
  and compression (KTX2, Meshopt); everyone near the player solid; the GPU cost model (T-K6); the published build (T-K5).
- **Long horizons:** the calendar's yearly streams (T-J4); catch-up without a cap (T-J3c); the rare tail (T-J2).

## 7. Discovery and completeness (UD-11, UD-14)

Every session:
1. `WORLD_INVENTORY.md` (TO-BUILD) grows: its rows are **seeded from outside taxonomies** (the HRAF Outline of Cultural Materials
   categories, the Persepolis Fortification and Treasury commodity and occupation lists, brief §5.5 line by line), then walked in
   thought as a person of 467 would live each area: what they use, hear, smell by proxy, step around, trade, fear, celebrate. Each
   row: PRESENT / MISSING / ABSENT-BY-EVIDENCE, tier, place.
2. **Two independent gap hunters** (fresh agents, not the builders) list gaps separately; the Lincoln–Petersen estimate of gaps
   still unfound must be ≤ 5 % of the inventory (T-J6).
3. MISSING rows are filled by the gap rule (most probable reconstruction, tier C, reasoning in F3 and the translation layer);
   only what the evidence says was absent stays out.
4. **At least three surprises are built and verified on screen** (T-J5): unasked, witnessable, arising from the world's own
   state and never spawned near the player (T-F6). A list of ideas is kept, but a listed surprise counts for nothing.

## 8. Governance and honesty

- **Gates** are the thresholds per area on the generated board; the brief's phase gates are read in its own scope words
  ("every walkable area", "objects", "as scenes", "whole Terrace").
- **Independent reviewers are calibrated and blind.** Every rubric session first scores the **anchor set** (`REVIEWS/anchors/`,
  TO-BUILD: 6 renders with pinned scores, including three s7-pass-2 failures, and 4 reference images; T-R1). Judged frames are
  shuffled with the anchors and with renders from before the latest fixes, unlabelled. Briefs come from
  `handoff/review_template.md`, which `tests/scope_ledger.test.ts` checks for the scope words. Reviewers rotate: none judges one
  area twice running. They use every reference paired to the scene (`handoff/review_briefs.md`, UD-05) and say which. The
  rubric gains a **life** category and a **listening** rubric, and Tier-2 scenes are judged in motion with sound.
- **The paired photo test:** each session the Now view is rendered from the solved cameras of the user's site photographs (#24
  first) under their sun; a blind reviewer picks the render out of each pair (≥ 10 pairs, T-A5).
- **Every escape becomes a detector:** a failure a reviewer or the user finds that the detectors passed is logged in
  `REVIEWS/escapes.md` and closed only by a new or tightened detector (T-R0).
- **Audits:** a full independent audit round (fresh auditors, against the brief and USER_DIRECTIONS) and a critique of this plan
  every third session at the latest (T-R2); findings enter the board and §13.
- **Records:** a claim needs fresh evidence on the current tree. TASKS.md lists work only; "verified" lives on the board, never as
  a `[x]`. "Resolved" names its scope. Every report leads with what is broken or placeholder (brief §3.7).
- **Waived tests:** a test waived as "timing under load" needs an idle re-run record (load average < 1) newer than the waiver in
  `bench-reports/`, or it counts as failing.
- **Done is not judged by the builder:** "met" for any user direction is judged by the independent audit round, with evidence.

## 9. Constraints and how they are handled

No GPU (SwiftShader, one render lane): detection without the lane (Tier 0, renderless), statistics on seeded Tier-1 samples,
judgement on Tier 2, canaries for change (§4.2); views grouped per page load; ≤ 3 rendering agents. No texture or scan libraries
(proxy): procedural materials calibrated to the user's photographs; the user may supply scans (NEEDS #10), optional, never
waited on. Scholarly hosts blocked: search summaries, tiered and flagged, upgraded when sources arrive. None of these lowers a
threshold (§4.1); where one cannot be met: measure, try ≥ 3 approaches, ship the most faithful, log it in BLOCKERS (brief §3.5),
and the board shows FAIL until it is met.

## 10. Definition of done

Every area PASSES every axis on the generated board, on the current tree, with no STALE or FAIL-EXCEPTION cell; the
illusion-break log holds T-H0 world-wide; the calibrated rubric and listening rubric hold on Tier 2; the soak and the on-screen
shadow review pass on ≥ 3 seeds including a fresh one; WORLD_INVENTORY's estimate of unfound gaps is ≤ 5 %; the independent audit
round finds every user direction met; a playable build is published; FINAL_REPORT.md leads with what is still short.

## 11. Decisions this plan rests on

D-233 (every inch), D-236 (court by default; names attested first; histories; never the same twice; a new seed per game), D-238
(comfort: default FOV 60° vertical, head-bob 1.8 cm, judged at default and widest), D-239 (a new game begins shortly before the
court's seed-chosen arrival), D-240 (the world's edge), D-241 (talk's depth in dead languages comes from gesture, action, memory
and the translation layer), D-242 (weather sampled by climate frequency with a floor for rare states), D-243 (evidence
retention ≤ 25 MB per session).

## 12. Trace of the user's directions

Every UD-nn must appear here, and every "measured by" cell must name a threshold id from `gates/thresholds.json` or an existing
file (`tests/scope_ledger.test.ts`).

| UD | direction (short) | where in this plan | measured by |
|---|---|---|---|
| UD-01 | the brief: most faithful, walkable, living, photoreal; the time capsule | §1, §3, all axes | T-H0, T-A4, T-I2 |
| UD-02 | fill the gaps to the best of your educated ability | §1, §7, axis J | T-J6 |
| UD-03 | full steam ahead (autonomous) | §6 order and session loop, §8 audits | T-R2, T-R3 |
| UD-04 | the working rules are permanent across sessions | §8; CLAUDE.md | tests/scope_ledger.test.ts, tests/gates_ratchet.test.ts |
| UD-05 | reviewers use the supplied references and photographs | §8 | T-A5, T-R1 |
| UD-06 | every inch, nowhere breaks the illusion | §1, §3, axes A–C, H, §4.3 | T-H0, T-A0, T-A6 |
| UD-07 | people with lives, many systems, a sprawling simulation/sandbox; master plan, critique, no need to intervene | §1, axes D, F, K; §6; §13 | T-D2s, T-F1, T-K1, T-R2 |
| UD-08 | nothing fake or copy-pasted; everyone a home, life, family, job, name, history | axes D, E | T-E1, T-E2, T-E3, T-E5 |
| UD-09 | coming and going, the king, events in real time, randomness, never repetitive, seeds | axes E, F, J | T-E6, T-E7, T-F5, T-J4 |
| UD-10 | the court comes and goes by default (C) | §6 programme (D-236, D-239) | T-F3d, tools/soak.ts |
| UD-11 | go above and beyond: surprises, what the user has not thought of | §7, axes F, J | T-J1a, T-J5, T-F6 |
| UD-12 | preserve this scope; update the master plan when needed | header, §4.1, §13, this table | tests/scope_ledger.test.ts, tests/gates_ratchet.test.ts |
| UD-13 | photos: easy list, no notes needed | §9 | NEEDS_FROM_ME.md |
| UD-14 | extrapolate from knowledge of the period; fill every gap | §1, §7, axis J | T-J6, T-I3 |

## 13. Revision log

| rev | date (session) | change | why |
|---|---|---|---|
| 1 | 2026-09-26 (s8) | First version | UD-06 … UD-14; the four audits |
| 1.1 | 2026-09-26 (s8) | Audit D folded in (fall-through, walk coverage, sound, seeds, autosave, bench, worker) | audit D |
| 2 | 2026-09-26 (s8) | The critique's ten changes: the illusion-break log as headline (§3); locked thresholds that only tighten (§4.1, `gates/thresholds.json`, `tests/gates_ratchet.test.ts`); the sampling architecture and budget (§4.2); the area registry and the world's edge (§4.3); the reorder (stop the bleeding, a one-session instrument, a village-to-Apadana transect, multipliers first, a visible change every session); calibrated blind judges and detector escapes (§8); identity, families and perceptual repetition (E); systems' depth, conservation, emergence and player independence (F); long horizons (J); the player's experience (new axis K); process thresholds (R); the generated board with STALE = FAIL (§5); TO-BUILD marked; the trace measured by threshold ids; section order fixed; DRAFT cleared | REVIEWS/master_plan_critique.md; UD-07, UD-12 |
