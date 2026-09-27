// D-300: the Terrace's surfaces without the world (tools/dev/terrace_probe.ts): seconds a load against the game's 11-30 min.
// Serve the tree on its port (npx vite --port <E2E_PORT>), then: node tools/dev/terrace_probe.mjs <tag> [view,view] [?query]
// (frames to $OUT or shots/tprobe-<view>-<tag>.png). The same poses as moments.spec's Terrace views; the sun from the ephemeris
// at each moment (true az / alt). Heavy use goes through the GPU slot wrapper (fars-assets/gpu_slot.mjs)
import { chromium } from 'playwright';
const TAG = process.argv[2] ?? 'a', ONLYV = process.argv[3]?.split(','), URLX = process.argv[4] ?? '';
const S303 = { sunAz: 238.8, sunAlt: 19.3 }, S25pm = { sunAz: 271, sunAlt: 32 }, S25am = { sunAz: 111, sunAlt: 61 };
const V = [
  { n: 'terrace-wall-lens', e: -66, n2: 22, eye: 1.6, az: 71, pitch: 12, fov: 60, ...S303 },
  { n: 'terrace-wall-near', e: -73.5, n2: 22, eye: 1.6, az: 71, pitch: 18, fov: 60, ...S303 },
  { n: 'gate-w-lens', court: true, e: -21.5, n2: 133, eye: 1.6, az: 71, pitch: 10, fov: 60, ...S303 },
  { n: 'gate-w-day', court: true, e: -40, n2: 124.6, eye: 1.6, az: 90, pitch: 15, fov: 60, ...S303 },
  { n: 'apadana-nw-court', court: true, e: -50, n2: 70, eye: 1.6, az: 127, pitch: 6, fov: 60, ...S303 },
  { n: 'stair-climb-pm', e: -43.9, n2: 128, eye: 1.6, az: 341, pitch: 12, fov: 60, ...S25pm },
  { n: 'tachara-s-stair', court: true, e: -21, n2: -112, eye: 1.6, az: 341, pitch: 6, fov: 60, ...S25am },
  { n: 'calib-24', e: -166.6, n2: 108.9, eye: 1.6, az: 117, pitch: 7.5, fov: 34.4, ...S303 },
  { n: 'calib-24-ground', e: -166.6, n2: 108.9, eye: 1.6, az: 117, pitch: 7.5, fov: 34.4, now: 1, ...S303 },
];
const b = await chromium.launch({ channel: 'chrome', headless: true, args: ['--enable-unsafe-webgpu', '--ignore-gpu-blocklist'] });
const p = await b.newPage({ viewport: { width: 960, height: 540 } }); const logs = [];
p.on('console', m => { if (m.type() === 'error' || m.type() === 'warning') logs.push(m.type() + ' ' + m.text().slice(0, 300)); }); p.on('pageerror', e => logs.push('pageerror ' + e));
const t0 = Date.now();
await p.goto('http://localhost:' + (process.env.E2E_PORT ?? '5271') + '/tools/dev/terrace_probe.html' + URLX);
await p.waitForFunction(() => window.__ready, null, { timeout: 900000 });
console.log('ready', await p.evaluate(() => window.__ready), (Date.now() - t0) / 1000, 's');
for (const v of V) { if (ONLYV && !ONLYV.includes(v.n)) continue;
  const errs = await p.evaluate(v => window.__shot({ ...v, n: v.n2 }), v);
  await p.screenshot({ timeout: 600000, path: `${process.env.OUT ?? 'shots'}/tprobe-${v.n}-${TAG}.png` }); console.log(v.n, errs.length ? errs : '', (Date.now() - t0) / 1000); }
console.log(logs.slice(0, 12).join('\n')); await b.close();
