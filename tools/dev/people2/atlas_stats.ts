// dev: per-row channel means of the hair atlas where covered (D-307)
import { readFileSync } from 'node:fs';
import { decodePNG } from '../../humans/png';
const im = decodePNG(readFileSync(process.argv[2])); const rows = 4, rh = im.height / rows;
for (let r = 0; r < rows; r++) { const s = [0, 0, 0, 0]; let n = 0, cov = 0;
  for (let y = r * rh; y < (r + 1) * rh; y++) for (let x = 0; x < im.width; x++) { const k = (y * im.width + x) * 4, a = im.data[k + 3] / 255; cov += a; if (a > 0.5) { n++; for (let c = 0; c < 3; c++) s[c] += im.data[k + c] / 255; } }
  console.log(`row ${r}: coverage ${(cov / (rh * im.width)).toFixed(3)}, R ${(s[0] / n).toFixed(3)} G ${(s[1] / n).toFixed(3)} B ${(s[2] / n).toFixed(3)}`); }
