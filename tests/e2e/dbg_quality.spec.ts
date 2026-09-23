import { test } from '@playwright/test';
import { lumStats } from './lib/lum';
// debug: one view at several quality levels / toggles, to isolate exposure and GI problems in the post pipeline.
// QS=high,high:1 renders high, then high with debug view 1 (scene pass only; 2 = AO, 3 = GI bounce).
test('quality comparison', async ({ page }, info) => {
  test.skip(info.project.name !== 'webgpu');
  test.setTimeout(2_400_000);
  const V = (process.env.V ?? '-20,72,1.6,161,2').split(',').map(Number);
  for (const q of (process.env.QS ?? 'test,medium,high').split(',')) {
    const [qd, extra] = q.split('+'); const [qq, dbg] = qd.split(':');
    await page.goto(`/?test&quality=${qq}&day=${process.env.DAY ?? 60}&hour=${process.env.HOUR ?? 18.3}&weather=clear${extra ? '&' + extra : ''}`);
    await page.waitForFunction(() => (window as any).__parsa?.ready === true, null, { timeout: 900_000 });
    await page.evaluate(v => (window as any).__parsa.view(...v), V);
    if (dbg) await page.evaluate(n => (window as any).__parsa.debugView(n), +dbg);
    for (let i = 0; i < 6; i++) await page.evaluate(() => (window as any).__parsa.renderOnce());
    const st = await page.evaluate(() => (window as any).__parsa.exposureInfo?.());
    const png = await page.screenshot({ path: `shots/dbgq-${q.replace(/[^a-z0-9]/gi, '_')}.png` });
    console.log(q, JSON.stringify(st), 'lum', JSON.stringify(await lumStats(page, png)));
  }
});
