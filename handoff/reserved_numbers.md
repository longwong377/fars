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
| D-249 | s9 | town walkability: doors and lane clearance (Q-670..Q-679, B67..B69) | agent worktree (town_walk) | in flight |
| D-250 | s9 | cached world (lead; speed plan D-248 step 1) | claude/amazing-fermi-40ds7j | in flight |
| D-251 | s9 | tiered tests (lead; speed plan D-248 step 2) | claude/amazing-fermi-40ds7j | in flight |
