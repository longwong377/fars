// Plain data (Phase 7): src/data/plain.json (owned here) plus read-only use of src/data/settlement.json (Phase 6 owns it:
// its zone polygons are kept free of fields, and its roads are where the village tracks join). The frame is the
// Persepolis grid (x grid-east, y grid-north); the world frame is x = east, z = -north (D-002). Far features use the
// pyproj-derived grid `xy` from the data, never src/core/geo.ts (which drifts ~80 m at 40 km).
import plainJson from '../../data/plain.json';
import settlementJson from '../../data/settlement.json';
import { BASE } from '../../core/base';
import { curvatureDrop } from '../../terrain/heightfield';

export const PLAIN: any = plainJson;
export const SETTLEMENT: any = settlementJson;
export const feature = (id: string): any => { const f = PLAIN.features.find((q: any) => q.id === id); if (!f) throw new Error(`plain.json: no feature ${id}`); return f; };
export const presentFeatures = (): any[] => PLAIN.features.filter((f: any) => f.present_467 === true);

/** userData for the dev overlay (F3): tier, source keys, note, placeholder flag, and the chronology link */
export function tag(f: { tier: string; src: string; note?: string; chrono?: string }, note?: string, placeholder = false) {
  return { tier: f.tier, src: f.src, note: note ?? f.note ?? '', placeholder, chrono: f.chrono };
}

/** settlement.json zones (Phase 6) that the plain leaves to the settlement: no fields, trees or villages inside */
export function settlementZones(): [number, number][][] {
  return SETTLEMENT.features.filter((f: any) => f.present_467 && Array.isArray(f.polygon) && /^zone_/.test(f.kind)).map((f: any) => f.polygon as [number, number][]);
}
/** settlement.json roads (present), as grid polylines */
export function settlementRoads(): { id: string; pts: [number, number][]; width: number }[] {
  return SETTLEMENT.features.filter((f: any) => f.present_467 && f.kind === 'road' && Array.isArray(f.polyline)).map((f: any) => ({ id: f.id, pts: f.polyline, width: f.width_m ?? 6 }));
}

