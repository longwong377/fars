# Session 17, the cloud side (2026-10-02 19:58 to 2026-10-03 ~01:50 UTC): report

The day ran as sessions/s17-vagon-v2.md: Vagon did the classes that need the GPU's eyes, the cloud built everything else in
parallel. This is the cloud lead's report; Vagon's lead writes sessions/s17.md. The final cloud commit for Vagon to merge is
the head of `cloud-s17-int` named in the last cloud-lead line of handoff/s17/asks_vagon.md.

## Broken, placeholder or unseen first
- **Almost nothing of the cloud's work has been seen on the GPU.** Vagon published 2 frames all day (both the same night view
  on the plain, cov-000), because each new time or weather state costs 10-13 min of shader compiles on the T4 (Vagon's V7 is on
  it). Every cloud class was judged by node censuses and tests, and late in the day by crude software frames (cloud eyes:
  SwiftShader WebGL2 at Q=test, branch s17-renders-cloud).
- **The crude frames say the world still does not read as AAA or full** (with the caveat that they are software frames at test
  quality): a town lane at 10 h is still mostly bare with smooth plaster walls and drawn cracks; the town from 20 m up shows
  ROOFLESS houses (rooms open to the sky: a far-LOD or roof draw-distance fault, to check on the T4 first); the plain reads as
  a smeared khaki sheet with flat green patches and little standing on it at 0.3-2 km; a walled enclosure west of the town
  draws as a flat grey box; a dark dotted seam crosses the near plain. Sent to Vagon (asks_vagon.md).
