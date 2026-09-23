// Lines of sight over the built world, 2.5-D (D-143): for counting, in node tests, how many of the people a view draws
// could be seen from the camera, and for choosing the views the rendered floor is measured in. The browser measures
// the same thing exactly against the rendered depth (crowdprobe.ts); this is the fast estimate, never used for drawing.
//  - the Terrace: its architecture (the parts of buildTerrace(), the same data the meshes and colliders are built from)
//    rasterised on the walkable grid's 0.5 m cells, per cell a solid column from the ground to the top of the parts that
//    stand on it and one elevated interval (lintels, roofs, capitals over a passage or a hall);
//  - the town and the villages: their site rasters as built (settlement/site.ts): roofed rooms solid to their roof and
//    parapet, courts and yards open, walls on the cell edges to the tops site.ts builds them to (doors open to DOOR_H);
//  - the terrain between (every 4 m).
// Not modelled: trees and vegetation, fittings, props, other people (the browser count includes them).
import type { Part } from '../arch/parts';
import { pointInPoly, polyBounds } from '../arch/parts';
import { NAV } from './navgrid';
import { Site, ROOM, COURT, DOOR_H, toLocal } from '../world/settlement/site';
import type { PopGeo } from './popgeo';

type V3 = [number, number, number];
interface Box { s: Site; e0: number; n0: number; e1: number; n1: number }

/** clip the segment a→b (grid e, n) to a box: [f0, f1] along it, or null */
function clip(ae: number, an: number, be: number, bn: number, x0: number, y0: number, x1: number, y1: number): [number, number] | null {
  const dx = be - ae, dy = bn - an; let u0 = 0, u1 = 1;
  for (const [p, q] of [[-dx, ae - x0], [dx, x1 - ae], [-dy, an - y0], [dy, y1 - an]] as const) {
    if (p === 0) { if (q < 0) return null; continue; }
    const r = q / p; if (p < 0) { if (r > u1) return null; if (r > u0) u0 = r; } else { if (r < u0) return null; if (r < u1) u1 = r; } }
  return [u0, u1];
}

