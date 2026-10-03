# s18 C15: beyond the Terrace (D-800), report

Branch `cloud-s18-c15-beyond`. Owned files: src/world/plain/naqsh.ts (+ new naqsh_paint.ts, naqsh_life.ts,
naqsh_captions.json), plain/villagehouses.ts, settlement/compounds.ts (untouched), the estates/pavilion/hall block of
settlement/plan.ts (+ new settlement/estates.ts).

## Broken, placeholder or unseen (read first)

- **The Elamite and Babylonian of DNa and DNb are still not carved** (Q-1730). A sub-agent searched every reachable open
  source: ORACC ARIo (oracc/catf, CC0) edits these two texts in Old Persian only, and so do the ARIo JSON mirror, SLAB-NLP/Akk
  and the CDLI composites. No Hugging Face or GitHub dataset has them. The versions exist in print alone. Nothing was invented;
  the panels carry the Old Persian alone, flagged PLACEHOLDER in the carved mesh's note.
- **DNc, DNd and DNe are carved but cannot be picked.** They are carved from the edition and have translations, but have no pick
  rectangle (the plain is at its 40-mesh cap), so the translation layer cannot be opened on them yet.
- **The estate houses' walls.** C2's D-668, merged at the end, now washes plot kind `elite` white, so the walls behind the
  porches should read white. This is unseen: the frames predate it. Interiors are not painted (not mine).
