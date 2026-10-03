// s18 C9 (D-740/D-810): the player's live path on a built site in the cloud: no ?test; title (20 s) -> Enter (DOM click,
// the opening skipped) -> 30 s -> walk forward 60 s; at each step the draw calls, the screenshot's mean brightness (sRGB,
// 0-255), __parsa.exposureInfo() (frameFaults, meterLost), window.__renderFaults, page errors. Headless Chromium on
// SwiftShader WebGPU, or ?webgl=1 (--webgl).   node tools/dev/live_path.mjs <dist> <outdir> [--webgl] [--params '&x=y']
import { chromium } from '@playwright/test';
import { spawn } from 'node:child_process';
import { writeFileSync, mkdirSync } from 'node:fs';
import { join, resolve } from 'node:path';
import sharp from 'sharp';
const a = process.argv.slice(2), opt = (k, d) => { const i = a.indexOf(k); return i >= 0 ? a[i + 1] : d; };
const dist = resolve(a[0] ?? 'dist'), out = resolve(a[1] ?? 'live'), webgl = a.includes('--webgl'), extra = opt('--params', ''), q = opt('--q', 'high'), port = +opt('--port', 4186); mkdirSync(out, { recursive: true });
const srv = spawn(process.execPath, [join(new URL('.', import.meta.url).pathname, '../deploy/serve.mjs'), dist, String(port), '/fars/'], { stdio: 'ignore' });
process.on('exit', () => { try { srv.kill(); } catch {} }); await new Promise(r => setTimeout(r, 1500));
const b = await chromium.launch({ headless: true, args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--enable-unsafe-webgpu', '--enable-features=Vulkan', '--use-vulkan=swiftshader', '--use-webgpu-adapter=swiftshader'] });
const p = await b.newPage({ viewport: { width: 1280, height: 720 } }), errs = [], t0 = Date.now(), s = () => +((Date.now() - t0) / 1000).toFixed(0);
p.on('pageerror', e => errs.push(`${s()}s PAGEERROR ${String(e.stack ?? e).slice(0, 400)}`));
p.on('console', m => { if (m.type() === 'error') errs.push(`${s()}s ${m.text().slice(0, 300)}`); });
await p.goto(`http://127.0.0.2:${port}/fars/?quality=${q}&seed=1${webgl ? '&webgl=1' : ''}${extra}`);
await p.waitForFunction(() => window.__parsa?.ready === true || window.__parsa?.error, null, { timeout: 2_400_000, polling: 1000 });
const R = { dist, webgl, backend: await p.evaluate(() => window.__parsa.backend), readyS: s(), error: await p.evaluate(() => window.__parsa.error ?? null), steps: [] };
const step = async (label) => { const png = await p.screenshot({ timeout: 120000 }).catch(e => null); if (png) writeFileSync(join(out, `${label}.png`), png);
  let sum = 0, data = [0]; if (png) { data = (await sharp(png).removeAlpha().raw().toBuffer({ resolveWithObject: true })).data; for (let i = 0; i < data.length; i++) sum += data[i]; }
  const st = await p.evaluate(() => { const s = window.__parsa.stats(); return { draws: s.drawCalls, tris: +(s.triangles / 1e6).toFixed(2), exposure: window.__parsa.exposureInfo?.() ?? null, faults: window.__renderFaults ?? null, live: window.__liveDisposals ?? null, deferred: window.__deferredDisposals ?? null }; });
  const row = { label, atS: s(), mean: png ? +(sum / data.length).toFixed(1) : 'no screenshot', destroyedErrors: errs.filter(e => /destroyed/.test(e)).length, ...st }; R.steps.push(row); console.log(JSON.stringify(row).slice(0, 900)); };
await step('ready'); await p.waitForTimeout(20000); await step('title+20s');
await p.evaluate(() => [...document.querySelectorAll('button')].find(b => /^(Enter|Continue the visit)$/.test(b.textContent))?.click());
for (let i = 0; i < 4; i++) { await p.waitForTimeout(1500); await p.keyboard.press('Escape'); await p.keyboard.press('Space'); }
await p.waitForTimeout(30000); await step('entered+30s');
await p.evaluate(() => window.__parsa.setInput({ forward: 1 }));
for (let i = 1; i <= 3; i++) { await p.waitForTimeout(20000); await step(`walk+${i * 20}s`); }
await p.evaluate(() => window.__parsa.setInput({ forward: 0 }));
R.errors = [...new Set(errs)].slice(0, 30); writeFileSync(join(out, 'live.json'), JSON.stringify(R, null, 1));
console.log('backend', R.backend, 'ready', R.readyS, 's; errors', errs.length); for (const e of R.errors.slice(0, 12)) console.log(' ', e.slice(0, 300));
await b.close(); srv.kill(); process.exit(0);
