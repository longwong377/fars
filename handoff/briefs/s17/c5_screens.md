# C5 screens and intro (cloud) — branch cloud-s17-c5-screens; D-590, Q-1520..Q-1529, B620..B629
Read handoff/briefs/s17/cloud_common.md first.
**The player sees by tonight (UD-37):** the out-of-world layer at the AAA standard: a beautiful loading screen with honest
progress, the title and menus, settings, subtitles and the translation-layer text, the chronicle (key J); and a gorgeous
wordless intro: the plain at dawn, the river, the town waking, the Terrace in the first sun, people at their work, ending
where the player's walk begins. In-engine, skippable, it STARTS WHEN THE WORLD IS WALKABLE and covers the streaming of the
rest (animals, far models, the talk model). No narrator, no title card that hints at the place's fate (§1.1); English only in
the out-of-world layer, no modern language in the world (§10; `npm run lint:lang`).
**Owns:** src/shell/**, src/ui/**, a new src/shell/intro.ts; its hook in src/main.ts through C4 (ask in your report or a
one-line hook).
**Start at:** src/ui/shell.ts, src/ui/translation.ts, src/shell/; how the loading bar is fed today (D-393 "honest loading
bar"). The intro: a camera path of 5-7 shots (positions from tests/e2e/moments.spec.ts and tests/data/coverage_points.json;
the world's clock set to a real dawn), eased, 60-90 s, any key skips. 2D screens: headless screenshots are fine here; the
intro's frames you see from the Vagon train (ask for the shots in asks_vagon.md).
**Done:** every screen judged against a top modern game's front end (typography, layout, motion; fonts in public/fonts with
ASSET_LEDGER rows); the intro plays after ready, skips cleanly, never delays walkable; lint:lang clean.
