# s17 CI (the cloud CI session; cloud-s17-ci)
Each run: `npx vitest run --mode fast --maxWorkers=3`, `npx tsc --noEmit -p .`, `npm run guards` on the head in its own worktree
(4-core cloud box, under load from other jobs: timeouts are not verdicts). ON BASE = also fails on origin/s14-int 63d26b45
(the merge base of both int branches); NEW = not on base, with the breaking commit and owner.

## Known on base (confirmed on s14-int 63d26b45, 2026-10-03 00:00Z)
day_slice, exchanges (gate_check 0), fire_occ (bake hash), humans_faces (kandys sleeve), impostor_assets (56.6 MB > 56.1 MB),
instruments (5 vs 4), people_days_r11, people_days_r9, persistence, sim_fixture, talk_prompt (2, 600 s timeouts), visible
(haggled deals); people_belly passed on base and on s17-int in this run (flaky/timing).
Also on base (the cloud lead's list): people_days_r6 (6: rain year-wide timeout, infants d148, minding d101, dust d298, eats
later d181, child in mourning), court_fill (2: audience mornings, party 13), land_work, people_children (lame 0.0218),
coverage (sample by seed), popview (child/walk2 width), people_models (people_cloth hash), sculpt (pieces hash), reliefs
(1.57 M > 1.5 M triangles). (These are in the gate tier: not run by --mode fast.)

## Runs
| head | branch | date (UTC) | vitest files / tests | failed tests | tsc | guards | NEW failures (commit, owner) |
|---|---|---|---|---|---|---|---|
| 2f1351f1 | s17-int | 10-03 00:03-00:57 | 183 files / 1129 | 15 (13 ON BASE) | 15 errors | pass | base_paths (63aba1c8, V1 light: light_lab.ts loads '/'); language image lint dirt_floor/arm.jpg (a23bfea8, V2 materials); tsc tone_look x6 (63aba1c8, V1); tsc x9 fixed by 0e127937 (not yet merged into s17-int) |
