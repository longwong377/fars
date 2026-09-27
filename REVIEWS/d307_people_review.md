# D-307 review: the people seen close, round 2 (blind, uncalibrated)

Reviewer: independent blind reviewer (subagent), 2026-09-27. Brief: handoff/briefs/s11/review_d307_people.md.
Read: USER_DIRECTIONS.md, MASTER_PLAN.md §3 (T-A4, T-A4cg), the brief. Did not open shots/, review_key.json, revsrc or git.

## Lead: what is broken

**Every one of the 30 items reads as CG. None reaches 4 in any category. T-A4 (lowest category >= 4) FAILS on all 30;
T-A4cg (reads-as-CG count <= 0) FAILS at 30.** At 1.5 m nothing here would be taken for a photograph of a person; most items
read as a mid-2000s game NPC in a test room. The people are not yet at the "photograph of a real place" standard (UD-01, UD-06),
and the gap is wide, not marginal.

## Conditions and limits

- **Uncalibrated.** REVIEWS/anchors/ does not exist, so T-R1 could not be run. Scores are my absolute judgement only.
- **Lens and quality.** Frames are 1920x1080 at 60° vertical FOV, quality `high` per the brief, **not `ultra`**. The brief's
  own clause 2 asks for ultra; no item is at ultra. Crops are 2x nearest-neighbour, which exaggerates pixel stepping a little,
  but every defect listed below is visible in the full frames too.
- **Stills only.** No motion, no sound: pose, cloth motion, hair motion, blinking, lip movement, pop and shimmer are unjudged.
  All figures stand in the same symmetric A-pose with hands half-curled; a still cannot say whether they ever move.
- **Time.** Day items: day 25 (late spring), 10:00, clear. Fire items: same day 22:00, clear, brazier 1.3 m right. Unjudged:
  every other hour, season, dust, rain/overcast, dawn and dusk, lamp-lit interiors. In the fire items no brazier or flame is
  visible in frame; the light reads as a warm flat fill rather than a flickering point source.
- **Scene.** The probe (plain ground, one wall, no town) cannot tell me anything about people in the real places, crowds, or
  whether they act as a scene; judged as figures, not as a scene. Nothing here speaks to every walkable area.
- **References used.** C:\Users\Administrator\fars-assets\photos\sheet_reliefs.png (29 relief photographs: Apadana guards,
  tribute bearers, Median/Persian courtiers, beards and headdress as carved). Real skin, hair and cloth at arm's length: no
  reference exists, judged against knowledge of photographs of real people (**label C** for every skin/hair/cloth score).

## Per-item scores (1-5; C = judged against memory of photographs of real people)

| item | skin | hair | cloth | overall | reads as CG | what breaks it first |
|---|---|---|---|---|---|---|
| P01 | 2 | 1 | 2 | 2 | yes | alpha-tested hair helmet with dithered edges; brows as dotted strokes; belt a rigid hoop floating off the tunic |
| P02 | 2 | 1 | 1 | 1 | yes | crown and veil are flat opaque slabs behind the head; torn holes at the sleeves; smeared vertical stripe "folds" |
| P03 | 2 | 2 | 1 | 2 | yes | stair-stepped pleat shading on the skirt; belt hoop floats with a visible gap; waxy plastic face |
| P04 | 2 | 1 | 1 | 1 | yes | fringe dissolves into dither noise over the eyes; torn cuff; pleat aliasing |
| P05 | 2 | 2 | 2 | 2 | yes | beard is a stacked corrugated sausage with stamped spiral decals (stone read literally as hair) |
| P06 | 2 | 1 | 1 | 1 | yes | dithered bob; hard-edged blocky cast shadow on chest; floating belt hoop; pleat aliasing |
| P07 | 2 | 2 | 2 | 2 | yes | beard is a black painted jaw plus stringy card fringe; sleeve interiors pure black |
| P08 | 2 | 2 | 2 | 2 | yes | headscarf is a solid rubbery shell; dark smudge on forehead; skirt aliasing |
| P09 | 2 | 2 | 2 | 2 | yes | sausage-stack beard; hat a rigid cylinder with a plastic highlight on its rim; black sleeve interiors |
| P10 | 2 | 2 | 1 | 2 | yes | as P08 plus torn sleeve cuffs showing skin through holes |
| P11 | 2 | 1 | 2 | 2 | yes | beard strands end in a straight cut line; dithered brows; sleeve tips shear |
| P12 | 2 | 2 | 2 | 2 | yes | beard is a flat rectangular texture patch; dark blotches at both hands; skirt aliasing |
| P13 | 2 | 1 | 2 | 2 | yes | headband floats as a brim/disc off the skull; beard edges pixel-dithered |
| P14 | 2 | 2 | 2 | 2 | yes | cloak is rigid flat panels; arms are grey tubes; spiral-decal beard; hood a smooth shell |
| P15 | 2 | 1 | 2 | 2 | yes | as P13: floating headband disc, dithered beard |
| P16 | 2 | 2 | 1 | 2 | yes | hair helmet; blue belt hoop floating; pleat aliasing; blocky shadow |
| P17 | 3 | 2 | 2 | 2 | yes | best face in the set but hair is dither-edged and blouse gathers are smeared stripes |
| P18 | 2 | 1 | 2 | 2 | yes | headband a hovering ring; beard a black pixel mass |
| P19 | 2 | 2 | 2 | 2 | yes | hair a painted skullcap; brows painted strokes; belt hoop gap |
| P20 | 2 | 2 | 2 | 2 | yes | long beard is a slab with a hard cut bottom; black sleeve interiors |
| P21 | 2 | 2 | 2 | 2 | yes | sausage-stack beard; smeared robe folds |
| P22 | 3 | 2 | 2 | 2 | yes | waist seam shows a dark gap; skirt a stiff cone |
| P23 | 2 | 2 | 2 | 2 | yes | cloak rigid panels; beard card fringe; grey tube arms |
| P24 | 2 | 2 | 1 | 2 | yes | sleeves shatter into shards at the elbows (geometry through cloth) |
| P25 | 2 | 1 | 2 | 2 | yes | floating headband ring; beard black dithered blob |
| P26 | 3 | 2 | 2 | 2 | yes | as P22; skirt cone with a hard hem |
| P27 | 2 | 1 | 1 | 1 | yes | crown/veil flat slabs, veil a rigid rectangle beside the neck; torn sleeves |
| P28 | 3 | 2 | 2 | 2 | yes | child: acceptable face, but hair texture cap and stiff cone skirt |
| P29 | 2 | 2 | 2 | 2 | yes | long beard slab; tall hat rigid with plastic highlight; black sleeve interiors |
| P30 | 2 | 2 | 2 | 2 | yes | sausage-stack beard; smeared vertical robe stripes |

