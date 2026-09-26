# Brief: villages (session 9) — generated from handoff/agent_template.md

## Fixed clauses (copy verbatim)

You are a worker agent on PĀRSA (repo /home/user/fars, your own worktree branch; do not push). Read USER_DIRECTIONS.md,
MASTER_PLAN.md and CLAUDE.md first. The standard is every walkable area, at the player's lens and quality,
in motion, with sound, at every hour, season and weather. Your work serves the user directions UD-06, UD-08, UD-14 and the thresholds T-A1 ("0 % untiered or placeholder pixels"), T-D3 ("0 drawn outdoors while planned indoors"), T-J7 ("0 MISSING rows left unfilled where a probable reconstruction exists").

1. Say before you start how your change could pass its tests while the intent fails, and measure against that, not only the test.
2. Prefer the world-wide fix to the per-view fix. A fix proved in one view is not proved everywhere.
3. Evidence: node previews and CPU mirrors first; at most 1 browser runs through tools/dev/queue_e2e.sh.
4. Records: your reserved numbers are D-254, Q-690..Q-699, B74..B76; rows are appended, never renumbered.
5. Never lower or reword a threshold (tests/gates_ratchet.test.ts); a threshold you cannot meet goes to BLOCKERS with ≥ 3
   approaches measured.
6. Lead your final report with what is broken, placeholder or unverified on screen; list tests run with results; run
   `git checkout bench-reports/` before committing.
7. Heavy CPU work (soaks, bots, audio renders, bakes, long test runs) goes through `tools/dev/cpu_slot.sh`, one process at a
   time: the four cores are shared with the render lane.

## Slots
- **Task:** the 39 villages of the plain (src/world/plain/villages.ts; flagged `placeholder: true`: "merged vertex-coloured boxes: no
  walls with thickness, doors, roofs, courts, ovens, pens, people or night light"; B64: village rooms are solid boxes, so sleepers
  are drawn inside solid geometry) become real places: compounds with walls of thickness and doorways a body fits through, flat
  roofs with ladders, a court with an oven, a hearth, storage bins and jars, an animal pen, a threshing floor at the village edge,
  night light from doorways and hearths, varied per compound (no copy-paste: MASTER_PLAN T-E5). Reuse the town's house generator
  (src/world/settlement/houses.ts, houseplan.ts, site.ts; D-234, D-249's door rules) at village scale where it fits; keep the
  people's village rasters and the drawn compounds in agreement (D-237 found them disagreeing at village_p22). Remove the
  placeholder flag only when no box remains. Villages are C (Sumner's sites for place; the form by analogy: tier it).
- **Areas:** every village of the plain. **Files in scope:** src/world/plain/villages.ts and what it builds, src/world/settlement/*
  for reuse (without changing the town's output: its tests and derived data must not move), src/people/* only where village
  homes and rooms are read, colliders/nav for villages, tests.
- **Done means:** tests prove each village compound has walls with thickness, doorways ≥ 0.8 m, a court, an oven and a pen, and
  that sleepers are drawn inside rooms that exist (T-D3 over village people: tools/dev/people_trace.ts); the draw-call and triangle
  cost of the plain view measured before/after (plain.spec budget views); one render at test quality of a village by day and at
  dusk. **UD ids:** UD-06, UD-08, UD-14. **Reserved:** D-254, Q-690..Q-699, B74..B76. **Render budget:** 1 browser run.
- **Context:** WORLD_INVENTORY.md (session 9's merged gap hunt) lists these gaps with the hunters' row ids and evidence; read the
  rows named below and the two reports (REVIEWS/gap_hunt_s9_A.md, _B.md). The box is shared: check `uptime` and `free -g` before any
  heavy run (memory is the third bottleneck: CLAUDE.md working rules); one heavy process at a time via tools/dev/cpu_slot.sh,
  vitest with --maxWorkers=1; tests in the fast tier while working (`npm run test:fast`), the touched gate files once at the end.
- Commit on your worktree branch with clear messages; put your full report in your final message (the lead copies it into REVIEWS/).
