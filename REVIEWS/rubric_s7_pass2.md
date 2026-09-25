# §8.2 rubric review, session 7, SECOND PASS

Reviewer: independent vision subagent, 2026-09-25. I have not seen the build. Before scoring I read PERSEPOLIS_BRIEF §1, §1.1,
§3, §7 and §8, `references/INDEX.md`, and lines 1–60 of `REVIEWS/rubric_s6_pass1.md` (for the format only). I did not read
the rest of pass 1, `DECISIONS.md` or `PROGRESS.md`.

I opened every one of these with the image viewer:
- all 37 non-debug `shots/moment-*-webgpu.png`, including both `moment-rain-approach` and `moment-rain-approach-v4`;
- `crowd-court-forecourt-w` and `crowd-court-apadana-n` (these are the only two `crowd-court-*-high` files on disk);
- the 6 `plain-*-high` renders;
- the 3 `humanlab-s6-*` renders;
- the 2 Now-view renders (`moment-now-*`).

I also looked at the two `*-shaftdbg*` renders and `surf-harem-portico-*`. These are debug renders and I did not score them.
For comparison I viewed two references: `references/persepolis from a distance.jpg` and `references/column hall.jpg`.

I read `moments-lum.json`, `crowd-scale.json` and `plain-stats.json`. Every scored image is 960×540 WebGPU on SwiftShader.

**Quality level and currency.** Every scored moment has a `|high|` key in `moments-lum.json`. All the PNGs date from
2026-09-24 18:32 to 2026-09-25 04:06, which is after pass 1 (09-24 02:25–07:56), so every frame here is a new render.
- `plain-stats.json` has three entries with no PNG on disk: `stair-dawn-plain`, `apadana-north-nr` and `stair-foot-east`.
- The two `*-shaftdbg*` entries are `|test|`.

**Comparison basis (exception B6).** I could not reach reference photographs of the site. I compared against three things:
- `references/`: the Getty hall interior, the photoreal golden-hour mood image and the Getty relief screens (from the INDEX).
  None of these is a photograph of the site.
- My own knowledge of real photographs: Persepolis grey limestone in sun, in shade and polished; the Apadana and Tripylon
  reliefs in raking light; the Marvdasht plain in April; the rocky, bedded, scree-covered limestone of Kuh-e Rahmat and
  Naqsh-e Rostam; Fars mud-brick and mud-plaster villages.
- Night, rain and twilight photography in general.

Every statement about how a photograph looks is therefore reviewer knowledge, tier C.

**My measurements.** I converted sRGB to linear Y. Flatness is Ystd/Y, the 1σ spread divided by the mean over a region.
Real sunlit stone or earth at this scale usually measures 0.15–0.35 because of joints, pitting, soiling and grain.

| surface (image) | Y | Ystd/Y | reading |
|---|---|---|---|
| court floor (`court-assembly`) | 0.19 | 0.078 | flat: one colour and a speckle stamp |
| court floor (`crowd-court-forecourt-w`) | 0.18 | 0.048 | flat |
| ground (`hall100-site`) | 0.24 | 0.042 | flat |
| near plain at noon (`plain-stair-noon-plain`) | 0.09 | 0.036 | flat. `plain-stats`: `crops 0, margins 0` in this view |
| merlon face at dawn (`dawn-stair-top`) | 0.043 | 0.058 | flat: no block joints, no weathering |
| rain sky (`rain-approach-v4`) | 0.69 | 0.025 | a uniform white card |
| plain at dawn (`dawn-stair-top`) | 0.018 | 0.68 | dark. The sky/ground ratio (≈9:1) is physically plausible at a sun altitude of −2.9°, but the plain holds nothing to read |
| brazier-lit floor, rows 250→540 px, ≈60 m → 2 m (`brazier-close`) | 0.52, 0.50, 0.56, 0.58, 0.57, 0.54 | – | **no distance falloff from a point fire** |
| torch-lit floor, near → far (`night-terrace`) | 0.17 → 0.04 | – | falloff present |
| Pulvar river surface (`plain-pulvar-bank-april`) | sRGB (15, 5, 1) | – | a black-maroon band, not water |
| `rain-approach` vs `rain-approach-v4` | mean \|Δ\| = 3.2/255 | – | only 6.9 % of pixels change by more than 10/255; **v4 is visually the same frame** |

