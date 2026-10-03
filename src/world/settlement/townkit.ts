// s18 C2 (the reset, C15's D-802 town kit): the kit's pieces for the houses' generator, bundled (houses build in node, in the
// bake and on the page alike; render/townKit.ts's fetch is the page's only). Pieces in kit.ts's unit frames (kitFrame).
import kitData from '../../../public/models/kit/town/kit.json';
import { parseTownKit, townPiece } from '../../render/townKit';
import type { KitPiece } from './kit';

export const TKIT = parseTownKit(kitData);
/** a piece of the town kit at a level (0 full, 1, 2) */
export const tkit = (name: string, lod: 0 | 1 | 2 = 0): KitPiece | undefined => townPiece(TKIT, name, lod);
export const TKIT_SOURCE = 'tools/blender/kit_town.py (C15, D-802); public/models/kit/town/kit.json';
/** the far side of a single-sided sheet in a piece (its vertices from `from` on: the awning's cloth, seen from the lane
 *  below), normals reversed and the winding flipped */
export function underside(q: KitPiece, from: number): KitPiece {
  const nv = q.nv - from, p = q.p.slice(from * 3), n = q.n.slice(from * 3).map(x => -x), ao = q.ao.slice(from), k = q.k.slice(from), i: number[] = [];
  for (let t = 0; t + 2 < q.i.length; t += 3) { const a = q.i[t], b = q.i[t + 1], c = q.i[t + 2]; if (a >= from && b >= from && c >= from) i.push(a - from, c - from, b - from); }
  return { nv, p, n, ao, k, i, tris: i.length / 3, min: q.min, max: q.max };
}
/** the awning (two poles and their beam: the first 36 vertices; the cloth after) and its cloth's underside */
export const AWNING = tkit('awning'), AWNING_UNDER = AWNING ? underside(AWNING, 36) : undefined;
/** counts for the probes (node) */
export const KIT_STATS = { awnings: 0, awningTried: 0, windows: 0 };
