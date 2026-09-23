import { test } from '@playwright/test';
// debug: which layer draws the grey ground discs under the orchard trees of village P22 (each shot hides one layer)
test('plain layer debug', async ({ page }, info) => {
  test.skip(info.project.name !== 'webgpu'); test.setTimeout(840_000);
  await page.goto(`/?test&quality=${process.env.Q ?? 'test'}&day=0&hour=16&weather=clear`);
  await page.waitForFunction(() => (window as any).__parsa?.ready === true, null, { timeout: 600_000 });
  await page.evaluate(() => (window as any).__parsa.renderer.setAnimationLoop(null));
  const v: [number, number, number, number, number] = [-973, 3287, 1.6, 341, 1];
  await page.evaluate(v => (window as any).__parsa.view(...v), v); await page.evaluate(() => (window as any).__parsa.renderOnce()); await page.evaluate(v => (window as any).__parsa.view(...v), v);
  const names = await page.evaluate(() => { const p = (window as any).__parsa.world.root.getObjectByName('plain'); return p.children.map((c: any) => `${c.name}:${c.type}:${c.visible}`); });
  console.log('plain children', JSON.stringify(names));
  // mesh names since D-120 (tree kit): near leaves/wood per LOD, impostors (river/canal far, mid ring, orchard rows)
  const leaves = ['plain-trees-leaves-lod0', 'plain-trees-leaves-lod1', 'plain-trees-noshadow-leaves-lod1'], wood = leaves.map(n => n.replace('leaves', 'wood'));
  const sets: [string, string[]][] = [['base', []], ['nocrown', leaves], ['nowood', wood], ['noimpostor', ['plain-trees-far', 'plain-trees-mid', 'plain-orchards-far']], ['nocrops', ['plain-crops-near']], ['novillage', ['plain-villages']]];
  for (const [tag, hide] of sets) {
    await page.evaluate(h => { const p = (window as any).__parsa.world.root.getObjectByName('plain'); p.traverse((o: any) => { if (o.userData.__dbgHidden) { o.visible = true; delete o.userData.__dbgHidden; } }); p.traverse((o: any) => { if (h.includes(o.name)) { o.visible = false; o.userData.__dbgHidden = true; } }); }, hide);
    for (let i = 0; i < 6; i++) await page.evaluate(() => (window as any).__parsa.renderOnce());
    await page.screenshot({ path: `shots/dbg-plain-${tag}.png` });
  }
});