Clipping (`moments-lum.json`):
- `hall-out` 7.9 %, `brazier-close` 5.0 %, `hadish-hall` 1.4 %; all others are at or below 0.25 %.
- The door blow-outs in `hall-out` and `hadish-hall` are correct camera behaviour.
- The 5 % in `brazier-close` is a sheet of floor, which is not correct.

---

## Verdict: **FAIL**

No category reaches 4. Two categories, light and scale cues, show real progress. Materials, weather and relief carving are
still at the "reads as CG" level.

**Moments: 0 of 8 land and 1 partly lands.**
- **Entering the Apadana from bright sun partly lands.** As a light-and-exposure sequence it is the one convincing
  "scene" in the set.
- **Dusk smoke from the town has no render.**
- **Night with fire, moon and stars** is spread across three frames. Not one of them contains fire, moon and stars
  together, and there is no moon in any render.
- **Rain** has no rain in either version.
- **The scribe's room** has no writing in it.
- **The court in full assembly** is a milling fair.
- **Dawn and the reliefs** do not land.

Six real rendering bugs, listed in the next section, should be fixed before any art work.

## Scores

| category | score | one-line justification |
|---|---|---|
| Light | **2** | The interiors are much improved: `hadish-hall`, `apadana-enter-hall` and `apadana-hall-in` have believable exposure ratios (×1.3 in the court, ×86–306 inside), red-floor colour bleed onto the shafts and door haze. But every fire light is wrong: the brazier has no falloff, the Gate at dusk is lit evenly orange by no visible source, the Apadana at night is floodlit and the torch is a bloom ball with no flame. There is no bounce under the porticos, there is a light leak in the scribe room and the floors are mirror SSR. |
| Materials | **1** | Stone is uniform grey concrete with no joints, pitting, polish or wear. Mud plaster is a flat tan card. Reliefs are clay cut-outs with camouflage-mottled paint. The river renders black-maroon, the garden channel is a black and yellow chequer, and the Naqsh cliff is a vertically stretched curtain. Cloth is felt with no weave or folds. Only the timber ceiling (`hall-in`), the red floor at grazing angles and the near grass (`pulvar`, `village`) come close to real. |
| Scale cues | **3** | The 1:1 geometry now reads. In `hadish-hall`, `apadana-enter-hall` and `hall-axis` the colonnade recession and the one small figure make the size felt. `court-assembly` gives people against 18 m walls, and the stair-climb flights are long. It is held back because surfaces carry no scale information (no course heights, block sizes or texture gradient) and because the plain from the stair is an empty brown sheet: `crops 0` in that view. |
| Detail | **2** | The fluting, bull capitals, timber ceiling and door straps are modelled. But merlons are box stacks, arrises are razor sharp, tori are faceted and relief carving has no depth: the lion–bull triangles are amorphous blobs. Rooms are bare, hills have no rock and villages are tan boxes. |
| People | **2** | `humanlab` faces are now plausible at portrait distance and the silhouettes and walk shadows are good. But robes are stiff cones with no drape, beards are combed blocks rather than curled rows, and colours are flat and saturated. A head sits inside a jar. The scribe has no tablet. The court crowd mills at random instead of standing in ordered files. |
| Weather | **1** | The rain moment has no rain, no curtains or virga, no darkening front and no wet ground, and v4 is the same frame as v1. The snow render has no accumulation anywhere, sparse flakes, two lens-sized diamond sprites and a brown sky. Clear-sky cumulus is acceptable, but that belongs to atmosphere. |
| Atmosphere | **2** | Interior haze and door glow are photographic, the far-range aerial perspective is good, the sunrise cloud undersides are right and the Milky Way still is plausible. But there is no smoke or dust in any frame: no town, no hearths, no work dust at the construction site. The hills are smooth dunes, the dawn clouds are grey puffs and nothing shows inhabitation at landscape scale. |

