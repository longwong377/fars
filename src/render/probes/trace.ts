// Ray queries against the architecture's own parts (D-110): the same boxes, prisms and column orders that the meshes, the
// colliders and the dimension tests are built from (src/arch/parts.ts), as analytic primitives in a bounding-volume
// hierarchy. Pure TypeScript (no three.js), so the light-probe bake runs in node, in worker processes and in the unit tests.
// World axes as everywhere in the renderer: x = grid east, y = up (court datum 0), z = −grid north.
// Approximations (C): a column is its square base block, a cylindrical shaft of the lower diameter (no taper, no flutes)
// and its capital's bounding box (protome box along grid x, SITE_SPEC r_column_proportions.capital_boxes); sculpture
// (colossi) is its collider box; reliefs, furniture, fires and people are not occluders.
import type { Part, Material, Pt } from '../../arch/parts';

/** linear albedo (rgb) of a surface, from the sRGB table the materials use */
export type RGB = [number, number, number];
export const srgbToLinear = (c: number) => (c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4));
export const lum = (r: number, g: number, b: number) => 0.2126 * r + 0.7152 * g + 0.0722 * b;

const BOX = 0, PRISM = 1, CYL = 2;
const STRIDE = 12;

export interface ColumnShape { baseW: number; baseH: number; shaftR: number; shaftTop: number; capW: [number, number] | null; capY0: number; capY1: number }
/** column → base block, shaft, capital box (local, relative to the column's foot) */
export function columnShape(p: Extract<Part, { type: 'column' }>, capitalBoxes: { protome: [number, number]; plain: number; volute: [number, number] }): ColumnShape {
  const o = p.order, D = o.shaftD, built = p.built;
  const shaftTop = o.baseH + (o.height - o.baseH - (built >= 1 ? o.capitalH : 0)) * built;
  const hasCap = built >= 1 && o.capital !== 'none';
  const capW: [number, number] | null = !hasCap ? null : o.capital === 'plain' ? [capitalBoxes.plain * D, capitalBoxes.plain * D] : [capitalBoxes.protome[0] * D, capitalBoxes.protome[1] * D];
  return { baseW: o.baseW, baseH: o.baseH, shaftR: D / 2, shaftTop, capW, capY0: o.height - o.capitalH, capY1: o.height };
}

export interface Hit { t: number; nx: number; ny: number; nz: number; prim: number }

/** the architecture as ray-traceable primitives */
export class TraceScene {
  readonly n: number;
  private kind: Uint8Array; private f: Float64Array; private edges: Float64Array;
  /** linear albedo per primitive (side faces) and on up-facing faces (the Terrace platform: court fill on top) */
  readonly albedo: Float32Array; readonly albedoTop: Float32Array;
  readonly building: string[]; readonly material: Material[];
  private bmin: Float64Array; private bmax: Float64Array;
  private nodeMin!: Float64Array; private nodeMax!: Float64Array; private nodeL!: Int32Array; private nodeR!: Int32Array; private order!: Int32Array;
  private stack = new Int32Array(128);
  private tmp: Hit = { t: 0, nx: 0, ny: 0, nz: 0, prim: -1 };

  constructor(prims: { kind: number; f: number[]; poly?: Pt[]; albedo: RGB; top: RGB; building: string; material: Material; min: [number, number, number]; max: [number, number, number] }[]) {
    this.n = prims.length;
    this.kind = new Uint8Array(this.n); this.f = new Float64Array(this.n * STRIDE);
    this.albedo = new Float32Array(this.n * 3); this.albedoTop = new Float32Array(this.n * 3);
    this.bmin = new Float64Array(this.n * 3); this.bmax = new Float64Array(this.n * 3);
    this.building = []; this.material = [];
    const E: number[] = [];
    prims.forEach((p, i) => {
      this.kind[i] = p.kind;
      const f = [...p.f];
      if (p.kind === PRISM) { f[2] = E.length / 4; f[3] = p.poly!.length; for (let k = 0; k < p.poly!.length; k++) { const a = p.poly![k], b = p.poly![(k + 1) % p.poly!.length]; E.push(a[0], -a[1], b[0], -b[1]); } }
      for (let k = 0; k < f.length; k++) this.f[i * STRIDE + k] = f[k];
      this.albedo.set(p.albedo, i * 3); this.albedoTop.set(p.top, i * 3);
      this.bmin.set(p.min, i * 3); this.bmax.set(p.max, i * 3);
      this.building.push(p.building); this.material.push(p.material);
    });
    this.edges = new Float64Array(E);
    this.build();
  }

