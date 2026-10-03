# C10 life everywhere: report (s17 cloud, D-640)

**Broken, placeholder or unseen first.** Nothing here is seen in a render yet (node census only). The road folk reach the
screen only when world.ts calls `sim.pop.shareFolk()` before `new Traffic(seed, sim.pop, ...)` (world.ts:474, the lead's
line, asked); until then they stay the traffic's extras. The plain's fields, river banks and the far Kur stay mostly empty
within 60 m at any one moment (B670: the plain's real density); within 250 m the fields have someone ~36 % of moments. The
keepers' house at Naqsh-e Rustam is not built (inside it they are not drawn). Plain villages' population coordinates and
built sites lie up to 33 km apart, so the plain's walks to town are mistimed (Q-1570, not fixed). Pre-existing red on the base
too (not mine): religion (3), land_work planCheck, people_children lame/blind, popview impostors.

**What a player now sees.** Field workers all round each village instead of on one side; children and servants gathering
brushwood on Kuh-e Rahmat and the state flock grazing its lower slope (the fuel run used to put them at the burial ground);
gardeners in the paradise of Bagh-e Firuzi and the orchards; two magi and their young men keeping Darius' tomb, its sheep below
the cliff; ~2,300 road folk a dry day as people of the population (talkable once handed over).

**Census** (tools/dev/life_census.ts, seed 1, 19 daytime moments x 515 points): points with a reason empty at every moment
91 → 39; nobody within 250 m at every moment 65 → 16; point-moments empty 30 % → 25 %.

**Files:** src/people/population.ts, popgeo.ts, calendar.ts (a re-entry guard), popview.ts (folkView + one anchor: the lead
assigned the road folk's placement to C10), tools/dev/life_census.ts; DECISIONS D-640, Q-1570/1571, B670.

**Tests:** road_folk 7/7; planCheck on the road folk's days 0 issues (120 days, 1 in 5); typecheck clean; soak: see commit.
