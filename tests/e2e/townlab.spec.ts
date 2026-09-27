import { test } from '@playwright/test';
import { mkdirSync } from 'node:fs';
// Town lab (dev page, D-303): one quarter's houses at full detail on flat ground under the game's sky and post pipeline, for
// quick judgement of the scanned surfaces (walls, footings, roofs, lanes, courts) at arm's length. Screenshots find problems
// (shots/townlab-*.png); the world renders (town_real.spec.ts) judge. Env: TAG, ONLY, SITE (q_s1), Q (high).
const VIEWS: { n: string; hour: number; spot: string; eye?: number; pitch?: number; turn?: number; back?: number }[] = [
  { n: 'lane', hour: 10.5, spot: 'lane' },
  { n: 'wall', hour: 10.5, spot: 'wall' },
  { n: 'wall-pm', hour: 16.5, spot: 'wall' },
  { n: 'court', hour: 10.5, spot: 'court' },
  { n: 'door', hour: 16.5, spot: 'door' },
  { n: 'roofs', hour: 10.5, spot: 'lane', eye: 9, pitch: -25 },
  { n: 'lane-down', hour: 10.5, spot: 'lane', pitch: -35 },
  { n: 'lane-feet', hour: 10.5, spot: 'lane', pitch: -75 },
];
test('town lab', async ({ page }) => {
  test.setTimeout(1_800_000);
  const errs: string[] = []; page.on('pageerror', e => errs.push(String(e))); page.on('console', m => { if (m.type() === 'error') errs.push(m.text().slice(0, 300)); });
  await page.goto(`/townlab.html?test&quality=${process.env.Q ?? 'high'}&site=${process.env.SITE ?? 'q_s1'}&day=25&hour=10.5`);
  await page.waitForFunction(() => (window as any).__lab?.ready === true || (window as any).__lab?.error, null, { timeout: 1_500_000 });
  const err = await page.evaluate(() => (window as any).__lab.error); if (err) throw new Error(err);
  mkdirSync('shots', { recursive: true });
  const only = process.env.ONLY?.split(','), TAG = process.env.TAG ? '-' + process.env.TAG : '';
  for (const v of VIEWS) {
    if (only && !only.includes(v.n)) continue;
    const cam = await page.evaluate((v) => { const L = (window as any).__lab, s = L.site; const open = (i: number, j: number) => { const c = s.at(i, j); return c === -2 || c === -4; };
      if (v.spot === 'lane' || v.spot === 'wall') { let best: any = null;
        for (let j = 10; j < s.H - 10; j++) for (let i = 10; i < s.W - 10; i++) { if (![[-1, -1], [0, -1], [-1, 0], [0, 0]].every(([a, b]) => open(i + a, j + b))) continue;
          const r = Math.hypot(s.cu(i), s.cv(j)); if (r > Math.min(s.W, s.H) * 0.3) continue;
          let runU = 0; while (open(i + runU, j) && open(i + runU, j - 1) && runU < 60) runU++; let runV = 0; while (open(i, j + runV) && open(i - 1, j + runV) && runV < 60) runV++;
          const sc = Math.max(runU, runV) - r * 0.05; if (!best || sc > best.sc) best = { i, j, sc, alongU: runU >= runV }; }
        const th = s.frame.theta + (best.alongU ? 0 : Math.PI / 2), gb = 90 - th * 180 / Math.PI;
        if (v.spot === 'lane') { const g = s.grid(s.u0 + best.i, s.v0 + best.j); return [g[0], g[1], v.eye ?? 1.6, gb, v.pitch ?? 2]; }
        const du = best.alongU ? 0 : 1, dv = best.alongU ? 1 : 0; let k = 0; while (k < 8 && open(best.i + du * k, best.j + dv * k)) k++;
        const g = s.grid(s.u0 + best.i + du * (k - 1.4), s.v0 + best.j + dv * (k - 1.4)); return [g[0], g[1], 1.6, gb - 25, -12]; }
      let best: any = null;
      for (const p of s.plots) { if (!p.door || (p.kind !== 'house' && p.kind !== 'house_large')) continue; const cells: number[] = []; for (let k = 0; k < s.cell.length; k++) if (s.cell[k] === p.idx && s.sub[k] === 2) cells.push(k);
        if (cells.length < 20) continue; const [i0, j0, i1, j1] = p.rect, r = Math.hypot(s.cu((i0 + i1) / 2), s.cv((j0 + j1) / 2)); if (!best || r < best.r) best = { p, cells, r }; }
      if (v.spot === 'court') { let lo = best.cells[0], su = 0, sv = 0; for (const k of best.cells) { const u = s.cu(k % s.W), w = s.cv((k / s.W) | 0); su += u; sv += w; if (u + w < s.cu(lo % s.W) + s.cv((lo / s.W) | 0)) lo = k; }
        const g = s.grid(s.cu(lo % s.W), s.cv((lo / s.W) | 0)), c = s.grid(su / best.cells.length, sv / best.cells.length); return [g[0], g[1], 1.6, Math.atan2(c[0] - g[0], c[1] - g[1]) * 180 / Math.PI, 8]; }
      const d = s.doorPoints(best.p), nu = d.inside[0] - d.out[0], nv = d.inside[1] - d.out[1], g = s.grid(d.out[0] - nu * 2.2, d.out[1] - nv * 2.2), t = s.grid(d.inside[0], d.inside[1]);
      return [g[0], g[1], 1.6, Math.atan2(t[0] - g[0], t[1] - g[1]) * 180 / Math.PI + 20, 4]; }, v);
    await page.evaluate(([c, h]) => { const L = (window as any).__lab; L.setTime(25, h); L.view(...c); }, [cam, v.hour] as const);
    await page.evaluate(() => (window as any).__lab.render(6));
    await page.screenshot({ path: `shots/townlab-${v.n}${TAG}.png` });
    console.log(v.n, JSON.stringify(cam.map((x: number) => +x.toFixed(1))), JSON.stringify(await page.evaluate(() => (window as any).__lab.stats())));
  }
  console.log('errors:', errs.slice(0, 6).join('\n'));
});
