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
        if (spot === 'slope') return [253, -650, 1.6, 228, -4]; // 3 m E of the first try, off a garden tree's trunk
        if (spot === 'mountain') return [380, -60, 1.6, 250, -8];
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
        if (spot === 'areab') { const s = plan.sites.find((x: any) => x.id === 'q_w2'); const p = s.plots.find((q: any) => q.id === 'pw_area_b-yard'); const [i0, j0, i1, j1] = p.rect;
          const g = s.grid(s.u0 + (i0 + i1) / 2 + 6, s.v0 + (j0 + j1) / 2), th = s.frame.theta + Math.PI; const gb = 90 - th * 180 / Math.PI; return [g[0], g[1], 1.6, ((gb + 341) % 360 + 360) % 360, -8]; }
        if (spot === 'ajori') { const c = plan.gate.c, th = plan.gate.theta; const e = c[0] + Math.cos(th) * 60, n = c[1] + Math.sin(th) * 60; const gb = 90 - (th + Math.PI) * 180 / Math.PI; return [e, n, 1.6, ((gb + 341) % 360 + 360) % 360, 6]; }
        return [-50.5, -120, 1.6, 215, -3];
      }, v.spot);
      // a photographic lens (vertical 40°, ≈ 28 mm; FOV=game: the player's 70°), session 4
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
