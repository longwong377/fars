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

## D-220 smoke and dust (merged: worktree-agent-a3f0e1f4d0c864d3e, 805d645, 6ad2600)
**Broken / unverified first.** Dust has NEVER appeared in a render: every rendered view reported 0 emitters (dust.begin()
ran after crowd.update() and cleared them); fixed in 6ad2600 and checked in node with a real Crowd (walker, herder, mason: 7
puffs); NOT re-rendered; animals/flocks/carts dust unverified. The smoke measurably changes the image but does not show a
smoky town: from the Terrace at 1 km the lower town is a thin line of specks with a pale band over it; no rising plume at
18:48 (most hearths embers); from Kuh-e Rahmat (bearing 228°) the S palaces fill the foreground. Lead's look: the
town-smoke-dusk frame reads as an empty dark plain under a twilight sky; the moment does not land (framing, and the town's
readability at distance: landscape workstream). Side effect: the town's hearth flames follow the sim (lit for lighting,
cooking, or a low fire on nights with minimum < 8 °C); on a warm evening (day 14) they are out by ~19:30 (was ~70 % lit from
sunset to 1.5–3 h after; Q-502). All amounts C, recollection (Q-500..Q-506). Sim villages stand elsewhere than the rendered
villages (Q-503): village smoke uses the plain's mean household day scaled by population. GPU cost estimated (~650 ALU per
covered pixel, 0.1–0.2 ms at 1080p), not measured. performances "300 performers" and popview costs failed under load.
**Why no frame had smoke:** near puffs spawned at rate × dt and renderOnce passes dt = 0; single-hearth plumes τ ≈ 0.03 (right
for one hearth); the town's haze existed but no moment looked SSW at it; villages had no fire or smoke; no dust code; not
killed by the composite.
**Changed:** src/world/hearthSmoke.ts (1,241 of 1,304 town fires linked to their household's day: relit before breakfast, cook
0.35 h before the evening meal, cooking, low fire or embers; ovens before baking; per-quarter and per-village leaky boxes
ventilated by the wind, ~40 min dilution, layer peaking ~14 m up at dusk and dawn, mixed high by day, a downwind tail);
src/world/landSmoke.ts (one instanced wind-aligned box per settlement, exact extinction in 6 segments, sky/sun lit, 1 − e^−τ;
replaces haze.ts's per-quarter sheets); fire.ts puffs from time (frozen renders show them), opacity from each fire's emission;
src/world/dust.ts (walkers, animals, flocks, carts on dry earth; chisels and sledges; none on wet ground, snow, rain or in
halls; a third on the Terrace courts; Crowd.dustTap, Animals.onPush); moments town-smoke-dusk (Terrace W edge looking SSW,
24° lens) and town-smoke-dusk-rahmat, day 14 18:48, wind 0.8 m/s; moments.spec `ab` option (A/B shots with named objects
hidden, draw calls logged).
**Measured:** τ Terrace → S quarters at dusk 0.19–0.35, at 12:30 < 0.03, after midnight 0; Rahmat → W quarter 0.074; Grand
Stair → village p21 at dawn 0.39; a 6 m/s wind more than halves τ; 5 puffs per lit hearth at dt = 0 (was 0); renders (high,
smoke − none): town-smoke-dusk rows 250–262 +10.3/+8.9 luma (+22 % Weber; control parapet |Δ| 0.25), near-horizon sky −3.9;
rahmat +10–12 %; dawn-stair-top +6.8 at the horizon line. Draws +1 (+1 inside a layer). Tests: smoke_dust (16), smoke_light,
fire_light, settlement, settlement_build, religion, fx_shader, fauna; tsc; lint:all. D-220, Q-500..Q-506.

## D-221 the court as an assembly and the scribes' room (merged: worktree-agent-a1c7dbb28cc230746, head 1f092fd)
**Broken / unverified first.** In render 2 the Aramaic secretary and the pupil still read as bare torsos in short red skirts
(node: the Median tunic, trousers and boots are drawn, 12,690 tunic pixels; guess, unchecked: madder-red cloth under the red
floor's bounce reads as skin; handed to the garments workstream D-225). The nearest scribe sat 2.42 m from the lens, inside
the rig's 2.5 m clearance, and was not drawn: the camera moved back 0.3 m, not re-rendered. The court frame is calmer (no
sweepers; blocks and knots) but the spearmen's files, 29–41 m away and end-on at eye level, are not legible: still a busy
court more than an assembly. Placeholders: the usher does not hold the leader's hand (no pose); the delegations' animals stay
at the camp; the Aramaic leather sheet carries no writing; the pupil rests on a recalled attestation (Q-514). (The lamp is
lit since the lead's follow-up: a fire of kind lamp, sched 'day', in the occlusion bake.) The 30-day court soak fails
variety, populationVariety and plansWellFormed (2,786 "festival" issues, court women on day 10) identically on the base
tree (pre-existing). Timing asserts in performances/popview failed under load.
**Court:** posts 1.0 m apart centred on each line (court.json day.file_spacing_m), held in place (Spot.fixed), others kept
0.8 m off posts, the way between the files and the parties' places; the Gate's S file to the W wall. CourtResidents.dayOrder:
25 party blocks five abreast before the N stair (0.9 m apart, rows 1 m), petitioners in lines on the E side, the morning's
called parties nearest in arrival order; one party at a time before the king (≤ 0.25 h), each with its own usher (531 turns);
those waiting face the N stair, E stair, hall door or throne; forecourt talk in knots round ~20 centres; sweeping only before
~08:00 and after ~16:00; court-assembly moved to day 32 09:30. Measured (node, before → after): guards in order 0.5 % →
91.9 % of ~1,945 (87 % at meal hours: end men whose neighbour eats, Q-512); party members within 3 m of their centre 8.6 % →
100 %; mean alignment to the focus 0.009 → 0.996; within 30° 18.6 % → 100 %. Test tests/court_order.test.ts.
**Scribes' room:** write_tablet draws a tablet in the left palm and a 6-triangle stylus (the phiale lost a side to keep the
1,000-triangle small-prop budget; draws back to 2); the Aramaic secretary with leather sheet and reed pen; seats in site_spec
(Elamite scribe, secretary, pupil, visitor); the secretary's son (15) copies on 259 of 350 days (gap audit 33; no new person,
pids unchanged); mats, lamp and soot, ink pot, water bowl, jars, bench baskets, seals, stained floor (all C); the old moment
had one scribe ill and the other in the store: moved to day 21 13:30, re-aimed from the W. people_pieces passes again.
Tests: court, court_fill, court_order, scribes_room, court_view, people, population, people_pieces, treasury_rooms. D-221,
Q-510..Q-516, COURT.md §6, SITE_SPEC regenerated.

