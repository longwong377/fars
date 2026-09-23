import { expect, type Page } from '@playwright/test';
// Phase 4b render helper (D-049..D-051): load the world, then for each view set the camera (and optionally a door's state
// at an hour), render twice, log the renderer and relief counters and save shots/<name>.png. Views follow
// __parsa.view(east, north, eye, azTrue, pitch); grid north = 341° true. Queue rule: at most four views per spec.
export type P4View = { name: string; v: [number, number, number, number, number]; door?: [string, number, number?] };
export async function renderViews(page: Page, views: P4View[]) {
  const logs: string[] = [];
  page.on('console', m => { if (m.type() === 'error') logs.push(m.text().slice(0, 300)); });
  page.on('pageerror', e => logs.push('PAGEERR ' + e));
  await page.goto(`/?test&quality=${process.env.Q ?? 'test'}&day=60&hour=${process.env.HOUR ?? 10}&weather=clear`);
  await page.waitForFunction(() => (window as any).__parsa?.ready === true || (window as any).__parsa?.error, null, { timeout: 780_000 });
  for (const { name, v, door } of views) {
    if (process.env.ONLY && !name.includes(process.env.ONLY)) continue;
    await page.evaluate(([v, door]) => { const P = (window as any).__parsa; P.view(...v);
      const D = P.world.doors; if (door) { const d = D.doors.get(door[0]); d.target = door[1]; d.t = door[1]; d.dirty = true; D.update(0, door[2] ?? 10); } }, [v, door] as any);
    for (let i = 0; i < 2; i++) await page.evaluate(() => (window as any).__parsa.renderOnce());
    const s = await page.evaluate(() => { const s = (window as any).__parsa.stats(); return { backend: s.backend, drawCalls: s.drawCalls, triangles: s.triangles, reliefs: { tris: s.reliefs.tris, byLod: s.reliefs.byLod, draws: s.reliefs.draws, far: s.reliefs.farChunks, proxies: s.reliefs.proxies } }; });
    console.log(name, JSON.stringify(s));
    await page.screenshot({ path: `shots/${name}${process.env.SUFFIX ?? ''}.png` });
  }
  return logs;
}
export function expectClean(logs: string[]) {
  console.log(logs.slice(0, 8).join('\n'));
  expect(logs.filter(l => /relief|door|PAGEERR/i.test(l))).toEqual([]);
}
