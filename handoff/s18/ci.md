# s18 CI (C7, cloud-s18-c7-ci, D-710)
Each run: `npx vitest run --maxWorkers=3` (the full suite, every tier), `npx tsc --noEmit -p .`, `npm run lint:all` on the s17-int
head in its own worktree (4-core cloud box; a test that only times out under load is re-run alone before it counts). NEW = not on
the previous head, with the commit that broke it (bisected) and its owner. OLD = also failing before this session's wave.

## Runs
| head | date (UTC) | files / tests | failed | tsc | lint:all | NEW failures (commit, owner) |
|---|---|---|---|---|---|---|
| 0ff7edef | 10-03 02:42 | (killed at ~100 min for memory when the head moved twice; no table) | | | | |
| ca471bef | 10-03 04:43- | running | | | | court_fill tents on a road (bd141ed7 D-730: fixed by the lead cdaeaf78); plain village frame 2.05 M > 2.0 M (64d8f0c1 C2 D-660); language image registry, 83 KTX2 (C9 D-740: fixed by C7 6d40f45f); horizonmap stale after the meander (ef9df75f C3 D-670: re-baked by C7 2e8b302d); terrain ring seams 53 m apart + terrain_walk mid/far gap (ef9df75f C3 D-670); settlement_build walk to q_w1 blocked at (-451.9, 265.6) (5819c8ef C2 D-661) |
| eb6f768f | 10-03 07:20-09:40 | 280 files (264 reported) / 2056 tests | 78 tests in 41 files (11 timeouts under load; list: ci_fails_eb6f768f.txt) | 0 errors | red: language (cat KTX2 C14, DNc C15) | C13: persian LOD budgets (96f1ae4b, fixed by C13 2e672f33), robe_upper (54655633), people_drape ΔE 12 (e9341d07), people_models hair/cloth stale (outfits.ts); C15: DNc carved without text (592d1b2f); C14: cat KTX2 unregistered (2c212081), impostor frames 71 vs 68 (f6ffdede); C2: fauna route / camp_life train / town_glow / plain_d223 fields (5819c8ef), plain_d223 radial run (9522767b), plain static 2.007 M; C1: crafts tannery/press 62 m (5a3c79f6), person_census name share (6371b169); C11: Math.random in score.ts (5cac851e) |

## OLD failures: root cause, owner, state
| test | root cause | owner | state |
|---|---|---|---|
| instruments | D-255 (fbaa17fc) added a 5th prop class (crafts' tools); test expected 4 | C7 | fixed 8071a409 |
| religion (3) | funerals: pinned farmer 15310 no longer bereaved on d245 (population changed since s8); magus year: first plan() of a day runs the day's economy (fdcc8e56 D-340, ~0.8 s/day, 330 s idle vs 120 s); planCheck year: load timeout | C7 | fixed 1ce09dfe |
| sculpt (pieces hash) | the only input changed since D-328 is D-393's parallel fetch in sculpt.ts (cf0fb4de); rebuilt: all 8 pieces byte-identical | C7 | fixed e8f71e43 |
| humans_faces (kandys) | D-322 rev 4 (5ccd9bb0) moved the empty sleeves onto the coat's back (and 14x10 tubes); test still looked beside the arms | C7 | fixed 9752c090 |
| people_children (lame share) | D-292 (f33c75e8) few-day limps after a work injury (injuryOn) counted with D-215's lasting lameness: 2.0 % vs 0.6 % | C7 | fixed |
| popview (child/walk2 width) | D-333 mocap walk (9a125611): the child's swinging arm is under half a texel in the 32 px alpha-tested cell; width has two edges, the bound is a texel per edge | C7 | fixed |
| coverage (sample by seed) | the sampler's output drifts with the world (nav, town): 178 of 515 points; regenerated with the same seed and commit, as bf31e17a | C7 | fixed 1df8b733 |
| arch (literals) | the literal lint read terrace_rooms.ts's `/** D-276 … */` doc comment as a dimension (block comments not stripped) | C7 | fixed |
| blender_assets (12 stale) | input hashes moved by two edits that do not touch the builds (sculpt.ts D-393 loader; sculpt.json re-hash): with those files at their built versions all 12 match | C7 | fixed 0b170400 |
| blender_assets (4) | s17 V4 D-510/511 (7611c620, 44e649e0, Vagon): colossus_lamassu stale (its scan inputs changed, not rebuilt), capital_protome and colossus_bull never `--verify`d, a level's AO map blank (ao_mean 1) | V4 / C10 | ask: rebuild + verify on a Blender box |
| court_fill audience, party led (2) | REAL BUG: EconPlans.pick (fdcc8e56 D-340) sends court people to the town market: the whisk-bearer keeps a barley stall through an audience, a delegation leader sells beer mid-audience. Patch: `&& !P.court?.owns(x)` in pick's member filter (both pass) | C8 | ask sent with patch |
| reliefs (1.57 M > 1.5 M) | D-320 round 4b (693da7b7): the cypress crown 2.5x wider (half-width 0.075 -> 0.185); worst E façade a=-16.8 off 1.2 m: L0 683 k | C10 | ask sent |
| people_children (palms 13.2 > 12 cm) | s17 V3 D-500 SKIRT_KNEE (41deb6f7; keep 1 -> passes): the skirted mother's hand-hold no longer meets the child's | C14 (anim.ts) | ask sent |
| land_work (planCheck) | 16 issues in plain days, most in economy-inserted steps: hired day labour 'in the cold undressed' (dress not applied to econ steps), 1.5 h queues before the quarter's elder, meal gaps of 8-11 h, 'with the household' with nobody there | C8 (economy), C13 (dress), C1 (meals) | to send |
| people_days_r3 (water drawn) | a road-folk girl's jar of buttermilk (roadFolk.ts, s17 C10 D-640) read as the house's water | C7 | fixed 24f22d89 |
| person_census (one-sided spouses, 3 seeds) | the census asked kin only of people present that day: s17 C10's road-folk wives at home off the map (5e875732) counted one-sided | C7 | fixed 52472425 |
| settlement_build (meshes ≤ 45) | 48 at d1adeedf (s17 C1 D-550 six door forms), 51 by s17's end, 55 with s18 C2 | C2 | ask sent |
| persistence (save-load-save) | `npc.people.deeds.z` re-saves smaller after a load (831,583 vs 808,059 chars): the deeds engine does not restore all it saves | C8 (deeds) | to send |
| exchanges (gate_check 0 in 8 days) | no guard at a check post meets a courier/official/porter among the agents; bisecting 2c2180f1..63d26b45 | C8 / C1 | in progress |
| adult_only | road-folk wives floored at 16 (s17 C10 D-640), under D-348's ADULT 18 | C7 | fixed (roadFolk.ts) |
| econ_plans (moves without a walk) | DeedWorld.overlay cutIn lays goals' stretches with no walk, over the economy's walks (D-461) | C8 | patch sent (handoff/s18/patches) |
| exchanges (gate_check) | seed 1 has no courier/official/porter within 8 m of a guard at a check post since 61f93192 (seeds 2-4: ~100) | C1 / C8 | sent |
| day plans read after the world moved on | a past day's laid deeds/visits are dropped once the world advanced (9 of 1,176 sampled plans differ) | C8 / C1 | sent |
