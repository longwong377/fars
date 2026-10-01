import { test } from '@playwright/test';
// s13 gpuhang: which top-level object group makes a frame hang the T4 (DXGI_ERROR_DEVICE_HUNG)? One page load; every group is hidden,
// then shown one at a time (cumulative=0) or added (CUM=1); each step renders 2 frames and reports ms and device loss.
test('bisect', async ({ page }) => {
  test.setTimeout(+(process.env.TIMEOUT ?? 5400) * 1000);
  await page.setViewportSize({ width: +(process.env.W ?? 1920), height: +(process.env.H ?? 1080) });
  page.on('console', m => { const t = m.text(); if (m.type() === 'error' || m.type() === 'warning' || t.startsWith('[bis]')) console.log(t.slice(0, 300)); });
  const t0 = Date.now();
  await page.goto(`/?test&quality=${process.env.Q ?? 'high'}&day=0&hour=5.4&weather=clear&court=seasonal`);
  await page.waitForFunction(() => (window as any).__parsa?.ready === true, null, { timeout: 3_000_000, polling: 2000 });
  await page.evaluate(() => { const P = (window as any).__parsa; P.renderer.setAnimationLoop(null); (window as any).__lost = null; P.renderer.backend.device?.lost.then((i: any) => { (window as any).__lost = i.reason + ' ' + i.message.slice(0, 80); }); });
  console.log('[bis] ready', ((Date.now() - t0) / 1000).toFixed(0), 's');
  await page.evaluate(() => (window as any).__parsa.view(-36.4, 135.5, 1.6, 281, -5, 40));
  const groups: string[] = await page.evaluate(() => { const P = (window as any).__parsa, sc = P.world.root.parent; const n: string[] = [];
    for (const o of [...P.world.root.children, ...sc.children]) if (o !== P.world.root && o.visible && o.name) n.push(o.name); return [...new Set(n)]; });
  console.log('[bis] groups', JSON.stringify(groups));
  const set = (on: string[]) => page.evaluate((on) => { const P = (window as any).__parsa, sc = P.world.root.parent; for (const o of [...P.world.root.children, ...sc.children]) if (o !== P.world.root && o.name) o.visible = on.includes(o.name); }, on);
  const cum: string[] = [];
  for (const g of groups) {
    cum.push(g); await set(process.env.CUM ? cum : [g]);
    const r = await page.evaluate(async () => { const P = (window as any).__parsa; const out: number[] = []; for (let i = 0; i < 2; i++) { const t = performance.now(); await P.renderOnce(); out.push(Math.round(performance.now() - t)); } return { out, lost: (window as any).__lost }; });
    console.log('[bis]', g, JSON.stringify(r), ((Date.now() - t0) / 1000).toFixed(0), 's');
    if (r.lost) break;
  }
  await set(groups);
  await page.screenshot({ path: 'shots/bisect-final.png' });
});
