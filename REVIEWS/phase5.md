# Phase 5 independent review (people and animals at scale)

**VERDICT: FAIL.** One CRITICAL finding is open.

The gate needs four things at once: "Full evidence-based population simulated; rendered floors met within budget; no pop-in; soak test (§13.11) passes". No single build configuration of the current tree meets all four:
- **Court absent (the default).** The soak passes and the shadow review passed. The rendered floor "≥ 300 visible in the busiest scenes" is **not** met at ground level. It is met only from the hillside view, which is over the triangle budget (B11, B13).
- **Court resident (the "seasonal pattern" setting).** This is the only configuration in which the floor is met on the Terrace. On HEAD it **fails the soak's plansWellFormed gate** (my 30-day court run below; DECISIONS ll. 4988–4992). BLOCKERS B12 still says "the year soak with the court (76,238 people) passes all 8 gates". That result dates from 2026-09-24 22:24, before D-211 added festivals, and no longer holds.

Everything else I checked holds, or is honestly logged as open:
- the population sizes against PEOPLE.md;
- the default-world year soak (all 8 gates, 15.46 M person-days, 0 plan issues);
- round 10 of the shadow review;
- activity coverage (lint and plan scan);
- the node pop-in walks.

- **Reviewer:** an independent reviewer subagent (Claude Opus 5.5). I did not see the build process.
- **Date:** 2026-09-25.
- **Tree:** branch `claude/amazing-fermi-40ds7j`, HEAD `5f37dbb`. The working tree was clean.
- **Read:** PERSEPOLIS_BRIEF.md (all), CLAUDE.md, PROGRESS.md (all), BLOCKERS.md (all), handoff/review_briefs.md, research/PEOPLE.md §P5.6, and the DECISIONS rows D-143, D-182, D-199, D-207, D-210, D-211, D-213, D-221 and D-225 (the court-soak paragraphs). From OPEN_QUESTIONS: Q-207 and Q-209. From REVIEWS: shadow_phase5_r10.md and _r10_b.md (heads and findings), agent_crowd_scale.md, rubric_s7_pass2.md (the crowd and court passages), agent_reports_session8.md (D-221) and the three soak JSONs.
- **Not run:** Playwright, and the full test suite.

---

## CRITICAL

### C1. No configuration meets the gate: the floor needs the court, and the court fails the soak
- **The floor, court absent (B11, BLOCKERS.md l. 14).** Browser visible counts: Apadana forecourt 84, Hall of 100 Columns site 96, dawn stair top 228, town lane 51. The Terrace from the hillside reaches 560. That hillside frame is 12.52 M triangles against the 12 M budget, and the world alone takes about 12 M there (B13, l. 16). So in the default world the floor is met only in a view that is over budget, and never at ground level.
- **The floor, court resident.** Met in node on HEAD. I re-ran `tests/court_view.test.ts` (3/3 pass). `court-forecourt-w` has 618 people visible of 2,000 drawn (776 on day 30), and `court-apadana-n` has 8,453 of 10,995 (bench-reports/court-view.json, identical before and after my run). The browser claim (682 of 2,310) cannot be checked: see M1.
- **The soak, court resident.** I ran `runSoak(30, 60, 1, …, {court: true})` on HEAD (76,238 people; 1,937,731 person-days checked; scratchpad `soak_court30.json`).
  - Result: **plansWellFormed fails with 2,786 `festival` issues**, all court women (homemakers at `court_harem`) on day 10. Example: "51421 homemaker f34 day 10: festival: work on a festival day off: 0.00-5.76 sleep @ court_harem — asleep".
  - variety and populationVariety also fail, on 20 non-court people and the detailed child agent (0.168). That is expected over 30 days, since the gate is calibrated for a year.
  - events, stuck, stocks, renderedHonest and visibleChange pass.
  - The flagged segments are sleep and rest. The cause may be the court's plans (they have no festival rule: D-221) or planCheck's festival rule applied to the women's quarters. Either way the gate as defined fails, and it has not been resolved.
  - DECISIONS.md ll. 4988–4992 (D-221) records the same failure: "plansWellFormed fails on 2,786 'festival' issues, all the court women on day 10 (the court's plans have no festival rule; pre-existing)". It fails identically on the base tree b875b92.
  - The last court-year soak that passed is D-199's (DECISIONS l. 3731; 2026-09-24 22:24). It predates commit 52dbb3e (D-211 festivals, 2026-09-25 01:53), which introduced the failure. No court-year soak has been run since.
