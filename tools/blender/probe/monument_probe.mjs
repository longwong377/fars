// D-329: the Blender-built monuments in the game renderer and materials without the world (tools/blender/probe/monument_probe.ts):
// each view shot twice, the models (after) and the procedural stand-ins (before). Serve the tree (npx vite --port $E2E_PORT),
// then: node tools/blender/probe/monument_probe.mjs <outDir> [view,view]
import { chromium } from 'playwright';
import { mkdirSync, writeFileSync } from 'node:fs';
const OUT = process.argv[2] ?? 'T:/fars-assets-s12/ajori_naqsh/probe', ONLY = process.argv[3]?.split(',');
mkdirSync(OUT, { recursive: true });
const SUN = [0.6, 0.6, 0.35];
const V = (n, eye, at, fov = 60) => ({ n, eye, at, fov });
export const VIEWS = [
  V("aj-far", [58, 18, 1.6], [19.5, -2, 5], 70), V("aj-facade", [27, 7, 1.6], [19.5, 6, 3], 70), V("aj-near", [21.5, 5.5, 1.6], [19.5, 5.2, 2.2], 60),
  V("aj-corridor", [22, 0.3, 1.6], [0, 2.1, 2.2], 70), V("aj-room", [6.5, -3, 1.6], [-7, 3, 2.5], 70), V("aj-top", [48, -30, 9], [19.5, 0, 11], 60),
];
const b = await chromium.launch({ channel: process.env.PW_CHANNEL ?? 'chrome', headless: true, args: ['--enable-unsafe-webgpu', '--ignore-gpu-blocklist'] });
const p = await b.newPage({ viewport: { width: 1600, height: 900 } }); const logs = [];
p.on('console', m => { if (m.type() === 'error' || m.type() === 'warning') logs.push(m.type() + ' ' + m.text().slice(0, 300)); }); p.on('pageerror', e => logs.push('pageerror ' + e));
const t0 = Date.now();
await p.goto('http://localhost:' + (process.env.E2E_PORT ?? '5341') + '/tools/blender/probe/monument_probe.html' + (process.env.Q ?? ''));
await p.waitForFunction(() => window.__ready, null, { timeout: 1800000 });
const ready = await p.evaluate(() => window.__ready); console.log('ready', JSON.stringify(ready).slice(0, 400), (Date.now() - t0) / 1000, 's');
const rec = { ready, views: [] };
for (const v of VIEWS) { if (ONLY && !ONLY.includes(v.n)) continue;
  for (const [tag, before] of [['after', false], ['before', true]]) {
    const r = await p.evaluate(a => window.__shot(a), { ...v, sun: SUN, before });
    await p.screenshot({ timeout: 600000, path: `${OUT}/${v.n}-${tag}.png` });
    rec.views.push({ n: v.n, tag, ...r }); console.log(v.n, tag, r.errs.length ? r.errs : '', JSON.stringify(r.info), (Date.now() - t0) / 1000);
  } }
rec.logs = logs.slice(0, 30); writeFileSync(`${OUT}/probe.json`, JSON.stringify(rec, null, 1));
console.log(logs.slice(0, 12).join('\n')); await b.close();
