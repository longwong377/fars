import { test, expect } from '@playwright/test';
// Close-up views of the sculpted orders and colossi (D-014), for judging the carving (screenshots find problems; the
// geometry is verified by tests/sculpt.test.ts). Views: an Apadana E-portico composite capital at capital height, lit
// by the morning sun; a human-headed winged bull of the Gate of All Nations E doorway. Output: shots/sculpt-*.png.
// Run: npx playwright test -c playwright.sculpt.config.ts --project=webgpu   (SwiftShader: several minutes)
test('sculpted capital and colossus close-ups', async ({ page }) => {
  const logs: string[] = []; page.on('console', m => { if (m.type() === 'error' || m.type() === 'warning') logs.push(m.text().slice(0, 300)); }); page.on('pageerror', e => logs.push('PAGEERR ' + e));
  await page.goto(`/?test&quality=${process.env.Q ?? 'medium'}&day=60&hour=${process.env.HOUR ?? 9}`);
  await page.waitForFunction(() => (window as any).__parsa?.ready === true || (window as any).__parsa?.error, null, { timeout: 600_000 });
  const views: [string, number, number, number, number, number][] = [
    // E portico, outer row: column at (54.75, −0.58); camera 7 m E-NE of it, eye 16 m above the podium (≈ capital)
    ['apadana-capital', 61.5, 2.2, 16, 228, 2],
    // E doorway of the Gate: the N lamassu (head at x ≈ 17.5, y ≈ 127.3) seen from the SE at eye height
    ['gate-lamassu', 24, 124, 1.6, 276, 14],
  ];
  for (const [n, e, no, h, az, p] of views) {
    await page.evaluate(([e, no, h, az, p]) => (window as any).__parsa.view(e, no, h, az, p), [e, no, h, az, p]);
    for (let i = 0; i < 3; i++) await page.evaluate(() => (window as any).__parsa.renderOnce());
    await page.screenshot({ path: `shots/sculpt-${n}.png` });
    console.log(n, JSON.stringify(await page.evaluate(() => (window as any).__parsa.stats())));
  }
  console.log(logs.slice(0, 12).join('\n'));
  expect(logs.filter(l => l.startsWith('PAGEERR'))).toEqual([]);
});
