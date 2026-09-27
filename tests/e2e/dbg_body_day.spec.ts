import { test } from '@playwright/test';
import { mkdirSync, writeFileSync } from 'node:fs';
// D-292 (debug spec, DBG=1): candidate views for the body and the day, on ONE page load (day 30 08:30 first, the lane moment's own state, as moments.spec.ts loads it; setTime then moves the
// frozen world to 06:00). Each subject is a person tools/dev/body_find.ts found (seed 1); the spec looks the person up in
// the page's own view (world.people.view.visible), so the camera aims at where the page put them, and captures it from
// four sides at 3.2 m (the rig keeps nobody within 2.5 m). The chosen poses go into moments.spec.ts.
//   DBG=1 PW_CHANNEL=chrome E2E_PORT=5251 Q=high npx playwright test tests/e2e/dbg_body_day.spec.ts --project=gpu
// Measured (session 11, T4): ready after ~5 min; the first view took ~30 min of shader compiling, and each new subject ~6 min
// (the area streamed and its pipelines compiled): the 40-min budget covered 2 of 10 subjects. Give TIMEOUT 5400 or fewer subjects
const STATES: { day: number; hour: number; subjects: { tag: string; pid: number; at: [number, number]; also?: number }[] }[] = [
  { day: 30, hour: 8.5, subjects: [
    { tag: 'lane-p1082', pid: 1082, at: [-381.2, -1011.6] }, // spinning on the doorstep, due in 32 days (0.79)
    { tag: 'lane-p4537', pid: 4537, at: [-333.6, -898.3] }, // spinning on the doorstep, due in 22 days (0.86)
    { tag: 'lane-p1872', pid: 1872, at: [-427.9, -1014.0] }, // walking to the storehouse, due in 5 days (0.97)
    { tag: 'lane-p3028', pid: 3028, at: [-479.5, -905.9] }, // mending clothes on the doorstep, due in 33 days (0.78)
    { tag: 'comb-q90', pid: 1033, at: [-385.7, -987.8], also: 1035 }, // a boy's hair gone through for lice on the doorstep (the pair)
  ] },
  { day: 30, hour: 6.0, subjects: [
    { tag: 'wash-q35', pid: 3710, at: [-466.7, -1006.3], also: 3706 }, // a woman washing at rising; a woman with child (0.70) in the same court
    { tag: 'wash-q79', pid: 421, at: [-454.2, -960.5] },
    { tag: 'wash-q158', pid: 5414, at: [-355.1, -927.0] },
    { tag: 'wash-q191', pid: 4066, at: [-441.8, -850.4] },
    { tag: 'child-q136', pid: 1963, at: [-372.4, -944.6] }, // due in 11 days (belly 0.93), at home at 06:00
  ] },
];
test('body and day candidates', async ({ page }) => {
  test.setTimeout(+(process.env.TIMEOUT ?? 2400) * 1000);
  const errs: string[] = []; page.on('pageerror', e => errs.push(String(e))); page.on('console', m => { const t = m.text(); if (m.type() === 'error') errs.push(t.slice(0, 200)); else if (/probes|adapter|backend/i.test(t)) console.log('page:', t.slice(0, 300)); });
  mkdirSync('shots', { recursive: true }); const log: any[] = [];
  const S0 = STATES[0], t0 = Date.now();
  await page.goto(`/?test&quality=${process.env.Q ?? 'high'}&day=${S0.day}&hour=${S0.hour}&weather=clear`);
  await page.waitForFunction(() => (window as any).__parsa?.ready === true, null, { timeout: 1_800_000 });
  await page.evaluate(() => (window as any).__parsa.renderer.setAnimationLoop(null));
  console.log('ready after', ((Date.now() - t0) / 1000).toFixed(0), 's; backend', await page.evaluate(() => (window as any).__parsa.backend));
  const frames = process.env.FRAMES ? +process.env.FRAMES : 8;
  for (const [si, S] of STATES.entries()) {
    if (si > 0) { await page.evaluate(([d, h]) => (window as any).__parsa.setTime(d, h), [S.day, S.hour] as const); for (let i = 0; i < 3; i++) await page.evaluate(() => (window as any).__parsa.renderOnce()); }
    for (const sub of S.subjects) {
      // near the subject first, so the view settles the people round it; then its own place and heading from the page
      await page.evaluate(([e, n]) => (window as any).__parsa.view(e + 4, n + 4, 1.6, 0, -6), sub.at);
      for (let i = 0; i < 3; i++) await page.evaluate(() => (window as any).__parsa.renderOnce());
      const find = (pid: number) => page.evaluate((pid) => { const W = (window as any).__parsa.world, v = W.people.view.visible.find((x: any) => x.pid === pid);
        return v ? { e: v.e, n: v.n, heading: v.heading, act: v.act, why: v.why, what: v.what, moving: v.moving } : null; }, pid);
      const vp = await find(sub.pid), vp2 = sub.also !== undefined ? await find(sub.also) : null;
      const [e, n] = vp ? [vp.e, vp.n] : sub.at, hd = vp?.heading ?? 0;
      // the aim: the subject (or the middle between the two of a pair) at 1.0 m
      const [ae, an] = vp2 ? [(e + vp2.e) / 2, (n + vp2.n) / 2] : [e, n];
      const row: any = { tag: sub.tag, day: S.day, hour: S.hour, pid: sub.pid, vp, also: vp2, views: [] as any[] }; log.push(row);
      for (const [k, off] of [['r', 90], ['l', -90], ['f', 0], ['q', 45]] as const) {
        const b = (hd + off) * Math.PI / 180, dist = vp2 ? 4.5 : 3.2, ce = ae + Math.sin(b) * dist, cn = an + Math.cos(b) * dist;
        const g = (Math.atan2(ae - ce, an - cn) * 180 / Math.PI + 360) % 360, az = (g - 19 + 360) % 360, pitch = Math.atan2(1.0 - 1.6, dist) * 180 / Math.PI;
        const v: [number, number, number, number, number] = [+ce.toFixed(1), +cn.toFixed(1), 1.6, +az.toFixed(1), +pitch.toFixed(1)];
        await page.evaluate((v) => (window as any).__parsa.view(...v), v);
        for (let i = 0; i < frames; i++) await page.evaluate(() => (window as any).__parsa.renderOnce());
        const f = `shots/body-${sub.tag}-${k}-gpu.png`; await page.screenshot({ path: f }); row.views.push({ k, v, f });
      }
      console.log(JSON.stringify(row));
    }
  }
  writeFileSync('shots/body_day_candidates.json', JSON.stringify(log, null, 1));
  console.log('errors:', errs.slice(0, 5).join('\n'));
});
