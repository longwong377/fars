# C5 crowds, doors and the walk (s18 cloud), D-690

**Broken, placeholder or unseen first**
- Not seen in a browser. Every number is from node runs on the offline world (tools/dev/lib/offline_world.ts), day 25 10:00, people on.
  How the step aside looks (a shuffle at 0.6 m/s through the walk gait, the body turned, the head's 'turn' reaction) is unseen.
- Packed places now leave people undrawn rather than stacked: the royal kitchens' court ~82, the Tachara's court ~43, the Treasury N
  court ~27, the Harem W entrance ~9 (standcensus.ts, within 6 m of each spot). One spot is shared by 100+ people in a court too small
  for them at 1 m; the real fix is more spots per place (popgeo/population, not mine): ask below.
- 4 of 399 town street doors still fail the door walk with people on, none touching a person (B690): q_w1 plot 141 also fails with
  nobody about (a wall collider across the door); 3 pass walked alone and fail late in the long run with a box at the jamb (likely a
  town door leaf shut by its household's hours as the run's clock moves).
- Town bots seed 2: 39/40, stopped by a small animal lying in a q_s2 lane (solids.ts makes small animals solid). Terrace bot stuck
  time 1.6-5 % of bot time (gate T-H1s 0.5 %): the bots wait for people stepping aside in the packed courts.
- Detailed agents (sim.ts, the 135 on the Terrace) do not make way: not my file. None blocked a door in the runs.
- Pre-existing test failures, identical on s17-int: popview (impostor child width), court_view (pop-in), people_care (2),
  people_children (2).

**What a player now meets (measured)**
- Nobody stands in a doorway or its apron (1.5 m either side): door passages blocked by a person 35 -> 0. Doors walked both ways with
  people: Terrace 118 -> 130/130, rooms 326 -> 330/330, town street doors 367 -> 395/399.
- People standing keep about a metre apart (nearest-neighbour median 0.34-0.75 m -> 1.04-1.25 m at the crowded places; under 0.6 m:
  27/16/77 at the Treasury court/Tachara/kitchens -> 0). Groups at a talk, rest, game or meal face their middle.
- Walk up to someone standing and they make way: within 2.4 m (3.2 m by a doorway) they step up to 0.85 m off your way, to the side
  they stand on (never across it), turned toward you, the head following; they step back once you pass. Up to 15 at once in a court.
- Walk bots with people: Terrace 40/40 on two seeds (s17: 36/40); town 40/40 (seed 1), 39/40 (seed 2).
- The s17 "unexplained" q_s2 misses: (1) q_s2's pen 180 holds leftover ground walled off from its door, which no body can reach; the
  bots no longer sample such cells (walkers.ts: reachFromDoor); (2) in q_s2's 1.4 m lanes a person by one wall stepped across the
  walker's way into the gap left and pinned the body against the other wall: fixed (never across).
- Frame cost: popview update ~7 ms on the Terrace in node vs ~9.6 ms on s17-int (budgets included).

**Files:** src/people/popview.ts (SEP, SPREAD_R, DOOR_CLEAR, inDoor, setDoorways, makeWay), src/people/crowd.ts (the head turned while
making way), tools/dev/doorwalk.ts (who blocks, --only, --trace), tools/dev/walkers.ts (reachable plot cells), tools/dev/standcensus.ts
(new), tools/dev/lib/offline_world.ts (setDoorways), tests/popview.test.ts (the spread bound reads SPREAD_R). DECISIONS D-690, BLOCKERS B690.
**Asks:** world.ts after `new PopView(...)`: `view.setDoorways(doorways);` (else the view builds the doorways itself once, ~0.1 s).
popgeo/population owner: more standing spots per crowded Terrace place (court_kitchen, court_tachara, the Treasury N court).
