// D-296 (UD-18, T-E9): the conversation lab on the real GPU (converse.html). Needs WebGPU and the models under public/models
// (tools/dev/fetch_models.mjs); skipped otherwise. Run: PW_CHANNEL=chrome E2E_PORT=5261 npx playwright test converse --project=gpu
// The whole T-E9 set and the measurements are run by tools/dev/converse_drive.mjs (the numbers in DECISIONS D-296).
import { test, expect } from '@playwright/test';
import { existsSync } from 'node:fs';

const MODEL = process.env.CONVERSE_MODEL ?? 'gemma-2-2b-it-q4f16_1-MLC';
test('a person answers in character, fenced, from their own life, within 4 s (a sample of the T-E9 set)', async ({ page }, info) => {
  test.skip(info.project.name !== 'gpu' || !existsSync('public/models/manifest.json'), 'needs the real GPU and the downloaded models');
  test.setTimeout(900_000);
  await page.goto('/converse.html');
  await page.waitForFunction('window.__lab && window.__lab.ready', null, { timeout: 120_000 });
  const adapter = await page.evaluate(() => (window as any).__lab.adapter()); test.skip(!adapter, 'no WebGPU adapter'); console.log('adapter', JSON.stringify(adapter));
  await page.evaluate(m => (window as any).__lab.load(m), MODEL);
  const rows: any[] = await page.evaluate(() => (window as any).__lab.testSet(72, 0, 12));
  for (const r of rows) console.log(r.pass ? 'ok ' : 'XX ', r.job, r.kind, '|', r.prompt, '=>', r.reply, '|', r.why.join('; '), Math.round(r.ms));
  expect(rows.length).toBe(12);
  expect(rows.filter(r => r.pass).length / rows.length).toBeGreaterThanOrEqual(0.5); // the sample's floor; T-E9 itself is measured on the whole set
});
