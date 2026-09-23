import { test, expect } from '@playwright/test';
// People's bodies in the world (D-025…D-028): close-ups of a lineup of every dress on the plain west of the Grand Stair,
// the simulation's guards at the Gate and masons at work, and the draw-call / triangle cost of the crowd at the approach
// view and at the busiest slice views. Screenshots → shots/humans-*.png. Env: Q (quality), ONLY (shot names).
const az = (gridDeg: number) => gridDeg - 19; // grid heading → true azimuth
test('people bodies in the world', async ({ page }, info) => {
  test.setTimeout(2_400_000);
  const errs: string[] = []; page.on('pageerror', e => errs.push(String(e))); page.on('console', m => { if (m.type() === 'error') errs.push(m.text().slice(0, 300)); });
  await page.goto(`/?test&quality=${process.env.Q ?? 'test'}&day=25&hour=10`);
  await page.waitForFunction(() => (window as any).__parsa?.ready === true || (window as any).__parsa?.error, null, { timeout: 900_000 });
  const only = process.env.ONLY?.split(',');
  const shot = async (n: string, v: number[], frames = 3) => {
    if (only && !only.includes(n)) return;
    await page.evaluate(v => (window as any).__parsa.view(...v), v);
    for (let i = 0; i < frames; i++) await page.evaluate(() => (window as any).__parsa.renderOnce());
    const st = await page.evaluate(() => { const w = (window as any).__parsa; const s = w.stats(); return { drawCalls: s.drawCalls, triangles: s.triangles, humans: w.humans() }; });
    console.log(n, JSON.stringify(st));
    await page.screenshot({ path: `shots/humans-${n}-${info.project.name}.png` });
  };
  console.log('load', JSON.stringify(await page.evaluate(() => (window as any).__parsa.humans()?.load)));
  // the approach view (the frame budget's worst case so far) and the busiest slice views
  await shot('approach', [-175, 122.45, 1.6, az(90), 0]);
  await shot('masons', [146, 36, 2.2, az(180), -10]);
  await shot('gate-guards', [-30, 124.6, 1.6, az(90), -3]);
  await shot('guard-close', [-21.2, 120.9, 1.62, az(95), -4]);
  // a lineup of every dress on the plain west of the stair, faces from 1–2 m in daylight
  const specs = [{ dress: 'persian', sex: 'm', role: 'official', seed: 11 }, { dress: 'guard', sex: 'm', role: 'guard', seed: 12 }, { dress: 'median', sex: 'm', role: 'guard', seed: 13 },
    { dress: 'worker', sex: 'm', role: 'mason', seed: 14 }, { dress: 'woman', sex: 'f', role: 'grinder', seed: 21 }, { dress: 'child', sex: 'm', role: 'child', seed: 23 }];
  const E0 = -120, N0 = 110; // open plain, facing grid south (toward a camera placed south of them)
  await page.evaluate(([e, n, a]) => (window as any).__parsa.view(e + 2.25, n - 3.6, 1.55, a, -3), [E0, N0, az(0)]);
  const r = await page.evaluate(([e, n, s]) => (window as any).__parsa.humanLineup(e, n, 180, s), [E0, N0, specs] as any);
  console.log('lineup', JSON.stringify(r));
  await shot('lineup', [E0 + 2.25, N0 - 3.6, 1.55, az(0), -6]);
  for (let i = 0; i < specs.length; i++) await shot(`face-${specs[i].dress}`, [E0 + i * 0.9, N0 - 1.0, specs[i].dress === 'child' ? 1.1 : specs[i].dress === 'woman' ? 1.45 : 1.55, az(0), -2]);
  // load: 300 people in the Apadana forecourt (the rendered-floor target, §9.2), seen from the Gate's E door and from inside the crowd
  if (!only || only.includes('crowd300')) {
    await page.evaluate(() => (window as any).__parsa.humanCrowd(300, 0, 88, 20));
    await shot('crowd300', [0, 114, 1.7, az(180), -3]);
    await shot('crowd300-inside', [3, 92, 1.65, az(200), -3]);
  }
  console.log(errs.slice(0, 10).join('\n'));
  expect(errs).toEqual([]);
});
