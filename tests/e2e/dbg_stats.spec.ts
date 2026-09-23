import { test } from '@playwright/test';
// debug: renderer counters for one view at a quality level (the bench's draw-call and triangle numbers)
test('renderer stats', async ({ page }, info) => {
  test.skip(info.project.name !== 'webgpu');
  test.setTimeout(1_200_000);
  await page.goto(`/?test&quality=${process.env.Q ?? 'high'}&day=0&hour=9`);
  await page.waitForFunction(() => (window as any).__parsa?.ready === true, null, { timeout: 900_000 });
  const V = (process.env.V ?? '-60,122,1.6,71,10').split(',').map(Number);
  await page.evaluate(v => (window as any).__parsa.view(...v), V);
  await page.evaluate(() => { const r = (window as any).__parsa.renderer, b = r.backend, w = window as any; w.__draws = 0; w.__renders = 0; w.__skipped = 0;
    const d = b.draw.bind(b); b.draw = (...a: any[]) => { w.__draws++; return d(...a); };
    const rr = r.render.bind(r); r.render = (...a: any[]) => { w.__renders++; return rr(...a); };
    const u = r.info.update.bind(r.info); r.info.update = (...a: any[]) => { w.__infoUpd = (w.__infoUpd ?? 0) + 1; return u(...a); }; });
  for (let i = 0; i < 3; i++) { await page.evaluate(() => { const w = window as any; w.__draws = 0; w.__renders = 0; w.__infoUpd = 0; }); await page.evaluate(() => (window as any).__parsa.renderOnce());
    console.log(JSON.stringify(await page.evaluate(() => { const w = window as any, s = w.__parsa.stats(); delete s.reliefs; return { ...s, backendDraws: w.__draws, renderCalls: w.__renders, infoUpdates: w.__infoUpd, frameCalls: w.__parsa.renderer.info.render.frameCalls }; }))); }
});
