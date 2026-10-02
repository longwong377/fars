# Session 17 (Vagon only): all the GPU and Blender work. START HERE

The user (2026-10-02, after the cloud's report): "I want to do a vagon only session where we knock out all the blender/gpu
work". No cloud sessions run alongside. The depth is done and merged; this session is the look, the bodies, the performances
and seeing everything in the browser.

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
