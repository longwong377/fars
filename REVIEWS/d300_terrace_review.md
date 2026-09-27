# D-300 Terrace exteriors: independent materials review (s11, branch s11-realism-terrace)

Reviewer: independent (did not build these frames). Brief: handoff/briefs/s11/review_d300_terrace.md.
**This review is uncalibrated:** REVIEWS/anchors/ does not exist (T-R1 unbuilt), so no anchor set was scored first and the
scores below cannot be checked against pins. I did not open shots/d300/review_key.json, the d300 sheets or any moment-*.png.

## Lead: what reads as CG (all of it)

**Every one of the 27 frames reads as CG (27/27; T-A4cg <= 0 fails by 27). No frame reaches materials 4 (T-A4 >= 4 fails
everywhere). Overall materials score for the set: 2 / 5 (median 2, lowest 1, highest 3).** Both paired-photo renders are
identified instantly (T-A5d <= 65 % would fail at 100 %).

The failures are systemic, not per-view:

1. **Texture tiling on every large surface.** The same albedo stamp (a crescent / comma mark with a pale blotch) repeats on a
   visible grid across the court paving (F05, F24), the ashlar faces (F09 right wall, F12 right wall, F26), and the mud
   plaster (F06: a diamond-lattice repeat every ~100 px across the whole wall). A viewer spots it in under a second.
2. **Wrong material identity for the stone.** Stair façades and parapets read as grey veined marble or poured concrete
   (F04/F17, F07/F13, F10, F20/F24), not as the buff-honey Persepolis limestone of `reliefs.webp`, `stairs 2.jpg` and #24. At
   dawn (F04/F17) the stone goes blue-slate with a cloudy noise pattern that reads as a triplanar procedural.
3. **Reliefs are painted cut-out cards, not carving.** The delegations, guards and audience figures (F01/F03, F07/F13, F08,
   F20/F24) are flat coloured silhouettes with a hard outline and no modelling, no shadowed undercut, no stone showing through
   the paint; the lion-bull groups are faint grey ghosts with no depth. Compare `reliefs.webp` (crisp 2-4 cm relief, raking
   shadows inside every fold) and `Apadana-Relief-1.png`.
4. **The Gate's colossi are untextured white blobs** (F15/F27, F18/F19): no feathers, beard, hooves or plinth carving, a
   material different from the walls around them (compare `The Gate of All Nations 2/3.webp`, `bulls.png`).
5. **Mud plaster walls are single flat planes** (F11/F23, F15/F27, F08, F01 background): uniform tone over tens of metres, no
   trowel undulation, no base splash/erosion band, no staining under the parapet, razor-straight arrises.
6. **Masonry joints drawn, not built.** Joints are dark outline strips or bevel ribbons (F02, F22, F25) like a vector drawing;
   the retaining wall at 20-60 m is a regular small-block grid (F11/F23: cinder-block scale, regular grout) where #24 shows
   huge irregular-length courses and a polygonal foot of boulder-sized blocks.
7. **Ground.** Court fill is a smooth smudged plane (F01, F07/F13 dark wet-asphalt look); the plain in the Now view is either
   flat khaki (F16) or a cracked salt-flat decal (F21) where #24 shows grey-white gravel with moss patches.
8. **The Now view from the plain fails its own photograph** (F16, F21, pair renders): wall hue dark grey (F16) or rust-red
   (F21) against #24's warm buff-grey; the wall face shows no coursing at all (F16) or a regular grid (F21); the polygonal
   foot is absent (F16) or drawn as a few decal cracks (F21); Kuh-e Rahmat is smooth sand dunes, not bedded rocky outcrop;
   the Gate colossi and the Tachara/Palace silhouettes on the skyline are missing.

## Per-frame table

Distances: "arm" = within 3 m; "20-60" = the wall or stair at mid distance. Times per the brief's slot list, matched by
content (I did not use the key). All clear weather.

