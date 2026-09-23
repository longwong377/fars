import { test, expect } from '@playwright/test';
// Close-up views of the sculpted orders and colossi (D-018) and the carved-stone fixes (D-029..D-032), for judging the carving
// and the stone surfaces (screenshots find problems; the geometry is verified by tests/sculpt.test.ts). Views: an Apadana
// E-portico composite capital at capital height, lit by the morning sun; a human-headed winged bull of the Gate of All
// Nations E doorway; the W doorway's bull flank seen from inside the passage; the W doorway from the hall (door leaves
// against the inner wall face); the Apadana N doorway frame (polished dark grey limestone); Treasury columns (stone base,
// plastered shaft, timber capital). Weather is forced clear (WEATHER=auto to use the day's weather). Output:
// shots/sculpt-*.png. VIEWS=name,name… renders a subset.
// Run: npx playwright test -c playwright.sculpt.config.ts --project=webgpu   (SwiftShader: several minutes)
// view(east, north, eye above ground, azimuth from TRUE north (grid north = 341° true), pitch)
test('sculpted capital and colossus close-ups', async ({ page }) => {
  const logs: string[] = []; page.on('console', m => { if (m.type() === 'error' || m.type() === 'warning') logs.push(m.text().slice(0, 300)); }); page.on('pageerror', e => logs.push('PAGEERR ' + e));
  await page.goto(`/?test&quality=${process.env.Q ?? 'medium'}&day=60&hour=${process.env.HOUR ?? 9}&weather=${process.env.WEATHER ?? 'clear'}`);
  await page.waitForFunction(() => (window as any).__parsa?.ready === true || (window as any).__parsa?.error, null, { timeout: 600_000 });
  const views: [string, number, number, number, number, number][] = [
    // E portico, outer row: column at (54.75, −0.58); camera 7 m E-NE of it, eye 16 m above the podium (≈ capital)
    ['apadana-capital', 61.5, 2.2, 16, 228, 2],
    // E doorway of the Gate: the N lamassu (head at x ≈ 17.5, y ≈ 127.3) seen from the SE at eye height
    ['gate-lamassu', 24, 124, 1.6, 276, 14],
    // W doorway of the Gate, inside the passage: the S bull's carved flank (passage face n = 122.69), its fore-part beyond
    ['gate-bull-flank', -14.3, 126.2, 1.7, 181, 22],
    // the W doorway from inside the hall: open leaves against the inner wall face either side of the opening (D-032)
    ['gate-w-door-hall', -3, 124.6, 1.7, 251, 6],
    // Apadana N doorway from the N portico: the polished dark grey limestone frame (D-031)
    ['apadana-n-door', 1.9, 44.5, 1.7, 161, 14],
    // Treasury Hall of 99 Columns: stone bases, plastered shafts, timber capitals (D-029)
    ['treasury-columns', 175, -112, 1.7, 181, 6],
  ];
  const only = process.env.VIEWS ? process.env.VIEWS.split(',') : null;
  for (const [n, e, no, h, az, p] of views) {
    if (only && !only.includes(n)) continue;
    await page.evaluate(([e, no, h, az, p]) => (window as any).__parsa.view(e, no, h, az, p), [e, no, h, az, p]);
    for (let i = 0; i < 3; i++) await page.evaluate(() => (window as any).__parsa.renderOnce());
    await page.screenshot({ path: `shots/sculpt-${n}${process.env.SUFFIX ?? ''}.png` });
    console.log(n, JSON.stringify(await page.evaluate(() => (window as any).__parsa.stats())));
  }
  console.log(logs.slice(0, 12).join('\n'));
  expect(logs.filter(l => l.startsWith('PAGEERR'))).toEqual([]);
});