  // ------------------------------------------------------------------ BVH (median split on the widest centroid axis)
  private build() {
    const n = this.n, idx = Array.from({ length: n }, (_, i) => i);
    const nm: number[] = [], nM: number[] = [], L: number[] = [], R: number[] = [];
    const cen = (i: number, a: number) => (this.bmin[i * 3 + a] + this.bmax[i * 3 + a]) / 2;
    const rec = (lo: number, hi: number): number => {
      const id = L.length; L.push(0); R.push(0);
      const mn = [Infinity, Infinity, Infinity], mx = [-Infinity, -Infinity, -Infinity], cm = [Infinity, Infinity, Infinity], cM = [-Infinity, -Infinity, -Infinity];
      for (let k = lo; k < hi; k++) { const i = idx[k]; for (let a = 0; a < 3; a++) { mn[a] = Math.min(mn[a], this.bmin[i * 3 + a]); mx[a] = Math.max(mx[a], this.bmax[i * 3 + a]); const c = cen(i, a); cm[a] = Math.min(cm[a], c); cM[a] = Math.max(cM[a], c); } }
      nm.push(...mn); nM.push(...mx);
      if (hi - lo <= 4) { L[id] = -(lo + 1); R[id] = hi - lo; return id; }
      const ax = cM[0] - cm[0] >= cM[1] - cm[1] && cM[0] - cm[0] >= cM[2] - cm[2] ? 0 : cM[1] - cm[1] >= cM[2] - cm[2] ? 1 : 2;
      const sub = idx.slice(lo, hi).sort((p, q) => cen(p, ax) - cen(q, ax)); for (let k = lo; k < hi; k++) idx[k] = sub[k - lo];
      const mid = (lo + hi) >> 1;
      L[id] = rec(lo, mid); R[id] = rec(mid, hi); return id;
    };
    if (n) rec(0, n);
    this.nodeMin = new Float64Array(nm); this.nodeMax = new Float64Array(nM); this.nodeL = new Int32Array(L); this.nodeR = new Int32Array(R); this.order = new Int32Array(idx);
  }

