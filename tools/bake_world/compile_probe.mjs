// s14/load (D-354): how long the GPU's pipeline compiles take, and whether they can be cached across page loads. Loads a page
// (default: the Terrace probe, tools/dev/terrace_probe.html: the game's own surface materials in seconds) in Chrome on the
// real GPU with a given profile directory and extra flags, wraps the WebGPU device so every shader module and render
// pipeline is timed and its WGSL hashed, and renders one view. Run it twice on one profile to see what the browser's shader
// cache keeps; compare the hash lists of two runs to see whether the WGSL is the same from load to load (the cache's key).
//   node tools/dev/gpu_slot.mjs load -- node tools/bake_world/compile_probe.mjs <port> <profileDir> <label> [page=terrace]
//   FLAGS="--enable-dawn-features=…" adds Chrome flags; WORLD=1 loads the full world (?test&quality=high) instead.
import { chromium } from '@playwright/test';
import { writeFileSync, mkdirSync } from 'node:fs';
const [port = '5182', prof, label = 'run'] = process.argv.slice(2);
const args = ['--enable-unsafe-webgpu', '--ignore-gpu-blocklist', ...(process.env.FLAGS ? process.env.FLAGS.split(' ') : [])];
const ctx = await chromium.launchPersistentContext(prof, { channel: 'chrome', headless: true, args, viewport: { width: 1920, height: 1080 } });
await ctx.addInitScript(() => {
  const S = (window).__gpuStats = { modules: 0, moduleMs: 0, pipes: 0, pipeMs: 0, asyncPipes: 0, asyncMs: 0, hashes: [], slow: [] };
  const h = (s) => { let a = 0x811c9dc5 | 0, b = 0x9e3779b9 | 0; for (let i = 0; i < s.length; i++) { const c = s.charCodeAt(i); a = Math.imul(a ^ c, 16777619); b = Math.imul(b ^ c, 2246822519); } return (a >>> 0).toString(16).padStart(8, '0') + (b >>> 0).toString(16).padStart(8, '0'); };
  const D = GPUDevice.prototype, cm = D.createShaderModule, cp = D.createRenderPipeline, cpa = D.createRenderPipelineAsync, cc = D.createComputePipeline;
  D.createShaderModule = function (d) { const t = performance.now(); const r = cm.call(this, d); S.moduleMs += performance.now() - t; S.modules++; S.hashes.push(h(d.code) + ':' + d.code.length); return r; };
  D.createRenderPipeline = function (d) { const t = performance.now(); const r = cp.call(this, d); const ms = performance.now() - t; S.pipeMs += ms; S.pipes++; if (ms > 500) S.slow.push(Math.round(ms)); return r; };
  D.createComputePipeline = function (d) { const t = performance.now(); const r = cc.call(this, d); const ms = performance.now() - t; S.pipeMs += ms; S.pipes++; return r; };
  D.createRenderPipelineAsync = function (d) { const t = performance.now(); S.asyncPipes++; return cpa.call(this, d).then(r => { S.asyncMs += performance.now() - t; return r; }); };
});
const page = ctx.pages()[0] ?? await ctx.newPage();
const logs = []; page.on('console', m => { if (m.type() === 'error' || /\[boot\]/.test(m.text())) logs.push(m.text().slice(0, 200)); });
const t0 = Date.now(), el = () => +((Date.now() - t0) / 1000).toFixed(1);
const res = { label, flags: process.env.FLAGS ?? '' };
if (process.env.WORLD) {
  await page.goto(`http://localhost:${port}/?test&trace&quality=${process.env.Q ?? 'high'}&day=0&hour=5.4&weather=clear${process.env.URLX ?? ''}`);
  await page.waitForFunction(() => window.__parsa?.ready === true || window.__parsa?.error, null, { timeout: 3_600_000, polling: 1000 });
  res.readyS = el();
  await page.evaluate(() => { window.__parsa.renderer.setAnimationLoop(null); window.__parsa.view(-36.4, 140.5, 1.6, 196, -8); });
  if (!process.env.NOWARM) res.warmUp = await page.evaluate(() => window.__parsa.warmUp());
  res.frames = []; for (let i = 0; i < 2; i++) { const t = Date.now(); await page.evaluate(() => window.__parsa.renderOnce()); res.frames.push((Date.now() - t) / 1000); }
} else {
  await page.goto(`http://localhost:${port}/tools/dev/terrace_probe.html`);
  await page.waitForFunction(() => window.__ready, null, { timeout: 900_000 });
  res.readyS = el(); res.ready = await page.evaluate(() => window.__ready);
  if (res.ready !== true) { console.log(JSON.stringify(res), logs.slice(0, 20)); await ctx.close(); process.exit(1); }
  const v = { e: -43.9, n: 128, eye: 1.6, az: 341, pitch: 12, fov: 60, sunAz: 271, sunAlt: 32 };
  res.shots = []; for (let i = 0; i < 2; i++) { const t = Date.now(); await page.evaluate(v => window.__shot(v), v); res.shots.push((Date.now() - t) / 1000); }
  // the device's queue drained: the async compiles are done
  await page.evaluate(async () => { const r = window.__r; if (r?.backend?.device) await r.backend.device.queue.onSubmittedWorkDone(); });
}
res.firstFrameS = el();
const st = await page.evaluate(() => window.__gpuStats);
Object.assign(res, { modules: st.modules, moduleMs: Math.round(st.moduleMs), pipes: st.pipes, pipeMs: Math.round(st.pipeMs), asyncPipes: st.asyncPipes, asyncMs: Math.round(st.asyncMs), slow: st.slow.slice(0, 40), logs: logs.slice(0, 80) });
mkdirSync('../load-out', { recursive: true }); writeFileSync(`../load-out/compile_${label}.json`, JSON.stringify({ ...res, hashes: st.hashes }, null, 1));
console.log(JSON.stringify(res));
await ctx.close();
