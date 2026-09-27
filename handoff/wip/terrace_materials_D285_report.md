D-285 Terrace materials: stopped early because the session is closing. Everything is committed as WIP.

**Broken, placeholder or unverified**
- **B40 is not met.** The soiling I added to the stone does nothing measurable on screen. On the CPU mirror, the 10 m frontal wall stays at 0.059 (48 px windows). The #24 view's wall region goes 0.091 → 0.092 on screen; in scene-linear terms it is 0.145 → 0.147. In the render of the `terrace-wall-near` view, the mean pixel difference between on and off is 0.02/255. The drip stains are 3–10 cm wide, which is under a pixel at 10–30 m.
- **The tone curve compresses most of the spread.** In the mirror, sunlit stone's scene-linear spread already reaches 0.147–0.156 in the #24 view (frontal and raking sun). AgX's shallow slope at the stone's brightness (0.4–0.6) turns that into 0.09–0.12 on screen. That is a pipeline question, outside my files.
- **The Terrace wall in the render is overexposed.** Frame mean is 199/255 at exposure 3.87. This washed-out look is a large part of the "grey concrete" impression, and it is also outside my files.
- **The mud plaster's texture is raised to match the photo, but it may read as noise.** On screen it now reads as mottling; the lifts, bays and rain-wash lanes are not clearly visible as structure. I then restructured the mottle into stroke-aligned sweeps (last commit, mirror 0.032–0.038). That version is **not rendered**.
- **Not done:**
  - the second render (calib-24 before/after, and gate-dusk);
  - the shader-cost measurement with shader_sizes.mjs;
  - the D-285 row in DECISIONS and the B40 update in BLOCKERS;
  - the reviewer brief and the #24 side-by-side for the materials category.
- **Render run 1 may still be going.** It is rendering calib-24 at the end of its time budget and will likely be cut off by the watchdog. Its shots land in the worktree's `shots/` folder.

**Done and tested**
- **Changes in `src/render/materials.ts`:**
  - Stone: drip stains that hang under the bed joints (`SoilDef`).
  - Stone: per-surface run-off length and foot-band height. The Terrace walls get 6 m run-off and a 0.9 m foot band.
  - Mud plaster, every mudbrick wall: the plastering campaign (`PlasterWeatherDef`), i.e. lifts and bays with their own tone and overlap seams, hand-stroke relief, mottle, and rain-wash lanes at the top.
  - Everything is behind a new A/B switch, `window.__parsaSurf.d285`.
  - The retaining-wall and ashlar cell helpers now also return the distance to the bed joint above.
- **Plaster target from a real photo.** New tool `tools/dev/plaster_photo_d285.py` measures the only mud plaster in the references: the modern kahgel coat around the Gate's hall in #21. At the render's pixel size it reads 0.036 in 0.5 m windows. The Gate's weathered stone piers read 0.30–0.38.
- **New CPU mirror** `tests/lib/plaster_cpu.ts`. `tests/lib/stone_cpu.ts` now also mirrors the soiling and the run-off.
- **Render run 1** (test quality, 3 views in one page load, `dbg_surf.spec.ts` with the switch on and off):
  - Gate W wall in daylight, 0.5 m windows: 0.021 → 0.035, against the photo's 0.036. The mirror predicted 0.020 → 0.036, so the mirror agrees with the render.
  - 1.5 m windows: 0.035 → 0.048.
- **Tests:**
  - `tests/materials_d285.test.ts`: all 4 cases passed. The last full run was before the final plaster tweak; after the tweak I re-ran only the 2 plaster cases, which passed.
  - The existing surface tests — `stone_photo_d230`, `surfaces`, `surfaces_s6`, `masonry_d232` and `surfaces_d218` — all passed.
  - `tsc` was clean.
- **Records:** Q-750 (what the 467 plaster finish was) and Q-751 (how soiled the stone was after ~50 years) are appended to `research/OPEN_QUESTIONS.md`.

**Branch** `worktree-agent-abfe07c728ddcef1d`. Commits: `3b91eeb`, then last commit `625e71b`. `bench-reports/materials-d285.txt` is left uncommitted because it is partial (only the plaster cases wrote to it on the last run).
