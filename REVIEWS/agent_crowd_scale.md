**VERDICT: PARTIAL.**
- Built:
  - the whole simulated population is drawn, placed in the built world and walking built routes;
  - people are fed to the skinned pool nearest-first;
  - everyone else in view is drawn as an impostor to 5 km;
  - no simulated person out of doors in view is missing;
  - no pop-in on the probe walk.
- Measured and failing:
  - the floor "≥ 300 visible in the busiest scenes" at ground level (B11);
  - "≤ 12 M triangles at quality high" in the busiest Terrace views (B13).
- The "court in full assembly" (3,000–8,000 people) is not simulated (B12).

# Crowd at scale: the whole population drawn (D-143). Crowd agent, session 4

- **Branch:** `worktree-agent-ac3b77001e4e485c0` (from `claude/amazing-fermi-40ds7j`), not pushed.
- **Date:** 2026-09-23.
- **Scope:** the lead's brief to the crowd agent. It draws the whole simulated population, not only the ~135 detailed
  Terrace agents (Phase 5 gate: rendered floors, no pop-in, "what's simulated is what you see").

## 1. Still missing, weak or unverified
- **The floor "≥ 300 people visible in the busiest scenes" is met in one view of seven (B11).**
  - "Visible" is measured, not assumed: of the people drawn in a frame, those whose chest or head is in front of the
    depth of the same frame rendered without people (browser, `crowdprobe.ts`). Node estimates the same with 2.5-D
    sightlines (`sightline.ts`).
  - Frustum counts overstate by 10–100×: they include people in walled courts and rooms, and in the Hall of 100 Columns
    site behind its walls and columns.
  - Browser, quality high, visible (drawn in view):
    - the Terrace from the hillside above it: 560 (5,603), most at 60–200 m and a few pixels tall;
    - the approach at dawn from the Grand Stair top: 228 (4,751), specks at 0.6–5 km;
    - the Hall of 100 Columns site among the workers: 96 (2,967);
    - the Apadana forecourt: 84 (775);
    - a lower-town lane at 12:11: 51 (3,101);
    - the court setting: the forecourt 94 (641), from the hillside 558 (5,659).
  - These are the best views a node scan of ~350 viewpoints × headings found.
  - Rendering is not the limit: every simulated person out of doors in view within 5 km is drawn (tested: 0 missing).
    The limit is where the plans put people: at 12:12 the plans put 5,471 of the town's people in their courts and 14
    in its lanes (Q-204), and the Terrace's workers are inside the hall site.
- **The court in full assembly is not simulated (B12, Q-200).**
  - population.json gives the Terrace 3,000–8,000 people by day with the court resident; the Population does not use
    those values.
  - On day 0 at 10:00 the plans put 685 people on the Terrace with the court setting and 676 without.
- **Frame triangles at quality high (≤ 12 M) are exceeded in 3 of 7 views (B13).** Draw calls (≤ 3,000) are met
  everywhere: 418–671.
  - On the hillside (12.52 M; 11.97 M without people) and the court hillside (12.64; 12.04 without), the world alone
    takes about 12 M.
  - In the hall site (13.51; 10.21 without), people add 3.30 M, 1.8 M of it the floor of 50 at full detail.
  - Within budget with people: the forecourt (8.53, court 8.60), the town lane at noon (11.35) and the dawn approach
    (6.74).
  - Three approaches were measured; shipped: the farthest body from 90 m, and walled-off people at the farthest body.
- **Walk times are the plans' (Q-203).**
  - A walk arrives at the plan's hour. Where the plan allows more time than the route needs (63 % of walks sampled),
    the walker leaves late.
  - 7.5 % of walks need more than 1.8 m/s and are drawn hurrying.
  - The simulation's travel was not changed: population.ts belongs to another agent this session.
- **Placeholder activities reach drawn people (Q-207).** They are shown standing, flagged in the dev overlay and
  counted: up to 182 skinned and 1,976 impostors per frame in the busiest views.
- **Children.**
  - Under one: never drawn. At one or two: drawn only when playing or walking; otherwise carried, with no carried-child
    prop (Q-205).
  - Statures are modern growth-chart medians (Q-206).
