// cloud eyes: one page load, every view of a SET file, full frames as PNG (same __parsa calls as tests/e2e/coverage.spec.ts)
import { chromium } from '/home/user/fars/node_modules/playwright/index.mjs';
import { readFileSync, mkdirSync, existsSync, appendFileSync } from 'node:fs';
const [setFile, outDir] = process.argv.slice(2); mkdirSync(outDir, { recursive: true });
const S = JSON.parse(readFileSync(setFile, 'utf8'));
const PROBES = process.env.PROBES ? JSON.parse(readFileSync(process.env.PROBES, 'utf8')) : {}; // {viewId: [js expression, ...]} evaluated after the view is set
const P = JSON.parse(readFileSync('/home/user/fars/tests/data/coverage_points.json', 'utf8')).points;
const work = [...P.filter(p => (S.ids ?? []).includes(p.id)), ...(S.extra ?? [])].filter(v => !existsSync(`${outDir}/${v.id}.png`));
work.sort((a, b) => a.day - b.day || a.hour - b.hour || String(a.w).localeCompare(String(b.w)));
console.log('views', work.length); if (!work.length) process.exit(0);
const args = ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--enable-unsafe-webgpu', '--enable-features=Vulkan', '--use-vulkan=swiftshader', '--use-webgpu-adapter=swiftshader'];
const b = await chromium.launch({ headless: true, args });
const p = await b.newPage({ viewport: { width: +(process.env.VW ?? 1280), height: +(process.env.VH ?? 720) } });
// the dev page posts each world-cache unit it computed back to vite; a 140 MB+ body in CDP's network event kills playwright's pipe
await p.addInitScript(() => { const f0 = window.fetch.bind(window); window.fetch = (u, o) => (String(u).includes('/__world-cache/put') && (o?.body?.byteLength ?? o?.body?.size ?? o?.body?.length ?? 0) > 100e6 ? Promise.resolve(new Response(null, { status: 200 })) : f0(u, o)); });
const t0 = Date.now(); const T = () => ((Date.now() - t0) / 1000).toFixed(0) + 's'; const errs = new Map();
p.on('console', m => { const t = m.text(); if (t.startsWith('[boot]')) console.log(T(), t.slice(0, 150)); else if (m.type() === 'error') { const k = t.slice(0, 160); errs.set(k, (errs.get(k) ?? 0) + 1); } });
p.on('pageerror', e => console.log(T(), 'PAGEERROR', String(e).slice(0, 300)));
const Q = process.env.Q ?? 'test', f = work[0];
await p.goto(`http://localhost:${process.env.PORT ?? 5191}/?test&trace&quality=${Q}&day=${f.day}&hour=${f.hour}&weather=${f.w}&court=seasonal${process.env.WEBGL ? "&webgl=1" : ""}`, { timeout: 600000, waitUntil: 'domcontentloaded' });
await p.waitForFunction(() => window.__parsa?.ready === true || window.__parsa?.error, null, { timeout: 2400000, polling: 5000 });
await p.evaluate(() => window.__parsa?.renderer?.setAnimationLoop(null));
const err = await p.evaluate(() => window.__parsa.error); if (err) throw new Error(err);
console.log(T(), 'ready');
let key = `${f.day}|${f.hour}|${f.w}`;
for (const v of work) {
  const t1 = Date.now();
  try {
    const k = `${v.day}|${v.hour}|${v.w}`;
    if (k !== key) { await p.evaluate(([d, h, w]) => { const a = window.__parsa; a.setTime(d, h); a.setWeather(w); }, [v.day, v.hour, v.w]); key = k; }
    const a = [v.e, v.n, v.eye, v.az, v.pitch, undefined, { cast: v.cast ?? null, rigClear: 0 }];
    await p.evaluate(a => window.__parsa.view(...a), a); await p.evaluate(() => window.__parsa.tick()); await p.evaluate(a => window.__parsa.view(...a), a);
    for (let i = 0; i < +(process.env.FRAMES ?? 3); i++) await p.evaluate(() => window.__parsa.renderOnce());
    for (const js of PROBES[v.id] ?? []) { const r = await p.evaluate(js).catch(e => 'ERR ' + String(e).slice(0, 300)); appendFileSync(`${outDir}/probes.txt`, `## ${v.id}\n${js.slice(0, 200)}\n=> ${typeof r === 'string' ? r : JSON.stringify(r)}\n\n`); }
    await p.screenshot({ path: `${outDir}/${v.id}.png`, timeout: 1800000 });
    const st = await p.evaluate(() => { const s = window.__parsa.stats(); return { dc: s.drawCalls, tri: s.triangles, be: s.backend }; }).catch(() => ({}));
    const line = `${v.id} ${((Date.now() - t1) / 1000).toFixed(0)}s ${JSON.stringify(st)}`; console.log(T(), line); appendFileSync(`${outDir}/log.txt`, line + '\n');
  } catch (e) { console.log(T(), v.id, 'FAILED', String(e).slice(0, 300)); if (/closed|destroyed|crash/i.test(String(e))) break; }
}
console.log('page errors (unique):'); for (const [k, n] of errs) console.log(n, k);
appendFileSync(`${outDir}/log.txt`, 'errors: ' + JSON.stringify([...errs].slice(0, 30)) + '\n');
await b.close();
