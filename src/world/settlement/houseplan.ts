// The houses' lives (D-234; the user's directions UD-08 and UD-14 via D-236): what each house in the town is like beyond its
// plan: the standing of the household that lives in it, the age of the house and when it was last re-plastered, its
// repairs and later additions, and the things a household keeps in its court and on its roof. Pure data, no three.js: the
// plan (plan.ts) calls planHouses() once after the sites are laid out, so the people (popgeo.ts via walk.ts plotCells), the
// sightlines (people/sightline.ts), the colliders and the meshes (houses.ts) all read the same fixtures.
// Nothing here draws from the plan's random streams: every choice is a hash of the plot id, so the plan (plots, rooms,
// courts, doors, hearths) is unchanged and town_plots.json stays valid.
// Evidence: no house of Achaemenid Fars has been excavated (research/SETTLEMENT.md §8). Every choice is tier C, by analogy
// (tier of the analogue in HOUSE_PARTS, houses.ts) and the gap rule D-207; its reasoning is in the F3 notes.
import { hashString, Rng } from '../../core/rng';
import { Site, Plot, ROOM, COURT, YARD } from './site';

/** a court or roof fixture of one house (site-local u, v in metres; rot = the direction the fixture faces, radians CCW
 *  from local +u; `len` along the wall) */
export interface Fixture {
  kind: FixKind; plot: number; u: number; v: number; rot: number; len: number; h?: number; row: string; note: string;
  /** the portico's two posts and its roof rectangle (local), the eave edge of the facade it stands before */
  posts?: [number, number][]; rect?: [number, number, number, number];
  /** a variant index (which kind of basket, which animal, which colour of fleece) */
  alt?: number;
}
export type FixKind = 'ladder' | 'bench' | 'portico' | 'fodder' | 'tether' | 'firewood' | 'dungcakes' | 'fleece' | 'line' | 'waterjar'
  | 'baskets' | 'broom' | 'roller' | 'roof_fuel' | 'roof_mats' | 'niche' | 'drain' | 'mortar' | 'cradle';

/** the life of one house (all C; judgement, D-207) */
export interface HouseLife {
  /** 0 the poorest household .. 1 the richest (from the plot's size and kind: the population places its largest households
   *  in the largest houses first, D-081, so size stands for land, trade and numbers) */
  standing: number;
  /** years since the house was built (the town grew with the Terrace works from c. 518 BCE: 0-50 years in 467) */
  age: number;
  /** months since the court walls were last re-plastered (renewed before the rains: autumn) */
  sincePlaster: number;
  /** stone footing visible above the ground at the lane (m) */
  socle: number;
  /** the household keeps a donkey or goats in the court */
  animal: 'donkey' | 'goats' | 'sheep' | null;
  /** a later addition: the room strip at this side of the court was built later (a straight joint, a different plaster) */
  addition: number;
  /** repair patches per 10 m of wall (fresh plaster over a fallen patch) and bare-brick patches where the plaster has gone */
  patches: number; bare: number;
  /** the timber of the street door: 0 grey old poplar .. 1 fresh planks */
  doorWood: number;
  /** the hinge side of the street door (+1 / −1 along the wall) */
  hinge: 1 | -1;
}

export const HOUSE_KINDS = new Set(['house', 'house_large', 'workshop']);
const h01 = (s: string) => hashString(s) / 4294967296;
/** a plot's standing (0..1, C) */
export function standingOf(p: Plot): number {
  const r = h01(p.id + ':standing');
  switch (p.kind) {
    case 'elite': return 0.95; case 'official': return 0.9; case 'station': case 'store': case 'stable': return 0.6;
    case 'house_large': return 0.7 + 0.3 * r;
    case 'workshop': return 0.3 + 0.35 * r;
    case 'house': return Math.min(1, Math.max(0, (p.roofed - 35) / 140)) * 0.6 + 0.3 * r + 0.05;
    default: return 0.4;
  }
}
export function lifeOf(p: Plot): HouseLife {
  const rng = new Rng(hashString(p.id), 'house-life'), st = standingOf(p);
  const age = Math.round(rng.range(1, 50) * (0.6 + 0.4 * rng.next()));
  const animalR = rng.next();
  return {
    standing: st, age,
    sincePlaster: Math.round(rng.range(0, 11) + (st < 0.3 ? rng.range(0, 24) : 0)),
    socle: +(0.22 + 0.3 * st + rng.range(-0.05, 0.08)).toFixed(2),
    animal: p.kind === 'workshop' ? (animalR < 0.25 ? 'donkey' : null) : animalR < 0.3 ? 'goats' : animalR < 0.45 ? 'donkey' : animalR < 0.55 ? 'sheep' : null,
    addition: age > 15 && rng.chance(0.35) ? rng.int(0, 3) : -1,
    patches: +(rng.range(0.4, 1.6) * (1 + age / 40)).toFixed(2),
    bare: +(rng.range(0, 1) * (1.2 - st) * (age / 30)).toFixed(2),
    doorWood: +Math.min(1, Math.max(0, st * 0.6 + rng.range(-0.2, 0.4) - age / 120)).toFixed(2),
    hinge: rng.chance(0.5) ? 1 : -1,
  };
}

