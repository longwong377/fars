// The used ground round the Terrace and the town (D-190). Before this, everything inside the settlement.json zones and a
// 660 m square round the Terrace was drawn as the plain's natural herb layer: from the Grand Stair the whole foreground
// (the ground within ~400 m of the Terrace foot fills most of the frame below the horizon) read as an unbroken lawn with
// people standing on it. Here, on a 4 m grid over the near ring (±2,048 m), per sample:
//  - R, G: the vector (east, north) from the sample to the nearest worn path, ±12.7 m in 0.1 m steps (128 = 0). The paths
//    are desire lines: the population walks open ground in straight runs wherever the run is clear of the built sites
//    (settlement/walk.ts openRoute shortcuts every route to them, D-143), so the worn lines are the clear straight runs
//    between each site's lane mouth and its three nearest neighbours, the stair foot and the facilities (C: which pairs
//    wear a path). All the graph's runs (walk.ts openRuns, 1,400 of them) drew a spider's web. A vector, not a distance:
//    for a straight path it is linear in position, so the bilinear filter reconstructs it exactly and a 1.8 m path stays
//    continuous between 4 m samples.
//  - B: trampled ground 0..1: the Terrace's foot and its approach (the people's walkable grid), the quarters and their
//    edges, the roads. Bare packed earth, the herb layer grazed and trodden off (C).
//  - A: field allowed 1 / 0: the town's open ground between its quarters is cultivated (irrigated plots on the Kuh-e
//    Rahmat canal's water, settlement.json canal_kuh_e_rahmat, B existence / C extent), but never inside or within 30 m of
//    a built site, within 15 m of a road or water piece, within 70 m of the approach line (town place to stair foot),
//    within 150 m of the Terrace, on the court's camp ground or at a facility the population works at.
// All C (reconstruction), built from the town plan as built.
import { siteExits, type TownPlan } from '../settlement/plan';
import { TownWalk } from '../settlement/walk';
import { toLocal, type P2 } from '../settlement/site';
import placesJson from '../../data/people_places.json';
import townJson from '../../data/town.json';
import courtJson from '../../data/court.json';

export const GROUND = { half: 2048, cell: 4, n: 1025 } as const;
/** the Terrace footprint (settlement.json / footprints.json terrace, grid m) and the people's walkable grid round it (D-024) */
export const TERRACE_BOX = { e0: -61, e1: 256, n0: -239, n1: 235 } as const;
export const APPROACH_BOX = { e0: -620, e1: 262, n0: -245, n1: 185 } as const;
export const PATH_W = 1.8; // m: a trodden footpath (C)
const VEC_RANGE = 12.7; // m, per component
export interface GroundMap { data: Uint8Array; n: number; half: number; cell: number; runs: number }

const boxDist = (e: number, n: number, b: { e0: number; e1: number; n0: number; n1: number }) => Math.hypot(Math.max(b.e0 - e, 0, e - b.e1), Math.max(b.n0 - n, 0, n - b.n1));
const segDist = (e: number, n: number, a: P2, b: P2) => { const dx = b[0] - a[0], dy = b[1] - a[1], t = Math.min(1, Math.max(0, ((e - a[0]) * dx + (n - a[1]) * dy) / (dx * dx + dy * dy || 1))); return Math.hypot(a[0] + t * dx - e, a[1] + t * dy - n); };
const sstep = (a: number, b: number, x: number) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };

/** the extra nodes popgeo gives the lane graph (people/popgeo.ts: the stair foot, the town place and the facilities) */
export function laneExtras(): P2[] {
  const at = (id: string) => ((placesJson as any).places as any[]).find(p => p.id === id)?.at as P2 | undefined;
  const fac = Object.fromEntries(((townJson as any).facilities as any[]).map(f => [f.id, f.at as P2]));
  const out: P2[] = [];
  for (const p of [at('stair_foot'), at('town')]) if (p) out.push(p);
  for (const k of ['mill', 'stockyard', 'brickyard', 'offering_place', 'crown_fields', 'clay_pit', 'river', 'mountain', 'outside']) if (fac[k]) out.push(fac[k]);
  return out;
}

/** the worn desire lines (grid m) with their wear (0..1): each built site's lane mouth nearest the other end, joined by a
 *  clear straight run to its three nearest sites (within 2.5 km), to the stair foot (within 3 km: the Terrace workforce
 *  walks it daily) and each facility to its two nearest sites and the stair; runs a site blocks are left out */
