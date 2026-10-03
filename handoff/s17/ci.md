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
| 0cc1d212 | cloud-s17-int | 10-03 00:58-02:17 | (stopped: talk_prompt's synchronous buildTestSet held one worker 76+ CPU-min; the lead moved CI to s17-int) | - | 6 errors (tone_look, V1 63aba1c8) | pass | as s17-int 2f1351f1 for tsc |
| 266c0719 | s17-int | 10-03 02:17-02:37 | 188 files / 1179 (talk_prompt excluded: ON BASE, 70+ min) | 15 (10 ON BASE) | clean | pass | language image lint: public/textures/clay_block_wall/arm.ktx2 not registered (c6f0dd34, V2 materials, D-490 KTX2 scans); person_census x3 (H.oneSided spouses 1388/1405/1424 vs 0, line 47; passes on base; bisected to 5e875732, C10 life: the road folk made persons); settlement_build meshes 51 > 45 (line 30; passes on base; bisected to d1adeedf, C1 town: street doors in six forms). C1 and C10 sessions are inactive (send_message refused): for the s18 owners. Fixed since 2f1351f1: base_paths, tsc, fire_occ passes |
| 18bd8c07 | s17-int | 10-03 02:55-03:15 | 188 files / 1179 (talk_prompt excluded) | 14 (10 ON BASE) | clean | pass | person_census x3 (5e875732, C10) and settlement_build 51 > 45 (d1adeedf, C1) still NEW; the language image lint (V2) now passes. (The 169e0f4f run was lost to a container restart.) |

## End of s17 CI (03:15 UTC): open NEW failures for s18
- tests/person_census.test.ts (3 seeds), line 47: `H.oneSided` spouses 1388/1405/1424, expected 0. From 5e875732 (C10: the road folk made
  persons). Repro: `npx vitest run tests/person_census.test.ts -t "seed 1"`.
- tests/settlement_build.test.ts "settlement geometry budget", line 30: meshes 51 > 45. From d1adeedf (C1: street doors in six forms,
  three new kit leaves). Repro: `npx vitest run tests/settlement_build.test.ts -t "geometry budget"`.
- talk_prompt (ON BASE) holds one worker 70+ CPU-min in a synchronous buildTestSet (population plan), so its 600 s timeout cannot fire;
  exclude it (`--exclude tests/talk_prompt.test.ts`) for a ~20 min fast tier on 4 cores, or fix the test set's size.
