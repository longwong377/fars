# D-285 Terrace materials: independent review (materials category, session 11)

Reviewer: independent subagent. Branch s11-d285-materials. **Uncalibrated:** REVIEWS/anchors/ does not exist on this branch (T-R1 unbuilt), so no anchor set was scored and these scores carry no calibration.

## What is broken or reads as CG (lead)

Every frame reads as CG. No frame reaches 4, so **T-A4 (>= 4) FAILS and T-A4cg (<= 0) FAILS, with 7 of 7 frames reading as CG.** Neither version of the materials is close to the bar.

- **Terrace ashlar, far (1, 2).** The wall looks like a cool white-grey grid of small, even blocks, like a tiled box. Compared with #24 (same camera), it lacks the huge, irregular-height courses, the megalithic lower blocks and the warm honey-buff colour. There is also no raking relief from the low WSW sun. The palace mud walls above are untextured tan slabs. The sandy dome at the lower left looks like a placeholder.
- **Terrace ashlar, near (7).** This one is the worst. The polygonal "stones" have constant-width, bevelled grout lines like floor tile. Persepolis joints are dry-laid hairlines with no mortar. Each face carries regular horizontal sine-wave stripes and evenly spaced wavy hairlines, which look procedural. There are no tool marks, arris wear or block-to-block colour shifts. It also **contradicts frames 1-2**, which show rectangular coursed ashlar down to the foot of the same wall, and #24 shows coursed ashlar too.
- **Gate plaster, far (3, 4).** A large flat tan field with only low-frequency blotching. The doorway interior is crushed to pure black by day. The lamassu and jambs are near-white and read as untextured, like a clay render; the Gate references show carved, shadow-rich stone. The glazed panel is flat stripes. A thin, bright, even-width wavy line runs along the wall base (a salt or damp line?) and looks like a decal.
- **Gate plaster, near (5, 6).** The craze cracks are thin, even-width Voronoi cell networks in isolated patches, a standard procedural tell. The same base line appears. A dark blob at the lower right is rendered as a **dither/stipple pattern** (screen-door transparency or a shadow artifact), which is a hard CG giveaway. Frame 6 adds the problems listed under pair 5 vs 6.

## Scores

| Frame | View | Materials 1-5 | Reads as CG | Main reason |
|---|---|---|---|---|
| 1 | #24 camera, Terrace W wall | 2 | yes | Small, uniform, cool-grey tiled blocks; no raking relief; flat mud walls |
| 2 | same | 2 | yes | No visible difference from 1 |
| 3 | Gate from stair landing | 2 | yes | Flat blotchy plaster; black-crushed doorway; untextured white lamassu; decal-like base line |
| 4 | same | 2 | yes | No visible difference from 3 |
| 5 | Gate W wall at 5 m | 2 | yes | Voronoi craze patches; dithered dark blob; otherwise plausible plain plaster |
| 6 | same | 1 | yes | Adds aliased, dashed "course" joints and stretched streak grain on a mud-plastered wall; dither blob |
| 7 | Terrace W wall foot at 4.5 m | 1 | yes | Tile-like polygonal blocks with bevelled grout, sine-stripe faces; contradicts 1-2 and #24 |

## Pair comparisons

- **1 vs 2: no difference I can see.** The files differ byte-wise, but at 960x540 the stone and plaster look the same. Whatever changed does not show at this distance.
- **3 vs 4: no difference I can see**, for the same reason: the change does not show at stair-landing distance.
- **5 vs 6: 5 reads more real.** Frame 6 adds horizontal joint lines about 0.6-0.7 m apart (my estimate from the fov and 5 m distance). That is too far apart for mud-brick courses and wrong for a plastered wall. The joints also break into stair-stepped dashes (aliasing or texture seams), and the faces carry directional, stretched streaks that look like UV stretch rather than trowel marks. Frame 5 is bland and blotchy but at least plausible as fresh plaster. Both share the Voronoi crazing, the base line and the dither blob.

Overall, the version difference only shows at close range (5/6), and there it makes things worse. At the distances where the Terrace is usually seen (1-4), the two versions look the same.

## Scope and conditions (fixed clauses 1-4)

- None of the frames is at the player's quality: all are `test`, not `ultra`. Frames 1-2 (fov 34.4°) are also not at the player's lens; 3-7 use fov 40-46°, and I cannot confirm the default FOV.
- All items are stills, so pop, shimmer, texture swimming on the dashed joints, moiré on the Voronoi cracks and sound are unjudged.
- One time stratum only: day 303 (early February), 16:05 LMT, clear, low WSW sun. Unjudged: other hours (noon, golden hour, night), other seasons, overcast, rain, dust and wet stone.
- Seven views of two wall classes cannot show the other retaining-wall faces, the stairs, the other palaces' plaster, or interiors. The 7-vs-1 inconsistency suggests the wall material is not coherent along a single wall.

## References judged against

`persepolis and the mountain behind the ruins 2.webp` (#24), `stairs today.webp`, `The Gate of All Nations 2.webp`, `The Gate of All Nations 3.webp`, `The Gate of All Nations 4.jpg`, `gate of all nations more.webp`, `reliefs.webp` (near-fresh stone: warm buff, crisp arrises), `bulls.png`, `more bulls.png`, `lamassu statues.png`, `more interior.png`. All of them opened. The Getty images are renders; I used them only for plaster and polychromy intent, not as photographic truth. No memory (C-labelled) judgments were needed.

## Proxy hunt

- **PASSes given: none**, so there is no pass-while-intent-fails case to answer.
- **Detector escapes (for REVIEWS/escapes.md, T-R0):**
  - The black-crushed doorway in 3/4 should be caught by **T-A3k** (black crush by day). If it passed, that is an escape.
  - The large flat plaster fields in 3/4 and 5 should show up in **T-A2f/T-A2f2** (flat-region share). If they passed, the 12 px Ystd/Y test is being satisfied by low-frequency blotch noise that does not read as texture. That is a proxy escape.
  - The tile-grout look of 7, the aliased dashed joints of 6 and the dither blob in 5/6 are **not covered by any detector I can see on the board**. These are escapes to log; a joint-width or regularity metric and a dither or high-frequency-pattern detector are candidates.
  - Frames 1-2 would fail **T-A5** (the blind paired photo test against #24) on colour and block scale alone.