  // ------------------------------------------------------------------ primitive tests
  /** nearest t in (tmin, tmax) at which the ray meets primitive i; writes the face normal (facing the ray) into h */
  private hitPrim(i: number, ox: number, oy: number, oz: number, dx: number, dy: number, dz: number, tmin: number, tmax: number, h: Hit | null): number {
    const F = this.f, o = i * STRIDE;
    const k = this.kind[i];
    if (k === BOX) {
      const cx = F[o], cy = F[o + 1], cz = F[o + 2], hx = F[o + 3], hy = F[o + 4], hz = F[o + 5], c = F[o + 6], s = F[o + 7];
      const px = ox - cx, pz = oz - cz;
      const lx = px * c - pz * s, ly = oy - cy, lz = px * s + pz * c;
      const ex = dx * c - dz * s, ey = dy, ez = dx * s + dz * c;
      let t0 = tmin, t1 = tmax, ax = -1, sg = 0;
      // slab x
      if (Math.abs(ex) < 1e-12) { if (lx < -hx || lx > hx) return Infinity; } else { let a = (-hx - lx) / ex, b = (hx - lx) / ex, sa = -1; if (a > b) { const t = a; a = b; b = t; sa = 1; } if (a > t0) { t0 = a; ax = 0; sg = sa; } if (b < t1) t1 = b; if (t0 > t1) return Infinity; }
      if (Math.abs(ey) < 1e-12) { if (ly < -hy || ly > hy) return Infinity; } else { let a = (-hy - ly) / ey, b = (hy - ly) / ey, sa = -1; if (a > b) { const t = a; a = b; b = t; sa = 1; } if (a > t0) { t0 = a; ax = 1; sg = sa; } if (b < t1) t1 = b; if (t0 > t1) return Infinity; }
      if (Math.abs(ez) < 1e-12) { if (lz < -hz || lz > hz) return Infinity; } else { let a = (-hz - lz) / ez, b = (hz - lz) / ez, sa = -1; if (a > b) { const t = a; a = b; b = t; sa = 1; } if (a > t0) { t0 = a; ax = 2; sg = sa; } if (b < t1) t1 = b; if (t0 > t1) return Infinity; }
      if (ax < 0) { // the ray starts inside the box or on its surface heading in: blocked at once (a probe on a wall face
        // must not see through the wall)
        if (t1 <= tmin) return Infinity;
        if (h) { h.nx = -dx; h.ny = -dy; h.nz = -dz; }
        return tmin;
      }
      if (h) { // local normal → world (rotation by +rot about y: x' = x c + z s, z' = −x s + z c)
        const nlx = ax === 0 ? sg : 0, nly = ax === 1 ? sg : 0, nlz = ax === 2 ? sg : 0;
        h.nx = nlx * c + nlz * s; h.ny = nly; h.nz = -nlx * s + nlz * c;
      }
      return t0;
    }
    if (k === CYL) {
      const cx = F[o], cz = F[o + 1], r = F[o + 2], y0 = F[o + 3], y1 = F[o + 4];
      const px = ox - cx, pz = oz - cz;
      if (oy >= y0 && oy <= y1 && px * px + pz * pz <= r * r) { if (h) { h.nx = -dx; h.ny = -dy; h.nz = -dz; } return tmin; } // starts inside: blocked
      let best = Infinity, nx = 0, ny = 0, nz = 0;
      const a = dx * dx + dz * dz;
      if (a > 1e-14) {
        const b = px * dx + pz * dz, cc = px * px + pz * pz - r * r, disc = b * b - a * cc;
        if (disc >= 0) { const t = (-b - Math.sqrt(disc)) / a; if (t > tmin && t < tmax) { const y = oy + t * dy; if (y >= y0 && y <= y1) { best = t; nx = (px + t * dx) / r; ny = 0; nz = (pz + t * dz) / r; } } }
      }
      if (Math.abs(dy) > 1e-14) { // the cap the ray enters: the top going down, the bottom going up
        const yc = dy < 0 ? y1 : y0, t = (yc - oy) / dy;
        if (t > tmin && t < best && t < tmax) { const qx = px + t * dx, qz = pz + t * dz; if (qx * qx + qz * qz <= r * r) { best = t; nx = 0; ny = dy < 0 ? 1 : -1; nz = 0; } }
      }
      if (h && best < Infinity) { h.nx = nx; h.ny = ny; h.nz = nz; }
      return best;
    }
    // prism: vertical side faces from the polygon edges, horizontal caps
    const y0 = F[o], y1 = F[o + 1], e0 = F[o + 2], ne = F[o + 3], Ed = this.edges;
    let best = Infinity, nx = 0, ny = 0, nz = 0;
    for (let q = 0; q < ne; q++) {
      const j = (e0 + q) * 4, ax = Ed[j], az = Ed[j + 1], ex = Ed[j + 2] - ax, ez = Ed[j + 3] - az;
      const den = dx * ez - dz * ex; if (Math.abs(den) < 1e-14) continue;
      const wx = ax - ox, wz = az - oz;
      const t = (wx * ez - wz * ex) / den; if (t <= tmin || t >= best || t >= tmax) continue;
      const s = (wx * dz - wz * dx) / den; if (s < 0 || s > 1) continue;
      const y = oy + t * dy; if (y < y0 || y > y1) continue;
      const L = Math.hypot(ex, ez); let mx = ez / L, mz = -ex / L; if (mx * dx + mz * dz > 0) { mx = -mx; mz = -mz; }
      best = t; nx = mx; ny = 0; nz = mz;
    }
    if (Math.abs(dy) > 1e-14) { // the cap the ray enters: the top going down, the bottom going up
      const yc = dy < 0 ? y1 : y0, t = (yc - oy) / dy;
      if (t > tmin && t < best && t < tmax && this.inPoly(i, ox + t * dx, oz + t * dz)) { best = t; nx = 0; ny = dy > 0 ? -1 : 1; nz = 0; }
    }
    if (h && best < Infinity) { h.nx = nx; h.ny = ny; h.nz = nz; }
    return best;
  }
  private inPoly(i: number, x: number, z: number) {
    const o = i * STRIDE, e0 = this.f[o + 2], ne = this.f[o + 3], Ed = this.edges; let ins = false;
    for (let q = 0; q < ne; q++) { const j = (e0 + q) * 4, xi = Ed[j], zi = Ed[j + 1], xj = Ed[j + 2], zj = Ed[j + 3]; if ((zi > z) !== (zj > z) && x < ((xj - xi) * (z - zi)) / (zj - zi) + xi) ins = !ins; }
    return ins;
  }
  /** is the point inside primitive i (solid interior)? */
  private insidePrim(i: number, x: number, y: number, z: number, pad: number) {
    const F = this.f, o = i * STRIDE, k = this.kind[i];
    if (k === BOX) {
      const px = x - F[o], pz = z - F[o + 2], c = F[o + 6], s = F[o + 7];
      const lx = px * c - pz * s, lz = px * s + pz * c;
      return Math.abs(lx) < F[o + 3] - pad && Math.abs(y - F[o + 1]) < F[o + 4] - pad && Math.abs(lz) < F[o + 5] - pad;
    }
    if (k === CYL) { const px = x - F[o], pz = z - F[o + 1], r = F[o + 2] - pad; return y > F[o + 3] + pad && y < F[o + 4] - pad && px * px + pz * pz < r * r; }
    return y > F[o] + pad && y < F[o + 1] - pad && this.inPoly(i, x, z);
  }

