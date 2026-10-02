# C3 life on the roads — report (cloud, s17; D-570)

**Broken / placeholder / unseen first**
- Road folk can't be talked to yet. roadFolk.ts gives C10 a register (2,400 households, ~8,000 people), each member's day (planOf), their place (spotOf) and bindPids. C10 still has to create them and place them.
- Nothing rendered (no s17-renders yet); views asked in asks_vagon.md.
- Travellers appear and vanish at the stair foot. 150–210 are alive at once, ~70–100 within 750 m: check the frame budget.
- Moving flocks, stone carts and string loads by trade wait on V3/V5 variants (asked).
- Errands come from the calendar, not the economy.
- tests/land_work fails on clean int too, so it's pre-existing.

**What a player sees**: all four roads busy in dry daylight with strings, baskets, jars, carts, festival families, traders and camels. People go in at morning and home in the afternoon, halting on the way and selling at the stair foot. Herders graze the verges; flocks spend spells on the stubble and slopes, folded at night and drawn out to 2.4 km. The court's camps have things before every tent, and picket lines with dogs. The court's baggage train fills the royal road when it comes and goes. An earth ramp leads to the column being raised. There are more birds over the fields and water.

**Census**: the roads were empty 99 % of daylight; now the longest gap is 1.7 min. About 500 people work the site; the camps hold about 4,300.

**Files**: roadFolk.ts, camp_probe.*; traffic, courtCamps, fauna, wildlife, construction; world.ts hooks; road_census.ts.

**Tests**: road_folk 7/7, camp_life 4/4, construction_view, fauna, wildlife and the bird tests all pass.
