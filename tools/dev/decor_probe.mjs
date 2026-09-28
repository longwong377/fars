// D-330: drive tools/dev/decor_probe.html (serve the tree: npx vite --port <E2E_PORT>), through the GPU slots:
//   node C:/Users/Administrator/fars-assets/gpu_slot.mjs decor -- node tools/dev/decor_probe.mjs <tag> <views.json> [?query]
// views.json: [{ n, e, n2, y?, eye, az, pitch, fov, sunAz, sunAlt }] (grid e/n, y the floor if not the terrain; az true
// degrees); frames to $OUT or shots/dprobe-<view>-<tag>.png
import { chromium } from 'playwright';
import { readFileSync } from 'node:fs';
const TAG = process.argv[2] ?? 'a', V = JSON.parse(readFileSync(process.argv[3], 'utf8')), URLX = process.argv[4] ?? '';
const b = await chromium.launch({ channel: 'chrome', headless: true, args: ['--enable-unsafe-webgpu', '--ignore-gpu-blocklist'] });
const p = await b.newPage({ viewport: { width: 960, height: 540 } }); const logs = [];
p.on('console', m => { if (m.type() === 'error' || m.type() === 'warning') logs.push(m.type() + ' ' + m.text().slice(0, 300)); }); p.on('pageerror', e => logs.push('pageerror ' + e));
const t0 = Date.now();
await p.goto('http://localhost:' + (process.env.E2E_PORT ?? '5342') + '/tools/dev/decor_probe.html' + URLX);
await p.waitForFunction(() => window.__ready, null, { timeout: 900000 });
console.log('ready', JSON.stringify(await p.evaluate(() => window.__ready)), JSON.stringify(await p.evaluate(() => window.__frames ?? null)), (Date.now() - t0) / 1000, 's');
for (const v of V) {
  const res = await p.evaluate(v => window.__shot({ ...v, n: v.n2 }), v);
  await p.screenshot({ timeout: 600000, path: `${process.env.OUT ?? 'shots'}/dprobe-${v.n}-${TAG}.png` }); console.log(v.n, JSON.stringify(res), (Date.now() - t0) / 1000); }
console.log(logs.slice(0, 12).join('\n')); await b.close();
