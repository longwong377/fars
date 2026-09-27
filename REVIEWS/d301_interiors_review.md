# D-301 interiors: blind materials review (session 11)

Reviewer: independent, blind. Branch s11-realism-interiors. I did not build what I judge, and I did not open git history,
DECISIONS.md, source code or any other file in shots/. Inputs: `shots/blind_d301/frame_1.png` … `frame_16.png` (stills,
960 × 540, quality `high`, the player's FOV), plus the references `references/more interior.png` and `references/column hall.jpg`.

## What is broken (read this first)

1. **Every frame reads as CG: 16 of 16.** T-A4cg (≤ 0) fails in every view. No frame passes for a photograph.
2. **No frame reaches the done-bar of materials ≥ 3.** The best frames score 2. T-A4 (every category ≥ 4) fails in all 8 views.
3. **Two of the eight views did not change between the versions.** Frames 2 and 5 (the Treasury hall) differ in 0.15 % of
   sampled pixels, which is one small figure. Frames 11 and 14 (the dark hall with the single door, which I take to be the Harem
   apartment) differ in 0.01 %. Whatever D-301 changed, it did not reach those two rooms, or it cannot be seen at this exposure.
4. **The rooms are nearly black.** Mean luminance is about 16/255 in frames 2 and 5 and about 13/255 in frames 11 and 14, at
   11:00 on a clear spring day. The walls and ceilings sink into a red-brown murk, and you cannot judge a material you cannot see.
   The Getty column-hall reference is dim too, but its floor, column fluting, bases and ceiling are all legible, and these frames
   are not. This is a lighting or exposure fault more than a materials fault, but it hides the materials. The black crush should
   also be checked against T-A3k. It is day, so the ≤ 1 % limit applies.
5. **The props are primitives.** In the store room and on its shelf the jars are low-poly with visible facets, the "boxes" are
   plain cuboids, and there is a disc with a faceted silhouette (frame 8). The bedding in the garrison is flat slabs with plain
   cylinder bolsters. One hearth is a torus (frame 16), and another is a flat emissive disc (frames 1, 3). A grey rectangular block
   sits on the kitchen floor with no evident purpose (frames 7, 16).
6. **The rooms are empty of life and use.** The kitchen has no pots, fuel, ovens, soot, water jars or cooks. The Harem apartment
   has no furnishing at all. The Treasury hall is a bare floor with small goods at the wall foot. As scenes (clause 5) these are
   sets, not rooms where people work. The one exception is the garrison, where men are asleep.
7. **Specific artefacts:**
   - a black wavy ribbon on the garrison wall above the sleepers (frame 3), which reads as a broken smoke or shadow sprite;
   - two floating white spheres in the Gate hall (frames 6 and 15, left), which read as particles or lens sprites;
   - dark red splotches on the Gate hall floor in frame 6 that read as blood;
   - thin curved seam lines drawn across the store room wall (frame 8);
   - the gravel floor of the garrison shimmers with high-frequency noise, and will crawl in motion.

## Scope, lens, time, calibration

- **Anchor set:** `REVIEWS/anchors/` does not exist on this branch (T-R1 unbuilt). **All scores are uncalibrated.**
- **Lens and quality:** every frame is at quality `high`, **not `ultra`**, so this review does not speak for the top preset (clause 2).
  All frames are at the player's FOV. Nobody appears hidden near the lens.
- **Motion and sound:** all items are stills. I could not judge pop, shimmer (though I predict it on the gravel floors and the
  jar facets), sliding, flicker of the hearths, or sound. The listening rubric (T-G4) is not judged.
- **Time strata judged:** the Gate hall on day 269, 07:30, clear, low sun (late January); the Treasury, Harem and kitchen on day 20,
  11:00, clear, spring; the garrison on day 20, 23:00, night, lit by one hearth. **Unjudged:** dusk, lamp-lit evenings in the
  store rooms and Harem, summer, rain, overcast, and any hour with the doors shut.
- **What the sample cannot tell me:** the other store rooms of the Treasury, the other Harem units, the other kitchens and
  garrison rooms, the halls not sampled (Apadana, Hundred Columns, palaces), roofs and stairs. Two of eight views also did not
  change, so I cannot tell whether D-301 is effective in those room types at all.
- **References used:** `more interior.png` against the Gate hall (frames 6 and 15) and `column hall.jpg` against the Treasury hall
  (frames 2 and 5) and the Harem hall (11 and 14). No reference covers the store rooms, kitchen, quarters or furnishings, so I
  judged those from memory (**C**) of Schmidt's Treasury store rooms, Achaemenid storage jars and bowls, and excavated mud-brick
  domestic rooms.

## Per frame

Score = materials 1–5 (surfaces: floors, walls, ceilings, columns; props: jars, goods, mats, bedding, hearths). "Tell" = the one
thing that gives the CG away.

| frame | view (my identification) | materials | reads as CG | tell | worst three faults |
|---|---|---|---|---|---|
| 1 | Garrison, wide, toward the hearth (23:00) | 2 | yes | the hearth is a flat glowing disc with no fuel, flame or smoke | disc hearth; bedding is flat slabs with plain cylinder bolsters, identical and in perfect rows; the gravel floor is noisy dither and would shimmer (a garrison floor would be packed earth or plaster) |
| 2 | Treasury columned hall (11:00) | 2 | yes | uniform flat red floor with no wear, and walls lost to black | exposure so dark that walls and ceiling cannot be read; the lattice-painted columns are clean and identical, with no plaster or paint variation; the goods along the walls are tiny and unreadable, so the hall reads empty |
| 3 | Garrison, with the sleepers (23:00) | 2 | yes | a black wavy ribbon on the wall above the sleepers | the ribbon artefact; disc hearth; the sleepers read as mannequins in a line, and the bedding is slabs |
| 4 | Treasury store room (11:00) | 2 | yes | three faceted, low-poly jars in a row in the middle of the floor | low-poly jars with smooth untextured glaze; walls are smooth mottle with no brick or plaster structure; the floor is a flat red plane with no dust, scuffs or edge wear |
| 5 | Treasury columned hall (same as 2) | 2 | yes | as 2 | as 2 (only a small figure differs) |
| 6 | Gate of All Nations hall (07:30) | 2 | yes | two floating white spheres, and a waxy uniform floor | dark red blotches on the floor read as blood; the sweepers are grey, untextured and doll-like; the white fluted columns are clean and untinted, where the reference shows painted bases and a warm, dirtier interior; the doorway is blown out |
| 7 | Kitchen (11:00) | 2 | yes | an empty box with a stone ring and a stray grey block | no kitchen goods, fuel, ovens or soot anywhere; the grey block on the floor is unexplained; the walls are a uniform tiled noise with no brick courses, and the ceiling is too regular |
| 8 | Store room shelf, close (11:00) | 1 | yes | an untextured disc with a faceted silhouette | the disc is flat and faceted; the "boxes" are flat-shaded cuboids; seam lines are drawn across the wall; the red floor band is textureless |
| 9 | Garrison, with the sleepers (same as 3) | 2 | yes | mannequin sleepers in a rank | the sleepers; slab bedding; noisy gravel floor (the wall ribbon of frame 3 is gone, and the hearth now shows fuel) |
| 10 | Store room shelf, close (same as 8) | 2 | yes | geometric primitives lined up on a bench | the jars are still simple lathe shapes with no slip, chips or dust; the boxes are soft cuboids with a painted-on grain; the disc is still too clean (no dents or verdigris); the bench top is gravel noise |
| 11 | Harem apartment / dark hall (11:00) | 1 | yes | a black room with a flat red gradient floor | nearly black at midday; the walls are one repeated blotch texture; the room is empty, with plain columns, nothing on the floor, and a void doorway |
| 12 | Treasury store room (same as 4) | 2 | yes | toy-like goods on the benches and a clean, flat red floor | the floor is uniform and unworn; the props are still low-poly primitives; the walls are better (mottled plaster) but still have no courses and no damp or soot |
| 13 | Garrison, wide (same as 1) | 2 | yes | slab bedding in perfect rows | slab bedding and plain bolsters; noisy gravel floor; clean, white, identical columns (the hearth now has logs, which is better) |
| 14 | Harem apartment / dark hall (same as 11) | 1 | yes | as 11 | as 11 (no visible change) |
| 15 | Gate of All Nations hall (same as 6) | 2 | yes | floating white spheres and a waxy floor | the floating spheres; doll-like sweepers; the floor is still too uniform and wet-looking, though it is cleaner than 6 with pale dust patches instead of the red blotches |
| 16 | Kitchen (same as 7) | 2 | yes | the hearth is a smooth torus | torus hearth; a blotchy floor texture whose repeat is visible; the grey slab block; the room is empty |

Materials scores: none reaches 3. Minimum 1 (frames 8, 11, 14). **Done-bar (≥ 3) failed on every interior frame.**

## Per pair: which reads more real (I am not told which is newer)

| pair | view | more real | why |
|---|---|---|---|
| 1 / 13 | Garrison, wide | **13** | the hearth has visible logs and flame instead of a flat glowing disc; everything else is identical |
| 3 / 9 | Garrison, sleepers | **9** | the hearth has fuel, and the black ribbon artefact on the wall is gone |
| 2 / 5 | Treasury hall | **neither** (tie) | pixel-identical apart from one small figure in 5; no material change is visible |
| 4 / 12 | Treasury store room | **12** | the faceted jars in mid-floor are gone, and the walls have plaster mottling and structure; the floor is still a flat red plane |
| 8 / 10 | Store room shelf | **10** | the wall has real plaster texture with no seam lines; the disc has a rim and boss; the boxes have grain. It is the clearest improvement in the set, and it is still a 2 |
| 6 / 15 | Gate hall | **15** (slightly) | the blood-like red blotches on the floor are replaced by pale dust patches; the spheres, figures and columns are unchanged |
| 7 / 16 | Kitchen | **7** | the stone-ring hearth and fine earthen floor read better than 16's smooth torus hearth and blotchy, repeating floor. This is the one pair where I prefer the other side of the pattern |
| 11 / 14 | Harem / dark hall | **neither** (tie) | effectively identical (0.01 % of pixels differ) |

Pattern: in five of the eight pairs one side is clearly or slightly better (13, 9, 12, 10, 15). If those are the newer frames,
D-301 improved the hearths, the store-room walls and the shelf props. It did not lift any frame to 3, and it did nothing visible in
the Treasury hall or the Harem. In the kitchen pair, the version with the torus hearth is worse.

## Proxy hunt and detector escapes

- **No PASS was given, so there is no pass to proxy-hunt.** One warning for the agent's own tests: a check that says "textures
  changed", or a material count on meshes, could pass on 2/5 and 11/14 while nothing on screen changed. Judge on pixels at the
  player's exposure.
- **Detector escapes (these should have been caught before review; log in REVIEWS/escapes.md, T-R0):**
  - Near-black day interiors (frames 2, 5, 11, 14): **T-A3k** black crush by day ≤ 1 % should catch this if it runs on interiors.
    If it did not flag them, that is an escape.
  - The floating white spheres (6, 15) and the wall ribbon (3): these fit the soft break "a placeholder in view" and would count
    as an object hanging unsupported. No detector caught them, so that is an escape.
  - The unexplained grey block (7, 16), the torus hearth (16) and the disc hearth (1, 3): primitives in view should fail
    **T-A1** (untiered or placeholder pixels) if the props are flagged honestly. If they carry "sourced" tiers, the flags are lying,
    which is the anti-proxy the plan names.
  - Pairs with no visible change (2/5, 11/14): no detector exists for "the change did not reach the screen". Recommend a
    before/after pixel-difference check on each change's own target views.

## Anachronism and accuracy notes (T-I1, not scored)

- The Gate hall columns in 6 and 15 are plain white fluted stone with a Greek-looking base, and there are no capitals in view. The
  reference (Getty) shows painted, bell-shaped bases and a warmer interior. Verify the base profile against SITE_SPEC.
- The garrison's gravel floor has no evidence I know of (C). Packed earth or lime plaster would be expected.
- Shiny red floors in store rooms and in the Harem are plausible from Schmidt's red-painted plaster floors (C), but they would be
  worn, dusty and patched, not glossy and uniform.
- No anachronisms seen in the props at this resolution.
