// s17 V3 (D-500): the people at the player's lens (fov 60, 1920x1080) at 2, 10 and 30 m under daylight, in one humanlab
// load. Serve the tree (npx vite --port $PORT), then:
//   PW_CHANNEL=chrome node tools/dev/gpu_slot.mjs people -- node tools/dev/people_probe.mjs <outdir> [shot,...]
import { chromium } from 'playwright';
import { mkdirSync, writeFileSync } from 'node:fs';
const OUT = process.argv[2] ?? 'shots/v3/base'; mkdirSync(OUT, { recursive: true });
const ONLY = process.argv[3]?.split(',') ?? null;
const port = process.env.PORT ?? '5186', Q = process.env.Q ?? 'high', HOUR = process.env.HOUR ?? '10';
const b = await chromium.launch({ channel: 'chrome', headless: true, args: ['--enable-unsafe-webgpu', '--ignore-gpu-blocklist', '--enable-features=Vulkan'] });
const p = await b.newPage({ viewport: { width: 1920, height: 1080 } }); const logs = [];
p.on('console', m => { if (m.type() === 'error' || m.type() === 'warning') logs.push(m.type() + ' ' + m.text().slice(0, 300)); }); p.on('pageerror', e => logs.push('pageerror ' + e));
const t0 = Date.now();
await p.goto(`http://localhost:${port}/humanlab.html?test&quality=${Q}&hour=${HOUR}&day=110&fov=60${process.env.EXTRA ?? ''}`);
await p.waitForFunction(() => window.__lab?.ready === true || window.__lab?.error, null, { timeout: 900000 });
const err = await p.evaluate(() => window.__lab.error); if (err) { console.log('ERR', err); process.exit(1); }
console.log('ready', (Date.now() - t0) / 1000, 's');
const stats = {};
const shot = async (name, setup) => { if (ONLY && !ONLY.includes(name)) return; await p.evaluate(setup.fn, setup.arg);
  await p.evaluate(() => window.__lab.render(+(window.__frames ?? 48))); stats[name] = await p.evaluate(() => window.__lab.stats()); await p.screenshot({ path: `${OUT}/${name}.png`, timeout: 600000 }); console.log(name, (Date.now() - t0) / 1000); };
const MIX = [
  { dress: 'worker', sex: 'm', role: 'porter', seed: 24, origin: 'Persian' }, { dress: 'woman', sex: 'f', role: 'grinder', seed: 21, origin: 'Persian' },
  { dress: 'persian', sex: 'm', role: 'official', seed: 36, origin: 'Persian', age: 'elder' }, { dress: 'median', sex: 'm', role: 'guard', seed: 13 },
  { dress: 'child', sex: 'f', role: 'child', seed: 54 }, { dress: 'woman', sex: 'f', role: 'baker', seed: 22, age: 'elder' }, { dress: 'worker', sex: 'm', role: 'mason', seed: 51, age: 'elder' }];
