# HANDOFF — end of session 12 (2026-09-28); branch claude/amazing-fermi-40ds7j

## FIRST, IN THE CLOUD (session 13)
1. **Models:** the cloud's proxy blocked Hugging Face. Test it first:
   `curl -sI https://huggingface.co/onnx-community/whisper-base/resolve/main/config.json | head -1`
   If blocked, use branch **models-archive** (every model the game uses first; files > 95 MiB split in parts, SHA256SUMS of each
   whole file): `git fetch origin models-archive --depth 1 && git worktree add ../models-archive FETCH_HEAD && (cd ../models-archive && node join.mjs)`,
   then serve its `models/` at /models/ (research/MODELS_MANIFEST.json, tools/dev/fetch_models.mjs) and point tools/bake-cpu/bake.mts
   `--model` at `bake/Qwen3-4B-Instruct-2507-Q4_K_M.gguf`. The upload was still running at the session's end: check which paths
   landed (`git ls-tree -r --name-only origin/models-archive`); the game's own set (gemma-2-2b, WebLLM libs, Whisper, Kokoro, the
   voices' models, Qwen2.5-1.5B, the bake GGUF) went first, the unused 3B/7B variants last.
2. Read sessions/s12.md (broken first; the class table).
3. **UD-23 (new, the user: "maximum immersion"):** people converse with each other, model-driven and grounded in both lives, overheard near the player, in their own languages and voices (T-E12). The node side (pair choice, grounding, lexicon line choice, gossip) is cloud work; the in-browser model load and voices need a GPU session.
4. **UD-24 (the user: "a living breathing world that you can actually affect and change"):** people talk freely about whatever their lives need (§10 loosened for this, D-316) and their talk changes the simulation with or without the player (T-E13). Node side first: talk events between pairs from their needs, resolved as structured intents away from the player, generated and voiced near the player.

## SESSION 12 CLOSE (Vagon): every Blender class of research/BLENDER_PLAN.md built world-wide, merged
Merged (all branches of the session): lighting (cascades, tone look, sky visibility, interiors verified 19 -> 112), CC0 scans
(rocks, flora, jars, baskets), the house kit + three LODs + baked walls, block faces (tool marks, chipped arris geometry, joint
grooves), palace walls/roofs/painted interiors, reliefs (carved atlas; 20 of 41 kinds from photographs), columns (every part baked),
the protome and colossi, frames/merlons/court tents, Tol-e Ajori and Naqsh-e Rustam, garments (cloth sim, 2 cuts), hands/hair/
beards, animals (34), trees (15), birds and small life and real flora, people impostors (Cycles), motion capture for every walker,
neural voices per person (Kokoro) with the Farsi/English opt-in, conversations that act and are remembered (behind ?converse),
the profiler and the eye-ray fix.
**Broken / unverified (read first):** most classes were never seen in a full-world render (the GPU slots were the bottleneck);
world frame time 209-287 ms at high (B125; the profiler dbg_perf.spec.ts is built, not yet run to completion); blender_assets
reproducible fails for 3 assets on the merged tree (rerun `node tools/blender/build.mjs --verify` on Vagon); the impostor atlas
is stale after the garments merge (`node tools/blender/impostors.mjs`, Vagon); T-E10 62.5 % (target 90), T-E9 ~60 %, T-E11 not
finally measured (94.7 % unique, 72 % natural; B190-B192); B111 the town lanes at night still black; interiors of rooms other
than the scribe room unverified; tests timing out under load (reliefs budget, doors, arris step, performances) to re-run idle.
**The cloud next (node-only):** reviews of REVIEWS/renders/s12/, the depth track (lives, T-E9/T-E10 grounding in node, the soak
gates), the records; anything needing Blender or the GPU waits for the next Vagon session (list above).

---

# (Earlier in session 12)

## SESSION 12 CLOSE (Vagon, ~2 h, UD-19): what was built, what is broken, what the cloud does next
Read sessions/s12.md first (broken first, the class table, the verification). In short:
- **Built en masse, merged:** the lighting (cascades 4096 at 8/50/160/600 m, full-res SSR/contact shadows, SSGI, the tone look
  fitted to 74 photos, outdoor sky visibility from a height map of the scene as built; D-309); CC0 scanned models world-wide
  (loose rock/boulders new, ground flora, every jar, every basket; D-310, 22 MB in public/models/props); the Blender mudbrick kit
  on every house of the town and villages (crests, poles, lintels, tannurs, door leaves, round wall ends, eroded foot; D-311);
  the protome capitals re-proportioned and the colossi at 6.7 m (D-312, with two known defects); every belt a tied sash (D-313).
- **Broken / not merged:** s12-monuments e7290b1 (2 failing tests; the colossi's vertical-only stretch and the paddle ears remain
  in the merged state; fix needs Blender, ~30 min, the next GPU session). Reliefs, block faces, garments, hair: not started (B136).
- **For the user:** the permission classifier refused (a) pushing the CPU bake model to a models-archive branch and (b) committing
  tools/bake-cpu/. Both are on this machine only (T:/models-archive, T:/fars-assets-s12/lead, tools/bake-cpu untracked). The Poly
  Haven model set (4.3 GB) is on T: only. T: is volatile.

