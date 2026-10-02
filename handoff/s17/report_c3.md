# C3 life on the roads — report (cloud, s17; D-570)

**Broken / placeholder / unseen first**
- Unseen: nothing of this has been rendered. Views asked in handoff/s17/asks_vagon.md (C3 lines: two royal-road views, the south road at harvest, the Naqsh road, the court camp, the royal stud's lines, the site's ramp).
- Road travellers end at the Grand Stair's foot (all four roads) and appear/vanish there after a stay; the town's lanes are not on their route. ~150-210 road folk alive at once, ~20-40 at the foot: the frame budget must be checked on Vagon (extras within 750 m of the camera: ~70-100 people plus strings).
- Moving flocks: no performance draws a flock walking with its herder; herders graze the verges instead (ask to V3/V5 for a 'drive' variant).
- The hinterland households are a register of their own (not the 44,000 population): no homes drawn, no conversation memory; their purposes come from the calendar (season, weather, festival), not the economy.
- tests/land_work.test.ts failed once here on plan checks (meals/labels); it does not import my files; not re-run on a clean tree yet.

**What a player now sees**: the four roads busy all day in dry weather (villagers with strings of donkeys, baskets, jars, brushwood, ox carts, families at festivals, traders and camels on the royal road), going in in the morning and home in the afternoon, halting by the road; herders with flocks on the verges; a lively halt at the stair foot; the court's camps with things before every tent and picket lines of horses and mules; an earth ramp with a drum on rollers at the column being raised.

**Census** (tools/dev/road_census.ts): roads empty 99 % of daylight before; after, longest empty spell 1.7 min (30 days, 10 s steps, dry daylight); site ~500 at work per hour; camps ~4,300 in residence.

**Files**: src/world/roadFolk.ts (new), traffic.ts, courtCamps.ts, fauna.ts, construction.ts; world.ts (3 one-line hooks); tools/dev/road_census.ts; tests/road_folk.test.ts, camp_life.test.ts, construction_view.test.ts.

**Tests**: road_folk 5/5, camp_life 3/3, construction_view 3/3, masons_marks, fauna 32/32 together; tsc clean on my files.
