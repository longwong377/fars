import { test } from '@playwright/test';
import { renderViews, expectClean, type P4View } from './lib/p4views';
// Phase 4b doors and windows (D-050, D-051): the Tachara hall S wall from inside with the door open, half-way and shut
// (two windows beside it), and a Treasury store door sealed as at night (knobs, cord, clay lump; door hour 20).
const views: P4View[] = [
  { name: 'p4-tachara-windows-open', v: [-21.3, -83.5, 1.6, 161, 4] },
  { name: 'p4-tachara-door-half', v: [-21.3, -83.5, 1.6, 161, 4], door: ['tachara:S_main', 0.5] },
  { name: 'p4-tachara-door-closed', v: [-21.3, -83.5, 1.6, 161, 4], door: ['tachara:S_main', 0] },
  { name: 'p4-treasury-sealing', v: [180.7, -92.0, 1.4, 161, -10], door: ['treasury:hall99', 0, 20] },
];
test('phase 4b door renders', async ({ page }) => {
  test.setTimeout(840_000);
  const logs = await renderViews(page, views);
  console.log('treasury doors', JSON.stringify(await page.evaluate(() => (window as any).__parsa.doors().filter((d: any) => d.id.startsWith('treasury')))));
  expectClean(logs);
});
