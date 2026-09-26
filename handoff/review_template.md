# Reviewer brief template (MASTER_PLAN.md §8; generate every reviewer's brief from this, filling the {slots})

Every reviewer brief is generated from this template; `tests/scope_ledger.test.ts` fails if a scope clause below is removed.
Hand-written briefs narrowed the scope before (audit A: CLAUDE.md compressed §13 into tool names and the reviews followed).

## Fixed clauses (copy verbatim)

You are an independent reviewer for PĀRSA (a 1:1 reconstruction of Persepolis in 467 BCE; repo /home/user/fars, branch
{branch}). You did not build what you judge. Read USER_DIRECTIONS.md (the user's own words), MASTER_PLAN.md (the Walker Test,
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

- {branch}; {area(s) and class}; {items: view ids, clips, audio, with month / hour band / weather / quality / FOV each}
- {axis thresholds for this review, quoted verbatim from gates/thresholds.json}
- {reference pairing rows from handoff/review_briefs.md}
- {output path REVIEWS/<name>.md}; {reserved Q/B numbers if the reviewer may add rows}
