// dev (D-250): load the page with ?shaderlog, render a few frames, and list the pipelines by fragment WGSL size with the
// object and material they came from (the load's cost is SwiftShader compiling these). Usage: node tools/dev/shader_log.mjs <port> [q]
import { chromium } from '@playwright/test';
import { writeFileSync } from 'node:fs';
const [port, q = 'test', extra = ''] = process.argv.slice(2);
const args = ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--enable-unsafe-webgpu', '--enable-features=Vulkan', '--use-vulkan=swiftshader', '--use-webgpu-adapter=swiftshader'];
const b = await chromium.launch({ headless: true, args });
const page = await b.newPage({ viewport: { width: 960, height: 540 } });
await page.goto(`http://localhost:${port}/?test&shaderlog=${encodeURIComponent(process.env.PAT ?? '')}&quality=${q}&day=25&hour=11&weather=clear${extra}`);
await page.waitForFunction(() => window.__parsa?.ready === true || window.__parsa?.error, null, { timeout: 2_400_000, polling: 2000 });
await page.evaluate(() => window.__parsa.renderer.setAnimationLoop(null));
for (let i = 0; i < +(process.env.FRAMES ?? 2); i++) await page.evaluate(() => window.__parsa.renderOnce());
const log = await page.evaluate(() => window.__shaderLog);
writeFileSync(process.env.OUT ?? 'shader_log.json', JSON.stringify(log, null, 0));
const tot = log.reduce((a, x) => a + x.frag + x.vert, 0);
console.log(`${log.length} pipelines, ${(tot / 1e6).toFixed(2)} MB WGSL`);
const byMat = new Map(); for (const x of log) { const k = `${x.mat} | ${x.obj}`; const e = byMat.get(k) ?? { n: 0, kb: 0, max: 0 }; e.n++; e.kb += (x.frag + x.vert) / 1000; e.max = Math.max(e.max, x.frag); byMat.set(k, e); }
for (const [k, e] of [...byMat].sort((a, b) => b[1].kb - a[1].kb).slice(0, 40)) console.log(e.kb.toFixed(0).padStart(6), 'KB', String(e.n).padStart(3), 'pipes, max frag', String(e.max).padStart(7), ' ', k.slice(0, 110));
await b.close();
