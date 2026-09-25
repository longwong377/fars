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
import { FOOT_LINES } from '../terraceFoot';

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

/** the worn paths (grid m) with their wear (0..1). D-223 (rubric s7 pass 2 fix 9, "straight radial beige streaks"): the
 *  D-190 set joined every site within 3 km straight to the stair foot, a star of a dozen ruled lines converging under the
 *  Grand Stair, which from the Terrace read as seams of a projected texture. Paths merge: people bound for the stair walk
 *  to the nearest well-trodden way and follow it (desire lines coalesce into a branching net, and wear concentrates on the
 *  trunks). So the net grows from the trunks, the approach line (town place to stair foot) and the roads, nearest site
 *  first: each site's lane mouth runs clear and straight to the nearest point of the net (if that is nearer than the stair
 *  itself), each join adding wear to the branch it joins and every branch between it and the stair (0.25 a spur, up to
 *  0.6 on a trunk); each site keeps one clear run to its nearest neighbouring site (the quarters' own traffic, 0.2); the
 *  facilities join the net the same way. All C (which runs wear, and how much) */
export function desireLines(plan: TownPlan): { a: P2; b: P2; w: number }[] {
  const walk = new TownWalk(plan.sites), ex = laneExtras(), stair = ex[0], townPl = ex[1];
  const sites = plan.sites.map(s => ({ c: s.frame.c as P2, exits: siteExits(s) })).filter(s => s.exits.length);
  const mouth = (i: number, to: P2) => sites[i].exits.reduce((b, p) => (Math.hypot(p[0] - to[0], p[1] - to[1]) < Math.hypot(b[0] - to[0], b[1] - to[1]) ? p : b));
  const d2 = (a: P2, b: P2) => Math.hypot(a[0] - b[0], a[1] - b[1]);
  const out: { a: P2; b: P2; w: number }[] = [], seen = new Set<string>();
  // the net: segments with their parent (toward the stair) for the wear; roads and the approach are trunks (not drawn:
  // the roads are drawn by the settlement, the approach is trodden ground, D-190)
  interface Seg { a: P2; b: P2; parent: number; out: number }
  const net: Seg[] = [];
  if (stair && townPl) net.push({ a: townPl, b: stair, parent: -1, out: -1 });
  for (const r of plan.roads) for (let i = 1; i < r.pts.length; i++) { const a = r.pts[i - 1], b = r.pts[i]; if (Math.min(d2(a, [0, 0]), d2(b, [0, 0])) < 4000) net.push({ a, b, parent: -1, out: -1 }); }
  const wear = (k: number, dw: number) => { for (let j = k; j >= 0; j = net[j].parent) if (net[j].out >= 0) out[net[j].out].w = Math.min(0.6, out[net[j].out].w + dw); };
  const add = (a: P2, b: P2, w: number, parent = -1): boolean => { const key = [a, b].map(p => p.join(',')).sort().join('|'); if (seen.has(key) || d2(a, b) < 5 || !walk.clear(a, b)) return false;
    seen.add(key); out.push({ a, b, w }); net.push({ a, b, parent, out: out.length - 1 }); return true; };
  /** the nearest point of the net to p that p can reach in a clear straight run (at most `max` m), with its segment */
  const join = (p: P2, max: number): { q: P2; k: number } | null => {
    const cand = net.map((sg, k) => { const dx = sg.b[0] - sg.a[0], dy = sg.b[1] - sg.a[1], L2 = dx * dx + dy * dy || 1, t = Math.min(1, Math.max(0, ((p[0] - sg.a[0]) * dx + (p[1] - sg.a[1]) * dy) / L2));
      const q: P2 = [sg.a[0] + t * dx, sg.a[1] + t * dy]; return { q, k, d: d2(p, q) }; }).filter(c => c.d < max && c.d > 5).sort((x, y) => x.d - y.d);
    for (const c of cand.slice(0, 6)) if (walk.clear(p, c.q)) return { q: c.q, k: c.k };
    return null;
  };
  const order = sites.map((s, i) => i).filter(i => stair && d2(sites[i].c, stair) < 3000).sort((i, j) => d2(sites[i].c, stair) - d2(sites[j].c, stair));
  for (const i of order) { const m = mouth(i, stair), direct = d2(m, stair), j = join(m, direct);
    if (j) { if (add(m, j.q, 0.25, j.k)) wear(j.k, 0.08); } else add(m, stair, 0.4); }
  sites.forEach((s, i) => { const nb = sites.map((t, j) => [d2(t.c, s.c), j] as [number, number]).filter(([d, j]) => j !== i && d < 2500).sort((x, y) => x[0] - y[0]);
    for (const [, j] of nb.slice(0, 1)) add(mouth(i, sites[j].c), mouth(j, s.c), 0.2); });
  for (const f of ex.slice(2)) { if (!stair || d2(f, stair) > 3000) continue; const j = join(f, d2(f, stair)); if (j) { if (add(f, j.q, 0.25, j.k)) wear(j.k, 0.05); } else add(f, stair, 0.3); }
  return out;
}

