// D-331 dev probe (not shipped): the far people side by side in the human lab (humanlab.html?imp=1): the skinned lineup (one
// person a dress, the crowd's own LOD for the distance) in the middle, the same people as Cycles-rendered impostors to its
// right and as the CPU bake's to its left, at the player's lens (60 deg) from the hand-over distances. Serve the tree
// (npx vite --port $E2E_PORT), then (through tools/dev/gpu_slot.mjs):
//   node tools/dev/imp_probe.mjs <tag> [quality=high]    -> $OUT (default shots)/imp-<view>-<tag>.png, and 4x crops
import { chromium } from 'playwright';
import { mkdirSync } from 'node:fs';
const TAG = process.argv[2] ?? 'a', Q = process.argv[3] ?? 'high', OUT = process.env.OUT ?? 'shots'; mkdirSync(OUT, { recursive: true });
const W = 1920, H = 1080;
const b = await chromium.launch({ channel: 'chrome', headless: true, args: ['--enable-unsafe-webgpu', '--ignore-gpu-blocklist'] });
const p = await b.newPage({ viewport: { width: W, height: H } }); const logs = [];
p.on('console', m => { if (m.type() === 'error' || m.type() === 'warning') logs.push(m.type() + ' ' + m.text().slice(0, 300)); }); p.on('pageerror', e => logs.push('pageerror ' + e));
const t0 = Date.now();
await p.goto(`http://localhost:${process.env.E2E_PORT ?? '5343'}/humanlab.html?test&imp=1&quality=${Q}&hour=10&day=120&fov=60`);
await p.waitForFunction(() => window.__lab?.ready === true || window.__lab?.error, null, { timeout: 2_400_000 });
const err = await p.evaluate(() => window.__lab.error ?? null); if (err) { console.log('error', err); process.exit(1); }
console.log('ready', (Date.now() - t0) / 1000, 's');
const PEOPLE = [{ dress: 'persian', sex: 'm', role: 'official', seed: 11 }, { dress: 'guard', sex: 'm', role: 'guard', seed: 12 }, { dress: 'median', sex: 'm', role: 'guard', seed: 13 },
  { dress: 'worker', sex: 'm', role: 'labourer', seed: 15 }, { dress: 'woman', sex: 'f', role: 'grinder', seed: 14 }, { dress: 'child', sex: 'm', role: 'child', seed: 16, age: 8 }];
const SP = 1.2, DX = 8.5;
const VIEWS = [{ n: 'd30', d: 30, anim: 'idle' }, { n: 'd30walk', d: 30, anim: 'walk' }, { n: 'd60', d: 60, anim: 'idle' }, { n: 'd120', d: 120, anim: 'idle' }, { n: 'd30side', d: 30, anim: 'idle', side: true }];
for (const v of VIEWS) {
  await p.evaluate(([s, sp, anim]) => window.__lab.lineup(s.map(x => ({ ...x, anim })), sp, false), [PEOPLE, SP, v.anim]);
  const ra = await p.evaluate(([dx, anim]) => [window.__lab.impRow('cycles', dx, 0, anim, 0.3), window.__lab.impRow('cpu', -dx, 0, anim, 0.3)], [DX, v.anim]);
  if (v.side) await p.evaluate(d => window.__lab.view(d, 1.6, 0.01, 0, 1.0, 0), v.d); else await p.evaluate(d => window.__lab.view(0, 1.6, d, 0, 1.0, 0), v.d);
  await p.evaluate(() => window.__lab.render(12));
  const path = `${OUT}/imp-${v.n}-${TAG}.png`; await p.screenshot({ path });
  // the rows' screen boxes: a 4x crop round the three rows
  const box = await p.evaluate(([dx, sp]) => { const c = window.__lab.camera, V = c.constructor; const pr = (x, y, z) => { const q = new c.position.constructor(x, y, z).project(c); return [(q.x + 1) / 2 * innerWidth, (1 - q.y) / 2 * innerHeight]; };
    const a = pr(-dx - 4 * sp, 2.1, 0), bb = pr(dx + 4 * sp, -0.1, 0); return [a[0], a[1], bb[0], bb[1]]; }, [DX, SP]);
  console.log(v.n, JSON.stringify(ra), JSON.stringify(await p.evaluate(() => window.__lab.stats().crowd.perf?.drawn ?? null)), box.map(x => Math.round(x)), (Date.now() - t0) / 1000);
  if (!v.side) { const x0 = Math.max(0, Math.floor(box[0])), y0 = Math.max(0, Math.floor(box[1])), w = Math.min(W - x0, Math.ceil(box[2] - box[0])), h = Math.min(H - y0, Math.ceil(box[3] - box[1]));
    await p.screenshot({ path: `${OUT}/imp-${v.n}-${TAG}-crop.png`, clip: { x: x0, y: y0, width: w, height: h } }); }
}
console.log(logs.slice(0, 12).join('\n')); await b.close();
