# Critique of MASTER_PLAN.md (rev 1.1)

**Critic:** an independent, adversarial subagent (Claude Opus 5.5). I did not write the plan or build the world.
**Date:** 2026-09-26. **Tree:** `claude/amazing-fermi-40ds7j` at `bde84aa` (MASTER_PLAN rev 1.1).
**Read in full:** USER_DIRECTIONS.md (UD-01…UD-14), MASTER_PLAN.md, PERSEPOLIS_BRIEF.md, CLAUDE.md, audits A, B, C and D.
**Skimmed:** PROGRESS.md (problems section), BLOCKERS.md, HANDOFF.md, DECISIONS D-233 and D-236, handoff/review_briefs.md,
tests/scope_ledger.test.ts, src/core/settings.ts (defaults), tools/dev/load_probe.mjs.
**Ran:** nothing heavy. I checked which files the plan names actually exist: `tools/dev/coverage_points.ts`,
`tools/dev/coverage_report.ts`, `tests/e2e/coverage.spec.ts`, `WORLD_INVENTORY.md` and `COVERAGE.md` do **not** exist at
`bde84aa`. `tests/scope_ledger.test.ts` does exist. Machine: 4 cores, 15 GB RAM, one shared SwiftShader render lane.

**Verdict in one line:** the plan diagnoses the failure correctly and names the right axes, but it has **almost no numbers**,
**no definition of "area" or of the world's edge**, **no sampling budget that fits one render lane**, and **no mechanical
guard against the same drift that caused the miss**. As written, a future session could turn every axis green while the
user's intent still fails. Section B gives 15 concrete scenarios where that happens.

---

## A. The ten most important changes (ranked), with the exact text to add or replace

Each change says where it goes in MASTER_PLAN.md and gives the text to paste. Number ranges such as `T-A1` are threshold ids
for the locked file proposed in change 2.

### 1. Make the Walker Test mechanical: an illusion-break log as the top-level measure
**Why:** §3 defines the standard in prose ("find nothing fake, repeated, dead, silent…"), then measures *places*. The user
does not experience places. They experience **moments that break**: falling through the mountain, a body walking through
theirs, a hitch at the day rollover, a house that pops in, a mute crowd, a twin face, a moonless night lit like dusk. The
plan counts none of these as events, so none has a rate or a threshold. Audit D's fall-through (12 of 24 crossings) is
exactly this kind of break, and it sat outside every axis until someone walked there.

**Add to §3, after the first paragraph:**
> **The illusion-break log (the Walker Test made mechanical).** A fleet of walker bots plays the world continuously: in the
> renderless world mode (change 3), plus a low-resolution ID pass where a check needs pixels. Each bot follows one of four
> policies: *wanderer* (random walk over the walkable envelope), *tourist* (heads for sound, crowds and landmarks),
> *follower* (shadows a random person for a whole day) and *returner* (revisits yesterday's places at the same hour). It
> logs every **break event** with place, time, seed and commit.
> - **Hard breaks:** falling through the ground (feet more than 0.3 m below the drawn surface), stuck for more than 10 s,
>   an invisible wall, an object or person appearing or vanishing inside 50 m in view, a NaN or black tile, a
>   main-thread frame over 100 ms at ×1, a person interpenetrating another or the player by more than 0.2 m, a person
>   walking in place, a work plan drawn as a standing figure, a person drawn outdoors whose plan says indoors, a
>   speaker within 10 m with no audible source, English or modern text or audio in the world.
> - **Soft breaks:** a frame over 33 ms at ×1, a twin face within 15 m, the same voice line heard twice within 10 minutes,
>   an identical audio segment repeating within 60 s, a scene that matches the same place and hour on another day
>   (T-E6), a clipped highlight in a normal exposure, a placeholder in view.
> - **Thresholds** (locked in `gates/thresholds.json`): **0 hard breaks in 20 bot-hours per area and in 200 bot-hours
>   world-wide** (T-H0); soft breaks ≤ 2 per bot-hour per area (T-H0s). A break a reviewer or the user finds that the log
>   did not catch counts as a **detector escape** (change 6).
> - The log's rate per area is the **first column of COVERAGE.md**. PROGRESS.md leads with the ten worst.

### 2. Numbers, locked: a thresholds file that can only tighten, and a generated board that cannot be hand-edited
**Why:** the axes say "threshold" ten times and give a number almost nowhere ("detail per steradian below threshold",
"crowds of the right density", "rubric ≥ 4 on a stratified sample" of unstated size, "share of viewpoints passing" with no
share). A future session will set the numbers, and a session that is behind will set them where it stands. The scope-ledger
test only checks that `| UD-nn |` appears in §12. A row that reads "measured by: —" passes, and UD-03 already reads "—".

**Add a new §4.1 (after the axes):**
> **4.1 Thresholds are data and only tighten.** Every threshold lives in `gates/thresholds.json` as
> `{id, axis, metric, op, value, unit, sample, tool, anti_proxy, since_commit, user_direction}`. Section 4 quotes the ids.
> `tests/gates_ratchet.test.ts` fails if:
> 1. a threshold id present at any earlier commit is missing now (read with `git log --format=%H -- gates/thresholds.json`
>    and `git show <rev>:gates/thresholds.json`);
> 2. a value moved in the loosening direction, unless the row cites a UD-nn entry that says so;
> 3. a row's `tool` is not an existing file.
>
> `COVERAGE.md` is generated only by `tools/dev/coverage_report.ts` from the evidence files. `tests/coverage_board.test.ts`
> regenerates it and fails on any difference, so a PASS cannot be typed by hand. Every cell carries the evidence commit and
> a **dependency hash** (the hash of the source files that cell depends on; any change to a global render, material,
> people-drawing or audio-engine file invalidates every cell of its axis). A cell whose dependency hash is out of date reads
> **STALE**, and STALE counts as FAIL. Brief §15.7's "passed with logged exceptions" is shown as FAIL-EXCEPTION, never as
> PASS.

**Replace the §12 header line with:**
> ## 12. Trace of the user's directions (every UD-nn must appear here, and every "measured by" cell must name a threshold
> id from gates/thresholds.json or an existing file: tests/scope_ledger.test.ts)

**Add to tests/scope_ledger.test.ts (described here; the plan owner implements it):** each §12 row's "measured by" cell
must contain `T-` ids that exist in `gates/thresholds.json`, or a path that exists. The ten axis headings A–J must still be
present, and the number of threshold rows never decreases.

