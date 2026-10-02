// dev (s17 C2, D-560): the plain's empty-ground census, in node, from the same placement code the page runs. For every path a
// walker follows across the plain (the settlement.json roads, the village tracks, the town's desire lines), the ground within
// 30 m of it is sampled on the ground cover's own 2 m cells (groundCover.ts COVER.cell), and each cell is asked: does any
// object stand in it? Objects: the ground cover (tufts, sward, stubble, dung), the flora (thorn cushions, camelthorn,
// thistles), the loose rocks (stones, boulders), the standing crop (crops.ts grid: any clump with height or stubble today),
// the trees (river and canal lines, orchards, woodland; the crown's inner half); with the roadside rules (plain/verge.ts).
// Reported per plain area of data/areas.json (village, river-reach, near-ground, plain-sector: the first that holds the cell):
//  - bare: share of the cells within 30 m of a path (off its tread) with no object;
//  - roadside: along each path, both verges (the 2 m cells at tread + 1 m and + 3 m) in 2 m steps: the longest run with
//    both verge cells empty, and the length in runs over 15 m;
//  - repeats: trees, rocks and flora within 30 m of a path that have a twin within 20 m (same model and variant, scale within
//    6 %, proportions within 6 %, yaw within 15 deg, lean within 4 deg): reads as a copy-paste;
//  - fields: the cropped cells' state today (standing green, ripening, stubble, tilled/bare plough) by month.
// Cells the census leaves out: water and its 8 m margin (riparian.ts reeds own it), built ground, the Terrace, the town's
// sites and zones (C1's), and the tread of the path itself (worn bare on purpose).
// Usage: npx tsx tools/dev/plain_census.ts [--doy 107] [--seed 1] [--max-km 14] [--json out.json]
import { writeFileSync, readFileSync } from 'node:fs';
import { loadTerrain, loadRiversFile } from '../../tests/plainLib';
import { buildTownPlan } from '../../src/world/settlement/plan';
import { buildTownGround, groundAt4, desireLines } from '../../src/world/plain/townGround';
import { buildZones, landUseAt, hash2, unit, cellU, type ZoneMap } from '../../src/world/plain/fields';
import { buildCanals } from '../../src/world/plain/canals';
import { placeVillages } from '../../src/world/plain/villages';
import { riparianTrees, canalTrees, orchardPlots, orchardPlotTrees, woodlandTrees, type Tree } from '../../src/world/plain/trees';
import { trackLines } from '../../src/world/plain/ribbons';
import { settlementRoads, feature } from '../../src/world/plain/data';
import { coverCell, COVER } from '../../src/world/plain/groundCover';
import { cropState, YEAR } from '../../src/world/plain/seasonal';
import { PLAIN_QUALITY } from '../../src/world/plain/index';
import { FLORA, floraCell, type FloraKind } from '../../src/world/groundFlora';
import { ROCKS, rockCell, type RockKind } from '../../src/world/groundRocks';
import { CELL as SCELL, type CellCtx } from '../../src/world/smallLife';
import { treeInst } from '../../src/world/trees/render';
import { FOOTPRINTS } from '../../src/arch/spec';
import { toLocal } from '../../src/world/settlement/site';
import { DOY_AT_DAY0, SEASON_TABLE } from '../../src/world/season';
import { setVergePaths } from '../../src/world/plain/verge';

const arg = (k: string, d: string) => { const i = process.argv.indexOf(k); return i > 0 ? process.argv[i + 1] : d; };
const DOY = +arg('--doy', String(DOY_AT_DAY0 + 5)), SEED = +arg('--seed', '1'), MAXKM = +arg('--max-km', '14'), OUT = arg('--json', '');
const NO_VERGE = process.argv.includes('--no-verge');
const BAND = 30, STEP_ALONG = 10, C = COVER.cell;
const seasonOf = (doy: number) => { const d = ((doy % YEAR) + YEAR) % YEAR; for (let i = 1; i < SEASON_TABLE.length; i++) { const a = SEASON_TABLE[i - 1], b = SEASON_TABLE[i]; if (d <= b.doy) { const t = (d - a.doy) / (b.doy - a.doy); return { green: a.green + (b.green - a.green) * t, dry: a.dry + (b.dry - a.dry) * t }; } } return SEASON_TABLE[0]; };

