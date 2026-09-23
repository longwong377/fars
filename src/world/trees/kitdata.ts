// Packing of the tree models into the float arrays the GPU reads (vertex pulling, render.ts), and data derived from the
// models for the atlas (leaf size on a tile). Pure JS.
import { SPECIES } from './species';
import { allModels, M0, K0, VARIANTS, VARIANT_SPREAD, type TreeModel } from './model';
import { crownOf } from './shade';
import { TILE_NAMES, tileIndex, atlasFill, buildAtlas, type TileName, type Atlas } from './atlas';
import { TILE_FILL } from './model';
import { barkLinear } from './impostor';
import { groupIndex } from './species';

/** leaf length on each tile (tile units): the species' leaf size over its mean card size, averaged over the species
 *  that use the tile; twig tiles use the leaf scale of their species too (their twigs are drawn at a fixed scale) */
export function leafFractions(models: TreeModel[] = allModels()): Partial<Record<TileName, number>> {
  const acc: Record<string, { s: number; n: number }> = {};
  for (const m of models) { if (m.variant) continue; const cs = m.cards.slice(0, m.used.cards); const size = cs.reduce((a, c) => a + c.size, 0) / Math.max(1, cs.length);
    const f = (m.species.leaf.size_cm / 100) / Math.max(0.05, size); const k = m.species.leaf.tile; (acc[k] ??= { s: 0, n: 0 }); acc[k].s += f; acc[k].n++; }
  const out: Partial<Record<TileName, number>> = {};
  for (const n of TILE_NAMES) if (acc[n]) out[n] = acc[n].s / acc[n].n;
  return out;
}

/** texels per record */
export const SEG_TEX = 3, CARD_TEX = 5, SP_TEX = 6;
/** segment texture (width M0 x 3, one row per model): (a, ra), (b, rb), (u, level) */
export function packSegments(models: TreeModel[] = allModels()) {
  const w = M0 * SEG_TEX, out = new Float32Array(w * models.length * 4);
  models.forEach((m, r) => m.segs.forEach((s, i) => { const o = (r * w + i * SEG_TEX) * 4;
    out.set([s.a[0], s.a[1], s.a[2], s.ra, s.b[0], s.b[1], s.b[2], s.rb, s.u[0], s.u[1], s.u[2], s.level], o); }));
  return { data: out, width: w, height: models.length };
}
/** card texture (width K0 x 5, one row per model): (c, size), (w, ht), (up, hb), (side, tint), (hv, -, -, -). The
 *  per-card lighting normal and occlusion (n, ao) are no longer packed: the shaders take both per texel (shade.ts) */
export function packCards(models: TreeModel[] = allModels()) {
  const w = K0 * CARD_TEX, out = new Float32Array(w * models.length * 4);
  models.forEach((m, r) => m.cards.forEach((c, i) => out.set([c.c[0], c.c[1], c.c[2], c.size, c.w[0], c.w[1], c.w[2], c.ht, c.up[0], c.up[1], c.up[2], c.hb,
    c.side[0], c.side[1], c.side[2], c.tint, c.hv, 0, 0, 0], (r * w + i * CARD_TEX) * 4)));
  return { data: out, width: w, height: models.length };
}
/** species texture (width 6, one row per model): (group, leaf tile, twig tile, blossom tile or -1), (bark rgb linear, H),
 *  (impostor tile side T, y0, W, CB), (crown ellipsoid: centre height, horizontal radius, radii above and below: shade.ts
 *  crownOf), (transmission attenuation kappa, twig_cards, the variant's leaf-out spread VARIANT_SPREAD, -), (card aspect,
 *  clump shading weight, -, -) (trees.json card) */
export function packSpecies(models: TreeModel[] = allModels()) {
  const out = new Float32Array(SP_TEX * models.length * 4);
  models.forEach((m, r) => { const s = m.species, o = r * SP_TEX * 4, c = crownOf(m);
    const bk = barkLinear(m); out.set([groupIndex(s.group), tileIndex(s.leaf.tile), tileIndex(s.twig_tile), s.blossom_tile ? tileIndex(s.blossom_tile) : -1, bk[0], bk[1], bk[2], m.H, m.T, m.y0, m.W, m.CB,
      c.yc, c.rx, c.ryT, c.ryB, c.kappa, s.twig_cards, VARIANT_SPREAD[m.variant % VARIANTS], 0, s.card.aspect, s.card.clump, 0, 0], o); });
  return { data: out, width: SP_TEX, height: models.length };
}
export const MODEL_ROWS = SPECIES.length * VARIANTS;

/** Calibrate card sizes to the drawn tiles (once per model set): a card's area x its tile's opaque share must give the
 *  species' leaf layers over the crown surface, whatever the tile drawing produced (C). Returns the leaf atlas drawn at
 *  the calibrated leaf scale. */
const calibrated = new WeakSet<TreeModel[]>();
export function calibrateAndDrawAtlas(models: TreeModel[] = allModels()): Atlas {
  if (!calibrated.has(models)) {
    const fill = atlasFill(leafFractions(models));
    for (const m of models) { const f = fill[tileIndex(m.species.leaf.tile)], k = Math.min(1.5, Math.max(0.8, Math.sqrt(TILE_FILL / Math.max(0.05, f))));
      for (const c of m.cards) c.size *= k; }
    calibrated.add(models);
  }
  return buildAtlas(leafFractions(models));
}