### 3. A sampling architecture that fits one render lane: detect everywhere, judge a seeded sample, carry evidence forward only by canary
**Why:** ~400 points × 12 months × 8 hour bands × 9 weathers × 3 seeds is about 1 million views. At ~3 min for a high frame
it would take about 6 lane-*years*. Even at test quality it cannot be done. The plan says "detection at test quality over the
full coverage, judgement at high/ultra on a sample" (§9) but gives no sample size, no selection rule, no confidence and no
invalidation rule. Global render changes land every session and invalidate everything, so a naive re-measure never
finishes. And whoever picks the sample can pick easy points.

**Replace §9's first sentence and add §4.2:**
> **4.2 How coverage is measured (the budget is part of the gate).**
> - **Tier 0: every cell, every session, no render lane.** A node/CPU pass over every walkable cell of every area at 5 m
>   spacing (4 m in the reference transect). It checks placeholder or untiered objects within view distance, geometric
>   detail per steradian by distance class, instance repetition in the view cone, and the audit-C people probes (overlap,
>   treadmill, stand frame, indoor/outdoor contradiction, speed, silence). It also computes the collider-vs-drawn height
>   difference and the offline reachability with the browser's full collider set.
> - **Renderless world mode (`?norender`, P0).** The full world (simulation, physics, crowd instance buffers, audio graph)
>   runs in headless Chromium with the renderer off, so it does not take the SwiftShader lock. The walker bots, audio renders
>   (OfflineAudioContext, faster than real time) and on-screen people traces (read from the crowd's instance buffers, not
>   from popview) run here in parallel with the render lane.
> - **Tier 1: seeded random sample at test quality.** An unlit ID + depth + normal pass plus one shaded frame per view,
>   960×540. The sample is drawn by `tools/dev/coverage_points.ts` from a seed equal to the first 8 hex digits of the
>   commit hash, so the agent does not choose it. It is stratified over the area registry (change 4) and spread over month ×
>   hour band × weather by a pairwise covering array. The minimum is **n ≥ 59 random views per area or per generator
>   class, with 0 hard fails** (T-A0: failure rate < 5 % at 95 % confidence). The reference transect needs **n ≥ 150**
>   (< 2 %). Generator-made areas (villages, town quarters) are sampled as a class, with at least 8 views per member.
>   Another 25 % of the views may be chosen worst-first from Tier 0; they are reported separately and never counted in
>   the pass rate.
> - **Tier 2: judged sample at the full target.** Each session: **16 ultra views** drawn at random from the Tier-1 set;
>   **16 detail tiles at 1440p** (rendered as 960×540 sub-rectangles of a 2560×1440 projection with
>   `camera.setViewOffset`, the cost of one 960×540 frame each); **3 motion clips** (48 frames at 480×270 at high, walking
>   at 1.35 m/s, with an ID pass per frame for pop and a motion-compensated difference for shimmer and ghosting); and
>   **audio** for every Tier-2 view (60 s binaural from the renderless mode).
> - **Canary invalidation.** After any change that touches a global dependency, 3 fixed canary views per area are
>   re-rendered at test quality (about 60 lane-minutes for 80 areas with grouped loads). If an area's canaries change
>   by less than ΔSSIM 0.02 and no detector score worsens, its Tier-1 evidence is carried forward, marked "carried" with its
>   age. If not, the area's Tier-1 sample is re-queued. Carried evidence older than 4 sessions is STALE.
> - **Session budget (one lane, 16 lane-hours assumed; the first session measures the real unit costs and writes them into
>   `gates/budget.json`):** canaries ≤ 60 min; Tier 1 ≈ 500–600 views ≤ 300 min; Tier 2 ≤ 400 min; agents' own renders
>   ≤ 6 × 15 min; reserve 20 %. With about 80 areas, the full Tier-1 rotation completes in **≤ 4 sessions**. The board shows
>   each area's evidence age.

### 4. Define the world: a canonical area registry over the physical walkable envelope, and the world's edge
**Why:** every axis is gated "per area", but no area list exists. Areas can be merged so that one failing village is diluted
by 30 passing fields. Audit D showed the other trap: the walk bots' "coverage" is measured against the **nav grid**, which
covers only the Terrace plus 480 m (35 ha), while the player can walk 143 × 143 km (audit B M2). A denominator the build
defines for itself will always look good.

**Add to §4 A, replacing its first sentence:**
> **A. Place coverage (UD-06).** The unit is the **area**, from `data/areas.json`, generated by `tools/dev/areas.ts` from the
> terrain, the architecture and the settlement and plain data (not from the nav grid). The registry covers the **walkable
> envelope**: every point the player's controller can physically reach from the spawn point, computed from slope ≤ 42°,
> step-up and colliders on the terrain rings. Rules:
> - Each Terrace building and court, each town quarter, each palace or garden zone, each village, each river reach and
>   each ~1 km² plain sector is its own area. No area exceeds 1 km² (0.25 ha for interiors).
> - `tests/areas.test.ts` fails if the union of areas covers less than 99.5 % of the envelope, or if the area count or the
>   total area shrinks without a DECISIONS entry that cites a UD.
> - **The world's edge is a decision, not an accident (D-nnn):** where the built world ends, what the walker meets there
>   (terrain the controller cannot climb, a river in spate, or honest built content to the horizon ring), and no invisible
>   wall. The envelope beyond the fields' 40.96 km zone is either built to the bar or made unreachable by real terrain.
>   Either way it is in the registry and on the board.

### 5. Reorder: stop the bleeding first, a reference transect instead of the Terrace slice, world-wide multipliers before area-by-area, and a time box on P0
**Why:**
- P0 as written is a whole programme: harness, probes, censuses, audio renders, bots, inventory, evidence, ledger, bench.
  It has no internal order, no exit criteria and no time box. Measuring a world whose failures are already known
  (placeholder houses, box villages, 23 bodies, frozen distant workers, a mute town) buys little. The user sees nothing
  change for a session or more.
- The reference area (approach, Grand Stair, Gate, Apadana) is the **most built and least representative** part of the
  world. It exercises stone and monumental light. It does not exercise houses, interiors, hearths at night, households,
  voices, villages, fields or animals, which is where UD-07/08/09 live and where every audit found the worst failures.
- A strong studio lead does three things first: fixes the hard breaks, builds the cheapest honest instrument, and invests
  in the systems that lift every place at once (faces and bodies, animation, the audio engine, materials, shadows).

