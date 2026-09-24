# §8.2 rubric review, session 6, FIRST PASS (render pass still running)

Reviewer: independent vision subagent, 2026-09-24. I have not seen the build. I read PERSEPOLIS_BRIEF §1.1, §3, §7 and §8 and
`references/INDEX.md`, then looked at every `shots/moment-*-webgpu.png` (20), `shots/crowd-*-high-webgpu.png` (4) and
`shots/surf-*.png` (6, A/B debug renders; used only to understand terms and not scored). I also read `shots/moments-lum.json`,
`shots/crowd-scale.json` and `shots/surf-stats.json`. All images are 960×540 WebGPU on SwiftShader.

**Quality level.** Every moment scored here has a `|high|` key in `moments-lum.json`, and its PNG timestamp (2026-09-24
02:25–07:56) falls inside the current pass. That includes `apadana-hall-in`, `apadana-hall-axis` and `hadish-hall`: their
`|test|` keys are stale entries from an earlier run, and the PNGs on disk are the Q=high renders from 06:09–06:25. The four
crowd shots are Q=high as well (`crowd-scale.json`).

**Comparison basis (exception B6).** I could not reach reference photographs of the site. I compared against:
- `references/`: the Getty "Persepolis Reimagined" screens (`column hall.jpg`, `more interior.png`, `bulls.png`), the
  persepolis3D renders, the Golvin watercolour, and the one photoreal mood image (`persepolis from a distance.jpg`). None
  of these is a photograph of the site;
- my own knowledge of real photographs: Persepolis limestone in sun and in shade, the Apadana and Tripylon reliefs in
  raking light, the Marvdasht plain in late spring, Kuh-e Rahmat, and comparable dressed limestone and mud-plaster
  buildings.

Every judgement about "how a photograph looks" in this review is therefore reviewer knowledge, tier C.

**My measurements** (sRGB converted to linear Y; Ystd/Y = 1σ ÷ mean over the region, used as a flatness index):

| surface | Ystd/Y | reading |
|---|---|---|
| court floor, court-assembly | 0.071 | flat; the variation comes only from a speckle stamp |
| ground, hall100-site | 0.051 | flat |
| Tripylon stone in shade | 0.063 | flat |
| harem roof soffit | 0.044 | flat |
| plain at dawn, from the stair top | 0.069 | flat |

In `moment-tachara-lance-bearer-close`, 57 % of pixels have linear Y < 0.001, even at an exposure of ×1333.

---

## Verdict: **FAIL**

Every scored category is below 4. As a set, these frames read as a real-time game engine in an early art pass, not as
photographs. Of the eight §1.1 moments:
- four have no render yet: dusk smoke, night, rain, and (so far as a scene) the procession reliefs in raking light, since
  none of the relief renders is in raking light;
- four have renders, and none of them lands.

The strongest frames are `moment-apadana-hall-in` and `moment-scribe-room-ne`. In both, the exposure logic and the light
falling from the doorways give a real sense of mood.

## Scores

