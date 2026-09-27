# The Blender asset pipeline: inventory, pipeline, rollout (D-305, session 11)

**Status (read first; D-306).** The pipeline runs from a clean checkout (`node tools/blender/build.mjs`: every asset; `--verify`
reproduces byte for byte, or where Blender's Draco bitstream varies, in decoded content within tolerance; `--check` lists
stale assets). Four assets are in the game, all with KTX2 maps (UASTC + zstd, BC7 on the T4): the double-bull protome (210
capitals) and the composite capitals' volute member, both carved with the motifs of the photographed capitals (bead rows,
collar and rosettes, pendant, mane; rosette-ended rolls), and the Gate's four colossi (bulls, human-headed bulls) with
their collar, bead rows, mane, feather barbs. The carving is map-only relief on the bake's source (tools/blender/carving.json,
lib/carving.ts). **Not done / placeholder:** the capitals and colossi still read as CG to a blind reviewer (capitals 2/5,
colossi 1/5; B118): the FORM of the tier-C models is what fails (Q-842, B120), and the carving's sizes are by eye (Q-840);
the palm and calyx bells are not baked (row 1); the volute member's reeded panel shows seam streaks in its map; the other
protome types of Persepolis (griffin, lion) are not modelled (Q-843); impostors are designed here but not built; the Hall of
100 Columns' columns under construction and the masons' yard capitals still draw the procedural protome (not my files).

## 1. What Blender adds, and what it cannot

Every surface of the world is procedural or scanned: **no geometry in the project has UVs** (the materials are world-space
node materials with triplanar scans, src/render/materials.ts, src/render/scans.ts). Blender adds four things the runtime
cannot afford or the node tools cannot do:

1. **Baked detail**: normal and occlusion maps transferred from a surface 10-1000x denser than the game can draw
   (Cycles, selected-to-active, on the T4: seconds per asset). The carving the triangles cannot carry is kept; the
   triangle budget stays where it is.
2. **UVs and tangents** (Smart UV Project, MikkTSpace): the precondition of every baked map.
3. **Real modelling operations** the project's own generators lack: booleans, bevels with weighted normals, remeshing,
   decimation that keeps silhouettes, cloth simulation baked to meshes (garment drape), hair cards, rigging and weight
   transfer, octahedral impostor renders with normals and depth.
4. **Standard packaging**: GLB with Draco geometry (and KTX2 textures once the KTX tools are installed), loadable by three's
   GLTFLoader.

