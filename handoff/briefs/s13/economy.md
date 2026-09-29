# s13 agent: economy

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
- Task: the emergent economy and needs core (UD-26; T-F9 verbatim in gates/thresholds.json). Per-household stores, needs (food, fuel, water, cash, help, health, kin), harvests driven by the existing calendar/weather/season, grain and goods prices from supply and demand, debts and loans, household decisions under need (sell, borrow, work for wages, petition, steal) and justice (court.ts) — no scripted sequences. Build tests/emergence.test.ts measuring chains per simulated year on 3 seeds (>=3 causally linked state changes across >=2 households or systems, deduplicated by shape) plus the enterable share via seeded interventions. Files: src/people/economy/** (new, you own api.ts), hooks into src/people/sim.ts/population.ts minimal. Done: emergence.test.ts runs; report the measured chain count honestly (the threshold stays; if short, BLOCKERS with approaches). Reserved: D-338, Q-1000..Q-1004, B196..B198.

Shared interface (both agents code to it; economy owns it): src/people/economy/api.ts exports
  type NeedKind = "food"|"fuel"|"water"|"cash"|"help"|"health"|"kin"; interface HouseholdNeed { hh: string; kind: NeedKind; urgency: number /*0..1*/ }
  interface Intent { kind: "trade"|"work"|"help"|"visit"|"news"|"loan"|"petition"; from: string; to: string; day: number; payload: Record<string, number|string> }
  interface EconWorld { needsOf(hh: string): HouseholdNeed[]; price(good: string, day: number): number; applyIntent(i: Intent): { ok: boolean; changes: string[] }; step(day: number): void; snapshot(): unknown }
All state is seeded (src/people/hash.ts) and replays identically; saved via the existing save path.