| frame | what it shows (time as inferred) | materials (1-5) | reads as CG | tells (where in frame) |
|---|---|---|---|---|
| 01 | Apadana stair wing + court fill, raking daylight (May) | 2 | yes | relief figures = flat painted decals (left-centre); stair stone = grey concrete noise, no block joints (whole façade); court fill smudge plane (lower half); Apadana wall flat brown slab (upper right); cypress row = green lozenge decals (top-left) |
| 02 | Wall close-up at the polygonal foot (Feb 16:05) | 2 | yes | joints as dark outline strips (centre-left diagonal); floating plank-like ledge (centre right); right wall mottled grey repeat, "wrong material" (right third); dirt ground flat (bottom right) |
| 03 | = view of 01, gravel ground | 2 | yes | as 01 for the wall and reliefs; ground better (pebble scatter) but uniform, no fines/stone mix change toward the wall |
| 04 | Stair top at dawn (Apr 05:24) | 2 | yes | blue-slate cloudy procedural on every stone (all); merlons blocky, no arris wear (left); treads identical, no wear (bottom); wall coursing smeared (right) |
| 05 | Court paving, top-down, arm's length | 2 | yes | tiling repeat: identical crescent marks on every slab (all); slabs dead flat, hairline grout uniform |
| 06 | Mud-plaster wall, arm's length (Feb 16:05) | 1 | yes | diamond-lattice tiling repeat (whole wall); white horizontal decal line (lower third); no relief, no trowel marks |
| 07 | Palace stair façade (Tripylon/Hadish type), court | 1 | yes | stone = grey veined marble (whole façade); figures = cut-out cards (centre); winged disc decal (centre); ground dark wet asphalt (lower third); blue-black doorway frame reads as modern steel (top centre); lion-bull ghosts (edges) |
| 08 | Palace portico stair, frontal (May) | 2 | yes | figures = decals (centre); stone concrete-flat (façade); columns grey uniform, no fluting read (centre); mud walls flat planes (sides); court flat |
| 09 | = view of 02 | 2 | yes | crescent-stamp tiling on both walls (right wall most visible); joints softened but blocks still flat planes; ground flat |
| 10 | Grand Stair climb (May 11:00) | 2 | yes | treads identical and unworn (bottom half); right wall: no readable course joints at arm's length, faint lines only (right third); merlon shadows read as floating dark slivers (right centre); parapet stone concrete noise (left) |
| 11 | Palace on its terrace wall from the court/plain | 2 | yes | wall = small regular blocks, regular grout, cinder-block scale (centre band); mud walls flat single tone (upper); yellow hemisphere bush/rock (lower left); ground flat |
| 12 | = view of 10 | 2 | yes | as 10, plus crescent-stamp tiling on the right wall (right third) |
| 13 | = view of 07 | 1 | yes | as 07; ground darker and flatter |
| 14 | = view of 06 | 3 | yes (borderline) | best surface in the set: no visible repeat, faint cracks; still dead flat (no normal response to low sun), one tone over the whole wall, soft blur band at the foot |
| 15 | Gate of All Nations by day (Feb 16:05) | 1 | yes | colossi white untextured blobs (centre); glowing blue-grey lintel plate (above door); wall one flat plane, no pilasters/coursing (left half); red carpet flat (door foot); brazier on thin stalk (foreground); court paving grey flat (bottom) |
| 16 | Terrace wall from 150 m, Now view (Feb 16:05, fov 34.4) | 1 | yes | wall face flat dark grey, no coursing, no polygonal foot (centre); columns plain sticks (top); hills smooth dunes (background); plain flat khaki (bottom) |
| 17 | = view of 04 | 2 | yes | as 04 |
| 18 | Gate at dusk (Apr 19:15) | 2 | yes | colossi white shapes glowing (centre); wall plane uniform (left); brazier small, one flame; star field fully dark at 19:15 (sky) |
| 19 | = view of 18 | 2 | yes | as 18 |
| 20 | Apadana N/E stair façade, frontal (May) | 2 | yes | figures decals (centre); lion-bull faint grey ghost (left/right of centre); cypress = green lozenges; columns grey unfluted-looking; court fill flat |
| 21 | = view of 16, other rendering | 1 | yes | wall rust-red, wrong hue vs #24 (centre); regular grid coursing; polygonal foot as decal cracks (lower wall); plain = cracked salt-flat decal, wrong material (bottom); hills smooth |
| 22 | Polygonal masonry close (foot), arm's length | 2 | yes | joints as raised dark bevel ribbons (upper centre); blocks flat planes; no weathering at arrises |
| 23 | = view of 11 | 2 | yes | as 11, plus a few crack decals on the wall |
| 24 | = view of 20 | 2 | yes | as 20; court paving with crescent-stamp tiling (bottom half) |
| 25 | Retaining wall face, coursed above, polygonal foot below | 2 | yes | upper courses a blurred rectangular tiling; polygonal joints as dark strips (lower half); no depth between blocks |
| 26 | = view of 25 | 1 | yes | crescent-stamp tiling on every block (all); no polygonal foot; flat |
| 27 | = view of 15 | 1 | yes | as 15; plaster smoother but still one plane; colossi unchanged |

