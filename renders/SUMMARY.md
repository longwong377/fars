# cloud eyes, s17: what the headless frames show (for the next cloud lead; sessions/s18-start.md)

Frames: renders/2026-10-03T02-45-cloud-gl2-0ec8352f/ (latest, cloud-s17-int 0ec8352f; 6 views) and the earlier
01-36 / 02-20 sets (329bbbb1; 5 views). Each index.md has a "what I see" column per view. How: renders/_tools/README.md.

Broken or placeholder first (0ec8352f):
- Town from 20 m: still ROOFLESS: open-top mud boxes with the room interiors showing, on a bare plain (no fields, gardens or
  paths at its edge). The biggest single CG read in these frames.
- Plain at noon, April: sparse confetti-scattered tufts on bare khaki soil (reads as late summer, not April after the rain);
  a flat grey puddle decal; a small black ring on the ground.
- Market q_s1 at 8 h: one empty stall (no seller or goods), a dark shadow rectangle painted on the wall behind the awning, an
  oversized smooth well-head; reads as a small square, not a market.
- Court interior (ask-c7-1): the camera is in the door jamb (re-frame); the room beyond is dark and reads empty.
- Grand Stair at 8.5 h: right shape; nobody on it; one mottled grey scan on steps, parapet and wall (not sun-bleached cream).
- C1 lane: the floating strip is fixed; the pick shows q_s1's DISTANT house level drawn 3-4 m from the eye (probes.txt).
- 329bbbb1 only: the river reads as a straight canal with a reed fence in the water; C5's shot 2 framed no Terrace (re-framed
  by C5 in d79650e6, not rendered).
Not rendered (time): 25 of the 31 view asks in asks_vagon.md (C2, C3, C6 all; C5 4-6 and new shot 2 -340,2610,88,150,-5,0,5.52;
C1 3-4; C7 2-6) and 4 of the 6 scoreboard views (sb-spawn-morning, sb-town-from-rahmat, sb-plain-rain, cov-142, cov-037).

Method facts: SwiftShader's WebGPU caps 16 sampled textures per fragment stage, so the terrain and hills fail there; use
?webgl=1 (32 units, no page errors). In dev, world-cache puts over 100 MB must be dropped in the page or Playwright's pipe
dies (this is also why coverage.spec hangs in the cloud). NOHMR=1. Page ready 8-18 min; a view 3-14 min on 4 cores.
