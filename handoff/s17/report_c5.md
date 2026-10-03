# C5 screens and intro: final report (s17, cloud; D-590)

**Broken, placeholder or unseen first.** The opening and the title's drifting backdrop are UNSEEN in the world: s17-renders
holds one baseline frame and none of the seven views asked in handoff/s17/asks_vagon.md. Risks there: progressive shader
compile may pop objects in during the far shots; exposure carries ~1 s across a cut; the town and work framing is computed,
not seen. The loading skyline doubles the real relief and its Terrace silhouette has heights by eye (C). The boot-failure
message is plain text.

**What a player sees.** A loading screen of the real Kuh-e Rahmat skyline whose dawn rises with measured progress; glass
title and pause menu over the live world (the camera drifting past the Terrace behind the title); tabbed settings, controls,
a chronicle by day, boxless subtitles, a map whose buildings now show; Cormorant Garamond + Alegreya Sans (OFL). On a new
visit an 85 s wordless opening (river, plain, town, the Terrace's W face, the gangs at the Hall of a Hundred Columns, down to
the eye), skippable at once. The talk panel says honestly why a person answers in their own lines.

**Final check** (00:50, build_site dist of cloud-s17-int b9c44423, headless, tools/dev/first_minutes.mjs): 19/19, ready 51 s,
reload 38 s, zero console or page errors.

**Files.** src/ui/*, src/shell/intro.ts, progress.ts, skyline.json; public/fonts; index.html (preloads); src/main.ts (hook);
src/people/converse/ui.ts (note, assigned); tests/intro.test.ts; tests/language.test.ts (one line); tools/dev/shell_probe.*,
skyline_gen.ts, first_minutes.mjs.

**Tests.** intro 11/11; guards 25/25; tsc clean in touched files. lint:lang 25/26 after the last merge: V2's new public/textures/dirt_floor/arm.jpg (a23bfea8, D-490) is not registered in the image list (not C5's; to V2).
Cloud eyes' frame of shot 3 (01:36): from e -165 the town lay off the right edge; the shot was moved W over the quarter (72 plots in the frame's cone vs few before). Its other findings (roofless houses, the smeared plain, the grey walled box, a dotted seam) are C1's/C2's/V2's.
Cloud eyes' frames 02:20: shot 1 (river) reads; shot 2 had no Terrace or Rahmat (a low ridge E of the old position hides them; moved W where the line of sight clears by 0.7 deg); the title backdrop reads (its bright vertical streak on the mountain is not C5's). Shots 4-6 unrendered.
