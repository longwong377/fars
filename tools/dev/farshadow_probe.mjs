// s17 V11 (D-473 addendum): the far sun cascade in the light lab (src/render/probes/light_lab.ts: the town, terrain, sky and
// pipeline at `high`, no Terrace). Serve the tree (npx vite --port <port>), then
//   node tools/dev/gpu_slot.mjs v11 -- node tools/dev/farshadow_probe.mjs <tag> [?query]
// Per view: a frame with the far cascade blended in and one with it off (window.__parsaFarShadow.mix = 0), and the frame
// cost (ms a frame over 30 frames, each frame waiting on the meter read-back) on / off / with a forced far redraw.
import { chromium } from 'playwright';
import { mkdirSync } from 'node:fs';
const TAG = process.argv[2] ?? 'a', Q = process.argv[3] ?? '', OUT = process.env.OUT ?? '.scratch/farshadow';
mkdirSync(OUT, { recursive: true });
// [x, z, eye above ground, true bearing (grid az + 341), pitch]
const V = [
  { n: 'rahmat-1700', cam: [380, 60, 1.6, 228 + 341, -4], fov: 60, day: 14, hour: 17.0 },
  { n: 'rahmat-1880', cam: [380, 60, 1.6, 228 + 341, -4], fov: 60, day: 14, hour: 18.8 },
  { n: 'terrace-town-0900', cam: [100, 0, 18, 245 + 341, -4], fov: 50, day: 14, hour: 9.0 },
  { n: 'plain-town-1600', cam: [-175, -122.45, 1.6, 225 + 341, 0], fov: 50, day: 14, hour: 16.0 },
];
const b = await chromium.launch({ channel: 'chrome', headless: true, args: ['--enable-unsafe-webgpu', '--ignore-gpu-blocklist'] });
const p = await b.newPage({ viewport: { width: 1280, height: 720 } }); const logs = [];
p.on('console', m => { if (m.type() === 'error' || m.type() === 'warning') logs.push(m.type() + ' ' + m.text().slice(0, 300)); }); p.on('pageerror', e => logs.push('pageerror ' + e));
// the sampler check: the most samplers any fragment shader module declares (the T4 allows 16 a stage)
await p.addInitScript(() => { const D = GPUDevice.prototype, o = D.createShaderModule; window.__smp = { max: 0, far: 0, n: 0 };
  D.createShaderModule = function (d) { const c = String(d?.code ?? ''), k = (c.match(/:[ ]*sampler(_comparison)?[ ]*;/g) ?? []).length; window.__smp.n++; if (k > window.__smp.max) window.__smp.max = k; if (c.includes('textureLoad') && c.includes('texture_depth_2d') && k > 0) window.__smp.far = Math.max(window.__smp.far, k); return o.call(this, d); }; });
const t0 = Date.now();
await p.goto('http://127.0.0.1:' + (process.env.PORT ?? '5197') + '/src/render/probes/light_lab.html' + Q);
await p.waitForFunction(() => window.__ready, null, { timeout: 1500000 });
console.log('ready', await p.evaluate(() => window.__ready), (Date.now() - t0) / 1000, 's');
const hasFar = await p.evaluate(() => !!window.__sky?.sun?.shadow?.shadowNode?.farNode);
console.log('far cascade', hasFar);
for (const v of V) {
  for (const mix of hasFar ? [1, 0] : [1]) {
    await p.evaluate(m => { if (window.__parsaFarShadow) window.__parsaFarShadow.mix.value = m; }, mix);
    const res = await p.evaluate(v => window.__shot(v), v);
    await p.screenshot({ timeout: 600000, path: `${OUT}/${v.n}-${TAG}${mix ? '' : '-off'}.png` });
    const ms = await p.evaluate(async v => { const t = performance.now(); await window.__shot({ ...v, frames: 30 }); return (performance.now() - t) / 30; }, v);
    console.log(v.n, 'mix', mix, 'ms/frame', ms.toFixed(2), 'alt', res.sunAlt?.toFixed(1), 'errs', res.errs?.length, res.errs?.[0] ?? '');
  }
  if (hasFar) {
    await p.evaluate(() => { window.__parsaFarShadow.mix.value = 1; });
    const r = await p.evaluate(async v => { const n = window.__sky.sun.shadow.shadowNode, out = [];
      for (let k = 0; k < 5; k++) { let t = performance.now(); await window.__shot({ ...v, frames: 1 }); const base = performance.now() - t;
        n.farLast = null; t = performance.now(); await window.__shot({ ...v, frames: 1 }); out.push([base, performance.now() - t]); }
      return { out, texel: n.farTexel }; }, v);
    console.log(v.n, 'redraw (base ms, forced-redraw ms)', JSON.stringify(r.out.map(a => a.map(x => +x.toFixed(1)))), 'texel', r.texel?.toFixed(2));
  }
}
console.log('samplers', JSON.stringify(await p.evaluate(() => window.__smp)));
console.log(logs.slice(0, 12).join('\n')); await b.close();
