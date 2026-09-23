// dev: Rec. 709 luma (sRGB display values) and mean colour of horizontal bands of a PNG — e.g. the sky above a horizon
// row and the ground below it — to compare renders numerically (D-118). Usage:
//   node tools/dev/lum_bands.mjs <png> y0:y1[:label] …   (rows as fractions 0..1 of the height, or pixels if > 1)
import { createRequire } from 'node:module'; import { readFileSync } from 'node:fs';
const { PNG } = createRequire(import.meta.url)('playwright-core/lib/utilsBundle');
const [,, file, ...bands] = process.argv; const im = PNG.sync.read(readFileSync(file));
for (const b of bands) {
  const [a, c, ...l] = b.split(':'); const H = im.height, W = im.width;
  const y0 = Math.round(+a <= 1 ? +a * H : +a), y1 = Math.round(+c <= 1 ? +c * H : +c);
  let s = [0, 0, 0], n = 0, L = [];
  for (let y = y0; y < y1; y++) for (let x = 0; x < W; x++) { const i = (y * W + x) * 4; const r = im.data[i], g = im.data[i + 1], bl = im.data[i + 2]; s[0] += r; s[1] += g; s[2] += bl; n++; L.push(0.2126 * r + 0.7152 * g + 0.0722 * bl); }
  L.sort((p, q) => p - q);
  const m = s.map(v => Math.round(v / n)), mean = L.reduce((p, q) => p + q, 0) / n;
  console.log(`${(l.join(' ') || `${y0}-${y1}`).padEnd(14)} rows ${y0}-${y1}: luma mean ${mean.toFixed(1)} p10 ${L[Math.floor(n * 0.1)].toFixed(0)} p90 ${L[Math.floor(n * 0.9)].toFixed(0)} | mean rgb ${m.join(',')} (b/r ${(m[2] / Math.max(1, m[0])).toFixed(2)})`);
}
