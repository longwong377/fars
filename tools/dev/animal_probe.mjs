// D-326: the animals' probe (tools/dev/animal_probe.ts). Serve the tree (npx vite --port $E2E_PORT), then
//   node tools/dev/animal_probe.mjs <tag> [shots.json] [?query]   (frames to $OUT or shots/animal-<name>-<tag>.png)
// shots.json: [{ name, az, el, dist, target, t, states?, only?, fov? }]; default: a row view of every species and close views.
import { chromium } from 'playwright';
import { readFileSync } from 'node:fs';
const TAG = process.argv[2] ?? 'a', SHOTS = process.argv[3] && process.argv[3] !== '-' ? JSON.parse(readFileSync(process.argv[3], 'utf8')) : null, URLX = process.argv[4] ?? '';
const b = await chromium.launch({ channel: 'chrome', headless: true, args: ['--enable-unsafe-webgpu', '--ignore-gpu-blocklist'] });
const p = await b.newPage({ viewport: { width: 1280, height: 720 } }); const logs = [];
p.on('console', m => { if (m.type() === 'error' || m.type() === 'warning') logs.push(m.type() + ' ' + m.text().slice(0, 300)); }); p.on('pageerror', e => logs.push('pageerror ' + e));
const t0 = Date.now();
await p.goto('http://localhost:' + (process.env.E2E_PORT ?? '5326') + '/tools/dev/animal_probe.html' + URLX);
await p.waitForFunction(() => window.__ready, null, { timeout: 900000 });
console.log('ready', await p.evaluate(() => window.__ready), (Date.now() - t0) / 1000, 's', JSON.stringify(await p.evaluate(() => window.__models)));
const layout = await p.evaluate(() => window.__layout);
const shots = SHOTS ?? layout.map(l => ({ name: l.sp, az: 55, el: 14, dist: 3 + 2.2 * (l.len ?? 1), target: [l.x, 0.7, 4.8], t: 3.1 }));
for (const v of shots) {
  if (v.sp) { const l = layout.find(q => q.sp === v.sp); const B = await p.evaluate(sp => window.__len(sp), v.sp); v.target = [l.x, B * 0.4, v.row ?? 1.6]; v.dist = v.d ?? 1.6 + 2.4 * B; }
  const res = await p.evaluate(v => window.__shot(v), v);
  await p.screenshot({ timeout: 600000, path: `${process.env.OUT ?? 'shots'}/animal-${v.name}-${TAG}.png` }); console.log(v.name, JSON.stringify(res), (Date.now() - t0) / 1000);
}
console.log(logs.slice(0, 12).join('\n')); await b.close();
