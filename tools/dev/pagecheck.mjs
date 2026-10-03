// s18 C12 (D-772): THE IN-PAGE TRUTH CHECK. What does the page actually have visible in the camera's frustum, class by
// class, at a list of views, compared with what the simulation in the same page holds? Built because twice in s18 a fix
// passed its node census while the page drew something else (C2's roofs; the people: the sim held 120-270 within 60 m while
// only humans:*:lod3 was visible). No pixels: the BUILT site is loaded headless with ?norender, the world is stepped (the
// same frame loop minus the draw), and the scene graph is read: per object the effective visibility (every ancestor
// visible), per mesh or instance whether its bounding sphere meets the camera frustum, and the triangles that would be drawn.
// LOD objects are updated against the camera first (three does this in render(), which ?norender skips).
//
// Run (cloud or Vagon):
//   (cd <tree> && npx vite build)            # the built site, as deployed (base /fars/)
//   node tools/dev/pagecheck.mjs --tree ../fars-pc [--views town20,lanes,court,terrace,apadana,plain,night] [--port 4173]
//        [--out handoff/s18/pagecheck] [--keep-server]
// Writes <out>.json (every class row per view) and <out>.md (the summary and the flags). Out of world, English.
import { chromium } from 'playwright';
import { spawn } from 'node:child_process';
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';

const arg = (k, d) => { const i = process.argv.indexOf('--' + k); return i > 0 ? process.argv[i + 1] : d; };
const TREE = resolve(arg('tree', '.')), PORT = +arg('port', 4173), OUT = arg('out', 'handoff/s18/pagecheck');
const COV = JSON.parse(readFileSync(resolve('tests/data/coverage_points.json'), 'utf8')).points;
const SB = JSON.parse(readFileSync(resolve('tests/data/scoreboard_s17.json'), 'utf8')).extra ?? [];
const cov = id => { const p = COV.find(x => x.id === id) ?? SB.find(x => x.id === id); if (!p) throw new Error('no view ' + id); return p; };
// the views the lead named (town from 20 m, lanes, a court, the Terrace, the Apadana, the plain, night), from the coverage set
const VIEWS = {
  town20: { ...cov('cov-142'), id: 'town20', eye: 20, pitch: -22, why: 'the town from 20 m up (roofs vs walls)' },
  lanes: { ...cov('cov-142'), id: 'lanes', why: 'a town lane, afternoon (cov-142)' },
  court: { ...cov('cov-037'), id: 'court', why: 'a town court, noon (cov-037)' },
  terrace: { ...cov('cov-252'), id: 'terrace', why: 'the Terrace, noon (cov-252)' },
  terrace_court: { ...cov('cov-252'), id: 'terrace_court', day: 40, hour: 10, w: 'clear', why: 'the Terrace at 10:00 with the court resident (day 40)' },
  apadana: { ...cov('cov-294'), id: 'apadana', why: 'the Apadana hall, morning (cov-294)' },
  plain: { ...cov('cov-406'), id: 'plain', why: 'the open plain, dusk (cov-406)' },
  fields: { ...cov('cov-196'), id: 'fields', why: 'the approach fields, dawn (cov-196)' },
  night: { ...cov('cov-448'), id: 'night', why: 'the town at night (cov-448)' },
  night_terrace: { ...cov('sb-night-terrace'), id: 'night_terrace', why: 'the Terrace at 22:30 (sb-night-terrace)' },
};
const pick = (arg('views', Object.keys(VIEWS).join(','))).split(',').map(k => { if (!VIEWS[k]) throw new Error('unknown view ' + k); return VIEWS[k]; });

// ---- the server: vite preview of <tree>/dist (base /fars/)
const up = async () => { try { const r = await fetch(`http://localhost:${PORT}/fars/`); return r.ok; } catch { return false; } };
let server = null;
if (!(await up())) {
  if (!existsSync(`${TREE}/dist/index.html`)) throw new Error(`no ${TREE}/dist: build it first (cd ${TREE} && npx vite build)`);
  server = spawn('npx', ['vite', 'preview', '--port', String(PORT), '--strictPort'], { cwd: TREE, stdio: 'ignore', detached: false });
  for (let i = 0; i < 60 && !(await up()); i++) await new Promise(r => setTimeout(r, 1000));
  if (!(await up())) throw new Error('vite preview did not come up');
}
const head = (() => { try { return readFileSync(`${TREE}/.git`, 'utf8').trim(); } catch { return ''; } })();

