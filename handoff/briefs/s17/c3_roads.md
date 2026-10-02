# C3 life on the roads (cloud) — branch cloud-s17-c3-roads; D-570, Q-1500..Q-1509, B600..B609
Read handoff/briefs/s17/cloud_common.md first.
**The player sees by tonight:** the roads and the Terrace's foot are busy at the right hours: caravans of donkeys and
camels with loads and drivers, farmers going to the fields at dawn and back at dusk, herders moving flocks, visitors and
delegations arriving, carts of stone; the Hall of a Hundred Columns' building site with gangs, ramps, scaffolds, blocks and
dust; the court's camps and tents alive when the court is in residence. Who goes where and when, how many, in what groups,
carrying what (the animals' and people's looks are Vagon's; you use the existing models).
**Owns:** src/world/traffic.ts, src/world/visitor/**, construction.ts, courtCamps.ts, tentForms.ts, terraceFoot.ts,
fauna.ts, wildlife.ts, smallLife.ts (behaviour and placement; animal models and motion are V5's: src/people/animal*.ts,
beasts.ts, lifeModels.ts).
**Start at:** traffic.ts, construction.ts, courtCamps.ts, src/world/visitor/controller.ts; the sim's day (grep the activities
and routes the people already follow; the traffic must come from lives, not loops: UD-08/09). Write tools/dev/road_census.ts
(per road segment and hour: travellers, groups, animals, loads; the longest empty stretch in daylight) and measure first.
**Done:** in daylight no visible road stretch of the plain near Pārsa empty for > 2 minutes; the building site and camps
populated by the census; every traveller has a purpose from the sim (an errand, a trade, a visit); the train's road and
camp views read as alive.