// 2 m: three people in conversation range (faces, skin, cloth)
await shot('d02-front', { fn: m => { const L = window.__lab; L.lineup(m.slice(0, 3), 0.9, true); L.at(4); L.view(0.1, 1.62, 2.0, 0, 1.45, 0); }, arg: MIX });
await shot('d02-face', { fn: m => { const L = window.__lab; L.lineup(m.slice(0, 3), 0.9, true); L.frameFace(1, 0.9, 0.15); }, arg: MIX });
await shot('d02-walk', { fn: m => { const L = window.__lab; L.lineup(m.slice(0, 3).map(s => ({ ...s, anim: 'walk' })), 0.9, false); L.at(2.31); L.view(2.0, 1.62, 1.2, 0, 1.0, 0); }, arg: MIX });
await shot('d02-side', { fn: m => { const L = window.__lab; L.lineup(m.slice(0, 3), 0.9, false); L.at(4); L.view(2.4, 1.5, 0.15, 0, 1.1, 0); }, arg: MIX });
await shot('d02-sit', { fn: m => { const L = window.__lab; L.lineup([{ ...m[0], anim: 'sit' }, { ...m[1], anim: 'talk' }, { ...m[6], anim: 'carry_shoulder' }], 0.9, false); L.at(5); L.view(0.6, 1.5, 2.3, 0, 0.9, 0); }, arg: MIX });
await shot('d1-beard', { fn: m => { const L = window.__lab; L.lineup(m.slice(0, 3), 0.9, true); L.at(4); L.frameFace(2, 0.8, 0.1); }, arg: MIX });
await shot('d1-worker', { fn: m => { const L = window.__lab; L.lineup(m.slice(0, 3), 0.9, true); L.at(4); L.frameFace(0, 0.7, -0.1); }, arg: MIX });
await shot('d05-face', { fn: m => { const L = window.__lab; L.lineup(m.slice(0, 3), 0.9, true); L.at(4); L.frameFace(0, 0.5, 0.12); }, arg: MIX });
await shot('d05-woman', { fn: m => { const L = window.__lab; L.lineup(m.slice(0, 3), 0.9, true); L.at(4); L.frameFace(1, 0.5, -0.1); }, arg: MIX });
await shot('asks', { fn: () => { const L = window.__lab; L.stations([{ act: 'walk', why: 'driving a flock along the road', dress: 'worker', sex: 'm', role: 'herder', x: -4, z: -2, yaw: 0.3 },
  { act: 'walk', why: 'ox cart of building stone', dress: 'worker', sex: 'm', role: 'porter', x: 4, z: 3, yaw: 0.4 }, { act: 'walk', why: 'holding the stone cart', dress: 'worker', sex: 'm', role: 'porter', x: 9, z: -4, yaw: -0.6 }]); L.at(6); L.view(-2, 3.2, 16, 2, 0.8, 0); }, arg: null });
await shot('marks', { fn: m => { const L = window.__lab; L.lineup([{ ...m[1], seed: 31 }, m[6], { ...m[3], seed: 77 }], 0.9, true); L.marks(0, 1); L.marks(1, 1, 1); L.marks(2, 3); L.at(4); L.frameFace(1, 0.7, 0.1); }, arg: MIX });
// 10 m: a group, mixed activities
await shot('d10', { fn: m => { const L = window.__lab; const A = ['walk', 'idle', 'talk', 'carry_shoulder', 'idle', 'walk', 'talk'];
  L.lineup(m.map((s, i) => ({ ...s, anim: A[i] })), 1.3, false); L.at(7.7); L.view(1.5, 1.62, 10, 0, 1.0, 0); }, arg: MIX });
// 30 m: a crowd of 60 between 22 and 38 m, walking and standing
await shot('d30', { fn: () => { const L = window.__lab, cr = L.crowd; cr.removeExtras(); const D = ['guard', 'median', 'persian', 'worker', 'woman', 'child', 'worker', 'woman'], A = ['walk', 'idle', 'talk', 'walk', 'carry_shoulder', 'walk'];
  for (let i = 0; i < 60; i++) { const d = D[i % 8], r = 22 + 16 * ((i * 0.37) % 1), a = (((i * 0.618) % 1) - 0.5) * 0.9;
    cr.addExtra(`s${i}`, { id: -100 - i, sex: d === 'woman' ? 'f' : 'm', role: d === 'guard' ? 'guard' : d === 'child' ? 'child' : 'mason', dress: d, seed: 7000 + i * 13, x: r * Math.sin(a), y: 0, z: 36 - r * Math.cos(a), yaw: i * 2.1, anim: A[i % 6], look: null }); }
  L.at(11.2); L.view(0, 1.62, 36, 0, 1.2, 6); }, arg: null });
writeFileSync(`${OUT}/stats.json`, JSON.stringify(stats, null, 1));
console.log(logs.slice(0, 15).join('\n')); await b.close();
