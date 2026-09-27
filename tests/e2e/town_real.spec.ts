import { test, expect } from '@playwright/test';
import { writeFileSync, mkdirSync, readFileSync, existsSync } from 'node:fs';
import { lumStats } from './lib/lum';
// D-303 (session 11, the GPU machine): the town below the Terrace, the villages and the workshops in ONE page load (a load is
// ~11 min of shader compiles, a frame 0.1 s): each view sets its day, hour and weather on the loaded world. The town's views
// ask the generated plan for their spot (as settlement.spec does), so they follow the layout. Per view: the frame, its
// luminance, the draw calls, and T-A7's sample: an 8 x 5 grid of picks (a whole-scene raycast each: ~1-2 s on a loaded box), each hit's surface (surfaceMaterial names its
// materials `surface:<name>`) against src/render/scans.ts SCAN_USE: a surface pixel counts as a stand-in when its surface has
// no scan, a scan blended under alb 0.3, or a scan whose largest tile spans < 8 px at the hit's distance (T-A7's anti-proxy).
// Env: ONLY=a,b  Q=high  FOV=game (the player's 70°; default) or photo (40°)  TAG=before|after  FRAMES
type V = { n: string; day: number; hour: number; w: string; spot?: string; v?: [number, number, number, number, number] };
const VIEWS: V[] = [
  { n: 'lane-q_s1', day: 25, hour: 10.5, w: 'clear', spot: 'lane:q_s1' },
  { n: 'court-q_s1', day: 25, hour: 10.5, w: 'clear', spot: 'court:q_s1' },
  { n: 'wall-q_s1', day: 25, hour: 10.5, w: 'clear', spot: 'wall:q_s1' }, // arm's length: 1.4 m from a lane wall, looking along it at its foot
  { n: 'workshop-area-b', day: 25, hour: 9.5, w: 'clear', spot: 'areab' },
  { n: 'terrace-w-day', day: 25, hour: 10, w: 'clear', spot: 'terrace' },
  { n: 'door-q_s1', day: 25, hour: 16.5, w: 'clear', spot: 'door:q_s1' },
  { n: 'lane-q_s1-night', day: 25, hour: 21.5, w: 'clear', spot: 'lane:q_s1' },
  { n: 'lane-q_w1', day: 0, hour: 16, w: 'clear', spot: 'lane:q_w1' },
  { n: 'lane-q_w1-dusk', day: 0, hour: 18.9, w: 'clear', spot: 'lane:q_w1' },
  { n: 'village-p22', day: 0, hour: 16, w: 'clear', v: [-973, 3287, 1.6, 341, 1] },
  { n: 'village-p22-lane', day: 0, hour: 16, w: 'clear', v: [-980, 3530, 1.6, 42, 2] },
  { n: 'village-p22-dusk', day: 0, hour: 18.9, w: 'clear', v: [-980, 3530, 1.6, 42, 2] },
  { n: 'tannery-work', day: 60, hour: 9, w: 'clear', v: [415, 420, 1.6, 26, -8] },
  { n: 'press-work', day: 60, hour: 9, w: 'clear', v: [-228, -702, 1.6, 26, -8] },
];
// SCAN_USE read from the source (the spec runs in node without three/webgpu): name -> [alb, largest tile]
const SCANS: Record<string, [number, number]> = {};
for (const m of readFileSync('src/render/scans.ts', 'utf8').matchAll(/^\s+(\w+): \{ scan: '\w+', scale: ([\d.]+)(?:, scale2: ([\d.]+))?, alb: ([\d.]+)/gm))
  SCANS[m[1]] = [+m[4], Math.max(+m[2], +(m[3] ?? 0))];

test('town real', async ({ page }, info) => {
  test.setTimeout(+(process.env.TIMEOUT ?? 3000) * 1000);
  const errs: string[] = [], blank: string[] = []; page.on('pageerror', e => errs.push(String(e))); page.on('console', m => { if (m.type() === 'error') errs.push(m.text().slice(0, 300)); });
  const only = process.env.ONLY?.split(','), Q = process.env.Q ?? 'high', TAG = process.env.TAG ? '-' + process.env.TAG : '';
  const run = VIEWS.filter(v => !only || only.includes(v.n));
  const fovDeg = process.env.FOV === 'photo' ? 40 : undefined;
  await page.goto(`/?test&quality=${Q}&day=${run[0].day}&hour=${run[0].hour}&weather=${run[0].w}${process.env.URLX ?? ''}`);
  await page.waitForFunction(() => (window as any).__parsa?.ready === true || (window as any).__parsa?.error, null, { timeout: 2_400_000 });
  { const err = await page.evaluate(() => (window as any).__parsa?.error); if (err) throw new Error('world build failed: ' + err); }
  await page.evaluate(() => (window as any).__parsa.renderer.setAnimationLoop(null));
  mkdirSync('shots', { recursive: true }); const f = 'shots/town-real-stats.json'; const all = existsSync(f) ? JSON.parse(readFileSync(f, 'utf8')) : {};
  for (const v of run) {
    await page.evaluate(([d, h, w]) => { const p = (window as any).__parsa; p.setWeather(w); p.setTime(d, h); }, [v.day, v.hour, v.w] as const);
    const cam: number[] = v.v ?? await page.evaluate((spot: string) => {
      const P = (window as any).__parsa, S = P.world.settlement, plan = S.plan;
      if (spot === 'terrace') return [-50.5, -120, 1.6, 215, -9]; // (-3 at the player's 70°: the parapet filled the lower half and the town was a line on the horizon)
      if (spot === 'areab') { const s = plan.sites.find((x: any) => x.id === 'q_w2'); const p = s.plots.find((q: any) => q.id === 'pw_area_b-yard'); const [i0, j0, i1, j1] = p.rect;
        const g = s.grid(s.u0 + (i0 + i1) / 2 + 6, s.v0 + (j0 + j1) / 2), th = s.frame.theta + Math.PI; const gb = 90 - th * 180 / Math.PI; return [g[0], g[1], 1.6, ((gb + 341) % 360 + 360) % 360, -8]; }
      const s = plan.sites.find((x: any) => x.id === spot.split(':')[1]); const open = (i: number, j: number) => { const c = s.at(i, j); return c === -2 || c === -4; };
      if (spot.startsWith('lane:') || spot.startsWith('wall:')) { // settlement.spec's lane vertex: 3 m clear, deep in the quarter, along the longer open run
        let best: any = null;
        for (let j = 10; j < s.H - 10; j++) for (let i = 10; i < s.W - 10; i++) { if (![[-1, -1], [0, -1], [-1, 0], [0, 0]].every(([a, b]) => open(i + a, j + b))) continue;
          const r = Math.hypot(s.cu(i), s.cv(j)); if (r > Math.min(s.W, s.H) * 0.3) continue;
          let runU = 0; while (open(i + runU, j) && open(i + runU, j - 1) && runU < 60) runU++; let runV = 0; while (open(i, j + runV) && open(i - 1, j + runV) && runV < 60) runV++;
          const sc = Math.max(runU, runV) - r * 0.05; if (!best || sc > best.sc) best = { i, j, sc, alongU: runU >= runV }; }
        const th = s.frame.theta + (best.alongU ? 0 : Math.PI / 2), gridBearing = 90 - th * 180 / Math.PI;
        if (spot.startsWith('lane:')) { const g = s.grid(s.u0 + best.i, s.v0 + best.j); return [g[0], g[1], 1.6, ((gridBearing + 341) % 360 + 360) % 360, 2]; }
        // the wall: step across the lane (perpendicular to the run) to the first built cell, stand 1.4 m off it, look 25 deg into the wall and down
        const du = best.alongU ? 0 : 1, dv = best.alongU ? 1 : 0; let k = 0; while (k < 8 && open(best.i + du * k, best.j + dv * k)) k++;
        const g = s.grid(s.u0 + best.i + du * (k - 1.4), s.v0 + best.j + dv * (k - 1.4));
        return [g[0], g[1], 1.6, ((gridBearing - 25 + 341) % 360 + 360) % 360, -12];
      }
      let best: any = null; // court / door: the house nearest the quarter's centre with a court of 20+ cells
      for (const p of s.plots) { if (!p.door || (p.kind !== 'house' && p.kind !== 'house_large')) continue; const cells: number[] = []; for (let k = 0; k < s.cell.length; k++) if (s.cell[k] === p.idx && s.sub[k] === 2) cells.push(k);
        if (cells.length < 20) continue; const [i0, j0, i1, j1] = p.rect, r = Math.hypot(s.cu((i0 + i1) / 2), s.cv((j0 + j1) / 2)); if (!best || r < best.r) best = { p, cells, r }; }
      if (spot.startsWith('court:')) { let lo = best.cells[0], su = 0, sv = 0; for (const k of best.cells) { const u = s.cu(k % s.W), v = s.cv((k / s.W) | 0); su += u; sv += v; if (u + v < s.cu(lo % s.W) + s.cv((lo / s.W) | 0)) lo = k; }
        const g = s.grid(s.cu(lo % s.W), s.cv((lo / s.W) | 0)), c = s.grid(su / best.cells.length, sv / best.cells.length), gb = Math.atan2(c[0] - g[0], c[1] - g[1]) * 180 / Math.PI;
        return [g[0], g[1], 1.6, ((gb + 341) % 360 + 360) % 360, 8]; }
      const d = s.doorPoints(best.p), nu = d.inside[0] - d.out[0], nv = d.inside[1] - d.out[1], g = s.grid(d.out[0] - nu * 2.2, d.out[1] - nv * 2.2), t = s.grid(d.inside[0], d.inside[1]);
      const gb = Math.atan2(t[0] - g[0], t[1] - g[1]) * 180 / Math.PI + 20; return [g[0], g[1], 1.6, ((gb + 341) % 360 + 360) % 360, 4];
    }, v.spot!);
    await page.evaluate(([c, fv]) => (window as any).__parsa.view(...c, fv), [cam, fovDeg] as const);
    await page.evaluate(() => (window as any).__parsa.renderOnce()); await page.evaluate(([c, fv]) => (window as any).__parsa.view(...c, fv), [cam, fovDeg] as const); // colliders and near tiles built: stand on what is drawn
    for (let i = 0; i < +(process.env.FRAMES ?? 8); i++) await page.evaluate(() => (window as any).__parsa.renderOnce());
    const png = await page.screenshot({ path: `shots/town-${v.n}${TAG}-${Q}-${info.project.name}.png` });
    const lum = await lumStats(page, png);
    if (lum.max < 1) blank.push(v.n); // (session 11: a lost device, DXGI_ERROR_DEVICE_HUNG, left every later frame black and the run "passed")
    // T-A7's sample: 8 x 5 picks; each hit's object -> its material's surface name
    const hits: { s: string; d: number; o: string }[] = await page.evaluate(() => { const P = (window as any).__parsa, root = P.world.root, out: any[] = [], byName = new Map<string, any>();
      for (let y = 0; y < 5; y++) for (let x = 0; x < 8; x++) { const h = P.pick((x + 0.5) / 4 - 1, 1 - (y + 0.5) / 2.5); if (!h) { out.push({ s: 'sky', d: 0, o: '' }); continue; }
        let o = byName.get(h.name); if (o === undefined) { o = root.getObjectByName(h.name) ?? null; byName.set(h.name, o); }
        const m = o && (Array.isArray(o.material) ? o.material[0] : o.material); const s = m?.userData?.surface ?? (m ? 'other:' + (m.name || m.type) : 'other:?');
        out.push({ s, d: h.d, o: h.name }); }
      return out; });
    const pxAng = ((fovDeg ?? 70) * Math.PI / 180) / 540; let surf = 0, stand = 0; const bySurf: Record<string, [number, number]> = {}, others: Record<string, number> = {};
    for (const h of hits) { if (h.s === 'sky') continue; if (h.s.startsWith('other:')) { const k = h.s + ' ' + h.o.slice(0, 40); others[k] = (others[k] ?? 0) + 1; continue; }
      surf++; const u = SCANS[h.s], ok = !!u && u[0] >= 0.3 && u[1] / (h.d * pxAng) >= 8; if (!ok) stand++;
      const e = bySurf[h.s] ?? (bySurf[h.s] = [0, 0]); e[0]++; if (!ok) e[1]++; }
    const st = await page.evaluate(() => { const P = (window as any).__parsa, s = P.stats(); return { drawCalls: s.drawCalls, triangles: s.triangles, backend: s.backend, town: P.world.settlement?.stats?.(), fires: P.world.fire?.stats?.() }; });
    all[`${v.n}${TAG}|${Q}|${info.project.name}`] = { cam: cam.map(x => +x.toFixed(2)), lum, drawCalls: st.drawCalls, triangles: st.triangles, backend: st.backend,
      TA7: { surfacePx: surf, standInPx: stand, share: surf ? +(100 * stand / surf).toFixed(2) : 0, bySurf, others } };
    writeFileSync(f, JSON.stringify(all, null, 1));
    console.log(v.n, JSON.stringify({ cam: cam.map(x => +x.toFixed(1)), lum: lum.mean, draws: st.drawCalls, tris: st.triangles, TA7: all[`${v.n}${TAG}|${Q}|${info.project.name}`].TA7.share, bySurf }));
  }
  console.log('errors:', errs.slice(0, 8).join('\n'));
  const gpu = errs.filter(e => /sampled textures|Invalid (ShaderModule|RenderPipeline|BindGroup|CommandBuffer)|WebGPU validation|GPUValidationError/i.test(e));
  expect(gpu, 'WebGPU validation errors: ' + gpu.slice(0, 3).join(' | ')).toEqual([]);
  expect(blank, 'black frames (the GPU device lost?)').toEqual([]);
});
