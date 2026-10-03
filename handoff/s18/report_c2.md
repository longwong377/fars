# s18 cloud C2: town roofs, lane fill, doors, the last shut houses, the lower-city belt, washes (D-660, D-661)

Branch cloud-s18-c2-town. Frames: crude cloud software frames (SwiftShader WebGL2, quality=test), in handoff/s18/c2_frames/.

## Broken, placeholder or unseen (read first)
- **Unseen at the T4's look.** Every frame here is the cloud's WebGL2 software path at test quality: placement and presence only.
  The washes, the roof coat and the painted doors need a T4 frame to judge tone; the belt quarters (q_b*) have one cloud frame each
  at most (see the frames table for which views show them).
- **The town's courts still read as dark holes from afar** (they are open courts in shadow: correct, but heavy); not addressed.
- **Lanes in shade read dark and bare even with the fill drawn** (c2-lane): the fill along the walls is mostly thin tools,
  pegs and fodder that vanish in shadow; the light (exposure in narrow lanes) is not mine. The feet-level frame shows the things.
- **The nav grid holds none of the new doors or the belt** (public/generated/nav.i16 is built from the Terrace only; the town's
  own walk graph covers the quarters). The belt was kept outside the nav grid's box (e −620…262, n −245…185) for that reason:
  moving the town into the Terrace's immediate foot needs build_nav.ts to take the town's colliders (asked of the lead).
- **Cost.** The town plan (baked in the browser, live in node tests, the bake and CI) went 19 s → ~37 s on this box (739 more
  plots and the access passes); tests/settlement_build's mesh-count check (≤ 45) already failed on the base (51) and now reads 55
  (the belt's cluster meshes); its triangle check holds (1.14 M ≤ 1.2 M, base 0.968 M) only because the far level's wall crests
  were thinned (stations 3 m → 6 m). tests/settlement.test.ts's 60 s setup hook timed out once on the loaded box (plan time).
- The population is unchanged: households move to the nearest houses of their zone, so the belt fills from the existing quarters
  and more houses further out stand empty.
- The ask-c7-1 court eye lands against a wall in deep shadow: no court frame worth judging.

## What a player now meets (measured)
- **Roofs.** The town was never roofless: a ray down every house room hits a roof on the far level for 92 % of 6,878 rooms (the
  rest carry roof fuel on top) and on both near levels for ~97 % of a 982-room sample. It read as open boxes because the roof top
  was the walls' own plaster tone, parapets hide flat roofs at low angles and nothing of a roof's life was drawn beyond 120 m.
  Now each roof carries a straw-and-clay coat (paler, warmer, varied roof to roof, both levels) and the roofs' jars, mats, fleeces
  and dung cakes stand on the far level too. Frame c2-town20: the roofs read as roofs with their things on them.
- **Lane fill.** It was drawn but under the lane's earth: the trodden ground was draped 10 cm over the terrain while the fill and
  the people stand on the terrain. Before: 1,250 of 1,273 litter pieces and 709 mats and flat things wholly under it, every other
  item (14,155) sunk 10 cm. After: the ground 1 cm over the terrain within 30 m of the eye (10 cm by 140 m), litter lifted 1.2 cm:
  0 buried in every class (town fill census, node). Frame c2-lanefeet: dung cakes, cloth, a broom, firewood at the wall foot.
- **Street doors.** No street door leaf had been drawn since s15 (eacb1e4 put the instance write inside a comment): every
  doorway stood open. Drawn again, and 40 % of them now painted (red ochre, blue-grey, green-grey).
- **Repairs.** Patches step a third as far from the wall's tone with a wider rim; brick losses get an irregular halo of
  thinned, damp plaster fading into the wall. Unseen at the T4.
- **Every house can be entered.** reach_census: shut houses 6 → 0, quarter plot cells reached 99.437 → 99.84 %, lane cells
  99.742 → 100 %. Cut-back corners for landlocked houses (q_s4-0074 100/100 cells, q_s4-0161 91/141, q_w3-0122, one more) and a
  lane pocket's one-cell exit widened into the yard beside it (q_w2-0077, q_w2-0082).
- **The lower-city belt.** Five quarters (q_b1, q_b3, q_b4 on the road south, q_b5, q_b6 on the road west with a 14 m
  processional street) join the quarters toward the Terrace's foot: plots 1,505 → ~2,240, all reached.
- **Washes.** Houses washed white (12-52 % by standing), yellow ochre (10-18 %), red ochre (4-10 %), the rest bare mud; full in
  the court, thinner on the lane, fading since the last renewal. Five more dyes in the cloth palette.
- C5's q_w1 plot 141 (B691): not a collider fault; plot index 141 is q_w1-0142, a pen whose door opens onto a one-cell strip of
  the pen with its own wall 0.8 m behind.

## Frames
(frames: rendering; this table is filled when the before/after renders finish)
