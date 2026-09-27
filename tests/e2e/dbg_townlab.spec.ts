import { test } from '@playwright/test';
// D-303 debug (DBG=1): look straight down at one sherd of the lab's litter from 1 m, and report the litter meshes
test('townlab litter', async ({ page }) => {
  test.setTimeout(900_000);
  await page.goto(`/townlab.html?test&quality=high&site=q_s1&day=25&hour=10.5`);
  await page.waitForFunction(() => (window as any).__lab?.ready === true || (window as any).__lab?.error, null, { timeout: 800_000 });
  const info = await page.evaluate(async () => { const L = (window as any).__lab; L.view(-423.2, -941.4, 1.6, 27.6, -35);
    const out: any[] = []; let hit: number[] | null = null;
    L.scene.traverse((o: any) => { if (o.name !== 'lab:litter') return; const c = o.geometry.getAttribute('color'), p = o.geometry.getAttribute('position');
      out.push({ n: p.count, vis: o.visible, mat: o.material?.name, side: o.material?.side });
      for (let i = 0; i < c.count && !hit; i++) if (c.getX(i) > c.getZ(i) * 2.5 && Math.hypot(p.getX(i) + 423.2, p.getZ(i) - 941.4) < 12) hit = [p.getX(i), p.getY(i), p.getZ(i)]; });
    L.camera.position.set(-423.2 + 3 * Math.sin(27.6 * Math.PI / 180), 4, 941.4 - 3 * Math.cos(27.6 * Math.PI / 180)); L.camera.lookAt(-423.2 + 3.01 * Math.sin(27.6 * Math.PI / 180), 0, 941.4 - 3.01 * Math.cos(27.6 * Math.PI / 180)); L.camera.updateMatrixWorld();
    await L.render(4); return { out, hit }; });
  console.log(JSON.stringify(info));
  await page.screenshot({ path: 'shots/townlab-dbg-top.png' });
});
