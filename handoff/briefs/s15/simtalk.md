# Brief s14/simtalk: Talking to people reaches the real simulation

## Fixed clauses (copy verbatim)

You are a worker agent on PĀRSA (repo /home/user/fars, your own worktree branch; do not push). Read USER_DIRECTIONS.md,
MASTER_PLAN.md and CLAUDE.md first. The standard is every walkable area, at the player's lens and quality,
in motion, with sound, at every hour, season and weather. Your work serves the user directions UD-18, UD-21, UD-24, UD-25, UD-26 and the thresholds T-E9: "share of the conversation test set (spoken or typed prompts to people within 3 m, every class of person, every hour) answered in character within 4 s, with nothing anachronistic (the T-I1 checklist) and no hint of the world's fate" >= 95 %; T-E10: "share of a seeded request-and-recall test set (asks to follow, lead to a place, fetch a person, give or trade, stop work; and questions about a conversation held earlier in the same save, including one heard second-hand through kin or friends) where the person acts through the simulation (does it, or refuses for a reason of their own duties) and recalls correctly, with nothing anachronistic" >= 90 %; T-F9: "consequence chains per simulated year with no player input, on each of 3 seeds: a chain is >= 3 causally linked state changes across >= 2 households or systems (e.g. a poor harvest -> dearer grain -> a household's debt -> a petition or a theft -> a judgement), none scripted as a sequence; plus the share of such chains the player can enter and change through speech or action (measured on a seeded set of interventions)" >= 50 chains per year (and >= 50 % enterable).

1. Say before you start how your change could pass its tests while the intent fails, and measure against that, not only the test.
2. Prefer the world-wide fix to the per-view fix. A fix proved in one view is not proved everywhere.
3. Evidence: node previews and CPU mirrors first; at most 0 browser runs through tools/dev/queue_e2e.sh.
4. Records: your reserved numbers are D-358, Q-1120..Q-1129, B290..B299; rows are appended, never renumbered.
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
   files, bots, Blender bakes on the CPU) through `node tools/dev/cpu_slot.mjs <label> -- <cmd>`; a job of more than ~10 min
   with `LONG=1` (it may take one slot only; the other stays for short checks), and hours-long runs queued for the night.
   Memory: one browser or Blender process of yours at a time (16 GB is shared; the session crashed once from it). Tests: only the files you
   touched or that import them (`npx vitest run <files>`); the lead runs the full suite overnight.
5b. **Box safeguards (session 15):** the slot tools wait while free memory is under 4 GB; mkwt refuses a 5th active agent;
   when you finish, run `node tools/dev/mkwt.mjs --done <name>`. A blocking resource problem (a stalled slot, memory) goes in
   your report's first line with the pids; never kill another agent's job.
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
**Your tree:** C:/Users/Administrator/fars-wt/simtalk (branch s14-simtalk; the fixed clause's /home/user path is the cloud's).

**Goal (as the player meets it):** When the player talks to someone, they speak from their real life (their actual debts, prices, spouse or betrothal, rumours they hold, trust in the player), and what the player says can enter the world: trade and haggle, give, ask for help, petition, hospitality, all as real economy and simulation intents.

**Time box:** 3 h. **Needs:** node. **Reserved:** D-358, Q-1120..Q-1129, B290..B299.

**Files you own:**
- src/people/converse/life.ts
- src/people/converse/turn.ts
- src/people/converse/intent.ts
- src/people/converse/ground.ts
- src/people/speech/**
- src/people/asks/**
- tests/ (new files for this package)

**Read-only, for context:**
- src/people/economy/**
- src/people/relations/**
- src/people/living/**
- src/people/sim.ts
- src/people/talk.ts

**Start here (entry points):**
- converse/life.ts:158-162: lifeRecord fakes seeded debts: read the economy's real loans, stores, prices and recent events, relations (spouse, betrothal, scandal), rumours held, trust
- willTalk is never called by conversation (B234): gate turns on it
- talkAct goes through talk.ts only: [trade], [give] and a new [petition]/[host] become economy intents through speech/haggle.ts with the player as a party
- asks (needs as emergent quests, off unless opts.asks): surface them as talk hooks and turn them on by default if cost allows

**Decisions and blockers that matter (grep these ids, do not read the files whole):** D-296, D-339, D-341, D-351, D-352, B234, B235, B233

**Commands:**
- node tools/dev/mkwt.mjs simtalk
- npx vitest run tests/<your files> tests/converse*.test.ts
- the stand-in model for T-E9/T-E10 in node (the real model is the interactive agent's, wave 2)

**Done line:** In a node session on a day-300 save, every conversation's grounding facts come from the simulation (0 seeded fakes), and a scripted set of 30 player interventions (buy, haggle, give, lend, petition, host, ask for help) each change simulation state and enter a T-F9 chain; T-E9/T-E10 measured with the stand-in.

**Render-train views to request:** (none: node-only)

**Notes:** RESUME/REPAIR (session 15): branch s14-simtalk (merged with s14-int at cc660894) fails 3 of 5 tests in tests/simtalk.test.ts (log: C:/Users/Administrator/fars-train/logs/simtalk.log): (1) a grounding fact puts modern digits in the stranger's words ("138 BAR", lint kind modern/digits): render quantities in the period way, no digits; (2) 30 scripted interventions: 22 join a causal chain, need >= 27; (3) T-E10 stand-in 86.7 % < 90. A 4th failure was a 300 s timeout on a loaded box (econAskOf talk set): re-run alone before treating it as real. Never lower a threshold. Fix the causes, re-run the file through cpu_slot (LONG=1), commit.