// ------------------------------------------------------------------ the world as the page builds it (world.ts, plain/index.ts)
const t0 = Date.now();
const T = loadTerrain(), RV = loadRiversFile(), plan = buildTownPlan(), G = buildTownGround(plan);
const canals = buildCanals(T, RV.rivers, SEED), villages = placeVillages(T, RV.rivers, canals, SEED);
const Z: ZoneMap = buildZones({ terrain: T, rivers: RV.rivers.map(r => ({ x: r.x, y: r.y, halfCorridor: r.carveRadius.mid + 24 })), villages: villages.map(v => ({ x: v.x, y: v.y, r: v.r })), ground: G,
  sites: plan.sites.map(s => ({ c: s.frame.c as [number, number], theta: s.frame.theta, W: s.W, H: s.H })) });
const ground = (x: number, z: number) => T.surfaceAt(x, z);
// the small cells' context (world.ts ctxAt, the middens left out: the town's)
const wetLines: { pts: [number, number][]; hw: number }[] = [...RV.rivers.map(r => ({ pts: Array.from(r.x, (x, i) => [x, r.y[i]] as [number, number]), hw: r.topWidth / 2 })), ...canals.map(c => ({ pts: c.pts as [number, number][], hw: 1.5 }))];
const segIdx = new Map<number, { a: [number, number]; b: [number, number]; hw: number }[]>(); const SI = 100, sk = (i: number, j: number) => (i + 5000) * 10000 + (j + 5000);
for (const L of wetLines) for (let i = 1; i < L.pts.length; i++) { const a = L.pts[i - 1], b = L.pts[i];
  for (let x = Math.floor(Math.min(a[0], b[0]) / SI) - 1; x <= Math.floor(Math.max(a[0], b[0]) / SI) + 1; x++) for (let y = Math.floor(Math.min(a[1], b[1]) / SI) - 1; y <= Math.floor(Math.max(a[1], b[1]) / SI) + 1; y++) {
    const k = sk(x, y); let l = segIdx.get(k); if (!l) segIdx.set(k, l = []); l.push({ a, b, hw: L.hw }); } }
