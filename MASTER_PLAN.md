# MASTER PLAN — how PĀRSA becomes a time machine

**Status:** governing document, **rev 2.2** (§13). Rev 1 was critiqued by an independent adversarial reviewer
(`REVIEWS/master_plan_critique.md`) and rev 2 folded it in. Rev 2 was critiqued by a second one
(`REVIEWS/master_plan_critique_rev2.md`), who defeated all thirteen attacks on its guards and found impossible or undefined
numbers; rev 2.1 folds that in (§13). Read `USER_DIRECTIONS.md` (the user's own words, append-only) and this plan at the start
of every session, before PROGRESS, TASKS or HANDOFF. Where an older task list, handoff or decision conflicts with this plan, this
plan wins; where this plan conflicts with the user's directions, the directions win and this plan is corrected. The plan may
grow; it may not shrink without a user direction (§13).

Mechanical guards:
- `tests/scope_ledger.test.ts`: every UD row's text is identical to its first committed version, and the ledger never holds fewer
  rows than it ever did; every trace row names at least one threshold id of its own UD, only ids or regular files, and never
  fewer references than before; every sentence in `gates/scope_phrases.json` (append-only) appears verbatim where it belongs;
  every TO-BUILD tool path is named in this plan; every D-, Q- and B- number this plan or CLAUDE.md cites exists in its record or
  in `handoff/reserved_numbers.md`; each brief template's fixed clauses keep their rev 2 text, and every brief sent
  (`handoff/briefs/sNN/`) carries them; TASKS.md holds no verification ticks.
- `tests/gates_ratchet.test.ts` (§4.1). Both fail closed and run before every commit, in `npm run build` and on GitHub (§8).

Numbers quoted here are rev 2.1's; **`gates/thresholds.json` is authoritative** and can only be stricter.

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
`audit_D_engine_sound_verification.md`) and two critiques of this plan found that the chosen-views miss was one instance of a
general failure:

