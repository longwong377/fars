// dev (D-250): after load, list the render pipelines' shader programs by WGSL size, and the GPU process's CPU seconds per phase
// (the load's cost is SwiftShader compiling pipelines, measured on the GPU process, not the page's JS thread).
// Usage: node tools/dev/shader_sizes.mjs <port> [quality=test] ['&extra']  (serve with NOHMR=1 vite)
import { chromium } from '@playwright/test';
import { readFileSync, readdirSync } from 'node:fs';
const [port, q = 'test', extra = ''] = process.argv.slice(2);
const args = ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--enable-unsafe-webgpu', '--enable-features=Vulkan', '--use-vulkan=swiftshader', '--use-webgpu-adapter=swiftshader'];
const gpuPids = () => readdirSync('/proc').filter(x => /^\d+$/.test(x)).filter(p => { try { return readFileSync(`/proc/${p}/cmdline`, 'utf8').includes('--type=gpu-process'); } catch { return false; } });
const before = new Set(gpuPids()); // other Chromiums (a render job) are not ours
const b = await chromium.launch({ headless: true, args });
let mine = null; const gpuPid = () => mine ??= gpuPids().find(p => !before.has(p)) ?? null;
const cpu = () => { const p = gpuPid(); if (!p) return 0; const f = readFileSync(`/proc/${p}/stat`, 'utf8').split(') ')[1].split(' '); return (+f[11] + +f[12]) / 100; };
const page = await b.newPage({ viewport: { width: 960, height: 540 } });
const t0 = Date.now(); let c0 = 0;
await page.goto('about:blank'); c0 = cpu(); const cStart0 = c0; console.log('gpu-process pid', gpuPid());
const lap = (l) => { const c = cpu(); console.log(l, 'wall', ((Date.now() - t0) / 1000).toFixed(0), 's; gpu-process cpu', (c - c0).toFixed(1), 's'); c0 = c; };
await page.goto(`http://localhost:${port}/?test&quality=${q}&day=25&hour=11&weather=clear${extra}`);
await page.waitForFunction(() => window.__parsa?.ready === true || window.__parsa?.error, null, { timeout: 1_800_000, polling: 1000 });
lap('ready');
await page.evaluate(() => window.__parsa.renderer.setAnimationLoop(null));
// render until the pipeline set stops growing (content streams in at times that depend on the box's load, so a fixed frame
// count compares different sets): at least 5 frames, then 3 in a row with no new pipeline
const npipe = () => page.evaluate(() => window.__parsa.renderer._pipelines.caches.size);
let last = await npipe(), still = 0, cTot = cpu() - c0 + 0; const cStart = c0;
for (let i = 1; still < 3 || i <= 5; i++) { await page.evaluate(() => window.__parsa.renderOnce()); const n = await npipe(); lap(`renderOnce ${i} (${n} pipelines)`); still = n === last ? still + 1 : 0; last = n; if (i > 40) break; }
console.log('SETTLED', JSON.stringify({ pipelines: last, gpuCpuS: +(cpu() - cStart0).toFixed(1), wallS: (Date.now() - t0) / 1000 }));
const progs = await page.evaluate(() => { const P = window.__parsa.renderer._pipelines.programs; const out = [];
  for (const st of ['vertex', 'fragment']) for (const [k, v] of P[st]) out.push({ st, n: v.name ?? '', len: (v.code ?? '').length, key: String(k).slice(0, 40) }); return out; });
progs.sort((a, b) => b.len - a.len);
const tot = progs.reduce((a, p) => a + p.len, 0);
console.log(`${progs.length} programs, ${(tot / 1e6).toFixed(2)} MB WGSL; top 25:`);
for (const p of progs.slice(0, 25)) console.log(p.st.padEnd(9), String(p.len).padStart(7), p.n);
const hist = [0, 5e3, 2e4, 5e4, 1e5, 2e5, 1e9]; for (let i = 0; i < hist.length - 1; i++) console.log(`  ${hist[i]}-${hist[i + 1]}: ${progs.filter(p => p.len >= hist[i] && p.len < hist[i + 1]).length}`);
await b.close();
