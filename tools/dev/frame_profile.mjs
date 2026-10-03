// s18 C9 (D-740): where a frame goes, on a built site in the cloud (headless Chromium, SwiftShader WebGPU: the CPU side is
// real, the GPU times are not). Loads ?quality=high at one day and hour, waits for every pipeline (progressive compile),
// then at each view runs __parsa.profile(n) (main.ts: CPU per section, each pass's draws and triangles by class) and
// writes the rows.   node tools/dev/frame_profile.mjs <dist> <out.json> [--n 20] [--day 6 --hour 9.5]
import { chromium } from '@playwright/test';
import { spawn } from 'node:child_process';
import { writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
const a = process.argv.slice(2), opt = (k, d) => { const i = a.indexOf(k); return i >= 0 ? a[i + 1] : d; };
const dist = resolve(a[0] ?? 'dist'), out = a[1] ?? 'frame_profile.json', n = +opt('--n', 20), day = opt('--day', '6'), hour = opt('--hour', '9.5'), q = opt('--q', 'high'), only = opt('--views', ''), port = 4184;
const VIEWS = [{ id: 'spawn', e: -175, n: 122.45, eye: 1.6, az: 79, pitch: 2 }, { id: 'stair', e: -43.9, n: 128, eye: 1.6, az: 341, pitch: 12 },
  { id: 'town-lane', e: -269.5, n: 723.5, eye: 1.6, az: 254, pitch: 1.9, cast: 1.2 }, { id: 'town-lane2', e: -294.5, n: 719.5, eye: 1.6, az: 206.6, pitch: -3.7, cast: 1.2 }];
const srv = spawn(process.execPath, [join(new URL('.', import.meta.url).pathname, '../deploy/serve.mjs'), dist, String(port), '/fars/'], { stdio: 'ignore' });
process.on('exit', () => { try { srv.kill(); } catch {} });
await new Promise(r => setTimeout(r, 1500));
const b = await chromium.launch({ headless: true, args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--enable-unsafe-webgpu', '--enable-features=Vulkan', '--use-vulkan=swiftshader', '--use-webgpu-adapter=swiftshader'] });
const p = await b.newPage({ viewport: { width: 1280, height: 720 } }), t0 = Date.now(), s = () => ((Date.now() - t0) / 1000).toFixed(0);
p.on('console', m => { if (m.type() === 'error') console.log('[page]', m.text().slice(0, 200)); });
await p.goto(`http://127.0.0.2:${port}/fars/?quality=${q}&seed=1&day=${day}&hour=${hour}&weather=clear`);
await p.waitForFunction(() => window.__parsa?.ready === true || window.__parsa?.error, null, { timeout: 3_600_000, polling: 1000 });
console.log('ready', s());
const R = { dist, day, hour, views: {} };
for (const v of VIEWS.filter(v => !only || only.split(',').includes(v.id))) {
  await p.evaluate(v => { window.__parsa.view(v.e, v.n, v.eye, v.az, v.pitch, undefined, { cast: v.cast ?? null }); }, v);
  // every pipeline this view needs compiled (40 min at most)
  const t1 = Date.now(); while (Date.now() - t1 < 2_400_000) { await p.evaluate(() => window.__parsa.step(2)); const c = await p.evaluate(() => window.__parsa.compiling?.() ?? null); if (!c || (c.live === 0 && !c.deferred)) break; await p.waitForTimeout(2000); }
  console.log(v.id, 'compiled', s());
  R.views[v.id] = await p.evaluate(k => window.__parsa.profile(k), n).catch(e => String(e).slice(0, 300));
  const r = R.views[v.id]; console.log(v.id, JSON.stringify({ cpuMs: r.cpuMs, pipelinedMs: r.pipelinedMs, draws: r.draws, tris: r.tris, sections: r.sections, passes: (r.passes ?? []).map(q => `${q.label}:${q.n}x ${q.draws}d ${q.cpu}ms`) }));
  writeFileSync(out, JSON.stringify(R, null, 1));
}
await b.close(); srv.kill(); process.exit(0);
