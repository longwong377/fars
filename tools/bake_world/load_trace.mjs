// s14/load (D-354): one cold page load on the real GPU, traced: the boot and world-build stages (?trace), ready, the warm-up
// (D-353, per group), and the first frames, written as one JSON trace. Run through the GPU slot against a NOHMR vite:
//   NOHMR=1 npx vite --port <p> --strictPort   (in this tree), then
//   node tools/dev/gpu_slot.mjs load -- node tools/bake_world/load_trace.mjs <port> [quality=high] [out.json] (URLX=&norender for build-only)
// A fresh, throw-away browser profile every run (a cold load: no Chrome shader or HTTP cache from an earlier run) unless
// PROFILE=<dir> is set (a warm second load against the same profile).
import { chromium } from '@playwright/test';
import { mkdtempSync, writeFileSync, mkdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
const [port = '5182', q = 'high', out = 'bench-reports/load_trace.json'] = process.argv.slice(2), extra = process.env.URLX ?? ''; // URLX: extra query (e.g. &norender, &warm=async), an env var so no shell splits it
const prof = process.env.PROFILE ?? mkdtempSync(join(tmpdir(), 'parsa-load-'));
const args = ['--enable-unsafe-webgpu', '--ignore-gpu-blocklist', '--enable-gpu-rasterization'];
const ctx = await chromium.launchPersistentContext(prof, { channel: process.env.PW_CHANNEL ?? 'chrome', headless: !process.env.HEADED, args, viewport: { width: 1920, height: 1080 } });
const page = ctx.pages()[0] ?? await ctx.newPage();
const t0 = Date.now(), lines = [], el = () => +((Date.now() - t0) / 1000).toFixed(1);
page.on('console', m => { const t = m.text(); if (/^\[boot\]|\[load\]|error|Error|warn/i.test(t) && lines.length < 4000) lines.push(`${el()} ${m.type()} ${t.slice(0, 300)}`); });
page.on('pageerror', e => lines.push(`${el()} pageerror ${String(e).slice(0, 300)}`));
const url = `http://localhost:${port}/?test&trace&quality=${q}&day=0&hour=5.4&weather=clear${extra}`;
await page.goto(url);
await page.waitForFunction(() => window.__parsa?.ready === true || window.__parsa?.error, null, { timeout: 3_600_000, polling: 500 });
const readyS = el();
const err = await page.evaluate(() => window.__parsa.error ?? null);
const res = { url, q, prof: process.env.PROFILE ? prof : 'fresh', readyS, err };
if (!err) {
  res.adapter = await page.evaluate(async () => { try { const a = await navigator.gpu?.requestAdapter(); const i = a?.info ?? (await a?.requestAdapterInfo?.()); return i ? { vendor: i.vendor, arch: i.architecture, desc: i.description } : null; } catch { return null; } });
  await page.evaluate(() => window.__parsa.renderer.setAnimationLoop(null));
  await page.evaluate(() => window.__parsa.view(-36.4, 140.5, 1.6, 196, -8)); // dawn-stair-top's eye
  const tw = Date.now();
  if (!process.env.NOWARM) res.warmUp = await page.evaluate(() => window.__parsa.warmUp());
  res.warmUpS = +((Date.now() - tw) / 1000).toFixed(1);
  res.frames = [];
  for (let i = 0; i < 3; i++) { const t = Date.now(); await page.evaluate(() => window.__parsa.renderOnce()); res.frames.push(+((Date.now() - t) / 1000).toFixed(2)); }
  res.firstFrameS = el();
  if (process.env.SHOT) await page.screenshot({ path: process.env.SHOT });
}
res.lines = lines;
mkdirSync(dirname(out), { recursive: true }); writeFileSync(out, JSON.stringify(res, null, 1));
console.log(JSON.stringify({ readyS: res.readyS, warmUpS: res.warmUpS, frames: res.frames, firstFrameS: res.firstFrameS, err }));
await ctx.close();