| category | score | one-line justification |
|---|---|---|
| Light | **2** | The sun direction, soft sun shadows and interior exposure logic are right: doorways blow out and the hall reads dark. But exteriors have no visible ambient occlusion or sun bounce (the harem soffit, column feet and merlons are flat), shade is a cold charcoal-blue, several frames have light leaks and black holes, and the polished floors behave as mirrors. |
| Materials | **1** | Plaster and mud-brick are one large olive-green mottle; ashlar is plain grey with invisible joints; the ground is one beige plane with a repeating dark-speckle stamp; the red floors are liquid mirrors; reliefs are flat colour decals; the roof soffit is a flat brown slab. Every surface reads as CG. |
| Scale cues | **2** | The 1:1 geometry helps: people beside the 100-Column bases and the dwarfing hypostyle rows read correctly. Surfaces carry no scale information, though: no course heights, block sizes, tool marks or texture gradient with distance. The plain has no fields, tracks or trees, so its depth cannot be read. |
| Detail | **2** | Column fluting and bull capitals are modelled. But every arris is a perfect 90° edge, merlons are stacks of boxes, column tori and bells show polygon facets, relief carving has no depth, rooms are bare, and hills have no rock. |
| People | **2** | Crowd numbers, pose variety and grounded contact shadows are present (court-assembly; crowd-court-forecourt-w). Faces are mannequins; costumes are saturated flat primaries with no weave, folds, fading or soil; a head is lost inside a carried jar; distant people are white pins. |
| Weather | **not assessable** | No render shows rain, dust, wind or overcast. Clear and partly cloudy skies only; the clouds are noted under atmosphere. |
| Atmosphere | **2** | The daytime sky and the haze on the far ranges at dawn are close to photographic, and the hall-in haze is good. But the dawn clouds are grey smoke puffs, there is no dust or smoke in the air over the plain or the town, the hills are smooth sand dunes, and the plain is an empty lawn. Nothing yet feels inhabited at landscape scale. |

---

## Rendering bugs (fix before anything else)

1. **Black stair-stepped block over the brazier flame** (`moment-dawn-glow-e`). A block of about 150×130 px, 21 %
   near-black, with jagged horizontal steps, sits directly above and around the flame.
   - It looks like a transparent heat-haze or smoke quad that samples an unwritten or invalid colour or depth buffer, or
     that writes black with depth-write on.
   - The same scene in `surf-dawn-glow-e-B` (brazier further away) does not show it, so it depends on distance or screen
     size.
   - `surf-dawn-glow-e-post-sss` is white speckle noise over the whole frame and `…-post-ssr` is almost fully black. If
     those buffers are fed back into the composite, suspect them.
2. **Relief figure in the Tachara doorway renders black** (`moment-tachara-lance-bearer-close`).
   - 57 % of pixels have Y < 0.001, even at an exposure of ×1333. The lance-bearer shows only as thin red and orange edge
     lines on black.
   - Either the jamb reveal receives zero indirect light (a probe or GI hole inside door reveals) or the relief material
     returns black (its albedo or normal is invalid).
   - A 1–2 px bright white seam runs down the full height of the right jamb edge: a light leak through the jamb–wall
     joint.
3. **Camera inside or against a column** (`moment-tachara-lance-bearers`). About 70 % of the frame is column fluting at
   point-blank range, and the relief the shot is named for is not in view. The rig pose needs a clearance check against
   geometry.
4. **Light leaks at wall edges in the scribe's room.**
   - `moment-scribe-at-work`: a ragged, dithered white fringe up the right wall's vertical arris (top right, peak RGB
     225/200/180) and blue-white specks in the bottom-right corner.
   - `moment-scribe-room-ne`: a thin red-lit line along the left wall–floor junction.
   - Likely causes are shadow-map bias or cascade seams at thin walls, or SSR sampling off-screen.
5. **Pure-black foreground objects** (`moment-apadana-enter`). The two stands in the bottom corners render as flat black
   cut-outs with no indirect light at all.
6. **Floor fireflies.**
   - `moment-hadish-hall`: scattered saturated red dots around the column bases, on both sides. `surf-hadish-hall-env0`
     and `-B` do not show them.
   - `moment-apadana-hall-axis`: isolated white sparkles on the floor mid-frame.
   - Suspect SSR or SSS noise that is not denoised or clamped.
7. **Head swallowed by a carried jar** (`crowd-court-forecourt-w`, centre). The jar sits where the head is, so the prop
   attachment offset is wrong: the jar should rest on a head pad above the skull.
8. **Unlit black blobs on the hills.** In `moment-dawn-stair-top-nw` and `crowd-court-apadana-n` (right-hand hill), small
   pure-black dots stay black whatever the light. They are likely animal or bird sprites, or shrub impostors, with no
   lighting. `moment-hall100-site` also has one black dot in the sky.
