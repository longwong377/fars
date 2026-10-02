# C9 the walk (cloud) — branch cloud-s17-c9-walk; D-630, Q-1560..Q-1569, B660..B669
Read cloud_common.md first.
**The player feels by tonight:** moving through Pārsa feels like a top modern open-world game's first person: a body with
weight (acceleration and stopping, not a sliding camera), walking pace by default and a slower careful pace (no sprint
needed beyond a brisk walk, §1.1), a head that moves with the steps (subtle bob and sway, settling when still), stairs and
slopes climbed with the body's rhythm (the Grand Stair's low risers felt), no snagging on door frames, props, people or
terrain seams, smooth mouse and gamepad look, a field of view and camera height that make true scale read (1.6 m eye),
crouching through low doors, the body's own feet and shadow when looking down if the people's kit allows. No HUD.
**Owns:** src/player/**, src/core/input.ts, src/world/solids.ts (collision with people and animals). Footstep events for C8's
sound (one hook). The people's models are V3's (Vagon); ask, don't edit.
**Start at:** src/player/player.ts, physics.ts, body.ts; tools/dev/walkers.ts, pathcheck.ts, navcheck.ts, routecheck.ts (the
walk bots). Measure first with a node walker over the coverage routes: snags (stuck > 0.5 s), unwalkable doors, stair
cadence, camera jerk (frame-to-frame angular acceleration).
**Done:** the walk bots cross every coverage area with no snag; every door the nav grid marks enterable is entered; the head
motion and pace tuned and recorded in DECISIONS; tests green.
