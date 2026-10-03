// s18: does the player's own path draw? load, click Enter (DOM click), skip the opening, walk a little; stats + frames + errors
import { chromium } from '@playwright/test';
import { spawn } from 'node:child_process';
import { mkdtempSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
const dist = resolve(process.argv[2]), tag = process.argv[3], port = +process.argv[4], extra = process.argv[5] ?? '';
const here = new URL('.', import.meta.url).pathname.replace(/^\/(\w:)/, '$1');
const srv = spawn(process.execPath, [join(here, '../deploy/serve.mjs'), dist, String(port), '/fars/'], { stdio: 'ignore' }); process.on('exit', () => srv.kill());
const host = `http://127.0.0.2:${port}`; for (let i = 0; i < 50; i++) { try { if ((await fetch(`${host}/fars/`)).ok) break; } catch {} await new Promise(r => setTimeout(r, 200)); }
const ctx = await chromium.launchPersistentContext(mkdtempSync('T:/tmp/parsa-player-'), { channel: 'chrome', headless: true, args: ['--enable-unsafe-webgpu', '--ignore-gpu-blocklist'], viewport: { width: 1920, height: 1080 } });
const page = ctx.pages()[0]; const errs = []; page.on('console', m => { if (m.type() === 'error') errs.push(m.text().slice(0, 500)); }); page.on('pageerror', e => errs.push('PAGEERROR ' + String(e.stack ?? e).slice(0, 1200)));
const t0 = Date.now(), log = (...x) => console.log(tag, ((Date.now() - t0) / 1000).toFixed(0) + 's', ...x);
await page.goto(`${host}/fars/?quality=high&seed=1${extra}`);
await page.waitForFunction(() => window.__parsa?.ready === true || window.__parsa?.error, null, { timeout: 1_800_000 });
const st = () => page.evaluate(() => { const s = window.__parsa.stats(); return `draws ${s.drawCalls} tris ${(s.triangles / 1e6).toFixed(2)} M`; });
log('ready;', await st());
await page.waitForTimeout(20000); log('title +20 s;', await st()); writeFileSync(`T:/s18-player-${tag}-title.png`, await page.screenshot());
await page.evaluate(() => [...document.querySelectorAll('button')].find(b => /^(Enter|Continue the visit)$/.test(b.textContent))?.click());
for (let i = 0; i < 4; i++) { await page.waitForTimeout(1500); await page.keyboard.press('Escape'); await page.keyboard.press('Space'); }
await page.waitForTimeout(30000); log('entered +30 s;', await st()); writeFileSync(`T:/s18-player-${tag}-in.png`, await page.screenshot());
await page.evaluate(() => window.__parsa.setInput({ forward: 1 })); await page.waitForTimeout(8000); await page.evaluate(() => window.__parsa.setInput({ forward: 0 }));
log('walked 8 s;', await st()); writeFileSync(`T:/s18-player-${tag}-walk.png`, await page.screenshot());
log('errors', errs.length, '\n' + [...new Set(errs)].slice(0, 6).join('\n'));
await ctx.close(); process.exit(0);
