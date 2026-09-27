// dev (D-276): for each range's `into` side, how far the enclosure's inner face lies beyond the range's edge (the
// traced faces are not straight): the worst gap along the side, so the range row's edge can be set on the face.
import { terraceBuilt } from '../../src/arch/built';
import { terraceRanges } from '../../src/arch/terrace_rooms';
import type { Box } from '../../src/arch/parts';
const T = terraceBuilt();
const solids = T.parts.filter(p => p.type === 'box' && p.solid !== false && p.kind !== 'roof') as Box[];
const inBox = (p: Box, e: number, n: number, y: number) => { if (y < p.y0 || y > p.y1) return false; const a = -(p.rot ?? 0), dx = e - p.c[0], dy = n - p.c[1], u = dx * Math.cos(a) - dy * Math.sin(a), w = dx * Math.sin(a) + dy * Math.cos(a); return Math.abs(u) <= p.size[0] / 2 && Math.abs(w) <= p.size[1] / 2; };
for (const B of terraceRanges()) for (const { R } of B.ranges) for (const s of R.into ?? []) {
  const own = (p: Box) => p.note?.startsWith(`${R.id}:`);
  const vert = s === 'E' || s === 'W', [q0, q1] = vert ? R.y : R.x, edge = s === 'N' ? R.y[1] : s === 'S' ? R.y[0] : s === 'E' ? R.x[1] : R.x[0], sg = s === 'N' || s === 'E' ? 1 : -1, y = B.fl + 1;
  let worst = 0, best = Infinity;
  for (let q = q0 + 0.5; q < q1 - 0.5; q += 0.5) { let d = 0; for (; d < 2; d += 0.02) { const [e, n] = vert ? [edge + sg * d, q] : [q, edge + sg * d]; if (solids.some(p => !own(p) && inBox(p, e, n, y))) break; } worst = Math.max(worst, d); best = Math.min(best, d); }
  console.log(`${B.b}.${R.id} ${s}: edge ${edge}, face at ${(edge + sg * best).toFixed(2)}..${(edge + sg * worst).toFixed(2)} (gap ${best.toFixed(2)}..${worst.toFixed(2)})`);
}
