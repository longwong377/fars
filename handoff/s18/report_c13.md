# s18 cloud C13: court, ceremony and dress (D-780)

## Broken, placeholder, unseen (first)
- **No frame judged yet.** The one crude SwiftShader run timed out: the page was not ready after 40 min on a box busy with test
  runs. A retry is below if it lands. Nothing has been seen at the player's lens on a GPU.
- **people_hair and people_cloth are STALE** (tests/people_models "current: its inputs hash"). Their input hash covers all of
  src/people/outfits.ts, and D-780 changed it (the workers' bronze rings, the kidaris, the radial head fit). They can only be
  rebuilt on Vagon, because the makehuman sources are on C:. Ask: `node tools/blender/build.mjs people_hair people_cloth`.
  Until then the drape and hair cards come from the older build, which is harmless: the head pieces are not in those assets.
- **Pose stand-ins:**
  - The proskynesis cycle is new (workAnims.ts 'proskynesis'). Its far impostor reuses the harp_h@30.9 frame (0.09 m match).
  - Diners sit with the 'sit' pose and a bowl. There is no table-side reclining.
- **No gallop and no driven chariot.** Riders mount at the walk gait, including the 7.5 m/s couriers. The gallop and the
  chariot are C14's now.
- **Routed by the lead to other owners:**
  - lamps lit on banquet nights (C9 + C4, the fireOcc bake);
  - the daily wardrobe on the look (C5);
  - the parasol following the king's route (C5);
  - household religion (C1, C2).
- **Not done:**
  - the delegations' mantles, tassels and the chin wrap of the soft cap;
  - the lion bands on the throne covers and the canopy;
  - drums and trumpets with the column (no trumpet instrument exists).
- **Fewer banquet furnishings than planned.** The banquet's 38 tables are drawn at the model's lowest level and have no carpet
  or lamp of their own, and there are no hangings on the Apadana's W, E and N walls. With them the court's furnishings were
  600-700 k triangles against the 450 k budget (tests/model_props). Measured now: 441 k.
- Gold appliqués are the rosette motif in a gold-yellow trim colour (one material bit), not metal plaques.
- The banquet uses the place `court_audience`, an ORDERED place in popgeo.ts, so diners get seats.
- **Pre-existing failures, also on the base commit:** humans_faces "the kandys hangs past the knee" and court_view "no pop-in"
  (a forecourt talker at 41.7 m).

## What a player now meets (node census, seed 1; handoff/s18/c13_court_census.md)
The court is in residence from day 14 to day 117 (103 days). Each of those days carries a programme (src/people/ceremony.ts,
a pure function of the seed and the day):

| event | times in the residence | where |
|---|---|---|
| audience (the king enthroned, the chiliarch before him) | 47 mornings (8 of them the gift days) | Apadana |
| the days of the peoples' gifts (every delegation, in the reliefs' order) | 8 (days 19, 33, 45, 59, 72, 83, 99, 110) | Gate → forecourt → the N stair → the throne |
| great banquet | 17 nights | the Apadana's bays (304 seats round 38 tables), the overflow in the portico |
| the king's ride (escort, nobles, grooms) | 21 mornings | the Great Stair → the plain → the royal horse lines |
| the hunt (riders, beaters on the river reeds) | 9 | the royal horse lines and the Pulvar's reeds |
| the king's gifts and the dawn fire | day 15 | the magi's fire, then the Apadana |
| the tukta (the king's birthday) | day 75 | the fire, the Apadana, a banquet |
| couriers riding in | 356 (2-5 a day) | the road station → the stair foot → the Gate |
| grooms exercising horses | every morning, ~680 riders | the town camps → the royal horse lines |
| the watch changing | 06, 14, 22 every day | the guards' court → the posts |

Every morning of the residence holds an audience, a gift day, a ride, a hunt or the king's gifts on more than 70 % of days
(test). Who takes part (people counted from their own plans):
- **first gift day (day 19):** 211 delegates go up the stair in file behind 22 ushers, 22 leaders bow before the king, the
  chiliarch stands at the throne, 533 Persians of rank line the portico and the hall; that night 488 dine, 182 servers and
  wine-bearers cross the Terrace from the kitchens, and 33 servants fill and trim the lamps;
- **the king's gifts (day 15):** the king at the magi's fire at first light, 545 Persians of rank receive gifts in the
  Apadana, 508 at the banquet;
- **a hunt (day 29):** 93 riders, 111 beaters, 11 grooms with the spare horses;
- **a ride (day 18):** 47 riders, 15 grooms.

New people: the chiliarch (in Median dress with kandys, gold at the ears and wrists) and 356 royal-road couriers.

## Dress (tools/dev/dress_census.ts, seed 1; looks.ts, garments.ts, delegations.json)
| people | main garment dyed, before → after | main colour C*ab | ornaments |
|---|---|---|---|
| everyone, court away (3,000 drawn) | 16 % → 63 % | 14.9 → 22.4 | 21 % → 40 % |
| working men | 0 % → 58 % | 11.5 → 20.5 | 0 % → 34 % (bronze) |
| children | 0 % → 51 % | 12.2 → 21.0 | – |
| women | 50 % → 79 % | 21.4 → 26.0 | 67 % → 89 % |
| the court on day 40 (1,700) | 45 % → 80 % | 20.9 → 26.3 | gold 38 % → 43 %, rosettes or gold plaques 7 % → 15 % |
| guards | 57 % → 83 % (yellow, purple and white Susa robes) | 23.4 → 25.5 | 77 % → 96 % |
| delegations | 38-48 % → 73-74 % | 19-21 → 25-29 | – |

Persians' robes are never undyed. 60 % wear torques (was 30 %). A third wear gold plaques, drawn as the rosette in gold-yellow.

## Halls (furnish_palaces.ts)
- **Court in residence:** the Apadana is laid for the banquets with 38 low tables in the bays (304 seats). This is on top of the
  throne's canopy, burners, carpets and hangings. The use state is 441 k triangles (budget 450 k).
- **Court away:** the Apadana keeps the hangings behind the throne's place, a keeper's corner and lamp stands at the corners. The
  Tachara's side rooms and the Hadish keep their hangings. The stored state is 279 k triangles (budget 300 k).

## Applied in other owners' files (the lead's go-ahead, kept small)
- activities.ts (C8): variants for riders, led horses and gift animals by delegation, the bow, banquet diners and servers, and
  beaters. PropKind gift_*.
- calendar.ts (C1): the programme in the event log. New rows in events_calendar.json: E-28 the great banquet, E-29 the ride and
  the hunt.
- performers.ts: a court_banquet gig in the Apadana (3 harps, 5 singers, a frame drum). The lead wired banquetHall in world.ts.
- workAnims.ts / impostors.ts: the proskynesis cycle.
- props.ts (C5): the gift props.
- population.json and town.json: the stale "court absent by default" lines rewritten.

## The court's people and dress (later passes)
- The crown prince and the weapon-bearer stand behind the throne (the Treasury relief). The parasol is furled indoors.
- Guards: two in three non-Persian guards wear the court robe (Susa archers), and the robes are new and strong.
- The king's crown is the plain kidaris. The gorytos is named as a combined bow case and quiver.
- Head pieces are fitted radially. The support-function fit stood 12 mm off the head on average and up to 36 mm: C14's
  floating headband.
- The 23 peoples' skin means sit a little further apart, sd 0.16 → 0.12.
- The delegations' gifts are modelled in Blender and carried: an ibex-handled amphora, armlets, a tusk, akinakes, bows and
  folded garments, 17 of the gifts in all. Bowls and cups keep the lobed phiale.

## Frames (crude, SwiftShader WebGL2, seed 1, day 19)
See handoff/s18/c13_frames/ (if present): the forecourt and N stair at 09:12 on the gift day, the audience in the hall at
09:24, and the banquet at 20:06.

## Tests
- tests/court_ceremony.test.ts (new, 5 tests): the programme, the seats, the people on the programme's days, well-formed plans.
- tests/palace_furnish.test.ts: updated for the stored state (hangings stay up).
- tests/people_look.test.ts: updated so court chroma must be > 1.5× the working dress's (it was 2×).
- tests/court.test.ts: see the run below.
