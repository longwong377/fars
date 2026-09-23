import { test } from '@playwright/test';
import { lumStats } from './lib/lum';
// Light probes (D-110 … D-113): interior views of the §1.1 moments (same cameras as moments.spec.ts) rendered in one world
// load, with the renderer's counters, the eye adaptation and the probe field at the camera. Queue rule: ≤ 4 views per
// run; the world loads once (day/hour of the first view), later views set the clock only (the lighting follows it; the
// people do not move). VIEWS= picks views by name; SUFFIX= tags the shots.
const VIEWS: { n: string; day: number; hour: number; v: [number, number, number, number, number] }[] = [
  { n: 'apadana-enter', day: 25, hour: 11, v: [1.9, 36, 1.6, 161, 2] },
  { n: 'hadish-hall', day: 25, hour: 11, v: [22, -150, 1.6, 161, 2] },
  { n: 'apadana-hall-centre', day: 25, hour: 11, v: [1.9, 6, 1.6, 161, 4] },
  { n: 'tachara-s-stair', day: 25, hour: 15.5, v: [-21, -112, 1.6, 341, 6] },
];
test('light probes', async ({ page }, info) => {
  test.setTimeout(840_000);
  const errs: string[] = []; page.on('pageerror', e => errs.push(String(e))); page.on('console', m => { if (m.type() === 'error' || /probes/.test(m.text())) errs.push(m.text().slice(0, 300)); });
  const only = process.env.VIEWS?.split(','), views = VIEWS.filter(s => !only || only.includes(s.n));
  const first = views[0];
  await page.goto(`/?test&quality=${process.env.Q ?? 'high'}&day=${first.day}&hour=${first.hour}&weather=clear${process.env.EXTRA ?? ''}`);
  await page.waitForFunction(() => (window as any).__parsa?.ready === true || (window as any).__parsa?.error, null, { timeout: 780_000 });
  await page.evaluate(() => (window as any).__parsa.renderer.setAnimationLoop(null));
  for (const s of views) {
    await page.evaluate(([d, h]) => (window as any).__parsa.setTime(d, h), [s.day, s.hour]);
    await page.evaluate(v => (window as any).__parsa.view(...v), s.v);
    for (let i = 0; i < +(process.env.FRAMES ?? 8); i++) await page.evaluate(() => (window as any).__parsa.renderOnce());
    const png = await page.screenshot({ path: `shots/probes-${s.n}-${info.project.name}${process.env.SUFFIX ?? ''}.png` });
    const st = await page.evaluate(() => { const P = (window as any).__parsa, s = P.stats?.() ?? {}; return { backend: P.backend, drawCalls: s.drawCalls, triangles: s.triangles, textures: s.textures, frameMs: s.frameMs, exposure: P.exposureInfo?.(), summary: String(P.world?.summary?.() ?? '').split(' · ')[0] }; });
    console.log(s.n, JSON.stringify(st), 'lum', JSON.stringify(await lumStats(page, png)));
    if (process.env.ADAPT) { // what-if (test only, not the game's adaptation): the exposure the eye formula would reach without its
      // 15 % floor, E = (sun + 0.8·sky)·max(skyVis, 0.002), capped at ADAPT; the frame's own exposure write is ignored
      const x = await page.evaluate(cap => { const P = (window as any).__parsa, e = P.exposureInfo(), r = P.renderer;
        const E = (e.sunI * Math.max(0, Math.sin(e.sunAlt * Math.PI / 180)) + e.hemiI * 0.8) * Math.max(e.skyVis, 0.002) + 0.004;
        const x = Math.min(+cap, Math.max(0.35, 2.3 / E)); Object.defineProperty(r, 'toneMappingExposure', { get: () => x, set: () => {}, configurable: true }); return x; }, process.env.ADAPT);
      for (let i = 0; i < 2; i++) await page.evaluate(() => (window as any).__parsa.renderOnce());
      const png2 = await page.screenshot({ path: `shots/probes-${s.n}-${info.project.name}${process.env.SUFFIX ?? ''}-adapted.png` });
      console.log(s.n, 'what-if adapted exposure', x.toFixed(2), 'lum', JSON.stringify(await lumStats(page, png2)));
      await page.evaluate(() => { delete (window as any).__parsa.renderer.toneMappingExposure; (window as any).__parsa.renderer.toneMappingExposure = 1; });
    }
  }
  console.log(errs.slice(0, 8).join('\n'));
});
