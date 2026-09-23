import { test } from '@playwright/test';
import { writeFileSync, mkdirSync, readFileSync, existsSync } from 'node:fs';
import { lumStats } from './lib/lum';
// D-157 surfaces / reflections / contact shading: renders each view with the photoreal-triage switches on (B) and off
// (A: no broad tone, wall-foot band, floor wear, worn arrises or block tilt; no bevels, sky specular, SSR or sun contact
// shadows; the session-4
// SSGI input and contact AO; window.__parsaSurf) in ONE page load (views at other hours through setTime, as plain.spec).
// Between the variants of a view the frame meter (D-159) is frozen at the B frame's reading, so both variants are exposed
// identically and the pixels compare directly. Debug spec: runs only with DBG=1.
// ONLY=view,view  VARIANTS=B,A,gi0 (gi0 = only the SSGI input switched back)  FRAMES=6  Q=high
const IN = 46;
const VIEWS: Record<string, { day: number; hour: number; v: [number, number, number, number, number]; fov?: number }> = {
  'apadana-hall-in': { day: 25, hour: 11, v: [10.55, 12.4, 1.6, 170, 20], fov: 50 },
  'hadish-hall': { day: 25, hour: 11, v: [22, -150, 1.6, 161, 2], fov: IN },
  'apadana-enter': { day: 25, hour: 11, v: [1.9, 58, 1.6, 161, 4], fov: IN },
  'apadana-enter-portico': { day: 25, hour: 11, v: [1.9, 36, 1.6, 161, 2], fov: IN },
  'scribe-at-work': { day: 25, hour: 10, v: [183.2, -83.9, 1.6, 60, -20], fov: 50 },
  'harem-portico': { day: 25, hour: 10, v: [114, -114, 1.6, 161, 4], fov: IN },
  'apadana-north-nr': { day: 0, hour: 9, v: [1.9, 40, 1.6, 341, 1] },
  'stair-foot-east': { day: 0, hour: 9, v: [-60, 122, 1.6, 71, 10] },
  'stair-climb-pm': { day: 25, hour: 16, v: [-43.9, 128, 1.6, 341, 12] },
};
const SET: Record<string, Record<string, number | boolean>> = {
  B: { surf: 1, env: 1, ssr: 1, sss: 1, giDirect: 1, contact: 1, bevels: true },
  A: { surf: 0, env: 0, ssr: 0, sss: 0, giDirect: 0, contact: 0, bevels: false },
  gi0: { surf: 1, env: 1, ssr: 1, sss: 1, giDirect: 0, contact: 1, bevels: true },
};
test('surfaces A/B', async ({ page }) => {
  test.setTimeout(1_380_000);
  const t0 = Date.now(), budget = +(process.env.BUDGET_S ?? 1150) * 1000; // stop starting new renders after ~19 min
  const errs: string[] = []; page.on('pageerror', e => errs.push(String(e))); page.on('console', m => { if (m.type() === 'error' || m.type() === 'warning') errs.push(m.text().slice(0, 300)); });
  // ONLY=view[:V1+V2],… (per-view variants; default VARIANTS)
  const only = (process.env.ONLY ?? 'apadana-hall-in').split(',').map(x => x.split(':')), frames = +(process.env.FRAMES ?? 6), Q = process.env.Q ?? 'high';
  const first = VIEWS[only[0][0]];
  await page.goto(`/?test&quality=${Q}&day=${first.day}&hour=${first.hour}&weather=clear`);
  await page.waitForFunction(() => (window as any).__parsa?.ready === true || (window as any).__parsa?.error, null, { timeout: 600_000 });
  await page.evaluate(() => (window as any).__parsa?.renderer?.setAnimationLoop(null));
  const err = await page.evaluate(() => (window as any).__parsa.error); if (err) throw new Error(err);
  // the frame meter's read-back, frozen on request (window.__meterFreeze) so that a variant is exposed as the B frame was
  await page.evaluate(() => {
    const w = window as any, r = w.__parsa.renderer, orig = r.readRenderTargetPixelsAsync.bind(r);
    r.readRenderTargetPixelsAsync = async (rt: any, x: number, y: number, W: number, H: number, ...a: any[]) => {
      const meter = W === 24 && H === 14;
      if (meter && w.__meterFreeze) return w.__meterFreeze;
      const px = await orig(rt, x, y, W, H, ...a); if (meter) w.__meterLast = px; return px;
    };
  });
  mkdirSync('shots', { recursive: true });
  const out: Record<string, any> = {}, w0: { last?: string } = {};
  for (const [name, vs] of only) {
    const s = VIEWS[name]; if (!s) throw new Error(`unknown view ${name}`);
    const variants = (vs ?? process.env.VARIANTS ?? 'B,A').split(/[+,]/);
    await page.evaluate(([d, h]) => { const p = (window as any).__parsa; p.setTime(d, h); p.setWeather('clear'); }, [s.day, s.hour]);
    await page.evaluate(([v, f]) => (window as any).__parsa.view(...v, f), [s.v, s.fov] as const);
    for (const vn of variants) {
      if (Date.now() - t0 > budget) { console.log(`budget: skipping ${name}/${vn}`); continue; }
      // a variant `post=<view>` renders a pipeline debug view (B settings), rebuilt at run time; the next variant rebuilds the image
      const post = vn.startsWith('post=') ? vn.slice(5) : '';
      await page.evaluate(([set, freeze, pv, wasPost]) => {
        const w = window as any, S = w.__parsaSurf;
        for (const [k, v] of Object.entries(set as any)) { if (k === 'bevels') S.bevels(v); else if (S[k]) S[k].value = v; }
        if (pv || wasPost) S.post(pv);
        w.__meterFreeze = freeze ? w.__meterLast : null;
      }, [SET[post ? 'B' : vn], vn !== variants[0], post, !!(w0.last?.startsWith('post='))] as const);
      w0.last = vn;
      const ts = Date.now();
      for (let i = 0; i < frames; i++) await page.evaluate(() => (window as any).__parsa.renderOnce());
      const png = await page.screenshot({ path: `shots/surf-${name}-${vn.replace('=', '-')}.png` });
      const lum = await lumStats(page, png);
      const info = await page.evaluate(() => { const p = (window as any).__parsa, st = p.stats(), e = p.exposureInfo(); return { drawCalls: st.drawCalls, triangles: st.triangles, exposure: e.exposure, meterEV: e.meterEV, envCaptures: (window as any).__parsaSurf.envCaptures?.() }; });
      out[`${name}|${vn}`] = { ...info, lum, frameS: +((Date.now() - ts) / 1000 / frames).toFixed(1) };
      console.log(name, vn, JSON.stringify(out[`${name}|${vn}`]));
      { const f = 'shots/surf-stats.json', all = existsSync(f) ? JSON.parse(readFileSync(f, 'utf8')) : {}; all[`${name}|${vn}`] = out[`${name}|${vn}`]; writeFileSync(f, JSON.stringify(all, null, 1)); } // after every render (a killed run keeps what it did)
    }
    await page.evaluate(() => { (window as any).__meterFreeze = null; });
  }
  console.log('errors/warnings:', errs.slice(0, 15).join('\n'));
});