**The cloud next (node-only), in order:** (1) review the committed s12 frames (REVIEWS/renders/s12/) blind, against references/;
(2) depth in bulk (the session-12 plan's cloud list below stands: life records, conversation grounding T-E9, soak gates, the
town's night, the villages); (3) node-side fixes the render shows (tints of the scanned props and flora, the eave pole ends, the
vessels' lod1 via a node decimator, sacks/vats/sherds as scan instances from the committed GLBs); (4) npm run areas and the board.
**The next GPU session:** the monuments fix (e7290b1's plan), reliefs as carved geometry, block faces, garments and hair (B136:
lower-resolution hands first), kit LODs/impostors for distant houses, PCSS, the tone look per sun altitude, and pushing the T:
downloads if the user allows.

---

# (Session 11 handoff and the session 12 plan follow)

## SESSION 12 PLAN (UD-19, D-308): ~2 hours on Vagon — BUILD EN MASSE; verify once at the end; the rest goes to the cloud
The user's direction: the whole world still reads as CG; stop verifying small details and build in bulk. The next Vagon session
is about two hours; the project then finishes in Claude Code on the web (no GPU, no Blender, a proxy that blocks Poly Haven,
ambientCG, Wikimedia, Hugging Face). Measure: T-R12, at least 5 whole asset classes replaced across the world this session.

**Why it still reads as CG (D-308):** almost every shape is a procedural primitive (boxes, lathes, one parametric body, code
trees), and the real-time lighting was sized for SwiftShader. Session 11 put scanned surfaces on those shapes; the shapes and
the light are what remain.

**Minute 0-10: setup and launch.** `git pull`, `npm ci` (tools are installed: CLAUDE.md, the GPU machine). Launch 5 build agents
AT ONCE, each in its own worktree (on T: if C: is short), each owning a whole class across the world, iterating on probe pages
(seconds a load; never a full-world render while iterating), committing as they go:
1. **The lighting at the T4's full quality** (the biggest single "photograph vs render" lever): shadow maps and cascades up
   (the stair-stepped shadows, B113), SSR/AO/contact shadows at full resolution, GI or probe light everywhere people walk (not
   only some halls), the tone curve and exposure against the photographs (#24, the Wikimedia set), atmospheric depth. Frame time
   measured on the T4 (T-K6).
2. **CC0 3D models in bulk (Poly Haven models: rocks, boulders, plants, shrubs, trees, pottery, baskets, crates, logs):**
   download the whole relevant set (commit what the game loads to public/models; everything else to branch assets-archive),
   and replace EVERY procedural rock, outcrop, shrub, jar, basket and similar prop in the world by instancing them (placement
   stays the simulation's and SITE_SPEC's). The cloud cannot reach Poly Haven: download everything the project might use.
3. **A Blender mudbrick building kit** (walls with plaster and repairs, doorways and door leaves, roofs and parapets, eaves,
   ovens, courtyards) driven by the town's and villages' own plot data: rebuild every house and compound as a kit building
   (the town's 1,447 houses, the villages), LODs and impostors from the pipeline (research/BLENDER_PLAN.md, D-305).
4. **The monuments' forms (Blender):** re-proportion the protome capitals and the Gate colossi from the photographs (B118), the
   relief figures as carved geometry (BLENDER_PLAN row 3), the Terrace's block faces with spalls and arrises.
5. **The people's forms (Blender):** garment meshes from simulated patterns with fold normals, real belts and sashes, hair
   from Blender hair curves (B121), posed drapes (B123); every class and the crowd.

**Minute ~80-110: one verification.** Merge the agents' branches (records as unions; code conflicts resolved in favour of the
bulk change), ONE batched world render with `SAMPLERDBG=1` over the review views (sessions/s11.md's 11 + a town lane + the plain
+ people), fix any pipeline over 16 samplers, commit the frames under REVIEWS/renders/s12/ (the cloud reviews from committed
frames; also build REVIEWS/anchors/ from them and the user's photos).

**Minute ~110-120: push everything** (`claude/amazing-fermi-40ds7j`, `assets-archive`, the agent branches) and rewrite this
section: what was built, what the cloud does next.

**Then the cloud: DEPTH first (UD-07, UD-08, UD-11, UD-18), in bulk across every person and system, node-only work:**
(1) the life records for every person (life.ts) and the life prose baked for all of them (the bake needs a model: bake on
Vagon if a slot remains, else a smaller offline model in node); (2) conversation grounded in each person's own life, the
fence, turning to face the speaker, T-E9 from 61 % to 95 % measured in node; (3) the simulation's systems: the soak gates
(populationVariety, plansWellFormed), the court and visitors, events and surprises (T-J5, T-J6 gap hunt), never repetitive;
(4) the town's night (lamps, B111), the villages' lives; (5) then the rest: merge `s11-realism-town` (plan below; it may be
superseded by the kit), the third T-F8 seed, `npm run areas` and the board, lints, records, reviews of the committed frames.

**Session 11 ran on the GPU machine (Vagon, Windows: NVIDIA T4, 16 cores, 63 GB).** Read first, in this order: `USER_DIRECTIONS.md`
(UD-17 and UD-18 are new), `MASTER_PLAN.md` (rev 2.4), `gates/thresholds.json` (T-A7, T-E9 new), PROGRESS.md (problems first),
this section, `sessions/s11.md`, BLOCKERS.md, `COVERAGE.md`, and **CLAUDE.md's new "GPU machine" section** (every rule below is there).

## What is broken, unverified or placeholder (read first)
- **Every area still reads as CG in blind review** (uncalibrated: REVIEWS/anchors/ does not exist). Scores after this session's
  work: land 2.75 (from 1.9), Terrace materials 1.86 (from 1.62), interiors 1-2, town 2, people 2-2.5, capitals 2, colossi 1.
  The tells now are FORM, not surface: the protome "a toy cow", colossi heads low, reliefs flat painted cards, props simple
  forms, joints drawn not built, block faces flat, people's hair helmets and boxy dress, straight box lanes. Surface scans are in
  everywhere (T-A7 ~0 in the measured views).
- **WebGPU pipelines over 16 samplers** (named and cut, unverified): checked inside session 12's ONE verification batch, not as
  its own task. SAMPLERDBG=1 names any that remain.
- **One branch NOT merged (pushed):** `s11-realism-town` (D-303); see "Unmerged" below. The people (D-304 inside D-307) are merged.
- **Night lanes in the town are black** (lamps light only their rooms, B111); the zodiacal light does not show; night clouds
  are black blobs. The belly (D-292) is not seen on screen (GB12 PARTIAL).
- **Speaking with the people (D-296) works behind `?converse` but fails T-E9 (61 %; target 95)** and replies take 4-10 s in the
  world on the T4 (1.3 s in the lab); the T4's Windows watchdog caps the model at ~2 B parameters (B98). Baked prose weak (B99).
- **The renderer ran ~5 fps at 1080p high on the shared T4 in the conversation run**: T-K6 not measured on an idle card.
- **Soak gates fail on seeds 7 and 90412:** populationVariety and plansWellFormed (children, porters, Treasury staff, a weaver).
  T-F8 = 3 events on both, n = 2 of the 3 seeds it needs (seed 1's re-run was stopped: re-run in its own worktree).
- The board reads 0 of 173 PASS: T-A6/T-A6x STALE after this session's source changes (re-run `npm run areas`, then `npm run board`);
  T-F8 STALE (no dependency hash in soak.ts, n = 2).

## The machine and its rules (details: CLAUDE.md, "The GPU machine")
- Renders: `PW_CHANNEL=chrome` + `--project=gpu` through `node tools/dev/gpu_slot.mjs <label> -- …` (two GPU slots; more trips the
  Windows watchdog, DXGI_ERROR_DEVICE_HUNG). A world page load is 11-30 min of shader compiles (neither compileAsync, D-299, nor a
  warm profile cache helps); a warm frame 0.1 s. Batch views in one load (moments.spec `BATCH=1`, validated against a fresh load).
  **Iterate on probe pages** (tools/dev/ground_probe.*, tools/dev/terrace_probe.*, townlab.html, humanlab.html,
  tools/blender/probe/*): seconds to a minute or two a load.
- Never edit a tree whose dev server serves a render; never run `npm ci` in a tree a running job uses (session 11 half-deleted
  node_modules under a soak); agents work in worktrees (`../fars-wt/*`, or on T: when C: is short).
- **Disk:** C: is 75 GB with a 9 GB page file; it filled twice. Re-downloadable bulk lives on T: (volatile) behind junctions.
- Tools installed: Python 3.12 (numpy, scipy, pillow, rasterio, shapely, pyproj, parselmouth, espeakng-loader, soundfile,
  allosaurus), Blender 5.0.1 (headless; Cycles on the T4), KTX-Software 4.4.2. The Blender MCP is not connected.

## Downloads (fars-assets; NOT all in git)
- On GitHub: branch `assets-archive` = 103 CC0 texture sets (Poly Haven, ambientCG) with manifests; the textures the game loads
  are in the code branch (public/textures/, src/data/scans.json, ASSET_LEDGER.md).
- **Only on this machine** (C:\Users\Administrator\fars-assets, each folder with a manifest.json of URL, licence, sha256): 54
  sources (ISAC OIP 65/68/69/70/91/92, Flights, Tolman, Iranica, open papers; the archive push of the papers was refused by the
  permission classifier), 366 Wikimedia photos (photos/, CC-BY-SA reference-only), datasets (Horizons, GHCN Shiraz, ISD, NASA
  POWER, Open-Meteo/ERA5), 13 OpenAIR impulse responses (CC-BY), MakeHuman CC0 pack, 11 Piper voices, and the language/speech
  models on T: (research/MODELS_MANIFEST.json; `node tools/dev/fetch_models.mjs` re-fetches them). A cloud session re-fetches
  from the manifests where its proxy allows.

## Unmerged branches and how to merge them
- `s11-realism-town` (D-303): real scans for the town, lane litter, the town lab. Conflicts with the main branch in
  src/render/scans.ts (it has its own normal-map path: a `Nor` type, a `top` scan for up-facing faces, a texture loader with
  optional maps), materials.ts, scans.json and three textures. Merge by keeping the main branch's D-300 normal maps
  (`nor` number, triNormal) and porting D-303's `top` scans and its SCAN_USE entries onto them; then the town lab and one world
  render (town_real.spec.ts) and the sampler counter.
- The people (D-304 skin layers and cloth scans; D-307 hair cards, cloth drape, the human material at 1 sampler) are MERGED; its
  world runs failed only on the unidentified 17/19-sampler pipelines (B122), which are not the people's material.

## Next steps, in order
**SUPERSEDED by the SESSION 12 PLAN at the top of this file (UD-19, D-308): on Vagon, bulk building of the look; in the
cloud, bulk depth. The list below is the session-11 backlog: fold its items into those two tracks, never let them lead.**
1. The sampler bug (above); then one full verification batch with zero validation errors.
2. Merge s11-realism-town (plan above).
3. FORM, through the Blender pipeline (research/BLENDER_PLAN.md): re-proportion the protome and colossi from the photographs
   (B118); relief figures as carved geometry; props (jars, baskets, goods) and doors; the polygonal foot's spalls; lane geometry
   (doors, spouts, ruts); garments and hair (D-307's route); Kuh-e Rahmat outcrops and scree.
4. Town lamps reaching doorways and courts at night (B111); the zodiacal light; night clouds.
5. Speaking with the people: T-E9 from 61 % (grounding in the life record, fence words, turn to face the speaker, spatial
   audio); the bake prose with a larger model where the watchdog allows (a CPU/offline bake).
6. `npm run areas` and the board; the third T-F8 seed; the soak gates (populationVariety, plansWellFormed).
7. At close: sessions/s12.md, reserved-number fates, tag ratchet/s12.

---

# Previous: end of session 10
# HANDOFF — end of session 10 (2026-09-27); branch claude/amazing-fermi-40ds7j

**Session 11 moves to a GPU machine (Vagon, the user's choice).** Read first, in this order: `USER_DIRECTIONS.md`, `MASTER_PLAN.md`,
`gates/thresholds.json`, PROGRESS.md (problems first), this section, `sessions/s10.md`, BLOCKERS.md, `COVERAGE.md` (the generated
board), `WORLD_INVENTORY.md`. Decide, log in DECISIONS, proceed; every report leads with what is broken.

## First: setting up on the GPU machine (the whole point of the move)
- **What changes:** every render so far ran in SwiftShader on 4 CPU cores (a test-quality view ~285 s, a high frame 2.5-4 min,
  a page load 5-45 min of shader compiling). On a real GPU expect seconds. The render lane stops being the bottleneck: render at
  the player's lens and quality (FOV=game, Q=high/ultra) by default, run the coverage passes (tests/e2e/coverage.spec.ts), and
  measure real frame rates (REAL_HARDWARE_TODO.md, T-K7).
- **Setup:** `git clone`, `git checkout claude/amazing-fermi-40ds7j`, `git fetch --unshallow --tags` if shallow, `npm ci` (installs
  the pre-commit guards), `npx playwright install chromium` (the container used a preinstalled browser; Vagon will not have it),
  `npm run guards`, `npx tsc --noEmit -p .`. Terrain: public/generated/ is committed; the DEM tifs are not needed to run.
- **The GPU project:** `playwright.config.ts` now has `--project=gpu` (no SwiftShader flags; `HEADED=1` for a visible window if
  headless falls back to software). FIRST check which adapter the page gets (every spec logs `backend`; `__parsa` reports the
  adapter): if it says SwiftShader or software, run headed. Then re-time one moment (e.g. `ONLY=gate-dusk`) to learn the new cost.
- **Windows (Vagon is a Windows desktop):** the tools under tools/dev/*.sh (render_runner.sh, queue_e2e.sh, cpu_slot.sh,
  e2e_watchdog.sh, e2e_snapshot.sh) are bash with flock/pgrep: run them in WSL or Git Bash, or call Playwright directly
  (`npx playwright test tests/e2e/moments.spec.ts --project=gpu` with the env vars). The cpu_slot / render-queue rules in CLAUDE.md
  were written for the 4-core SwiftShader box: re-measure and relax them in DECISIONS once the new machine's load is known (they are
  working rules, not gates).
- **Pushing:** the session designates the branch; keep pushing to claude/amazing-fermi-40ds7j. Tag pushes were refused here; try
  `git push origin ratchet/s10` from the new machine (the tag is created locally below only if the push works there).

## What is broken, unverified or placeholder (read first)
- **Three agent branches were stopped mid-work at the move and are NOT merged.** Their work is saved as patches in
  `handoff/wip/` (one per agent, with each agent's own stop report in `handoff/wip/*_report.md` where it arrived in time):
  D-276 Terrace rooms (Treasury, Harem, garrison, guards' sleeping: B63), D-285 Terrace materials (against the photos: B40, B57),
  D-292 the body and the day (pregnancy, washing, shaving, the Persian washing rule). Resume: create a branch from the current
  head, `git apply --3way handoff/wip/<name>.patch` (plain `git apply` fails only on their appended OPEN_QUESTIONS rows: --3way or append by hand), read the brief in handoff/briefs/s10/, finish, test, merge. Their reserved
  numbers stay reserved (handoff/reserved_numbers.md). Known state: D-276 has three gate-tier failures its last WIP commit is meant to fix (popview, court, coverage sample: regenerate with its tool) and no render; D-285 did not move B40 (the tone curve and a 199/255 overexposed Terrace wall are the likelier culprits: pipeline, outside its files); D-292's pregnancy is done and tested, its care layer breaks one people_days test (the barber sits in the lane in dust: check wx.dustH).
- **Almost nothing of session 10 has been seen on screen.** Judged: the shader A/B (identical; probe loop default on, D-290) and
  planets-dusk at the player's lens (a thistle on the Terrace paving: fixed, unrendered). halo-sundogs timed out. Never rendered:
  every session-10 addition (list in sessions/s10.md) and session 9's backlog. **Sounds added this session were never heard (B65).**
- **The board:** COVERAGE.md reads 0 of 171 PASS (143 NOT-MEASURED, 19 STALE, 9 SUPERSEDED). T-A6/T-A6x passed when written and are
  STALE since (re-run `npm run areas` after the D-276 rooms land, then `npm run board`).
- **B88: the world's edge is walkable** (the far ring's edge at ±71.7 km; D-240 wants real terrain there). Q-741/Q-742 (unreached
  floors; roofs have no collider; the Hall of 100 Columns unroofed?). Tier 0: the Grand Stair's collider floor off the drawn
  surface in 33 % of cells (worst 0.76 m).
- **T-J6 fails:** three gap hunters: 16-28 % of gaps estimated unfound (the two-list 19 % was low). WORLD_INVENTORY.md holds 34 new
  rows (GC1-GC34) from hunter C.
- **T-B3 (Tier-1 rotation) reads FAIL by budget on SwiftShader** (205 lane-hours a rotation): the GPU machine is the fix.
- Still open from session 9: B67 town walk, B74-B76 villages (hitches, fires, unrendered), B81 wild garlic, B83 raised river corridor.

## The render queue at close (not run: re-run these on the GPU first, they are the unverified backlog)
    104a_tj5b1.job: E2E_PORT=5204 Q=high FOV=game ONLY=dust-devils-jun TAG=tj5 TIMEOUT=3500 PW_TIMEOUT=3550 URLX=&shareinst=1
    104b_tj5b2.job: E2E_PORT=5218 Q=high FOV=game ONLY=meteor-terrace TAG=tj5 TIMEOUT=3500 PW_TIMEOUT=3550
    106_ford.job: E2E_PORT=5206 Q=test ONLY=ford-pulvar-sep,ford-kur-apr TIMEOUT=2000
    107_frost.job: E2E_PORT=5207 Q=test ONLY=frost-dawn,breath-dawn TIMEOUT=2000
    108_quarry.job: E2E_PORT=5208 Q=test ONLY=quarry-work,tannery-work TIMEOUT=2000
    109_press.job: E2E_PORT=5209 Q=test ONLY=press-work,drum-road TIMEOUT=2000
    110_village.job: E2E_PORT=5210 Q=test ONLY=village-p22-dusk,village-p22-lane TIMEOUT=2000
    111_small.job: E2E_PORT=5211 Q=test ONLY=small-spring-field,flowers-may TIMEOUT=2000
    112_eclipse.job: E2E_PORT=5212 Q=test ONLY=eclipse-terrace,eclipse-moon-tele TIMEOUT=1500
    113_swifts.job: E2E_PORT=5213 Q=test FOV=game ONLY=swifts-dusk TIMEOUT=1500
    114_ground.job: E2E_PORT=5214 Q=test FOV=game ONLY=stair-foot-ground TIMEOUT=1500
    115_murmur.job: E2E_PORT=5215 Q=test ONLY=murmuration-jan TIMEOUT=1500
    116_snow289.job: E2E_PORT=5216 Q=test FOV=game ONLY=snow-morning-289 TIMEOUT=1500
    117_halo.job: E2E_PORT=5217 Q=high FOV=game ONLY=halo-sundogs TAG=tj5 TIMEOUT=3500 PW_TIMEOUT=3550
    118_zodiacal.job: E2E_PORT=5219 Q=test ONLY=zodiacal-mar TIMEOUT=1500
    plus: planets-dusk again (the thistle fix), and share-instancing at high (`URLX=&shareinst=1` on one high view; if it renders
    without validation errors, make it default like D-290).

## Next steps, in order
1. Set up the GPU machine (above); re-time a render; write the new costs into gates/budget.json and DECISIONS.
2. Render the whole backlog above at the player's lens and quality; judge each in sessions/s11.md; fix what they show.
3. Resume the three stopped agents from handoff/wip/ (at most 2-3 at once), D-276 first (ring 1).
4. With renders cheap: the coverage pass (tests/e2e/coverage.spec.ts; now over data/areas.json once the sampler is moved onto the
   registry: MASTER_PLAN §4.2), then the board; T-J5 three surprises verified (planets-dusk counts; halo, dust devils, meteors,
   rainbow, murmuration, zodiacal light are candidates).
5. Listen: a browser with speakers can finally hear the audio (B65): the lanes, the Terrace forecourt, a village, the road (hooves,
   doors, far crowd), rain on a roof.
6. B88 the world's edge; the next gap hunter (T-J6); ring 2 (town) after ring 1 passes coverage.
7. At close: sessions/s11.md, reserved-number fates, tag ratchet/s11.

---

# Previous: end of session 9
# HANDOFF — end of session 9 (2026-09-27); branch claude/amazing-fermi-40ds7j

**Read first, in this order:** `USER_DIRECTIONS.md`, `MASTER_PLAN.md` (rev 2.1), `gates/thresholds.json`, then PROGRESS.md
(problems first), this file, BLOCKERS.md, `sessions/s09.md`, `WORLD_INVENTORY.md`. Decide, log in DECISIONS, proceed; every
report leads with what is broken. **Do not end a turn with close-out steps "still ahead": nothing wakes the lead (s09 log).**

## What is broken, unverified or placeholder (read first)
- **Most of session 9's additions have never been seen on screen.** Rendered and judged (test quality, chosen lens): fords (a
  pale staircase: fixed, re-render queued), the crescent Moon (VERIFIED after D-274), the winter snowline (VERIFIED on the N ranges),
  frost (read as snow: toned down, re-render queued), the heat pass (compiles; effect not seen), the Kur ford (floating reeds:
  snapshot predates the B83 tuft fix; raised corridor remains), the May flowers (pink blotches, no heads seen near), the beasts
  (onagers read; lions specks; cheetahs hidden by a rise). Unrendered: villages at dusk, the crafts in the town (the smith only in
  a forgeless lab), cattle/fishing/bees, the small life, birds, dust devils, hail (no hail day in the test seed), breath, roses,
  alfalfa/flax, timber carts.
- **T-J5 (three surprises at the player's lens) is not met;** jobs 413_tj5a / 414_tj5b in the queue render them at FOV=game, Q=high.
  halo-sundogs' camera was inside the Apadana: moved to [-36, 125] (the tj5a job reads the fixed spec).
- **B84:** the eclipse's totality renders nearly black. **B83:** the far ring's river corridor stands up to 6.5 m above the
  ground. **B74-B76:** village build hitches (up to 681 ms), village fires 5.4 ms at dusk, villages unrendered. **B80/B81:**
  quarrymen vanish on cold nights; nobody collects the month's wild garlic. **B67:** the town walk still fails (93.5 % / 16.4 %).
- **Budgets near their limits:** the plain at 39 of 40 meshes; the village-p22 fov-70 frame at 1.93 M of 2.0 M triangles
  (mostly the fords' stone mesh in the shadow passes).
- **Timing tests** (performances, humans_runtime, solids, cloudnoise) failed only under load 7-9: re-run alone, idle, before
  judging. T-F8 has one seed (1); seeds 7 and a fresh one still to soak.
- Opt-in, pending A/B: `?probeloop=1`, `?shareinst=1` (jobs 415/416), `?heat=1` (D-268).

## Merged this session (all on claude/amazing-fermi-40ds7j)
- Lead: D-250 load anatomy + smaller shaders (opt-in), D-251 tiered tests, D-253 `?norender`, the eclipse, meteors, rainbow,
  planets, snowline, predators and wild animals (beasts.ts), birds; after the gap hunt D-257..D-274 (fords, small life, flowers,
  crops, human sounds, frost, halo, birds, flora, dust devils, hail, breath, heat, coughs, alfalfa/flax, roses, timber, the Moon).
- Agents: D-249 town walk, D-252 court arrival, D-254 villages, D-255 crafts and records, D-256 land work. Worktrees under
  .claude/worktrees/ can be removed.
- The gap hunt: two hunters' reports (REVIEWS/gap_hunt_s9_A.md, _B.md) merged into WORLD_INVENTORY.md (capture-recapture: N ≈ 244,
  ~46 unfound: T-J6 fails); 63 rows filled, 135 open. The fill order is at its top.

## The render queue at close (tools/dev/render_runner.sh; work dir in the lead's scratchpad, not in the repo)
Running: moontele (planets-moon-tele done, eclipse-moon-tele done, frost/breath/halo/dust at test quality). Queued: quarry
(+tannery, press), tj5a, village (dusk, lane), ford2 (both fords + frost after fixes), tj5b, ab_old, ab_new. The queue dies with
the container: a new session re-queues from tests/e2e/moments.spec.ts and plain.spec.ts (the views are all in the specs).

## Next steps, in order (D-275: two lanes at full rate, ring by ring; UD-16)
The user's direction at close (UD-16): the full scope, as complete as possible, as fast as possible. D-275 sets how: a **render
lane** that is never idle and a **build lane** of at most 2 agents, ring by ring (Terrace, then town, then plain), admitted only
while the unverified backlog (merged changes never judged on screen) is at most ~20 job-views (T-R11, locked).
1. **Session start:** guards, `git fetch --unshallow --tags` if shallow, `uptime`/`free -g`. The render queue died with the
   container: re-queue at once, in value order: (a) the probeloop/shareinst pixel A/B (if identical, default on: every later
   render is cheaper); (b) T-J5 at FOV=game Q=high (planets-dusk, halo-sundogs, dust-devils-jun, rainbow-plain, meteor-terrace);
   (c) the unverified backlog of session 9 (fords, frost, village dusk, crafts, quarry, small life, flowers). Judge each, log
   in sessions/s10.md; fix B84 and what the renders show.
2. **Build lane, ring 1 (the Terrace):** launch the D-276 agent from `handoff/briefs/s09/terrace_rooms.md` (reserved D-276,
   Q-730..Q-739, B85..B87; NOT launched in session 9): the Treasury and Harem rooms, garrison quarters and guard sleeping (B63),
   then the Tripylon site. A second agent only if the backlog is under the cap: materials against the photos (B57).
3. **Instruments early:** the coverage harness (D-235, T-R rows), renderless walker bots, the generated COVERAGE board: they
   decide what ring 1 still lacks.
4. Idle-box re-run of the four timing tests; T-F8 soaks for seeds 7 and a fresh seed (via cpu_slot).
5. A third gap hunter with a different checklist (T-J6); the people-side gaps: roof sleeping (G23), latrines (G24), plastering
   (G25), board games (G32), tomb guardians (G35), the royal hunt (G11).
6. Ring 2/3 work after ring 1 passes coverage: B67 town walk, B83 (finer terrain ring over the rivers), B74 (village build in a worker).
7. At close: sessions/s10.md, fates in reserved_numbers.md (D-276's), tag ratchet/s10.

---

# Previous: end of session 8
# HANDOFF — end of session 8 (2026-09-26); branch claude/amazing-fermi-40ds7j (tag ratchet/s08 exists locally only: the git proxy dropped every tag push)

**Read first, in this order:** `USER_DIRECTIONS.md` (the user's own words, UD-01..UD-14, append-only), `MASTER_PLAN.md` (rev 2.1,
governs everything), `gates/thresholds.json` (169 locked thresholds), then PROGRESS.md (problems first), this file, BLOCKERS.md.
The user wants no interventions: decide, log in DECISIONS, proceed. Every report leads with what is broken.

## What session 8 changed (the big picture)
- **The standard changed** (UD-06, D-233): not chosen camera views but **every inch the player can walk**, at every hour, season
  and weather, in motion, with sound. The user then asked for a living sandbox (UD-07..UD-11, UD-14): everyone a name, home,
  family, job and history; the court coming and going by default; never repetitive; surprises; every gap filled from the period.
- **Four independent audits** (REVIEWS/audit_A..D) found the chosen-views miss was one of many: 6 % of the Terrace ever judged,
  copy-paste everywhere (23 bodies, 209 names for 46,910 people), people drawn in the rain their plan sheltered, frozen distant
  workers, a silent town, the player falling through Kuh-e Rahmat at the terrain LOD seam, no autosave, seed always 1.
- **MASTER_PLAN rev 1 → 2 → 2.1**, critiqued twice by independent adversaries (REVIEWS/master_plan_critique*.md): the Walker Test
  on axes A–K + R, an illusion-break log as the headline measure, 169 thresholds that only tighten, seeded sampling the agent can't
  choose, an area registry over the whole walkable envelope, a generated board where NOT-MEASURED and STALE count as FAIL.
- **Guards that run themselves** (rev 2.1): `npm run guards` = tests/gates_ratchet.test.ts + tests/scope_ledger.test.ts +
  tests/defaults.test.ts; in the pre-commit hook (`.githooks`, installed by `npm ci`), at the start of `npm run build`, and in
  GitHub Actions (`.github/workflows/guards.yml`). They fail closed. All 13 of the second critic's attacks re-run: all caught.
- **Every threshold starts at to-build.** Status is earned only by an evidence file (`REVIEWS/evidence/**/<id>.json` written by
  the row's tool). First earned: T-G1, T-G2 (failing), T-G2b, T-G2f, T-G3, T-G3e (partial, from D-245).

## Merged this session (on claude/amazing-fermi-40ds7j)
- D-222 fire-light occlusion (B24 on the Terrace), D-226 relief self-shadows, D-228 village budget, D-229 Phase 5 fixes (court
  soak 8/8, impostor work frames), D-232 masonry layout (renders: no longer flat or black, but fails photo #24 plainly), terrain
  quality scale fixed, the moon moment.
- Stop the bleeding (MASTER_PLAN §6 step 1): no Math.random in src; per-call audio noise; a new world seed per new game (settings
  shows it, "New world"); villages and Tol-e Ajori flagged placeholder; lint:all in the build; the court by default (UD-10; rigs
  with ?test pin court=evidence unless &court=seasonal); FOV 60 / bob 1.8 cm (D-238); TASKS ticks removed.
- D-245 the town is not mute: limiter, voices from everyone within 60 m, non-looping beds, rivers audible. **Never heard in a
  browser** (B65); T-G2 fails (2 repeats: the Old Persian lexicon is ~114 words, B66).
- `tools/dev/cpu_slot.sh`: heavy node jobs run in 2 low-priority slots (load 11 on 4 cores starved renders for hours).

## Agent branches at close (see handoff/reserved_numbers.md for fates)
All six agent branches of the session are merged (handoff/reserved_numbers.md): D-229, D-245, D-237, D-244, D-234, D-235.
Their worktrees under .claude/worktrees/ can be removed (`git worktree remove -f -f <path>`).
- **D-237 walkability:** terrain colliders from the drawn chunks (0 of 24 mountain crossings fall, was 12; T-H1 built), controller
  fixes, rescue net, solid people/animals near the player, autosave (IndexedDB, byte-identical round trip in node), walk bots
  (tools/dev/walkers.ts, lib/offline_world.ts). Town fails: 61.7 % of targets reached, 27.5 % stuck; 767 house doors too narrow
  (Q-640); lane routes clip walls (Q-641). 7 of 14 areas never bot-walked. persistence.spec and the walkthrough never ran.
- **D-244 indoor truth:** the indoors drawn inside rooms or not at all (T-D3 0, T-D3s 100 %, T-D4 4.6 % worst area, 3 seeds);
  tools/dev/people_trace.ts. Never seen on screen; garrison/mill/camps have no rooms so their people vanish (B63).
- **D-234 town houses:** 1,447 distinct houses, near/far levels, 1,494 street doors, lamps, seasons. Rendered once before its
  last fixes (lane view timed out); near tiles built on the main thread (B59); drawn people walk through shut doors (B60).
- **D-235 coverage harness:** commit-seeded sampler, ID pass, gate metrics, coverage.spec, coverage_report.ts (evidence and
  COVERAGE.md). No evidence yet; a pass is ~30 lane-hours at test quality. How to run: PROGRESS.md (D-235 entry).

## What is broken, unverified or placeholder (read first)
- Photo #24 side by side: the Terrace wall reads as grey concrete, no polygonal foot, smooth ground, featureless mountain (B57).
- Nothing on the board is measured yet except the six audio rows; the instruments of §6 step 2 are TO-BUILD (renderless mode,
  area registry, Tier 0, walker bots, Tier-1 sampler, generated board, anchor set, escapes log, event kinds).
- The court's arrival is not simulated (present from day 0); D-239 (start before the arrival) and T-F8 wait on it.
- The simulation still runs on the main thread (B53); long route searches stall 150–650 ms (B54).
- Impostor work frames, the new voices, the houses after their fixes, indoor drawing, solid crowds and autosave have never been
  seen or heard in a browser. **The first job of session 9 is to render and listen to what session 8 merged.**
- The town walk fails (doors too narrow, routes clip walls); the town's tiles hitch the main thread (B59).
- Villages are box compounds; interiors unbuilt; faces are a few variants; one voice synthesiser.
- The random-seed year soak (seed 362095439) was stopped for CPU at 25k/46k people: re-run it idle via cpu_slot.
- D-246 (the perpetual 467) and D-247 (a fall off the Terrace) are decided, not implemented.

## Next steps, in order (MASTER_PLAN §6)
0. **Speed first (UD-15, D-248):** the cached world (page loads in seconds) and tiered tests, then the renderless mode. No sibling
   cloud sessions (the user declined them: T-R10). Check `uptime` and the render queue before launching anything.
1. Session start: `git fetch --unshallow --tags` if shallow; `npm ci`; `npm run guards`; merge or record any agent branch left
   in handoff/reserved_numbers.md.
2. Verify session 8 on screen: one grouped render job for the town (lane-q_s1, court-q_s1, town-smoke-dusk), the persistence
   and walkthrough specs, a crowd view at distance (work frames), then the first coverage chunk (D-235 command in PROGRESS).
   Listen: town lane, forecourt, village, Pulvar bank, rain by a fire, a close conversation.
3. Finish step 1: town doors wide enough (Q-640) and lanes off the walls (Q-641); the court's arrival simulated (D-239, T-F8);
   the random-seed soak (seed 362095439) via cpu_slot.
4. Step 2, time-boxed: **the renderless mode first** (measure bot-hours per core-hour into gates/budget.json), then the area
   registry, Tier 0, walker bots (five policies), the Tier-1 sampler, the generated board, anchors, escapes, event kinds.
5. At close: sessions/s09.md, fates in reserved_numbers.md, tag `ratchet/s09` pushed.

## Tools (session 10 additions)
- **Area registry:** `npm run areas` (cpu slot, ~15 min, ~4 GB) → data/areas.json, T-A6/T-A6x evidence, the envelope cache
  (shots/cache/envelope.bin, 348 MB, gitignored). Any edit under src/ or tools/dev/lib makes T-A6/T-A6x STALE: re-run, then board.
- **Board:** `npm run board` (~1 s) → COVERAGE.md. tests/coverage_board.test.ts is in `npm run guards` (not in the pre-commit hook):
  after a source change run `npm run board` and commit COVERAGE.md with it, or guards/test:fast/CI fail.
- **Tier 0:** `npm run tier0` (cpu slot, ~1.5 min with the envelope cache) → REVIEWS/evidence/s10-instruments/tier0.json.
- **Render jobs at quality high:** one view (one page load) per job with `TIMEOUT=3500 PW_TIMEOUT=3550`; two loads at high
  timed out at 2900 s under load (tj5a). `URLX=&flag=1` in a job's env line reaches the page (the probe-loop A/B used it).
- **Never `pgrep -f <pattern> | xargs kill` from the Bash tool:** the pattern matches the tool's own shell and kills it.

## Tools (session 8 additions)
- `npm run guards`; `tools/dev/cpu_slot.sh <cmd>` (always, for soaks/bots/audio/bakes/long vitest); `tools/dev/audio_render.ts
  --evidence <pass>` (D-245); `tools/dev/plan_dump.ts <pid> <day0> [day1] [seed] [--court]`; `tools/dev/sim_cost.ts`;
  `tools/dev/load_probe.mjs`; `tools/dev/person_census.ts`; audit probes in tools/dev/audit_c and audit_d; `tools/build_fire_occ.ts`
  after any architecture or fire change (tests/fire_occ.test.ts checks the parts hash).
- Briefs from handoff/agent_template.md and handoff/review_template.md, saved to handoff/briefs/sNN/; reserve numbers in
  handoff/reserved_numbers.md first.

## Gotchas (session 8)
- **Check the render queue, not just CPU:** `ps -eo pid,etime,args | grep "[q]ueue_e2e"` shows every job waiting on the one
  flock lane. A job with an empty log is usually waiting, not stuck. Cancel low-value jobs before they block agents' renders.
- Load above 6 on 4 cores: queue, don't start. Four parallel bot processes starved a render for ~2 h.
- The pre-commit hook runs the guards in every worktree (shared git config); branches older than the guards skip it.
- Templates' fixed clauses may only grow: append a new numbered clause, never renumber (the scope test caught this).
- Tests rewrite bench-reports/*.txt under load: `git checkout bench-reports/` before every commit.
- `vitest run $(ls tests/*x*)` with an empty glob runs the whole suite; `grep -c $(git diff --name-only --diff-filter=U)` hangs
  when there are no conflicts (guard with `[ -n "$U" ]`).
- The camera rig takes a TRUE azimuth; a near brazier sets the exposure.

## Tools (session 7 additions)
- **`tests/e2e/dbg_hang.spec.ts`** (DBG=1): when a frame never returns, it pauses the page through the DevTools protocol and
  prints the JS stack (found the homeHours hang in one run). Env: DAY, HOUR, W, V, Q, WAIT.
- **Rain shafts:** `?shaftdbg=1..4` (4 = real tint, uniforms logged; moments.spec prints `shaftdbg` console lines).
- **Camera rig:** `__parsa.view()` sets `crowd.rigClear = 2.5` (nobody drawn within 2.5 m of the lens; the player's camera
  never); `world.treesNear(e, n, r)` lists plain and town trees (slope view keeps off them).
- **`tests/e2e/dbg_light.spec.ts`** (D-216): light-group switches (fires, braziers, SSR) with before/after measurements.
- Music claims: the next free number is M-24; OPEN_QUESTIONS used up to Q-473; decisions up to D-217; blockers up to B24.

## Gotchas (session 7)
- **Never delete `/tmp/parsa-e2e.lock` or a running job's snapshot dir**: a runner holding the old lock's inode and a new one
  can overlap, and a deleted snapshot kills the page mid-run ("Execution context was destroyed").
- **After a container restart, check for a second render runner** (`ps -eo pid,args | grep [r]ender_runner`); one may already
  be running.
- **Resume stopped agents with SendMessage to their id** after a restart: their worktrees survive with uncommitted work.
- **Agents' merges collide on shared ids**: music claims (M-22 twice this session), OPEN_QUESTIONS rows, DECISIONS order.
  Reserve number ranges per agent in the prompt (done for Q-420..479 and D-214..217 this session).
- Merging markdown tables: `rowmerge.py`-style per-row resolution against the merge base (git's `:1:` stage).
- A heavy test run under 5 agents OOM'd a render once (session 7); keep ≤ 4 agents and one vitest at a time.

## Tools (session 6; still apply)
- **Render runner:** `tools/dev/render_runner.sh <work dir>` and `LIMIT=3700 tools/dev/e2e_watchdog.sh` in the background;
  copy job files into `<work dir>/jobs/`. Specs take `TIMEOUT` (s) and the Playwright config `PW_TIMEOUT` (s): high renders
  under load need `TIMEOUT=2900 PW_TIMEOUT=2900`. Keep ≤ 3 views per job; views sharing (day, hour, weather) share a page
  load. The entry sequence (`apadana-enter-court` … `apadana-hall-out`) must stay in ONE job: it carries eye adaptation
  (`__parsa.carryEye`).
- **Debug views:** `?envdbg=occ` (sky specular visibility red / occlusion green); `dbg_surf.spec.ts` takes `URLX` and
  `TIMEOUT` and has `dawn-glow-e`; `dbg_plain.spec.ts` takes `VIEW`, `DAY`, `HOUR`, `TAG`; `tools/dev/scene_lum.ts` undoes
  the tone map; `tests/lib/occ_check.ts` is a CPU mirror of the sky-specular occlusion at floor points.
- **Markdown table conflicts** (BLOCKERS, OPEN_QUESTIONS) when agents edit the same rows: resolve per row against the merge
  base (take the side that changed the row; flag rows changed on both).

## Gotchas (session 6)
- **Committing a worktree's `node_modules` symlink replaced the main tree's real node_modules** (git turned the directory into
  a self-loop). `.gitignore` now ignores `node_modules` as a symlink too. If node_modules vanishes: `npm ci`.
- **`pgrep -f` / `pkill -f` with a pattern** match your own shell's command line. Use PIDs from `ps -eo pid,args | grep "[p]attern"`.
- **three's MRTNode blends only `output`**; every other G-buffer attachment was written unblended (D-183). Any new MRT output
  must get `setBlendMode(name, new BlendMode(MaterialBlending))`.
- **Container restarts** kill agent sessions but keep the disk: an agent's worktree under `.claude/worktrees/` survives;
  resume it with SendMessage to its id.
- Agents cannot write outside their worktrees: copy their reports into `REVIEWS/agent_reports_session6.md`.

## Gotchas (sessions 2–5, still true)
- Timing tests and long `beforeAll` builds fail under load: re-run alone before calling a regression.
- Long Playwright runs: don't pipe through `head`. TSL: no runtime `select()` under TRAA; `pow()` of a negative base is NaN;
  reversed-edge `smoothstep` undefined; r186 binds a `Data3DTexture` through a 2-D view and fails; colour uniforms type-check
  only against floats. Frames outside three's loop must advance `renderer._nodes.nodeFrame` (D-047); use `__parsa.setTime`.
- The runner snapshots the tree when a job takes the lock: never leave code and generated data out of step.
- Light probes: `WORKERS=3 npx tsx tools/build_probes.ts` after architecture or SURFACES albedo changes (~20 min loaded);
  `npx tsx tools/build_nav.ts` after architecture changes; `npx tsx tools/build_horizon.ts` for the horizon map.
- Effect materials must use `colourOnly()`; small indoor objects must receive shadows.
- Old agent worktrees: remove with `git worktree remove -f -f` once their branch is merged (session 7 did; earlier sessions were refused).

