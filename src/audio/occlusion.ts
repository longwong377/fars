// Audio occlusion (brief §11 "occlusion"; D-178; Q-304). Built geometry between a sound and the listener attenuates it
// and takes away its highs; a doorway lets it through. Pure (no Web Audio, no three), so node tests measure it.
//
// The field: the architecture's solid parts (walls, towers, curtain walls, parapets, door frames, platforms, stair
// masses; src/arch/terrace buildTerrace) rasterised once into a 0.5 m plan grid. Each cell keeps up to two solid height
// intervals (court datum, cm), so a doorway's lintel or a window's sill and head leave the opening free. Columns, roofs,
// people, furniture and trees are not occluders; the town's and the plain's buildings are not in the field (C).
// Door leaves are dynamic lines (the door system's current swing): a closed timber leaf costs LEAF_DB.
//
// One query (source S, listener L):
//  1. direct: march S→L in 0.25 m steps; a step whose height at that point lies inside a solid interval is blocked;
//  2. if blocked, the energy of three kinds of path is summed:
//     - through a doorway D (at most MAX_DOORS, those with the least detour, each needing S→D and D→L clear):
//       Maekawa's barrier attenuation for the detour δ = |SD| + |DL| − |SL| at 500 Hz (A = 10·log10(3 + 20N), N = 2δf/c,
//       at most EDGE_MAX_DB), plus the extra spreading of the longer path, plus any closed leaf crossed;
//     - over the blocking wall's top (not when either end is under a roof): the same, for the edge at the highest
//       excess above the ray;
//     - through the wall: TRANSMISSION_DB (1–5 m of mud brick: far beyond 50 dB by the mass law, C);
//  3. the low-pass cutoff is the dominant path's: where diffraction costs 6 dB more than at 500 Hz
//     (f = 2000 + 9c/(40δ) Hz), 1.2 kHz through a closed leaf, 300 Hz through a wall.
// Everything here is C (a standard engineering approximation, not a measurement of the site).
import type { Part, Doorway, Pt } from '../arch/parts';
import { polyBounds } from '../arch/parts';

export interface P3 { e: number; n: number; y: number }
export interface Leaf { a: Pt; b: Pt; y0: number; y1: number }
export interface RoofBox { cx: number; cy: number; sx: number; sy: number; fl: number; h: number }
export interface OcclusionResult { gainDb: number; cutoffHz: number; path: string; direct: boolean }

/** part kinds that stop sound (solid masses); columns (thin, scattering), roofs, benches and sculpture are left out */
export const OCCLUDER_KINDS = new Set(['wall', 'tower', 'curtain', 'parapet', 'door_frame', 'niche_frame', 'window_frame', 'facade', 'platform', 'floor', 'landing', 'step', 'storerooms', 'plinth', 'portico_floor', 'pavement']);
export const CELL = 0.5, STEP = 0.25, C_SOUND = 343, F_REF = 500;
export const EDGE_MAX_DB = 25, TRANSMISSION_DB = 55, LEAF_DB = 22, MAX_DOORS = 6, DOOR_DETOUR_MAX = 40;
export const OPEN_HZ = 20000;
const EMPTY_LO = 32767, EMPTY_HI = -32768;

/** Maekawa's single-edge barrier attenuation (dB) for detour δ (m) at frequency f (Hz), capped */
export function maekawa(delta: number, f = F_REF): number {
  if (!(delta > 0)) return 0; const N = (2 * delta * f) / C_SOUND; return Math.min(EDGE_MAX_DB, 10 * Math.log10(3 + 20 * N));
}
/** the frequency where the edge costs 6 dB more than at 500 Hz (low-pass cutoff for a diffracted path) */
export const diffractionCutoff = (delta: number) => Math.min(OPEN_HZ, Math.max(400, 2000 + (9 * C_SOUND) / (40 * Math.max(delta, 1e-3))));