  // ------------------------------------------------------------------ queries
  /** closest hit along the ray (unit direction) within (tmin, tmax); null if it escapes */
  intersect(ox: number, oy: number, oz: number, dx: number, dy: number, dz: number, tmin = 1e-4, tmax = Infinity, out: Hit = { t: 0, nx: 0, ny: 0, nz: 0, prim: -1 }): Hit | null {
    if (!this.n) return null;
    const ix = 1 / dx, iy = 1 / dy, iz = 1 / dz, S = this.stack; let sp = 0; S[sp++] = 0;
    let best = tmax, bp = -1; const tmp = this.tmp;
    while (sp) {
      const nd = S[--sp];
      if (!this.boxHit(nd, ox, oy, oz, ix, iy, iz, tmin, best)) continue;
      const l = this.nodeL[nd];
      if (l < 0) { const s0 = -l - 1, cnt = this.nodeR[nd]; for (let k = s0; k < s0 + cnt; k++) { const p = this.order[k]; const t = this.hitPrim(p, ox, oy, oz, dx, dy, dz, tmin, best, tmp); if (t < best) { best = t; bp = p; out.nx = tmp.nx; out.ny = tmp.ny; out.nz = tmp.nz; } } }
      else { S[sp++] = l; S[sp++] = this.nodeR[nd]; }
    }
    if (bp < 0) return null;
    out.t = best; out.prim = bp; return out;
  }
  /** does anything block the ray within (tmin, tmax)? */
  occluded(ox: number, oy: number, oz: number, dx: number, dy: number, dz: number, tmin = 1e-4, tmax = Infinity): boolean {
    if (!this.n) return false;
    const ix = 1 / dx, iy = 1 / dy, iz = 1 / dz, S = this.stack; let sp = 0; S[sp++] = 0;
    while (sp) {
      const nd = S[--sp];
      if (!this.boxHit(nd, ox, oy, oz, ix, iy, iz, tmin, tmax)) continue;
      const l = this.nodeL[nd];
      if (l < 0) { const s0 = -l - 1, cnt = this.nodeR[nd]; for (let k = s0; k < s0 + cnt; k++) if (this.hitPrim(this.order[k], ox, oy, oz, dx, dy, dz, tmin, tmax, null) < tmax) return true; }
      else { S[sp++] = l; S[sp++] = this.nodeR[nd]; }
    }
    return false;
  }
  /** is the point inside any solid (pad: shrink the solids by this margin, m)? */
  inside(x: number, y: number, z: number, pad = 0): boolean {
    if (!this.n) return false;
    const S = this.stack; let sp = 0; S[sp++] = 0;
    while (sp) {
      const nd = S[--sp], a = nd * 3;
      if (x < this.nodeMin[a] || x > this.nodeMax[a] || y < this.nodeMin[a + 1] || y > this.nodeMax[a + 1] || z < this.nodeMin[a + 2] || z > this.nodeMax[a + 2]) continue;
      const l = this.nodeL[nd];
      if (l < 0) { const s0 = -l - 1, cnt = this.nodeR[nd]; for (let k = s0; k < s0 + cnt; k++) if (this.insidePrim(this.order[k], x, y, z, pad)) return true; }
      else { S[sp++] = l; S[sp++] = this.nodeR[nd]; }
    }
    return false;
  }
  private boxHit(nd: number, ox: number, oy: number, oz: number, ix: number, iy: number, iz: number, tmin: number, tmax: number) {
    const a = nd * 3, m = this.nodeMin, M = this.nodeMax;
    let t0 = tmin, t1 = tmax, p: number, q: number;
    p = (m[a] - ox) * ix; q = (M[a] - ox) * ix; if (p > q) { const t = p; p = q; q = t; } if (p > t0) t0 = p; if (q < t1) t1 = q; if (!(t0 <= t1)) return false;
    p = (m[a + 1] - oy) * iy; q = (M[a + 1] - oy) * iy; if (p > q) { const t = p; p = q; q = t; } if (p > t0) t0 = p; if (q < t1) t1 = q; if (!(t0 <= t1)) return false;
    p = (m[a + 2] - oz) * iz; q = (M[a + 2] - oz) * iz; if (p > q) { const t = p; p = q; q = t; } if (p > t0) t0 = p; if (q < t1) t1 = q;
    return t0 <= t1;
  }
  /** albedo of a hit (up-facing faces of a two-surface part use its top albedo) */
  albedoAt(prim: number, ny: number, out: RGB): RGB {
    const A = ny > 0.7 ? this.albedoTop : this.albedo, o = prim * 3;
    out[0] = A[o]; out[1] = A[o + 1]; out[2] = A[o + 2]; return out;
  }
}