**Replace the first paragraph of §6 ("Order within the standard …") with:**
> **Order within the standard.**
> 1. **Stop the bleeding (the first session, in parallel with 2):** the terrain fall-through (one surface for drawing and
>    walking, plus a rescue), merge D-229 (impostor work frames), draw "indoors" as indoors (rain, night, sickness,
>    sleep), flag the villages and Tol-e Ajori as placeholders, seed the noise generator per call, autosave and save on
>    close, `lint:all` inside `npm run build`.
> 2. **The cheapest honest instrument (time-boxed to one session):** Tier 0, the renderless mode, the walker bots, the area
>    registry, the thresholds file and the generated board. The expensive Tier-2 judgement starts only once the reference
>    transect has 0 Tier-1 hard fails.
> 3. **The reference transect:** a village on the plain, the road through its fields and a canal crossing, one town quarter
>    (a lane, a house interior by day and at night, a workshop yard, a hearth), the stair foot, the Grand Stair, the Gate and
>    the Apadana with its courts. It is brought to PASS on every axis, at every hour band, in clear weather, rain and dust,
>    before techniques are rolled out.
> 4. **World-wide multipliers before area-by-area work:** people's faces and bodies (per-person parameters), animation
>    (impostor frames, work cycles, steering), voices and the audio engine everywhere, materials and contact-hardening
>    shadows, night light and occlusion in the town. These are fixed once for everywhere.
> 5. **Then area by area, worst first by the board.** Each session ships at least one change a player would notice, and
>    PROGRESS.md names it.

### 6. Honest judges: calibrated reviewers, blind mixes, a locked brief template, and "every escape becomes a detector"
**Why:** the rubric reviewer is the same model family, briefed by the lead who needs the pass. It scores 960×540 stills.
Nothing pins its scale from one session to the next, so leniency can drift up. The plan's own history shows the root
cause: CLAUDE.md compressed §13 into tool names and dropped the scope words, and briefs written ad hoc inherit the
narrowing.

