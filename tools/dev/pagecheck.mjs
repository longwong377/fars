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
  qs1: { ...cov('cov-381'), id: 'qs1', day: 0, hour: 10, w: 'clear', why: 'a q_s1 lane on the road south at day 0, 10:00 (cov-381\'s spot)' },
  court: { ...cov('cov-037'), id: 'court', why: 'a town court, noon (cov-037)' },
  terrace: { ...cov('cov-252'), id: 'terrace', why: 'the Terrace, noon (cov-252)' },
  terrace_court: { ...cov('cov-252'), id: 'terrace_court', day: 40, hour: 10, w: 'clear', why: 'the Terrace at 10:00 with the court resident (day 40)' },
  apadana: { ...cov('cov-294'), id: 'apadana', why: 'the Apadana hall, morning (cov-294)' },
  plain: { ...cov('cov-406'), id: 'plain', why: 'the open plain, dusk (cov-406)' },
  approach_dawn: { ...cov('cov-196'), id: 'approach_dawn', why: 'the Terrace approach at dawn (cov-196; area approach, not fields)' },
  field_spring: { ...cov('cov-096'), id: 'field_spring', why: 'plain fields, day 58 08:24 (cov-096)' },
  field_autumn: { ...cov('cov-387'), id: 'field_autumn', why: 'plain fields, day 272 07:19 (cov-387)' },
  night: { ...cov('cov-448'), id: 'night', why: 'the town at night (cov-448)' },
  night_terrace: { ...cov('sb-night-terrace'), id: 'night_terrace', why: 'the Terrace at 22:30 (sb-night-terrace)' },
};
const pick = (arg('views', Object.keys(VIEWS).join(','))).split(',').map(k => { if (!VIEWS[k]) throw new Error('unknown view ' + k); return VIEWS[k]; });

// ---- the server: <tree>/dist at /fars/ (the deployed base), with the headers the site needs (COOP/COEP: SharedArrayBuffer).
// Not vite preview: the config's base is /fars/ only for `build`, so preview serves the built html at / and its /fars/ assets 404.
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.wasm': 'application/wasm',
  '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.webp': 'image/webp', '.ktx2': 'image/ktx2', '.glb': 'model/gltf-binary',
  '.bin': 'application/octet-stream', '.woff2': 'font/woff2', '.ogg': 'audio/ogg', '.opus': 'audio/ogg', '.mp3': 'audio/mpeg', '.wav': 'audio/wav', '.webm': 'video/webm', '.mp4': 'video/mp4', '.txt': 'text/plain' };
const up = async () => { try { const r = await fetch(`http://localhost:${PORT}/fars/`); return r.ok; } catch { return false; } };
let server = null;
if (!(await up())) {
  const DIST = `${TREE}/dist`; if (!existsSync(`${DIST}/index.html`)) throw new Error(`no ${DIST}: build it first (cd ${TREE} && npx vite build)`);
  const { createServer } = await import('node:http'); const { createReadStream, statSync } = await import('node:fs'); const { extname, join, normalize } = await import('node:path');
  server = createServer((req, res) => {
    let u = decodeURIComponent(new URL(req.url, 'http://x').pathname); if (!u.startsWith('/fars/')) { res.writeHead(404); return res.end(); }
    let f = normalize(join(DIST, u.slice(6))); if (!f.startsWith(DIST)) { res.writeHead(403); return res.end(); }
    try { if (statSync(f).isDirectory()) f = join(f, 'index.html'); const st = statSync(f);
      res.writeHead(200, { 'Content-Type': MIME[extname(f).toLowerCase()] ?? 'application/octet-stream', 'Content-Length': st.size, 'Cross-Origin-Opener-Policy': 'same-origin', 'Cross-Origin-Embedder-Policy': 'require-corp', 'Cross-Origin-Resource-Policy': 'same-origin' });
      createReadStream(f).pipe(res);
    } catch { res.writeHead(404); res.end(); }
  }).listen(PORT);
  for (let i = 0; i < 20 && !(await up()); i++) await new Promise(r => setTimeout(r, 250));
  if (!(await up())) throw new Error('static server did not come up');
}
const head = (() => { try { return readFileSync(`${TREE}/.git`, 'utf8').trim(); } catch { return ''; } })();

