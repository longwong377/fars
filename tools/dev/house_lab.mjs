// D-324: the houses' probe (tools/dev/house_lab.ts); serve the tree (npx vite --port <E2E_PORT>), then
// node tools/dev/gpu_slot.mjs houselab -- node tools/dev/house_lab.mjs <tag> [view,view] [?query]   (frames to $OUT or shots/houselab-<view>-<tag>.png)
import { chromium } from 'playwright';
const TAG = process.argv[2] ?? 'a', ONLYV = process.argv[3] && process.argv[3] !== 'all' ? process.argv[3].split(',') : null, URLX = process.argv[4] ?? '';
const V = [
  // near (the full level): a court, a street door, looking down into a court from 7 m
  { n: 'court-s1', cam: 'court:q_s1:3', fov: 60 }, { n: 'court-w1', cam: 'court:q_w1:7', fov: 60, sunAz: 120, sunAlt: 30 },
  { n: 'door-s1', cam: 'door:q_s1:3', fov: 55 }, { n: 'door-s3', cam: 'door:q_s3:11:3.5', fov: 55, sunAz: 250, sunAlt: 35 },
  { n: 'above-s1', cam: 'above:q_s1:5', fov: 60 },
  // the middle ring and the far level: a quarter from 60, 120 and 300 m, low and from the height of the Terrace
  { n: 'far60-s1', cam: 'far:q_s1:60:2:200', fov: 50 }, { n: 'far120-s1', cam: 'far:q_s1:120:6:200', fov: 45 },
  { n: 'far300-s1', cam: 'far:q_s1:300:20:160', fov: 40 }, { n: 'far600-w1', cam: 'far:q_w1:600:40:90', fov: 35 },
  // a village from 30 m and 200 m
  { n: 'village30', cam: 'village:0:40:2:180', fov: 60 }, { n: 'village200', cam: 'village:0:200:8:180', fov: 45 },
];
const b = await chromium.launch({ channel: 'chrome', headless: true, args: ['--enable-unsafe-webgpu', '--ignore-gpu-blocklist'] });
const p = await b.newPage({ viewport: { width: 960, height: 540 } }); const logs = [];
p.on('console', m => { if (m.type() === 'error' || m.type() === 'warning') logs.push(m.type() + ' ' + m.text().slice(0, 300)); }); p.on('pageerror', e => logs.push('pageerror ' + e));
const t0 = Date.now();
await p.goto('http://localhost:' + (process.env.E2E_PORT ?? '5324') + '/tools/dev/house_lab.html' + URLX);
await p.waitForFunction(() => window.__ready, null, { timeout: 1500000 });
console.log('ready', await p.evaluate(() => window.__ready), (Date.now() - t0) / 1000, 's');
if (process.env.SITES) console.log(JSON.stringify(await p.evaluate(() => window.__sites)));
for (const v of V) { if (ONLYV && !ONLYV.includes(v.n)) continue;
  const res = await p.evaluate(v => window.__shot(v), v);
  await p.screenshot({ timeout: 600000, path: `${process.env.OUT ?? 'shots'}/houselab-${v.n}-${TAG}.png` }); console.log(v.n, JSON.stringify(res), (Date.now() - t0) / 1000); }
console.log(logs.slice(0, 12).join('\n')); await b.close();
