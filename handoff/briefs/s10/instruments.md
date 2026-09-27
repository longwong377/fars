# Brief: the instruments (session 10, MASTER_PLAN §6 step 2; D-275 "instruments early") — generated from handoff/agent_template.md

## Fixed clauses (copy verbatim)

You are a worker agent on PĀRSA (repo /home/user/fars, your own worktree branch; do not push). Read USER_DIRECTIONS.md,
MASTER_PLAN.md and CLAUDE.md first. The standard is every walkable area, at the player's lens and quality,
in motion, with sound, at every hour, season and weather. Your work serves the user directions UD-06, UD-07, UD-12, UD-16 and the thresholds T-A6 ("area registry union cover of the physically walkable envelope" >= 99.5 %), T-A6x ("largest area (0.25 ha for interiors)" <= 1 km2), and the board of MASTER_PLAN §5 (every threshold id a cell; NOT-MEASURED and STALE count as FAIL).

1. Say before you start how your change could pass its tests while the intent fails, and measure against that, not only the test.
2. Prefer the world-wide fix to the per-view fix. A fix proved in one view is not proved everywhere.
3. Evidence: node previews and CPU mirrors first; at most 0 browser runs through tools/dev/queue_e2e.sh.
4. Records: your reserved numbers are D-277, Q-740..Q-749, B88..B90; rows are appended, never renumbered.
5. Never lower or reword a threshold (tests/gates_ratchet.test.ts); a threshold you cannot meet goes to BLOCKERS with ≥ 3
   approaches measured.
6. Lead your final report with what is broken, placeholder or unverified on screen; list tests run with results; run
   `git checkout bench-reports/` before committing.
7. Heavy CPU work (soaks, bots, audio renders, bakes, long test runs) goes through `tools/dev/cpu_slot.sh`, one process at a
   time: the four cores are shared with the render lane.

## Slots
- **Task:** build the instruments MASTER_PLAN §4.2, §4.3 and §5 mark TO-BUILD, in this order, each usable when committed:
  (1) **the area registry**: `tools/dev/areas.ts` generating `data/areas.json` from the physically walkable envelope (terrain
  slope <= 42°, step-up, the colliders of every terrain ring and the architecture; NOT the nav grid), unique areas (each Terrace
  building and court, town quarter, palace/garden zone, named site, village, river reach, the transect) and generator classes
  (plain sectors, far land); `tests/areas.test.ts` (T-A6 union >= 99.5 % of the envelope, T-A6x largest <= 1 km2 / 0.25 ha
  interiors, count/total never shrink without a DECISIONS row citing a UD); evidence files for T-A6/T-A6x written by the tool.
  (2) **the generated board**: extend `tools/dev/coverage_report.ts` to write `COVERAGE.md` with a cell for EVERY id in
  gates/thresholds.json, read from REVIEWS/evidence/**/<id>.json, with evidence commit, age (sessions), and a dependency hash
  of the source files the tool depends on (tools/dev/coverage_dep.ts exists: reuse it); NOT-MEASURED / STALE / FAIL-EXCEPTION /
  SUPERSEDED as §5 defines; the illusion-break rate first column (REVIEWS/escapes.md and the break log if present; NOT-MEASURED
  if absent); `tests/coverage_board.test.ts` regenerates and fails on any difference. Wire the board into `npm run guards` only if
  it stays fast (< 5 s) and deterministic; otherwise into test:fast.
  (3) **Tier 0** in node (tools/dev/tier0.ts): over the registry at 5 m (4 m transect), per cell: PLACEHOLDER/untiered objects in
  view distance, instance repetition in the view cone, collider vs drawn height, offline reachability (tools/dev/lib/offline_world.ts
  and walkers.ts exist); per-area summary JSON as evidence for the thresholds whose `tool` is tier0 (check thresholds.json for
  which ids name it; do NOT change any tool field or threshold); budget: it must run in <= 30 min in one cpu slot, else sample
  and say so. (4) `data/event_kinds.json` and `gates/budget.json` (the measured timings: t_load, t_test, t_high from recent
  runner logs/bench-reports; renderless throughput) if time remains.
- **Areas:** the whole walkable world (instrument work). **Files in scope:** tools/dev/areas.ts, tools/dev/tier0.ts,
  tools/dev/coverage_report.ts, tools/dev/coverage_dep.ts, tools/dev/lib/*, data/areas.json, data/event_kinds.json,
  gates/budget.json, COVERAGE.md, REVIEWS/evidence/s10-instruments/**, tests/areas.test.ts, tests/coverage_board.test.ts,
  package.json scripts. Read-only: src/** (import world builders the way offline_world.ts does). Do NOT edit gates/thresholds.json
  or the guard tests. Another agent (D-276) is adding Terrace rooms in src/arch/terrace.ts: your registry must pick up new
  buildings by reading the architecture, not by a hard-coded list.
- **Done means:** T-A6 and T-A6x have tool-written evidence (pass or fail, honestly); COVERAGE.md is generated with every
  threshold id and a test pins it; Tier 0 runs over at least the Terrace, one town quarter and one village with per-area
  results; the lead can regenerate all three with one documented command each (add them to HANDOFF.md's Tools section
  text in your report, not in HANDOFF.md itself). **UD ids:** UD-06, UD-07, UD-12, UD-16. **Reserved:** D-277, Q-740..Q-749,
  B88..B90. **Render budget:** 0 (renderless work; `?norender` pages through cpu_slot are allowed).
- **Context:** the lead's render queue is running (SwiftShader, ~2 cores). The box is shared: check `uptime` and `free -g`
  before any heavy run; one heavy process at a time via tools/dev/cpu_slot.sh, vitest with --maxWorkers=1; tests in the fast tier
  while working (`npm run test:fast`), the touched files once at the end. Symlink node_modules from /home/user/fars/node_modules.
  First run `git fetch origin claude/amazing-fermi-40ds7j && git merge origin/claude/amazing-fermi-40ds7j` if needed.
- Commit on your worktree branch with clear messages; put your full report in your final message (the lead copies it into REVIEWS/).
