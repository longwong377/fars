# C5 screens and intro: report (s17, cloud; D-590)

**Broken, placeholder or unseen first.** The opening and the title's drifting backdrop are UNSEEN in the world: no full-world
load is allowed here, so every shot is checked only by node tests against the terrain and the Terrace; seven views for the
Vagon train are in handoff/s17/asks_vagon.md. Known risks there: shaders compile progressively, so far shots (river, plain)
may show pop-in on a first visit; the eye's exposure carries across a cut for ~1 s (the dip hides part); the town and work
shots' framing is computed from plot data, not seen. The loading screen's skyline doubles the real relief (C). The boot-failure
message is still plain text. Map labels use the new fonts only once they have loaded. The Terrace in the loading screen's
skyline is a silhouette of masses with heights by eye (C).

**What a player now sees.** A loading screen that is the place itself: the real Kuh-e Rahmat skyline cut from the terrain,
whose dawn brightens with the measured progress (steps and bytes, no timer); PĀRSA with its Old Persian name; a title and pause
menu of glass over the live world (the camera drifting past the Terrace behind the title); a tabbed settings sheet (Esc goes
back) with readable keys; a controls page; a chronicle grouped by day; boxless subtitles; the map (M) now shows the Terrace's buildings and their names (the platform had
been painted over them); the Terrace of 467 stands at Rahmat's foot in the loading screen's skyline. On Enter in a new visit: an 85 s
wordless opening (river before sunrise, the plain from 90 m, the town, the Terrace's W face in the first sun, the gangs at the
Hall of a Hundred Columns, then down to the eye at the spawn), letterboxed, any key skips; time only moves forward.

**Files.** src/ui/shell.ts, shell.css, translation.ts; src/shell/intro.ts (new), progress.ts, skyline.json (new); public/fonts
(Cormorant Garamond, Alegreya Sans, OFL); index.html (3 font preloads); src/main.ts (hook: introDeps + two hook entries,
C4's file); tests/intro.test.ts (new); tests/language.test.ts (one registry line); tools/dev/shell_probe.*, skyline_gen.ts.

**Tests.** intro 11/11 (paths, control flow, and "never delays walkable": the title, the only way in, comes after ready; Enter starts the walk before the opening); lint:lang + intro 37/37; guards 25/25; tsc clean in touched files. No s17-renders yet: the intro is unseen.
