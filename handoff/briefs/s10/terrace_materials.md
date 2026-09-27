# Brief: Terrace materials (session 10, D-275 ring 1) — generated from handoff/agent_template.md

## Fixed clauses (copy verbatim)

You are a worker agent on PĀRSA (repo /home/user/fars, your own worktree branch; do not push). Read USER_DIRECTIONS.md,
MASTER_PLAN.md and CLAUDE.md first. The standard is every walkable area, at the player's lens and quality,
in motion, with sound, at every hour, season and weather. Your work serves the user directions UD-01, UD-05, UD-06, UD-16 and the thresholds T-A4 (the photoreal rubric: every category ≥ 4, materials included), T-A4cg ("reads as CG" = 0).

1. Say before you start how your change could pass its tests while the intent fails, and measure against that, not only the test.
2. Prefer the world-wide fix to the per-view fix. A fix proved in one view is not proved everywhere.
3. Evidence: node previews and CPU mirrors first; at most 2 browser runs through tools/dev/queue_e2e.sh.
4. Records: your reserved numbers are D-285, Q-750..Q-759, B91..B93; rows are appended, never renumbered.
5. Never lower or reword a threshold (tests/gates_ratchet.test.ts); a threshold you cannot meet goes to BLOCKERS with ≥ 3
   approaches measured.
6. Lead your final report with what is broken, placeholder or unverified on screen; list tests run with results; run
   `git checkout bench-reports/` before committing.
7. Heavy CPU work (soaks, bots, audio renders, bakes, long test runs) goes through `tools/dev/cpu_slot.sh`, one process at a
   time: the four cores are shared with the render lane.

## Slots
- **Task:** the Terrace's surfaces read as CG (session 10's gate-dusk render: the Gate of All Nations' walls one flat, uniform
  orange-brown; session 8's photo #24 calibration: the Terrace wall "grey concrete", no polygonal foot, smooth ground; B40 sunlit
  ashlar Ystd/Y 0.15-0.25 not met; B57 Kuh-e Rahmat's texture). Make the Terrace's materials read as the real stone, brick and
  plaster of 467, judged against the references paired to them (references/INDEX.md: the user's site photographs, #24, the Gate
  photos 'The Gate of All Nations 2/3/4', Getty screens for the painted state) and research/ (mud-brick walls plastered: their
  colour, the lime or mud plaster's texture and its variation, trowel marks, repairs, weathering bands, the damp foot; the ashlar's
  grey limestone with its polish where fresh, weathering elsewhere; the Terrace wall's polygonal masonry foot, D-232). World-wide
  fixes in the shared materials (src/render/materials.ts and the TSL surface functions), not per-view patches: every building of the
  Terrace gets them, and the town's plaster may reuse them. Measure with the existing tools (tools/dev/calib24_*.py, the Ystd/Y
  window statistic of B40/B57) before and after.
- **Areas:** the Terrace (materials world-wide). **Files in scope:** src/render/materials.ts and the material helpers it uses,
  src/arch/masonry*.ts (surface only), tools/dev/calib24_*, tests. Not src/arch/terrace.ts's geometry (the D-276 agent owns it).
- **Done means:** B40's Ystd/Y met on sunlit ashlar in two views, the Gate's plastered wall showing measured texture variation
  (Ystd/Y within the photographs' range, from the Gate photos at matched scale), photo #24's side-by-side improved on the rubric's
  materials category by a reviewer briefed from handoff/review_template.md; shader cost measured (tools/dev/shader_sizes.mjs) and
  within 10 % of before; two renders at test quality through the queue.
  **UD ids:** UD-01, UD-05, UD-06, UD-16. **Reserved:** D-285, Q-750..Q-759, B91..B93. **Render budget:** 2 browser runs.
- **Context:** the lead's render queue is busy (tools/dev/queue_e2e.sh serialises it; expect waits of up to an hour). The box is
  shared: check `uptime` and `free -g` before any heavy run; one heavy process at a time via tools/dev/cpu_slot.sh, vitest with
  --maxWorkers=1. Symlink node_modules from /home/user/fars/node_modules. First run `git fetch origin claude/amazing-fermi-40ds7j &&
  git merge origin/claude/amazing-fermi-40ds7j`.
- Commit on your worktree branch with clear messages; put your full report in your final message (the lead copies it into REVIEWS/).
