# C8 sound — report (session 17, cloud; D-620)

**Broken, placeholder or unseen first**
- **No recordings are in the world yet** except the 8 measured rooms. The cloud cannot reach freesound, Commons or archive.org, so all 35 beds, 69 one-shot sets and 17 footstep sets are *listed* (tools/audio/fetch_list.json) but not fetched; until Vagon runs the fetch the player hears the old synthesis (now the fallback) plus the measured reverb. Census: 12,384 of 12,384 area x band x weather x season cells listed, 0 fetched.
- **Unheard**: nothing here was listened to. The beds' level (BED_LEVEL 0.55 at -23 LUFS) and one-shot levels are set by reasoning, not by ear; the speech screen is calibrated on synthetic and eSpeak signals only.
- **Hooks missing**: footstep surfaces wood and water, and town rooms (the 'room' bed, hearth, small-room IR), need C9's walk to pass `ground` and `roofed` into `sound.update` (src/world/world.ts, one argument each). Without them town interiors sound like the lane.
- Fires use a recorded hearth bed per fire once fetched; fire pops stay synthesised until then.

**What a player now hears differently**: the Terrace halls, courts, lanes, slopes, orchards and plain reverberate through measured impulse responses (OpenAIR, CC BY 4.0) instead of generated noise tails. After the fetch: recorded beds crossfaded by place, hour, season and weather; recorded work and animal sounds at their sources; footsteps by surface and pace.

**Views asked**: none (sound). Asks in asks_vagon.md: run the fetch; listen to a lane and the Apadana.

**Files**: src/audio/soundplan.ts, library.ts, sampler.ts (new); soundscape.ts, engine.ts; src/world/world.ts (hook: `air: ctx.cond`, overlay lines); tools/audio/{fetch.mjs, fetch_list.json, irs.mjs, common.mjs}; tools/dev/sound_census.ts; public/audio/{manifest.json, ir/*.ogg}; tests/sound_recorded.test.ts; DECISIONS D-620; ASSET_LEDGER.

**Tests**: tests/sound_recorded.test.ts 13/13; audio, audio_population, door_sounds, occlusion, waterworks, farcrowd, voices_unique 59 passed, 1 skipped; lint:lang 26/26; guards pass. fetch.mjs proved offline on synthetic downloads (bed -22.9 LUFS).
