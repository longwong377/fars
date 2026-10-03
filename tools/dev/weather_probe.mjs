// V5 (D-521): runs tools/dev/weather_probe.html. Serve the tree on its port (npx vite --port <E2E_PORT>), then:
//   node tools/dev/weather_probe.mjs <tag> [view,view] [?query]    frames to $OUT (default shots/) as wx-<view>-<tag>.png
// Views: a spring rain on the plain with a flock, the wet ground after it, a dry June track with a herd and a pack string
// raising dust, the herd at 5 m and 30 m, a cold winter morning; V='[...]' adds more.
import { chromium } from 'playwright';
const TAG = process.argv[2] ?? 'a', ONLYV = process.argv[3]?.split(',').filter(Boolean), URLX = process.argv[4] ?? '';
const flock = { sp: ['sheep', 'sheep', 'goat', 'sheep'], n: 14, ahead: 16, side: 1, kind: 'flock' };
const V = [
  { n: 'rain-spring', e: -800, n2: 200, eye: 1.6, az: 251, pitch: -4, fov: 60, day: 8, sunAz: 130, sunAlt: 40, rain: 1, wet: 0.9, wind: 4, cloud: 1, herd: [flock] },
  { n: 'wet-after', e: -800, n2: 200, eye: 1.6, az: 251, pitch: -14, fov: 60, day: 9, sunAz: 140, sunAlt: 35, rain: 0, wet: 0.8, cloud: 0.6 },
  { n: 'dust-june', e: -900, n2: 420, eye: 1.6, az: 250, pitch: -5, fov: 60, day: 60, sunAz: 250, sunAlt: 18, wet: 0, wind: 3, cloud: 0,
    herd: [{ ...flock, n: 24, ahead: 22 }, { sp: ['donkey_pack', 'mule_pack', 'donkey_pack'], n: 3, ahead: 9, side: -4, kind: 'string', pace: 1.1 }] },
  { n: 'herd-5m', e: -900, n2: 420, eye: 1.6, az: 250, pitch: -8, fov: 60, day: 20, sunAz: 120, sunAlt: 35, wet: 0, cloud: 0.1,
    herd: [{ sp: ['ox', 'cow', 'calf', 'donkey'], n: 6, ahead: 5, kind: 'flock' }] },
  { n: 'herd-30m', e: -900, n2: 420, eye: 1.6, az: 250, pitch: -3, fov: 60, day: 20, sunAz: 120, sunAlt: 35, wet: 0, cloud: 0.1,
    herd: [{ ...flock, n: 30, ahead: 30 }, { sp: ['horse_saddle', 'dromedary', 'mule_pack'], n: 3, ahead: 26, side: -8, kind: 'string', pace: 1 }] },
  { n: 'cold-morning', e: -800, n2: 200, eye: 1.6, az: 251, pitch: -4, fov: 60, day: 270, sunAz: 120, sunAlt: 8, wet: 0.5, cloud: 0.3, tempC: -2, herd: [{ ...flock, n: 10, ahead: 8 }] },
];
if (process.env.V) V.push(...JSON.parse(process.env.V));
const b = await chromium.launch({ channel: 'chrome', headless: true, args: ['--enable-unsafe-webgpu', '--ignore-gpu-blocklist'] });
const p = await b.newPage({ viewport: { width: 1280, height: 720 } }); const logs = [];
p.on('console', m => { if (m.text().startsWith('[stage]')) console.log(m.text()); if (m.type() === 'error' || m.type() === 'warning') logs.push(m.type() + ' ' + m.text().slice(0, 300)); }); p.on('pageerror', e => logs.push('pageerror ' + e));
const t0 = Date.now();
await p.goto('http://localhost:' + (process.env.E2E_PORT ?? '5189') + '/tools/dev/weather_probe.html' + URLX, { timeout: 600000, waitUntil: 'domcontentloaded' });
try { await p.waitForFunction(() => window.__ready, null, { timeout: 900000 }); } catch { console.log('not ready', await p.evaluate(() => window.__stage)); console.log(logs.join('\n')); await b.close(); process.exit(1); }
if (await p.evaluate(() => window.__ready) !== true) { console.log(await p.evaluate(() => window.__ready)); console.log(logs.join('\n')); await b.close(); process.exit(1); }
for (const v of V) { if (ONLYV && !ONLYV.includes(v.n)) continue;
  const res = await p.evaluate(v => window.__shot({ ...v, n: v.n2 }), v);
  await p.screenshot({ timeout: 600000, path: `${process.env.OUT ?? 'shots'}/wx-${v.n}-${TAG}.png` });
  console.log(v.n, JSON.stringify(res).slice(0, 400), ((Date.now() - t0) / 1000).toFixed(0) + ' s');
}
console.log(logs.slice(0, 12).join('\n')); await b.close();
