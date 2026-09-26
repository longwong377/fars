// dev (D-253): the renderless world's cost. Loads ?test&norender, stands the player in a place, and steps whole frames (the world,
// the people, the crowd buffers, the audio graph; nothing drawn) at ×1 and ×60, measuring the page's CPU (the renderer process,
// all threads) per world second: bot-hours per core-hour for gates/budget.json. Usage:
//   node tools/dev/renderless_probe.mjs <port> [east=-40] [north=122] [frames=900]   (serve with NOHMR=1 vite)
import { chromium } from '@playwright/test';
import { readFileSync, readdirSync } from 'node:fs';
const [port, east = '-40', north = '122', frames = '900'] = process.argv.slice(2);
const args = ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--enable-unsafe-webgpu', '--enable-features=Vulkan', '--use-vulkan=swiftshader', '--use-webgpu-adapter=swiftshader'];
const procs = (type) => readdirSync('/proc').filter(x => /^\d+$/.test(x)).filter(p => { try { return readFileSync(`/proc/${p}/cmdline`, 'utf8').includes(`--type=${type}`); } catch { return false; } });
const before = new Set([...procs('renderer'), ...procs('gpu-process')]);
const b = await chromium.launch({ headless: true, args });
const page = await b.newPage({ viewport: { width: 960, height: 540 } });
const cpuOf = (pids) => pids.reduce((a, p) => { try { const f = readFileSync(`/proc/${p}/stat`, 'utf8').split(') ')[1].split(' '); return a + (+f[11] + +f[12]) / 100; } catch { return a; } }, 0);
const mine = () => [...procs('renderer'), ...procs('gpu-process')].filter(p => !before.has(p));
const t0 = Date.now();
await page.goto(`http://localhost:${port}/?test&norender&quality=test&day=25&hour=10&weather=clear`);
await page.waitForFunction(() => window.__parsa?.ready === true || window.__parsa?.error, null, { timeout: 1_800_000, polling: 500 });
const ready = (Date.now() - t0) / 1000; const c0 = cpuOf(mine());
console.log(JSON.stringify({ ready_s: ready, norender: await page.evaluate(() => window.__parsa.norender), cpu_at_ready_s: +c0.toFixed(1) }));
await page.evaluate(([e, n]) => { const w = window.__parsa; w.renderer.setAnimationLoop(null); w.walkMode(); w.teleport(e, n); }, [+east, +north]);
const out = {};
for (const scale of [1, 60]) {
  const c1 = cpuOf(mine()), w1 = Date.now();
  const r = await page.evaluate(([n, s]) => window.__parsa.step(n, 1 / 30, s), [+frames, scale]);
  const cpu = cpuOf(mine()) - c1, wall = (Date.now() - w1) / 1000;
  out[`x${scale}`] = { frames: +frames, worldS: r.worldS, wallS: +wall.toFixed(1), cpuS: +cpu.toFixed(1), msPerFrame: +(r.ms / +frames).toFixed(1), worldSecondsPerCpuSecond: +(r.worldS / cpu).toFixed(2) };
}
console.log(JSON.stringify(out));
await b.close();
