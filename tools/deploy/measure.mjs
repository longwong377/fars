// s15/ship (D-368): time a player's first and second visit to the BUILT site (no dev server), on this machine's GPU.
//   node tools/dev/gpu_slot.mjs ship -- node tools/deploy/measure.mjs [dist=dist] [--mbps 100] [--q high] [--warm-only <profile>]
// It serves the dist as GitHub Pages does (tools/deploy/serve.mjs: /fars/, gzip, max-age=600 + ETag), optionally capped to
// --mbps megabits a second, opens the installed Chrome on the T4 with an EMPTY profile (cold: no HTTP or shader cache), then
// opens the same profile again (warm). Per visit: the seconds to ready (world built; the title is shown and the player can
// walk), to the first 3 frames, to every shader compiled (progressive compile: __parsa.compiling().live == 0), the bytes
// fetched before ready and in the first 60 s, the page's memory (every Chrome process of the profile), and the boot trace.
import { chromium } from '@playwright/test';
import { spawn, execFileSync } from 'node:child_process';
import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';

const a = process.argv.slice(2), opt = (k, d) => { const i = a.indexOf(k); return i >= 0 ? a[i + 1] : d; };
const dist = resolve(a[0] && !a[0].startsWith('--') ? a[0] : 'dist'), mbps = opt('--mbps', ''), q = opt('--q', 'high'), port = +opt('--port', 4180);
const visits = (opt('--visits', 'cold,warm')).split(','), extra = opt('--params', '');
const here = new URL('.', import.meta.url).pathname.replace(/^\/(\w:)/, '$1');
const srv = spawn(process.execPath, [join(here, 'serve.mjs'), dist, String(port), '/fars/'], { env: { ...process.env, ...(mbps ? { MBPS: mbps } : {}) }, stdio: ['ignore', 'inherit', 'inherit'] });
// (D-393: the server stands for a remote host: above the browser's priority, so the page's own CPU load on this 4-thread box
// does not slow its downloads; measured below normal under gpu_slot, the served rate fell to a third of the cap)
try { (await import('node:os')).setPriority(srv.pid, (await import('node:os')).constants.priority.PRIORITY_ABOVE_NORMAL); } catch (e) { console.log('[measure] server priority unchanged:', e.message); }
const stop = () => { try { srv.kill(); } catch {} }; process.on('exit', stop);
const host = `http://127.0.0.2:${port}`; // not "localhost": the site must take the public origin's paths (models from Hugging Face)
for (let i = 0; i < 50; i++) { try { if ((await fetch(`${host}/fars/`)).ok) break; } catch {} await new Promise(r => setTimeout(r, 200)); }
const served = async (reset = false) => (await fetch(`${host}/__served`, { method: reset ? 'POST' : 'GET' })).json();
const prof = opt('--profile', null) ?? mkdtempSync(join(tmpdir(), 'parsa-visit-'));
const memGB = () => { try { const ps = `(Get-CimInstance Win32_Process -Filter "Name='chrome.exe'" | ? { $_.CommandLine -like '*${prof.split(/[\\/]/).pop()}*' } | % { (Get-Process -Id $_.ProcessId).WorkingSet64 } | Measure-Object -Sum).Sum`;
  return +(+execFileSync('powershell', ['-NoProfile', '-Command', ps], { encoding: 'utf8' }).trim() / 2 ** 30).toFixed(2); } catch { return NaN; } };
