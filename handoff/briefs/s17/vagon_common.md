# s17 Vagon agents: the common part (read this, then your own brief)

The day: sessions/s17-vagon-v2.md ("Rules for both sides", "The art direction"). The user (UD-36): by tonight every inch of
the world looks like a top modern AAA open world (AC Origins, RDR2, Kingdom Come 2) and is filled in. UD-33/34/37: nothing reads
procedural; real assets in bulk; libraries (Poly Haven, ambientCG, CMU mocap) only for culture-neutral materials, nature and
motion; culturally shaped things from the period kit in Blender (tools/blender/). UD-20: no present-day ruins work. Read
CLAUDE.md and USER_DIRECTIONS.md first; grep DECISIONS/BLOCKERS by id, never read them whole.

## The box (Windows, Tesla T4, 16 cores, 63 GB; up to 5 agents at once)
- Work ONLY in your worktree (path given). Its own Vite port is in .wtport. Never edit another tree; never touch
  C:/Users/Administrator/fars-wt/int, T:/s17-train or T:/s17-budget (the lead's render and budget trees).
- **No full-world page loads** (11-30 min each; the lead's trains own them). Iterate on probe pages (tools/dev/*_probe.*,
  humanlab.html, treelab.html, src/render/probes/outdoor_probe.*): they load in seconds. Installed Chrome drives the GPU:
  PW_CHANNEL=chrome, --project=gpu. One probe browser at a time per agent. Cycles GPU bakes and anything over ~2 min of GPU go
  through `node tools/dev/gpu_slot.mjs <label> -- <cmd>` (2 slots; the trains hold them at times, so bake early or wait).
  Keep single GPU dispatches short (the Windows watchdog resets the card at ~2 s).
- Blender 5.0.1: `C:/Program Files/Blender Foundation/Blender 5.0/blender.exe -b --factory-startup --python tools/blender/x.py`;
  pipeline `node tools/blender/build.mjs [id]`; KTX: `C:/Program Files/KTX-Software/bin/ktx.exe`. Every asset job a script.
- Downloads: Poly Haven / ambientCG / Hugging Face are reachable; check branch assets-archive first (57 Poly Haven + 33
  ambientCG sets already). C: has ~20 GB: put big downloads on T: and commit only the shipped (KTX2, sized) result. Every
  asset a row in ASSET_LEDGER.md (CC0 / CC-BY / CC-BY-NC).
- Judge the look at the player's lens against the AAA bar and references/ (the art direction in the plan), not "better than
  before". The lead's trains publish full-world frames to branch s17-renders (renders/<stamp>/*.jpg + index.md): fetch and
  look at them for your class. Ask the lead for views in your commit message / report (e,n,eye,heading,pitch,day,hour).

## Branch, tests, records
- Your branch is s17-<name> (mkwt made it from s17-int). Commit and PUSH at every meaningful step (at least hourly):
  `git push -u origin s17-<name>`. Never push s17-int, s14-int or cloud-s17-int; never force-push; never bypass the hook.
- Tests: `npx vitest run <the files you touched and their importers>` and `npm run guards` before each commit. Timing tests
  under load are not failures.
- Records: one DECISIONS row (your D number) for the package, Q/B only from your range, appended at the end, never renumbered.
  No edits to PROGRESS, HANDOFF, TASKS, COVERAGE. Do not regress load time, page memory or frame time (the lead's budget check
  holds back a merge that does): ship textures as KTX2, sized; reuse materials; instance.
- You own only your brief's files. A change elsewhere: the smallest hook, named in your report.

## Done and report
Stop at your done line or ~T-2 h (the lead messages you). A sub-goal that fails three measured approaches goes to BLOCKERS.
Final report (<= 250 words) in your last commit message AND handoff/s17/report_<name>.md: broken/placeholder/unseen first;
what a player now sees differently; the probe frames you judged (paths); views for the lead's train; files; tests. No
questions: decide, log, proceed. Push intermediate results early: the lead merges what is ready before each ~90-min train.
