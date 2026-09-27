import { test, expect } from '@playwright/test';
import { writeFileSync, mkdirSync } from 'node:fs';
import { lumStats } from './lib/lum';
// D-305: the Blender-baked capital protome before/after, at the player's lens (FOV game) and quality (Q, default high), in ONE
// page load (the GPU box: ~11 min a load, 0.1 s a warm frame). Each view is rendered with the baked model ("after"), then with
// the same instances swapped back to the procedural protome and carved-stone material (window.__models.ab(false):
// "before"), then swapped back. Views: standing in the colonnades of the palaces whose capitals carry the double-bull
// protome, looking up at one (poses from the column grids of src/arch/terrace.ts; eye 1.6 m over the floor; azimuths TRUE,
// = grid + 341°, as __parsa.view takes them), at a morning
// and a late-afternoon hour. (Pitches raised after the first run, whose frames held the nearer columns' capitals at the top
// edge: the 70° lens takes in the next row's capitals first.) Run:
//   node C:/Users/Administrator/fars-assets/gpu_slot.mjs blender -- "set E2E_PORT=5321&& set PW_CHANNEL=chrome&& npx playwright test tests/e2e/blender_hero.spec.ts --project=gpu"
const VIEWS: { n: string; v: [number, number, number, number, number] }[] = [
  { n: 'apadana-w-portico', v: [-46.63, -4.9, 1.6, 359.4, 60] },     // 13.7 m from a W-portico bull capital (protome 16 m above the eye)
  { n: 'tachara-portico', v: [-21.65, -82.7, 1.6, 20.4, 58] },       // 7.6 m from a Tachara capital (LOD0)
  { n: 'harem-hall', v: [112.5, -138, 1.6, 28.4, 45] },            // 9.2 m from a Harem hall capital, in the roofed hall
  { n: 'hadish-hall', v: [18.1, -155.6, 1.6, 26, 55] },              // 8.3 m from a Hadish capital
  { n: 'hall100-hall', v: [140.2, -35.2, 1.6, 26, 55] },             // 13.2 m, the finished part of the Hall of 100 Columns
  { n: 'apadana-n-court', v: [1.9, 75, 1.6, 161, 30] },              // the N portico from the court: LOD0 near, LOD1 beyond 32 m
];
const HOURS = [{ day: 25, hour: 10 }, { day: 25, hour: 17.2 }];

test('Blender hero asset: capital protome before/after (D-305)', async ({ page }, info) => {
  test.setTimeout(+(process.env.TIMEOUT ?? 1800) * 1000);
  const errs: string[] = []; page.on('pageerror', e => errs.push(String(e))); page.on('console', m => { if (m.type() === 'error' || /\[models\]/.test(m.text())) errs.push(m.text().slice(0, 300)); });
  await page.setViewportSize({ width: +(process.env.W ?? 1600), height: +(process.env.H ?? 900) });
  const Q = process.env.Q ?? 'high';
  await page.goto(`/?test&quality=${Q}&day=${HOURS[0].day}&hour=${HOURS[0].hour}&weather=clear`);
  await page.waitForFunction(() => (window as any).__parsa?.ready === true, null, { timeout: 1_500_000 });
  await page.evaluate(() => (window as any).__parsa.renderer.setAnimationLoop(null));
  const models = await page.evaluate(() => (window as any).__models?.stats?.() ?? null);
  console.log('models', JSON.stringify(models));
  expect(models?.loaded ?? [], 'the capital protome model loaded').toContain('capital_protome');
  mkdirSync('shots/blender', { recursive: true });
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
        const png = await page.screenshot({ path: `shots/blender/${tag}-${mode}.png` });
        const st = await page.evaluate(() => { const P = (window as any).__parsa; const s = P.stats(); return { draws: s.drawCalls, tris: s.triangles }; });
        res[mode] = { ...st, swapped, lum: await lumStats(page, png) };
      }
      await page.evaluate(() => (window as any).__models.ab(true));
      out[tag] = res; console.log(tag, JSON.stringify(res));
    }
  }
  writeFileSync('shots/blender/hero.json', JSON.stringify({ ...out, errors: errs.slice(0, 20) }, null, 1));
  const gpu = errs.filter(e => /sampled textures|Invalid (ShaderModule|RenderPipeline|BindGroup|CommandBuffer)|WebGPU validation|GPUValidationError/i.test(e));
  expect(gpu, 'WebGPU validation errors: ' + gpu.slice(0, 3).join(' | ')).toEqual([]);
});
