import { test } from '@playwright/test';
// Renderer counters (draw calls, triangles, backend draws) at three views, for the relief far-representation work
// (D-048): Grand Stair foot, Apadana N court, Tachara S court. Q=quality (default high). Prints one JSON line per view,
// plus the per-object tally of the relief objects' draws over the same frame (view and shadow passes; as dbg_draws).
test('phase 4 draw counts', async ({ page }, info) => {
  test.skip(info.project.name !== 'webgpu');
  test.setTimeout(840_000);
  await page.goto(`/?test&quality=${process.env.Q ?? 'high'}&day=0&hour=9&weather=clear`);
  await page.waitForFunction(() => (window as any).__parsa?.ready === true || (window as any).__parsa?.error, null, { timeout: 780_000 });
  await page.evaluate(() => { const P = (window as any).__parsa, r = P.renderer, b = r.backend, w = window as any; w.__draws = 0; w.__tally = null;
    const d = b.draw.bind(b); b.draw = (...a: any[]) => { w.__draws++; return d(...a); };
    const key = (o: any) => { let n = o; const path: string[] = []; while (n && path.length < 3) { if (n.name) path.push(n.name); n = n.parent; } return (path.reverse().join('/') || o.type) + (o.isBatchedMesh ? ' [batched]' : ''); };
    const u = r.info.update.bind(r.info); r.info.update = (o: any, count: number, inst: number) => { const t = w.__tally; if (t) { const e = (t[key(o)] ??= [0, 0]); e[0]++; e[1] += (inst ?? 1) * count / 3; } return u(o, count, inst); }; });
  const views: [string, number[]][] = [['grand-stair-foot', [-60, 122, 1.6, 71, 10]], ['apadana-n-court', [0, 60, 1.6, 161, 5]], ['tachara-s-court', [-21, -112, 1.6, 341, 6]]];
  for (const [name, v] of views) {
    await page.evaluate(v => (window as any).__parsa.view(...v), v);
    await page.evaluate(() => (window as any).__parsa.renderOnce());
    await page.evaluate(() => { const w = window as any; w.__draws = 0; w.__tally = {}; });
    await page.evaluate(() => (window as any).__parsa.renderOnce());
    const s = await page.evaluate(() => { const w = window as any, s = w.__parsa.stats(), t = w.__tally as Record<string, [number, number]>; w.__tally = null;
      const rel = Object.entries(t).filter(([k]) => /relief/i.test(k)); const relDraws = rel.reduce((a, [, e]) => a + e[0], 0);
      const top = Object.entries(t).sort((a, b) => b[1][0] - a[1][0]).slice(0, 6).map(([k, e]) => `${e[0]} ${k}`);
      return { drawCalls: s.drawCalls, triangles: s.triangles, backendDraws: w.__draws, reliefTris: s.reliefs.tris, reliefByLod: s.reliefs.byLod, reliefSets: s.reliefs.sets, reliefDraws: s.reliefs.draws ?? null, reliefObjDraws: relDraws, top }; });
    console.log(`DRAWS ${process.env.TAG ?? ''} ${name} ${JSON.stringify(s)}`);
    if (process.env.SHOT) await page.screenshot({ path: `shots/draws-${name}${process.env.TAG ? '-' + process.env.TAG : ''}.png` });
  }
});
