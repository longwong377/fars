import { test } from '@playwright/test';
// debug: where the smoke layer (blue, D-220: landSmoke.ts) and the town's plumes (red) are drawn in the two dusk views (?smokedbg)
test('smoke debug', async ({ page }, info) => {
  test.skip(info.project.name !== 'webgpu'); test.setTimeout(840_000);
  await page.goto(`/?test&quality=${process.env.Q ?? 'test'}&day=0&hour=18.75&weather=clear&smokedbg`);
  await page.waitForFunction(() => (window as any).__parsa?.ready === true, null, { timeout: 600_000 });
  await page.evaluate(() => (window as any).__parsa.renderer.setAnimationLoop(null));
  for (const [tag, v] of [['terrace', [-50.5, -120, 1.6, 215, -3]], ['slope', [250, -650, 1.6, 228, -4]]] as [string, number[]][]) {
    await page.evaluate(v => (window as any).__parsa.view(...v), v);
    for (let i = 0; i < 4; i++) await page.evaluate(() => (window as any).__parsa.renderOnce());
    const st = await page.evaluate(() => { const P = (window as any).__parsa, sc = P.world.root; const L = P.world.smoke?.land, pl = sc.getObjectByName('settlement:smoke-plumes');
      return { layer: L ? { cells: L.count, inside: L.inside } : null, plumes: pl ? { vis: pl.visible, n: pl.geometry.instanceCount } : null, settle: P.world.settlement?.stats?.() ?? null, clock: P.clockLabel?.() }; });
    console.log(tag, JSON.stringify(st).slice(0, 1500));
    await page.screenshot({ path: `shots/dbg-smoke-${tag}.png` });
  }
});