## D-223 mountains, cliffs and the plain from the Terrace (merged: worktree-agent-a4c56a96aa1c9fb35, head c7202d2)
**Broken / unverified first.** The near plain is still an empty brown sheet (stair-noon-plain render 2: ground 40–200 m out
Ystd/Y 0.068 vs 0.065): it is the Terrace foot, the approach and the court camp (trodden; no fields, D-190); the added wear,
tone and stains are band-limited away (a pixel covers 1–4 m at 100–200 m from 14 m up) and trodden vs untrodden earth differ
~12 % in albedo; one approach tried; next: larger features (tracks, stone heaps, tethered animals, herb patches). The royal
road still reads as a straight light line at dawn (settlement.json's straight polyline; ±3 m wander < 1 px at 1 km). The town
at dusk does not read and materials cannot fix it: at 1–2.5 km from 15 m on the 24° lens a 3 m house is ~4 px tall, a roof
~0.2 px deep (696 roofed plots in view, all ≥ 1.5 px); at dusk walls, roofs and ground are within a few % (smoke lifts the band
Y 0.026 vs 0.020, open plain 0.010); at noon the town at ~1.5 km shows light roof tops over darker walls; at dusk it needs lamp
and hearth glow. Naqsh-e Rustam rendered once with the fix (render 1): no fine wavy lines at 960×540, broad dark run-off
streaks and block tones remain (Ystd/Y 0.44–0.59). All geology C (Q-520, Q-521); the riser/bench is a shading tilt, not
geometry (silhouettes and cast shadows keep the DEM's form; fades by ~2.3 km). The dark dots on Kuh-e Rahmat are flocks.
**R9 moiré: shadow acne.** nr_rock is DoubleSide and three r186 draws DoubleSide into the shadow map on both sides, so the lit
face shadowed itself (sun at grid 271° along the face at 15:00, mean N·L 0.11, depth slope ~9× the cascade texel vs a 0.06 m
normal bias). Fix: shadowSide = BackSide (naqsh.ts); the E return flipped (0.1 % still faces in); fine and middle mottling and
the streaks' fine octave band-limited (materials.ts). The bump band-limit (D-217) and the horizon map were ruled out.
**Mountains (terrainPlain.ts):** cliff packages as a riser over a bench (world-space normal tilt keeping the DEM's slope),
pinching out along strike and cut by gullies; pale riser with run-off streaks, darker bench; talus under each riser, aprons
under steep ground, gravel fans at gully mouths; shrub crowns 3-D spheres on a rotated jittered grid, grey-green; woodland dots
round on slopes. Shrub down/across ratio at 0/45/60/75° 1.00/1.41/2.00/3.83 → 1.01/1.00/1.00/1.00.
**Plain:** the radial streaks were D-190's 12 ruled desire lines to the stair foot: now a branching net (23 runs, was 43; one
ends at the stair foot, was 12; none pointing at the stair camera, was 4; band ±3.5 m, was ±6); worn-path pixels in
stair-noon-plain 720 → 48; roads as worn tracks (ruts, herb verge, patches); irrigated fallow by 800 m district (8–32 %,
fields.ts with a JS mirror); town roofs lighter (clay-and-straw coat) and lanes darker where roofs close in. plain-stats'
`crops 0, margins 0, nearTrees 0` counts only the near 3-D sets: 6,548 trees in frustum at 2.5–5 km, 19,529 at 5–10 km
(impostors to 20 km); fields keep 1.00/0.94/0.47 of plot contrast at 0.2–0.5/0.5–1/1–2.5 km. Terrain shader 4 → 8 texture
samples, 26 → 27 noise calls; 0 draws added; render 2 budgets 402–425 draws, 5.8–7.5 M tris. Tests hills_d223, plain_d223 and
18 other suites. D-223, Q-520..Q-526, PLAIN.md §12.

## D-225 garments and beards (merged: worktree-agent-aea82b185c065550d, head 2927fd5)
**Broken / unverified first.** No cloth simulation: the pleats and sleeves are baked into the meshes and move with the
skinning (never lag, sway or settle; seated skirts on D-155's slack sag). Only the pattern is B (the reliefs' convention); cut,
sizes, counts C (Q-540). LOD 2 (> ~20 m) keeps only the front stack's bulge and the slanted hem: at court-assembly distances
(29–41 m) the pleats are mostly shading or nothing. One browser run only (humanlab, high, WebGPU, no errors): at 4 m the front
stack, hem folds, slanted sleeves and hem soil read; at 1 m the court beard reads as stacked curled rows, more carved rolls than
hair (roll depth can be reduced). NOT rendered: court-assembly, crowds, motion, WebGL2, the scribes' room. Dyes: only madder
moved (a* 31 b* 29, from a search extract; colorimetry papers blocked, Q-541): population saturation barely changed (Persian p90
0.650 → 0.642, women 0.565 → 0.550); "flat" answered by unevenness within a garment (saturation spread 0.0003 → 0.019 at 0.3 m).
The weave shows only within ~0.5 m (band-limited). The scribes' "bare-chested" look is NOT the palette: at day 21 13:30 the
tunics are green (Elamite) and weld yellow (Babylonian); tunic vs skin ΔE*ab 31/46 daylight, 26/35 room light, 17/28 under the
red bounce alone; tunics 1.7–2.9× the skin's luminance; only the grey undyed trousers match skin luminance; likely the room's
red-dominated underexposed light (Q-544; palette unchanged).
**Changed:** the Persian robe skirt (drape.ts ROBE/robePleat/robeTheta; outfits.ts skirtTube({robe})): 72/24/10 columns at
LOD 0/1/2, a front pleat stack 1.6 cm proud with 4 grooves, diagonal side folds hips to hem (2 cm at the hem), 7 back folds and
a heel kick, hem higher in front, lining on every second ring; sleeves cut on the slant with 6 folds; the court beard 6 rolls
(vertex shader, court style only) with 14 spiral curls per row and 1.2 cm curl rows on cheeks and chin; cloth: band-limited
tabby weave, weft bars, uneven chroma, felt noise 3 → 1.5 mm, chest folds, robe creases, hem soil 0.55 → 0.8 plus a dragged
last 7 %; impostors.ts clothStatsOf sampled inside triangles (the hem band had been overstated 3.4×; impostor worst ΔE 2.10 →
0.96). Measured: hem ring rms beyond the body 6.7 → 12.1 mm (LOD 0), fold crests round the hem 11 → 14; felt-band cloth rms
1119 → 189 µm at 0.3 m; beard 4 row maxima (was 0); hem soil ΔE 6.96 → 10.43; Persian costume 40,380/6,041/3,008/765
triangles (budgets 42,000/7,000/3,200/800); 300-person view 15 draws, +1.9 % triangles. Tests people_drape (7) and 15 suites.
D-225, Q-540..Q-544.

## D-224 sky and exposure (merged: worktree-agent-a31aafc3ed0f91a99, head 27ef078)
**Broken / unverified first.** (1) The Belt of Venus is still lilac, not pink (B44): at −2.9° the arch sits at 11–21° over a
blue-grey Earth's shadow, but its reddest point is R/B 0.48 (was 0.43). Of four approaches only a converged multiple-scattering
table turns it pink-lilac (R/B 0.86 at −2°), and it fails D-116's test against Lee 2015 at −1°/−2° (Δxy 0.023–0.031, limit
0.02): kept as MS_CONVERGED, not adopted (B43, Q-531); it exposed that D-116's coarse table puts 44–57 % too much light into
the dark segment at −2°…−3°. (2) The rendered dawn frames show no arch and no shadow band: the "clear" day's broken deck
(cover 0.05) covers the low W sky, and the arch sits at and above the frame's top. (3) Dawn clouds at −2.9° stay unlit: the deck
at 1.5–3.6 km loses the sun at −1.4°/−2.1°; only cloud above ~8 km would be lit and the weather has none (Q-534); at +2.5° the
undersides render salmon. (4) The W ranges at +2.5° are sunlit but the clear-day air (visibility 43 km) passes 14–28 % of their
light: rendered grey-blue (101, 104, 115); a red first light needs ~100 km visibility (Q-535; haze not tuned). (5) No rendered
overcast frame: node only; snow-terrace's "brown sky" is the Apadana N portico's shaded interior. (6) Under full cover the
ground still gets a quarter-strength sun with sharp shadows (D-115's factors): the overcast horizon is 0.7× the grey ground
where CIE gives ~2× (Q-532, not changed).
**Changed:** overcast: dome, fog colour, air in-scatter and skylight colour blend by cloud cover to the CIE standard overcast
sky (L = Lz(1 + 2 sin e)/3, zenith 3× horizon, same irradiance as the clear sky), colour 6358 K (Lee & Hernández-Andrés 2005,
abstract), bluer at low sun; nothing changes at cover 0. Antisolar twilight: aerosol lidar ratio 50 sr (was ~200), a
stratospheric background layer (τ 0.005 at 20 km; visibility 43 → 45 km; both C, Q-533). The low sun keeps the zenith sun's
luminance (+88 % at 2.5°, +16 % at 5°, +6 % at 10°; the max-channel normalisation threw half away). Frame meter (meter.ts
meterEVFrame): texels ≥ 3 EV above the law's grey are "bright"; when they are the centre-weighted majority (blend 50–65 %), the
correction is 0.6 × (reference − bright log-mean), never closing past the open-air exposure nor 6 EV; D-159 otherwise.
exposureInfo meterBright/meterMean; F3 shows meter EV, bright share, overcast weight; new moment apadana-w-portico-out;
tools/dev/overcast_colour.ts.
**Measured:** full cover horizon b/r 1.06–1.08 (was R > G > B), skylight b/r 1.06–1.08 (clear 1.70–1.79); zenith:horizon 3;
6000–7000 K; irradiance within 1 %. Synthetic: portico sky 5–7× white → exposure 36 → 2.30 (sky 0.32–0.45 of white). Renders
(high): apadana-w-portico-out exposure 1.67 (D-159 alone ≈ 8.2), sky sRGB 133–177, 0 % clipped; apadana-hall-out run 1 (blend
30–60 %) stopped the door blowing out (regression; the doorway is 43 % of the centre-weighted field), run 2 (50–65 %) 108.3,
7.8 % clipped (rubric 7.9 %); dawn-stair-top 4.83 (mean 71.6 vs 71.9); dawn-sunrise ranges b/r 1.13. Tests sky_d224 and 15
sky/exposure/weather/shader suites (115). D-224, Q-530..Q-536, B43, B44.

## D-226 relief carving (merged: worktree-agent-a1edd9eae5ae4c8ce, head 4d7afc5)
**Broken / placeholder first.** Still procedural low relief (C, RELIEF_META.placeholder, NEEDS #10); the edge profile from
memory of photographs (Q-550). No undercut (a heightfield cannot hold one: the near-vertical step, contour occlusion and cast
shadow stand in). The lion-and-bull is still a poor drawing (the lion's head lost under the mane block; musculature only the
incised arcs and doming; Q-552). Detail finer than the 5 mm atlas texel (curls, pleat steps) casts no self-shadow (on a guard at
22° ~25 % of what the exact march shades stays lit; the lion-and-bull 3–4 %). Robes speckle at 10 m in reliefs-raking (pleat
self-shadow at 17° or paint-loss noise, not separated). Naqsh-e Rustam reliefs not covered. Load: atlas 43 MiB (8-bit 8192 ×
5560) GPU and as much JS heap, ~8 s worker + 0.8 s main thread. Render run 1 failed one material at 17 textures (limit 16; the
panel table moved to a uniform array) and showed dark blotches on the bull; run 2 (high, 5 frames, TAG d226b) passed both views.
Full npm test and the soak not re-run on the final tree.
**Cause of "no raking shadows":** the relief figures cast no shadow (D-048); the sun's nearest cascade has cm texels and a 6 cm
normal bias that lifts every wall point above a 4.5–6 cm relief; the node preview marched its own heightfield.
**Changed:** src/arch/relief_shadow.ts + src/render/reliefShadow.ts: all 927 figures and 2,740 rosettes stamped once into an
8-bit height atlas in their walls' frames (texel 5–8 mm; facades sliced), a plan grid of ≤ 4 panels per cell; the sun's colour
marches the atlas toward the sun (24 bilinear samples, 0.4 m reach), starting on the atlas's own surface on the carving (the
LOD meshes lie up to 7 mm under the field: run 1's blotches); one extra texture binding in the opted-in materials; crisper edges
(a near-vertical step holding 0.65–0.75 of the height, less rounding; the lion deeper, narrower waist); paint film even (opacity
0.94–0.97, was 0.64–0.90), losses rare; per-vertex paint = the mean within half its longest edge (the LOD's diamonds).
**Measured:** 15° raking sun, a straight edge: depth 3/4.5/6 cm → band 2.75/4.85/6.90 cm (exact march 3.20/5.20/7.20); shaded
ground: guard 890 vs 1,025 cm² exact, lion-and-bull 3,365 vs 3,435; false self-shadow 0–0.43 % (was 11–44 % before the
start-on-atlas fix); robe edge profile 1/3/12 mm in: 8.8/11.7/20.7 → 19.6/22.6/28.3 mm; reliefs-raking: wall luma 101 → ~49
over 6 px then a 3 px near-black edge (geometry predicts 4–6 px); apadana-e-stair-raking: the bull's belly throws a band, luma
110 → 44–63 over 10 px, blotches gone. Budgets: Apadana walk worst 1.091 → 1.112 M tris, Phase 4 jambs 1.444 → 1.450 M (budget
1.5 M), draws unchanged. D-226, Q-550..Q-552, bench-reports/relief_budget_d226.txt.

## D-227 the town and near plain at a distance (merged: worktree-agent-affb6da328ad32725, head ca8a9af)
**Broken / unverified first.** (1) The town at dusk shows no points of fire and cannot from these cameras (B49): with the sim's
fires and a 0.5 m height raster of every wall, roof and oven top (tests/town_glow.test.ts), day 20 19:00 has 886 lit fires,
420 in the Terrace frame (0.45–1.7 km) and 594 in the Kuh-e Rahmat frame (0.8–2.0 km); flames in line of sight 0 and 0; their
light on their own court walls sums to 0.03 / 0.30 of one fire's candela (a court wall hides 48–170 m of ground at 1–4° below
the horizontal; hearths stand in court corners); method check: from 300 m above q_s1, 47 of 103 flames seen. No glow sprites
drawn (staging). (2) The moments were not re-timed: day 20 19:00 (most fires lit) rendered smoke contrast +2.2 luma (D-220's
18:48: +10.3), τ 0.113 vs 0.343 (the low evening fire smokes less than embers after a meal); both moments stay at day 14 18:48.
(3) Fire light on the smoke layer is built but invisible at dusk (0.15 % of the layer's skylight at −5.7°, 3.9 % at −8.7°).
(4) The approach track does not show in either render (crown 18 % paler; the far terrain LOD may bury the 6 cm ribbon;
unverified). (5) Herb patches barely show (greenness p95 0.951 vs 0.929). (6) The stair-foot budget cut after run 2 (+22
calls, +61 k tris incl. shadow cascades → node 8 calls, 19.3 k tris) is not rendered. (7) Run 1 showed no people on the plain,
run 2 did (1,905 impostors, 225 skinned): not investigated. (8) House lamps not modelled (Q-560). (9) Sim artefact: nearly
every household shares one bedtime, all 866 fires out within a minute at 19:16 (Q-566). (10) Full vitest (maxWorkers 1): 1025
passed, 2 failed, neither in its code: people_days_r5 S12 timeout; writing.test "scribes' room draw calls 17 > 9" (D-221's
furnishing; the lead fixed it by merging the static pieces).
**Changed:** measurement tools tests/lib/townLos.ts, tests/town_glow.test.ts, tools/dev/town_glow_probe.ts; each quarter's smoke
cell lit from below by lit candela × FIRE_ESCAPE_SR (1.0 sr, measured 0.98 over 148 hearths; Q-562) / footprint; the approach
track (8 m, dusty crown) in the roads mesh; src/world/terraceFoot.ts: two tether lines 50–120 m W of the stair foot, 51 slots
filled 35–80 % 07:00–16:30 (closed form), sacks, dung and straw heaps, trodden ground (C, Q-563); herb fans below the W and S
drain mouths and 20–60 m patches over ~40 % of the foot (Q-564); no stone heaps on the W plain (the quarry is E; Q-565);
shader_build D-227 case; plain.spec fauna A/B and people counts. Renders (high): stair-noon-plain ground 40–200 m Ystd/Y 0.088 →
0.104 (run 1) → 0.127 (run 2); stair-dawn-plain 430 draws, 7.55 M tris. D-227, B49, Q-560..Q-566.

## D-228 the Phase 6+7 review's majors M2–M5 (merged: worktree-agent-a9cf83d120dcfc93c, f287c11)
**Unverified first.** M2's new P22 figures are headless counts of every render pass (before the change the count matched the
browser's D-190 figure exactly: +40 calls, 2.560 M); village-p22 not re-rendered; no on-screen check for trees popping in on a
turn (geometric test only). The headless count does not model each cascade's own culling (an upper bound). The Sivand quarry is
not built (no rock slope > 25 % within 100 m; Q-570); F3 had labelled Majdabad with Sivand's tier. New placeholder flag: every
town plot's walls, roofs and street doors show [PLACEHOLDER]. Q-571: the tier rule applied to absent, unplaced rows too (the
five later sites and the Frataraka complex now C, their dating evidence B).
**M2:** the near 3-D tree sets were never culled (every tree within 225 m drawn, behind the camera too: 1,743 trees, 0.735 M;
490 shadow casters into 3 cascades, 0.822 M). Now each tree is tested against the view widened by 8° (main pass: in view;
shadow passes: casters whose shadow can reach the view; within 12 m always kept; re-cull after a 3° turn, 1 m move or 0.5° sun
move): P22 40° lens 2.560 → 1.275 M (135 of 1,743 trees, 89 of 490 casters), 70° 2.571 → 1.414 M; other views 0.88–1.21 M,
12–61 calls. plain.test asserts ≤ 150 calls and ≤ 2 M per frame at five views and two lenses with the sun and shadow passes
(frameTriangles in tests/plainLib.ts); a test that the cull hides nothing visible. Found: the plain switched shadows on for the
Naqsh-e Rustam relief figures (all 4 cascades): now left to the relief system's stand-ins (D-048).
**M3:** tiers to C by "the lower of existence and position" (settlement.json pw_area_b_craft, frataraka_complex,
precinct_plinths; town.json craft_zone; plain.json quarry_majdabad, qadamgah, steppe, woodland, dam_sang_e_dokhtar,
bard_burideh and five absent sites), chronology rows too; quarries.ts names the hit site's own tier; lint_chrono now fails on a
position uncertain by > 200 m not at C, a tier differing from its chronology row, a town element above its feature, a town.json
quarter or facility not C (checked by reverting one).
**M4:** each plot's F3 description placeholder: true (PLOT_PLACEHOLDER, build.ts); test in settlement_build; PROGRESS updated.
**M5:** stale statements corrected against the code in PROGRESS.md, town.json _meta, PLAIN.md (lines 8, 84, 111), plain.json
notes, SETTLEMENT.md (lines 13 and 63: both population figures sourced; the build 1,456 homes, room for 7,968, 7,776 people).
D-228, Q-570, Q-571. Tests: 12 files, 132 tests; tsc; lint:all.

## D-230 the site photographs as yardsticks (merged: worktree-agent-a85cc3b75ef5ca837, 674a9ad, d6d6309)
**Broken / unverified first.** B40 still not met; block tone went DOWN (17 → 13 %): measured on the photos, the rubric's
0.15–0.25 describes weathered stone (#24 W wall 0.43 in 48 px windows = 0.27 between blocks, 0.24 within, 0.24 joints, cracks
and form); the least weathered stone in place (Apadana E stair, #29, buried until the 1930s) 0.13 between 4 relief blocks, 0.07
between 5 merlons, pooled 0.10; set 13 % = 0.10 × 1.2 (phone HDR) ⊕ 0.05 (~50 years of soiling by 467). Renders: stair-climb-pm
Terrace wall 0.066 region / 0.049 windows (D-218 0.072 / 0.053); calib-24 wall 0.081 (CPU mirror predicted 0.079). The lead
decided the yardstick (D-231: near-fresh references). The near-fresh sample is small (±35 %, Q-591). Merlon slot depths C
(±50 %, Q-590); the back-face slot assumed by symmetry. §8.1: the geometry calibrates, the light does not, and this photo
cannot settle it (B55: a Lightroom JPEG with an orange-and-teal grade; thin cloud vs the render's cumulus; a modern gravel lot).
The Now view's columns moved after the calibration render: not rendered (Q-592). tests/surfaces_d218's "×1.8" now runs on
D-218's own 17 % surface, D-230's value checked ≥ ×1.5 beside it.
**1. Stone:** tools/dev/stone_photo_d230.py (hand-picked boxes, overlays): #24 between 0.267 (IQR 0.224), within 0.238, windows
0.431; #33 windows 0.425; #5 weathered skin 0.07, fresh stone under spalls 0.05 (1.045× brighter, warmer); #29 relief blocks
0.127 / 0.116, merlons 0.072; ~75 % of the weathered walls' between-block variance is weathering. materials.ts HAIRLINE.blockSd
0.13 (mean-preserving, no re-bake). Test stone_photo_d230.
**2. Merlons:** #29 shows a double-rebated slot in each face, open at the foot, centred: outer recess 0.26 w × 0.41 h, inner
slot 0.10 × 0.33 (two merlons; the step outline matches ours 1 : 0.74 : 0.50 : 0.27); depth 0.15 of the merlon per rebate (C).
SITE_SPEC apadana.r_merlon_slot (B on the Apadana, C on the other stairs; REF-PHOTO-29, REF-DRAW-32). crenellationGeometry
132 → 204 triangles per merlon (~+28 k). Rendered in stair-climb-pm and reliefs-raking. Test crenellation (rays, budget).
**3. §8.1 calibration (REVIEWS/calib24.md):** sun azimuth 238.84°, altitude 19.32° (IRST assumed, Q-593); the simulated year's
same sun on day 303 at 16.087 LMT; camera grid (−166.6, 108.9), 117.0° true, pitch 7.47°, roll 0.48°, vertical fov 34.4°
(corner residuals rms 8.9 px; the Kuh-e Rahmat skyline fits the DEM to a median 8 px); views calib-24-now and calib-24.
Ratios (photo / Now view / 467): sunlit/shaded wall 3.86 / 8.65 / 6.97 (clear-sky estimate ~8–10 sides with the render);
sky/sunlit wall 3.06 / 0.73 / 0.56; ground/sunlit wall 2.12 / 0.21 / 0.19; mountain/sky 0.42 / 1.04 / 1.39; mountain R/G ÷
stone R/G 0.72 / 1.01 / 1.07. The weathered wall red-brown and dark where the Now view's weathering is neutral and lighter
(Q-594). Fixed: the Now view's W portico columns (the inner row matches to 0.05–0.52°). D-230, B55, Q-590..Q-594.
**Lead's note:** the ground/wall (2.12 vs 0.2) and sky/wall (3.06 vs 0.6) gaps are ~10× and 5×, more than a grade explains;
with sunlit/shade agreeing with a clear-sky estimate, the likely reading is a much darker weathered wall today plus the
grade; kept as Q-594 for a second dated photo.
