// The merge budget (session 15): the game as a whole may never silently get heavier. One player-like page load of a tree,
// measured: seconds to ready (world built), seconds to the first 3 frames drawn (shader compiles included), page memory (every
// Chrome process of this run's profile), and the median frame time over 10 s at the spawn. Compared with gates/budgets.json:
// a metric worse than its baseline by more than the tolerance FAILS (exit 1: the merge does not go in); a pass that improves a
// metric tightens the baseline (--accept writes it). The UD-31 targets are reported as the gap still to close.
//   node tools/dev/gpu_slot.mjs budget -- node tools/dev/budget.mjs [--tree <path>] [--port 5199] [--accept] [--q high]
import { chromium } from '@playwright/test';
import { spawn, execFileSync } from 'node:child_process';
import { mkdtempSync, readFileSync, writeFileSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';

const a = process.argv.slice(2), opt = (k, d) => { const i = a.indexOf(k); return i >= 0 ? a[i + 1] : d; };
const tree = resolve(opt('--tree', '.')), port = +opt('--port', 5199), q = opt('--q', 'high'), accept = a.includes('--accept');
const BF = resolve('gates/budgets.json'), B = JSON.parse(readFileSync(BF, 'utf8'));

// the tree's own dev server, no HMR (a reload mid-run would void the measurement)
const vite = spawn('npx', ['vite', '--port', String(port), '--strictPort'], { cwd: tree, shell: true, env: { ...process.env, NOHMR: '1' }, stdio: 'ignore' });
const stop = () => { try { execFileSync('taskkill', ['/T', '/F', '/PID', String(vite.pid)], { stdio: 'ignore' }); } catch {} };
process.on('exit', stop);
for (let i = 0; i < 120; i++) { try { if ((await fetch(`http://localhost:${port}/`)).ok) break; } catch {} await new Promise(r => setTimeout(r, 1000)); }

const prof = mkdtempSync(join(tmpdir(), 'parsa-budget-')); // a cold load: no shader or HTTP cache from earlier runs
const ctx = await chromium.launchPersistentContext(prof, { channel: process.env.PW_CHANNEL ?? 'chrome', headless: !process.env.HEADED,
  args: ['--enable-unsafe-webgpu', '--ignore-gpu-blocklist'], viewport: { width: 1920, height: 1080 } });
const page = ctx.pages()[0] ?? await ctx.newPage();
const memGB = () => { try { // working sets of every Chrome process started with this run's profile
  const ps = `(Get-CimInstance Win32_Process -Filter "Name='chrome.exe'" | ? { $_.CommandLine -like '*${prof.split('\\').pop()}*' } | % { (Get-Process -Id $_.ProcessId).WorkingSet64 } | Measure-Object -Sum).Sum`;
  return +(+execFileSync('powershell', ['-NoProfile', '-Command', ps], { encoding: 'utf8' }).trim() / 2 ** 30).toFixed(2); } catch { return NaN; } };

const t0 = Date.now(), s = () => +((Date.now() - t0) / 1000).toFixed(1);
let peak = 0; const poll = setInterval(() => { const m = memGB(); if (m > peak) peak = m; }, 5000);
await page.goto(`http://localhost:${port}/?quality=${q}`);
await page.waitForFunction(() => window.__parsa?.ready === true || window.__parsa?.error, null, { timeout: 3_600_000, polling: 500 });
const err = await page.evaluate(() => window.__parsa.error ?? null);
if (err) { console.log(`FAIL: the page did not start: ${err}`); await ctx.close(); process.exit(1); }
const readyS = s();
await page.evaluate(() => new Promise(r => { let n = 0; const f = () => (++n >= 3 ? r() : requestAnimationFrame(f)); requestAnimationFrame(f); }));
const framesS = s();
await page.waitForTimeout(5000); // let streaming settle at the spawn
const frameMs = await page.evaluate(() => new Promise(r => { const t = []; let last = performance.now(); const end = last + 10000;
  const f = now => { t.push(now - last); last = now; if (now < end) requestAnimationFrame(f); else { t.sort((x, y) => x - y); r(+t[t.length >> 1].toFixed(1)); } };
  requestAnimationFrame(f); }));
clearInterval(poll); const mem = Math.max(peak, memGB());
await ctx.close();

const m = { readyS, framesS, memGB: mem, frameMs }, base = B.baseline ?? {}, tol = B.tolerance ?? 0.05;
let fail = false; const rows = [];
for (const [k, v] of Object.entries(m)) {
  const b = base[k], worse = b != null && v > b * (1 + tol), t = B.target[k];
  if (worse) fail = true;
  rows.push(`${worse ? 'FAIL' : 'ok  '} ${k.padEnd(8)} ${String(v).padStart(7)}   baseline ${b ?? '-'}   target ${t}${v > t ? ` (gap ${+(v - t).toFixed(1)})` : ' (met)'}`);
}
console.log(`budget ${tree} (${q}):\n${rows.join('\n')}`);
if (!fail && accept) {
  const nb = Object.fromEntries(Object.keys(m).map(k => [k, base[k] == null ? m[k] : Math.min(base[k], m[k])])); // only ever tightens
  B.baseline = nb; B.history = [...(B.history ?? []), { at: new Date().toISOString(), ...m }].slice(-50);
  writeFileSync(BF, JSON.stringify(B, null, 1) + '\n'); console.log('baseline updated');
}
stop(); process.exit(fail ? 1 : 0);
