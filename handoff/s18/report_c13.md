# s18 cloud C13: court, ceremony and dress (D-780)

## Broken, placeholder, unseen (first)
- **People taking part are not yet drawn doing it.** The plans hold the ceremonies (words, places, times, measured below), but a
  performance is chosen by activities.ts variants (C8's file), and the variants are not in yet. Until C8 adds them
  (handoff/s18/c13_asks.md, ready to paste):
  - riders on a ride, a hunt or at exercise are drawn **walking at a horse's speed with no horse**. Only the couriers ride
    already, because their words match the existing `/courier riding/` variant.
  - the leader's proskynesis and the chiliarch's raised hand are drawn as **'inspect'** (hands clasped);
  - banquet diners are drawn with the **'eat' sit-and-bread** pose (not seated at a table with a cup);
  - gift animals are not led up the stair: the words are there, the animals are not;
  - servers with wine show the jar; servers with dishes show bread.
- **No gallop.** Couriers move at 7.5 m/s and the hunt at ~5 m/s with the walk gait (C9: a gallop cycle). The royal chariot
  stays parked (fauna.ts, C9).
- **Silent ceremonies.** There is no banquet music and no drums with the column: the court supper's harps in the Hadish are
  unchanged (audio/performers.ts, unowned). The Apadana's lamp stands are **unlit** on banquet nights (C4's fire.ts).
- **Not in the event log.** The chronicle and the soak do not see the programme yet: calendar.ts (C1) needs one line, given in
  the asks.
- **Wardrobe not reaching the view.** The daily wardrobe's chosen garments still never reach the drawn look:
  popview.lookInput (C5) does not pass `outfit`. The palette change in looks.ts is what is seen.
- The banquet uses the place `court_audience` (an ORDERED place in popgeo.ts) so diners get seats without a popgeo edit;
  a separate `court_feast` place would be cleaner (C1's popgeo ORDERED set).
- Gold appliqués are drawn as the existing rosette motif in a gold-yellow trim colour (one material bit), not as metal plaques.
- Frames: crude SwiftShader frames only (below); nothing judged at the player's lens on a GPU.

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
- **Court in residence:** the Apadana is laid for the banquets: 38 low tables on carpets in the bays, 23 lamp stands and
  72 hangings on the W, E and N walls. This is on top of the throne's canopy, burners and carpet road.
- **Court away:** the Apadana keeps the hangings behind the throne's place, a keeper's corner and lamp stands. The Hadish and
  the Harem keep their hangings.
- 90 k triangles in use (budget 450 k).

## Frames (crude, SwiftShader WebGL2, seed 1, day 19)
See handoff/s18/c13_frames/ (if present): the forecourt and N stair at 09:12 on the gift day, the audience in the hall at
09:24, and the banquet at 20:06.

## Tests
- tests/court_ceremony.test.ts (new, 5 tests): the programme, the seats, the people on the programme's days, well-formed plans.
- tests/palace_furnish.test.ts: updated for the stored state (hangings stay up).
- tests/people_look.test.ts: updated so court chroma must be > 1.5× the working dress's (it was 2×).
- tests/court.test.ts: see the run below.
