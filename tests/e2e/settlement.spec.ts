import { test } from '@playwright/test';
import { writeFileSync, mkdirSync, readFileSync, existsSync } from 'node:fs';
// Phase 6 settlement views (camera rig, world frozen via ?test&day&hour&weather). Logs __parsa.stats() (draw calls,
// triangles) per view, and at the Terrace W edge the same view with ?notown, so the settlement's own share of the frame
// budget is measured (target: ≤ 150 draw calls and ≤ 2 M triangles added). Views that need a spot inside the town ask
// the generated plan for it (a lane vertex, a workshop yard), so they follow the layout.
type V = { n: string; day: number; hour: number; w: string; q?: string; ab?: boolean; frames?: number; spot: string };
// shared render queue rules (lead, session 3): ≤ 4 page loads per run, runs under 15 min, quality=test while iterating.
// The default set is 4 loads; the EXTRA views run only when named in ONLY=… (e.g. ONLY=slope-s-dusk,workshop-area-b).
const VIEWS: V[] = [
  { n: 'terrace-w-dusk', day: 0, hour: 18.75, w: 'clear', ab: true, spot: 'terrace' },
  { n: 'lane-q_s1', day: 25, hour: 10.5, w: 'clear', spot: 'lane:q_s1' },
  { n: 'tol-ajori-50m', day: 25, hour: 9, w: 'clear', spot: 'ajori' },
];
const EXTRA: V[] = [
  { n: 'terrace-w-day', day: 25, hour: 10, w: 'clear', ab: true, spot: 'terrace' },
  // from the slope of Kuh-e Rahmat S of the Terrace (+42 m), over the lower town at dusk: smoke as the hearths are lit
  { n: 'slope-s-dusk', day: 0, hour: 18.75, w: 'clear', ab: true, spot: 'slope' },
  // from Kuh-e Rahmat E of the Terrace (+65 m over the court, ~80 m over the plain), W over the Terrace to the town and the
  // sunset: the quarters at 1-2 km, bearings 200-308 deg true (D-070)
  { n: 'mountain-dusk', day: 0, hour: 18.75, w: 'clear', ab: true, spot: 'mountain' },
  { n: 'lane-q_w1-dusk', day: 0, hour: 18.9, w: 'clear', spot: 'lane:q_w1' },
  { n: 'workshop-area-b', day: 25, hour: 9.5, w: 'clear', spot: 'areab' },
  // D-234: in a house's court (its corner, looking across it at the eaves, doors and the household's things), and in the lane
  // before a street door
  { n: 'court-q_s1', day: 25, hour: 10.5, w: 'clear', spot: 'court:q_s1' },
  { n: 'door-q_s1', day: 25, hour: 16.5, w: 'clear', spot: 'door:q_s1' },
];
const Q = process.env.Q ?? 'test';
const only = process.env.ONLY?.split(',');
// one test per view (and per A/B variant): each page load compiles every shader under SwiftShader
for (const v of [...VIEWS, ...EXTRA]) for (const town of v.ab ? [true, false] : [true]) {
  if (only ? !only.includes(v.n) : !VIEWS.includes(v)) continue;
  test(`settlement ${v.n}${town ? '' : ' notown'}`, async ({ page }, info) => {
    const errs: string[] = []; page.on('pageerror', e => errs.push(String(e))); page.on('console', m => { if (m.type() === 'error') errs.push(m.text().slice(0, 200)); });
    mkdirSync('shots', { recursive: true }); const f = 'shots/settlement-stats.json';
    {
      await page.goto(`/?test&quality=${Q}&day=${v.day}&hour=${v.hour}&weather=${v.w}${town ? '' : '&notown'}`);
      await page.waitForFunction(() => (window as any).__parsa?.ready === true, null, { timeout: 900_000 });
      await page.evaluate(() => (window as any).__parsa?.renderer?.setAnimationLoop(null)); // frozen test world: no frames behind the screenshots
      const cam = await page.evaluate((spot: string) => {
        const P = (window as any).__parsa, S = P.world.settlement;
        if (spot === 'mountain') return [380, -60, 1.6, 250, -8];
        if (spot === 'slope') { // (session 8: an early return above this block made it dead code; the view stood at a tree) the nearest spot to [253, -650] with no woodland tree within 8 m nor in the view's cone to 60 m (render pass 2: a tree stood at the lens)
          const B = 228, bx = Math.sin(B * Math.PI / 180), by = Math.cos(B * Math.PI / 180), T = (window as any).__parsa.world.treesNear(253, -650, 110);
          (window as any).__treeLog = [T.length, ...T.map((t: number[]) => [Math.round(t[0] - 253), Math.round(t[1] + 650), Math.round(t[2])]).sort((a: number[], b: number[]) => Math.hypot(a[0], a[1]) - Math.hypot(b[0], b[1])).slice(0, 6)];
          const clear = (e: number, n: number) => T.every(([x, y, w]: number[]) => { const dx = x - e, dy = y - n, d = Math.hypot(dx, dy), along = dx * bx + dy * by;
            return d > 8 + w / 2 && !(along > 0 && along < 60 && Math.abs(dx * by - dy * bx) < 2 + w / 2 + along * 0.2); });
          for (let r = 0; r <= 40; r += 2) for (let k = 0; k < Math.max(1, Math.round(r * 1.5)); k++) { const a = (2 * Math.PI * k) / Math.max(1, Math.round(r * 1.5)), e = 253 + r * Math.cos(a), n = -650 + r * Math.sin(a);
            if (clear(e, n)) return [e, n, 1.6, B, -4]; }
          return [253, -650, 1.6, B, -4]; }
        if (spot === 'terrace') return [-50.5, -120, 1.6, 215, -3]; // on the Terrace platform 2.3 m inside its W edge (x −52.8 here), looking SW over the lower town
        if (!S) return spot === 'slope' ? [253, -650, 1.6, 228, -4] : spot === 'mountain' ? [380, -60, 1.6, 250, -8] : [-50.5, -120, 1.6, 215, -3];
        const plan = S.plan;
        if (spot.startsWith('lane:')) { // a lane vertex with 3 m clear around it, deep in the quarter, looking along the longer open run
          const s = plan.sites.find((x: any) => x.id === spot.slice(5)); const open = (i: number, j: number) => { const c = s.at(i, j); return c === -2 || c === -4; };
          let best: any = null;
          for (let j = 10; j < s.H - 10; j++) for (let i = 10; i < s.W - 10; i++) { if (![[-1, -1], [0, -1], [-1, 0], [0, 0]].every(([a, b]) => open(i + a, j + b))) continue;
            const r = Math.hypot(s.cu(i), s.cv(j)); if (r > Math.min(s.W, s.H) * 0.3) continue;
            let runU = 0; while (open(i + runU, j) && open(i + runU, j - 1) && runU < 60) runU++; let runV = 0; while (open(i, j + runV) && open(i - 1, j + runV) && runV < 60) runV++;
            const sc = Math.max(runU, runV) - r * 0.05; if (!best || sc > best.sc) best = { i, j, sc, alongU: runU >= runV }; }
          const g = s.grid(s.u0 + best.i, s.v0 + best.j), th = s.frame.theta + (best.alongU ? 0 : Math.PI / 2); // look along +u or +v
          const gridBearing = 90 - th * 180 / Math.PI; return [g[0], g[1], 1.6, ((gridBearing + 341) % 360 + 360) % 360, 2];
        }
        if (spot.startsWith('court:') || spot.startsWith('door:')) { // the house nearest the quarter's centre with a court of 20+ cells
          const s = plan.sites.find((x: any) => x.id === spot.split(':')[1]); let best: any = null;
          for (const p of s.plots) { if (!p.door || (p.kind !== 'house' && p.kind !== 'house_large')) continue; const cells: number[] = []; for (let k = 0; k < s.cell.length; k++) if (s.cell[k] === p.idx && s.sub[k] === 2) cells.push(k);
            if (cells.length < 20) continue; const [i0, j0, i1, j1] = p.rect, r = Math.hypot(s.cu((i0 + i1) / 2), s.cv((j0 + j1) / 2)); if (!best || r < best.r) best = { p, cells, r }; }
          if (spot.startsWith('court:')) { let lo = best.cells[0], su = 0, sv = 0; for (const k of best.cells) { const u = s.cu(k % s.W), v = s.cv((k / s.W) | 0); su += u; sv += v; if (u + v < s.cu(lo % s.W) + s.cv((lo / s.W) | 0)) lo = k; }
            const g = s.grid(s.cu(lo % s.W), s.cv((lo / s.W) | 0)), c = s.grid(su / best.cells.length, sv / best.cells.length), gb = Math.atan2(c[0] - g[0], c[1] - g[1]) * 180 / Math.PI;
            return [g[0], g[1], 1.6, ((gb + 341) % 360 + 360) % 360, 8]; }
          const d = s.doorPoints(best.p), nu = d.inside[0] - d.out[0], nv = d.inside[1] - d.out[1], g = s.grid(d.out[0] - nu * 0.6, d.out[1] - nv * 0.6), t = s.grid(d.inside[0], d.inside[1]);
          const gb = Math.atan2(t[0] - g[0], t[1] - g[1]) * 180 / Math.PI + 25; return [g[0], g[1], 1.6, ((gb + 341) % 360 + 360) % 360, 6]; }
        if (spot === 'areab') { const s = plan.sites.find((x: any) => x.id === 'q_w2'); const p = s.plots.find((q: any) => q.id === 'pw_area_b-yard'); const [i0, j0, i1, j1] = p.rect;
          const g = s.grid(s.u0 + (i0 + i1) / 2 + 6, s.v0 + (j0 + j1) / 2), th = s.frame.theta + Math.PI; const gb = 90 - th * 180 / Math.PI; return [g[0], g[1], 1.6, ((gb + 341) % 360 + 360) % 360, -8]; }
        if (spot === 'ajori') { const c = plan.gate.c, th = plan.gate.theta; const e = c[0] + Math.cos(th) * 60, n = c[1] + Math.sin(th) * 60; const gb = 90 - (th + Math.PI) * 180 / Math.PI; return [e, n, 1.6, ((gb + 341) % 360 + 360) % 360, 6]; }
        return [-50.5, -120, 1.6, 215, -3];
      }, v.spot);
      // a photographic lens (vertical 40°, ≈ 28 mm; FOV=game: the player's 70°), session 4
      if (v.spot === 'slope') console.log('slope trees (count, nearest [de, dn, w])', JSON.stringify(await page.evaluate(() => (window as any).__treeLog)));
      const fov = process.env.FOV === 'game' ? undefined : 40;
      await page.evaluate(([c, f]) => (window as any).__parsa.view(...c, f), [cam, fov] as const);
      for (let i = 0; i < (v.frames ?? 6); i++) await page.evaluate(() => (window as any).__parsa.renderOnce());
      const tag = `${v.n}${town ? '' : '-notown'}-${Q}-${info.project.name}`;
      await page.screenshot({ path: `shots/settlement-${tag}.png` });
      const st: any = await page.evaluate(() => { const P = (window as any).__parsa; const s = P.stats(); const S = P.world.settlement; return { drawCalls: s.drawCalls, triangles: s.triangles, backend: s.backend, town: S ? S.stats() : null, fires: P.world.fire.stats(), sun: P.sky() }; });
      // the settlement's own share at this very view: the same frame with the settlement group hidden (its fires stay)
      if (town) { await page.evaluate(() => { (window as any).__parsa.world.settlement.group.visible = false; }); await page.evaluate(() => (window as any).__parsa.renderOnce());
        const hid = await page.evaluate(() => { const s = (window as any).__parsa.stats(); return { drawCalls: s.drawCalls, triangles: s.triangles }; });
        await page.evaluate(() => { (window as any).__parsa.world.settlement.group.visible = true; });
        st.added = { drawCalls: st.drawCalls - hid.drawCalls, triangles: st.triangles - hid.triangles }; }
      const all = existsSync(f) ? JSON.parse(readFileSync(f, 'utf8')) : {}; all[tag] = { cam, ...st }; writeFileSync(f, JSON.stringify(all, null, 1));
      console.log(tag, JSON.stringify({ cam: cam.map((x: number) => +x.toFixed(1)), drawCalls: st.drawCalls, triangles: st.triangles, added: st.added, backend: st.backend, fires: st.fires, haze: st.town?.haze?.maxAlpha, colliders: st.town?.liveColliders }));
    }
    console.log('errors:', errs.slice(0, 8).join('\n'));
  });
}
