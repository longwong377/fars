import { test } from '@playwright/test';
import { writeFileSync, mkdirSync, readFileSync, existsSync } from 'node:fs';
// Rubric s7 pass 2, geometry bugs (D-217; debug spec, DBG=1): what the untextured boxes (R8) and the floating rod (R11) are.
// One page load (day 25 11:00, clear; Q, default high); the views of moments.spec / crowd_scale.spec; picks (NDC) at the
// pixels the review names (960 × 540: x_ndc = px / 480 − 1, y_ndc = 1 − py / 270), each with the next hits behind it.
// SHOOT=1 also screenshots each view (shots/dbg-s7p2-<view>.png). Results → shots/dbg-s7p2.json.
type V = { n: string; hour: number; v: [number, number, number, number, number]; fov: number; pts: [number, number][]; box?: [number, number, number, number, number, number] /* grid e0, n0, y0, e1, n1, y1 */ };
const VIEWS: V[] = [
  { n: 'apadana-hall-out', hour: 11, v: [1.9, 18, 1.6, 341, 3], fov: 46, pts: [[0, 0.2407], [0, 0.2], [0, 0.28], [0.004, 0.2407]] },
  { n: 'apadana-enter-door', hour: 11, v: [1.9, 31.0, 1.6, 161, 2], fov: 46, pts: [[0.002, 0.333], [0.002, 0.3], [0.002, 0.36], [0, 0.18]] },
  { n: 'hall100-site', hour: 9.5, v: [146, 45, 1.6, 161, 4], fov: 40, pts: [[-0.8125, -0.5926], [0.71875, -0.5926], [-0.8125, -0.5], [0.71875, -0.5]], box: [138, 33, -0.5, 155, 44, 2.5] },
  { n: 'court-assembly', hour: 10, v: [-35, 85, 1.6, 71, -2], fov: 46, pts: [[-0.948, -0.667], [-0.97, -0.55]], box: [-40, 85.3, -0.5, -27, 93, 3] },
  { n: 'crowd-court-forecourt-w', hour: 10, v: [-35, 85, 1.6, 71, -2], fov: 40, pts: [[-0.79, -0.556], [-0.6, -0.4]], box: [-40, 85.3, -0.5, -27, 93, 3] },
];
test('s7 pass 2 picks (D-217)', async ({ page }) => {
  test.setTimeout(+(process.env.TIMEOUT ?? 1400) * 1000);
  const errs: string[] = []; page.on('pageerror', e => errs.push(String(e)));
  const only = process.env.ONLY?.split(','), out: Record<string, any> = {};
  const court = !!process.env.COURT; // the court setting (day 30, as court-assembly)
  await page.goto(`/?test&quality=${process.env.Q ?? 'high'}&day=${court ? 30 : 25}&hour=11&weather=clear${court ? '&court=seasonal' : ''}`);
  await page.waitForFunction(() => (window as any).__parsa?.ready === true || (window as any).__parsa?.error, null, { timeout: 900_000 });
  await page.evaluate(() => (window as any).__parsa.renderer.setAnimationLoop(null));
  await page.evaluate(d => { (window as any).__day = d; }, court ? 30 : 25);
  for (const s of VIEWS) {
    if (only && !only.includes(s.n)) continue;
    await page.evaluate(h => { const p = (window as any).__parsa; p.setTime((window as any).__day ?? 25, h); p.setWeather?.('clear'); }, s.hour);
    await page.evaluate(([v, f]) => (window as any).__parsa.view(...v, f), [s.v, s.fov] as const);
    if (process.env.SHOOT) { for (let i = 0; i < 3; i++) await page.evaluate(() => (window as any).__parsa.renderOnce()); await page.screenshot({ path: `shots/dbg-s7p2-${s.n}.png` }); }
    else await page.evaluate(() => (window as any).__parsa.tick());
    const r = await page.evaluate(pts => { const p = (window as any).__parsa; const o: any = {}; for (const [x, y] of pts) o[`${x},${y}`] = p.pick(x, y); return o; }, s.pts);
    // every drawn mesh (each instance of an instanced one) whose world box meets the view's suspect box (the picks miss meshes
    // whose bounds are stale or whose raycast is off)
    const found = s.box ? await page.evaluate(B => { const p = (window as any).__parsa, T = p.world.root?.parent ?? null; const scene = (p.renderer && (window as any).__parsaScene) || null; void T; void scene;
      const lo = { x: B[0], y: B[2], z: -B[4] }, hi = { x: B[3], y: B[5], z: -B[1] }, out: any[] = [];
      const root = p.world.scene ?? p.world.root; let top: any = root; while (top?.parent) top = top.parent;
      const inter = (b: any) => b.min.x <= hi.x && b.max.x >= lo.x && b.min.y <= hi.y && b.max.y >= lo.y && b.min.z <= hi.z && b.max.z >= lo.z;
      top.traverseVisible((o: any) => { if (!o.isMesh || !o.geometry) return; const g = o.geometry; if (!g.boundingBox) g.computeBoundingBox(); const bb = g.boundingBox; if (!bb || !isFinite(bb.min.x)) return;
        const M = o.matrixWorld.clone(), name = `${o.parent?.parent?.name ?? ''}/${o.parent?.name ?? ''}/${o.name}|L${o.layers.mask}|${o.constructor?.name}`;
        if (o.isInstancedMesh) { const m = M.clone().identity(); for (let i = 0; i < o.count; i++) { o.getMatrixAt(i, m); const w = bb.clone().applyMatrix4(M.clone().multiply(m)); if (inter(w)) out.push({ name, inst: i, min: w.min.toArray().map((x: number) => +x.toFixed(2)), max: w.max.toArray().map((x: number) => +x.toFixed(2)), mat: o.material?.type, note: String(o.userData?.note ?? '').slice(0, 140) }); } }
        else { const w = bb.clone().applyMatrix4(M); if (inter(w)) out.push({ name, min: w.min.toArray().map((x: number) => +x.toFixed(2)), max: w.max.toArray().map((x: number) => +x.toFixed(2)), mat: o.material?.type, note: String(o.userData?.note ?? '').slice(0, 140) }); } });
      return out.slice(0, 150); }, s.box) : null;
    out[s.n] = { picks: r, found }; console.log('picks', s.n, JSON.stringify(r)); if (found) console.log('found', s.n, JSON.stringify(found));
  }
  mkdirSync('shots', { recursive: true }); const f = 'shots/dbg-s7p2.json', all = existsSync(f) ? JSON.parse(readFileSync(f, 'utf8')) : {};
  Object.assign(all, out); writeFileSync(f, JSON.stringify(all, null, 1));
  console.log(errs.slice(0, 5).join('\n'));
});
