// The town fill census (s17 C1, D-550): is every lane, court and roof of the town dressed? Pure data (the plan and the fill
// plan, no three.js draw): run `npx tsx tools/dev/fill_census.ts [--json out.json]`.
// Measures, per quarter and for the whole town:
//  - lanes: every lane cell's distance to the nearest thing the fill or the houses put there (fill items, wells, troughs,
//    drains); a cell with nothing within 3 m is bare (a walker passes 6 m with nothing beside them); the bare share and the
//    longest bare stretch (the geodesic length of the largest connected run of bare lane cells, m); props per 10 m² of lane.
//  - squares: the same, the market's stalls counted.
//  - courts: each house court (>= 6 cells) and the number of things in it (houseplan.ts fixtures, the plan's fittings in it); dressed = >= 3.
//  - roofs: each house roof and the things on it (roller, fuel, mats, fleece over the parapet); dressed = >= 1.
//  - repeats: pairs of the same model within 15 m that look identical (same scale within 3 %, same colours, turned within
//    10 degrees): the clones the eye catches; and the share of items with another of the same model within 4 m.
import { writeFileSync } from 'node:fs';
import { buildTownPlan } from '../../src/world/settlement/plan';
import { LANE, SQUARE, COURT, YARD, toLocal, type Site } from '../../src/world/settlement/site';
import { HOUSE_KINDS } from '../../src/world/settlement/houseplan';
import { townFill, type FillItem } from '../../src/world/fillPlan';

const ROOF_KINDS = new Set(['roller', 'roof_fuel', 'roof_mats', 'fleece', 'roof_jars', 'roof_drying', 'roof_patch']);
const LANE_SIDE = new Set(['drain', 'niche']);
const BARE_R = 3;

export interface Census {
  lane: { cells: number; bare: number; bareShare: number; longestBare: number; per10: number };
  square: { cells: number; bare: number; bareShare: number; per10: number };
  courts: { n: number; dressed: number; meanThings: number; per10: number };
  roofs: { n: number; dressed: number; meanThings: number };
  repeats: { clones15: number; sameNear4Share: number; items: number; byModel: Record<string, number> };
  quarters: { id: string; laneBare: number; longestBare: number; courtsDressed: string; roofsDressed: string }[];
}