**Now view** (out of world, scored separately): **2/5**. The Apadana ruin columns are dark, **unfluted** smooth cylinders; the
real survivors are pale, fluted and in places carry capital fragments. The stair façade is a dark streaked slab, the ground is
blank white-grey, and the Gate pylons are clean boxes. It does not match a photograph of the site today.

---

## Rendering bugs (fix before anything else)

| # | bug | images | evidence | fix |
|---|---|---|---|---|
| R1 | **Carried jar swallows the head**, and there is a see-through hole in the torso between arm and body | `crowd-court-forecourt-w` (centre figure) | The jar occupies the whole head volume, and background pixels show through the waist | Drive jar placement from an IK "head-carry" socket with a pad offset, or a shoulder carry. Add an interpenetration test to the carry-prop unit tests. Fix the garment/arm skin weights that open the hole |
| R2 | **Relief animals render as shapeless blobs.** The lion–bull combat looks like a grey cloud, the Tripylon/audience-panel animals like soft white shapes | `apadana-e-stair-raking`, `apadana-enter-court` (the "grey puffs" in front of the stair), `reliefs-raking`, `snow-terrace` | No contour, legs or heads; the edges are noisy, like a low-resolution heightfield or a failed displacement | Check the source height map resolution and the displacement/normal path on WebGPU. Replace with sculpted relief meshes or high-res height maps (≥1 texel/mm at arm's length, §7) |
| R3 | **Water renders black or maroon** | `plain-pulvar-bank-april` (river strip sRGB 15/5/1), `plain-garden-paradise` (channel is a black and yellow chequer) | The water shader or its reflection/refraction target is failing | Check the water material's env/SSR inputs on SwiftShader. Fall back to a sky-reflecting Fresnel water with a shallow-bed colour |
| R4 | **Fire light has no falloff** | `brazier-close` (floor Y ≈ 0.5–0.58 from 2 m out to ≈60 m, 5 % clipped) | The point light's `decay`/`distance` is off or the lighting is baked as ambient | Use physical inverse-square decay with candela from the flame power. Add a unit test: floor Y at 1 m vs 8 m ≥ 30:1 |
| R5 | **The Gate W face glows evenly orange at sun −11°** | `gate-dusk` (whole 18 m wall; sRGB 110/71/39) | The only visible sources are two small jamb lamps and one ground flame | Either the post-sunset sun/ambient is not being cut off, or the wall material has emissive or tint. Check the sky irradiance at −11°: the wall should carry blue twilight fill plus local warm pools |
| R6 | **Rain has no effect**: v4 = v1 | `rain-approach`, `rain-approach-v4` (mean \|Δ\| 3.2/255) | No streaks, curtains, darkened front, wet sheen or puddles. The debug renders `shaftdbg`/`shaftdbg2` show flat pink rectangles where the shafts should be | The rain-shaft volume is not being rendered, or it has the wrong blend and depth. Verify it in a debug view with an unmistakable colour, then give it a density gradient |
| R7 | **Light leak at the wall–floor junction**: a glowing red strip | `scribe-at-work`, `scribe-room-ne` (left wall base) | SSGI or SSR is leaking under the wall, or the wall does not reach the floor | Close the geometry gap, add a thickness bias to SSGI/SSR, and mask SSR at occluders |
| R8 | **Untextured placeholder boxes in the foreground** | `court-assembly` (white cube, bottom left), `crowd-court-forecourt-w` (large white slab, bottom left), `hall100-site` (two dark grey boxes) | The primitives have no material | Give them a real material or remove them. If they are placeholders, flag them in F3 and in PROGRESS |
| R9 | **The Naqsh-e Rostam cliff texture is stretched vertically** | `plain-naqsh-200m` | Stripe smearing on a near-vertical face | Use triplanar or world-space projection on steep terrain, with a dedicated cliff material |
| R10 | **Screen-space reflection smears**: vertical bright streaks under figures and doors, and mirror floors | `hadish-hall`, `apadana-hall-axis`, `scribe-*`, `tachara-lance-bearer*` | SSR is too sharp and too strong on a burnished floor | Increase roughness (0.35–0.5), fade SSR by roughness, and add a clear-coat layer only where polished |
| R11 | **Unidentified thin dark vertical element** floating above the far door/Gate | `apadana-hall-out` (≈x480, y180–230), `apadana-enter-door` | A floating rod | Identify it (spear? flag? stray instance?) and remove it if it is stray |
| R12 | **A black rectangle** fills the right third below the night sky | `brazier-close` | An unlit wall, or missing geometry | Check the geometry and back-face culling |

---

## Prioritised fix list (what reads as CG, why, and how to fix it)

1. **Relief carving.** The Apadana, Tripylon and Tachara reliefs look like clay cut-outs, not carving: flat colour sprites
   with ragged edges on a flat wall, and no raking shadows even at a sun altitude of 32°.
   - Images: `apadana-e-stair-raking`, `reliefs-raking`, `tripylon-n-stair`, `tachara-s-stair`, `tachara-lance-bearer*`,
     `snow-terrace`, `apadana-enter-portico`.
   - Fix: carve the reliefs as geometry, or as displacement plus parallax occlusion, from measured drawings and scans:
     - 2–6 cm relief with crisp, undercut contours;
     - drapery pleats and curled beards;
     - self-shadowing, so raking light draws black lines.
   - Paint as a separate layer: thin, even and edge-bounded, not noise-mottled.
   - Test with a 15° raking sun: shadow width should be proportional to relief depth.
2. **Stone material.** Every ashlar surface reads as poured concrete.
   - Images: all exteriors, especially `stair-climb`, `stair-climb-pm`, `crowd-court-apadana-n`, `dawn-stair-top`,
     `court-assembly`.
   - Fix:
     - block joints at SITE_SPEC course heights;
     - slight arris rounding (3–10 mm);
     - calibrated albedo variation between blocks;
     - fossil pitting and tool marks;
     - foot-polish on tread centres;
     - polished dark-grey stone on doorframes and jambs (the Tachara should be glossy near-black);
     - micro-normal detail.
   - Target Ystd/Y of 0.15–0.25 on sunlit stone.
3. **Fire as a light.**
   - Brazier: inverse-square decay (R4).
   - Torches and sconces need flame geometry and an ember core, a warm pool of about 5–8 m, smoke plumes rising and bending,
     and flicker.
   - No hidden floodlights on the Apadana at night.
   - Images: `brazier-close`, `apadana-hall-torch`, `night-terrace`, `gate-dusk`, `dawn-glow-e` (that flame lights
     nothing).
4. **Weather that you can see.**
   - Rain: visible rain curtains or virga beneath a dark cloud base over the plain, a moving darkening front, and wet stone
     with darkened albedo and puddle specular.
   - Snow: accumulation on horizontal surfaces (merlon tops, relief ledges, floor) with footprints.
   - Images: `rain-approach`, `rain-approach-v4`, `snow-terrace`.
5. **Smoke and dust.** No frame contains any.
   - Add hearth and kiln smoke from the town and villages at dusk and dawn, dust at the construction site, and dust behind
     walkers and carts.
   - Images: `gate-dusk`, `dawn-*`, `hall100-site`, `plain-*`, `court-assembly`.
   - This is also the missing "smoke from the town at dusk" moment. **No render exists for it.**
6. **Garments.** Robes are rigid cones and cloth reads as felt.
   - Images: `humanlab-s6-*`, `court-assembly`, `crowd-court-forecourt-w`.
   - Fix: cloth simulation or baked drape with the Persian court robe's attested pleat pattern (the relief pleats); a weave
     normal; slightly desaturated, uneven natural dyes; soil at the hems.
   - Beards: curled rows as on the reliefs.
7. **The court as an assembly.** At present the crowd is spread at random.
   - Images: `court-assembly`, `crowd-court-forecourt-w`, `crowd-court-apadana-n`.
   - Fix: ordered files of guards (the `crowd-scale` note claims "files of the king's spearmen", but the frame shows none),
     delegations grouped and waiting by the stair, ushers, and a focus of attention.
8. **Mountains and cliffs.** Kuh-e Rahmat and the Naqsh cliff are smooth dunes and smeared curtains.
   - Images: `plain-rahmat-west-pm`, `court-assembly`, `crowd-court-forecourt-w`, `moment-now-*`, `plain-naqsh-200m`.
   - Fix: a rock material with bedding planes, outcrops, scree fans and sparse shrubs, with steep-slope triplanar mapping.
9. **The plain seen from the Terrace.** From the stair it is an empty brown sheet with straight radial beige streaks.
   - Images: `plain-stair-noon-plain`, `dawn-stair-top*`, `dawn-sunrise*`.
   - Fix:
     - Extend the crop, field-margin and tree LOD to the far field (`plain-stats`: `crops 0, margins 0, nearTrees 0`).
     - Use impostors or texture-baked fields out to 5–10 km.
     - Replace the radial streaks, which read as projected texture seams, with real tracks.
     - Add the town's roofs and smoke.
10. **Merlons, and a door for the Gate.**
    - Merlons are untextured box stacks. They need a stone material, joints and slight weathering.
    - The Gate of Xerxes and other walls read as plain tan boxes. Add the plaster texture, a base course, the pilaster
      recesses (INDEX §2) and staining at the base.
    - Images: `crowd-court-apadana-n`, `stair-climb*`, `dawn-*`, `court-assembly`, `gate-dusk`.
11. **Scribe's room.** It does not tell a story.
    - Images: `scribe-at-work`, `scribe-room-ne`.
    - Fix:
      - A tablet in hand and a stylus.
      - Seals, tablet baskets and jars on the bench.
      - A second person (a reader or dictator).
      - A lamp.
      - Dressed rather than stripped to a loincloth, unless that is attested for the role.
      - A floor and walls with wear.
12. **Dawn composition.**
    - The clouds are unlit grey puffs.
    - The western sky lacks the belt of Venus and the earth-shadow band.
    - Merlons in the foreground read as boxes.
    - At +2.5° the western ranges should take the first pink light.
    - Images: `dawn-stair-top`, `-nw`, `dawn-sunrise`, `-nw`.
13. **Bounce light under porticos and eaves.** Shaded soffits and column feet are black-brown with no ground bounce.
    - Images: `harem-portico`, `tachara-s-stair`, `crowd-court-forecourt-w`.
    - Fix: increase the SSGI or probe contribution from sunlit ground (albedo ≈ 0.3), or add a sky-and-ground irradiance
      probe per portico.
14. **Moon.** No render contains the moon, although the moment asks for "fire, moon and stars".
    - Add a moonlit-night rig with the ephemeris moon, moonlit stone and fire in the same frame.
15. **Now view.**
    - Fluted, pale weathered columns, including the reassembled ones with capital fragments.
    - The modern shelter over the Apadana east stair.
    - Gravel and boardwalk ground.
    - Heads missing on the Gate colossi.
    - Images: `moment-now-*`.

---

## Per-moment notes (judged as scenes)

1. **Dawn from the top of the Grand Stairway**: *does not land.*
   - `dawn-stair-top` and `-nw` (sun −2.9°):
     - The far-range haze and sky gradient are good.
     - The foreground merlons are blue-grey boxes.
     - The plain is an unreadable dark sheet (Y 0.018).
     - The clouds are grey puffs with no lit rims.
     - There is no earth-shadow or pink band, no village smoke and no lamp in the town.
   - `dawn-sunrise` and `-nw` (+2.5°) are better: the salmon cloud undersides are right. But the plain is still featureless,
     and the people on it are red and white pins.
   - The feeling of looking over a living plain as the day begins is absent.
2. **Entering the Apadana from bright sun** (`apadana-enter-court` → `apadana-enter` → `apadana-enter-portico` →
   `apadana-enter-door` → `apadana-enter-hall` → `apadana-hall-out`): *partly lands.*
   - The exposure logic carries the whole sequence:
     - The door stays unadapted (×20) in `enter-door`, so the hall is black and the far door burns.
     - After adaptation (×86) the forest of columns emerges from haze with red floor bounce.
     - Looking back out, the court blows white.
   - That is the physiological moment the brief asks for.
   - It fails as a place:
     - The court view has blob artefacts (R2) and a washed-out façade.
     - The jamb reliefs are ghosts.
     - The hall is empty apart from one small figure.
     - Nobody stands in the portico.
     - The capitals disappear into black.
   - Also relevant: `apadana-hall-in` and `apadana-hall-axis`. The sweeper in `hall-axis` is exactly the kind of ordinary
     life §1.1 asks for, and it is the best single idea in the set.
3. **Procession reliefs in raking light, in full colour** (`apadana-e-stair-raking`, `reliefs-raking`, also `snow-terrace`,
   `tripylon-n-stair`): *does not land.*
   - The light is not raking: the sun is at 61° and 32°, with the face lit nearly flat.
   - Even so, the figures cast almost no shadow.
   - The carving has no depth and the lion–bull pair is a blob.
   - The colour is noise-mottled, not painted.
   - The frieze band with lions and the audience-panel layout (the king enthroned, incense stands) show the programme is in
     place. The rendering is what fails.
4. **Smoke rising from the town at dusk as lamps are lit**: *no render.*
   - `gate-dusk` is the only dusk frame. It shows no town, no smoke and no lamps apart from two at the Gate jambs.
   - The stars in a blue sky are good.
5. **Night on the Terrace with only fire, moon and stars**: *does not land.*
   - The elements are spread across three frames, and none contains all three:
     - `night-milkyway` is a plausible astro-still with a dense star field and dust lane, but the sky is warm-brown
       (sRGB 18/18/16) rather than blue-black, and there is no terrace and no fire.
     - `night-terrace`: the portico columns are lit warm from below like modern floodlighting, the source is not visible,
       and there is no sky, no moon and no flame.
     - `brazier-close` is a flat, bright floor with no falloff (R4) and a black void (R12).
     - `apadana-hall-torch`: a bloom ball on the wall, and no sconce, flame or smoke.
   - No moon anywhere.
6. **Rain moving across the plain toward the columns** (`rain-approach`, `rain-approach-v4`, the newer version): *does not
   land.*
   - Both are a white overcast card (Y 0.69, flatness 0.025) over a dry plain and a dry floor.
   - There is no rain, no front, no curtain and no sense of motion.
   - v4 is visually identical to v1 (R6).
7. **A scribe's room, mid-work** (`scribe-at-work`, `scribe-room-ne`): *does not land.*
   - The light is good: a blown door, deep room falloff and a warm floor bounce.
   - But the man squats bare-chested with empty raised hands, holding no tablet or stylus. A rack of tablets and one clay
     lump lie on the floor.
   - The long room is otherwise bare. The mirror floor and the red leak (R7) reinforce CG.
   - It reads as a man alone in a cell, not an archive at work.
8. **The court in full assembly on the Terrace** (`court-assembly`, `crowd-court-forecourt-w`, `crowd-court-apadana-n`):
   *does not land.*
   - Numbers are there: `crowd-scale` counts 2,310 and 11,138 in view.
   - But the arrangement is a fair: people scattered at random, no ranks of guards, no delegations waiting, and no focus.
   - There are placeholder boxes (R8) and a jar-head clip (R1).
   - The flat saturated robes and dune hills complete the CG impression.
   - The walker in the foreground of `court-assembly` has a good silhouette and contact shadow.

---

## Per-image notes

**Dawn**
- `moment-dawn-stair-top-webgpu.png`: covered in the moment notes. Merlon faces measure flatness 0.058. There are faint
  diagonal streaks over the plain on the left (probably a shaft or fog artefact).
- `moment-dawn-stair-top-nw-webgpu.png`: same as above, with more parapet in frame.
- `moment-dawn-glow-e-webgpu.png`:
  - The Gate bulls look like pale plaster casts.
  - The royal-blue band is saturated.
  - The brazier flame lights nothing around it: no warm pool on the floor or the colossi.
  - The guards' scale against the bulls is right.
- `moment-dawn-sunrise-webgpu.png` and `moment-dawn-sunrise-nw-webgpu.png`:
  - The pink cloud bases are good.
  - The plain is dark brown and empty.
  - The western hills take no first light.
  - The stone is concrete.

**The Apadana entry sequence**
- `moment-apadana-enter-court-webgpu.png`:
  - The stair façade is washed pale.
  - Grey blob "puffs" float in front of the stair: these are the relief animals (R2).
  - The panel figures are low-resolution smears.
  - The bottom third is an empty speckled floor.
- `moment-apadana-enter-webgpu.png`: the portico has fluted shafts and lobed bell bases, but it is dim and flat. The far
  door is a small hard white rectangle.
- `moment-apadana-enter-portico-webgpu.png`: the jamb reliefs are faint flat ghosts. The dark hall beyond is correct.
- `moment-apadana-enter-door-webgpu.png`: the unadapted exposure is convincing. There is a thin rod above the far door
  (R11).
- `moment-apadana-enter-hall-webgpu.png`: the best frame of the sequence, with haze, colonnade recession and red-floor bounce.
  The capitals are lost in darkness and the hall is empty.
- `moment-apadana-hall-out-webgpu.png`: the timber leaves have bronze straps and the court blows out correctly. There is a
  floating dark bar above the Gate (R11).
- `moment-apadana-hall-in-webgpu.png`:
  - The most photographic interior: bull capitals, a planked ceiling, red bounce on the shafts, haze.
  - The stone is uniformly clean and unpainted.
  - Some shafts are dark brown and others white, with no visible reason.
- `moment-apadana-hall-axis-webgpu.png`: the sweeper is a good idea. There is an SSR smear under him (R10), and the plinth
  arrises are razor sharp.
- `moment-apadana-hall-torch-webgpu.png`: the light source is a floating bloom ball. There is no flame and no soot. The
  undersides of the capitals are lit, which is consistent.

**Reliefs, stairs and palaces**
- `moment-apadana-e-stair-raking-webgpu.png` and `moment-reliefs-raking-webgpu.png`: covered in the moment notes. The lion
  frieze band is good. The cypresses are green teardrops and the rosette band is a dotted blue line.
- `moment-stair-climb-webgpu.png` (morning):
  - All in shade (treads Y 0.048, wall 0.069), dull grey.
  - The top of the flight ends in a plain grey box, which reads as a placeholder.
- `moment-stair-climb-pm-webgpu.png`:
  - The sunlit wall (Y 0.27) carries stepped merlon shadows, which is good and shows the shadowing works.
  - The treads are shaded by the left parapet, which is consistent.
  - There is no foot wear on the treads.
- `moment-tripylon-n-stair-webgpu.png`: winged disc, sphinxes, palms and guards as flat cut-outs. Black stone door frames
  above. The foreground band is dark and flat, and the whole reads like a diorama.
- `moment-tachara-lance-bearers-webgpu.png` and `moment-tachara-lance-bearer-close-webgpu.png`:
  - The jamb relief is a sprite-like figure with noisy edges on a black panel.
  - The attested polished dark stone has no gloss.
  - The door leaves are flat brown with studs.
  - The red floor is a mirror.
- `moment-tachara-s-stair-webgpu.png`: the fluted columns and animal capitals are good. The eight relief bearers are pale
  cut-outs. The two living guards are well placed, with their backs to the camera.
- `moment-hadish-hall-webgpu.png`: strong depth and exposure logic. The tori are faceted, there is an SSR door streak on the
  floor, and the stone is uniformly white.
- `moment-harem-portico-webgpu.png`:
  - The sun-to-shade ratio (≈15:1) is plausible.
  - There is no bounce on the soffit or the column feet.
  - The mud plaster is flat tan (flatness 0.15 in shade).
  - The ground is featureless.
- `moment-hall100-site-webgpu.png`:
  - This is a construction site with no construction: no scaffolds, ramps, dust, workers at the bases or stone chips.
  - Two untextured boxes (R8).
  - Capitals of mixed heights stand above the wall.

**Dusk and night**
- `moment-gate-dusk-webgpu.png`: covered under R5 and moment 4. There is also a white disc at the base of the ground flame.
- `moment-night-terrace-webgpu.png`, `moment-night-milkyway-webgpu.png`, `moment-brazier-close-webgpu.png`: covered in
  moment 5.

**Rain and snow**
- `moment-rain-approach-webgpu.png` and `moment-rain-approach-v4-webgpu.png`: covered under R6 and moment 6. A few tree
  clumps sit on the horizon, and the fluted columns and bell bases are well modelled.
- `moment-snow-terrace-webgpu.png`:
  - No accumulation.
  - The ground is a pale blue-grey card.
  - The flakes are sparse, plus two large diamond sprites.
  - The sky is murky brown.
  - The relief registers are tiny flat figures.

**Scribe and court**
- `moment-scribe-at-work-webgpu.png` and `moment-scribe-room-ne-webgpu.png`: covered in moment 7.
- `moment-court-assembly-webgpu.png`: covered in moment 8. The hills are dunes with dot bushes, and the far wall has box
  merlons.
- `crowd-court-forecourt-w-high-webgpu.png`:
  - The jar-head clip (R1) and the white slab (R8).
  - The walk shadows are good.
  - The Gate is a plain tan box.
  - No files of spearmen, although the note says there are.
- `crowd-court-apadana-n-high-webgpu.png`:
  - The note says "from the foot of the N façade", but the camera is at parapet or stair level.
  - The merlons are white untextured steps.
  - The plain beyond has green fields and white village blobs, the best far plain in the set.

**People (test quality, `humanlab-s6-*`)**
- `humanlab-s6-face-persian-webgpu.png`:
  - Face proportions and eyes are plausible, and the fluted felt hat reads.
  - The lips are too red.
  - There is a dark smudge on one cheek.
  - The beard is a stiff combed block.
  - There is no skin subsurface scattering.
  - The robe is fuzzy felt with no neckline folds.
- `humanlab-s6-men-full-webgpu.png`: four men in a near-A-pose. The robes are rigid cones with flared sleeves. The Median
  trousers read correctly.
- `humanlab-s6-mixed-full-webgpu.png`: the women's and girl's proportions are good, but the hair is helmet caps and the
  garments are cones. A speckle stamp repeats on the ground.

**Plain**
- `plain-stair-noon-plain-high-webgpu.png`: covered in fix 9.
- `plain-rahmat-west-pm-high-webgpu.png`:
  - The mountain is a smooth grey dune with gully streaks and black dot shrubs, not bedded limestone.
  - The fortification wall is grey and white boxes.
- `plain-village-p22-high-webgpu.png`: the closest to a photograph of the whole set. It has an orchard with real shadows,
  young crop rows and blossom rows with haze. But it has no people, animals or smoke, and the soil texture repeats.
- `plain-naqsh-200m-high-webgpu.png`:
  - The cliff is a stretched curtain (R9).
  - The Ka'ba-ye Zartosht is a white box with no courses.
  - **Two** tomb façades are shown. For 467 BCE (Xerxes alive until 465), check `CHRONOLOGY.md` on whether a second tomb
    existed or was only begun, and log the answer.
- `plain-pulvar-bank-april-high-webgpu.png`: the black-maroon river (R3). The near grass blades are good, the trees are
  plausible, and the grass is a saturated lawn green.
- `plain-garden-paradise-high-webgpu.png`:
  - The cypress allée composition is good.
  - The foliage is a painterly clumped texture.
  - The channel water is a black and yellow chequer (R3).

**Now view** (out of world; scored separately above)
- `moment-now-stair-top-webgpu.png`:
  - The Gate colossi are too intact.
  - The pylons are clean-cut boxes.
  - The ground is a bright blank sheet.
  - The hills are dunes.
  - There is a small modern canopy on the right.
- `moment-now-apadana-webgpu.png`:
  - The columns are dark and unfluted, which is wrong for the surviving shafts.
  - The stair façade is a dark streaked slab in shade.
  - The ground is blank.
