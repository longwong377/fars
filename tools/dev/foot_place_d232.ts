// D-232: place the Terrace foot's zone of large irregular blocks (SITE_SPEC terrace.r_masonry.foot) so that it agrees with
// photograph #24 where the photo sees the wall (tools/dev/masonry_photo_d232.py READ.foot): present on the Apadana salient's
// W face (grid e -61.45) for its first ~62 m from the NW corner (n 59.7 -> -2.3), absent from n 17 to -55 and on the W wall
// S of the salient (e ~ -53, n -70.8 -> -158.4); and along ~38 % of the W- and S-facing walls overall (the share read).
// Searches the plan noise's offset for a given lambda / theta / w; prints the best few.
// Run: npx tsx tools/dev/foot_place_d232.ts
import { mxNoise3 } from '../../tests/lib/mx_noise_cpu';
import { MASONRY } from '../../src/render/masonry';
import FP from '../../src/data/geo/footprints.json';

const F = MASONRY.foot;
const smooth = (a: number, b: number, x: number) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
/** the shader's foot mask at grid (e, n): world x = e, z = -n */
export const footMask = (e: number, n: number, off: [number, number], lambda = F.lambda, theta = F.theta, w = F.w) =>
  smooth(theta - w, theta + w, mxNoise3(e / lambda + off[0], 0.5, -n / lambda + off[1]));

const poly = (FP as any).terrace.polygon as [number, number][];
const ringArea = poly.slice(0, -1).reduce((s, p, i) => { const q = poly[(i + 1) % (poly.length - 1)]; return s + p[0] * q[1] - q[0] * p[1]; }, 0);
const edges: { a: [number, number]; b: [number, number] }[] = [];
for (let i = 0; i < poly.length - 1; i++) {
  const a = poly[i], b = poly[i + 1], L = Math.hypot(b[0] - a[0], b[1] - a[1]); if (L < 1) continue;
  // outward normal (CCW ring: right-hand normal of each edge is outward)
  const s = ringArea > 0 ? 1 : -1, nx = s * (b[1] - a[1]) / L, ny = -s * (b[0] - a[0]) / L;
  if (nx < -0.5 || ny < -0.5) edges.push({ a, b }); // W- or S-facing
}
function score(off: [number, number], lambda: number, theta: number, w: number) {
  let on = 0, tot = 0;
  for (const { a, b } of edges) { const L = Math.hypot(b[0] - a[0], b[1] - a[1]); for (let s = 0.5; s < L; s += 1) { const t = s / L; on += footMask(a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, off, lambda, theta, w); tot++; } }
  const share = on / tot;
  let seen = 0, nSeen = 0, miss = 0, nMiss = 0;
  for (let n = 57; n >= 0; n -= 1) { seen += footMask(-61.45, n, off, lambda, theta, w); nSeen++; }
  for (let n = 17; n >= -55; n -= 1) { miss += footMask(-61.47, n, off, lambda, theta, w); nMiss++; }
  for (let n = -71; n >= -158; n -= 1) { miss += footMask(-52.9, n, off, lambda, theta, w); nMiss++; }
  seen /= nSeen; miss /= nMiss;
  return { share, seen, miss, err: (1 - seen) * 2 + miss * 2 + Math.abs(share - 0.38) * 3 };
}
if (process.argv[1]?.endsWith('foot_place_d232.ts')) {
  const res: any[] = [];
  for (let ox = 0; ox < 40; ox += 0.37) for (let oz = 0; oz < 40; oz += 0.41) {
    const r = score([ox, oz], F.lambda, F.theta, F.w); res.push({ ox: +ox.toFixed(2), oz: +oz.toFixed(2), ...r });
  }
  res.sort((p, q) => p.err - q.err);
  console.log(`${edges.length} W/S-facing edges`); for (const r of res.slice(0, 8)) console.log(JSON.stringify(r));
}
export { score };
