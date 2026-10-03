// D-780 (s18 C13): the dress palette census. People drawn from the seed's population on a day (never chosen), with the
// game's looks (tools/dev/body_variety.ts sample: popview.lookInput + looks.lookFor), and counted by dress: the share whose
// main garment is dyed, the share wearing any dyed piece, the dyes of the main garment, the ornaments, the rosette robes and
// the mean chroma (C*ab) of the main garment's colour. `npx tsx tools/dev/dress_census.ts [seed] [n] [day]`
import { loadA, sample } from './body_variety';
import type { PersonLook } from '../../src/people/looks';

const UNDYED = new Set(['wool', 'linen', 'brown', 'grey']);
const ORN = ['torque', 'earrings', 'bracelets', 'earrings_b', 'bracelets_b'];
function chroma(c: [number, number, number]): number {
  // linear sRGB → XYZ → Lab C*
  const [r, g, b] = c, X = 0.4124 * r + 0.3576 * g + 0.1805 * b, Y = 0.2126 * r + 0.7152 * g + 0.0722 * b, Z = 0.0193 * r + 0.1192 * g + 0.9505 * b;
  const f = (t: number) => t > 0.008856 ? Math.cbrt(t) : 7.787 * t + 16 / 116, fx = f(X / 0.9505), fy = f(Y), fz = f(Z / 1.089);
  return Math.hypot(500 * (fx - fy), 200 * (fy - fz));
}
export interface DressRow { n: number; mainDyed: number; anyDyed: number; ornament: number; gold: number; rosette: number; chroma: number; dyes: Record<string, number> }
export function dressCensus(looks: PersonLook[]): Record<string, DressRow> {
  const out: Record<string, DressRow> = {};
  const row = (k: string) => out[k] ??= { n: 0, mainDyed: 0, anyDyed: 0, ornament: 0, gold: 0, rosette: 0, chroma: 0, dyes: {} };
  for (const L of looks) {
    const m = /colours main (\w+) \([A-C]\), second (\w+), trim (\w+)/.exec(L.note); if (!m) continue;
    for (const R of [row(L.dress), row('ALL')]) { R.n++;
      if (!UNDYED.has(m[1])) R.mainDyed++; if (m.slice(1, 4).some(k => !UNDYED.has(k))) R.anyDyed++;
      if (L.pieces.some(p => ORN.includes(p))) R.ornament++; if (L.pieces.some(p => ['torque', 'earrings', 'bracelets'].includes(p))) R.gold++;
      if (L.pattern % 2) R.rosette++; R.chroma += chroma(L.col.main); R.dyes[m[1]] = (R.dyes[m[1]] ?? 0) + 1; }
  }
  for (const R of Object.values(out)) R.chroma /= Math.max(1, R.n);
  return out;
}
export function printCensus(c: Record<string, DressRow>): string {
  const pc = (x: number, n: number) => `${Math.round(100 * x / Math.max(1, n))} %`;
  const lines = ['| dress | n | main dyed | any piece dyed | ornament | gold | rosettes | main C*ab | main dyes |', '|---|---|---|---|---|---|---|---|---|'];
  for (const [k, R] of Object.entries(c).sort((a, b) => b[1].n - a[1].n))
    lines.push(`| ${k} | ${R.n} | ${pc(R.mainDyed, R.n)} | ${pc(R.anyDyed, R.n)} | ${pc(R.ornament, R.n)} | ${pc(R.gold, R.n)} | ${pc(R.rosette, R.n)} | ${R.chroma.toFixed(1)} | ${Object.entries(R.dyes).sort((a, b) => b[1] - a[1]).map(([d, x]) => `${d} ${pc(x, R.n)}`).join(', ')} |`);
  return lines.join('\n');
}
if (process.argv[1]?.endsWith('dress_census.ts')) {
  const seed = Number(process.argv[2] ?? 1), n = Number(process.argv[3] ?? 3000), day = process.argv[4] !== undefined ? Number(process.argv[4]) : undefined;
  const A = loadA(), S = sample(seed, A, n, day);
  console.log(`seed ${seed}, day ${S.day}, ${S.people.length} people\n`); console.log(printCensus(dressCensus(S.people.map(p => p.look))));
}
