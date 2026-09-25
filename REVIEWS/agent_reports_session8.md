# Agent reports, session 8

## D-218 stone and wall surfaces (merged: worktree-agent-a42b26dd00e0827e5, head f126862)
**Broken / not met first.** The on-screen target (sunlit ashlar Ystd/Y 0.15–0.25) is NOT met: node CPU mirror with AgX
0.057–0.060 → 0.109–0.130 frontal at 5–30 m; rendered stair-climb-pm (high) 0.041–0.048 → 0.062–0.072 over the region
(0.032–0.034 → 0.046–0.053 in 48 px windows). Pre-tonemap 0.10 → 0.19–0.20 (inside "real stone 0.15–0.35"); AgX's local
slope at the stone's level (linear Y 0.30–0.35) is 0.6–0.7. Reaching 0.15 on screen would need ≥ 22 % (1σ) block albedo
and ≥ 13 % bands, judged implausible for fresh dressed stone: blocks kept at 17 %, bands 9 % (B40, Q-480). Three approaches
tried (albedo, normals, weathering). Other weak points: the mud-plaster salt line rendered once (dusk) as a thin wire,
softened to ~4 cm afterwards, NOT rendered; dark frames' daylight gloss NOT rendered; merlons rendered only in shade; the
instanced merlon shader not covered by shader_build; micro detail (pits, facets, striations) only reads at 1–6 m; Gate
door and pilaster recesses (fix 10, geometry) NOT done; no stone base course under the mud-brick walls (none found:
Q-483); a pre-existing dotted vertical line on the Terrace wall in stair-climb-pm (x ≈ 760) not investigated; GPU cost
estimated from the generated shader (1,166 → 1,481 lines, ≤ 0.6 ms at 1080p), not measured; probes not re-baked (means
preserved except the dark frames 6.4 % → 5.2 %).
**The brazier-close floor pyramids (lead's observation):** Perlin noise is zero at its integer lattice; the landing at
y = 0 sat on it, so the bump normals formed a 1/6 m quilt. Fixed in node by a rotated noise frame (NOISE_FRAME; noise at
grid nodes on the y/x/z = 0 planes 0 → 0.26–0.27); NOT re-rendered in that view. The merlons' sawtooth is the attested
four-stepped outline.
**Changed:** block tone 17 % (was 7.5 %), arrises rounded 3–9 mm at every joint (row above a bed joint −44 % at 5 m, −21 %
at 10 m, −7 % at 30 m; the joint a 0.8 mm hairline), bedding, stylolites in 45 % of blocks, fossil pits, chisel facets and
striations; steps grouped in blocks of 4–5 per row (Grand Stair B, others C), tread centres polished, grit at the tread
ends; merlons one stone each, dust on the ledges, faint streaks; dark frames roughness 0.18 → 0.10, albedo 6.4 → 5.2 %;
mud plaster base coat ~0.5 m, rising damp, salt tide line, 6 mm hand unevenness. All C but the stair rows (B). D-218,
Q-480..Q-485. Tests: surfaces_d218 (new), surfaces, surfaces_s6, polychromy, shader_build, detail, crenellation, arch,
now_view, probes. Renders: shots/moment-stair-climb-pm-d218{before,after}-webgpu.png, moment-gate-dusk-d218after.

## D-219 visible weather (merged: worktree-agent-a96267e84dc8071c7, head 712f495)
**Broken / unverified first.** (1) R6's cause is the exposure, not the shafts: the rain-approach camera stood 5 m inside the
Apadana W portico (sky visibility 0.05): exposure 36, the sky at 5–7× display white on AgX's shoulder; a solid-red shaft at
full opacity rendered sRGB (255,239,230) against the sky's (236,241,246); the real curtain is 22 % darker in linear light but
moves the PNG 4 %. The lead moved the moment into the open (Grand Stair landing), not yet rendered. (2) The ≥ 15 % PNG target
is not met: from a half-open stance (grid −57, 55; exposure 7.1) the sky inside the mask is 11.7 % darker (median; p90 16.5 %,
max 18 %; linear 22 %); ~16 % is estimated at an open-air exposure of ~2.5, not rendered; the constants were not darkened to
pass (no evidence). (3) No dark cloud base at quality test (volumetric clouds off); nothing rendered at high. (4) The
darkening front is 2.5–8 km out, 1–4 pixel rows under the horizon from the Terrace: 1 % effect. (5) Wet ground: the plain
45–60 m below 8 % darker at wetness 1; grazing angles 3–7 % brighter from the new sheen; puddles flat, sharp, bright at test.
(6) Snow lies on the court floor (+45 % luminance) and low relief ledges; merlon tops not seen from the stance; no footprints;
the brown overcast sky is NOT fixed (calibrated horizon under full overcast (0.279, 0.273, 0.256): the clear-sky dome has no
overcast whitening); flakes round, never lens-sized, still visually sparse. (7) The streak-orientation fix and rain-columns
not rendered after it. (8) people_days_r8 "child by the water" timed out under load (338 s vs 300 s).
**Changed:** rain shafts (src/world/rainShafts.ts) coloured on the GPU from the fog/cloud air table, opacity from the column's
optical depth with a height profile and falling streaks, darkening toward the cloud base (0.42 → 0.22 of the sky radiance),
debug()/stats(); RAIN_CELL uniform (clouds.ts; skySystem, materials): the cell's cloud shades the sun, wet ground under it;
wet sheen on porous surfaces scaled by wetness (materials.ts, envmap.ts); the ground ahead of the rain dry (0.48 → 0.006
before arrival; day-end states and climate statistics unchanged); streaks and flakes sky-lit, ≥ 1 px with light conserved,
none within 0.5 m of the lens, rain 4.5× and snow 14× denser, round flakes, streaks along the drop's velocity; snow on the
ground lights from below (groundSnow); the ration issue (HANDOFF 2a): the cause was rationRun, not workBlock (rainShiftedIssue:
a rain-delayed issue waits for another day near dusk; the depot queue must fit the work block in daylight; late queues in a
1/7 town sample on that day 5 → 0); debug: __parsa.weatherDbg(), pickW(), holdWeather(), tests/e2e/dbg_weather.spec.ts.
**Tests:** rain_shafts (an 8 mm/h shaft darkens the sky ≥ 15 % linear for ≥ 3 of 7 shafts), weather_visible (new),
shader_build, reflections_s7, rain_day_plans, weather, sky/surface/exposure suites; tsc, lint:all. D-219, Q-490..Q-495.
