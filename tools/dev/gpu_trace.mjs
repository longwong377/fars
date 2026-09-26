// dev (D-250): record a Chrome trace (gpu, Dawn and SwiftShader categories) of a page load and its first frames, then total
// the GPU process's slices by name (self time of the top-level slices per thread): where the load's GPU-process time goes.
// Usage: node tools/dev/gpu_trace.mjs <port> [quality=test] ['&extra']  (serve with NOHMR=1 vite)
import { chromium } from '@playwright/test';
import { readFileSync, writeFileSync } from 'node:fs';
const [port, q = 'test', extra = ''] = process.argv.slice(2);
const args = ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--enable-unsafe-webgpu', '--enable-features=Vulkan', '--use-vulkan=swiftshader', '--use-webgpu-adapter=swiftshader'];
const b = await chromium.launch({ headless: true, args });
const page = await b.newPage({ viewport: { width: 960, height: 540 } });
const out = process.env.OUT ?? '/tmp/gpu_trace.json';
await b.startTracing(page, { path: out, categories: ['gpu', 'gpu.dawn', 'disabled-by-default-gpu.dawn', 'gpu.service', 'disabled-by-default-gpu.service', 'toplevel', 'viz', 'gpu.capture'] });
const t0 = Date.now();
await page.goto(`http://localhost:${port}/?test&quality=${q}&day=25&hour=11&weather=clear${extra}`);
await page.waitForFunction(() => window.__parsa?.ready === true || window.__parsa?.error, null, { timeout: 2_400_000, polling: 2000 });
console.log('ready', (Date.now() - t0) / 1000);
await page.evaluate(() => window.__parsa.renderer.setAnimationLoop(null));
for (let i = 0; i < +(process.env.FRAMES ?? 2); i++) { const t = Date.now(); await page.evaluate(() => window.__parsa.renderOnce()); console.log('renderOnce', i + 1, (Date.now() - t) / 1000); }
await b.stopTracing(); await b.close();
const T = JSON.parse(readFileSync(out, 'utf8')); const ev = T.traceEvents ?? T;
const names = new Map(); for (const e of ev) if (e.ph === 'M' && e.name === 'process_name') names.set(e.pid, e.args.name);
const gpu = [...names].filter(([, n]) => /GPU/i.test(n)).map(([p]) => p);
console.log('gpu process pids', gpu, 'events', ev.length);
// complete events (X) and begin/end pairs (B/E) on the GPU process, per thread: inclusive totals by name, and the top level
const tot = new Map(), top = new Map(); const stacks = new Map();
const add = (m, k, d) => m.set(k, (m.get(k) ?? 0) + d);
for (const e of ev.filter(e => gpu.includes(e.pid)).sort((a, b) => a.ts - b.ts)) {
  const key = `${e.tid}`; if (!stacks.has(key)) stacks.set(key, []); const st = stacks.get(key);
  if (e.ph === 'X') { add(tot, e.name, e.dur / 1e6); while (st.length && st[st.length - 1] <= e.ts) st.pop(); if (!st.length) add(top, e.name, e.dur / 1e6); st.push(e.ts + e.dur); }
  else if (e.ph === 'B') { st.push({ name: e.name, ts: e.ts }); } else if (e.ph === 'E') { const s = st.pop(); if (s?.name) { add(tot, s.name, (e.ts - s.ts) / 1e6); } }
}
const show = (m, n) => [...m].sort((a, b) => b[1] - a[1]).slice(0, n).map(([k, v]) => `${v.toFixed(1).padStart(8)} s  ${k}`).join('\n');
console.log('--- top-level slices (GPU process)\n' + show(top, 25) + '\n--- inclusive by name\n' + show(tot, 40));
