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
