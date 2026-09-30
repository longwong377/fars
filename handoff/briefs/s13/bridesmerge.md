# s13 agent: bridesmerge

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
- Task (~1.5 h; weekly budget at 94 %, so no waste): finish and merge the adult-brides branch. Main (2c2180f1) holds D-348 (nobody under 18 marries; ages raised after the bride draw, so weddings fell from 353 to ~120 a year). Branch s13-brides (2929ab64, on origin; worktree at C:/Users/Administrator/fars-wt/brides with node_modules junctioned) redraws brides among women 18+ (~300 weddings a year), moves person ids, re-pins 5 r6 ids, fixes 4 planner faults (D-349). Open: B229 (one new people_days_r6 failure: a child labelled "minding the little ones" while with their mother at another house) and B230 (34 failures in the other people_days files, unknown which are new). The lead is running all tests/people_days*.test.ts on both trees in the background (C:/Users/Administrator/fars-wt/cmp.sh; results in C:/Users/Administrator/fars-wt/pd_fars.json = main and pd_brides.json = brides, vitest JSON; the file C:/Users/Administrator/fars-wt/cmp.done appears when both are finished, ~1-2 h): DO NOT run people_days on those trees yourself meanwhile (4 cores, 16 GB). Work in your own worktree from s13-brides; first fix B229 by reading code (population.ts / economy/plans.ts labels), and once cmp.done exists read the two JSONs: for every test failing only on brides, fix the cause (re-pin only if a pinned person id moved, same property, reason in DECISIONS; never weaken a check), then re-run just those files. Then merge into main-based history: merge main (2c2180f1) into your branch, run adult_only, relations, relations_plans, living_world, persistence, wardrobe, simjoin, emergence in small batches, guards, commit. Do not push; report so the lead merges. Reserved: D-350, Q-1058..Q-1059, B231..B232. Report under 100 words, broken first.
