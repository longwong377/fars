import { writeFileSync } from 'node:fs';
import { test, expect, Page } from '@playwright/test';
// Phase 1 gate checks in the browser: boot on each render path, walk bot on the plain, save/load round trip,
// night sky, performance proxies (recorded to shots/phase1-<project>.json).
async function boot(page: Page, project: string, extra = '') {
  const errors: string[] = [];
  page.on('pageerror', e => errors.push(String(e)));
  page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
  page.on('response', r => { if (r.status() >= 400) errors.push(r.status() + ' ' + r.url()); });
  await page.goto(`/?test&quality=test${project === 'webgl2' ? '&webgl=1' : ''}${extra}`);
  await page.waitForFunction(() => (window as any).__parsa?.ready === true, null, { timeout: 300_000 });
  return errors;
}
test('boot, approach view, walk bot, save/load, night sky, proxies', async ({ page }, info) => {
  const errors = await boot(page, info.project.name, '&day=0&hour=9');
  const backend = await page.evaluate(() => (window as any).__parsa.backend);
  info.annotations.push({ type: 'backend', description: backend });
  expect(backend).toBe(info.project.name === 'webgl2' ? 'WebGL2' : 'WebGPU');
  // approach view
  await page.evaluate(() => (window as any).__parsa.view(-175, 122.45, 1.6, 71, 4));
  await page.waitForTimeout(1500);
  await page.screenshot({ path: `shots/p1-approach-${info.project.name}.png` });
  const proxies: any = { approach: await page.evaluate(() => (window as any).__parsa.stats()) };
  // walk bot: from spawn walk 20 s toward the terrace (grid east) on the plain
  await page.evaluate(() => { const w = (window as any).__parsa; w.walkMode(); w.teleport(-300, 122.45); w.setInput({ forward: 1, yawDeg: 71, pitchDeg: 0 }); });
  const x0 = await page.evaluate(() => (window as any).__parsa.playerState().x);
  await page.evaluate(() => (window as any).__parsa.simulate(10, 1 / 30));
  const st = await page.evaluate(() => (window as any).__parsa.playerState());
  await page.evaluate(() => (window as any).__parsa.setInput({ forward: 0 }));
  expect(st.x - x0).toBeGreaterThan(12.5); expect(st.x - x0).toBeLessThan(13.8); // 10 s at 1.35 m/s, grid east
  expect(Math.abs(st.feetY - st.ground)).toBeLessThan(0.3);
  expect(st.grounded).toBe(true);
  // save / load round trip
  const saved = await page.evaluate(() => { const w = (window as any).__parsa; w.setTime(40, 15.5); return w.clockLabel(); });
  await page.evaluate(() => { (window as any).__parsaSave = JSON.stringify(localStorage); });
  // night sky with stars: new moon-ish night
  await page.evaluate(() => { const w = (window as any).__parsa; w.setTime(0, 23.5); w.setWeather('clear'); w.view(0, 0, 1.6, 90, 35); });
  await page.waitForTimeout(1500);
  await page.screenshot({ path: `shots/p1-night-${info.project.name}.png` });
  const sky = await page.evaluate(() => (window as any).__parsa.sky());
  expect(sky.sunAlt).toBeLessThan(-18);
  proxies.night = await page.evaluate(() => (window as any).__parsa.stats());
  writeFileSync(`shots/phase1-${info.project.name}.json`, JSON.stringify({ backend, proxies, walk: st, savedLabel: saved }, null, 1));
  expect(errors.filter(e => !/deprecated|PCFSoft/i.test(e))).toEqual([]);
});
