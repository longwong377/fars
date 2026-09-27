import { test, expect } from '@playwright/test';
import { writeFileSync, mkdirSync } from 'node:fs';
import { lumStats } from './lib/lum';
// D-306: the carving (capitals and the Gate's colossi baked in Blender with the carving of the photographs, KTX2 maps)
// before/after in the full world, at the player's lens (FOV game) and quality (Q, default high), in ONE page load: the pattern
// of blender_hero.spec.ts (D-305): each view with the models ('after'), then the same instances swapped back to the procedural
// pieces and carved-stone material (window.__models.ab(false): 'before'). Views (grid e, n; eye 1.6 m; azimuth TRUE = grid +
// 341 deg; pitch up): the Gate of All Nations' W bull and E human-headed bull from their passages, the E pair from outside the
// E door, a W bull's head from outside the W door; a Tachara, a Harem and an Apadana (composite: volute and protome) capital.
//   node C:/Users/Administrator/fars-assets/gpu_slot.mjs carving -- "set E2E_PORT=5331&& set PW_CHANNEL=chrome&& npx playwright test tests/e2e/blender_carving.spec.ts --project=gpu"
const VIEWS: { n: string; v: [number, number, number, number, number] }[] = [
  { n: 'gate-w-bull-passage', v: [-9.0, 125.3, 1.6, 229.2, 21] },     // 8 m from the S W bull's chest, in the W passage
  { n: 'gate-w-bull-head', v: [-24.0, 124.6, 1.6, 92.7, 30] },         // outside the W door, the S bull's head 7 m off
  { n: 'gate-e-lamassu-passage', v: [9.0, 125.3, 1.6, 92.8, 21] },     // 8 m from the S E human-headed bull, in the E passage
  { n: 'gate-e-front', v: [30.0, 124.6, 1.6, 251, 12] },               // 14 m E of the E door: the pair from the front
  { n: 'tachara-portico', v: [-21.65, -82.7, 1.6, 20.4, 58] },        // 7.6 m from a Tachara capital (as D-305)
  { n: 'harem-hall', v: [112.5, -138, 1.6, 28.4, 45] },               // 9.2 m from a Harem hall capital (as D-305)
  { n: 'apadana-n-court', v: [1.9, 75, 1.6, 161, 30] },               // the N portico's composite capitals (volute + protome)
];
const HOURS = [{ day: 25, hour: 10 }, { day: 25, hour: 17.2 }];

test('The carving: capitals and Gate colossi before/after (D-306)', async ({ page }, info) => {
  test.setTimeout(+(process.env.TIMEOUT ?? 1800) * 1000);
  const errs: string[] = []; page.on('pageerror', e => errs.push(String(e))); page.on('console', m => { if (m.type() === 'error' || /\[models\]/.test(m.text())) errs.push(m.text().slice(0, 300)); });
  await page.setViewportSize({ width: +(process.env.W ?? 1600), height: +(process.env.H ?? 900) });
  const Q = process.env.Q ?? 'high';
  await page.goto(`/?test&quality=${Q}&day=${HOURS[0].day}&hour=${HOURS[0].hour}&weather=clear`);
  await page.waitForFunction(() => (window as any).__parsa?.ready === true, null, { timeout: 1_500_000 });
  await page.evaluate(() => (window as any).__parsa.renderer.setAnimationLoop(null));
  const models = await page.evaluate(() => (window as any).__models?.stats?.() ?? null);
  console.log('models', JSON.stringify(models));
  for (const id of ['capital_protome', 'capital_volute', 'colossus_bull', 'colossus_lamassu']) expect(models?.loaded ?? [], id + ' loaded').toContain(id);
  expect(Object.values(models?.formats ?? {}).every((f: any) => String(f).startsWith('compressed:')), 'every map on the GPU compressed (KTX2 transcoded)').toBe(true);
  mkdirSync('shots/carving', { recursive: true });
  const out: Record<string, any> = { models, q: Q, project: info.project.name };
  const frames = +(process.env.FRAMES ?? 8);
  const render = async () => { for (let i = 0; i < frames; i++) await page.evaluate(() => (window as any).__parsa.renderOnce()); };
  for (const h of HOURS) {
    if (h !== HOURS[0]) await page.evaluate(([d, hr]) => { const p = (window as any).__parsa; p.setWeather('clear'); p.setTime(d, hr); }, [h.day, h.hour] as const);
    for (const s of VIEWS) {
      const tag = `${s.n}-h${String(h.hour).replace('.', '')}`;
      await page.evaluate(v => (window as any).__parsa.view(...v, undefined), s.v);
      const res: any = {};
      for (const mode of ['after', 'before'] as const) {
        const swapped = await page.evaluate(on => (window as any).__models.ab(on), mode === 'after');
        await render();
        const png = await page.screenshot({ path: `shots/carving/${tag}-${mode}.png` });
        const st = await page.evaluate(() => { const P = (window as any).__parsa; const s = P.stats(); return { draws: s.drawCalls, tris: s.triangles }; });
        res[mode] = { ...st, swapped, lum: await lumStats(page, png) };
      }
      await page.evaluate(() => (window as any).__models.ab(true));
      out[tag] = res; console.log(tag, JSON.stringify(res));
    }
  }
  writeFileSync('shots/carving/carving.json', JSON.stringify({ ...out, errors: errs.slice(0, 20) }, null, 1));
  const gpu = errs.filter(e => /sampled textures|Invalid (ShaderModule|RenderPipeline|BindGroup|CommandBuffer)|WebGPU validation|GPUValidationError/i.test(e));
  expect(gpu, 'WebGPU validation errors: ' + gpu.slice(0, 3).join(' | ')).toEqual([]);
});