9. **Pale comb of vertical streaks on the horizon** (`moment-dawn-sunrise` right side, RGB ≈ 79/86/95 against land at
   44/47/40; also `moment-dawn-stair-top`). At dawn these impostors (poplars or settlement) are twice as bright as the land
   around them, which suggests their lighting ignores the sun's altitude or their normals are wrong.

---

## Prioritised fix list

Ordered by the number of §1.1 moments touched × how strongly the fault reads as CG. Rendered moment groups:
- **Dawn**: dawn-stair-top, dawn-stair-top-nw, dawn-sunrise, dawn-sunrise-nw;
- **Entry**: apadana-enter, apadana-enter-portico, apadana-hall-in, apadana-hall-axis;
- **Reliefs**: tachara-s-stair, tachara-lance-bearers, tachara-lance-bearer-close, tripylon-n-stair;
- **Scribe**: scribe-at-work, scribe-room-ne;
- **Court**: court-assembly plus the four crowd shots.

The supporting scenes are hadish-hall, harem-portico, hall100-site, stair-climb-pm and dawn-glow-e.

### 1. Wall and stone surfaces are procedural mottle, with no construction, wear or dirt
- **Renders:** nearly all of them; worst in court-assembly, crowd-forecourt-morning, crowd-court-*, dawn-glow-e,
  harem-portico, hall100-site, stair-climb-pm, tripylon-n-stair and apadana-enter-portico.
- **Moments:** 5 of 5 rendered.
- **What is wrong:**
  - Plaster and mud-brick walls are one low-frequency noise blotch 2–5 m across with an **olive-green cast**: gate wall
    RGB ≈ 86/84/68, harem wall 52/48/35, Apadana wall 64/66/54. Lime or mud plaster in sun is warm buff to cream, and in
    shade neutral to slightly warm.
  - There are no trowel or float marks, no hairline cracks, no patching, no darker splash band at the wall foot, and no
    run-off under copings.
  - Dressed limestone is an even grey with block joints only faintly visible (Tripylon Ystd/Y 0.063). It has no bedding,
    no tool dressing, no chipped arrises, no tone difference between blocks and no lichen-free weathering, and at 10–30 m
    the ashlar looks like painted concrete.
  - The gate and court walls carry the same dark-speckle stamp as the ground, which looks like terrazzo.
- **Fix:**
  - Build photo-sourced material sets for limestone, lime plaster and mud plaster (CC0 scans from ambientCG or Poly Haven,
    recorded in ASSET_LEDGER), with albedo, normal and roughness at two scales plus a macro variation map.
  - Correct the plaster albedo hue away from green; check it against the §8.1 calibration numbers.
  - Add weathering masks driven by world position: wall-foot splash, under-coping streaks, dust on ledges.
  - Vary ashlar block tone by ±10–15 %, and make joints at least 2–3 px wide at 10 m through normal and AO rather than
    albedo.

### 2. No ambient occlusion or bounce light in exteriors; shade is cold charcoal
- **Renders:** harem-portico (soffit, capital–beam junction, column feet), tachara-s-stair, tripylon-n-stair,
  stair-climb-pm, hall100-site (block feet), court-assembly (wall–ground junctions), dawn-stair-top-nw/sunrise-nw
  (merlons), apadana-enter.
- **Moments:** 5.
- **What is wrong:**
  - Corners, the undersides of the portico roof and the feet of columns and blocks show no darkening, so objects float.
  - Sunlit ground should throw warm fill into the portico soffit and capitals; the soffit is a uniform brown (Ystd/Y
    0.044).
  - North-facing and shaded limestone (Tripylon stair) renders near-black blue-grey (RGB ≈ 39/39/40). In photographs,
    pale limestone in open shade is lit by a bright sky and ground and sits roughly 2–3 stops below sunlit stone, still
    reading light grey.
