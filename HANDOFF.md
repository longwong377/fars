# HANDOFF — end of session 3 (2026-09-23, evening)

Read `CLAUDE.md` first (the resume procedure), then this file, then `PROGRESS.md` (problems first), `TASKS.md`,
`DECISIONS.md` and `BLOCKERS.md`. Session 3 decisions: D-033 … D-070 (lead), D-080 … D-087 and D-135 … D-139 (sim),
D-090 … D-093 (humans), D-100 … D-109 (access, language), D-110 … D-114 (interior light), D-115 … D-119 (twilight),
D-120 … D-123 (trees), D-130 … D-134 (Tachara). Open questions up to Q-184.
**Branch:** `claude/amazing-fermi-40ds7j` (sessions 2 and 3). Never force-push. **Every agent branch is merged**; there
is no work outside this branch. No background agents are running.

## What is broken, unverified or placeholder (read first)
1. **No gate after Phase 2 has passed.** The §8.2 rubric and the independent Phase 3/4/6/7 reviews have not run. The rubric has no reference photographs (every photo host is blocked, B6): a logged exception, not a pass.
2. **Interiors render near black in play: a visible regression, merged on purpose (D-110 … D-114, B10, Q-153).**
   - The baked light probes are physically right: the Apadana hall gets 0.005–1 % of open-ground skylight.
   - The exposure model (`src/sky/exposure.ts`, `exposureTarget`) opens at most ~3 stops above outdoors, and the halls sit 7–10 stops below.
   - Measured at high: hadish-hall frame mean 19 → 1.6; the apadana-enter hall columns 25 → 0.
   - **First job of session 4:** let eye adaptation follow the probe illuminance indoors (the `skyVis` hook already feeds `exposureTarget`). Then re-render the interior moments: apadana-enter, hadish-hall, scribe-at-work and the Tachara rooms.
3. **The soak FAILS 2 of 8 gates after the sim round-3 merge** (D-139):
   - populationVariety: child 41397 (7 days present) has a near-copy share of 0.19;
   - plansWellFormed: two "apart" day-issues on day 123, children 42002 and 42003 on road:plain while their mother is home.
   - Suspects: population.ts `small()` (the toddler walk-between pass, lane outings) and the water()/fire() post-passes changing the mother's plan after the children's was drawn.
   - Fix it before shadow review round 4. The round-2 state (c5075a2) passed all eight.
4. **Merged in the last hour, not rendered or not fully checked:**
   - **Sim round 3** (D-135 … D-139): soak failing (item 3).
     - Shadow review round 4 has not run. Use a pick seed other than 7, 11, 23, 37, 53 and 71.
     - Rounds 1–3 failed (10, 3 and 3 of 20 below 4).
   - **Trees** (D-120 … D-123): 15 species, leaf-cluster cards, impostors matched to the near trees, one kit for the plain and the town.
     - Nothing was rendered at high: the whole-frame 12 M triangle budget and dithering under TRAA are unmeasured.
     - The town gardens have never been rendered.
     - Winter and cypress impostors read 6–22/255 darker than LOD1 at test quality.
   - **Tachara rebuilt from REF-PLAN** (D-130 … D-134): the N and E rooms are unrendered, the e2e walkthrough (28 legs) has not run, and the SW room is not on the walkable grid (0.95 m doorway).
   - **Twilight** (D-115 … D-119): on a "clear" day at high quality, the cloud layer hides the Earth's shadow; twilight is strongly blue (no chromatic adaptation); daytime shade is 20–30 % darker.
5. **Built in session 3 and seen at test quality only (or not at all):**
   - Seen at test quality: the scribes' room (D-067; reads, but underexposed); Naqsh-e Rustam at 200 m (D-069; the reliefs are specks on dark façades, and the cliff reads as a banded low mound, not a 64 m rock face); town dusk smoke (D-070; visible now, plumes diluted since, not re-rendered).
   - Not rendered at all: the stair crenellations (D-065); XPe (D-066); the foundation deposits (D-068, sealed by design); the `mountain-dusk` view.
