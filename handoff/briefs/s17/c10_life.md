# C10 life everywhere (cloud) — branch cloud-s17-c10-life; D-640, Q-1570..Q-1579, B670..B679
Read cloud_common.md first.
**The player sees by tonight:** wherever they stand, at any hour the sim says people are up, there are people living and
working in view, for reasons from their own lives (UD-08, UD-09, UD-26): fields worked in season (ploughing, sowing, weeding,
watering, reaping, threshing), roofs used (sleeping on summer nights, drying, spinning), courts busy (cooking, grinding,
weaving, children), doors with neighbours talking, wells and channels with water-carriers, workshops working, the market full
in the morning, the Terrace's guards, scribes, servants and petitioners, the building site's gangs; quiet at night, never empty
by day. No crowd copied: each figure is a person of the population on their own errand.
**Owns (what and where, not how they look):** src/people/population.ts, popgeo.ts, sim.ts, living/**, aims.ts, calendar.ts,
camps.ts, construction.ts, court.ts, courtYear.ts, roofs.ts, history.ts. NOT yours: how people look and move (Vagon V3:
human*, body*, drape, looks, outfits, anim, workAnims, mocap*, impostors, popview, crowd, activities' performances), talk
(converse/**), the roads' travellers (C3). A new activity kind needs V3's performance: ask in handoff/s17/asks_vagon.md.
**Start at:** a census first (tools/dev/life_census.ts, from the existing tools/dev/visible_week.ts, person_census.ts,
places_walkable.ts, household_day.ts): per coverage area and hour band, people in view (within 60 m of the coverage points),
share at work vs idle vs absent, the emptiest places by day. Then fill the emptiest from the sim (more of the population out of
doors and at their work where they would be; outdoor work places the sim lacks), never by spawning extras.
**Done:** no coverage point by day with nobody in view within 60 m where the sim has a reason for people to be (the census);
the soak (`npm run soak`, one process) still green; frame and memory within budget (C4).
