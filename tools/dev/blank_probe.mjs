// s18: why does the built site draw 0 calls? load, then report the DOM's state, the canvas, and stats around renderOnce
import { chromium } from '@playwright/test';
import { spawn } from 'node:child_process';
import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
const dist = resolve(process.argv[2]), params = process.argv[3] ?? '', out = process.argv[4] ?? 'T:/s18-blank';
const port = 4183, here = new URL('.', import.meta.url).pathname.replace(/^\/(\w:)/, '$1');
const srv = spawn(process.execPath, [join(here, '../deploy/serve.mjs'), dist, String(port), '/fars/'], { stdio: 'ignore' }); process.on('exit', () => srv.kill());
const host = `http://127.0.0.2:${port}`; for (let i = 0; i < 50; i++) { try { if ((await fetch(`${host}/fars/`)).ok) break; } catch {} await new Promise(r => setTimeout(r, 200)); }
const ctx = await chromium.launchPersistentContext(mkdtempSync(join(tmpdir(), 'parsa-blank-')), { channel: 'chrome', headless: true, args: ['--enable-unsafe-webgpu', '--ignore-gpu-blocklist'], viewport: { width: 1920, height: 1080 } });
const page = ctx.pages()[0]; const errs = []; page.on('console', m => { if (m.type() === 'error') errs.push(m.text().slice(0, 600) + ' @ ' + JSON.stringify(m.location())); }); page.on('pageerror', e => errs.push(String(e.stack ?? e).slice(0, 1500)));
const t0 = Date.now();
await page.goto(`${host}/fars/?quality=high&seed=1&day=168&hour=12.586&court=seasonal${params}`);
await page.waitForFunction(() => window.__parsa?.ready === true || window.__parsa?.error, null, { timeout: 1_800_000 });
console.log('ready', (Date.now() - t0) / 1000, 's');
const dom = async () => page.evaluate(() => {
  const c = document.querySelector('canvas'); const btn = [...document.querySelectorAll('button')].filter(b => b.offsetParent).map(b => b.textContent);
  const covers = [...document.querySelectorAll('body *')].filter(e => { const s = getComputedStyle(e); const r = e.getBoundingClientRect(); return r.width > 1500 && r.height > 800 && s.visibility !== 'hidden' && s.display !== 'none' && +s.opacity > 0.05 && e.tagName !== 'CANVAS'; }).map(e => `${e.tagName}#${e.id}.${e.className} bg=${getComputedStyle(e).backgroundColor} op=${getComputedStyle(e).opacity} z=${getComputedStyle(e).zIndex}`);
  const p = window.__parsa, s = p.stats();
  return { canvas: c ? [c.width, c.height, getComputedStyle(c).display, getComputedStyle(c).visibility] : null, buttons: btn, covers, text: document.body.innerText.slice(0, 400), draws: s.drawCalls, tris: s.triangles, backend: s.backend, norender: p.norender };
});
for (const wait of [5, 60]) { await page.waitForTimeout(wait * 1000); console.log(`after ${wait} s`, JSON.stringify(await dom())); }
await page.evaluate(() => window.__parsa.view(84.8, 9.85, 1.6, 69.6, 1.9));
await page.evaluate(() => window.__parsa.renderOnce()); await page.evaluate(() => window.__parsa.renderOnce());
console.log('after view+renderOnce', JSON.stringify(await dom()));
writeFileSync(join(out + '-' + (params.replace(/\W/g, '') || 'live') + '.png'), await page.screenshot());
console.log('errors', errs.slice(0, 10).join('\n'));
await ctx.close(); process.exit(0);

