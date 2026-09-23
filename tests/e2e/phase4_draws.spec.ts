import { test } from '@playwright/test';
// Renderer counters (draw calls, triangles, backend draws) at three views, for the relief far-representation work
// (D-048): Grand Stair foot, Apadana N court, Tachara S court. Q=quality (default high). Prints one JSON line per view.
test('phase 4 draw counts', async ({ page }, info) => {
  test.skip(info.project.name !== 'webgpu');
  test.setTimeout(1_800_000);
  await page.goto(`/?test&quality=${process.env.Q ?? 'high'}&day=0&hour=9&weather=clear`);
  await page.waitForFunction(() => (window as any).__parsa?.ready === true || (window as any).__parsa?.error, null, { timeout: 1_200_000 });
  await page.evaluate(() => { const r = (window as any).__parsa.renderer, b = r.backend, w = window as any; w.__draws = 0;
    const d = b.draw.bind(b); b.draw = (...a: any[]) => { w.__draws++; return d(...a); }; });
  const views: [string, number[]][] = [['grand-stair-foot', [-60, 122, 1.6, 71, 10]], ['apadana-n-court', [0, 60, 1.6, 161, 5]], ['tachara-s-court', [-21, -112, 1.6, 341, 6]]];
  for (const [name, v] of views) {
    await page.evaluate(v => (window as any).__parsa.view(...v), v);
    await page.evaluate(() => (window as any).__parsa.renderOnce());
    await page.evaluate(() => { (window as any).__draws = 0; });
    await page.evaluate(() => (window as any).__parsa.renderOnce());
    const s = await page.evaluate(() => { const w = window as any, s = w.__parsa.stats(); return { drawCalls: s.drawCalls, triangles: s.triangles, backendDraws: w.__draws, reliefTris: s.reliefs.tris, reliefByLod: s.reliefs.byLod, reliefSets: s.reliefs.sets, reliefDraws: s.reliefs.draws ?? null }; });
    console.log(`DRAWS ${process.env.TAG ?? ''} ${name} ${JSON.stringify(s)}`);
    if (process.env.SHOT) await page.screenshot({ path: `shots/draws-${name}${process.env.TAG ? '-' + process.env.TAG : ''}.png` });
  }
});
