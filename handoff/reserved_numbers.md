# Reserved record numbers (MASTER_PLAN §6 session loop; T-R6)

Every number reserved for an agent, with its branch and fate. A number cited in MASTER_PLAN.md or CLAUDE.md must exist in its
record (DECISIONS, OPEN_QUESTIONS, BLOCKERS) or in this table (tests/scope_ledger.test.ts). At session close every row's fate
is "merged <commit>" or "abandoned: <why>"; none stays "in flight" across a session unrecorded.

| number | session | workstream | branch | fate |
|---|---|---|---|---|
| D-229 | s8 | Phase 5 review fixes (C1, M4, M3) | worktree-agent-a77ac53305a706d11 | merged c461ebe |
| D-234 | s8 | the town's real houses (Q-610..Q-629, B59..B60) | worktree-agent-af2da6f89e949d64f | in flight |
| D-235 | s8 | coverage harness for every inch (Q-630..Q-639) | worktree-agent-af3e66fbfe7229375 | in flight |
| D-237 | s8 | walkability: fall-through, walk everywhere, autosave (Q-640..Q-649, B61..B62) | worktree-agent-a1aaf525d1db6ee63 | in flight |
| D-244 | s8 | indoor truth on screen (Q-650..Q-659, B63..B64) | worktree agent (indoor truth) | in flight |
| D-245 | s8 | the town is not mute (Q-660..Q-669, B65..B66) | worktree agent (audio) | in flight |
