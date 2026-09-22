import { test } from '@playwright/test';
test('dbg', async ({ page }, info) => {
  const logs: string[] = []; page.on('console', m => logs.push(m.type() + ': ' + m.text().slice(0, 400))); page.on('pageerror', e => logs.push('PAGEERR ' + e));
  const webgl = info.project.name === 'webgl2' ? '&webgl=1' : '';
  await page.goto(`/?test&quality=test${webgl}&day=0&hour=9`);
  await page.waitForFunction(() => (window as any).__parsa?.ready === true, null, { timeout: 300_000 });
  await page.evaluate(() => { const w = (window as any).__parsa; w.view(-175, 122.45, 30, 71, -10); });
  await page.waitForTimeout(2500);
  await page.screenshot({ path: `shots/dbg-${info.project.name}.png` });
  console.log(logs.filter(l => !/deprecated|PCFSoft/.test(l)).slice(0, 15).join('\n'));
});
