// s18 C14 (D-790): what every town and village animal is doing over a day (walk, graze, lie, still), per species. Run: npx vitest run --dir tools/dev fauna_census
import { it } from 'vitest';
import { writeFileSync } from 'node:fs';
import { buildTownPlan } from '../../src/world/settlement/plan';
import { Fauna, type FaunaCtx } from '../../src/world/fauna';
import { villageCompounds, placeVillages } from '../../src/world/plain/villages';
import { buildCanals } from '../../src/world/plain/canals';
import { loadTerrain, loadRiversFile } from '../../tests/plainLib';
it('census', () => {
  const plan = buildTownPlan(), terrain = loadTerrain(), rivers = loadRiversFile(), canals = buildCanals(terrain, rivers.rivers, 1);
  const villages = placeVillages(terrain, rivers.rivers, canals, 1).map(v => ({ id: v.id, x: v.x, y: v.y, r: v.r, comps: villageCompounds(v, terrain, 1) }));
  const fauna = new Fauna(1, plan, villages, (e, n) => terrain.heightAt(e, -n), { rivers: rivers.rivers.map(r => ({ pts: Array.from(r.x, (x, i) => [x, r.y[i]] as [number, number]), half: r.topWidth / 2 })), canals: canals.map(c => c.pts as [number, number][]) });
  const S: Record<string, { n: number; walk: number; graze: number; lie: number; still: number }> = {};
  const A: any = (fauna as any).animals, push0 = A.push.bind(A);
  A.push = (o: any, m: any) => { const s = S[o.sp] ?? (S[o.sp] = { n: 0, walk: 0, graze: 0, lie: 0, still: 0 }); s.n++; if (o.walk > 0) s.walk++; else if (o.graze > 0) s.graze++; else if (o.lie > 0) s.lie++; else s.still++; return push0(o, m); };
  const cams: [number, number][] = [[-900, -300], [-600, 200], [200, 300], [-1500, 600], ...villages.slice(0, 4).map(v => [v.x, v.y] as [number, number])];
  for (const cam of cams) for (let h = 0; h < 24; h += 1) for (let k = 0; k < 3; k++) fauna.update({ t: 40000 + h * 3600 + k * 37, hour: h + 0.5, month: 5, sun: { rise: 5.8, set: 19.4 }, player: null, cam: { x: cam[0], y: 0, z: -cam[1] }, dt: 0.1, rain: 0 } as FaunaCtx);
  const rows = Object.entries(S).sort((a, b) => b[1].n - a[1].n).map(([sp, s]) => `${sp.padEnd(12)} n ${String(s.n).padStart(6)}  walk ${(100 * s.walk / s.n).toFixed(0).padStart(3)} %  graze ${(100 * s.graze / s.n).toFixed(0).padStart(3)} %  lie ${(100 * s.lie / s.n).toFixed(0).padStart(3)} %  still ${(100 * s.still / s.n).toFixed(0).padStart(3)} %`);
  writeFileSync('bench-reports/fauna_census.txt', rows.join('\n') + '\n');
}, 600_000);
