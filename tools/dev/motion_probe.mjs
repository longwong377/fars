// D-362: the motion probe (tools/dev/motion_probe.ts). Serve the tree (npx vite --port $E2E_PORT), then, through the GPU slot:
//   node tools/dev/gpu_slot.mjs animalmotion -- node tools/dev/motion_probe.mjs <outdir>
import { chromium } from 'playwright';
import { mkdirSync } from 'node:fs';
const OUT = process.argv[2] ?? 'shots/motion'; mkdirSync(OUT, { recursive: true });
const b = await chromium.launch({ channel: 'chrome', headless: true, args: ['--enable-unsafe-webgpu', '--ignore-gpu-blocklist'] });
const p = await b.newPage({ viewport: { width: 1280, height: 720 } }); const logs = [];
p.on('console', m => { if (m.type() === 'error' || m.type() === 'warning') logs.push(m.type() + ' ' + m.text().slice(0, 300)); }); p.on('pageerror', e => logs.push('pageerror ' + e));
const t0 = Date.now(), port = process.env.E2E_PORT ?? '5192';
await p.goto(`http://localhost:${port}/tools/dev/motion_probe.html?bird=${process.env.BIRD ?? 'crow'}`);
await p.waitForFunction(() => window.__ready, null, { timeout: 900000 });
console.log('ready', await p.evaluate(() => window.__ready), (Date.now() - t0) / 1000, 's');
const shot = async (name, fn, v) => { const res = await p.evaluate(([fn, v]) => window[fn](v), [fn, v]); await p.screenshot({ path: `${OUT}/${name}.png` }); console.log(name, JSON.stringify(res).slice(0, 300)); };
// walking: the same animals at moments of the stride, close: belly, ears, tail and load; and without the secondary motion
const row = ['donkey_pack', 'ox', 'horse', 'camel_pack'];
for (const [i, t] of [0, 0.35, 0.7].entries()) await shot(`walk-${i}`, '__anim', { sp: row, t: 3 + t, walk: 1, az: 200, el: 12, dist: 9, target: [3.6, 0.9, 0] });
for (const [i, t] of [0, 0.35].entries()) await shot(`walk-nosec-${i}`, '__anim', { sp: row, t: 3 + t, walk: 1, az: 200, el: 12, dist: 9, target: [3.6, 0.9, 0], sec: false });
const row2 = ['sheep', 'goat', 'dog', 'cow'];
for (const [i, t] of [0, 0.35].entries()) await shot(`walk2-${i}`, '__anim', { sp: row2, t: 5 + t, walk: 1, az: 160, el: 15, dist: 5, target: [2.4, 0.5, 0] });
for (const [i, t] of [0, 3, 6.3].entries()) await shot(`stand-${i}`, '__anim', { sp: row, t: 20 + t, walk: 0, az: 200, el: 12, dist: 9, target: [3.6, 0.9, 0] });
// the bird: standing, the morph, flying with the wings up and down (lit)
for (const [n, v] of [['k1', { k: 1, t: 0 }], ['k05', { k: 0.5, t: 0.02 }], ['fly-a', { k: 0, t: 0.07 }], ['fly-b', { k: 0, t: 0.2 }]]) await shot(`bird-${n}`, '__bird', { ...v, az: 30, el: 20, dist: 2.2 });
for (const sec of [false, true, false, true]) console.log('bench', sec, JSON.stringify(await p.evaluate(s => window.__bench(200, 60, s), sec)));
console.log(logs.slice(0, 12).join('\n')); await b.close();
