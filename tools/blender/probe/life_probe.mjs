// D-332: the modelled small life in the game's renderer (tools/blender/probe/life_probe.ts). Serve the tree
// (npx vite --port $E2E_PORT), then: node tools/blender/probe/life_probe.mjs <outDir> [birds|small|flora]
// Views walk each row: the standing birds from the side at a walker's eye, the flying birds from below, the small creatures
// and the flora from 1-2 m, each a few metres of the row at a time.
import { chromium } from 'playwright';
import { mkdirSync, writeFileSync } from 'node:fs';
const OUT = process.argv[2] ?? 'T:/fars-assets-s12/smalllife/probe', CLS = process.argv[3];
mkdirSync(OUT, { recursive: true });
const SUN = [0.5, 0.7, 0.6];
const b = await chromium.launch({ channel: process.env.PW_CHANNEL ?? 'chrome', headless: true, args: ['--enable-unsafe-webgpu', '--ignore-gpu-blocklist'] });
const p = await b.newPage({ viewport: { width: 1600, height: 900 } }); const logs = [];
p.on('console', m => { if (m.type() === 'error' || m.type() === 'warning') logs.push(m.type() + ' ' + m.text().slice(0, 300)); }); p.on('pageerror', e => logs.push('pageerror ' + e));
const t0 = Date.now();
await p.goto('http://localhost:' + (process.env.E2E_PORT ?? '5344') + '/tools/blender/probe/life_probe.html' + (CLS ? `?cls=${CLS}` : ''));
await p.waitForFunction(() => window.__ready, null, { timeout: 600000 });
const ready = await p.evaluate(() => window.__ready); console.log('ready', JSON.stringify(ready.stats ?? ready).slice(0, 300), (Date.now() - t0) / 1000, 's');
if (typeof ready === 'string') { console.log(ready); process.exit(1); }
const views = [], ex = ready.extent;
if (!CLS || CLS === 'birds') { for (let x = 0; x < ex.stand; x += 1.6) views.push({ n: `birds-stand-${x.toFixed(1)}`, eye: [x + 0.8, 0.45, 1.3], at: [x + 0.8, 0.15, 0], fov: 55 });
  for (let x = 0; x < ex.birds; x += 3.2) views.push({ n: `birds-fly-${x.toFixed(0)}`, eye: [x + 1.6, 2.9, 0.4], at: [x + 1.6, 2.5, -3], fov: 60, t: x * 0.37 }); }
if (!CLS || CLS === 'small') for (let x = 0; x < ex.small; x += 1.4) views.push({ n: `small-${x.toFixed(1)}`, eye: [x + 0.7, 0.45, 5.0], at: [x + 0.7, 0.02, 4], fov: 55, t: x });
if (!CLS || CLS === 'flora') for (let x = 0; x < ex.flora; x += 3) { views.push({ n: `flora-${x.toFixed(0)}`, eye: [x + 1.5, 1.4, 10.3], at: [x + 1.5, 0.3, 8], fov: 55 }); views.push({ n: `flora-lod1-${x.toFixed(0)}`, eye: [x + 1.5, 1.4, 13.3], at: [x + 1.5, 0.3, 11], fov: 55 }); }
const rec = { ready, views: [] };
for (const v of views) {
  const r = await p.evaluate(a => window.__shot(a), { ...v, sun: SUN });
  await p.screenshot({ timeout: 600000, path: `${OUT}/${v.n}.png` }); rec.views.push({ n: v.n, ...r }); console.log(v.n, r.errs.length ? r.errs : '', JSON.stringify(r.info));
}
rec.logs = logs.slice(0, 30); writeFileSync(`${OUT}/probe.json`, JSON.stringify(rec, null, 1));
console.log(logs.slice(0, 12).join('\n')); await b.close();
