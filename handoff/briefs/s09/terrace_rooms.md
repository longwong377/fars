# Brief: Terrace rooms (session 9, D-275 ring 1) — generated from handoff/agent_template.md

## Fixed clauses (copy verbatim)

You are a worker agent on PĀRSA (repo /home/user/fars, your own worktree branch; do not push). Read USER_DIRECTIONS.md,
MASTER_PLAN.md and CLAUDE.md first. The standard is every walkable area, at the player's lens and quality,
in motion, with sound, at every hour, season and weather. Your work serves the user directions UD-06, UD-08, UD-14, UD-16 and the thresholds T-D3 ("0 drawn outdoors while planned indoors"), T-D4 (people left undrawn for want of a room), T-A1 ("0 % untiered or placeholder pixels").

1. Say before you start how your change could pass its tests while the intent fails, and measure against that, not only the test.
2. Prefer the world-wide fix to the per-view fix. A fix proved in one view is not proved everywhere.
3. Evidence: node previews and CPU mirrors first; at most 2 browser runs through tools/dev/queue_e2e.sh.
4. Records: your reserved numbers are D-276, Q-730..Q-739, B85..B87; rows are appended, never renumbered.
5. Never lower or reword a threshold (tests/gates_ratchet.test.ts); a threshold you cannot meet goes to BLOCKERS with ≥ 3
   approaches measured.
6. Lead your final report with what is broken, placeholder or unverified on screen; list tests run with results; run
   `git checkout bench-reports/` before committing.
7. Heavy CPU work (soaks, bots, audio renders, bakes, long test runs) goes through `tools/dev/cpu_slot.sh`, one process at a
   time: the four cores are shared with the render lane.

## Slots
- **Task:** complete the Terrace's unbuilt interiors (src/arch/terrace.ts: "Treasury, Harem, Garrison (perimeter walls + key
  halls; C interiors)"): (1) the Treasury's rooms and courts beyond the Hall of 99 Columns and the N range (REF-PLAN / the site
  spec's footprints; rooms, corridors, storerooms with benches, doors of the attested widths), keeping the people's paths clear
  (the walk bots found standing people blocking its aisles: place standing spots off the aisles); (2) the Harem's room ranges
  beyond its main hall; (3) the garrison's quarters (rooms, hearths, sleeping places: today a perimeter wall round an open court)
  and the royal guard's sleeping places and the guards' mess (B63: ~250 people left undrawn at 23:00 for want of a room);
  (4) the Tripylon as a building site in 467 (under construction: chronology.json), if (1)-(3) are done. Geometry from
  research/SITE_SPEC.md / src/data/site_spec.json wherever a value exists (numbers before pictures); the rest reconstruction by
  analogy (tier C, reasoning visible in F3). Furnish rooms by use (stores: benches, jars, sealed doors; quarters: mats, hearths,
  lamps) with the town's fittings where they fit.
- **Areas:** the Terrace. **Files in scope:** src/arch/terrace.ts (and the arch helpers it uses), src/data/site_spec.json and
  research/SITE_SPEC.md (new values sourced and tiered), src/people/* only where Terrace rooms and indoor places are read
  (popgeo, indoor drawing: D-244), colliders/nav for these rooms (the nav grid bake if needed: tools/), tests.
- **Done means:** tests prove every room has walls with thickness, doorways >= 0.8 m and a roof where roofed; people_trace
  (tools/dev/people_trace.ts --gate, seeds 1 and 7, the court on) shows 0 people left undrawn for want of a room on the Terrace
  (B63) and T-D3 = 0; walk bots over the Terrace (tools/dev/walkers.ts) reach >= the session-8 93.3 % and no standing spot in an
  aisle; draw calls and triangles of the Terrace views (court-forecourt-w, court-apadana-n) measured before/after within their
  budgets; two renders at test quality: inside a Treasury storeroom and the garrison's quarters at night.
  **UD ids:** UD-06, UD-08, UD-14, UD-16. **Reserved:** D-276, Q-730..Q-739, B85..B87. **Render budget:** 2 browser runs.
- **Context:** the lead's render queue is full (tools/dev/queue_e2e.sh serialises it; expect waits). The box is shared: check
  `uptime` and `free -g` before any heavy run; one heavy process at a time via tools/dev/cpu_slot.sh, vitest with --maxWorkers=1;
  tests in the fast tier while working (`npm run test:fast`), the touched gate files once at the end. Symlink node_modules from
  /home/user/fars/node_modules. First run `git fetch origin claude/amazing-fermi-40ds7j && git merge origin/claude/amazing-fermi-40ds7j`.
- Commit on your worktree branch with clear messages; put your full report in your final message (the lead copies it into REVIEWS/).
