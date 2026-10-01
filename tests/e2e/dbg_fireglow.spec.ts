import { test, expect } from '@playwright/test';
// D-355: the deferred far fires (src/render/fireGlow.ts) compile and light the G-buffer in the post composite. The human lab
// at high (its pipeline is the world's), at night: one deferred light 1.5 m in front of the line-up; the centre's luminance
// with the term on vs off (__parsaSurf.fireglow), and the console clean.
// DBG=1 PW_CHANNEL=chrome npx playwright test tests/e2e/dbg_fireglow.spec.ts --project=gpu
test('fire glow: the deferred fire term compiles and lights the line-up', async ({ page }) => {
  test.setTimeout(1_200_000);
  const errs: string[] = []; page.on('console', m => { if (m.type() === 'error') errs.push(m.text().slice(0, 400)); });
  await page.setViewportSize({ width: 960, height: 540 });
  await page.goto('/humanlab.html?test&quality=high&hour=23');
  await page.waitForFunction(() => (window as any).__lab?.ready === true || (window as any).__lab?.error, null, { timeout: 900_000, polling: 2000 });
  expect(await page.evaluate(() => (window as any).__lab.error ?? null)).toBeNull();
  await page.evaluate(() => (window as any).__lab.view(0, 1.5, 4.2, 0, 1.0, 0));
  const meanLum = async (tag: string) => { await page.evaluate(() => (window as any).__lab.render(6)); await page.screenshot({ path: `shots/fireglow-${tag}.png` });
    return page.evaluate(async () => { const c = document.querySelector('canvas')!; const bmp = await createImageBitmap(c); const o = new OffscreenCanvas(bmp.width, bmp.height), x = o.getContext('2d')!; x.drawImage(bmp, 0, 0);
      const d = x.getImageData(bmp.width * 0.3, bmp.height * 0.3, bmp.width * 0.4, bmp.height * 0.5).data; let s = 0; for (let i = 0; i < d.length; i += 4) s += 0.2126 * d[i] + 0.7152 * d[i + 1] + 0.0722 * d[i + 2]; return s / (d.length / 4); }); };
  const off = await meanLum('none');
  await page.evaluate(async () => { const m: any = await import('/src/render/fireGlow.ts'), F: any = await import('/src/world/fire.ts'); const G = m.FIRE_GLOW, L = F.fireLight('brazier'), I = L.candela * F.FIRE_FLICKER_MEAN;
    G.A[0].set(0, 1.4, 1.5, L.cutoff); G.B[0].set(1.0 * I, 0.52 * I, 0.18 * I, 0); G.D[0].set(0, 0, -1, 0); G.n = 1; });
  const on = await meanLum('on');
  await page.evaluate(() => { (globalThis as any).__parsaSurf.fireglow.value = 0; });
  const ab = await meanLum('ab-off');
  console.log(`[fireglow] centre luma: no light ${off.toFixed(2)}, deferred light ${on.toFixed(2)}, term off ${ab.toFixed(2)}; errors ${errs.length}`);
  for (const e of errs) console.log('[err]', e);
  expect(errs.filter(e => /WGSL|shader|pipeline|Invalid/i.test(e))).toEqual([]);
  expect(on).toBeGreaterThan(off + 2);
  expect(Math.abs(ab - off)).toBeLessThan(1.5);
});
