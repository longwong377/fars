import { test, expect } from '@playwright/test';
// Visitor mode (D-063): walk from the Grand Stair head into the Gate of All Nations with the normal controller; the Gate
// guard stops the visitor; E shows the halmi and he is admitted; the courts beyond need an escort, who comes after a wait.
test('visitor mode: stopped at the Gate, the halmi, the escort', async ({ page }, info) => {
  test.skip(info.project.name !== 'webgpu');
  test.setTimeout(840_000);
  const errs: string[] = []; page.on('pageerror', e => errs.push(String(e)));
  await page.goto('/?test&quality=test&day=30&hour=10&weather=clear&visitor&tl');
  await page.waitForFunction(() => (window as any).__parsa?.ready === true, null, { timeout: 600_000 });
  await page.evaluate(() => (window as any).__parsa.renderer.setAnimationLoop(null));
  const log = () => page.evaluate(() => ((window as any).__parsa.world.visitor.log() as any[]).map(l => l.text).join(' | '));
  await page.evaluate(() => { const w = (window as any).__parsa; w.walkMode(); w.teleport(-28, 121.5); w.simulate(1, 1 / 60); });
  // into the Gate: stopped at its W door
  const r1 = await page.evaluate(() => (window as any).__parsa.walkTo(0.1, 124.6, 30, 0.6, 1 / 30));
  console.log('walk 1', JSON.stringify({ reached: r1.reached, x: r1.state.x, n: -r1.state.z }), await log());
  expect(r1.reached).toBe(false); expect(r1.state.x).toBeLessThan(-15);
  expect(await log()).toMatch(/sealed document/);
  // E: show the halmi to the guard who stopped him
  await page.keyboard.press('KeyE');
  expect(await log()).toMatch(/show the halmi/);
  const r2 = await page.evaluate(() => (window as any).__parsa.walkTo(0.1, 124.6, 60, 0.8, 1 / 30));
  console.log('walk 2', JSON.stringify({ reached: r2.reached, x: r2.state.x, n: -r2.state.z }));
  expect(r2.reached).toBe(true);
  // beyond the Gate's S door: not alone; after the wait an escort walks with him
  const r3 = await page.evaluate(() => (window as any).__parsa.walkTo(0, 90, 30, 0.8, 1 / 30));
  console.log('walk 3', JSON.stringify({ reached: r3.reached, x: r3.state.x, n: -r3.state.z }), await log());
  expect(r3.reached).toBe(false); expect(await log()).toMatch(/not walk here alone/);
  // the test world's clock is frozen (scale 0): move it on six minutes, then take a step so the visitor sees the time
  await page.evaluate(() => (window as any).__parsa.setTime(30, 10 + 6 / 60));
  const r4 = await page.evaluate(() => (window as any).__parsa.walkTo(0, 90, 60, 0.8, 1 / 30));
  console.log('walk 4', JSON.stringify({ reached: r4.reached, x: r4.state.x, n: -r4.state.z }), await log());
  expect(await page.evaluate(() => (window as any).__parsa.world.visitor.state().escorted)).toBe(true);
  expect(r4.reached).toBe(true);
  await page.evaluate(() => (window as any).__parsa.renderOnce());
  await page.screenshot({ path: 'shots/visitor-escort-webgpu.png' });
  console.log(errs.slice(0, 5).join('\n')); expect(errs).toEqual([]);
});