// ---- the page
const args = ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'];
const browser = await chromium.launch({ headless: true, args });
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
const t0 = Date.now(), T = () => ((Date.now() - t0) / 1000).toFixed(0) + 's';
const errs = new Map(); page.on('console', m => { if (m.type() === 'error') { const k = m.text().slice(0, 160); errs.set(k, (errs.get(k) ?? 0) + 1); } });
page.on('pageerror', e => console.log(T(), 'PAGEERROR', String(e).slice(0, 300)));
const f = pick[0];
await page.goto(`http://localhost:${PORT}/fars/?test&norender&webgl=1&quality=test&nointro&day=${f.day}&hour=${f.hour}&weather=${f.w}&court=seasonal`, { timeout: 600000, waitUntil: 'domcontentloaded' });
await page.waitForFunction(() => window.__parsa?.ready === true || window.__parsa?.error, null, { timeout: 2400000, polling: 2000 });
const err = await page.evaluate(() => window.__parsa.error); if (err) throw new Error(err);
console.log(T(), 'ready');

// ---- one view: place, step, read the scene graph
const readView = () => {
  const api = window.__parsa, scene = api.scene, W = api.world, P = W.people;
  const cam = P?.crowd?.lastCamera; if (!cam) return { error: 'no camera (no people module?)' };
  cam.updateMatrixWorld();
  const M4 = cam.matrixWorld.constructor, V3 = cam.position.constructor;
  const Fr = P.crowd.frustum.constructor, Sph = (() => { let S = null; scene.traverse(o => { if (!S && o.geometry?.boundingSphere) S = o.geometry.boundingSphere.constructor; }); return S; })();
  const fr = new Fr(), pm = new M4().multiplyMatrices(cam.projectionMatrix, cam.matrixWorldInverse); fr.setFromProjectionMatrix(pm);
  scene.traverse(o => { if (o.isLOD && o.autoUpdate !== false) o.update(cam); }); // what render() would do
  const effVis = o => { for (let q = o; q; q = q.parent) if (!q.visible) return false; return true; };
  const keyOf = o => { const names = []; for (let q = o; q && q !== scene; q = q.parent) if (q.name) names.push(q.name); names.reverse();
    const top = names[0] ?? '(unnamed)', own = (o.name || names[names.length - 1] || o.type).replace(/[0-9]+/g, '#'); return names.length > 1 ? `${top.replace(/[0-9]+/g, '#')} / ${own}` : own; };
  const rows = new Map(), s = new Sph(), m = new M4(), camP = cam.position;
  const row = k => { let r = rows.get(k); if (!r) rows.set(k, r = { k, meshes: 0, vis: 0, hidden: 0, inst: 0, instVis: 0, instIn: 0, tris: 0, near60: 0, mats: new Set(), tiers: new Set(), placeholder: 0 }); return r; };
  scene.traverse(o => {
    if (!(o.isMesh || o.isPoints || o.isSprite || o.isLine)) return;
    const r = row(keyOf(o)); r.meshes++; const v = effVis(o); if (v) r.vis++; else r.hidden++;
    const g = o.geometry; const triPer = g ? ((g.index ? g.index.count : (g.attributes.position?.count ?? 0)) / 3) * (g.drawRange && g.drawRange.count !== Infinity ? Math.min(1, g.drawRange.count / (g.index ? g.index.count : g.attributes.position.count)) : 1) : 0;
    const mat = Array.isArray(o.material) ? o.material[0] : o.material; if (mat) { r.mats.add(mat.name || mat.type); if (mat.userData?.tier) r.tiers.add(mat.userData.tier); }
    if (o.userData?.placeholder || mat?.userData?.placeholder) r.placeholder++;
    if (g && !g.boundingSphere) { try { g.computeBoundingSphere(); } catch { } }
    if (o.isInstancedMesh || o.isBatchedMesh) {
      const n = o.isInstancedMesh ? o.count : (o._instanceInfo?.length ?? o.instanceCount ?? 0); r.inst += n; if (!v) return; r.instVis += n;
      if (!o.isInstancedMesh || !g?.boundingSphere) { r.instIn += n; r.tris += triPer * n; return; }
      const im = o.instanceMatrix.array, step = n > 200000 ? Math.ceil(n / 200000) : 1; let inF = 0, near = 0;
      for (let i = 0; i < n; i += step) { m.fromArray(im, i * 16).premultiply(o.matrixWorld); s.copy(g.boundingSphere).applyMatrix4(m);
        if (s.radius > 0 && fr.intersectsSphere(s)) { inF += step; if (s.center.distanceTo(camP) < 60) near += step; } }
      r.instIn += inF; r.near60 += near; r.tris += triPer * inF; return;
    }
    r.inst += 1; if (!v) return; r.instVis += 1;
    if (o.frustumCulled === false) { r.instIn += 1; r.tris += triPer; return; }
    if (g?.boundingSphere) { s.copy(g.boundingSphere).applyMatrix4(o.matrixWorld); if (fr.intersectsSphere(s)) { r.instIn += 1; r.tris += triPer; if (s.center.distanceTo(camP) < 60 + s.radius) r.near60 += 1; } }
  });
  // what the simulation in this page holds round the camera (the population view and the detailed agents)
  const ce = camP.x, cn = -camP.z; let simNear = 0, simNearAll = 0;
  for (const p of P?.view?.visible ?? []) { const d = Math.hypot(p.e - ce, p.n - cn); if (d < 60) simNear++; if (d < 250) simNearAll++; }
  for (const a of P?.sim?.agents ?? []) if (!a.offmap) { const d = Math.hypot(a.pos[0] - ce, a.pos[1] - cn); if (d < 60) simNear++; if (d < 250) simNearAll++; }
  const lights = []; scene.traverse(o => { if (o.isDirectionalLight && o.castShadow) lights.push({ name: o.name, far: o.shadow?.camera?.far, size: [o.shadow?.camera?.right - o.shadow?.camera?.left] }); });
  let crowd = null; try { crowd = api.humans(); } catch { }
  return { cam: [+ce.toFixed(1), +cn.toFixed(1), +camP.y.toFixed(1)], simNear60: simNear, simNear250: simNearAll, crowd, lights,
    rows: [...rows.values()].map(r => ({ ...r, mats: [...r.mats].slice(0, 4), tiers: [...r.tiers], tris: Math.round(r.tris) })) };
};

