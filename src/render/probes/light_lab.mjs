// D-480: drive the light lab (light_lab.ts). Serve the tree (npx vite --port <port>), then
//   node tools/dev/gpu_slot.mjs lightlab -- node src/render/probes/light_lab.mjs <tag> [views.json] [?query]
// views: a JSON array of { n, cam, fov, day, hour, weather, vis, tone }; default: the five bands at a court, a lane door and a
// far view. Frames to $OUT (default .scratch/lightlab), as <n>-<tag>.png, with a stats line per view.
import { chromium } from 'playwright';
import { mkdirSync, readFileSync } from 'node:fs';
const TAG = process.argv[2] ?? 'a', VF = process.argv[3] && process.argv[3] !== '-' ? process.argv[3] : null, Q = process.argv[4] ?? '', OUT = process.env.OUT ?? '.scratch/lightlab';
mkdirSync(OUT, { recursive: true });
const bands = [['dawn', 6.2], ['morn', 8.5], ['noon', 12.5], ['late', 16.5], ['gold', 18.0], ['dusk', 18.9], ['night', 22.5]];
const D = [];
for (const [b, h] of bands) {
  D.push({ n: `court-${b}`, cam: 'court:q_s1:3', fov: 60, hour: h });
  D.push({ n: `door-${b}`, cam: 'door:q_s3:11:3.5', fov: 55, hour: h });
  D.push({ n: `far-${b}`, cam: 'far:q_s1:300:20:160', fov: 45, hour: h });
}
D.push({ n: 'court-overcast', cam: 'court:q_s1:3', fov: 60, hour: 12.5, weather: 'overcast' }, { n: 'far-overcast', cam: 'far:q_s1:300:20:160', fov: 45, hour: 12.5, weather: 'overcast' });
const V = VF ? JSON.parse(readFileSync(VF, 'utf8')) : D;
const b = await chromium.launch({ channel: 'chrome', headless: true, args: ['--enable-unsafe-webgpu', '--ignore-gpu-blocklist'] });
const p = await b.newPage({ viewport: { width: 960, height: 540 } }); const logs = [];
p.on('console', m => { if (m.type() === 'error' || m.type() === 'warning') logs.push(m.type() + ' ' + m.text().slice(0, 300)); }); p.on('pageerror', e => logs.push('pageerror ' + e));
const t0 = Date.now();
await p.goto('http://127.0.0.1:' + (process.env.PORT ?? '5190') + '/src/render/probes/light_lab.html' + Q);
await p.waitForFunction(() => window.__ready, null, { timeout: 1500000 });
console.log('ready', await p.evaluate(() => window.__ready), (Date.now() - t0) / 1000, 's');
for (const v of V) {
  const res = await p.evaluate(v => window.__shot(v), v);
  await p.screenshot({ timeout: 600000, path: `${OUT}/${v.n}-${TAG}.png` });
  console.log(v.n, JSON.stringify({ x: +res.exposure?.toFixed(3), ev: +res.ev?.toFixed(2), alt: +res.sunAlt?.toFixed(1), lux: +res.lux?.toPrecision(3), g: +res.gain?.toPrecision(3), cond: res.cond, errs: res.errs?.length }), ((Date.now() - t0) / 1000).toFixed(0));
}
console.log(logs.slice(0, 12).join('\n')); await b.close();
