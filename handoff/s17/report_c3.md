# C3 life on the roads — report (cloud, s17; D-570)

**Broken / placeholder / unseen first**
- Unseen: no C3 view rendered (s17-renders holds one night baseline frame). Starling fix unconfirmed on the T4.
- Road folk can't be talked to: C10 hasn't wired the register (hinterlandRegister/planOf/spotOf/bindPids, ready in roadFolk.ts) into the population.
- Travellers appear/vanish at the stair foot; ~150–210 alive, ~70–100 within 750 m: check frame budget.
- Moving flocks, stone carts, loads by trade wait on V3/V5 variants (asked).
- Errands come from the calendar, not the economy.
- tests/land_work fails on clean int (pre-existing).

**What a player sees**: four roads busy in dry daylight (strings, baskets, jars, carts, festival families, traders, camels), in at morning, home in the afternoon, halts, a market at the stair foot; herders on verges, flocks on stubble and slopes (drawn to 2.4 km), folded at night; court camps dressed, picket lines with dogs; the court's baggage train on arrival and leave days; an earth ramp at the Hall of 100 Columns; more birds; starlings fixed to ≤16 vertex inputs.

**Census**: roads empty 99 % of daylight before, longest gap 1.7 min after; site ~500 at work, camps ~4,300.

**Files**: roadFolk.ts, camp_probe.*, vertex_inputs test; traffic, courtCamps, fauna, wildlife, construction; world.ts hooks.

**Tests** (merged int, V5 animals): road_folk, camp_life, vertex_inputs, fauna, wildlife, bird_takeoff, construction_view: 38/38.
