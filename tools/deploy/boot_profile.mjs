// s17/load (D-580): where a cold built-site load's main thread goes. Serves the dist as measure.mjs does (serve.mjs, the
// same cap), opens an empty profile with the CPU profiler on the page's main thread from navigation to ready + `--tail` s,
// and prints the self time per function in windows of `--win` s (the boot trace's stages beside them).
//   node tools/deploy/boot_profile.mjs [dist] [--mbps 100] [--params norender] [--win 5] [--tail 10] [--top 8]
import { chromium } from '@playwright/test';
import { spawn } from 'node:child_process';
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';

const a = process.argv.slice(2), opt = (k, d) => { const i = a.indexOf(k); return i >= 0 ? a[i + 1] : d; };
const dist = resolve(a[0] && !a[0].startsWith('--') ? a[0] : 'dist'), mbps = opt('--mbps', '100'), port = +opt('--port', 4181);
const extra = opt('--params', 'norender'), win = +opt('--win', 5), tail = +opt('--tail', 10), top = +opt('--top', 8);
const here = new URL('.', import.meta.url).pathname;
const srv = spawn(process.execPath, [join(here, 'serve.mjs'), dist, String(port), '/fars/'], { env: { ...process.env, MBPS: mbps }, stdio: ['ignore', 'inherit', 'inherit'] });
process.on('exit', () => { try { srv.kill(); } catch {} });
const host = `http://127.0.0.2:${port}`;
for (let i = 0; i < 50; i++) { try { if ((await fetch(`${host}/fars/`)).ok) break; } catch {} await new Promise(r => setTimeout(r, 200)); }
const prof = mkdtempSync(join(tmpdir(), 'parsa-prof-'));
const ctx = await chromium.launchPersistentContext(prof, { channel: process.env.PW_CHANNEL ?? 'chromium', headless: true, args: ['--enable-unsafe-webgpu', '--ignore-gpu-blocklist'], viewport: { width: 1280, height: 720 } });
const page = ctx.pages()[0] ?? await ctx.newPage(), boot = [];
const cdp = await ctx.newCDPSession(page);
await cdp.send('Profiler.enable'); await cdp.send('Profiler.setSamplingInterval', { interval: 2000 }); await cdp.send('Profiler.start');
const t0 = Date.now();
page.on('console', m => { const t = m.text(); if (t.startsWith('[boot]')) boot.push([(Date.now() - t0) / 1000, t.slice(7, 90)]); });
await page.goto(`${host}/fars/?quality=high&trace&${extra}`);
await page.waitForFunction(() => window.__parsa?.ready === true || window.__parsa?.error, null, { timeout: 1_800_000, polling: 250 });
const readyS = (Date.now() - t0) / 1000, readyAt = await page.evaluate(() => window.__parsa.readyAt ?? null);
await page.waitForTimeout(tail * 1000);
const { profile } = await cdp.send('Profiler.stop');
await ctx.close(); try { rmSync(prof, { recursive: true, force: true }); } catch {}
writeFileSync(join(dist, '..', 'boot-profile.cpuprofile'), JSON.stringify(profile));
// self time per node, per window (the profile's clock: microseconds from its start, which is ~navigation)
const byId = new Map(profile.nodes.map(n => [n.id, n])), W = new Map();
let t = profile.startTime; const t00 = profile.startTime;
for (let i = 0; i < profile.samples.length; i++) { t += profile.timeDeltas[i]; const n = byId.get(profile.samples[i]); const f = n.callFrame;
  const name = f.functionName || (f.url ? '(anon)' : f.url === '' && n.callFrame.functionName === '' ? '(program)' : '(anon)');
  const key = `${name} ${f.url.split('/').pop()}:${f.lineNumber + 1}`.replace(/^\(anon\)  :0$/, '(native/idle)');
  const w = Math.floor((t - t00) / 1e6 / win), m = W.get(w) ?? new Map(); m.set(key, (m.get(key) ?? 0) + (profile.timeDeltas[i + 1] ?? 0) / 1000); W.set(w, m); }
console.log(`ready ${readyS.toFixed(1)} s (harness), page clock ${readyAt ? (readyAt / 1000).toFixed(1) : '?'} s`);
for (const w of [...W.keys()].sort((x, y) => x - y)) { const m = W.get(w), busy = [...m].filter(([k]) => !/^\((idle|program|garbage|native\/idle)/.test(k)).reduce((x, [, v]) => x + v, 0);
  const st = boot.filter(([s]) => s >= w * win && s < (w + 1) * win).map(([, l]) => l.split(' ').slice(0, 2).join(' ')).join(' | ');
  console.log(`${String(w * win).padStart(4)} s busy ${(busy / (win * 10)).toFixed(0).padStart(3)} %  ${st}`);
  for (const [k, v] of [...m].sort((x, y) => y[1] - x[1]).slice(0, top)) console.log(`        ${v.toFixed(0).padStart(6)} ms  ${k.slice(0, 120)}`); }
process.exit(0);
