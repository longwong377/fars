import { test, expect } from '@playwright/test';
// Translation layer (out-of-world, off by default): looking at XPa on the Gate shows its transliteration and glosses;
// M opens the map, J the chronicle; with the layer off nothing is shown.
test('translation layer: inscription, map, chronicle', async ({ page }, info) => {
  test.skip(info.project.name !== 'webgpu', 'DOM layer is backend-independent');
  test.setTimeout(900_000);
  await page.goto('/?test&quality=test&day=25&hour=10&tl');
  await page.waitForFunction(() => (window as any).__parsa?.ready === true, null, { timeout: 600_000 });
  // the XPa panel above a W-doorway colossus of the Gate: stand in the doorway and look up at the reveal
  const names: string[] = await page.evaluate(() => { const r: string[] = []; (window as any).__parsa.world.root.getObjectByName('inscriptions').traverse((o: any) => { if (o.name) r.push(o.name); }); return r; });
  expect(names.some(n => n.startsWith('inscription:XPa'))).toBe(true);
  const target = await page.evaluate(() => { const g = (window as any).__parsa.world.root.getObjectByName('inscriptions'); let m: any = null; g.traverse((o: any) => { if (!m && o.name?.startsWith('inscription:XPa')) m = o; });
    m.geometry.computeBoundingBox(); const c = m.geometry.boundingBox.getCenter(new (m.position.constructor)()).applyMatrix4(m.matrixWorld); return { x: c.x, y: c.y, z: c.z }; });
  // camera 6 m from the panel along its normal, looking at it
  // camera on the doorway axis below the panel, looking across and up at it (the doorway is only a few metres wide)
  // aim exactly at the panel centre from the doorway axis (azimuth and pitch from the offsets, not assumed)
  await page.evaluate(t => { const w = (window as any).__parsa; const n = -t.z, axis = 124.6, camE = t.x - 0.4, de = t.x - camE, dn = n - axis;
    w.view(camE, axis, 1.6, (Math.atan2(de, dn) * 180) / Math.PI + 341, (Math.atan2(t.y - 1.6, Math.hypot(de, dn)) * 180) / Math.PI); }, target);
  for (let i = 0; i < 3; i++) await page.evaluate(() => (window as any).__parsa.renderOnce());
  await page.waitForTimeout(400); await page.evaluate(() => (window as any).__parsa.renderOnce());
  const insc = await page.locator('.tl-insc').textContent();
  console.log('target', JSON.stringify(target), 'centre ray hits', JSON.stringify(await page.evaluate(() => (window as any).__parsa.pick(0, 0))));
  await page.screenshot({ path: 'shots/translation-xpa.png' });
  expect(insc ?? '').toContain('XPa'); expect(insc ?? '').toContain('ARIo');
  await page.keyboard.press('KeyM'); await page.evaluate(() => (window as any).__parsa.renderOnce());
  await expect(page.locator('.tl-map')).toBeVisible();
  await page.keyboard.press('KeyM'); await page.keyboard.press('KeyJ'); await page.evaluate(() => (window as any).__parsa.renderOnce());
  await expect(page.locator('.tl-panel')).toContainText('Chronicle');
});