/** `edge`: the blocked stretch of the path, from its first to its last blocked step, and the highest solid top in it */
interface Trace { blocked: boolean; thick: number; leafDb: number; edge: { e1: number; n1: number; e2: number; n2: number; top: number } | null }

export class OcclusionField {
  readonly e0: number; readonly n0: number; readonly w: number; readonly h: number;
  /** two solid intervals per cell (cm) */
  private lo0: Int16Array; private hi0: Int16Array; private lo1: Int16Array; private hi1: Int16Array;
  leaves: Leaf[] = [];
  /** queries run and their cost (for the overlay and the budget test) */
  stats = { queries: 0, steps: 0 };
  constructor(parts: Part[], readonly doorways: Doorway[] = [], readonly roofs: RoofBox[] = []) {
    const occ = parts.filter(p => OCCLUDER_KINDS.has(p.kind) && p.type !== 'column' && p.solid !== false);
    let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
    for (const p of occ) { const b = bounds(p); x0 = Math.min(x0, b[0]); y0 = Math.min(y0, b[1]); x1 = Math.max(x1, b[2]); y1 = Math.max(y1, b[3]); }
    if (!Number.isFinite(x0)) { x0 = y0 = 0; x1 = y1 = 1; }
    this.e0 = Math.floor(x0) - 1; this.n0 = Math.floor(y0) - 1;
    this.w = Math.ceil((x1 - this.e0 + 1) / CELL); this.h = Math.ceil((y1 - this.n0 + 1) / CELL);
    const n = this.w * this.h;
    this.lo0 = new Int16Array(n).fill(EMPTY_LO); this.hi0 = new Int16Array(n).fill(EMPTY_HI); this.lo1 = new Int16Array(n).fill(EMPTY_LO); this.hi1 = new Int16Array(n).fill(EMPTY_HI);
    for (const p of occ) this.raster(p);
  }
  /** cells of the field (for the budget report) */
  get cells() { return this.w * this.h; }
  private put(i: number, j: number, a: number, b: number) {
    if (i < 0 || j < 0 || i >= this.w || j >= this.h) return;
    const k = j * this.w + i, A = Math.max(-32000, Math.round(a * 100)), B = Math.min(32000, Math.round(b * 100));
    const L0 = this.lo0, H0 = this.hi0, L1 = this.lo1, H1 = this.hi1;
    if (L0[k] > H0[k]) { L0[k] = A; H0[k] = B; return; }
    if (A <= H0[k] + 5 && B >= L0[k] - 5) { if (A < L0[k]) L0[k] = A; if (B > H0[k]) H0[k] = B; }
    else if (L1[k] > H1[k]) { L1[k] = A; H1[k] = B; return; }
    else if (A <= H1[k] + 5 && B >= L1[k] - 5) { if (A < L1[k]) L1[k] = A; if (B > H1[k]) H1[k] = B; }
    else { // a third interval: merge into the nearer one (fills a gap: conservative)
      const d0 = Math.min(Math.abs(A - H0[k]), Math.abs(L0[k] - B)), d1 = Math.min(Math.abs(A - H1[k]), Math.abs(L1[k] - B));
      if (d0 <= d1) { L0[k] = Math.min(L0[k], A); H0[k] = Math.max(H0[k], B); } else { L1[k] = Math.min(L1[k], A); H1[k] = Math.max(H1[k], B); }
    }
    if (L1[k] <= H1[k] && L1[k] <= H0[k] + 5 && H1[k] >= L0[k] - 5) { L0[k] = Math.min(L0[k], L1[k]); H0[k] = Math.max(H0[k], H1[k]); L1[k] = EMPTY_LO; H1[k] = EMPTY_HI; }
  }
  private raster(p: Part) {
    const y0 = p.y0, y1 = (p as any).y1 as number; if (!(y1 > y0)) return;
    if (p.type === 'prism') { // scanline fill at the cell centres' rows
      const P = p.polygon, [, by0, , by1] = polyBounds(P);
      for (let j = Math.floor((by0 - this.n0) / CELL); j <= Math.floor((by1 - this.n0) / CELL); j++) {
        const y = this.n0 + (j + 0.5) * CELL, xs: number[] = [];
        for (let a = 0, b = P.length - 1; a < P.length; b = a++) { const [xa, ya] = P[a], [xb, yb] = P[b]; if ((ya > y) !== (yb > y)) xs.push(xa + ((y - ya) * (xb - xa)) / (yb - ya)); }
        xs.sort((u, v) => u - v);
        for (let q = 0; q + 1 < xs.length; q += 2) for (let i = Math.ceil((xs[q] - this.e0) / CELL - 0.5); this.e0 + (i + 0.5) * CELL <= xs[q + 1]; i++) this.put(i, j, y0, y1);
      }
      return;
    }
    if (p.type !== 'box') return;
    const [cx, cy] = p.c, [sx, sy] = p.size, r = p.rot ?? 0, co = Math.cos(r), si = Math.sin(r);
    const [bx0, by0, bx1, by1] = bounds(p);
    for (let j = Math.floor((by0 - this.n0) / CELL); j <= Math.floor((by1 - this.n0) / CELL); j++) for (let i = Math.floor((bx0 - this.e0) / CELL); i <= Math.floor((bx1 - this.e0) / CELL); i++) {
      const dx = this.e0 + (i + 0.5) * CELL - cx, dy = this.n0 + (j + 0.5) * CELL - cy, u = dx * co + dy * si, v = -dx * si + dy * co;
      if (Math.abs(u) <= sx / 2 && Math.abs(v) <= sy / 2) this.put(i, j, y0, y1);
    }
    // thin parts (under two cells across): their centre line too, so no gap opens between cell centres
    if (Math.min(sx, sy) < 2 * CELL) {
      const long = sx >= sy, len = long ? sx : sy, m = Math.max(1, Math.ceil(len / (CELL / 2)));
      for (let q = 0; q <= m; q++) { const t = -len / 2 + (len * q) / m, u = long ? t : 0, v = long ? 0 : t;
        const e = cx + u * co - v * si, nn = cy + u * si + v * co; this.put(Math.floor((e - this.e0) / CELL), Math.floor((nn - this.n0) / CELL), y0, y1); }
    }
  }
  /** is the point inside a solid interval? */
  solidAt(e: number, n: number, y: number): boolean {
    const i = Math.floor((e - this.e0) / CELL), j = Math.floor((n - this.n0) / CELL); if (i < 0 || j < 0 || i >= this.w || j >= this.h) return false;
    const k = j * this.w + i, c = y * 100; return (c >= this.lo0[k] && c <= this.hi0[k]) || (c >= this.lo1[k] && c <= this.hi1[k]);
  }
  private underRoof(p: P3) { for (const r of this.roofs) if (Math.abs(p.e - r.cx) < r.sx / 2 && Math.abs(p.n - r.cy) < r.sy / 2 && p.y > r.fl - 0.5 && p.y < r.fl + r.h) return true; return false; }
  /** march a straight path; blocked steps, solid length crossed, the leaves crossed and the highest edge above the ray */
  trace(a: P3, b: P3, wantEdge = false): Trace {
    const de = b.e - a.e, dn = b.n - a.n, dy = b.y - a.y, L = Math.hypot(de, dn), m = Math.max(1, Math.ceil(L / STEP));
    let thick = 0, edge: Trace['edge'] = null; const W = this.w, H = this.h, L0 = this.lo0, H0 = this.hi0, L1 = this.lo1, H1 = this.hi1;
    // the first and last half metre are the source's and listener's own places (a person against a wall is not behind it)
    const skip = Math.min(m / 2, Math.ceil(0.5 / STEP)), inv = 1 / CELL, step = L / m;
    // incremental march in cell units (the hot loop of every query)
    let fe = (a.e + (de * skip) / m - this.e0) * inv, fn = (a.n + (dn * skip) / m - this.n0) * inv, c = (a.y + (dy * skip) / m) * 100;
    const dfe = (de / m) * inv, dfn = (dn / m) * inv, dc = (dy / m) * 100;
    for (let q = skip; q <= m - skip; q++, fe += dfe, fn += dfn, c += dc) {
      if (fe < 0 || fn < 0 || fe >= W || fn >= H) continue;
      const k = (fn | 0) * W + (fe | 0);
      let top = NaN; if (c >= L0[k] && c <= H0[k]) top = H0[k]; else if (c >= L1[k] && c <= H1[k]) top = H1[k];
      if (top === top) { thick += step; if (wantEdge) { const e = this.e0 + fe * CELL, n = this.n0 + fn * CELL; if (!edge) edge = { e1: e, n1: n, e2: e, n2: n, top: top / 100 }; else { edge.e2 = e; edge.n2 = n; if (top / 100 > edge.top) edge.top = top / 100; } } }
    }
    this.stats.steps += m;
    let leafDb = 0;
    for (const f of this.leaves) { const t = segX(a.e, a.n, b.e, b.n, f.a[0], f.a[1], f.b[0], f.b[1]); if (t === null) continue; const y = a.y + dy * t; if (y >= f.y0 && y <= f.y1) leafDb += LEAF_DB; }
    return { blocked: thick > 0, thick, leafDb, edge };
  }
  /** one leg of a path: clear (0 dB), or over one edge (Maekawa), or impassable (null) */
  private leg(A: P3, B: P3): { a: number; delta: number; leafDb: number } | null {
    const t = this.trace(A, B, true); if (!t.blocked) return { a: 0, delta: 0, leafDb: t.leafDb };
    const o = this.overTop(A, B, t); return o ? { a: o.a, delta: o.delta, leafDb: 0 } : null;
  }
  /** diffraction over the highest edge of a blocked straight path, when the sky is open over both ends and both
   *  halves of the bent path are clear */
  private overTop(A: P3, B: P3, t: Trace): { a: number; delta: number; top: number } | null {
    if (!t.edge || this.underRoof(A) || this.underRoof(B)) return null;
    // a band stretched over the blocked stretch at its highest top: A → E1 → E2 → B (one edge when the stretch is short)
    const y = t.edge.top + 0.05, E1: P3 = { e: t.edge.e1, n: t.edge.n1, y }, E2: P3 = { e: t.edge.e2, n: t.edge.n2, y };
    const d = dist(A, B), a1 = dist(A, E1), a12 = dist(E1, E2), a2 = dist(E2, B), delta = a1 + a12 + a2 - d;
    if (this.trace(A, E1).blocked || this.trace(E2, B).blocked) return null;
    return { a: maekawa(delta) + 20 * Math.log10((a1 + a12 + a2) / d), delta, top: t.edge.top };
  }
  /** the top of the highest solid below height y at a point (the floor or ground a person there stands on), or NaN */
  floorBelow(e: number, n: number, y: number): number {
    const i = Math.floor((e - this.e0) / CELL), j = Math.floor((n - this.n0) / CELL); if (i < 0 || j < 0 || i >= this.w || j >= this.h) return NaN;
    const k = j * this.w + i, c = y * 100; let best = -Infinity;
    if (this.lo0[k] <= this.hi0[k] && this.hi0[k] <= c) best = Math.max(best, this.hi0[k]); if (this.lo1[k] <= this.hi1[k] && this.hi1[k] <= c) best = Math.max(best, this.hi1[k]);
    return best === -Infinity ? NaN : best / 100;
  }
  /** attenuation (dB, ≤ 0) and low-pass cutoff of a sound at S heard at L */
  query(S: P3, Lp: P3): OcclusionResult {
    this.stats.queries++;
    const d = dist(S, Lp); if (d < 0.75) return { gainDb: 0, cutoffHz: OPEN_HZ, path: 'direct', direct: true };
    const tr = this.trace(S, Lp, true);
    if (!tr.blocked) return { gainDb: tr.leafDb > 0 ? -tr.leafDb : 0, cutoffHz: tr.leafDb > 0 ? 1200 : OPEN_HZ, path: tr.leafDb > 0 ? 'direct (closed leaf)' : 'direct', direct: true };
    const paths: { a: number; fc: number; name: string }[] = [{ a: TRANSMISSION_DB, fc: 300, name: 'through the wall' }];
    // over the top of the blocking wall or terrace edge (open sky only)
    const over = this.overTop(S, Lp, tr);
    if (over) paths.push({ a: over.a, fc: diffractionCutoff(over.delta), name: `over the top (${over.top.toFixed(1)} m)` });
    // through the doorways with the least detour; each leg may itself pass over one edge (a door, then the podium's edge)
    const cand: { dw: Doorway; D: P3; delta: number; a1: number; a2: number }[] = [];
    for (const dw of this.doorways) {
      const D: P3 = { e: dw.c[0], n: dw.c[1], y: Math.min(dw.y0 + dw.height - 0.3, Math.max(dw.y0 + 0.3, (S.y + Lp.y) / 2)) };
      const a1 = dist(S, D), a2 = dist(D, Lp), delta = a1 + a2 - d; if (delta > DOOR_DETOUR_MAX) continue;
      cand.push({ dw, D, delta, a1, a2 });
    }
    cand.sort((x, y) => x.delta - y.delta);
    let best = Math.min(...paths.map(p => p.a));
    for (const c of cand.slice(0, MAX_DOORS)) {
      // a path 15 dB below the best found adds under 0.2 dB: not worth its traces (the candidates come in detour order)
      if (maekawa(c.delta) + 20 * Math.log10((c.a1 + c.a2) / d) > best + 15) break;
      const l1 = this.leg(S, c.D); if (!l1) continue; const l2 = this.leg(c.D, Lp); if (!l2) continue;
      const leaf = l1.leafDb + l2.leafDb, edgeDelta = l1.delta + l2.delta;
      paths.push({ a: maekawa(c.delta) + l1.a + l2.a + 20 * Math.log10((c.a1 + c.a2) / d) + leaf, fc: leaf > 0 ? 1200 : diffractionCutoff(c.delta + edgeDelta), name: `doorway ${c.dw.id}${edgeDelta > 0 ? ' and an edge' : ''}` });
      best = Math.min(best, paths[paths.length - 1].a);
    }
    let E = 0, top = paths[0]; for (const p of paths) { E += 10 ** (-p.a / 10); if (p.a < top.a) top = p; }
    return { gainDb: 10 * Math.log10(E), cutoffHz: top.fc, path: top.name, direct: false };
  }
}

