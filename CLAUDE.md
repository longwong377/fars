# PĀRSA — project memory for Claude Code

**Read first, every session: `USER_DIRECTIONS.md` (the user's own words, append-only) and `MASTER_PLAN.md` (how the goal is
achieved and measured; it governs over older task lists and handoffs), with its locked thresholds in `gates/thresholds.json`
(they only tighten: `tests/gates_ratchet.test.ts`).** The master brief is `PERSEPOLIS_BRIEF.md` (copy of the user's upload). Re-read it after any compaction/restart,
then read `PROGRESS.md`, `TASKS.md`, `DECISIONS.md`, `BLOCKERS.md` and resume from the first unfinished task.
If the user types only "continue", that is what it means.

**The first question of every session, before any task list (UD-19, session 11's failure):** look at the whole world in a few
renders and ask "does this look AAA (a top modern open-world game) and full of life?" While the answer is no, the session's work is BULK
REPLACEMENT of whatever makes it read as CG — the lighting, and every class of placeholder shape across the whole world (rocks,
plants, props, buildings, people), with real modelled or scanned assets, several agents in parallel — not polishing single
assets, not per-change reviews, not process. Verification is one batched render at the end. If a plan's next step is a detail
(one capital's proportions, one room's props) while the world as a whole reads as CG, the plan is wrong: say so and change it.
**And it must be as deep as it looks (UD-07, UD-08, UD-11):** the second question — walk up to anyone and follow them for a day:
do they have a home, family, work, history, reasons, a voice, a conversation grounded in their own life, and does the world's
day and year change around them? Where the answer is thin, the same rule holds: bulk depth (whole systems, every person), not
one showcase NPC. On the GPU machine, the look first; in the cloud (node-only), the depth first.

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
6. Accuracy beats beauty where the evidence is clear and it costs the illusion nothing; otherwise immersion governs (UD-29). The
   references ground the place in reality; they are not a 1:1 target. The lead is the director: fill every blank with the most
   probable reconstruction and take artistic liberties where the vision needs them (tier C, reasoning in F3). A detail slightly
   off never outranks a world that does not yet feel real. Judge the AAA bar from knowledge of top games; never ask the user for it.
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
These are the brief's tools, not its scope: §13 is read in its own scope words ("every walkable area", "as scenes"), and the
measure of progress is MASTER_PLAN.md's Walker Test (the illusion-break log, axes A–K and R, the generated COVERAGE.md board).

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
- **CPU is the second bottleneck (session 8: load 11 on 4 cores starved a render for 2 h).** Every heavy node job (soak, bots,
  audio renders, bakes, long vitest runs) goes through `tools/dev/cpu_slot.sh` (2 slots, nice 15), one process per slot, never
  parallel copies; SwiftShader keeps the rest. The lead checks `uptime` before launching work: load above 6 means queue, not start.
  Agents' briefs say this; a render that has not advanced in 30 min means the box is oversubscribed, not that the render is slow.
- **Memory is the third bottleneck (session 9: 14 of 15 GB used, no swap, load 35).** A render job holds ~3.5 GB (GPU process +
  page), each vitest worker up to ~2 GB, an agent's node run ~3 GB, an extra measurement browser ~1.3 GB. Check `free -g` with
  `uptime` before launching; no second browser of your own while a render job and two agents' test runs are live.
- **A page load is SwiftShader compiling shaders, not building the world (D-250):** the world builds in ~17 s idle; the first
  frames compile ~125 pipelines for 5-7 minutes. A page that needs no pixels uses `?norender` (D-253); measure GPU-process CPU
  (tools/dev/shader_sizes.mjs), not wall time, when comparing shader changes on a busy box.
- **Timing tests under load are not failures** until re-run alone on an idle box (performances, popview, humans_runtime,
  cloudnoise, long people_days runs). Never commit bench-reports/*.txt rewritten by a loaded test run.
- **Reviewers use every reference** in `references/` paired to the moments (table in handoff/review_briefs.md), and say which
  ones they judged against; memory of photographs of the ruin is allowed only where no reference covers it, labelled C.
- **Before merging an agent branch:** records conflict (DECISIONS, OPEN_QUESTIONS, BLOCKERS, PROGRESS) are unions of appended
  rows: keep both sides, no blank line inside a table; reserve D/Q/B number ranges per agent in its prompt.
- **After a render-affecting merge**, re-render the moments it touches before claiming a fix; a node test is not a render.

## The GPU machine (session 11 on; supersedes the SwiftShader-era rules above where they differ)
- Windows (Vagon), NVIDIA Tesla T4, 16 cores, 63 GB, open internet. Clone setup: `git config core.autocrlf false` (the guards
  compare bytes), `npm ci`, the installed Chrome drives the GPU (`PW_CHANNEL=chrome npx playwright test … --project=gpu`;
  Playwright's own chrome.exe does not start here). No python, flock or pgrep: cpu_slot.sh and the queue scripts do not run;
  run node jobs directly, several at once.
- A page load is ~11 min (world ~3 min, then shader compiles in the first 3 frames); a warm frame 0.1 s. Render every view of
  a job in one load (`BATCH=1`), at the player's lens and quality by default. **Never edit a tree whose dev server is serving
  a render**: vite reloads the page and kills the run; work in another worktree (`../fars-wt/*`).
- **B7 is lifted: texture and asset libraries are reachable.** Surfaces use CC0 scans (Poly Haven, ambientCG) over the
  procedural base (src/render/scans.ts; the measured tint and layout stay, the scan adds the grain); every asset in
  ASSET_LEDGER.md. The user's direction (session 11): every inch looking real, and every limit of the old machine revisited.
- Agents: short briefs (UD-30): goal, owned files, done line, the box rules.
- **Disk:** C: is 125 GB since session 13 (75 GB and down to 3.5 GB free in session 11). Session 13: T: was wiped; the models were restored from branch models-archive to C:/Users/Administrator/models-archive (checksums verified; 4 Qwen2.5-1.5B files re-fetched from Hugging Face) and linked as public/models/{mlc-ai,onnx-community,mlc-libs}. Older note: (downloads, worktrees, models). Large re-downloadable files
  (language models, browser caches) live on T: ("Temporary Storage", ~210 GB, may be wiped when the machine stops) behind
  a junction at their old path; anything that cannot be re-fetched stays on C: or goes to git. Check free space before
  large downloads.
- **The GPU watchdog:** Windows resets the card when one GPU job runs > ~2 s (DXGI_ERROR_DEVICE_HUNG; session 11: a long
  language-model prefill, and a portrait run while other agents rendered). Keep at most two heavy renders at once; keep
  single dispatches short (prompts ≤ ~450 tokens for the in-browser model). Do not change the Windows TDR settings.
  Every render goes through `node tools/dev/gpu_slot.mjs <label> -- npx playwright test …` (two slots under T:/gpu-slots).
- **Iterate on probe pages, verify in the world.** A full-world page load is 11-30 min of shader compiling, and neither
  compileAsync in the pass's context (D-299) nor a persistent profile's cache (session 11: 412 s vs 532 s first frame) cuts
  it. Pages that load only what is being worked on load in seconds (tools/dev/ground_probe.* ~10 s; humanlab.html,
  treelab.html): iterate there, and spend full-world renders (one per task, batched) on final verification only.
- **Blender 5.0.1** is installed (`C:/Program Files/Blender Foundation/Blender 5.0/blender.exe`; headless: `blender -b
  --factory-startup --python tools/blender/<script>.py`; ~20 s start-up; Cycles bakes on the T4 via OptiX/CUDA; glTF export with
  Draco). Use it for real prop and architecture geometry, normal/AO bakes, LODs and impostors, garment drape (cloth
  simulation baked into meshes) and hair cards; scripts live in tools/blender/ so every asset is reproducible. Heavy Cycles
  bakes take a GPU slot. (The Blender MCP is not connected to Claude Code; the scripted route is the project's.) The pipeline
  is `node tools/blender/build.mjs [id]` (D-305; research/BLENDER_PLAN.md); KTX-Software 4.4.2 is installed
  (`C:/Program Files/KTX-Software/bin/ktx.exe`) for its KTX2 textures.

## Box safeguards (session 15; the session-14 freeze)
- At most 2 agents at once on the 4-core box (the user, session 15, after 4 agents pinned the CPU at 100 % and made the app
  unusable; `tools/dev/mkwt.mjs` refuses a 3rd; `--done <name>` when one finishes). gpu_slot/cpu_slot wait while free memory
  < 4 GB or CPU > 75 % busy; one GPU slot; every slot job at below-normal priority. The watchdog alerts on CPU > 90 %: act at
  once (stop work you started), never call it an expected peak. `node tools/dev/watchdog.mjs [--loop]` reports a slot held > 45 min with no output (pids to kill), low
  memory, too many agents: the lead runs it every 30 min (the user, session 15) and passes any problem to the user at once, alone.
- No full-world render while agents build: the render train refuses while any agent is active (FORCE=1); it runs between waves.

## Every inch (the user's direction, session 8; D-233)
The camera-rig moments are NOT the standard. **Nowhere the player can walk may break the illusion**: every walkable place
of the Terrace, the town and the plain must reach the photoreal bar, one way or another. Measure it as coverage, not by
chosen views: the coverage harness (`tests/e2e/coverage.spec.ts`, `tools/dev/coverage_points.ts`; TO-BUILD, D-235 in flight) renders viewpoints
sampled over every walkable area and reports, per view and per area, the share of pixels drawn by PLACEHOLDER-flagged
objects, flat/blank surfaces, and the rubric reviewer's scores on a sample. The backlog is ordered by the areas that fail
most; a phase or area is done only when its coverage passes. Placeholders (town houses, procedural reliefs, stand-in
people at distance) are the first targets. Judge whole views at the player's lens against the AAA bar (UD-29); every session ships a change a player would notice.

## Guards and process (UD-30, session 15: "do whatever you think is best" after the critique of too much process)
- `npm run guards` runs before every commit (`.githooks/pre-commit`) and keeps only what protects the user: no direction in
  USER_DIRECTIONS.md reworded or dropped, no threshold in gates/thresholds.json loosened or removed. Never bypass the hook.
- Briefs are a short paragraph: goal as the player meets it, files owned, done line, the box rules. No templates.
- Records: one DECISIONS line per package (the lead gives each agent a D number); no reserved ranges, evidence paperwork or
  per-change verification. Status messages only when something changed.
- **The goal that orders all work: the playable slice (UD-31: by the end of session 15).** A public URL anyone opens, walkable
  in under a minute on a good GPU, talking to people on by default (small models, streamed); formerly: a URL that loads in about 2 minutes and runs smoothly on the T4; walk
  into a lane and it looks real; talk to anyone and they answer from their own life in their own voice; follow them home. Every
  package is judged by whether it moves the slice forward, and none may make load or frame rate worse.

