// D-357: drive the outdoor-light probe page (outdoor_probe.ts). Serve the tree (npx vite --port <E2E_PORT>), then
//   node tools/dev/gpu_slot.mjs light-probe -- node src/render/probes/outdoor_probe.mjs <tag> [?query]
// views as JSON in $VIEWS (default: two lanes of q_n1); frames to $OUT (default .scratch/shots)
import { chromium } from 'playwright';
import { mkdirSync, readFileSync } from 'node:fs';
const TAG = process.argv[2] ?? 'a', Q = process.argv[3] ?? '', OUT = process.env.OUT ?? '.scratch/shots'; mkdirSync(OUT, { recursive: true });
const V = process.env.VIEWS ? JSON.parse(readFileSync(process.env.VIEWS, 'utf8')) : [{ n: 'lane', u: 0.5, v: 0.5, yawLocal: 0, pitch: 0, fov: 60, sunAz: 120, sunAlt: 45 }];
const b = await chromium.launch({ channel: 'chrome', headless: true, args: ['--enable-unsafe-webgpu', '--ignore-gpu-blocklist'] });
const p = await b.newPage({ viewport: { width: 960, height: 540 } }); const logs = [];
p.on('console', m => { if (m.type() === 'error' || m.type() === 'warning') logs.push(m.type() + ' ' + m.text().slice(0, 300)); }); p.on('pageerror', e => logs.push('pageerror ' + e));
const t0 = Date.now();
await p.goto('http://localhost:' + (process.env.E2E_PORT ?? '5187') + '/src/render/probes/outdoor_probe.html' + Q);
await p.waitForFunction(() => window.__ready, null, { timeout: 600000 });
console.log('ready', await p.evaluate(() => window.__ready), (Date.now() - t0) / 1000, 's');
for (const v of V) { const errs = await p.evaluate(v => window.__shot(v), v); await p.screenshot({ timeout: 600000, path: `${OUT}/${v.n}-${TAG}.png` }); console.log(v.n, errs.length ? errs : '', (Date.now() - t0) / 1000); }
console.log(logs.slice(0, 12).join('\n')); await b.close();