- **The night (T4 frames):** a magenta-purple band along the horizon, a fan of light streaks rising from one horizon point,
  clouds as dark cotton blobs (V1's; the ground was pitch black before light v1 and now reads).
- **Far views have no sun shadow past 600 m** (sunShadows.ts maxFar): the Terrace and town from the plain are flat-lit (C6's
  find; V1's file; asked).
- **Load:** cold ready 52-62 s headless on the cloud CPU (harness clock), page clock 43-53 s; this morning 99.8 s. The KTX2
  scans added ~34 MB / ~3 s before ready at the end of the day. Page memory 5.8-5.9 GB against 5 GB. Never measured on the T4
  today; the talk model excluded (Hugging Face is blocked in the cloud).
- **Sound:** 7 of 35 beds recorded (provisional patchworks of short clips); the rest play the synthesis until Vagon runs
  `node tools/audio/fetch.mjs` (internet). Nothing was listened to.
- **Walk:** 2 houses still cannot be entered (B580); people standing in doorways block 37 door passages (V3's step-aside and
  C10's spacing asked); the town bots miss 2 of 40 targets near q_s2 party walls for an unexplained reason (the player body is
  0.5 m, the routes are built for 0.56 m).
- **Town ground fill near the walls possibly not drawing:** in cloud eyes' lane frame only the firewood of ~10 things the plan
  puts within 10 m shows (C1's report; cause unknown: not drawn in that page, or sunk at terrain height under the wall foot). Check
  on the T4 first in any town lane view.
- **Life (C10, late):** coverage points with a reason for people but nobody there at every daytime moment 91 -> 39, nobody
  within 250 m 65 -> 16 (node census).
- **Road folk:** made population people (C10, D-640) and handed over in world.ts by the cloud lead at the end of the day
  (`sim.pop.shareFolk()`), so they are talkable; this hand-over is unseen in a render.
- **Old failing tests, all also failing on s14-int 63d26b45 (not today's):** day_slice, exchanges, fire_occ, humans_faces,
  impostor_assets, instruments, people_days_r6/r9/r11, persistence, sim_fixture, talk_prompt, visible, court_fill, land_work,
  people_children, coverage, popview, people_models (cloth hash), sculpt (pieces hash), reliefs (1.57 M > 1.5 M triangles).
  Today's NEW failures were all fixed the same day (base_paths, tone_look types, language-lint registrations, the plain's mesh
  gate, the palace furnishings' triangle budget).

## What the cloud landed (each agent's report: handoff/s17/report_c*.md)
| agent | D | what a player now meets (measured, unseen unless said) |
|---|---|---|
| C1 town fill | D-550 | bare lane cells 20 % -> 0, every court and roof dressed (1,447 each), no identical prop within 15 m; house fronts never alike next door (66 pairs -> 0), height by wealth; wall wear and feathered patches; 558 door lamps at night, things brought in at dusk; plank doors; 3 of 5 shut houses opened |
| C2 plain fill | D-560 | the black grass "flames" since s12 fixed; roadsides worn and rank, no bare verge over 2 m; repeated instances 11,000 -> 67; harvest stooks, threshing floors, straw; field weeds so young wheat is clumped; black flora cards lit; the quarry path |
| C3 roads | D-570 | roads near Pārsa empty 99 % of daylight -> no 250 m stretch empty over 2 min; camps dressed, picket lines, dogs; flocks out by season; more birds; the starling pipeline fixed for the T4 (17 -> 14 vertex inputs, a test guards 16); stone carts quarry -> site, flocks driven in |
| C4 load | D-580 | 99.8 s -> 52-62 s cold ready (headless); service-worker prefetch in need order; the shared KTX2/Draco decoder re-landed; no 404s; site 692 MB |
| C5 screens and intro | D-590 | one type system, loading screen of the Rahmat dawn, title, pause, settings, subtitles, chronicle, map; an 85 s wordless opening after walkable, skippable; first ten minutes of the built site 19/19 with zero console errors; the talk panel says honestly when the model cannot load |
| C6 far land | D-600 | terrain LOD pops over 2 px 32 -> 0; far hill normals; rock to 1 km; the quarries worked; the far-shadow fault found |
| C7 interiors | D-610 | every enterable room furnished by its use and household (town, villages, palaces, Treasury, stores, workshops, tents), neighbours never alike, doors clear; palace furnishings under budget |
| C8 sound | D-620 | the recorded-sound engine, footsteps by surface, activity foley, room reverb from 8 measured IRs, the fetch list for Vagon (~33 MB in a 40 MB budget), the synthesis as a clean fallback |
| C9 the walk | D-630 | stuck time in town 29.5 % -> 1.3 %; every enterable door walked (Terrace 130/130, inner 506/506, street 594/594 without people); pointer-lock errors caught |
| C10 life everywhere | D-640 | field workers round each village, brushwood gatherers and the state flock on Rahmat; road folk as population people with homes and days |
| cloud lead | D-540 | the plan audit and v2; Blender (pip bpy 5.0.1) and KTX2 (npm ktx2-encoder) in the cloud; the scoreboard set and runner; the ownership audit (every src file one owner: tools/dev/owners_s17.py); merges; tsc 0 errors; lint fixes; CI (a cloud session) and cloud eyes (software frames) |

## What went wrong in the cloud's running of the day (so the next lead does not repeat it)
- The lead planned agents by class and checked only that no two shared a file, not that every part of the game had an owner:
  interiors, sound, people's presence, the walk and water had none until the user asked "who is covering interiors?" Run
  tools/dev/owners_s17.py (0 unowned) before launching, and list the player's experience (see, hear, walk, meet, enter) against
  owners, not only the files.
- The lead did not read Vagon's asks_cloud.md for ~1.5 h, held cloud-s17-int stale ~70 min behind slow test runs, and let
  agents idle waiting for frames. Push merges at once when guards and owners pass; tests after, in a separate CI session.
- `public/models` is in .gitignore: built assets must be `git add -f` (C1's first props existed only in its container).
- The decisive bottleneck of the day was the T4's per-state shader compile (one frame per 10-13 min): the scoreboard of 46 states
  could not be rendered. Next session: V7's compile fix first, then a scoreboard grouped into few states.

## Branches
cloud-s17-int (the cloud's integration; holds all of Vagon's s17-int up to its 01:3x head), cloud-s17-c1-town ... cloud-s17-c10-life
(all merged into cloud-s17-int), cloud-s17-ci (CI table handoff/s17/ci.md; merged), s17-renders-cloud (cloud eyes' frames; data,
not merged), cloud-s17-audit (the plan audit; superseded by cloud-s17-int). Fates are in handoff/reserved_numbers.md.
