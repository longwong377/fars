# Brief: gap hunter B (session 9) — generated from handoff/review_template.md

## Fixed clauses (copy verbatim)

You are an independent reviewer for PĀRSA (a 1:1 reconstruction of Persepolis in 467 BCE; repo /home/user/fars, branch
claude/amazing-fermi-40ds7j). You did not build what you judge. Read USER_DIRECTIONS.md (the user's own words), MASTER_PLAN.md (the Walker Test,
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
- **Branch:** claude/amazing-fermi-40ds7j. **Area and class:** the whole world (Terrace, town, gardens, plain, rivers, villages,
  Naqsh-e Rustam, Kuh-e Rahmat, the land to the edge), every season, hour and weather.
- **Task: a gap hunt (MASTER_PLAN §7, T-J6, T-J7).** You are one of two independent gap hunters; the other works from a different
  checklist and you must not coordinate. Find what a real Persepolis and Marvdasht of 467 BCE would hold (things, people, animals,
  plants, activities, sounds, smells-as-visible-traces, weather and sky phenomena, events, institutions, seasonal changes) that
  the build LACKS, or has only as a placeholder. Work from YOUR checklist below, line by line, then walk each area in thought as a
  person of 467 living there would. For each checklist line, check the code and data (src/, src/data/*.json, research/*.md,
  PROGRESS.md, BLOCKERS.md) to decide PRESENT / PARTIAL / MISSING / ABSENT-BY-EVIDENCE (only when the evidence says it was not
  there in 467). Do NOT read REVIEWS/gap_audit.md or any other gap list (the estimate needs independent lists).
- **Evidence standard:** a PRESENT row names the file that implements it; a MISSING row says why the period would have it (source
  or analogy, tier A/B/C) and where in the world it belongs. Be concrete ("wolves: none; grey wolf ubiquitous in Iran; heard from
  the hills at night, flocks penned against them") not generic.
- **Output:** your final message is the report: problems first (the biggest MISSING rows, ranked by how much their absence breaks
  the time capsule for a walker), then the full table (row id, checklist category, item, status, evidence/file, where, tier, why
  it matters). Aim for breadth: 150+ rows. No edits to the repository.
- **Thresholds (verbatim from gates/thresholds.json):** T-J6 WORLD_INVENTORY's capture-recapture estimate of unfound gaps ≤ 5 %;
  T-J7 0 MISSING rows left unfilled where a probable reconstruction exists (D-207).
- **Your checklist (hunter B):** the brief (PERSEPOLIS_BRIEF.md) line by line (especially §1.1, §5.3-§5.5, §9, §11), the Persepolis
  Fortification and Treasury tablets' commodity and occupation categories as the build's research files record them (grain,
  flour, beer, wine, fruit, livestock and their products, poultry, fish, oil, silver, textiles, tools, the occupations and work
  groups, travel rations, royal table, offerings), a traveller's walk from the Kur bridge to the Terrace roof at each of the eight
  hour bands and four seasons (what would I see, hear, meet, step round, smell the traces of), and natural phenomena (weather,
  sky, water, geology, fauna by habitat: river, reedbed, field, steppe, rock slope, mountain, settlement, sky).