**Replace the second bullet of §8 with:**
> - **Independent reviewers are calibrated and blind.**
>   - Every rubric session first scores a fixed **anchor set** (`REVIEWS/anchors/`: 6 renders with pinned scores, including
>     three s7-pass-2 failures, and 4 reference images). If any anchor score lands more than 0.5 from its pin, the
>     session's scores are void.
>   - Judged frames are shuffled with the anchors and with renders from before the latest fixes. The reviewer is not told
>     which frame is which.
>   - Reviewer briefs are generated from `handoff/review_template.md`. `tests/review_template.test.ts` checks that the
>     template contains the scope words: "every walkable area", "the player's lens and quality", "in motion", "with
>     sound", "at every hour, season and weather", "judge as a scene".
>   - Reviewers rotate: none judges the same area twice in a row.
>   - **Paired photo test:** each session, the Now view is rendered from the solved cameras of the user's site photographs
>     (#24 first) under the photos' sun. A blind reviewer picks the render out of each pair. The pick accuracy over
>     ≥ 10 pairs is recorded (T-A5), trends down, and ratchets.
> - **Every failure a reviewer or the user finds that the detectors passed is a detector escape.** It is logged in
>   `REVIEWS/escapes.md` and closed only by a new or tightened detector that would have caught it. Threshold: escapes
>   ≤ 10 % of the last 30 judged views (T-G0). Above that, Tier-2 judgement cannot award PASS.
> - **A full independent audit round** (fresh auditors, like audits A–D, against the brief and USER_DIRECTIONS) runs every
>   third session. So does a **critique of this plan**. Their findings enter the board and the revision log.

### 7. Identity that survives a close look: per-person faces and bodies, histories that are consistent and surface, families that behave as families
**Why:** axis E's measures can all pass while the intent fails:
- "Distinct body/face/garment combinations per 100 people": 12 faces × garments × colours give hundreds of distinct
  combinations, and every girl in the world still has one face.
- `person_census` "has a history": a templated sentence fills the field for 100 % of people.
- "Name shared by no more people than a real town would share" has no number.
- "Asset-repetition census (distinct geometries per instance)" passes procedurally resized houses that look identical.

**Replace axis E's metrics sentence with:**
> *Metrics and thresholds:*
> - **Faces and bodies** are continuous per-person parameters (shape, age, weight, asymmetry, skin, hair), not a pick from
>   variants. T-E1: within any set of people simultaneously within 15 m of the player, 0 pairs closer than the
>   just-noticeable face distance. The JND is set by a lineup test: a reviewer shown 20 crops from one crowd finds a "twin
>   pair" in ≤ 1 of 10 lineups.
> - **Names** (T-E2): no name is held by more than 1 % of a (sex, origin) group of over 2,000 people. No two living members
>   of one household share a name unless the evidence attests the practice. Attested names are used before reconstructed
>   ones, and the census reports the share of each.
> - **Histories** (T-E3): 100 % have ≥ 5 events consistent with age, kin and the archive's dates (a test checks birth
>   order, mother's age 14–45, arrival before job). Fewer than 1 % of pairs share an identical event-type sequence of
>   length 4. **At least 30 % of people show one trace of their history a walker can see or hear** (mourning dress, a
>   limp, a foreign accent or dress, a craft mark, a keepsake, a greeting for an old friend). The translation layer shows
>   every history, sourced and tiered.
> - **Families on screen** (T-E4): children follow their own mother or kin, never a random adult. Households eat
>   together at their mealtimes. An on-screen trace of 20 households over 7 in-game days matches the simulation's kin
>   graph 100 %.
> - **Perceptual repetition** (T-E5): between any two instances of the same generator within 50 m of each other (houses,
>   trees, village compounds, props, relief figures of one type), the image-patch SSIM stays below 0.9 at matched
>   viewpoint and light. Architectural orders (columns, merlons) may share geometry but not surface wear.
> - **Scene variety** (T-E6): the same place (60 m) at the same hour on 7 different days: identical (person, act, metre)
>   share ≤ 50 %, and at least one non-routine witnessable event within 100 m in every 2-hour daytime window per area.
>   Identity-shuffling jitter does not count (the measure is on acts, events, weather signs, visitors and changes, not on
>   who stands where).
> - All people gates run on ≥ 3 seeds, **one of them a fresh random seed every run** (logged), so tuning to seeds shows.

### 8. Systems with depth, conservation and consequence, and a world that never performs for the player
**Why:** axis F counts **sightings**. Five people standing with baskets are a "market sighting". A chronicle variable that
changes is a "cause". Audit C found that short rations, the ration issue, delegations, late deliveries and construction
all live in text. The plan also misses a direct risk of UD-11: the easiest way to fake "surprises" is to spawn them near
the player, which breaks §1.1 ("the world never performs for the player").

**Append to axis F:**
> *Depth and consequence thresholds:*
> - **Stages** (T-F1): each system in `data/systems.json` shows ≥ 3 distinct witnessable stages (grain: reaped, threshed,
>   carried, stored, issued, ground, baked, eaten), each at a place in the area registry.
> - **Conservation of goods** (T-F2): every drawn store equals the simulated stock ±1 display unit. Monthly flows balance
>   within 2 %. Goods never appear or vanish without a carrier.
> - **Cause → effect on screen** (T-F3): each causal link the brief names has an automated probe that measures the effect
>   in the drawn world with an effect size. A delegation arrival must at least double road density within 1 km and guard
>   posts must double. A storm must drop outdoor work within 5 minutes. Short rations must show a longer queue and fewer
>   jars carried home.
> - **Emergent incidents** (T-F4): ≥ 15 kinds of incident arise from system state, not from the calendar: a cart that loses
>   a wheel, a runaway donkey, a spilled jar, a kitchen fire put out, a lost child found, a quarrel at a canal gate, a
>   sick animal. Each is witnessable, tiered and rate-limited by its causes.
> - **Information travels** (T-F5): news of an arrival reaches people through visible messengers before the event, and
>   crowds gather where the news went.
> - **The world does not perform** (T-F6): with the seed fixed, the world's event log is identical whatever path the player
>   walks. The only exception is reactions addressed to the player (glance, step aside, reply, memory).
>   `tests/player_independence.test.ts` runs two different bot paths and diffs the logs.

### 9. Long horizons: the novelty curve, the return visit, the year that does not replay, and surprises built, not listed
**Why:** UD-09 and UD-11 are about hour 50 and a return a month later. The plan measures one day at a time.
- The calendar replays identically after 354 days (audit A M7).
- The catch-up is capped at 30 days.
- The discovery metric ("distinct witnessable event kinds per km² per hour") is inflated by splitting kinds.
- §7's "add at least ten surprises to the backlog" is met by writing a list.
- WORLD_INVENTORY is written by the same agents who build, so "no MISSING entry" is met by not listing things.

**Replace axis J's metric sentence with:**
> *Metrics and thresholds:*
> - **Novelty curve** (T-J1): the tourist bot records the first sighting of each distinct (event kind × place class ×
>   state) triple. After 10 bot-hours at ×1 it still finds ≥ 3 new triples per hour; after 50 bot-hours, ≥ 1 per hour.
>   Event kinds are defined in `data/event_kinds.json`, and splitting a kind needs a visible difference that a reviewer
>   confirms.
> - **Rare tail** (T-J2): ≥ 20 kinds with an expected frequency below once per 10 hours of play (the July 467 partial lunar
>   eclipse, a meteor night, a rainbow after a rain cell, frost on the merlons, a dust devil over stubble, the Kur over its
>   banks, a birth announced, a death mourned, a courier at a gallop).
> - **Return visit** (T-J3): after 30 in-game days away, ≥ 60 % of areas show a change a walker can see (fields, construction,
>   stores, people arrived or gone, births, marriages, deaths). The catch-up covers any absence. There is no 30-day cap; the
>   state past the cap is derived deterministically, not frozen.
> - **The year does not replay** (T-J4): day d and day d + year share no more than adjacent days do. Weather and events
>   draw on a new stream each year, and the label stays 467 by the brief.
> - **Surprises built** (T-J5): each session ships ≥ 3 witnessable surprises, verified on screen (a Tier-2 view or clip).
>   Listing alone does not count.
> - **Completeness from outside** (T-J6): WORLD_INVENTORY rows are seeded from external taxonomies (the HRAF Outline of
>   Cultural Materials categories, the PF/PT commodity and occupation lists, and brief §5.5 line by line), not only from the
>   builders' imagination. Each session, two independent gap hunters list gaps separately. The capture–recapture estimate
>   (Lincoln–Petersen) of gaps still unfound must be ≤ 5 % of the inventory.

### 10. The player's side: sandbox verbs, comfort, long sessions, a playable build the user can open, and a real-hardware cost model
**Why:** UD-07 says "sandbox". The plan's only player verbs are those that already exist: address (0.3 % of people), doors,
inscriptions in the translation layer. It says nothing about:
- comfort: the default vertical FOV of 70° (about 102° horizontal) shrinks the gates §1.1 wants felt, and head-bob is on by
  default;
- accessibility settings, which have had no test since session 3;
- long-session stability;
- how the user actually plays it (the build has never been deployed);
- frame rate on the target GPU (the bench has never produced a valid report, and triangle proxies cannot see per-pixel cost).

Axis C also enshrines "70°" as the player's lens without asking whether 70° is right, and the default quality preset is
`high`, not the `ultra` the plan judges.

**Add a new axis K after J (and to the §12 trace for UD-07, UD-06):**
> **K. The player's experience.**
> - **Verbs** (T-K1): the sandbox's verbs are decided in DECISIONS within the brief (no quests, combat or invented
>   mechanics): address anyone, inspect any object (with its tier and story in the translation layer), follow and be
>   followed, sit, wait or sleep to pass time where a person of 467 could, carry a sealed document (visitor mode), and
>   watch any craft up close. Each verb works in 100 % of the areas where it makes sense, by bot test. Everyone within 3 m
>   can be addressed and answers in their language, with gesture. Lines are heard with ≤ 10 % repeats over 50 random
>   addresses per area.
> - **Consequence** (T-K2): everyone the player addresses or obstructs remembers it for ≥ 7 in-game days (no longer only
>   the 135). People step aside for the player. Visitor-mode checks happen at the town gate and on the roads, not only on
>   the Terrace.
> - **Comfort and access** (T-K3): the default FOV is decided with a rationale (scale is felt: a vertical FOV around 55–60°
>   is the usual choice). Frames are judged at the default FOV and at the setting's widest. Head-bob, the lightning-flash
>   warning, key remapping, mouse sensitivity, subtitle size and colour-blind-safe UI each have an e2e test that runs every
>   gate. Motion comfort is checked: no camera roll, and bob amplitude under 2 cm by default. The judged quality is `ultra`
>   (the full target); hard-break detectors also run at the default preset.
> - **Long sessions** (T-K4): a 4-hour browser soak (renderless plus periodic frames) at ×1 and ×60: heap growth ≤ 2 % per
>   hour after warm-up, no leaked audio nodes, no drift in time or positions, saves round-trip byte-identically.
> - **The user can play it** (T-K5): each gate publishes a playable static build (a host with COOP/COEP) and a one-page
>   "what changed, what is still broken" note. The link goes in PROGRESS.md.
> - **Real hardware** (T-K6): a GPU cost model counts per-pass ALU and texture operations from the compiled shaders,
>   multiplied by pixel coverage at 1440p. It predicts ≤ 16.6 ms on an RTX 3070 in the 10 heaviest views of the board
>   (court assembly, town at dusk, rain on the plain). The bench drives the player so the simulation runs. The first bench
>   report from the user recalibrates the model.

