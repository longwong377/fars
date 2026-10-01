// D-356: runs tools/dev/plain_probe.html (the plain without the Terrace, town, people or sky). Serve the tree on its port
// (npx vite --port <E2E_PORT>), then: node tools/dev/plain_probe.mjs <tag> [view,view] [?query]
// frames to $OUT (default shots/) as pp-<view>-<tag>.png; prints the plain's, flora's and rocks' stats and the frame time.
// Views: the ground probe's plain views (tools/dev/ground_probe.mjs) plus the stair-top and mid-field views; V='[...]' adds more.
import { chromium } from 'playwright';
const TAG = process.argv[2] ?? 'a', ONLYV = process.argv[3]?.split(',').filter(Boolean), URLX = process.argv[4] ?? '';
const V = [
  { n: 'small-spring-field', e: -800, n2: 200, eye: 1.6, az: 251, pitch: -6, fov: 70, day: 12, sunAz: 130, sunAlt: 66 },
  { n: 'flowers-may', e: -800, n2: 200, eye: 1.6, az: 251, pitch: -10, fov: 70, day: 30, sunAz: 105, sunAlt: 55 },
  { n: 'drum-road', e: -495, n2: 128, eye: 1.6, az: 282, pitch: -2, fov: 70, day: 13, sunAz: 95, sunAlt: 22 },
  { n: 'ford-pulvar-sep', e: 859.1, n2: 3775.1, eye: 1.6, az: 334.7, pitch: -7, fov: 70, day: 150, sunAz: 105, sunAlt: 40 },
  { n: 'steppe-feet', e: -900, n2: 420, eye: 1.6, az: 250, pitch: -20, fov: 70, day: 30, sunAz: 120, sunAlt: 50 },
  { n: 'stubble-aug', e: -1300, n2: 900, eye: 1.6, az: 300, pitch: -6, fov: 70, day: 125, sunAz: 120, sunAlt: 50 },
  { n: 'steppe-aug', e: -900, n2: 420, eye: 1.6, az: 250, pitch: -4, fov: 70, day: 125, sunAz: 140, sunAlt: 45 },
  { n: 'stair-top', e: -60, n2: 112, eye: 16, az: 250, pitch: -8, fov: 70, day: 20, sunAz: 105, sunAlt: 20 },
  { n: 'rahmat-slope', e: 420, n2: 150, eye: 1.6, az: 80, pitch: -4, fov: 70, day: 150, sunAz: 200, sunAlt: 50 },
  { n: 'spring-wet', e: -800, n2: 200, eye: 1.6, az: 251, pitch: -12, fov: 50, day: 12, sunAz: 130, sunAlt: 66, wet: 0.85 },
];
if (process.env.V) V.push(...JSON.parse(process.env.V));
const b = await chromium.launch({ channel: 'chrome', headless: true, args: ['--enable-unsafe-webgpu', '--ignore-gpu-blocklist'] });
const p = await b.newPage({ viewport: { width: 1280, height: 720 } }); const logs = [];
p.on('console', m => { if (m.type() === 'error' || m.type() === 'warning') logs.push(m.type() + ' ' + m.text().slice(0, 300)); }); p.on('pageerror', e => logs.push('pageerror ' + e));
const t0 = Date.now();
await p.goto('http://localhost:' + (process.env.E2E_PORT ?? '5291') + '/tools/dev/plain_probe.html' + URLX, { timeout: 600000, waitUntil: 'domcontentloaded' });
await p.waitForFunction(() => window.__ready, null, { timeout: 900000 });
console.log('ready', await p.evaluate(() => window.__ready), (Date.now() - t0) / 1000, 's');
if (await p.evaluate(() => window.__ready) !== true) { console.log(logs.join('\n')); await b.close(); process.exit(1); }
for (const v of V) { if (ONLYV && !ONLYV.includes(v.n)) continue;
  const res = await p.evaluate(v => window.__shot({ ...v, n: v.n2 }), v);
  await p.screenshot({ timeout: 600000, path: `${process.env.OUT ?? 'shots'}/pp-${v.n}-${TAG}.png` });
  console.log(v.n, JSON.stringify(res), (Date.now() - t0) / 1000); }
console.log(JSON.stringify(await p.evaluate(() => window.__info())));
console.log(logs.slice(0, 20).join('\n')); await b.close();
