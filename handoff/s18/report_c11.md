# C11 report: the title film, the opening and the score (D-760, D-761; UD-38, UD-39)

## Broken, placeholder or unseen (first)
- **Nobody has heard the score.** The cloud has no ears: every cue was checked by measurement only (BS.1770 loudness curves,
  spectrograms, the build's semitone-clash check of long notes against the harmony, range checks per instrument). A human
  listen on Vagon is the first real review; tools/score/analyze.ts prints the curve of any master.
- **The hall is synthetic** (a modelled scoring-stage response, RT60 3.1 s low / 2.5 mid / 1.5 high): no recorded hall IR is
  reachable from the cloud. Sample library: Sonatina Symphonic Orchestra is good but not a top commercial library; the
  sample legato is SSO's, not a scripted true legato. Both are the ceiling of what the cloud can reach.
- **The film in the repo is the cloud's draft**: 640x268, rendered at 8 frames a second and motion-interpolated to 24, 14
  samples. The full-quality pass (1920x804, every frame, 64 spp) is a T4 job: tools/film/T4_JOB.md (through the lead).
- **The game's bull and capital meshes look faceted in close-up** (their detail lives in KTX2 normal maps Blender's importer
  cannot read): the film shows them only as silhouettes, in haze and firelight; the Gate-bull close-up was cut.
- **The in-engine opening's new first shot ('stars', night over Kuh-e Rahmat) and the town shot (roofless from above?) are
  unseen**: asked C6 for frames. The opening's other shots are D-590's.
- The film plays on a key press (browsers allow sound only after a gesture): until then it waits on its poster with "Any key
  to begin · Esc to skip". Safari before 17 may not play the AV1 WebM: it falls back to the H.264 MP4; a browser without
  Opus hears no in-world score (the opening's cue has an AAC copy).
- Not mine and still raw: the talk panel's strings (src/people/converse/ui.ts).

## What a player now meets
1. The page opens on the title film over the loading screen (src/shell/film.ts): ~2:25 of macro main-title shots cut to the
   main theme's bars: an ember over carved rosettes; a reed stylus pressing wedges into clay; an Elamite tablet's lines;
   the Gate's XPa inscription in raking dawn light (the signs as the stone has them); the glazed rosette frieze with dust in
   the sun; a brazier catching; the braziers of a night hall flaring down the rows on the drums; the colonnade in morning
   haze; the double-bull capital against the sky; the stair climbing into the sunrise; the merlons against the sun; the hall
   backlit at the climax; 𐎱𐎠𐎼𐎿 in gold. It covers the load; any key skips.
2. Enter: the in-engine opening (src/shell/intro.ts), now cut to the cue "First Light": stars, river, plain, town, Terrace,
   work, the walk, each cut on a bar, the camera's clock following the music, landing as the horn closes the theme's half.
3. In the world: after 4-7 min of silence, now and then one of 21 cues (62 min) for the hour, the place and the weather,
   never the last one, nothing from the last hour while a fresh one fits, 5-12 min of silence between; Settings › Sound ›
   Score (On/Off) and Score volume of its own.

## The score (tools/score)
- Written note by note (cues/*.ts), performed with expression (lib/write.ts), rendered through recorded instruments (SSO,
  VSCO-2 CE, MuseScore General via sfizz and fluidsynth), mixed on a stage and mastered (build.ts). Libraries and renderer:
  tools/score/fetch.sh. Re-oriented after C12's fourth pass: none of the brief's banned "ancient Persia" cliché (§11).
- Main theme "Pārsa", D minor, 2:25 (in the film; tools/film/work/main_theme.opus is its source for the edit).
- The world's cues: First Light, The Road, The Long Shadow, The King's Terrace, Night Sky, The Watch, Rain on Stone, Golden
  Hour, Market Morning, Theme Remembered, Wind over the Plain, Dawn Chorale, Evening Road, Court at Night, Stars over
  Rahmat, Harvest, Smoke and Embers, The Gate, Midday Heat, Before Dawn, After the Rain.

## Sizes
- public/audio/score: 21 cues in Opus/WebM 80 kbps (+ First Light in AAC), 44 MB, catalogue manifest.json (~10 KB). Nothing
  loads before the walk except the opening's cue (~2.8 MB, streamed) and the film.
- public/film: see the final commit (filled in when the render lands).

## Tests
tests/score.test.ts (director rules, the catalogue on disk, an hour of music, the opening cut on bars), tests/intro.test.ts
(D-590's clearance and control flow, unchanged), tests/language.test.ts (the film registered as an out-of-world text site),
tests/translation_layer.test.ts and tests/writing.test.ts (the reworded translation layer).
