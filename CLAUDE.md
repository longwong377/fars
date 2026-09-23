# PĀRSA — project memory for Claude Code

The master brief is `PERSEPOLIS_BRIEF.md` (copy of the user's upload). Re-read it after any compaction/restart,
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
Ritual only as attested. No face scans without licence. Kurtaš labour, children, punishment: as evidence, not sensational.
Blocklist: `research/ANACHRONISM_BLOCKLIST.md` (ancient world only).

## Verification (§13)
`npm test` (unit + dimension + sky + weather), `npm run test:e2e` (camera rig + walkthrough bots, headless Chromium,
SwiftShader), `npm run lint:all` (chronology/anachronism/language/activity coverage), `npm run soak` (year-long sim).

## How to run (§15)
No questions, no pauses; decide, log in `DECISIONS.md`, proceed. Gates bind — never lower one to pass it.
Commit at every gate; push to the branch the session designates (session 1: `claude/new-session-lfjkbn`; session 2: `claude/amazing-fermi-40ds7j`); never force-push.
Large binaries (DEM tifs) stay out of git; `npm run terrain` regenerates derived files from `data/dem/`.
