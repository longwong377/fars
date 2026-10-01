import { test, expect } from '@playwright/test';
// D-363 (T-E15): every body different, in the human lab (the human system alone under the game's sky and pipeline). A row of
// men and a row of women of many lives (labour, means, age, children, nursing, illness: looks.LookInput.life), standing and
// walking in place, from the front and the side; a frame cost of the crowd with and without the bodies' soft tissue.
// Screenshots → shots/bodies-*.png (screenshots find problems; tests/body_variety.test.ts measures).
const L = (o: any) => ({ id: 0, ...o });
const MEN = [
  L({ dress: 'worker', sex: 'm', role: 'porter', seed: 101, life: { ageYears: 24, labour: 1, wealth: 0.1 } }),
  L({ dress: 'persian', sex: 'm', role: 'official', seed: 102, life: { ageYears: 50, labour: 0.1, wealth: 0.95 } }),
  L({ dress: 'worker', sex: 'm', role: 'mason', seed: 103, life: { ageYears: 38, labour: 0.95, wealth: 0.25 } }),
  L({ dress: 'median', sex: 'm', role: 'scribe', seed: 104, life: { ageYears: 66, labour: 0.15, wealth: 0.6 } }),
  L({ dress: 'worker', sex: 'm', role: 'farmer', seed: 105, life: { ageYears: 30, labour: 0.8, wealth: 0.3, ill: 0.8 } }),
  L({ dress: 'guard', sex: 'm', role: 'guard', seed: 106, life: { ageYears: 27, labour: 0.7, wealth: 0.6 } }),
];
const WOMEN = [
  L({ dress: 'woman', sex: 'f', role: 'grinder', seed: 201, life: { ageYears: 19, labour: 0.8, wealth: 0.2 } }),
  L({ dress: 'woman', sex: 'f', role: 'homemaker', seed: 202, life: { ageYears: 28, parity: 3, nursing: true, wealth: 0.5 } }),
  L({ dress: 'woman', sex: 'f', role: 'weaver', seed: 203, life: { ageYears: 45, parity: 6, wealth: 0.7, labour: 0.4 } }),
  L({ dress: 'woman', sex: 'f', role: 'homemaker', seed: 204, life: { ageYears: 68, parity: 5, wealth: 0.3 } }),
  L({ dress: 'woman', sex: 'f', role: 'baker', seed: 205, life: { ageYears: 33, parity: 2, wealth: 0.9, labour: 0.3 } }),
  L({ dress: 'woman', sex: 'f', role: 'homemaker', seed: 206, life: { ageYears: 23, parity: 0, wealth: 0.4, ill: 0.7 } }),
];
const SHOTS: [string, any[], string, number[], number[]][] = [
  ['men-front', MEN, 'idle', [0, 1.4, 5.2], [0, 0.95, 0]],
  ['women-front', WOMEN, 'idle', [0, 1.35, 5.2], [0, 0.9, 0]],
  ['women-side', WOMEN, 'idle', [5.6, 1.3, 0.4], [0, 0.9, 0]],
  ['women-walk', WOMEN, 'walk', [0, 1.35, 5.2], [0, 0.9, 0]],
  ['women-walk-close', WOMEN, 'walk', [-1.6, 1.3, 1.6], [-2, 1.1, 0]],
];
test('bodies: every body different, soft tissue in walking', async ({ page }, info) => {
  test.setTimeout(1_800_000);
  const errs: string[] = []; page.on('pageerror', e => errs.push(String(e))); page.on('console', m => { if (m.type() === 'error' || m.type() === 'warning') errs.push(`${m.type()}: ${m.text().slice(0, 300)}`); });
  await page.goto(`/humanlab.html?test&quality=${process.env.Q ?? 'medium'}&hour=${process.env.HOUR ?? 10}`);
  await page.waitForFunction(() => (window as any).__lab?.ready === true || (window as any).__lab?.error, null, { timeout: 1_200_000 });
  expect(await page.evaluate(() => (window as any).__lab.error ?? null)).toBeNull();
  let last: any[] | null = null, lastAnim = '';
  for (const [n, row, anim, c, t] of SHOTS) {
    if (row !== last || anim !== lastAnim) { const r = await page.evaluate(([s, a]) => (window as any).__lab.lineup((s as any[]).map(x => ({ ...x, anim: a })), 0.9, false), [row, anim] as const); console.log(n, JSON.stringify(r.map((x: any) => [x.variant, x.stature]))); last = row; lastAnim = anim; }
    await page.evaluate(([c, t]) => (window as any).__lab.view(c[0], c[1], c[2], t[0], t[1], t[2]), [c, t]);
    await page.evaluate(k => (window as any).__lab.render(k, 1 / 30), anim === 'walk' ? 40 : 4);
    await page.screenshot({ path: `shots/bodies-${n}-${info.project.name}.png` });
    if (anim === 'walk') { await page.evaluate(() => (window as any).__lab.render(4, 1 / 30)); await page.screenshot({ path: `shots/bodies-${n}-b-${info.project.name}.png` }); }
  }
  // the spring offsets the walkers' rows carry (the palette's extra texels: breast springs, mm)
  const soft = await page.evaluate(() => { const L = (window as any).__lab, g = L.humans.gpu, out: number[] = []; for (const p of L.crowd.persons.values()) { const o = p.slot * 744 + 59 * 12 + 12; out.push(Math.round(Math.hypot(g.palette[o], g.palette[o + 1], g.palette[o + 2]) * 10000) / 10); } return out; });
  console.log('breast springs (mm)', JSON.stringify(soft));
  console.log(errs.slice(0, 20).join('\n'));
  expect(errs.filter(e => !e.startsWith('warning'))).toEqual([]);
  expect(errs.filter(e => /impostors\] the Cycles atlas/.test(e)), 'the impostor atlas is fresh').toEqual([]);
});
