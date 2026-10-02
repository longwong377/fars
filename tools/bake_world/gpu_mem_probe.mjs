// s15/load (D-354): the GPU process's memory per GPU byte on this machine: 256 MB of 2048² RGBA8 textures (one level, then
// with mips), 256 MB of buffers, BC7, each step sampled (working set and private bytes of the GPU process).
//   node tools/dev/gpu_slot.mjs load -- node tools/bake_world/gpu_mem_probe.mjs <port>
import { chromium } from '@playwright/test';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { execSync } from 'node:child_process';
const [port = '5182'] = process.argv.slice(2);
const prof = mkdtempSync(join(tmpdir(), 'parsa-gmem-')), tag = prof.split(/[\\/]/).pop();
const ctx = await chromium.launchPersistentContext(prof, { channel: 'chrome', headless: true, args: ['--enable-unsafe-webgpu', '--ignore-gpu-blocklist'] });
const page = ctx.pages()[0] ?? await ctx.newPage();
const gpuProc = () => { const ps = `$all = Get-CimInstance Win32_Process -Filter "Name='chrome.exe'"; $b = @($all | Where-Object { $_.CommandLine -like '*${tag}*' -and $_.CommandLine -notmatch '--type=' } | ForEach-Object { $_.ProcessId }); foreach ($x in ($all | Where-Object { $b -contains $_.ParentProcessId -and $_.CommandLine -match '--type=gpu-process' })) { $g = Get-Process -Id $x.ProcessId; '{0} {1}' -f [int]($g.WorkingSet64/1MB), [int]($g.PrivateMemorySize64/1MB) }`;
  const [ws, priv] = execSync('powershell -NoProfile -Command -', { input: ps, encoding: 'utf8' }).trim().split(/\s+/).map(Number); return { ws, priv }; };
await page.goto(`http://localhost:${port}/tools/bake_world/gpu_mem.html`);
await page.waitForFunction(() => window.__ready, null, { timeout: 120000 });
const rows = [], s0 = gpuProc(); rows.push(['start', 0, s0]);
let prev = s0;
for (const [kind, n, mb] of [['tex', 16, 256], ['texmip', 12, 256], ['buf', 16, 256], ['bc7', 16, 64], ['texnowrite', 16, 256]]) {
  await page.evaluate(([k, c]) => window.__step(k, c), [kind, n]); await page.waitForTimeout(1500);
  const s = gpuProc(); rows.push([kind, mb, s, { dWs: s.ws - prev.ws, dPriv: s.priv - prev.priv, privPerMB: +((s.priv - prev.priv) / mb).toFixed(2) }]); prev = s;
}
console.log(JSON.stringify(rows));
await ctx.close();
