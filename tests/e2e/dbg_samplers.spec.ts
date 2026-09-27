import { test } from '@playwright/test';
import { writeFileSync, mkdirSync } from 'node:fs';
// D-306 debug (DBG=1): which materials of the full world exceed WebGPU's 16 samplers per fragment stage. One page load, one
// frame, then every unique material of the scene's meshes is built into WGSL with the live renderer's own node builder and
// its sampler bindings counted; the models' baked materials are listed beside their procedural stand-ins.
test('samplers per material (D-306 debug)', async ({ page }) => {
  test.setTimeout(3_000_000);
  await page.setViewportSize({ width: 800, height: 450 });
  await page.goto(`/?test&quality=high&day=25&hour=10&weather=clear`);
  await page.waitForFunction(() => (window as any).__parsa?.ready === true, null, { timeout: 2_500_000 });
  await page.evaluate(() => (window as any).__parsa.renderer.setAnimationLoop(null));
  await page.evaluate(() => (window as any).__parsa.view(9.0, 125.3, 1.6, 92.8, 21));
  await page.evaluate(() => (window as any).__parsa.renderOnce());
  const res = await page.evaluate(() => {
    const P = (window as any).__parsa, r = P.renderer, scene = P.world.root.parent;
    let cam: any = null; scene.traverse((o: any) => { if (!cam && o.isLight && o.shadow?.camera) cam = o.shadow.camera; });
    const seen = new Map<any, any>(), out: any[] = [];
    const count = (mesh: any, mat: any) => {
      try {
        const b = r.backend.createNodeBuilder(mesh, r); b.scene = scene; b.camera = cam; b.material = mat; b.lightsNode = r.lighting.getNode(scene, cam); b.build();
        const f: string = b.fragmentShader; return { samplers: (f.match(/:\s*sampler(_comparison)?\s*;/g) ?? []).length, textures: (f.match(/:\s*texture_[a-z0-9_]+/g) ?? []).length };
      } catch (e) { return { err: String(e).slice(0, 120) }; }
    };
    scene.traverse((o: any) => {
      if (!o.isMesh) return; const mats = Array.isArray(o.material) ? o.material : [o.material];
      for (const m of mats) { if (!m || seen.has(m)) continue; const c = count(o, m); seen.set(m, c); out.push({ name: m.name || m.type, mesh: o.name, ...c }); }
    });
    return out.sort((a, b) => (b.samplers ?? 0) - (a.samplers ?? 0));
  });
  mkdirSync('shots/carving', { recursive: true });
  writeFileSync('shots/carving/samplers.json', JSON.stringify(res, null, 1));
  console.log('top', JSON.stringify(res.slice(0, 25)));
  console.log('models', JSON.stringify(res.filter((x: any) => /model:/.test(x.name))));
});
