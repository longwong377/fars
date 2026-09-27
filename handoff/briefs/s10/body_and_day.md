# Brief: the body and the day (session 10; gap hunter C's people gaps) — generated from handoff/agent_template.md

## Fixed clauses (copy verbatim)

You are a worker agent on PĀRSA (repo /home/user/fars, your own worktree branch; do not push). Read USER_DIRECTIONS.md,
MASTER_PLAN.md and CLAUDE.md first. The standard is every walkable area, at the player's lens and quality,
in motion, with sound, at every hour, season and weather. Your work serves the user directions UD-07, UD-08, UD-14, UD-16 and the thresholds T-J7 ("0 MISSING rows left unfilled where a probable reconstruction exists").

1. Say before you start how your change could pass its tests while the intent fails, and measure against that, not only the test.
2. Prefer the world-wide fix to the per-view fix. A fix proved in one view is not proved everywhere.
3. Evidence: node previews and CPU mirrors first; at most 2 browser runs through tools/dev/queue_e2e.sh.
4. Records: your reserved numbers are D-292, Q-760..Q-769, B94..B96; rows are appended, never renumbered.
5. Never lower or reword a threshold (tests/gates_ratchet.test.ts); a threshold you cannot meet goes to BLOCKERS with ≥ 3
   approaches measured.
6. Lead your final report with what is broken, placeholder or unverified on screen; list tests run with results; run
   `git checkout bench-reports/` before committing.
7. Heavy CPU work (soaks, bots, audio renders, bakes, long test runs) goes through `tools/dev/cpu_slot.sh`, one process at a
   time: the four cores are shared with the render lane.

## Slots
- **Task:** fill the people-side gaps a third gap hunter found (REVIEWS/gap_hunt_s10_C.md; WORLD_INVENTORY.md rows named below),
  each as the most probable reconstruction (D-207), tiered and visible in F3, in this order: (1) visible pregnancy (C-D09): women
  whose birth (population.ts births, E-70) falls within the next ~4 months carry a belly, drawn on the body and its garments by a
  per-instance displacement in the humans' shader (src/people/humanGPU.ts, humanMaterial.ts, drape.ts) that is continuous with
  the months, never on a woman who gives no birth; the women who give birth in the first months after the simulated year are
  pregnant in its last months too; (2) bodily care: washing face and hands at the jar in the court at rising, a man shaved or
  his beard trimmed by a barber in the lane now and then, combing and delousing a child on the doorstep (C-D04..C-D07; GC6, GC20),
  keeping the morning's timing tests green; (3) the Persians' washing rule: guards and Persian men wash clothes on the bank with
  water drawn in a jar, never in the stream (C-D46: Herodotus 1.138, B claim, population.ts "washing his clothes at the river");
  (4) the herd boy's sling (GC27), a lullaby hummed (wordless) at a baby's bedtime (GA29, C-D30), a courtship glance and word at
  the well (GC24), a quarrel that comes to blows and is pulled apart, rarely (GC25), injuries (a cut hand bound, a limp after a
  kick: GC23) if time remains. Evidence standard: CLAUDE.md §12 (kurtaš labour, children, punishment: as evidence, not sensational).
- **Areas:** everywhere people live (town, plain, Terrace). **Files in scope:** src/people/* (population.ts day plans, activities.ts,
  props.ts, workObjects.ts, humanGPU.ts, humanMaterial.ts, drape.ts, looks.ts), src/audio/voices.ts (the lullaby), src/data/lives.json,
  tests. Another agent (D-276) edits the garrison/guard plans in population.ts and the Terrace rooms: merge its branch in first if
  it has landed (git fetch; git merge origin/claude/amazing-fermi-40ds7j), and keep your population.ts edits local to the functions
  you change.
- **Done means:** tests (people_days, activities, the new ones) green; a node trace (tools/dev/people_trace.ts or a new small tool)
  showing, for seed 1 over 6 sampled days: the share of women 15-44 visibly pregnant (target 3-6 %), morning washes per household,
  shaves per man per month, no Persian washing in a stream; one render at test quality of a lane in the morning with a pregnant
  woman in view (ONLY a moment you add to tests/e2e/moments.spec.ts). **UD ids:** UD-07, UD-08, UD-14, UD-16. **Reserved:** D-292,
  Q-760..Q-769, B94..B96. **Render budget:** 2 browser runs.
- **Context:** the render queue is shared and busy (tools/dev/queue_e2e.sh; waits of up to an hour). Check `uptime` and `free -g`
  before any heavy run; one heavy process at a time via tools/dev/cpu_slot.sh, vitest with --maxWorkers=1. Symlink node_modules
  from /home/user/fars/node_modules. First run `git fetch origin claude/amazing-fermi-40ds7j && git merge origin/claude/amazing-fermi-40ds7j`.
- Commit on your worktree branch with clear messages; put your full report in your final message (the lead copies it into REVIEWS/).
