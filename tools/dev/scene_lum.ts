// dev: scene-linear luminance (before exposure) of PNG regions, by inverting three's AgX grey curve at the frame's
// exposure (moments-lum.json `exposure`), so shade/sun ratios can be measured on renders (D-188). Usage:
//   npx tsx tools/dev/scene_lum.ts <png> <exposure> x,y[,r[,label]] …   (a (2r+1)² box; r default 3)
// Prints the mean sRGB, the scene-linear luminance of the box's mean luma, and the box's linear Ystd/Y (flatness).
import { agx, toSRGB8 } from './human_cpu';
import { createRequire } from 'node:module'; import { readFileSync } from 'node:fs';
const { PNG } = createRequire(import.meta.url)('playwright-core/lib/utilsBundle');
const [,, file, Xs, ...pts] = process.argv; const X = +Xs; const im = PNG.sync.read(readFileSync(file));
/** display luma (sRGB8 of the grey) → the scene-linear grey that AgX maps to it at exposure X */
function invGrey(s8: number) {
  let lo = 1e-8, hi = 1e4;
  for (let i = 0; i < 90; i++) { const m = Math.sqrt(lo * hi); const v = toSRGB8(agx([m, m, m], X)[1]); if (v < s8) lo = m; else hi = m; }
  return Math.sqrt(lo * hi);
}
const toLin = (v: number) => { v /= 255; return v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; };
for (const p of pts) {
  const [x, y, r0, ...l] = p.split(','); const R = r0 ? +r0 : 3; const s = [0, 0, 0]; let n = 0; const Ls: number[] = [];
  for (let dy = -R; dy <= R; dy++) for (let dx = -R; dx <= R; dx++) {
    const i = ((+y + dy) * im.width + (+x + dx)) * 4; s[0] += im.data[i]; s[1] += im.data[i + 1]; s[2] += im.data[i + 2]; n++;
    Ls.push(0.2126 * toLin(im.data[i]) + 0.7152 * toLin(im.data[i + 1]) + 0.0722 * toLin(im.data[i + 2]));
  }
  const m = s.map(v => v / n), luma = 0.2126 * m[0] + 0.7152 * m[1] + 0.0722 * m[2];
  const mean = Ls.reduce((a, b) => a + b, 0) / n, sd = Math.sqrt(Ls.reduce((a, b) => a + (b - mean) ** 2, 0) / n);
  console.log((l.join(' ') || `${x},${y}`).padEnd(14), m.map(Math.round).join(',').padEnd(12), 'scene', invGrey(luma).toExponential(3), ' Ystd/Y', (sd / Math.max(mean, 1e-9)).toFixed(3));
}