/** `camps`: the court setting's retinue camps (court.json camps, D-199): their ground trodden and not tilled, as the court's
 *  own camp's (C: a camp pitched on fallow ground) */
/** D-227: herbs where the foot's ground is damp or little trodden (C). Below each drain mouth in the Terrace's W and S walls
 *  (arch/waterworks.ts, D-214) the rain off the courts runs out onto the foot: a fan FAN.len m out from the wall, FAN.w0 m wide
 *  at the wall and FAN.w1 m at its end (at least a cell and a half of the 4 m ground map wide), where the herbs grow back (the trodden share cut to FAN.keep); and between the paths
 *  the foot keeps grazed herb in patches ~PATCH.lam m across (value noise; the trodden share × PATCH.keep over PATCH.share
 *  of the ground, not within PATCH.clear m of the approach line). From the stair a 20-60 m patch spans 5-20 px along the view
 *  at 100-200 m (D-223: the 10-35 m wear noise's contrast is ~12 % of albedo and does not read); herbs in their own colour do */
export const FAN = { len: 16, w0: 6, w1: 10, keep: 0.25 } as const;
export const PATCH = { lam: 45, share: 0.35, keep: 0.35, clear: 14, lush: 0.6 } as const;
/** the A channel carries the herbs' regrowth (0..1 → 0..LUSH_MAX) where no field is allowed, at least a cell inside such ground
 *  (allowed ground reads 1; the shader's field mask thresholds A at 0.4-0.6, so fields never creep into it) */
export const LUSH_MAX = 0.35;
const vnoise = (x: number, y: number, seed: number) => { const h = (i: number, j: number) => { const v = Math.sin(i * 127.1 + j * 311.7 + seed * 74.7) * 43758.5453; return v - Math.floor(v); };
  const i = Math.floor(x), j = Math.floor(y), fx = x - i, fy = y - j, sx = fx * fx * (3 - 2 * fx), sy = fy * fy * (3 - 2 * fy);
  return (h(i, j) * (1 - sx) + h(i + 1, j) * sx) * (1 - sy) + (h(i, j + 1) * (1 - sx) + h(i + 1, j + 1) * sx) * sy; };
/** the herb patch mask at grid (e, n): 1 in a patch, 0 out (two octaves, thresholded to PATCH.share of the ground; C) */
export function herbPatch(e: number, n: number): number { const v = 0.7 * vnoise(e / PATCH.lam, n / PATCH.lam, 3) + 0.3 * vnoise(e / (PATCH.lam * 0.4), n / (PATCH.lam * 0.4), 7);
  return sstep(0.55, 0.62, v); }
