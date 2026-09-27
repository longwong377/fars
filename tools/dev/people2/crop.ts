// dev (D-307): crop regions of screenshots into one sheet (nearest-neighbour upscale), for close looks at the portraits
// usage: npx tsx tools/dev/people2/crop.ts <out.png> <scale> <x0,y0,w,h> <img.png> [<img.png> ...]
import { readFileSync, writeFileSync } from 'node:fs';
import { decodePNG, encodePNG } from '../../humans/png';
const [out, scaleS, rect, ...imgs] = process.argv.slice(2); const k = +scaleS; const [x0, y0, w, h] = rect.split(',').map(Number);
const W = w * k * imgs.length, H = h * k, o = new Uint8Array(W * H * 4);
imgs.forEach((f, n) => { const im = decodePNG(readFileSync(f));
  for (let y = 0; y < H; y++) for (let x = 0; x < w * k; x++) { const sx = x0 + Math.floor(x / k), sy = y0 + Math.floor(y / k), si = (sy * im.width + sx) * 4, di = (y * W + n * w * k + x) * 4;
    for (let c = 0; c < 3; c++) o[di + c] = im.data[si + c]; o[di + 3] = 255; } });
writeFileSync(out, encodePNG(W, H, o)); console.log('wrote', out, W, H);