---

## B. Detailed critique

### B1. Will the plan achieve the goal? Direction by direction, and how each could be "met" while the intent fails

| UD | Plan's mechanism | Strength | Proxy-trap scenario (the axis goes green, the intent fails) |
|---|---|---|---|
| UD-01 brief | all axes | named | The rubric's seven categories are all visual. "Living" and "a soundscape true to the place" never enter the photoreal gate, so a silent, frozen town that photographs well passes §8. |
| UD-02 / UD-14 fill every gap | §7, axis J, WORLD_INVENTORY | weak | The inventory is written by the builders. What they don't imagine is never MISSING. "No fillable MISSING entry" is met by a short inventory (fixed by T-J6). |
| UD-03 autonomous | session loop | fine | "—" in the trace. Autonomy without a budget means a session can spend all its time on instruments (fixed by change 5). |
| UD-04 rules permanent | CLAUDE.md | named | The working rules include "timing tests under load are not failures", with no forced idle re-run. That loophole kept 11 failures open for three sessions (audit A M8). Add: a waived test needs an idle re-run record in `bench-reports/` newer than the waiver, or `npm test` fails. |
| UD-05 references | §8 reviewers | fine | Reviewers can say which references they used and still score against memory. The anchor set (change 6) pins the scale. |
| UD-06 every inch | axes A–C, coverage harness | **named, not specified** | **(1)** The town passes detection: D-234 houses are no longer flagged placeholder, procedural noise defeats the flat-region check, and triangle density is fine. But every house is one kit, no lamp burns in any room at night, and no one is inside by day. Axis A passes; E's "distinct geometries per instance" passes on resized kits. **(2)** A failing village is diluted inside a 150 km² "plain" area. **(3)** Walk coverage is 99 % of the nav grid, which is 35 ha. **(4)** The detectors penalise black crush, so night gets brightened until moonless nights look like dusk. |
| UD-07 lives, systems, sandbox | axes D, F; P1 | sightings only | **(5)** A market "sighting" is five standing people with baskets. **(6)** The cause→effect probe checks a simulation variable, not the screen. **(7)** "Sandbox" is never defined: the player still cannot inspect, give, carry, sit or be remembered by anyone outside 135 people. |
| UD-08 nothing copy-pasted | axis E censuses | weak metrics | **(8)** "Distinct combinations per 100 people" passes with 12 faces. **(9)** "History" is 100 % filled by a template. **(10)** Everyone is addressable, and each reply is a nod plus one of 12 Elamite lines. |
| UD-09 coming and going, not repetitive, seeds | E scene variety, F | partial | **(11)** Scene variety measured as a person-set Jaccard is defeated by shuffling who stands where, while the lane feels identical. **(12)** The court arrives once a year on a fixed date. A player never sees it, but "arrival event exists" passes. **(13)** The calendar replays after 354 days; the plan never mentions it. |
| UD-10 court default | P1, court soak | fine | Making the court default moves the heaviest scene (12–13.5 M triangles, B13) into the default world. The plan does not tie that to the bench or the budget. Also, the default new game should start near the arrival so the first session contains it (see B2). |
| UD-11 surprises | §7, axis J | **weak** | **(14)** "Ten surprises added to the backlog each session" is met by writing lists. The discovery metric is inflated by splitting kinds. The easiest real implementation, spawning events near the player, breaks §1.1 restraint. No test forbids it (fixed by T-F6). |
| UD-12 scope preserved | scope_ledger test | shallow | The test checks that an id string appears in a table. It does not check that axes, thresholds or measures survive. **(15)** A later session "clarifies" axis C to "the rig lens where the player lens is impractical", and every test stays green (fixed by change 2). |
| UD-13 easy photo list | NEEDS_FROM_ME | fine | — |

**The general answer:** the plan's mechanisms are strong where they already exist in code (lints, censuses, audit-C
probes). They are only *named* for the three directions the user cares most about: every inch, lives and systems, and
surprise. None of those has a numeric threshold, a denominator the build cannot redefine, or a guard against selective
sampling.

### B2. What the plan is missing entirely

Things a player meets that no axis measures or no programme builds:

- **Hour 50.** Novelty saturation. No measure exists of whether anything is still new after many hours (T-J1). Construction
  progress over weeks is simulated for Hall 100 columns only.
- **The return visit a month later.** Autosave is missing (P0 names it). The catch-up is capped at 30 days (not named).
  Visible deltas after an absence are unmeasured (T-J3).
- **Night in a village.** The villages have no fires, no lamps and no voices, and they are boxes. The plan puts villages in
  P2 but has no night truth. Nobody defines how dark a moonless night should read after tone mapping. Proposed: moonless,
  away from fire, tone-mapped mean luma ≤ 20/255; full moon ≤ 45/255; fire-lit surfaces carry the frame. People sleep on
  roofs in summer. Dogs and jackals can be heard. Town fire light leaks through walls (audit B M11).
- **Following one family for a week.** The follow check is 20 people × 1 day, on text. Kin coherence on screen, household
  meals, a child with its own mother and sick days at home are all unmeasured (T-E4).
- **Talking to strangers.** Content scale is absent from the plan: 62 lines × 6 voice classes for the whole world, and
  lexicons of 79–116 words. The dead-language limit means talk cannot be deep. The plan should *decide* (DECISIONS) that
  depth comes from gesture, action, memory and the translation layer (who this is, their history), and measure line
  repetition (T-K1).
- **A festival.** Festivals and weddings have never been rendered or heard. They need crowd scale, music with performers,
  food, and a respectful ritual (action, fire, offering, wordless chant). The plan names festivals only in lists.
- **Weather extremes and their consequences.** The plan lists weather *types* but not *behaviour and aftermath*: a storm
  flattening an awning, the Pulvar in spate, mud with tracks that dries over days, snow by altitude (the mountains are bare
  when the plain is bare: audit B M9), dust storm visibility, heat rest at noon in July.
- **A child's day.** Play, errands, following the mother, apprentices (scribal pupils are attested in the Fortification
  texts as far as I recall; tier C until sourced), "the child following the stranger". The girl who has one face and body.