const ext = new Map(); // the model hosts' traffic (Hugging Face, GitHub raw): requests and bytes per host
async function talkCheck(page, s) {
  const T = { hosts: null, rows: [] };
  const toPerson = () => page.evaluate(() => { const P = window.__parsa.people(); const a = P?.agents.find(x => !x.offmap); if (!a) return null; window.__parsa.teleport(a.e + 0.8, a.n); return a.name; });
  const say = async text => { const who = await toPerson(); await page.evaluate(() => window.__parsa.tick()); const t0 = Date.now();
    const row = await page.evaluate(t => window.__converse.say(t).then(r => r && { name: r.name, reply: r.reply, own: !!r.own, ok: r.ok, ms: Math.round(r.ms ?? 0), ttft: r.ttft ? Math.round(r.ttft) : null, heard: r.heard?.backend ?? null, hits: (r.hits ?? []).slice(0, 4).map(h => typeof h === 'string' ? h : JSON.stringify(h).slice(0, 80)) }), text).catch(e => ({ error: String(e).slice(0, 200) }));
    return { atS: s(), to: who, text, wallMs: Date.now() - t0, ...(row ?? { none: true }) }; };
  for (let i = 0; i < 40 && !(await page.evaluate(() => !!window.__converse)); i++) await page.waitForTimeout(500);
  if (!(await page.evaluate(() => !!window.__converse))) { T.error = 'no __converse (talk off?)'; return T; }
  T.rows.push(await say('Greetings. What is your work?'));
  const t1 = Date.now(); let st;
  while (Date.now() - t1 < 900_000) { st = await page.evaluate(() => ({ ...window.__converse.state, log: undefined, history: undefined, heard: undefined, last: undefined }));
    if (st.loaded || /cannot|did not load/.test(st.status ?? '')) break; await page.waitForTimeout(2000); }
  T.status = st?.status; T.loaded = !!st?.loaded; T.loadedAtS = s();
  if (T.loaded) for (const q of ['Where is your home, and who lives there with you?', 'What did you eat this morning?', 'Is the work hard today?']) T.rows.push(await say(q));
  T.hosts = Object.fromEntries([...ext].map(([h, x]) => [h, { n: x.n, MB: +(x.b / 1048576).toFixed(1), failed: x.f }]));
  console.log('talk', JSON.stringify(T)); return T;
}
const out = { dist, mbps: mbps ? +mbps : 'unlimited (loopback)', q, visits: {} };
for (const v of visits) {
  await served(true);
  const ctx = await chromium.launchPersistentContext(prof, { channel: process.env.PW_CHANNEL ?? 'chrome', headless: !process.env.HEADED,
    args: ['--enable-unsafe-webgpu', '--ignore-gpu-blocklist'], viewport: { width: 1920, height: 1080 } });
  const page = ctx.pages()[0] ?? await ctx.newPage(), boot = [], errs = [];
  page.on('console', m => { const t = m.text(); if (t.startsWith('[boot]')) { boot.push([+((Date.now() - t0) / 1000).toFixed(1), t.slice(7, 120)]); console.log(((Date.now() - t0) / 1000).toFixed(1), t.slice(0, 160)); } else if (m.type() === 'error' || m.type() === 'warning') { errs.push(t.slice(0, 200)); console.log('[page]', m.type(), t.slice(0, 300)); } });
  page.on('requestfinished', async q => { const u = new URL(q.url()); if (u.host.startsWith('127.0.0.2')) return; const x = ext.get(u.host) ?? { n: 0, b: 0, f: 0 }; x.n++; ext.set(u.host, x);
    try { const z = await q.sizes(); x.b += z.responseBodySize; } catch {} });
  page.on('requestfailed', q => { const u = new URL(q.url()); if (u.host.startsWith('127.0.0.2')) return; const x = ext.get(u.host) ?? { n: 0, b: 0, f: 0 }; x.f++; ext.set(u.host, x); console.log('[net] failed', q.url().slice(0, 160), q.failure()?.errorText); });
  page.on('crash',() => console.log('[page] CRASHED at', ((Date.now() - t0) / 1000).toFixed(1), 's')); page.on('close', () => console.log('[page] closed'));
  let peak = 0; const poll = setInterval(() => { const m = memGB(); if (m > peak) peak = m; }, 5000);
  let t0 = Date.now(); const s = () => +((Date.now() - t0) / 1000).toFixed(1), r = {};
  await page.goto(`${host}/fars/?quality=${q}&trace${extra ? '&' + extra : ''}`);
  await page.waitForFunction(() => window.__parsa?.ready === true || window.__parsa?.error, null, { timeout: 3_600_000, polling: 250 });
  r.error = await page.evaluate(() => window.__parsa.error ?? null); r.swControl = await page.evaluate(() => !!navigator.serviceWorker?.controller); r.warm = await page.evaluate(() => window.__warm ?? null);
  r.siteCache = await page.evaluate(async () => { try { const ks = await caches.keys(), out = {}; for (const k of ks) out[k] = (await (await caches.open(k)).keys()).length; const e = await navigator.storage.estimate(); return { caches: out, usageMB: Math.round(e.usage / 1048576), quotaMB: Math.round(e.quota / 1048576) }; } catch (e) { return String(e); } }); r.readyS = s(); console.log(v, 'ready', r.readyS, 's', r.error ?? '');
  const log1 = await served(); r.beforeReadyMB = +(log1.reduce((x, e) => x + (e.b ?? 0), 0) / 1048576).toFixed(1); r.requests = log1.length; r.served = log1.map(e => [e.p, e.b ?? 0, e.t]); r.lastByteBeforeReadyS = +(Math.max(0, ...log1.map(e => e.t)) / 1000).toFixed(1);
  if (!r.error) {
    await page.evaluate(() => new Promise(res => { let n = 0; const f = () => (++n >= 3 ? res() : requestAnimationFrame(f)); requestAnimationFrame(f); })); r.framesS = s();
    // every shader compiled (progressive compile), or 20 min
    const t1 = Date.now(); while (Date.now() - t1 < 1_200_000) { const c = await page.evaluate(() => window.__parsa.compiling?.() ?? null); if (!c) break; r.compiled = c.done; r.deferredLast = c.deferred; if (c.live === 0 && !c.deferred && Date.now() - t1 > 3000) break; await page.waitForTimeout(1000); }
    r.settledS = s();
    r.frameMs = await page.evaluate(() => new Promise(res => { const t = []; let last = performance.now(); const end = last + 5000;
      const f = now => { t.push(now - last); last = now; if (now < end) requestAnimationFrame(f); else { t.sort((x, y) => x - y); res(+t[t.length >> 1].toFixed(1)); } }; requestAnimationFrame(f); }));
    await page.screenshot({ path: join(dist, '..', `visit-${v}.jpg`), quality: 70 }).catch(() => {});
    // D-393 --talk: speak to the nearest person at once (their own line while the model streams in), then again once the
    // talk model is ready (Qwen2.5-0.5B from Hugging Face's CDN): the replies, the model's load time, the hosts it came from
    if (a.includes('--talk')) r.talk = await talkCheck(page, s);
  }
  const log2 = await served(); r.totalMB = +(log2.reduce((x, e) => x + (e.b ?? 0), 0) / 1048576).toFixed(1);
  r.first60sMB = +(log2.filter(e => e.t <= 60000).reduce((x, e) => x + (e.b ?? 0), 0) / 1048576).toFixed(1);
  r.notModified = log2.filter(e => e.s === 304).length; r.missing = log2.filter(e => e.s === 404).map(e => e.p).slice(0, 20);
  r.top = [...log2].sort((x, y) => (y.b ?? 0) - (x.b ?? 0)).slice(0, 10).map(e => `${e.p} ${((e.b ?? 0) / 1048576).toFixed(1)}`);
  clearInterval(poll); r.memGB = Math.max(peak, memGB()); r.boot = boot; r.errors = errs.slice(0, 15);
  out.visits[v] = r; console.log(v, JSON.stringify({ ...r, boot: undefined, served: undefined, errors: r.errors.filter(e => !/KTX2Loader/.test(e)).slice(0, 5) }));
  await ctx.close();
}
writeFileSync(join(dist, '..', 'visits.json'), JSON.stringify(out, null, 1)); console.log(JSON.stringify(out, null, 1));
stop(); process.exit(0);
