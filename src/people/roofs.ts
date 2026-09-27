// D-244, D-276: where on the Terrace a person stands under a built roof: under one of the Terrace generator's roof parts
// (terrace.ts: the halls' and porticoes' roofs, the Treasury's, the Harem's and the garrison's room ranges, the guards'
// mess). Until D-276 it was a roofed building's whole traced footprint, porticoes, stairs, open courts and the unbuilt
// wings included: a person the plan kept indoors could be drawn in the Harem's empty W wing, on the Apadana's stairs or in
// the unroofed Tripylon and count as under a roof (T-D3's anti-proxy). A building under construction has no roof (the Hall
// of a Hundred Columns, the Tripylon: construction.ts, chronology.json).
import { terraceBuilt } from '../arch/built';
import type { Box } from '../arch/parts';

interface RoofBox { b: string; c: [number, number]; cs: number; sn: number; hx: number; hy: number; x0: number; x1: number; y0: number; y1: number }
let RB: RoofBox[] | null = null;
function roofs(): RoofBox[] {
  if (RB) return RB;
  RB = (terraceBuilt().parts.filter(p => p.type === 'box' && p.kind === 'roof') as Box[]).map(p => {
    const a = p.rot ?? 0, cs = Math.cos(a), sn = Math.sin(a), hx = p.size[0] / 2, hy = p.size[1] / 2, ex = Math.abs(cs) * hx + Math.abs(sn) * hy, ey = Math.abs(sn) * hx + Math.abs(cs) * hy;
    return { b: p.building, c: p.c, cs, sn, hx, hy, x0: p.c[0] - ex, x1: p.c[0] + ex, y0: p.c[1] - ey, y1: p.c[1] + ey };
  });
  return RB;
}
/** the building whose built roof covers (e, n) grid metres, or null */
export function roofAt(e: number, n: number): string | null {
  for (const r of roofs()) {
    if (e < r.x0 || e > r.x1 || n < r.y0 || n > r.y1) continue;
    const dx = e - r.c[0], dy = n - r.c[1], u = dx * r.cs + dy * r.sn, w = -dx * r.sn + dy * r.cs;
    if (Math.abs(u) <= r.hx && Math.abs(w) <= r.hy) return r.b;
  }
  return null;
}
/** (e, n) grid metres is under a built Terrace roof */
export const terraceRoofed = (e: number, n: number): boolean => roofAt(e, n) !== null;
