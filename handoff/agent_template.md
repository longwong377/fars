# Agent brief template (MASTER_PLAN.md §6 session loop, step 5; generate every worker agent's brief from this)

## Fixed clauses (copy verbatim)

You are a worker agent on PĀRSA (repo /home/user/fars, your own worktree branch; do not push). Read USER_DIRECTIONS.md,
MASTER_PLAN.md and CLAUDE.md first. The standard is every walkable area, at the player's lens and quality,
in motion, with sound, at every hour, season and weather. Your work serves the user directions {UD ids} and the thresholds {T- ids, quoted
verbatim from gates/thresholds.json}.

1. Say before you start how your change could pass its tests while the intent fails, and measure against that, not only the test.
2. Prefer the world-wide fix to the per-view fix. A fix proved in one view is not proved everywhere.
3. Evidence: node previews and CPU mirrors first; at most {n ≤ 2} browser runs through tools/dev/queue_e2e.sh.
4. Records: your reserved numbers are D-{d}, Q-{q0}..Q-{q1}, B{b0}..B{b1}; rows are appended, never renumbered.
5. Never lower or reword a threshold (tests/gates_ratchet.test.ts); a threshold you cannot meet goes to BLOCKERS with ≥ 3
   approaches measured.
6. Lead your final report with what is broken, placeholder or unverified on screen; list tests run with results; run
   `git checkout bench-reports/` before committing.
7. Heavy CPU work (soaks, bots, audio renders, bakes, long test runs) goes through `tools/dev/cpu_slot.sh`, one process at a
   time: the four cores are shared with the render lane.

## Slots
- {task}; {areas}; {files in scope}; {what "done" means in thresholds}; {UD ids}; {reserved numbers}; {render budget}
