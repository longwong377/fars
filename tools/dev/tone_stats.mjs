// luma percentiles, mean saturation, b/r of the lower 60% of the frame (the ground/buildings, not the sky) per image
import sharp from 'sharp'; import { readdirSync } from 'node:fs'; import path from 'node:path';
const files = process.argv.slice(2);
const rows = [];
for (const f of files) {
  const { data, info } = await sharp(f).resize(480, null).removeAlpha().raw().toBuffer({ resolveWithObject: true });
  const W = info.width, H = info.height, L = []; let sr = 0, sg = 0, sb = 0, sat = 0, n = 0;
  for (let y = Math.floor(H * 0.4); y < H; y++) for (let x = 0; x < W; x++) { const i = (y * W + x) * 3, r = data[i], g = data[i + 1], b = data[i + 2];
    L.push(0.2126 * r + 0.7152 * g + 0.0722 * b); sr += r; sg += g; sb += b; const mx = Math.max(r, g, b), mn = Math.min(r, g, b); sat += mx ? (mx - mn) / mx : 0; n++; }
  L.sort((a, b) => a - b); const p = q => L[Math.floor(n * q)].toFixed(0);
  rows.push(`${path.basename(f).slice(0, 44).padEnd(44)} p5 ${p(0.05).padStart(3)} p25 ${p(0.25).padStart(3)} p50 ${p(0.5).padStart(3)} p75 ${p(0.75).padStart(3)} p95 ${p(0.95).padStart(3)} sat ${(sat / n).toFixed(2)} b/r ${(sb / sr).toFixed(2)} g/r ${(sg / sr).toFixed(2)}`);
}
console.log(rows.join('\n'));
