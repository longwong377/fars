// s15/load (D-392): one page load with ?norender, its main thread's CPU profiled (CDP) from navigation to ready, and the boot
// trace's stage lines. Against a dev server (unminified names: NOHMR=1 npx vite --port <p> --strictPort) or a built site.
//   node tools/dev/gpu_slot.mjs prof -- node tools/bake_world/browser_prof.mjs <url-without-query> [out-prefix]
// URLX: extra query (e.g. &seed=1&worldcache=0). Writes <out>.cpuprofile and <out>.json (stage lines, ready seconds, cache stats).
import { chromium } from '@playwright/test';
import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
const [base = 'http://localhost:5190/', out = 'bench-reports/browser_prof'] = process.argv.slice(2), extra = process.env.URLX ?? '';
const prof = mkdtempSync(join(process.env.PROF_TMP ?? tmpdir(), 'parsa-prof-'));
const ctx = await chromium.launchPersistentContext(prof, { channel: process.env.PW_CHANNEL ?? 'chrome', headless: !process.env.HEADED,
  args: ['--enable-unsafe-webgpu', '--ignore-gpu-blocklist'], viewport: { width: 1280, height: 720 } });
const page = ctx.pages()[0] ?? await ctx.newPage();
const t0 = Date.now(), el = () => +((Date.now() - t0) / 1000).toFixed(1), lines = [];
page.on('console', m => { const t = m.text(); if (/^\[boot\]|world-cache|error/i.test(t) && lines.length < 3000) { lines.push(`${el()} ${t.slice(0, 600)}`); if (/world:|ready|world-cache/.test(t)) console.log(el(), t.slice(0, 300)); } });
page.on('pageerror', e => lines.push(`${el()} pageerror ${String(e).slice(0, 300)}`));
const cdp = await ctx.newCDPSession(page);
// HEAP=1: the sampling heap profiler too (what the page still holds at ready, by the function that allocated it)
if (process.env.HEAP) { await cdp.send('HeapProfiler.enable'); await cdp.send('HeapProfiler.startSampling', { samplingInterval: 262144 }); }
await cdp.send('Profiler.enable'); await cdp.send('Profiler.setSamplingInterval', { interval: +(process.env.PROF_US ?? 4000) }); await cdp.send('Profiler.start');
const url = `${base}?quality=high&trace&norender${extra}`;
await page.goto(url);
await page.waitForFunction(() => window.__parsa?.ready === true || window.__parsa?.error, null, { timeout: 3_600_000, polling: 500 });
const readyS = el();
const { profile } = await cdp.send('Profiler.stop');
if (process.env.HEAP) { const { profile: hp } = await cdp.send('HeapProfiler.stopSampling'); writeFileSync(`${out}.heapprofile`, JSON.stringify(hp));
  const by = new Map(); const walk = (n, path) => { const k = `${n.callFrame.functionName || '(anon)'} ${n.callFrame.url.replace(/^.*[/](src|deps)[/]/, "$1/")}:${n.callFrame.lineNumber + 1}`; by.set(k, (by.get(k) ?? 0) + n.selfSize); for (const c of n.children) walk(c); }; walk(hp.head);
  console.log('heap by allocator (MB):'); for (const [k, v] of [...by].sort((a, b) => b[1] - a[1]).slice(0, 40)) console.log((v / 1048576).toFixed(1).padStart(8), k); }
const err = await page.evaluate(() => window.__parsa.error ?? null);
const mem = await page.evaluate(() => (performance).memory ? { usedJSHeapMB: Math.round(performance.memory.usedJSHeapSize / 1048576) } : null);
writeFileSync(`${out}.cpuprofile`, JSON.stringify(profile));
writeFileSync(`${out}.json`, JSON.stringify({ url, readyS, err, mem, lines }, null, 1));
console.log(JSON.stringify({ readyS, err, mem }));
await ctx.close(); process.exit(0);
