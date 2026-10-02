# C8 sound — report (session 17, cloud; D-620)

**Broken, placeholder or unseen first**
- **Most beds are still the synthesis.** In git: 7 of 35 beds, 17 of 69 one-shot sets, 8 of 12 footstep surfaces, 8 of 8 rooms. Census: 882 of 12,384 area × band × weather × season cells fully recorded; the other 11,502 are listed for Vagon's fetch (`node tools/audio/fetch.mjs`, asks_vagon.md), which the cloud cannot run (freesound, Commons, archive.org blocked).
- **The 7 recorded beds are PROVISIONAL patchworks** of 27-37 five-second ESC-50 clips crossfaded (rain light/heavy, drips, hearth, gusts, warm-night crickets, orchard birds): the texture changes every few seconds. Vagon's fetch replaces them with long field recordings.
- **Nothing was listened to.** Levels are measured (tools/dev/sound_mix.ts: each scene within 0.4-2.3 dB of its level before the recordings), the speech screen is calibrated on synthetic and eSpeak signals, and clips were chosen by their titles only.
- **The walk's hooks are wired but live only once C9 merges:** world.ts passes `player.groundKind` and `player.roofed` (cloud-s17-c9-walk) into `sound.update`, read through a cast so it typechecks before and after that merge. Until both branches are in cloud-s17-int, town rooms sound like the lane. Even after it, C9's groundKind is only 'stone' (built floors) or undefined, so wood and water steps are still never chosen.
- Unrelated, seen in passing: tests/crafts.test.ts "day plans" (a sim test, 212 s) failed once on this branch (`expected [ Array(1) ] to deeply equal []`). Not verified against the base: both attempts ended in a container restart. My diff touches no sim file (src/audio, tools, and one argument in world.ts), so it is most likely pre-existing; the cloud lead's CI should confirm.

**What a player now hears differently**: measured reverb in every hall, court, lane, slope, orchard and on the plain (OpenAIR); recorded dogs, cocks, hens, cattle, sheep, pigs and the boar, frogs, crows, crickets, bees, a door's creak, thunder, a fire's pops, water poured; footsteps recorded on every surface (4 by the nearest surface's set); recorded rain, drips, gusts, hearths, warm-night crickets and orchard birds.

**Views asked**: none. Asks: run the fetch; listen in a lane and the Apadana.

**Files**: src/audio/{soundplan,library,sampler}.ts (new), soundscape.ts, engine.ts; src/world/world.ts (hook: `air: ctx.cond`; overlay); tools/audio/{fetch.mjs, fetch_list.json, fetch_lock.json, irs.mjs, common.mjs}; tools/dev/{sound_census,sound_mix}.ts; public/audio/**; tests/sound_recorded.test.ts; DECISIONS D-620; ASSET_LEDGER (rooms + the D-620 block).

**Census also covers activity foley**: all 25 work sounds the performances ask for are listed (5 fetched; footsteps, fire and murmur are layers). **Rooms**: the 8 measured impulse responses play per room kind (hall_large for the great halls, hall_medium, room_small, court for courts and lanes, gorge for the slopes, open, wood, chamber), tested end to end.

**Tests**: sound_recorded 14/14; audio, audio_population, door_sounds, occlusion, waterworks, farcrowd, voices_unique pass; lint:lang 26/26; guards pass; 183/183 files decode in headless Chromium at their listed lengths.
