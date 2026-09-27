# D-303 town review: the lower town below the Terrace (ring 2)

Independent reviewer; read-only; blind to which frames are current or older (not guessed). Written 2026-09-27.

## Verdict first: what is broken or placeholder

**All 8 frames fail T-A4 (lowest category 1 or 2 in every frame; the gate is >= 4) and all 8 read as CG (T-A4cg: 8 against a
limit of 0).** No category in any frame reaches 4. The life category is the weakest: 1 in five frames, 2 in the other three.

Top faults across the sample, worst first:

1. **The workshop yard's crowd is a clone field (frames 1, 6).** About 50 people share one body type, one pale tunic and three
   poses (kneel with open hands, crouch, kneel and reach), spread evenly over a bare field. Their hands work at nothing: there are
   no benches, clay, stones, tools, kilns or baskets, only small flat multicoloured tiles at their knees that look like plastic
   paint palettes, and scattered twig bundles. There are no animals, no one standing or carrying, and no one talking to anyone.
   This is a work plan drawn as a posed figure, and it is the least convincing thing in the sample.
2. **Lane and court walls are untextured flat brown (frames 2, 4, 6, 8).** The mud plaster is a single even tone with a few thin
   drawn lines that stand in for cracks (frame 8, left wall: straight polyline "cracks"). The references show trowel marks,
   rain rills, patching, slumped tops, exposed brick courses and a darker, damp, eroded foot (`31255816_Mud_wall_Panjrah`,
   `130306671_Old_part_of_Yazd`). mud_plaster and house_plaster have a scan in SCAN_USE, so wherever these frames show the
   current build this is a **T-A7 failure** (a scan exists but a procedural flat colour is drawn).
3. **Where the wall scan is applied (frames 3, 5, 7) it reads as rock, not mud plaster.** The relief is deep and craggy like a
   cliff face or quarried stone, it tiles at one scale on every wall, and it runs uninterrupted across corners and tops. Hand
   plaster has a softer, trowelled, rounded surface (Panjrah, Abyaneh, Yazd photographs). The scan is present, but it is the
   wrong material at arm's length.
4. **The wall-foot socle is a grey band that looks procedural (every lane frame: 2, 4, 5, 7; courts 3, 8).** It is a pale grey
   strip of flat polygonal "flagstones" with black outlines, stair-stepped aliasing on its top edge, and a hard horizontal line
   against the plaster. At the foot of the right wall in frames 4 and 7 there is also a thin white trim strip with a dark slot,
   like a modern skirting board. Real socles are rounded fieldstone set in mud, plaster-splashed and earth-coloured, with the
   plaster eroded into a scalloped band above them (Panjrah shows exactly this). House_socle has a scan (dry_riverbed_rock),
   but what is drawn does not look like it, so this is a **T-A7 candidate in every frame**.
5. **The lanes are extruded boxes (frames 2, 4, 5, 7).** They are ruler-straight, too wide, with constant-height parapets. The
   walls have no doorways, no drain spouts, no projecting roof joists, no niches or mangers, no dung-cake patches and no
   rubbish against the wall foot. The lane centre carries light rectangular "paving" slabs that read as concrete (frames 2, 4,
   centre distance). Everything is at one scale; nothing leans, bulges or slumps. The Yazd lane photograph shows how a real lane
   narrows, bends and is crowded with doors and patches.

Further faults (located per frame below): a faceted low-poly storage jar (frames 3, 8); red ground sprites that look like
floating red splotches rather than flowers (frames 4, 7); a pyramid-roofed hut in the workshop yard (frames 1, 6), a form
neither the references nor the region's flat-roofed tradition supports; grey noise-textured mounds (frames 1, 6, lower left);
and, at the far end of the lane, a red cylinder and a dark drum that read as a gas bottle or hydrant and an oil drum
(frames 2, 5, 4, 7). Also at the lane end are pale blocks with blue rectangles. They are probably the Terrace palaces with
their painted band (compare `persepolis more 1.jpg`), but at this distance they read as modern apartment blocks.

## Conditions of the sample (what it can and cannot tell)

