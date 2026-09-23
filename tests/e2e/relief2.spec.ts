import { test, expect } from '@playwright/test';
// Two raking-light close-ups of the carved reliefs on the Apadana N stair (D-019): a noble/guard register at arm's length and a
// delegation register from 3 m. renderOnce waits for the streamed relief LODs (world.settle). Screenshots go to shots/.
test('carved relief close-ups', async ({ page }) => {
  const logs: string[] = []; page.on('console', m => { if (m.type() === 'error') logs.push(m.text().slice(0, 300)); }); page.on('pageerror', e => logs.push('PAGEERR ' + e));
  await page.goto(`/?test&quality=${process.env.Q ?? 'test'}&day=60&hour=${process.env.HOUR ?? 17.8}&weather=${process.env.WEATHER ?? 'clear'}`);
  await page.waitForFunction(() => (window as any).__parsa?.ready === true || (window as any).__parsa?.error, null, { timeout: 600_000 });
  // N façade: origin (1.9, 59.05), along −x (viewer's left → right), normal +n; wings at a ∈ ±[13.6, 29.4] (a = 1.9 − e)
  const views: [string, number, number, number, number, number][] = [['relief-close-nobles', 1.9 - 20, 59.05 + 0.9, 1.2, 161, -8], ['relief-close-delegations', 1.9 + 20, 59.05 + 3.0, 1.6, 161, 0]];
  for (const [n, e, no, h, az, p] of views) {
    await page.evaluate(([e, no, h, az, p]) => (window as any).__parsa.view(e, no, h, az, p), [e, no, h, az, p]);
    for (let i = 0; i < 2; i++) await page.evaluate(() => (window as any).__parsa.renderOnce());
    console.log(n, JSON.stringify(await page.evaluate(() => { const s = (window as any).__parsa.stats(); return { backend: s.backend, reliefs: s.reliefs }; })));
    await page.screenshot({ path: `shots/${n}${process.env.SUFFIX ?? ''}.png` });
  }
  console.log(logs.slice(0, 8).join('\n'));
  expect(logs.filter(l => /relief/i.test(l))).toEqual([]);
});