- **population.ts gives NaN hours in 81 of 130,592 plans (Q-208).** The view repairs and counts them.
- **Jumping back in time.** The population's life events do not go back when time jumps back, nor do the detailed
  agents: a test that runs the year and jumps back sees other people. This is population.ts and sim.ts behaviour. The
  busiest-scenes test builds its own simulation.
- **Impostors.**
  - They cast no shadows.
  - There are 14 frames; performances with no frame of their own stand.
  - Size and colour-slot match with the far body is tested in node. No browser A/B render at the 600 m switch was made.
  - When more than 448 people are nearer than 600 m, the rest are impostors inside 600 m.
- **Standing apart.** People standing keep 0.6 m apart (tests: 0.8 % closer than 0.45 m). Round the work-camp hearth at
  the noon meal, 3.2 % find no room within 5 m. The detailed agents' own positions (sim.ts) sometimes coincide.
- **Pop-in.**
  - A node walk through the lower town to the Terrace (1×, 4,597 frames, 1.6 km): 0 pop-ins.
  - Every e2e scene: 0.
  - Not run: a browser walkthrough, and a walk at 60×.
- **main.ts (not owned):** one line, so the bots' paths avoid the population's people standing still.
- **Per-quality caps:** none set. `crowd.caps` can take them; a budget is stated only for quality high.

## 2. Numbers
### 2.1 Browser: e2e, quality high, WebGPU on SwiftShader, 960 × 540 (`tests/e2e/crowd_scale.spec.ts`)
- **Measurement.** Each scene is rendered with people shown and hidden in the same frame state. Every backend draw is
  counted.
- **"Visible"** comes from the depth probe (`world.people.probe`): of the people drawn, those whose chest or head is in
  front of the depth of the same frame rendered without people.
- **Numbers file:** `shots/crowd-scale.json`.

| scene (day 25 unless court) | drawn in view: skinned full/mid/far/farthest + impostors | visible (depth probe): total; <50/<200/<600/<1500/<5000 m | frame with people: draws / triangles | without people | people's share | pop-ins | placeholder acts shown standing: skinned + impostors |
|---|---|---|---|---|---|---|---|
| Hall of 100 Columns site among the workers, 10:00 ([144, −12], S) | 50/100/18/202 + 2,597 = 2,967 | 96; 89/7/0/0/0 | 624 / 13.51 M | 593 / 10.21 M | +31 / +3.30 M | 0 | 181 + 1,084 |
| the Terrace from the hillside above it, 10:00 ([290, −20], W, 26 m above the court) | 0/3/0/399 + 5,201 = 5,603 | 560; 0/311/13/116/120 | 671 / 12.52 M | 650 / 11.97 M | +21 / +0.54 M | 0 | 76 + 1,976 |
| the Apadana forecourt, 10:00 ([20, 80], SE) | 0/2/0/403 + 370 = 775 | 84; 1/83/0/0/0 | 616 / 8.53 M | 596 / 7.96 M | +20 / +0.57 M | 0 | 127 + 120 |
| lower-town lane (q_s1), 12:11 ([−422, −941], NNE) | 18/41/0/176 + 2,866 = 3,101 | 51; 19/7/25/0/0 | 485 / 11.35 M | 450 / 10.30 M | +35 / +1.06 M | 0 | 47 + 960 |
| the approach at dawn from the Grand Stair top, 05:24 | 8/0/0/139 + 4,604 = 4,751 | 228; 0/1/35/103/89 | 418 / 6.74 M | 400 / 6.31 M | +18 / +0.43 M | 0 | 20 + 1,768 |
| court setting, day 0 10:00, the forecourt | 1/2/0/418 + 220 = 641 | 94; 2/92/0/0/0 | 618 / 8.60 M | 594 / 8.02 M | +24 / +0.57 M | 0 | 123 + 33 |
| court setting, day 0 10:00, from the hillside | 0/0/0/448 + 5,211 = 5,659 | 558; 0/234/17/147/160 | 662 / 12.64 M | 647 / 12.04 M | +15 / +0.60 M | 0 | 91 + 1,863 |