export function desireLines(plan: TownPlan): { a: P2; b: P2; w: number }[] {
  const walk = new TownWalk(plan.sites), ex = laneExtras(), stair = ex[0];
  const sites = plan.sites.map(s => ({ c: s.frame.c as P2, exits: siteExits(s) })).filter(s => s.exits.length);
  const mouth = (i: number, to: P2) => sites[i].exits.reduce((b, p) => (Math.hypot(p[0] - to[0], p[1] - to[1]) < Math.hypot(b[0] - to[0], b[1] - to[1]) ? p : b));
  const d2 = (a: P2, b: P2) => Math.hypot(a[0] - b[0], a[1] - b[1]);
  const out: { a: P2; b: P2; w: number }[] = [], seen = new Set<string>();
  const add = (a: P2, b: P2, w: number) => { const k = [a, b].map(p => p.join(',')).sort().join('|'); if (seen.has(k) || d2(a, b) < 5 || !walk.clear(a, b)) return; seen.add(k); out.push({ a, b, w }); };
  const nearest = (p: P2, k: number, R: number, skip = -1) => sites.map((s, i) => [d2(s.c, p), i] as [number, number]).filter(([d, i]) => i !== skip && d < R).sort((x, y) => x[0] - y[0]).slice(0, k).map(x => x[1]);
  sites.forEach((s, i) => {
    for (const j of nearest(s.c, 3, 2500, i)) add(mouth(i, sites[j].c), mouth(j, s.c), 0.25);
    if (stair && d2(s.c, stair) < 3000) add(mouth(i, stair), stair, 0.4);
  });
  for (const f of ex.slice(1)) { for (const j of nearest(f, 2, 3000)) add(f, mouth(j, f), 0.25); if (stair && d2(f, stair) < 3000) add(f, stair, f === ex[1] ? 0.6 : 0.3); }
  return out;
}

export function buildTownGround(plan: TownPlan | null): GroundMap {
  const { n, half, cell } = GROUND, N = n * n;
  const vx = new Float32Array(N).fill(VEC_RANGE), vy = new Float32Array(N).fill(VEC_RANGE), best = new Float32Array(N).fill(1e9);
  const trample = new Float32Array(N), allowed = new Float32Array(N).fill(1);
  const idx = (e: number) => Math.round((e + half) / cell);
  const each = (e0: number, e1: number, n0: number, n1: number, f: (k: number, e: number, nn: number) => void) => {
    const c0 = Math.max(0, idx(e0)), c1 = Math.min(n - 1, idx(e1)), r0 = Math.max(0, idx(-n1)), r1 = Math.min(n - 1, idx(-n0)); // row r = world z = -north
    for (let r = r0; r <= r1; r++) for (let c = c0; c <= c1; c++) f(r * n + c, -half + c * cell, -(-half + r * cell));
  };
  // the Terrace's foot, and the approach from the W: the line from the town place to the stair foot (people_places.json;
  // the walkable grid's axis, D-024) is kept open ±70 m, trodden along its middle (C)
  const ex = laneExtras(), stair = ex[0], townPl = ex[1];
  each(APPROACH_BOX.e0 - 120, TERRACE_BOX.e1 + 160, APPROACH_BOX.n0 - 160, APPROACH_BOX.n1 + 160, (k, e, nn) => {
    const dT = boxDist(e, nn, TERRACE_BOX), dA = stair && townPl ? segDist(e, nn, stair, townPl) : 1e9;
    trample[k] = Math.max(trample[k], 0.8 * (1 - sstep(20, 110, dT)) * (1 - sstep(200, 300, e)), 0.4 * (1 - sstep(8, 70, dA))); // not up the mountain behind the E edge
    if (dT < 150 || dA < 70) allowed[k] = 0;
  });
  // the court's camp below the Terrace (court.json camp: open ground, tents not built) and the facilities the population
  // works at in the near ring (town.json: stores, mill, brewery, brickyard, clay pit; positions C): trodden, not tilled
  const camp = (courtJson as any).camp as { c: P2; r: number };
  each(camp.c[0] - camp.r - 60, camp.c[0] + camp.r + 60, camp.c[1] - camp.r - 60, camp.c[1] + camp.r + 60, (k, e, nn) => {
    const d = Math.hypot(e - camp.c[0], nn - camp.c[1]); trample[k] = Math.max(trample[k], 0.45 * (1 - sstep(camp.r * 0.6, camp.r + 50, d))); if (d < camp.r + 30) allowed[k] = 0; });
  for (const f of (townJson as any).facilities as { id: string; at: P2 }[]) { if (/^(crown_fields|garden_pw|mountain|offering_place|river|outside|station)$/.test(f.id)) continue;
    each(f.at[0] - 70, f.at[0] + 70, f.at[1] - 70, f.at[1] + 70, (k, e, nn) => { const d = Math.hypot(e - f.at[0], nn - f.at[1]);
      trample[k] = Math.max(trample[k], 0.5 * (1 - sstep(25, 65, d))); if (d < 50) allowed[k] = 0; }); }
  let runs = 0;
  if (plan) {
    for (const s of plan.sites) { const hw = s.W / 2, hh = s.H / 2, R = Math.hypot(hw, hh) + 60, [ce, cn] = s.frame.c;
      const q = s.meta.kind === 'quarter' ? 0.7 : 0.45;
      each(ce - R, ce + R, cn - R, cn + R, (k, e, nn) => { const [u, v] = toLocal(s.frame, e, nn), d = Math.hypot(Math.max(Math.abs(u) - hw, 0), Math.max(Math.abs(v) - hh, 0));
        trample[k] = Math.max(trample[k], q * (1 - sstep(0, 55, d))); if (d < 30) allowed[k] = 0; }); }
    const seg = (a: P2, b: P2, r: number, f: (k: number, d: number, px: number, py: number) => void) => {
      each(Math.min(a[0], b[0]) - r, Math.max(a[0], b[0]) + r, Math.min(a[1], b[1]) - r, Math.max(a[1], b[1]) + r, (k, e, nn) => {
        const dx = b[0] - a[0], dy = b[1] - a[1], L2 = dx * dx + dy * dy || 1, t = Math.min(1, Math.max(0, ((e - a[0]) * dx + (nn - a[1]) * dy) / L2));
        const px = a[0] + t * dx - e, py = a[1] + t * dy - nn; f(k, Math.hypot(px, py), px, py); });
    };
    for (const rd of plan.roads) for (let i = 1; i < rd.pts.length; i++) seg(rd.pts[i - 1], rd.pts[i], 40, (k, d) => { trample[k] = Math.max(trample[k], 0.5 * (1 - sstep(rd.width / 2, rd.width / 2 + 25, d))); if (d < rd.width / 2 + 15) allowed[k] = 0; });
    for (const w of plan.water) for (let i = 1; i < w.pts.length; i++) seg(w.pts[i - 1], w.pts[i], 20, (k, d) => { if (d < w.width / 2 + 12) allowed[k] = 0; });
    for (const r of desireLines(plan)) { runs++;
      seg(r.a, r.b, VEC_RANGE, (k, d, px, py) => { if (d < best[k]) { best[k] = d; vx[k] = px; vy[k] = py; } });
      seg(r.a, r.b, 7, (k, d) => { trample[k] = Math.max(trample[k], r.w * (1 - sstep(1, 6, d))); }); } // (was ±14 m: broad bands)
  }
  const data = new Uint8Array(N * 4), enc = (v: number) => Math.round(128 + Math.max(-VEC_RANGE, Math.min(VEC_RANGE, v)) * 10);
  for (let k = 0; k < N; k++) { data[k * 4] = enc(vx[k]); data[k * 4 + 1] = enc(vy[k]); data[k * 4 + 2] = Math.round(Math.min(1, trample[k]) * 255); data[k * 4 + 3] = allowed[k] ? 255 : 0; }
  return { data, n, half, cell, runs };
}

