import { test, expect } from '@playwright/test';
// Walk bot (§13.8 prototype): plain → Grand Stair (north half) → top landing → court → through the Gate of All Nations.
test('walk bot climbs the Grand Stair and passes through the Gate of All Nations', async ({ page }, info) => {
  test.skip(info.project.name !== 'webgpu' && !process.env.ALL_PATHS, 'physics is backend-independent');
  await page.goto('/?test&quality=test');
  await page.waitForFunction(() => (window as any).__parsa?.ready === true, null, { timeout: 300_000 });
  await page.evaluate(() => { const w = (window as any).__parsa; w.walkMode(); w.teleport(-43.85, 125.0); });
  const route: [number, number, string][] = [[-43.85, 153.5, 'lower flight → outer landing'], [-36.4, 154.2, 'across the landing to the E lane'],
    [-36.4, 120, 'upper flight → top landing'], [-20, 124.6, 'to the Gate W door'], [0.1, 124.6, 'inside the Gate'], [0.1, 104, 'out through the S door']];
  const out: any[] = [];
  for (const [e, n, what] of route) {
    const r = await page.evaluate(([e, n]) => (window as any).__parsa.walkTo(e, n, 90), [e, n]);
    out.push({ what, reached: r.reached, stuck: r.stuck, t: +r.t.toFixed(1), e: +r.state.x.toFixed(2), n: +(-r.state.z).toFixed(2), y: +r.state.feetY.toFixed(3) });
    if (!r.reached) break;
  }
  console.log(JSON.stringify(out, null, 0));
  for (const o of out) expect(o.reached, o.what).toBe(true);
  expect(out[0].y).toBeCloseTo(-12 + 63 * (12 / 111), 1);
  expect(Math.abs(out[2].y)).toBeLessThan(0.05);
  expect(Math.abs(out[5].y)).toBeLessThan(0.05);
});
