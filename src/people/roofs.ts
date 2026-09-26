// D-244: where on the Terrace a person stands under a built roof. The roofed buildings standing in 467 (their traced
// footprints, geo/footprints.json): the Apadana, the Tachara, the Hadish, the Harem, the Treasury, the Tripylon, the Gate of
// All Nations and Palace H. Not the Hall of a Hundred Columns (building, unroofed: construction.ts) and not the garrison
// (its quarters are drawn as a perimeter wall round an open court, terrace.ts; their rooms are not built: BLOCKERS B63).
// A footprint stands for the whole building, its porticoes included (C: a portico is roofed; the open courts inside the
// Harem and the Treasury are not told apart here).
import { footprint } from '../arch/spec';

export const ROOFED_BUILDINGS = ['apadana', 'tachara', 'hadish', 'harem', 'treasury', 'tripylon', 'gate_nations', 'palace_h'] as const;
const FP = ROOFED_BUILDINGS.map(k => footprint(k));
function inPoly(p: [number, number][], x: number, y: number) {
  let c = false; for (let i = 0, j = p.length - 1; i < p.length; j = i++) { const [xi, yi] = p[i], [xj, yj] = p[j]; if ((yi > y) !== (yj > y) && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) c = !c; }
  return c;
}
/** (e, n) grid metres is inside a roofed Terrace building */
export function terraceRoofed(e: number, n: number): boolean {
  for (const f of FP) { const b = f.bounds; if (e >= b[0] && e <= b[2] && n >= b[1] && n <= b[3] && inPoly(f.polygon, e, n)) return true; }
  return false;
}