## Means over all 30 items

| category | mean | min | T-A4 (>= 4) |
|---|---|---|---|
| skin | 2.13 | 2 | FAIL |
| hair (scalp, beard, brows) | 1.67 | 1 | FAIL |
| cloth | 1.73 | 1 | FAIL |
| overall | 1.87 | 1 | FAIL |
| reads as CG | 30 / 30 | | T-A4cg FAIL |

## The five things that most break the illusion

1. **Hair and beards.** Alpha-tested cards with dithered/stippled edges, hair as a solid helmet or painted skullcap, beards as a
   stacked corrugated "sausage" with spiral decals (the relief's stone convention transcribed literally, reading as a
   sculpture glued to a face), or as a flat patch with a straight-cut bottom. Brows are drawn strokes. Worst category.
2. **Belts and headbands floating.** Nearly every belt is a rigid hoop standing off the body with a visible gap and no
   cinching; headbands are discs/rings hovering off the skull. Cloth never gathers under a belt.
3. **Cloth has no weight or real folds.** Folds are smeared vertical stripe textures; pleated skirts alias into stair-steps;
   robes are stiff cones; cloaks are flat panels; crowns and veils are opaque slabs. Sleeve interiors render pure black.
4. **Interpenetration and holes.** Arms poke through sleeves (P24 shards, torn cuffs on P04/P06/P10, holes in P02/P27),
   dark blotches at the hands (P12 and others), dark waist seams on the children.
5. **Skin and lighting.** Waxy, uniform skin with no pores, sheen or subsurface variation; face tone often differs from the arm
   tone; blocky low-res shadow maps on chests; identical dead A-pose for everyone; in the fire items no visible light source,
   no flicker, just a warm tint.

## Anachronism and identifiability

- Women's hair (P03, P04, P06, P16) reads as a 1920s/modern bob with a blunt fringe; not supported by any relief.
- Short-sleeved belted tunics and the hood-plus-cloak (P14, P23) read as medieval European peasant/Crusader-era dress more than
  Achaemenid. Against the reliefs, the Median figures lack the trousers, the sleeved coat worn as a cape (kandys) with its
  empty sleeves, and the akinakes; the Persian court robe lacks the reliefs' cascading diagonal folds.
- The fluted tall hats are broadly consistent with the reliefs, but render as fabric cylinders like a modern chef's hat.
- No figure carries a spear, bow, quiver, shield or tribute: the sample does not recognisably include guards or delegations,
  so those classes are unjudged here.
- Nothing identifiable (no real person's likeness or brand) seen.

## Proxy hunt / detector escapes

No PASS given, so no pass-proxy question arises. Failures a detector should have caught (candidates for REVIEWS/escapes.md):
belt/headband clearance from the body (a distance check); cloth-body interpenetration at sleeves (an intersection check);
alpha-tested dither on hair (an edge-noise metric on the hair mask); stair-step aliasing on pleated cloth (a high-frequency
aliasing metric); pure-black sleeve interiors (a black-crush check within the figure mask, analogous to T-A3k).

## What this sample cannot tell you

Motion, sound, crowds, people in real settings, any other hour/season/weather, the ultra setting, and every dress class not
recognisably present (guards, delegations with their own dress). Several items appear to be near-duplicates of one another;
I did not try to identify which are older renders.
