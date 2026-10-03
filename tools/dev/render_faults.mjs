// s18 C9 (D-740): does the built site keep drawing after ready (the T4's black screen)? Cold load with rendering on, the
// player's loop for ~40 s (the low-first upgrades run 2 s after ready), then the draw calls, page errors, GPU validation
// errors and the safety net's skips (window.__renderFaults). Headless Chromium, SwiftShader WebGPU.
//   node tools/dev/render_faults.mjs <dist> [--params 'seed=1']
import { chromium } from '@playwright/test';
import { spawn } from 'node:child_process';
import { join, resolve } from 'node:path';
const a = process.argv.slice(2), opt = (k, d) => { const i = a.indexOf(k); return i >= 0 ? a[i + 1] : d; };
const dist = resolve(a[0] ?? 'dist'), extra = opt('--params', 'seed=1'), port = 4185;
const srv = spawn(process.execPath, [join(new URL('.', import.meta.url).pathname, '../deploy/serve.mjs'), dist, String(port), '/fars/'], { stdio: 'ignore' });
process.on('exit', () => { try { srv.kill(); } catch {} }); await new Promise(r => setTimeout(r, 1500));
const b = await chromium.launch({ headless: true, args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--enable-unsafe-webgpu', '--enable-features=Vulkan', '--use-vulkan=swiftshader', '--use-webgpu-adapter=swiftshader'] });
const p = await b.newPage({ viewport: { width: 1280, height: 720 } }), errs = [], warns = [], t0 = Date.now(), s = () => ((Date.now() - t0) / 1000).toFixed(0);
p.on('pageerror', e => errs.push(`${s()}s ${String(e).slice(0, 200)}`));
p.on('console', m => { const t = m.text(); if (m.type() === 'error' && !/sampled textures|Invalid (Pipeline|BindGroup)Layout|Async render pipeline/.test(t)) errs.push(`${s()}s ${t.slice(0, 200)}`); if (/\[render\] skipped|\[release\]|\[lowfirst\]/.test(t)) warns.push(t.slice(0, 200)); });
await p.goto(`http://127.0.0.2:${port}/fars/?quality=high&${extra}`);
await p.waitForFunction(() => window.__parsa?.ready === true || window.__parsa?.error, null, { timeout: 1_800_000, polling: 1000 });
console.log('ready', s());
const rows = [];
for (let i = 0; i < 8; i++) { await p.waitForTimeout(5000); rows.push(await p.evaluate(() => { const st = window.__parsa.stats(); return { draws: st.drawCalls, lowFirst: window.__parsa.lowFirst?.(), faults: Object.keys(window.__renderFaults ?? {}).length }; })); console.log(s(), JSON.stringify(rows[rows.length - 1])); }
console.log('faults', JSON.stringify(await p.evaluate(() => window.__renderFaults ?? null), null, 1));
console.log('page errors', errs.length, JSON.stringify(errs.slice(0, 10), null, 1)); console.log('warnings', JSON.stringify(warns.slice(0, 12), null, 1));
await b.close(); srv.kill(); process.exit(0);
