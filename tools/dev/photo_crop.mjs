// D-320 round 3: a region of a reference photograph with a ruler in source pixels, to measure a relief figure's landmarks
//   node tools/dev/photo_crop.mjs <img> <x0> <y0> <x1> <y1> <out.png> [step]
import { chromium } from 'playwright';
import { readFileSync } from 'node:fs';
const [img, x0, y0, x1, y1, out, step0] = process.argv.slice(2); const X0 = +x0, Y0 = +y0, X1 = +x1, Y1 = +y1, W = X1 - X0, H = Y1 - Y0;
const S = Math.min(1500 / W, 1000 / H), step = +(step0 ?? 50);
const b = await chromium.launch({ channel: process.env.PW_CHANNEL ?? "chrome" }); const p = await b.newPage({ viewport: { width: Math.ceil(W * S) + 60, height: Math.ceil(H * S) + 40 } });
const data = 'data:image/jpeg;base64,' + readFileSync(img).toString('base64');
await p.setContent(`<canvas id=c></canvas>`);
const info = await p.evaluate(async ({ data, X0, Y0, W, H, S, step }) => {
  const im = new Image(); im.src = data; await im.decode();
  const c = document.getElementById('c'); c.width = W * S + 60; c.height = H * S + 40; const g = c.getContext('2d');
  g.fillStyle = '#000'; g.fillRect(0, 0, c.width, c.height); g.drawImage(im, X0, Y0, W, H, 50, 0, W * S, H * S);
  g.font = '11px sans-serif'; g.lineWidth = 1;
  for (let x = Math.ceil(X0 / step) * step; x <= X0 + W; x += step) { const px = 50 + (x - X0) * S; g.strokeStyle = x % (step * 2) ? 'rgba(255,255,0,0.35)' : 'rgba(255,0,0,0.55)'; g.beginPath(); g.moveTo(px, 0); g.lineTo(px, H * S); g.stroke(); g.fillStyle = '#ff0'; g.fillText(String(x), px - 10, H * S + 14); }
  for (let y = Math.ceil(Y0 / step) * step; y <= Y0 + H; y += step) { const py = (y - Y0) * S; g.strokeStyle = y % (step * 2) ? 'rgba(255,255,0,0.35)' : 'rgba(255,0,0,0.55)'; g.beginPath(); g.moveTo(50, py); g.lineTo(50 + W * S, py); g.stroke(); g.fillStyle = '#ff0'; g.fillText(String(y), 2, py + 4); }
  return { w: im.naturalWidth, h: im.naturalHeight };
}, { data, X0, Y0, W, H, S, step });
await p.locator('#c').screenshot({ path: out }); console.log(JSON.stringify(info)); await b.close();
