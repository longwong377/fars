import { test } from '@playwright/test';
// Camera-rig style fixed views for visual inspection (screenshots find problems; they never prove correctness).
const VIEWS: [string, number, number, number, number, number][] = [
  ['approach', -175, 122.45, 1.6, 71, 5], ['stair-foot', -60, 122.45, 1.6, 71, 18], ['gate-west', -26, 124.5, 1.6, 71, 8],
  ['apadana-forecourt', 0, 95, 1.6, 161, 6], ['apadana-hall', -8, 0, 4.6, 161, 12], ['aerial-nw', -260, 330, 160, 131, -28], ['aerial-top', 90, 0, 700, 161, -89],
];
test('fixed views', async ({ page }, info) => {
  test.skip(info.project.name !== 'webgpu' && !process.env.ALL_PATHS, 'views on WebGPU only unless ALL_PATHS');
  await page.goto(`/?test&quality=test&day=0&hour=${process.env.HOUR ?? 9}${info.project.name === 'webgl2' ? '&webgl=1' : ''}`);
  await page.waitForFunction(() => (window as any).__parsa?.ready === true, null, { timeout: 300_000 });
  for (const [n, e, no, h, az, p] of VIEWS) {
    await page.evaluate(([e, no, h, az, p]) => (window as any).__parsa.view(e, no, h, az, p), [e, no, h, az, p]);
    await page.waitForTimeout(1200);
    await page.screenshot({ path: `shots/view-${n}-${info.project.name}.png` });
  }
});
