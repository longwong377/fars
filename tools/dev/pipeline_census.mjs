// s18 C9 (D-740): the cloud's budget numbers for a built site, one cold visit: the bytes fetched before ready (and by kind),
// the page's memory at ready (every process of the profile; a relative signal: no GPU here), the seconds to ready, and the
// pipeline census (src/dev/pipelineCensus.ts: programs, the T4's per-pipeline limits, texture GPU bytes) on ?norender, so
// nothing is compiled. Headless Chromium on SwiftShader's WebGPU (the WGSL builder is the T4's).
//   node tools/dev/pipeline_census.mjs <dist> <out.json> [--mbps 100] [--params 'seed=1'] [--check: noon and night, exit 1 over a limit]
import { chromium } from '@playwright/test';
import { spawn, execFileSync } from 'node:child_process';
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';

const a = process.argv.slice(2), opt = (k, d) => { const i = a.indexOf(k); return i >= 0 ? a[i + 1] : d; };
const dist = resolve(a[0] ?? 'dist'), out = a[1] ?? 'census.json', mbps = opt('--mbps', '100'), extra = opt('--params', 'seed=1'), port = +opt('--port', 4182);
const here = new URL('.', import.meta.url).pathname;
const srv = spawn(process.execPath, [join(here, '../deploy/serve.mjs'), dist, String(port), '/fars/'], { env: { ...process.env, MBPS: mbps }, stdio: 'ignore' });
process.on('exit', () => { try { srv.kill(); } catch {} });
const host = `http://127.0.0.2:${port}`;
for (let i = 0; i < 50; i++) { try { if ((await fetch(`${host}/fars/`)).ok) break; } catch {} await new Promise(r => setTimeout(r, 200)); }
await fetch(`${host}/__served`, { method: 'POST' });
const prof = mkdtempSync(join(tmpdir(), 'parsa-census-')), tag = prof.split('/').pop();
const memGB = () => { try { // every process of the profile's browser: its own (named by the profile) and all their descendants
  const rows = execFileSync('ps', ['-eo', 'pid=,ppid=,rss=,args='], { encoding: 'utf8', maxBuffer: 64 << 20 }).split('\n').map(l => l.trim().split(/\s+/)).filter(r => r.length > 3).map(r => ({ pid: r[0], ppid: r[1], rss: +r[2], args: r.slice(3).join(' ') }));
  const mine = new Set(rows.filter(r => r.args.includes(tag)).map(r => r.pid)); let grew = true;
  while (grew) { grew = false; for (const r of rows) if (!mine.has(r.pid) && mine.has(r.ppid)) { mine.add(r.pid); grew = true; } }
  return +(rows.filter(r => mine.has(r.pid)).reduce((x, r) => x + r.rss, 0) / 2 ** 20).toFixed(2); } catch { return NaN; } };
const ctx = await chromium.launchPersistentContext(prof, { headless: true, viewport: { width: 1920, height: 1080 },
  args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--enable-unsafe-webgpu', '--enable-features=Vulkan', '--use-vulkan=swiftshader', '--use-webgpu-adapter=swiftshader'] });
const page = ctx.pages()[0] ?? await ctx.newPage(), errs = [];
const lowWarn = []; page.on('console', m => { const t = m.text(); if (m.type() === 'error') errs.push(t.slice(0, 200)); if (/\[lowfirst\]|\[scans\]/.test(t)) lowWarn.push(t.slice(0, 200)); });
let peak = 0; const poll = setInterval(() => { const m = memGB(); if (m > peak) peak = m; }, 3000);
const t0 = Date.now(), s = () => +((Date.now() - t0) / 1000).toFixed(1);
await page.goto(`${host}/fars/?quality=high&norender&${extra}`);
await page.waitForFunction(() => window.__parsa?.ready === true || window.__parsa?.error, null, { timeout: 3_600_000, polling: 500 });
const r = { dist, mbps: +mbps, readyS: s(), error: await page.evaluate(() => window.__parsa.error ?? null), backend: await page.evaluate(() => window.__parsa.backend), memAtReadyGB: memGB() };
const served = await (await fetch(`${host}/__served`)).json();
r.beforeReadyMB = +(served.reduce((x, e) => x + (e.b ?? 0), 0) / 1048576).toFixed(1); r.requests = served.length;
const kind = p => p.startsWith('textures/') ? (p.includes('.low.') ? 'textures:low' : p.endsWith('.ktx2') ? 'textures:ktx2' : 'textures:img') : p.startsWith('models/') ? 'models/' + p.split('/')[1] : p.split('/')[0];
r.beforeReadyByKind = {}; for (const e of served) { const k = kind(e.p); r.beforeReadyByKind[k] = +((r.beforeReadyByKind[k] ?? 0) + (e.b ?? 0) / 1048576).toFixed(1); }
r.beforeReadyByKind = Object.fromEntries(Object.entries(r.beforeReadyByKind).sort((x, y) => y[1] - x[1]));
r.missing = served.filter(e => e.s === 404).map(e => e.p).slice(0, 20);
console.log('ready', r.readyS, 's', r.backend, 'before ready', r.beforeReadyMB, 'MB', 'memory', r.memAtReadyGB, 'GB');
r.census = await page.evaluate(() => window.__parsa.census?.() ?? null).catch(e => String(e).slice(0, 300));
// --check (D-740): also at night (the fire lights and their maps are in the scene then), and exit 1 on any pipeline over the
// T4's limits (16 vertex inputs, 8 vertex buffers, 16 fragment samplers): a page-wide texture added anywhere fails here
if (a.includes('--check')) { r.censusNight = await page.evaluate(async () => { window.__parsa.setTime(0, 22.5); await window.__parsa.step(2); return window.__parsa.census(); }).catch(e => String(e).slice(0, 300)); }
// the low-first upgrades (D-740: the UASTC mips into the ETC1S twins' textures) run after ready: wait for them (5 min at most)
for (let i = 0; i < 100; i++) { const L = await page.evaluate(() => window.__parsa.lowFirst?.() ?? null); r.lowFirst = L; if (!L || L.pending === 0) break; await page.waitForTimeout(3000); }
r.lowFirstWarnings = lowWarn.slice(0, 12); r.memAfterUpgradesGB = memGB();
r.peakGB = Math.max(peak, memGB()); r.errors = errs.slice(0, 10);
clearInterval(poll); writeFileSync(out, JSON.stringify(r, null, 1));
console.log(JSON.stringify({ ...r, census: r.census && { ...r.census, byWhere: undefined, textures: r.census.textures && { ...r.census.textures, top: r.census.textures.top?.slice(0, 8) } } }, null, 1));
await ctx.close(); srv.kill(); try { rmSync(prof, { recursive: true, force: true }); } catch {}
if (a.includes('--check')) { const bad = [r.census, r.censusNight].flatMap(c => (typeof c === 'object' && c ? c.over : [`census failed: ${c}`]));
  if (r.error || bad.length) { console.log('PIPELINE LIMITS FAILED (D-740):', JSON.stringify(r.error ? [r.error, ...bad] : bad, null, 1)); process.exit(1); }
  console.log(`pipeline limits ok: worst day ${JSON.stringify(r.census.worst)}, night ${JSON.stringify(r.censusNight.worst)}`); }
process.exit(0);
