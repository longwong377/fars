// D-802 (s18 cloud C15): the town kit's loader. tools/blender/kit_town.py models the mud-brick houses' pieces (wall runs plain,
// worn to the brick and timber-laced; the corner arris; the splashed foot; the doorframe with its lintel and threshold; small
// windows with grilles; the parapet with its drip edge and vigas; the roof tile; the hatch; steps; an awning) in Blender,
// eroded with seeded noise and their AO baked by Cycles, in the house kit's unit frames (kit.ts KitPiece, kitFrame): x 0..1
// along the run, y 0..1 up, z -0.5..0.5 across (public/models/kit/town/manifest.json: each piece's frame, sockets, height
// rule and triangles per level). Each piece in three levels: `name`, `name_l1`, `name_l2`.
import type { KitPiece } from '../world/settlement/kit';
import { BASE } from '../core/base';

export interface TownKit { pieces: Record<string, KitPiece>; manifest: any }
const toPiece = (q: any): KitPiece => {
  const nv = q.p.length / 3, min = [1e9, 1e9, 1e9], max = [-1e9, -1e9, -1e9];
  for (let k = 0; k < nv; k++) for (let j = 0; j < 3; j++) { min[j] = Math.min(min[j], q.p[k * 3 + j]); max[j] = Math.max(max[j], q.p[k * 3 + j]); }
  return { nv, p: q.p, n: q.n, ao: q.ao, k: q.k, i: q.i, tris: q.tris, min, max };
};
/** the kit from its JSON (kit.json as written by kit_town.py) */
export function parseTownKit(kit: any, manifest: any = null): TownKit {
  const pieces: Record<string, KitPiece> = {}; for (const [n, q] of Object.entries<any>(kit.pieces)) pieces[n] = toPiece(q);
  return { pieces, manifest };
}
/** a piece at a level of detail (0 = full, 1, 2), falling back to the coarser one present */
export const townPiece = (kit: TownKit, name: string, lod: 0 | 1 | 2 = 0): KitPiece | undefined => kit.pieces[lod ? `${name}_l${lod}` : name] ?? kit.pieces[name];
let loading: Promise<TownKit | null> | null = null;
/** fetch the kit (browser); null when missing (the callers keep their boxes) */
export function loadTownKit(base = BASE): Promise<TownKit | null> {
  return loading ??= (async () => { try {
    const [k, m] = await Promise.all([fetch(base + 'models/kit/town/kit.json').then(r => r.ok ? r.json() : null), fetch(base + 'models/kit/town/manifest.json').then(r => r.ok ? r.json() : null)]);
    return k ? parseTownKit(k, m) : null; } catch { return null; } })();
}
