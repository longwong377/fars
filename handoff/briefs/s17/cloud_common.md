# s17 cloud agents: the common part of every brief (read this, then your own brief)

The day's plan: sessions/s17-vagon-v2.md (read "The split", "How the two sides talk", "Rules for both sides", "The art
direction"). The user (UD-36): by the end of today every inch of the world looks like a top modern AAA open-world game and is
filled in, lived in. UD-33/34/37: nothing reads as procedural; fill in bulk; libraries only for culture-neutral materials and
nature; everything culturally shaped from the project's own period kit (Blender scripts in tools/blender/). UD-20: no work on
the present-day ruins view. Read USER_DIRECTIONS.md and CLAUDE.md first; do NOT read DECISIONS/PROGRESS/HANDOFF/TASKS/BLOCKERS
whole (grep an id when you need one).

## Your machine (a cloud container; you are a sibling session, alone in it)
- 4 cores, 15 GB, no GPU. Headless Chromium (SwiftShader) works for crude checks: at most 2 browser runs an hour, one at a
  time, probe pages only (tools/dev/*_probe.*), never the full world. Node checks, census tools and unit tests first.
- No Poly Haven, ambientCG, Hugging Face or GitHub-release downloads. What was downloaded is in git: `git fetch origin
  assets-archive` then `git checkout origin/assets-archive -- textures/polyhaven/<name>` (or `git show`) for only what you use;
  models-archive likewise. npm and PyPI work.
- Blender 5.0.1 runs as a Python module: `python3 -m venv ~/bpy && ~/bpy/bin/pip install bpy`. The lead's shim
  (tools/blender/bpy_cli.sh, `BLENDER=` for tools/blender/build.mjs, DEVICE=CPU) lands on cloud-s17-int within the first
  hours; merge it when it does. CPU bakes only; a Cycles GPU bake goes to Vagon via handoff/s17/asks_vagon.md.
- Heavy node jobs one at a time (`node tools/dev/cpu_slot.mjs <label> -- <cmd>` if it runs here; else just one at a time).
  Tests: the files you touched and their importers (`npx vitest run <files>`), then `npm run guards` before every commit.
- First: `git fetch --unshallow --tags` if the clone is shallow (the ratchet guard needs the history), `npm ci`.

## Branches and sync
- Work on your branch (named in your brief), started from origin/cloud-s17-int. Commit and PUSH at least hourly
  (`git push -u origin <branch>`); the cloud lead merges you into cloud-s17-int, Vagon merges that into s17-int before each
  train. Merge origin/cloud-s17-int into your branch each time you push (never rebase, never force-push).
- Never push s14-int (it deploys the live site), s17-int or cloud-s17-int.
- **Seeing your work:** Vagon pushes each render train's frames to branch s17-renders (`renders/<stamp>/...jpg` + index.md).
  `git fetch origin s17-renders` and look at the frames for your class (you can read images). Ask for views: append a line
  to handoff/s17/asks_vagon.md on your branch: `<agent> | view: e,n,eye,heading,pitch,day,hour | why`.
- You own only your brief's files. A needed change elsewhere: the smallest hook (an import, one call), named in your report,
  or a line in handoff/s17/asks_vagon.md (if Vagon owns it) / your report (if another cloud agent does).

## Records
One DECISIONS row for your package with your reserved D number; Q and B rows only from your ranges; rows appended at the end
of the table, never renumbered; ASSET_LEDGER.md row for every asset you add. No edits to PROGRESS, HANDOFF, TASKS, COVERAGE.

## Done and report
Your brief's done line, as the player would see it. Stop at it; a sub-goal that fails three measured approaches goes to
BLOCKERS and you move on. Time box: until ~T-2 h of the Vagon day (the lead will message you). Final report (<= 250 words) in
your last commit message AND in handoff/s17/report_<agent>.md: what is broken, placeholder or unseen first; what a player
now sees differently; views asked; files touched; tests run with results. No questions: decide, log, proceed.
