// s17 C7 (D-610): a room's planned things (plan.ts) drawn into the house batches of its near tile (settlement/houses.ts
// draws the town's and the villages' houses into one mesh per material: the furnishing adds triangles, never a draw call).
// Each thing is the period kit's modelled piece (tools/blender/model_props.py, interior_props.py) at its far level (lod2:
// a room is seen from its doorway, a near tile holds a few dozen rooms), fitted to the planned size and coloured per part:
// the household's textiles (undyed wool and linen, madder, indigo, weld-saffron by standing, D-610), the clay of its pots,
// the wood of its chests. A piece whose model is not loaded falls back to a simpler kit piece, never to nothing.
import * as THREE from 'three/webgpu';
import { modelFit, model, mergedModel, scanShape } from '../../render/scanProps';
import type { Batch, RGB } from '../settlement/geom';
import { lin } from '../settlement/geom';
import type { Item, Profile } from './plan';
import { textileOf } from './plan';

/** the household textiles (sRGB): four undyed (cream wool, linen, grey-brown, dark brown), five dyed (madder red, indigo,
 *  weld-saffron, a madder-brown, an indigo-weld green): the art direction's palette (sessions/s17-vagon-v2.md) */
export const TEXTILE: RGB[] = [[0.72, 0.66, 0.55], [0.76, 0.72, 0.62], [0.47, 0.41, 0.34], [0.31, 0.25, 0.2], [0.55, 0.2, 0.14], [0.2, 0.24, 0.4], [0.78, 0.58, 0.24], [0.42, 0.22, 0.18], [0.34, 0.38, 0.25]];
const CLAY: RGB = [0.63, 0.45, 0.32], CLAY_D: RGB = [0.42, 0.31, 0.24], WOOD: RGB = [0.45, 0.33, 0.22], WOOD_D: RGB = [0.32, 0.24, 0.17], REED: RGB = [0.64, 0.55, 0.37];
const STONE: RGB = [0.52, 0.5, 0.46], IRON: RGB = [0.26, 0.25, 0.24], BRONZE: RGB = [0.5, 0.37, 0.2], WOOL: RGB = [0.78, 0.73, 0.62], HIDE: RGB = [0.5, 0.36, 0.24], STRAW: RGB = [0.7, 0.6, 0.38];
const sh = (c: RGB, k: number): RGB => [c[0] * k, c[1] * k, c[2] * k];
const mix = (a: RGB, b: RGB, t: number): RGB => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];

/** fitted model geometry, cached by id, level, size (to 2 cm) and turn of the lean */
const CACHE = new Map<string, Record<string, THREE.BufferGeometry> | null>();
function fitted(id: string, size: [number, number, number], lod = 2, lean = 0): Record<string, THREE.BufferGeometry> | null {
  const q = size.map(x => Math.max(0.02, Math.round(x * 50) / 50)) as [number, number, number], key = `${id}|${lod}|${q.join(',')}|${lean.toFixed(2)}`;
  if (CACHE.has(key)) return CACHE.get(key)!;
  if (!model(id)) return null; // (not cached: the models may load later)
  const p = modelFit(id, q, lod);
  if (p && lean) { // a tool leaning on the wall: its length (z) up, its top a little into the wall (+z), its foot on the floor
    for (const g of Object.values(p)) g.rotateX(-(Math.PI / 2 - lean)); let lo = Infinity; for (const g of Object.values(p)) { g.computeBoundingBox(); lo = Math.min(lo, g.boundingBox!.min.y); }
    for (const g of Object.values(p)) g.translate(0, -lo, 0); }
  if (CACHE.size > 3000) CACHE.clear(); CACHE.set(key, p); return p;
}

