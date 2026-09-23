import { test } from '@playwright/test';
// debug: boot one quality level and log every console message / page error with timestamps (diagnosing hangs)
test('boot trace', async ({ page }, info) => {
  test.skip(info.project.name !== 'webgpu');
  test.setTimeout(1_200_000);
  const t0 = Date.now(); const ts = () => ((Date.now() - t0) / 1000).toFixed(1) + 's';
  page.on('console', m => console.log(ts(), 'console', m.type(), m.text().slice(0, 300)));
  page.on('pageerror', e => console.log(ts(), 'pageerror', String(e).slice(0, 500)));
  page.on('crash', () => console.log(ts(), 'CRASH'));
  await page.goto(`/?test&quality=${process.env.Q ?? 'high'}&day=60&hour=18.3&weather=clear`);
  for (let i = 0; i < 120; i++) {
    const st = await Promise.race([page.evaluate(() => { const p = (window as any).__parsa; return p ? { ready: p.ready, error: p.error } : null; }), new Promise(r => setTimeout(() => r('main thread busy'), 20_000))]);
    console.log(ts(), 'state', JSON.stringify(st)); if ((st as any)?.ready || (st as any)?.error) break;
    await page.waitForTimeout(8000);
  }
});
