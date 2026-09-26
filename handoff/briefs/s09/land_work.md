# Brief: land_work (session 9) — generated from handoff/agent_template.md

## Fixed clauses (copy verbatim)

You are a worker agent on PĀRSA (repo /home/user/fars, your own worktree branch; do not push). Read USER_DIRECTIONS.md,
MASTER_PLAN.md and CLAUDE.md first. The standard is every walkable area, at the player's lens and quality,
in motion, with sound, at every hour, season and weather. Your work serves the user directions UD-07, UD-08, UD-14 and the thresholds T-J7 ("0 MISSING rows left unfilled where a probable reconstruction exists"), T-D5 ("0 herders or ploughmen without their animals"), T-F1 ("≥ 3 witnessable stages per system").

1. Say before you start how your change could pass its tests while the intent fails, and measure against that, not only the test.
2. Prefer the world-wide fix to the per-view fix. A fix proved in one view is not proved everywhere.
3. Evidence: node previews and CPU mirrors first; at most 1 browser runs through tools/dev/queue_e2e.sh.
4. Records: your reserved numbers are D-256, Q-710..Q-719, B80..B82; rows are appended, never renumbered.
5. Never lower or reword a threshold (tests/gates_ratchet.test.ts); a threshold you cannot meet goes to BLOCKERS with ≥ 3
   approaches measured.
6. Lead your final report with what is broken, placeholder or unverified on screen; list tests run with results; run
   `git checkout bench-reports/` before committing.
7. Heavy CPU work (soaks, bots, audio renders, bakes, long test runs) goes through `tools/dev/cpu_slot.sh`, one process at a
   time: the four cores are shared with the render lane.

## Slots
- **Task:** the work on the land the gap hunters found missing (WORLD_INVENTORY G11-G17, G30; rows A001-A007, A024, A505/A506,
  P-012, P-063, P-034, P-064, P-065, S-013): (1) cattle herds: cows and calves with a herdsman, grazing the river meadows and
  fallow, milked (a milking performance), penned at night; (2) fishing on the Pulvar, the Kur and the canals (a net or line from
  the bank, a fish trap; fish carried home; C); (3) fowling and snaring by boys and men at the reeds and field edges; (4) the
  quarrymen at Majdabad and Sivand (src/world/plain/quarries.ts: the workings are empty) cutting and dressing, and the column drums
  hauled across the plain to the Terrace on sledges or carts behind oxen, so the construction's supply (construction.ts's drum
  arrivals) is seen on the road; (5) wild nuts gathered on the slopes in Aug-Sep (plain.json says so) and acorns in autumn;
  (6) bee-keeping: hives in the gardens and villages, honey taken in season. And penning the flocks at night against the wolves
  (session 9 added wolves: src/world/beasts.ts; the flocks are not yet penned at night except the court's).
  Each as simulated activity (jobs, places, hours, seasons), performance, animals/props, sound, lint:activity pass, tiers.
- **Areas:** the plain, the rivers and canals, the quarries, the roads to the Terrace, the villages' edges. **Files in scope:**
  src/people/*, src/data/*.json, src/world/plain/quarries.ts, src/world/traffic.ts, src/world/fauna.ts (cattle drawn with the rig).
- **Done means:** lint:activity 0 placeholders; people tests; a 14-day soak's plansWellFormed; a node trace showing a drum's
  journey from the quarry to the Terrace and a herd's day; one render at test quality of the quarry at work or a drum on the road.
  **UD ids:** UD-07, UD-08, UD-14. **Reserved:** D-256, Q-710..Q-719, B80..B82. **Render budget:** 1 browser run.
- **Context:** WORLD_INVENTORY.md (session 9's merged gap hunt) lists these gaps with the hunters' row ids and evidence; read the
  rows named below and the two reports (REVIEWS/gap_hunt_s9_A.md, _B.md). The box is shared: check `uptime` and `free -g` before any
  heavy run (memory is the third bottleneck: CLAUDE.md working rules); one heavy process at a time via tools/dev/cpu_slot.sh,
  vitest with --maxWorkers=1; tests in the fast tier while working (`npm run test:fast`), the touched gate files once at the end.
- Commit on your worktree branch with clear messages; put your full report in your final message (the lead copies it into REVIEWS/).
