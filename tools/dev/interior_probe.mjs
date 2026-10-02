// s17 C7 (D-610): the interiors probe (tools/dev/interior_probe.ts). Serve the tree (npx vite --port <E2E_PORT>), then
// node tools/dev/interior_probe.mjs <tag> [?site=q_s1&webgl | ?terrace&webgl]   (frames to $OUT or shots/iprobe-<view>-<tag>.png)
// Views: V (JSON) or, by default, the quarter from above at three of its street doors and through one doorway at eye height.
import { chromium } from 'playwright';
const TAG = process.argv[2] ?? 'a', URLX = process.argv[3] ?? '?site=q_s1&webgl', OUT = process.env.OUT ?? 'shots';
const b = await chromium.launch(process.env.PW_CHANNEL ? { channel: process.env.PW_CHANNEL, args: ['--enable-unsafe-webgpu'] } : { args: ['--enable-unsafe-webgpu', '--use-angle=swiftshader', '--enable-features=Vulkan'] });
const p = await b.newPage({ viewport: { width: 960, height: 540 } }); const logs = [];
p.on('console', m => { if (m.type() === 'error' || m.type() === 'warning') logs.push(m.type() + ' ' + m.text().slice(0, 300)); }); p.on('pageerror', e => logs.push('pageerror ' + e));
const t0 = Date.now();
await p.goto('http://localhost:' + (process.env.E2E_PORT ?? '5371') + '/tools/dev/interior_probe.html' + URLX);
await p.waitForFunction(() => window.__ready, null, { timeout: 1800000 });
console.log('ready', JSON.stringify(await p.evaluate(() => window.__ready)), (Date.now() - t0) / 1000, 's');
const S = await p.evaluate(() => window.__site);
let V = process.env.V ? JSON.parse(process.env.V) : [];
const RM = await p.evaluate(() => window.__rooms ?? []);
if (!V.length && process.env.ROOMS) for (const use of process.env.ROOMS.split(',')) { const R = RM.filter(q => q.use === use)[+(process.env.PICK ?? 3)] ?? RM.find(q => q.use === use); if (!R) continue;
  const az = (90 - R.theta * 180 / Math.PI + 360) % 360; V.push({ name: `room-${use}-${R.id.split(':').slice(1).join('_')}`, e: R.c[0] - Math.sin(az * Math.PI / 180) * 2.6, n: R.c[1] - Math.cos(az * Math.PI / 180) * 2.6, eye: 4.6, az, pitch: -58, fov: 62, at: R.c }); }
if (!V.length && S.doors) for (const k of [3, 11, 19]) { const d = S.doors[k % S.doors.length], [e, n] = d.in, [oe, on] = d.out, az = Math.atan2(e - oe, n - on) * 180 / Math.PI;
  V.push({ name: `above-${d.id}`, e: e - Math.sin(az * Math.PI / 180) * 6, n: n - Math.cos(az * Math.PI / 180) * 6, eye: 9, az, pitch: -52, fov: 60, at: [e, n] });
  V.push({ name: `door-${d.id}`, e: oe, n: on, eye: 1.6, az, pitch: -12, fov: 70, at: [e, n] }); }
if (!V.length && S.rooms) for (const k of [0, 30, 45, 60]) { const R = S.rooms[k % S.rooms.length]; V.push({ name: `t-${R.b}-${R.use}-${R.id}`, e: R.c[0], n: R.c[1] - 7, y: R.fl, eye: 8, az: 0, pitch: -50, fov: 60, at: R.c }); }
for (const v of V) { const res = await p.evaluate(v => window.__shot(v), v); await p.screenshot({ timeout: 1800000, path: `${OUT}/iprobe-${v.name}-${TAG}.png` }); console.log(v.name, JSON.stringify(res), (Date.now() - t0) / 1000); }
console.log(logs.slice(0, 12).join('\n')); await b.close();
