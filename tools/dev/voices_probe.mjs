// D-336: drive tools/dev/voices_probe.html on the real GPU. Serve the tree (npx vite --port $E2E_PORT), then
//   node tools/dev/gpu_slot.mjs voices -- node tools/dev/voices_probe.mjs "?device=webgpu&dtype=fp32" out.json
import { chromium } from 'playwright';
import { writeFileSync } from 'node:fs';
const Q = process.argv[2] ?? '', OUTF = process.argv[3] ?? 'T:/fars-assets-s12/voices/probe.json';
const b = await chromium.launch({ channel: 'chrome', headless: true, args: ['--enable-unsafe-webgpu', '--ignore-gpu-blocklist', '--autoplay-policy=no-user-gesture-required'] });
const p = await b.newPage(); const logs = [];
p.on('console', m => logs.push(m.type() + ' ' + m.text().slice(0, 300))); p.on('pageerror', e => logs.push('pageerror ' + e));
const t0 = Date.now();
await p.goto('http://localhost:' + (process.env.E2E_PORT ?? '5348') + '/tools/dev/voices_probe.html' + Q);
try { await p.waitForFunction(() => window.__probe?.done, null, { timeout: 900000, polling: 1000 }); } catch (e) { logs.push('timeout ' + e); }
const r = await p.evaluate(() => window.__probe); r.wallS = (Date.now() - t0) / 1000; r.logs = logs.slice(-40);
writeFileSync(OUTF, JSON.stringify(r, null, 1)); console.log(JSON.stringify({ ...r, crowd: r.crowd && { ...r.crowd, renderMs: undefined }, logs: r.logs.slice(-8) }, null, 1));
await b.close();
