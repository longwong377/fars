import { test, expect } from '@playwright/test';
test('boots, renders the approach view, reports its backend', async ({ page }, info) => {
  const errors: string[] = [];
  page.on('pageerror', e => errors.push(String(e))); page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
  page.on('response', r => { if (r.status() >= 400) errors.push(r.status() + ' ' + r.url()); });
  const webgl = info.project.name === 'webgl2' ? '&webgl=1' : '';
  await page.goto(`/?test&quality=test${webgl}&day=0&hour=9`);
  await page.waitForFunction(() => (window as any).__parsa?.ready === true, null, { timeout: 300_000 });
  const backend = await page.evaluate(() => (window as any).__parsa.backend);
  info.annotations.push({ type: 'backend', description: backend });
  expect(backend).toBe(info.project.name === 'webgl2' ? 'WebGL2' : 'WebGPU');
  await page.evaluate(() => (window as any).__parsa.view(-175, 122.45, 1.6, 71, 4));
  await page.waitForTimeout(3000);
  await page.screenshot({ path: `shots/smoke-${info.project.name}.png` });
  const stats = await page.evaluate(() => (window as any).__parsa.stats());
  console.log(info.project.name, JSON.stringify(stats));
  expect(errors.filter(e => !/favicon/.test(e))).toEqual([]);
});
