import { test, expect } from '@playwright/test';
test('audio engine runs: context running, reverb space switches between open air, the Gate and the Apadana hall', async ({ page }, info) => {
  test.skip(info.project.name !== 'webgpu', 'audio independent of render path');
  const errs: string[] = []; page.on('pageerror', e => errs.push(String(e)));
  await page.goto('/?test&quality=test&day=40&hour=7');
  await page.waitForFunction(() => (window as any).__parsa?.ready === true, null, { timeout: 300_000 });
  await page.evaluate(() => (window as any).__parsa.audioUnlock());
  const spaces: string[] = [];
  for (const v of [[-175, 122.45, 1.6, 71, 0], [0.1, 124.6, 1.6, 71, 0], [-8, 0, 4.6, 161, 0]]) {
    await page.evaluate(v => (window as any).__parsa.view(...v), v);
    for (let i = 0; i < 3; i++) await page.evaluate(() => (window as any).__parsa.renderOnce());
    spaces.push((await page.evaluate(() => (window as any).__parsa.audioState())).space);
  }
  const st = await page.evaluate(() => (window as any).__parsa.audioState());
  console.log(JSON.stringify({ st, spaces }));
  expect(st.ctx).toBe('running'); expect(spaces).toEqual(['open', 'gate_nations', 'apadana']); expect(errs).toEqual([]);
});
