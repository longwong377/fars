import { test, expect } from '@playwright/test';
// Activity performances (D-142) in the human lab: every activity the simulation schedules, performed by the crowd with
// its tools, work objects and animals under the game's sky and pipeline; close-ups and 10-30 m views →
// shots/perf-<name>-<project>.png. Screenshots find problems; tests/performances.test.ts measures (grips, planting,
// ground rest, animals, the activity lint). Two page loads (one per test), within the shared queue's limits.
// Env: Q (quality, default test), ONLY (comma list of shot names).
type St = { act: string; why?: string; dress: string; sex: 'm' | 'f'; role: string; seed?: number; variant?: number; n?: number };
const M = (act: string, why = '', o: Partial<St> = {}): St => ({ act, why, dress: 'worker', sex: 'm', role: 'porter', ...o });
const F = (act: string, why = '', o: Partial<St> = {}): St => ({ act, why, dress: 'woman', sex: 'f', role: 'grinder', ...o });
// groups: stations in a row along x (spacing m), facing +Z
const G: Record<string, [St[], number]> = {
  fieldsA: [[M('field_work', 'hoeing and weeding the growing crop'), M('irrigate'), M('reap', 'reaping the barley'), M('reap', 'binding sheaves at the harvest')], 3.4],
  fieldsB: [[F('field_work', 'gleaning behind the reapers'), M('thresh', 'winnowing on the village floor'), M('dig_canal', 'clearing the village canal'), M('dig_canal', 'filling the silt baskets and carrying them out')], 5.2], // wide: the threshing floor's 4 m radius
  thresh: [[M('thresh', 'threshing: driving the animals round over the sheaves')], 0],
  plough: [[M('plough')], 0],
  animalsA: [[M('tend_animals', 'seeing to the household’s animals', { variant: -1 }), M('tend_animals', 'tending the relay horses'), F('tend_animals', 'with the ewes at lambing'), M('shear')], 4.2],
  animalsB: [[M('slaughter'), M('offer', 'the lan', { dress: 'median', role: 'official', variant: -1 }), M('offer', 'the lan', { dress: 'median', role: 'official', variant: 1 }), M('offer', 'the lan', { dress: 'median', role: 'official', variant: 0 })], 4.2],
  herd: [[M('herd')], 0],
  train: [[M('train', '', { dress: 'child', role: 'child' })], 0],
  haul: [[M('haul', 'hauling a drum up the ramp', { n: 3 })], 0],
  buildA: [[M('haul', 'building up the earth ramp'), M('haul', 'carrying dried bricks from the stacks to the wall'), M('mould_brick')], 3.8],
  buildB: [[M('lay_brick'), M('work_wood'), M('polish_metal', '', { role: 'mason' }), M('craft', 'mending tools and baskets')], 3.4],
  craft: [[M('craft', 'firing the kiln'), M('craft', 'making pigments'), M('craft', 'digging clay by the river'), F('weave')], 3.6],
  homeA: [[F('spin'), F('gather', 'gathering dung and brushwood for the fire'), F('gather', 'shaping dung cakes and setting them on the wall to dry'), F('brew')], 3.4],
  homeB: [[F('cook'), F('wash'), F('clean'), M('garden_work', 'hoeing and weeding the beds')], 3.4],
  orchard: [[M('garden_work', 'pruning the trees'), M('pick_fruit', 'the vintage: picking grapes'), M('pick_fruit', 'treading the picked grapes in the press'), M('carry_bier')], 4],
};
// [shot name, group, camera (x, y, z), target (x, y, z) — relative to the group's centre; time (s)]
type Shot = [string, string, number[], number[], number];
const PAGE1: Shot[] = [
  ['fields-a', 'fieldsA', [2, 2.3, 8.5], [0, 0.7, 0.5], 3.4], ['fields-b', 'fieldsB', [-1.5, 3.2, 12], [0, 0.6, 0.5], 3.4],
  ['thresh', 'thresh', [5, 3.2, 7.5], [0, 0.6, 1.2], 5], ['plough', 'plough', [12, 3.5, 8], [0, 0.8, 8], 4],
  ['animals-a', 'animalsA', [1, 2.6, 10.5], [0.5, 0.8, 0.8], 3.4], ['animals-b', 'animalsB', [-1, 2.6, 10.5], [-0.5, 0.8, 0.8], 3.4],
  ['herd', 'herd', [9, 4, 14], [0, 0.5, 2], 6], ['train', 'train', [-3, 1.9, -4.5], [0, 1.1, 8], 9.15], ['train-draw', 'train', [-3.6, 1.5, 1.6], [0, 1.2, 0.6], 9.15],
  ['fields-20m', 'fieldsA', [8, 5, 19], [0, 0.6, 0], 3.4],
];
const PAGE2: Shot[] = [
  ['haul', 'haul', [8, 2.6, 2], [0, 0.8, 2.5], 3.4], ['build-a', 'buildA', [2, 2.4, 7.5], [0, 0.7, 0.3], 3.4], ['build-b', 'buildB', [-2, 2.3, 8.5], [0, 0.6, 0.5], 3.4],
  ['craft', 'craft', [2, 2.3, 8.5], [0, 0.6, 0.5], 3.4], ['home-a', 'homeA', [-2, 2.2, 8.5], [0, 0.6, 0.5], 3.4],
  ['home-b', 'homeB', [2, 2.2, 8.5], [0, 0.6, 0.5], 3.4], ['orchard', 'orchard', [-1.5, 2.5, 10], [0, 0.8, 0.3], 3.4],
  ['haul-25m', 'haul', [18, 7, 18], [0, 0.6, 2], 3.4], ['animals-30m', 'animalsA', [-12, 8, 27], [0, 0.6, 0], 3.4],
];
const ORIGIN = [0, 0, 24]; // clear of the lab's backdrop wall

