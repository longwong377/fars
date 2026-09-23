import { test, expect } from '@playwright/test';
// Phase 4b renders (D-049..D-051): door-jamb reliefs at arm's length, the Tachara S stair façade, a window wall with a door
// swinging shut (open / half / closed), the Tripylon throne-bearers, a blocked-out Hall of 100 Columns jamb and the Treasury
// sealing. Views: __parsa.view(east, north, eye, azTrue, pitch); grid north = 341° true. Screenshots go to shots/.
const views: { name: string; v: [number, number, number, number, number]; door?: [string, number, number?] }[] = [
  { name: 'p4-tachara-jamb-king', v: [-21.55, -88.9, 1.6, 251, 14] },         // S doorway, W reveal, 0.95 m away: king under the parasol
  { name: 'p4-tachara-stair', v: [-21, -108.5, 1.6, 341, 4] },               // S stair: servants on the flights, guards and XPc
  { name: 'p4-tachara-stair-close', v: [-31.5, -102.6, 1.5, 341, 2] },       // W flight servants from 1.5 m
  { name: 'p4-tachara-windows-open', v: [-21.3, -83.5, 1.6, 161, 4] },        // hall S wall from inside: door open, two windows
  { name: 'p4-tachara-door-half', v: [-21.3, -83.5, 1.6, 161, 4], door: ['tachara:S_main', 0.5] },
  { name: 'p4-tachara-door-closed', v: [-21.3, -83.5, 1.6, 161, 4], door: ['tachara:S_main', 0] },
  { name: 'p4-tripylon-bearers', v: [89.5, -71.75, 1.6, 341, 22] },           // E doorway, N reveal: throne carried by the nations
  { name: 'p4-hall100-rough', v: [133.3, 6.0, 1.6, 251, 18] },                // N1 doorway, W reveal: blocked-out throne scene
  { name: 'p4-treasury-sealing', v: [180.7, -92.0, 1.4, 161, -10], door: ['treasury:hall99', 0, 20] }, // store door sealed as at night: knobs, cord, clay lump
];
test('phase 4b renders', async ({ page }) => {
  test.setTimeout(1_800_000);
  const logs: string[] = []; page.on('console', m => { if (m.type() === 'error') logs.push(m.text().slice(0, 300)); }); page.on('pageerror', e => logs.push('PAGEERR ' + e));
  await page.goto(`/?test&quality=${process.env.Q ?? 'test'}&day=60&hour=${process.env.HOUR ?? 10}&weather=clear`);
  await page.waitForFunction(() => (window as any).__parsa?.ready === true || (window as any).__parsa?.error, null, { timeout: 1_200_000 });
  for (const { name, v, door } of views) {
    if (process.env.ONLY && !name.includes(process.env.ONLY)) continue;
    await page.evaluate(([v, door]) => { const P = (window as any).__parsa; P.view(...v);
      const D = P.world.doors; if (door) { const d = D.doors.get(door[0]); d.target = door[1]; d.t = door[1]; d.dirty = true; D.update(0, door[2] ?? 10); } }, [v, door] as any);
    for (let i = 0; i < 2; i++) await page.evaluate(() => (window as any).__parsa.renderOnce());
    const s = await page.evaluate(() => { const s = (window as any).__parsa.stats(); return { backend: s.backend, drawCalls: s.drawCalls, triangles: s.triangles, reliefs: { tris: s.reliefs.tris, byLod: s.reliefs.byLod, draws: s.reliefs.draws, far: s.reliefs.farChunks, proxies: s.reliefs.proxies } }; });
    console.log(name, JSON.stringify(s));
    await page.screenshot({ path: `shots/${name}${process.env.SUFFIX ?? ''}.png` });
  }
  const doors = await page.evaluate(() => (window as any).__parsa.doors().filter((d: any) => d.id.startsWith('treasury')));
  console.log('treasury doors', JSON.stringify(doors));
  console.log(logs.slice(0, 8).join('\n'));
  expect(logs.filter(l => /relief|door|PAGEERR/i.test(l))).toEqual([]);
});
