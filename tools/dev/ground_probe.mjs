// D-302: the ground layers without the world (terrain, the plain's material, the rivers' and canals' banks; no Terrace, town,
// people or sky): a page load of ~10 s against the game's 11-30 min. Serve the tree on its port (npx vite --port <E2E_PORT>),
// then: node tools/dev/ground_probe.mjs <tag> [view,view] [?noscans]  (frames to $OUT or shots/probe-<view>-<tag>.png)
import { chromium } from 'playwright';
const TAG = process.argv[2] ?? 'a', ONLYV = process.argv[3]?.split(','), URLX = process.argv[4] ?? '';
const V = [
  { n: 'stair-foot-ground', e: -60, n2: 112, eye: 1.6, az: 250, pitch: -18, fov: 70, day: 30, sunAz: 105, sunAlt: 55 },
  { n: 'small-spring-field', e: -800, n2: 200, eye: 1.6, az: 251, pitch: -6, fov: 70, day: 12, sunAz: 130, sunAlt: 66 },
  { n: 'flowers-may', e: -800, n2: 200, eye: 1.6, az: 251, pitch: -10, fov: 70, day: 30, sunAz: 105, sunAlt: 55 },
  { n: 'ford-pulvar-sep', e: 859.1, n2: 3775.1, eye: 1.6, az: 334.7, pitch: -7, fov: 70, day: 150, sunAz: 105, sunAlt: 40 },
  { n: 'drum-road', e: -495, n2: 128, eye: 1.6, az: 282, pitch: -2, fov: 70, day: 13, sunAz: 95, sunAlt: 22 },
  { n: 'rainbow-plain', e: -600, n2: 60, eye: 1.6, az: 75, pitch: 8, fov: 70, day: 12, sunAz: 270, sunAlt: 25, wet: 0.8 },
  { n: 'calib-24', e: -166.6, n2: 108.9, eye: 1.6, az: 117, pitch: 7.5, fov: 34.4, day: 303, sunAz: 235, sunAlt: 20 },
  { n: 'rahmat-slope', e: 420, n2: 150, eye: 1.6, az: 80, pitch: 12, fov: 70, day: 150, sunAz: 200, sunAlt: 50 },
  { n: 'rahmat-face', e: -166.6, n2: 108.9, eye: 1.6, az: 117, pitch: 7.5, fov: 40, day: 150, sunAz: 235, sunAlt: 30 },
  { n: 'rahmat-mid', e: 330, n2: 60, eye: 1.6, az: 90, pitch: 10, fov: 60, day: 150, sunAz: 150, sunAlt: 45 },
  { n: 'rahmat-close', e: 520, n2: 180, eye: 1.6, az: 70, pitch: 5, fov: 60, day: 150, sunAz: 150, sunAlt: 40 },
  { n: 'spring-wet', e: -800, n2: 200, eye: 1.6, az: 251, pitch: -6, fov: 35, day: 12, sunAz: 130, sunAlt: 66, wet: 0.75 },
  { n: 'steppe-feet', e: -900, n2: 420, eye: 1.6, az: 250, pitch: -20, fov: 70, day: 30, sunAz: 120, sunAlt: 50 },
  { n: 'stubble-jul', e: -1300, n2: 900, eye: 1.6, az: 300, pitch: -14, fov: 70, day: 95, sunAz: 120, sunAlt: 50 },
  { n: 'ford-close', e: 850, n2: 3790, eye: 1.6, az: 330, pitch: -12, fov: 60, day: 150, sunAz: 105, sunAlt: 40 },
  { n: 'feet-dust', e: -700, n2: 150, eye: 1.6, az: 200, pitch: -55, fov: 70, day: 150, sunAz: 200, sunAlt: 50 },
];
if (process.env.V) V.push(...JSON.parse(process.env.V)); // extra views: [{ n, e, n2, eye, az, pitch, fov, day, sunAz, sunAlt }]
const b = await chromium.launch({ channel: 'chrome', headless: true, args: ['--enable-unsafe-webgpu', '--ignore-gpu-blocklist'] });
const p = await b.newPage({ viewport: { width: 960, height: 540 } }); const logs = [];
p.on('console', m => { if (m.type() === 'error' || m.type() === 'warning') logs.push(m.type() + ' ' + m.text().slice(0, 300)); }); p.on('pageerror', e => logs.push('pageerror ' + e));
const t0 = Date.now();
await p.goto('http://localhost:' + (process.env.E2E_PORT ?? '5291') + '/tools/dev/ground_probe.html' + URLX);
await p.waitForFunction(() => window.__ready, null, { timeout: 900000 });
console.log('ready', await p.evaluate(() => window.__ready), (Date.now() - t0) / 1000, 's');
for (const v of V) { if (ONLYV && !ONLYV.includes(v.n)) continue;
  const errs = await p.evaluate(v => window.__shot({ ...v, n: v.n2 }), v);
  await p.screenshot({ timeout: 600000, path: `${process.env.OUT ?? 'shots'}/probe-${v.n}-${TAG}.png` }); console.log(v.n, errs.length ? errs : '', (Date.now() - t0) / 1000, JSON.stringify(await p.evaluate(() => window.__bedrock ?? null))); }
console.log(logs.slice(0, 12).join('\n')); await b.close();