- **Lens and quality:** all 8 frames use the player's 70° vertical FOV but quality `high`, not `ultra`, at 960x540 on an NVIDIA T4
  running WebGPU. **No frame is at the player's widest quality setting (`ultra`),** so every score here is at `high`. I cannot
  tell whether anyone is hidden near the lens. In frames 1 and 6 an arm enters at the right edge, so people are not suppressed
  at the frame edge.
- **Motion and sound:** all items are stills with no audio. Nothing could be judged in motion or with sound: not the crowd's
  loops or sliding feet, walking in place, pop-in along the long lane sightlines, shimmer on the socle band (its aliased edge
  will almost certainly crawl in motion), or whether the yard's 50 workers make any sound. **Every item was judged as a still
  only.**
- **Time:** every frame is mid-May 467 BCE, 09:30–10:30, clear. **Unjudged:** 11 months; the pre-dawn, dawn, noon, afternoon,
  dusk and moonlit and moonless night hour bands (including the brief's "smoke rising from the town at dusk as lamps are lit",
  which is this area's §1.1 moment); and every weather except clear (cloud, overcast, rain, storm, snow, dust, mist, lightning).
  Nothing here shows wet plaster, mud in the lanes, winter or fire-lit courts.
- **Scope:** 4 distinct viewpoints (two lanes or a junction, one house court, one workshop yard), each in two material states. That
  is far below T-A4's `sample_min` of 16 and T-A0's n >= 59 random views. The sample says nothing about enterable rooms
  (the court's doorways show only dark interiors), roofs (the ladder implies roof access but no roof was judged), the town's
  edges against fields, gardens, the canal or water sources, markets, or any lane narrower than these. It also cannot show
  whether the "chosen" views are better or worse than seeded random ones.
- **The slot "a lane wall at arm's length" was not supplied.** The nearest wall in any frame is the left-edge wall in frames 2 and 5,
  at roughly 1.5–3 m. No frame shows a wall at 0.5–0.7 m, the distance that decides the materials score, so the materials scores
  below are too generous if anything.
- **Calibration:** there is no anchor set (REVIEWS/anchors does not exist). **All scores are uncalibrated.** They are one
  reviewer's absolute judgement on a 1–5 scale, where 5 would pass as a photograph of the place.

## References judged against

- `references/persepolis more 1.jpg` (mood only): a dense town of flat-roofed, pale courtyard houses with gardens and trees. The
  frames have no trees, gardens or roofscape; the town's walls are darker and browner than this palette.
- `references/persepolis more.jpg` (Golvin; mood only): houses at the Terrace foot are small flat-roofed blocks. It does not
  support the pyramid-roofed hut.
- Fars and central-Iranian mud-brick photographs (`C:\Users\Administrator\fars-assets\photos\fars_villages_mudbrick\`), viewed:
  `31255816_Mud_wall_Panjrah_Nishapur_1.jpg` (the plaster, patching and eroded wall foot at arm's length),
  `130306671_Old_part_of_Yazd_Iran_463164286.jpg` (lane width, shade, wall surface and debris),
  `64143663_Mud_Brick_Architecture_Abyaneh...jpg` (the plaster's grain and projecting roof timbers),
  `107854056_Korkosh.jpg` (a village lane's ground, dust, stones, dog and clutter),
  `57788709_Kakan_village_Simakan_Fars_panoramio.jpg`, `87621176_Qalat_Jahrom.jpg`, `54423403_Balbali_Village_panoramio.jpg` (the
  settlement's massing, trees, varied heights and the mountain backdrop). Modern elements in these photographs (poles, signs,
  steel doors, windcatchers, pointed arches) were ignored.
- **Memory (C)** was used only for chickens in Achaemenid Fars (plausible, C) and for Near Eastern workshop yards having kilns,
  benches and heaps of clay or stone (C). No reference covers either.

## Per-frame scores (1–5, uncalibrated; "CG" = reads as CG)

| frame | view | geometry/form | materials | light | scale/density | life | reads as CG |
|---|---|---|---|---|---|---|---|
| 1 | workshop yard, wide | 2 | 2 | 2 | 2 | 1 | yes |
| 2 | long lane, flat walls | 2 | 1 | 2 | 2 | 1 | yes |
| 3 | house court, scanned walls | 3 | 2 | 3 | 3 | 2 | yes |
| 4 | lane junction, flat walls | 2 | 1 | 2 | 2 | 1 | yes |
| 5 | long lane, scanned walls | 2 | 2 | 2 | 2 | 1 | yes |
| 6 | workshop yard, flat ground | 2 | 1 | 2 | 2 | 1 | yes |
| 7 | lane junction, scanned walls and ground | 2 | 2 | 2 | 2 | 2 | yes |
| 8 | house court, flat walls | 3 | 1 | 3 | 3 | 2 | yes |

Lowest category in every frame: 1 (frames 1, 2, 4, 5, 6, 8) or 2 (frames 3, 7). **T-A4 fails. T-A4cg = 8 (limit 0).**

## Per-frame faults, located, with fixes

### Frame 1: workshop yard
- **Centre to right, the crowd:** about 50 clones kneel in three poses, evenly spaced and facing no work. Fix: give each worker the
  props of the trade (a potter's wheel or clay heap, a stone block and chisels, a loom, a basket of wool). Add standing, walking
  and carrying workers and pairs facing each other. Vary body, age, cloth colour and wear; cluster people around work, not on a
  grid.
- **At the workers' knees:** flat multicoloured tiles that read as plastic paint palettes. Fix: replace them with the actual work
  object (a tablet, a mould, a pot) in earth colours, or remove them.
- **Centre, the pyramid-roofed hut:** an unattested form that reads as a tent or modern shed. Fix: flat-roofed shed on posts, or a
  kiln (a domed kiln is period-correct as a kiln, not as a roof).
- **Lower left, a grey block:** a noise-textured slab with no contact shadow. Fix: a stone or brick heap with contact shadows,
  or remove it.
- **Right middle, a dark mound:** a grey-blue lump that reads as unlit geometry. Fix: a spoil or clay heap in local earth.
- **Perimeter walls:** blank, uniform in height, no doors. Fix: gates, sheds, lean-tos, drying racks and firewood along the walls.
- **Ground:** reasonably grainy trodden earth with twig bundles. It is the best surface in the frame, but has no pot sherds, ash,
  chips or spoil a working yard would hold. Fix: work debris scattered by trade.
- **Light:** flat; figures have no contact darkening; everything lit the same. Fix: contact AO or shadows under kneeling figures,
  and ground bounce.

### Frame 2: long lane, flat walls
- **Both walls:** flat brown with thin drawn crack lines; no plaster grain. This is T-A7 if it is the current build. Fix:
  apply the mud_plaster scan at a strength and scale that reads at 1–3 m, with an eroded, darker foot.
- **Wall foot, left and right:** a grey polygon-tile socle with black outlines and an aliased top edge. Fix: fieldstone socle
  (the house_socle scan, actually applied), bedded in mud, with plaster splash and an eroded scallop above it.
- **Left foreground:** a projecting horizontal slab on the near wall (a lintel or beam?) that ends in a flat cut. Fix: rough
  timber lintel over an opening, or remove it.
- **Lane:** too wide and straight; light rectangular "paving" in the centre distance reads as concrete. Fix: a narrower,
  bending lane of trodden earth with a central drain gully, wheel ruts and dung.
- **Walls:** no doors, spouts, roof joists or stepping in the parapet. Fix: door frames every few metres, roof-drain spouts,
  joist ends, and varied heights with house fronts.
- **Life:** a few tiny figures at 60–100 m, evenly spaced grass tufts. Fix: nearer people, a donkey, a dog, a heap of rubbish or
  dung against a wall.
- **Far end:** a red cylinder and a dark drum (see top faults). Fix: identify them and give them a period form and colour (a
  red-slipped jar, a basket).

### Frame 3: house court, scanned walls
- **All walls:** craggy rock relief at one scale; left foreground wall reads as a cliff face. Fix: a softer plaster normal map
  at lower strength, smudged trowel marks, a lighter tone that varies with sun exposure.
- **Left front, the storage jar:** faceted low-poly silhouette, uniform orange. Fix: a smooth-lathed jar with slip, wear and a
  dark wet band at the base.
- **Doorways (centre and right):** interiors dark, with pale plank-like floors beyond the thresholds. Fix: worn earth floors, a
  hearth, bedding or objects visible inside, a timber door leaf or curtain.
- **Parapet:** projecting joist ends are good (compare Abyaneh). The roof edge is a single clean plank. Fix: an irregular
  mud-and-straw roof lip with brush poking out.
- **Life:** a woman walking with an arm raised, a child by the ladder with a pot, one white hen. This is the best life in the
  sample, but there is no wear, fire, washing, tethered animal, or smoke from a hearth. Fix: an oven (tanur), a hearth smudge on
  the wall, drying laundry, a tethered goat, and straw and dung on the court floor.
- **Foreground post:** a clean cylinder. Fix: an irregular pole, split and weathered.

### Frame 4: lane junction, flat walls
- **Left walls:** flat brown with one drawn crack line; the socle is a grey band with a black-grouted tile pattern. Fix: as frame 2.
- **Right wall foot:** a white trim strip with a dark slot, like a modern skirting board. Fix: remove it or model it as the socle.
- **Right wall:** a darker rectangular frame that looks like a doorway rendered as a decal. Fix: a real recessed door with a
  timber leaf.
- **Ground, lower left:** red sprites that read as floating red splotches (flowers?), and one grass tuft. Fix: poppies with stems
  at correct scale, or remove them; add dung, straw and footprints.
- **Centre:** light rectangular paving slabs (as in frame 2).
- **Far end:** a running child, and the same red cylinder and drum.

### Frame 5: long lane, scanned walls
- **Walls:** a rock-cliff scan, the same scale on every wall, running continuous across the corner of the near left block. Fix:
  as frame 3.
- **Socle:** the same grey band (frame 2 fix).
- **Ground:** better. A gritty earth scan with pebbles and small debris. Still no ruts, dung, drain or wall-foot rubbish.
- **Everything else:** as frame 2.

### Frame 6: workshop yard, flat ground
- **As frame 1.** In addition, the ground is a smoother, low-contrast streaked texture that averages to a flat tone beyond 5 m
  (T-A2f and T-A7 candidate), and the lower-left mound is grey noise.

### Frame 7: lane junction, scanned walls and ground
- **Walls:** rock-like scan (frame 3 fix). The socle is the grey tile band. The white trim on the right wall foot remains.
- **Ground:** the best lane ground in the sample. Dung pellets, grit and small litter give it a used look (the reason life
  scores 2 here).
- **Ground, lower left:** red sprites remain as in frame 4.
- **Far end:** red cylinder and drum as in frame 4.

### Frame 8: house court, flat walls
- **Left wall:** flat brown with straight drawn crack lines forming a polyline net. It reads as a line decal. Fix: the scan plus
  real crack geometry or normal detail.
- **Other walls, jar and life:** as frame 3, but the walls are flat colour. The socle is grey flagstones with black outlines.

## Anachronism checklist (T-I1), against research/ANACHRONISM_BLOCKLIST.md item by item

**Confirmed hits: 0.** None of these is visible: windcatcher, dome, pointed arch, fired-brick house wall, glass window, signage,
fence, lamp post, modern road or asphalt, paper, stirrup, Islamic dress, date palm, new-world crop or restoration capping.

**Items a player could read as anachronistic (not counted as hits; they need identifying):**
- The red cylinder and dark drum at the lane end (frames 2, 4, 5, 7) read as a gas bottle or hydrant and an oil drum.
- The pale blocks with blue rectangles at the lane end read as modern apartment blocks, though they are probably the Terrace.
- The multicoloured flat tiles at the yard workers' knees (frames 1, 6) read as plastic.
- The white skirting trim on a wall foot (frames 4, 7) reads as modern.
- The pyramid-roofed hut (frames 1, 6).
- Chickens (frames 3, 8) are plausible for Achaemenid Fars (C); they are not on the blocklist.

## Thresholds in this review

- **T-A4 (lowest category >= 4): FAIL** in all 8 frames. The lowest scores are 1 (frames 1, 2, 4, 5, 6, 8) and 2 (frames 3, 7).
- **T-A4cg (<= 0 reading as CG): FAIL**, 8 of 8.
- **T-A7 (<= 0 % of pixels from a procedural stand-in where a scan exists): likely FAIL. I cannot measure it from stills.**
  - The walls in frames 2, 4, 6 and 8 and the ground in frame 6 look like flat stand-ins for surfaces that have scans
    (mud_plaster, house_plaster, earth or court_fill).
  - The socle band in every frame does not look like its scan (house_socle: dry_riverbed_rock).
  - I cannot tell which frames are the current build, so the measurement must be run on the coverage sample.
  - Even where a scan is applied (frames 3, 5, 7), T-A7's anti-proxy only checks strength and tiling. A rock scan on a mud wall
    passes T-A7 and still fails the intent (see below).

## Proxy hunt

- **PASSes given:** no rubric category passes. The only "pass" is T-I1's zero confirmed hits. **How that could pass while the
  intent fails:** the checklist matches named objects. Unidentified props that *read* as modern (the red cylinder, drum,
  plastic-looking tiles, skirting trim, blue-windowed blocks) are not on it. A player who takes them for a gas bottle or
  apartment blocks is taken out of 467 just the same. The check needs a "reads as modern" question per prop, not only name
  matching.
- **Also, for the scanned frames (3, 5, 7):** "scan applied" (T-A7) can pass while the intent fails, because the scan chosen is
  the wrong material (rock relief on mud plaster). T-A7 should require the scan to match the photographed material class, or
  T-A2 statistics must be taken against the mud-wall photographs at arm's length.
- **Detectors that should have caught each failure.** Every relevant detector is status `to-build`. These are therefore
  unbuilt-detector gaps rather than escapes by a running detector. Each should still be logged in REVIEWS/escapes.md so that
  the detector is built to catch it:
  - **Flat walls and flat ground (frames 2, 4, 6, 8):** T-A2f/T-A2f2 (flat-region share) and T-A7 should catch these. The walls
    are large connected regions with very low luma variance.
  - **Grey tiled socle band:** T-A7 (a scan exists) and T-A1 (placeholder pixels).
  - **The clone crowd (frames 1, 6):**
    - T-E1 (twin pairs within 15 m) and T-E1l (crowd lineups) should catch it.
    - The Walker Test hard break "a work plan drawn as a standing figure" should be widened to "a work plan drawn without its
      work". Kneeling at nothing is the same failure, and no listed detector catches it.
  - **Missing lane furniture (doors, spouts, rubbish) and the missing yard trade equipment:** no detector on the board catches
    "absent that a real 467 lane would hold". Only a reviewer finds it. T-A0's Tier-1 hard-fail list could add "blank wall
    run > N m with no opening".
  - **Faceted jar:** no silhouette-polygon check exists. It is a T-A1m (meshes tiered and sourced) question if the jar is a
    stand-in.
  - **Aliased socle edge and possible shimmer:** these need motion clips; T-A4 anti-proxy ("in motion with sound") is unmet by
    this still-only sample.

## Summary for the board

Uncalibrated scores (no anchor set exists).

| frame | view | geometry | materials | light | scale/density | life | reads as CG |
|---|---|---|---|---|---|---|---|
| 1 | yard | 2 | 2 | 2 | 2 | 1 | yes |
| 2 | lane | 2 | 1 | 2 | 2 | 1 | yes |
| 3 | court | 3 | 2 | 3 | 3 | 2 | yes |
| 4 | junction | 2 | 1 | 2 | 2 | 1 | yes |
| 5 | lane | 2 | 2 | 2 | 2 | 1 | yes |
| 6 | yard | 2 | 1 | 2 | 2 | 1 | yes |
| 7 | junction | 2 | 2 | 2 | 2 | 2 | yes |
| 8 | court | 3 | 1 | 3 | 3 | 2 | yes |

- T-A4 fails, and T-A4cg = 8.
- T-A7 is likely failing, but it needs measuring.
- T-I1 has 0 confirmed hits, with 6 read-as-modern risks.
- Every frame was judged as a still at `high`, not `ultra`, at one month, hour band and weather only.
