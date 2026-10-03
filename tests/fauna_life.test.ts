// s18 C14 (D-790): the town's animals live at the people's depth: strays roam the lanes from their midden and back (on open
// ground all the way: lanes, never through a house), bark at a stranger now and then; the penned animals mill about their
// corner instead of standing rooted all night.
import { describe, it, expect, beforeAll } from 'vitest';
import { buildTownPlan, type TownPlan } from '../src/world/settlement/plan';
import { Fauna, openGround, type FaunaCtx } from '../src/world/fauna';
import { villageCompounds, placeVillages } from '../src/world/plain/villages';
import { buildCanals } from '../src/world/plain/canals';
import { loadTerrain, loadRiversFile } from './plainLib';
let plan: TownPlan, fauna: Fauna;
beforeAll(() => { plan = buildTownPlan(); const terrain = loadTerrain(), rivers = loadRiversFile(), canals = buildCanals(terrain, rivers.rivers, 1);
  const villages = placeVillages(terrain, rivers.rivers, canals, 1).map(v => ({ id: v.id, x: v.x, y: v.y, r: v.r, comps: villageCompounds(v, terrain, 1) }));
  fauna = new Fauna(1, plan, villages, (e, n) => terrain.heightAt(e, -n), { rivers: rivers.rivers.map(r => ({ pts: Array.from(r.x, (x, i) => [x, r.y[i]] as [number, number]), half: r.topWidth / 2 })), canals: canals.map(c => c.pts as [number, number][]) }); }, 300_000);
const ctx = (t: number, hour: number, player: [number, number] | null, cam: [number, number]): FaunaCtx => ({ t, hour, month: 5, sun: { rise: 5.8, set: 19.4 }, player, cam: { x: cam[0], y: 0, z: -cam[1] }, dt: 0.5, rain: 0 } as FaunaCtx);
describe('the town animals\' life', () => {
  it('a stray of each roaming group walks its lanes out and back, on open ground all the way, and comes home', () => {
    const S: any[] = (fauna as any).strays, roam = S.filter(g => g.route); expect(roam.length).toBeGreaterThan(5);
    const o: any = { sp: 'dog', e: 0, n: 0, x: 0, z: 0, yaw: 0, phase: 0, walk: 0, graze: 0, lie: 0, coat: 0 };
    let far = 0, moving = 0, N = 0;
    for (const g of roam.slice(0, 12)) for (let t = 0; t < 720; t += 2) { (fauna as any).strayAt(g, 0, ctx(30000 + t, 10, null, g.c), o); N++;
      expect(openGround(plan, o.e, o.n) || Math.hypot(o.e - g.c[0], o.n - g.c[1]) < 12, 'in a lane or at the midden').toBe(true);
      if (o.walk) moving++; far = Math.max(far, Math.hypot(o.e - g.c[0], o.n - g.c[1])); }
    expect(far).toBeGreaterThan(30); expect(moving / N).toBeGreaterThan(0.2);
  });
  it('the penned animals mill about, and bold strays bark at a stranger', () => {
    const A: any = (fauna as any).animals, push0 = A.push.bind(A); let walk = 0, n = 0; A.push = (o: any, m: any) => { if (/^(sheep|goat|cow|calf)$/.test(o.sp)) { n++; if (o.walk > 0) walk++; } return push0(o, m); };
    const V: any[] = (fauna as any).stockYards; const at = V[0].yard.bed as [number, number];
    for (let k = 0; k < 400; k++) fauna.update(ctx(50000 + k * 3, 23, null, at)); A.push = push0;
    expect(n).toBeGreaterThan(0); expect(walk).toBeGreaterThan(0);
    const S: any[] = (fauna as any).strays, b0 = fauna.stats.barks; let barks = 0;
    for (const g of S.slice(0, 30)) { for (let k = 0; k < 40; k++) fauna.update(ctx(60000 + k * 0.5, 14, [g.spots[0][0] + 5, g.spots[0][1]], g.c)); }
    barks = fauna.stats.barks - b0; expect(barks).toBeGreaterThan(3);
  });
});
