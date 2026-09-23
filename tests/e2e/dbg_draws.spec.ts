import { test } from '@playwright/test';
// debug: where a frame's draw commands go (tally of renderer.info.update calls by object, over one manual frame)
test('draw breakdown', async ({ page }, info) => {
  test.skip(info.project.name !== 'webgpu');
  test.setTimeout(1_200_000);
  await page.goto(`/?test&quality=${process.env.Q ?? 'high'}&day=0&hour=9`);
  await page.waitForFunction(() => (window as any).__parsa?.ready === true, null, { timeout: 900_000 });
  const V = (process.env.V ?? '-60,122,1.6,71,10').split(',').map(Number);
  await page.evaluate(v => (window as any).__parsa.view(...v), V);
  for (let i = 0; i < 2; i++) await page.evaluate(() => (window as any).__parsa.renderOnce());
  const r = await page.evaluate(async () => {
    const P = (window as any).__parsa, R = P.renderer, tally: Record<string, [number, number]> = {};
    const key = (o: any) => { let n = o; const path: string[] = []; while (n && path.length < 3) { if (n.name) path.push(n.name); n = n.parent; } return (path.reverse().join('/') || o.type) + (o.isBatchedMesh ? ' [batched]' : o.isInstancedMesh ? ' [instanced]' : ''); };
    const u = R.info.update.bind(R.info); let on = false;
    R.info.update = (o: any, count: number, inst: number) => { if (on) { const k = key(o); const t = (tally[k] ??= [0, 0]); t[0]++; t[1] += (inst ?? 1) * count / 3; } return u(o, count, inst); };
    R.setAnimationLoop(null); on = true; await P.renderOnce(); on = false; R.info.update = u;
    return Object.entries(tally).sort((a, b) => b[1][0] - a[1][0]).map(([k, [d, t]]) => `${String(d).padStart(5)} draws ${(t / 1e6).toFixed(2).padStart(6)} M tris  ${k}`);
  });
  console.log(r.slice(0, 40).join('\n'));
});
