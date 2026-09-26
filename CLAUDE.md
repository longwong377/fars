# PĀRSA — project memory for Claude Code

**Read first, every session: `USER_DIRECTIONS.md` (the user's own words, append-only) and `MASTER_PLAN.md` (how the goal is
achieved and measured; it governs over older task lists and handoffs).** The master brief is `PERSEPOLIS_BRIEF.md` (copy of the user's upload). Re-read it after any compaction/restart,
then read `PROGRESS.md`, `TASKS.md`, `DECISIONS.md`, `BLOCKERS.md` and resume from the first unfinished task.
If the user types only "continue", that is what it means.

## Intent (§1.1)
A time capsule: stepping through a door into a place that was real and is gone. Presence through the body
(true scale, walking pace, no fast travel). Restraint: no narrator, tutorial, score, waypoints, minimap or in-world HUD.
Getting lost is allowed. Weight comes from ordinary, often named, lives. The world never hints at its fate.

## Binding rules (§3)
1. Numbers before pictures: geometry only from `research/SITE_SPEC.md` (every value sourced + tiered).
2. Evidence tiers everywhere: A attested / B inferred / C reconstructed — in data, visible in the dev overlay (F3).
3. Primary sources win; conflicts logged in `research/OPEN_QUESTIONS.md`.
4. Verify by measurement; screenshots find problems, never prove correctness.
5. Fidelity is fixed; if a target can't be met: measure, try ≥3 approaches, ship most faithful, log in `BLOCKERS.md`.
6. Accuracy beats beauty.
7. Honesty: a phase is done only when its gate passes. Placeholders flagged in dev overlay, PROGRESS.md, reports.
   Every report leads with what is broken or placeholder.

## Language (§10)
No modern language rendered or heard in the world. English only in out-of-world layers (menus, settings,
translation layer). Period scripts only, only published texts. `npm run lint:lang` enforces this.

## Licences / ethics (§12)
USE = personal, non-commercial. CC0 / CC-BY / CC-BY-NC OK; record every asset in `ASSET_LEDGER.md`.
Gaps (user direction, session 7, D-207): where the evidence is silent, fill with the MOST PROBABLE reconstruction by analogy
(region, period, neighbours), tier C, reasoning visible in F3 and the translation layer; keep out only what the evidence says
was NOT there (e.g. fire temples in 467). Ritual: attested elements where known, otherwise probable reconstruction shown as
action, fire, offering and wordless chant — no invented liturgical words for a living religion. No face scans without licence. Kurtaš labour, children, punishment: as evidence, not sensational.
Blocklist: `research/ANACHRONISM_BLOCKLIST.md` (ancient world only).

## Verification (§13)
`npm test` (unit + dimension + sky + weather), `npm run test:e2e` (camera rig + walkthrough bots, headless Chromium,
SwiftShader), `npm run lint:all` (chronology/anachronism/language/activity coverage), `npm run soak` (year-long sim).

## How to run (§15)
No questions, no pauses; decide, log in `DECISIONS.md`, proceed. Gates bind — never lower one to pass it.
Commit at every gate; push to the branch the session designates (session 1: `claude/new-session-lfjkbn`; sessions 2–3: `claude/amazing-fermi-40ds7j`); never force-push.
Large binaries (DEM tifs) stay out of git; `npm run terrain` regenerates derived files from `data/dem/`.

## Working rules learned in sessions 5–8 (the user asked for these to persist)
- **Render queue is the bottleneck** (one shared SwiftShader lock; a high view's test is ~8 min, but jobs wait ~50 min behind
  others). Run at most 3 agents that render at once; give each ≤ 2 browser runs and node-side previews/CPU mirrors first; the
  lead's full passes go in grouped jobs (views sharing day/hour/weather share a page load). Details: HANDOFF.md Tools.
  Measured (session 8, tools/dev/load_probe.mjs): a persistent Chromium profile (GPU shader cache kept) does NOT speed loads
  or frames measurably; load time is contention (35 s idle vs 244 s busy) and a high frame costs ~2.5–4 min (8 per view).
- **Timing tests under load are not failures** until re-run alone on an idle box (performances, popview, humans_runtime,
  cloudnoise, long people_days runs). Never commit bench-reports/*.txt rewritten by a loaded test run.
- **Reviewers use every reference** in `references/` paired to the moments (table in handoff/review_briefs.md), and say which
  ones they judged against; memory of photographs of the ruin is allowed only where no reference covers it, labelled C.
- **Before merging an agent branch:** records conflict (DECISIONS, OPEN_QUESTIONS, BLOCKERS, PROGRESS) are unions of appended
  rows: keep both sides, no blank line inside a table; reserve D/Q/B number ranges per agent in its prompt.
- **After a render-affecting merge**, re-render the moments it touches before claiming a fix; a node test is not a render.

## Every inch (the user's direction, session 8; D-233)
The camera-rig moments are NOT the standard. **Nowhere the player can walk may break the illusion**: every walkable place
of the Terrace, the town and the plain must reach the photoreal bar, one way or another. Measure it as coverage, not by
chosen views: the coverage harness (`tests/e2e/coverage.spec.ts`, `tools/dev/coverage_points.ts`) renders viewpoints
sampled over every walkable area and reports, per view and per area, the share of pixels drawn by PLACEHOLDER-flagged
objects, flat/blank surfaces, and the rubric reviewer's scores on a sample. The backlog is ordered by the areas that fail
most; a phase or area is done only when its coverage passes. Placeholders (town houses, procedural reliefs, stand-in
people at distance) are the first targets.