6. **Phase 5:** activity coverage fails (placeholder activities, including threshing, weaving and animals); the population beyond the Terrace agents is not rendered; rendered floors are unmet.
7. **Bench:** there are no valid numbers since D-047. The four per-route jobs are ready in `handoff/render_jobs/`.
8. **Calibration scene (§8.1):** blocked (NEEDS #13). **Translations** need NEEDS #14. **Voices:** nobody has listened to them (H8).

## Next steps, in order
1. Fix the two failing soak gates (item 3), and exposure for interiors (item 2). Re-run `npm run soak` (~25 min) and re-render the interior moments.
2. Run the queued renders in `handoff/render_jobs/`: mountain-dusk, reliefs-raking, and the four bench routes. Then the trees at high quality: the three plain budget views (`tests/e2e/plain.spec.ts` with no ONLY), village-p22, pulvar-bank-april, garden-paradise, and `treelab.spec` at Q=high. Record draw calls and triangles in PROGRESS.
3. The Naqsh-e Rustam cliff: its material bands and apparent height at 200 m, compared with plain.json (64 m cliff).
4. Shadow review round 4: `npx tsx tools/shadow_days.ts 1 <seed> > REVIEWS/shadow_days_input_seed1_pick<seed>.txt`, then a fresh reviewer subagent with the round-3 protocol (see REVIEWS/shadow_phase5_r3.md).
5. Re-render every §1.1 moment at high quality (≤ 2 page loads per job). Then run the §8.2 rubric review and the independent Phase 3/4/6/7 reviews as fresh subagents (`REVIEWS/`), and record the gates honestly.
6. Open items:
   - the court in full assembly (needs the court-resident setting and crowd scale: 3,000–8,000 people on the Terrace, impostors);
   - Phase 5 activity performances;
   - Phase 8 translations;
   - Phase 9 and FINAL_REPORT.md.

## Tools
- **Render runner:** `tools/dev/render_runner.sh <work dir>`, started in the background. It runs `<work dir>/jobs/*.job` in name order.
  - A job file is three lines: name, spec, env.
  - Copy `handoff/render_jobs/*.job` into `<work dir>/jobs/` to run the pending ones.
  - It goes through `tools/dev/queue_e2e.sh`, which takes the shared lock `/tmp/parsa-e2e.lock`. Never wrap it in another `flock`: that self-deadlocks.
  - Start `tools/dev/e2e_watchdog.sh` in the background too (LIMIT 900 s).
  - **Page loads take ~5 min each at test quality:** keep a job to ≤ 2 page loads. settlement.spec loads once per view (twice for A/B views); moments.spec and plain.spec load once and step their views.
- Debug specs `tests/e2e/dbg_*.spec.ts` run only with `DBG=1`:
  - `dbg_plain` hides plain layers one by one;
  - `dbg_smoke` renders with `?smokedbg` (haze blue, plumes red);
  - `dbg_rain`.
- **Snapshots** (`tools/e2e_snapshot.sh`) are ~0.3 GB each. Delete finished `snap_*` directories by hand; check `ps` first.
- `tools/dev/botcheck.ts`: the offline walkthrough bot (all areas: 97 legs; `slice`: 28).
- `tools/dev/px.mjs` measures pixels; `tools/dev/pxdiff.mjs a.png b.png [thresholds]` counts pixels that differ.
- **REF-PLAN in the grid:** grid = s·R·[px, −py] + t with s 0.47284, R rot(−18.51°), t (−37.664, 300.563). A pixel is wall if R+G+B < 420 (`pip install pillow numpy scipy`). Examples: `tools/apply_treasury_rooms_patch.py`, `tools/apply_tachara_plan_patch.py`, `tools/dev/tachara_overlay.py`.
- **After any architecture change**, rebuild:
  - `npx tsx tools/build_nav.ts` (the walkable grid; the parts-hash test in people.test);
  - `npx tsx tools/build_probes.ts` (the light probes, 3–5 min; the parts-hash test in probes.test).
- `tools/relief_preview.ts`: node raking-light previews of relief kinds (`--sheet`).
- `tools/shadow_days.ts`: §13.11 review input (it now picks only the living; `tools/shadow_pick.ts`).

## Gotchas (sessions 2–3)
- **`pkill -f <pattern>`:** never use it with a pattern in your own command line; it kills your own shell (exit 144). Use PIDs.
- **Long Playwright runs:** don't pipe them through `head`; closing the pipe stalls the run.
- **TSL:**
  - no runtime `select()` under TRAA;
  - `pow()` of a negative base is NaN (write x·x);
  - reversed-edge `smoothstep` is undefined (use `1 − smoothstep(lo, hi, x)`);
  - r186 binds a `Data3DTexture` through a 2-D view and fails (use a 2-D atlas);
  - colour uniforms type-check only against floats (cast to `any`).
- **Frames outside three's animation loop** must advance `renderer._nodes.nodeFrame` (D-047). E2E specs stop the loop after load; the test clock is frozen, so use `__parsa.setTime(day, hour)`.
- **`world.update` ctx:** `ctx.sky` is `sky.state`; the SkySystem (horizon, hemi, sun, fireScale) is `ctx.skyLight`.
- **Smoke** is lit by `smokeSkyRadiance` (fire.ts, D-070), the mean skylight, not the horizon behind it.
- **Vitest console output is suppressed:** write debug dumps to a file.
- **Timing tests** (cloud-noise build, crowd posing) and heavy `beforeAll` builds fail under load (renders plus a soak share 4 cores). Re-run them alone before calling anything a regression.
- **Removing old agent worktrees** (`.claude/worktrees/`) is refused by the permission classifier. Leave them.