/** where and how a room's things are drawn: the site frame, the floor, the two batches (earth/clay/stone; wood/cloth) */
export interface DrawCtx {
  grid: (u: number, v: number) => [number, number]; theta: number; floor: (u: number, v: number) => number;
  clay: Batch; cloth: Batch; own: number; prof: Profile;
}
/** draw a model's parts at a thing's place (each part its colour; a part without a colour is left out) */
function put(c: DrawCtx, b: Batch, id: string, it: Item, size: [number, number, number], cols: Record<string, RGB>, at: [number, number] = [0, 0], dy = 0, rot = 0, lean = 0): boolean {
  const p = fitted(id, size, 2, lean); if (!p) return false;
  const th = c.theta + it.rot + rot, cs = Math.cos(c.theta + it.rot), sn = Math.sin(c.theta + it.rot), [e, n] = c.grid(it.u, it.v), E = e + at[0] * cs + at[1] * sn, N = n + at[0] * sn - at[1] * cs;
  const y = c.floor(it.u, it.v) + it.y + dy;
  for (const [k, g] of Object.entries(p)) { const col = cols[k] ?? cols['*']; if (col) b.geo(E, N, y, g, th, lin(col), c.own); }
  return true;
}
const tex = (c: DrawCtx, vr: number) => TEXTILE[textileOf(c.prof, vr)];

