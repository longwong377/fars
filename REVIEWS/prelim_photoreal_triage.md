# Preliminary photoreal triage: session-4 high renders (NOT the §8.2 gate review)

Reviewer: vision subagent, 2026-09-23. Written for the lead's areas: lighting, exposure, sky and atmosphere, the
architecture and ground materials (`src/render/materials.ts`), post-processing (`src/render/pipeline.ts`), and the
framing of the fixed moments. Left out as requested: trees, the plain's close-range ground and water (D-154 is already
on the "camouflage" ground), the sculpting of capitals, colossi and reliefs, and people.

**Inputs:** 11 renders in `shots/` (960×540, quality high, WebGPU on SwiftShader, frozen world), `shots/moments-lum.json`,
`shots/plain-stats.json`, `references/column hall.jpg` (Getty) and `references/persepolis from a distance.jpg`.
Every number marked "measured" is my own reading of the PNGs: display-referred sRGB converted to linear Rec. 709 Y.
**Ystd/Y** is the 1σ linear luminance over a region divided by its mean, used here as a flatness measure.

**Indicative scores (my estimate, not a gate score):** light 2, materials 2, scale cues 2, detail 2, atmosphere 2–3.
People and weather were not judged. As a set, these frames read as CG.

**Already photographic:** the dawn sky (pastel gradient, pink-lit cloud edges, the far ranges fading into the haze); the
sun's aureole in plain-stair-foot-east; the exposure logic of the interiors, where a lit portico shows the hall behind it
as a black void and doorways blow out as a camera would record them.

