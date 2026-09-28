import { test, expect } from '@playwright/test';
// D-309 probe (session 12): the sun's cascaded shadows, session 11's (?csm=old) against D-309's, on the human lab (the world's
// sky, sun, CSM and post pipeline on a floor and a wall; loads in seconds). Close-ups of the chin/beard shadow on the chest
// (B113) and a full lineup (old = session 11: ?csm=old&tone=agx) with the wall, and the frame time on the card (GPU work done per frame, 40 frames).
// Env: Q (default high), HOUR (default 10; 16.5 = a low sun), MODES (default old,new). Screenshots → shots/sunshadow-*.png
const SHOTS: [string, number[], number[]][] = [
  ['face', [-1.2, 1.62, 0.95], [-1.2, 1.45, 0]],
  ['full', [0, 1.5, 4.2], [0, 1.0, 0]],
  ['feet', [0.6, 0.9, 1.6], [0.2, 0.1, 0]],
];
// LANE=1: the lab's lane (2 m between two mudbrick walls) and the closed room's interior (humanLab ?lane=1)
if (process.env.LANE) SHOTS.push(['lane', [-12, 1.6, -4.5], [0, 1.2, -4.5]], ['lane-up', [4, 1.6, -4.2], [-6, 2.4, -5.2]], ['room', [25, 1.6, -0.6], [25, 1.1, -5]]);
const MEN = [{ dress: 'persian', sex: 'm', role: 'official', seed: 36 }, { dress: 'guard', sex: 'm', role: 'guard', seed: 12 }, { dress: 'median', sex: 'm', role: 'guard', seed: 13 }, { dress: 'worker', sex: 'm', role: 'mason', seed: 14 }];
for (const mode of (process.env.MODES ?? 'old,new').split(',')) {
  test(`sun shadows ${mode}`, async ({ page }, info) => {
    test.setTimeout(1_200_000);
    const errs: string[] = []; page.on('pageerror', e => errs.push(String(e))); page.on('console', m => { if (m.type() === 'error') errs.push(m.text().slice(0, 300)); });
    const Q = process.env.Q ?? 'high', H = process.env.HOUR ?? '10';
    await page.setViewportSize({ width: 1920, height: 1080 }); // the player's frame size (frame time at 1080p)
    await page.goto(`/humanlab.html?test&quality=${Q}&hour=${H}${mode === 'old' ? '&csm=old&tone=agx' : ''}${process.env.POST ? '&post=' + process.env.POST : ''}${process.env.LANE ? '&lane=1' : ''}`);
    await page.waitForFunction(() => (window as any).__lab?.ready === true || (window as any).__lab?.error, null, { timeout: 900_000 });
    expect(await page.evaluate(() => (window as any).__lab.error ?? null)).toBeNull();
    await page.evaluate(() => (window as any).__lab.view(0, 1.5, 4, 0, 1.2, 0));
    await page.evaluate(s => (window as any).__lab.lineup(s), MEN);
    for (const [n, c, t] of SHOTS) {
      await page.evaluate(([c, t]) => (window as any).__lab.view(c[0], c[1], c[2], t[0], t[1], t[2]), [c, t]);
      await page.evaluate(() => (window as any).__lab.render(12));
      if (n === 'full') {
        const ms = await page.evaluate(async () => { const L = (window as any).__lab, dev = L.renderer.backend.device;
          const done = () => dev ? dev.queue.onSubmittedWorkDone() : Promise.resolve();
          await L.render(5); await done(); const t0 = performance.now(); await L.render(40); await done(); return (performance.now() - t0) / 40; });
        const casc = await page.evaluate(() => { const n = (window as any).__lab.scene; let s: any = null; n.traverse((o: any) => { if (!s && o.isDirectionalLight && o.castShadow && o.shadow?.shadowNode) s = o.shadow.shadowNode; });
          return s?.lights?.map((L: any) => ({ texel_mm: +(1000 * (L.shadow.camera.right - L.shadow.camera.left) / L.shadow.mapSize.width).toFixed(2), bias_m: +(-L.shadow.bias * (L.shadow.camera.far - L.shadow.camera.near)).toFixed(4), nb: +L.shadow.normalBias.toFixed(4), r: +L.shadow.radius.toFixed(2), size: L.shadow.mapSize.width })) ?? null; });
        console.log(`[sunshadow] mode=${mode} q=${Q} hour=${H} frame_ms=${ms.toFixed(2)} cascades=${JSON.stringify(casc)}`);
      }
      await page.screenshot({ path: `shots/sunshadow-${process.env.POST ?? ''}${mode}-${Q}-h${H}-${n}-${info.project.name}.png` });
    }
    console.log(errs.slice(0, 10).join('\n'));
    expect(errs).toEqual([]);
  });
}