/** primitives from parts. `albedoOf(material, top)` gives the linear albedo; `members(order)` the surface of a column's
 *  base, shaft and capital (the Treasury's stone base, plastered shaft and timber capital) */
export function sceneFromParts(parts: Part[], albedoOf: (m: Material, top: boolean) => RGB, capitalBoxes: { protome: [number, number]; plain: number; volute: [number, number] },
  members: (p: Extract<Part, { type: 'column' }>) => { base: Material; shaft: Material; capital: Material } = p => ({ base: p.order.material, shaft: p.order.material, capital: p.order.material })): TraceScene {
  const prims: ConstructorParameters<typeof TraceScene>[0] = [];
  const addBox = (b: string, m: Material, cx: number, cy: number, cz: number, hx: number, hy: number, hz: number, rot: number) => {
    const c = Math.cos(rot), s = Math.sin(rot), ex = Math.abs(c) * hx + Math.abs(s) * hz, ez = Math.abs(s) * hx + Math.abs(c) * hz;
    prims.push({ kind: BOX, f: [cx, cy, cz, hx, hy, hz, c, s], albedo: albedoOf(m, false), top: albedoOf(m, true), building: b, material: m, min: [cx - ex, cy - hy, cz - ez], max: [cx + ex, cy + hy, cz + ez] });
  };
  for (const p of parts) {
    if (p.type === 'box') {
      if (p.y1 - p.y0 <= 0 || p.size[0] <= 0 || p.size[1] <= 0) continue;
      addBox(p.building, p.material, p.c[0], (p.y0 + p.y1) / 2, -p.c[1], p.size[0] / 2, (p.y1 - p.y0) / 2, p.size[1] / 2, p.rot ?? 0);
    } else if (p.type === 'prism') {
      let x0 = Infinity, x1 = -Infinity, z0 = Infinity, z1 = -Infinity; for (const [e, n] of p.polygon) { x0 = Math.min(x0, e); x1 = Math.max(x1, e); z0 = Math.min(z0, -n); z1 = Math.max(z1, -n); }
      prims.push({ kind: PRISM, f: [p.y0, p.y1, 0, 0], poly: p.polygon, albedo: albedoOf(p.material, false), top: albedoOf(p.material, true), building: p.building, material: p.material, min: [x0, p.y0, z0], max: [x1, p.y1, z1] });
    } else {
      const S = columnShape(p, capitalBoxes), M = members(p), x = p.c[0], z = -p.c[1], y = p.y0;
      addBox(p.building, M.base, x, y + S.baseH / 2, z, S.baseW / 2, S.baseH / 2, S.baseW / 2, 0);
      if (S.shaftTop > S.baseH) prims.push({ kind: CYL, f: [x, z, S.shaftR, y + S.baseH, y + Math.min(S.shaftTop, S.capW ? S.capY0 : S.shaftTop)], albedo: albedoOf(M.shaft, false), top: albedoOf(M.shaft, true), building: p.building, material: M.shaft, min: [x - S.shaftR, y + S.baseH, z - S.shaftR], max: [x + S.shaftR, y + S.shaftTop, z + S.shaftR] });
      if (S.capW) addBox(p.building, M.capital, x, y + (S.capY0 + S.capY1) / 2, z, S.capW[0] / 2, (S.capY1 - S.capY0) / 2, S.capW[1] / 2, 0);
    }
  }
  return new TraceScene(prims);
}
