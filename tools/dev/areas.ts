// The area registry (MASTER_PLAN §4.3, D-277): generates data/areas.json from the physically walkable envelope
// (tools/dev/lib/envelope.ts: the terrain rings' slope and reach, the architecture's colliders at 0.5 m; never the people's
// walkable grid) and the world's own data, and writes the evidence of T-A6 (union cover of the envelope) and T-A6x (the
// largest unique area: 1 km², 0.25 ha for interiors).
//
// Unique areas (judged each on its own), all read from the builders, none listed by hand:
//  - the Terrace (src/arch/terrace.ts buildTerrace): per building, its roofed ground (the footprint under its roof parts;
//    "interior", split into ≤ 50 m grid tiles when over 0.25 ha) and its open ground (porticoes, stairs, platforms); the
//    Terrace's open ground outside the buildings, split into courts by the nearest building ("terrace:court:<building>").
//    A building added to buildTerrace gets its areas on the next run (D-276's rooms included);
//  - the town (settlement/plan.ts buildTownPlan): every site, quarter or compound, as its raster's rectangle; the town and
//    garden zones of settlement.json outside the sites, in ≤ 900 m tiles;
//  - named sites: every feature of settlement.json and plain.json with a point and present in 467 that no other unique area
//    holds (Naqsh-e Rustam from plain.json's cliff; the rest a disc of half its size + 40 m, else 100 m); the court's camps
//    (people/camps.ts, the court setting is on by default, UD-10);
//  - every village (plain/villages.ts placeVillages as the world builds it): its disc (1.2 r) and its compounds;
//  - river reaches: the Pulvar and the Kur within the mid ring (±10,240 m), 2 km reaches, the channel plus 60 m of bank;
//  - the approach (480 m of plain W of the Terrace, the stair foot);
//  - the reference transect (MASTER_PLAN §6 step 3; the route is D-277, C): an overlay from the village nearest the Terrace
//    through a canal crossing and its fields to the town quarter nearest the spawn, the stair foot, the Grand Stair, the Gate,
//    the Apadana and its court, 30 m either side of the line plus those Terrace areas.
// Generator classes (judged as a class, D-240 "the land to the world's edge"): the near ground (the rest of the near terrain
// ring, ±2,048 m, in 25 tiles of 819.2 m: the open ground between the Terrace, the town and the plain, and the slopes of
// Kuh-e Rahmat above the Terrace), plain sectors (10.24 km tiles within the field patchwork's ±40,960 m) and far land
// (10.24 km tiles from there to the far ring's end, ±71,680 m).
// A point's primary area is the first containing area by priority (Terrace interiors first, classes last); overlays (the
// transect) are counted on top.
//
// Usage: tools/dev/cpu_slot.sh npx tsx tools/dev/areas.ts [--no-cache]   (~10 min, ~3 GB; writes data/areas.json,
//        REVIEWS/evidence/s10-instruments/T-A6.json and T-A6x.json, and the envelope cache shots/cache/envelope.bin for
//        tools/dev/tier0.ts)
import { writeFileSync, mkdirSync, readFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { buildWalkableWorld } from './lib/walkable_world';
import { buildTerrace } from '../../src/arch/terrace';
import { SETTLEMENT, PLAIN } from '../../src/world/plain/data';
import { villageCompounds } from '../../src/world/plain/villages';
import { CAMPS } from '../../src/people/camps';
import { terrainLayer, patchBuckets, fillPatch, forEachEnvelope, saveEnvelope, SPAWN, type Envelope } from './lib/envelope';
import { depHashFor } from './coverage_dep';
import {
  AreaIndex, AREA_LIMIT_M2, INTERIOR_LIMIT_M2, type Area, type AreaClass, type AreaKind, type MultiPoly, type P2, type Registry,
  bboxOf, buffer, circle, diff, inter, orect, polyArea, polyOf, rect, roundPoly, splitGrid, simplify, union, inMulti,
} from './lib/areas_geo';

export const TOOL = 'tools/dev/areas.ts';
export const PRIORITY: Record<AreaKind, number> = { 'terrace-interior': 10, 'terrace-open': 20, 'terrace-court': 30, 'town-site': 40, 'named-site': 50, village: 55, camp: 60,
  'garden-zone': 65, 'town-zone': 66, 'river-reach': 70, approach: 80, 'near-ground': 90, transect: 5, 'plain-sector': 100, 'far-land': 110 };
export const CLASS_TILE = 10240, FIELDS_HALF = 40960, WORLD_HALF = 71680, NEAR_HALF = 2048, NEAR_TILE = 4096 / 5, ZONE_TILE = 900, INTERIOR_TILE = 50;
export const RIVER_REACH_M = 2000, RIVER_BANK_M = 60, RIVER_HALF = 10240, TRANSECT_HALF = 30;

type Src = { parts: any[]; plan: any; villages: any[]; rivers: any[]; canals: any[] };

/** a Terrace part's ground footprint (grid e, n) */
function partShape(p: any): MultiPoly | null {
  if (p.type === 'prism' && p.polygon?.length >= 3) return polyOf(p.polygon);
  if (p.type === 'box' && p.c && p.size) return orect(p.c, p.size[0] / 2, p.size[1] / 2, p.rot ?? 0);
  return null;
}
function segDist(x: number, y: number, a: P2, b: P2) { const dx = b[0] - a[0], dy = b[1] - a[1], L = dx * dx + dy * dy, t = L ? Math.max(0, Math.min(1, ((x - a[0]) * dx + (y - a[1]) * dy) / L)) : 0; return Math.hypot(x - a[0] - t * dx, y - a[1] - t * dy); }
function polyDist(x: number, y: number, m: MultiPoly) { if (inMulti(x, y, m)) return 0; let d = Infinity; for (const p of m) for (const r of p) for (let i = 0; i + 1 < r.length; i++) d = Math.min(d, segDist(x, y, r[i], r[i + 1])); return d; }
const centroid = (m: MultiPoly): P2 => { const b = bboxOf(m); return [(b[0] + b[2]) / 2, (b[1] + b[3]) / 2]; };

/** the registry's areas from the world's data (no envelope needed: the shapes) */
export function buildAreas(S: Src): { areas: Area[]; classes: AreaClass[]; notes: string[] } {
  const areas: Area[] = [], notes: string[] = [];
  const add = (id: string, kind: AreaKind, name: string, shape: MultiPoly, src: string, extra: Partial<Area> = {}) => {
    const sh = roundPoly(shape); if (!sh.length || polyArea(sh) < 1) { notes.push(`${id}: empty shape, not added`); return null; }
    const a: Area = { id, kind, name, role: extra.role ?? 'unique', interior: false, priority: PRIORITY[kind], src, shape: sh, bbox: bboxOf(sh), polyM2: Math.round(polyArea(sh)), ...extra };
    areas.push(a); return a; };
  const holders: Area[] = []; // unique areas a named feature may fall in
  // --- the Terrace -----------------------------------------------------------------------------------------------------
  const tp = S.parts.find(p => p.building === 'terrace' && p.kind === 'platform'); const terracePoly = polyOf(tp.polygon);
  const buildings = [...new Set(S.parts.map(p => p.building as string))].filter(b => b !== 'terrace').sort();
  const fps = new Map<string, MultiPoly>();
  for (const b of buildings) {
    const ps = S.parts.filter(p => p.building === b), shapes = ps.map(partShape).filter((x): x is MultiPoly => !!x); if (!shapes.length) { notes.push(`terrace building ${b}: no footprint parts`); continue; }
    const fp = union(...shapes); fps.set(b, fp);
    const roofs = ps.filter(p => p.kind === 'roof').map(partShape).filter((x): x is MultiPoly => !!x);
    const interior = roofs.length ? inter(fp, union(...roofs)) : [], open = interior.length ? diff(fp, interior) : fp;
    const src = `src/arch/terrace.ts buildTerrace (building ${b})`;
    if (interior.length) { const a = polyArea(interior);
      if (a <= INTERIOR_LIMIT_M2) holders.push(add(`terrace:${b}:interior`, 'terrace-interior', `${b}: under its roof`, interior, src, { interior: true })!);
      else splitGrid(interior, INTERIOR_TILE).forEach((piece, k) => { const x = add(`terrace:${b}:interior:${k + 1}`, 'terrace-interior', `${b}: under its roof, part ${k + 1} (${INTERIOR_TILE} m grid)`, piece, src, { interior: true }); if (x) holders.push(x); }); }
    if (open.length) { const x = add(`terrace:${b}:open`, 'terrace-open', `${b}: open ground (porticoes, stairs, platform)`, open, src); if (x) holders.push(x); }
  }
  // courts: the Terrace's ground outside every building, split by the nearest building on a 2 m raster
  const courts = diff(terracePoly, ...fps.values()), cb = bboxOf(courts), G = 2, names = [...fps.keys()], runs = new Map<string, MultiPoly[]>();
  for (let y = Math.floor(cb[1] / G) * G; y < cb[3]; y += G) { let cur = '', x0 = 0;
    const flush = (x1: number) => { if (cur) { let l = runs.get(cur); if (!l) runs.set(cur, l = []); l.push(rect(x0, y, x1, y + G)); } };
    for (let x = Math.floor(cb[0] / G) * G; x < cb[2] + G; x += G) { let best = '', bd = Infinity; if (x < cb[2]) for (const nm of names) { const d = polyDist(x + G / 2, y + G / 2, fps.get(nm)!); if (d < bd) { bd = d; best = nm; } }
      if (best !== cur) { flush(x); cur = best; x0 = x; } }
    flush(Math.floor(cb[2] / G) * G + G); }
  for (const nm of [...runs.keys()].sort()) { const piece = inter(courts, union(...runs.get(nm)!)); const x = add(`terrace:court:${nm}`, 'terrace-court', `the Terrace's open ground nearest ${nm}`, piece, 'src/arch/terrace.ts (terrace platform minus the buildings, nearest building)'); if (x) holders.push(x); }
  // --- the town --------------------------------------------------------------------------------------------------------
  const siteShapes: MultiPoly[] = [];
  for (const s of S.plan.sites) { const sh = orect(s.frame.c, s.W / 2, s.H / 2, s.frame.theta); siteShapes.push(sh);
    const x = add(`town:${s.meta.id}`, 'town-site', `${s.meta.kind} ${s.meta.id}: ${String(s.meta.note ?? '').slice(0, 90)}`, sh, `src/world/settlement/plan.ts buildTownPlan (site ${s.meta.id}, ${s.meta.feature})`); if (x) holders.push(x); }
  for (const f of SETTLEMENT.features) { if (!/^zone_/.test(f.kind) || !f.polygon || f.present_467 === false) continue;
    const kind: AreaKind = f.kind === 'zone_palace_garden' ? 'garden-zone' : 'town-zone', rest = diff(polyOf(f.polygon), ...siteShapes);
    const pieces = polyArea(rest) > AREA_LIMIT_M2 * 0.95 ? splitGrid(rest, ZONE_TILE) : [rest];
    pieces.forEach((p, k) => add(pieces.length > 1 ? `zone:${f.id}:${k + 1}` : `zone:${f.id}`, kind, `${f.name ?? f.id} outside its sites${pieces.length > 1 ? `, tile ${k + 1} (${ZONE_TILE} m grid)` : ''}`, p, `data settlement.json ${f.id}`)); }
  // --- villages ----------------------------------------------------------------------------------------------------------
  for (const v of S.villages) { const comps = villageCompounds(v, null as any);
    const sh = union(circle([v.x, v.y], v.r * 1.2, 48), ...comps.map(c => orect([c.x, c.y], c.w / 2 + 3, c.d / 2 + 3, c.angle)));
    const x = add(`village:${v.id}`, 'village', v.name, sh, `src/world/plain/villages.ts placeVillages (${v.id}, ${v.tier})`); if (x) holders.push(x); }
  // --- named sites -------------------------------------------------------------------------------------------------------
  const nr = PLAIN.naqsh_e_rustam.cliff;
  const nra = add('site:naqsh_e_rustam', 'named-site', 'Naqsh-e Rustam: the cliff, the tombs of Darius I and Xerxes, the tower and the plain before them', rect(nr.x_range[0] - 60, nr.face_y - 350, nr.x_range[1] + 60, nr.face_y + 40), 'data plain.json naqsh_e_rustam.cliff');
  if (nra) holders.push(nra);
  const feats = [...SETTLEMENT.features.map((f: any) => ({ f, file: 'settlement.json' })), ...PLAIN.features.map((f: any) => ({ f, file: 'plain.json' }))]
    .filter(({ f }) => Array.isArray(f.xy) && f.present_467 !== false && !['village', 'mountain'].includes(f.kind)).sort((a, b) => a.f.id < b.f.id ? -1 : 1);
  for (const { f, file } of feats) { const [e, n] = f.xy as P2;
    const holder = holders.find(h => inMulti(e, n, h.shape)); if (holder) { (holder.contains ??= []).push(f.id); continue; }
    const size = Array.isArray(f.size_m) ? Math.max(...f.size_m) : typeof f.size_m === 'number' ? f.size_m : null, r = size ? size / 2 + 40 : 100;
    const x = add(`site:${f.id}`, 'named-site', `${f.name ?? f.id} (${f.kind})`, circle([e, n], r, 32), `data ${file} ${f.id}`); if (x) holders.push(x); }
  for (const c of CAMPS) add(`camp:${c.id}`, 'camp', `the court's camp ${c.id} (court setting, UD-10)`, circle(c.c as P2, c.r, 32), 'src/people/camps.ts CAMPS');
  // --- river reaches -----------------------------------------------------------------------------------------------------
  for (const rv of S.rivers) { const pts: P2[] = []; for (let i = 0; i < rv.x.length; i++) if (Math.abs(rv.x[i]) <= RIVER_HALF && Math.abs(rv.y[i]) <= RIVER_HALF) pts.push([rv.x[i], rv.y[i]]); else if (pts.length) pts.push([NaN, NaN]);
    // runs of consecutive points inside, cut into reaches by length
    const runsR: P2[][] = []; let cur: P2[] = []; for (const p of pts) { if (Number.isNaN(p[0])) { if (cur.length > 1) runsR.push(cur); cur = []; } else cur.push(p); } if (cur.length > 1) runsR.push(cur);
    let k = 0; const half = rv.topWidth / 2 + RIVER_BANK_M;
    for (const run of runsR) { let acc = 0, piece: P2[] = [run[0]];
      for (let i = 1; i < run.length; i++) { acc += Math.hypot(run[i][0] - run[i - 1][0], run[i][1] - run[i - 1][1]); piece.push(run[i]);
        if (acc >= RIVER_REACH_M || i === run.length - 1) { if (piece.length > 1) { k++; add(`river:${rv.id}:${k}`, 'river-reach', `${rv.id.replace('river_', '')} reach ${k} (${Math.round(acc)} m, channel + ${RIVER_BANK_M} m banks)`, buffer(simplify(piece, 4), half), `data rivers.json ${rv.id} (plain/data.ts parseRivers)`); }
          piece = [run[i]]; acc = 0; } } } }
  // --- the approach and the near ground ------------------------------------------------------------------------------------
  const tb = bboxOf(terracePoly); add('approach', 'approach', 'the approach: 480 m of plain W of the Terrace, the stair foot', rect(tb[0] - 480, tb[1] - 60, tb[0], tb[3] + 60), 'the Terrace outline (terrace.ts) and the spawn');
  const nearM: string[] = [];
  for (let i = 0; i < 5; i++) for (let j = 0; j < 5; j++) { const x0 = -NEAR_HALF + i * NEAR_TILE, y0 = -NEAR_HALF + j * NEAR_TILE;
    nearM.push(`ground:near:${i}:${j}`);
    add(`ground:near:${i}:${j}`, 'near-ground', `near ground tile ${i},${j} (e ${Math.round(x0)}…${Math.round(x0 + NEAR_TILE)}, n ${Math.round(y0)}…${Math.round(y0 + NEAR_TILE)})`, rect(x0, y0, x0 + NEAR_TILE, y0 + NEAR_TILE), 'the near terrain ring (heightfield.ts), 5 × 5 tiles', { role: 'member', cls: 'near' }); }
  // --- generator classes -----------------------------------------------------------------------------------------------------
  const plainM: string[] = [], farM: string[] = [], nT = WORLD_HALF / CLASS_TILE;
  for (let i = -nT; i < nT; i++) for (let j = -nT; j < nT; j++) { const x0 = i * CLASS_TILE, y0 = j * CLASS_TILE, inside = Math.max(Math.abs(x0 + CLASS_TILE / 2), Math.abs(y0 + CLASS_TILE / 2)) < FIELDS_HALF;
    const id = `${inside ? 'plain' : 'far'}:${i}:${j}`; (inside ? plainM : farM).push(id);
    add(id, inside ? 'plain-sector' : 'far-land', `${inside ? 'plain sector' : 'far land'} tile e ${x0}…${x0 + CLASS_TILE}, n ${y0}…${y0 + CLASS_TILE}`, rect(x0, y0, x0 + CLASS_TILE, y0 + CLASS_TILE), 'the terrain rings (10.24 km tiles)', { role: 'member', cls: inside ? 'plain' : 'far' }); }
  const classes: AreaClass[] = [
    { id: 'near', kind: 'near-ground', rule: `the near terrain ring (±${NEAR_HALF} m) in 25 tiles of ${NEAR_TILE} m: the open ground between the Terrace, the town and the plain, and Kuh-e Rahmat's lower slopes, primary where no unique area is`, members: nearM },
    { id: 'plain', kind: 'plain-sector', rule: `10.24 km tiles within the field patchwork (±${FIELDS_HALF} m), primary where no unique area is`, members: plainM },
    { id: 'far', kind: 'far-land', rule: `10.24 km tiles from ±${FIELDS_HALF} m to the far ring's end (±${WORLD_HALF} m), primary where no unique area is`, members: farM }];
  // --- the transect (overlay) --------------------------------------------------------------------------------------------------
  const village = [...S.villages].sort((a, b) => Math.hypot(a.x, a.y) - Math.hypot(b.x, b.y))[0];
  const quarter = S.plan.sites.filter((s: any) => s.meta.kind === 'quarter' && s.meta.popZone === 'town').sort((a: any, b: any) => Math.hypot(a.frame.c[0] - SPAWN[0], a.frame.c[1] - SPAWN[1]) - Math.hypot(b.frame.c[0] - SPAWN[0], b.frame.c[1] - SPAWN[1]))[0];
  const vq: [P2, P2] = [[village.x, village.y], quarter.frame.c];
  let crossing: P2 | null = null, bestT = Infinity;
  for (const c of S.canals) for (let i = 0; i + 1 < c.pts.length; i++) { const x = segX(vq[0], vq[1], c.pts[i], c.pts[i + 1]); if (x && x.t < bestT) { bestT = x.t; crossing = x.p; } }
  if (!crossing) { let bd = Infinity; for (const c of S.canals) for (const p of c.pts) { const d = Math.hypot(p[0] - village.x, p[1] - village.y); if (d < bd) { bd = d; crossing = [p[0], p[1]]; } } notes.push('transect: no canal on the straight line village → quarter; routed by the canal point nearest the village'); }
  const tc = (b: string) => { const ss = S.parts.filter(p => p.building === b).map(partShape).filter((x): x is MultiPoly => !!x); return centroid(union(...ss)); };
  const line: P2[] = [vq[0], ...(crossing ? [crossing] : []), quarter.frame.c, SPAWN, tc('grand_stair'), tc('gate_nations'), tc('apadana')];
  const inc = areas.filter(a => /^terrace:(grand_stair|gate_nations|apadana):/.test(a.id) || a.id === 'terrace:court:apadana');
  add('transect', 'transect', `the reference transect: ${village.id} → canal crossing → ${quarter.meta.id} → stair foot → Grand Stair → Gate → Apadana and its court (D-277, C)`,
    union(buffer(line, TRANSECT_HALF), ...inc.map(a => a.shape)), 'D-277 (MASTER_PLAN §6 step 3)', { overlay: true, contains: [village.id, quarter.meta.id, ...inc.map(a => a.id)] });
  return { areas, classes, notes };
}
function segX(a: P2, b: P2, c: P2, d: P2): { t: number; p: P2 } | null {
  const r = [b[0] - a[0], b[1] - a[1]], s = [d[0] - c[0], d[1] - c[1]], den = r[0] * s[1] - r[1] * s[0]; if (Math.abs(den) < 1e-9) return null;
  const t = ((c[0] - a[0]) * s[1] - (c[1] - a[1]) * s[0]) / den, u = ((c[0] - a[0]) * r[1] - (c[1] - a[1]) * r[0]) / den;
  return t >= 0 && t <= 1 && u >= 0 && u <= 1 ? { t, p: [a[0] + t * r[0], a[1] + t * r[1]] } : null;
}

/** walk the envelope once: primary area m², roofed m², overlay m², uncovered m² */
export function measure(E: Envelope, areas: Area[]) {
  const idx = new AreaIndex({ meta: {}, areas, classes: [] }), m2 = new Map<string, number>(), roofed = new Map<string, number>();
  let total = 0, covered = 0, unique = 0, patchM2 = 0, n = 0, reach7 = 0, reach7u = 0; const byLayer: Record<string, number> = {}; const uncoveredAt: P2[] = [];
  forEachEnvelope(E, (e, nn, a, rf, layer) => { n++; total += a; byLayer[layer] = (byLayer[layer] ?? 0) + a; if (layer === 'patch') patchM2 += a;
    const all = idx.all(e, nn), near = Math.hypot(e, nn) <= 7000; if (near) reach7 += a; if (!all.length) { if (uncoveredAt.length < 20) uncoveredAt.push([Math.round(e), Math.round(nn)]); return; } covered += a;
    let prim = false; for (const x of all) { if (x.overlay) { m2.set(x.id, (m2.get(x.id) ?? 0) + a); if (rf) roofed.set(x.id, (roofed.get(x.id) ?? 0) + a); continue; }
      if (prim) continue; prim = true; if (x.role === 'unique') { unique += a; if (near) reach7u += a; } m2.set(x.id, (m2.get(x.id) ?? 0) + a); if (rf) roofed.set(x.id, (roofed.get(x.id) ?? 0) + a); } });
  return { total, covered, unique, patchM2, n, byLayer, m2, roofed, uncoveredAt, reach7, reach7u };
}

async function main() {
  const t0 = Date.now(), log = (s: string) => console.log(`[areas ${((Date.now() - t0) / 1000).toFixed(0)} s] ${s}`);
  const commit = process.env.RUN_COMMIT ?? execFileSync('git', ['rev-parse', '--short', 'HEAD'], { encoding: 'utf8' }).trim();
  const w = await buildWalkableWorld(log), P = w.P;
  const TL = terrainLayer(w.T); log(`terrain layer (edge exits ${TL.edgeExits})`);
  const groups = patchBuckets(P); log(`${groups.length} architecture patches, ${groups.reduce((a, g) => a + g.length, 0)} buckets of 32 m`);
  const E: Envelope = { T: w.T, terrain: TL, patches: [], mask: new Map() };
  groups.forEach((g, i) => { const p = fillPatch(P, w.T, TL, g, i); E.patches.push(p); for (const k of g) E.mask.set(k, i); if (p.buckets.length > 20) log(`patch ${i}: ${p.buckets.length} buckets, ${p.seeds} seeds, ${p.reached} cells reached, ${Math.round(p.ms / 1000)} s`); });
  log('patches filled');
  const src: Src = { parts: buildTerrace().parts as any[], plan: w.settlement!.plan, villages: w.plain!.data.villages, rivers: w.plain!.data.rivers.rivers, canals: w.plain!.data.canals };
  let { areas, classes, notes } = buildAreas(src); log(`${areas.length} areas`);
  let M = measure(E, areas);
  // an area the envelope finds roofed (≥ 50 % of its ground under a roof) is an interior whatever its parts say
  const roofedBig = areas.filter(a => !a.interior && a.role === 'unique' && !a.overlay && (M.roofed.get(a.id) ?? 0) >= 0.5 * (M.m2.get(a.id) ?? Infinity));
  if (roofedBig.length) { const next: Area[] = [];
    for (const a of areas) { if (!roofedBig.includes(a)) { next.push(a); continue; } notes.push(`${a.id}: ${Math.round(100 * (M.roofed.get(a.id)! / M.m2.get(a.id)!))} % of its ground under a roof by the envelope: an interior`);
      const pieces = a.polyM2 > INTERIOR_LIMIT_M2 ? splitGrid(a.shape, INTERIOR_TILE) : [a.shape];
      pieces.forEach((p, k) => { const sh = roundPoly(p); next.push({ ...a, id: pieces.length > 1 ? `${a.id}:${k + 1}` : a.id, name: `${a.name}${pieces.length > 1 ? `, part ${k + 1} (${INTERIOR_TILE} m grid)` : ''}`, interior: true, shape: sh, bbox: bboxOf(sh), polyM2: Math.round(polyArea(sh)) }); }); }
    areas = next; M = measure(E, areas); }
  for (const a of areas) { a.envM2 = Math.round(M.m2.get(a.id) ?? 0); a.roofedShare = a.envM2 ? +((M.roofed.get(a.id) ?? 0) / a.envM2).toFixed(3) : 0; if (a.contains) a.contains.sort(); }
  const uniq = areas.filter(a => a.role === 'unique'), prim = uniq.filter(a => !a.overlay);
  const empty = prim.filter(a => !a.envM2).map(a => a.id); if (empty.length) notes.push(`${empty.length} unique areas hold no walkable ground: ${empty.slice(0, 12).join(', ')}${empty.length > 12 ? ' …' : ''}`);
  const worst = [...uniq].filter(a => !a.interior).sort((a, b) => b.polyM2 - a.polyM2)[0], worstI = [...uniq].filter(a => a.interior).sort((a, b) => b.polyM2 - a.polyM2)[0];
  const coverPct = (100 * M.covered) / M.total, uniqueUnion = Math.round(polyArea(union(...prim.map(a => a.shape))));
  const reachM2 = { t: M.reach7, u: M.reach7u };
  const dep = depHashFor(TOOL);
  const reg: Registry = {
    meta: {
      about: 'The area registry (MASTER_PLAN §4.3, D-277): generated by tools/dev/areas.ts; do not edit. Unique areas are judged each on its own, class members as their class. Coordinates: grid e, n (m).',
      tool: TOOL, dep, spawn: SPAWN,
      envelope: { method: 'terrain rings: triangle slope ≤ 42° and 4-connected reach from the spawn at each ring\'s resolution; architecture: 0.5 m 2.5-D flood fill against every static collider (step 0.42 m, 1.7 m headroom, knee and head rays; doors open)', total_m2: Math.round(M.total), by_layer_m2: Object.fromEntries(Object.entries(M.byLayer).map(([k, v]) => [k, Math.round(v)])), elements: M.n,
        patches: E.patches.length, patch_reached_m2: Math.round(M.patchM2), edge_exits: TL.edgeExits },
      cover: { union_m2: Math.round(M.covered), pct: +coverPct.toFixed(4), unique_primary_m2: Math.round(M.unique), unique_pct: +((100 * M.unique) / M.total).toFixed(4), within_7km_unique_pct: +((100 * reachM2.u) / reachM2.t).toFixed(2), uncovered_examples: M.uncoveredAt },
      largest: { unique: { id: worst.id, m2: worst.polyM2 }, interior: worstI ? { id: worstI.id, m2: worstI.polyM2 } : null, limits_m2: { unique: AREA_LIMIT_M2, interior: INTERIOR_LIMIT_M2 } },
      counts: { areas: areas.length, unique: uniq.length, members: areas.length - uniq.length, classes: classes.length, by_kind: Object.fromEntries([...new Set(areas.map(a => a.kind))].sort().map(k => [k, areas.filter(a => a.kind === k).length])) },
      totals: { unique_union_m2: uniqueUnion },
      sources: { buildings: [...new Set(src.parts.map(p => p.building))].filter(b => b !== 'terrace').sort(), town_sites: src.plan.sites.map((s: any) => s.meta.id).sort(), villages: src.villages.map(v => v.id).sort() },
      notes,
    },
    areas: areas.sort((a, b) => a.priority - b.priority || (a.id < b.id ? -1 : 1)), classes };
  writeFileSync('data/areas.json', JSON.stringify(reg) + '\n'); log(`data/areas.json: ${areas.length} areas (${uniq.length} unique), cover ${coverPct.toFixed(3)} %`);
  const dir = 'REVIEWS/evidence/s10-instruments'; mkdirSync(dir, { recursive: true });
  const a6 = { id: 'T-A6', value: +coverPct.toFixed(4), n: M.n, commit, tool: TOOL, dep, unit: '%', status: coverPct >= 99.5 ? 'PASS' : 'FAIL', envelope_m2: Math.round(M.total), covered_m2: Math.round(M.covered),
    unique_primary_pct: reg.meta.cover.unique_pct, within_7km_unique_pct: reg.meta.cover.within_7km_unique_pct, edge_exits: TL.edgeExits, uncovered_examples: M.uncoveredAt,
    note: 'union cover of the physically walkable envelope (tools/dev/lib/envelope.ts). The classes tile the whole terrain, so the union is ~100 % by construction; unique_primary_pct is the share judged area by area.' };
  const lim = uniq.map(a => ({ id: a.id, interior: a.interior, km2: a.polyM2 / 1e6, over: a.polyM2 > (a.interior ? INTERIOR_LIMIT_M2 : AREA_LIMIT_M2) }));
  const a6x = { id: 'T-A6x', value: +(worst.polyM2 / 1e6).toFixed(4), n: uniq.length, commit, tool: TOOL, dep, unit: 'km2', status: lim.some(l => l.over) ? 'FAIL' : 'PASS', largest: worst.id,
    interior_largest: worstI ? { id: worstI.id, ha: +(worstI.polyM2 / 1e4).toFixed(4) } : null, over_limit: lim.filter(l => l.over).map(l => l.id), note: 'polygon area of each unique area (≥ its walkable ground); interiors: roof parts or ≥ 50 % roofed by the envelope\'s up-ray, limit 0.25 ha' };
  writeFileSync(`${dir}/T-A6.json`, JSON.stringify(a6, null, 1) + '\n'); writeFileSync(`${dir}/T-A6x.json`, JSON.stringify(a6x, null, 1) + '\n');
  if (!process.argv.includes('--no-cache')) { const f = saveEnvelope(E, 'shots/cache/envelope.bin', dep); log(`envelope cache → ${f}`); }
  log(`T-A6 ${a6.value} % (${a6.status}); T-A6x ${a6x.value} km² ${a6x.largest}, interior ${a6x.interior_largest?.ha} ha (${a6x.status})`);
}
if (process.argv[1]?.endsWith('areas.ts')) main().then(() => process.exit(0), e => { console.error(e); process.exit(1); });
