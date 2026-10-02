// s15/load (D-392): open the built site (tools/deploy/serve.mjs) once with a query, print its console, page errors, failed
// requests and the boot trace until ready or a timeout (a quick check before the timed visits of tools/deploy/measure.mjs).
//   PROBE_Q='quality=high&trace&norender' node tools/dev/gpu_slot.mjs probe -- node tools/bake_world/site_probe.mjs <dist> [seconds]
import { chromium } from '@playwright/test';
import { spawn } from 'node:child_process';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
const [dist, secs = '300'] = process.argv.slice(2), q = process.env.PROBE_Q ?? 'quality=high&trace&norender', port = 4181; // (the query by env: gpu_slot runs the command through a shell)
const here = new URL('../deploy/', import.meta.url).pathname.replace(/^\/(\w:)/, '$1');
const srv = spawn(process.execPath, [join(here, 'serve.mjs'), dist, String(port), '/fars/'], { stdio: ['ignore', 'inherit', 'inherit'], env: { ...process.env, ...(process.env.MBPS ? { MBPS: process.env.MBPS } : {}) } });
process.on('exit', () => { try { srv.kill(); } catch {} });
const host = `http://127.0.0.2:${port}`;
for (let i = 0; i < 50; i++) { try { if ((await fetch(`${host}/fars/`)).ok) break; } catch {} await new Promise(r => setTimeout(r, 200)); }
const ctx = await chromium.launchPersistentContext(mkdtempSync(join(process.env.PROF_TMP ?? tmpdir(), 'parsa-probe-')), { channel: 'chrome', headless: !process.env.HEADED, args: ['--enable-unsafe-webgpu', '--ignore-gpu-blocklist'] });
const page = ctx.pages()[0] ?? await ctx.newPage(), t0 = Date.now(), s = () => ((Date.now() - t0) / 1000).toFixed(1);
page.on('console', m => console.log(s(), m.type(), m.text().slice(0, 400)));
page.on('pageerror', e => console.log(s(), 'PAGEERROR', String(e).slice(0, 600)));
page.on('requestfailed', r => console.log(s(), 'FAILED', r.url(), r.failure()?.errorText));
page.on('response', r => { if (r.status() >= 400) console.log(s(), 'HTTP', r.status(), r.url()); });
await page.goto(`${host}/fars/?${q}`);
const ok = await page.waitForFunction(() => window.__parsa?.ready === true || window.__parsa?.error, null, { timeout: +secs * 1000, polling: 500 }).then(() => true).catch(() => false);
console.log(s(), 'ready?', ok, await page.evaluate(() => ({ ready: window.__parsa?.ready, error: window.__parsa?.error ?? null, shell: document.body.innerText.slice(0, 300) })).catch(e => String(e)));
await ctx.close(); process.exit(0);
