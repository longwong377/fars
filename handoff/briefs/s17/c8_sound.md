# C8 sound (cloud) — branch cloud-s17-c8-sound; D-620, Q-1550..Q-1559, B650..B659
Read cloud_common.md first.
**The player hears by tonight:** a world that sounds like a top modern open-world game, not a synthesiser: every place, hour,
season and weather with its own recorded bed (the town's lanes: voices at a distance, doors, donkeys, dogs, children, pots,
querns, hammering; the plain: wind in grass, larks and partridges, insects, water in the channels, distant herds and bells;
the Terrace: wind over stone, masons' chisels at the Hall of 100 Columns' site, footsteps echoing; interiors: hearth crackle,
the room's own acoustics (the archived OpenAIR impulse responses); night: crickets, jackals, dogs, owls; rain, thunder, dust
wind), footsteps by surface and pace, the foley of what people do near you (the activities' sounds), all mixed with distance,
occlusion and the room. The synthesis in src/audio/soundscape.ts becomes the fallback, not the sound (UD-33).
**The catch:** the cloud cannot download recordings (freesound, archive.org, Wikimedia are blocked here). So: (1) write
tools/audio/fetch_list.json: every recording the world needs, from CC0 / CC-BY sources (freesound CC0 first; licence, author,
URL, the layer it serves, trim and loudness), and tools/audio/fetch.mjs that downloads, trims, normalises (-23 LUFS beds),
encodes to Opus in public/audio/** (`git add -f` if ignored) and writes ASSET_LEDGER rows; (2) put one line in
handoff/s17/asks_vagon.md for the Vagon lead to run it (open internet there) and push; (3) meanwhile build the sample engine
(beds crossfaded by place/hour/season/weather, one-shots scheduled from the sim's activities and animals, footsteps from the
player's surface, convolution reverb from the IRs per room kind, a size budget agreed with C4: streamed after walkable).
**Owns:** src/audio/** except speech.ts, voices.ts, phonemes.ts and src/audio/neural/** (the voices are talk's), tools/audio/**,
public/audio/**. Footsteps: the player's surface comes from C9's src/player/**; ask it for one hook.
**Done:** every coverage area x hour band x weather has a recorded bed (tools/dev/sound_census.ts says so), footsteps on every
surface kind, the fetch script ready and, once Vagon has run it, the recordings in git and playing; nothing loads before
walkable; lint:lang clean (no modern speech in any recording: reject any bed with intelligible modern voices).
