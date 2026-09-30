# s13 agent: trust

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
- Task (~1.5 h, commit early and often: the weekly budget is near its cap and the lead may stop you): the first two UD-25 mechanics, node side (UD-25, UD-26; ROADMAP pillar 4). (1) Reputation and trust: per person, household and group (quarter, trade, kin), moving with deeds, debts paid or defaulted, help given, news heard (living/** news), judgements (court.ts), and the player's own events; readable by everything that decides (lenders' credit, who helps whom, who talks to the stranger). (2) Haggling and barter: a structured exchange between the player (or any two people) for goods/services/favours, priced by the economy (Economy.price, needsOf), shifted by trust, urgency and the haggler's skill, resolved by the simulation (the model will only propose later); deals enter the economy as intents with causes so they join chains. New dir src/people/speech/** (you own it); hooks into economy/**, living/**, sim.ts minimal and named; the main checkout is at 08868d73 (plus s13-bridesmerge pending in another tree: avoid population.ts). Save/load: state in the save, replay identical. Tests tests/trust.test.ts, tests/haggle.test.ts on a seeded year/week, honest measured numbers (how trust differs between honest and defaulting households; price spread in haggles; chains that include a haggle or a trust change). Only one heavy node run at a time (a long people_days run is using two cores). Reserved: D-351, Q-1060..Q-1064, B233..B235. Report under 100 words, broken first.
