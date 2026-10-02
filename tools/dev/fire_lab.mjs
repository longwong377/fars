// D-530: drive the fire lab (tools/dev/fire_lab.ts). Serve the tree (npx vite --port <.wtport>), then
//   node tools/dev/gpu_slot.mjs firelab -- node tools/dev/fire_lab.mjs <tag> <views.json> [?query]
// views: a JSON array of { n, cam | eye+look, fov, day, hour, weather, xp }. Frames to $OUT (default .scratch/firelab) as
// <n>-<tag>.png, with a stats line per view (exposure, fires' light at the eye, probe weight).
import { chromium } from 'playwright';
import { mkdirSync, readFileSync } from 'node:fs';
const TAG = process.argv[2] ?? 'a', VF = process.argv[3], Q = process.argv[4] ?? '', OUT = process.env.OUT ?? '.scratch/firelab';
mkdirSync(OUT, { recursive: true });
const V = JSON.parse(readFileSync(VF, 'utf8'));
const b = await chromium.launch({ channel: 'chrome', headless: true, args: ['--enable-unsafe-webgpu', '--ignore-gpu-blocklist'] });
const p = await b.newPage({ viewport: { width: 960, height: 540 } }); const logs = [];
p.on('console', m => { if (m.type() === 'error' || m.type() === 'warning') logs.push(m.type() + ' ' + m.text().slice(0, 300)); }); p.on('pageerror', e => logs.push('pageerror ' + e));
const t0 = Date.now();
await p.goto('http://localhost:' + (process.env.PORT ?? readFileSync('.wtport', 'utf8').trim()) + '/tools/dev/fire_lab.html' + Q);
await p.waitForFunction(() => window.__ready, null, { timeout: 1500000 });
console.log('ready', await p.evaluate(() => window.__ready), (Date.now() - t0) / 1000, 's');
for (const v of V) {
  const res = await p.evaluate(v => window.__shot(v), v).catch(e => ({ err: String(e) }));
  await p.screenshot({ timeout: 600000, path: `${OUT}/${v.n}-${TAG}.png` });
  console.log(v.n, JSON.stringify({ x: +res.exposure?.toFixed(3), ev: +res.ev?.toFixed(2), alt: +res.sunAlt?.toFixed(1), fireE: +res.fireE?.toPrecision(3), pvw: +res.pvw?.toFixed(2), pve: +res.pve?.toFixed(3), fires: res.fires, cam: res.cam, err: res.err, errs: res.errs?.length }), ((Date.now() - t0) / 1000).toFixed(0));
}
console.log(logs.slice(0, 12).join('\n')); await b.close();
