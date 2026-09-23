// dev: difference of two same-size PNGs: count of pixels whose max channel difference exceeds each threshold, the
// bounding box of those above the first, and the mean difference inside it. Usage: node tools/dev/pxdiff.mjs a.png b.png [t1 t2 …]
import { createRequire } from 'node:module'; const { PNG } = createRequire(import.meta.url)('playwright-core/lib/utilsBundle'); import { readFileSync } from 'node:fs';
const [,, fa, fb, ...ts] = process.argv; const A = PNG.sync.read(readFileSync(fa)), B = PNG.sync.read(readFileSync(fb));
if (A.width !== B.width || A.height !== B.height) throw new Error('size differs');
const th = (ts.length ? ts : ['4', '12', '30']).map(Number), cnt = th.map(() => 0); let x0 = 1e9, y0 = 1e9, x1 = -1, y1 = -1, sum = 0, n = 0;
for (let y = 0; y < A.height; y++) for (let x = 0; x < A.width; x++) { const i = (y * A.width + x) * 4;
  const d = Math.max(Math.abs(A.data[i] - B.data[i]), Math.abs(A.data[i + 1] - B.data[i + 1]), Math.abs(A.data[i + 2] - B.data[i + 2]));
  th.forEach((t, k) => { if (d > t) cnt[k]++; }); if (d > th[0]) { x0 = Math.min(x0, x); y0 = Math.min(y0, y); x1 = Math.max(x1, x); y1 = Math.max(y1, y); sum += d; n++; } }
console.log(JSON.stringify({ size: [A.width, A.height], over: Object.fromEntries(th.map((t, k) => [t, cnt[k]])), bbox: n ? [x0, y0, x1, y1] : null, meanDiff: n ? +(sum / n).toFixed(1) : 0 }));