All rows are from the final code. Superseded runs, kept for comparison:
- the hall site looking W from [170, −20]: 4,523 drawn, 176 visible, 16.79 / 13.64 M;
- the hillside before the LOD change: 13.50 M, people +1.52 M;
- the town lane before the walled-off rule: 13.14 M, people +2.85 M, 26 visible.

Crowd CPU in these frozen browser frames (feed 1–16 ms, pose 5–46 ms, impostors 1–14 ms) competes with SwiftShader for
the CPU and is not representative. The node figures below are the reference.

### 2.2 Node (`tests/popview.test.ts`; lines in `bench-reports/popview-tests.json`)
- **Places resolved:** 110,088 of 110,126 place visits sampled over three days (99.97 %). The 38 unresolved are
  `lane:` visits of village compounds whose gate the raster could not place.
- **Walls.**
  - 25,490 people drawn in four scenes and 732 routes walked: 0 stand in a wall cell or a roofed room; 0 routes cross a
    wall.
  - Standing within 0.45 m of another: 0.8 % (spread aside 2,424; no room 162).
- **Positions.** 20,946 people at their places and 526 on their way: 0 off the plan (at the spot, or at the clear place
  beside it; on the route; arriving at the plan's hour).
- **Walk pace the plans imply over the built routes (3,000 walks):** p5 0.02, p50 0.40, p95 2.42 m/s.
  - 63.3 % leave late;
  - 7.5 % are drawn hurrying (> 1.8 m/s);
  - 29.2 % walk at a walking pace as planned.
- **Busiest scenes by sightline:** visible by sightline of drawn in view:
  - hall site 89 of 2,995 (50 at full detail);
  - hillside 953 of 5,538;
  - forecourt 108 of 774;
  - town at noon 34 of 2,854;
  - dawn 379 of 4,275.
  - Nobody simulated in view is missing (every population person out of doors and every detailed agent on the map in
    the frustum within 5 km is drawn).
  - Sightlines see through trees, parapets and small parts that the browser depth does not: the browser counts are
    lower (dawn 228).
- **Pop-in walk.** The lower town → the stair foot → the Hall of 100 Columns site: 1,608 m at 1.4 m/s, 4 frames a
  second, 1× time. 0 pop-ins; 0 people came out of doors within 50 m.
- **CPU per frame** (node, on a machine at load 7–9 on 4 cores, two runs):
  - view: 1.4–2.8 ms at 1× (p99 2.4–11), 2.5–5.3 ms at 60× (p99 15–26);
  - pool, pose and impostors: 3.7–5.2 ms at 1× (p99 7–15), 3.7–6.7 ms at 60× (p99 8–29).
  - An A/B in one process put the spacing of standing people at under 0.02 ms a frame.
- **Budget variants (node, main pass, people's triangles):**

  | view | before (far body to 200 m) | shipped (farthest body from 90 m) | + mid cap 50 | + shadows within 40 m |
  |---|---|---|---|---|
  | hall site | 3.18 M | 2.83 M | 2.65 M | 2.83 M (shadows 0.23 → 0.18 M per map) |
  | hillside | 1.06 M | 0.22 M | 0.22 M | 0.22 M |
  | forecourt | 1.09 M | 0.22 M | 0.22 M | 0.22 M |
  | town lane at noon | 2.66 M | 2.42 M → 0.07 M with the walled-off rule | 2.27 M | 2.42 M |
  | dawn approach | 0.09 M | 0.09 M | 0.09 M | 0.09 M |

## 3. Pop-in probe
- **The probe (§13.8).** A person is a pop-in when they are a candidate within 50 m, in view, who was no candidate in
  the last frame. This covers the detailed agents and every population person within 5 km, skinned or impostor.
- **Not counted as pop-ins:**
  - people stepping out of a door (counted as `impPerf.doorEntries`);
  - the first frame after a camera teleport (> 30 m in a frame) or a jump in time (back, or > 15 min ahead).
- **Node walk (1×):** 0 pop-ins in 4,597 frames.
- **e2e scenes:** 0 in every scene rendered (probe reset after each `view()` teleport).
- **Not run:** a browser walkthrough with the probe, and a walk at 60×.

## 4. Impostors
- **Bake.**
  - What is baked: the far body the crowd draws farthest (LOD 3, the far body simplified to a fifth), per dress family:
    persian, guard, median, worker, woman, child. Each is posed by the same rig solver as the skinned crowd.
  - Frames: 14 (stand; a 6-frame walk cycle; carry on the head, with the jar prop; carry on the shoulder, with the sack
    prop; sit; kneel; bend; lie; a guard's stance).
  - Views: 8. Cells: 32 × 32 px over 1.6 × 2 m. Atlas 256 × 2,688 in 6 coverage-preserving mip levels.
  - Bake time: 0.5 s in node, 0.9–1.3 s in the browser at load.
- **Colour.** Texels hold colour-slot weights, not colours: main, second, trim, skin, hair, leather or felt, fixed. Each
  instance carries its person's look colours (looks.ts), packed square-root 8-bit per channel, within 1.6/255 in sRGB
  (tested). A distant woman's red mantle stays red.
- **Size.** Each instance is scaled by its person's stature over the dress family's reference stature. A child is scaled
  by its age's height.
- **Match with the far body (node, 18 cases: 6 dresses × stand, walk, kneel):**
  - height within a texel (6 cm);
  - width within a texel (5 cm);
  - silhouette area within 8 % (worst 3.9 %);
  - colour-slot shares against the far body's visible pixels at 4× resolution: worst 0.045 (woman kneeling).
  - Coverage per cell: > 0.07 standing and walking, > 0.04 seated or bent, > 0.02 lying; children half these.
  - Mip level 3 keeps each cell's coverage within 0.2.
- **Drawing.** One instanced draw of 2 triangles each. Cylindrical billboards; the nearest of 8 views by the person's
  yaw; alpha test at 0.5; lit as MeshStandard with the baked normal and cavity AO. The previous position is written for
  TRAA, so impostors do not smear. They cast no shadows.
- **Frame choice.** The frame follows the person's activity performance: walking gets the cycle phase advanced by speed;
  carrying, sitting, kneeling, bending and lying get their frames; everything else stands.
- **Switch.** Impostors are drawn beyond 600 m, and for anyone not in the skinned pool (the nearest 448) at any
  distance, to 5 km. Culling uses the crowd's widened frustum on the CPU; there is no sort (alpha test).

## 5. Simulation changes (API)
- **population.ts, sim.ts: no change.** The view reads the public API (`plan`, `present`, `home`, `ageOn`, `nameOf`,
  `persons`, `households`, `quarters`, `visibleAgents`, `agents`, `performance`).
- **New modules, read-only on the simulation and the built plan:**
  - `src/world/settlement/walk.ts`: `TownWalk` (`locate`, `route`, `clear`, the lane graph), `siteSearch`, `siteLine`,
    `plotCells`.
  - `src/people/popgeo.ts`: `PopGeo` (`spot`, `route`, `stepClear`, `plotAt`, `villageOf`, `villageLoad`,
    `spotAtPoint`, `groundAt`, `villageSites`), `routeAt`. A Spot in a walled court or yard carries `plot` and `wall`.
  - `src/people/popview.ts`: `PopView` (`update(t, centre)`, `settle`, `query(centre, r)`, `visible`, `lookInput`,
    `childStature`, `describe`, `stats`, `jumps`).
  - `src/people/impostors.ts`: `bakeImpostors`, `CrowdImpostors`.
  - `src/people/crowdprobe.ts`: `countVisible`.
  - `src/people/sightline.ts`: `Sightlines`.
- **crowd.ts (pool, LOD, impostor parts):**
  - `view`, `imp`, `attachPop(pid)`, `impPerf`, `caps`, `drawnPoints()`, `drawnKeys`, `lastCamera`,
    `resetPopinProbe()`, `looksPerFrame`;
  - `stats()` adds `impostors`, `impostorDraws`, `impostorTriangles`, `impPerf` and `view`.
- **world.ts:** `world.people` gains `view`, `geo` and `probe(renderer)`. It also adds 48 capsules for the population
  nearest the player, the population's walkers opening doors, and the overlay line.
- **main.ts (not an owned file, one line):** `navPath` avoids the population's people standing still.
- **Offered, not made:** the plans could take walk times from `PopGeo.route(a, b).len` instead of straight lines
  (Q-203). That change belongs in population.ts (the sim agent).

## 6. Renders (`/home/user/fars/shots/agent-crowd/`)
- `crowd-hall-site-working-morning-high-webgpu.png`: among the Hall of 100 Columns site's workers at 10:00. Two
  workers at full detail in front, the gang between the columns behind.
- `crowd-hall-site-west-view-high-webgpu.png`: the same site from [170, −20] looking W (superseded view: a column
  fills the right half).
- `crowd-terrace-from-hillside-high-webgpu.png`: the Terrace working morning from 26 m above the court.
  - 560 people are visible, most among the hall site's columns 100–200 m away and 2–5 px tall.
  - `…-before-lod-…` is the same view before the LOD change.
- `crowd-forecourt-morning-high-webgpu.png`: the Apadana forecourt looking SE. The 84 visible people are mostly a band
  2–4 px tall at the foot of the hall site's N wall, 100–150 m away.
- `crowd-town-lane-midday-high-webgpu.png`: the q_s1 main street at 12:11. Women in coloured dresses and men stand
  outside their doors; the lane narrows toward the Terrace.
- `crowd-approach-dawn-high-webgpu.png`: from the Grand Stair top at 05:24. The stair parapet is in front; the walkers
  on the plain are specks.
- `crowd-court-forecourt-high-webgpu.png` and `crowd-court-from-hillside-high-webgpu.png`: the court setting, day 0 at
  10:00. They differ from day 25 only by what the plans put there.
- `crowd-scale-runA.json`: the numbers of the first high run (superseded views). The current numbers are in
  `shots/crowd-scale.json` of the worktree.

## 7. Files and commits
- **New:**
  - `src/world/settlement/walk.ts`
  - `src/people/popgeo.ts`, `src/people/popview.ts`, `src/people/impostors.ts`, `src/people/crowdprobe.ts`,
    `src/people/sightline.ts`
  - `tests/popview.test.ts`, `tests/e2e/crowd_scale.spec.ts`
- **Changed:**
  - `src/people/crowd.ts`: the pool, LOD and impostor parts only.
  - `src/world/world.ts`: the crowd lines.
  - `src/main.ts`: one line.
  - `DECISIONS.md` (D-143), `research/OPEN_QUESTIONS.md` (Q-200 … Q-209), `BLOCKERS.md` (B11–B13), this report.
- **Commits** (on top of `2ffdac9`; the documentation commit that adds this report comes after them):
  - `fa47d46` Full detail for the people who can be seen (D-143): walled-off people get the farthest body and no shadow
  - `6e62bb2` Nobody stands inside anybody (D-143): people keep 0.6 m apart at their places; gatherings spread
  - `8d409ea` Crowd LOD caps as instance fields (D-143): tests measure the triangle budget under other caps
  - `0fd24f6` Dev overlay counts the placeholder activities shown standing (D-143); open questions Q-200 to Q-209
  - `7abfb4d` Crowd LOD (D-143): the farthest body from 90 m; impostor colours tested against the far body's visible slots
  - `f55410e` Crowd tests (D-143): the drawn set is the simulated set, visibility by sightline, the e2e scenes from a view scan
  - `c5095b3` Visibility measured, not assumed (D-143): the people drawn who can be seen
  - `d72825d` Crowd pool fed by the population view (D-143): the nearest 400 skinned, everyone else in view to 5 km as impostors
  - `a145a65` Crowd impostors (D-143): far people as instanced billboards baked from the far LOD
  - `8f87e68` Population view (D-143): every simulated person out of doors, placed where the plan says, walking built routes
  - `f120a63` Town walk network (D-143): the settlement's walkable ways derived read-only from the built plan
