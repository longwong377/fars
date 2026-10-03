// s18: which object throws in the render? wrap renderer._renderObjectDirect, log the object behind each throw (first 20 unique)
import { chromium } from '@playwright/test';
import { spawn } from 'node:child_process';
import { mkdtempSync } from 'node:fs';
import { join, resolve } from 'node:path';
const dist = resolve(process.argv[2]), tag = process.argv[3], port = +process.argv[4];
const here = new URL('.', import.meta.url).pathname.replace(/^\/(\w:)/, '$1');
const srv = spawn(process.execPath, [join(here, '../deploy/serve.mjs'), dist, String(port), '/fars/'], { stdio: 'ignore' }); process.on('exit', () => srv.kill());
const host = `http://127.0.0.2:${port}`; for (let i = 0; i < 50; i++) { try { if ((await fetch(`${host}/fars/`)).ok) break; } catch {} await new Promise(r => setTimeout(r, 200)); }
const ctx = await chromium.launchPersistentContext(mkdtempSync('T:/tmp/parsa-culprit-'), { channel: 'chrome', headless: true, args: ['--enable-unsafe-webgpu', '--ignore-gpu-blocklist'], viewport: { width: 1920, height: 1080 } });
const page = ctx.pages()[0];
await page.addInitScript(() => { const bad = window.__bad = []; const note = (kind, a, stack) => { if (bad.length < 40) { const o = window.__cur; bad.push({ kind, arg: a === undefined ? 'undefined' : a === null ? 'null' : (a?.constructor?.name ?? typeof a), obj: o ? { name: o.name, type: o.type, path: (() => { const p = []; for (let x = o; x; x = x.parent) p.push(x.name || x.type); return p.slice(0, 6).join(' < '); })(), mat: o.material?.type + ':' + (o.material?.name ?? '') } : null, stack: stack.split(String.fromCharCode(10)).slice(2, 7).join(' | ') }); } };
  const Q = globalThis.GPUQueue?.prototype; if (!Q) return; const wb = Q.writeBuffer, wt = Q.writeTexture;
  Q.writeBuffer = function (b, ...r) { if (!(b instanceof GPUBuffer)) { note('writeBuffer', b, new Error().stack); return; } return wb.call(this, b, ...r); };
  Q.writeTexture = function (...a) { try { return wt.apply(this, a); } catch (e) { note('writeTexture ' + String(e).slice(0, 80), a[1], new Error().stack); } }; });
const t0 = Date.now(), log = (...x) => console.log(tag, ((Date.now() - t0) / 1000).toFixed(0) + 's', ...x);
await page.goto(`${host}/fars/?quality=high&seed=1`);
await page.waitForFunction(() => window.__parsa?.ready === true || window.__parsa?.error, null, { timeout: 1_800_000 });
const tagAll = () => page.evaluate(() => { let n = 0; window.__parsa.scene.traverse(o => { if (o.__tagged) return; o.__tagged = true; const f = o.onBeforeRender; o.onBeforeRender = function (...a) { window.__cur = o; return f?.apply(this, a); }; n++; }); return n; });
log('tagged', await tagAll());
const st = () => page.evaluate(() => { const s = window.__parsa.stats(); return 'draws ' + s.drawCalls + ' tris ' + (s.triangles / 1e6).toFixed(2) + ' M'; });
await page.evaluate(() => [...document.querySelectorAll('button')].find(b => /^(Enter|Continue the visit)$/.test(b.textContent))?.click());
for (let i = 0; i < 4; i++) { await page.waitForTimeout(1500); await page.keyboard.press('Escape'); await page.keyboard.press('Space'); }
await page.waitForTimeout(10000); log('tagged', await tagAll()); await page.waitForTimeout(10000); log('entered', await st());
await page.evaluate(() => window.__parsa.setInput({ forward: 1 })); await page.waitForTimeout(15000); await page.evaluate(() => window.__parsa.setInput({ forward: 0 }));
log('walked', await st()); const c = await page.evaluate(() => window.__bad);
log('culprits', c.length); for (const x of c.slice(0, 20)) console.log(JSON.stringify(x));
await ctx.close(); process.exit(0);
