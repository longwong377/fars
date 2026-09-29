# s13 agent: simjoin

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
- Task: join the new systems into one saved, fast, balanced simulation (UD-26, UD-24; T-F9, T-E13, T-H3r). All of this session's work is merged at c3b9fc2e: economy (src/people/economy/**, D-338/D-340/D-343), talk (src/people/living/**, D-339/D-341/D-342/D-344), wardrobe (src/people/wardrobe/**, D-345). Read those DECISIONS rows first. (1) Load speed and save size: a day-300 save loads in 3.6-10.5 s and is 6.6 MB, mostly the economy replaying ~58k intents; snapshot the economy's stores and state at the save day (index intents by day if still needed) so a day-300 load is < 2 s of node time and the save < 1 MB, replay still identical (persistence, living_world tests). (2) The wardrobe's ledger into the save (sim.ts save/load). (3) Washing and bathing: the plans hold washing trips on only 9 of ~840 household-days a week and no bathing days; add laundry days and bathing in the plans at a period-plausible rate (tier C), so clothes are not near-fully dirty. (4) The economy's illness and death reach the Population (sickbed, funeral, the person gone), no double deaths. (5) Balance: with talk help (66k gifts a year) seed 1 now has 3 thefts and 207 petitions a year; check against plausible rates by analogy and tune so crises remain real on all three seeds (1, 7, 42) without the old seed-7 runaway; report per-seed counts. Another agent works in src/people/relations/** (new) with one small hook: stay out of it. Reserved: D-347, Q-1045..Q-1049, B223..B225. Report under 150 words, broken first.
