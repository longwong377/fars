import { test } from '@playwright/test';
test('dbg', async ({ page }) => {
  await page.goto(`/?test&quality=test&day=0&hour=9`);
  await page.waitForFunction(() => (window as any).__parsa?.ready === true, null, { timeout: 300_000 });
  const r = await page.evaluate(() => {
    const w = (window as any).__parsa; const arch = w.world.root.getObjectByName('architecture'); const out: any[] = [];
    for (const m of arch.children) { m.geometry.computeBoundingBox(); const bb = m.geometry.boundingBox; out.push([m.name, m.isInstancedMesh ? m.count : 1, +bb.min.y.toFixed(1), +bb.max.y.toFixed(1)]); }
    return out.filter(o => o[3] > 15);
  });
  console.log(JSON.stringify(r));
});