- **Animals' lives.** Herds vanish beyond 400 m (audit C M-9). No lambing season, animal pens at night, animal sleep,
  slaughter on a stockyard that doesn't exist, dogs that belong to someone and follow them, or storks and swallows nesting
  in season. Animals are not solid.
- **Economy flows.** Conservation of goods (T-F2) and visible issuers at ration issues are missing. Only two drawn sack
  piles follow the stock.
- **Social relations and gossip.** Relationships change in data (`pop.relate`) and surface nowhere. Friends greeting,
  enemies avoiding each other, disputes brought to hearings, news travelling (T-F5): none is a requirement in the plan.
- **Emergent incidents** from system state rather than the calendar (T-F4). Today every event is scheduled from (seed, day).
  The population's 46,775 people are pure functions of the calendar and cannot react to a blocked lane, a door or the player
  (audit C row 23).
- **The player's agency and its consequences.** Covered in change 10: verbs, memory beyond 135 people, stepping aside,
  visitor checks outside the Terrace.
- **Comfort and access.** The FOV default, head-bob on by default, the photosensitivity warning, controls, subtitles, the
  first five minutes without a tutorial (is the controls help discoverable?), and a loading time that already reaches 244 s
  under load. A two-minute loading screen breaks the time capsule before it begins.
- **Long-session stability.** Memory growth, audio node leaks and time drift over hours. The simulation stalls up to 675 ms
  at ×60.
- **The translation layer.** Its English is the project's own and unchecked (D-198). It is the only place a player can
  learn a stranger's name and history (UD-08 needs it), the map, the chronicle and the gap reasoning (D-207). The plan
  mentions it only as "reasoning visible in F3 and the translation layer". It needs its own checks: every history and
  every reconstruction note surfaced and tiered, and no fate hints (a lint over speech lines, the chronicle and the layer
  for Alexander, 330, burning, ruin and similar).
- **Performance on real hardware.** The plan relies on the user's optional bench. If the build runs at 12 fps on a 3070,
  no session would ever know. A static GPU cost model (T-K6) is a better proxy than triangles.
- **Delivery.** The build has never been deployed. The user who "doesn't want to intervene" still has to *play* it
  (T-K5).
- **The default experience itself.** The default quality is `high` (settings.ts:21), and the plan judges `ultra`. The
  default FOV is 70° vertical. The default start date is not tied to any event. A decision is needed: a new game starts on
  the morning of the court's arrival (a seed-chosen date in the probable season, labelled C), so the first session contains
  the defining event.

### B3. Is it executable? A concrete budget and cadence

**The arithmetic the plan omits.**

| design | views | at test quality (assume ~30 s amortised) | at high (~3–8 min) |
|---|---|---|---|
| 400 points × 12 months × 8 hours × 9 weathers × 3 seeds | 1,036,800 | ~360 lane-days | ~6 lane-years (3 min) |
| 400 points × 1 state (D-235 as built) | 400 | 3.3 h | 20–53 h |
| Proposed Tier 1 (≈ 80 areas × 59, rotating over 4 sessions) | ~1,200 per session | ~10 h | — |
| Proposed Tier 2 per session | 16 ultra + 16 tiles + 3 clips | — | ~6.5 h |

(Unit costs are uncertain. CLAUDE.md gives "a high view's test is ~8 min" and "a high frame costs ~2.5–4 min (8 per view)",
which disagree. The first session must measure t_load, t_test, t_id, t_high and t_ultra on an idle lane and write
`gates/budget.json`. The per-session sample sizes are then derived from it, not chosen.)

**The design that keeps coverage honest** (change 3 in full):
1. **Detection everywhere, no lane:** Tier 0 over every 5 m cell of the registry, every session, plus the renderless bots,
   audio and people traces in parallel Chromium instances. This is where "every inch" is actually covered.
2. **Statistical claims per area at test quality:** n ≥ 59 random views with 0 hard fails gives < 5 % failure at 95 %
   confidence (the rule of three). n ≥ 150 gives < 2 % for the transect. The seed comes from the commit hash. Views are
   spread over month × hour × weather by a pairwise covering array, so every pair (hour band × weather, month × hour,
   area class × weather) is hit at world level within one rotation. Every marginal (each month, hour band and weather) is
   hit per area within the rotation.
3. **Judgement is a detector audit, not the statistic.** Six all-passing Tier-2 views still allow a failure rate of about
   40 % (95 % bound). So Tier 2's job is to find what the detectors miss. Every escape becomes a detector (change 6), and
   the escape rate is the gate on the judges themselves.
4. **Change-driven re-measurement with canaries:** 3 fixed canaries per area (~240 test views ≈ 60–90 min) after any global
   change. Carry forward on a small ΔSSIM with no worse detector score; otherwise re-queue that area. Evidence carried for
   more than 4 sessions is STALE.
5. **Cheap high-resolution truth:** 1440p detail via `camera.setViewOffset` tiles, at the cost of a 960×540 frame, not a
   2560×1440 one.
6. **Motion at reduced resolution:** 480×270 clips at high, 48 frames, with an ID pass per frame. This catches pop,
   shimmer, ghosting and sliding at a quarter of the cost.
7. **Evidence size:** JPEGs at ~60 KB × ~1,500 views per session is ~90 MB per session in git history, or ~2.7 GB over 30
   sessions. Keep stats JSON for every view. Keep images for Tier-2 views, Tier-1 failures and canaries only. Keep
   160×90 thumbnails for passing Tier-1 views. Cap it at 25 MB per session, enforced by a test on the size of
   `REVIEWS/evidence/<pass>/`.

**Cadence per session:** first hour: start-up, Tier 0 and the renderless bots begin (they run all session). Then canaries if
a global change landed, Tier 1 for the areas due (oldest evidence first, plus change-driven areas), then Tier 2, then
agents' ≤ 2 renders each, with a 20 % reserve. The board is regenerated at close.

### B4. Is the order right?

- **Measurement first:** right in principle, wrong in size. Instruments that measure *known* failures (placeholder houses,
  23 bodies, mute town, frozen distant work, box villages) add nothing until those are fixed. Time-box P0 to one session
  and restrict it to the cheapest instruments (Tier 0, renderless, bots, registry, thresholds, board). Run it in parallel
  with a "stop the bleeding" sprint whose items are already diagnosed with line numbers in audits A–D.
- **Visible progress:** the user found the miss by *looking*. A plan that shows no visible change for a session invites the
  next intervention. Rule: every session ships one change a player would notice, named first in PROGRESS.
