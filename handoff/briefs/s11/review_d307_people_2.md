# Reviewer brief: the people seen close, round 2 (D-307; session 11) — generated from handoff/review_template.md

## Fixed clauses (verbatim from the template)

You are an independent reviewer for PĀRSA (a 1:1 reconstruction of Persepolis in 467 BCE; repo /home/user/fars, branch
s11-people2). You did not build what you judge. Read USER_DIRECTIONS.md (the user's own words), MASTER_PLAN.md (the Walker Test,
axes A–K, thresholds in gates/thresholds.json) and PERSEPOLIS_BRIEF.md §1.1 and §3 first.

1. **Scope.** The standard covers every walkable area, not chosen views. Judge what you are given as a sample of every walkable
   area of its class, and say what it cannot tell you about the rest.
2. **The player's lens and quality.** Judge at the player's lens and quality (the default FOV and the widest setting, `ultra`),
   with nobody hidden near the lens. Name any frame that is not at the player's lens and quality.
3. **In motion, with sound.** Judge clips in motion and with sound where they are supplied; a still cannot show pop, shimmer,
   sliding or a mute crowd. Say which items you could only judge as stills.
4. **Time.** Judge at every hour, season and weather the sample holds. State the month, hour band and weather of each item and which strata the sample
   leaves unjudged.
5. **Judge as a scene.** Judge as a scene, as a person standing there in 467 would meet it: place, people, animals, sound, light,
   weather, what is happening; not as a material swatch.
6. **References.** Use every reference paired to the scene (handoff/review_briefs.md tables; references/INDEX.md, including the
   user's site photographs) and list which you judged against. Memory of photographs is allowed only where no reference covers
   the item, and is labelled C.
7. **Calibration and blindness.** Score the anchor set first (REVIEWS/anchors/INDEX.md, T-R1); if any anchor lands more than 0.5
   from its pin, stop and report. The frames are shuffled with anchors and older renders and unlabelled: do not try to guess.
8. **Proxy hunt.** For every PASS you give, answer: how could this pass while the intent fails? For every failure you find, say
   whether a detector on the board should have caught it (a detector escape, REVIEWS/escapes.md, T-R0).
9. **Honesty.** Lead with what is broken or placeholder. Categories: the photoreal rubric (every category ≥ 4, T-A4; "reads as
   CG" = 0, T-A4cg), the life category, the listening rubric (T-G4), the anachronism checklist (T-I1).

## Slots

- Branch s11-people2 (C:\Users\Administrator\fars-wt\people2, read only). Area and class: every person seen close (1.5 m,
  conversation distance), the people of every dress and class (court, guards, Median dress, workers, women, children,
  delegations, the king, a court woman). Anchor set: **none exists yet** (REVIEWS/anchors/ is absent): the review is
  uncalibrated; say so.
- Items: 30 stills in T:\fars-blender\people2\review2\ named P01..P30, each as `Pnn-frame.png` (the full frame, 1920 × 1080,
  the player's default lens 60° vertical, quality high, the probe page humanlab.html: a plain ground and a wall, no town around)
  and `Pnn-crop.png` (the same frame's person, head to knees, enlarged 2× nearest-neighbour for detail). Day items: day 25 of the
  year (late spring), 10:00, clear. Fire items: the same day 22:00, clear, lit by a brazier 1.3 m to the person's right. The items
  are shuffled; some come from older renders; you are not told which. Stills only (no motion, no sound).
- Thresholds (gates/thresholds.json, verbatim): T-A4 "lowest rubric category score in any judged view" >= 4 (score 1-5);
  T-A4cg "judged views that read as CG" <= 0 (count).
- References: references/INDEX.md (`example of soldier.jpg`, the Apadana relief images), C:\Users\Administrator\fars-assets\photos\reliefs
  and sheet_reliefs.png (the dress, hair and beards as carved); for real skin, hair and cloth at arm's length there is no
  reference photograph of 467 people: judge against your knowledge of photographs of real people (label it C).
- Output: write REVIEWS/d307_people_review2.md in the worktree above (the only file you may create). For every item: skin, hair
  (scalp hair, beard, brows), cloth (drape, folds, belt, weight), overall, each 1-5; "reads as CG" yes/no; one line on what
  breaks it first. Then the means per category over all items, the five things that most break the illusion, and anything
  anachronistic or identifiable. No reserved Q/B numbers for you.
