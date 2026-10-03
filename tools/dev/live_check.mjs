// s18 (the cloud's item 1): the LIVE path on the built site (no ?test): title, Enter, walk 60 s at cov-252; the frame,
// __parsa.exposureInfo() (frameFaults, meterLost), window.__renderFaults, and the ?shaderlog validation errors.
//   node tools/dev/gpu_slot.mjs live -- node tools/dev/live_check.mjs <dist> <out.png> [port]
import { chromium } from '@playwright/test';
import { spawn } from 'node:child_process';
import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
const dist = resolve(process.argv[2]), out = process.argv[3], port = +(process.argv[4] ?? 4231);
const here = new URL('.', import.meta.url).pathname.replace(/^\/(\w:)/, '$1');
const srv = spawn(process.execPath, [join(here, '../deploy/serve.mjs'), dist, String(port), '/fars/'], { stdio: 'ignore' }); process.on('exit', () => srv.kill());
const host = `http://127.0.0.2:${port}`; for (let i = 0; i < 50; i++) { try { if ((await fetch(`${host}/fars/`)).ok) break; } catch {} await new Promise(r => setTimeout(r, 200)); }
const ctx = await chromium.launchPersistentContext(mkdtempSync(join(tmpdir(), 'parsa-live-')), { channel: 'chrome', headless: true, args: ['--enable-unsafe-webgpu', '--ignore-gpu-blocklist'], viewport: { width: 1920, height: 1080 } });
const page = ctx.pages()[0], msgs = [];
page.on('console', m => { if (/error|warn/.test(m.type())) msgs.push(`[${m.type()}] ${m.text().slice(0, 400)}`); }); page.on('pageerror', e => msgs.push('[pageerror] ' + String(e).slice(0, 400)));
const t0 = Date.now(), log = (...x) => console.log(((Date.now() - t0) / 1000).toFixed(0) + 's', ...x);
await page.goto(`${host}/fars/?quality=high&seed=1&day=168&hour=12.586&shaderlog`);
await page.waitForFunction(() => window.__parsa?.ready === true || window.__parsa?.error, null, { timeout: 1_800_000 });
const st = () => page.evaluate(() => { const p = window.__parsa, s = p.stats(); return { draws: s.drawCalls, tris: s.triangles }; });
log('ready', JSON.stringify(await st()));
await page.waitForTimeout(10000); writeFileSync(out.replace(/\.png$/, '-title.png'), await page.screenshot());
log('enter', await page.evaluate(() => { const b = [...document.querySelectorAll('button')].find(x => /^(Enter|Continue the visit)$/.test(x.textContent)); b?.click(); return !!b; }));
for (let i = 0; i < 4; i++) { await page.waitForTimeout(1500); await page.keyboard.press('Space'); }
await page.evaluate(() => { const p = window.__parsa; p.teleport(84.8, 9.85); p.setInput({ yawDeg: 69.6, pitchDeg: 1.9 }); });
await page.waitForTimeout(3000);
await page.evaluate(() => window.__parsa.setInput({ forward: 0.6 }));
for (let s = 0; s < 60; s += 20) { await page.waitForTimeout(20000); log(`walk ${s + 20} s`, JSON.stringify(await st())); }
await page.evaluate(() => window.__parsa.setInput({ forward: 0 })); await page.waitForTimeout(1500);
writeFileSync(out, await page.screenshot());
const r = await page.evaluate(() => { const p = window.__parsa, e = p.exposureInfo();
  return { exposureInfo: e, frameFaults: e?.frameFaults ?? '(no field)', meterLost: e?.meterLost ?? '(no field)', renderFaults: window.__renderFaults ?? '(undefined)', stats: p.stats().drawCalls, clock: p.clockLabel() }; });
console.log('RESULT', JSON.stringify(r).slice(0, 3000));
const val = [...new Set(msgs.filter(m => /validation|invalid|pipeline creation failed|destroyed|writeBuffer|writeTexture|frameFault/i.test(m)))];
console.log('VALIDATION', val.length); for (const m of val.slice(0, 20)) console.log('  ' + m);
await ctx.close(); process.exit(0);
