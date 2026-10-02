// D-395: the reactions to the stranger played on real people in the human lab (seconds to load, no world): each of six
// lineup people plays one kind toward a point to their right, and the pose the rig solves is read back (head yaw, the bow's
// chest, the greeting's hand). Screenshot → shots/react-<project>.png (screenshots find problems; the numbers measure).
//   node tools/dev/gpu_slot.mjs react -- npx playwright test tests/e2e/react.spec.ts --project=gpu   (PW_CHANNEL=chrome)
import { test, expect } from '@playwright/test';

const KINDS = ['greet', 'bow', 'nod', 'stare', 'avoid', 'turn'];
test('reactions to the stranger on the lab’s people', async ({ page }, info) => {
  test.setTimeout(600_000);
  const errs: string[] = []; page.on('pageerror', e => errs.push(String(e)));
  await page.goto('/humanlab.html?test&quality=test&hour=10');
  await page.waitForFunction(() => (window as any).__lab?.ready === true || (window as any).__lab?.error, null, { timeout: 500_000 });
  expect(await page.evaluate(() => (window as any).__lab.error ?? null)).toBeNull();
  await page.evaluate(() => { const L = (window as any).__lab; L.view(0, 1.5, 4.5, 0, 1.2, 0);
    L.lineup(['persian', 'guard', 'worker', 'woman', 'child', 'median'].map((dress, i) => ({ dress, sex: dress === 'woman' ? 'f' : 'm', role: dress === 'guard' ? 'guard' : dress === 'child' ? 'child' : 'mason', seed: 70 + i })), 0.9, false); });
  await page.evaluate(() => (window as any).__lab.render(2));
  const before = await page.evaluate(() => [0, 1, 2, 3, 4, 5].map(i => (window as any).__lab.rot(i)));
  // the stranger stands 3 m to their right (+x) and a little ahead
  await page.evaluate(k => k.forEach((kind, i) => (window as any).__lab.react(i, kind, [4, 1.7, 2])), KINDS);
  await page.evaluate(() => (window as any).__lab.render(36, 1 / 30)); // 1.2 s: the nod and the bow at their depth
  const after = await page.evaluate(() => [0, 1, 2, 3, 4, 5].map(i => (window as any).__lab.rot(i)));
  await page.screenshot({ path: `shots/react-${info.project.name}.png` });
  const yaw = (r: any) => r?.head?.[1] ?? 0;
  const rows = KINDS.map((k, i) => ({ k, yaw0: +yaw(before[i]).toFixed(2), yaw: +yaw(after[i]).toFixed(2), chest: after[i]?.chest?.map((x: number) => +x.toFixed(2)), arm: after[i]?.r_upper?.map((x: number) => +x.toFixed(2)) }));
  console.log(JSON.stringify(rows));
  for (const r of rows) if (r.k !== 'avoid' && r.k !== 'bow') expect(r.yaw - r.yaw0, r.k).toBeGreaterThan(0.3);
  expect(rows[4].yaw - rows[4].yaw0, 'avoid: away').toBeLessThan(-0.3);
  expect(rows[1].chest[0], 'bow from the chest').toBeGreaterThan(0.2);
  expect(errs).toEqual([]);
});
