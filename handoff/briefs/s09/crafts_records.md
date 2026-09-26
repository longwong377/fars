# Brief: crafts_records (session 9) — generated from handoff/agent_template.md

## Fixed clauses (copy verbatim)

You are a worker agent on PĀRSA (repo /home/user/fars, your own worktree branch; do not push). Read USER_DIRECTIONS.md,
MASTER_PLAN.md and CLAUDE.md first. The standard is every walkable area, at the player's lens and quality,
in motion, with sound, at every hour, season and weather. Your work serves the user directions UD-07, UD-08, UD-14 and the thresholds T-J7 ("0 MISSING rows left unfilled where a probable reconstruction exists"), T-F7a ("0 placeholder performances"), T-D2s ("0 stand frames for active work").

1. Say before you start how your change could pass its tests while the intent fails, and measure against that, not only the test.
2. Prefer the world-wide fix to the per-view fix. A fix proved in one view is not proved everywhere.
3. Evidence: node previews and CPU mirrors first; at most 1 browser runs through tools/dev/queue_e2e.sh.
4. Records: your reserved numbers are D-255, Q-700..Q-709, B77..B79; rows are appended, never renumbered.
5. Never lower or reword a threshold (tests/gates_ratchet.test.ts); a threshold you cannot meet goes to BLOCKERS with ≥ 3
   approaches measured.
6. Lead your final report with what is broken, placeholder or unverified on screen; list tests run with results; run
   `git checkout bench-reports/` before committing.
7. Heavy CPU work (soaks, bots, audio renders, bakes, long test runs) goes through `tools/dev/cpu_slot.sh`, one process at a
   time: the four cores are shared with the render lane.

## Slots
- **Task:** the crafts and record-keeping acts the gap hunters found missing or faked (WORLD_INVENTORY G26, G27, G28, G29, GB4,
  GB13; hunters' rows A095/B-037 smith, A096/P-039 goldsmiths, A098/B-056/P-014 tanning, A099/P-047 seal cutting, B-009 sealing,
  B-095/P-022 silver weighed as `inspect`, A045/P-010 sesame-oil pressing): (1) a smith working the lit forge (hammer on anvil,
  bellows, quench) with its sound (a hammer and bellows strike kind); (2) goldsmiths chasing and forging at the Treasury, not only
  polishing; (3) silver weighed on a balance with weights (a balance prop and a weighing performance; a detector escape to log in
  REVIEWS/escapes.md: the activity lint passed `inspect`); (4) the act of sealing: a tablet or a bulla rolled with a cylinder seal
  or stamped; (5) seal cutters at a workshop bench; (6) a tannery at the town's downwind edge by water: hides soaking, scraping,
  drying frames, its smell's visible trace (flies, if the flies exist); (7) a sesame-oil press and oil jars feeding the lamps.
  Each as a simulated activity with jobs, places and hours (population.ts, activities.ts), a performance (workAnims, props,
  workObjects), a sound, a lint:activity pass, evidence tiers (A/B/C with sources in research files).
- **Areas:** the town's workshops, the Treasury, Persepolis West. **Files in scope:** src/people/*, src/data/*.json for the
  activities and places, src/audio/soundscape.ts for strike kinds, src/world/settlement/* only to place a tannery or press.
- **Done means:** lint:activity 0 placeholders with the new activities; people tests and the soak's plansWellFormed on a 14-day run;
  a node trace shows each new activity performed by named people at their places and hours; one render at test quality of the
  forge or the weighing. **UD ids:** UD-07, UD-08, UD-14. **Reserved:** D-255, Q-700..Q-709, B77..B79. **Render budget:** 1 browser run.
- **Context:** WORLD_INVENTORY.md (session 9's merged gap hunt) lists these gaps with the hunters' row ids and evidence; read the
  rows named below and the two reports (REVIEWS/gap_hunt_s9_A.md, _B.md). The box is shared: check `uptime` and `free -g` before any
  heavy run (memory is the third bottleneck: CLAUDE.md working rules); one heavy process at a time via tools/dev/cpu_slot.sh,
  vitest with --maxWorkers=1; tests in the fast tier while working (`npm run test:fast`), the touched gate files once at the end.
- Commit on your worktree branch with clear messages; put your full report in your final message (the lead copies it into REVIEWS/).
