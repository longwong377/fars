import { test } from '@playwright/test';
// debug: the rain-approach moment's live state (shafts, cloud layer, fog) at high quality
test('rain debug', async ({ page }, info) => {
  test.skip(info.project.name !== 'webgpu'); test.setTimeout(840_000);
  await page.goto(`/?test&quality=${process.env.Q ?? 'high'}&day=299&hour=10.6&weather=auto${process.env.SHAFTDBG ? '&shaftdbg=' + process.env.SHAFTDBG : ''}`);
  await page.waitForFunction(() => (window as any).__parsa?.ready === true, null, { timeout: 600_000 });
  await page.evaluate(() => (window as any).__parsa.renderer.setAnimationLoop(null));
  await page.evaluate(() => (window as any).__parsa.view(-38, -5, 1.6, 232, 3));
  for (let i = 0; i < 3; i++) await page.evaluate(() => (window as any).__parsa.renderOnce());
  const info2 = await page.evaluate(() => {
    const P = (window as any).__parsa, scene = P.world.root.parent;
    const sh = scene.getObjectByName('rain-shafts');
    const shafts = sh ? sh.children.map((m: any) => ({ vis: m.visible, x: +m.position.x.toFixed(0), z: +m.position.z.toFixed(0), sx: +m.scale.x.toFixed(0), sy: +m.scale.y.toFixed(0) })) : 'none';
    let clouds: any = null; scene.traverse((o: any) => { if (o.material?.colorNode && o.renderOrder === -7) clouds = { vis: o.visible, name: o.name, pos: o.position.toArray().map((v: number) => +v.toFixed(0)) }; });
    const cam = P.renderer ? null : null; void cam;
    return { shafts, clouds, fog: scene.fog ? { c: scene.fog.color.toArray().map((v: number) => +v.toFixed(4)), d: scene.fog.density } : null, clock: P.clockLabel(), exposure: P.exposureInfo?.() };
  });
  console.log(JSON.stringify(info2));
  await page.screenshot({ path: `shots/dbg-rain${process.env.SHAFTDBG ?? ''}.png` });
});
