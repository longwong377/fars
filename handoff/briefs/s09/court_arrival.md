# Brief: the court's arrival (session 9) — generated from handoff/agent_template.md

## Fixed clauses (copy verbatim)

You are a worker agent on PĀRSA (repo /home/user/fars, your own worktree branch; do not push). Read USER_DIRECTIONS.md,
MASTER_PLAN.md and CLAUDE.md first. The standard is every walkable area, at the player's lens and quality,
in motion, with sound, at every hour, season and weather. Your work serves the user directions UD-09, UD-10 and the thresholds T-F8 ("court arrivals and departures a walker can witness per year in the default world (the court comes and goes by default, labelled C)" >= 2 events per year on 3 seeds), T-F5 ("news travels by visible messengers before an arrival"), T-F3d ("a delegation arrival at least doubles road density within 1 km"), quoted
verbatim from gates/thresholds.json.

1. Say before you start how your change could pass its tests while the intent fails, and measure against that, not only the test.
2. Prefer the world-wide fix to the per-view fix. A fix proved in one view is not proved everywhere.
3. Evidence: node previews and CPU mirrors first; at most 1 browser runs through tools/dev/queue_e2e.sh.
4. Records: your reserved numbers are D-252, Q-680..Q-689, B70..B72; rows are appended, never renumbered.
5. Never lower or reword a threshold (tests/gates_ratchet.test.ts); a threshold you cannot meet goes to BLOCKERS with ≥ 3
   approaches measured.
6. Lead your final report with what is broken, placeholder or unverified on screen; list tests run with results; run
   `git checkout bench-reports/` before committing.
7. Heavy CPU work (soaks, bots, audio renders, bakes, long test runs) goes through `tools/dev/cpu_slot.sh`, one process at a
   time: the four cores are shared with the render lane.

## Slots
- **Task:** simulate the court's ARRIVAL as an event with a before and an after (D-239, D-236; today src/data/court.json
  `resident.first_day` is 0, so the court is present from the first day and only its departure, E-26/leave_day 117, is
  simulated). The default world (courtCalendar 'seasonal', D-236) must show, each year, on a seed-chosen day in the court's
  probable season: before — preparations (the palace servants and the king's table stocking up, stores moving, the Terrace
  swept, extra guards posted), messengers on the royal road announcing it (T-F5: news travels by visible messengers before
  an arrival); the arrival itself — the court's column on the road from Susa and up the Grand Stair over a day or two (the
  retinue's camps pitched as they arrive, not present beforehand), roads visibly busier (T-F3d-like: measure road density
  within 1 km before/during); after — residence, then the existing departure. Decide the season and whether a year holds one
  or two residences from the evidence already in research/ (COURT.md, CHRONOLOGY, the Greek claims as claims) and log it (C).
  Then D-239: a new game (fresh seed) starts at dawn 1–3 days before that seed's arrival (src/main.ts / settings / seed
  handling; players can still pick any date; pin the decided default in tests/defaults.test.ts, T-K10). The world must not
  perform (T-F6): the arrival day is the seed's, never the player's.
- **Areas:** the royal road and the approach, the plain's camps, the town, the Terrace (the court's places), the Grand Stair.
- **Files in scope:** src/people/court.ts, src/people/population.ts (only where the court's presence days are read),
  src/people/camps.ts, src/data/court.json, src/people/sim.ts, src/main.ts (the start day), src/core/settings.ts,
  tools/soak.ts (T-F8 evidence: count witnessable arrivals and departures per year per seed), the people tests.
- **Done means:** the soak (tools/soak.ts via cpu_slot) on 3 seeds (1, 7 and a fresh random one, logged) passes its 8 gates
  and writes T-F8 evidence (≥ 2 events per year: an arrival and a departure, each with people on the road and the Terrace
  changing), into REVIEWS/evidence/s9-court-arrival/; the people and court tests pass; a node trace (tools/dev/plan_dump.ts or
  people_trace.ts) shows the before/during/after for a few named court people and the road counts; tsc and `npm run guards`
  pass. One full-year soak per seed at most; run them one at a time through cpu_slot.
- **UD ids:** UD-09, UD-10. **Reserved numbers:** D-252, Q-680..Q-689, B70..B72. **Render budget:** 1 browser run (optional:
  the Grand Stair foot on the arrival day at test quality).
- Commit on your worktree branch with clear messages; put your full report in your final message (the lead copies it into
  REVIEWS/).
