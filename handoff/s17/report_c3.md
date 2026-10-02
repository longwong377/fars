# C3 life on the roads — report (cloud, s17; D-570)

**Broken / placeholder / unseen first**
- Nobody on the roads can be spoken to: the road folk (and the caravans' drivers) are the crowd's extras, which the talk and voice systems skip (crowd.ts nearPeople: pid < 0). Each mover now carries `life` (the head's attested name, the person's place in the household, home, livelihood) and its errand in `why`, ready for a talk hook in crowd.ts/converse (not C3's files): for the lead.
- Unseen: nothing of this has been rendered. Views asked in handoff/s17/asks_vagon.md (C3 lines: two royal-road views, the south road at harvest, the Naqsh road, the court camp, the royal stud's lines, the site's ramp).
- Road travellers end at the Grand Stair's foot (all four roads) and appear/vanish there after a stay; the town's lanes are not on their route. ~150-210 road folk alive at once, ~20-40 at the foot: the frame budget must be checked on Vagon (extras within 750 m of the camera: ~70-100 people plus strings).
- Moving flocks: no performance draws a flock walking with its herder; herders graze the verges instead (ask to V3/V5 for a 'drive' variant).
- The hinterland households are a register of their own (not the 44,000 population): no homes drawn, no conversation memory; their purposes come from the calendar (season, weather, festival), not the economy.
- tests/land_work.test.ts fails on plan checks (meals/labels) on a clean origin/cloud-s17-int too (re-run there): pre-existing, not C3's.
- Headless look: the cloud's Chromium cannot render the probe usefully (WebGPU fails on texture views; the WebGL2 path gave a blank frame); tools/dev/camp_probe.* counted 111 camp items drawn at the court camp with no model missing.

**What a player now sees**: the four roads busy all day in dry weather (villagers with strings of donkeys, baskets, jars, brushwood, ox carts, families at festivals, traders and camels on the royal road), going in in the morning and home in the afternoon, halting by the road; herders with flocks on the verges; a lively halt at the stair foot; the court's camps with things before every tent and picket lines of horses and mules; an earth ramp with a drum on rollers at the column being raised; when the court comes (days 10-15) its baggage train fills the royal road, a string for every tented household, and on the leave day the column goes back out.

**Census** (tools/dev/road_census.ts): roads empty 99 % of daylight before; after, longest empty spell 1.7 min (30 days, 10 s steps, dry daylight); site ~500 at work per hour; camps ~4,300 in residence; the plain's fields 6,400 at 06 h rising to 11,400 by 08 h (the population's own farmers, drawn by popview); ~330 herders out with the flocks 08-15 h.

**Files**: src/world/roadFolk.ts (new), tools/dev/camp_probe.* (new), traffic.ts, courtCamps.ts, fauna.ts, construction.ts; world.ts (3 one-line hooks); tools/dev/road_census.ts; tests/road_folk.test.ts, camp_life.test.ts, construction_view.test.ts.

**Tests**: road_folk 5/5, camp_life 3/3, construction_view 3/3, masons_marks, fauna 32/32 together; tsc clean on my files.
