// s16 (D-463): a cold built-site boot in headless Chromium (no GPU needed with ?norender), every 404 by URL, the boot trace in
// full, and where the page is waiting when it stalls (no new [boot] mark for --stall seconds: the pending requests and the
// page's own state). Linux or Windows; the bundled Chromium unless PW_CHANNEL names one.
//   node tools/deploy/boot_probe.mjs [dist=dist] [--params norender&seed=467] [--mbps 100] [--stall 180] [--limit 1500] [--swiftshader-webgpu] [--swiftshader-webgpu]
import { chromium } from '@playwright/test';
import { spawn } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
const a = process.argv.slice(2), opt = (k, d) => { const i = a.indexOf(k); return i >= 0 ? a[i + 1] : d; };
const dist = resolve(a[0] && !a[0].startsWith('--') ? a[0] : 'dist'), port = +opt('--port', 4181), mbps = opt('--mbps', '');
const params = opt('--params', 'norender'), stallS = +opt('--stall', 180), limitS = +opt('--limit', 1500);
const here = new URL('.', import.meta.url).pathname.replace(/^\/(\w:)/, '$1');
const srv = spawn(process.execPath, [join(here, 'serve.mjs'), dist, String(port), '/fars/'], { env: { ...process.env, ...(mbps ? { MBPS: mbps } : {}) }, stdio: ['ignore', 'ignore', 'inherit'] });
process.on('exit', () => { try { srv.kill(); } catch {} });
const host = `http://127.0.0.2:${port}`;
for (let i = 0; i < 50; i++) { try { if ((await fetch(`${host}/fars/`)).ok) break; } catch {} await new Promise(r => setTimeout(r, 200)); }
const prof = mkdtempSync(join(tmpdir(), 'parsa-probe-'));
const ctx = await chromium.launchPersistentContext(prof, { ...(process.env.PW_CHANNEL ? { channel: process.env.PW_CHANNEL } : {}), headless: !process.env.HEADED,
  args: ['--enable-unsafe-webgpu', '--ignore-gpu-blocklist', ...(a.includes('--swiftshader-webgpu') ? ['--enable-features=Vulkan', '--use-vulkan=swiftshader', '--use-webgpu-adapter=swiftshader'] : [])], viewport: { width: 1280, height: 720 } });
const page = ctx.pages()[0] ?? await ctx.newPage(), t0 = Date.now(), s = () => ((Date.now() - t0) / 1000).toFixed(1);
let lastMark = Date.now(); const pending = new Map(), missing = [];
page.on('console', m => { const t = m.text(); if (t.startsWith('[boot]')) { lastMark = Date.now(); console.log(s(), t.slice(0, 4000)); } else if (m.type() === 'error' || m.type() === 'warning') { if (!/KTX2Loader: Multiple/.test(t)) console.log(s(), '[page]', m.type(), t.slice(0, 400)); } });
page.on('pageerror', e => console.log(s(), '[pageerror]', String(e).slice(0, 600)));
page.on('request', q => pending.set(q, Date.now()));
page.on('requestfinished', async q => { pending.delete(q); const r = await q.response(); if (r && r.status() >= 400) { missing.push(`${r.status()} ${q.url()}`); console.log(s(), '[404]', r.status(), q.url()); } });
page.on('requestfailed', q => { pending.delete(q); console.log(s(), '[net] failed', q.url().slice(0, 200), q.failure()?.errorText); });
page.on('crash', () => console.log(s(), '[page] CRASHED'));
await page.goto(`${host}/fars/?quality=high&trace&${params}`);
let ok = false;
while ((Date.now() - t0) / 1000 < limitS) {
  const st = await page.evaluate(() => ({ ready: window.__parsa?.ready === true, error: window.__parsa?.error ?? null, backend: window.__parsa?.backend })).catch(e => ({ error: 'evaluate: ' + e.message }));
  if (st.ready || st.error) { console.log(s(), st.ready ? 'READY' : 'ERROR', st.backend, st.error ?? ''); ok = !!st.ready; break; }
  if (Date.now() - lastMark > stallS * 1000) {
    console.log(s(), `STALL: no [boot] mark for ${stallS} s; pending requests:`);
    for (const [q, t] of pending) console.log('   ', ((Date.now() - t) / 1000).toFixed(0), 's', q.url().slice(0, 200));
    lastMark = Date.now();
  }
  await new Promise(r => setTimeout(r, 1000));
}
console.log('missing', JSON.stringify(missing));
const cs = await page.evaluate(() => window.__parsa?.cacheStats ?? null).catch(() => null); if (cs) console.log('cacheStats', JSON.stringify(cs).slice(0, 3000));
await ctx.close(); rmSync(prof, { recursive: true, force: true }); process.exit(ok ? 0 : 1);
