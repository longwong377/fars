// dev (D-250): CPU-profile the page's first frames after load (the JS main thread) and print the heaviest functions by self
// and inclusive time. Usage: node tools/dev/profile_frame.mjs <port> [quality=test] ['&extra'] (serve with NOHMR=1 vite)
import { chromium } from '@playwright/test';
import { writeFileSync } from 'node:fs';
const [port, q = 'test', extra = ''] = process.argv.slice(2);
const args = ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--enable-unsafe-webgpu', '--enable-features=Vulkan', '--use-vulkan=swiftshader', '--use-webgpu-adapter=swiftshader'];
const b = await chromium.launch({ headless: true, args });
const page = await b.newPage({ viewport: { width: 960, height: 540 } });
const cdp = await page.context().newCDPSession(page);
await cdp.send('Profiler.enable'); await cdp.send('Profiler.setSamplingInterval', { interval: 5000 });
const t0 = Date.now();
if (process.env.FROMSTART) await cdp.send('Profiler.start');
await page.goto(`http://localhost:${port}/?test&quality=${q}&day=25&hour=11&weather=clear${extra}`);
await page.waitForFunction(() => window.__parsa?.ready === true || window.__parsa?.error, null, { timeout: 1_800_000, polling: 1000 });
console.log('ready', (Date.now() - t0) / 1000);
await page.evaluate(() => window.__parsa.renderer.setAnimationLoop(null));
await page.evaluate(() => { const be = window.__parsa.renderer.backend, orig = be.updateTexture.bind(be); window.__texLog = [];
  be.updateTexture = (tex, opts) => { const t = performance.now(); const r = orig(tex, opts); const im = tex.image ?? {}; window.__texLog.push({ name: tex.name, type: tex.constructor.name, w: im.width, h: im.height, d: im.depth, bytes: im.data?.byteLength, fmt: tex.format, ty: tex.type, mips: tex.generateMipmaps, ms: Math.round(performance.now() - t), ver: tex.version }); return r; }; });
if (!process.env.FROMSTART) await cdp.send('Profiler.start');
const t = Date.now(); await page.evaluate(() => window.__parsa.renderOnce()); console.log('frame1', (Date.now() - t) / 1000); console.log('textures', JSON.stringify(await page.evaluate(() => window.__texLog.sort((a, b) => b.ms - a.ms).slice(0, 15)), null, 0));
const { profile } = await cdp.send('Profiler.stop');
writeFileSync(process.env.OUT ?? '/tmp/frame.cpuprofile', JSON.stringify(profile));
// self time per function, and inclusive time per function (each sample counted once per distinct function on its stack)
const byId = new Map(profile.nodes.map(n => [n.id, n])), parent = new Map();
for (const n of profile.nodes) for (const c of n.children ?? []) parent.set(c, n.id);
const dt = profile.timeDeltas, self = new Map(), incl = new Map();
const name = n => `${n.callFrame.functionName || '(anon)'} ${n.callFrame.url.split('/').slice(-1)[0]}:${n.callFrame.lineNumber + 1}`;
profile.samples.forEach((id, i) => { const d = (dt[i + 1] ?? 0) / 1000; let n = byId.get(id); self.set(name(n), (self.get(name(n)) ?? 0) + d);
  const seen = new Set(); for (let k = id; k != null; k = parent.get(k)) { const nm = name(byId.get(k)); if (seen.has(nm)) continue; seen.add(nm); incl.set(nm, (incl.get(nm) ?? 0) + d); } });
const top = (m, n) => [...m].sort((a, b) => b[1] - a[1]).slice(0, n).map(([k, v]) => `${(v / 1000).toFixed(1).padStart(7)} s  ${k}`).join('\n');
console.log('--- self\n' + top(self, 30) + '\n--- inclusive\n' + top(incl, 60));
await b.close();