- **Roofs from below.** Prop boxes have no bottom face (C2's build.ts), so the pavilion's, the hall's and the porches' roofs
  read only as edges from below. I asked for a `Prop.bottom` flag; estates.ts already sets it on every overhead box.
- **Mesh and triangle counts.** The estates add one settlement mesh. Two tests fail on the s17-int base itself, not because
  of this branch:
  - tests/language.test.ts 'every raster … registered': public/textures/plaster001.
  - the settlement mesh cap: 55 meshes against a limit of 45 on the base, 56 with this branch.
- **Village gates are not painted.** TownDoors paints only when `variants > 1`, and villages use 1 (C2's towndoors.ts). The
  cloths and dung cakes are on the far level only; when a tile is drawn near they give way to the near level's own things.
- **The tomb-cutters and the visitors are not simulated.** The scaffold, the spoil and the lean-to stand empty unless C1 adds a
  crew (asked). The keepers' house is built, but popgeo's `naqsh:house` indoor spot still says NOT BUILT (asked C1).
- **Unseen on the T4.** The only frames are crude SwiftShader ones (below). The gold's look (metal plus skylight), the paint's
  strength at 50–200 m and the glazed friezes' colours have not been judged on the GPU machine.

## What a player now meets (measured)

- **Naqsh-e Rustam.** Both façades' architecture is painted and gilded, while the reliefs' ground stays bare stone:
  - Darius' tomb: a measured share of its 21,702 façade vertices painted (tests/naqsh_life.test.ts asserts a share between 15 and 90 %), with
    gilded horns, throne legs and studs.
  - The Ka'ba is a fresh, finer white.
  - Before the second façade stands a scaffold of 16 standards with ledgers, transoms, 4 plank decks, ladders and the cutters'
    baskets. Below it lies a pale talus of fresh chips with spalls, and at the foot the cutters' lean-to: bench, whetstone, water
    jar, tool baskets, spare poles.
  - The keepers' whitewashed courtyard house has two rooms with open doorways, a tannur, a sheep pen and a fleece on the roof.
  - The offering table before Darius' tomb holds bowls of flour, wine and water, the barsom and flowers, with a mat before it.
  - All of this adds 7.8 k triangles in one draw; the plain stays at 40 meshes and 1.87 M triangles (cap 2.0 M).
- **The estates.** Each of the four has:
  - a nine-column garden porch;
  - a four-column talar in the court on dark stone bases;
  - a gatehouse with glazed friezes and a painted lintel;
  - a four-part garden whose stone-lined channels cross at the pool.

  Their 15 columns and piers per estate stand as the town's `column` fittings (colliders and the far level).
- **The pavilion.** It stands on a two-step platform with a dark top course. Its porch has 2 × 4 painted columns on bell bases,
  and its room is white over a red dado, with a dark stone doorframe and a red-painted floor. A glazed frieze and a deep eave
  run along the front.
- **The Dasht-e Gohar hall.** 20 painted columns (white and dark bases alternating) stand on a stone stylobate. The back half is
  walled white over a red dado and has a red floor, and the painted beams carry a frieze and an eave board.
- **The villages.**
  - From afar, the far level carries each household's wash by C2's draw (white, ochre, red, or bare mud for most of the poor).
    tests/villages_life.test.ts keeps the table equal to houses.ts.
  - 38 % of households have a cloth or two drying over the eave, in madder, woad, weld, undyed or brown.
  - 45 % have a straw and fodder stack on the roof, and 30 % of the wings carry brushwood.
  - The dung cakes were cut again for the plain's triangle cap: s17-int was already over it, at 2.01 M against 2.0 M.

## Round 2 (lead 3), pushed and tested; not rendered
- **D-801, the roads** (src/world/plain/wayside.ts, in the nr-life draw):
  - Along the first 9 km of each of the 4 roads, and the Naqsh-e Rustam road its whole length, there are 12 wells, 12 halts
    each with an ox-cart, and 10 field shrines (ash and wood; the fire is the people's action). They cost 6.7 k triangles.
  - The droppings on the road are left to roadLitter.ts.
  - Paid for inside the plain's 2.0 M: the threshing kerbs went from 26 stones to 12, and the roof stacks have 3 faces.
- **The Naqsh-e Rustam ground:** the keepers' sheepfold, well and trough, garden and fuel stack, and trodden paths from the
  house to the table, the Ka'ba's stair and the works.
- **The estates' roofs are drawn from below**, through C2's Prop.bottom.
- **road_pasargadae:** nothing to change. D-730 already took it off Kuh-e Rahmat; measured, it stays between −14 and +9 m of
  its start over 12.8 km.
- **Unseen:** a render of the halts, wells and shrines was stopped at the reset, so their placement has not been looked at in a
  frame.

## Frames (crude, SwiftShader, `?webgl=1`, 1280 × 720, day 25 10:00 clear)

Before: `origin/s17-int` 803a0e76 (06:00). After: this branch at 4f3ab187. Since then: the village yards are trodden earth
(1a3863f2), and the villages and estates follow C2's D-668 washes (merged at 931db695). All frames are in handoff/s18/c15/ as
before_*.jpg and after_*.jpg. They are crude frames for placement and emptiness only, not for the look.

| view | before | after |
|---|---|---|
| naqsh-50 (54 m before Darius' tomb, looking N) | bare stone façades on a bare cliff, empty ground | the façades' bands painted (red/blue/green fasciae, the throne's beams), the second façade under its pole scaffold with 4 decks, the pale spoil and the cutters' lean-to at its foot, the white offering table |
| naqsh-150 | an empty plain before the cliff; the Ka'ba | the same with the scaffold and spoil readable; the ground still empty of people (C1 ask) |
| naqsh-tomb2 (after only) | — | the scaffold over the second façade, its painted bands showing through, the spoil, the lean-to |
| estate1-gate | (camera placed against the outer wall: not comparable) | the gatehouse: two white piers on red dados, the glazed frieze of white/turquoise/yellow, the trees over the wall; the house behind still bare mud |
| estate1-porch (after only) | — | the garden porch: red-ochre shafts with blue/yellow bands on white bell bases, blue bracket capitals, the glazed frieze, the cushions; the house wall behind bare mud (C2 ask) |
| pavilion | mud box walls, plain columns, a flat slab | a white room on a red dado and a dark doorframe, red shafts on bell bases, painted beams, the frieze; **the roof reads only as an edge from below** (props have no bottom face: C2 ask) |
| village-60 | a tree fills the view (camera) | the same tree (the open-view probe did not turn from it): not comparable |
| village-15m (after only) | — | the near level: compounds full of people (357 drawn), some washed lighter; **the yards were green lawns**, since fixed by trodden-earth yards (1a3863f2, not yet rendered) |


## Tests
tests/naqsh_life.test.ts, tests/estates.test.ts and tests/villages_life.test.ts are new and pass. tests/plain.test.ts (33),
tests/villages.test.ts and tests/monuments_samplers.test.ts pass. tests/settlement.test.ts and tests/settlement_build.test.ts
fail 6 tests, the same 6 with identical messages as on the base head (the lower-city belt), plus the one-mesh rise noted above.
