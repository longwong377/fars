import { expect, type Page } from '@playwright/test';
/** §13.8 walkthrough bot: walk a list of grid targets with the normal controller at walking pace, routing each leg over
 *  the walkable grid (avoiding people standing still), re-planning a stuck leg up to twice. Returns the leg log. */
export async function walkRoute(page: Page, start: [number, number], targets: [number, number, string][]) {
  await page.evaluate(([e, n]) => { const w = (window as any).__parsa; w.walkMode(); w.teleport(e, n); w.simulate(1, 1 / 60); w.resetFalls(); }, start);
  const legs: { what: string; ok: boolean; tries: number; e: number; n: number; y: number; maxFall: number }[] = [];
  let pos: [number, number] = start; let totalT = 0;
  for (const [e, n, what] of targets) {
    let ok = false, tries = 0, last: any = null;
    while (!ok && tries < 3) {
      tries++;
      const path: [number, number][] | null = await page.evaluate(([a, b]) => (window as any).__parsa.navPath(a, b), [pos, [e, n]]);
      expect(path, `no walkable route to ${what}`).not.toBeNull();
      ok = true;
      // intermediate waypoints are cell centres of a path planned with 0.35 m wall clearance: reach them within 0.2 m, or
      // the next straight leg starts beside the planned line and can clip a corner (Hadish W stair head, 1.8 m opening)
      for (const [k, [we, wn]] of path!.slice(1).entries()) {
        const tol = k === path!.length - 2 ? 0.5 : 0.2;
        last = await page.evaluate(([we, wn, tol]) => (window as any).__parsa.walkTo(we, wn, 240, tol, 1 / 30), [we, wn, tol]);
        totalT += last.t; pos = [last.state.x, -last.state.z];
        if (!last.reached) { ok = false; break; }
      }
      if (!last) { last = { state: await page.evaluate(() => (window as any).__parsa.playerState()) }; }
    }
    legs.push({ what, ok, tries, e: +pos[0].toFixed(1), n: +pos[1].toFixed(1), y: +last.state.feetY.toFixed(2), maxFall: +last.state.maxFall.toFixed(2) });
    if (!ok) break;
  }
  return { legs, minutes: totalT / 60 };
}
