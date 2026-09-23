import { test, expect } from '@playwright/test';
// Human lab (dev page): the human system alone under the game's sky, tone mapping and pipeline, for close-ups of faces,
// dress and poses. Screenshots → shots/humanlab-*.png (screenshots find problems; tests/humans*.test.ts measure).
// Env: Q (quality, default test), HOUR, ONLY (comma list of shot names).
const LINEUPS: Record<string, any[]> = {
  men: [{ dress: 'persian', sex: 'm', role: 'official', seed: 11 }, { dress: 'guard', sex: 'm', role: 'guard', seed: 12 }, { dress: 'median', sex: 'm', role: 'guard', seed: 13 }, { dress: 'worker', sex: 'm', role: 'mason', seed: 14 }],
  mixed: [{ dress: 'woman', sex: 'f', role: 'grinder', seed: 21 }, { dress: 'woman', sex: 'f', role: 'baker', seed: 22 }, { dress: 'child', sex: 'm', role: 'child', seed: 23 }, { dress: 'worker', sex: 'm', role: 'porter', seed: 24 }],
};
// [name, lineup, camera (x, y, z), target (x, y, z)]
const SHOTS: [string, string, number[], number[]][] = [
  ['men-full', 'men', [0, 1.5, 4.2], [0, 1.0, 0]],
  ['mixed-full', 'mixed', [0, 1.4, 4.2], [0, 0.9, 0]],
  ['face-persian', 'men', [-1.2, 1.62, 0.95], [-1.2, 1.55, 0]],
  ['face-guard', 'men', [-0.4, 1.62, 0.95], [-0.4, 1.55, 0]],
  ['face-median', 'men', [0.4, 1.62, 0.95], [0.4, 1.55, 0]],
  ['face-worker', 'men', [1.2, 1.62, 0.95], [1.2, 1.55, 0]],
  ['face-woman', 'mixed', [-1.2, 1.5, 0.95], [-1.2, 1.44, 0]],
  ['face-child', 'mixed', [0.4, 1.1, 0.9], [0.4, 1.02, 0]],
  ['macro-persian', 'men', [0, 0.5, 0], [0, 0, 0]],
  ['macro-guard', 'men', [1, 0.5, 0.12], [0, 0, 0]],
  ['macro-median', 'men', [2, 0.5, 0], [0, 0, 0]],
  ['macro-worker', 'men', [3, 0.5, -0.15], [0, 0, 0]],
  ['macro-woman', 'mixed', [0, 0.5, 0], [0, 0, 0]],
  ['macro-woman2', 'mixed', [1, 0.5, 0.1], [0, 0, 0]],
  ['macro-child', 'mixed', [2, 0.45, 0], [0, 0, 0]],
  ['men-side', 'men', [3.2, 1.5, 0.6], [0, 1.0, 0]],
  ['men-back', 'men', [0.5, 1.6, -3.5], [0, 1.0, 0]],
];
test('human lab close-ups', async ({ page }, info) => {
  test.setTimeout(1_800_000);
  const errs: string[] = []; page.on('pageerror', e => errs.push(String(e))); page.on('console', m => { if (m.type() === 'error' || m.type() === 'warning') errs.push(`${m.type()}: ${m.text().slice(0, 300)}`); });
  await page.goto(`/humanlab.html?test&quality=${process.env.Q ?? 'test'}&hour=${process.env.HOUR ?? 10}`);
  await page.waitForFunction(() => (window as any).__lab?.ready === true || (window as any).__lab?.error, null, { timeout: 900_000 });
  const err = await page.evaluate(() => (window as any).__lab.error); expect(err ?? null).toBeNull();
  console.log('load', JSON.stringify(await page.evaluate(() => ({ load: (window as any).__lab.loadMs, total: (window as any).__lab.totalMs }))));
  const only = process.env.ONLY?.split(',');
  let lastLineup = '';
  for (const [n, lu, c, t] of SHOTS) {
    if (only && !only.includes(n)) continue;
    if (lu !== lastLineup) { await page.evaluate(() => (window as any).__lab.view(0, 1.5, 4, 0, 1.2, 0)); const r = await page.evaluate(s => (window as any).__lab.lineup(s), LINEUPS[lu]); console.log(lu, JSON.stringify(r)); lastLineup = lu; }
    // macro shots: [person index, distance, side offset] framed on that person's eyes; others: camera and target
    if (n.startsWith('macro-')) await page.evaluate(([c]) => (window as any).__lab.frameFace(c[0], c[1], c[2]), [c]);
    else await page.evaluate(([c, t]) => (window as any).__lab.view(c[0], c[1], c[2], t[0], t[1], t[2]), [c, t]);
    await page.evaluate(() => (window as any).__lab.render(3));
    console.log(n, JSON.stringify(await page.evaluate(() => (window as any).__lab.stats())));
    await page.screenshot({ path: `shots/humanlab-${n}-${info.project.name}.png` });
  }
  console.log(errs.slice(0, 20).join('\n'));
  expect(errs.filter(e => !e.startsWith('warning'))).toEqual([]);
});
// The velocity path (TRAA at medium and above needs the previous-frame skinning) and SSGI at high quality.
test('human lab at high quality (TRAA, previous-frame skinning)', async ({ page }, info) => {
  test.skip(!!process.env.ONLY && !process.env.ONLY.includes('high'), 'ONLY filter');
  test.setTimeout(1_800_000);
  const errs: string[] = []; page.on('pageerror', e => errs.push(String(e))); page.on('console', m => { if (m.type() === 'error') errs.push(m.text().slice(0, 300)); });
  await page.goto(`/humanlab.html?test&quality=high&hour=${process.env.HOUR ?? 10}`);
  await page.waitForFunction(() => (window as any).__lab?.ready === true || (window as any).__lab?.error, null, { timeout: 900_000 });
  expect(await page.evaluate(() => (window as any).__lab.error ?? null)).toBeNull();
  await page.evaluate(() => (window as any).__lab.view(0, 1.5, 3.2, 0, 1.1, 0));
  await page.evaluate(() => (window as any).__lab.lineup([{ dress: 'guard', sex: 'm', role: 'guard', seed: 12, anim: 'walk' }, { dress: 'woman', sex: 'f', role: 'grinder', seed: 21 }, { dress: 'median', sex: 'm', role: 'scribe', seed: 31, anim: 'talk' }]));
  await page.evaluate(() => (window as any).__lab.render(8));
  console.log('high', JSON.stringify(await page.evaluate(() => (window as any).__lab.stats())));
  await page.screenshot({ path: `shots/humanlab-high-full-${info.project.name}.png` });
  await page.evaluate(() => (window as any).__lab.frameFace(1, 0.6, 0.1));
  await page.evaluate(() => (window as any).__lab.render(8));
  await page.screenshot({ path: `shots/humanlab-high-face-${info.project.name}.png` });
  console.log(errs.slice(0, 10).join('\n'));
  expect(errs).toEqual([]);
});