**Stale renders:** most of these renders predate the last three hours of fixes. Re-render before the formal review. Details are
[at the end](#staleness).

---

## Top 5: what is broken

### 1. Every large surface is a flat, uniform plane with mathematically sharp edges
- **Seen in:** all 11 renders. Measured Ystd/Y values:
  - apadana-enter plaster walls: 0.04 (250×350 px each side); polished jamb: 0.06;
  - north-nr portico floor: 0.032;
  - stair-climb terrace wall: 0.057, rendered after D-147 (micro grain) and D-148 (block tone);
  - stair-dawn-plain parapet top: 0.032.

  The Gate of All Nations reads as a cream box from both the stair foot and the Apadana. Every arris (jambs, plinth
  steps, stair nosings, merlons, wall corners) is a perfect 90° edge with no highlight line.
- **How photographs differ (reviewer's estimate, C):** lime plaster, mud plaster and dressed limestone at 1–5 m scale show
  roughly 8–20 % luminance variation (1σ) in even light. The sources are patching, trowel and float passes, dust, splash at
  the wall foot, run-off under copings and block-to-block stone tone. Every worn arris also catches a thin light or dark line.
- **Cause:**
  - `layer()` mottles with `noiseAmp × (0.6, 0.25, 0.12)` over three octaves. `mx_noise_float` typically swings about
    ±0.3 (my estimate), so this gives only ~1–3 % (1σ) albedo variation (limestone 0.12, plaster 0.08, mud plaster 0.09).
  - Beyond ~5 m only the broad octave (≈4–9 m wavelength) remains. The micro grain (D-147) and the chips fade with distance
    by design.
  - Hairline joints are 0.8 mm wide and 60 % dark. At 70° VFOV and 540 px, a pixel at 10 m is ~2.6 cm, so the joint
    box-filters to a line only 1–2 % darker, which is invisible.
  - `blockTone` ±8 % on a regular 1.05 × 2.2 m grid does not show in shade.
  - There is no weathering driven by position, and the geometry has no bevels.
- **Fix (all C; log in DECISIONS):**
  1. **Broad tone.** Mottling of ~8–12 % (1σ) for plaster and mud plaster and ~6–8 % for stone, in three octaves at about
     0.4, 1.5 and 6 m. Add a faint chroma shift (±0.02) so that patches differ in colour as well as value.
  2. **Weathering masks** in `layer()`/`finish()`:
     - a splash and dust band at wall feet: 0–0.4 m above the local floor, 10–20 % darker and toward the earth albedo, with
       a noisy top edge;
     - run-off streaks under horizontal members (copings, lintels, beam ends), stretched ~10:1 at 5–10 %. This needs a
       "distance below the member's top" attribute from the generator;
     - traffic wear on floors along door-to-door lines: roughness −0.1 to −0.2, albedo −5 %;
     - sheltered versus exposed: darker and dustier under porticoes, from the probe visibility the composite already reads.
  3. **Ashlar.** It reads through its arrises and through each block catching the light differently:
     - vary block length (1.2–3.5 m) and course height per course;
     - raise `blockTone` to ±12–15 % with a slight warm/cool split;
     - tilt each block's normal by ±0.3–0.5°, so blocks separate in raking light;
     - draw each joint with a 3–6 mm worn arris on each side (a dark slot and a light lip). The joint itself stays 0.8 mm,
       so Q-071 is untouched; the arris wear is what the eye sees at 5–30 m.
  4. **Bevels.**
     - 5–15 mm chamfers on stone steps, jambs, plinths and merlons, and 20–40 mm rounded arrises on plastered mud-brick
       corners.
     - A bevelled box has 26 faces. For `box` parts, a shader alternative is a round-corner normal from the object-space
       distance to the box edges.
- **Gain:** materials +1, detail +1, scale cues +0.5 (the block size and the wall-foot band give a readable metre scale).

### 2. No specular environment: polished floors, polished stone and bronze have nothing to reflect
- **Seen in:**
  - **apadana-hall-in, hadish-hall, scribe-at-work:** the red floors reflect neither the doorway nor the columns. This
    reflection is the defining cue of `references/column hall.jpg`, whose floor mirrors every column and the door.
  - **apadana-enter:** the polished dark-limestone jambs (roughness 0.18) read as matte grey. Measured: sRGB 69, Ystd/Y 0.06.
  - **plain-apadana-north-nr:** the bronze incense stands are pure black cut-outs in the sunlit court.
  - **Outdoors:** pavement seen toward the bright horizon has no Fresnel sheen.
- **Cause:**
  - There is no `scene.environment` and no SSR; the pipeline is SSGI + TRAA + bloom. `doors.ts` and `rivers.ts` already
    note the missing environment.
  - `MeshStandardNodeMaterial` therefore gets specular light only from the sun. Metal (metalness 1) has no diffuse term,
    so it renders black.
- **Fix:**
  1. **Sky specular.** When the sun moves more than 0.5° or the weather changes, render the dome (atmosphere, clouds, and
     the D-153 ground colour below the horizon) into a 64–128 px cube and prefilter it with PMREM. Use it for indirect
     specular only; the hemisphere light and the probes keep the diffuse. Two ways to wire it:
     - a `PhysicalLightingModel` subclass whose `indirect()` adds radiance only, or
     - `F_Schlick · env(R, roughness)` added in the composite, from a roughness/metalness MRT target.
  2. **Specular occlusion indoors** from the probe field's sky visibility (the S channel), so the halls do not mirror the sky.
  3. **Screen-space reflections.** three r186 ships `SSRNode` (`three/addons/tsl/display/SSRNode.js`). It takes roughness
     and metalness nodes, uses blur mips, and with `stochastic: false` gives output that suits TRAA.
     - Enable it at high and ultra for roughness below 0.5, with a maximum distance of ~30 m and a thickness of ~0.3 m.
       Fall back to items 1 and 2 where it misses.
     - The red floors then carry the doorway as a long streak and the columns as soft dark reflections, as in the Getty
       reference.
  4. **Rain.** The same environment serves the rain state (§5.3 "darkened wet stone, puddles"). Wet stone cannot read without it.
- **Gain:** materials +1 (floors, jambs, bronze, glazed brick, and later wet stone); light +0.5 (the floor reflection
  shows where the light comes from).

### 3. Red floors and red-floored rooms are oversaturated, because floors are lit by their own colour
- **Seen in:**
  - **apadana-hall-in:** near floor measured at sRGB (67, 6, 5), linear R/G ≈ 34. For comparison, the Getty reference floor
    under its own warm light measures R/G 4.4–5.0, sRGB (56–64, 22–27, 26–29).
  - **scribe-at-work:** walls (26, 3, 0) and ceiling (40, 4, 0). Green and blue are about 0: the room looks lit by a
    darkroom safelight.
  - **hadish-hall:** the floor, at (72, 27, 29), is less extreme.
- **Cause:**
  - **Direction-free probe tint.** The probes store one bounce tint per probe, applied in every direction. `field.ts` and
    `runtime.ts` compute `E = S·mix(1, tint, fb)·E_S(n) + U·tint·E_U(n)`. So the red the floor reflects is also applied to
    light reaching the floor from the white doorway, the walls and the ceiling: red times red.
  - **Albedo.** `plaster_red` is sRGB (0.48, 0.14, 0.10) = linear (0.196, 0.017, 0.010), R/G 11.3.
    - I integrated a hematite-like reflectance with CIE 1931 and D65: ≈4–7 % below ~580 nm, rising to 30–50 % above
      ~620 nm (my estimate, C).
    - Result: linear ≈ (0.25–0.53, 0.034–0.085, 0.036–0.059), R/G 6–7.5, sRGB ≈ (0.54–0.76, 0.20–0.32, 0.21–0.27).
    - The current green and blue are 2–5× too low.
- **Fix:**
  1. Store the bounce per colour channel and re-bake: RGB L1 for U and for the bounce part of S (24 values, +2 atlas bands),
     or at minimum one tint for the upper hemisphere and one for the lower, blended by n.y.
  2. Retune `plaster_red` inside the hematite range above, e.g. sRGB ≈ (0.56, 0.23, 0.20). The pigment stays B; the value is C.
- **Acceptance:** the hall floor at linear R/G 4–7 under the probes; the scribe room's plaster walls pinkish-beige (R/G ≤ 2),
  not red.
- **Gain:** materials +1, light +0.5 (interiors).

### 4. Glare turns every blown opening into a fog bank
- **Seen in:**
  - **hadish-hall:** a blue-white haze ~300 px wide veils the near columns. Measured sRGB (167, 185, 197) left of the door,
    over columns that read Y 0.13 away from it. Most of the frame's mean luma of 83 is this haze.
  - **apadana-hall-in and apadana-enter:** soft blue halos of 40–60 px around the far doors.
  - **scribe-at-work:** the sun patch and the fresh tablets glow.
- **Cause:**
  - `BloomNode` (an UnrealBloom mip chain, radius 0.35) is added on top of the image. Per D-141, its strength is
    0.12/√(X/6) and its threshold 0.9/(X/6).
  - At X = 241 those come to 0.019 and 0.022. But that exposure is ~185× the outdoor one (~7.5 stops), which puts the
    sunlit doorway ~5–6 stops above display white. So even 2 % of it spread over a wide Gaussian stack is as bright as the hall.
  - A real lens's veiling glare has a sharp core and a weak power-law tail. A doorway 5–6 stops over gets a bright fringe
    of a few pixels and a faint veil; it never lowers the contrast of foreground columns.
  - The hadish PNG (17:54) and its stats (exposure 241, mean 83.2) are the ones D-141 reports, so it most likely already
    includes the 1/√ strength law. Re-render to confirm.
- **Fix:**
  1. Clamp the bloom's input at a sensor-like saturation after exposure (e.g. 16–32× display white), so interior
     adaptation cannot feed it 100–400× (hadish ≈ 185×, scribe ≈ 430× the outdoor exposure).
  2. Tighten the kernel: mip weights falling ~4× per level (1, 0.25, 0.06, 0.016, 0.004), radius toward 0.
  3. Make it energy-conserving: `mix(scene, blurred, k)` with k = 0.02–0.04, instead of `add`.
  4. Optionally, a measured lens PSF with a 1/θ³ tail.
- **Acceptance:** in hadish the near columns keep ≥ 90 % of their contrast 150 px from the door.
- **Gain:** light +0.5, atmosphere +0.5 (interiors), materials +0.5 (columns near doors get their surface back).

### 5. The moments are framed as corridors, walls and empty ground, through a 14 mm lens
- **Field of view (all captures).**
  - The captures use the game's 70° vertical FOV: 102° horizontal at 16:9, about a 14–15 mm lens on full frame.
  - Near columns balloon and stretch at the frame edges (hadish, hall-in), and far subjects shrink (doorways, the Gate, the plain).
  - Photographs of the site are mostly taken at 24–50 mm. For the §8.2 rubric, capture each moment at a photographic FOV
    as well: interiors at 24 mm (VFOV ≈ 46° at 16:9), exteriors at 35 mm (VFOV ≈ 32°).
  - Keep the 70° frame for judging §1.1 "as a scene" (first-person presence).
- **apadana-enter.**
  - Two blank wall planes fill 60 % of the frame. The "bright sun" is not in it, and there is no column and no person.
  - Stand in the sunlit court 8–12 m N of the portico's outer row and look S between two portico columns at the doorway.
    The frame should hold sunlit pavement in the lower third, the portico's shadow edge, and a guard by the jamb
    (§1.1 "how small a person is"). Expose by the outdoor law so the hall is a black void.
  - Then capture 3–4 frames stepping in (t = 0, 1, 3 and 8 s; τ = 3 s, D-141), so the adaptation itself is judged.
- **apadana-hall-in.**
  - "The columns close overhead" needs the overhead in frame, but at pitch +6° the frame stops at the capitals.
  - Pitch +18–25° from one bay off the axis. Capitals, beams and the dark ceiling then fill the upper half, and the doorway
    is the only bright thing in the lower third.
- **scribe-at-work.**
  - The scribe is a silhouette against the doorway: the camera sits in the NE corner looking into the light.
  - Put the camera beside the doorway looking NE/E, so the door light falls across the scribe's face, hands and tablet as a
    side key (§1.1 "a scribe pressing a tablet").
  - Pitch −20° to take in the tablet, the drying board and the clay.
- **stair-climb.** Make the new `stair-climb-pm` (afternoon sun on the W-facing flight) the moment. Keep the 08:30 frame as
  a shade test.
- **dawn-sunrise.**
  - The 20:38 re-render at the new −12° position (4df2752) still has no foreground: no merlons, no landing edge, no flight,
    only plain and sky.
  - The camera stands 0.4 m from the landing's W edge (x −40.6). A parapet ~1 m high there would lie ~56° below the eye
    line, under the frame's bottom edge at −47°. D-148 also notes that "there is no parapet on the axis".
  - Stand 1.5–2 m back from a stretch that has merlons, or use the `dawn-sunrise-nw` position with the N upper flight in
    the right third. Keep the horizon near the upper third.
- **Gain:** scale cues +1, light +0.5 (the moment's light story is in the frame). Low effort.

---

## Items 6–15

### 6. Interior bounce ignores the current sun, so a sun patch lights nothing
- **Seen in:** scribe-at-work. At exposure 559, the median sRGB is 7 and the mean 22: a blown sun patch on the floor beside
  a black room. The same applies to every roofed space with sun on its floor.
- **Why it reads as CG:** a 1–2 m² patch of midday sun on a floor is the main light source of a small room. After one
  bounce it lights the walls and ceiling to tens or hundreds of lux, and photographs of such rooms glow warm around the patch.
- **Cause:**
  - The bake's sun term σ is the direct sun on each hit averaged over the year's daylight. The `bake.ts` header says so:
    "the bounce does not follow the sun through the day" (C).
  - Inside probe volumes the SSGI bounce is removed (`(1 − w)` in the composite).
  - So the patch the shadow map draws at this hour never re-emits.
- **Fix:**
  1. **Quick.** Inside volumes, keep the SSGI bounce for pixels lit by the direct sun: write a sun-only term or mask to the
     MRT and compose `albedo · bounce_sun · w`. Subtract the probes' yearly-mean U share where it double counts.
  2. **Proper.** Relight U at runtime:
     - For each probe, keep 64–128 surfel hits from the bake (position, normal, albedo, weight).
     - In a compute pass every few frames, or every 0.25° of sun motion, evaluate the CSM sun visibility at those surfels
       and re-project them to L1. This is Enlighten-style surfel relighting (DDGI-lite).
     - The eye adaptation (probe eye illuminance, D-141) then follows the patch too, which lowers the exposure and the clipping.
     - After item 3 (per-channel L1), the relit bounce keeps its colour per direction.
- **Gain:** light +1 to +1.5 (interiors), scale cues +0.5 (a readable room).

### 7. No shadows beyond 600 m, so at dawn Kuh-e Rahmat cannot shadow the Terrace or the plain
- **Seen in:** dawn-sunrise (both renders) and plain-stair-dawn-plain. It affects every low-sun view.
- **Measured (DEM, `public/generated/terrain_*`):**
  - From the Grand Stair landing (x −40.2, z −122.45, eye 1.6 m above the court), the skyline toward the sunrise azimuths
    (80–90°) stands 11.3–11.9° high. The crest is 2.3–2.5 km E, about 520 m above the court.
  - So at 05:51 on day 0 (sun +2.5°), the whole Terrace, and the plain out to roughly 10 km W, lie in the mountain's shadow.
  - The sun reaches the landing only when it clears ~11.6°. At the sun's climb of ~13°/h, that is roughly 06:30 (my estimate).
- **Cause:**
  - Only the near terrain ring (±2,048 m) casts shadows, and the CSM reaches 600 m with a 200 m light margin. The crest is
    outside both.
  - D-148 describes "the plain with the Terrace's long dawn shadow", which implies the Terrace is sunlit at 05:51. It
    should not be.
  - The orange-lit tree rows and villages near the horizon are probably inside the mountain's shadow as well. Check their range.
- **Fix:**
  1. Bake a terrain horizon map from the DEM: per texel (16–40 m), the skyline elevation in 16–32 azimuths, stored as R8
     slices (a few MB).
  2. The sun is visible where sunAlt > horizon(az), with a smoothstep over ±0.3° for the sun's disc.
  3. Multiply the direct sun by this on the terrain, the plain's objects and the architecture. The CSM stays for detail
     within 600 m.
  4. The same map yields the evening shadows of the W ranges and of Naqsh-e Rustam's cliff, and the true sunrise time on the Terrace.
- **Gain:** light +0.5 to +1 (dawn and dusk), scale cues +0.5 (a shadow edge kilometres out across the plain),
  atmosphere +0.5.

### 8. Aerial perspective: FogExp2 leaves 1–10 km almost unveiled, in a single colour
- **Seen in:**
  - dawn-sunrise and plain-stair-dawn-plain: the plain keeps its foreground contrast until a few pixels under the horizon;
  - plain-apadana-north-nr: hills 1–3 km away show no veil;
  - the Naqsh-e Rustam views.
- **Cause:**
  - `FogExp2` with density `1.2e-5 + 1.2e-4·haze²` (main.ts). At clear-day haze 0.2–0.25 the veil is 3–4 % at 10 km and
    11–14 % at 20 km, which is the air of a >200 km visibility day.
  - The Exp2 law also has the wrong shape. It grows with d², so the near and mid range stay too clear and the veil
    saturates late.
  - There is one colour for all view directions.
- **Physics:**
  - Koschmieder gives σ = 3.912/V. A spring day over Marvdasht with V = 40–60 km veils 48–62 % at 10 km and 28–39 % at 5 km.
  - Successive ridges step paler and bluer, the classic cue in photographs of the plain.
- **Fix:**
  1. Exponential height fog with Beer–Lambert, integrated analytically along the ray: σ(h) = σ₀·exp(−(h − h_plain)/H), with
     H ≈ 1.2 km (aerosol) and σ₀ = 3.912/V.
  2. Take V from the weather: ≈40–70 km on a clear spring day, 5–15 km in dust.
  3. Take the in-scatter from the Bruneton tables already built in `atmosphere.ts` (brighter and warmer toward the sun,
     bluer away) instead of the single horizon colour.
  4. Keep the clouds on the same law (D-064).
- **Gain:** atmosphere +1, scale cues +1 ("how far the plain stretches").

### 9. Exposure: frames dominated by shade come out about 1–1.5 stops dark
- **Seen in:**
  - moment-stair-climb: p50 34, mean 54. The treads measure sRGB 33 (Y 0.015) against the sunlit plain at Y 0.156.
  - plain-stair-foot-east: the wall measures (32, 36, 41), bluish.
- **Cause:**
  - The outdoor law meters the sun and sky, as an 18 % grey under the global illuminance (`exposure.ts`). It never meters the
    frame.
  - A real camera's evaluative meter, and the eye, would open up for a frame that is 80 % shade.
  - D-153, which landed after these renders, raises shaded vertical faces ~1.4× and warms them. Horizontal treads in a
    stair-well gain less.
- **Fix:**
  1. Re-render with D-153 first.
  2. Then add a partial frame-metered correction on top of the illuminance law: ΔEV = clamp(k · log2(L_target / L_frame),
     −1, +1.5), with k 0.5–0.7 and L_frame the centre-weighted log-average of the frame before tone mapping.
  3. Ease it with the existing τ.
- **Acceptance:** stair-climb (am) median 60–80 with the sky unclipped; north-nr (p50 145) barely changes.
- **Gain:** light +0.5.

### 10. Contact shadows and AO: none where things meet the ground, halos where they don't
- **Seen in:**
  - **apadana-hall-in:** the plinths meet the red floor with no darkening at the junction.
  - **plain-apadana-north-nr:** a broad soft smear ~1 m to one side of the column base, and no tight contact line.
  - **apadana-enter:** the wall–floor corner is a hard line, with no AO gradient up the wall.
  - **hadish-hall:** a dark soft halo of ~40 px around the left door leaf, on the wall behind it.
  - **apadana-hall-in:** orange blotches 2–4 m across on dark shafts and walls deep in the hall (e.g. x 250–300, y 190–250;
    Ystd/Y 1.15). They are at probe-grid scale, and not from SSGI, since the screen-space bounce is off inside volumes.
- **Cause:**
  - SSGI runs at radius 12 m with 2 slices × 8 steps and `expFactor` 2, which puts only 1–2 samples inside 0.5 m. Contact
    AO is under-sampled.
  - A constant thickness of 1 m makes thin foreground members such as door leaves occlude the wall behind them (the halo).
  - Sun contact shadows depend on the CSM texel (cm to dm) and the PCF blur.
  - Probe interpolation at 2 m spacing lets one bright probe paint a round blob. D-152's reach test runs along ±x/±z at
    probe height only, and columns between probes are the same case.
- **Fix:**
  1. Sun contact shadows with three r186 `SSSNode` (screen-space shadows; rays of 0.5–1 m or less, thickness 5–10 cm),
     multiplied into the sun term.
  2. A dedicated contact-AO pass, or a second SSGI configuration at 0.5–1.5 m radius with at least 4 samples inside 0.5 m.
  3. SSGI thickness 0.2–0.3 m with `useLinearThickness`.
  4. For the blotches: check with `?post=probe`, then extend the reach/validity test to columns, or move to DDGI-style
     per-probe depth moments.
- **Gain:** light +0.5, scale cues +0.5 (objects sit on the ground), detail +0.25.

### 11. Mountains and cliffs at 0.2–5 km read as smooth dunes and stucco
- **Seen in:**
  - **plain-apadana-north-nr:** hills measured at sRGB (232, 228, 221), Ystd/Y 0.057. They are as bright as the sunlit
    plaster Gate, and textureless.
  - **plain-naqsh-kaba-40m:** the hills to the right read as sand dunes. The cliff shows dark camouflage bands, but this
    render predates D-144.
  - **plain-naqsh-200m-am (after D-144):** the cliff reads as a streaked plaster wall, with no ledges, no overhangs and a
    smooth crest.
- **Cause:**
  - Terrain colour is set per DEM vertex (`groundColour`: rock sRGB (0.52, 0.50, 0.47) on slopes, linear Y ≈ 0.21), on top of
    the `earth` material's noise.
  - At 1–3 km a pixel covers 2.5–8 m, and the near ring's 4 m and mid ring's 16 m DEM is smooth. Nothing between 3 and 50 m
    produces shading.
  - The Naqsh face's relief lacks structure at 1–10 m.
- **Fix:** rock driven by slope and curvature. All values need checking against photographs of Kuh-e Rahmat (C).
  - bedding strata as horizontal albedo and normal bands (2–10 m) on slopes over 30°;
  - vertical joint shading;
  - lighter scree fans below steep faces;
  - dark scrub dots at 3–10 m spacing on moderate slopes (Amygdalus/Pistacia steppe);
  - a procedural detail normal (ridged multifractal, 5–50 m), band-limited by distance;
  - rock albedo nearer 0.15–0.25 linear, with a darker weathering patina on exposed faces.
- **Gain:** atmosphere +0.5, scale cues +0.5 (the mountain is the landmark players steer by, §1.1), materials +0.5.

### 12. Clouds are translucent grey-blue puffs, and the day sky is a dark ultramarine backdrop
- **Seen in:**
  - **Clouds, moment-stair-climb:** sunlit cumulus measures sRGB (101, 121, 146), darker than the horizon sky
    (141, 161, 172) and bluish. In a daylight photograph, sunlit cumulus is the brightest thing after the sun, ~2–4× the
    sunlit ground.
  - **Clouds, naqsh and kaba views:** better (white tops, grey bases), but soft near the horizon.
  - **Sky:** 60–90° from the sun it displays at about half the luminance of sunlit loam or stone, at saturation 0.64–0.73:
    - stair-climb: Y 0.08 against 0.156;
    - naqsh: 0.077 against 0.128;
    - kaba: 0.127 against 0.24.

    In photographs of the site under a clear sky, that part of the sky is usually as bright as the sunlit ground or brighter.
- **Cause, clouds:**
  - single scattering with a ×6 fudge factor;
  - the powder term, which holds thin parts at 0.2 of the sun term, so the blue sky ambient dominates thin cloud;
  - 32 primary steps over up to 22 km (dt up to ~690 m near the horizon), which blurs the shapes;
  - a light march of 4 × 180 m.
- **Cause, sky:** three's Preetham model above +10° (turbidity 2.2 + 6·haze, rayleigh 1.2). Kider et al. 2014 (ACM TOG;
  cited from memory, verify) found that Preetham misplaces sky luminance and colour when compared with captured skies.
- **Fix, clouds:**
  1. Multiple-scattering octaves after Wrenninge and Hillaire: 3 octaves, with extinction × 0.5ⁱ, contribution × 0.5ⁱ and
     phase g × 0.5ⁱ.
  2. Ambient = sky irradiance from above plus the D-153 ground colour from below, with a height gradient, so bases come out
     warm-grey rather than blue.
  3. Step length measured from the cloud entry (~100–150 m, with a capped count) instead of a fixed count over the span.
- **Fix, sky:** use the Bruneton sky-view already built for twilight during the day too, with the aerosol amount from the
  weather (the same air as item 8). Check against measured clear-sky luminance at 1,600 m.
- **Gain:** atmosphere +0.5 to +1.

### 13. Shadows have one softness everywhere (brief §8: "soft shadows with contact hardening")
- **Seen in:** only marginally at 960×540. The Ka'ba's cast shadow edge is uniformly hard, and the shadow band at the stair
  foot uniformly soft. It will show at 1440p and in close-ups.
- **Cause:** `PCFSoftShadowMap` uses a fixed kernel. The sun's 0.53° disc gives a penumbra of ~0.93 cm per metre of
  occluder distance:
  - ~1 mm at a step nosing;
  - ~11 cm from the 12 m terrace wall on the plain;
  - ~19 cm from a 20 m Apadana column on the court.
- **Fix:** PCSS in cascades 0–1: a 16-tap blocker search, then a 16–32-tap Poisson PCF sized by the sun's angular radius ×
  the receiver–blocker distance. Keep plain PCF beyond, in a custom TSL shadow filter.
- **Gain:** light +0.5.

### 14. Calibration: the stone's value and the tone curve are unmeasured, and they set the whole look
- **Seen in:** all renders; this is the "grey clay" look of north-nr, the stair and the halls.
- **Cause:**
  - `limestone` and `limestone_carved` have albedo sRGB 0.44, which is linear Y 0.155 (≈ N4.5). This is C, pending NEEDS #13.
  - The AgX base look (three's `AgXToneMapping`) has gentle mid-tone contrast; camera JPEG curves are steeper.
  - Neither has been checked against a photograph (rule 4).
- **Fix:**
  1. Unblock NEEDS #13: a dated, credited photograph. The §8.1 calibration scene is the right instrument.
  2. Meanwhile, bracket renders of stair-climb-pm and north-nr:
     - stone Y at 0.155, 0.22 and 0.30;
     - AgX base, against a "punchy" look (Blender's: power 1.35, saturation 1.4), against Khronos PBR Neutral.
  3. When the photograph arrives, keep whichever bracket matches its ratios of sunlit stone to shade to sky. Judge by
     measurement, not by eye.
- **Gain:** materials +0.5 to +1, light +0.5.

### 15. Interior air: no light in the air where the sun enters (§8 "volumetric light and haze")
- **Seen in:**
  - scribe-at-work: the sun through the doorway makes a floor patch but no shaft;
  - hadish-hall and the Apadana: the glare haze stands in for it.
- **Cause:** there is no participating medium indoors. The fog is outdoor aerial perspective only.
- **Fix:**
  1. Use three r186 `GodraysNode` (a screen-space ray march against the sun's shadow map) inside the volumes.
  2. Dust σ_s ≈ 1–5·10⁻⁴ m⁻¹ in halls; more in workshops and near hearths (§5.4 smoke).
  3. Only where direct sun enters.
  4. With item 4 fixed, this puts a physically placed shaft where the haze is now.
- **Gain:** atmosphere +0.5 (interiors), light +0.25.

---

## Per-render notes

**moment-apadana-enter** (17:51; exposure 28.4, sun 71.9°). §1.1 "entering the Apadana hall from bright sun".
- Photographic: the exposure logic. The hall behind the doorway is a black void relative to the lit portico, as a camera
  metering the portico would record it, and the far doorway is blown.
- CG:
  - The plaster walls fill 60 % of the frame at Ystd/Y 0.04.
  - The jambs are matte where they should be polished dark stone mirroring the court.
  - The floor is uniform, and the wall–floor junction is a hard line with no AO.
  - The arrises are razor-sharp.
  - The far doorway is blue-white with a soft halo.
- Moment: **does not land.** There is no sun, no portico column and no person; nothing says "from bright sun" (items 5, 1, 2, 4).

**moment-apadana-hall-in** (18:05; exposure 295, mean 30.9, p50 26.4). §1.1 "the columns close overhead and the light drops".
- Photographic: the dim key with one blown opening, the recession of the column rows, and a plausible interior histogram.
- CG:
  - The floor is carpet-red (67, 6, 5) with no sheen or reflection.
  - The columns are uniform grey clay, with no drum joints. Every standing column at the site shows its drum joints; their
    positions here would be C.
  - The plinth arrises are razor-sharp, with no contact shadow.
  - Orange probe blotches appear in the dark back of the hall, and the doorway has a halo.
- Moment: **half lands.** The light drops, but the columns do not close overhead because the overhead is not in frame
  (items 2, 3, 5, 10).

**moment-hadish-hall** (17:54; exposure 241, mean 83.2, 0.54 % clipped).
- Photographic: the blown doorway as the only source, the tonal falloff of the columns away from it, and the studded timber doors.
- CG:
  - The glare fog.
  - An AO halo around the left door leaf.
  - Uniform khaki walls.
  - Column bases without contact shadows, so they float.
  - Columns turned blue-grey inside the haze.
- The haze dominates the frame (items 4, 10, 1, 2).

**moment-scribe-at-work** (19:08; exposure 559, mean 22, p50 7.2). The red strip at the wall foot is ignored, as already
fixed (D-152). §1.1 "a scribe's room, mid-work".
- Photographic: at this exposure a camera would blow the doorway and the sun patch too, and the warm light rakes the right
  wall convincingly.
- CG:
  - The room's ambient is pure red (G and B ≈ 0).
  - The sun patch lights nothing.
  - The sunlit tablets and cloth glow white with bloom.
  - The scribe is a flat silhouette.
- Moment: **does not land.** The tablet, stylus and clay are invisible (items 3, 6, 5, 4).

**moment-stair-climb** (19:55; exposure 1.62, sun 41.9°, mean 54, p50 34). §1.1 "the long climb of the stairway".
- Photographic:
  - the sky's gradient from deep zenith to pale horizon;
  - the value of the shaded stair against the bright sky;
  - the silhouette of the stepped merlons;
  - the sunlit plain at the left.
- CG:
  - The flight and the terrace wall are flat dark planes. The wall measures Ystd/Y 0.057 even with D-147 and D-148.
  - The step nosings are razor-sharp.
  - The Gate at the top is a flat light box.
  - The clouds are translucent grey-blue.
  - The frame is 1–1.5 stops dark.
- Moment: **partly lands.** The length of the flight reads; the afternoon slot will tell the climb better
  (items 1, 9, 12, 5).

**moment-dawn-sunrise** (19:50, and again at 20:38 after 4df2752; exposure 6, sun +2.5°). §1.1 "dawn from the top of the
Grand Stairway".
- Photographic: the pastel sky, the pink-lit cloud edges, the pale horizon and the far ranges fading. These are the most
  photograph-like elements in the set.
- CG and fidelity:
  - There is no foreground in either version.
  - The light has no direction on the ground.
  - The lighting is physically wrong for the time: the Terrace and the near plain should be in Kuh-e Rahmat's shadow.
  - The 20:38 frame has a grid of white ovals at its foot.
  - The plain's pattern belongs to the ground owners, and D-154 is on it.
- Moment: **does not land yet** (items 5, 7, 8).

**plain-stair-foot-east** (19:03).
- Photographic: the sun's aureole at the top right, the sky gradient, and the value of the backlit wall against the sky.
- CG:
  - The stair façade is a flat dark plane, with no masonry and no bounce gradient rising from the ground. D-153 addresses the
    bounce; re-measure.
  - A bright seam line crosses it.
  - The Gate is a flat box.
  - The shade is bluish, measured at (32, 36, 41).
- Scale: nothing of known size stands at the foot of the wall. A person or a pack animal would carry §1.1 "how small a
  person is" (items 1, 9, 5).

**plain-apadana-north-nr** (19:01; p50 145).
- Photographic: the column's bell base, and the value step between the portico shade and the sunlit court.
- CG:
  - The floor measures Ystd/Y 0.032, with a broad AO smear by the base.
  - The bronze stands are pure black.
  - The Gate is a cream box.
  - The merlons are flat white cut-outs.
  - The hills are cream dunes.
- The whole frame reads as a clay render (items 1, 2, 10, 11).

**plain-stair-dawn-plain** (18:59).
- Photographic: the sky and horizon, as in the dawn moment.
- CG: the parapet top in the foreground is a flat slate-blue plane, measured Ystd/Y 0.032 (items 1, 7, 8).

**plain-naqsh-200m-am** (18:33, the first render after D-144).
- Photographic: the sky with its cumulus (a "polariser" look), and the cliff's scale against it.
- CG:
  - The cliff is a smooth streaked wall with a smooth crest.
  - The Ka'ba is a white box.
  - The hills beyond have no haze (items 11, 8, 12).

**plain-naqsh-kaba-40m** (18:14, before D-144).
- Photographic: the Ka'ba's hard cast shadow and its direction, and the grey bases of the clouds.
- CG:
  - The Ka'ba is a clean white box: no courses, no blind-window panels in dark stone. The geometry belongs to architecture.
  - The cliff shows blotched bands, which predate D-144.
  - The hills read as dunes (items 11, 1).

---

## Measurements (my readings of the PNGs)

| render | region (px) | sRGB mean | Y (display-linear) | Ystd/Y | note |
|---|---|---|---|---|---|
| apadana-enter | left wall 20–270 × 30–380 | 142 139 116 | 0.255 | 0.044 | uniform plaster |
| apadana-enter | jamb 300–330 × 50–380 | 69 70 69 | 0.061 | 0.061 | polished frame reads matte |
| apadana-enter | halo above far door | 23 44 57 | 0.030 | 1.10 | blue bloom |
| apadana-hall-in | floor near 300–660 × 420–540 | 67 6 5 | 0.014 | 0.16 | linear R/G ≈ 34 |
| Getty `column hall.jpg` | floor near | 56 22 26 | — | 0.15 | linear R/G ≈ 5.0 |
| apadana-hall-in | blotch 250–300 × 190–250 | 16 9 8 | 0.004 | 1.15 | probe-scale smudge |
| hadish-hall | haze left of door | 167 185 197 | 0.48 | 0.29 | glare over columns |
| hadish-hall | near column shafts | 94–99 100–105 105–109 | 0.13–0.14 | 0.15–0.20 | blue-grey in haze |
| scribe-at-work | left wall / ceiling | 26 3 0 / 40 4 0 | 0.003 / 0.006 | — | pure red |
| stair-climb | treads (shade) | 33 32 30 | 0.015 | 0.46 | dark |
| stair-climb | terrace wall (shade) | 35 34 31 | 0.016 | 0.057 | flat |
| stair-climb | sunlit plain | 123 108 82 | 0.156 | 0.030 | |
| stair-climb | sky upper left | 35 84 130 | 0.082 | 0.039 | sat 0.73 |
| stair-climb | sunlit cloud | 101 121 146 | 0.190 | 0.28 | darker than horizon sky |
| stair-foot-east | wall (shade) | 32 36 41 | 0.018 | 0.36 | bluish |
| north-nr | portico floor | 111 110 106 | 0.157 | 0.032 | flat |
| north-nr | hills (right) | 232 228 221 | 0.78 | 0.057 | cream, textureless |
| stair-dawn-plain | parapet top | 56 63 70 | 0.049 | 0.032 | flat |
| kaba-40m | sunlit face / sky | 134 127 115 / 58 103 146 | 0.24 / 0.127 | — | sky ≈ 0.5 × stone |

Luminance targets for §8.3 are not re-derived here. Clipping is small everywhere: hadish 0.54 %, scribe 0.14 %.

---

## Housekeeping (outside the 15; mostly other owners)
- **Crosshair dot.** `src/ui/shell.css .crosshair` (3 px, 35 % white) appears in every capture at (480, 270). Hide it in
  `?test` captures. Under §1.1 and §6 ("no in-world HUD") it is questionable in play too.
- **Seam on the stair façade (plain-stair-foot-east).** A thin bright diagonal line runs where the flight's parapet meets
  the wall; sky shows through a mesh gap. Owner: architecture.
- **White ovals (dawn-sunrise, 20:38).** A grid of white ovals at the bottom, perhaps a flock or a placeholder, reads as CG.
  Owner: animals.
- **Stone pile (plain-stair-foot-east).** A pile of smooth ovoid stones. Owner: plain.

## Staleness
Render times compared with the fixes:
- **Before D-146** (shadow bias, 18:49), D-147 (micro grain, 19:13), D-148 (block tone, 19:25), D-152 (probe reach,
  20:20) and D-153 (ground bounce, 20:23): apadana-enter, hadish-hall, apadana-hall-in, naqsh-kaba-40m and naqsh-200m-am.
  naqsh-kaba-40m also predates D-144.
- **Before D-147, D-148, D-152 and D-153:** north-nr, stair-dawn-plain and stair-foot-east.
- **Before D-152 and D-153:** scribe-at-work (19:08; D-146 in, D-147 not) and stair-climb (19:55).
- **dawn-sunrise:** re-rendered at 20:38 with 4df2752 and D-153. Its stats in `moments-lum.json` were updated the same minute.

Items 1 (in part), 9 and 10 (in part) should be re-measured on fresh renders before they are acted on. The others do not
depend on these fixes.
