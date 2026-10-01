// The town's sites as the outdoor light field sees them (D-357): walls (lintels over the doorways), roofs and the ground as
// boxes, each cell's ground and its walls and roof, and the site's region (outdoor.ts). Browser-safe (no node modules): the
// bake (outdoor_bake.ts) and the dev probe page (outdoor_probe.ts) build the same geometry.
import type { Part } from '../../arch/parts';
import type { Site } from '../../world/settlement/site';
import type { OutRegion } from './outdoor';

const ROOF_T = 0.35, DOOR_H = 2.0;
/** the town's probe layers above the floor or lane (C) */
export const TOWN_LAYERS = { L: 2, y0: 0.5, dy: 1.5 };
export interface SiteLight { R: OutRegion; parts: Part[]; ground: Float32Array; flags: Uint8Array; ceil: Float32Array }
/** one site (null: no roofs, a garden or an orchard: open ground and a wall, the skylight and D-309b) */
export function siteLight(s: Site, H: (e: number, n: number) => number): SiteLight | null {
  const roofs = s.roofs(); if (!roofs.length) return null;
  // plot bases as build.ts buildSite has them (the mean ground at the corners and centre; big open enclosures follow the ground)
  const base = new Float32Array(s.plots.length), local = new Uint8Array(s.plots.length);
  for (const p of s.plots) {
    const [i0, j0, i1, j1] = p.rect; const pts = [[i0, j0], [i1, j0], [i1, j1], [i0, j1], [(i0 + i1) / 2, (j0 + j1) / 2]].map(([i, j]) => s.grid(s.u0 + i, s.v0 + j));
    base[p.idx] = pts.reduce((a, q) => a + H(q[0], q[1]), 0) / pts.length;
    local[p.idx] = (i1 - i0) * (j1 - j0) > 2500 && p.roofed === 0 ? 1 : 0;
  }
  const parts: Part[] = [], th = s.frame.theta, B = { building: s.id, tier: 'C' as const, src: 'RECON' };
  const box = (u: number, v: number, hu: number, hv: number, y0: number, y1: number, material: string, kind: string) => {
    const g = s.grid(u, v); parts.push({ ...B, type: 'box', kind, material: material as any, c: [g[0], g[1]], size: [hu * 2, hv * 2], y0, y1, rot: th } as any);
  };
  const flags = new Uint8Array(s.W * s.H), ceil = new Float32Array(s.W * s.H).fill(Infinity);
  for (const w of s.walls()) {
    const g0 = s.grid(w.u0, w.v0), g1 = s.grid(w.u1, w.v1), gm = s.grid((w.u0 + w.u1) / 2, (w.v0 + w.v1) / 2);
    const hA = H(g0[0], g0[1]), hB = H(g1[0], g1[1]), hM = H(gm[0], gm[1]), gmin = Math.min(hA, hB, hM), gmax = Math.max(hA, hB, hM);
    let top = -Infinity, doorBase = Infinity; for (const sd of w.sides) { const b = local[sd.plot] ? gmin : base[sd.plot]; top = Math.max(top, b + sd.top); doorBase = Math.min(doorBase, b); }
    top = Math.max(top, gmax + 0.9); if (!isFinite(doorBase)) doorBase = gmin;
    const along = w.v0 === w.v1, len = along ? w.u1 - w.u0 : w.v1 - w.v0, hu = along ? len / 2 : w.thick / 2, hv = along ? w.thick / 2 : len / 2;
    const u = (w.u0 + w.u1) / 2, v = (w.v0 + w.v1) / 2;
    if (w.door) { if (top > doorBase + DOOR_H) box(u, v, hu, hv, doorBase + DOOR_H, top, 'house_plaster', 'lintel'); continue; }
    box(u, v, hu, hv, gmin - 0.4, top, 'house_plaster', 'wall');
    // the wall on the cell edges it runs along: bit 0 the +i edge of the cell below/left, bit 1 its +j edge
    if (along) { const j = Math.round(w.v0 - s.v0) - 1; for (let i = Math.round(w.u0 - s.u0); i < Math.round(w.u1 - s.u0); i++) if (i >= 0 && i < s.W && j >= 0 && j < s.H) flags[j * s.W + i] |= 2; }
    else { const i = Math.round(w.u0 - s.u0) - 1; for (let j = Math.round(w.v0 - s.v0); j < Math.round(w.v1 - s.v0); j++) if (i >= 0 && i < s.W && j >= 0 && j < s.H) flags[j * s.W + i] |= 1; }
  }
  for (const r of roofs) {
    const p = s.plots[r.plot], top = base[r.plot] + p.height;
    box(s.u0 + (r.i0 + r.i1) / 2, s.v0 + (r.j0 + r.j1) / 2, (r.i1 - r.i0) / 2 + 0.15, (r.j1 - r.j0) / 2 + 0.15, top - ROOF_T, top, 'house_roof', 'roof');
    for (let j = r.j0; j < r.j1; j++) for (let i = r.i0; i < r.i1; i++) ceil[j * s.W + i] = top - ROOF_T - base[r.plot];
  }
  // the ground: 4 m tiles at the terrain's height over the site and 16 m round it (a lane's floor, sunlit or shaded)
  const M = 16, tile = 4;
  for (let v = s.v0 - M; v < s.v0 + s.H + M; v += tile) for (let u = s.u0 - M; u < s.u0 + s.W + M; u += tile) {
    const g = s.grid(u + tile / 2, v + tile / 2), y = H(g[0], g[1]); box(u + tile / 2, v + tile / 2, tile / 2, tile / 2, y - 1, y, 'road', 'ground');
  }
  const ground = new Float32Array(s.W * s.H);
  for (let j = 0; j < s.H; j++) for (let i = 0; i < s.W; i++) {
    const k = j * s.W + i, c = s.cell[k], g = s.grid(s.cu(i), s.cv(j));
    ground[k] = c >= 0 && !local[c] ? base[c] : H(g[0], g[1]);
  }
  let gmin = Infinity, gmax = -Infinity; for (const g of ground) { gmin = Math.min(gmin, g); gmax = Math.max(gmax, g); }
  const R: OutRegion = { id: s.id, kind: 'town', c: [s.frame.c[0], s.frame.c[1]], theta: th, u0: s.u0, v0: s.v0, cell: 1, W: s.W, H: s.H,
    L: TOWN_LAYERS.L, y0: TOWN_LAYERS.y0, dy: TOWN_LAYERS.dy, gmin: gmin - 0.5, grange: gmax - gmin + 1, lo: [-0.9, -0.4], hi: [3.2, 4.6], edge: 2, probeBase: 0, colBase: 0, flags: true, cstep: 0.025 };
  return { R, parts, ground, flags, ceil };
}
