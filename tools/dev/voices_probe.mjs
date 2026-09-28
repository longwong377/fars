// D-336: drive tools/dev/voices_probe.html on the real GPU. Serve the tree (npx vite --port $E2E_PORT), then
//   node tools/dev/gpu_slot.mjs voices -- node tools/dev/voices_probe.mjs "?device=webgpu&dtype=fp32" out.json
import { chromium } from 'playwright';
import { writeFileSync } from 'node:fs';
const Q = process.env.PROBE_Q ?? process.argv[2] ?? '', OUTF = process.argv[3] ?? 'T:/fars-assets-s12/voices/probe.json';
const b = await chromium.launch({ channel: 'chrome', headless: true, args: ['--enable-unsafe-webgpu', '--ignore-gpu-blocklist', '--autoplay-policy=no-user-gesture-required'] });
const p = await b.newPage(); const logs = [];
p.on('console', m => logs.push(m.type() + ' ' + m.text().slice(0, 300))); p.on('pageerror', e => logs.push('pageerror ' + e)); p.on('response', r => { if (r.status() >= 400) logs.push('HTTP ' + r.status() + ' ' + r.url()); });
p.on('worker', w => { logs.push('worker ' + w.url()); w.on('console', m => logs.push('W ' + m.type() + ' ' + m.text().slice(0, 300))); });
const t0 = Date.now();
await p.goto('http://localhost:' + (process.env.E2E_PORT ?? '5348') + '/tools/dev/' + (process.env.PROBE_PAGE ?? 'voices_probe') + '.html' + Q);
const LIMIT = +(process.env.PROBE_S ?? 900) * 1000;
while (Date.now() - t0 < LIMIT) { const st = await p.evaluate(() => ({ done: !!window.__probe?.done, keys: Object.keys(window.__probe ?? {}), stats: window.__probe?.stats0 ?? null })).catch(e => ({ err: String(e) }));
  console.log(((Date.now() - t0) / 1000).toFixed(0), 's', JSON.stringify(st), logs.slice(-3).join(' | ').slice(0, 400)); if (st.done) break; await new Promise(r => setTimeout(r, 15000)); }
const r = await p.evaluate(() => window.__probe); r.wallS = (Date.now() - t0) / 1000; r.logs = logs.slice(-40);
writeFileSync(OUTF, JSON.stringify(r, null, 1));
console.log(JSON.stringify(r, (k, v) => (k === 'clips' || k === 'renderMs' || k === 'rows' ? `[${v?.length}]` : typeof v === 'number' ? Math.round(v * 100) / 100 : v), 1).slice(0, 6000));
await b.close();
