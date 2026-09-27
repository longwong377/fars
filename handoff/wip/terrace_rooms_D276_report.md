D-276 Terrace rooms. You asked me to stop for the session close; all work is committed. The last commit is WIP.

**Broken, placeholder or unverified (read first)**
- **Not seen on screen.** Both browser runs were killed before they started: the base-commit budget views, and the Treasury store room by day plus the garrison quarters at night. So there are no renders, and draw calls and triangles for court-forecourt-w and court-apadana-n were not measured before or after. The spec for this is ready: `tests/e2e/rooms_d276.spec.ts`. Logged as B85.
- **Last commit 72d6f63 is type-checked only.** It adds per-room anchors for people's routes, puts the Harem's women and attendants into the Harem's rooms (mats when asleep), and moves `court_harem` and `court_harem_s` off the new walls. The trace, walk bots and tests were not re-run on it.
- **Three gate-tier tests fail at e5814ef:**
  - `popview`: one walked route goes through the Hall of 99 Columns, starting from a Treasury bench place. 72d6f63 is meant to fix it; unverified.
  - `court.test`: `court_harem` and `court_harem_s` sat on new walls. Moved in 72d6f63; unverified.
  - `coverage.test`: the committed coverage sample is stale after the walkable-grid rebake and must be regenerated with its tool.
- **Task 4 not attempted:** the Tripylon is not yet a building site (B86).
- **The Treasury's Hall of 99 Columns stays where D-067 put it.** REF-PLAN lays out the northern halls differently (Q-730). The S part follows the plan (B); the rest is reconstruction (C).
- **Garrison mats:** 624 mats for up to about 1,100 men. Men whose numbers are 624 apart share a mat and are drawn on it together only if both sleep at once (Q-732).
- **Royal kitchens (C, Q-332/Q-733):** my switch to built roofs took away the Hadish footprint's false roof, which left 21 cooks undrawn at night. I added three kitchen rooms west of the Hadish to fix that.

**Done (node-measured, at e5814ef)**
- **Treasury:** 26 store rooms, two columned halls and a court. Benches carry the stored goods; the stock now includes your gap-hunt items (phialai, rhyta, textiles, armour, shields, beads, ivory, cut glass, bitumen jars). Store doors are sealed or barred out of hours.
- **Harem:** 22 four-post apartments (6 in the main wing, 16 in the W wing, per ISAC-PA), plus kitchens, the N hall and the side rooms.
- **Garrison:** seven quarters rooms (624 mats, a hearth and a lamp each), a store, a kitchen, and the royal guard's mess on its court.
- **Roofs:** "under a roof" now means under a built roof part, not a whole traced footprint.
- **People:** Treasury staff stand at bench fronts; nobody is placed standing in corridors, doorway approaches or passage rooms.
- **Bakes and fixes:** walkable grid, probes and fire occlusion rebaked. Probe-bake fixes (no merged volume covering another roof; trimming across the separating axis; the CPU weight now matches the shader). Ceiling joists drawn as 3 faces, which keeps the 60k-triangle ceiling budget.

**Tests and measurements**
- **People trace** (`people_trace --gate`, sample 4, court on):
  - Seed 1: T-D3 0, T-D3s 100%, 0 left undrawn for want of a room on the Terrace at every moment (baseline 251 at 23:00). T-D4 worst area 3.55% (was 3.45%).
  - Seed 7: T-D3 0, T-D3s 100%, Terrace 0.
  - Still undrawn off the Terrace: the town mill and forges, and one transhumant band's camp.
- **Walk bots, Terrace, 60 targets:** 95.0% reached (session 8: 93.3%). 3 bots were stopped for good by people: two in the Harem's ways (72d6f63 is meant to address them) and one near the Apadana. The share of bot time stuck is 25.2% against session 8's 17.4%, driven by those three bots.
- **New `tests/rooms.test.ts`: 9/9 pass.** It checks wall thickness, doorways ≥ 0.8 m, a roof over every room, no gaps in any room's walls, every room reached by the walkable grid, and fittings clear of doorways.
- **Fast tier:** 825 pass, 1 fail (`instruments.test`, which fails on the base commit too).
- **Also pass after fixes:** arch (the literal lint now covers `rooms.ts` and `terrace_rooms.ts`), doors, polychromy, surfaces_s6, waterworks, now_view, probes, fire_occ, people.

**Branch** `worktree-agent-a84bf728cb8073164`. Commits: 6892dfd, e5814ef, 72d6f63 (WIP, last).

**Records:** DECISIONS D-276; OPEN_QUESTIONS Q-730 to Q-733; BLOCKERS B63 marked resolved on the Terrace, plus new B85 and B86. Unused reserved numbers: Q-734 to Q-739 and B87.

Files are in the worktree `/home/user/fars/.claude/worktrees/agent-a84bf728cb8073164`:
- `src/arch/rooms.ts`
- `src/arch/terrace_rooms.ts`
- `src/arch/built.ts`
- `src/people/roofs.ts`
- `tools/apply_terrace_rooms_patch.py`
- `tests/rooms.test.ts`
- `tests/e2e/rooms_d276.spec.ts`
