# MASTER PLAN — how PĀRSA becomes a time machine

**Status:** governing document (rev 1 DRAFT: audit D and the independent critique pending). Read `USER_DIRECTIONS.md` (the user's own words, append-only) and this plan at the start of every
session, before PROGRESS, TASKS or HANDOFF. Where an older task list, handoff or decision conflicts with this plan, this plan wins;
where this plan conflicts with the user's directions, the directions win and this plan is corrected. The plan may grow; it may
not shrink without a user direction (§11, revision log). `tests/scope_ledger.test.ts` fails if a UD-nn entry is not traced here.

---

## 1. The goal, in one paragraph (UD-01, UD-06 … UD-14)

Stepping into PĀRSA must feel like stepping through a door into Persepolis in 467 BCE: **nowhere the player walks, at any hour or
season, breaks the illusion** (UD-06). Every place is built, lit and weathered as a real place is. **Every person is someone** —
a name not shared by half the town, a home, a family, a job, a history, a day that is theirs and not a loop (UD-08). **The world
runs by itself in real time** — people arrive and leave, the court comes and goes, caravans, delegations, festivals, quarrels,
weather, births and deaths, seeded but never the same twice (UD-09, UD-10). **Many systems interlock and their causes are
visible** to a walker (UD-07). **Nothing is copy-pasted** (UD-08). **Every gap in the evidence is filled** with the most probable
reconstruction from knowledge of the period and its neighbours, labelled as such; only what the evidence says was absent stays
out (UD-02, UD-14). **The world surprises** — it holds things the user never asked for and would not think to (UD-11). All of it
stays faithful: sourced, tiered, visible in F3, no anachronism (the brief's binding rules §3).

## 2. Why earlier sessions missed (the lessons this plan exists to prevent)

Four independent audits (session 8: `REVIEWS/audit_A_intent_process.md`, `audit_B_world_photoreal.md`, `audit_C_people_life.md`,
`audit_D_engine_sound_verification.md`) found that the chosen-views miss was one instance of a general failure:

| Anti-pattern | What happened | Rule now |
|---|---|---|
| **Letter over intent** | Gates were met as written (a rubric on camera-rig stills, a shadow review of text timelines) while the experience failed | Every metric states the intent it stands for AND how it could pass while the intent fails (§4) |
| **A sample stood for the whole** | ~40 chosen views (6 % of the Terrace's walkable ground within 25 m), 20 people × 1 day, 12 days mostly in April–May, 1 seed | Coverage over place × time × state × people × seeds (§4) |
| **Node instead of screen** | Systems "verified" in node were never seen or heard: people standing in rain the plan sheltered, frozen impostors, treadmill walkers, a soundscape never listened to | A requirement is VERIFIED only on the player's screen/speakers, or by a test proven to fail when the screen fails |
| **The judged frame was not the player's** | 40–46° lens at 960×540, `high` not `ultra`, nobody within 2.5 m, stills only | Judge at the player's lens and quality, in motion, with sound (§4 C) |
| **Breadth before depth** | Phases 4–8 built on a slice that never passed | A reference area proves each standard before it is rolled out (§6) |
| **Evidence evaporates, records overclaim** | shots/ and bench JSON gitignored; `[x]` on unverified items; stale "resolved" | Evidence kept in git (compressed); a claim without fresh evidence is not a claim (§8) |
| **Handoffs carry tasks, not the goal** | Each session inherited a to-do list | This plan and the ledger are read first; every task traces to a UD and an axis |
| **No one looked for the unasked** | Big gaps (209 names, no histories, unflagged boxes, interiors unbuilt) surfaced only when the user pushed | A discovery step and a completeness inventory every session (§7) |

## 3. The standard: the Walker Test

The project is done when a person can walk anywhere reachable, at any time of the year, for as long as they like, and find nothing
fake, repeated, dead, silent where it should speak, or absent that a real 467 Persepolis would hold. The Walker Test is measured on
ten axes; each has a metric, a tool, a threshold, a sample design and an anti-proxy note. Thresholds are the gate; they are never
lowered to pass (brief §3.7, CLAUDE.md).

## 4. The ten axes

**A. Place coverage (UD-06).** Every walkable area of the Terrace (every court, hall, room, stair, roof), the town (every lane,
court, room the player can enter), the approach, the plain within reach (roads, fields, canals, rivers, villages), Naqsh-e Rustam,
Kuh-e Rahmat's slopes, and the edge of built content. *Metric:* per area, the share of viewpoints passing the photoreal bar: no
placeholder object (flagged OR measured: detail per steradian below threshold at its distance), no missing/black/blown/flat regions,
rubric ≥ 4 on a stratified sample. *Tool:* coverage harness (`tests/e2e/coverage.spec.ts`, `tools/dev/coverage_points.ts`,
`tools/dev/coverage_report.ts`). *Anti-proxy:* flags lie (the 3,983 unflagged village boxes): measure detail directly; sample
inside and just outside the built edge.

**B. Time coverage.** Every season (all 12 months), every hour band (pre-dawn, dawn, morning, noon, afternoon, dusk, night with and
without moon), every weather the climate produces (clear, cloud, overcast, rain, storm, snow, dust, mist, lightning), fire-lit
nights. *Metric:* each area's coverage (A) holds across a stratified time × weather sample. *Anti-proxy:* one spring day per place
is not coverage.

**C. The player's view.** Judged at the player's lens (70°), at `ultra`, with 1440p detail crops, in motion (short clips: shimmer,
ghosting, pop, sliding), with nobody hidden near the lens. *Anti-proxy:* a flattering lens at 960×540 hides what the player sees.

**D. Life on screen (UD-07, UD-08, UD-09).** What a walker sees and hears among people and animals matches the simulation and reads
as life: people visibly do what their plan says (with tools and loads), shelter from rain, go indoors, sleep somewhere, are ill
somewhere; nobody frozen at distance, walking in place, sliding, clipping through another, dragged; walkers steer; animals at every
distance; crowds of the right density. *Metrics:* on-screen shadow review (follow people in the browser and compare with the
sim), walker probes (`tools/dev/audit_c/*`: treadmill, carry, rain, scene), frozen/treadmill/overlap counts per area, indoor
occupancy by hour. *Anti-proxy:* a text timeline can be perfect while the screen shows a frozen stand-in.

**E. Identity and variety — nothing copy-pasted (UD-08, UD-09).** Every person: a name (no name shared by more people than a real
town of that size would share), a home, a household and kin, a job, a HISTORY, a day of their own; faces, bodies, garments and
possessions varied; no visible cloned assets (trees, houses, reliefs, props, textures); the same place at the same hour on
different days must differ. *Metrics:* `tools/dev/person_census.ts` (names, homes, kin, jobs, histories), a look-uniqueness census
(distinct body/face/garment combinations per 100 people in view), an asset-repetition census (distinct geometries per instance in
view), scene variety across days (`tools/dev/audit_c/variety_probe.ts`, on screen), all on ≥ 3 seeds. *Anti-proxy:* per-person day
variety can pass while every face in a crowd is one of four.

**F. Systems visible and interlocking (UD-07, UD-09).** Every simulated system (households, rations and stores, work groups,
construction, the Treasury and the scribes, the court, delegations and petitioners, religion, festivals, weddings, funerals,
markets/exchange, herding, farming, water, weather, animals, the post, travellers) has witnessable manifestations a walker can find
in the places it lives, and its causes show (a delegation arriving means crowded roads and doubled guards; short rations change the
queue; rain empties the courts). *Metric:* a system-sighting table per area and season (from the coverage harness and walk bots);
cause→effect probes. *Anti-proxy:* a chronicle entry is not a sighting.

**G. The senses.** The soundscape, voices, murmur, music, animals, weather and work sounds, rendered and listened to per area and
time; no audible loops or repeated lines; every visible person who speaks is heard in their language. *Tools:* offline audio
renders per coverage cell, loudness/layer/repetition metrics, a listening rubric by a reviewer. *Anti-proxy:* "the audio context
is running" is not listening.

**H. It runs and holds together.** Walkable everywhere (walk bots over every area, in the browser, with the population drawn: no
falls, no invisible walls, no getting stuck); no pop-in of objects or people inside 50 m; save/load and persistence in the browser;
the simulation off the main thread; memory and load time measured; frame rate on real hardware (REAL_HARDWARE_TODO, the user's
optional run). *Anti-proxy:* triangle counts are not frame rates.

**I. Faithful.** Sourced and tiered in data and F3; no anachronism (the blocklist and lints); conflicts logged; the user's
directions superseding the brief recorded (D-236). Existing lints and reviews, re-run on the current tree.

**J. Complete and surprising (UD-11, UD-14).** `WORLD_INVENTORY.md`: everything a real 467 royal city and its countryside held
(buildings and parts, objects, trades and their traces, plants and animals through the year, institutions, movement, wear and time,
sounds, the unscheduled), each entry PRESENT / MISSING / ABSENT-BY-EVIDENCE with its tier and place. *Metric:* no MISSING entry at
tier ≥ C where a probable reconstruction exists; distinct witnessable event kinds per km² per hour (the discovery metric).

## 5. The status board

`COVERAGE.md` (generated by `tools/dev/coverage_report.ts` and the censuses) shows, per area × axis, PASS / FAIL / UNMEASURED with
the date and commit of the evidence. It replaces phase ticks as the measure of progress. PROGRESS.md leads with the worst cells.

## 6. How the work proceeds

**Order within the standard:** measurement first (so every fix is aimed and checked), then a **reference area** brought to PASS on
every axis (the vertical slice: the approach, the Grand Stair, the Gate, the Apadana and its courts, with their people), proving
each technique before it is rolled out; then area by area, worst first by the board, while world-wide systems (identity, looks,
life on screen, sound) are fixed once for everywhere.

**The session loop (every session):**
1. Start: fetch the branch; read USER_DIRECTIONS and this plan; `npm ci`; tsc, lints; the censuses; resume stopped agents.
2. Measure: the coverage harness on what changed since the last run, plus a rotating slice of the rest; audio renders; walk bots.
3. Discover (§7): extend WORLD_INVENTORY and the surprises list.
4. Rank: the board's worst cells and the inventory's biggest MISSING entries.
5. Work: ≤ 3 agents that render at once, each briefed from USER_DIRECTIONS and this plan (not from memory), each with reserved
   D/Q/B numbers, node previews first, ≤ 2 browser runs; world-wide fixes preferred over per-view fixes.
6. Verify: on screen at the player's view; update the board; keep the evidence (§8).
7. Close: revise this plan if anything learned changes it (§11), update the ledger's trace, write the handoff.

**The programme (from the four audits; the board re-orders it):**
- **P0 Measurement and records (first):** the coverage harness with axes A–C (player lens, ultra samples, motion clips, time and
  weather strata, flag-independent detail); walker probes and the on-screen shadow review (D); the identity, look and asset
  censuses and the scene-variety gate on ≥ 3 seeds (E); system sightings (F); audio renders and a listening rubric (G); walk bots
  over every area in the browser with an object pop-in probe (H); WORLD_INVENTORY (J); evidence retention; the scope-ledger test;
  CLAUDE.md §13 restated in the brief's scope words.
- **P1 Life on screen and identity:** merge D-229 (impostor work poses); shelter and indoor occupancy (rain, night, sickness,
  sleep); steering and no overlaps, no treadmill, no dragging; addressability and speech beyond the 135 Terrace agents (everyone the
  player meets can be addressed and heard); gesture with speech; a names onomasticon (attested first, reconstructed from attested
  elements after: D-236); per-person histories; real named people from the evidence placed where attested; look variety (bodies,
  faces, garments, possessions); visible cause and effect (stores, rations issued by someone, delegations' consequences,
  construction everywhere it happens); the court arriving and leaving by default (D-236) with its gate passing (the court soak);
  comings and goings as witnessable events; seeded randomness; a new seed per game; animals at every distance.
- **P2 The world complete:** the town's houses (D-234) and villages built for real; interiors (the Harem and Hadish apartments,
  storerooms, the garrison, the Treasury, furnished palaces in the default world); the missing places (quarries with their
  unfinished capitals, brick yards, lime kilns, tanneries, dye works, the mill, stockyard, threshing floors, fords and bridges);
  the pre-modern landscape (rivers, the ancient ground level, the plain from the 1930s aerial); weather in full (overcast, storm,
  dust, mist, lightning bolts, running drains, puddles, mud that dries, snow by altitude, cloth in wind); sky events (the July 467
  partial lunar eclipse, meteors, rainbows, frost, heat shimmer, dust devils); night: fire light occluded in the town, lamps.
- **P3 Photoreal everywhere:** materials (stone, plaster, earth, wood, cloth, metal), reliefs (scans when the user supplies them;
  until then carved geometry), trees and plants with variety, soft contact-hardening shadows, the calibration completed (§8.1: a
  column base, stair flight, doorway), the tone-curve question (B40), faces and bodies up close.
- **P4 Runs:** the simulation in a worker; memory and load time; streaming; the real-GPU bench (the user's optional run).

## 7. Discovery and completeness (UD-11, UD-14)

Every session: (1) extend `WORLD_INVENTORY.md` by walking one area in thought as a person of 467 would live it — what they would
use, hear, smell-by-proxy (smoke, dung, bread), step around, trade, fear, celebrate — and marking what the world lacks; (2) add at
least ten witnessable surprises to the backlog that no direction asked for (a dog following its owner, a lost sandal, swallows in
the capitals, a quarrel at a canal, mud drying after rain, a child following the stranger); (3) fill the MISSING entries by the gap
rule (most probable reconstruction, tier C, reasoning in F3); (4) keep out only what the evidence says was absent.

## 8. Governance and honesty

- Gates are the axes' thresholds per area; phase gates of the brief are read in its own scope words ("every walkable area",
  "objects", "as scenes", "whole Terrace").
- Independent reviewers (fresh agents) judge the player's view against the site photographs and references
  (`handoff/review_briefs.md`), state which they used, and hunt for proxy failures.
- Evidence is kept: per pass, compressed renders and stats in `REVIEWS/evidence/<pass>/` (JPEG ~60 KB), audio clips as short
  OGGs, census outputs in `bench-reports/*.txt` (committed).
- A claim needs fresh evidence on the current tree; `[x]` means verified on screen at the axis's scope; "resolved" names its scope.
- Every report leads with what is broken or placeholder (brief §3.7).

## 9. Constraints and how they are handled

No GPU (SwiftShader, ~3 min per high frame): detection at test quality over the full coverage, judgement at high/ultra on a sample;
views grouped per page load; ≤ 3 rendering agents. No texture or scan libraries (proxy): procedural materials calibrated to the
user's photographs; the user may supply scans (NEEDS #10) — optional, never waited on. Scholarly hosts blocked: search summaries,
tiered and flagged, upgraded when sources arrive. None of these lowers a gate; where a threshold cannot be met, measure, try ≥ 3
approaches, ship the most faithful, log it in BLOCKERS (brief §3.5).

## 10. Definition of done

Every area PASSES every axis on the board, on the current tree, with kept evidence; the rubric (≥ 4 in every category) holds on
coverage at the player's view; the soak and the on-screen shadow review pass on ≥ 3 seeds; WORLD_INVENTORY has no fillable MISSING
entry; the user's directions are all traced and met; FINAL_REPORT.md leads with what is still short.

## 12. Trace of the user's directions (every UD-nn must appear here: tests/scope_ledger.test.ts)

| UD | direction (short) | where in this plan | measured by |
|---|---|---|---|
| UD-01 | the brief: most faithful, walkable, living, photoreal; the time capsule | §1, §3, all axes | the board (§5) |
| UD-02 | fill the gaps to the best of your educated ability | §1, §7, axis J | WORLD_INVENTORY |
| UD-03 | full steam ahead (autonomous) | §6 session loop | — |
| UD-04 | the working rules are permanent across sessions | §6, §8; CLAUDE.md | this plan read first |
| UD-05 | reviewers use the supplied references and photographs | §8 | review briefs |
| UD-06 | every inch, nowhere breaks the illusion | §1, axes A–C | coverage per area |
| UD-07 | people with lives, many systems, a sprawling simulation/sandbox; master plan, critique, no need to intervene | §1, axes D, F; §6 P1; §11 | life on screen, system sightings |
| UD-08 | nothing fake or copy-pasted; everyone a home, life, family, job, name, history | axes D, E; §6 P1 | person, look and asset censuses |
| UD-09 | coming and going, the king, events in real time, randomness, never repetitive, seeds | axes E, F; §6 P1 | scene variety, system sightings, ≥ 3 seeds |
| UD-10 | the court comes and goes by default (C) | §6 P1 (D-236) | court soak; sightings |
| UD-11 | go above and beyond: surprises, what the user has not thought of | §7, axis J | discovery metric |
| UD-12 | preserve this scope; update the master plan when needed | header, §11, this table | tests/scope_ledger.test.ts |
| UD-13 | photos: easy list, no notes needed | §9 | NEEDS_FROM_ME |
| UD-14 | extrapolate from knowledge of the period; fill every gap | §1, §7, axis J | WORLD_INVENTORY |

## 11. Revision log

| rev | date (session) | change | why |
|---|---|---|---|
| 1 | 2026-09-26 (s8) | First version | UD-06 … UD-14; the four audits |
