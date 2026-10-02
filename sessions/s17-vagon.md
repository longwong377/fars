# Session 17 (Vagon only): all the GPU and Blender work. START HERE

The user (2026-10-02, after the cloud's report): "I want to do a vagon only session where we knock out all the blender/gpu
work". No cloud sessions run alongside. The depth is done and merged; this session is the look, the bodies, the performances
and seeing everything in the browser.

## The goal and how it is judged (UD-33)
The user: "i want every inch of the world to look AAA/real", and the rule agreed with them: **nothing on screen may read as
procedural.** Every surface and object is a real scan or a ready-made real asset (UD-34: "fill in the blanks for the sake of the
project": no per-object research, no modelling a cup from museum photos; the most real-looking asset that fits, in bulk; near
enough is right; Blender only for what no library has, fast). Code-made content stays
only where AAA games use it too: physically based sky, light, atmosphere and water; the placement and variation of real
assets; simulation (wind, cloth, crowds). Placement stays computed from the evidence (site spec, DEM, the town's layout).

Why it still looks bad although the scans were downloaded and the Blender wave built hundreds of models: the assets were proven
by node tests and probe pages, almost never judged in whole views at the player's eye (at least 7 BLOCKERS rows: "not seen in
the game's renderer"; nothing judged since s14); the scans only add grain under the old procedural tint and layout
(src/render/scans.ts), so surfaces keep their CG colour (blind reviews of the Terrace's materials, the interiors and the land:
1-3/5, every frame "reads as CG", after the scans); the light was never tuned against the references; and what fills the
screen (town walls, the ground, people at 2-30 m) is the weakest part.

The rules for the session:
1. **Render before anything else.** One load: the coverage points over every walkable area (tools/dev/coverage_points.ts,
   tests/e2e/coverage.spec.ts) plus the moments, at the player's lens, morning / late afternoon / overcast, each frame beside its
   reference photo (references/). That set is the scoreboard for the whole session.
2. **Rank by share of the screen.** What reads as CG over the most pixels goes first (expected: light and tone; town walls and
   roofs; ground, paths and rocks; people; then the Terrace's stone). Nothing small while something big still reads as CG.
3. **The procedural kill list** (code-made content that is seen; ~50 source files): materials and noise shading
   (src/render/materials.ts, scans.ts, blockface.ts, mx_noise_cpu.ts, monuments.ts); the town's surfaces, houses and kit
   (src/world/settlement/*, furnish*.ts, roadLitter.ts); ground, flora, trees and the plain (src/world/groundFlora.ts,
   trees/*, plain/*, src/terrain/terrainMesh.ts's shading); the Terrace's carved and modelled stone (src/arch/reliefs.ts,
   relief_figures.ts, sculpt.ts, column_models.ts, decor.ts, meshes.ts); people's bodies, outfits and props
   (src/people/body.ts, outfits.ts, props.ts, peopleModels.ts) and the animals; small life and wildlife. Each class is replaced
   IN BULK by ready-made real assets: scan libraries and asset packs first (Poly Haven, ambientCG, Sketchfab CC0/CC-BY and the
   like; every asset in ASSET_LEDGER.md), the scan's colour and pattern leading (flip the scans.ts rule); a class is one agent's
   job for an hour, not an object a day. Blender only to fill what no library has, quickly; the existing Blender wave reused
   where it reads real. No research per object: fill the blank, look at the whole view, move on.
4. **Seen or not done.** A replacement counts only when it is right in a whole-view render at the player's lens; no new
   assets until the existing ones are judged in place (most of the Blender wave never has been).
5. **Every ~45 min the render train** re-renders the scoreboard with every merge in; judge by eye against the AAA bar (RDR2,
   Ghost of Tsushima, AC Origins) and the references. The merge budget still applies: memory is already 0.83 GB over, so
   heavier real assets need compression (KTX2, Draco, LODs, impostors) as they land.
6. **Done** = every coverage view reads as a photograph to a fresh reviewer, not one showcase view. Leave sessions/s17.md
   with the before/after frames and what still breaks first.

## State at hand-off (s14-int 36adf02e, deployed to https://longwong377.github.io/fars/)
- Merged and live: everything of the cloud (D-455..D-464: open deeds and minds, goals, law, physical deeds, market
  stallholders, names, brides, talk-eval fixes) on top of Vagon's s16-candidate, the bake (D-392) and the boot fix (D-463).
  The user took the depth in although page memory rose 5.60 -> 5.83 GB (D-464): **that memory is owed back**.
- The report for the user: sessions/s15-cloud-report.md (what works, what is broken, numbers). Read its "Broken" list first.
- **Not seen by anyone:** no frame since s14, nothing of the deeds and minds played in the browser. The market and goals merges
  were not in the cloud's built-site load measurement.

## Order of work (each line is GPU/Blender; the cloud did everything node-side)
0. **Verify the live site first (20 min):** cold and warm load with the FIXED harness (`node tools/deploy/measure.mjs dist
   --visits cold,warm --params norender`; D-463: the old one blocked itself on PowerShell memory polls); the 6 x 404 named
   with `tools/deploy/boot_probe.mjs`. Then one real load with rendering: walk into a lane, talk to five people, try ten free
   deeds ("let me fix your roof", "let's go hunting tomorrow", "I'll fight him", "come drink with me tonight", "teach me to
   weave"), follow one person home. Write what breaks in sessions/s17.md as you go.
1. **The look in bulk:** handoff/briefs/s16/bigbox.md as written (baseline render in one load, 6 agents by class: light,
   ground, town, terrace, people, interiors; the render train every ~45 min; judge whole views against the AAA bar).
2. **Performances the deeds need** (handoff/briefs/s16/deeds_render.md): drink, dance, hunt_bow, wrestle, swim,
   plaster_roof as activities with anims and props; check the porter following at 1.5 m and the message walk; replace the
   stand-ins in src/people/deeds/verbs.ts NEAR_ACT / deeds/joint.ts.
3. **What the simulation now shows on bodies and houses (hooks exist, nothing renders them):**
   - visible marks: `marksOf(pop, pid, day)[].look` (scar_brow, burn_arm, limp, mourning, with_child, stoop, craft_*;
     src/people/marks.ts);
   - wounds: `sim.deeds.injuryOf(pid, day)` (bruised / cut / broken: a bandage, a limp, lying at home is already in the plans);
   - leaking roofs: `sim.deeds.joint.roofOf('h:<id>', day) < 0.45` (darker slumped plaster, a jar for the drips; fresh pale
     plaster after mending);
   - the market's stalls (`market:<q>:<hid>` places now full in the morning: goods spread out per the stall's kind).
4. **Blender backlog** (research/BLENDER_PLAN.md, BLOCKERS): B342 the Cycles people atlas 0.9 % over budget (re-bake);
   relief atlases and block-face baked detail; the lamassu's head; the griffin and lion capitals (Q-843); carving in the
   silhouette, not only the maps (B166, B167); far levels / impostors for the Terrace and palaces (B175); far people's
   impostors carrying their tools (B176); birds' take-off pop and wing normals (B179); flora cards alpha-to-coverage and wind
   (B180); houses' fixtures and furnishings; the shoreline water (B188); B189's probe; the women's walk and acted captures
   (B181-B183, if a usable source exists).
5. **Load and memory on the T4 (owed by D-464):** page memory under 5 GB again (5.83 now); ready under 60 s (the animals
   asset gates it: stream it after walkable); try the shared KTX2/Draco decoder again on 16 cores (one cherry-pick:
   871d8aab on cloud-s16-boot; it was neutral on the cloud's 4 cores).
6. **The voice on the GPU:** Qwen2.5-1.5B and the model's deed reading (Mind.readDeed, WebLLM JSON mode) in the page; the
   CPU eval's 150 labelled lines are in tools/dev/talkeval/deeds.ts; Kokoro fp16 vs fp32 by ear (`?neuraldtype=fp32`).

## Rules that still hold
CLAUDE.md "The GPU machine" and "Box safeguards" (gpu_slot, two heavy renders at most, never edit a tree whose dev server
serves a render, the merge budget after each merge). Push s14-int only after a cold built-site load reaches ready.