**Overall materials score (set): 2.** No frame at 4. The best single surface is F14 (plaster, 3).

## Paired photo test (T-A5)

| pair | my pick for the photograph | confidence | what gave it away |
|---|---|---|---|
| 1 | **A** | 100 % | B: the wall face has no blocks and no polygonal foot, hills are smooth sand dunes, the plain is flat khaki, the Gate and palace silhouettes and the column capitals/statues are missing, flat CG sky. A shows the huge irregular courses, the boulder foot, gravel with moss, rocky bedded hillside |
| 2 | **A** | 100 % | B: wall rust-red with a regular grid, foot drawn as cracks, cracked salt-flat ground, same smooth dunes and missing skyline. A as above |

Pick accuracy would be 100 %. T-A5 as written ("<= 100 %") passes at 100 %: that threshold cannot fail and is a proxy (see
below). The final standard T-A5d (<= 65 %) fails. The render camera also does not register on the photograph: the render's
wall runs further right and its columns are fewer and in different places, so the solved camera or the Now-view layout is off.

## Scope, lens, time: what this sample cannot tell

- **Not at the player's quality.** All 27 frames and both pair renders are quality `high`, not `ultra` (brief rule 2): every
  frame is off-spec on quality. Lens: FOV=game except F16/F21 and the pair renders (fov 34.4, the #24 camera), as stated.
- **Stills only.** No clip, no sound: pop-in, shimmer, texture swimming and the listening rubric (T-G4) are unjudged.
- **Time strata held:** Feb 16:05, Apr 05:24 and 19:15, May 09:30/11:00/16:00; clear weather only. **Unjudged:** every
  other month, noon/night-with-moon/moonless night, and all non-clear weather (cloud, overcast, rain, storm, snow, dust,
  mist). Wet stone and dust-coated stone are the strata most likely to expose these materials further.
- **Scene, not swatch.** The courts are nearly empty of people (a few figures in F08, F15/F27), no animals, no activity, no
  traces of use (no dung, straw, footpaths worn into the fill, water stains at the stair foot). Life and sound are not scored
  here but the scene would not land for a 467 visitor.
- **What the sample cannot say about the rest of the Terrace:** interiors, the Treasury, the Harem, the Hall of 100 Columns,
  the fortification wall up Kuh-e Rahmat, and the E/N/S retaining walls are not shown. Because the tells are shader-level
  (tiling, procedural stone, decal reliefs, flat plaster), I expect them to hold everywhere those materials are used.

## Anachronism checklist (T-I1) in this sample

No blocklist hit found with confidence. Two items to check: the blue-black door frame on the stair top in F07/F13 reads as a
modern steel portal; the glowing blue lintel plate on the Gate (F15/F27) reads as glass or enamelled metal. The winged disc
on the palace stair (F07/F13) is attested on Persepolis stair façades and is not a hit. Stars at full density at 19:15 on
17 April (F18/F19) look early for civil twilight; a light check, not an anachronism.

## Proxy hunt and detector escapes

I gave no PASS, so there is no PASS to attack. The gates themselves:

- **T-A5 "<= 100 %" is a threshold that cannot fail**: a reviewer at 100 % pick accuracy passes it. The intent (renders
  indistinguishable from the photograph) fails completely. Proposed: retire T-A5 in favour of T-A5d, or set it to <= 90 %
  as an interim floor.
- **Texture tiling (F05, F06, F09, F12, F24, F26)**: no detector on the board measures repeat within one surface. T-E5 only
  compares two instances of a generator. This is a **detector escape** (T-R0) once logged. Proposed detector: per surface
  class, autocorrelation of the albedo-only pass (or the frame) over 64-512 px lags; a secondary peak above 0.5 fails.
- **Flat surfaces (F14, F15/F27, F16, F11/F23)**: T-A2f (flat-region share) and T-A2s/T-A2s2 (spectrum slope and 12 px
  Ystd/Y against the reference photographs) should catch F16's featureless wall and the flat plaster planes, but all are
  `to-build`. When built, check the anti-proxy: a noise texture passes Ystd/Y without being stone, which is exactly what the
  current stone is doing (F04/F17, F10). Ystd/Y alone would pass this set's stone: pair it with the spectrum slope and an
  albedo-vs-reference hue test.
- **Wrong hue/material vs the reference (F21 rust-red, F16 dark grey, F07 grey marble)**: no detector compares mean albedo
  and hue of a surface class against its reference photographs (#24, reliefs.webp). Escape; proposed detector: per surface
  class, median Lab of the lit pixels within a delta-E band of the class's photographs at the same hour.
- **Decal reliefs (F01, F07, F20)**: no detector measures relief depth. Proposed: in raking light (sun < 25 deg), the luma
  contrast inside a relief's mask vs its surrounds must match reliefs.webp within a band; flat paint yields none.
- **T-A7 (scan exists but a procedural stand-in is drawn)** is the gate most likely to catch items 1-2 and is `to-build`.

## References judged against

Opened with Read: `persepolis and the mountain behind the ruins 2.webp` (#24; walls, foot, plain, pairs), `stairs today.webp`
(#33; masonry, Grand Stair), `The Gate of All Nations 2.webp` (#5; Gate, colossi, joints), `gate of all nations more.webp`
(#21; Gate coursing, Kuh-e Rahmat), `reliefs.webp` (#29; relief depth, merlons, near-fresh stone), `stairs 2.jpg` (#31;
stair reliefs, stone colour), `bulls.png` (Getty; Gate colossi on plinths, plaster walls), and
fars-assets/photos/`sheet_terrace_walls_stairs.png` (32 Wikimedia photographs: block faces, polygonal foot, merlons). I did
not open sheet_gate_of_all_nations, sheet_apadana or sheet_reliefs individually; the site references above covered those
items. Stone in 467 judged against the near-fresh reliefs.webp and stairs 2.jpg (D-231); the Now view (F16, F21, pairs)
against #24. No memory-only (C) judgements were needed except the civil-twilight star note.

## The three changes that would most raise the materials score

1. **Replace the procedural/tiled stone and plaster with scan-based, non-repeating materials** (T-A7): stochastic or
   texture-bombed sampling plus a macro variation layer, per-block tone variation (~0.10 for 467, 0.26-0.43 for the Now
   view, B40), real normal/height at arm's length, and the limestone's buff-honey hue from #24/reliefs.webp. Removes the
   tiling (F05, F06, F09, F12, F24, F26), the marble/concrete look (F04, F07, F10, F20) and the flat plaster (F11, F15, F14).
2. **Carve the reliefs and the colossi as geometry in the stone** (displacement or baked-normal meshes from the published
   relief casts/photos), with paint, where used, sitting in the carving and worn at the high points; give the Gate colossi
   their sculpted form and the wall's material. This fixes the most visible CG tell in every stair and Gate view.
3. **Build the masonry and the ground the way #24 shows them:** tight hairline joints with chipped arrises instead of
   dark outline/bevel strips (F02, F22, F25); the wall at the true block scale (irregular long courses, not a small grid:
   F11, F21); the polygonal foot as 3D boulder blocks; gravel-and-fines ground with pebble scatter and moss for the plain
   and trodden fill for the courts, not a smudge plane (F01, F07) or salt-crack decal (F21); correct the Now-view wall
   hue and Kuh-e Rahmat's bedded rock.

## Proposed record rows (not written to the record files)

| id | kind | text |
|---|---|---|
| B100 | blocker | T-A4/T-A4cg fail on every D-300 Terrace frame (27/27 read as CG; materials median 2): the Terrace exteriors are not at the photoreal standard |
| B101 | blocker | No detector for within-surface texture repeat, surface hue vs reference, or relief depth; three detector escapes to log in REVIEWS/escapes.md (tiling F05/F06/F26; hue F21/F16; decal reliefs F01/F07/F20) |
| B102 | blocker | Review uncalibrated: REVIEWS/anchors/ missing (T-R1); D-300 frames rendered at `high`, not `ultra` |
| Q-780 | question | T-A5 "<= 100 %" cannot fail; retire it for T-A5d (<= 65 %) or set an interim floor? |
| Q-781 | question | The #24 calib camera does not register (wall extent and column positions differ from the photograph): is the solved camera or the Now-view layout off? |
| Q-782 | question | F07/F13 blue-black door frame and F15/F27 glowing lintel plate: what material is intended? Both read as modern metal/glass |
| Q-783 | question | 19:15 on 17 April renders a full star field (F18/F19): check the twilight sky model against civil twilight at Persepolis |
