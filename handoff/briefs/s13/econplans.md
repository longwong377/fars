# s13 agent: econplans

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
- Task: make the economy visible and deepen its crises (UD-26, UD-07/UD-08; T-F9). The economy core is merged (src/people/economy/{api,world,chains}.ts, Simulation.economy(), D-338). (1) Day plans read it: households go to market to buy/sell by their stores and prices, borrowers visit lenders, petitioners go to the court/officials, the hungry seek work or help, thieves act at night and the accused are judged (court.ts) — each as a planned activity at a real place, through the existing activities/plans (src/people/sim.ts, population.ts, activities.ts), passing npm run lint:all activity coverage. (2) Deepen the crisis end so theft, arrests, judgements and debt bondage/labour arise from need, with more causal variety (animal loss, illness, fire, a death in the family, a good year, tribute levies), tier C reasoning in DECISIONS. (3) Re-run tests/emergence.test.ts from a committed tree so REVIEWS/evidence/F/T-F9.json carries the commit hash (it recorded "none"); add a test that economy-driven plan activities occur on a seeded week. Do not touch src/people/living/** or talk.ts/talkers.ts (another agent). Reserved: D-340, Q-1010..Q-1014, B202..B204. Done: plans visibly driven by the economy in node previews of a seeded day, emergence test green with a stamped hash, report honest counts of thefts/judgements/petitions per year.
