// D-306: the carved pieces (capitals, the Gate's colossi) before/after the Blender bake, in the game's renderer and materials
// without the world (tools/blender/probe/carving_probe.ts): a load of about a minute. Serve the tree (npx vite --port
// $E2E_PORT), then: node tools/blender/probe/carving_probe.mjs <outDir> [view,view]   (writes <view>-{before,after}.png)
// Views at the player's lens (70 deg, 1600x900, eye 1.6 m above the floor the player stands on) unless named calib-*.
import { chromium } from 'playwright';
import { mkdirSync, writeFileSync } from 'node:fs';
const OUT = process.argv[2] ?? 'shots/carving', ONLY = process.argv[3]?.split(',');
mkdirSync(OUT, { recursive: true });
const SUN = [0.55, 0.62, 0.55]; // late morning, from the south-east (world +x east, +z south)
export const VIEWS = [
  { n: 'gate-w-bull-head', eye: [-14.3, 1.6, -125.0], at: [-16.8, 4.6, -122.6], fov: 70 },
  { n: 'gate-w-bull-34', eye: [-9.0, 1.6, -125.3], at: [-16.5, 4.8, -122.3], fov: 70 },
  { n: 'gate-e-lamassu-34', eye: [9.0, 1.6, -125.3], at: [16.5, 4.8, -122.3], fov: 70 },
  { n: 'calib-capital-34', eye: [-60 + 4.5, 1.6, 150 + 5.0], at: [-60 + 1.2, 1.7, 150], fov: 50 },
  { n: 'calib-capital-head', eye: [-60 + 2.4, 2.4, 150 + 3.4], at: [-60 + 2.0, 2.3, 150], fov: 50 },
  { n: 'calib-volute', eye: [-67 + 0.6, 1.6, 150 + 3.2], at: [-67, 1.3, 150], fov: 50 },
  { n: 'gate-w-bull-flank', eye: [-11.2, 1.6, -125.6], at: [-14.8, 3.4, -122.4], fov: 70 },
  { n: 'gate-e-lamassu-front', eye: [30, 1.6, -124.6], at: [16, 4.6, -124.6], fov: 70 },
  { n: 'gate-e-lamassu-passage', eye: [13.8, 1.6, -125.0], at: [16.6, 4.6, -122.4], fov: 70 },
  { n: 'gate-composite-capital', eye: [-1.2, 1.6, -123.8], at: [-3.99, 14.2, -120.47], fov: 70 },
  { n: 'harem-bull-capital', eye: [106.3, 2.6, 145.6], at: [110.25, 6.2, 149.25], fov: 70 },
  { n: 'tachara-bull-capital', eye: [-23.2, 4.2, 73.2], at: [-26.4, 9.5, 76.85], fov: 70 },
  { n: 'apadana-composite-capital', eye: [-24.5, 4.6, 21.8], at: [-19.7, 18.5, 26.5], fov: 70 },
  // D-328: the columns' bases, shafts and capital bells (?b=gate_nations,apadana,tachara,harem,hadish,treasury,hall100,garrison)
  { n: 'apadana-bell-base', eye: [-17.5, 4.6, -37.7], at: [-19.7, 3.7, -39.31], fov: 70 },
  { n: 'apadana-square-base', eye: [-17.1, 4.6, 28.3], at: [-19.7, 3.7, 26.5], fov: 70 },
  { n: 'apadana-shaft-up', eye: [-17.9, 4.6, -38.1], at: [-19.7, 11, -39.31], fov: 70 },
  { n: 'gate-bell-base', eye: [-1.8, 1.6, -119.1], at: [-3.99, 0.6, -120.47], fov: 70 },
  { n: 'tachara-base', eye: [-24.6, 4.2, 78.05], at: [-26.4, 2.9, 76.85], fov: 70 },
  { n: 'hadish-plain-base', eye: [13.85, 7.6, 170.25], at: [12.25, 6.4, 169.25], fov: 70 },
  { n: 'hall100-base', eye: [120.6, 2.1, 58.6], at: [118.38, 1.0, 57.03], fov: 70 },
  { n: 'treasury-shafts', eye: [165.4, 1.9, 143.25], at: [163.43, 2.6, 141.75], fov: 70 },
  { n: 'garrison-posts', eye: [196.6, 1.8, 55.6], at: [195.08, 1.6, 54.25], fov: 70 },
];
const b = await chromium.launch({ channel: process.env.PW_CHANNEL ?? 'chrome', headless: true, args: ['--enable-unsafe-webgpu', '--ignore-gpu-blocklist'] });
const p = await b.newPage({ viewport: { width: 1600, height: 900 } }); const logs = [];
p.on('console', m => { if (m.type() === 'error' || m.type() === 'warning') logs.push(m.type() + ' ' + m.text().slice(0, 300)); }); p.on('pageerror', e => logs.push('pageerror ' + e));
const t0 = Date.now();
await p.goto('http://localhost:' + (process.env.E2E_PORT ?? '5331') + '/tools/blender/probe/carving_probe.html' + (process.env.Q ?? ''));
await p.waitForFunction(() => window.__ready, null, { timeout: 1800000 });
const ready = await p.evaluate(() => window.__ready); console.log('ready', JSON.stringify(ready).slice(0, 600), (Date.now() - t0) / 1000, 's');
const rec = { ready, adapter: await p.evaluate(async () => { const a = await navigator.gpu.requestAdapter(); return a?.info ? { vendor: a.info.vendor, arch: a.info.architecture, desc: a.info.description } : null; }), views: [] };
for (const v of VIEWS) { if (ONLY && !ONLY.includes(v.n)) continue;
  for (const [tag, models] of [['before', false], ['after', true]]) {
    const r = await p.evaluate(a => window.__shot(a), { ...v, sun: SUN, models });
    await p.screenshot({ timeout: 600000, path: `${OUT}/${v.n}-${tag}.png` });
    rec.views.push({ n: v.n, tag, ...r }); console.log(v.n, tag, r.errs.length ? r.errs : '', JSON.stringify(r.info), (Date.now() - t0) / 1000);
  } }
rec.stats = await p.evaluate(() => window.__models_stats()); rec.logs = logs.slice(0, 30);
writeFileSync(`${OUT}/probe.json`, JSON.stringify(rec, null, 1));
console.log(JSON.stringify(rec.stats)); console.log(logs.slice(0, 12).join('\n')); await b.close();
