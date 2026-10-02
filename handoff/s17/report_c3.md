# C3 life on the roads — report (cloud, s17; D-570)

**Broken / placeholder / unseen first**
- Nobody on the roads can be talked to: road folk and drivers are crowd extras, which talk and voices skip (crowd.ts nearPeople, pid < 0). Each mover carries `life` (name, role, home, livelihood) for a hook there (not C3's files).
- Unseen: nothing rendered yet; seven views asked in asks_vagon.md.
- Travellers appear and vanish at the Grand Stair's foot after a stay. 150–210 are alive at once (~70–100 extras within 750 m): Vagon's budget should check this.
- No moving flocks (herders graze the verges) and no stone carts: both wait on V3/V5 variants (asked).
- Hinterland households are their own register, not the population: their errands come from the calendar, not the economy.
- tests/land_work.test.ts fails on clean cloud-s17-int too, so it's pre-existing.

**What a player sees**: all four roads busy in dry daylight: strings, baskets, jars, brushwood, ox carts, festival families, traders and camels. People go in at morning and home in the afternoon, halt by the road and sell at the stair foot. Herders graze the verges. The court's camps have things before every tent and picket lines of animals. The Hall of 100 Columns has an earth ramp with a drum on rollers. When the court arrives, its baggage train fills the royal road, and leaves the same way.

**Census** (road_census.ts): roads were empty 99 % of daylight; now the longest gap is 1.7 min (30 days). The site has ~500 people at work an hour; the camps ~4,300.

**Files**: roadFolk.ts, camp_probe.* (new); traffic, courtCamps, fauna, construction; world.ts (3 hooks); road_census.ts; three tests.

**Tests**: road_folk 5/5, camp_life 4/4, construction_view 3/3, fauna 18/18, masons_marks pass.