export function pointInPolygon(x: number, y: number, poly: readonly (readonly number[])[]): boolean {
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const [xi, yi] = poly[i], [xj, yj] = poly[j];
    if ((yi > y) !== (yj > y) && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}
export function distToSegment(px: number, py: number, ax: number, ay: number, bx: number, by: number) {
  const dx = bx - ax, dy = by - ay, l2 = dx * dx + dy * dy; let t = l2 > 0 ? ((px - ax) * dx + (py - ay) * dy) / l2 : 0; t = Math.max(0, Math.min(1, t));
  return Math.hypot(px - (ax + t * dx), py - (ay + t * dy));
}
export function distToPolyline(px: number, py: number, pts: readonly (readonly number[])[]) {
  let d = Infinity; for (let i = 1; i < pts.length; i++) d = Math.min(d, distToSegment(px, py, pts[i - 1][0], pts[i - 1][1], pts[i][0], pts[i][1])); return d;
}

// ---------------------------------------------------------------- rivers (public/generated/rivers.json, tools/build_terrain.py)
export interface RiverProfile {
  id: 'river_pulvar' | 'river_kur';
  /** centreline every 20 m, grid metres, upstream first */ x: Float64Array; y: Float64Array;
  /** bank-top level (m asl, true) and the bare-earth floodplain it was derived from */ bank: Float64Array; floodplain: Float64Array;
  channel: { bed_width_m: number; side_slope_h_per_v: number; bank_height_m: number };
  topWidth: number; carveRadius: { far: number; mid: number };
  /** D-670: the course before the meander train (tools/plain/meander.ts), every 20 m: the canals' off-takes and the villages
   *  are placed on it as before, so the meanders move no village and no canal (their heads are joined to the water as drawn) */
  base?: { x: Float64Array; y: Float64Array; bank: Float64Array };
  /** D-670: the samples the meanders changed (shared by both rivers; priorTerrain) */
  prior?: PriorSamples;
}
/** the river on its pre-meander course (D-670; the river itself where there is none) */
export const baseCourse = (r: RiverProfile): RiverProfile => r.base ? { ...r, x: r.base.x, y: r.base.y, bank: r.base.bank, floodplain: r.base.bank } : r;
export interface RiversData { rivers: RiverProfile[]; nrAncientFootAsl: number }
/** D-670: the heightfield samples tools/plain/meander.ts changed, as build_terrain.py left them (raw u16 per ring) */
export interface PriorSamples { mid: Map<number, number>; far: Map<number, number> }
const b64u16 = (s: string) => { const bin = atob(s), u = new Uint16Array(bin.length >> 1); for (let i = 0; i < u.length; i++) u[i] = bin.charCodeAt(2 * i) | (bin.charCodeAt(2 * i + 1) << 8); return u; };
function parsePrior(p: any): PriorSamples | undefined {
  if (!p) return undefined; const out: any = {};
  for (const k of ['mid', 'far']) { const d = b64u16(p[k].d), v = b64u16(p[k].v), m = new Map<number, number>(); let i = 0, j = 0;
    let at = 0; while (j < v.length) { let dl = d[i++]; if (dl === 0) { dl = d[i] * 65536 + d[i + 1]; i += 2; } at += dl; m.set(at, v[j++]); }
    out[k] = m; }
  return out as PriorSamples;
}
const PRIOR_VIEW = new WeakMap<object, { aslAt(x: number, z: number): number }>();
/** D-670: the ground as build_terrain.py left it, before the meanders were carved (the canals and the villages are placed
 *  on it, so the meanders move none of them: the people's homes and the frozen views keep their places); the terrain
 *  itself where nothing changed. Only aslAt (what canals.ts and villages.ts read). */
export function priorTerrain(terrain: { aslAt(x: number, z: number): number; meta: any; mid: any; far: any; near: any }, prior: PriorSamples | undefined): { aslAt(x: number, z: number): number } {
  if (!prior) return terrain; const hit = PRIOR_VIEW.get(terrain); if (hit) return hit;
  const ringH = (ring: any, m: Map<number, number>, x: number, z: number) => {
    const { n, cell, half } = ring, gx = (x + half) / cell, gy = (z + half) / cell;
    const c0 = Math.max(0, Math.min(n - 2, Math.floor(gx))), r0 = Math.max(0, Math.min(n - 2, Math.floor(gy)));
    const fx = Math.max(0, Math.min(1, gx - c0)), fy = Math.max(0, Math.min(1, gy - r0)), off = ring.meta.asl_min - terrain.meta.court_asl;
    const at = (r: number, c: number) => { const i = r * n + c, raw = m.get(i); if (raw === undefined) return ring.h[i];
      const cx = c * cell - half, cz = r * cell - half; return Math.fround(off + raw * ring.meta.step - curvatureDrop(cx, cz)); };
    return (at(r0, c0) * (1 - fx) + at(r0, c0 + 1) * fx) * (1 - fy) + (at(r0 + 1, c0) * (1 - fx) + at(r0 + 1, c0 + 1) * fx) * fy;
  };
  const view = { aslAt(x: number, z: number) {
    const h = terrain.near.contains(x, z, 8) ? terrain.near.heightAt(x, z) : terrain.mid.contains(x, z, 32) ? ringH(terrain.mid, prior.mid, x, z) : ringH(terrain.far, prior.far, x, z);
    return h + curvatureDrop(x, z) + terrain.meta.court_asl; } };
  PRIOR_VIEW.set(terrain, view); return view;
}
export function parseRivers(j: any): RiversData {
  const prior = parsePrior(j.prior);
  const rivers = Object.entries(j.rivers).map(([id, r]: [string, any]) => ({
    id: id as RiverProfile['id'], x: Float64Array.from(r.x), y: Float64Array.from(r.y), bank: Float64Array.from(r.bank), floodplain: Float64Array.from(r.floodplain),
    channel: r.channel, topWidth: r.top_width_m, carveRadius: r.carve_radius_m,
    base: r.base_x ? { x: Float64Array.from(r.base_x), y: Float64Array.from(r.base_y), bank: Float64Array.from(r.base_bank) } : undefined, prior }));
  return { rivers, nrAncientFootAsl: j.naqsh_e_rustam.ancient_foot_asl };
}
export async function loadRivers(fetcher: (p: string) => Promise<any> = async p => (await fetch(BASE + p)).json()): Promise<RiversData> {
  return parseRivers(await fetcher('generated/rivers.json'));
}

/** bucketed point set for fast "nearest / any within r" queries over long polylines (rivers, canals, roads) */
export class PointIndex {
  private cells = new Map<number, number[]>(); readonly xs: number[] = []; readonly ys: number[] = []; readonly tags: number[] = [];
  constructor(readonly cell = 400) {}
  private key(ix: number, iy: number) { return (ix + 32768) * 65536 + (iy + 32768); }
  add(x: number, y: number, tag = 0) { const i = this.xs.length; this.xs.push(x); this.ys.push(y); this.tags.push(tag);
    const k = this.key(Math.floor(x / this.cell), Math.floor(y / this.cell)); let a = this.cells.get(k); if (!a) this.cells.set(k, a = []); a.push(i); }
  addPolyline(pts: ArrayLike<number>[] | { x: ArrayLike<number>; y: ArrayLike<number> }, step: number, tag = 0) {
    const P: [number, number][] = Array.isArray(pts) ? (pts as any) : Array.from({ length: (pts as any).x.length }, (_, i) => [(pts as any).x[i], (pts as any).y[i]]);
    for (let i = 1; i < P.length; i++) { const [ax, ay] = P[i - 1], [bx, by] = P[i], L = Math.hypot(bx - ax, by - ay), n = Math.max(1, Math.ceil(L / step));
      for (let k = 0; k < n; k++) this.add(ax + ((bx - ax) * k) / n, ay + ((by - ay) * k) / n, tag); }
    if (P.length) this.add(P[P.length - 1][0], P[P.length - 1][1], tag);
  }
  /** nearest point within r: [distance, index] or [Infinity, -1] */
  nearest(x: number, y: number, r: number, skipTag?: number): [number, number] {
    const c0x = Math.floor((x - r) / this.cell), c1x = Math.floor((x + r) / this.cell), c0y = Math.floor((y - r) / this.cell), c1y = Math.floor((y + r) / this.cell);
    let bd = r, bi = -1;
    for (let ix = c0x; ix <= c1x; ix++) for (let iy = c0y; iy <= c1y; iy++) { const a = this.cells.get(this.key(ix, iy)); if (!a) continue;
      for (const i of a) { if (skipTag !== undefined && this.tags[i] === skipTag) continue; const d = Math.hypot(this.xs[i] - x, this.ys[i] - y); if (d < bd) { bd = d; bi = i; } } }
    return bi < 0 ? [Infinity, -1] : [bd, bi];
  }
  any(x: number, y: number, r: number, skipTag?: number) { return this.nearest(x, y, r, skipTag)[1] >= 0; }
}
