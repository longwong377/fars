// D-320: the relief figures before/after the carved-relief atlas, in the game's renderer and materials without the world
// (tools/blender/probe/relief_probe.ts). Serve the tree (npx vite --port $E2E_PORT), then, through a GPU slot:
//   node tools/dev/gpu_slot.mjs reliefs -- node tools/blender/probe/relief_probe.mjs <outDir> [view,view]
// writes <view>-{legacy,atlas}.png and probe.json. Views at the player's lens (70 deg, 1600x900, eye 1.6 m above the floor)
// at arm's length, conversation distance and across a court; a raking morning sun on the E façade.
import { chromium } from 'playwright';
import { mkdirSync, writeFileSync } from 'node:fs';
const OUT = process.argv[2] ?? 'shots/reliefs', ONLY = process.argv[3]?.split(',');
mkdirSync(OUT, { recursive: true });
const SUN_E = [0.85, 0.42, 0.3], SUN_N = [0.3, 0.55, -0.78]; // morning sun raking the E façade; a late-afternoon one on the N (world +x east, -z north)
// [name, façade, along (m), off (m), eye y, target y, target along offset, fov, sun]
const FACADE = [
  ['E-left-guards-1m', 'E', -30, 1.0, 1.6, 1.0, 0.6, 70, SUN_E],
  ['E-left-guards-3m', 'E', -30, 3.0, 1.6, 1.2, 0, 70, SUN_E],
  ['E-right-deleg-1m', 'E', 28, 1.0, 1.6, 1.0, -0.6, 70, SUN_E],
  ['E-right-deleg-6m', 'E', 26, 6.0, 1.6, 1.6, 0, 70, SUN_E],
  ['E-audience-3m', 'E', 0, 3.0, 1.6, 1.5, 0, 70, SUN_E],
  ['E-audience-king-1m', 'E', 0, 1.2, 1.6, 1.2, 0.4, 70, SUN_E],
  ['E-flight-lionbull-4m', 'E', -12, 4.0, 1.6, 1.2, 0, 70, SUN_E],
  ['E-oblique-15m', 'E', -40, 15.0, 1.6, 1.5, 25, 70, SUN_E],
  ['N-right-10m', 'N', 20, 10.0, 1.6, 1.5, 0, 70, SUN_N],
];
const b = await chromium.launch({ channel: process.env.PW_CHANNEL ?? 'chrome', headless: true, args: ['--enable-unsafe-webgpu', '--ignore-gpu-blocklist'] });
const p = await b.newPage({ viewport: { width: 1600, height: 900 } }); const logs = [];
p.on('console', m => { if (m.type() === 'error' || m.type() === 'warning') logs.push(m.type() + ' ' + m.text().slice(0, 300)); }); p.on('pageerror', e => logs.push('pageerror ' + e));
const t0 = Date.now();
await p.goto('http://localhost:' + (process.env.E2E_PORT ?? '5320') + '/tools/blender/probe/relief_probe.html' + (process.env.Q ?? ''));
await p.waitForFunction(() => window.__ready, null, { timeout: 1800000 });
const ready = await p.evaluate(() => window.__ready); console.log('ready', JSON.stringify(ready).slice(0, 600), (Date.now() - t0) / 1000, 's');
if (typeof ready === 'string') { console.log(logs.join('\n')); await b.close(); process.exit(1); }
const views = [];
for (const [n, f, a, off, y, ty, da, fov, sun] of FACADE) views.push({ n, fov, sun, ...(await p.evaluate(q => window.__facadeView(...q), [f, a, off, y, ty, da])) });
// the jambs: from the far side of the doorway, 1.2 m off the reveal carrying the figures (Hall of 100 Columns N1, Tachara, Harem)
const J = await p.evaluate(() => window.__jambs);
for (const id of ['hall100:N1', 'tachara:S', 'harem:S1']) { const d = J.find(q => q.id.startsWith(id.split(':')[0]) && q.id.includes(id.split(':')[1] ?? '')) ?? null; if (!d) continue;
  const s = 1, w = d.width / 2, eye = [d.c[0] - d.u[0] * s * (w - 1.2) , d.y0 + 1.6, -(d.c[1] - d.u[1] * s * (w - 1.2))], at = [d.c[0] + d.u[0] * s * w - d.n[0] * 0.3, d.y0 + 1.5, -(d.c[1] + d.u[1] * s * w - d.n[1] * 0.3)];
  views.push({ n: `jamb-${d.id.replace(/[^a-z0-9]/gi, '_')}`, eye, at, fov: 70, sun: [0.2, 0.9, 0.35] }); }
// views on named figures: [name, kind, n, off, fy, dy, da, fov, sun]
const ITEMS = [
  ['guard-0.8m', 'guard', 3, 0.8, 0.75, 0.1, 0, 60, SUN_E], ['guard-head-0.4m', 'guard', 3, 0.4, 0.82, 0.0, 0.02, 50, SUN_E], ['guard-2.5m', 'guard', 3, 2.5, 0.6, 0.6, 0.3, 70, SUN_E], ['guards-6m', 'guard', 3, 6, 0.6, 0.9, 1.5, 70, SUN_E],
  ['delegate-1.2m', 'delegate', 20, 1.2, 0.6, 0.3, 0, 70, SUN_E], ['king-2m', 'king', 0, 2, 0.55, 0.2, 0, 70, SUN_E], ['lionbull-3m', 'lion_bull', 0, 3, 0.5, 0.3, 0, 70, SUN_E],
  ['elamite-2m', 'elamite', 2, 2.2, 0.55, 0.2, 0, 70, [0.35, 0.75, 0.55]], ['elamite-0.7m', 'elamite', 1, 0.7, 0.8, 0.0, 0, 60, [0.35, 0.75, 0.55]],
  ['kingatt-jamb-1.5m', 'king_attendants', 0, 1.5, 0.55, -0.4, 0, 70, [0.2, 0.9, 0.35]], ['bearer-2m', 'bearer', 0, 2, 0.6, 0, 0, 70, [0.2, 0.9, 0.35]],
];
for (const [n, kind, k, off, fy, dy, da, fov, sun] of ITEMS) { const v = await p.evaluate(q => window.__itemView(...q), [kind, k, off, fy, dy, da]); if (v) views.push({ n, fov, sun, eye: v.eye, at: v.at }); }
const rec = { ready, views: [] };
for (const v of views) { if (ONLY && !ONLY.includes(v.n)) continue;
  for (const [tag, atlas, dbg] of (process.env.DBG ? [['legacy', false, ''], ['atlas', true, ''], ...process.env.DBG.split(',').map(d => ['dbg-' + d, true, d])] : [['legacy', false, ''], ['atlas', true, '']])) {
    await p.evaluate(d => window.__debug(d), dbg);
    const r = await p.evaluate(a => window.__shot(a), { ...v, atlas });
    await p.screenshot({ timeout: 600000, path: `${OUT}/${v.n}-${tag}.png` });
    rec.views.push({ n: v.n, tag, ...r }); console.log(v.n, tag, r.errs.length ? r.errs : '', JSON.stringify({ tris: r.reliefTris, byLod: r.byLod, far: r.far }), (Date.now() - t0) / 1000);
  } }
rec.logs = logs.slice(0, 40);
writeFileSync(`${OUT}/probe.json`, JSON.stringify(rec, null, 1));
console.log(logs.slice(0, 12).join('\n')); await b.close();