const results = [];
let key = `${f.day}|${f.hour}|${f.w}`;
for (const v of pick) {
  const t1 = Date.now();
  try {
    const k = `${v.day}|${v.hour}|${v.w}`;
    if (k !== key) { await page.evaluate(([d, h, w]) => { const a = window.__parsa; a.setTime(d, h); a.setWeather(w); }, [v.day, v.hour, v.w]); key = k; }
    const a = [v.e, v.n, v.eye, v.az, v.pitch, undefined, { cast: v.cast ?? null, rigClear: 0 }];
    await page.evaluate(a => window.__parsa.view(...a), a);
    await page.evaluate(() => window.__parsa.step(20, 1 / 30, 0)); // 20 frames at a frozen clock: plans, crowd LODs, fill streaming settle
    await page.evaluate(a => window.__parsa.view(...a), a);
    await page.evaluate(() => window.__parsa.step(10, 1 / 30, 0));
    const r = await page.evaluate(readView);
    results.push({ view: v.id, why: v.why, day: v.day, hour: v.hour, ms: Date.now() - t1, ...r });
    console.log(T(), v.id, r.error ?? `sim<60m ${r.simNear60}, rows ${r.rows.length}`);
  } catch (e) { console.log(T(), v.id, 'FAILED', String(e).slice(0, 300)); results.push({ view: v.id, error: String(e).slice(0, 300) }); if (/closed|crash/i.test(String(e))) break; }
}
await browser.close(); if (server && !process.argv.includes('--keep-server')) server.kill();