- **Fix:**
  - Stronger GTAO with a larger radius, plus baked or voxel AO for the static architecture.
  - A one-bounce ground-to-soffit term: irradiance probes on a finer grid near porticoes, or sun-bounce from a
    ground-albedo proxy.
  - Check the sky irradiance level against the calibration photo so that shade/sun ≈ 0.15–0.3.

### 3. People read as game NPCs
- **Renders:** court-assembly, crowd-court-forecourt-w, crowd-court-apadana-n, crowd-hall-site-working-morning,
  apadana-hall-axis, scribe-at-work, scribe-room-ne, dawn-sunrise, tachara-s-stair.
- **Moments:** 4 (court, scribe, entry, dawn).
- **What is wrong:**
  - Faces are smooth, untextured mannequins; beards are solid black blocks; skin has no subsurface or pore variation.
  - Costumes are fully saturated primaries (pure red, yellow, royal blue) in flat colour, with no weave normal, no sheen,
    no folds that follow the pose, no fading, no soiled hems and no sweat or dust.
  - Skirts behave as rigid cones.
  - In the court, many figures share one silhouette and one colour, so the crowd reads as clones.
  - Distant people become white pins on the plain.
- **Fix:**
  - Natural-dye palette: madder reds, weld yellows, woad blues, desaturated and value-varied, with fading on the
    sun-facing folds.
  - Cloth materials with a weave detail normal, a sheen lobe and a wrinkle normal driven by the pose.
  - Face albedo and normal maps with SSS, and hair and beard cards instead of solid shapes.
  - Per-person variation in wear, soiling and fit.
  - Impostor albedo taken from the real costume colours at matching exposure.

### 4. Hard CG geometry: perfect arrises, visible polygon facets, box merlons, bare soffits
- **Renders:**
  - facets: hadish-hall, apadana-hall-axis, apadana-hall-in (right-hand foreground shaft);
  - box merlons: dawn-stair-top-nw, dawn-sunrise-nw, crowd-court-apadana-n, stair-climb-pm;
  - flat soffit: harem-portico;
  - untextured blocks: hall100-site foreground.
- **Moments:** 4 (dawn, entry, court, plus the reliefs through the stair blocks).
- **What is wrong:**
  - Every edge is a mathematically sharp 90°, with no bevel highlight line.
  - Column tori and bell bases show 16–24-sided faceting in silhouette and in shading bands.
  - Stepped merlons are unweathered stacks of boxes.
  - The harem roof is a single slab with no beams, joists or matting.
- **Fix:**
  - Bevel or chamfer all arrises by 1–3 cm, in the generator or with a rounded-edge shader.
  - At least 64 radial segments (near LOD) for turned profiles, with smooth normals.
  - Model the attested beam ends, joists and ceiling matting in the porticoes (the timber roofs of §7).
  - Give merlons chipped edges and joint lines.

### 5. The moments are framed so that they cannot land (camera rig)
- **Renders:** dawn-stair-top, dawn-sunrise, apadana-enter, tachara-lance-bearers, tachara-lance-bearer-close,
  tripylon-n-stair, scribe-at-work.
- **Moments:** 4 (dawn, entry, reliefs, scribe).
- **What is wrong:**
  - *Dawn from the top of the Grand Stairway:* the W views show no stair, parapet or terrace edge, just a dark plain to a
    knife-edge horizon, so there is no sense of standing high on the Terrace.
  - *Entering the Apadana from bright sun:* apadana-enter is a blue-grey, shade-adapted portico at noon (sun at 71.9°)
    with no sunlit ground visible behind or beside the camera. The transition from bright to dark, which is the moment
    itself, is never shown in one frame or sequence.
  - *Reliefs in raking light:* the Tripylon N stair is in full shade and the Tachara S stair is in flat frontal light;
    neither is raking. One camera is inside a column; the close-up is black (bugs 2 and 3).
  - *Scribe mid-work:* scribe-at-work spends half its frame on the empty floor.