- **The reference area:** replace the Terrace slice with a **transect** (change 5). The slice repeats phase 3's mistake: it
  proves stone and monument light, the part that is already the most advanced. It says nothing about houses, households,
  interiors, night fire, voices, villages, fields or animals. Those are where the user's new directions live and where
  every audit's worst findings sit.
- **World-wide systems vs area by area:** §6 says both ("area by area, worst first … while world-wide systems … are fixed
  once") without saying which comes first. P0–P4 are ordered by system type: P3 "photoreal everywhere" comes *after* P2
  "the world complete". That means materials and shadows, which touch every pixel, are fixed after hundreds of new
  buildings have been judged under the old ones. Proposed order: the multipliers (faces and bodies, animation, the audio
  engine, materials, contact shadows, night occlusion) inside the transect first, then everywhere, then area-by-area content.
- **What a strong studio lead would do first** for the biggest honest gain:
  1. Fix the four hard breaks: fall-through, D-229, indoor/rain, and the silent town with a crowd murmur bed plus voices
     from population speakers.
  2. Flag every unflagged placeholder, so the board is honest on day one.
  3. Stand up Tier 0 and the renderless bot fleet and publish the first board.
  4. Per-person face and body parameters: the largest felt copy-paste, and a world-wide multiplier.
  5. Transect to PASS.
  6. Generators with per-instance variation for houses and villages (one kit replaced everywhere at once).
  7. Only then, per-area content.

### B5. Governance holes, and mechanical guards

| Hole | How a session drifts | Guard |
|---|---|---|
| Thresholds unset or redefined | A session sets or "clarifies" a threshold where the build stands | `gates/thresholds.json` + `tests/gates_ratchet.test.ts`, which checks git history and only allows tightening (change 2) |
| Easy samples | The agent picks points it knows pass | Sample seeded from the commit hash; `coverage_report.ts` refuses evidence whose view ids differ from the sampler's output for that seed; worst-first views reported separately |
| Stale PASS | Evidence from before a global change still shows PASS | Dependency hash per cell → STALE = FAIL; canary carry-forward only with a measured small change; 4-session age limit |
| Hand-edited board | PROGRESS or COVERAGE says PASS without evidence | COVERAGE.md is generated; the test regenerates and diffs it; a PASS cell must point to evidence files that exist |
| Denominator games | Areas merged; nav grid as the "world" | `data/areas.json` generated from the physical envelope; `tests/areas.test.ts` checks union coverage ≥ 99.5 %, no shrink, max area size |
| Skipped discovery | §7 quietly dropped under time pressure | Session log `sessions/sNN.md` with required sections (breaks found, board delta, surprises shipped with evidence paths, gap hunters' lists and capture–recapture estimate); the scope test checks that the latest log exists and each section is non-empty and cites existing files |
| Narrowed briefs | The lead writes agent or reviewer prompts that drop scope words | Prompt templates in `handoff/` with mandatory clauses (UD ids, the axis thresholds quoted verbatim, "how could this pass while the intent fails"); a test checks the templates for the scope words |
| Waived tests never re-run | "Timing tests under load are not failures" | A waived test needs an idle re-run record (load average < 1) newer than the waiver in `bench-reports/`, or `npm test` fails |
| Plan shrinks | An axis dropped or softened in a rewrite | The scope test checks axis headings A–K, the count of threshold ids and the §12 measure cells (change 2) |
| Reviewer leniency drift | Scores creep up without the world changing | Anchor set with pinned scores; blind shuffles including pre-fix renders (change 6) |
| "Passed with logged exceptions" as PASS | Brief §15.7 read as permission | The board shows FAIL-EXCEPTION, which never counts toward done |
| TASKS.md ticks | `[x]` on unverified items (audit A M8) | Retire checkboxes for verification; TASKS lists work only, and "verified" lives on the generated board |
| Performing for the player | Surprises spawned near the player | `tests/player_independence.test.ts` (T-F6) |
| Definition of done judged by the builder | "the user's directions all traced and met" | "Met" is judged by the independent audit round (every third session) with evidence, never by the lead |

### B6. Proposed thresholds per axis (all to go in `gates/thresholds.json`)

| id | axis | metric | threshold | how measured |
|---|---|---|---|---|
| T-H0 | Walker | hard breaks | 0 per 20 bot-hours per area; 0 per 200 world-wide | illusion-break log (change 1) |
| T-H0s | Walker | soft breaks | ≤ 2 per bot-hour per area | same |
| T-A0 | A | Tier-1 hard fails | 0 in n ≥ 59 random views per area or class (n ≥ 150 in the transect) | ID + shaded pass; seeded sampler |
| T-A1 | A | untiered or placeholder pixels | 0 % of pixels; 100 % of drawn meshes carry tier and source | ID pass against the metadata registry |
| T-A2 | A | image statistics | per frame (excluding sky): radially averaged power-spectrum slope and 12 px Ystd/Y inside the 5–95 % band of the reference photographs at the same distance class; flat-region share (connected ≥ 2 % of frame with Ystd/Y < 0.03) ≤ 3 % | calibrated on `references/` site photos and the user's photos |
| T-A3 | A | exposure | clipped (any channel ≥ 254) ≤ 0.5 % excluding the sun disc and flames; black crush ≤ 1 % by day; 0 NaN or black tiles | shaded frame stats |
| T-A4 | A | rubric | every category ≥ 4 in every judged view; 0 "reads as CG" | calibrated reviewer (change 6) |
| T-A5 | A | paired photo test | reviewer pick accuracy recorded; ratchets down each time it improves | Now view vs photo pairs |
| T-B1 | B | stratum coverage | per area within one rotation: all 12 months, 8 hour bands and 9 weathers hit at least once; world-level pairwise coverage 100 % | covering-array report |
| T-B2 | B | night truth | moonless, away from fire: tone-mapped mean luma ≤ 20/255; full moon ≤ 45/255 | shaded frame stats |
| T-C1 | C | player's view | judged at the default FOV and at the widest; `ultra`; rigClear = 0; 16 tiles at 1440p per session | coverage spec |
| T-C2 | C | motion | 0 id pops inside 50 m; motion-compensated temporal flicker in static regions ≤ a limit calibrated on a static-camera clip | 480×270 clips with an ID pass |
| T-D1 | D | overlaps | 0 interpenetrations > 0.2 m; pairs < 0.4 m while walking ≤ 0.1 per 1,000 person-seconds | renderless trace from crowd instance buffers |
| T-D2 | D | fake performance | 0 walking in place; 0 stand frames for an active work plan; 0 walk gait > 2.0 m/s; 0 jumps > 3 m in 1 s within 150 m of the player | same |
| T-D3 | D | indoor truth | 0 people drawn outdoors whose plan says indoors; at 23:00 every household member whose plan says "asleep at home" is drawn asleep there | same, plus Tier-1 interiors |
| T-D4 | D | shelter | rain ≥ 0.5: people in the open (not exempt by job) ≤ 10 % of the dry-day count, all with rain posture or cover | same |
| T-D5 | D | animals | 0 herders or ploughmen in view without their animals, at any distance | same |
| T-E1…E6 | E | identity and variety | as in change 7 | person census, lineup test, SSIM, scene probe |
| T-F1…F6 | F | systems | as in change 8 | probes, conservation test, independence test |
| T-G1 | G | loudness | integrated loudness per cell inside a band per place class (set once from references, then locked); true peak ≤ −1 dBTP; limiter present | OfflineAudioContext renders |
| T-G2 | G | repetition | no segment (cross-correlation > 0.9 over > 0.3 s) repeats within 60 s; consecutive footsteps correlate < 0.8; no bed loop shorter than 30 s unless generative | same |
| T-G3 | G | presence | 100 % of visible speakers within 15 m audible (> −40 dB at the listener); every visible fire within 10 m and every river within 50 m audible | graph inspection in renderless mode |
| T-G4 | G | listening | every category ≥ 4 (presence, place, variety, mix, language, restraint) on the Tier-2 clips | calibrated listening reviewer |
| T-G5 | G | silence kept | in night-field cells, ≥ 20 % of time below the quiet floor | short-term loudness |
| T-G0 | Judges | detector escapes | ≤ 10 % of the last 30 judged views | escapes log |
| T-H1 | H | walkable truth | collider vs drawn height ≤ 0.05 m at 10,000 samples per ring seam; ≥ 99 % of 200 random reachable targets per area reached; stuck ≤ 0.5 % | node seam test; renderless bots |
| T-H2 | H | hitches | ×1: no main-thread frame > 33 ms from the simulation; ×60: p99 ≤ 20 ms | renderless timing (simulation in a worker) |
| T-H3 | H | persistence | autosave ≤ 5 real minutes and on `visibilitychange`; save → load → save byte-identical, including people, memory, doors and events | e2e |
| T-I1 | I | faithful | 0 blocklist hits in the judged sample's visual checklist (stirrups, coins, arches…); 0 fate-hint strings in speech, chronicle or translation layer | reviewer checklist; lint |
| T-J1…J6 | J | novelty and completeness | as in change 9 | tourist bot; inventory; gap hunters |
| T-K1…K6 | K | player's experience | as in change 10 | bot tests, e2e, soak, cost model |

### B7. What is wrong, vague, contradictory or wasteful in the plan

1. **Status line is stale:** "rev 1 DRAFT: audit D and the independent critique pending", while rev 1.1 says audit D is
   folded in.
2. **Section order:** §12 (trace) comes before §11 (revision log), and the header cites "§11, revision log". It is
   harmless to the test, which slices from `## 12.`, but it is sloppy for a governing document.
3. **Non-measures in the trace:** UD-03 "—", UD-04 "this plan read first", UD-12 measured by the test that checks the
   table itself. Each needs a threshold id or a file (change 2).
4. **Axis A has no numbers:** "share of viewpoints passing" (what share?), "detail per steradian below threshold" (what
   threshold?), "rubric ≥ 4 on a stratified sample" (what size, chosen how?).
5. **Axis C treats 70° as fixed.** It is a questionable default (about 102° horizontal) that works against §1.1's felt
   scale. It should be decided, then both the default and the widest setting judged. Axis C also judges `ultra` while the
   default preset is `high`.
6. **Axis B weights all weathers equally.** Sampling should follow climate frequency, with a guaranteed minimum for rare
   states, or the board over-samples snow and under-samples ordinary days.
7. **P0 "urgent (session 8)" is dated work inside a standing plan.** It belongs in TASKS. The plan should state the rule
   (hard breaks first), not the date.
8. **P0 has no exit criteria.** It is a list of ~14 instruments with no order and no time box (change 5).
9. **P2 before P3** puts world-wide material, shadow and face fixes after area content (B4).
10. **§6 order vs the programme:** "reference area first" and "P0→P4 by system type" are two orderings with no rule for
    which wins.
11. **"Evidence kept in git (JPEG ~60 KB)"** without a volume cap bloats history (B3.7).
12. **§8 "`[x]` means verified on screen"** keeps TASKS.md as a second tracker next to COVERAGE.md. Two sources of truth
    drift. Retire verification ticks from TASKS.
13. **§10 "the user's directions all traced and met"**: met according to whom? It must be the independent audit round,
    because the user asked not to have to intervene.
14. **The rubric stays photo-only.** The Walker Test's "dead, silent where it should speak" has no seat in the rubric.
    Add the listening rubric and a "life" category for Tier-2 scenes, and judge scenes in motion with sound, as §1.1
    already demands ("as scenes").
15. **§7 "smell-by-proxy"** is good, but only as prose. Tie it to inventory rows: smoke, dung, bread ovens, tanneries,
    middens, each placed where it is produced.
16. **P1 "addressability … everyone the player meets"** without content scale (lines per language, voices per person)
    will produce 46,000 people sharing 62 lines. State the target: per-person voice parameters, a line pool per language
    and role, and gesture-first exchanges.
17. **P4 "sound everywhere"** comes too late. The audio engine's cloned noise (one seed for every footstep and fire) and
    the Terrace-only voices are world-wide multipliers, cheap to fix, and felt immediately. Move them into P0/P1.
18. **§9 says "none of these lowers a gate"**, but the plan has almost no gates with values to lower. This is the core
    problem change 2 fixes.
19. **The plan names files that do not exist** (`coverage.spec.ts`, `coverage_points.ts`, `coverage_report.ts`,
    `WORLD_INVENTORY.md`, `COVERAGE.md`) as the tools of the axes. That is fine as intent, but the plan should mark them
    TO-BUILD. Otherwise a restart reads a plan whose instruments appear to exist, which is audit A's M7 finding again.

---

**Summary for the lead:** keep the diagnosis (§2), the axes and the ledger. Add numbers that only tighten, a world
registry the build cannot redefine, a sampling design that fits one render lane and cannot be cherry-picked, a mechanical
illusion-break log as the headline measure, calibrated judges, and the missing dimensions: long horizons, families,
conservation, emergence, the player's verbs and comfort, delivery, and real-hardware cost. Then reorder so that the first
session fixes what is already known to be broken and ships something the user can see.