/** the parapet (m above the roof) of a house of this standing: a low mud lip for the poorest, a knee-high wall (privacy for
 *  sleeping on the roof) for the better-off (C; the region's village roofs, RECOLLECTION, NOT SEEN) */
export const parapetOf = (p: Plot, st: number) => +(0.22 + 0.4 * st + (h01(p.id + ':parapet') - 0.5) * 0.12).toFixed(2);

/** rows of settlement.json town_elements the house parts and fixtures name (lint:chrono fail-closed) */
export const FIX_ROW: Record<FixKind, string> = {
  ladder: 'house_access', bench: 'house_courts', portico: 'house_porticoes', fodder: 'house_courts', tether: 'house_courts', firewood: 'house_courts',
  dungcakes: 'house_courts', fleece: 'house_courts', line: 'house_courts', waterjar: 'house_courts', baskets: 'house_courts', broom: 'house_courts',
  roller: 'house_roofs', roof_fuel: 'house_roofs', roof_mats: 'house_roofs', niche: 'house_walls', drain: 'house_walls', mortar: 'house_courts', cradle: 'house_courts',
};

interface Edge { k: number; kk: number; u: number; v: number; nu: number; nv: number } // a facade edge: room cell k, court cell kk, midpoint, normal into the court
const D4: [number, number][] = [[1, 0], [-1, 0], [0, 1], [0, -1]];

/** lay out every house's life and fixtures in a site; marks the court cells a fixture stands in (`blocked`, so the
 *  people do not stand in a heap of fodder) and sets each house's parapet from its standing */
