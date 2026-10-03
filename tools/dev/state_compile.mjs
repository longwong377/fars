// s17 V7 (D-473): how many GPU pipelines a change of world state (day, hour, weather) creates, and which materials make them.
// Loads the full world (?test&quality=high&shaderlog) in the installed Chrome on the GPU, warms one view, then steps through
// world states at that same view (each: setTime/setWeather, warm-up rounds until no frame asks for a new pipeline) and
// writes per state: seconds, GPU modules/pipelines created, and the new pipelines grouped by object|material|why.
//   node tools/dev/gpu_slot.mjs v7 -- node tools/dev/state_compile.mjs <port> [label]
import { chromium } from '@playwright/test';
import { writeFileSync, mkdirSync } from 'node:fs';
const [port = '5192', label = 'run'] = process.argv.slice(2);
const STATES = (process.env.STATES ?? '0,12,clear;0,21,clear;0,12,clear;0,12,rain;180,12,clear;90,17,overcast;0,21,rain;!old;0,21,clear;0,12,clear;0,21,clear').split(';').map(s => { if (s[0] === '!') return { mode: s.slice(1) }; const [d, h, w] = s.split(','); return { d: +d, h: +h, w }; });
const browser = await chromium.launch({ channel: 'chrome', headless: true, args: ['--enable-unsafe-webgpu', '--ignore-gpu-blocklist'] });
const page = await browser.newPage({ viewport: { width: 1920, height: 1080 } });
const logs = []; page.on('console', m => { if (m.type() === 'error') logs.push(m.text().slice(0, 200)); });
const t0 = Date.now(), el = () => +((Date.now() - t0) / 1000).toFixed(1);
const out = { label, states: [] };
const save = () => { mkdirSync('../load-out', { recursive: true }); writeFileSync(`../load-out/state_compile_${label}.json`, JSON.stringify(out, null, 1)); };
await page.goto(`http://localhost:${port}/?test&trace&shaderlog&quality=${process.env.Q ?? 'high'}&day=0&hour=${process.env.HOUR ?? 5.4}&weather=clear`);
await page.waitForFunction(() => window.__parsa?.ready === true || window.__parsa?.error, null, { timeout: 3_600_000, polling: 1000 });
out.readyS = el(); console.log('ready', out.readyS);
const V = (process.env.VIEW ?? '-36.4,140.5,1.6,196,-8').split(',').map(Number);
await page.evaluate((v) => { window.__parsa.renderer.setAnimationLoop(null); window.__parsa.view(...v); }, V);
const step = async (name) => {
  const c0 = await page.evaluate(() => ({ ...window.__gpuCount, n: window.__shaderLog.length }));
  const tk = Date.now(); await page.evaluate(() => window.__parsa.tick()); const tickS = (Date.now() - tk) / 1000;
  const t = Date.now(); const warm = await page.evaluate(() => window.__parsa.warmUp());
  for (let i = 0; i < 2; i++) await page.evaluate(() => window.__parsa.renderOnce());
  const s = (Date.now() - t) / 1000;
  const r = await page.evaluate((c0) => { const c = window.__gpuCount, L = window.__shaderLog.slice(c0.n), g = {};
    for (const e of L) { const k = `${e.obj}|${e.mat}|${e.shadow === true ? 'shadow' : ''}${e.pass}|${e.re ?? 'new'}${e.lights ? '|L' : ''}`; g[k] = (g[k] ?? 0) + 1; }
    return { modules: c.modules - c0.modules, pipes: c.pipes - c0.pipes, asyncPipes: c.asyncPipes - c0.asyncPipes, compute: c.compute - c0.compute, logged: L.length,
      rebuilt: L.filter(e => e.re).length, lightsChanged: L.filter(e => e.lights).length, sampleLights: L.find(e => e.lights)?.lights,
      top: Object.entries(g).sort((a, b) => b[1] - a[1]).slice(0, 60) }; }, c0);
  const row = { name, tickS, s, warm, ...r }; out.states.push(row); save();
  console.log(name, 'tick', tickS, 'warm', s, 's', JSON.stringify({ modules: r.modules, pipes: r.pipes + r.asyncPipes, compute: r.compute, rebuilt: r.rebuilt, lightsChanged: r.lightsChanged }));
};
await step(`initial 0,${process.env.HOUR ?? 5.4},clear`);
for (const st of STATES) {
  if (st.mode) { await page.evaluate((m) => { window.__parsaSunKept.on = m !== 'old'; }, st.mode); out.states.push({ name: 'mode ' + st.mode }); continue; }
  await page.evaluate(({ d, h, w }) => { const p = window.__parsa; p.setTime(d, h); p.setWeather(w); }, st);
  await step(`${st.d},${st.h},${st.w}${STATES.indexOf(st) > STATES.findIndex(x => x.mode === 'old') && STATES.some(x => x.mode === 'old') ? ' (old sun)' : ''}`);
}
out.logs = logs.slice(0, 40); out.totalS = el(); save();
await browser.close();
