// D-325: the modelled props in the game's renderer and materials without the world (tools/blender/probe/props_probe.ts):
// each view shot twice, the models (after) and the procedural stand-ins (before). Serve the tree (npx vite --port $E2E_PORT),
// then: node tools/blender/probe/props_probe.mjs <outDir> [view,view]
import { chromium } from 'playwright';
import { mkdirSync, writeFileSync } from 'node:fs';
const OUT = process.argv[2] ?? 'T:/fars-assets-s12/props/probe', ONLY = process.argv[3]?.split(',');
mkdirSync(OUT, { recursive: true });
const SUN = [0.55, 0.62, 0.55];
const V = (n, eye, at, fov = 60) => ({ n, eye, at, fov });
export const VIEWS = [
  V('furn-couches', [2.6, 1.6, 4.2], [3.0, 0.4, 0]), V('furn-small', [10.5, 1.5, 3.2], [10.5, 0.45, 0]), V('furn-burner-chest', [14.5, 1.5, 3.2], [14.5, 0.6, 0]),
  V('furn-carpet-rolls', [21.5, 1.6, 4.0], [21.5, 0.1, 0]), V('furn-hanging-canopy', [31.0, 1.8, 8.0], [32.5, 1.6, 0]),
  V('tools-a', [3.5, 1.1, -3.6], [3.5, 0.0, -6]), V('tools-b', [9.5, 1.1, -3.6], [9.5, 0.0, -6]), V('tools-c', [15.5, 1.1, -3.6], [15.5, 0.0, -6]), V('tools-d', [21.5, 1.1, -3.6], [21.5, 0.0, -6]), V('tools-e', [27.5, 1.1, -3.6], [27.5, 0.0, -6]),
  V('tools-close-a', [1.6, 0.55, -5.1], [1.6, 0.0, -6.0], 50), V('tools-close-b', [6.5, 0.55, -5.1], [6.5, 0.0, -6.0], 50), V('tools-close-c', [12.5, 0.55, -5.1], [12.5, 0.0, -6.0], 50), V('tools-close-d', [19.5, 0.55, -5.1], [19.5, 0.0, -6.0], 50), V('tools-close-e', [26.5, 0.55, -5.1], [26.5, 0.0, -6.0], 50),
  V('fire-doors', [5.5, 1.7, -7.5], [5.5, 0.8, -12]), V('goods', [4.0, 1.6, -15.6], [4.0, 0.8, -18]), V('rooms', [12.0, 1.4, -16.2], [12.5, 0.2, -18]),
  V('fittings-a', [7.0, 1.8, -20.2], [7.0, 0.5, -24]), V('fittings-b', [20.0, 1.8, -20.2], [20.0, 0.5, -24]), V('fittings-c', [31.0, 1.8, -20.2], [31.0, 0.5, -24]),
  V('work-a', [8, 1.8, 4.0], [8, 0.3, 9]), V('work-b', [22, 1.8, 4.0], [22, 0.3, 9]), V('work-c', [36, 1.8, 4.0], [36, 0.3, 9]), V('work-d', [50, 1.8, 4.0], [50, 0.3, 9]),
  V('work-e', [8, 2.2, 7.5], [8, 0.3, 13]), V('work-f', [25, 2.2, 7.5], [25, 0.3, 13]), V('work-g', [42, 2.2, 7.5], [42, 0.3, 13]), V('work-h', [15, 3.5, 12], [15, 0.3, 19]), V('work-i', [40, 3.5, 12], [40, 0.3, 19]),
];
const b = await chromium.launch({ channel: process.env.PW_CHANNEL ?? 'chrome', headless: true, args: ['--enable-unsafe-webgpu', '--ignore-gpu-blocklist'] });
const p = await b.newPage({ viewport: { width: 1600, height: 900 } }); const logs = [];
p.on('console', m => { if (m.type() === 'error' || m.type() === 'warning') logs.push(m.type() + ' ' + m.text().slice(0, 300)); }); p.on('pageerror', e => logs.push('pageerror ' + e));
const t0 = Date.now();
await p.goto('http://localhost:' + (process.env.E2E_PORT ?? '5325') + '/tools/blender/probe/props_probe.html' + (process.env.Q ?? ''));
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