export function planHouses(s: Site) {
  const S = s;
  S.lives = []; S.fixtures = []; S.blocked = new Set();
  // cells a fixture may not take: fittings (hearth, oven, jars, trees, looms ...) and the cells in front of every door
  const taken = new Set<number>();
  for (const f of s.fittings) { const i = s.ci(f.u), j = s.cj(f.v); for (let dj = -1; dj <= 1; dj++) for (let di = -1; di <= 1; di++) if (s.inb(i + di, j + dj)) taken.add(s.k(i + di, j + dj)); }
  const doorCells = new Set<number>();
  for (const e of s.doors) { const H = e < s.W * s.H, k = H ? e : e - s.W * s.H, i = k % s.W, j = (k / s.W) | 0; const k2 = H ? s.k(i, j + 1) : s.k(i + 1, j);
    for (const kk of [k, k2]) { if (kk < 0 || kk >= s.cell.length) continue; doorCells.add(kk); const ii = kk % s.W, jj = (kk / s.W) | 0; for (const [di, dj] of D4) if (s.inb(ii + di, jj + dj)) doorCells.add(s.k(ii + di, jj + dj)); } }
  for (const p of s.plots) {
    const life = lifeOf(p); S.lives[p.idx] = life;
    if (!HOUSE_KINDS.has(p.kind)) continue;
    p.parapet = parapetOf(p, life.standing);
    const rng = new Rng(hashString(p.id), 'house-fixtures');
    const [i0, j0, i1, j1] = p.rect;
    // the court: its cells, its facade edges (room | court of this plot) and its outer-wall edges
    const court: number[] = [], facade: Edge[] = [], outerE: Edge[] = [];
    for (let j = j0 - 2; j < j1 + 2; j++) for (let i = i0 - 2; i < i1 + 2; i++) { if (!s.inb(i, j)) continue; const k = s.k(i, j); if (s.cell[k] !== p.idx || (s.sub[k] !== COURT && s.sub[k] !== YARD)) continue; court.push(k);
      for (const [di, dj] of D4) { const ii = i + di, jj = j + dj; const kk = s.inb(ii, jj) ? s.k(ii, jj) : -1; const e: Edge = { k: kk, kk: k, u: s.cu(i) + di * 0.5, v: s.cv(j) + dj * 0.5, nu: -di, nv: -dj };
        if (kk >= 0 && s.cell[kk] === p.idx && s.sub[kk] === ROOM) facade.push(e); else if (kk < 0 || s.cell[kk] !== p.idx) outerE.push(e); } }
    if (court.length < 6) continue;
    const free = (k: number) => !taken.has(k) && !doorCells.has(k) && !S.blocked!.has(k);
    const fx = (f: Omit<Fixture, 'plot' | 'row'>, cells: number[]) => { S.fixtures!.push({ ...f, plot: p.idx, row: FIX_ROW[f.kind] }); for (const k of cells) { S.blocked!.add(k); taken.add(k); } };
    const cellAt = (u: number, v: number) => { const i = s.ci(u), j = s.cj(v); return s.inb(i, j) ? s.k(i, j) : -1; };
    const wallSpots = (edges: Edge[]) => edges.filter(e => free(e.kk));
    // 1. the ladder to the roof: every house with a court (C); against a facade where no door is near
    const lad = rng.pick(wallSpots(facade).length ? wallSpots(facade) : [null]);
    if (lad) fx({ kind: 'ladder', u: lad.u, v: lad.v, rot: Math.atan2(lad.nv, lad.nu), len: 0.5, h: p.height + 0.6,
      note: 'a poplar ladder to the roof, leaning on the eave (C: the roof is reached for sleeping, drying and repairs; wooden stairways in Babylonian houses and brick stairs in the Hasanlu buildings, B analogues; a ladder is the probable way up in a small house)' }, [lad.kk]);
    // 2. the portico before the main room of a large house (C; Hasanlu, Baba Jan: B analogues)
    if ((p.kind === 'house_large' || life.standing > 0.78) && p.kind !== 'workshop') {
      // the longest straight facade run facing the court, at least 4 m, with 2 m of court before it clear of fittings
      const runs = runsOf(facade); let best: Edge[] | null = null;
      for (const r of runs) if (r.length >= 4 && (!best || r.length > best.length)) { const n = r[0]; let ok = true;
        for (const e of r) for (let d = 0; d < 2 && ok; d++) { const k = cellAt(e.u + n.nu * (d + 0.5), e.v + n.nv * (d + 0.5)); if (k < 0 || s.cell[k] !== p.idx || s.sub[k] === ROOM || taken.has(k)) ok = false; }
        if (ok) best = r; }
      if (best) { const n = best[0], a = best[0], b = best[best.length - 1], tu = -n.nv, tv = n.nu; // along the run
        const along = (e: Edge) => e.u * tu + e.v * tv, lo = Math.min(along(a), along(b)) - 0.5, hi = Math.max(along(a), along(b)) + 0.5, L = hi - lo;
        const cu = a.u - tu * along(a), cv = a.v - tv * along(a); // the facade line's point at along = 0
        const post = (x: number): [number, number] => [cu + tu * x + n.nu * 2, cv + tv * x + n.nv * 2];
        const x1 = lo + Math.round(L / 3), x2 = hi - Math.round(L / 3);
        const us = [cu + tu * lo, cu + tu * hi, cu + tu * lo + n.nu * 2.25, cu + tu * hi + n.nu * 2.25], vs = [cv + tv * lo, cv + tv * hi, cv + tv * lo + n.nv * 2.25, cv + tv * hi + n.nv * 2.25];
        fx({ kind: 'portico', u: (post(x1)[0] + post(x2)[0]) / 2, v: (post(x1)[1] + post(x2)[1]) / 2, rot: Math.atan2(n.nv, n.nu), len: L, posts: [post(x1), post(x2)],
          rect: [Math.min(...us), Math.min(...vs), Math.max(...us), Math.max(...vs)],
          note: 'a portico of two timber posts on rough stone bases before the main room, roofed like the rooms (paired wooden portico columns at Hasanlu, wooden columns on uncarved stone slab bases, columned rooms opening on a court at Baba Jan and Nush-i Jan: SX, B analogues; in a large town house C)' }, []);
      }
    }
    // 3. a mud bench along a court wall (C; low benches along walls at Tol-e Ajori and in the Hasanlu porticoes: B analogues)
    if (rng.chance(0.25 + 0.5 * life.standing)) { const e = rng.pick(wallSpots(facade.length ? facade : outerE).length ? wallSpots(facade.length ? facade : outerE) : [null]);
      if (e) fx({ kind: 'bench', u: e.u, v: e.v, rot: Math.atan2(e.nv, e.nu), len: rng.range(1.2, 2.0), h: 0.42, note: 'a mud-brick bench along the court wall, plastered with the wall (C; benches along walls: Tol-e Ajori, Hasanlu, B analogues)' }, [e.kk]); }
    // 4. the household's animal: a tether peg, a mud manger against the wall, dung trodden in; fodder heaped by it
    if (life.animal) { const e = rng.pick(wallSpots(outerE.length ? outerE : facade).length ? wallSpots(outerE.length ? outerE : facade) : [null]);
      if (e) { fx({ kind: 'tether', u: e.u, v: e.v, rot: Math.atan2(e.nv, e.nu), len: 1.4, alt: life.animal === 'donkey' ? 0 : life.animal === 'goats' ? 1 : 2,
        note: `where the household's ${life.animal === 'donkey' ? 'donkey' : life.animal} ${life.animal === 'donkey' ? 'is' : 'are'} tied: a mud manger on the wall, a peg, dung trodden into the floor (C; donkeys and small stock kept in town: PF rations for animals, B; in the court C)` }, [e.kk]);
        const f2 = wallSpots(outerE).find(x => Math.hypot(x.u - e.u, x.v - e.v) > 1.2 && Math.hypot(x.u - e.u, x.v - e.v) < 3.2);
        if (f2) fx({ kind: 'fodder', u: f2.u, v: f2.v, rot: Math.atan2(f2.nv, f2.nu), len: rng.range(0.9, 1.5), h: rng.range(0.5, 1.1), note: 'a heap of chopped straw and barley stalks for the animal (C)' }, [f2.kk]); } }
    // 5. fuel: brushwood and thorn stacked against a wall; dung cakes slapped on a sunny wall to dry (C; the region's fuel,
    //    RECOLLECTION, NOT SEEN; dung as fuel on a treeless plain is the probable reconstruction)
    { const e = rng.pick(wallSpots(outerE).length ? wallSpots(outerE) : [null]); if (e && rng.chance(0.75)) fx({ kind: 'firewood', u: e.u, v: e.v, rot: Math.atan2(e.nv, e.nu), len: rng.range(0.8, 1.8), h: rng.range(0.5, 1.2), alt: rng.int(0, 2), note: 'brushwood and thorn fuel stacked against the wall (C)' }, [e.kk]); }
    if (rng.chance(0.45)) { const e = rng.pick(outerE.length ? outerE : facade); if (e) S.fixtures!.push({ kind: 'dungcakes', plot: p.idx, row: FIX_ROW.dungcakes, u: e.u, v: e.v, rot: Math.atan2(e.nv, e.nu), len: rng.range(1.2, 2.6), h: rng.range(0.9, 1.6), alt: rng.int(8, 22), note: 'dung cakes pressed on the wall to dry for fuel (C)' }); }
    // 6. water jar and a cup on a stand inside the street door; baskets; a broom; a stone mortar (C)
    if (p.door) { const ia = p.door.cell % s.W, ja = (p.door.cell / s.W) | 0, ib = p.door.out % s.W, jb = (p.door.out / s.W) | 0;
      S.fixtures!.push({ kind: 'niche', plot: p.idx, row: FIX_ROW.niche, u: (s.cu(ia) + s.cu(ib)) / 2, v: (s.cv(ja) + s.cv(jb)) / 2, rot: Math.atan2(jb - ja, ib - ia), len: life.hinge, alt: rng.int(0, 3),
        note: 'a small niche in the wall by the street door (a lamp at night); the doorstep worn and patched (C)' }); }
    const cor = court.filter(k => free(k)); if (cor.length) { const k = rng.pick(cor); fx({ kind: 'baskets', u: s.cu(k % s.W), v: s.cv((k / s.W) | 0), rot: rng.range(0, 6.28), len: 1, alt: rng.int(0, 5), note: 'baskets, a sieve and a broom of twigs (C)' }, [k]); }
    if (rng.chance(0.4)) { const c2 = court.filter(k => free(k)); if (c2.length) { const k = rng.pick(c2); fx({ kind: 'mortar', u: s.cu(k % s.W), v: s.cv((k / s.W) | 0), rot: rng.range(0, 6.28), len: 1, note: 'a stone mortar and a wooden pestle for pounding grain (C)' }, [k]); } }
    // 7. a line strung across a corner of the court with washed cloth or a fleece drying; fleeces over the parapet (C)
    if (rng.chance(0.3) && outerE.length >= 2) { const e = rng.pick(outerE); S.fixtures!.push({ kind: 'line', plot: p.idx, row: FIX_ROW.line, u: e.u, v: e.v, rot: Math.atan2(e.nv, e.nu), len: rng.range(2, 3.5), h: 1.9, alt: rng.int(0, 7), note: 'a cord with washed cloth hung to dry (wool and linen: PF textile work, B; the line C)' }); }
    if (rng.chance(0.25) && life.animal !== 'donkey') S.fixtures!.push({ kind: 'fleece', plot: p.idx, row: FIX_ROW.fleece, u: 0, v: 0, rot: 0, len: 1, alt: rng.int(0, 3), note: 'a fleece or a rug laid over the parapet to air (C)' });
    // 8. the roof: a stone roller for the earth after rain (Iron Age roof rollers: SX, the Levant, B analogue; C here),
    //    brushwood and dung-cake fuel stacked on the roof, sleeping mats rolled (the summer nights are slept on the roof, C)
    if (rng.chance(0.45 + 0.3 * life.standing)) S.fixtures!.push({ kind: 'roller', plot: p.idx, row: FIX_ROW.roller, u: 0, v: 0, rot: rng.range(0, 6.28), len: 0.6, alt: rng.int(0, 99), note: 'a stone roller for rolling the roof earth firm after rain (Iron Age roof rollers, SX: B analogue; C)' });
    if (rng.chance(0.55)) S.fixtures!.push({ kind: 'roof_fuel', plot: p.idx, row: FIX_ROW.roof_fuel, u: 0, v: 0, rot: rng.range(0, 6.28), len: rng.range(1, 2.5), alt: rng.int(0, 99), note: 'fuel stacked on the roof: brushwood, thorn, dung cakes (C)' });
    if (rng.chance(0.5)) S.fixtures!.push({ kind: 'roof_mats', plot: p.idx, row: FIX_ROW.roof_mats, u: 0, v: 0, rot: rng.range(0, 6.28), len: 1.8, alt: rng.int(0, 99), note: 'reed sleeping mats and bedding on the roof, rolled by day (summer nights on the roof, C)' });
    if (rng.chance(0.08) && p.kind !== 'workshop') { const c3 = court.filter(k => free(k)); if (c3.length) { const k = rng.pick(c3); fx({ kind: 'cradle', u: s.cu(k % s.W), v: s.cv((k / s.W) | 0), rot: rng.range(0, 6.28), len: 1, note: 'a wooden cradle in the shade of the wall (C)' }, [k]); } }
    // 9. a drain hole through the outer wall at the court's low corner, with its wet stain in the lane (C)
    { const lane = outerE.filter(e => e.k >= 0 && s.cell[e.k] < 0); if (lane.length) { const e = rng.pick(lane); S.fixtures!.push({ kind: 'drain', plot: p.idx, row: FIX_ROW.drain, u: e.u, v: e.v, rot: Math.atan2(-e.nv, -e.nu), len: 0.2, note: 'a drain hole through the court wall into the lane, its outfall stained (Babylonian houses drained courts and bathrooms: SX, B analogue; C)' }); } }
  }
}
/** facade edges grouped into straight runs (same normal, contiguous along the wall) */
function runsOf(edges: Edge[]): Edge[][] {
  const key = (e: Edge) => `${e.nu},${e.nv},${e.nu ? e.u.toFixed(2) : e.v.toFixed(2)}`, groups = new Map<string, Edge[]>();
  for (const e of edges) { const k = key(e); (groups.get(k) ?? groups.set(k, []).get(k)!).push(e); }
  const out: Edge[][] = [];
  for (const g of groups.values()) { const along = (e: Edge) => (g[0].nu ? e.v : e.u); g.sort((a, b) => along(a) - along(b)); let cur: Edge[] = [g[0]];
    for (let x = 1; x < g.length; x++) { if (Math.abs(along(g[x]) - along(g[x - 1]) - 1) < 0.01) cur.push(g[x]); else { out.push(cur); cur = [g[x]]; } } out.push(cur); }
  return out;
}
/** a site's fixtures and lives (after planHouses) */
export const fixturesOf = (s: Site): Fixture[] => s.fixtures ?? [];
export const livesOf = (s: Site): HouseLife[] => s.lives ?? [];
export const blockedOf = (s: Site): Set<number> => s.blocked ?? new Set();
