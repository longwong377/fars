import { test } from '@playwright/test';
test('dbg quality', async ({ page }) => {
  const logs: string[] = []; page.on('console', m => { if (m.type() === 'error' || m.type() === 'warning') logs.push(m.text().slice(0, 300)); }); page.on('pageerror', e => logs.push('PAGEERR ' + e));
  const q = process.env.Q ?? 'high';
  await page.goto(`/?test&quality=${q}&day=0&hour=${process.env.HOUR ?? 9}&weather=${process.env.W ?? 'auto'}`);
  await page.waitForFunction(() => (window as any).__parsa?.ready === true, null, { timeout: 600_000 });
  for (const [n, e, no, h, az, p] of ([['forecourt', 0, 95, 1.6, 161, 6], ['approach', -175, 122.45, 1.6, 71, 5], ['hall', -8, 0, 4.6, 161, 12]] as any).slice(0, +(process.env.NV ?? 3))) {
    await page.evaluate(([e, no, h, az, p]) => (window as any).__parsa.view(e, no, h, az, p), [e, no, h, az, p]);
    for (let i = 0; i < +(process.env.FR ?? 6); i++) await page.evaluate(() => (window as any).__parsa.renderOnce());
    await page.screenshot({ path: `shots/q-${q}-${n}.png` });
  }
  console.log(logs.filter(l => !/deprecated|PCFSoft|experimental/.test(l)).slice(0, 10).join('\n'));
});
