import { test } from '@playwright/test';
import { writeFileSync } from 'node:fs';
test('subsystem micro-benchmarks', async ({ page }, info) => {
  await page.goto(`/bench/subsystems.html${info.project.name === 'webgl2' ? '?webgl' : ''}`);
  await page.waitForFunction(() => (window as any).__results, null, { timeout: 300_000 });
  const r = await page.evaluate(() => (window as any).__results);
  writeFileSync(`shots/subsystems-${info.project.name}.json`, JSON.stringify(r, null, 1)); console.log(JSON.stringify(r));
});