/** draw one planned thing (false when no piece of the kit is loaded for it) */
export function drawItem(c: DrawCtx, it: Item): boolean {
  const v = it.vr, w = it.w, d = it.d, h = it.h, C = c.clay, T = c.cloth;
  switch (it.k) {
    case 'mat': return put(c, T, 'mat', it, [w, 0.012, d], { matting: sh(REED, 0.9 + 0.2 * v) }, [0, 0], 0.015);
    case 'carpet': return put(c, T, 'carpet', it, [w, 0.014, d], { pile: tex(c, 0.05 + v * 0.1), fringe: TEXTILE[1] }, [0, 0], 0.03);
    case 'fleece': return put(c, T, 'wo_fleece', it, [w, 0.1, d], { wool: sh(WOOL, 0.85 + 0.2 * v), wool_d: sh(WOOL, 0.7) }, [0, 0], 0.02, v * 6.28);
    case 'hide': return put(c, T, 'wo_hides', it, [w, 0.08, d], { hide: sh(HIDE, 0.85 + 0.25 * v), hide_d: sh(HIDE, 0.65) }, [0, 0], 0.02, v * 6.28);
    case 'grass_bed': return put(c, T, 'wo_grass_bed', it, [w, 0.08, d], { grass: sh(STRAW, 0.9 + 0.15 * v) }, [0, 0], 0.01);
    case 'roll': return put(c, T, 'roll', it, [w, h, d], { textile: tex(c, v) }, [0, 0], 0);
    case 'rugs': case 'bedding': { // folded quilts and rugs in a pile (a ledge of mud under the household's bedding)
      const n = it.k === 'rugs' ? Math.max(2, it.n ?? 3) : 4 + Math.round(v * 3); let y = 0;
      if (it.k === 'bedding' && put(c, T, 'i_bedding', it, [w, h, d], { mud: [0.5, 0.42, 0.32], textile_a: tex(c, v), textile_b: tex(c, (v + 0.37) % 1) })) return true;
      if (it.k === 'bedding') { put(c, C, 'bin', it, [w, 0.16, d], { mud: [0.5, 0.42, 0.32] }, [0, 0], -0.02) || C.box(...c.grid(it.u, it.v), c.theta + it.rot, w / 2, d / 2, c.floor(it.u, it.v) - 0.02, c.floor(it.u, it.v) + 0.14, lin([0.44, 0.37, 0.28]), lin([0.5, 0.42, 0.32]), c.own); y = 0.14; }
      let ok = true; for (let k = 0; k < n; k++) { const t = h01v(v, k), th = 0.045 + 0.02 * t; ok = put(c, T, 'rug_folded', it, [w * (0.92 + 0.08 * t), th, d * (0.9 + 0.1 * t)], { textile: tex(c, (v + k * 0.37) % 1) }, [(t - 0.5) * 0.04, 0], y, (t - 0.5) * 0.12) && ok; y += th * 0.92; }
      if (it.k === 'bedding') put(c, T, 'roll', it, [w * 0.9, 0.24, 0.26], { textile: tex(c, (v + 0.5) % 1) }, [0, 0.06], y);
      return ok; }
    case 'cushion': return put(c, T, 'i_cushion', it, [w, h, d], { textile: tex(c, v), cord: tex(c, (v + 0.41) % 1) }, [0, 0], 0, (v - 0.5) * 0.5) || put(c, T, 'rug_folded', it, [w, h, d], { textile: tex(c, v) }, [0, 0], 0, (v - 0.5) * 0.5);
    case 'chest': return put(c, T, 'chest', it, [w, h, d], { wood: sh(WOOD, 0.85 + 0.3 * v), lid: sh(WOOD_D, 0.9 + 0.3 * v), bronze: BRONZE });
    case 'stool': return put(c, T, 'stool', it, [w, h, d], { wood: sh(WOOD, 0.8 + 0.35 * v) }, [0, 0], 0, (v - 0.5) * 0.6);
    case 'low_table': { // a low wooden tray-table (the stool's form at a table's span), bowls and bread on it
      const ok = put(c, T, 'i_low_table', it, [w, h, d], { wood: sh(WOOD, 0.75 + 0.3 * v) }) || put(c, T, 'stool', it, [w, h, d], { wood: sh(WOOD, 0.75 + 0.3 * v) });
      put(c, C, 'bowl', it, [0.18, 0.08, 0.18], { clay: sh(CLAY, 0.9 + 0.2 * v) }, [-w * 0.2, 0.04], h); put(c, C, 'bowl', it, [0.16, 0.07, 0.16], { clay: sh(CLAY_D, 1.2) }, [w * 0.15, -0.06], h);
      if (v > 0.4) put(c, C, 'jug', it, [0.15, 0.17, 0.13], { clay: sh(CLAY, 0.85) }, [w * 0.32, 0.08], h);
      return ok; }
    case 'bench': return put(c, T, 'bench', it, [w, h, d], { wood: sh(WOOD, 0.85 + 0.2 * v) }) || (C.box(...c.grid(it.u, it.v), c.theta + it.rot, w / 2, d / 2, c.floor(it.u, it.v) - 0.03, c.floor(it.u, it.v) + h, lin([0.44, 0.37, 0.28]), lin([0.5, 0.42, 0.32]), c.own), true);
    case 'jar_store': case 'jar_neck': case 'jar_water': { const ok = put(c, C, it.k, it, [w * 0.92, h, d * 0.92], { clay: sh(it.k === 'jar_water' ? [0.68, 0.53, 0.4] : CLAY, 0.82 + 0.3 * v) }, [0, 0], -0.04, v * 6.28);
      if (it.k === 'jar_water') put(c, C, 'bowl', it, [0.1, 0.05, 0.1], { clay: sh(CLAY, 0.95) }, [0.02, 0], h - 0.03);
      return ok || drawLathe(c, it, C); }
    case 'sack': case 'sack_lying': return put(c, T, it.k, it, [w, h, d], { cloth: sh(mix(TEXTILE[1], TEXTILE[2], v), 0.85 + 0.15 * v), cord: TEXTILE[3] }, [0, 0], -0.01, (v - 0.5) * 0.8);
    case 'bin': return put(c, C, 'bin', it, [w, h, d], { mud: [0.56, 0.47, 0.36], lid: [0.5, 0.42, 0.32], dark: [0.2, 0.17, 0.14] }, [0, 0], -0.04);
    case 'basket': case 'bread': { const g = scanShape('basket', Math.floor(v * 10), [w, h, d], 2); if (g) { const [e, n] = c.grid(it.u, it.v); T.geo(e, n, c.floor(it.u, it.v), g, c.theta + it.rot + v * 3, lin(sh([0.62, 0.52, 0.34], 0.85 + 0.2 * v)), c.own); }
      // a cloth over the bread
      put(c, T, 'rug_folded', it, [w * 0.7, 0.03, d * 0.7], { textile: TEXTILE[1] }, [0, 0], h * 0.85, v); return !!g; }
    case 'bale': return put(c, T, 'bale', it, [w, h, d], { cloth: tex(c, v), cord: TEXTILE[3] });
    case 'grain': return put(c, T, 'fill_grain', it, [w, h, d], { cloth: sh(TEXTILE[1], 0.9), grain: [0.74, 0.62, 0.38], wood: WOOD });
    case 'cookpot': return put(c, C, 'cookpot', it, [w, h, d], { clay: sh(CLAY_D, 0.8 + 0.25 * v) }, [0, 0], -0.01, v * 6);
    case 'bowls': { let ok = false; for (let k = 0; k < 3; k++) ok = put(c, C, 'bowl', it, [0.2 - 0.015 * k, 0.07, 0.2 - 0.015 * k], { clay: sh(CLAY, 0.85 + 0.12 * k) }, [0, 0], 0.04 * k, k) || ok; return ok; }
    case 'jug': return put(c, C, 'jug', it, [w, h, d], { clay: sh(CLAY, 0.85 + 0.2 * v) }, [0, 0], 0, v * 6);
    case 'basin': return put(c, C, 'basin', it, [w, h, d], { clay: sh(CLAY, 0.85 + 0.2 * v) });
    case 'milkpot': return put(c, C, 'milkpot', it, [w, h, d], { clay: sh(CLAY_D, 1.1) });
    case 'kneading': return put(c, T, 'kneading_trough', it, [w, h, d], { clay: sh(WOOD, 0.9 + 0.2 * v) });
    case 'quern': return put(c, C, 'quern', it, [w, h, d], { stone: sh(STONE, 0.9 + 0.15 * v) });
    case 'mortar': return put(c, C, 'mortar_set', it, [w, h, d], { stone: sh(STONE, 0.95) });
    case 'loom_ground': return put(c, T, 'wo_loom', it, [w, 0.28, d], { wood: WOOD, wood_d: WOOD_D, red: TEXTILE[4], blue: TEXTILE[5], warp: TEXTILE[1], stone: STONE }, [0, 0], 0, Math.PI / 2);
    case 'loom_upright': return put(c, T, 'loom_upright', it, [w, h, d], { wood: WOOD, warp: TEXTILE[1], cloth: tex(c, v) });
    case 'spinning': { // a basket of combed wool, the spindle and the distaff stuck in it
      const g = scanShape('basket', 3 + Math.floor(v * 5), [w, h * 0.5, d], 2); if (g) { const [e, n] = c.grid(it.u, it.v); T.geo(e, n, c.floor(it.u, it.v), g, c.theta + it.rot, lin([0.6, 0.5, 0.33]), c.own); }
      put(c, T, 'wo_fleece', it, [w * 0.7, 0.08, d * 0.7], { wool: WOOL, wool_d: sh(WOOL, 0.8) }, [0, 0], h * 0.42);
      put(c, T, 'tool_spindle', it, [0.05, 0.3, 0.05], { wood: WOOD, stone: STONE, wool: WOOL }, [0.08, 0], h * 0.3, 0.2);
      return put(c, T, 'tool_distaff', it, [0.07, 0.07, 0.53], { wood: WOOD, wool: WOOL }, [-0.08, 0.02], h * 0.3, 0, 0.35) || !!g; }
    case 'wool': return put(c, T, 'wo_fleece', it, [w, h, d], { wool: sh(WOOL, 0.85 + 0.2 * v), wool_d: sh(WOOL, 0.72) }, [0, 0], 0, v * 6);
    case 'bolts': return put(c, T, 'fill_bolts', it, [w, h, d], { reed: REED, textile_a: tex(c, v), textile_b: tex(c, (v + 0.5) % 1) });
    case 'tool_lean': { const id = `tool_${it.sub ?? 'staff'}`, len = it.h;
      const cols: Record<string, RGB> = { wood: sh(WOOD, 0.9 + 0.2 * v), wood_d: WOOD_D, iron: IRON, bronze: BRONZE, silver: [0.7, 0.7, 0.7], cord: TEXTILE[2], leather: HIDE };
      const m = model(id); if (!m) return false; const b = m.box, sz: [number, number, number] = [b.max.x - b.min.x, b.max.y - b.min.y, b.max.z - b.min.z], k = len / Math.max(sz[2], 0.01);
      return put(c, T, id, it, [sz[0] * Math.min(1.2, k), sz[1] * Math.min(1.2, k), len], cols, [0, 0.06], 0, 0, 0.2); }
    case 'broom': return put(c, T, 'tool_broom', it, [0.19, 0.16, it.h], { straw: STRAW, cord: TEXTILE[2] }, [0, 0.05], 0, 0, 0.25);
    case 'anvil': return put(c, C, 'wo_anvil', it, [w, h, d], { wood_d: WOOD_D, iron: IRON, scale: [0.18, 0.16, 0.15] });
    case 'bellows': return put(c, T, 'wo_bellows', it, [w, h, d], { skin: HIDE, pot: CLAY_D });
    case 'timber': return put(c, T, 'timber_stack', it, [w, h, d], { wood: sh(WOOD, 1.05 + 0.15 * v) });
    case 'vat': return put(c, C, 'vat', it, [w, h, d], { clay: sh(CLAY, 0.85 + 0.2 * v) }, [0, 0], -0.04);
    case 'pots': return put(c, C, 'fill_pots', it, [w, h, d], { reed: REED, clay: sh(CLAY, 0.9 + 0.2 * v) });
    case 'wheel': { // the potter's turntable: a stone pivot and a heavy clay-plastered wooden wheel, a pot on it
      if (put(c, C, 'i_wheel', it, [w, h, d], { stone: STONE, wood: sh(WOOD_D, 1.1), clay: [0.6, 0.47, 0.37] })) return true;
      const [e, n] = c.grid(it.u, it.v), y = c.floor(it.u, it.v); C.lathe(e, n, y - 0.02, [[0.16, 0], [0.18, 0.1], [0.08, 0.14], [0.06, 0.3]], 7, lin(STONE), c.own);
      T.lathe(e, n, y + 0.3, [[0.04, 0], [0.3, 0.01], [0.31, 0.07], [0.28, 0.09], [0.05, 0.09]], 12, lin(sh(WOOD_D, 1.1)), c.own);
      put(c, C, 'jar_neck', it, [0.22, 0.3, 0.22], { clay: [0.6, 0.47, 0.37] }, [0, 0], 0.39); return true; }
    case 'pigments': return put(c, C, 'wo_pigment_slab', it, [w, h, d], { stone: STONE, stone_d: sh(STONE, 0.9), pig_blue: [0.12, 0.28, 0.62], pig_green: [0.22, 0.48, 0.34], pig_red: [0.55, 0.2, 0.13], pig_ochre: [0.76, 0.58, 0.26] });
    case 'mould': return put(c, T, 'tool_mould', it, [w, h, d], { wood: WOOD }) && (put(c, C, 'tool_brick', it, [0.33, 0.11, 0.33], { mud: [0.56, 0.47, 0.36] }, [0.5, 0]) || true);
    case 'seal_bench': return put(c, C, 'wo_seal_bench', it, [w, h, d], { stone: STONE, wood: WOOD, lapis: [0.15, 0.22, 0.55], pot: CLAY, sand: [0.75, 0.66, 0.5] });
    case 'weigh_table': return put(c, T, 'wo_weigh_table', it, [w, h, d], { '*': WOOD, bronze: BRONZE });
    case 'tablets': { const g = scanShape('basket', 7, [w, h, d], 2); if (g) { const [e, n] = c.grid(it.u, it.v); T.geo(e, n, c.floor(it.u, it.v), g, c.theta + it.rot, lin([0.58, 0.48, 0.32]), c.own); }
      for (let k = 0; k < 3; k++) put(c, C, 'tool_brick', it, [0.07, 0.025, 0.05], { mud: [0.62, 0.52, 0.4] }, [(k - 1) * 0.08, 0.02], h * 0.8 + 0.01 * k, k * 0.3);
      put(c, T, 'tool_stylus', it, [0.01, 0.01, 0.15], { '*': WOOD }, [0.1, -0.05], h); return !!g; }
    case 'cradle': return it.sub === 'basket' ? put(c, T, 'basket_cradle', it, [w * 0.9, 0.18, d * 0.8], { wicker: [0.62, 0.52, 0.34], cloth: tex(c, v) }) : put(c, T, 'cradle', it, [w, h, d], { wood: WOOD, cloth: tex(c, v) });
    case 'toys': { if (it.sub === 'bones') return put(c, C, 'wo_knucklebones', it, [0.15, 0.012, 0.18], { bone: [0.82, 0.78, 0.68] });
      if (it.sub === 'bow') return put(c, T, 'tool_toy_bow', it, [0.08, 0.02, 0.6], { wood: WOOD, leather: HIDE }, [0, 0], 0.01, Math.PI / 2 + 0.3, 0);
      return put(c, C, 'wo_toy_wheeled', it, [0.12, 0.2, 0.34], { clay_toy: [0.66, 0.47, 0.33], wood_d: WOOD_D, cord: TEXTILE[2] }, [0, 0], 0, v * 3); }
    case 'peg_cloth': { // a wooden peg in the wall, a cloak or a bag on it
      put(c, T, 'peg', it, [0.05, 0.05, 0.22], { wood: WOOD_D }, [0, 0.06], 0, 0, 0);
      return put(c, T, 'hung_cloth', it, [w, h, 0.09], { cloth: tex(c, v) }, [0, -0.02], -h + 0.05); }
    case 'herbs': case 'onions': { // hung from the ceiling poles by a cord (interior_props.py's strings when loaded)
      if (put(c, T, it.k === 'herbs' ? 'i_herbs' : 'i_onions', it, [it.k === 'herbs' ? 0.16 : 0.15, h, it.k === 'herbs' ? 0.16 : 0.15], { leaf: sh([0.4, 0.44, 0.25], 0.85 + 0.3 * v), bulb: sh([0.74, 0.55, 0.36], 0.9 + 0.2 * v), stem: [0.62, 0.55, 0.36], cord: TEXTILE[2] }, [0, 0.04], 0)) return true;
      return put(c, T, 'tool_broom', it, [0.16, 0.14, h], { straw: it.k === 'herbs' ? [0.42, 0.45, 0.26] : [0.66, 0.5, 0.34], cord: TEXTILE[2] }, [0, 0], 0, 0, 0.05); }
    case 'lamp': return put(c, C, 'lamp', it, [0.17, 0.035, 0.14], { clay: [0.6, 0.42, 0.3] });
    case 'shield': return put(c, T, 'shield', it, [w, h, d], { hide: sh(HIDE, 0.8 + 0.3 * v), cord: TEXTILE[2], bronze: BRONZE }, [0, 0.02], 0, 0, 0);
    case 'arrows': { let ok = false; for (let k = 0; k < 7; k++) ok = put(c, T, 'tool_arrow', it, [0.02, 0.02, Math.min(0.75, w)], { reed: [0.66, 0.58, 0.4], bronze: BRONZE, feather: [0.5, 0.46, 0.4] }, [0, (k - 3) * 0.035], 0.012 * (k % 2), Math.PI / 2) || ok;
      put(c, T, 'tool_rope', it, [0.03, 0.03, 0.3], { cord: TEXTILE[2] }, [0, 0], 0.03, 0); return ok; }
    case 'vessels': { // stone and metal vessels of the Treasury's finds (an alabastron, a phiale, a glass bowl: B types)
      const a = put(c, C, 'alabastron', it, [0.15, 0.26, 0.15], { stone: [0.86, 0.82, 0.74] }, [-w * 0.3, 0]);
      put(c, C, 'phiale', it, [0.2, 0.04, 0.2], { metal: v < 0.5 ? [0.72, 0.72, 0.7] : [0.66, 0.5, 0.26] }, [0.02, 0.02]);
      put(c, C, 'glass_bowl', it, [0.18, 0.07, 0.18], { glass: [0.56, 0.62, 0.58] }, [w * 0.32, -0.03]); return a; }
  }
  return false;
}
const h01v = (v: number, k: number) => ((v * 9301 + k * 49297) % 233280) / 233280;
/** a jar as a lathe when no model is loaded */
function drawLathe(c: DrawCtx, it: Item, b: Batch) { const [e, n] = c.grid(it.u, it.v), k = it.h / 0.82, r = it.w / 2; b.lathe(e, n, c.floor(it.u, it.v) - 0.04, [[r * 0.45, 0], [r, 0.25 * k], [r * 0.95, 0.55 * k], [r * 0.45, 0.78 * k], [r * 0.38, 0.82 * k]], 8, lin(CLAY), c.own); return true; }
