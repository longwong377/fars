# Brief: town walkability (session 9) — generated from handoff/agent_template.md

## Fixed clauses (copy verbatim)

You are a worker agent on PĀRSA (repo /home/user/fars, your own worktree branch; do not push). Read USER_DIRECTIONS.md,
MASTER_PLAN.md and CLAUDE.md first. The standard is every walkable area, at the player's lens and quality,
in motion, with sound, at every hour, season and weather. Your work serves the user directions UD-06, UD-08 and the thresholds T-H1r ("random reachable targets reached per area" >= 99 %), T-H1s ("bot time stuck" <= 0.5 %), T-D1 (0 interpenetrations > 0.2 m), quoted
verbatim from gates/thresholds.json.

1. Say before you start how your change could pass its tests while the intent fails, and measure against that, not only the test.
2. Prefer the world-wide fix to the per-view fix. A fix proved in one view is not proved everywhere.
3. Evidence: node previews and CPU mirrors first; at most 1 browser runs through tools/dev/queue_e2e.sh.
4. Records: your reserved numbers are D-249, Q-670..Q-679, B67..B69; rows are appended, never renumbered.
5. Never lower or reword a threshold (tests/gates_ratchet.test.ts); a threshold you cannot meet goes to BLOCKERS with ≥ 3
   approaches measured.
6. Lead your final report with what is broken, placeholder or unverified on screen; list tests run with results; run
   `git checkout bench-reports/` before committing.
7. Heavy CPU work (soaks, bots, audio renders, bakes, long test runs) goes through `tools/dev/cpu_slot.sh`, one process at a
   time: the four cores are shared with the render lane.

## Slots
- **Task:** make the lower town walkable for the player and its people. (a) Q-640: 767 of 10,583 town doors keep < 0.62 m clear
  because perpendicular walls meeting at a door's jamb vertex (and collinear runs extended by `hv`/`hu` in `Site.walls()`,
  src/world/settlement/site.ts) intrude into the 1 m door cell. Fix at the source: door placement (houseplan/quarter/compounds,
  wherever `p.door` / `site.doors` are chosen) avoids jamb vertices where a perpendicular wall meets, or moves the door one cell
  along its wall; and walls() never extends a wall into a door opening. Target: every door ≥ 0.8 m clear (excavated Achaemenid
  and Elamite doors 0.7–1.0 m, C). (b) Q-641: routes in src/world/settlement/walk.ts keep WALL_CLEAR 0.3 m from raster edges
  while walls are 0.5–0.7 m thick and centred on them: clearance = the wall's half thickness + 0.3 m; fittings with colliders
  (wells, troughs, walled props) marked in the site raster so routes avoid them.
- **Areas:** the lower town (all quarters), Persepolis West, compounds that share site.ts.
- **Files in scope:** src/world/settlement/*.ts, src/people/* only where they read town doors/routes, tools/dev/walkers.ts and
  lib/offline_world.ts (measurement), tests for these. Regenerate anything derived with the repo's tools (build_nav, probes,
  fire occlusion) if their parts-hash tests demand it (tests tell you).
- **Done means:** the walk bots (tools/dev/walkers.ts, via cpu_slot) show town T-H1r ≥ 99 % and T-H1s ≤ 0.5 % on ≥ 200 targets,
  evidence written by the tool into REVIEWS/evidence/s9-town-walk/; a door-clearance census (all doors, min/p1/median) written as
  evidence; the town house tests and people tests pass; tsc and `npm run guards` pass. If the town plan changes, report which
  derived data changed and that the soak's plansWellFormed still holds on one quick run (e.g. 14 days) — a full year soak is the
  lead's.
- **UD ids:** UD-06, UD-08. **Reserved numbers:** D-249, Q-670..Q-679, B67..B69. **Render budget:** 1 browser run (optional: one
  town lane view at test quality to confirm the doors read right).
- Commit on your worktree branch with clear messages; put your full report in your final message (you cannot write REVIEWS/
  outside the worktree reliably; the lead copies it).
