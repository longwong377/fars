// `npm run bench`: runs benchmark mode (?bench=all) and writes bench-reports/<timestamp>.json. On the sandbox this runs
// on SwiftShader (numbers are not meaningful); on real hardware run it headed or open /?bench=all in Chrome/Edge.
import { test } from '@playwright/test';
import { mkdirSync, writeFileSync } from 'node:fs';
test('benchmark mode', async ({ page }) => {
  test.setTimeout(1_800_000);
  await page.goto(`/?bench=${process.env.ROUTES ?? 'all'}&quality=${process.env.QUALITY ?? 'ultra'}`);
  await page.waitForFunction(() => (window as any).__benchReport, null, { timeout: 1_700_000 });
  const r = await page.evaluate(() => (window as any).__benchReport);
  mkdirSync('bench-reports', { recursive: true }); writeFileSync(`bench-reports/${Date.now()}.json`, JSON.stringify(r, null, 2));
  console.log(JSON.stringify(r.routes));
});