export function census(sites: Site[], items: FillItem[]): Census {
  // a spatial hash of every grid point that dresses a lane (fill items + lane-side fixtures + open-ground fittings)
  const pts: [number, number][] = items.map(i => [i.e, i.n]);
  for (const s of sites) { for (const f of s.fixtures ?? []) if (LANE_SIDE.has(f.kind)) pts.push(s.grid(f.u, f.v));
    for (const f of s.fittings) { const c = s.at(s.ci(f.u), s.cj(f.v)); if (c === LANE || c === SQUARE) pts.push(s.grid(f.u, f.v)); } }
  const G = new Map<string, [number, number][]>(), key = (e: number, n: number) => `${Math.floor(e / 4)},${Math.floor(n / 4)}`;
  for (const p of pts) { const k = key(p[0], p[1]); (G.get(k) ?? G.set(k, []).get(k)!).push(p); }
  const near = (e: number, n: number, r: number) => { const i0 = Math.floor(e / 4), j0 = Math.floor(n / 4); let c = 0;
    for (let a = -1; a <= 1; a++) for (let b = -1; b <= 1; b++) for (const [x, y] of G.get(`${i0 + a},${j0 + b}`) ?? []) if (Math.hypot(x - e, y - n) < r) c++; return c; };
  const out: Census = { lane: { cells: 0, bare: 0, bareShare: 0, longestBare: 0, per10: 0 }, square: { cells: 0, bare: 0, bareShare: 0, per10: 0 },
    courts: { n: 0, dressed: 0, meanThings: 0, per10: 0 }, roofs: { n: 0, dressed: 0, meanThings: 0 }, repeats: { clones15: 0, sameNear4Share: 0, items: items.length, byModel: {} }, quarters: [] };
  let laneItems = 0, sqItems = 0, courtThings = 0, courtCells = 0, roofThings = 0;
  for (const it of items) if (it.at === 'lane' || it.at === 'gap' || it.at === 'litter' || it.at === 'door' || it.at === 'line') laneItems++; else if (it.at === 'market') sqItems++;
  for (const s of sites) { if (s.meta.kind !== 'quarter') continue;
    const W = s.W, bare = new Uint8Array(W * s.H); let qBare = 0, qLane = 0;
    for (let j = 0; j < s.H; j++) for (let i = 0; i < W; i++) { const k = j * W + i, c = s.cell[k]; if (c !== LANE && c !== SQUARE) continue;
      const [e, n] = s.grid(s.cu(i), s.cv(j)), b = near(e, n, BARE_R) === 0;
      if (c === LANE) { out.lane.cells++; qLane++; if (b) { out.lane.bare++; qBare++; bare[k] = 1; } } else { out.square.cells++; if (b) out.square.bare++; } }
    // the longest bare stretch: per connected run of bare lane cells, its geodesic diameter (two BFS passes)
    let longest = 0; const seen = new Uint8Array(W * s.H);
    const bfs = (k0: number) => { const d = new Map<number, number>([[k0, 0]]), q = [k0]; let far = k0;
      for (let x = 0; x < q.length; x++) { const k = q[x], i = k % W, j = (k / W) | 0; for (const [di, dj] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { const i2 = i + di, j2 = j + dj; if (!s.inb(i2, j2)) continue; const k2 = j2 * W + i2;
        if (bare[k2] && !d.has(k2)) { d.set(k2, d.get(k)! + 1); q.push(k2); if (d.get(k2)! > d.get(far)!) far = k2; } } }
      return { far, dist: d.get(far)!, all: q }; };
    for (let k = 0; k < W * s.H; k++) if (bare[k] && !seen[k]) { const a = bfs(k); for (const x of a.all) seen[x] = 1; const b = bfs(a.far); longest = Math.max(longest, b.dist + 1); }
    out.lane.longestBare = Math.max(out.lane.longestBare, longest);
    // courts and roofs
    let qc = 0, qcd = 0, qr = 0, qrd = 0;
    const byPlot = new Map<number, { court: number; roof: number }>();
    for (const f of s.fixtures ?? []) { const r = byPlot.get(f.plot) ?? byPlot.set(f.plot, { court: 0, roof: 0 }).get(f.plot)!; if (ROOF_KINDS.has(f.kind)) r.roof++; else if (!LANE_SIDE.has(f.kind)) r.court++; }
    // (the plan's fittings standing in a court count: hearths, ovens, jars, querns, looms, trees, troughs)
    for (const f of s.fittings) { if (f.plot < 0) continue; const i = s.ci(f.u), j = s.cj(f.v); if (!s.inb(i, j)) continue; const k = s.k(i, j);
      if (s.cell[k] === f.plot && (s.sub[k] === COURT || s.sub[k] === YARD)) { const r = byPlot.get(f.plot) ?? byPlot.set(f.plot, { court: 0, roof: 0 }).get(f.plot)!; r.court++; } }
    const courtN = new Map<number, number>(); for (let k = 0; k < W * s.H; k++) { const c = s.cell[k]; if (c >= 0 && (s.sub[k] === COURT || s.sub[k] === YARD)) courtN.set(c, (courtN.get(c) ?? 0) + 1); }
    for (const p of s.plots) { if (!HOUSE_KINDS.has(p.kind)) continue; const r = byPlot.get(p.idx) ?? { court: 0, roof: 0 };
      if (p.roofed > 0) { qr++; out.roofs.n++; roofThings += r.roof; if (r.roof >= 1) { qrd++; out.roofs.dressed++; } }
      const cn = courtN.get(p.idx) ?? 0; if (cn >= 6) { qc++; out.courts.n++; courtThings += r.court; courtCells += cn; if (r.court >= 3) { qcd++; out.courts.dressed++; } } }
    out.quarters.push({ id: s.id, laneBare: +(qBare / Math.max(1, qLane)).toFixed(3), longestBare: longest, courtsDressed: `${qcd}/${qc}`, roofsDressed: `${qrd}/${qr}` });
  }
  out.lane.bareShare = +(out.lane.bare / Math.max(1, out.lane.cells)).toFixed(3); out.square.bareShare = +(out.square.bare / Math.max(1, out.square.cells)).toFixed(3);
  out.lane.per10 = +(laneItems / out.lane.cells * 10).toFixed(2); out.square.per10 = +(sqItems / Math.max(1, out.square.cells) * 10).toFixed(2);
  out.courts.meanThings = +(courtThings / Math.max(1, out.courts.n)).toFixed(2); out.courts.per10 = +(courtThings / Math.max(1, courtCells) * 10).toFixed(2);
  out.roofs.meanThings = +(roofThings / Math.max(1, out.roofs.n)).toFixed(2);
  // repeats
  const IG = new Map<string, FillItem[]>(), ik = (e: number, n: number) => `${Math.floor(e / 15)},${Math.floor(n / 15)}`;
  for (const it of items) { const k = ik(it.e, it.n); (IG.get(k) ?? IG.set(k, []).get(k)!).push(it); }
  const same = (a: FillItem, b: FillItem) => a.m === b.m && Math.abs(a.s[0] - b.s[0]) < 0.03 * a.s[0] && Math.abs(a.s[1] - b.s[1]) < 0.03 * a.s[1] && JSON.stringify(a.col ?? {}) === JSON.stringify(b.col ?? {})
    && Math.abs(Math.atan2(Math.sin(a.rot - b.rot), Math.cos(a.rot - b.rot))) < 0.175 && Math.abs((a.tilt ?? 0) - (b.tilt ?? 0)) < 0.05;
  let clones = 0, near4 = 0;
  for (const a of items) { const i0 = Math.floor(a.e / 15), j0 = Math.floor(a.n / 15); let n4 = false;
    for (let x = -1; x <= 1; x++) for (let y = -1; y <= 1; y++) for (const b of IG.get(`${i0 + x},${j0 + y}`) ?? []) { if (b === a) continue; const d = Math.hypot(a.e - b.e, a.n - b.n);
      if (a.m === b.m && d < 4) n4 = true; if (d < 15 && same(a, b) && a.e < b.e) { clones++; out.repeats.byModel[a.m] = (out.repeats.byModel[a.m] ?? 0) + 1; } }
    if (n4) near4++; }
  out.repeats.clones15 = clones; out.repeats.sameNear4Share = +(near4 / Math.max(1, items.length)).toFixed(3);
  return out;
}

const isMain = typeof process !== 'undefined' && process.argv[1] && /fill_census/.test(process.argv[1]);
if (isMain) {
  const t0 = Date.now(), sites = buildTownPlan().sites, { items, stats } = townFill(sites, 1);
  const c = census(sites, items);
  console.log(`[fill_census] ${items.length} items (${JSON.stringify(stats)}) in ${((Date.now() - t0) / 1000).toFixed(1)} s`);
  console.log(`lanes: ${c.lane.cells} cells, bare ${c.lane.bare} (${(c.lane.bareShare * 100).toFixed(1)} %), longest bare stretch ${c.lane.longestBare} m, ${c.lane.per10} things / 10 m²`);
  console.log(`squares: ${c.square.cells} cells, bare ${(c.square.bareShare * 100).toFixed(1)} %, ${c.square.per10} things / 10 m²`);
  console.log(`courts: ${c.courts.dressed}/${c.courts.n} dressed (>= 3 things), mean ${c.courts.meanThings}, ${c.courts.per10} / 10 m²`);
  console.log(`roofs: ${c.roofs.dressed}/${c.roofs.n} dressed (>= 1 thing), mean ${c.roofs.meanThings}`);
  console.log(`repeats: ${c.repeats.clones15} identical pairs within 15 m; ${(c.repeats.sameNear4Share * 100).toFixed(1)} % of items have the same model within 4 m ${JSON.stringify(c.repeats.byModel)}`);
  for (const q of c.quarters) console.log(`  ${q.id.padEnd(22)} lane bare ${(q.laneBare * 100).toFixed(1).padStart(5)} %  longest ${String(q.longestBare).padStart(4)} m  courts ${q.courtsDressed}  roofs ${q.roofsDressed}`);
  // --cost: the drawn fill (WorldFill, the real models) at every 25th lane point sampled over the town by day: draws, triangles
  if (process.argv.includes('--cost')) { const { loadModelsNode } = await import('../../tests/lib/models_node'); const { WorldFill } = await import('../../src/world/fill'); loadModelsNode();
    const F = new WorldFill(items, { ground: () => 0 }), S: { draws: number; tris: number; drawn: number }[] = [];
    for (const s of sites) { if (s.meta.kind !== 'quarter') continue; let q = 0; for (let j = 0; j < s.H; j += 7) for (let i = 0; i < s.W; i += 7) if (s.cell[s.k(i, j)] === LANE && q++ % 25 === 0) { F.update(s.grid(s.cu(i), s.cv(j)), 9, 0, true); S.push(F.stats()); } }
    const avg = (f: (x: typeof S[0]) => number) => Math.round(S.reduce((a, x) => a + f(x), 0) / S.length), max = (f: (x: typeof S[0]) => number) => Math.max(...S.map(f));
    console.log(`cost (${S.length} lane views, 9 h): draws mean ${avg(x => x.draws)} max ${max(x => x.draws)}; triangles mean ${avg(x => x.tris)} max ${max(x => x.tris)}; things drawn mean ${avg(x => x.drawn)}; missing ${JSON.stringify(F.missing)}`); }
  const j = process.argv.indexOf('--json'); if (j > 0) writeFileSync(process.argv[j + 1], JSON.stringify(c, null, 1));
}