const dSeg = (p: [number, number], a: [number, number], b: [number, number]) => { const dx = b[0] - a[0], dy = b[1] - a[1], L2 = dx * dx + dy * dy || 1, t = Math.max(0, Math.min(1, ((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / L2)); return Math.hypot(p[0] - a[0] - t * dx, p[1] - a[1] - t * dy); };
const wetAt = (e: number, n: number) => { let best = Infinity, hw = 0; for (const s of segIdx.get(sk(Math.floor(e / SI), Math.floor(n / SI))) ?? []) { const d = dSeg([e, n], s.a, s.b); if (d < best) { best = d; hw = s.hw; } } return { d: best, hw }; };
const terr = (FOOTPRINTS as any).terrace.polygon as [number, number][];
const inPoly = (P: readonly (readonly number[])[], x: number, y: number) => { let c = false; for (let i = 0, j = P.length - 1; i < P.length; j = i++) { const [xi, yi] = P[i], [xj, yj] = P[j]; if ((yi > y) !== (yj > y) && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) c = !c; } return c; };
const built = (e: number, n: number) => inPoly(terr, e, n) || plan.sites.some(s0 => { const s = s0 as any; if (Math.hypot(e - s.frame.c[0], n - s.frame.c[1]) > Math.hypot(s.W, s.H)) return false; const [u, v] = toLocal(s.frame, e, n), i = s.ci(u), j = s.cj(v); return s.inb(i, j) && s.cell[s.k(i, j)] >= 0; });
const ctxAt = (e: number, n: number): CellCtx => {
  if (built(e, n)) return 'none';
  const w = wetAt(e, n); if (w.d < 40) { if (w.d > w.hw - 4 && w.d < w.hw + 8) return 'water'; if (w.d <= w.hw - 4) return 'none'; }
  const h = (a: number, b: number) => T.heightAt(a, -b), sl = Math.hypot(h(e + 4, n) - h(e - 4, n), h(e, n + 4) - h(e, n - 4)) / 8;
  if (sl > 0.3) return 'rock';
  return landUseAt(Z, e, -n).use === 'natural' ? 'steppe' : 'field';
};
const ctxCache = new Map<number, CellCtx>(), ctxCell = (ix: number, iy: number) => { const k = (ix + 32768) * 65536 + (iy + 32768); let c = ctxCache.get(k); if (c === undefined) { c = ctxAt((ix + 0.5) * SCELL, (iy + 0.5) * SCELL); ctxCache.set(k, c); } return c; };

// ------------------------------------------------------------------ the paths
const tracks = trackLines(villages), tw = feature('villages_unlocated').tracks.width_m as number;
const paths: { id: string; pts: [number, number][]; hw: number; kind: 'road' | 'track' | 'path' }[] = [
  ...settlementRoads().map(r => ({ id: r.id, pts: r.pts, hw: r.width / 2, kind: 'road' as const })),
  ...tracks.map((pts, i) => ({ id: `track_${i}`, pts: pts as [number, number][], hw: tw / 2, kind: 'track' as const })),
  ...desireLines(plan).map((l, i) => ({ id: `desire_${i}`, pts: [l.a, l.b] as [number, number][], hw: l.w / 2, kind: 'path' as const })),
].map(p => ({ ...p, pts: p.pts.filter(q => Math.hypot(q[0], q[1]) < MAXKM * 1000) })).filter(p => p.pts.length > 1);
// the page's roadside rules (verge.ts), off with --no-verge (the baseline)
if (!NO_VERGE) setVergePaths(paths.map(p => ({ pts: p.pts, hw: p.hw, kind: p.kind })));
// a coarse index of all path segments: the tread test (a cell on any path's tread is left out)
const pIdx = new Map<number, { a: [number, number]; b: [number, number]; hw: number }[]>(); const PI_ = 40;
for (const p of paths) for (let i = 1; i < p.pts.length; i++) { const a = p.pts[i - 1], b = p.pts[i];
  for (let x = Math.floor(Math.min(a[0], b[0]) / PI_) - 1; x <= Math.floor(Math.max(a[0], b[0]) / PI_) + 1; x++) for (let y = Math.floor(Math.min(a[1], b[1]) / PI_) - 1; y <= Math.floor(Math.max(a[1], b[1]) / PI_) + 1; y++) {
    const k = sk(x, y); let l = pIdx.get(k); if (!l) pIdx.set(k, l = []); l.push({ a, b, hw: p.hw }); } }
const onTread = (e: number, n: number) => (pIdx.get(sk(Math.floor(e / PI_), Math.floor(n / PI_))) ?? []).some(s => dSeg([e, n], s.a, s.b) < s.hw + 0.3);

// ------------------------------------------------------------------ the areas (data/areas.json): plain kinds, unique first
const AREAS = JSON.parse(readFileSync('data/areas.json', 'utf8')).areas as any[];
const KINDS = ['village', 'river-reach', 'near-ground', 'garden-zone', 'plain-sector'];
const areaList = AREAS.filter(a => KINDS.includes(a.kind)).sort((a, b) => KINDS.indexOf(a.kind) - KINDS.indexOf(b.kind));
const excluded = AREAS.filter(a => ['town-site', 'town-zone', 'terrace-open', 'terrace-court', 'terrace-interior', 'camp', 'approach'].includes(a.kind));
const inArea = (a: any, e: number, n: number) => e >= a.bbox[0] && e <= a.bbox[2] && n >= a.bbox[1] && n <= a.bbox[3] && (a.shape as number[][][][]).some(poly => inPoly(poly[0], e, n) && !poly.slice(1).some(h => inPoly(h, e, n)));
const areaAt = (e: number, n: number): string | null => { if (excluded.some(a => inArea(a, e, n))) return null; const a = areaList.find(q => inArea(q, e, n)); return a ? a.id : null; };

// ------------------------------------------------------------------ the objects in a 2 m cell
const season = seasonOf(DOY);
const covEnv = { ground, zones: Z, trodden: (x: number, z: number) => groundAt4(G, x, -z)[1], blocked: (x: number, z: number) => { const c = ctxCell(Math.floor(x / SCELL), Math.floor(-z / SCELL)); return c === 'none' || c === 'water'; } };
interface Obj { cls: string; key: string; e: number; n: number; s: number; yaw: number; asp: number; lean: [number, number]; r: number }
const smallObjs = new Map<number, Obj[]>(), floraMemo = new Map<number, any[]>(), rockMemo = new Map<number, any[]>(); // per 8 m small cell: flora + rocks
const NV: Record<RockKind, number> = { stone: 12, boulder: 6 }; // public/models/props/manifest.json roles (stone; boulder + outcrop)
const smallCell = (ix: number, iy: number) => { const k = (ix + 32768) * 65536 + (iy + 32768); let l = smallObjs.get(k); if (l) return l; l = [];
  const cx = ctxCell(ix, iy);
  void cx;
  for (const f of Object.keys(FLORA) as FloraKind[]) for (const it of floraCell(SEED, f, ix, iy, ctxCell, floraMemo)) l.push({ cls: 'flora', key: f, e: it.e, n: it.n, s: it.sz, yaw: it.yaw, asp: it.asp, lean: it.lean, r: it.sz * 0.4 });
  for (const r of Object.keys(ROCKS) as RockKind[]) for (const it of rockCell(SEED, r, ix, iy, NV[r], ctxCell, rockMemo)) l.push({ cls: 'rock', key: `${r}:${it.vi}`, e: it.e, n: it.n, s: it.sz, yaw: it.yaw, asp: it.sy, lean: it.tilt, r: it.sz * 0.4 });
  smallObjs.set(k, l); return l; };
const coverMemo = new Map<number, number>();
const coverCount = (ix: number, iz: number) => { const k = (ix + 32768) * 65536 + (iz + 32768); let c = coverMemo.get(k); if (c === undefined) { c = coverCell(covEnv, ix, iz, SEED, DOY, season).length; coverMemo.set(k, c); } return c; };
// the standing crop (crops.ts: grid cropStep, skipped on bunds, district tracks and the orchard floor; present when it has height or stubble today)
const Q = PLAIN_QUALITY.high;
const cropIn = (x0: number, z0: number) => { const sp = Q.cropStep; let n = 0;
  for (let i = Math.floor(x0 / sp); i <= Math.floor((x0 + C) / sp); i++) for (let j = Math.floor(z0 / sp); j <= Math.floor((z0 + C) / sp); j++) {
    const hh = hash2(cellU(i), cellU(j), 91), x = (i + 0.5 + 0.8 * (unit(hh) - 0.5)) * sp, z = (j + 0.5 + 0.8 * (unit(hash2(cellU(i), cellU(j), 92)) - 0.5)) * sp;
    if (x < x0 || x >= x0 + C || z < z0 || z >= z0 + C) continue;
    const u = landUseAt(Z, x, z); if (u.use === 'natural' || u.row === 'orchard_floor' || u.plot.edge < 0.35 || u.plot.dEdge < 1.6) continue;
    if (u.row === 'vineyard') { const across = ((x - u.plot.dSeed[0]) * Math.cos(u.plot.angle) + (z - u.plot.dSeed[1]) * Math.sin(u.plot.angle)), fr = ((across / 2.5) % 1 + 1) % 1; if (Math.abs(fr - 0.5) > 0.12) continue; }
    const st = cropState(u.row, DOY + u.offsetDays); if (st.height > 0.03 || st.straw > 0.2) n++; }
  return n; };
// trees: every plain tree within MAXKM, indexed by 20 m
const trees: { t: Tree; where: string }[] = [...riparianTrees(RV.rivers, SEED).map(t => ({ t, where: 'riparian' })), ...canalTrees(canals, SEED).map(t => ({ t, where: 'canal' }))];
for (const p of orchardPlots(Z, villages)) if (Math.hypot(p.sx, p.sz) < MAXKM * 1000) for (const t of orchardPlotTrees(Z, p.sx, p.sz)) trees.push({ t, where: 'orchard' });
const tIdx = new Map<number, Obj[]>(); const TI = 20;
const addTree = (t: Tree, where: string) => { const r = treeInst(t.sp, t.x, 0, -t.y, t.h, t.w, t.seed); const o: Obj = { cls: 'tree:' + where, key: `tree:${r.row}`, e: t.x, n: t.y, s: r.sy, yaw: r.yaw, asp: r.sxz / r.sy, lean: [0, 0], r: t.w * 0.25 };
  const k = sk(Math.floor(t.x / TI), Math.floor(t.y / TI)); let l = tIdx.get(k); if (!l) tIdx.set(k, l = []); l.push(o); };
for (const q of trees) addTree(q.t, q.where);
const woodDone = new Set<number>();
const ensureWood = (e: number, n: number) => { const k = sk(Math.floor(e / 200), Math.floor(n / 200)); if (woodDone.has(k)) return; woodDone.add(k);
  const cx = (Math.floor(e / 200) + 0.5) * 200, cn = (Math.floor(n / 200) + 0.5) * 200; for (const t of woodlandTrees(Z, cx, -cn, 142)) if (Math.floor(t.x / 200) === Math.floor(e / 200) && Math.floor(t.y / 200) === Math.floor(n / 200)) addTree(t, 'woodland'); };
const treesNear = (e: number, n: number, R: number) => { const out: Obj[] = []; for (let x = Math.floor((e - R) / TI); x <= Math.floor((e + R) / TI); x++) for (let y = Math.floor((n - R) / TI); y <= Math.floor((n + R) / TI); y++) for (const o of tIdx.get(sk(x, y)) ?? []) if (Math.hypot(o.e - e, o.n - n) < R) out.push(o); return out; };
const vergeOn = !NO_VERGE;
/** what stands in the 2 m cover cell (ix, iz) (world x = ix * C, world z = iz * C; grid n = -z) */
const cellObjects = (ix: number, iz: number) => {
  const x0 = ix * C, z0 = iz * C, e0 = x0, n1 = -z0, n0 = n1 - C; let n = coverCount(ix, iz), crop = 0;
  if (n === 0) { const sx = Math.floor((e0 + 1) / SCELL), sy = Math.floor((n0 + 1) / SCELL); for (const o of smallCell(sx, sy)) if (o.e >= e0 && o.e < e0 + C && o.n >= n0 && o.n < n1) n++; }
  if (n === 0) { crop = cropIn(x0, z0); n += crop; }
  if (n === 0) { ensureWood(e0 + 1, n0 + 1); n += treesNear(e0 + 1, n0 + 1, 12).filter(o => Math.hypot(o.e - e0 - 1, o.n - n0 - 1) < o.r + 1).length; }
  return n;
};

// ------------------------------------------------------------------ the walk
type AreaStat = { cells: number; bare: number; verge: number; vergeBare: number; maxRun: number; runOver15: number; pathM: number; field: Record<string, number>; reps: number; inst: number };
const stats = new Map<string, AreaStat>(), S = (id: string) => { let s = stats.get(id); if (!s) stats.set(id, s = { cells: 0, bare: 0, verge: 0, vergeBare: 0, maxRun: 0, runOver15: 0, pathM: 0, field: {}, reps: 0, inst: 0 }); return s; };
const seen = new Set<number>(), cellKey = (ix: number, iz: number) => (ix + 32768) * 65536 + (iz + 32768);
const instSeen = new Set<string>(), inst: Obj[] = [];
const fieldState = (x: number, z: number) => { const u = landUseAt(Z, x, z); if (u.use === 'natural') return null; if (u.row === 'orchard_floor') return 'orchard';
  const st = cropState(u.row, DOY + u.offsetDays); return st.height > 0.03 ? (st.straw > st.green ? 'ripening' : 'green') : st.straw > 0.2 ? 'stubble' : st.tilled > 0.3 ? 'ploughed' : 'bare'; };
const worst: { id: string; e: number; n: number; run: number }[] = [];
let samples = 0;
for (const p of paths) {
  // along the path in 2 m steps: the verges; every STEP_ALONG m a transect across the 30 m band
  const run: Record<string, number> = { L: 0, R: 0 };
  let along = 0;
  for (let i = 1; i < p.pts.length; i++) { const a = p.pts[i - 1], b = p.pts[i], L = Math.hypot(b[0] - a[0], b[1] - a[1]); if (L < 1e-6) continue;
    const tx = (b[0] - a[0]) / L, ty = (b[1] - a[1]) / L, nx = -ty, ny = tx;
    for (let s = 0; s < L; s += 2, along += 2) { const e = a[0] + tx * s, n = a[1] + ty * s, id = areaAt(e, n);
      if (!id) { run.L = run.R = 0; continue; }
      const A = S(id); A.pathM += 2;
      for (const side of [-1, 1] as const) { const key = side < 0 ? 'L' : 'R';
        let any = false, counted = false;
        for (const off of [p.hw + 1, p.hw + 3]) { const pe = e + nx * off * side, pn = n + ny * off * side, c = ctxCell(Math.floor(pe / SCELL), Math.floor(pn / SCELL));
          if (c === 'none' || c === 'water' || onTread(pe, pn)) continue; counted = true; if (cellObjects(Math.floor(pe / C), Math.floor(-pn / C)) > 0) any = true; }
        if (!counted) { run[key] = 0; continue; }
        A.verge++; if (!any) { A.vergeBare++; run[key] += 2; if (run[key] > A.maxRun) { A.maxRun = run[key]; } if (run[key] === 16) A.runOver15 += 16; else if (run[key] > 16) A.runOver15 += 2; if (run[key] >= 16) worst.push({ id: p.id, e, n, run: run[key] }); }
        else run[key] = 0; }
      if (Math.round(along) % STEP_ALONG !== 0) continue;
      for (let off = p.hw + 0.5; off <= BAND; off += 2) for (const side of [-1, 1]) {
        const pe = e + nx * off * side, pn = n + ny * off * side, ix = Math.floor(pe / C), iz = Math.floor(-pn / C), k = cellKey(ix, iz); if (seen.has(k)) continue; seen.add(k);
        const id2 = areaAt(pe, pn); if (!id2) continue; const c = ctxCell(Math.floor(pe / SCELL), Math.floor(pn / SCELL)); if (c === 'none' || c === 'water' || onTread(pe, pn)) continue;
        const B = S(id2); B.cells++; samples++; if (cellObjects(ix, iz) === 0) B.bare++;
        const fs = fieldState(pe, -pn); if (fs) B.field[fs] = (B.field[fs] ?? 0) + 1;
        // the instances standing near the path (for the repeat test)
        if (off < 12) { for (const o of [...smallCell(Math.floor(pe / SCELL), Math.floor(pn / SCELL)).filter(o => o.cls !== 'x'), ...treesNear(pe, pn, 6)]) { const ik = `${o.key}:${o.e.toFixed(2)}:${o.n.toFixed(2)}`; if (!instSeen.has(ik)) { instSeen.add(ik); inst.push(o); } } }
      }
    }
  }
}
// repeats: a twin within 20 m (same model and variant, scale and proportions within 6 %, yaw within 15 deg, lean within 4 deg)
const rIdx = new Map<number, Obj[]>(); for (const o of inst) { const k = sk(Math.floor(o.e / 20), Math.floor(o.n / 20)); let l = rIdx.get(k); if (!l) rIdx.set(k, l = []); l.push(o); }
const repByCls: Record<string, [number, number]> = {};
for (const o of inst) { let twin = false;
  for (let x = Math.floor(o.e / 20) - 1; x <= Math.floor(o.e / 20) + 1 && !twin; x++) for (let y = Math.floor(o.n / 20) - 1; y <= Math.floor(o.n / 20) + 1 && !twin; y++) for (const q of rIdx.get(sk(x, y)) ?? []) {
    if (q === o || q.key !== o.key || Math.hypot(q.e - o.e, q.n - o.n) > 20) continue;
    const dy = Math.abs(((q.yaw - o.yaw) % (2 * Math.PI) + 3 * Math.PI) % (2 * Math.PI) - Math.PI);
    if (Math.abs(q.s / o.s - 1) < 0.06 && Math.abs(q.asp / o.asp - 1) < 0.06 && dy < 0.26 && Math.hypot(q.lean[0] - o.lean[0], q.lean[1] - o.lean[1]) < 0.07) { twin = true; break; } }
  const c = o.cls; const r = repByCls[c] ??= [0, 0]; r[1]++; if (twin) r[0]++;
  const id = areaAt(o.e, o.n); if (id) { const A = S(id); A.inst++; if (twin) A.reps++; } }

// ------------------------------------------------------------------ report
const kindOf = (id: string) => id.split(':')[0];
const byKind: Record<string, AreaStat & { areas: number }> = {};
for (const [id, s] of stats) { const k = kindOf(id), K = byKind[k] ??= { cells: 0, bare: 0, verge: 0, vergeBare: 0, maxRun: 0, runOver15: 0, pathM: 0, field: {}, reps: 0, inst: 0, areas: 0 };
  K.areas++; K.cells += s.cells; K.bare += s.bare; K.verge += s.verge; K.vergeBare += s.vergeBare; K.maxRun = Math.max(K.maxRun, s.maxRun); K.runOver15 += s.runOver15; K.pathM += s.pathM; K.reps += s.reps; K.inst += s.inst; for (const [f, v] of Object.entries(s.field)) K.field[f] = (K.field[f] ?? 0) + v; }
const pct = (a: number, b: number) => b ? (100 * a / b).toFixed(1) + '%' : '-';
console.log(`plain census: doy ${DOY} (${new Date(Date.UTC(2001, 0, DOY + 1)).toISOString().slice(5, 10)}), seed ${SEED}, paths within ${MAXKM} km: ${paths.length} (${(paths.reduce((s, p) => s + p.pts.slice(1).reduce((a, q, i) => a + Math.hypot(q[0] - p.pts[i][0], q[1] - p.pts[i][1]), 0), 0) / 1000).toFixed(1)} km), ${samples} cells, verge fill ${vergeOn ? 'on' : 'off'}, ${((Date.now() - t0) / 1000).toFixed(0)} s`);
console.log('kind           areas  path km  cells   bare    verge-bare  max bare run  m in runs>15  repeats (inst)  fields');
for (const [k, K] of Object.entries(byKind)) console.log(`${k.padEnd(14)} ${String(K.areas).padStart(5)} ${(K.pathM / 1000).toFixed(1).padStart(8)} ${String(K.cells).padStart(6)} ${pct(K.bare, K.cells).padStart(7)} ${pct(K.vergeBare, K.verge).padStart(11)} ${String(K.maxRun).padStart(10)} m ${String(K.runOver15).padStart(12)} ${pct(K.reps, K.inst).padStart(9)} (${K.inst}) ${Object.entries(K.field).map(([f, v]) => `${f} ${pct(v, Object.values(K.field).reduce((a, b) => a + b, 0))}`).join(', ')}`);
console.log('repeats by class:', Object.entries(repByCls).map(([c, [r, n]]) => `${c} ${r}/${n} (${pct(r, n)})`).join(', '));
const top = [...stats.entries()].filter(([, s]) => s.cells > 50).sort((a, b) => b[1].bare / b[1].cells - a[1].bare / a[1].cells).slice(0, 8);
console.log('barest areas:', top.map(([id, s]) => `${id} ${pct(s.bare, s.cells)} (max run ${s.maxRun} m)`).join('; '));
const w = worst.sort((a, b) => b.run - a.run).slice(0, 6); console.log('longest bare verges:', w.map(q => `${q.id} @ ${q.e.toFixed(0)},${q.n.toFixed(0)}: ${q.run} m`).join('; '));
if (OUT) writeFileSync(OUT, JSON.stringify({ doy: DOY, seed: SEED, byKind, areas: Object.fromEntries(stats), repByCls, worst: w }, null, 1));