async function run(page: any, info: any, shots: Shot[]) {
  test.skip(info.project.name !== 'webgpu', 'WebGPU only');
  test.setTimeout(1_800_000);
  const errs: string[] = []; page.on('pageerror', (e: any) => errs.push(String(e))); page.on('console', (m: any) => { if (m.type() === 'error') errs.push(`${m.type()}: ${m.text().slice(0, 300)}`); });
  await page.goto(`/humanlab.html?test&quality=${process.env.Q ?? 'test'}&hour=10`);
  await page.waitForFunction(() => (window as any).__lab?.ready === true || (window as any).__lab?.error, null, { timeout: 900_000 });
  expect(await page.evaluate(() => (window as any).__lab.error ?? null)).toBeNull();
  const only = process.env.ONLY?.split(',');
  const stats: any[] = [];
  for (const [name, g, c, t, time] of shots) {
    if (only && !only.includes(name)) continue;
    const [sts, sp] = G[g], x0 = -((sts.length - 1) * sp) / 2;
    const placed = sts.map((s, i) => ({ ...s, x: ORIGIN[0] + x0 + i * sp, z: ORIGIN[2] }));
    await page.evaluate((p: any) => (window as any).__lab.stations(p), placed);
    await page.evaluate(([c, t]: number[][]) => (window as any).__lab.view(c[0], c[1], c[2] + 24, t[0], t[1], t[2] + 24), [c, t]);
    await page.evaluate((tt: number) => { const L = (window as any).__lab; L.at(tt); }, time);
    await page.evaluate(() => (window as any).__lab.render(3));
    const s = await page.evaluate(() => { const L = (window as any).__lab, S = L.stats(); return { drawCalls: S.drawCalls, triangles: S.triangles, backend: S.backend, props: S.crowd.props, propDraws: S.crowd.propDraws, things: S.crowd.things, animals: S.crowd.animals, placeholderActs: S.crowd.placeholderActs }; });
    console.log(name, JSON.stringify(s)); stats.push({ name, ...s });
    expect(s.placeholderActs, name).toBe(0);
    await page.screenshot({ path: `shots/perf-${name}-${info.project.name}.png` });
  }
  console.log(errs.slice(0, 20).join('\n'));
  expect(errs).toEqual([]);
  return stats;
}
test('activity performances: fields, animals, offering, archery', async ({ page }, info) => { await run(page, info, PAGE1); });
test('activity performances: building, crafts, household, orchard, the bier', async ({ page }, info) => { await run(page, info, PAGE2); });
