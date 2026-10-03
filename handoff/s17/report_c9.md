# C9 the walk (cloud, s17), D-630

**Broken, placeholder or unseen first**
- Not yet seen in a browser. Every number below comes from node runs with the offline world; no frames have been rendered.
- Packed standing crowds block the walk. On the Terrace the bots reach 34/40 targets: the Treasury N court and the Harem W entrance hold 15-20 passers-by within 2.5 m, 0.4-0.6 m apart. With people present, 12/130 Terrace doors and 45/594 town street doors are blocked by someone standing in a 1.0-1.4 m opening. Asked V3/C10 (asks_vagon.md) for people to keep apart and make way.
- Town: 38/40 (the 2 misses are a pen plot in q_s2 the town walk graph cannot route into: C1). Ajori: 16/30, with straight-line bots stopped by a 39 m building and "through a wall" raster flags in the paradise. The baseline was 17/30 with 38 such flags, so this is pre-existing and not the walk's. Fields: 34/40, also straight-line bots meeting compound walls.
- Banks (river edges) not measured: the bot run hit its 83-min time limit before reporting.
- Crouched, the visible body is hidden (the kit has no crouch pose): PLACEHOLDER in that state only.
- tests/plain.test.ts fails (106 meshes > 40); it fails the same way on cloud-s17-int.

- **Final run on cloud-s17-int (00:20 UTC, with V3's people and everyone's merges), day 25 at 10:00:** Terrace 36/40
  (was 34; the 4 misses are still people), town 35/40 (2 are the unroutable q_s2 pen; 2 are new 3.6 x 0.7 m colliders,
  box 1.81x~2x0.35, standing on the town route's lane at (-819.8, -1168.1) and (-856.6, -1135.6), arrived with today's
  merges: the walk's owners C1/C4 should check them; 1 is a passer-by in a lane). Doors with people: Terrace 118/130,
  street 555/598, inner 502/503; 37 failures touch a person standing in the opening. The V3/C10 ask for standing people
  to make way still holds.

**What a player now notices**
- Weight: the body starts and stops over about a step. Paces: careful 0.8 m/s (Alt), walking 1.35, brisk 1.95 (Shift; was a 3.2 jog). Crouch is C. Slopes slow the body.
- The head bobs ±1.8 cm, lowest at each footfall, and settles when you stop (it used to freeze mid-bob). Sway, a landing dip and a breath at rest.
- Stairs climb at walking pace with a gliding eye. On the Terrace routes the eye's worst jolt per frame is now ≤ 6 mm across (was 20-31) and ≤ 16 mm up and down (was 60). Feet no longer sink 7-10 cm into the floor.
- No snags: the walk eases round people and edges and gets unstuck from mesh faces. walkfeel: 125/125 targets, 0 snags (was 117/125, 15 snags).
- Doors without people: Terrace 130/130, doors inside town plots 506/506, town street doors 594/594.
- Bots with people (before → now): town stuck time 29.5 % → 1.3 %, camps reached 77 % → 97 %. Approach, roads, villages, burial and compounds: 100 %.
- Gamepad and raw mouse with spike filtering.
- Footfall events (Player.onStep) for C8, plus player.groundKind and player.roofed.

**Views asked:** none. **Files:** src/player/{player,motion,body}.ts, src/core/input.ts, tests/{walk_feel,solids,defaults}.test.ts, tools/dev/{walkfeel,doorwalk,walk_spot}.ts, tools/dev/walkers.ts and tools/dev/lib/offline_world.ts (the bots' pace and who blocks them). Hooks in files I don't own: main.ts (head offset, input.active, body height), settings.ts (keys slow/crouch), shell.ts (key labels), world.ts (footsteps' running flag).
**Tests:** walk_feel 13/13; solids, physics, terrain_walk, doors, defaults and now_view pass; guards pass.
