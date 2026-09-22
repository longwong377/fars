import { test } from '@playwright/test';
test('relief views', async ({ page }) => {
  const logs: string[] = []; page.on('console', m => { if (m.type() === 'error') logs.push(m.text().slice(0, 300)); }); page.on('pageerror', e => logs.push('PAGEERR ' + e));
  await page.goto(`/?test&quality=${process.env.Q ?? 'test'}&day=0&hour=${process.env.HOUR ?? 8.5}`);
  await page.waitForFunction(() => (window as any).__parsa?.ready === true || (window as any).__parsa?.error, null, { timeout: 600_000 });
  const views: [string, number, number, number, number, number][] = [
    ['e-facade', 100, -5, 1.6, 251, 3], ['e-facade-close', 80, -12, 1.6, 251, 0], ['n-facade', 2, 80, 1.6, 161, 3], ['n-audience', 2, 66, 1.7, 161, 5],
    ['gate-reveal', 0.1, 124.6, 1.6, 71, 25], ['gate-east', 25, 124.6, 1.6, 251, 12]];
  for (const [n, e, no, h, az, p] of views) {
    await page.evaluate(([e, no, h, az, p]) => (window as any).__parsa.view(e, no, h, az, p), [e, no, h, az, p]);
    for (let i = 0; i < 3; i++) await page.evaluate(() => (window as any).__parsa.renderOnce());
    await page.screenshot({ path: `shots/relief-${n}.png` });
  }
  console.log(logs.slice(0, 8).join('\n'));
});
