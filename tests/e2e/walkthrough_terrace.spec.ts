import { test, expect } from '@playwright/test';
import { walkRoute } from './lib/bot';
import { ROUTES } from './lib/routes';
// §13.8 walkthrough bots for Phase 4: every walkable area of the rest of the Terrace, one route per area, each starting
// on the open court. Checks: every leg reached (≤ 2 re-plans), floor levels of the palaces reached, no fall > 0.6 m,
// no people popping in within 50 m in view, no page errors. AREA=tachara,hadish,… runs a subset.
const AREAS = (process.env.AREA ?? Object.keys(ROUTES).join(',')).split(',');
for (const area of AREAS) test(`walkthrough bot, Phase 4: ${area}`, async ({ page }, info) => {
  test.skip(info.project.name !== 'webgpu', 'physics/nav are backend-independent');
  test.setTimeout(1_800_000);
  const R = ROUTES[area]; const errs: string[] = []; page.on('pageerror', e => errs.push(String(e)));
  await page.goto(`/?test&quality=test&day=25&hour=${process.env.HOUR ?? 9.5}`);
  await page.waitForFunction(() => (window as any).__parsa?.ready === true, null, { timeout: 300_000 });
  const { legs, minutes } = await walkRoute(page, R.start, R.targets);
  const popins = await page.evaluate(() => (window as any).__parsa.popins);
  console.log(area, JSON.stringify(legs)); console.log(`${area}: walked ${minutes.toFixed(1)} min of game time; pop-ins ${JSON.stringify(popins)}; errors ${errs.length}`);
  for (const l of legs) expect(l.ok, `${area} leg: ${l.what} (at ${l.e}, ${l.n}, y ${l.y})`).toBe(true);
  expect(legs.length).toBe(R.targets.length);
  for (const [what, y] of Object.entries(R.levels)) expect(legs.find(l => l.what === what)!.y, `${what} floor level`).toBeCloseTo(y, 1);
  for (const l of legs) expect(l.maxFall, `${area} fall during ${l.what}`).toBeLessThan(0.6);
  expect(popins).toEqual([]);
  expect(errs).toEqual([]);
});