// ---- the page
const args = ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'];
const browser = await chromium.launch({ headless: true, args });
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
const t0 = Date.now(), T = () => ((Date.now() - t0) / 1000).toFixed(0) + 's';
const errs = new Map(); page.on('console', m => { if (m.type() === 'error') { const k = m.text().slice(0, 160); errs.set(k, (errs.get(k) ?? 0) + 1); } });
page.on('pageerror', e => console.log(T(), 'PAGEERROR', String(e).slice(0, 300)));
page.on('crash', () => { console.log(T(), 'PAGE CRASHED'); process.exit(2); });
let closing = false; browser.on('disconnected', () => { if (closing) return; console.log(T(), 'BROWSER DISCONNECTED'); process.exit(2); });
page.on('console', m => { const t = m.text(); if (t.startsWith('[boot]') || process.env.VERBOSE) console.log(T(), t.slice(0, 160)); });
const f = pick[0];
console.log(T(), 'loading');
await page.goto(`http://localhost:${PORT}/fars/?test&trace&norender&webgl=1&quality=test&nointro&day=${f.day}&hour=${f.hour}&weather=${f.w}&court=seasonal`, { timeout: 600000, waitUntil: 'domcontentloaded' });
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
      if (!o.isInstancedMesh || !g?.boundingSphere) { r.instIn += n; r.tris += o.isBatchedMesh ? triPer : triPer * n; return; }
      const im = o.instanceMatrix.array, step = n > 200000 ? Math.ceil(n / 200000) : 1; let inF = 0, near = 0;
      for (let i = 0; i < n; i += step) { m.fromArray(im, i * 16).premultiply(o.matrixWorld); s.copy(g.boundingSphere).applyMatrix4(m);
        if (s.radius > 0 && fr.intersectsSphere(s)) { inF += step; if (s.center.distanceTo(camP) < 60) near += step; } }
      r.instIn += inF; r.near60 += near; r.tris += triPer * inF; return;
    }
    r.inst += 1; if (!v) return; r.instVis += 1;
    if (o.frustumCulled === false) { r.instIn += 1; r.tris += triPer; return; }
    if (g?.boundingSphere) { s.copy(g.boundingSphere).applyMatrix4(o.matrixWorld); if (fr.intersectsSphere(s)) { r.instIn += 1; r.tris += triPer; if (s.center.distanceTo(camP) < 60 + s.radius) r.near60 += 1; } }
  });
  // the town's roofs (C2's houses are merged meshes, roofs and walls together): within 150 m of the point the camera looks at
  // on the ground, the area of up-facing triangles standing 1.8 m or more above the mesh's local floor (roofs, parapet tops)
  // against the area of vertical triangles (walls). A roofless town reads ~0; a roofed one about 0.4-1.5 (C).
  const look = (() => { const d = new V3(0, 0, -1).applyQuaternion(cam.quaternion); const t = d.y < -0.05 ? Math.min(300, (camP.y - (camP.y - 20)) / -d.y) : 60; return camP.clone().addScaledVector(d, Math.min(t, 150)); })();
  let up = 0, vert = 0, tris = 0; const a = new V3(), b = new V3(), c = new V3(), e1 = new V3(), e2 = new V3(), nn = new V3();
  scene.traverse(o => { if (!o.isMesh || o.isInstancedMesh || !/^settlement:(near:(plaster|brick|stone|timber)|q_[a-z]#?.*:far|q_[a-z][0-9]+:far)/.test(o.name) || !effVis(o)) return;
    const g = o.geometry, P = g.attributes.position, I = g.index; if (!P) return; const n3 = I ? I.count : P.count; o.updateMatrixWorld();
    let ymin = Infinity; for (let i = 0; i < P.count; i += 7) { a.fromBufferAttribute(P, i).applyMatrix4(o.matrixWorld); if (Math.hypot(a.x - look.x, a.z - look.z) < 150 && a.y < ymin) ymin = a.y; }
    for (let i = 0; i < n3; i += 3) { const i0 = I ? I.getX(i) : i, i1 = I ? I.getX(i + 1) : i + 1, i2 = I ? I.getX(i + 2) : i + 2;
      a.fromBufferAttribute(P, i0).applyMatrix4(o.matrixWorld); if (Math.hypot(a.x - look.x, a.z - look.z) > 150) continue;
      b.fromBufferAttribute(P, i1).applyMatrix4(o.matrixWorld); c.fromBufferAttribute(P, i2).applyMatrix4(o.matrixWorld);
      e1.subVectors(b, a); e2.subVectors(c, a); nn.crossVectors(e1, e2); const ar = nn.length() / 2; if (!ar) continue; nn.normalize(); tris++;
      if (Math.abs(nn.y) < 0.3) vert += ar; else if (nn.y > 0.7 && (a.y + b.y + c.y) / 3 - ymin > 1.8) up += ar; } });
  const roofs = { upAreaAbove18: Math.round(up), wallArea: Math.round(vert), ratio: vert ? +(up / vert).toFixed(3) : null, tris, at: [+look.x.toFixed(0), +(-look.z).toFixed(0)] };
  // what the simulation in this page holds round the camera (the population view and the detailed agents)
  // what the simulation in this page holds round the camera: the population view's people out of doors and the detailed
  // agents, within 40/60/250 m; of those within 60 m, how many are in the camera frustum (a 1.3 m sphere at chest height,
  // the crowd's own test) and how many of those the crowd hides behind a court wall (crowd.walledOff: the eye below the wall top)
  const ce = camP.x, cn = -camP.z, CR = P?.crowd; const places = {};
  const S = { near40: 0, near60: 0, near250: 0, open60: 0, court60: 0, moving60: 0, inFr40: 0, inFr60: 0, inFrNotWalled60: 0, walledInFr60: 0 };
  const sp = new Sph(), cv = new V3();
  const one = (e, n, y, vp) => { const d = Math.hypot(e - ce, n - cn); if (d < 250) S.near250++; if (d >= 60) return; S.near60++; if (d < 40) S.near40++;
    if (vp) { if (vp.plot) S.court60++; else S.open60++; if (vp.moving) S.moving60++; const k = (vp.place || (vp.moving ? '(walking)' : '?')).split(/[:#]/)[0]; places[k] = (places[k] ?? 0) + 1; }
    sp.center.copy(cv.set(e, y + 0.9, -n)); sp.radius = 1.3; if (!fr.intersectsSphere(sp)) return; S.inFr60++; if (d < 40) S.inFr40++;
    let walled = false; try { walled = !!(vp && CR?.walledOff?.(vp, camP.y)); } catch { } if (walled) S.walledInFr60++; else S.inFrNotWalled60++; };
  for (const p of P?.view?.visible ?? []) one(p.e, p.n, p.y, p);
  for (const a of P?.sim?.agents ?? []) if (!a.offmap) one(a.pos[0], a.pos[1], a.y ?? camP.y, null);
  const simNear = S.near60, simNearAll = S.near250, openNear = S.open60, courtNear = S.court60, movingNear = S.moving60;
  const lights = []; scene.traverse(o => { if (o.isDirectionalLight && o.castShadow) lights.push({ name: o.name, far: o.shadow?.camera?.far, size: [o.shadow?.camera?.right - o.shadow?.camera?.left] }); });
  let crowd = null; try { crowd = api.humans(); } catch { }
  return { cam: [+ce.toFixed(1), +cn.toFixed(1), +camP.y.toFixed(1)], simNear60: simNear, simNear250: simNearAll, openNear60: openNear, courtNear60: courtNear, movingNear60: movingNear, places60: places, sim: S, backend: api.backend, norender: api.norender, catchingUp: P?.sim?.catchingUp ?? null, crowd, lights, roofs,
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
    // after a time jump the placement is whole only when the sim has caught up (sim.catchingUp false; a dt-0 tick finishes it)
    const cu = await page.evaluate(async () => { const a = window.__parsa; let k = 0; while (a.world.people?.sim?.catchingUp && k < 200) { await a.tick(); k++; } return { ticks: k, catchingUp: !!a.world.people?.sim?.catchingUp }; });
    await page.evaluate(() => window.__parsa.step(60, 1 / 30, 1)); // 2 s with the clock running: walkers are mid-walk (a frozen clock never reads 'moving')
    const r = await page.evaluate(readView); r.catchUp = cu;
    results.push({ view: v.id, why: v.why, day: v.day, hour: v.hour, ms: Date.now() - t1, ...r });
    console.log(T(), v.id, r.error ?? `sim<60m ${r.simNear60}, rows ${r.rows.length}`);
  } catch (e) { console.log(T(), v.id, 'FAILED', String(e).slice(0, 300)); results.push({ view: v.id, error: String(e).slice(0, 300) }); if (/closed|crash/i.test(String(e))) break; }
}
closing = true; await browser.close(); if (server) server.close();

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
  const cs = r.crowd ?? {}, drawn = (cs.people ?? 0) + (cs.impostors ?? 0);
  md.push(`page: backend ${r.backend}, norender ${r.norender}, catch-up ticks ${r.catchUp?.ticks} (still catching up: ${r.catchUp?.catchingUp}), crowd looks pending ${cs.impPerf?.looksPending ?? '?'}`, '');
  md.push(`people in the frustum: within 40 m ${r.sim.inFr40} of ${r.sim.near40}; within 60 m ${r.sim.inFr60} of ${r.sim.near60} (behind court walls for this eye: ${r.sim.walledInFr60}; to be drawn: ${r.sim.inFrNotWalled60})`, '');
  { const hp = r.rows.filter(x => /^(world|player-body) \/ (humans:|people:)/.test(x.k)); md.push('| people mesh | visible / hidden meshes | instances (count) | in frustum | < 60 m |', '|---|---|---|---|---|', ...hp.map(x => `| ${x.k} | ${x.vis} / ${x.hidden} | ${x.inst} | ${x.instIn} | ${x.near60} |`), ''); }
  md.push(`people: sim out of doors within 60 m ${r.simNear60} (open ground ${r.openNear60}, inside walled courts ${r.courtNear60}, walking ${r.movingNear60}; places ${JSON.stringify(r.places60)}; 250 m ${r.simNear250}); crowd attached ${cs.perf?.attached ?? '?'}, skinned drawn ${cs.people ?? '?'} by LOD ${JSON.stringify(cs.byLod ?? [])}, impostors drawn ${cs.impostors ?? '?'} of ${cs.impPerf?.candidates ?? '?'} candidates`, '');
  md.push(`town roofs (150 m round ${JSON.stringify(r.roofs?.at)}): up-facing area above 1.8 m ${r.roofs?.upAreaAbove18} m², wall area ${r.roofs?.wallArea} m², ratio ${r.roofs?.ratio} (${r.roofs?.tris} triangles)`, '');
  if (r.sim.inFrNotWalled60 >= 5 && (cs.people ?? 0) + (cs.impostors ?? 0) < r.sim.inFrNotWalled60 * 0.7) flags.push(`${r.view} [C5 people]: ${r.sim.inFrNotWalled60} people within 60 m are in the frustum and not behind a wall for this eye (${r.sim.inFr60} in the frustum, ${r.simNear60} round); the crowd draws ${cs.people} skinned (by LOD ${JSON.stringify(cs.byLod)}) + ${cs.impostors} impostors of ${cs.impPerf?.candidates} candidates, ${cs.perf?.attached} attached`);
  if (r.roofs?.wallArea > 2000 && r.roofs.ratio !== null && r.roofs.ratio < 0.15) flags.push(`${r.view} [C2 roofs]: within 150 m of ${JSON.stringify(r.roofs.at)} the houses show ${r.roofs.wallArea} m² of wall but ${r.roofs.upAreaAbove18} m² of up-facing surface above 1.8 m (ratio ${r.roofs.ratio}): roofless`);
  md.push('<details><summary>all classes (top 60 by triangles)</summary>', '', '| object key | vis / hidden | inst in frustum | < 60 m | tris | mats | tiers |', '|---|---|---|---|---|---|---|');
  for (const x of [...r.rows].sort((a, b) => b.tris - a.tris || b.hidden - a.hidden).slice(0, 60)) md.push(`| ${x.k} | ${x.vis} / ${x.hidden} | ${x.instIn} | ${x.near60} | ${x.tris} | ${x.mats.join(', ')} | ${x.tiers.join('')} |`);
  md.push('', '</details>', '');
}
md.splice(6, 0, '## Flags', '', ...(flags.length ? flags.map(s => '- ' + s) : ['- none']), '', `Page errors (unique): ${errs.size}`, ...[...errs].slice(0, 12).map(([k, n]) => `- ${n}x ${k}`), '');
// the json keeps the 80 heaviest rows per view (the full graph is ~2.5 MB a run; --full keeps every row)
const slim = process.argv.includes('--full') ? results : results.map(r => r.rows ? { ...r, rows: [...r.rows].sort((a, b) => b.tris - a.tris || b.hidden - a.hidden).slice(0, 80) } : r);
writeFileSync(OUT + '.json', JSON.stringify({ tree: TREE, head, results: slim }));
writeFileSync(OUT + '.md', md.join('\n') + '\n');
console.log(T(), 'wrote', OUT + '.md', '\nFLAGS:\n' + flags.join('\n'));
