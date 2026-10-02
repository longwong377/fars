// The town's house variety census (s17 C1, D-550): do neighbouring houses read alike from the lane? Pure data (the plan, the
// houses' lives and fixtures, the fill plan): `npx tsx tools/dev/house_census.ts`.
// Neighbours: two houses (house, house_large, workshop) of one site whose street doors are within NEAR m of each other.
// What the lane sees of a house, each made a bucket: its height (25 cm), its parapet (10 cm), its door leaf (the wood's age x
// the kit's two forms: towndoors.ts), its door shade (none, cloth, reed: the fill), its wall's patching (patches + bare, by
// 0.6), and what shows over the parapet (the roof things' kinds). A pair is alike when the street face (height, parapet,
// door, shade) is the same; twins when every bucket is.
import { buildTownPlan } from '../../src/world/settlement/plan';
import { HOUSE_KINDS, ROOF_FIX } from '../../src/world/settlement/houseplan';
import { townFill, type FillItem } from '../../src/world/fillPlan';
import { hashString } from '../../src/core/rng';
import type { Site } from '../../src/world/settlement/site';

const NEAR = 12;
export interface HouseSig { site: string; id: string; door: [number, number]; h: number; par: number; leaf: number; shade: number; patch: number; roof: string; standing: number; height: number }
const leafOf = (id: string, wood: number) => { const a = wood < 0.35 ? 0 : wood < 0.7 ? 1 : 2; return hashString(`${id}:form`) / 4294967296 < 0.5 ? a + 3 : a; };

export function houseSigs(sites: Site[], items: FillItem[]): HouseSig[] {
  const shades = items.filter(i => i.m === 'fill_awning' || i.m === 'fill_reed_awning'), out: HouseSig[] = [];
  for (const s of sites) { if (s.meta.kind !== 'quarter') continue; const lives = s.lives ?? [], fx = s.fixtures ?? [];
    for (const p of s.plots) { if (!HOUSE_KINDS.has(p.kind) || !p.door) continue; const L = lives[p.idx]; if (!L) continue;
      const dp = s.doorPoints(p); if (!dp) continue; const door = s.grid(dp.out[0], dp.out[1]);
      const sh = shades.find(a => Math.hypot(a.e - door[0], a.n - door[1]) < 1.8), id = `${s.id}:${p.id}`;
      const roof = [...new Set(fx.filter(f => f.plot === p.idx && ROOF_FIX.has(f.kind)).map(f => f.kind))].sort().join(',');
      out.push({ site: s.id, id: p.id, door, h: Math.round(p.height / 0.25), par: Math.round(p.parapet / 0.1), leaf: leafOf(`${s.id}:${p.id}`, L.doorWood), shade: sh ? (sh.m === 'fill_awning' ? 1 : 2) : 0,
        patch: Math.round((L.patches + L.bare) / 0.6), roof, standing: L.standing, height: p.height }); void id; } }
  return out;
}
export function houseCensus(sigs: HouseSig[]) {
  let pairs = 0, alike = 0, twins = 0; const ex: string[] = [];
  for (let a = 0; a < sigs.length; a++) for (let b = a + 1; b < sigs.length; b++) { const A = sigs[a], B = sigs[b]; if (A.site !== B.site || Math.hypot(A.door[0] - B.door[0], A.door[1] - B.door[1]) > NEAR) continue;
    pairs++; const face = A.h === B.h && A.par === B.par && A.leaf === B.leaf && A.shade === B.shade; if (face) { alike++; if (ex.length < 5) ex.push(`${A.id}~${B.id}`); }
    if (face && A.patch === B.patch && A.roof === B.roof) twins++; }
  // does size follow wealth? the correlation of standing with height
  const n = sigs.length, mx = sigs.reduce((s, x) => s + x.standing, 0) / n, my = sigs.reduce((s, x) => s + x.height, 0) / n;
  const cov = sigs.reduce((s, x) => s + (x.standing - mx) * (x.height - my), 0), vx = sigs.reduce((s, x) => s + (x.standing - mx) ** 2, 0), vy = sigs.reduce((s, x) => s + (x.height - my) ** 2, 0);
  return { houses: n, pairs, alike, alikeShare: +(alike / Math.max(1, pairs)).toFixed(3), twins, heightByStanding: +(cov / Math.sqrt(vx * vy)).toFixed(2), examples: ex };
}

const isMain = typeof process !== 'undefined' && process.argv[1] && /house_census/.test(process.argv[1]);
if (isMain) { const sites = buildTownPlan().sites, { items } = townFill(sites, 1); console.log('[house_census]', JSON.stringify(houseCensus(houseSigs(sites, items)))); }
