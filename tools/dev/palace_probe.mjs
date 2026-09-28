// D-334: the palaces' walls and roofs on the probe page (tools/dev/palace_probe.ts). Serve the tree (npx vite --port $E2E_PORT), then
//   node tools/dev/gpu_slot.mjs palprobe -- node tools/dev/palace_probe.mjs <tag> [view,view|all] [?query]
// frames to $OUT (default T:/fars-assets-s12/palacewalls/shots)/pal-<view>-<tag>.png. Views are placed from each building's bounds.
import { chromium } from 'playwright';
const TAG = process.argv[2] ?? 'a', ONLYV = process.argv[3] && process.argv[3] !== 'all' ? process.argv[3].split(',') : null, URLX = process.argv[4] ?? '';
const OUT = process.env.OUT ?? 'T:/fars-assets-s12/palacewalls/shots';
const b = await chromium.launch({ channel: 'chrome', headless: true, args: ['--enable-unsafe-webgpu', '--ignore-gpu-blocklist'] });
const p = await b.newPage({ viewport: { width: 960, height: 540 } }); const logs = [];
p.on('console', m => { if (m.type() === 'error' || m.type() === 'warning') logs.push(m.type() + ' ' + m.text().slice(0, 300)); }); p.on('pageerror', e => logs.push('pageerror ' + e));
const t0 = Date.now();
await p.goto('http://localhost:' + (process.env.E2E_PORT ?? '5346') + '/tools/dev/palace_probe.html' + URLX);
await p.waitForFunction(() => window.__ready, null, { timeout: 1800000 });
const BB = await p.evaluate(() => window.__bb);
console.log('ready', await p.evaluate(() => window.__ready), (Date.now() - t0) / 1000, 's', Object.keys(BB).join(' '));
const AT = await p.evaluate(() => window.__at);
const S = { sunAz: 238.8, sunAlt: 25 }, SE = { sunAz: 120, sunAlt: 35 };
const V = [];
// per building: from the S (grid) at 30 m, eye 1.6 m over its floor; at arm's length of the S wall; from above at 45 degrees
for (const [k, B] of Object.entries(BB)) {
  const cx = (B[0] + B[1]) / 2, cy = (B[2] + B[3]) / 2, fl = B[4], top = B[5], R = Math.max(B[1] - B[0], B[3] - B[2]) / 2;
  V.push({ n: `${k}-s30`, eye: [cx + 6, B[2] - 30, fl + 1.6], look: [cx, cy, fl + (top - fl) * 0.45], ...S });
  V.push({ n: `${k}-w30`, eye: [B[0] - 30, cy - 5, fl + 1.6], look: [cx, cy, fl + (top - fl) * 0.45], ...SE });
  V.push({ n: `${k}-high`, eye: [cx - R * 0.9, B[2] - R * 1.1, top + R * 0.9], look: [cx, cy, top - 2], ...S });
  V.push({ n: `${k}-eave`, eye: [cx + 3, B[2] - 9, fl + 1.6], look: [cx, B[2] + 1, top - 0.5], fov: 45, ...S });
}
// the class's own places: a dentil row from 8 m below and out, a spout from 6 m, a wall foot at arm's length (outward normal az)
for (const [k, [e, n, y, az]] of Object.entries(AT)) {
  const ox = Math.cos(az), oy = Math.sin(az), [b, kind] = k.split(':');
  if (kind === 'dentil') V.push({ n: `${b}-dentils`, eye: [e + ox * 7 + oy * 4, n + oy * 7 - ox * 4, y - 6], look: [e, n, y], fov: 40, ...S });
  if (kind === 'spout') V.push({ n: `${b}-spout`, eye: [e + ox * 5 + oy * 3, n + oy * 5 - ox * 3, y - 1.5], look: [e, n, y - 1], fov: 45, ...S });
  if (kind === 'foot') V.push({ n: `${b}-foot-${k.split(':')[2]}`, eye: [e + ox * 1.4 + oy * 0.8, n + oy * 1.4 - ox * 0.8, y + 1.2], look: [e, n, y + 0.4], fov: 55, ...S });
}
// inside: from the hall's middle toward its S wall; the roof close from 25 m over its S edge
for (const [k, B] of Object.entries(BB)) { const cx = (B[0] + B[1]) / 2, cy = (B[2] + B[3]) / 2;
  V.push({ n: `${k}-inside`, eye: [cx + 2, cy + 3, B[4] + 1.6], look: [cx, B[2], B[4] + 2.5], fov: 70, ...S });
  V.push({ n: `${k}-roofnear`, eye: [cx - 6, B[2] - 10, B[5] + 12], look: [cx, B[2] + 4, B[5] - 1], fov: 55, ...S }); }
// round 3: bare courses close (the Tripylon's and Hall of 100 Columns' walls), the roof coat at arm's length (on the Gate's
// roof, by its parapet), the portico entablature from the court at the player's lens
for (const k of ['tripylon', 'hall100']) { const B = BB[k]; const cx = (B[0] + B[1]) / 2; V.push({ n: k + '-bare', eye: [cx + 1, B[2] - 3.5, B[4] + 1.6], look: [cx, B[2], B[4] + 1.8], fov: 60, ...S }); }
{ const B = BB.gate_nations, cx = (B[0] + B[1]) / 2, cy = (B[2] + B[3]) / 2; V.push({ n: 'gate-roof-arm', eye: [cx, B[2] + 2.2, B[5] + 1.6], look: [cx + 2, B[2] + 0.2, B[5] - 0.2], fov: 60, ...S }); V.push({ n: 'gate-roof-walk', eye: [cx - 3, cy, B[5] + 1.6], look: [cx + 6, B[2] + 3, B[5] + 0.2], fov: 60, ...S }); }
{ const B = BB.apadana, cy = (B[2] + B[3]) / 2; V.push({ n: 'apadana-portico-court', eye: [B[1] + 30, cy - 10, 1.6], look: [B[1], cy, 16], fov: 60, ...SE }); }
V.push({ n: 'gate-arm', eye: [-40, 15, 1.6], look: [-40, 30, 1.8], fov: 60, ...S });
const FL = process.env.FLAGS ? JSON.parse(process.env.FLAGS) : [{}];
for (const v of V) { if (ONLYV && !ONLYV.some(o => v.n.startsWith(o))) continue;
  for (const [i, flags] of FL.entries()) {
    const errs = await p.evaluate(v => window.__shot(v), { ...v, flags });
    await p.screenshot({ timeout: 600000, path: `${OUT}/pal-${v.n}-${TAG}${FL.length > 1 ? '-f' + i : ''}.png` });
    console.log(v.n, errs.length ? errs : '', (Date.now() - t0) / 1000);
  } }
console.log(logs.slice(0, 12).join('\n')); await b.close();
