# Brief s14/visible: The simulation made visible: errands, markets, washing, weddings, wardrobes

## Fixed clauses (copy verbatim)

You are a worker agent on PĀRSA (repo /home/user/fars, your own worktree branch; do not push). Read USER_DIRECTIONS.md,
MASTER_PLAN.md and CLAUDE.md first. The standard is every walkable area, at the player's lens and quality,
in motion, with sound, at every hour, season and weather. Your work serves the user directions UD-07, UD-08, UD-09, UD-26, UD-27 and the thresholds T-F9: "consequence chains per simulated year with no player input, on each of 3 seeds: a chain is >= 3 causally linked state changes across >= 2 households or systems (e.g. a poor harvest -> dearer grain -> a household's debt -> a petition or a theft -> a judgement), none scripted as a sequence; plus the share of such chains the player can enter and change through speech or action (measured on a seeded set of interventions)" >= 50 chains per year (and >= 50 % enterable); T-E13: "share of a seeded week of simulated life (no player input) in which person-to-person talk changes the simulation: arrangements made in talk (work, trade, help, visits, news passed on) that the people then carry out through their plans, measured as the share of talk events with a consequence in the sim within the next 3 game days, plus the share of player-caused changes that propagate to at least one other person" >= 50 %.

1. Say before you start how your change could pass its tests while the intent fails, and measure against that, not only the test.
2. Prefer the world-wide fix to the per-view fix. A fix proved in one view is not proved everywhere.
3. Evidence: node previews and CPU mirrors first; at most 0 browser runs through tools/dev/queue_e2e.sh.
4. Records: your reserved numbers are D-359, Q-1130..Q-1139, B300..B309; rows are appended, never renumbered.
5. Never lower or reword a threshold (tests/gates_ratchet.test.ts); a threshold you cannot meet goes to BLOCKERS with ≥ 3
   approaches measured.
6. Lead your final report with what is broken, placeholder or unverified on screen; list tests run with results; run
   `git checkout bench-reports/` before committing.
7. Heavy CPU work (soaks, bots, audio renders, bakes, long test runs) goes through `tools/dev/cpu_slot.sh`, one process at a
   time: the four cores are shared with the render lane.

## Machine section (session 11 on; copy into every brief after the fixed clauses)
On the GPU machine (session 11 on: Windows, NVIDIA T4, 16 cores, 63 GB, open internet), this clause governs where it
   differs from 3 and 7. Render with Playwright directly on the real GPU (`PW_CHANNEL=chrome --project=gpu`, your own
   E2E_PORT), at the player's lens and quality; a page load is ~11 min, a warm frame 0.1 s, so put all your views in one
   load (moments.spec.ts `BATCH=1`). Never edit files in a tree whose dev server is serving a render (it reloads the page).
   Run node jobs directly (no cpu_slot.sh, flock or python here). Surfaces must read as real at arm's length: use CC0
   scans and assets (Poly Haven, ambientCG; src/render/scans.ts; each recorded in ASSET_LEDGER.md) over the procedural
   base, keeping the measured tints and layouts; a procedural stand-in where a scan exists is a placeholder.

## Operating model (session 14 on; UD-28; governs where it differs from the clauses and machine section above)
The box is now 4 cores, 16 GB, one T4 (two GPU slots). An agent's own thinking costs the box nothing; its jobs do. Work so
that no hour is spent reading, waiting or polishing.
1. **Setup in one command:** `node tools/dev/mkwt.mjs <name>` (branch `s14-<name>` off `s14-int`, node_modules and models
   linked, your port in `.wtport`; use it as E2E_PORT). No `npm ci`. Work only in that tree.
2. **Read the context pack, not the records.** Your brief names the entry files and lines, the decisions and blockers that
   matter, the commands and the done line. Never read DECISIONS.md, PROGRESS.md, HANDOFF.md, TASKS.md or BLOCKERS.md whole:
   grep an id when you need one.
3. **You own your files.** Edit only the files your pack lists as owned (new files in your area are yours). A needed change in
   a file you do not own: make the smallest hook (an import, one call) and say so in the report; never refactor it.
4. **Iterate fast, verify once.** Iterate on probe pages and node checks (seconds). Never load the full world yourself:
   request your views on the render train (`node tools/dev/render_train.mjs request <name> <moment,...> [views.json]`); the
   lead runs it on `s14-int` after merging you and puts the frames in fars-train/out/<run>/<name>/. While you wait, do your
   next item; never sit idle on a slot.
5. **Slots:** every GPU job (probe pages too) through `node tools/dev/gpu_slot.mjs`; every heavy node job (soak, long vitest
   files, bots, Blender bakes on the CPU) through `node tools/dev/cpu_slot.mjs <label> -- <cmd>`. Tests: only the files you
   touched or that import them (`npx vitest run <files>`); the lead runs the full suite overnight.
6. **Done line and stop rules.** Your pack's done line is what a player would see (or a named threshold). Stop when it is
   met: no polish past it. A sub-goal that fails three measured approaches goes to BLOCKERS (your numbers) and you move on.
   Time box: the pack's hours; at the box's end, commit and report whatever state you are in.
7. **Commit hourly** to your branch (the guards run in the hook); before the final report, merge `s14-int` into your branch,
   re-run your tests, and commit. The lead merges you into `s14-int`; do not push.
8. **Records:** one DECISIONS row (your reserved D number) for the package; BLOCKERS rows only for real blocks; no edits to
   PROGRESS, HANDOFF, TASKS or COVERAGE (the lead's).
9. **Report ≤ 250 words:** broken/placeholder first; what a player now sees differently; train views requested; files
   touched; tests run with results. No questions mid-run: decide, log, proceed.

## Your context pack
**Your tree:** C:/Users/Administrator/fars-wt/visible (branch s14-visible; the fixed clause's /home/user path is the cloud's).

**Goal (as the player meets it):** What the simulation does, the player can see: people walk to market and haggle at stalls, carry goods home, wash clothes at the canal, go to a wedding procession and feast, wear the clothes their wardrobe chose today.

**Time box:** 6 h. **Needs:** node. **Reserved:** D-359, Q-1130..Q-1139, B300..B309.

**Files you own:**
- src/people/economy/plans.ts
- src/people/wardrobe/**
- src/people/activities.ts
- src/people/relations/plans.ts
- src/people/relations/world.ts
- src/people/living/world.ts

**Read-only, for context:**
- src/people/population.ts
- src/people/crowd.ts
- src/people/popview.ts
- src/people/sim.ts
- src/people/economy/world.ts

**Start here (entry points):**
- haggles are never walked (B235): a market segment at a real stall with a performance
- laundry is a plan segment with no activity: washing at the canal/river with a performance and props
- every economy segment gets a performance and carried goods (activities.ts, lint:activity must stay 0 placeholders)
- weddings move no house (B226) and never reach the economy (B227): step Relations inside LivingWorld.advance; processions and feasts as plan segments for both households
- export the day's garment choice per person for the render (the 'people' agent reads it in wave 2)

**Decisions and blockers that matter (grep these ids, do not read the files whole):** D-338, D-343, D-345, D-347, D-348, B226, B227, B235

**Commands:**
- node tools/dev/mkwt.mjs visible
- npm run lint:activity
- npx vitest run <touched tests>; long people_days files only through node tools/dev/cpu_slot.mjs

**Done line:** In a simulated week (node), >= 95 % of economy, washing and relation segments have a performance, a real place and carried props (a node count), weddings move a household and reach the economy, and each person's daily garment is exported; T-E13 and T-F9 re-measured.

**Render-train views to request:** lane-with-child, morning-wash, tannery-work, press-work
