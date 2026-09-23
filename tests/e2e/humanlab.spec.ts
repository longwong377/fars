import { test, expect } from '@playwright/test';
// Human lab (dev page): the human system alone under the game's sky, tone mapping and pipeline, for close-ups of faces,
// dress and poses. Screenshots → shots/humanlab-[TAG-]*.png (screenshots find problems; tests/humans*.test.ts measure).
// Env: Q (quality, default test), HOUR, ONLY (comma list of shot names; default: the 3 shots in DEFAULT, so the spec stays
// within the shared queue's limits: ≤ 4 views, < 15 min; ONLY=all runs every shot), HIGH=1 adds the high-quality view,
// TAG (a prefix for the screenshot names, so before/after runs do not overwrite each other).
// The 'stress' shot is the crowd stress view (D-093): 300 extras 2–20 m in front of the camera; it logs the frame's draw
// calls and triangles (renderer.info, every pass) and the crowd's own count (main pass and shadow casters).
const LINEUPS: Record<string, any[]> = {
  men: [{ dress: 'persian', sex: 'm', role: 'official', seed: 11 }, { dress: 'guard', sex: 'm', role: 'guard', seed: 12 }, { dress: 'median', sex: 'm', role: 'guard', seed: 13 }, { dress: 'worker', sex: 'm', role: 'mason', seed: 14 }],
  mixed: [{ dress: 'woman', sex: 'f', role: 'grinder', seed: 21 }, { dress: 'woman', sex: 'f', role: 'baker', seed: 22 }, { dress: 'child', sex: 'm', role: 'child', seed: 23 }, { dress: 'worker', sex: 'm', role: 'porter', seed: 24 }],
  // the known close-up faults: a Median official in the kandys (seed 31), a bareheaded Persian (36: hair, bun, long
  // beard), a seated porter with a short beard (34: the seated skirt), a bareheaded mason with a long beard (31)
  extra: [{ dress: 'median', sex: 'm', role: 'official', seed: 31 }, { dress: 'persian', sex: 'm', role: 'official', seed: 36 }, { dress: 'worker', sex: 'm', role: 'porter', seed: 34, anim: 'sit' }, { dress: 'worker', sex: 'm', role: 'mason', seed: 31 }],
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
  ['extra-full', 'extra', [0, 1.3, 3.6], [0, 0.95, 0]],
  ['extra-back', 'extra', [0.3, 1.5, -3.4], [0, 1.0, 0]],
  ['extra-side', 'extra', [3.4, 1.3, 1.2], [0, 0.9, 0]],
  ['macro-extra-persian', 'extra', [1, 0.5, 0.1], [0, 0, 0]],
  ['stress', 'stress', [0, 1.6, 4], [0, 1.2, -10]],
];
const DEFAULT = ['mixed-full', 'macro-persian', 'macro-woman2'];
const TAG = process.env.TAG ? `${process.env.TAG}-` : '';
test('human lab close-ups', async ({ page }, info) => {
  test.setTimeout(1_800_000);
  const t0 = Date.now(), el = () => `${((Date.now() - t0) / 1000).toFixed(0)} s`;
  const errs: string[] = []; page.on('pageerror', e => errs.push(String(e))); page.on('console', m => { if (m.type() === 'error' || m.type() === 'warning') errs.push(`${m.type()}: ${m.text().slice(0, 300)}`); });
  await page.goto(`/humanlab.html?test&quality=${process.env.Q ?? 'test'}&hour=${process.env.HOUR ?? 10}`);
  await page.waitForFunction(() => (window as any).__lab?.ready === true || (window as any).__lab?.error, null, { timeout: 900_000 });
  const err = await page.evaluate(() => (window as any).__lab.error); expect(err ?? null).toBeNull();
  console.log('load', el(), JSON.stringify(await page.evaluate(() => ({ load: (window as any).__lab.loadMs, total: (window as any).__lab.totalMs }))));
  const only = process.env.ONLY === 'all' ? null : process.env.ONLY?.split(',') ?? DEFAULT;
  let lastLineup = '';
  for (const [n, lu, c, t] of SHOTS) {
    if (only && !only.includes(n)) continue;
    if (lu === 'stress') { // 300 people 2–20 m ahead, in a 70° wedge (dresses and poses cycle); the camera at (0, 1.6, 4) looks along −Z
      await page.evaluate(([c, t]) => (window as any).__lab.view(c[0], c[1], c[2], t[0], t[1], t[2]), [c, t]);
      await page.evaluate(() => { const L = (window as any).__lab, cr = L.crowd; cr.removeExtras();
        const dresses = ['guard', 'median', 'persian', 'worker', 'woman', 'child'], anims = ['walk', 'idle', 'guard', 'chisel', 'grind', 'talk', 'sit', 'carry_shoulder'];
        for (let i = 0; i < 300; i++) { const dress = dresses[i % 6], d = 2 + 18 * Math.sqrt((i + 0.5) / 300), a = (((i * 0.618) % 1) - 0.5) * 1.2;
          cr.addExtra(`s${i}`, { id: -100 - i, sex: dress === 'woman' ? 'f' : 'm', role: dress === 'guard' ? 'guard' : dress === 'child' ? 'child' : 'mason', dress, seed: 5000 + i, x: d * Math.sin(a), y: 0, z: 4 - d * Math.cos(a), yaw: i, anim: anims[i % anims.length], look: null }); } });
      lastLineup = 'stress';
    } else {
      if (lu !== lastLineup) { await page.evaluate(() => (window as any).__lab.view(0, 1.5, 4, 0, 1.2, 0)); const r = await page.evaluate(s => (window as any).__lab.lineup(s), LINEUPS[lu]); console.log(lu, JSON.stringify(r)); lastLineup = lu; }
      // macro shots: [person index, distance, side offset] framed on that person's eyes; others: camera and target
      if (n.startsWith('macro-')) await page.evaluate(([c]) => (window as any).__lab.frameFace(c[0], c[1], c[2]), [c]);
      else await page.evaluate(([c, t]) => (window as any).__lab.view(c[0], c[1], c[2], t[0], t[1], t[2]), [c, t]);
    }
    await page.evaluate(() => (window as any).__lab.render(3));
    console.log(n, el(), JSON.stringify(await page.evaluate(() => (window as any).__lab.stats())));
    await page.screenshot({ path: `shots/humanlab-${TAG}${n}-${info.project.name}.png` });
  }
  console.log('done', el());
  console.log(errs.slice(0, 20).join('\n'));
  expect(errs.filter(e => !e.startsWith('warning'))).toEqual([]);
});
// The velocity path (TRAA at medium and above needs the previous-frame skinning) and SSGI at high quality.
test('human lab at high quality (TRAA, previous-frame skinning)', async ({ page }, info) => {
  test.skip(process.env.HIGH !== '1', 'HIGH=1 only (quality=high is for the one final check)');
  test.setTimeout(1_800_000);
  const errs: string[] = []; page.on('pageerror', e => errs.push(String(e))); page.on('console', m => { if (m.type() === 'error') errs.push(m.text().slice(0, 300)); });
  await page.goto(`/humanlab.html?test&quality=high&hour=${process.env.HOUR ?? 10}`);
  await page.waitForFunction(() => (window as any).__lab?.ready === true || (window as any).__lab?.error, null, { timeout: 900_000 });
  expect(await page.evaluate(() => (window as any).__lab.error ?? null)).toBeNull();
  await page.evaluate(() => (window as any).__lab.view(0, 1.5, 3.2, 0, 1.1, 0));
  await page.evaluate(() => (window as any).__lab.lineup([{ dress: 'guard', sex: 'm', role: 'guard', seed: 12, anim: 'walk' }, { dress: 'woman', sex: 'f', role: 'grinder', seed: 21 }, { dress: 'median', sex: 'm', role: 'scribe', seed: 31, anim: 'talk' }]));
  await page.evaluate(() => (window as any).__lab.render(8));
  console.log('high', JSON.stringify(await page.evaluate(() => (window as any).__lab.stats())));
  await page.screenshot({ path: `shots/humanlab-${TAG}high-full-${info.project.name}.png` });
  console.log(errs.slice(0, 10).join('\n'));
  expect(errs).toEqual([]);
});
