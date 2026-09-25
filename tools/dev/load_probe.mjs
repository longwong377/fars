// dev: time a page load to __parsa.ready (and one frame) with a PERSISTENT Chromium profile, to see whether the GPU
// pipeline/shader cache survives between runs. Usage: node tools/dev/load_probe.mjs <port> <profileDir> [quality=high]
import { chromium } from '@playwright/test';
const [port, prof, q = 'high'] = process.argv.slice(2);
const args = ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--enable-unsafe-webgpu', '--enable-features=Vulkan', '--use-vulkan=swiftshader', '--use-webgpu-adapter=swiftshader'];
const ctx = await chromium.launchPersistentContext(prof, { headless: true, args, viewport: { width: 960, height: 540 } });
const page = ctx.pages()[0] ?? await ctx.newPage();
const t0 = Date.now();
await page.goto(`http://localhost:${port}/?test&quality=${q}&day=25&hour=11&weather=clear`);
await page.waitForFunction(() => window.__parsa?.ready === true || window.__parsa?.error, null, { timeout: 1_800_000 });
const tReady = (Date.now() - t0) / 1000;
await page.evaluate(() => window.__parsa.renderer.setAnimationLoop(null));
await page.evaluate(() => window.__parsa.view(1.9, 75, 1.6, 161, 2, 46));
const t1 = Date.now(); await page.evaluate(() => window.__parsa.renderOnce()); const tF1 = (Date.now() - t1) / 1000;
const t2 = Date.now(); await page.evaluate(() => window.__parsa.renderOnce()); const tF2 = (Date.now() - t2) / 1000;
console.log(JSON.stringify({ prof, q, readyS: tReady, firstFrameS: tF1, secondFrameS: tF2 }));
await ctx.close();
