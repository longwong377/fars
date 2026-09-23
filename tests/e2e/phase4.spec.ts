import { test } from '@playwright/test';
import { renderViews, expectClean, type P4View } from './lib/p4views';
// Phase 4b relief renders (D-049): a door-jamb relief at arm's length, the Tachara S stair façade, the Tripylon
// throne-bearers and a blocked-out Hall of 100 Columns jamb. The doors and windows are in phase4_doors.spec.ts.
const views: P4View[] = [
  { name: 'p4-tachara-jamb-king', v: [-21.55, -88.9, 1.6, 251, 14] },         // S doorway, W reveal, 0.95 m away: king under the parasol
  { name: 'p4-tachara-stair', v: [-21, -108.5, 1.6, 341, 4] },               // S stair: servants on the flights, guards and XPc
  { name: 'p4-tripylon-bearers', v: [89.5, -71.75, 1.6, 341, 22] },           // E doorway, N reveal: throne carried by the nations
  { name: 'p4-hall100-rough', v: [133.3, 6.0, 1.6, 251, 18] },                // N1 doorway, W reveal: blocked-out throne scene
];
test('phase 4b relief renders', async ({ page }) => {
  test.setTimeout(840_000);
  expectClean(await renderViews(page, views));
});