export function buildTownGround(plan: TownPlan | null, camps: { c: P2; r: number }[] = [], drains: { at: P2; n: P2 }[] = [], herbs = true): GroundMap {
  const { n, half, cell } = GROUND, N = n * n;
  const vx = new Float32Array(N).fill(VEC_RANGE), vy = new Float32Array(N).fill(VEC_RANGE), best = new Float32Array(N).fill(1e9);
  const trample = new Float32Array(N), allowed = new Float32Array(N).fill(1), lush = new Float32Array(N);
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
  for (const cp of camps) each(cp.c[0] - cp.r - 60, cp.c[0] + cp.r + 60, cp.c[1] - cp.r - 60, cp.c[1] + cp.r + 60, (k, e, nn) => { // D-199
    const d = Math.hypot(e - cp.c[0], nn - cp.c[1]); trample[k] = Math.max(trample[k], 0.45 * (1 - sstep(cp.r * 0.6, cp.r + 50, d))); if (d < cp.r + 30) allowed[k] = 0; });
  for (const f of (townJson as any).facilities as { id: string; at: P2 }[]) { if (/^(crown_fields|garden_pw|mountain|river|station)$/.test(f.id)) continue; // (D-209: the precinct and the burial ground are trodden, never tilled)
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
      seg(r.a, r.b, 5, (k, d) => { trample[k] = Math.max(trample[k], r.w * (1 - sstep(0.8, 3.5, d))); }); } // (was ±14 m, then ±6 m: broad bands; D-223)
  }
  // D-227: the foot's herbs: in patches between the paths (not on a worn path), and in a fan below each drain mouth; last, over
  // every trodden layer above
  // the tether lines at the stair foot (terraceFoot.ts): the animals' standing ground trodden bare and dunged (C)
  const nearLine = (e: number, nn: number) => Math.min(...FOOT_LINES.map(L => segDist(e, nn, L.a, L.b)));
  for (const L of FOOT_LINES) each(Math.min(L.a[0], L.b[0]) - 12, Math.max(L.a[0], L.b[0]) + 12, Math.min(L.a[1], L.b[1]) - 12, Math.max(L.a[1], L.b[1]) + 12, (k, e, nn) => {
    trample[k] = Math.max(trample[k], 0.85 * (1 - sstep(5, 10, segDist(e, nn, L.a, L.b)))); });
  if (herbs) {
  each(APPROACH_BOX.e0 - 120, TERRACE_BOX.e1 + 160, APPROACH_BOX.n0 - 160, APPROACH_BOX.n1 + 160, (k, e, nn) => {
    const dT = boxDist(e, nn, TERRACE_BOX), dA = stair && townPl ? segDist(e, nn, stair, townPl) : 1e9; if (dT > 150 && dA > 70) return;
    const p = herbPatch(e, nn) * sstep(PATCH.clear, PATCH.clear + 10, dA); if (best[k] < 3 || nearLine(e, nn) < 10) return; trample[k] *= 1 - (1 - PATCH.keep) * p; lush[k] = Math.max(lush[k], PATCH.lush * p); });
  for (const d of drains) { const L = FAN.len, e0 = d.at[0], n0 = d.at[1];
    each(e0 - L - FAN.w1, e0 + L + FAN.w1, n0 - L - FAN.w1, n0 + L + FAN.w1, (k, e, nn) => { const de = e - e0, dn = nn - n0, t = de * d.n[0] + dn * d.n[1], a = Math.abs(-de * d.n[1] + dn * d.n[0]);
      if (t < 0 || t > L) return; const hw = (FAN.w0 + (FAN.w1 - FAN.w0) * (t / L)) / 2, f = (1 - sstep(hw * 0.8, hw + 1, a)) * (1 - sstep(L * 0.7, L, t)); trample[k] *= 1 - (1 - FAN.keep) * f; lush[k] = Math.max(lush[k], f); }); }
  }
  const lushCode = (k: number) => { const r = Math.floor(k / n), c = k % n; if (!lush[k] || r < 1 || c < 1 || r >= n - 1 || c >= n - 1) return 0;
    if (allowed[k - 1] || allowed[k + 1] || allowed[k - n] || allowed[k + n]) return 0; return Math.round(Math.min(1, lush[k]) * LUSH_MAX * 255); };
  const data = new Uint8Array(N * 4), enc = (v: number) => Math.round(128 + Math.max(-VEC_RANGE, Math.min(VEC_RANGE, v)) * 10);
  for (let k = 0; k < N; k++) { data[k * 4] = enc(vx[k]); data[k * 4 + 1] = enc(vy[k]); data[k * 4 + 2] = Math.round(Math.min(1, trample[k]) * 255); data[k * 4 + 3] = allowed[k] ? 255 : lushCode(k); }
  return { data, n, half, cell, runs };
}

/** bilinear sample of the map at grid (e, n): [path distance m, trampled 0..1, field allowed 0..1]; outside: no path, not
 *  trampled, allowed (the shader's defaults) */
export function groundAt(g: GroundMap, e: number, nn: number): [number, number, number] {
  return groundAt4(g, e, nn).slice(0, 3) as [number, number, number];
}
/** as groundAt, and the herbs' regrowth 0..1 (D-227; the shader's `lush`) */
export function groundAt4(g: GroundMap, e: number, nn: number): [number, number, number, number] {
  const fx = (e + g.half) / g.cell, fy = (-nn + g.half) / g.cell;
  if (fx < 0 || fy < 0 || fx > g.n - 1 || fy > g.n - 1) return [99, 0, 1, 0];
  const c0 = Math.min(g.n - 2, Math.floor(fx)), r0 = Math.min(g.n - 2, Math.floor(fy)), tx = fx - c0, ty = fy - r0;
  const s = (ch: number, f = (v: number) => v) => { const a = (r: number, c: number) => f(g.data[(r * g.n + c) * 4 + ch] / 255);
    return (a(r0, c0) * (1 - tx) + a(r0, c0 + 1) * tx) * (1 - ty) + (a(r0 + 1, c0) * (1 - tx) + a(r0 + 1, c0 + 1) * tx) * ty; };
  return [pathDistance(g, e, nn), s(2), s(3, v => (v < LUSH_MAX + 0.03 ? 0 : v)), s(3, v => (v < LUSH_MAX + 0.03 ? v / LUSH_MAX : 0))];
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
