## Fixed clauses (copy verbatim)

You are an independent reviewer for PĀRSA (a 1:1 reconstruction of Persepolis in 467 BCE; repo /home/user/fars, branch
s11-carving (worktree C:SERSADMINISTRATORARS-WTRVING)). You did not build what you judge. Read USER_DIRECTIONS.md (the user's own words), MASTER_PLAN.md (the Walker Test,
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

## Slots (filled for D-306, the carving)

- **Branch:** s11-carving. **Area and class:** the column capitals (double-bull protome, composite volute member) and the Gate of
  All Nations' colossi (W bulls, E human-headed winged bulls): every walkable place from which a capital or a colossus is seen.
- **Items** (T:\fars-blender\carving\review\items\item01..22.png; shuffled; each view appears twice, drawn two ways; you are not
  told which is which): 1600x900 frames rendered by a probe page (tools/blender/probe/carving_probe.ts) in the game's own
  WebGPU renderer and materials (Q=high surfaces, the Gate, Apadana, Tachara and Harem only: NO terrain, sky model, weather,
  people or sound; one sun late morning from the SE and a hemisphere light; a flat brown ground plane). Player's lens (70°,
  eye 1.6 m above the floor) except the three calibration frames (a capital protome and a volute member placed on the ground
  off the Terrace, 50° lens, not a place in the game). Month and weather: none modelled (clear, no season). Stills only.
- **References** (T:\fars-blender\carving\review\refs\): photographs of the site today (Wikimedia; the ruin, weathered): a
  fallen bull capital three-quarter, a bull capital's head and neck side-on, the Gate's W bull from its passage, the Gate's E
  human-headed bulls from the front, the Gate's standing composite column. The photographs show the stone as it is after
  2,500 years; the reconstruction is of 467 BCE (fresher stone, D-285): judge the carving and the surface reading, not the ruin.
- **Paired photo test (T-A5):** T:\fars-blender\carving\review\pairs\pairN_X.png / pairN_Y.png (4 pairs, all PNG, 1200 px):
  each pair is one render and one photograph of the same subject. For each pair say which you think is the photograph and why.
- **Thresholds (gates/thresholds.json, verbatim):** T-A4 "lowest rubric category score in any judged view" >= 4 (score 1-5);
  T-A4cg "judged views that read as CG" <= 0 (count); T-A5 "paired photo test: blind reviewer pick accuracy (render vs site
  photograph from its solved camera)" <= 100 (%).
- **What to score, per item:** (a) the photoreal rubric's categories you can judge on a still of carved stone (form, surface /
  material, carving detail against the references, light and shadow), each 1-5; (b) reads as CG: yes/no; (c) one line on
  what breaks it. Then, per view pair you can identify as the same view, which of the two is closer to the photographs and why.
  Finally an overall 1-5 score for the capitals and one for the colossi.
- **Anchors:** REVIEWS/anchors/ does not exist in this tree; say so and score without calibration (clause 7).
- **Output:** write REVIEWS/review_carving_s11.md in the worktree C:\Users\Administrator\fars-wt\carving (only that file);
  no reserved Q/B numbers (list new issues as prose; the agent files them).