// ---- classes and flags
const CLASSES = [
  ['people (skinned, any LOD)', /humans?[^/]*lod[0-2]|humans:(?!.*lod3)/i], ['people LOD3 (far)', /lod3/i], ['people impostors', /impostor/i],
  ['house roofs', /roof/i], ['house walls', /wall(?!wear)/i], ['ground fill / props', /fill|litter|prop|scatter|decor/i],
  ['trees', /tree|orchard/i], ['crops / flora', /crop|wheat|barley|flora|grass|sward|reed/i], ['fires / lamps', /fire|flame|lamp|torch|brazier|ember|coal/i],
  ['water', /water|river|canal|pool|channel/i], ['animals', /animal|beast|flock|sheep|goat|donkey|horse|camel|bird/i],
  ['terrace architecture', /terrace|apadana|gate|palace|column|relief|monument/i],
];
const sum = (res, re) => res.rows.filter(r => re.test(r.k)).reduce((a, r) => ({ vis: a.vis + r.vis, hidden: a.hidden + r.hidden, instIn: a.instIn + r.instIn, near60: a.near60 + r.near60, tris: a.tris + r.tris }), { vis: 0, hidden: 0, instIn: 0, near60: 0, tris: 0 });
const md = [`# Page check (D-772): what the page draws vs what its simulation holds`, '',
  `Tree ${TREE} ${head}; built site (vite build, base /fars/), headless Chromium, ?test&norender&webgl=1&quality=test&court=seasonal; ${new Date().toISOString()}.`,
  'Per view: objects effectively visible (every ancestor visible) and meeting the camera frustum, their instances and triangles;',
  'hidden = present in the scene but visible=false somewhere up the chain. sim<60 m = population view + detailed agents within 60 m of the camera.', ''];
const flags = [];
for (const r of results) {
  md.push(`## ${r.view}: ${r.why ?? ''} (day ${r.day}, ${r.hour} h)`, '');
  if (r.error) { md.push('ERROR: ' + r.error, ''); continue; }
  md.push(`camera ${r.cam.join(', ')}; sim people within 60 m: ${r.simNear60}, within 250 m: ${r.simNear250}; crowd stats: ${JSON.stringify(r.crowd ?? {}).slice(0, 300)}`, '');
  md.push('| class | meshes visible / hidden | instances in frustum | of them < 60 m | triangles in frustum |', '|---|---|---|---|---|');
  for (const [name, re] of CLASSES) { const s = sum(r, re); md.push(`| ${name} | ${s.vis} / ${s.hidden} | ${s.instIn} | ${s.near60} | ${s.tris} |`); }
  md.push('', `shadow-casting lights: ${JSON.stringify(r.lights)}`, '');
  const people = sum(r, CLASSES[0][1]).near60 + sum(r, CLASSES[1][1]).near60 + sum(r, CLASSES[2][1]).near60;
  if (r.simNear60 >= 10 && people < r.simNear60 * 0.3) flags.push(`${r.view}: the sim holds ${r.simNear60} people within 60 m; the page has ${people} person instances visible within 60 m in the frustum (skinned ${sum(r, CLASSES[0][1]).near60}, lod3 ${sum(r, CLASSES[1][1]).near60}, impostors ${sum(r, CLASSES[2][1]).near60}; hidden people meshes ${sum(r, CLASSES[0][1]).hidden + sum(r, CLASSES[1][1]).hidden + sum(r, CLASSES[2][1]).hidden})`);
  const roofs = sum(r, CLASSES[3][1]), walls = sum(r, CLASSES[4][1]);
  if (walls.instIn > 20 && roofs.instIn < walls.instIn * 0.1) flags.push(`${r.view}: ${walls.instIn} wall instances in the frustum but ${roofs.instIn} roof instances (roof meshes visible ${roofs.vis}, hidden ${roofs.hidden})`);
  md.push('<details><summary>all classes (top 60 by triangles)</summary>', '', '| object key | vis / hidden | inst in frustum | < 60 m | tris | mats | tiers |', '|---|---|---|---|---|---|---|');
  for (const x of [...r.rows].sort((a, b) => b.tris - a.tris || b.hidden - a.hidden).slice(0, 60)) md.push(`| ${x.k} | ${x.vis} / ${x.hidden} | ${x.instIn} | ${x.near60} | ${x.tris} | ${x.mats.join(', ')} | ${x.tiers.join('')} |`);
  md.push('', '</details>', '');
}
md.splice(6, 0, '## Flags', '', ...(flags.length ? flags.map(s => '- ' + s) : ['- none']), '', `Page errors (unique): ${errs.size}`, ...[...errs].slice(0, 12).map(([k, n]) => `- ${n}x ${k}`), '');
writeFileSync(OUT + '.json', JSON.stringify({ tree: TREE, head, results }, null, 1));
writeFileSync(OUT + '.md', md.join('\n') + '\n');
console.log(T(), 'wrote', OUT + '.md', '\nFLAGS:\n' + flags.join('\n'));
