// D-366: the surface probe (tools/dev/surface_probe.ts). Serve the tree on its port (npx vite --port <E2E_PORT>), then through a GPU slot:
//   node tools/dev/gpu_slot.mjs surfprobe -- node tools/dev/surface_probe.mjs <tag> [view,view]   (frames to $OUT or shots/surf-<view>-<tag>[-off].png)
// Each view is shot with the grime layer on and off in the same load.
import { chromium } from 'playwright';
const TAG = process.argv[2] ?? 'a', ONLYV = process.argv[3]?.split(',');
const V = [
  { n: 'lane', x: 2, y: 1.6, z: 0.3, tx: 30, ty: 1.2, tz: 0, fov: 60 },
  { n: 'door', x: 12.5, y: 1.6, z: 2.0, tx: 12, ty: 2.2, tz: -2.4, fov: 75 },
  { n: 'hearth-room', x: 12, y: 1.6, z: -2.9, tx: 12, ty: 1.4, tz: -6.4, fov: 75 },
  { n: 'terrace-wall', x: -15, y: 1.6, z: 18, tx: -40, ty: 4, tz: 18, fov: 60 },
  { n: 'terrace-far', x: 60, y: 1.6, z: 60, tx: -40, ty: 6, tz: 0, fov: 50 },
  { n: 'palace-wall', x: -75, y: 13.6, z: 10, tx: -75, ty: 15, tz: -29, fov: 60 },
  { n: 'ground-far', x: 30, y: 1.6, z: 60, tx: 30, ty: -2, tz: 200, fov: 60 },
];
const b = await chromium.launch({ channel: 'chrome', headless: true, args: ['--enable-unsafe-webgpu', '--ignore-gpu-blocklist'] });
const p = await b.newPage({ viewport: { width: 960, height: 540 } }); const logs = [];
p.on('console', m => { if (m.type() === 'error' || m.type() === 'warning') logs.push(m.type() + ' ' + m.text().slice(0, 300)); }); p.on('pageerror', e => logs.push('pageerror ' + e));
const t0 = Date.now();
await p.goto('http://localhost:' + (process.env.E2E_PORT ?? '5190') + '/tools/dev/surface_probe.html');
await p.waitForFunction(() => window.__ready, null, { timeout: 900000 });
console.log('ready', JSON.stringify(await p.evaluate(() => window.__ready)), (Date.now() - t0) / 1000, 's');
for (const v of V) { if (ONLYV && !ONLYV.includes(v.n)) continue;
  for (const g of [1, 0]) { const errs = await p.evaluate(v => window.__shot(v), { ...v, grime: g });
    await p.screenshot({ timeout: 600000, path: `${process.env.OUT ?? 'shots'}/surf-${v.n}-${TAG}${g ? '' : '-off'}.png` }); console.log(v.n, g, errs.length ? errs : '', (Date.now() - t0) / 1000); } }
console.log(logs.slice(0, 12).join('\n')); await b.close();
