# Audit of sessions/s17-vagon.md (cloud, 2026-10-02)

An adversarial read of the one-day Vagon plan (commits 8f842bd..21dfd5e) against CLAUDE.md, USER_DIRECTIONS.md (UD-01..UD-37),
the tools the plan calls and the state of s14-int (63d26b4). The plan's goal and art direction stand; its schedule, its
scoreboard, its machine assumptions and its ownership table do not. The replacement is **sessions/s17-vagon-v2.md**.
Every finding below was checked in the repo; the file or number is given so the lead can re-check it in a minute.

## Blocking: the plan cannot run as written

**1. The scoreboard would take ~100 hours to render, and the 45-min train cannot exist.**
The plan's scoreboard is "the coverage points over every walkable area + the moments" x morning / late afternoon / overcast /
night / rain-or-dust / winter. tests/data/coverage_points.json holds 515 points (+5 variety places), so that is ~3,100 views.
The measured batched rate on this machine is 25 views in 58 min at Q=high in one load (sessions/s11.md:22), i.e. ~2 min a
view plus an ~11-min load. 3,100 views is ~100 h; even the 515 points once is ~17 h. The plan puts the baseline in hour 0-1
and a full re-render "every ~45 min". Also, the 515 points already carry their own month, hour band and weather (stratified
over 12 months, 8 bands, 9 weathers: the file's meta.time), so multiplying them by six conditions repeats a sampling that is
already done.

**2. The tools the plan names refuse to do what it asks.**
- `render_train.mjs run` refuses while any agent worktree is active (boxguard.activeAgents; "run between waves") and the
  plan runs it every 45 min while 13 agents build. FORCE=1 overrides, but CLAUDE.md "Box safeguards" (the user, session 15)
  says no full-world render while agents build. The plan breaks a rule the user set without saying so.
- render_train only runs tests/e2e/moments.spec.ts (named moments + EXTRA shots). The coverage points are rendered and
  measured by tests/e2e/coverage.spec.ts (placeholder share, flat/blank pixels, tiling, identical instances, life in view),
  which the plan never calls. The baseline as described has no runner.
- boxguard defaults: MAX_AGENTS=2, GPU_SLOTS=1, MIN_FREE_GB=4 (session 15, the 4-core box). mkwt.mjs refuses a 3rd agent.
  The plan's 13 agents and "two heavy renders at once" need these changed; the plan does not say so, or to what.
- gates/budgets.json has `"baseline": null`: the merge budget the plan relies on ("runs the merge budget") has never had a
  baseline, so it gates nothing until someone runs `budget.mjs --accept`. Each budget run is itself a cold full-world GPU
  load (~11 min+, holding the one GPU slot), so "after each merge" for 13 agents is ~13 GPU loads a cycle.

**3. Thirteen agents at once does not fit the box, and there is no plan for the other box.**
- Which machine: CLAUDE.md lists the big Vagon box (16 cores, 63 GB, T4), but sessions 13-16 ran on a 4-core / 16 GB T4
  box (HANDOFF.md:22, sessions/s16.md "full-world renders freeze this 16 GB box"). The plan assumes the big one and has no
  first check and no fallback. On the small box the user's own cap is 2 agents (CLAUDE.md, session 15).
- On the big box: one agent is a Claude process + a vite dev server + a probe Chrome on the GPU + tsc/vitest (each vitest
  worker up to ~2 GB, CLAUDE.md), so ~4-5 GB each. 13 x ~4.5 GB + a full-world train page (grew to 10 GB in session 15,
  gpu_slot.mjs:45) is more than 63 GB, before Blender. The T4 has 16 GB of VRAM shared by every probe page, the train and
  any Cycles bake, and Windows resets the card when one GPU job runs past ~2 s (CLAUDE.md "The GPU watchdog"). The session-14
  freeze was 9 agents on the small box; nothing measured says 13 fit on the big one.
- The plan cites UD-28 ("no cap on agents"); the session-15 cap came later and from the user's own words. The later
  direction is box-specific, so it does not forbid more agents on the big box, but the plan must measure and record the
  number it uses (DECISIONS), not cite the superseded line.

**4. The ownership table collides on the files that matter most.**
| file(s) | claimed by |
|---|---|
| src/world/plain/riparian.ts, src/world/plain/canals.ts | plain fill (`src/world/plain/**`) and land-and-water |
| src/world/plain/terrainPlain.ts | ground and plain fill |
| src/terrain/** (far levels) | ground and land-and-water |
| src/arch/rooms.ts, src/arch/terrace_rooms.ts | terrace (`src/arch/**`) and interiors |
| hearth / torch light (src/world/fire.ts, firePlaces.ts) | atmosphere-and-night; interiors needs it for "rooms lit by hearths" (bigbox.md gave fire*.ts to interiors) |
| night exposure, moon light (src/render/toneLook.ts, src/sky/**) | light owns them; atmosphere-and-night must change them to light the night |
| src/render/materials.ts (42 importers), src/render/scans.ts | "town surfaces", yet the scans.ts flip ("the scan's own colour leads") changes the ground, the plain, the rivers, the Terrace and the people lab (7 importers) |
| caravans and traffic animals | works-and-camps (traffic.ts, visitor/**) and animals |
Thirteen branches touching overlapping files from the same base, merged every 45 min, is a day of conflict resolution.

**5. The light and the palette are tuned in parallel against a moving target.** Every agent re-tints and judges its imports
under the current light while the light agent changes sun, sky, exposure and tone. Whatever is tuned before the light lands
is tuned wrong. The baked outdoor light (D-357: public/lightmaps, src/render/probes/outdoor_bake.ts: sky past the walls and
the sun's bounce, which depends on the surfaces' albedo and the town's geometry) goes stale when the light, the surfaces or
the town change; the plan never re-bakes it.

## Contradictions with the user's directions

**6. The art direction is for the wrong season.** It sets "late-summer Fars ... pale straw fields". The world opens on day 0 =
17 April 467 BCE (src/world/season.ts: DOY_AT_DAY0 = 102; the herb layer's greenness peaks at 1.0 at doy 105). Every first
visit is green spring. An agent that re-tints fields, grass and haze to straw fights season.ts and makes the first
impression wrong. The palette must follow the calendar (spring green and poppies on arrival, straw from June, autumn,
winter), with season.ts as the only source of the seasonal tint.

**7. UD-31 (load under a minute, talking on, a public URL anyone opens) is demoted to "if an agent frees up".** The live
site is already over it (ready 99.8 s cold, 5.83 GB page memory: bench-reports/load_s16_boot.md on cloud-s16-boot; target
under 60 s and under 5 GB), public/ is 444 MB and GitHub Pages caps a site at 1 GB with the baked world cache on top. A day
of new KTX2 textures and Blender meshes from 13 agents moves all three the wrong way, and every push to s14-int deploys.
UD-31 is a standing direction; the plan needs an owner and a gate for it, not a spare-time line.

**8. The intro cinematic cannot be "streamed while the world loads".** It is in-engine (UD-37's wording via the plan), and
the engine cannot draw the world before it is built and its shaders compiled; the shader compile is the load (D-250). Played
before ready it would show a blank or stalling frame; a pre-rendered video adds megabytes to every first visit (UD-31). It
can play from the moment the world is walkable, while the rest (animals, far models, the talk model) streams, and be skipped.

**9. "Fill with ready-made assets" (UD-34) vs "everything culturally shaped built in Blender" (UD-37) is resolved in the
text but not in the hours.** UD-37 moves buildings, doors, furniture, pottery, tools, clothing and people to the project's own
Blender kit. That kit exists (s12 Blender wave, house kit, jars, garments), but every new object type is a scripted Blender
job (~20 s start-up, Cycles bakes on the one T4 competing with renders). The plan does not cap how much new Blender work a day
holds, does not put Blender bakes behind the GPU slot, and does not say that variants of existing kit pieces come first.

**10. The render set spends time on the ruins view.** "+ the moments" includes now-stair-top, now-apadana and calib-24-now
(tests/e2e/moments.spec.ts, `now: true`): UD-20 says no work, renders or review time on the present-day view.

**11. "The cloud does not run today" ignores the cloud work that would save Vagon hours.** Node-only preparation (the
scoreboard file, the train's coverage support, the box limits by env, reserved numbers, the briefs) costs no GPU and, done
before the box starts, removes the first hour's set-up. This audit is itself a cloud session.

## Missing

**12. No done line that can be checked.** "Every coverage view ... looks AAA" over ~3,100 views cannot be judged by one lead in
a day. A fixed, frozen scoreboard (same views before and after, not reseeded mid-day) plus coverage.spec's own measurements is
checkable; "every inch" is then reported as the measured share of the coverage set, honestly.

**13. No reserved numbers.** CLAUDE.md: reserve D/Q/B ranges per agent before launching. Thirteen agents appending to
DECISIONS, OPEN_QUESTIONS and BLOCKERS with no ranges will collide. Highest used today: D-464, Q-1171 (Q-1260..1399 were
reserved for Vagon waves), B403 (B402-B403 already eat into the old B430..B499 Vagon range).

**14. Unmerged work the plan's agents would redo.** s14-monuments (713ed04, 3 commits not in s14-int: the licensed-scan route
for the Gate colossi, the lamassu source, the stopped agent's meshes) belongs to the terrace agent; cloud-s16-boot (82b3675)
holds the latest load measurement. The plan mentions neither.

**15. No integration branch.** Agents merge "in" with no named tree. Merging straight into s14-int (which deploys on push)
risks a mid-day push of a half-merged world; a separate integration branch, pushed to s14-int once at the end after a cold
built-site load and the budget, protects the live site.

**16. The second question of CLAUDE.md (depth) is absent.** Acceptable for a look day by the user's own words (UD-33: "the next
session is Vagon only"), but the plan should say what it will not break: talking on by default (UD-31), the sim's hooks
(marks, wounds, roofs, stalls) and people's activities must survive the people and town agents' changes. A regression check
of the depth (npm test's sim tiers) belongs in each merge.

## Smaller

- "People 1.55-1.75 m" in the art direction: the body system draws a seeded spread (UD-27, bell curve); keep its range, do not
  clamp to the sheet.
- New performances (drink, dance, hunt_bow, wrestle, swim, plaster_roof): the motion source is the CMU mocap route already in
  ASSET_LEDGER.md (src/people/mocapClips.ts, D-333); no non-CC clip packs.
- "Re-tint and re-roughen imports to the palette" and "the scan's own colour leads" pull opposite ways: the scan keeps its
  pattern and local colour, the palette sets the mean albedo per material (in PBR range), one owner applies both.
- The hand-off says push s14-int "only after a cold built-site load reaches ready" but not after the budget or the guards
  (sessions/s16.md: the pre-commit hook runs 3 of the 5 guards; `npm run guards` before pushing).