const dist = (a: P3, b: P3) => Math.hypot(a.e - b.e, a.n - b.n, a.y - b.y);
function bounds(p: Part): [number, number, number, number] {
  if (p.type === 'prism') { const b = polyBounds(p.polygon); return [b[0], b[1], b[2], b[3]]; }
  if (p.type === 'box') { const r = p.rot ?? 0, hx = (Math.abs(Math.cos(r)) * p.size[0] + Math.abs(Math.sin(r)) * p.size[1]) / 2, hy = (Math.abs(Math.sin(r)) * p.size[0] + Math.abs(Math.cos(r)) * p.size[1]) / 2; return [p.c[0] - hx, p.c[1] - hy, p.c[0] + hx, p.c[1] + hy]; }
  return [p.c[0], p.c[1], p.c[0], p.c[1]];
}
/** parameter t along AB where it crosses segment CD (2-D), or null */
function segX(ax: number, ay: number, bx: number, by: number, cx: number, cy: number, dx: number, dy: number): number | null {
  const rx = bx - ax, ry = by - ay, sx = dx - cx, sy = dy - cy, den = rx * sy - ry * sx; if (Math.abs(den) < 1e-12) return null;
  const t = ((cx - ax) * sy - (cy - ay) * sx) / den, u = ((cx - ax) * ry - (cy - ay) * rx) / den;
  return t >= 0 && t <= 1 && u >= 0 && u <= 1 ? t : null;
}
