import { test } from '@playwright/test';
import { mkdirSync, writeFileSync } from 'node:fs';
// debug (D-219): weather you can see. One page load per state; per view the real frame and debug variants of the rain
// shafts (solid red = the mask, the real colour at full opacity, the shafts hidden), all at the real frame's exposure
// (carryEye), plus the live values: shafts, the weather uniforms, the sky, and what sits under a grid of screen points.
// Env: Q (test), VIEWS (comma list of names), TAG. Images: shots/wx-<name>-<variant>[-TAG].png; values: shots/wx-debug[-TAG].json.
const VIEWS = [
  { n: 'rain-approach', day: 299, hour: 11.45, w: 'auto', v: [-38, -5, 1.6, 232, 3], shafts: true },
  { n: 'rain-columns', day: 2, hour: 14, w: 'rain', v: [-20, 70, 1.6, 161, 4] },
  { n: 'snow-terrace', day: 280, hour: 10, w: 'snow', v: [-20, 70, 1.6, 161, 4] },
];
test('weather debug', async ({ page }, info) => {
  test.skip(info.project.name !== 'webgpu'); test.setTimeout(+(process.env.TIMEOUT ?? 2500) * 1000);
  const errs: string[] = []; page.on('pageerror', e => errs.push(String(e))); page.on('console', m => { if (m.type() === 'error' || m.type() === 'warning') errs.push(m.text().slice(0, 300)); });
  const only = process.env.VIEWS?.split(','), tag = process.env.TAG ? '-' + process.env.TAG : '';
  mkdirSync('shots', { recursive: true });
  const out: Record<string, any> = {};
  const shot = async (name: string) => { for (let i = 0; i < 2; i++) await page.evaluate(() => (window as any).__parsa.renderOnce()); await page.screenshot({ path: `shots/wx-${name}${tag}.png` }); };
  for (const s of VIEWS) {
    if (only && !only.includes(s.n)) continue;
    await page.goto(`/?test&quality=${process.env.Q ?? 'test'}&day=${s.day}&hour=${s.hour}&weather=${s.w}`);
    await page.waitForFunction(() => (window as any).__parsa?.ready === true, null, { timeout: 900_000 });
    await page.evaluate(() => (window as any).__parsa.renderer.setAnimationLoop(null));
    await page.evaluate(v => { const p = (window as any).__parsa; p.carryEye(null); p.view(...v, 40); }, s.v as any); // (the moments rig's outdoor lens, OUT = 40°)
    for (let i = 0; i < 6; i++) await page.evaluate(() => (window as any).__parsa.renderOnce());
    await page.screenshot({ path: `shots/wx-${s.n}-real${tag}.png` });
    const o: any = out[s.n] = {};
    o.exposure = await page.evaluate(() => (window as any).__parsa.exposureInfo());
    o.weather = await page.evaluate(() => (window as any).__parsa.weatherDbg());
    await page.evaluate(x => (window as any).__parsa.carryEye(x, 0), o.exposure.exposure); // hold the exposure for the variants
    o.picks = await page.evaluate(() => { const r: any[] = []; for (const y of [-0.9, -0.7, -0.5, -0.3]) for (const x of [-0.6, 0, 0.6]) r.push({ x, y, hit: (window as any).__parsa.pickW(x, y) }); return r; });
    o.transparents = await page.evaluate(() => { const sc = (window as any).__parsa.world.root.parent, r: any[] = [];
      sc.traverseVisible((m: any) => { if (m.isMesh && m.material && !Array.isArray(m.material) && (m.material.transparent || m.renderOrder > 1)) r.push({ n: m.name || m.parent?.name, ro: m.renderOrder, t: m.material.transparent, dt: m.material.depthTest, bl: m.material.blending, fog: m.material.fog, c: m.count }); });
      return r.slice(0, 40); });
    if (s.shafts) {
      const api = `window.__parsa.world.root.parent.getObjectByName('rain-shafts').userData.api`;
      o.shafts = await page.evaluate(`${api}.stats()`);
      await page.evaluate(`${api}.debug(1)`); await shot(`${s.n}-red`);
      await page.evaluate(`${api}.debug(4)`); await shot(`${s.n}-full`);
      await page.evaluate(`${api}.debug(0)`); await page.evaluate(`window.__parsa.world.root.parent.getObjectByName('rain-shafts').visible = false`); await shot(`${s.n}-none`);
      await page.evaluate(`window.__parsa.world.root.parent.getObjectByName('rain-shafts').visible = true`); await shot(`${s.n}-real2`);
      o.shafts2 = await page.evaluate(`${api}.stats()`);
    }
    console.log(s.n, JSON.stringify(o).slice(0, 4000));
  }
  out.errors = errs.slice(0, 20);
  writeFileSync(`shots/wx-debug${tag}.json`, JSON.stringify(out, null, 1));
  console.log('errors', errs.slice(0, 10).join('\n'));
});
