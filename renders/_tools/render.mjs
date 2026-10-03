// cloud eyes: one page load, every view of a SET file, full frames as PNG (same __parsa calls as tests/e2e/coverage.spec.ts)
import { chromium } from '/home/user/fars/node_modules/playwright/index.mjs';
import { createRequire } from 'node:module'; const sharp = createRequire('/home/user/fars/package.json')('sharp');
import { readFileSync, mkdirSync, existsSync, appendFileSync } from 'node:fs';
const [setFile, outDir] = process.argv.slice(2); mkdirSync(outDir, { recursive: true });
const S = JSON.parse(readFileSync(setFile, 'utf8')); const P = JSON.parse(readFileSync('/home/user/fars/tests/data/coverage_points.json', 'utf8')).points;
const work = [...P.filter(p => (S.ids ?? []).includes(p.id)), ...(S.extra ?? [])].filter(v => !existsSync(`${outDir}/${v.id}.png`));
work.sort((a, b) => (a.prio ?? 9) - (b.prio ?? 9) || a.day - b.day || a.hour - b.hour || String(a.w).localeCompare(String(b.w)));
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
    const a = [v.e, v.n, v.eye, v.az, v.pitch, v.fov, { cast: v.cast ?? null, rigClear: 0 }];
    await p.evaluate(a => window.__parsa.view(...a), a); await p.evaluate(() => window.__parsa.tick()); await p.evaluate(a => window.__parsa.view(...a), a);
    // s18 (lead/C12): let a time jump's sliced catch-up (D-650) finish placing people before the frame: tick until the sim
    // reaches the view's hour and the population view has nothing pending (at most WAITS s)
    const tw = Date.now(), target = v.day * 24 + v.hour; let wait = null;
    for (let i = 0; i < 400 && Date.now() - tw < +(process.env.WAITS ?? 240) * 1000; i++) {
      wait = await p.evaluate(() => { const a = window.__parsa, P = a.people?.(), H = a.humans?.(); return { t: P?.t ?? null, pending: H?.view?.pending ?? null, catchingUp: a.world?.people?.sim?.catchingUp ?? null }; });
      if (wait.t !== null && Math.abs(wait.t - target) < 0.05 && !wait.pending && !wait.catchingUp) break;
      await p.evaluate(() => window.__parsa.tick()); }
    // an open view (v.open; the lead, holes.md row 22): keep the heading if the first hit at eye level on it is >= 8 m away,
    // else turn to the bearing of 16 with the farthest first hit (pickW: the world's meshes through the screen centre)
    if (v.open) { const probe = async az => { await p.evaluate(q => window.__parsa.view(...q), [a[0], a[1], a[2], az, 0, a[5], a[6]]); await p.evaluate(() => window.__parsa.tick()); // the camera's matrices update in the frame, not in view()
        const h = await p.evaluate(() => window.__parsa.pickW(0, 0)).catch(() => null); return h ? h.d : 1e4; };
      const d0 = await probe(v.az); if (d0 < 8) { let best = [v.az, d0];
        for (let i = 0; i < 16; i++) { const az = (v.az + i * 22.5) % 360, d = await probe(az); if (d > best[1]) best = [az, d]; }
        a[3] = best[0]; v.reheaded = `az ${v.az} (wall at ${d0.toFixed(1)} m) -> ${best[0]} (${best[1] >= 1e4 ? 'open' : best[1].toFixed(1) + ' m'})`; console.log(v.id, 'reheaded', v.reheaded); } }
    // a face view (v.face): the camera 0.5 m before the nearest simulated person to (e, n) still and in the open (a talker
    // first), at face height, looking at them
    if (v.face) { const who = await p.evaluate(([e, n]) => { const g = (window.__parsa.people?.()?.agents ?? []).filter(x => !x.offmap);
        const d = x => Math.hypot(x.e - e, x.n - n) + (x.walking ? 30 : 0) - (/talk|chat|convers|gossip|haggl|sell/i.test(String(x.act)) ? 20 : 0);
        g.sort((x, y) => d(x) - d(y)); return g[0] ?? null; }, [v.e, v.n]);
      if (who) { const az = v.az, r = az * Math.PI / 180, ce = who.e - 0.5 * Math.sin(r), cn = who.n - 0.5 * Math.cos(r);
        a[0] = ce; a[1] = cn; a[2] = v.eye ?? 1.5; a[3] = az; a[4] = v.pitch ?? 0; v.who = `${who.name} (${who.role}, ${who.act}) at ${who.e},${who.n}`; console.log('face:', v.who); } }
    await p.evaluate(a => window.__parsa.view(...a), a);
    for (let i = 0; i < +(v.frames ?? process.env.FRAMES ?? 3); i++) await p.evaluate(() => window.__parsa.renderOnce());
    // people drawn here vs the sim's count for the spot (the lead's ask, s18): skinned + impostors drawn, the population view's
    // kept/visible/pending, the detailed sim's agents within 60 m and 150 m
    const life = await p.evaluate(([e, n]) => { const a = window.__parsa, H = a.humans?.(), P = a.people?.(); if (!H) return null;
      const near = r => (P?.agents ?? []).filter(g => !g.offmap && Math.hypot(g.e - e, g.n - n) < r).length;
      const W = a.world?.people, C = W?.crowd; let drawn60 = null, planned60 = null;
      try { drawn60 = C.nearPeople({ x: e, y: 0, z: -n }, 60).length; planned60 = (C.view?.query([e, n], 60)?.length ?? 0) + near(60); } catch (err) { drawn60 = 'err ' + String(err).slice(0, 60); }
      const rf = window.__renderFaults, ff = window.__frameFaults; return { drawn60, planned60, renderFaults: rf ?? null, frameFaults: ff ?? null, skinned: (H.perf?.drawn ?? []).reduce((x, y) => x + y, 0), imp: H.impPerf?.drawn ?? H.impostors ?? null, popKept: H.view?.candidates ?? null, popVisible: H.view?.visible ?? null, popPending: H.view?.pending ?? null, pv: H.view ? Object.fromEntries(Object.entries(H.view).filter(([k, x]) => typeof x === "number" && x)) : null, agents60: near(60), agents150: near(150), simT: P?.t != null ? +P.t.toFixed(3) : null }; }, [a[0], a[1]]).catch(e => ({ err: String(e).slice(0, 80) }));
    life.waitS = +((Date.now() - tw) / 1000).toFixed(0); life.catchingUp = await p.evaluate(() => window.__parsa.world?.people?.sim?.catchingUp ?? null).catch(() => 'err'); life.target = +target.toFixed(3);
    const tf = Date.now(); await p.screenshot({ path: `${outDir}/${v.id}.png`, timeout: 1800000 }); const tshot = ((Date.now() - tf) / 1000).toFixed(0);
    try { const st2 = await sharp(`${outDir}/${v.id}.png`).greyscale().stats(); life.meanLuma = +st2.channels[0].mean.toFixed(1); } catch (e) { life.meanLuma = 'err'; }
    if (v.town) { // the share of the town's upward faces seen that are open floors (a floor more than 1.5 m below the roofs round it)
      const t3 = Date.now(), N = [24, 14], hits = [], names = {};
      for (let j = 0; j < N[1]; j++) for (let i = 0; i < N[0]; i++) { const h = await p.evaluate(([x, y]) => window.__parsa.pickW(x, y), [-1 + (2 * i + 1) / N[0], -1 + (2 * j + 1) / N[1]]).catch(() => null);
        if (h) { const k = `${h.name}|${h.parent}`; names[k] = (names[k] ?? 0) + 1; }
        if (h && h.ny > 0.7 && /^settlement|^house|^town|^q_/i.test(String(h.name || h.parent)) && !/ground|road|water|refuse|tree|haze|smoke|canal|channel|bank/i.test(String(h.name))) hits.push(h.p); }
      // refine: a 5x5 sub-grid in every coarse cell that hit settlement geometry (the town is a small part of a 20 m frame)
      const cells = []; for (let j = 0; j < N[1]; j++) for (let i = 0; i < N[0]; i++) cells.push([i, j]);
      const isTown = h => h && /^settlement/i.test(String(h.name)) && !/ground|road|water|refuse|tree|haze|smoke|canal|channel|bank/i.test(String(h.name));
      const hitCells = [];
      for (const [i, j] of cells) { const h = await p.evaluate(([x, y]) => window.__parsa.pickW(x, y), [-1 + (2 * i + 1) / N[0], -1 + (2 * j + 1) / N[1]]).catch(() => null); if (isTown(h)) hitCells.push([i, j]); }
      hits.length = 0;
      for (const [i, j] of hitCells) for (let b = 0; b < 5; b++) for (let c = 0; c < 5; c++) {
        const h = await p.evaluate(([x, y]) => window.__parsa.pickW(x, y), [-1 + (2 * i + (c + 0.5) / 5 * 2) / N[0], -1 + (2 * j + (b + 0.5) / 5 * 2) / N[1]]).catch(() => null);
        if (h) { const k = `${h.name}|${h.parent}`; names[k] = (names[k] ?? 0) + 1; }
        if (isTown(h) && h.ny > 0.7) hits.push(h.p); }
      let open = 0; for (const q of hits) { const top = Math.max(...hits.filter(r => Math.hypot(r[0] - q[0], r[2] - q[2]) < 15).map(r => r[1])); if (top - q[1] > 1.5) open++; }
      life.openToSky = hits.length ? +(open / hits.length).toFixed(3) : null; life.openSamples = hits.length; life.openNames = Object.entries(names).sort((x, y) => y[1] - x[1]).slice(0, 8); life.openS = +((Date.now() - t3) / 1000).toFixed(0); }
    appendFileSync(`${outDir}/life.jsonl`, JSON.stringify({ id: v.id, who: v.who, reheaded: v.reheaded, ...life }) + '\n');
    const st = await p.evaluate(() => { const s = window.__parsa.stats(); return { dc: s.drawCalls, tri: s.triangles, be: s.backend }; }).catch(() => ({}));
    const line = `${v.id} ${((Date.now() - t1) / 1000).toFixed(0)}s (shot ${tshot}s) ${JSON.stringify(st)} life ${JSON.stringify(life)}`; console.log(T(), line); appendFileSync(`${outDir}/log.txt`, line + '\n');
  } catch (e) { console.log(T(), v.id, 'FAILED', String(e).slice(0, 300)); if (/closed|destroyed|crash/i.test(String(e))) break; }
}
console.log('page errors (unique):'); for (const [k, n] of errs) console.log(n, k);
appendFileSync(`${outDir}/log.txt`, 'errors: ' + JSON.stringify([...errs].slice(0, 30)) + '\n');
await b.close();
