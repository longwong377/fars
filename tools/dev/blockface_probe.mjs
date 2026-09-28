// D-321: the block faces on the Terrace probe (tools/dev/blockface_probe.ts): each view with the Blender-carved set (bf 1)
// and without it (bf 0) from one page load. Serve the tree (npx vite --port $E2E_PORT), then
//   node tools/dev/gpu_slot.mjs bfprobe -- node tools/dev/blockface_probe.mjs <tag> [view,view] [?query]
// frames to $OUT (default shots)/bfprobe-<view>-<tag>-bf<0|1>.png
import { chromium } from 'playwright';
const TAG = process.argv[2] ?? 'a', ONLYV = process.argv[3] && process.argv[3] !== 'all' ? process.argv[3].split(',') : null, URLX = process.argv[4] ?? '';
const S303 = { sunAz: 238.8, sunAlt: 19.3 }, S25pm = { sunAz: 271, sunAlt: 32 }, S25am = { sunAz: 111, sunAlt: 61 }, S25e = { sunAz: 100, sunAlt: 40 };
const V = [
  { n: 'stair-climb-pm', e: -43.9, n2: 128, eye: 1.6, az: 341, pitch: 12, fov: 60, ...S25pm },
  { n: 'stair-tread-arm', e: -43.9, n2: 128, eye: 1.6, az: 341, pitch: -38, fov: 60, dist: 1.0, ...S25pm },
  { n: 'stair-parapet-arm', e: -43.9, n2: 128, eye: 1.6, az: 250, pitch: -5, fov: 60, dist: 1.2, ...S25pm },
  { n: 'terrace-wall-near', e: -73.5, n2: 22, eye: 1.6, az: 71, pitch: 18, fov: 60, ...S303 },
  { n: 'terrace-wall-arm', e: -80, n2: 22, eye: 1.6, az: 71, pitch: 4, fov: 60, dist: 1.3, ...S303 },
  { n: 'terrace-wall-3m', e: -80, n2: 22, eye: 1.6, az: 71, pitch: 10, fov: 60, dist: 3.5, ...S303 },
  { n: 'terrace-foot-arm', e: -80, n2: 40, eye: 1.6, az: 80, pitch: -12, fov: 60, dist: 1.6, ...S303 },
  { n: 'tachara-s-stair', court: true, e: -21, n2: -112, eye: 1.6, az: 341, pitch: 6, fov: 60, ...S25am },
  { n: 'tachara-stair-arm', court: true, e: -21, n2: -112, eye: 1.6, az: 341, pitch: -8, fov: 60, dist: 1.4, ...S25am },
  { n: 'apadana-e-stair-raking', court: true, e: 80, n2: -14, eye: 1.6, az: 300, pitch: 0, fov: 60, ...S25e },
  { n: 'apadana-e-stair-arm', court: true, e: 80, n2: -14, eye: 1.6, az: 300, pitch: -6, fov: 60, dist: 1.5, ...S25e },
  // raking light (the sun set ~75° off the face's normal: the relief's own test; not a moment's sun)
  { n: 'wall-rake-arm', e: -80, n2: 22, eye: 1.6, az: 71, pitch: 4, fov: 60, dist: 1.3, sunAz: 321, sunAlt: 10 },
  { n: 'wall-rake-4m', e: -80, n2: 22, eye: 1.6, az: 71, pitch: 10, fov: 60, dist: 4, sunAz: 321, sunAlt: 10 },
  { n: 'stair-rake-arm', e: -43.9, n2: 128, eye: 1.6, az: 341, pitch: -30, fov: 60, dist: 1.2, sunAz: 231, sunAlt: 15 },
  { n: 'stair-rake-4m', e: -43.9, n2: 134, eye: 1.6, az: 341, pitch: 0, fov: 60, sunAz: 231, sunAlt: 15 },
  { n: 'wall-high-rake', e: -80, n2: 22, eye: 1.6, az: 71, pitch: 28, fov: 60, dist: 2.2, sunAz: 321, sunAlt: 10 },
  { n: 'apadana-stair-rake', court: true, e: 80, n2: -14, eye: 1.6, az: 300, pitch: -6, fov: 60, dist: 2.0, sunAz: 20, sunAlt: 20 },
  { n: 'samples-4m', court: true, e: -24, n2: 94, eye: 1.6, az: 341 + 0, pitch: -2, fov: 60, ...S25pm },
  { n: 'samples-arm', court: true, e: -30, n2: 98.2, eye: 1.4, az: 341, pitch: -5, fov: 60, ...S25pm },
  { n: 'merlon-arm', court: true, e: -15, n2: 98.9, eye: 0.5, az: 341, pitch: 0, fov: 60, sunAz: 300, sunAlt: 25 },
  // D-321 rev 2: the arrises at arm's length in a low sun: a stair's nosings, a parapet's coping, a wall's corner
  { n: 'nosing-arm', e: -43.9, n2: 131.5, eye: 1.6, az: 341, pitch: -32, fov: 35, sunAz: 250, sunAlt: 18 },
  { n: 'block-corner', court: true, e: -10.2, n2: 98.3, eye: 1.25, az: 315, pitch: -12, fov: 40, sunAz: 200, sunAlt: 15 },
  { n: 'block-top', court: true, e: -12, n2: 98.6, eye: 1.5, az: 341, pitch: -40, fov: 40, sunAz: 250, sunAlt: 12 },
  { n: 'corner-arm', court: true, e: 80, n2: -14, eye: 1.6, az: 300, pitch: -10, fov: 45, dist: 1.2, sunAz: 20, sunAlt: 18 },
];
const b = await chromium.launch({ channel: 'chrome', headless: true, args: ['--enable-unsafe-webgpu', '--ignore-gpu-blocklist'] });
const p = await b.newPage({ viewport: { width: 960, height: 540 } }); const logs = [];
p.on('console', m => { if (m.type() === 'error' || m.type() === 'warning') logs.push(m.type() + ' ' + m.text().slice(0, 300)); }); p.on('pageerror', e => logs.push('pageerror ' + e));
const t0 = Date.now();
await p.goto('http://localhost:' + (process.env.E2E_PORT ?? '5321') + '/tools/dev/blockface_probe.html' + URLX);
await p.waitForFunction(() => window.__ready, null, { timeout: 900000 });
console.log('ready', await p.evaluate(() => window.__ready), (Date.now() - t0) / 1000, 's', JSON.stringify(await p.evaluate(() => window.__bf)));
const BFS = (process.env.BF ?? '1,0').split(',').map(Number); // (a gain > 1 exaggerates the detail: its placement)
for (const v of V) { if (ONLYV && !ONLYV.includes(v.n)) continue;
  for (const bf of BFS) {
    const ar = +(process.env.AR ?? 1); // D-321 rev 2: the arris bands on (1) or off (0)
    const errs = await p.evaluate(v => window.__shot({ ...v, n: v.n2 }), { ...v, bf, ar });
    const hit = await p.evaluate(() => window.__hit ?? null);
    await p.screenshot({ timeout: 600000, path: `${process.env.OUT ?? 'shots'}/bfprobe-${v.n}-${TAG}-bf${bf}${process.env.AR === '0' ? '-ar0' : ''}.png` });
    console.log(v.n, 'bf', bf, JSON.stringify(await p.evaluate(() => window.__arris)), hit ? JSON.stringify(hit) : '', errs.length ? errs : '', (Date.now() - t0) / 1000);
  } }
console.log(logs.slice(0, 12).join('\n')); await b.close();
