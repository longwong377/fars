# V6 interior light and fire (D-530), report (final)

**Broken / placeholder / unseen first.** Palace halls and the Terrace rooms were not reached: no frame of them in this session
(the box crashed twice under the lab runs; the first full lab run with the Terrace never finished). Fire shadows (2 nearest
lights at high, static cube maps) are coded but never seen in a frame: confirm in the train or set FIRE_SHADOW_LIGHTS = 0 in
src/world/fire.ts. The new flames and coal beds were drawn in the lab but not judged close up. House rooms by day are lit
near the doorway only; the back of a room is still dark-brown, not bounced (the deferred lights have no SSGI). Lamps unshadowed:
a brighter lamp leaked through the street facade, so lamps stay as they were. Court camp hearths: hook written, not wired
(one line in world.ts after CourtCampTents: `addCampHearths(fire, campItems(sim.pop.court.tents), (e, n) => terrain.heightAt(e, -n), ti => tentStands(sim.pop.court.tents[ti], sim.t))`).
The lab pages log "samplers (18) > 16" errors (pre-existing, also before my changes).

**What a player sees differently.** By day a town doorway shows its room: floor, bench, jars lit from the door, instead of a
black hole (the ~9,100 doorways are daylight sources on the room side). At dusk and night a room with a lit lamp or hearth
spills warm light on the lane or court before its door. Flames have tongues and a hot core; hearths and braziers sit on glowing coals.

**Probe frames judged** (T:/s17-fire/shots, not committed): house-day-b (before), lanedoor-day-d (ports off/on), lanedoor-day-e,
court-day-e, court-night-e, lanedoor-night-e (facade over-lit: lamp reverted, spill cut to x0.8). The final tune (ports x2 by day, spill x0.8) got no GPU slot in 40 min and is UNSEEN: judge it in the train.

**Views for the train:** a lane door by day and at night: fire lab cam 'door:q_s3:11:3.5' (grid -1154.2, 956.7 area; heading 78,
pitch 4) at 11:00 and 20:40, day 20; court of q_s1 house 3 at 20:40.

**Files:** src/world/fire.ts, firePlaces.ts, src/render/fireGlow.ts, public/generated/fire_occ.* (re-baked), src/world/world.ts
(one hook line: fire.setPorts), tools/dev/fire_lab.*, tests/fire_camp.test.ts.
**Tests:** fire_camp, fire_light, fire_glow, fire_occ, town_glow, smoke_light: pass; guards pass.