- **Stale claim.** BLOCKERS.md l. 15 (B12) still states "the year soak with the court (76,238 people) passes all 8 gates" as current.
- **Why this is critical.**
  - The gate is one sentence about one build. Its floor is defined by the brief's own example, "a court day in the Apadana forecourt" (§9.2), and that is exactly the configuration whose plans are malformed.
  - §9.2 also makes the court-resident population part of "everyone who lived there exists" ("When the court is resident, expect thousands on and around the Terrace…").
  - The builder treated the court setting as in scope for the soak (D-182, D-199 ran it), so its failure counts.
- **To close:** fix the court plans' festival rule. Then re-run `npx tsx tools/soak.ts 354 60 1 --court` on the final tree, keep the report under REVIEWS/soak/, and correct B12. Alternatively, raise the default world's ground-level floor, but B11 shows that the plans put too few people in the open.

---

## MAJOR

### M1. The browser evidence for the floor is gone; on HEAD the floor is node-only
- B11's headline rests on a file that is not in the repository or anywhere on disk. The line reads: "Browser-measured, session 7 (render pass 2, high, WebGPU): … court-forecourt-w 682 visible of 2,310 drawn, court-apadana-n 2,431 of 11,138 (shots/crowd-scale.json)". I searched with `find / -name "crowd-scale*.json"`: no result. `shots/` is gitignored (.gitignore l. 16).
- Also missing: the renders `crowd-court-*`, `crowd-*` and `shots/agent-crowd/`, which REVIEWS/agent_crowd_scale.md §6 names.
- One piece of corroboration exists. The rubric s7 pass-2 reviewer read the file and quotes the **drawn** counts only (REVIEWS/rubric_s7_pass2.md ll. 17, 268: "crowd-scale counts 2,310 and 11,138 in view"). None of the visible counts is corroborated.
- The only crowd-scale measurement on HEAD is the node sightline count.
  - By the builder's own account it sees through trees, parapets and small parts (agent_crowd_scale.md l. 126).
  - Example: dawn gives 379 by sightline but 228 by the browser depth probe.
  - On HEAD, `court-apadana-n` counts 8,453 "visible" of 10,995, which is not credible as people seen at eye level.
- B11's body still says "the browser probe not yet run" and "The floor is met only from the hillside". This contradicts its own headline.
- All of those renders predate D-221, which moved every court person into files and parties, so any count they held no longer describes this tree.
- The one court render on disk is `shots/moment-court-assembly-webgpu-d221r2.png` (looked at). It has no stats JSON and is not a crowd-scale view. It shows perhaps 150–250 people at 10–150 m, as a loose crowd: no spearmen's files can be read, and a row of squatting parties stands on the right.

### M2. "Within budget" is not shown on the current tree for any view that meets the floor
- **B13 is still open.** In the session-4 browser rows, three of seven busiest views are over 12 M triangles (hall site 13.51 M, hillside 12.52 M, court hillside 12.64 M).
- **The last browser frame count of a court floor view** is `court-forecourt-w` at 11.27 M (DECISIONS l. 3475). That was session 6, before D-199 (retinue, delegations), D-215, D-217, D-221 (files, parties), D-225 (robes: Persian LOD0 38,236 → 40,380 triangles, PROGRESS l. 33) and D-226 (relief atlas).
- **`court-apadana-n` has no recorded browser triangle count anywhere.**
  - Node on HEAD: people 3.11 M + props 0.17 M + work objects and animals 0.013 M, with shadows not counted (court-view.json).
  - README gives the Apadana N court's world as 8.57 M in session 7, and D-217 raised the relief far chunks by 0.28 M.
  - Adding these gives about 12.1 M before shadows: at or over the budget.
- **JS heap.** README l. 29: "not re-measured with the full population". The court setting simulates 76,238 people.
- **Crowd CPU.** The crowd CPU gate (tests/performances.test.ts, median < 10 ms) fails under load and "needs re-measuring on a quiet machine" (DECISIONS D-210; PROGRESS ll. 119–120). It has not been re-measured.

### M3. The simulation runs on the main thread; at 60× its step alone exceeds the frame budget
- §6 says NPCs "run in Web Workers, with simulation LOD". `PeopleSim` is built and stepped in `src/world/world.ts:183`, and no worker hosts it: `grep "new Worker" src` finds reliefs, trees, music, terrain detail and humans only. D-00x (DECISIONS l. 83) deferred the move "into a worker in Phase 5", and it never happened.
- **Measured step cost.**

  | run | 60×: mean | 60×: p99 | 60×: max | 1×: max |
  |---|---|---|---|---|
  | merged-tree soak | 17.63 ms | 358.5 ms | 675 ms | 84 ms |
  | my HEAD re-run | 15.90 ms | 496.7 ms | 664.8 ms | 73 ms |

