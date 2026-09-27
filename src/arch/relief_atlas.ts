// The carved-relief atlas (D-320; research/BLENDER_PLAN.md row 3). Every relief figure definition drawn in the world (kind |
// seed: 927 figures, ~200 definitions) is carved once at the finest grid (RELIEF_ATLAS.texel_m on the stone) by
// tools/blender/relief_atlas.ts: its heightfield becomes a dense carved mesh (the arrises of each step pulled under the top: an
// undercut, as the Persepolis masons cut their outlines), which Blender (Cycles) bakes into a normal map and a ray-traced
// ambient-occlusion map seen from the front, beside the paint (colour, film coverage with its wear, gilding) sampled on the
// same grid. The maps are packed into two array textures (KTX2): `nao` (RG = the carved surface's normal in the figure's frame
// at the baked depth ratio, B = sky occlusion, A = gilding) and `paint` (sRGB colour, A = paint coverage).
// In the game (arch/reliefs.ts), a relief set whose figures are all in the atlas draws them with ATLAS_LODS: the same RTIN
// heightfield meshes on coarser grids with larger error bounds and no refinement at paint edges (the map carries the
// modelling, the paint and the contour shading the triangles no longer need), each vertex carrying its atlas coordinate
// (`ruv`: u, v, layer, depth-ratio correction) and the wall's frame (normal + tangent), so the shader reads the carved surface
// at 1-2 mm per texel wherever the camera is. Pure data and arithmetic (runs in node, workers and the browser).
import type { FigureDef } from './relief_field';
import INDEX from '../data/relief_atlas.json';

/** one figure definition's place in the atlas */
export interface AtlasEntry {
  /** array layer (page) */
  layer: number;
  /** texel rectangle in the page: x0, y0, width, height (texels; the rectangle includes MARGIN texels of background) */
  px: [number, number, number, number];
  /** figure-frame position (figure units) of the centre of texel (px[0], px[1]) */
  fig: [number, number];
  /** figure units per texel */
  cell: number;
  /** depth ratio D/S (relief depth over figure height) at which the normals and the occlusion were baked */
  rho: number;
}
export interface AtlasIndex {
  about: string; version: number;
  /** hash of the inputs (figure code, field code, polychromy, bake settings): tests/relief_atlas.test.ts rebuilds it */
  inHash: string;
  /** page size (texels) and number of layers */
  size: number; layers: number;
  /** texel size on the stone (m) for figures up to the size cap, and the cap */
  texel_m: number; maxTexels: number;
  files: { nao: string; paint: string };
  /** sha256 of the two files as built */
  sha: { nao: string; paint: string };
  bytes: { nao: number; paint: number };
  blender: string; device: string;
  defs: Record<string, AtlasEntry>;
}

/** the built index (src/data/relief_atlas.json; empty until tools/blender/relief_atlas.ts has run) */
export const ATLAS_INDEX = INDEX as unknown as AtlasIndex;
export const atlasKey = (kind: string, seed: number) => `${kind}|${seed}`;
export const atlasEntry = (kind: string, seed: number): AtlasEntry | null => ATLAS_INDEX.defs?.[atlasKey(kind, seed)] ?? null;

/** levels of detail of a relief set drawn with the atlas (same switch distances as RELIEF_LODS, D-217 bands): grid cell on the
 *  stone, largest grid, RTIN error bound (relief-depth units), switch distance. The map carries the carving and the paint, so
 *  the triangles carry only the silhouette (kept cell-exact at every level: relief_field SILHOUETTE_ERROR is above every
 *  bound) and the relief's parallax at a quarter to a fifth of its depth. Chosen with tools/relief_budget.ts (D-320) */
export const ATLAS_LODS = [
  { cell: 0.0032, maxN: 513, err: 0.07, grad: 1, dist: 1.2, pre: true },
  { cell: 0.0064, maxN: 257, err: 0.12, grad: 1, dist: 4, pre: true },
  { cell: 0.0128, maxN: 129, err: 0.18, grad: 1, dist: 14, pre: true },
  { cell: 0.0256, maxN: 65, err: 0.19, grad: 1, dist: 28, pre: true },
  { cell: 0.0512, maxN: 33, err: 0.19, grad: 1, dist: Infinity, pre: true },
];

/** texel coordinates → the vertex attribute `ruv` (u, v in the page, layer, depth-ratio correction) for a vertex at figure
 *  position (x, y) (unmirrored figure frame). `rho` = the instance's D/S: the shader scales the baked slopes by rho / e.rho */
export function atlasUV(e: AtlasEntry, x: number, y: number, size: number): [number, number] {
  return [(e.px[0] + 0.5 + (x - e.fig[0]) / e.cell) / size, (e.px[1] + 0.5 + (y - e.fig[1]) / e.cell) / size];
}

/** texel size (figure units) for a definition drawn at most `sMax` m tall and `ext` figure units across: texel_m on the stone,
 *  coarser where the square grid would pass maxTexels (the blocked-out giants of the Hall of 100 Columns), and for the kinds
 *  never seen near (the canopy: minLod 1) twice texel_m */
export function atlasCell(texel_m: number, maxTexels: number, sMax: number, ext: number, coarse = false) {
  const t = (coarse ? 2 : 1) * texel_m / sMax;
  return Math.max(t, ext / (maxTexels - 1));
}
/** the figure's non-empty bounds from its definition (figure units): what the atlas rectangle covers (plus the margin) */
export type Def = FigureDef;