/** bilinear sample of the map at grid (e, n): [path distance m, trampled 0..1, field allowed 0..1]; outside: no path, not
 *  trampled, allowed (the shader's defaults) */
export function groundAt(g: GroundMap, e: number, nn: number): [number, number, number] {
  const fx = (e + g.half) / g.cell, fy = (-nn + g.half) / g.cell;
  if (fx < 0 || fy < 0 || fx > g.n - 1 || fy > g.n - 1) return [99, 0, 1];
  const c0 = Math.min(g.n - 2, Math.floor(fx)), r0 = Math.min(g.n - 2, Math.floor(fy)), tx = fx - c0, ty = fy - r0;
  const s = (ch: number) => { const a = (r: number, c: number) => g.data[(r * g.n + c) * 4 + ch] / 255;
    return (a(r0, c0) * (1 - tx) + a(r0, c0 + 1) * tx) * (1 - ty) + (a(r0 + 1, c0) * (1 - tx) + a(r0 + 1, c0 + 1) * tx) * ty; };
  return [pathDistance(g, e, nn), s(2), s(3)];
}
/** distance (m) to the nearest worn path as the shader reconstructs it (terrainPlain.ts): each of the 4 surrounding
 *  samples names its nearest path point and the path's normal; the least distance to those lines (99: none within reach) */
export function pathDistance(g: GroundMap, e: number, nn: number): number {
  const fx = (e + g.half) / g.cell, fy = (-nn + g.half) / g.cell, c0 = Math.floor(fx), r0 = Math.floor(fy); let best = 99;
  for (let i = 0; i <= 1; i++) for (let j = 0; j <= 1; j++) {
    const c = Math.min(g.n - 1, Math.max(0, c0 + i)), r = Math.min(g.n - 1, Math.max(0, r0 + j)), k = (r * g.n + c) * 4;
    const vx = (g.data[k] - 128) / 10, vy = (g.data[k + 1] - 128) / 10, vl = Math.hypot(vx, vy);
    if (Math.max(Math.abs(vx), Math.abs(vy)) >= 12.6) continue;
    const qe = -g.half + c * g.cell + vx, qn = -(-g.half + r * g.cell) + vy, de = e - qe, dn = nn - qn;
    const t = Math.min(1, Math.max(0, (vl - 0.2) / 0.3)), w = t * t * (3 - 2 * t);
    const dLine = vl > 1e-3 ? Math.abs(de * vx + dn * vy) / vl : 0;
    best = Math.min(best, Math.hypot(de, dn) * (1 - w) + dLine * w);
  }
  return best;
}