- **Fix:**
  - Re-pose the rigs: keep the stair parapets and the Terrace edge in the lower third for dawn.
  - Add a pair or sequence (outside portico in sun → door → hall) for the entry, with the eye-adaptation state carried
    over.
  - Choose relief façades and hours where the sun meets the face at 10–25°: E-facing Apadana stair in early morning,
    W-facing stairs late afternoon.
  - Frame the scribe at the tablet, from a seated eye height.

### 6. Polished red floors render as a liquid mirror
- **Renders:** apadana-hall-axis, hadish-hall, scribe-at-work, scribe-room-ne, apadana-enter-portico.
- **Moments:** 2 (entry, scribe), plus a supporting scene.
- **What is wrong:**
  - The floor reflects doorways, people and columns as sharp, full-length mirror images. It has no joints, no
    trowel-burnishing variation, no scuffs, no dust along the walls and no worn paths.
  - It reads as wet lacquer or plastic. A burnished hematite plaster floor (research B, Stein 2016) gives a broad, soft,
    low-contrast sheen with the reflections blurred out within a metre or two.
- **Fix:**
  - Roughness around 0.25–0.4 with a noise and wear map, and lower reflectance.
  - Clamp and blur SSR by roughness.
  - Add patching and plaster seams, dust and grit near walls and in corners, and wear along door-to-door lines.

### 7. Reliefs are flat painted decals
- **Renders:** tripylon-n-stair, tachara-s-stair, crowd-forecourt-morning (Apadana stair registers),
  tachara-lance-bearer-close.
- **Moments:** 2 (reliefs, court background). This is **the** relief moment.
- **What is wrong:**
  - The figures are saturated flat colour silhouettes, with a cut-out halo, printed on a smooth block face.
  - They have no carved depth (Persepolis reliefs stand about 2–10 cm proud, with rounded modelling and crisp undercut
    contours), no self-shadowing, and no paint thickness, wear or edge damage (§7).
  - Under any light they look like stickers.
- **Fix:**
  - Carve the relief as real geometry or displacement from the measured drawings (tier-flagged), with a height map
    driving normals and self-shadowing (POM or tessellated displacement at near LOD).
  - Paint by zone on the carved surface, with paint layer thickness and chipping at the high points.
  - Verify in raking light (fix 5).

### 8. The Marvdasht plain is an unbroken lawn
- **Renders:** dawn-stair-top, dawn-stair-top-nw, dawn-sunrise, dawn-sunrise-nw; background of crowd-court-apadana-n.
- **Moments:** 2 (dawn, court). This is the **first** §1.1 moment.
- **What is wrong:**
  - The plain is uniform dark green to the horizon, with no field mosaic (winter wheat and barley turning in May, fallow,
    stubble), no canals or qanat lines, no tracks, no tree lines along watercourses, no hedges, no smoke and no villages.
  - The settlement is a strip of white cubes on the horizon.
  - The horizon is a ruler-straight edge.
  - People stand scattered across the grass with no paths between them, like pins on a baize.
- **Fix:**
  - Drive a field-parcel layer from LANDSCAPE data, with crop albedo by date.
  - Add tracks and canal networks, and tree rows along the Pulvar and the canals.
  - Place the settlement's roofs, courtyards and hearth smoke at the Terrace foot.
  - Give the plain a mid-distance height-field roughness and aerial perspective.
  - Route people along tracks.

### 9. Kuh-e Rahmat and the other hills are smooth sand dunes
- **Renders:** court-assembly, crowd-court-forecourt-w, crowd-forecourt-morning, crowd-court-apadana-n,
  dawn-stair-top-nw/sunrise-nw (right-hand hill).