- At the adjustable time scale (§5.3) the population alone takes the whole 16.7 ms frame, with half-second hitches.

### M4. Distant and overflow people doing field or building work are drawn standing, and the placeholder counter cannot see it
- **The fallback.** `src/people/impostors.ts` ll. 41–50, `frameOf`: every animation without a frame of its own takes the default `FR.stand`. That covers hoe, reap, bind, winnow, plough, herd, shear, sweep, weave, spin, haul, lay, polish, adze, pick, tread, stoke, butcher, cook, harp, lyre, sing, barsom, feed_fire and the rest of `WORK_ANIMS` (`src/people/workAnims.ts` ll. 15–23).
- **Who gets impostors.** Impostors are drawn for everyone outside the nearest-448 skinned pool at any distance (agent_crowd_scale.md l. 179), not only beyond 600 m. In the hall-site view that is 2,597 impostors, most of them gangs hauling, laying and dressing stone within 200 m.
- **Why the counter misses it.** The "0 placeholder performances" figures (court_view.test.ts, popview m07, Q-207 closed) count only registry placeholders: `crowd.ts:616`, `if (ACTIVITIES[act].placeholder && !moving) placeholders++`. A reaper drawn as a standing billboard counts as performed.
- **The rule it breaks.** §9.5: "Distance never breaks it. Beyond full-detail range, people are cheaper to draw but still doing their real activity", and "No placeholder 'working' loop".
- **To fix:** add impostor frames for the work families (at least bend-and-swing, hoe, carry-in-arms, sit-at-loom), or a per-activity nearest-frame map. Count the stand fallback in `impPerf.placeholders`.

### M5. No pop-in walkthrough with the population has ever run in a browser
- **The only browser walkthrough (session 3)** predates the population view. TASKS.md ll. 95 and 104 still list "walkthrough e2e" as open, and HANDOFF.md l. 66 lists it as to-do.
- **The only pop-in evidence is node code.** It runs the crowd's own candidate logic:
  - popview walk: 1.6 km, 0 pop-ins;
  - court walk (`court_view.test.ts`): 634 m, 1,812 frames, 0 pop-ins, re-run by me on HEAD.
- **What the brief asks.** §13.8 walkthrough bots fail on "objects popping in within 50 m in view", in the browser. The node probe resets on teleports and does not cover a 60× walk (agent_crowd_scale.md l. 152).
- **Rating.** The node result is real evidence, so this is MAJOR rather than CRITICAL.

### M6. Women's names composed by the builder, against brief §9.1, on a general direction
- D-213 (DECISIONS l. 3879 ff.) composes 47 Persian women's names from Old Iranian elements. The element list is itself "RECOLLECTION of Tavernier 2007 / Mayrhofer, NOT SEEN".
- It states that "the user's direction to fill gaps (D-207) supersedes brief §9.1 'never invent names'". D-207, as recorded, is a general instruction about reconstructing where the evidence is silent. It says nothing about names, and §9.1's prohibition is specific ("Never invent 'Persian-sounding' names").
- The names are flagged (asterisk, RECONSTRUCTED, C, "not an attested name" in F3), so §3.7 honesty holds. The override of an explicit spec rule still needs the user's own ruling, not the builder's inference.
- 18,206 women carry these names.

---

## MINOR
- **m1. The soak was not re-run after the S1 fix.**
  - Commit `02d254c` (20:41) changed `sim.ts` decide0 after the soak (20:02) and after the shadow review passed (20:29). Its message says people.test, people_days_d211 and the names tests were "still running at commit time", and no result is recorded.
  - I re-ran the detailed-agent part of the soak on HEAD (`runSoak(354,60,1,…,{skipPopulation:true})`, scratchpad). variety (worst 0.017, a child), stuck (0), renderedHonest (0 bad), events (14–20 a week, floor 8), stocks and visibleChange all pass. `tests/terrace_walk.test.ts` passes.
  - The commit's population changes are text only (a birthday label) plus names flags. I judge the default soak still valid.
- **m2. Stale records** (they understate, but they are wrong):
  - PROGRESS.md l. 492, Phase-5 row: "activity coverage (25 placeholders), rendered floors, unrendered Terrace workforce, construction geometry, shadow review pending". `lint:activity` now reports 0 placeholders, and the shadow review passed.
  - `REVIEWS/agent_crowd_scale.md` (session 4) still says the court "is not simulated".
  - `src/people/activities.ts:137`: the `offmap` note still says "not rendered until the settlement exists, Phase 6".
