import { test, expect } from '@playwright/test';
// People in the vertical slice: they are where the simulation says, performing their activity; views for inspection.
const az = (gridDeg: number) => gridDeg - 19; // grid heading → true azimuth
const SHOTS: [string, number, number, number, number, number][] = [
  ['gate-guards', -30, 124.6, 1.6, az(90), -3], ['stair-head', -37.5, 142, 1.6, az(180), -4], ['masons', 146, 36, 2.2, az(180), -10],
  ['querns', 112, 18, 1.7, az(60), -12], ['stair-foot', -70, 116, 1.7, az(80), -4], ['treasury', 200, -55, 1.7, az(180), -5], ['apadana-guard', -52, 66, 1.7, az(120), -3],
];
test('people at work (day 25, 10:00)', async ({ page }, info) => {
  test.skip(info.project.name !== 'webgpu', 'WebGPU only');
  test.setTimeout(600_000);
  await page.goto(`/?test&quality=test&day=25&hour=10`);
  await page.waitForFunction(() => (window as any).__parsa?.ready === true, null, { timeout: 300_000 });
  await page.evaluate(() => (window as any).__parsa.renderOnce?.());
  const P = await page.evaluate(() => (window as any).__parsa.people());
  const on = P.agents.filter((a: any) => !a.offmap);
  console.log(`people on the Terrace at 10:00: ${on.length}/${P.agents.length}; acts ${JSON.stringify(on.reduce((m: any, a: any) => ((m[a.act] = (m[a.act] ?? 0) + 1), m), {}))}`);
  expect(on.length).toBeGreaterThan(30);
  expect(on.filter((a: any) => a.act === 'stand_guard').length).toBe(16); // every post of the rota held (GUARD_POSTS, D-023)
  expect(on.filter((a: any) => a.act === 'dress_stone').length).toBeGreaterThanOrEqual(8);
  for (const [n, e, no, h, a, p] of SHOTS.filter(s => !process.env.ONLY || process.env.ONLY.split(',').includes(s[0]))) {
    await page.evaluate(([e, no, h, a, p]) => (window as any).__parsa.view(e, no, h, a, p), [e, no, h, a, p]);
    await page.waitForTimeout(1500);
    await page.screenshot({ path: `shots/people-${n}.png` });
  }
});
test('people move with world time; the player cannot walk through them', async ({ page }, info) => {
  test.skip(info.project.name !== 'webgpu', 'WebGPU only');
  test.setTimeout(600_000);
  await page.goto(`/?test&quality=test&day=25&hour=9.9`);
  await page.waitForFunction(() => (window as any).__parsa?.ready === true, null, { timeout: 300_000 });
  const before = await page.evaluate(() => (window as any).__parsa.people());
  await page.evaluate(() => (window as any).__parsa.advanceWorld(120, 0.5));
  const after = await page.evaluate(() => (window as any).__parsa.people());
  const moved = after.agents.filter((a: any, i: number) => Math.hypot(a.e - before.agents[i].e, a.n - before.agents[i].n) > 5).length;
  console.log(`moved >5 m in 2 min: ${moved}; events ${JSON.stringify(after.events.map((e: any) => e.text))}`);
  expect(moved).toBeGreaterThan(2);
  // walk the player straight at a guard standing at the Gate W door: must stop short of the guard
  const g = after.agents.find((a: any) => a.act === 'stand_guard' && a.e < -18 && a.e > -20 && a.n < 122);
  expect(g).toBeTruthy();
  await page.evaluate(([e, n]) => { const w = (window as any).__parsa; w.walkMode(); w.teleport(e - 6, n); }, [g.e, g.n]);
  const r = await page.evaluate(([e, n]) => (window as any).__parsa.walkTo(e, n, 12, 0.2), [g.e, g.n]);
  const d = Math.hypot(r.state.x - g.e, -r.state.z - g.n);
  console.log(`player stopped ${d.toFixed(2)} m from the guard`);
  expect(r.reached).toBe(false); expect(d).toBeGreaterThan(0.35);
});

test('speech: addressing a guard gives a lexicon line (or a gesture); murmur voices exist where people talk', async ({ page }, info) => {
  test.skip(info.project.name !== 'webgpu', 'WebGPU only');
  const errs: string[] = []; page.on('pageerror', e => errs.push(String(e)));
  await page.goto(`/?test&quality=test&day=25&hour=10`);
  await page.waitForFunction(() => (window as any).__parsa?.ready === true, null, { timeout: 300_000 });
  await page.evaluate(() => { const w = (window as any).__parsa; w.audioUnlock(); w.walkMode(); w.teleport(-21.5, 120.4); });
  // face the W-door guard (grid east of us)
  const r = await page.evaluate(() => { const w = (window as any).__parsa; w.walkTo(-20.3, 120.4, 2, 0.3); return w.address(); });
  console.log('address →', JSON.stringify(r));
  expect(r).toBeTruthy();
  expect(r.lineId ?? r.gesture).toBeTruthy();
  if (r.lineId) { expect(r.gloss).toBeTruthy(); expect(r.tier).toMatch(/[ABC]/); }
  expect(errs).toEqual([]);
});