| Anti-pattern | What happened | Rule now |
|---|---|---|
| **Letter over intent** | Gates met as written (a rubric on camera-rig stills, a shadow review of text timelines) while the experience failed | Every threshold states its anti-proxy (how it could pass while the intent fails) in `gates/thresholds.json` |
| **A sample stood for the whole** | ~40 chosen views (6 % of the Terrace's walkable ground within 25 m), 20 people × 1 day, 12 days mostly April–May, 1 seed | Detection everywhere (Tier 0, bots); seeded random samples the agent does not choose (§4.2) |
| **Node instead of screen** | People standing in rain the plan sheltered, frozen impostors, treadmill walkers, a soundscape never heard | VERIFIED only on the player's screen/speakers, or by a detector proven to fail when the screen fails |
| **The judged frame was not the player's** | 40–46° lens at 960×540, `high` not `ultra`, nobody within 2.5 m, stills only | Judged at the player's FOV and quality, in motion, with sound (axis C) |
| **Breadth before depth** | Phases 4–8 built on a slice that never passed | A reference transect proves every standard before rollout (§6) |
| **Evidence evaporates, records overclaim** | shots/ and bench JSON gitignored; `[x]` on unverified items; stale "resolved" | A generated board with dependency hashes; STALE and NOT-MEASURED = FAIL; TASKS carries no verification ticks (§5, §8) |
| **Handoffs carry tasks, not the goal** | Each session inherited a to-do list | This plan and the ledger are read first; briefs come from templates with the scope words, and are saved (§8) |
| **No one looked for the unasked** | 209 names, no histories, unflagged boxes, unbuilt interiors surfaced only when the user pushed | Discovery with outside taxonomies and two independent gap hunters, estimated by capture–recapture (§7) |
| **Numbers left for later** (critique 1) | Rev 1 said "threshold" ten times and gave almost none | Thresholds are data, locked, and only tighten (§4.1) |
| **The build defined its own world** (critique 1) | Walk coverage measured against a 35 ha nav grid in a 143 × 143 km walkable terrain | The area registry is generated from the physically walkable envelope (§4.3) |
| **Measuring places, not moments** (critique 1) | Falling through the mountain sat outside every axis until someone walked there | The illusion-break log is the headline measure (§3) |
| **Guards that guard nothing** (critique 2) | Every attack on rev 2's guards passed: any UD cited as a loosening, a stub file promoting rows to "built", one unparsable commit switching off history, a squash, reworded directions | Guards fail closed, check history and pushed tags, derive status from evidence, and run outside the session's reach (§4.1, §8) |
| **Statuses typed, not earned** (critique 2) | Rows marked "partial" or "built" on tools that do not measure them | Status is derived from evidence files; every row restarted at to-build in rev 2.1 |

## 3. The standard: the Walker Test, made mechanical

The project is done when a person can walk anywhere reachable, at any time of the year, for as long as they like, and find nothing
fake, repeated, dead, silent where it should speak, staged for them, or absent that a real 467 Persepolis would hold. Thresholds
are the gate; they are never lowered to pass (brief §3.7, CLAUDE.md, §4.1).

**The illusion-break log (the headline measure).** A fleet of walker bots (`tools/dev/walkers.ts`, TO-BUILD) plays the world
continuously in the renderless mode (§4.2), plus a low-resolution ID pass where a check needs pixels. Five policies: *wanderer*
(random walk over the whole walkable envelope), *tourist* (heads for sound, crowds and landmarks), *follower* (shadows a random
person for a whole day), *returner* (revisits yesterday's places at the same hour), and the *prober*, the adversary (hugs walls,
jumps in corners, times doors, pushes through queues, climbs slopes at 41–43°, stands in doorways). Every **break event** is
logged with place, time, seed and commit.
- **Hard breaks:** feet more than 0.3 m below the drawn surface; stuck over 10 s; an invisible wall; the camera's near plane
  inside geometry (seeing through a wall or into a body); an object or person appearing or vanishing inside 50 m in view; a NaN or
  black tile; a main-thread frame over 100 ms at ×1; interpenetration over 0.2 m (person–person or person–player); walking in
  place; a work plan drawn as a standing figure; a person drawn outdoors whose plan says indoors; a speaker within 10 m with no
  audible source; English or modern text or audio in the world; an event spawned because the player is near.
- **Soft breaks:** a frame over 33 ms at ×1; a twin face within 15 m; one voice line heard twice within 10 minutes; an identical
  audio segment within 60 s; a scene matching the same place and hour on another day (T-E6); a clipped highlight in a normal
  exposure; a placeholder in view.
- **Thresholds:** **T-H0** 0 hard breaks per 20 bot-hours per area; **T-H0w** 0 in 200 bot-hours world-wide; **T-H0s** ≤ 2 soft
  breaks per bot-hour per area; **T-H0p** 0 hard breaks in 5 prober bot-hours per area. A break a reviewer or the user finds that
  the log missed is a **detector escape** (T-R0, §8).
- The log's rate per area is the **first column of COVERAGE.md**; PROGRESS.md leads with the ten worst.

## 4. The eleven axes

Each axis names its thresholds by id; each id's scope, metric, operator, value, unit, minimum sample, tool, status and anti-proxy
are in `gates/thresholds.json`. A superseded row stays in the file and reads SUPERSEDED (§4.1); its replacement is named here.

**A. Place coverage (UD-06).** The unit is the **area**, from the registry (§4.3), covering the whole walkable envelope: every
Terrace court, hall, room, stair and roof; every town lane, court and enterable room; the approach; the plain, its roads, fields,
canals, rivers and villages; Naqsh-e Rustam; the slopes of Kuh-e Rahmat; the land beyond the fields to the world's edge.
*Thresholds:* **T-A0** 0 hard fails in n ≥ 59 seeded random Tier-1 views per area or generator class (**T-A0t** n ≥ 150 in the
transect); **T-A1** 0 % untiered or placeholder pixels, **T-A1m** 100 % of drawn meshes tiered and sourced; image statistics
against **photographs** of the real place or listed analogues, never renders (**T-A2r** ≥ 30 per stratum, else NOT-MEASURED):
**T-A2s2** the share of frames inside the photographs' joint 5–95 % band within the binomial margin of the photographs' own
leave-one-out share, **T-A2k** no KS rejection, **T-A2f** flat-region share ≤ 3 % and **T-A2f2** never flatter than the
photographs' 95th percentile (T-A2s is superseded by T-A2s2: real photographs fail it); **T-A3c2** clipped ≤ 0.5 % outside the sun,
its 5° aureole, flames and glints (supersedes T-A3c), **T-A3k** black crush by day ≤ 1 %, **T-A3n** 0 NaN or black tiles; **T-A4**
every rubric category ≥ 4 in every judged view and **T-A4cg** 0 "reads as CG"; **T-A4m** the brief's eight §1.1 moments judged
each rotation as scenes in motion with sound; **T-A5** the paired photo test's pick accuracy, recorded and ratcheting, toward the
final standard **T-A5d** ≤ 65 % over ≥ 20 pairs; **T-A6** the registry covers ≥ 99.5 % of the envelope, **T-A6x** no unique area
over 1 km² (0.25 ha indoors). *Anti-proxy:* flags lie (3,983 unflagged village boxes), so detail is measured directly; noise
defeats a flatness check, so image statistics are matched to photographs.

**B. Time coverage.** Every month, eight hour bands (pre-dawn, dawn, morning, noon, afternoon, dusk, moonlit and moonless night),
every weather the climate makes (clear, cloud, overcast, rain, storm, snow, dust, mist, lightning), fire-lit nights. Weather is
sampled by climate frequency with a floor for rare states (D-242). *Thresholds:* **T-B1m** 12 months, **T-B1h** 8 hour bands and
**T-B1w** 9 weathers hit per area within one rotation, **T-B1p** 100 % world-level pairwise coverage; night neither dusk nor black:
**T-B2m** moonless away from fire ≤ 20/255 mean luma after tone mapping with **T-B2s** the skyline still ≥ 3/255 above the
terrain, **T-B2f** full moon ≤ 45/255 and **T-B2l** ≥ 8/255; **T-B3** a full rotation within 4 sessions, **T-B3a** carried
evidence STALE after 4 sessions.

**C. The player's view.** Judged at the default FOV (60° vertical, D-238) **and** at the widest setting, at `ultra`, with 1440p
detail tiles, in motion, with nobody hidden near the lens; hard-break detectors also run at the default preset (`high`).
*Thresholds:* **T-C1** rigClear 0; **T-C1u** ≥ 16 ultra views, **T-C1t** ≥ 16 detail tiles (960×540 sub-rectangles of a 2560×1440
projection via `camera.setViewOffset`) and **T-C1c** ≥ 3 motion clips (48 frames, 480×270, walking 1.35 m/s, an ID pass per frame)
per session; **T-C1f** ≥ 4 conversation-distance clips per session (the player addresses a random person at 1–2 m: every
category ≥ 4, none uncanny; brief §9.3 "faces first"); **T-C2** 0 pops inside 50 m; **T-C2f** static-region flicker ≤ 1.5 × a
static-camera baseline.

**D. Life on screen (UD-07, UD-08, UD-09).** What a walker sees among people and animals matches the simulation and reads as
life. Measured from renderless traces of the **crowd's instance buffers** (what is drawn), not popview or plans. *Thresholds:*
**T-D1** 0 interpenetrations > 0.2 m, **T-D1w** walking pairs < 0.4 m ≤ 0.1 per 1,000 person-s; **T-D2** 0 treadmill, **T-D2s** 0
stand frames for active work, **T-D2g** 0 gaits > 2.0 m/s, **T-D2j** 0 jumps > 3 m in 1 s within 150 m; **T-D3** 0 drawn outdoors
while planned indoors, **T-D3s** 100 % of "asleep at home" drawn there at 23:00; **T-D4** in rain ≥ 0.5, people in the open (jobs
exempted by evidence) ≤ 10 % of the dry-day count; **T-D5** 0 herders or ploughmen without their animals; **T-D6** the brief's
shadow review (§13.11) judged on screen, every followed person ≥ 4/5.

**E. Identity and variety: nothing copy-pasted (UD-08, UD-09).** *Thresholds:*
- **Faces and bodies** are continuous per-person parameters (shape, age, weight, asymmetry, skin, hair), not picks from variants:
  **T-E1d** 0 pairs within 15 m of the player closer than d\* in the population-SD-scaled parameter vector of the drawn head, d\*
  fitted from blind "same person" judgements (supersedes T-E1, which had no defined distance); **T-E1l** a reviewer finds a twin
  in ≤ 1 of 10 lineups of 20 crops from one crowd.
- **Names:** **T-E2** no name held by more than 1 % of a (sex, origin) group over 2,000 people; **T-E2h** no two living members of
  a household share a name unless the evidence attests it; attested names first, then names built from attested elements (D-236).
- **Histories:** **T-E3** 100 % of people have ≥ 5 events consistent with age, kin and the archive's dates; **T-E3r** ≤ 1 % of pairs
  share an identical event-type sequence of length 4; **T-E3v** ≥ 30 % show a trace of their history a walker can see or hear.
- **Families on screen:** **T-E4** children with their own mother or kin, households eating together, 20 households × 7 days
  matching the kin graph 100 %.
- **Perceptual repetition:** **T-E5** image-patch SSIM < 0.9 between two instances of one generator within 50 m.
- **Scene variety:** **T-E6** the same place at the same hour on 7 days shares ≤ 50 % identical (person, act, metre); **T-E6i** in
  inhabited areas every 2-hour daytime window holds a non-routine witnessable event within 100 m, and **T-E6w** in unpeopled areas
  a sign of life or weather change within sight (silence is allowed, brief §1.1; together they supersede T-E6e).
- **T-E7** every people gate runs on ≥ 3 seeds, one of them a fresh random seed each run (logged).

**F. Systems visible, conserved and consequential (UD-07, UD-09, UD-10).** Every system lives in `data/systems.json` (TO-BUILD)
with its places. *Thresholds:* **T-F1** ≥ 3 witnessable stages per system; **T-F2** drawn stores equal stock ± 1 display unit,
**T-F2m** monthly flows balance within 2 %; on screen, **T-F3d** a delegation arrival at least doubles road density within 1 km and
**T-F3g** guard posts, **T-F3s2** a storm drops outdoor work within 5 in-game minutes (supersedes T-F3s), **T-F3r** a short-ration
month lengthens the ration queue ≥ 1.5× and **T-F3j** cuts jars carried home to ≤ 0.8×, **T-F3x** every causal link of brief §9.5
has a row; **T-F4** ≥ 15 kinds of emergent incident from system state; **T-F5** news travels by visible messengers before an
arrival; **T-F6** **the world does not perform**: at one seed the event log is identical whatever path the player walks, and
**T-F6x** the event-log hash is the same in node and Chromium and matches a committed golden hash; **T-F7** the year soak passes
8/8 on 3 seeds, **T-F7a** 0 placeholder performances; **T-F8** the court's arrival and departure are witnessable every year in
the default world (UD-10).

**G. The senses.** Sound rendered (OfflineAudioContext, faster than real time, in the renderless mode) and listened to per area
and time. *Thresholds:* **T-G1** true peak ≤ −1 dBTP with a limiter; loudness bands fixed before measurement from published field
levels at a stated calibration, **T-G1t** town day median = 60 dBA playback, **T-G1n** rural night 25–35, **T-G1v** village day
40–50, **T-G1m** gatherings 60–70 (the rows of T-G1l); **T-G2** no segment repeats within 60 s, **T-G2f** consecutive footsteps
correlate ≤ 0.8, **T-G2b** no non-generative bed loop shorter than 30 s, **T-G2m** two performances of one piece share no segment
over 2 s; **T-G3** 100 % of visible speakers within 15 m audible, **T-G3e** every visible fire within 10 m and river within 50 m
audible; **T-G4** every listening-rubric category ≥ 4; **T-G5d** night fields ≥ 20 % of the time 30 LU below the town day
(supersedes T-G5); **T-G6** every enterable space's RT60 within 20 % of its Sabine estimate, **T-G6o** sources behind a wall
≥ 10 dB down and low-passed.

**H. It runs and holds together.** *Thresholds:* **T-H1** collider vs drawn ground ≤ 0.05 m at 10,000 samples per ring seam,
**T-H1r** ≥ 99 % of 200 random reachable targets per area reached, **T-H1s** stuck ≤ 0.5 %; **T-H2** no simulation frame over
33 ms at ×1, **T-H2p** p99 ≤ 20 ms at ×60, **T-H2x** ≤ 33 ms at ×600 (the simulation in a worker; route search made cheap first,
B53, B54); **T-H3** autosave every ≤ 5 real minutes and on `visibilitychange`, **T-H3r** save → load → save byte-identical, **T-H3s**
saves ≤ 2 MB after 100 bot-hours in IndexedDB with failures announced out-of-world, **T-H3v** a save from the previous published
build loads or its loss is announced; **T-H4** first frame ≤ 60 s on an idle box.

**I. Faithful.** *Thresholds:* **T-I1** 0 blocklist hits in the judged sample's visual checklist, **T-I1f** 0 fate-hint strings;
**T-I2** 0 modern-language hits, with `lint:lang` inside `npm run build`; **T-I3** 0 untiered data records; the translation layer
as a product: **T-I4** 0 strings without source and tier, **T-I4c** every chronicle entry backed by a witnessable event in the world
log, **T-I4n** every history and reconstruction note reachable; **T-I5** 0 attested named people outside their attested life window
or role in 467 (the Treasury texts, 492–458, before the Fortification texts, 509–493); the brief's own numeric gates locked here:
**T-I6** plan overlay IoU ≥ 0.95 and **T-I6o** offset ≤ 0.5 m (§13.2), **T-I6s** sun ≤ 0.1°, **T-I6t** monthly temperature ± 1 °C,
**T-I6p** precipitation days ± 20 % (§13.6); **T-I7** ≥ 10 attested objects shown at their 467 point (tablets sealed with attested
seals, foundation plates, Treasury objects).

**J. Complete, surprising, and still new at hour fifty (UD-02, UD-09, UD-11, UD-14).** *Thresholds:* **T-J1a** ≥ 3 new (event kind
× place class × state) triples per hour after 10 tourist bot-hours, **T-J1b** ≥ 1 after 50 (kinds in `data/event_kinds.json`,
TO-BUILD); **T-J2** ≥ 20 rare-tail kinds; **T-J3** after 30 in-game days away ≥ 60 % of areas visibly changed; **T-J3e** absences of
1, 30, 354 and 3,650 days load equal to a continuous run, within T-H4, under **the perpetual 467** (D-246; supersedes T-J3c, which
contradicted the brief's fixed year); **T-J4d** day d and d + 354 no more alike than the same calendar day in another seed
(supersedes T-J4); **T-J5** ≥ 3 surprises shipped per session, verified on screen; **T-J6** WORLD_INVENTORY's capture–recapture
estimate of unfound gaps ≤ 5 %; **T-J7** 0 MISSING rows left unfilled where a probable reconstruction exists (D-207).

**K. The player's experience (UD-07 "sandbox", UD-06, UD-10).** The sandbox's verbs, within the brief: address anyone, inspect any
object, follow and be followed, sit, wait or sleep to pass time where a person of 467 could, carry a sealed document, watch any
craft up close; the area classes per verb locked in `data/verbs.json` (TO-BUILD). *Thresholds:* **T-K1** each verb works in 100 %
of its classes; **T-K1a** everyone within 3 m can be addressed and answers, with gesture, **T-K1a2** never in another people's
language (gesture and wordless voice where no published corpus exists); **T-K1r** ≤ 10 % repeated lines over 50 addresses per area
(D-241); **T-K2** anyone addressed or obstructed remembers the player ≥ 7 days; **T-K3** head-bob ≤ 2 cm by default, no roll
(D-238), **T-K3a** six comfort and access settings under e2e test, **T-K3f** ≤ 3 flashes a second with the warning set (WCAG
2.3.1), **T-K3c** captions for every sound that carries news or life; **T-K4** heap growth ≤ 2 % per hour in a 4-hour soak,
**T-K4a** 0 leaked audio nodes, **T-K8h** JS heap ≤ 1.5 GB; **T-K5s** a playable build per session at a stable URL with a note
naming three places and times worth walking to now (supersedes T-K5: phase gates no longer exist); **T-K6** the GPU cost model
predicts ≤ 16.6 ms on an RTX 3070 at 1440p in the 10 heaviest views, **T-K8** GPU memory ≤ 3.5 GB, **T-K7** first load ≤ 60 MB,
**T-K7c** 0 compile hitches over 100 ms after 30 s on a real GPU, **T-K9** ≥ 4 bench routes that run the simulation (court, town at
dusk, rain on the plain, ×60), **T-K9w** 0 hard breaks under the WebGL2 fallback; **T-K10** every decided default pinned by
`tests/defaults.test.ts`.

**R. Reviewers and records (thresholds on the process itself).** **T-R0** detector escapes ≤ 10 % of the last 30 judged views;
**T-R1** anchor scores within 0.5 of their pins; **T-R2** a full independent audit round and a critique of this plan at least every
third session; **T-R3** every session ships ≥ 1 change a player would notice; **T-R4** 0 open critical review findings; **T-R5** 0
open findings of the representation review (brief §12), every audit round; **T-R6** 0 agent branches unmerged and unrecorded at a
session's close (UD-03); **T-R7** 0 guard weakenings found by the audit diff (UD-12); **T-R8** 0 working rules of CLAUDE.md dropped
or reworded without a user direction (UD-04); **T-R9** 0 requests to the user beyond the easy list (UD-13); **T-R10** 0 sibling cloud
sessions or other extra paid compute without a user direction naming it (UD-15).

### 4.1 Thresholds are data and only tighten

Every threshold is a row of `gates/thresholds.json`: `{id, axis, scope, metric, op, value, unit, sample_min, sample, tool,
status, anti_proxy, ud, since}`. `tests/gates_ratchet.test.ts` fails **closed**: if git, any committed version, or the baseline
`acf73a4` is unavailable or unparsable, it fails. It compares the file against every committed version and every `ratchet/*` tag
(one is pushed at every session close), and fails if:
- an id disappears;
- `metric`, `unit`, `axis`, `scope`, `op` or `sample` change;
- `tool` changes once the row is partial or built (a row reset to to-build in a committed version may take a new tool, as rev 2.1's
  reset of overclaimed statuses required; every tool change is in the audit round's guard diff, T-R7);
- a value moves the loose way or `sample_min` falls;
- `anti_proxy` is shorter than 20 characters;
- the plan fails to quote an id, or quotes an id the file lacks.

Status is **derived from evidence**: `partial` needs `REVIEWS/evidence/**/<id>.json` (`{id, value, n, commit, tool}`) written by
the row's tool, which names the id; `built` needs such evidence with n ≥ `sample_min` on a commit no more than 4 sessions old.
Demotion is always allowed. A loosening needs `"loosened_by": "UD-nn"`, where that UD row's verbatim text names the id and the new
value. A threshold proven wrong in principle takes `"superseded_by"` only with `gates/errata/<id>.md` (the measurement showing the
real thing fails the old definition; signed by the critic who proposed it and countersigned by the next audit's critic, until
which both rows are evaluated). The new row is at least as strict elsewhere; the old row reads SUPERSEDED. New thresholds are
added, never swapped for easier ones.

### 4.2 How coverage is measured (the budget is part of the gate)

- **Tier 0: every cell, every session, no render lane.** A node pass at 5 m spacing in unique areas (4 m in the transect) and at
  the terrain tile's own resolution, with a per-tile content hash, in generator-class areas: placeholder or untiered objects in
  view distance, detail per steradian by distance class, instance repetition in the view cone, the people probes, collider vs
  drawn height, offline reachability with the browser's full collider set.
- **Renderless world mode (`?norender`, TO-BUILD first).** The full world (simulation, physics, crowd instance buffers, audio
  graph) in headless Chromium with the renderer off, so it never takes the SwiftShader lock. Bots, audio renders and people traces
  run here, `nice`d while Tier-1 and Tier-2 jobs run (they share 4 cores with SwiftShader).
- **Tier 1: seeded random sample at test quality.** An unlit ID + depth + normal pass and one shaded frame per view, 960×540.
  `tools/dev/coverage_points.ts` (TO-BUILD) draws the sample from a seed equal to the first 8 hex digits of the commit hash (the
  agent does not choose it), stratified over the registry and spread over month × hour band × weather by a pairwise covering
  array. n ≥ 59 per area or generator class (T-A0; at least 8 per member in classes of ≤ 50 members; stratified so every
  10 × 10 km cell of a large class is hit within a rotation), n ≥ 150 in the transect. Up to 25 % more views may be chosen
  worst-first from Tier 0, reported apart and never counted in a pass rate. `tools/dev/coverage_report.ts` (TO-BUILD) refuses
  evidence whose view ids differ from the sampler's output for that seed.
- **Tier 2: judged sample at the full target.** Per session: 16 ultra views drawn at random from the Tier-1 set, 16 detail tiles at
  1440p, 3 motion clips, 4 conversation-distance clips, 60 s binaural audio for each Tier-2 view. Tier 2 finds what the detectors
  miss; it is not the statistic.
- **Canary invalidation.** After any change to a global dependency, 3 fixed canary views per area re-render at test quality. An
  area whose canaries move less than ΔSSIM 0.02 with no worse detector score keeps its Tier-1 evidence as "carried"; otherwise its
  sample re-queues. Carried evidence older than 4 sessions is STALE.
- **Session budget** (one lane; measured, not assumed: the instrument session measures t_load, t_test, t_id, t_high, t_ultra and
  the renderless throughput in bot-hours per core-hour, with the bots running, into `gates/budget.json`, TO-BUILD). Tier 1 needs
  Σ(n per stratum) ÷ 4 views a session to hold T-B3 (≈ 1,220 for ~80 unique strata and the transect). If the slot falls short,
  T-B3 reads FAIL and a BLOCKERS row logs ≥ 3 approaches (ID and depth at 480×270, grouped loads per day/hour/weather, shaded
  frames only where the ID pass shows a detector candidate); the rotation target is never raised.
- **Evidence retention:** stats JSON for every view; images for Tier-2 views, Tier-1 failures and canaries; 160×90 thumbnails for
  passing Tier-1 views; ≤ 25 MB per session in `REVIEWS/evidence/<pass>/` (the size test is TO-BUILD; D-243).

### 4.3 The world: the area registry, the envelope and the edge

`data/areas.json` is generated by `tools/dev/areas.ts` (TO-BUILD) from the terrain, the architecture and the settlement and plain
data, never from the nav grid. It covers the **walkable envelope**: every point the player's controller can physically reach
from the spawn (slope ≤ 42°, step-up, colliders on every terrain ring). **Unique areas** (each Terrace building and court, town
quarter, palace or garden zone, named site, village, river reach, and the transect) are judged each on its own, none over 1 km²
(T-A6x). **Generator classes** (plain sectors, far land) are judged as a class. Rows are scoped `area` (each unique area and each
class), `world`, `session` or `process`. `tests/areas.test.ts` (TO-BUILD) fails if the union covers < 99.5 % of the envelope
(T-A6) or the count or total shrinks without a DECISIONS entry citing a UD. **The world's edge is decided (D-240):** there are no
invisible walls; everything the controller can reach is in the registry and on the board, and land beyond the fields' 40.96 km
zone is built to the bar by the landscape generator as class areas, or made unreachable only by real terrain.

## 5. The status board

`COVERAGE.md` is **generated only** by `tools/dev/coverage_report.ts` from evidence files; `tests/coverage_board.test.ts`
(TO-BUILD) regenerates it and fails on any difference, so a PASS cannot be typed. Columns: the illusion-break rate first, then each
axis. **The board has a cell for every threshold id in `gates/thresholds.json`**; an id that is to-build, or has no evidence on the
current tree, reads **NOT-MEASURED**, which counts as FAIL; a superseded id reads SUPERSEDED. Every cell carries its evidence
commit, age and a **dependency hash** of the source files it depends on; a cell whose hash is out of date reads **STALE**, and
STALE counts as FAIL. Brief §15.7's "passed with logged exceptions" shows as **FAIL-EXCEPTION**, never PASS. The transect is PASSED
when every `area`-scoped row passes on its areas. The board replaces phase ticks as the measure of progress; PROGRESS.md leads with
its worst cells.

## 6. How the work proceeds

**Order within the standard** (this order wins over any list below):
1. **Stop the bleeding (first, in parallel with 2).** The hard breaks already diagnosed: the terrain fall-through (D-237); impostor
   work frames (D-229, merged); "indoors" drawn as indoors (D-244); every unflagged placeholder flagged (done in session 8 for the
   villages and Tol-e Ajori); no `Math.random` and per-call noise (done); a new seed per new game (done); the court coming and going
   **by default** (UD-10: done in rev 2.1, labelled C; its arrival still to be simulated, D-239); `tests/defaults.test.ts` pinning
   every decided default (done); the thresholds' statuses corrected to what their tools measure and their anti-proxies written
   (done: all to-build); TASKS.md's `[x]` removed (done); autosave and save on close (D-237); `lint:all` inside `npm run build`
   (done); voices from the population and a limiter (D-245).
2. **The cheapest honest instrument (time-boxed to one session; what is not built by its close reads NOT-MEASURED on the board
   and stays first in the next session):**
   - **speed first (UD-15, D-248):** a cached world (the generated town, terrain and population serialised to disk and loaded
     instead of rebuilt, so a page is ready in seconds: T-H4) and tiered tests (a fast tier while working, the heavy people and
     world suites once at the session gate, both through `tools/dev/cpu_slot.sh`);
   - the renderless mode first among the instruments, with its throughput (bot-hours per core-hour, with Tier-1 jobs running) written to
     `gates/budget.json`; if it cannot run at ≥ 10× real time on 2 cores, the headline measure moves to node Tier-0 people probes
     against the crowd feed and this plan says so;
   - the area registry;
   - Tier 0;
   - the walker bots (five policies, the prober included);
   - the Tier-1 sampler;
   - the generated board;
   - the anchor set (`REVIEWS/anchors/INDEX.md`) and `REVIEWS/escapes.md`;
   - `data/event_kinds.json`.

   Tier-2 judgement starts once the transect has 0 Tier-1 hard fails. Until then, T-J5 and T-R3 accept an agent render at the
   player's lens and quality, logged in `sessions/sNN.md`, and T-R0 reads NOT-MEASURED.
3. **The reference transect,** brought to PASS (every `area` row on its areas), every hour band, in clear weather, rain and dust,
   before techniques are rolled out: a village on the plain, the road through its fields and a canal crossing, one town quarter (a
   lane, a house interior by day and at night, a workshop yard, a hearth), the stair foot, the Grand Stair, the Gate, the Apadana
   and its courts.
4. **World-wide multipliers before area-by-area work,** proved in the transect then applied everywhere: per-person faces and
   bodies; animation and steering; voices and the audio engine everywhere; materials and contact-hardening shadows; night light
   and fire occlusion in the town and villages; house and village generators with per-instance variation.
5. **Then area by area, worst first by the board.** Every session ships at least one change a player would notice (T-R3) and at
   least three verified surprises (T-J5).

**The session loop (every session):**
1. Start: fetch the branch and its tags, and unshallow the clone (`git fetch --unshallow --tags` when shallow); read
   USER_DIRECTIONS and this plan; `npm ci` (installs the pre-commit guards); tsc, lints, `npm run guards`; resume stopped agents;
   start the renderless bots.
2. Measure: Tier 0; canaries if a global change landed; Tier 1 for the areas due (oldest evidence first, plus change-driven);
   then Tier 2.
3. Discover (§7).
4. Rank: the board's worst cells, the illusion-break log's worst areas, the inventory's biggest MISSING rows.
5. Work: ≤ 3 agents that render at once, each briefed from `handoff/agent_template.md` and `handoff/review_template.md`, the brief
   saved to `handoff/briefs/sNN/<agent>.md`, reserved D/Q/B numbers recorded in `handoff/reserved_numbers.md`, node previews first,
   ≤ 2 browser runs; world-wide fixes preferred.
6. Verify on the player's screen and speakers; regenerate the board; keep the evidence (§4.2).
7. Close: every worktree branch merged or abandoned with a DECISIONS or BLOCKERS row and its fate in the reserved-numbers table
   (T-R6); no cited D/Q/B number missing from its record; CLAUDE.md's descriptions of tools checked against the files on the branch;
   `sessions/sNN.md` written (breaks found, board delta, the visible change, surprises with evidence paths, the gap hunters' lists
   and estimate); this plan revised if anything learned changes it (§13); the handoff written; the tag `ratchet/sNN` pushed (where the environment refuses tag pushes, as in session 8, the closing commit
   is recorded in `sessions/sNN.md`).

**The programme** (from the four audits and two critiques; the board re-orders it within the order above):
- **Life and identity:** per-person faces and bodies; a names onomasticon (attested first, D-236) and histories that surface
  (T-E3v); real named people placed where and when attested (T-I5); families that behave as families (T-E4); shelter and indoor
  occupancy; steering, no overlap, no treadmill; addressability and speech for everyone (D-241); the player remembered (T-K2); the
  court's arrival simulated and a new game starting shortly before it (D-239); comings and goings, messengers and news (T-F5);
  emergent incidents (T-F4); a child's day; social relations that show; animals' lives (herds at every distance, pens at night,
  lambing, dogs that belong to someone, storks and swallows in season, animals solid).
- **Systems:** conservation of goods and visible issuers (T-F2); every system's stages placed (T-F1); cause → effect on screen
  (T-F3d, T-F3g, T-F3s2, T-F3r, T-F3j); construction progress over weeks beyond Hall 100.
- **The world complete:** the town's houses (D-234) and villages built for real and varied (T-E5); interiors; the missing places
  (quarries with unfinished capitals, brick yards, lime kilns, tanneries, dye works, the mill, stockyard, threshing floors, fords
  and bridges); the pre-modern landscape; the land to the world's edge (D-240); real objects in their moment (T-I7).
- **Weather and its aftermath; sky:** overcast, storm, dust, mist, lightning bolts, snow by altitude; drains, puddles, mud that
  dries over days, a storm flattening an awning, the Pulvar in spate, cloth in wind, heat rest at noon in July; the July 467
  partial lunar eclipse, meteors, rainbows, frost, heat shimmer, dust devils; night truth (T-B2m, T-B2f, T-B2s, T-B2l), people
  sleeping on roofs in summer, dogs and jackals heard.
- **Festivals and rites,** rendered and heard at full scale: crowds, music with performers, food, weddings, funerals; ritual as
  action, fire, offering and wordless chant (CLAUDE.md §12).
- **Photoreal everywhere:** materials, reliefs (scans when the user supplies them), trees and plants with variety, soft
  contact-hardening shadows, the §8.1 calibration completed, the tone-curve question (B40), faces and bodies up close (T-C1f); the
  analogue photographs each stratum needs (T-A2r), sought from CC-licensed sources first, then as an easy list for the user.
- **Hour 1 and delivery:** title, loading and click-to-start judged as part of the time capsule; download and first-frame budgets
  on real hardware (T-K7, T-K7c); saves in IndexedDB that survive updates (T-H3s, T-H3v); one playable build per session at a stable
  URL, with three places worth walking to now (T-K5s); a fall off the Terrace handled within restraint (D-247).
- **Ethics and representation (brief §12):** kurtaš, children and punishment as the evidence shows them; women's dress tiered;
  the living religion shown only as attested or as wordless action; delegations' peoples without caricature; attested people only
  in their attested lifetimes; reviewed every audit round (T-R5).
- **Runs:** the simulation in a worker after route search is cheap (B53, B54); memory and load budgets; streaming and compression;
  everyone near the player solid; the GPU cost model (T-K6); the bench with the simulation (T-K9) and the WebGL2 fallback (T-K9w).
- **Long horizons:** the perpetual 467 (D-246); the calendar's yearly streams (T-J4d); catch-up without freezing (T-J3e); the rare
  tail (T-J2).

**Instruments** (every tool the thresholds name; "exists" still means it must write evidence before a row leaves to-build):

| tool | state | thresholds |
|---|---|---|
| `.github/workflows/guards.yml` | exists (must still write evidence) | T-R7 |
| `MASTER_PLAN.md` | exists (must still write evidence) | T-F3x |
| `NEEDS_FROM_ME.md` | exists (must still write evidence) | T-R9 |
| `PROGRESS.md` | exists (must still write evidence) | T-K5, T-K5s |
| `REVIEWS/` | exists (must still write evidence) | T-R4, T-R5 |
| `REVIEWS/anchors/INDEX.md` | **TO-BUILD** | T-R1 |
| `REVIEWS/escapes.md` | **TO-BUILD** | T-R0 |
| `WORLD_INVENTORY.md` | **TO-BUILD** | T-J6, T-J7 |
| `gates/scope_phrases.json` | exists (must still write evidence) | T-R8 |
| `handoff/reserved_numbers.md` | exists (must still write evidence) | T-R6 |
| `handoff/review_template.md` | exists (must still write evidence) | T-A4, T-A4cg, T-G4, T-I1, T-A4m |
| `references/INDEX.md` | exists (must still write evidence) | T-A2r |
| `sessions/` | exists (must still write evidence) | T-R2, T-R3, T-J5 |
| `tests/arch.test.ts` | exists (must still write evidence) | T-I6, T-I6o |
| `tests/defaults.test.ts` | exists (must still write evidence) | T-K3, T-K10 |
| `tests/e2e/bench.spec.ts` | exists (must still write evidence) | T-K9, T-K9w |
| `tests/e2e/coverage.spec.ts` | exists (must still write evidence) | T-C1, T-C1t, T-C1u, T-C1c, T-C2, T-C2f, T-C1f |
| `tests/e2e/persistence.spec.ts` | exists (must still write evidence) | T-H3, T-H3r, T-J3c, T-H3s, T-H3v, T-J3e |
| `tests/e2e/settings.spec.ts` | **TO-BUILD** | T-K3a, T-K3f |
| `tests/language.test.ts` | exists (must still write evidence) | T-I1f, T-I2, T-I4, T-K3c |
| `tests/player_independence.test.ts` | **TO-BUILD** | T-F6, T-F6x, T-I4c |
| `tests/sky.test.ts` | exists (must still write evidence) | T-I6s, T-I6t, T-I6p |
| `tools/dev/areas.ts` | **TO-BUILD** | T-A6, T-A6x |
| `tools/dev/audio_render.ts` | exists (must still write evidence) | T-G1, T-G1l, T-G2, T-G2f, T-G2b, T-G3, T-G3e, T-G5, T-G1t, T-G1n, T-G1v, T-G1m, T-G5d, T-G2m, T-G6, T-G6o |
| `tools/dev/audit_c/scene_probe.ts` | exists (must still write evidence) | T-E6e, T-E6i |
| `tools/dev/audit_c/treadmill.ts` | exists (must still write evidence) | T-D2 |
| `tools/dev/audit_c/variety_probe.ts` | exists (must still write evidence) | T-E6 |
| `tools/dev/audit_d/ring_probe.mts` | exists (must still write evidence) | T-H1 |
| `tools/dev/coverage_points.ts` | exists (must still write evidence) | T-A0, T-A0t, T-B1m, T-B1h, T-B1w, T-B1p |
| `tools/dev/coverage_report.ts` | exists (must still write evidence) | T-A1, T-A1m, T-A2f, T-A2s, T-A3c, T-A3k, T-A3n, T-B2m, T-B2f, T-B3, T-B3a, T-J3, T-A2s2, T-A2k, T-A2f2, T-A3c2, T-B2s, T-B2l |
| `tools/dev/face_census.ts` | **TO-BUILD** | T-E1, T-E1l, T-E1d |
| `tools/dev/gpu_cost.ts` | **TO-BUILD** | T-K6, T-K7c, T-K8 |
| `tools/dev/load_probe.mjs` | exists (must still write evidence) | T-H4, T-K7 |
| `tools/dev/long_soak.mjs` | **TO-BUILD** | T-K4, T-K4a, T-K8h |
| `tools/dev/people_trace.ts` | exists (must still write evidence) | T-D1, T-D1w, T-D2s, T-D2g, T-D2j, T-D3, T-D3s, T-D4, T-D5, T-E4, T-D6 |
| `tools/dev/person_census.ts` | exists (must still write evidence) | T-E2, T-E2h, T-E3, T-E3r, T-E3v, T-I4n, T-I5, T-I7 |
| `tools/dev/photo_pairs.ts` | **TO-BUILD** | T-A5, T-A5d |
| `tools/dev/repeat_census.ts` | **TO-BUILD** | T-E5 |
| `tools/dev/sim_cost.ts` | exists (must still write evidence) | T-H2, T-H2p, T-H2x |
| `tools/dev/systems_probe.ts` | **TO-BUILD** | T-F1, T-F2, T-F3d, T-F3g, T-F3s, T-F4, T-F5, T-J2, T-F3s2, T-F3r, T-F3j |
| `tools/dev/walkers.ts` | exists (must still write evidence) | T-H0, T-H0w, T-H0s, T-H1r, T-H1s, T-J1a, T-J1b, T-K1, T-K1a, T-K1r, T-K2, T-E6w, T-H0p, T-K1a2 |
| `tools/lint_activity.ts` | exists (must still write evidence) | T-F7a |
| `tools/lint_chrono.ts` | exists (must still write evidence) | T-I3 |
| `tools/soak.ts` | exists (must still write evidence) | T-E7, T-F2m, T-J4, T-F7, T-J4d, T-F8 |

## 7. Discovery and completeness (UD-11, UD-14)

Every session:
1. `WORLD_INVENTORY.md` (TO-BUILD) grows: its rows are **seeded from outside taxonomies** (the HRAF Outline of Cultural Materials
   categories, the Persepolis Fortification and Treasury commodity and occupation lists, brief §5.5 line by line), then walked in
   thought as a person of 467 would live each area. Each row: PRESENT / MISSING / ABSENT-BY-EVIDENCE, tier, place.
2. **Two independent gap hunters** (fresh agents, not the builders) list gaps separately; the Lincoln–Petersen estimate of gaps
   still unfound must be ≤ 5 % of the inventory (T-J6).
3. MISSING rows are filled by the gap rule (T-J7); only what the evidence says was absent stays out.
4. **At least three surprises are built and verified on screen** (T-J5): unasked, witnessable, arising from the world's own
   state and never spawned near the player (T-F6). A listed surprise counts for nothing.

## 8. Governance and honesty

- **Gates** are the thresholds per area on the generated board; the brief's phase gates are read in its own scope words
  ("every walkable area", "objects", "as scenes", "whole Terrace").
- **The guards run themselves.** `npm run build` begins with `npm run guards` (the ratchet, scope and defaults tests). `npm ci`
  installs `.githooks/pre-commit` (through `"prepare": "git config core.hooksPath .githooks"`), which runs the ratchet and scope
  tests. A GitHub Actions workflow (`.github/workflows/guards.yml`) runs them with full history on every push. Session start
  unshallows the clone. Every audit round diffs the guard files (`tests/gates_ratchet.test.ts`, `tests/scope_ledger.test.ts`,
  `vitest.config.ts`, `package.json`, `gates/`, `USER_DIRECTIONS.md`, `handoff/*_template.md`, `.githooks/`, `.github/`) since the
  last audit and reports every weakening as a critical finding (T-R7). The honest limit: a session writes the ledger, so the audit
  also checks every UD added since the last audit against the user's own messages.
- **Independent reviewers are calibrated and blind.** Every rubric session first scores the **anchor set** (T-R1). Judged frames
  are shuffled with the anchors and with renders from before the latest fixes, unlabelled. Briefs come from
  `handoff/review_template.md` and are saved. Reviewers rotate. They use every reference paired to the scene
  (`handoff/review_briefs.md`, UD-05) and say which. The rubric gains a **life** category and a **listening** rubric, and Tier-2
  scenes are judged in motion with sound.
- **The paired photo test:** each session the Now view is rendered from the solved cameras of the user's site photographs (#24
  first) under their sun; a blind reviewer picks the render out of each pair (T-A5, T-A5d).
- **Every escape becomes a detector:** logged in `REVIEWS/escapes.md` and closed only by a new or tightened detector (T-R0).
- **Audits:** a full independent audit round, a representation review (T-R5) and a critique of this plan every third session at
  the latest (T-R2); findings enter the board and §13.
- **Records:** a claim needs fresh evidence on the current tree. TASKS.md lists work only; "verified" lives on the board. Every
  report leads with what is broken or placeholder (brief §3.7).
- **Waived tests:** a test waived as "timing under load" needs an idle re-run record (load average < 1) newer than the waiver in
  `bench-reports/`, or it counts as failing.
- **Done is not judged by the builder:** "met" for any user direction is judged by the independent audit round, with evidence.

## 9. Constraints and how they are handled

**Speed (UD-15, D-248).** The build is bound by one software render lane (no GPU: a high frame 2.5–4 min, a page load 35 s idle
to 4 min busy) and four shared cores. In this order: move every check that does not need pixels off the lane (the renderless
mode: bots, people traces, audio, soaks); render cheaply where pixels are needed (ID and depth passes at 480×270 for detection,
test quality for Tier 1, full quality only for the Tier-2 judged views); cache the generated world so page loads take seconds;
tier the tests; heavy node work only through `tools/dev/cpu_slot.sh`, and no new work while load is above 6 or the render queue
holds a job that another agent needs. No sibling cloud sessions or other extra paid compute without a user direction (UD-15,
T-R10). The user may optionally run one command on a machine with a GPU; never waited on.

No GPU (SwiftShader, one render lane): detection without the lane (Tier 0, renderless), statistics on seeded Tier-1 samples,
judgement on Tier 2, canaries for change (§4.2); views grouped per page load; ≤ 3 rendering agents; the render queue uses `flock`,
which a killed process releases, so no stale lock can block it. No texture or scan libraries (proxy): procedural materials
calibrated to the user's photographs; scans optional, never waited on. Scholarly hosts blocked: search summaries, tiered and
flagged, upgraded when sources arrive. None of these lowers a threshold (§4.1); where one cannot be met: measure, try ≥ 3
approaches, ship the most faithful, log it in BLOCKERS (brief §3.5), and the board shows FAIL until it is met.

## 10. Definition of done

Every threshold id on the generated board PASSES on the current tree (no NOT-MEASURED, STALE or FAIL-EXCEPTION cell, superseded ids
excepted); the illusion-break log holds T-H0 world-wide; the calibrated rubric and listening rubric hold on Tier 2; the soak and the
on-screen shadow review pass on ≥ 3 seeds including a fresh one; WORLD_INVENTORY's estimate of unfound gaps is ≤ 5 %; the
independent audit round finds every user direction met; a playable build is published; FINAL_REPORT.md leads with what is still
short.

## 11. Decisions this plan rests on

D-233 (every inch), D-236 (court by default; names attested first; histories; never the same twice; a new seed per game), D-238
(comfort defaults), D-239 (a new game begins shortly before the court's arrival), D-240 (the world's edge), D-241 (talk's depth in
dead languages), D-242 (weather sampling), D-243 (evidence retention), D-246 (the perpetual 467), D-247 (a fall off the Terrace).
In flight: D-234, D-235, D-237, D-244, D-245 (`handoff/reserved_numbers.md`).

## 12. Trace of the user's directions

Every UD-nn must appear here; every "measured by" cell names at least one threshold of its own direction (the row's `ud`), and
otherwise only threshold ids or existing files, and never loses a reference (`tests/scope_ledger.test.ts`).

| UD | direction (short) | where in this plan | measured by |
|---|---|---|---|
| UD-01 | the brief: most faithful, walkable, living, photoreal; the time capsule | §1, §3, all axes | T-H0, T-A4, T-I2, T-A4m, T-I6 |
| UD-02 | fill the gaps to the best of your educated ability | §1, §7, axis J | T-J6, T-J7 |
| UD-03 | full steam ahead (autonomous) | §6 order and session loop, §8 audits | T-R2, T-R3, T-R6 |
| UD-04 | the working rules are permanent across sessions | §8; CLAUDE.md | tests/scope_ledger.test.ts, tests/gates_ratchet.test.ts, T-R8 |
| UD-05 | reviewers use the supplied references and photographs | §8 | T-A5, T-R1, T-A5d, T-A2r |
| UD-06 | every inch, nowhere breaks the illusion | §1, §3, axes A–C, H, §4.3 | T-H0, T-A0, T-A6, T-H0p |
| UD-07 | people with lives, many systems, a sprawling simulation/sandbox; master plan, critique, no need to intervene | §1, axes D, F, K; §6; §13 | T-D2s, T-F1, T-K1, T-R2, T-D6 |
| UD-08 | nothing fake or copy-pasted; everyone a home, life, family, job, name, history | axes D, E | T-E1, T-E2, T-E3, T-E5, T-E1d, T-C1f |
| UD-09 | coming and going, the king, events in real time, randomness, never repetitive, seeds | axes E, F, J | T-E6, T-E7, T-F5, T-J4, T-J4d, T-F6x |
| UD-10 | the court comes and goes by default (C) | §6 order step 1, programme (D-236, D-239) | T-F3d, tools/soak.ts, T-F8, T-K10 |
| UD-11 | go above and beyond: surprises, what the user has not thought of | §7, axes F, J | T-J1a, T-J5, T-F6 |
| UD-12 | preserve this scope; update the master plan when needed | header, §4.1, §8, §13, this table | tests/scope_ledger.test.ts, tests/gates_ratchet.test.ts, T-R7 |
| UD-13 | photos: easy list, no notes needed | §9 | NEEDS_FROM_ME.md, T-R9 |
| UD-14 | extrapolate from knowledge of the period; fill every gap | §1, §7, axis J | T-J6, T-I3, T-I5, T-I7 |
| UD-15 | speed: no sibling sessions; renderless mode, cached world, cheaper renders, tiered tests | §6 order step 2, §9 | T-R10, T-H4 |

## 13. Revision log

| rev | date (session) | change | why |
|---|---|---|---|
| 1 | 2026-09-26 (s8) | First version | UD-06 … UD-14; the four audits |
| 1.1 | 2026-09-26 (s8) | Audit D folded in (fall-through, walk coverage, sound, seeds, autosave, bench, worker) | audit D |
| 2 | 2026-09-26 (s8) | The first critique's ten changes: the illusion-break log as headline (§3); locked thresholds that only tighten (§4.1, `gates/thresholds.json`, `tests/gates_ratchet.test.ts`); the sampling architecture and budget (§4.2); the area registry and the world's edge (§4.3); the reorder (stop the bleeding, a one-session instrument, a village-to-Apadana transect, multipliers first, a visible change every session); calibrated blind judges and detector escapes (§8); identity, families and perceptual repetition (E); systems' depth, conservation, emergence and player independence (F); long horizons (J); the player's experience (new axis K); process thresholds (R); the generated board with STALE = FAIL (§5); TO-BUILD marked; the trace measured by threshold ids; section order fixed; DRAFT cleared | REVIEWS/master_plan_critique.md; UD-07, UD-12 |
| 2.1 | 2026-09-26 (s8) | The second critique: guards fail closed, check every version and `ratchet/*` tags, descend from the baseline, lock sample/scope/tool, derive status from evidence, accept a loosening only when the user's own words name it, and take errata for thresholds wrong in principle (9 superseded, `gates/errata/`); the scope test locks direction text, trace references, scope phrases, TO-BUILD tools, cited record numbers, template clauses and saved briefs; the guards run in the pre-commit hook, `npm run build` and GitHub Actions; every id on the board, NOT-MEASURED = FAIL, rows scoped (area, world, session, process); corrected numbers (image statistics against photographs, the photo test's final standard, night lower bounds, loudness bands, defined metrics for faces and yearly sameness, the perpetual 467); 64 new rows (close-up faces, the §1.1 moments, the brief's own numeric gates, saves, cross-engine determinism, download and compile budgets, GPU memory, the bench and WebGL2, ×600, acoustics and music, the corpus rule, the translation layer, representation, attested people in their lifetimes, real objects, flashes and captions, the prober, a threshold for every direction); every status reset to to-build; anti-proxies for all; the court by default; defaults pinned; TASKS ticks removed; step 2 and its deadlock fixed; session close hygiene | REVIEWS/master_plan_critique_rev2.md; UD-03, UD-10, UD-12 |
| 2.2 | 2026-09-26 (s8) | The speed plan: renderless mode, a cached world, cheaper renders, tiered tests first in step 2; no extra paid compute without a user direction (T-R10) | UD-15 |
