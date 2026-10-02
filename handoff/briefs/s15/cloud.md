# Brief s15/cloud: the depth track, in Claude Code on the web (node-only), alongside the Vagon session

## Fixed clauses (copy verbatim)

You are a worker agent on PĀRSA (repo /home/user/fars, your own worktree branch; do not push). Read USER_DIRECTIONS.md,
MASTER_PLAN.md and CLAUDE.md first. The standard is every walkable area, at the player's lens and quality,
in motion, with sound, at every hour, season and weather. Your work serves the user directions UD-07, UD-08, UD-11, UD-21, UD-24, UD-25, UD-26, UD-29 and the thresholds T-F9: "consequence chains per simulated year with no player input, on each of 3 seeds: a chain is >= 3 causally linked state changes across >= 2 households or systems (e.g. a poor harvest -> dearer grain -> a household's debt -> a petition or a theft -> a judgement), none scripted as a sequence; plus the share of such chains the player can enter and change through speech or action (measured on a seeded set of interventions)" >= 50 chains per year (and >= 50 % enterable); T-E13: "share of a seeded week of simulated life (no player input) in which person-to-person talk changes the simulation: arrangements made in talk (work, trade, help, visits, news passed on) that the people then carry out through their plans, measured as the share of talk events with a consequence in the sim within the next 3 game days, plus the share of player-caused changes that propagate to at least one other person" >= 50 %; T-R15: "share of the session's agent packages whose target is an immersion breaker found in whole-view judgement (light, density, life, surfaces, silhouettes at the player's view, against the AAA bar) rather than a match to a reference photograph, counted from the session log" >= 80 %.

1. Say before you start how your change could pass its tests while the intent fails, and measure against that, not only the test.
2. Prefer the world-wide fix to the per-view fix. A fix proved in one view is not proved everywhere.
3. Evidence: node previews and CPU mirrors first; at most 0 browser runs through tools/dev/queue_e2e.sh.
4. Records: your reserved numbers are D-370, Q-1230..Q-1259, B400..B429; rows are appended, never renumbered.
5. Never lower or reword a threshold (tests/gates_ratchet.test.ts); a threshold you cannot meet goes to BLOCKERS with ≥ 3
   approaches measured.
6. Lead your final report with what is broken, placeholder or unverified on screen; list tests run with results; run
   `git checkout bench-reports/` before committing.
7. Heavy CPU work (soaks, bots, audio renders, bakes, long test runs) goes through `tools/dev/cpu_slot.sh`, one process at a
   time: the four cores are shared with the render lane.

## Your context pack (the cloud session; governs where it differs from the clauses above)

You are a Claude Code session in the cloud working on PĀRSA (a walkable, living Persepolis of 467 BC). A second session runs
at the same time on the GPU machine (Vagon) and owns everything visual. You own the depth: every person's life, the
simulation, the speech sandbox. The user (UD-29, session 15): "every inch of that world needs to put you there and it needs to
be just as deep as it is beautiful". Read CLAUDE.md, USER_DIRECTIONS.md (UD-07, UD-08, UD-11, UD-21..UD-29) and MASTER_PLAN.md
first; CLAUDE.md "in the cloud (node-only), the depth first" is your track.

## Git (strict: two sessions push to one repo)
- Start: `git fetch origin && git checkout -b cloud-s15-depth origin/s14-int` (`git fetch --unshallow` if shallow).
- Push only to `cloud-s15-depth` (and `s13-bridesmerge` for task 1). Never push to s14-int, claude/amazing-fermi-40ds7j or
  claude/new-session-lfjkbn: the Vagon lead merges you. Never force-push.
- Every ~hour: `git fetch origin && git merge origin/s14-int` (records conflict as unions of rows), re-run your tests, push.

## Ownership (the Vagon session does not touch these while you run)
- **Yours:** src/people/** EXCEPT the render side (looks.ts, humanGPU.ts, humanMaterial.ts, humanRig.ts, impostors.ts,
  popview.ts, crowd.ts, bodyShape.ts, softbody.ts: Vagon's); tests/people*.test.ts and every test of the files you own;
  tools/soak*; research/PEOPLE.md.
- **Not yours:** src/render/**, src/world/**, src/arch/**, tools/blender/**, public/** (a needed change there: the smallest hook,
  named in your report).
- **Numbers reserved for you:** D-370..D-379, Q-1230..Q-1259, B400..B429.

## The work, in order (bulk: whole systems, every person; no showcase NPC)
1. **The adult-brides branch (B230):** `s13-bridesmerge` (908fee4e) was never merged because comparing its people_days test
   failures against main takes hours, and those runs kept dying on the 4-core box. Run the d211 and people_days files on both
   (main = origin/s14-int), list which failures are the branch's own, fix those, merge s14-int into it, push it, report.
2. **The remaining speech-sandbox mechanics, node side (UD-25):** (3) work and livelihood: the stranger can be hired, paid,
   owed and fired by real employers in the economy; (6) learning the language: the stranger's comprehension grows with
   exposure, people simplify and gesture; (7) identity: who the stranger claims to be spreads by rumour, is believed or doubted
   by trust, and changes how people treat them; (8) petitions and authority: asking an official, a headman or the court for a
   ruling, with real outcomes; (9) hospitality: guest-right, meals, a place to sleep, obligations it creates; (10) groups:
   joining a work gang, a caravan, a household. The model proposes, the simulation decides. Each mechanic: state in the
   simulation, saved and replayed; consequences that chain (T-F9); tests.
3. **The depth audit (UD-07/08/11):** follow 20 random people for a day on 3 seeds (renderless): home, family, work, history,
   reasons, voice, a conversation grounded in their own life, the day and year changing around them. List where each is thin,
   then fix the thinnest systems for everyone (not the 20).
4. Overnight-scale runs belong here: the people_days files, the soak per seed. Report their numbers.

## Rules
- Never lower a threshold or loosen a test to pass it (`npm run guards` runs on every commit; never bypass the hook).
- §10 language rule and the anachronism list hold in the world; UD-24 loosens what people talk about, not the scripts.
- Commit often; push every hour; one DECISIONS row per package (your D numbers).
- At the end: a report in sessions/s15-cloud.md: broken first, what a player would now meet differently, numbers, branch tip.
