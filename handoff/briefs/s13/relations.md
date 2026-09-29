# s13 agent: relations

You are a worker agent on PĀRSA (repo /home/user/fars, your own worktree branch; do not push). Read USER_DIRECTIONS.md,
MASTER_PLAN.md and CLAUDE.md first. The standard is every walkable area, at the player's lens and quality,
in motion, with sound, at every hour, season and weather. Your work serves the user directions {UD ids} and the thresholds {T- ids, quoted
verbatim from gates/thresholds.json}.

1. Say before you start how your change could pass its tests while the intent fails, and measure against that, not only the test.
2. Prefer the world-wide fix to the per-view fix. A fix proved in one view is not proved everywhere.
3. Evidence: node previews and CPU mirrors first; at most {n ≤ 2} browser runs through tools/dev/queue_e2e.sh.
4. Records: your reserved numbers are D-{d}, Q-{q0}..Q-{q1}, B{b0}..B{b1}; rows are appended, never renumbered.
5. Never lower or reword a threshold (tests/gates_ratchet.test.ts); a threshold you cannot meet goes to BLOCKERS with ≥ 3
   approaches measured.
6. Lead your final report with what is broken, placeholder or unverified on screen; list tests run with results; run
   `git checkout bench-reports/` before committing.
7. Heavy CPU work (soaks, bots, audio renders, bakes, long test runs) goes through `tools/dev/cpu_slot.sh`, one process at a
   time: the four cores are shared with the render lane.
Machine note (session 13, this box): 4 cores, 16 GB RAM, T4. Node-only work; no browser runs (render budget 0). One heavy node process at a time; run vitest with --pool=forks --poolOptions.forks.maxForks=2. Weekly usage is at 84 %: work efficiently, target ~3 h, short final report.
On the GPU machine (session 11 on: Windows, NVIDIA T4, 16 cores, 63 GB, open internet), this clause governs where it
   differs from 3 and 7. Render with Playwright directly on the real GPU (`PW_CHANNEL=chrome --project=gpu`, your own
   E2E_PORT), at the player's lens and quality; a page load is ~11 min, a warm frame 0.1 s, so put all your views in one
   load (moments.spec.ts `BATCH=1`). Never edit files in a tree whose dev server is serving a render (it reloads the page).
   Run node jobs directly (no cpu_slot.sh, flock or python here). Surfaces must read as real at arm's length: use CC0
   scans and assets (Poly Haven, ambientCG; src/render/scans.ts; each recorded in ASSET_LEDGER.md) over the procedural
   base, keeping the measured tints and layouts; a procedural stand-in where a scan exists is a placeholder.

## Slots
- Task: ROADMAP.md item 3e, relationships and sexuality as life, node side (UD-07, UD-08, UD-24, UD-25). Read ROADMAP 3e first, and what exists: src/people/population.ts (spouse, marry, births, courting: courtingOn), src/people/living/** (talk, news), src/people/economy/** (households, bride-price/dowry if any), src/people/wardrobe/**. Build src/people/relations/** (new): per-pair affection, attraction and trust that move with shared time, help, talk and slights; courting and marriage choices arising from them (with the period's arrangement by families, bride-wealth and dowry through the economy interface, tier C where silent); lovers and affairs, desire and rejection, jealousy, scandal carried as news, divorce, doubtful parentage; fertility and conception tied to the couple (feeding the existing births rather than replacing them); the period's law and custom on them (tier C). A player-facing API for the later GPU/speech pass: court, marry, take a lover, share a home and bed, with the partner's own memory of how the player treated them. Not explicit: intimacy is a state change and a cut-away, never an interaction; no player action to undress anyone; minors are never eligible for any of it (assert this in tests). Do not edit economy/**, sim.ts or population.ts beyond one minimal hook (say where; another agent is merging there). Test tests/relations.test.ts on a seeded year: marriages, affairs, divorces, scandals per 1000 adults, each arising from the pair state, replay identical, the minors assertion. Reserved: D-346, Q-1040..Q-1044, B220..B222. Report under 150 words, broken first.
