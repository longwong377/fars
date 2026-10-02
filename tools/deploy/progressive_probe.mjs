// s15/ship (D-374): run tools/deploy/progressive_probe.html in sync and progressive mode on the real GPU, each in a fresh
// profile (no shader cache), and print the results. Serve the tree first (npx vite --port <port>).
//   node tools/dev/gpu_slot.mjs ship -- node tools/deploy/progressive_probe.mjs <port> [modes=sync,progressive]
import { chromium } from '@playwright/test';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
const [port = '5197', modes = 'sync,progressive'] = process.argv.slice(2);
for (const mode of modes.split(',')) {
  const ctx = await chromium.launchPersistentContext(mkdtempSync(join(tmpdir(), 'parsa-pp-')), { channel: 'chrome', headless: true, args: ['--enable-unsafe-webgpu', '--ignore-gpu-blocklist'], viewport: { width: 1280, height: 720 } });
  const p = ctx.pages()[0] ?? await ctx.newPage(); const logs = [];
  p.on('console', m => { if (m.type() === 'error') logs.push(m.text().slice(0, 200)); });
  const t0 = Date.now();
  await p.goto(`http://localhost:${port}/tools/deploy/progressive_probe.html?mode=${mode}`);
  await p.waitForFunction(() => window.__result, null, { timeout: 1_200_000, polling: 500 });
  const r = await p.evaluate(() => window.__result);
  await p.screenshot({ path: join(tmpdir(), `pp-${mode}.png`) }).catch(() => {});
  console.log(JSON.stringify({ ...r, pageS: (Date.now() - t0) / 1000, logs: logs.slice(0, 5) }));
  await ctx.close();
}
process.exit(0);
