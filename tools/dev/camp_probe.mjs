// s17 C3 (D-570): drive tools/dev/camp_probe.html (serve the tree: npx vite --port $E2E_PORT):
//   node tools/dev/camp_probe.mjs <tag> <views.json> [?query]   frames to $OUT or shots/cprobe-<view>-<tag>.png
import { chromium } from 'playwright';
import { readFileSync, mkdirSync } from 'node:fs';
const TAG = process.argv[2] ?? 'a', V = JSON.parse(readFileSync(process.argv[3], 'utf8')), URLX = process.argv[4] ?? '', OUT = process.env.OUT ?? 'shots'; mkdirSync(OUT, { recursive: true });
const b = await chromium.launch(process.env.PW_CHANNEL ? { channel: process.env.PW_CHANNEL, args: ['--enable-unsafe-webgpu'] } : { args: ['--enable-unsafe-webgpu', '--use-angle=swiftshader', '--enable-features=Vulkan'] });
const p = await b.newPage({ viewport: { width: 960, height: 540 } }); const logs = [];
p.on('console', m => { if (m.type() === 'error' || m.type() === 'warning') logs.push(m.type() + ' ' + m.text().slice(0, 300)); }); p.on('pageerror', e => logs.push('pageerror ' + e));
const t0 = Date.now();
await p.goto('http://localhost:' + (process.env.E2E_PORT ?? '5342') + '/tools/dev/camp_probe.html' + URLX);
await p.waitForFunction(() => window.__ready, null, { timeout: 1800000 });
console.log('ready', JSON.stringify(await p.evaluate(() => window.__ready)), (Date.now() - t0) / 1000, 's');
for (const v of V) { const res = await p.evaluate(v => window.__shot(v), v); await p.screenshot({ timeout: 1800000, path: `${OUT}/cprobe-${v.name}-${TAG}.png` }); console.log(v.name, JSON.stringify(res), (Date.now() - t0) / 1000); }
console.log(logs.slice(0, 12).join('\n')); await b.close();
