import { test } from '@playwright/test';
import { mkdirSync, writeFileSync } from 'node:fs';
// debug (D-219): weather you can see. One page load per state; per stance the real frame and before/after variants, each
// at the stance's own real exposure (carryEye holds it), plus the live values: shafts, the weather uniforms, the sky.
//  rain-approach (day 299 11:27, the §1.1 moment's state):
//   out-*      a stance in the open on the Apadana platform's NW corner (grid −57, 55), looking 232° over the Terrace's W
//              edge: wet (the platform's wetness held 1, the shafts real), red (the shafts' mask), none (shafts hidden), front (shafts hidden and the cell's shadow and
//              wet ground off), dry (wetness held 0: the moment's own, 0.006)
//   portico-*  the moment's own stance (grid −38, −5, in the W portico): real (its exposure, 36 in run 1: the sky on the
//              tone curve's shoulder), and openexp / openexp-none at the open stance's exposure
//  snow-terrace (day 280 10:00, forced snow): real, nosnow (the snow cover held 0)
// Env: Q (test), VIEWS (comma list: rain-approach, snow-terrace), TAG. Images shots/wx-<view>-<variant>[-TAG].png;
// values shots/wx-debug[-TAG].json (written after each state, so a timeout keeps what was done).
test('weather debug', async ({ page }, info) => {
  test.skip(info.project.name !== 'webgpu'); test.setTimeout(+(process.env.TIMEOUT ?? 3400) * 1000);
  const errs: string[] = []; page.on('pageerror', e => errs.push(String(e))); page.on('console', m => { if (m.type() === 'error' || m.type() === 'warning') errs.push(m.text().slice(0, 300)); });
  const only = process.env.VIEWS?.split(','), tag = process.env.TAG ? '-' + process.env.TAG : '';
  mkdirSync('shots', { recursive: true });
  const out: Record<string, any> = {}, save = () => writeFileSync(`shots/wx-debug${tag}.json`, JSON.stringify({ ...out, errors: errs.slice(0, 20) }, null, 1));
  const P = 'window.__parsa', SH = `${P}.world.root.parent.getObjectByName('rain-shafts')`;
  const frames = async (n: number) => { for (let i = 0; i < n; i++) await page.evaluate(() => (window as any).__parsa.renderOnce()); };
  const shot = async (name: string, n = 2) => { await frames(n); await page.screenshot({ path: `shots/wx-${name}${tag}.png` }); console.log('shot', name); };
  const load = async (day: number, hour: number, w: string) => {
    await page.goto(`/?test&quality=${process.env.Q ?? 'test'}&day=${day}&hour=${hour}&weather=${w}`);
    await page.waitForFunction(() => (window as any).__parsa?.ready === true, null, { timeout: 1_200_000 });
    await page.evaluate(() => (window as any).__parsa.renderer.setAnimationLoop(null));
  };
  const stance = async (v: number[]) => { await page.evaluate(`${P}.carryEye(null); ${P}.view(${v.join(',')}, 40)`); await frames(4); return page.evaluate(`${P}.exposureInfo()`) as Promise<any>; };
  const hold = (x: number | null) => page.evaluate(`${P}.carryEye(${x ?? 'null'}, 0)`);
  if (!only || only.includes('rain-approach')) {
    await load(299, 11.45, 'auto'); const o: any = out['rain-approach'] = {};
    // the open stance
    o.outExposure = await stance([-57, 55, 1.6, 232, 3]); await hold(o.outExposure.exposure);
    await page.evaluate(`${P}.holdWeather({ wetness: 1 })`); await shot('rain-approach-out-wet', 1);
    o.weather = await page.evaluate(`${P}.weatherDbg()`); o.shafts = await page.evaluate(`${SH}.userData.api.stats()`);
    o.picks = await page.evaluate(`[[-0.5,-0.9],[0,-0.9],[0.5,-0.9],[0,-0.5],[0,-0.2]].map(([x,y]) => ({ x, y, hit: ${P}.pickW(x, y) }))`);
    await page.evaluate(`${SH}.userData.api.debug(1)`); await shot('rain-approach-out-red');
    await page.evaluate(`${SH}.userData.api.debug(0); ${SH}.visible = false`); await shot('rain-approach-out-none');
    await page.evaluate(`${P}.holdWeather({ wetness: 1, cell: 0 })`); await shot('rain-approach-out-front');
    await page.evaluate(`${SH}.visible = true; ${P}.holdWeather({ wetness: 0 })`); await shot('rain-approach-out-dry');
    await page.evaluate(`${P}.holdWeather(null)`); save();
    // the moment's own stance, its own exposure, then the open stance's
    o.porticoExposure = await stance([-38, -5, 1.6, 232, 3]); await hold(o.porticoExposure.exposure); await shot('rain-approach-portico-real', 1);
    await hold(o.outExposure.exposure); await shot('rain-approach-portico-openexp');
    await page.evaluate(`${SH}.visible = false`); await shot('rain-approach-portico-openexp-none');
    await page.evaluate(`${SH}.visible = true`); save();
  }
  if (!only || only.includes('snow-terrace')) {
    await load(280, 10, 'snow'); const o: any = out['snow-terrace'] = {};
    o.exposure = await stance([-20, 70, 1.6, 161, 4]); await hold(o.exposure.exposure); await shot('snow-terrace-real', 1);
    o.weather = await page.evaluate(`${P}.weatherDbg()`);
    await page.evaluate(`${P}.holdWeather({ snow: 0 })`); await shot('snow-terrace-nosnow');
    await page.evaluate(`${P}.holdWeather(null)`);
    o.picks = await page.evaluate(`[[-0.5,-0.9],[0,-0.9],[0.5,-0.9],[0,-0.5],[0,0]].map(([x,y]) => ({ x, y, hit: ${P}.pickW(x, y) }))`); save();
  }
  console.log(JSON.stringify(out).slice(0, 6000));
  console.log('errors', errs.slice(0, 10).join('\n'));
});
