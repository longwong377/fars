# s18 cloud C1: the new-day tick (D-650)

## Broken, placeholder, unseen (first)
- **Not wired yet: nothing changes in the game until the lead adds two lines to src/world/world.ts** (not my file):
  `sim.aheadMs = 4;` after `sim.routeSearchesPerStep = 1`, and in `simulate` `sim.jumpTo(target, dt > 0 ? 8 : 0)` for the jump
  branch (a test `__parsa.tick()` runs with dt 0 and still jumps whole, so the scoreboard's frames are unchanged). Measured in
  the page with exactly that patch applied locally (then reverted).
- **The total work of a long jump is not smaller.** +180 days is still ≈ 60 s of CPU in the page (≈ 100 s node); it is spread
  over frames (≈ 4,500 frames) while the people wait where they were. The scoreboard train's wall time per far state is the same.
  It cannot be cached or moved to a worker today: a save and its load are not the same world (≈ 1 % of the plans differ after a
  round trip), so any checkpoint would change the people.
- **One-piece parts left (not my files):** EconPlans.steps (economy/plans.ts) ≈ 0.8 s once per game day (now in the evening
  before, not at midnight: still a hitch); the relations' weekly step ≈ 0.16-0.2 s; the relations re-derived from week 0 after a
  load (≈ 0.6 s + 0.16 s a week); the trees' day rebake on any day change (trees/render.ts setDay, ≈ 1.7 s in the page).
- **Tests failing before this change (unchanged by it):** people_days "girls of 9-13" (120 s timeout, also at the base), day_slice "same events and save" (the minds' save holds wall-clock
  counters, deeds.agency.st), sim_fixture "loads what the jump made", living_world "player deeds spread…" and "save mid-week…"
  (the save/load round trip). tools/dev/day_cost.ts times relDay as a function; it is now a generator, so its "relations" row
  reads ~0 (relations.advance stays right).
- The new-game start (day 5-17 for the pool seeds) still steps its days whole in the first world tick (≈ 2-6 s node): the
  world's first jump (`!simStarted`) stays whole in the suggested wiring, so it lands in the load, not in play.

## What changed
- src/people/sim.ts: `jumpTo(t, sliceMs = 0)` (sliced: the living world to the target's next morning, then the people's plans
  warmed, within ~sliceMs a call; `catchingUp` true meanwhile; returns true when made), `aheadMs` (D-388's stepAhead each step),
  `warmPlans`. Defaults keep the old behaviour.
- src/people/living/world.ts: the relations' days stepped a week a part (the first day's ~1.1 s set-up and two weeks).
- tests/day_jump.test.ts: sliced jump = whole jump (from a cached world day 60→64 and from a new world day 0→3); midnight with
  aheadMs = midnight on demand (events and save, the minds' timers aside); tomorrow made before midnight.
- tools/dev/jump_bench.ts: the before/after.

## Measured (node, seed 1, bonds + asks; SLICE 8 ms)
| jump | before: one call | after: calls, longest call, placing call |
|---|---|---|
| day 0 → 1 | 1.3-2.3 s | 30-35 calls, 0.44-0.71 s, 3-4 ms |
| day 1 → 181 | 90-103 s | 8,091 calls, 1.05 s, 21 ms |
| day 181 → 365 | 105 s | 8,310 calls, 1.39 s, 25 ms |
| midnight (30-s steps) | longest step 1.78 s at 0:00 | 0.91 s at 0:44 (EconPlans.steps for the day after) |

In the page (cloud, ?norender, court seasonal): before, setTime + tick: +1 day 0.98 s, +60 days 20.5 s (one frame). After (wired
locally): +1 day 8 frames, worst 0.51 s; +60 days 1,593 frames, median 29 ms, worst 2.2 s (the trees' rebake), 2nd 0.86 s;
+180 days 4,502 frames, median 44 ms, worst 1.6 s, 2nd 0.81 s (with a node bench sharing the CPU).
