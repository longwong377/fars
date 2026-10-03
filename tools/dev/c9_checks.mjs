// s18: C9's checks on the built site: __parsa.lowFirst() a minute after ready, ?shaderlog validation errors, __parsa.census() on ?norender
import { chromium } from '@playwright/test';
import { spawn } from 'node:child_process';
import { mkdtempSync } from 'node:fs';
import { join, resolve } from 'node:path';
const dist = resolve(process.argv[2]), port = +(process.argv[3] ?? 4211);
const here = new URL('.', import.meta.url).pathname.replace(/^\/(\w:)/, '$1');
const srv = spawn(process.execPath, [join(here, '../deploy/serve.mjs'), dist, String(port), '/fars/'], { stdio: 'ignore' }); process.on('exit', () => srv.kill());
const host = `http://127.0.0.2:${port}`; for (let i = 0; i < 50; i++) { try { if ((await fetch(`${host}/fars/`)).ok) break; } catch {} await new Promise(r => setTimeout(r, 200)); }
const open = async (q) => { const ctx = await chromium.launchPersistentContext(mkdtempSync('T:/tmp/parsa-c9-'), { channel: 'chrome', headless: true, args: ['--enable-unsafe-webgpu', '--ignore-gpu-blocklist'], viewport: { width: 1920, height: 1080 } });
  const page = ctx.pages()[0], msgs = []; page.on('console', m => msgs.push(`[${m.type()}] ${m.text().slice(0, 400)}`)); page.on('pageerror', e => msgs.push('[pageerror] ' + String(e).slice(0, 300)));
  await page.goto(`${host}/fars/?quality=high&seed=1${q}`); await page.waitForFunction(() => window.__parsa?.ready === true || window.__parsa?.error, null, { timeout: 1_800_000 }); return { ctx, page, msgs }; };
{ const { ctx, page, msgs } = await open('&shaderlog');
  await page.evaluate(() => [...document.querySelectorAll('button')].find(b => /^(Enter|Continue the visit)$/.test(b.textContent))?.click());
  await page.waitForTimeout(60000);
  const lf = await page.evaluate(async () => { try { const r = await window.__parsa.lowFirst?.(); return r ?? 'no lowFirst()'; } catch (e) { return 'threw ' + e; } });
  console.log('lowFirst', JSON.stringify(lf).slice(0, 1500));
  await page.waitForTimeout(120000);
  const val = msgs.filter(m => /validation|invalid|does not match|starling|dove|pipeline creation failed|lowfirst/i.test(m));
  console.log('validation/lowfirst messages', val.length); for (const m of [...new Set(val)].slice(0, 30)) console.log('  ' + m);
  await ctx.close(); }
{ const { ctx, page } = await open('&norender');
  const c = await page.evaluate(async () => { try { return await window.__parsa.census(); } catch (e) { return 'threw ' + e; } });
  const s = JSON.stringify(c); console.log('census', s.length > 4000 ? s.slice(0, 4000) + '...' : s);
  await ctx.close(); }
process.exit(0);