- **Moments:** 2 (court, dawn).
- **What is wrong:** the hills are pale beige, low-frequency rounded forms with a handful of lollipop trees. Kuh-e Rahmat
  in photographs is a steep, grey-brown limestone mass with:
  - bedding ledges and cliff bands;
  - scree fans and erosion gullies;
  - scattered dark shrubs (wild almond and pistachio);
  - strong self-shadowing in morning light.
- **Fix:**
  - Add high-frequency ridged and eroded detail on the DEM (a thermal or hydraulic erosion pass).
  - Assign materials by slope and curvature (rock face, scree, soil).
  - Use triplanar rock textures and scatter shrubs by aspect.
  - Keep the hill tops within the DEM so that fidelity to the real skyline is kept.

### 10. The ground is one beige plane with a repeating speckle stamp
- **Renders:** court-assembly, crowd-court-*, crowd-forecourt-morning, hall100-site, harem-portico, tachara-s-stair.
- **Moments:** 2 (court, reliefs).
- **What is wrong:** uniform albedo (Ystd/Y 0.05–0.07) with an evenly scattered dark-dot pattern that repeats visibly. The
  ground has no footpaths, no worn areas in front of doorways, no dung or straw, no pebbles or debris and no low-frequency
  colour change. Under the crowd, the ground shows no trampling at all.
- **Fix:**
  - Pave or pack the surface as SITE_SPEC says.
  - Add macro variation, trampled paths blended between doors, construction debris and stone chips at the 100-Column
    site, and litter and dung near the Gate.
  - Randomise the stamp by rotating and scattering tiles.

### 11. The scribe's room is empty
- **Renders:** scribe-at-work, scribe-room-ne.
- **Moments:** 1.
- **What is wrong:** one figure squats on the floor of an empty corridor, with one clay lump and a few blocks by the far
  wall. There are no tablet stacks or baskets, no clay bin or water pot, no reed styli, no sealing, no lamp, no shelves or
  benches in use, and no other scribes.
- **Fix:** dress the room per MATERIAL_CULTURE (tablet baskets and jars, a clay reservoir, sealings drying, a lamp, a
  second scribe or a clerk reading). "Mid-work" needs visible, specific, unfinished work.

### 12. Dawn clouds are grey smoke puffs, and the land is too dark
- **Renders:** dawn-stair-top, dawn-stair-top-nw, dawn-glow-e.
- **Moments:** 1.
- **What is wrong:**
  - The clouds are soft, structureless grey blobs with smoky edges and no base/top lighting difference. At sunrise
    (dawn-sunrise) the pink-lit cumulus is much better.
  - The land at sun altitude −2.9° is nearly black (Ystd/Y 0.069 in the plain), so detail is lost that a camera or eye
    would still see.
- **Fix:**
  - Give the cloud density a sharper erosion and edge detail, and multi-scatter so the bases are darker.
  - For the pre-sunrise moments, raise the exposure bias by about 0.5–1 EV, or lift the Earth-shadow and twilight
    irradiance.

### 13. Hypostyle interiors: black ceiling void, no light shafts
- **Renders:** apadana-hall-in, apadana-hall-axis, hadish-hall.
- **Moments:** 1.
- **What is wrong:**
  - The roof, beams and ceiling are invisible: pure black above the capitals.
  - No volumetric shafts come from the doors and windows, although the hall is dusty and in use.
  - Shaft colour is inconsistent (white and brown shafts side by side in hall-in).
- **Fix:**
  - Bounce from the bright floor and portico to the ceiling (the red floor should tint it).
  - Add a volumetric in-scatter pass keyed to door and window openings.
  - Check that the per-column material assignment matches the polychromy data.

---

## Per-image notes