Blender cannot help with: the sky, clouds and atmosphere (analytic, src/sky), weather and fire VFX (shader volumes and
billboards), audio (procedural Web Audio, eSpeak voices), the simulation (people, construction, weather state), the
terrain (the Copernicus DEM is the evidence; Blender would only resample it), the text layers, and **evidence**: a model
is only as faithful as the numbers that drive it (CLAUDE.md §3.1). Blender scripts here take their numbers from
research/SITE_SPEC.md, src/data/*.json and the project's own generators; nothing is shaped by hand in a .blend file.

## 2. The ranked inventory (measured and stated numbers)

Scores: **P** payoff 1-5 (how close the player stands to it × how crude it is now × how much of the walkable world shows it);
**E** effort in agent-days with this pipeline; **R** runtime delta (triangles, draws, GPU memory, download). Order = P/E with
the placeholder flags first. Counts from `buildTerrace()`, `public/generated/*.json`, the tests' budgets and bench-reports
(the inventory of session 11, D-305); "n.s." = not stated anywhere.

| # | Asset class (files) | Now | Instances | Triangles now (budget) | Nearest view | P | E | What Blender does | R (target) |
|---|---|---|---|---|---|---|---|---|---|
| 1 | **Column capitals: protome, volute, palm and calyx bells** (arch/sculpt.ts, sculpt_models.ts) | SDF → MC → simplify; carving C | 210 protomes, 88 volutes (composite), 580 columns | protome 8,816 / 1,074; volute 2,538 / 296; column 14.9-24.4 k / 2.0-2.9 k (25 k / 3 k) | 4-15 m below (palaces), 1.5 m (masons' yard) | 5 | 1 (done for the protome) | bake normal + AO from a 2x finer SDF; next: the volute and bells (same script), then **richer source detail** (bead rows, harness, rosettes of the photographs) as map-only relief | +2 draws per order, 0 tris; 2.0 MB GLB, 6.8 MB GPU (1.7 MB with KTX2) |
| 2 | **Gate colossi** (4; sculpt_models.ts colossusSDF) | SDF + lock templates; C | 4 | 49 k / 4.9 k each (50 k / 5 k) | 1-3 m (the Gate's passage) | 5 | 1 | the protome's script with colossusSDF at cell 0.007 m (half the game's), locks at 1,500 tris: beard and wing feathers into the normal map | 0 tris; ~3 MB GLB (2 levels × 2 models × 2048 px) |
| 3 | **Relief figures** (927 in 9 sets, 41 kinds; arch/relief_*.ts) | heightfield RTIN, 5 LODs, placeholder (NEEDS #10) | 927 | 0.62-1.45 M submitted before a panel | 0.5-2 m (every stair) | 5 | 4 | per figure kind: bake the finest heightfield (1.6 mm cells) into a normal + AO atlas and draw LOD1-2 triangles with it at arm's length: ~4x fewer triangles for the same relief; later, figure meshes modelled from the kind's outlines (hair, drapery folds) | -0.6 to -1 M tris; +~40 MB of atlases at 1 mm/texel (KTX2 needed) |
| 4 | **Animals** (34 species; people/animals.ts) | scaled spheres and tubes, vertex rig | fauna < 400 k tris; ~1 k tris each | <= 1,100 per species | 2-5 m (streets, fields, the Gate's teams) | 5 | 5 | modelled bodies from species proportions (src/data/fauna.json), one rig per family (bovid, equid, camelid, ovicaprid, canid, felid), weights transferred, the vertex-shader cycles re-targeted; baked coat maps | 3-6 k tris LOD0 + LODs; ~1 MB per family |
| 5 | **Garments** (people/outfits.ts, drape.ts) | body shells + swept rings, no simulation | 8 costumes × 4 LODs | [42 k, 7 k, 3.2 k, 800] | 1-3 m (conversation) | 5 | 5 | cloth simulation of each costume's pattern on the MakeHuman body in its rest pose, baked to meshes and to fold normal maps; skin weights transferred from the body | same budgets + one 1024 px fold map per costume |
| 6 | **Hair, beards** (people/looks.ts) | shells | every person | inside the costume budget | 1-3 m | 4 | 3 | hair cards (the Persian curled beard and the fillet-bound hair of the reliefs) with alpha + normal atlases | +2-4 k tris per head LOD0 |
| 7 | **Trees** (15 species × 3; world/trees) | procedural skeleton + cards; impostors CPU-baked | orchards, gardens, the plain | ~1.4 k / 0.37 k (near trees < 1.2 M) | 2-10 m | 4 | 3 | branch meshes with bark UVs from the same skeletons; leaf-card atlases rendered from modelled leaves; octahedral impostors with normals and depth rendered in Cycles | same budgets; +8 MB of atlases |
| 8 | **Town and village houses** (settlement/houses.ts, plain/villages.ts) | boxes, prisms, lathes; C | 1,505 town plots, 37 villages | settlement <= 1.2 M, plain < 2.0 M | 1 m (every lane) | 4 | 3 | a kit of eroded mud-brick pieces (wall ends, parapet caps, roof edges and rainspouts, thresholds, ladders, doors) with baked AO and normal detail, placed by the existing generators | ~same triangles; ~6 MB kit |
| 9 | **Palace furnishings** (world/furnish_palaces.ts; interiors agent) | box / cylinder / lathe | 271 in use | 47 k in use | 1-2 m | 4 | 2 | throne and footstool with lion paws and bull legs (the Treasury relief), couches, incense burners (Apadana relief), carpets with pile normal maps | +20 k tris; ~4 MB |
| 10 | **Treasury goods, jars, pottery** (world/furnish.ts; interiors agent) | lathes and boxes | ~10 types, hundreds | n.s. | 1 m | 3 | 1 | worn rims, chips, throwing ridges and AO baked onto the existing lathes (same script as the protome) | 0 tris; ~2 MB |
| 11 | **Doors** (arch/doors.ts) | boxes, cylinders, spheres | 108 leaves | n.s. | 0.5-2 m | 3 | 1 | leaves with plank joints, bronze bands and bosses as baked detail on the box | 0 tris; ~1 MB |
| 12 | **Held props and work objects** (people/props.ts, workObjects.ts) | primitives, vertex colours | 68 + ~60 kinds | unions <= 1,000 / 700; things < 1.2 M | 0.5-2 m | 3 | 3 | modelled props (bows, spears, jars, tools, looms, ards) at the same budgets with baked maps in one atlas per union class | same tris; ~4 MB atlas |
| 13 | **Ground flora** (world/groundFlora.ts) | boxes, spheres, planes | cushions capped at 900 | n.s. | 1-3 m | 3 | 2 | tragacanth cushions, camelthorn, thistles as card clusters with rendered atlases | ~same; ~2 MB |
| 14 | **Fire objects** (world/fire.ts, firePlaces.ts) | lathes, cylinders | braziers, lamps, altars, ovens | n.s. | 1-3 m | 3 | 1 | braziers and incense burners after the reliefs, lamps, ovens with soot AO | small |
| 15 | **Tol-e Ajori gate** (settlement/ajori.ts) | **placeholder** box massing | 1 | n.s. | 5-50 m | 3 | 2 | the gate's brick courses and glazed relief panels as modelled massing + baked panels | ~50 k tris |
| 16 | **Naqsh-e Rustam** (plain/naqsh.ts) | cliff sheet + façades; Elamite relief **placeholder** | 1 site | 7 draws | 2-20 m | 3 | 3 | the tomb façades' columns and entablature, the Ka'ba's blind windows, the cliff's fracture relief as maps | ~100 k tris |
| 17 | **Crenellations, frames, niches** (arch/decor.ts) | extrusions, bevelled boxes | 499 parapets, 128 door frames | n.s. | 1 m | 2 | 1 | edge wear and joint AO baked on the extrusion | 0 tris |
| 18 | **Court tents** (world/courtCamps.ts) | 20-tri shells | camps | <= 20 per tent | 2-10 m | 2 | 2 | cloth-simulated tents baked to meshes with guy ropes | +500 tris per tent |
| 19 | **Impostors: far buildings, people, trees** (people/impostors.ts, trees/impostor.ts) | CPU-rasterised in JS | beyond 90-600 m | 1 instanced quad draw | > 90 m | 2 | 2 | Cycles-rendered octahedral atlases with normal and depth (re-lit by the game's sun) | same draws; atlases |
| 20 | **Birds, small life** (world/wildlife.ts, smallLife.ts) | 20-72-tri diamonds and boxes | 27 bird kinds, ~15 small kinds | ~20 each | 2-50 m | 2 | 2 | low-poly modelled birds with wing flap in the vertex shader | ~200 tris each |
| - | Terrace walls, steps, floors, roofs (arch/terrace.ts, meshes.ts) | 3,681 bevelled boxes (D-157) | - | 34-55 k | 0.3 m | 2 | - | little: the masonry is shader-drawn and the bevels exist; the scans do the rest | - |
| - | Human bodies (MakeHuman, imported) | real mesh, 3 LODs | - | 29.8 k / 5.4 k / 1.3 k | 1 m | - | - | not a Blender target except garments and hair (rows 5-6); the skin is baked in node | - |
| - | Sky, weather, fire VFX, audio, simulation, terrain | - | - | - | - | - | - | **not Blender's** | - |

## 3. The pipeline (tools/blender/)

| File | Role |
|---|---|
| `assets.json` | the registry: per asset the source script and its arguments (with the reasoning for each technical number, tier C), the files and SITE_SPEC values it reads, the levels' map sizes, the bake settings, the budgets, tier, sources, ledger row |
| `sources/<asset>.ts` | node, the project's own model code: writes `high.ply` (the dense surface) and `lod<i>.ply` (the game's levels) with their normals (lib/ply.ts) |
| `bake.py` | Blender 5.0.1 headless: import (y-up → z-up), weld crease-split corners, Smart UV Project, Cycles selected-to-active normal (tangent) and AO bakes with the levels invisible to rays, pack normal RGB + AO A into one PNG per level (one sampler, D-295), export GLB (Draco 14/10/12/12 bits, MikkTSpace tangents) |
| `build.mjs` | the one command: hash inputs, write sources, bake (CPU by default: byte-reproducible; `--device=GPU` through `gpu_slot.mjs` for heavy bakes, reproduced 1 of 2 times), KTX2 when `ktx` exists, measure, check budgets, write `public/models/<id>.glb` + `manifest.json`, copy three's Draco and Basis decoders to `public/models/lib/`; `--verify` rebuilds and compares bytes; `--check` lists stale assets |
| `lib/glb.mjs`, `lib/inputs.mjs` | GLB measuring and repacking; the input hash (shared with the test) |
| `preview.py` | a node-side contact sheet: the level plain, baked, and its occlusion, from a 3/4 view (Cycles, CPU) |

In the game: `src/render/models.ts` loads the manifest's models at startup (GLTFLoader + DRACOLoader, KTX2Loader when a
model has KTX2 maps; decoders from `/models/lib/`), `model(id)` returns the levels or null (then the builder draws its
procedural stand-in: nothing is ever missing), `fitLevel` fits a level to the stand-in's box, `bakedMaterial(surface, map)`
is the project's own surface (albedo, layers, scans, weather) with the baked normal under the surface's own fine relief
and the baked occlusion on the indirect light. `?models=0` switches every model off; `window.__models.ab(false)` swaps the
drawn instances back to the stand-ins for A/B renders.

**Tests** (tests/blender_assets.test.ts): every registered asset is built, listed and ledgered; its file is the one the
build recorded (sha256); it is current (its inputs hash as at build: data, model code, bake settings, SITE_SPEC values);
it was reproduced byte for byte by `--verify`; it stays within its triangle, map, download and GPU budgets; each level has
UVs, normals, tangents (Draco) and its map, and the maps are not blank; the served decoders are three's own; for the
protome: the levels keep the game's triangles, column-without-protome + protome = column, the fitted boxes agree,
`fitLevel` keeps normals unit and tangents perpendicular, the baked material has its normal and occlusion nodes.

**Budgets (T-K rows).** T-K7 first-load download <= 60 MB (public/ already holds ~91 MB: textures 58, generated 30, so the
first load is not yet measured against it; every model adds its GLB); T-K8 GPU memory <= 3.5 GB in the heaviest view
(a 1024 px PNG map costs 5.6 MB decoded, a KTX2 UASTC one 1.4 MB); T-K6 frame time: each model adds one instanced draw
per level per order group (the protome: 16 instanced meshes, 8 order groups × 2 levels, of which the visible ones draw; plus their shadow passes), no triangles.

## 4. The rollout: order, sources, budgets, who uses it

| Order | Area / class | Owner (area agent) | Drives it | Budget | How |
|---|---|---|---|---|---|
| 1 | Capitals: volute, palm and calyx bells, bases (row 1) | Terrace exteriors | sculpture.json, SITE_SPEC orders | 0 tris; 3 MB | add entries to assets.json with sources/volute.ts etc. (copy protome.ts: pieceModel + the game's pieces) |
| 2 | Gate colossi (row 2) | Terrace exteriors | sculpture.json colossus | 0 tris; 3 MB | sources/colossus.ts; the Gate's MeshLOD takes `bakedMaterial` as the columns do |
| 3 | Relief figures (row 3) | Terrace exteriors / reliefs | relief_figures.ts masses, RELIEFS_AND_COLOUR.md | -0.6 M tris; KTX2 required | a per-kind atlas bake of the finest heightfield; the RTIN levels 1-2 drawn with it near (needs UVs from the heightfield grid: trivial) |
| 4 | Capital and colossus source detail (bead rows, harness, rosettes, feathers) | Terrace exteriors | the photographs (fars-assets/photos/columns_capitals, gate_of_all_nations): tier B for the attested motifs, C for their layout | 0 tris | map-only relief added to the SDF of the high source only |
| 5 | Garments and hair (rows 5-6) | people | the costume patterns (outfits.ts), the reliefs' dress | same | cloth simulation per costume in Blender, baked to the costume LODs |
| 6 | Animals (row 4) | land / town | fauna.json proportions, species photos | 3-6 k tris | modelled families, weights, maps |
| 7 | Houses kit (row 8) | town | SETTLEMENT.md, town_plots.json | same | kit pieces placed by houses.ts |
| 8 | Furnishings, goods, doors, props (rows 9-12) | interiors / people | MATERIAL_CULTURE.md, the reliefs | small | the protome's script per object (bake onto the existing lathes) |
| 9 | Trees and flora (rows 7, 13) | land | trees.json | same | Cycles-rendered cards and impostors |
| 10 | Impostors (row 19) | lead | - | same | one `impostor.py` for any GLB: octahedral 8×8 atlas, normal + depth + albedo-free |

How an area agent uses it: write `tools/blender/sources/<asset>.ts` from the project's generator (numbers from the data,
reasoning for each technical value in the script), add the entry to `tools/blender/assets.json` with budgets, run
`node tools/blender/build.mjs <id>` then `--verify <id>`, add the ASSET_LEDGER row, and in the builder draw
`model(id)` with `bakedMaterial` when it is loaded (the procedural stand-in otherwise); render before/after with
`window.__models.ab`. Bakes run on the CPU by default (the protome in ~15 s on the 16 cores, no GPU slot, byte-reproducible);
`--device=GPU` (OptiX on the T4, through the GPU slots) for bakes too heavy for the CPU, accepting that its output may
not reproduce byte for byte. Iterate on node previews (`tools/blender/preview.py`, a contact sheet in ~15 s) and spend one
batched full-world render (tests/e2e/blender_hero.spec.ts is the pattern: A/B in one page load) as the final check.

## 5. What to install (asks for the lead)

- **Done (D-306):** KTX-Software 4.4.2 is installed and used (build.mjs finds it at its installer's path); the text below is D-305's.

- **KTX-Software 4.4.2** (installer already in C:\Users\Administrator\fars-assets\tools, Apache-2.0): puts `ktx` on the
  PATH; build.mjs then writes UASTC + zstd KTX2 maps with mipmaps (the protome: GPU 6.8 → ~1.7 MB; download about the same
  or smaller). Needed before the relief atlases (row 3). The KTX2 path in build.mjs (repackGLB + KTX2Loader) is written but
  **unverified** until then.

## 6. Measured on the hero (capital protome)

- **Build:** sources 60 s (node: marching cubes of the protome SDF at 0.005 D, 1.84 M triangles, locks at 1,500 triangles),
  bake 12 s CPU / 5 s OptiX, whole build ~60 s. GLB 2.04 MB (maps 1.68 + 0.13 MB PNG, Draco geometry 0.2 MB), GPU ~6.8 MB
  estimated (maps decoded RGBA8 + mips); LOD0 8,816 / LOD1 1,074 triangles = the game's own; +16 instanced meshes. Byte
  reproduction: CPU 3 of 3, GPU 1 of 2 (default made CPU).
- **Renders** (tests/e2e/blender_hero.spec.ts, one page load, Q=high, the player's 70° lens, 1600×900, 6 views × 2 hours,
  shots/blender/*-{before,after}.png, sheets shots/blender/sheet-*.png): the model loads in ~0.5 s; the frames differ on
  0.6-4.1 % of pixels (the capitals) by a mean 8-13 luma levels, almost all darker (the occlusion in the eye sockets, the
  lock grooves, under the folded forelegs and the horns' roots); draw calls and triangles equal between A and B (the swap
  keeps the instances); no WebGPU validation error (the extra sampler fits).
- **Reviewer's read (the agent's own, against fars-assets/photos/columns_capitals "Broken Bull Capital" and the Gate's
  capitals):** the bake does what it can: the heads gain eye sockets and a shadowed chest apron, the forms read more carved
  at 5-15 m. It does not make the capitals read as real stone carving: the model has none of the bead rows, harness bands,
  rosettes and ridged locks of the real capitals (Q-830), and the surface is uniformly clean. T-A4cg is not moved by this
  asset alone.
- **Found by the first render and fixed:** the model came out lying on its side (Blender's PLY importer ignored the axis
  options; every node test passed): the PLY is now written in Blender's axes and a test compares the GLB's bounds with the
  game's pieces.

## 7. Measured on the carving (D-306)

- **Build** (CPU, 16 cores): protome 117-191 s (source 86 s: 1.9 M triangles at 0.004 D), bull 113-157 s, lamassu 134-157 s
  (sources ~70 s: 3.3 M triangles at 0.008 m), volute 33-39 s. GLB 3.26 / 2.93 / 3.40 / 0.92 MB; GPU ~6.5 / 9.1 / 9.6 / 1.7 MB.
- **The relief lookup** (Relief.at: a spatial hash with each motif filed under every cell its reach touches): 0.4 us a call
  (18 us with string keys and 27-cell lookups: the protome source took over 5 min).
- **Reproduction:** protome, bull, volute byte-identical; the lamassu by content (Draco bitstream differs, decoded equal, 0
  texels differ). Earlier builds: one tangent component in ~190 k one step apart, one texel in 4.2 M one level apart.
- **In the game:** KTX2 maps transcode to BC7 (models.formats); frames change on 1.4-15 % of pixels by 7-13 luma levels,
  darker in the carving's hollows; triangles and draws unchanged between A and B. Blind review: REVIEWS/review_carving_s11.md.
- **Iterating:** tools/blender/preview_high.py renders a SOURCE surface (the carving before any bake) in ~20 s;
  tools/blender/probe/carving_probe.{html,ts,mjs} renders the carved pieces in the game's renderer without the world (load
  6 s + ~100 s of shader compiling), before/after per view, with calibration pieces on the ground for the photographs.