- **m3.** The `poultry` store is 0 all year (soak `stores.poultry` min = max = 0), yet D-210 adds a state poultry yard (PF 2034: 1,044 head).
- **m4. §5.5 wildlife gaps**, logged in PROGRESS ll. 112–118:
  - no rats, bats or visible flies;
  - animals have a walk gait only, no reins, and wheels do not turn;
  - the delegations' animals stay at the camp;
  - the bands' donkeys are not drawn on the road.
- **m5. Open round-10 findings at the 4 level:**
  - S2: guards' family visits are one long "talk" block, with no heat sleep on 638 heat days;
  - S3: a mason returns to carving 4 minutes after his meal;
  - S4: the Lycian name Šamaš-iddin;
  - S5: the traveller's "another errand" with no first errand.
- **m6. The carry pose in the court render.** In `moment-court-assembly-webgpu-d221r2.png` (looked at, crop at x 300–480), the foreground jar-carrier's jar still covers his head from this angle. The torso shows a dark see-through gap between arm and body: R1's second half, "a see-through hole in the torso", is not visibly fixed.
- **m7. Side effect of my run.** Running `tests/court_view.test.ts` rewrote `bench-reports/court-view.json` (gitignored). The numbers are identical; a copy of the earlier file is in the reviewer's scratchpad.

---

## What I verified, and how

| Item | How | Result |
|---|---|---|
| Population size vs PEOPLE.md P5.6 | soak JSON `population`; D-199; PEOPLE.md ll. 282–310 | Court absent: 46,910, in the range 44,000–51,000. Court resident: Terrace 4,448 by day (3–8k), town 21,270 at night (13–30k), plain 41,136 (33–49k). **Holds** |
| Year soak, default, merged tree | REVIEWS/soak/soak-2026-09-25T20-02-38-098Z.json | 8/8 gates, 354 days (= the calendar year, Nisanu 1–Addaru 29), 15,462,938 person-days, 0 plan issues, worst population share 0.089, 14–20 event kinds a week, construction 51/51 weeks. **Holds** |
| Soak on HEAD (after 02d254c) | re-ran the detailed-agent part (54 s) | Detailed gates pass; see m1 |
| Soak, court setting | `runSoak(30,60,1,…,{court:true})` on HEAD; DECISIONS ll. 3731, 4988–4992 | 30 days: plansWellFormed **FAILS** (2,786 festival issues, court women, day 10); variety fails as expected over 30 days; the other 5 pass. The last court-year pass predates D-211 (C1) |
| Shadow review §13.11 | read r10 A and r10 B heads and findings; the S1 fix diff; ran `tests/terrace_walk.test.ts` | Both PASS (A 7 × 5 and 13 × 4; B 9 × 5 and 11 × 4). The S1 fix is present and its test passes |
| Activity coverage §9.5 | `npx tsx tools/lint_activity.ts`; my scan of every third person's plans on 8 days (46,910 people) against `ACTIVITIES` | Lint OK: 65 activities, 0 placeholders. Every planned act is in the registry (55 seen). Impostor stand fallback: see M4 |
| Floor ≥ 300 visible | `npx vitest run tests/court_view.test.ts --maxWorkers=1` (3/3 pass); bench-reports/court-view.json; search for shots/crowd-scale.json | Court setting: node 618 / 776. Browser evidence missing (M1). Default: not met at ground level (B11) |
| Floor ≥ 50 at full detail | `crowd.ts:90` MAX_FULL = 50; court-view `skinnedByLod[0]` | 50 in court-apadana-n and forecourt-w day 30; 50 in the hall site (B13). **Holds** where people are dense |
| Distant crowds read as people | `shots/plain-stair-noon-plain-after-high-webgpu-d223.png` (looked at) | Figures at about 100–400 m read as people (in files across bare ground). Beyond, no render on disk |
| Budget | README ll. 23–31; B13; DECISIONS l. 3475; court-view.json | Not shown on HEAD (M2) |
| No pop-in | court_view pop-in test on HEAD; popview-tests.json; TASKS ll. 95, 104 | Node: 0. Browser: never run (M5) |
| Sim cost and threading | soak `frameCost` (report and re-run); `grep "new Worker" src`; world.ts:183 | M3 |
| Types | `npx tsc --noEmit -p .` | Clean |
| Wildlife | `npx vitest run tests/wildlife.test.ts tests/fauna.test.ts --maxWorkers=1`; `src/world/wildlife.ts` header | 21/21 pass. Gaps: m4 |
| Names rule | D-213, D-207, `names_recalled.json` diff in 02d254c | M6 |
