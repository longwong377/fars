# C7 interiors everywhere (cloud) — branch cloud-s17-c7-interiors; D-610, Q-1540..Q-1549, B640..B649
Read handoff/briefs/s17/cloud_common.md first.
**The player sees by tonight:** every door the player can go through opens on a lived-in room of 467 BCE, in the town, the
villages, the Terrace's palaces, the Treasury, the storerooms, the guard rooms, the court's tents and the workshops: hearth
and its pots, bread oven, querns, storage jars and bins along the walls, bedding rolled or laid out (mats, blankets,
cushions), low stools and tables, chests, lamps in niches, tools of the household's trade (a potter's wheel, a loom, a smithy's
anvil and bellows, a scribe's tablets), hanging herbs and onions, water jars by the door, children's things, hides and
fleeces; the palaces with hangings, carpets, couches, tables, vessels, incense burners (furnish_palaces.ts keeps its evidence
notes and tiers). What is in a room comes from who lives or works there (the simulation's households, crafts, wealth and
season: a poor house is sparse, a rich one full; a weaver's house has a loom), never one kit copied everywhere (UD-08).
**Owns:** a new src/world/interiors/** (one furnishing system for every room kind), src/world/furnish.ts,
src/world/furnish_palaces.ts, tools/blender/interior_* (new kit pieces as bpy scripts; culturally shaped things only from the
period kit: UD-37, research/ANACHRONISM_BLOCKLIST.md). The rooms' geometry stays with its owner (town houses: C1's
settlement/**; village houses: C2's plain/villagehouses.ts; palace rooms: Vagon V6's src/arch/rooms.ts, terrace_rooms.ts;
tents: C3's tentForms.ts): you add only the smallest hook in their file (one call that hands you the room's footprint, doors,
hearth and household), named in your report. The room's LIGHT (hearth glow, lamps, door light) is Vagon V6's.
**Start at:** grep for how rooms are described today (src/arch/rooms.ts, terrace_rooms.ts, settlement/houseplan.ts,
plain/villagehouses.ts, tentForms.ts; tools/dev/rooms_probe.ts, rooms_gaps.ts, rooms_reach.ts) and what the sim knows of a
household (crafts, wealth, members). Write tools/dev/interior_census.ts first: per room kind, the share of enterable rooms with
fewer than N things, the floor share left empty, identical rooms (same set and layout) among neighbours; measure the baseline.
**Done:** the census: every enterable room furnished for its use and household, no two neighbouring rooms identical, nothing
blocking a doorway or a walking path (the nav grid stays walkable: tests), draw calls inside a house within budget (instance
everything; ask C4); the Vagon train's interior views read as lived in.
