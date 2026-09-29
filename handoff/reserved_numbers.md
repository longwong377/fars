merged session 12 (b82cd90, a3d2af5; B136 used) |first pass merged session 12 (87d1834, up to d417818); e7290b1 NOT merged (breaks 2 sculpt tests; plan in sessions/s12.md); no Q/B used |merged session 12 (391d995, round 2 5180cad; no Q/B used) |merged session 12 (c1d6516; no Q/B used) |merged session 12 (two passes: 38b2221, ada7346; Q-860, B124 used) |# Reserved record numbers (MASTER_PLAN §6 session loop; T-R6)

Every number reserved for an agent, with its branch and fate. A number cited in MASTER_PLAN.md or CLAUDE.md must exist in its
record (DECISIONS, OPEN_QUESTIONS, BLOCKERS) or in this table (tests/scope_ledger.test.ts). At session close every row's fate
is "merged <commit>" or "abandoned: <why>"; none stays "in flight" across a session unrecorded.

| number | session | workstream | branch | fate |
|---|---|---|---|---|
| D-229 | s8 | Phase 5 review fixes (C1, M4, M3) | worktree-agent-a77ac53305a706d11 | merged c461ebe |
| D-234 | s8 | the town's real houses (Q-610..Q-629, B59..B60) | worktree-agent-af2da6f89e949d64f | merged (session 8, 8313f77) |
| D-235 | s8 | coverage harness for every inch (Q-630..Q-639) | worktree-agent-af3e66fbfe7229375 | merged (session 8, eb776b3) |
| D-237 | s8 | walkability: fall-through, walk everywhere, autosave (Q-640..Q-649, B61..B62) | worktree-agent-a1aaf525d1db6ee63 | merged (session 8, bbc4e99) |
| D-244 | s8 | indoor truth on screen (Q-650..Q-659, B63..B64) | worktree-agent-af7d905287e998e62 | merged (session 8, 78f2a3b) |
| D-245 | s8 | the town is not mute (Q-660..Q-669, B65..B66) | worktree-agent-af46721eb7f032c30 | merged (session 8, after 22956d7) |
| D-249 | s9 | town walkability: doors and lane clearance (Q-670..Q-679, B67..B69) | worktree-agent-a9436d235d3ab7e79 | merged 8e78687 (agent stopped by an interruption; its uncommitted work kept as WIP c8a1e13; T-H1r/T-H1s not met, B67) |
| D-250 | s9 | cached world (lead; speed plan D-248 step 1) | claude/amazing-fermi-40ds7j | merged (session 9, lead's own commits on the branch) |
| D-251 | s9 | tiered tests (lead; speed plan D-248 step 2) | claude/amazing-fermi-40ds7j | merged (session 9, lead's own commits on the branch) |
| D-252 | s9 | the court's arrival simulated; a new game starts before it (Q-680..Q-689, B70..B72) | worktree-agent-a05470624036dba65 | merged 8d7f15c (agent stopped by an interruption before its soak: unverified) |
| D-253 | s9 | the renderless world (?norender) and its throughput (lead) | claude/amazing-fermi-40ds7j | merged (session 9, lead's own commits on the branch) |
| D-254 | s9 | villages as real places (Q-690..Q-699, B74..B76) | worktree-agent-a40a663d397a906e6 | merged (session 9; Q-693..Q-699 unused) |
| D-255 | s9 | crafts and records in action (Q-700..Q-709, B77..B79) | worktree-agent-a6b224ab6a23fe3b1 | merged (session 9; Q-704..Q-709 and B77..B79 unused) |
| D-256 | s9 | work on the land (Q-710..Q-719, B80..B82) | worktree-agent-ab76e505f3151e55f | merged (session 9; Q-715..Q-719 and B82 unused) |
| D-257 | s9 | the fords; the Pasargadae road redrawn (lead; Q-720..Q-721) | claude/amazing-fermi-40ds7j | merged (session 9, lead's own commits on the branch) |
| D-258 | s9 | the small life and the bats; puddles only on level ground (lead; B83) | claude/amazing-fermi-40ds7j | merged (session 9, lead's own commits on the branch) |
| D-259 | s9 | pulses and garden plots (lead) | claude/amazing-fermi-40ds7j | merged (session 9, lead's own commits on the branch) |
| D-260 | s9 | laughter, children's calls, babies crying (lead) | claude/amazing-fermi-40ds7j | merged (session 9, lead's own commits on the branch) |
| D-261 | s9 | hoarfrost; the 22 deg halo and sun dogs (lead) | claude/amazing-fermi-40ds7j | merged (session 9, lead's own commits on the branch) |
| D-262 | s9 | more birds seen (lead) | claude/amazing-fermi-40ds7j | merged (session 9, lead's own commits on the branch) |
| D-263 | s9 | frogs, tortoises, snakes, jirds (lead) | claude/amazing-fermi-40ds7j | merged (session 9, lead's own commits on the branch) |
| D-264 | s9 | thorn cushions, camelthorn, thistles (lead) | claude/amazing-fermi-40ds7j | merged (session 9, lead's own commits on the branch) |
| D-265 | s9 | dust devils (lead) | claude/amazing-fermi-40ds7j | merged (session 9, lead's own commits on the branch) |
| D-266 | s9 | hail (lead) | claude/amazing-fermi-40ds7j | merged (session 9, lead's own commits on the branch) |
| D-267 | s9 | breath in the cold (lead) | claude/amazing-fermi-40ds7j | merged (session 9, lead's own commits on the branch) |
| D-268 | s9 | heat shimmer and mirage (lead; opt-in) | claude/amazing-fermi-40ds7j | merged (session 9, lead's own commits on the branch) |
| D-269 | s9 | owl, bulbul, roller, ducks; water birds off the river beds (lead) | claude/amazing-fermi-40ds7j | merged (session 9, lead's own commits on the branch) |
| D-270 | s9 | coughs (lead) | claude/amazing-fermi-40ds7j | merged (session 9, lead's own commits on the branch) |
| D-271 | s9 | alfalfa and flax (lead) | claude/amazing-fermi-40ds7j | merged (session 9, lead's own commits on the branch) |
| D-272 | s9 | roses in the paradise (lead) | claude/amazing-fermi-40ds7j | merged (session 9, lead's own commits on the branch) |
| D-273 | s9 | roof timber arriving (lead) | claude/amazing-fermi-40ds7j | merged (session 9, lead's own commits on the branch) |
| D-274 | s9 | the Moon drawn additively; earthshine (lead) | claude/amazing-fermi-40ds7j | merged (session 9, lead's own commits on the branch) |
| D-275 | s9 | two lanes at full rate, ring by ring (lead; UD-16) | claude/amazing-fermi-40ds7j | merged (session 9, lead's own commit) |
| D-276 | s9 | Terrace rooms: Treasury, Harem, garrison, guard quarters (Q-730..Q-739, B85..B87) | agent worktree (terrace_rooms) | stopped at session 10's close (move to a GPU machine): WIP saved as handoff/wip/terrace_rooms_D276.patch (+ _report.md), NOT merged; its D-276, Q-730..Q-733, B85, B86 rows are inside the patch; Q-734..Q-739, B87 unused |
| D-277 | s10 | the instruments: area registry, generated board, Tier 0 (Q-740..Q-749, B88..B90) | agent worktree (instruments) | merged session 10 (Q-740..Q-743 used; B88 used by the lead for its Q-740 finding; B89-B90 unused) |
| D-278..D-284, D-286..D-291, D-293..D-299 | s10 | the lead's own decisions (D-285, D-292 are agents') | claude/amazing-fermi-40ds7j | used D-278..D-284, D-286..D-291, D-293, D-294; D-295..D-299 free |
| (none) | s10 | gap hunter C (research only; brief handoff/briefs/s10/gap_hunter_C.md) | read-only | done: REVIEWS/gap_hunt_s10_C.md, merged into WORLD_INVENTORY.md |
| D-285 | s10 | Terrace materials against the references (Q-750..Q-759, B91..B93) | agent worktree (terrace_materials) | stopped at session 10's close: WIP saved as handoff/wip/terrace_materials_D285.patch (+ _report.md), NOT merged; Q-750, Q-751 in the patch; no D-285 row yet |
| D-292 | s10 | the body and the day: pregnancy, bodily care, the washing rule, small lives (Q-760..Q-769, B94..B96) | agent worktree (body_and_day) | stopped at session 10's close: WIP saved as handoff/wip/body_and_day_D292.patch (+ _report.md), NOT merged; no D-292 row yet; no Q/B used |
| D-295 | s11 | the lead: CC0 scanned surface detail over the procedural surfaces; the adapter's texture limit (B7, B24) | s11-scans | merged session 11 (claude/amazing-fermi-40ds7j) |
| D-296 | s11 | speaking with the people (UD-18, T-E9): baked lives, in-browser speech recognition, language model and voices, the translation layer (Q-770..Q-779, B97..B99) | agent worktree (conversation), branch s11-conversation | merged session 11 (behind ?converse; T-E9 61 %, B97-B99) |
| D-297 | s11 | the lead: the fires' light at the eye weighted by the view direction (night views black beside a brazier) | claude/amazing-fermi-40ds7j | merged session 11 |
| D-298 | s11 | the lead: the sun against JPL Horizons (B2) | claude/amazing-fermi-40ds7j | done |
| D-299 | s11 | the lead: compileAsync in the scene pass context (rejected) | claude/amazing-fermi-40ds7j | done (branch s11-compile not merged) |
| D-300 | s11 | every inch real: the Terrace and the palaces' exteriors (Q-780..Q-789, B100..B102) | agent worktree (realism_terrace) | merged session 11 (Q-780..Q-785, B100..B102 used) |
| D-301 | s11 | every inch real: the interiors (Q-790..Q-799, B103..B105) | agent worktree (realism_interiors) | merged session 11 (Q-790, B103, B104 used) |
| D-302 | s11 | every inch real: the plain, the rivers and the mountains (Q-800..Q-809, B106..B108) | agent worktree (realism_land) | merged session 11 (B106 used; Q-800..809, B107, B108 unused) |
| D-303 | s11 | every inch real: the town and the villages (Q-810..Q-819, B109..B111) | agent worktree (realism_town) | NOT merged at session 11 close: branch s11-realism-town pushed; its scans.ts normal maps conflict with D-300's (merge plan in HANDOFF.md) (Q-810..Q-812, B109..B111 used) |
| D-304 | s11 | every inch real: the people seen close (Q-820..Q-829, B112..B114) | agent worktree (realism_people) | merged session 11 through s11-people2 (D-307 merged it in; Q-820..829 unused, B112..B114 used) |
| D-305 | s11 | the Blender asset pipeline: inventory, pipeline, a hero asset, the rollout plan (Q-830..Q-839, B115..B117) | agent worktree (blender) | merged session 11 (Q-830, B115 used; B115 resolved by D-306) |
| D-306 | s11 | the carving: capitals and the Gate colossi from the photographs (Q-840..Q-849, B118..B120) | agent worktree (carving) | merged session 11 (Q-840..Q-843, B118..B120 used) |
| D-307 | s11 | the people, round 2: garments, hair and beards (Q-850..Q-859, B121..B123) | agent worktree (people2) | merged session 11 (B121..B123, Q-850 used; Q-851..Q-859 unused) |
| D-308 | s11 | the lead: mass production on the GPU machine (UD-19, T-R12) | claude/amazing-fermi-40ds7j | done (the session 12 plan) |
| D-309 | s12 | the lighting at the T4's full quality (Q-860..Q-869, B124..B126) | agent worktree T:/fars-wt/lighting, branch s12-lighting | merged session 12 (two passes: 38b2221, ada7346; Q-860, B124 used) |
| D-310 | s12 | CC0 3D models in bulk: rocks, flora, jars, baskets, props (Q-870..Q-879, B127..B129) | agent worktree T:/fars-wt/models, branch s12-models | merged session 12 (c1d6516; no Q/B used) |
| D-311 | s12 | the Blender mudbrick house kit; every house rebuilt (Q-880..Q-889, B130..B132) | agent worktree T:/fars-wt/housekit, branch s12-housekit | merged session 12 (391d995, round 2 5180cad; no Q/B used) |
| D-312 | s12 | the monuments' forms: protome, colossi, reliefs, block faces (Q-890..Q-899, B133..B135) | agent worktree T:/fars-wt/monuments, branch s12-monuments | first pass merged session 12 (87d1834, up to d417818); e7290b1 NOT merged (breaks 2 sculpt tests; plan in sessions/s12.md); no Q/B used |
| D-313 | s12 | the people's forms: garments, belts, hair and beards (Q-900..Q-909, B136..B138) | agent worktree T:/fars-wt/people, branch s12-people | merged session 12 (b82cd90, a3d2af5; B136 used) |
| D-314..D-319 | s12 | the lead's own decisions (Q-910..Q-919, B139..B141) | claude/amazing-fermi-40ds7j | D-314 used (the CPU bake; tool uncommitted, see sessions/s12.md); D-315..D-319, Q-910..Q-919, B139..B141 unused |
| D-320 | s12 | Blender, all of it: reliefs (Q-920..Q-929, B142..B144) | agent worktree T:/fars-wt/reliefs, branch s12b-reliefs | merged session 12 (final merges 04:30-04:55 UTC, 2026-09-28) |
| D-321 | s12 | Blender, all of it: blocks (Q-930..Q-939, B145..B147) | agent worktree T:/fars-wt/blocks, branch s12b-blocks | merged session 12 (final merges 04:30-04:55 UTC, 2026-09-28) |
| D-322 | s12 | Blender, all of it: garments (Q-940..Q-949, B148..B150) | agent worktree T:/fars-wt/garments, branch s12b-garments | merged session 12 (final merges 04:30-04:55 UTC, 2026-09-28) |
| D-323 | s12 | Blender, all of it: hairhands (Q-950..Q-959, B151..B153) | agent worktree T:/fars-wt/hairhands, branch s12b-hairhands | merged session 12 (final merges 04:30-04:55 UTC, 2026-09-28) |
| D-324 | s12 | Blender, all of it: houselod (Q-960..Q-969, B154..B156) | agent worktree T:/fars-wt/houselod, branch s12b-houselod | merged session 12 (final merges 04:30-04:55 UTC, 2026-09-28) |
| D-325 | s12 | Blender, all of it: props (Q-970..Q-979, B157..B159) | agent worktree T:/fars-wt/props, branch s12b-props | merged session 12 (final merges 04:30-04:55 UTC, 2026-09-28) |
| D-326 | s12 | Blender, all of it: animals (Q-980..Q-989, B160..B162) | agent worktree T:/fars-wt/animals, branch s12b-animals | merged session 12 (final merges 04:30-04:55 UTC, 2026-09-28) |
| D-327 | s12 | Blender, all of it: trees (Q-990..Q-999, B163..B165) | agent worktree T:/fars-wt/trees, branch s12b-trees | merged session 12 (final merges 04:30-04:55 UTC, 2026-09-28) |
| D-315 | s12 | conversations act on the world and are remembered per save (UD-21; Q-910..Q-919, B139..B141) | agent worktree T:/fars-wt/talk, branch s12b-talk | merged session 12 (final merges 04:30-04:55 UTC, 2026-09-28) |
| D-328 | s12 | Blender, all of it (wave 3): columns (Q-912..Q-913, B166..B168) | agent worktree T:/fars-wt/columns, branch s12c-columns | merged session 12 (final merges 04:30-04:55 UTC, 2026-09-28) |
| D-329 | s12 | Blender, all of it (wave 3): ajori_naqsh (Q-914..Q-915, B169..B171) | agent worktree T:/fars-wt/ajori_naqsh, branch s12c-ajori_naqsh | merged session 12 (final merges 04:30-04:55 UTC, 2026-09-28) |
| D-330 | s12 | Blender, all of it (wave 3): decor_tents (Q-916..Q-917, B172..B174) | agent worktree T:/fars-wt/decor_tents, branch s12c-decor_tents | merged session 12 (final merges 04:30-04:55 UTC, 2026-09-28) |
| D-331 | s12 | Blender, all of it (wave 3): impostors (Q-918..Q-919, B175..B177) | agent worktree T:/fars-wt/impostors, branch s12c-impostors | merged session 12 (final merges 04:30-04:55 UTC, 2026-09-28) |
| D-332 | s12 | Blender, all of it (wave 3): smalllife (Q-920, B178..B180) | agent worktree T:/fars-wt/smalllife, branch s12c-smalllife | merged session 12 (final merges 04:30-04:55 UTC, 2026-09-28) |
| D-333 | s12 | wave 4: mocap (Q-921, B181..B183) | agent worktree T:/fars-wt/mocap, branch s12d-mocap | merged session 12 (final merges 04:30-04:55 UTC, 2026-09-28) |
| D-334 | s12 | wave 4: palacewalls (Q-922, B184..B186) | agent worktree T:/fars-wt/palacewalls, branch s12d-palacewalls | merged session 12 (final merges 04:30-04:55 UTC, 2026-09-28) |
| D-335 | s12 | wave 4: land (Q-923, B187..B189) | agent worktree T:/fars-wt/land, branch s12d-land | merged session 12 (final merges 04:30-04:55 UTC, 2026-09-28) |
| D-336 | s12 | voices: a unique natural voice per person, period languages, the Farsi/English opt-in (UD-22; Q-924, B190..B192) | agent worktree T:/fars-wt/voices, branch s12d-voices | merged session 12 (final merges 04:30-04:55 UTC, 2026-09-28) |
| D-337 | s12 | performance: the world playable at high on the T4 (Q-925, B193..B195) | agent worktree T:/fars-wt/perf, branch s12d-perf | merged session 12 (final merges 04:30-04:55 UTC, 2026-09-28) |
| D-338 | s13 | economy and needs core, emergence test (UD-26, T-F9; Q-1000..Q-1004, B196..B198) | agent worktree, branch s13-economy | merged session 13 (7b8bdbb8) |
| D-339 | s13 | talk that changes the world, living_world test (UD-24, T-E13; Q-1005..Q-1009, B199..B201) | agent worktree, branch s13-living | merged session 13 |
| D-340 | s13 | economy in the day plans, deeper crises (UD-26, T-F9; Q-1010..Q-1014, B202..B204) | agent worktree, branch s13-econplans | in flight |
| D-341 | s13 | talk on the real economy, deterministic windows (UD-24, T-E13; Q-1015..Q-1019, B205..B207) | agent worktree, branch s13-living2 | merged session 13 |
| D-342 | s13 | talk volume, news on every meeting, save/load replay test (UD-24, T-E13; Q-1020..Q-1024, B208..B210) | agent worktree, branch s13-living3 | in flight |
