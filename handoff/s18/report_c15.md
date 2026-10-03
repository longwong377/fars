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
- **The estates' houses are still bare mud** behind the new painted porches. Plot kind `elite` is not in C2's wash draw
  (houses.ts `HOUSE_KINDS`). I asked the lead/C2 for a one-line change. The rooms' interiors are not painted (interiors are not
  mine). Two smaller gaps: the porch roofs sit on per-prop ground heights (no group base), and the estates add one settlement
  mesh. The settlement test's mesh cap (45) was already failing at 55 before this work (C2's belt); it is now 56.
- **Village gates are not painted.** TownDoors paints only when `variants > 1`, and villages use 1 (C2's towndoors.ts). The
  cloths and dung cakes are on the far level only; when a tile is drawn near they give way to the near level's own things.
- **The tomb-cutters and the visitors are not simulated.** The scaffold, the spoil and the lean-to stand empty unless C1 adds a
  crew (asked). The keepers' house is built, but popgeo's `naqsh:house` indoor spot still says NOT BUILT (asked C1).
- **Unseen on the T4.** The only frames are crude SwiftShader ones (below). The gold's look (metal plus skylight), the paint's
  strength at 50–200 m and the glazed friezes' colours have not been judged on the GPU machine.

## What a player now meets (measured)

- **Naqsh-e Rustam.** Both façades' architecture is painted and gilded, while the reliefs' ground stays bare stone:
  - Darius' tomb: 6,0xx of 21,702 façade vertices painted (tests/naqsh_life.test.ts asserts a share between 15 and 90 %), with
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

## Frames (crude, SwiftShader, `?webgl=1`, 1280 × 720, day 25 10:00 clear)

FRAMES_PLACEHOLDER

## Tests
tests/naqsh_life.test.ts, tests/estates.test.ts and tests/villages_life.test.ts are new and pass. tests/plain.test.ts (33),
tests/villages.test.ts and tests/monuments_samplers.test.ts pass. tests/settlement.test.ts and tests/settlement_build.test.ts
fail 6 tests, the same 6 with identical messages as on the base head (the lower-city belt), plus the one-mesh rise noted above.
