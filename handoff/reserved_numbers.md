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
| D-250 | s9 | cached world (lead; speed plan D-248 step 1) | claude/amazing-fermi-40ds7j | in flight |
| D-251 | s9 | tiered tests (lead; speed plan D-248 step 2) | claude/amazing-fermi-40ds7j | in flight |
| D-252 | s9 | the court's arrival simulated; a new game starts before it (Q-680..Q-689, B70..B72) | worktree-agent-a05470624036dba65 | merged 8d7f15c (agent stopped by an interruption before its soak: unverified) |
| D-253 | s9 | the renderless world (?norender) and its throughput (lead) | claude/amazing-fermi-40ds7j | in flight |
| D-254 | s9 | villages as real places (Q-690..Q-699, B74..B76) | agent worktree (villages) | in flight |
| D-255 | s9 | crafts and records in action (Q-700..Q-709, B77..B79) | agent worktree (crafts_records) | in flight |
| D-256 | s9 | work on the land (Q-710..Q-719, B80..B82) | agent worktree (land_work) | in flight |
| D-257 | s9 | the fords; the Pasargadae road redrawn (lead; Q-720..Q-721) | claude/amazing-fermi-40ds7j | in flight |
