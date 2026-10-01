# s13 agent: needsasks

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
- Task (~1.5 h, commit early and often: the weekly budget is near its cap and the lead may stop you): UD-25 mechanics 2 and 5, node side (UD-25, UD-24, UD-26). (2) Needs surfaced in talk as emergent asks, no quest UI: from the economy's needs (Economy.needsOf, stores, debts, illness, a missing animal, a theft, a petition in progress, a lost child, a burnt house) derive, per person, the asks they would make to a stranger and to kin/neighbours: a structured list (who, what, why, how urgent, what would satisfy it, what the world does if ignored or met), readable by the later model/voice layer; meeting an ask (the player's deed or another person's) changes the economy and trust, and unmet asks escalate by the simulation's own rules, never scripted. (5) Rumour and information spreading beyond living/**'s news: what is known, by whom, how distorted (a seeded distortion per hand, tier C), how it moves along kin, neighbour, trade and work ties, and what it makes people do (avoid, help, gossip, demand, flee). Reuse living/** news and relations/**; new dir src/people/asks/** (you own it); hooks into economy/**, living/**, sim.ts minimal and named; avoid population.ts. Another agent (s13 trust) owns src/people/speech/** (trust, haggling). Save/load: state in the save, replay identical. Tests tests/asks.test.ts, tests/rumour.test.ts on a seeded year/week with honest measured numbers (asks per 1000 people a day by kind, share met, escalations; rumour reach and distortion by hops). Keep CPU light: one node run at a time (a long test run and another agent use the cores). Reserved: D-352, Q-1065..Q-1069, B236..B238. Report under 100 words, broken first.
