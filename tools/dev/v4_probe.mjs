// D-510 (s17 V4): the Terrace's carved stone on the palace probe page (tools/dev/palace_probe.ts): the Apadana's N stair, the
// Gate of All Nations' colossi and the Tachara's S front, each at ~5 m and ~40 m at the player's lens.
//   E2E_PORT=<port> node tools/dev/v4_probe.mjs <tag> [view,view] [?query]   (frames to $OUT, default shots/v4)
import { chromium } from 'playwright';
import { writeFileSync } from 'node:fs';
const TAG = process.argv[2] ?? 'a', ONLYV = process.argv[3] && process.argv[3] !== 'all' ? process.argv[3].split(',') : null, URLX = process.argv[4] ?? '';
const OUT = process.env.OUT ?? 'shots/v4';
const b = await chromium.launch({ channel: 'chrome', headless: true, args: ['--enable-unsafe-webgpu', '--ignore-gpu-blocklist'] });
const p = await b.newPage({ viewport: { width: 1280, height: 720 } }); const logs = [];
p.on('console', m => { if (m.type() === 'error' || m.type() === 'warning') logs.push(m.type() + ' ' + m.text().slice(0, 300)); }); p.on('pageerror', e => logs.push('pageerror ' + e));
await p.routeWebSocket(/.*/, () => {}).catch(() => {}); // no vite HMR: an edit in the tree must not reload the probe mid-run
const t0 = Date.now();
await p.goto('http://localhost:' + (process.env.E2E_PORT ?? '5188') + '/tools/dev/v4_probe.html' + URLX);
await p.waitForFunction(() => window.__ready, null, { timeout: 1800000 });
const BB = await p.evaluate(() => window.__bb);
writeFileSync(OUT + '/bb.json', JSON.stringify(BB, null, 1));
console.log('ready', await p.evaluate(() => window.__ready), (Date.now() - t0) / 1000, 's');
const S = { sunAz: 238.8, sunAlt: 30 }, SE = { sunAz: 120, sunAlt: 40 };
const V = JSON.parse(process.env.VIEWS ?? 'null') ?? [];
const c = k => { const B = BB[k]; return B && [(B[0] + B[1]) / 2, (B[2] + B[3]) / 2, B[4], B[5], B]; };
if (!V.length) V.push(
  { n: 'apa-n-40', eye: [-5, 98, 1.6], look: [-5, 55, 3], fov: 60, ...SE },
  { n: 'apa-n-5', eye: [-22, 64, 1.6], look: [-22, 57, 1.5], fov: 60, ...SE },
  { n: 'apa-n-5b', eye: [-6, 63, 1.6], look: [-14, 58, 1.0], fov: 60, ...SE },
  { n: 'apa-n-2', eye: [-20, 60.5, 1.6], look: [-22, 58.7, 1.2], fov: 60, ...SE },
  { n: 'gate-w-40', eye: [-64, 131, 1.6], look: [-24, 128.4, 5], fov: 60, ...SE },
  { n: 'gate-w-5', eye: [-29.9, 125.4, 1.6], look: [-23.9, 128.4, 4], fov: 60, ...SE },
  { n: 'gate-w-2', eye: [-26, 127.2, 1.6], look: [-22, 130.5, 3.5], fov: 60, ...SE },
  { n: 'gate-e-40', eye: [64, 125, 1.6], look: [24, 128.4, 5], fov: 60, ...S },
  { n: 'gate-e-5', eye: [30, 131.4, 1.6], look: [24, 128.4, 4], fov: 60, ...S },
  { n: 'gate-e-2', eye: [26.5, 129.6, 1.6], look: [22, 126.3, 3.5], fov: 60, ...S },
  { n: 'tach-s-40', eye: [-15, -142, 1.6], look: [-21, -100, 3], fov: 60, ...S },
  { n: 'tach-s-5', eye: [-21, -107, 1.6], look: [-21, -100.5, 1.2], fov: 60, ...S },
  { n: 'apa-cap', eye: [-4, 47, 4.6], look: [-4, 40, 21], fov: 60, ...S });
for (const v of V) { if (ONLYV && !ONLYV.includes(v.n)) continue;
  const errs = await p.evaluate(v => window.__shot(v), v);
  await p.screenshot({ timeout: 1500000, path: `${OUT}/${v.n}-${TAG}.png` }); console.log(v.n, errs.length ? errs : '', (Date.now() - t0) / 1000); }
console.log(logs.slice(0, 12).join('\n')); await b.close();