| image | notes |
|---|---|
| moment-dawn-stair-top | A dark lawn plain to a razor horizon with a white-cube settlement; no Terrace or stair in the frame. Twilight sky gradient fine, clouds smoky. |
| moment-dawn-stair-top-nw | Box merlons and a flat grey stair; blocky building at right; black blobs on the right-hand hill (bug 8). The plain and the far ranges' haze are the best parts. |
| moment-dawn-sunrise | Pink cumulus and the haze on the far ranges are good. The plain is empty green with people like pins; a pale streak comb on the right horizon (bug 9). |
| moment-dawn-sunrise-nw | As the -nw dawn frame. Warm sunrise light is barely visible on the parapet stone; no AO at the merlon steps. |
| moment-dawn-glow-e | Gate E doorway with lamassu and guards. A black stepped artefact over the brazier (bug 1). Wall is green noise; the blue frieze band is flat. |
| moment-apadana-enter | Portico in dim, blue-grey shade. The fluted shafts and bell bases are decent; two black cut-out stands (bug 5); no bright-sun context. |
| moment-apadana-enter-portico | Doorway into a black hall with a red floor and one bright window: good exposure logic. Jambs are flat grey slabs; walls flat cream. |
| moment-apadana-hall-in | Best mood frame: dim, forest-like columns with bull capitals and reddish haze. Ceiling void; white and brown shafts mixed; capitals plaster-smooth; foreground shaft banding. |
| moment-apadana-hall-axis | Strong composition. Mirror-like red floor with a reflected doorway; faceted bases; sweeper figure crude; white floor sparkles (bug 6). |
| moment-hadish-hall | Faceted tori and bells; mirror floor; red dot fireflies (bug 6); window openings good; beam ends barely visible. |
| moment-court-assembly | A real crowd (~200 visible) with shadows. Saturated clone costumes, mannequin foreground man, dune hills, speckled box Gate. The court moment does not yet land. |
| moment-scribe-at-work | A crouching scribe on an empty liquid-red floor; half the frame is floor; light-leak fringe on the right arris (bug 4). |
| moment-scribe-room-ne | Good light from the door, a silhouetted scribe and brick-course benches. Room bare; red line leak at the left wall foot (bug 4). |
| moment-hall100-site | Construction-site massing correct in feel (doorframes ahead of walls, capitals up). Flat olive wall, untextured grey blocks, speckle ground, no scaffolds in view; workers tiny. |
| moment-harem-portico | Clean, legible portico. Flat brown slab roof with no beams, no AO at capitals and feet, olive plaster. |
| moment-tachara-s-stair | Relief figures are flat sticker silhouettes on smooth grey blocks; flat frontal light; guards in primary colours. |
| moment-tachara-lance-bearers | Camera against a column; the relief is not visible (bug 3). |
| moment-tachara-lance-bearer-close | 57 % black; the relief figure shows only as edge lines; a light-leak seam on the jamb (bug 2). The studded door leaf is modelled. |
| moment-tripylon-n-stair | Winged disc, sphinxes, palms and guards as flat decals on a charcoal-grey face in shade; stub shafts and a free-standing doorframe above. |
| moment-stair-climb-pm | Strong perspective of the climb, and merlon shadows fall correctly on the wall. Treads are flat and dark; the wall is a smooth grey plane; the landing is a grey box. |
| crowd-court-apadana-n | Box merlons; the Gate is a beige box with a dark door; the crowd is distant; black blobs on the hill (bug 8). |
| crowd-court-forecourt-w | Walking people with good contact shadows. Jar swallows a head (bug 7); flat costumes; speckled wall and ground. |
| crowd-forecourt-morning | 60 % of the frame is speckle ground. The Apadana is an olive box; the stair registers are rows of tiny decals; lollipop trees on dune hills; 775 people "in view" but almost none visible. |
| crowd-hall-site-working-morning | Busiest near-field frame: workers carrying boards, a scaffold tower, big fluted column. Faces crude; costumes flat white; ground speckle. |
| surf-* (not scored) | B vs env0 shows the probe and volumetric term lifting the hadish floor. In the dawn-glow-e post-sss buffer the whole frame is white speckle noise and post-ssr is black, so suspect them for bugs 1 and 6. |
