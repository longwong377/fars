# Reserved record numbers (MASTER_PLAN §6 session loop; T-R6)

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
| D-295 | s11 | the lead: CC0 scanned surface detail over the procedural surfaces; the adapter's texture limit (B7, B24) | s11-scans | in progress (branch s11-scans, merges into claude/amazing-fermi-40ds7j) |
| D-296 | s11 | speaking with the people (UD-18, T-E9): baked lives, in-browser speech recognition, language model and voices, the translation layer (Q-770..Q-779, B97..B99) | agent worktree (conversation) | in progress |
| D-297 | s11 | the lead: the fires' light at the eye weighted by the view direction (night views black beside a brazier) | claude/amazing-fermi-40ds7j | in progress |
| D-298 | s11 | the lead: the sun against JPL Horizons (B2) | claude/amazing-fermi-40ds7j | done |