export class Sightlines {
  private top: Float32Array | null = null; private lo: Float32Array | null = null; private hi: Float32Array | null = null;
  private boxes: Box[];
  readonly stats = { checks: 0, samples: 0 };
  constructor(private geo: PopGeo, parts: Part[] | null) {
    this.boxes = [...(geo.town?.boxes ?? []), ...geo.villageSites().map(s => Sightlines.box(s))];
    if (parts) this.raster(parts);
  }
  private static box(s: Site): Box { const c = Math.cos(s.frame.theta), sn = Math.sin(s.frame.theta), hw = s.W / 2, hh = s.H / 2;
    const ex = Math.abs(c) * hw + Math.abs(sn) * hh, ny = Math.abs(sn) * hw + Math.abs(c) * hh; return { s, e0: s.frame.c[0] - ex, n0: s.frame.c[1] - ny, e1: s.frame.c[0] + ex, n1: s.frame.c[1] + ny }; }
  /** the Terrace's parts on the grid's cells, lowest first: a part that starts at or below a cell's solid top (+0.6 m)
   *  raises it; one that starts higher widens the cell's elevated interval (a passage stays open under its lintel) */
  private raster(parts: Part[]) {
    const W = NAV.w, H = NAV.h, top = new Float32Array(W * H), lo = new Float32Array(W * H).fill(Infinity), hi = new Float32Array(W * H).fill(-Infinity);
    for (let j = 0; j < H; j++) for (let i = 0; i < W; i++) top[j * W + i] = this.geo.groundAt(NAV.e0 + (i + 0.5) * NAV.cell, NAV.n0 + (j + 0.5) * NAV.cell);
    const put = (x0: number, y0_: number, x1: number, y1_: number, inside: (e: number, n: number) => boolean, b: number, t: number) => {
      const i0 = Math.max(0, Math.floor((x0 - NAV.e0) / NAV.cell)), i1 = Math.min(W - 1, Math.floor((x1 - NAV.e0) / NAV.cell)), j0 = Math.max(0, Math.floor((y0_ - NAV.n0) / NAV.cell)), j1 = Math.min(H - 1, Math.floor((y1_ - NAV.n0) / NAV.cell));
      for (let j = j0; j <= j1; j++) for (let i = i0; i <= i1; i++) { const e = NAV.e0 + (i + 0.5) * NAV.cell, n = NAV.n0 + (j + 0.5) * NAV.cell; if (!inside(e, n)) continue; const k = j * W + i;
        if (b <= top[k] + 0.6) top[k] = Math.max(top[k], t); else { lo[k] = Math.min(lo[k], b); hi[k] = Math.max(hi[k], t); } } };
    const list = parts.filter(p => p.material !== 'scaffold' && !(p.type === 'box' && p.door)).sort((a, b) => a.y0 - b.y0);
    for (const p of list) {
      if (p.type === 'prism') { const [x0, y0, x1, y1] = polyBounds(p.polygon); put(x0, y0, x1, y1, (e, n) => pointInPoly(e, n, p.polygon), p.y0, p.y1); }
      else if (p.type === 'box') { const r = p.rot ?? 0, c = Math.cos(r), s = Math.sin(r), hx = p.size[0] / 2, hy = p.size[1] / 2, ex = Math.abs(c) * hx + Math.abs(s) * hy, ey = Math.abs(s) * hx + Math.abs(c) * hy;
        put(p.c[0] - ex, p.c[1] - ey, p.c[0] + ex, p.c[1] + ey, (e, n) => { const de = e - p.c[0], dn = n - p.c[1], u = de * c + dn * s, v = -de * s + dn * c; return Math.abs(u) <= hx && Math.abs(v) <= hy; }, p.y0, p.y1); }
      else { const o = p.order, rr = Math.max(o.shaftD / 2, 0.3), h = o.baseH + (o.height - o.baseH) * Math.max(0, Math.min(1, p.built ?? 1));
        if (h <= 0) continue; put(p.c[0] - rr, p.c[1] - rr, p.c[0] + rr, p.c[1] + rr, (e, n) => Math.hypot(e - p.c[0], n - p.c[1]) <= rr, p.y0, p.y0 + h); }
    }
    this.top = top; this.lo = lo; this.hi = hi;
  }
  /** can an eye at (e, n, y) see the point (e, n, y)? */
  see(eye: V3, tgt: V3): boolean {
    this.stats.checks++;
    const [ae, an, ay] = eye, [be, bn, by] = tgt, L = Math.hypot(be - ae, bn - an); if (L < 0.3) return true;
    const at = (f: number): V3 => [ae + (be - ae) * f, an + (bn - an) * f, ay + (by - ay) * f];
    // the terrain, every 4 m
    for (let f = 4 / L; f < 1; f += 4 / L) { const [e, n, y] = at(f); if (y < this.geo.groundAt(e, n) - 0.2) return false; }
    // the Terrace's architecture
    if (this.top) { const c = clip(ae, an, be, bn, NAV.e0, NAV.n0, NAV.e0 + NAV.w * NAV.cell, NAV.n0 + NAV.h * NAV.cell);
      if (c) { const step = 0.2 / L, top = this.top, lo = this.lo!, hi = this.hi!;
        for (let f = c[0] + step * 0.5; f < c[1]; f += step) { const [e, n, y] = at(f); const i = Math.floor((e - NAV.e0) / NAV.cell), j = Math.floor((n - NAV.n0) / NAV.cell);
          if (i < 0 || j < 0 || i >= NAV.w || j >= NAV.h) continue; const k = j * NAV.w + i; this.stats.samples++;
          if (L * f < 0.35 || L * (1 - f) < 0.35) continue; // the eye's and the target's own cells
          if (y < top[k] || (y >= lo[k] && y <= hi[k])) return false; } } }
    // the town's and the villages' sites
    for (const B of this.boxes) { const c = clip(ae, an, be, bn, B.e0, B.n0, B.e1, B.n1); if (!c) continue; if (!this.throughSite(B.s, at, c[0], c[1], L)) return false; }
    return true;
  }
  /** the part [f0, f1] of the line through one site raster: rooms solid to roof and parapet, walls on the edges crossed */
  private throughSite(s: Site, at: (f: number) => V3, f0: number, f1: number, L: number): boolean {
    const step = 0.25 / L; let pi = -1, pj = -1, pu = 0, pv = 0;
    const topOf = (k: number) => { const c = s.cell[k]; if (c < 0) return 0; const p = s.plots[c], sb = s.sub[k]; return sb === ROOM ? p.height + p.parapet : sb === COURT ? p.height : p.yardWall; };
    // wall top on the edge between 4-neighbours k1, k2 (as Site.edgeWall builds it; 0 = none)
    const wallTop = (k1: number, k2: number) => { const c1 = s.cell[k1], c2 = s.cell[k2]; if (c1 < 0 && c2 < 0) return 0; if (s.noWall.has(s.edgeBetween(k1, k2))) return 0;
      if (c1 !== c2) return Math.max(topOf(k1), topOf(k2));
      const s1 = s.sub[k1], s2 = s.sub[k2], p = s.plots[c1];
      if (s1 === s2) return s1 === ROOM && s.room[k1] !== s.room[k2] ? p.height : 0;
      if (s1 === ROOM || s2 === ROOM) return p.height + p.parapet;
      return p.yardWall; };
    const cross = (k1: number, k2: number, y: number, g: number) => { const t = wallTop(k1, k2); if (!t || y >= g + t) return true; return s.doors.has(s.edgeBetween(k1, k2)) && y < g + DOOR_H; };
    for (let f = f0; f <= f1 + 1e-9; f += step) { const [e, n, y] = at(Math.min(f, f1)); const [u, v] = toLocal(s.frame, e, n), i = s.ci(u), j = s.cj(v);
      if (!s.inb(i, j)) { pi = -1; continue; }
      const k = s.k(i, j), near = L * f < 0.35 || L * (1 - f) < 0.35, g = this.geo.groundAt(e, n); this.stats.samples++;
      if (!near && s.cell[k] >= 0 && s.sub[k] === ROOM && y < g + topOf(k)) return false;
      if (pi >= 0 && (i !== pi || j !== pj) && !near) {
        const kp = s.k(pi, pj);
        if (Math.abs(i - pi) + Math.abs(j - pj) === 1) { if (!cross(kp, k, y, g)) return false; }
        else if (Math.abs(i - pi) <= 1 && Math.abs(j - pj) <= 1) { // a diagonal step: by the cell the line enters first
          const bu = s.u0 + Math.max(i, pi), bv = s.v0 + Math.max(j, pj), tu = (bu - pu) / (u - pu || 1e-9), tv = (bv - pv) / (v - pv || 1e-9);
          const km = tu < tv ? s.k(i, pj) : s.k(pi, j); if (!cross(kp, km, y, g) || !cross(km, k, y, g)) return false; }
      }
      pi = i; pj = j; pu = u; pv = v; }
    return true;
  }
}
