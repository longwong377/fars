# The day's cost (D-388, UD-30)

Node, cloud box (4 cores), seed 1, the game's options (`bonds: true, asks: true`), a cached world (`tests/sim_fixture.ts`
simAt) loaded at day 100 and day 280, then 21 days stepped one at a time: `econTo(d + 1)` (what reading day d's plans
needs), then `Population.plan(pid, d)` for the sim's 135 agents. Tool: `npx tsx tools/dev/day_cost.ts <seed> <day> <days>`
(`SLICE=<ms>` steps through `LivingWorld.advanceSliced`; `HASH=1` prints a digest of `E.events` and `sim.save()`).
Means (max) in ms per day over days 2-21 (the first day after a load is shown apart). Before = 3437ca0, after = that plus
this change; both re-checked on 8943287 after the merge (same digests).

| part | d101-121 before | after | d281-301 before | after |
|---|---|---|---|---|
| economy step (stranger inside: ~0) | 16.3 (37) | 14.5 (28) | 22.1 (43) | 23.5 (43) |
| relations (one week in seven) | 27.0 (186) | 27.0 (196) | 27.6 (189) | 27.4 (184) |
| living talk | 352 (444) | 346 (457) | 225 (338) | 233 (299) |
| asks (book) | 39.1 (63) | 34.5 (48) | 37.2 (48) | 34.0 (41) |
| rumours (incl. the stranger's news) | 37.6 (58) | 22.8 (48) | 47.5 (87) | 28.9 (55) |
| trust 'heard' pass | 1.0 (3.9) | 0.9 (2.5) | 1.1 (3.3) | 1.1 (3.9) |
| **advance, all** | **473 (664)** | **447 (700)** | **361 (524)** | **349 (563)** |
| plans read (135 agents; EconPlans.steps 32-45 of it) | 592 (745) | 577 (712) | 559 (820) | 582 (875) |
| first day after a load: advance | 4605 | 4203 | 9022 | 8858 |
|  of it: the relations re-derived from day 0 | 3363 | 3216 | 7498 | 7881 |
|  of it: the ask book and rumour net built and loaded | 406 | 145 | 941 | 342 |

Equivalence: the same `E.events` and `sim.save()` digests before and after, on the jumped path (SIM_FIXTURE=0) and the
loaded path, whole or sliced (SLICE=2/3/4 ms), at days 100 (10 and 21 days), 280 (20 and 21 days); `tests/day_slice.test.ts`.

## Where the day goes

Two thirds of a day is people's plans being drawn (`Population.rawPlan` -> the Planner, ~0.45 ms each; ~2000 a day in the
talk's meetings and errands, 2000-10000 in the morning's plan reads through the washing's quarter pass, `nobodyWith`). Those
live in population.ts and wardrobe/washing.ts, not this package's files; the talk's own logic is small beside them. The rest:
the economy step (economy/world.ts), the relations' weekly step (relations/world.ts) and its re-derivation from day 0 after
every load (~3-8 s, the save keeps only the player's acts), haggleRound (~60 ms a day, speech/haggle.ts).

Cut here (behaviour identical): the rumours' live holds read from a running index instead of a scan of every hold of every
rumour still told, each day; the quarter's run of sickness filtered only when its oldest day falls out (it was filtered at
every hearing); the ties' places in the lanes from a map (was indexOf); the 'heard' pass over the rumours still told (was every
rumour of the year); the child-lost draw before counting a house's little ones (was a count for all 10 000 houses a day);
the loads of the ask book and the rumour net copied with a JSON-exact deep copy ~4x faster than the JSON round trip.

## Sliced

A day still costs ~350-450 ms (and ~600 ms of plan reads), so it is sliceable: `PeopleSim.stepAhead(ms)` steps the living
world to the day after tomorrow a part at a time (the relations' week; the economy's step; each meeting of the talk; the ask
book every 1024 houses and 128 asks; the rumours every 8 told; the heard pass), then reads tomorrow's plans of the sim's
people one by one (the caches warmed). Any read of the economy meanwhile (`econTo`, `economy()`, a save) finishes the day
begun first; a plan's read of a day already begun does not. With a 4 ms budget: 53-85 calls a day; the parts over 30 ms are
whole units that are not this package's: the relations' week (~190-230 ms, one day in seven), the economy's step (15-45 ms),
a rare meeting whose errand draws several plans (p95 1.5 ms, max ~55 ms), and the first day after a load (relations from
day 0).

The call for the render side (Vagon session): once per frame, after the frame's own work,
`if (frameLeftMs > 2) sim.stepAhead(Math.min(4, frameLeftMs - 1));` (returns true when tomorrow is ready; a no-op then).
Not wired here.

Also seen: a loaded world does not continue as the same world kept running (digests differ between the jumped and the
loaded path, before and after this change alike); the save at day 280 carries ~370 000 rumour holds (~63 MB of JSON).
