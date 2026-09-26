import { chromium } from '@playwright/test';
// dev (D-250): time a page load stage by stage (?trace: world build stages, the first frames' sim/update/render) and count
// the render pipelines and shader programs. Usage: node tools/dev/trace_load.mjs <port> [quality=test] ['&extra=params']
// Serve with NOHMR=1 npx vite --port <port> so no edit reloads the page mid-measurement.
const [port, q = 'test', extra=''] = process.argv.slice(2);
const args = ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--enable-unsafe-webgpu', '--enable-features=Vulkan', '--use-vulkan=swiftshader', '--use-webgpu-adapter=swiftshader'];
const b = await chromium.launch({ headless: true, args });
const page = await b.newPage({ viewport: { width: 960, height: 540 } });
const t0 = Date.now();
page.on('console', m => { const t = m.text(); if (t.startsWith('[boot]') || /error/i.test(m.type())) console.log(((Date.now()-t0)/1000).toFixed(1), t.slice(0,300)); });
await page.goto(`http://localhost:${port}/?test&trace&quality=${q}&day=25&hour=11&weather=clear${extra}`);
await page.waitForFunction(() => window.__parsa?.ready === true || window.__parsa?.error, null, { timeout: 1_800_000, polling: 1000 });
console.log('ready', (Date.now() - t0) / 1000);
await page.evaluate(() => window.__parsa.renderer.setAnimationLoop(null));
const pc = () => page.evaluate(() => { const p = window.__parsa.renderer._pipelines; return { pipelines: p.caches.size, vertex: p.programs.vertex.size, fragment: p.programs.fragment.size }; });
console.log('pipelines at ready', JSON.stringify(await pc()));
for (let i = 1; i <= +(process.env.FRAMES ?? 4); i++) { const t = Date.now(); await page.evaluate(() => window.__parsa.renderOnce()); console.log(`frame${i}`, (Date.now() - t) / 1000, JSON.stringify(await pc())); }
await b.close();
