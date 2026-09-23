# The plain and the gardens at close range (session 4, plain-look agent; D-149)

Branch `worktree-agent-a0ae439b76e3139af`, from `claude/amazing-fermi-40ds7j` at b6badce. Not pushed, not merged. The decision entry is D-149 in DECISIONS.md; open questions are Q-210 to Q-214.

## Read first: still weak, failing or unverified

- **The tree lab r3 check fails for the oak at high.**
  - This is the first r3 match ever run at high quality (225 m; shots/treelab-r3-high.json).
  - Plane, poplar, apple and cypress impostors are within 4/255 of LOD1. Willow is 11-13/255 darker; oak is 14-16/255 darker, over the spec's 14/255 limit.
  - Session 3 measured the oak within 1/255, but at quality test. The comparison run on the old code at high was stopped at session end, so whether this is new is not known.
  - Likely cause: a specular sheen from the smooth crown normal (LOD1 roughness 0.75, impostors 0.8). The near-plane lab frame shows the sunlit crown top grey-white (sRGB 77/90/93). The lower leaf albedo makes the sheen a larger share.
  - Proposed fix, not applied: one roughness of ~0.92 for every leaf material, then a re-run.
- **The last two look commits are not rendered:**
  - the river margins' pop-free placement (50a1812);
  - the cypress without clump shading (28388b8).
  - The final renders predate them; renders were stopped at session end.
- **All values are tier C unless sourced.** The phenology rests on search extracts from Shiraz, Estahban and a Turkish plane stand: B there, C for the plain in 467.
- **Leaf albedo ×0.6 is a judgement** (generic leaf optics and one measured render). A sunlit crown's median is still 0.75-0.97 of the sunlit sward beside it; in photographs it is nearer half.
- **Leaf transmission ignores shadow maps.** A back-lit crown in a building's shadow still glows.
- **The river's far-bank reflection is modelled.** The bank's height and colour are modelled, and the trees are placed by noise. It can reflect a tree that is not there.
- **The tamarisks still read as reddish blotches in April.**
- **Close up (3-8 m), leaf clumps still read as cut-out cards.** In the garden, the sunlit cypresses were too light and scaly in the final render (the clump change aimed at this is unrendered).
- **The garden view is dark** (mean luma 27.7). The cause is not the trees: the camera is under a closed canopy at outdoor exposure, and the soil (materials.ts) is dark in shade.
- **White speckles on shaded trunks at P22.** Probably SSGI noise; they were there before this work. Not investigated.
- **P22 is further over the Phase 7 plain limit.** It adds 2.564 M triangles, against the ≤ 2 M limit set at quality test; it was 2.338 M before.
- **Kit build time is not measured cleanly.** Browser runs: 3.3-5.1 s, against 2.8-4.3 s before, under different loads. In node, back to back: models +30 %, atlas and bake about equal.

## What changed

- **Trees** (`src/world/trees/*`, `src/data/trees.json`):
  - leaf tiles in ragged clumps, so cards stay lobed at the coarse mips;
  - crowns built as masses at the branch tips, with hollows between them;
  - one shading model (`shade.ts`) for the shader and the baker: crown and clump normals, occlusion per texel, leaf transmission toward the sun;
  - per-tree hue, and variants that leaf out a little apart;
  - LOD1 with 120 smaller cards (was 80); the plain's r3 0.9× (high 225 m) to pay for it;
  - per-species bare-twig share and card shape;
  - leaf albedo ×0.6;
  - an allocation-free impostor bake.
- **Season** (`seasonal.ts`):
  - pomegranate in young, reddish leaf on 17 April (was bare);
  - figs in first leaf;
  - planes in young leaf;
  - vine rows as 0.5 m stocks at budburst (were 1.1 m and a third green);
  - barley and wheat at 0.6 m, as sourced.
- **Water** (`waterShade.ts`, used by the rivers, the canals and the town's pools and channels):
  - band-limited, advected noise ripples, faded by the pixel footprint;
  - absorption with depth;
  - Fresnel sky, and the far bank's reflection.
- **Banks:** wet film, damp band, silt only below the flood line, a riparian sward above it. The fix: silt had covered the whole apron.
- **River margins** (`riparian.ts`, new):
  - reed beds with last year's pale culms, rushes and bank grass, and the same along the canals;
  - one draw call;
  - coverage-preserving blade widening;
  - placed out to their radius plus the re-placement step, so nothing pops in.
- **Garden channels** (`settlement/water.ts`): jointed limestone blocks, lips 7 cm proud, a basin every 13.5 m (Pasargadae analogy). They replace the white kerbs.

## Measured (quality high, WebGPU/SwiftShader, 960×540; the plain's share, shown vs hidden)

| view | before | after |
|---|---|---|
| stair-dawn-plain | +15 calls, 0.962 M | +15, 0.962 M |
| apadana-north-nr | +18, 0.951 M | +20, 0.951 M |
| stair-foot-east | +10, 0.797 M | +10, 0.797 M |
| pulvar-bank-april | +26, 0.881 M | +27, 0.984 M (6,705 tufts) |
| village-p22 | +40, 2.338 M | +41, 2.564 M (near trees 0.671 → 0.735 M) |
| garden-paradise | +12, 0.896 M | +12, 0.896 M; the town adds +39 calls, 1.647 M (first measured) |

- Crowns against the sunlit sward at the Pulvar bank:
  - foliage median Y 0.077-0.087 → 0.052-0.066;
  - top decile 0.19-0.20 → 0.14-0.15;
  - sward 0.069.
- River band: before blue-grey with regular stripes (row profile ±7.1 %); after the olive of the reflected bank (±0.9 %).
- Whole town headless: 0.823 → 0.840 M triangles (channel stones).
- Checks:
  - `npx tsc --noEmit` clean;
  - unit suite 413 passed, 1 skipped (run before the cypress clump commit; trees.test passes after it);
  - `tools/lint_chrono.ts` OK.

## Renders

- In `/home/user/fars/shots/agent-plain/`:
  - `plain-pulvar-bank-april-high-webgpu.png`
  - `plain-village-p22-high-webgpu.png`
  - `plain-garden-paradise-high-webgpu.png`
  - the three budget views
  - `plain-stats.json`
- These are the look as of commit 031e6ae (see above for what is not in them).
- The tree lab sheets and `treelab-r3-high.json` are in the worktree's `shots/`.

## Files outside the plain/tree set

- `settlement/build.ts`: one line, the kerbs call removed; `kerbs()` left unused.
- `sources.json`: seven search-extract sources.
- `plain.json`: `riparian.margins`.
- research: PLAIN.md, SETTLEMENT.md and OPEN_QUESTIONS.md (Q-210 to Q-214).
- The e2e specs `plain.spec.ts` (the town's share) and `treelab.spec.ts` (the R3 map).

## For the main session (materials.ts and the pipeline)

- The garden soil in shade is Y ≈ 0.011, and under a canopy the frame mean falls to 28/255. Canopy-aware eye adaptation (D-141 extended to tree cover) would help more than any albedo change.
- Check SSGI convergence on shaded trunks in frozen test frames.
