// s18 C14 (D-790, UD-27): look-alikes in a crowd. For people of the population as the game looks them (tools/dev/body_variety
// sample), how often two people of a crowd of 40 (same dress mix as the town) would read as the same person at 5-15 m: the
// same base mesh, stature within 2 cm, the same hair/beard pieces, and skin, hair and main-garment colours within a just
// noticeable difference (ΔRGB < 0.04 linear). Prints the share of crowds with a look-alike pair, and the worst features.
//   npx tsx tools/dev/look_clones.ts [seed] [n]
import { loadA, sample } from './body_variety';
const seed = +(process.argv[2] ?? 1), N = +(process.argv[3] ?? 2000);
const A = loadA(), S = sample(seed, A, N).people;
const near = (a: number[], b: number[], t = 0.04) => Math.max(Math.abs(a[0] - b[0]), Math.abs(a[1] - b[1]), Math.abs(a[2] - b[2])) < t;
const hairPieces = (p: any) => p.look.pieces.filter((x: string) => /hair|beard|bun|bob|cap|hat|veil|band|fillet/.test(x)).sort().join(',');
const alike = (a: any, b: any) => a.look.variant === b.look.variant && Math.abs(a.look.stature - b.look.stature) < 0.02 && a.look.dress === b.look.dress && hairPieces(a) === hairPieces(b)
  && near(a.look.col.skin, b.look.col.skin) && near(a.look.col.hair, b.look.col.hair) && near(a.look.col.main, b.look.col.main);
let crowds = 0, withPair = 0, pairs = 0; const why: Record<string, number> = {};
let r = 12345; const rnd = () => (r = (r * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff;
for (let c = 0; c < 500; c++) { const crowd = Array.from({ length: 40 }, () => S[Math.floor(rnd() * S.length)]); crowds++; let any = false;
  for (let i = 0; i < 40; i++) for (let j = i + 1; j < 40; j++) { if (crowd[i] === crowd[j]) continue; if (alike(crowd[i], crowd[j])) { pairs++; any = true; why[crowd[i].look.dress] = (why[crowd[i].look.dress] ?? 0) + 1; } }
  if (any) withPair++; }
// the spread of what is seen from 10 m: stature, variant, colours
const st = S.filter(p => p.look.dress !== 'child').map(p => p.look.stature), m = st.reduce((a, b) => a + b, 0) / st.length, sd = Math.sqrt(st.reduce((a, b) => a + (b - m) ** 2, 0) / st.length);
const variants = new Set(S.map(p => p.look.variant)).size;
console.log(JSON.stringify({ seed, people: S.length, crowdsWithLookAlike: +(withPair / crowds).toFixed(3), pairsPerCrowd: +(pairs / crowds).toFixed(3), byDress: why, stature: { mean: +m.toFixed(3), sd: +sd.toFixed(3) }, variants }));
