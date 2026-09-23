// Geometry batch for the settlement: boxes, prisms, lathes and mounds merged into one indexed mesh per cluster and
// material, with linear vertex colours and a per-triangle owner id (the dev overlay looks up what a face belongs to).
// Coordinates: grid (e, n) in, world (x = e, z = −n) out. Box faces skip the bottom (they stand on or in the ground).
import * as THREE from 'three/webgpu';

export type RGB = [number, number, number];
const tmp = new THREE.Color();
/** sRGB triple → linear (vertex colours are read as linear albedo by the surface materials) */
export const lin = (c: RGB): RGB => { tmp.setRGB(c[0], c[1], c[2], THREE.SRGBColorSpace); return [tmp.r, tmp.g, tmp.b]; };

/** growable typed array */
class Grow<T extends Float32Array | Uint32Array | Int32Array> {
  n = 0;
  constructor(public a: T) {}
  push3(x: number, y: number, z: number) { if (this.n + 3 > this.a.length) this.grow(); const a = this.a; a[this.n] = x; a[this.n + 1] = y; a[this.n + 2] = z; this.n += 3; }
  push1(x: number) { if (this.n + 1 > this.a.length) this.grow(); this.a[this.n++] = x; }
  private grow() { const b = new (this.a.constructor as any)(Math.max(1024, this.a.length * 2)); b.set(this.a); this.a = b; }
  view() { return this.a.subarray(0, this.n) as T; }
}
export class Batch {
  private P = new Grow(new Float32Array(3072)); private N = new Grow(new Float32Array(3072)); private Cc = new Grow(new Float32Array(3072));
  private I = new Grow(new Uint32Array(3072)); private O = new Grow(new Int32Array(1024));
  get tris() { return this.I.n / 3; }
  get verts() { return this.P.n / 3; }
  get owner() { return this.O.view(); }
  private v(x: number, y: number, z: number, nx: number, ny: number, nz: number, c: RGB) { this.P.push3(x, y, z); this.N.push3(nx, ny, nz); this.Cc.push3(c[0], c[1], c[2]); return this.P.n / 3 - 1; }
  private tri(a: number, b: number, c: number, owner: number) { this.I.push3(a, b, c); this.O.push1(owner); }
  /** a planar quad a-b-c-d with outward normal n (winding fixed to face n) */
  quad(a: number[], b: number[], c: number[], d: number[], n: number[], ca: RGB, cb: RGB, cc: RGB, cd: RGB, owner: number) {
    const e1 = [b[0] - a[0], b[1] - a[1], b[2] - a[2]], e2 = [c[0] - a[0], c[1] - a[1], c[2] - a[2]];
    const cr = [e1[1] * e2[2] - e1[2] * e2[1], e1[2] * e2[0] - e1[0] * e2[2], e1[0] * e2[1] - e1[1] * e2[0]];
    const flip = cr[0] * n[0] + cr[1] * n[1] + cr[2] * n[2] < 0;
    const i0 = this.v(a[0], a[1], a[2], n[0], n[1], n[2], ca), i1 = this.v(b[0], b[1], b[2], n[0], n[1], n[2], cb), i2 = this.v(c[0], c[1], c[2], n[0], n[1], n[2], cc), i3 = this.v(d[0], d[1], d[2], n[0], n[1], n[2], cd);
    if (flip) { this.tri(i0, i2, i1, owner); this.tri(i0, i3, i2, owner); } else { this.tri(i0, i1, i2, owner); this.tri(i0, i2, i3, owner); }
  }
  /** oriented box: grid centre (e, n), angle theta (CCW from grid east), half sizes hu (along u), hv (along v), y0..y1 */
  box(e: number, n: number, theta: number, hu: number, hv: number, y0: number, y1: number, cBot: RGB, cTop: RGB, owner = -1, bottom = false) {
    const cs = Math.cos(theta), sn = Math.sin(theta);
    const U = [cs, 0, -sn], V = [-sn, 0, -cs], C = [e, 0, -n];
    const P = (su: number, sv: number, y: number) => [C[0] + U[0] * hu * su + V[0] * hv * sv, y, C[2] + U[2] * hu * su + V[2] * hv * sv];
    const [a0, b0, c0, d0] = [P(-1, -1, y0), P(1, -1, y0), P(1, 1, y0), P(-1, 1, y0)], [a1, b1, c1, d1] = [P(-1, -1, y1), P(1, -1, y1), P(1, 1, y1), P(-1, 1, y1)];
    this.quad(a1, b1, c1, d1, [0, 1, 0], cTop, cTop, cTop, cTop, owner);
    if (bottom) this.quad(a0, b0, c0, d0, [0, -1, 0], cBot, cBot, cBot, cBot, owner);
    const nU = U, nV = V, mU = [-U[0], 0, -U[2]], mV = [-V[0], 0, -V[2]];
    this.quad(b0, c0, c1, b1, nU, cBot, cBot, cTop, cTop, owner);
    this.quad(d0, a0, a1, d1, mU, cBot, cBot, cTop, cTop, owner);
    this.quad(c0, d0, d1, c1, nV, cBot, cBot, cTop, cTop, owner);
    this.quad(a0, b0, b1, a1, mV, cBot, cBot, cTop, cTop, owner);
  }
  /** vertical prism (cylinder/cone frustum) with a top cap; r0 at y0, r1 at y1 */
  cyl(e: number, n: number, r0: number, r1: number, y0: number, y1: number, sides: number, cBot: RGB, cTop: RGB, owner = -1, cap = true) {
    const x = e, z = -n, slope = (r0 - r1) / Math.max(1e-6, y1 - y0);
    for (let s = 0; s < sides; s++) {
      const a0 = (s / sides) * Math.PI * 2, a1 = ((s + 1) / sides) * Math.PI * 2, am = (a0 + a1) / 2;
      const nn = [Math.cos(am), slope, Math.sin(am)], L = Math.hypot(nn[0], nn[1], nn[2]);
      this.quad([x + Math.cos(a0) * r0, y0, z + Math.sin(a0) * r0], [x + Math.cos(a1) * r0, y0, z + Math.sin(a1) * r0], [x + Math.cos(a1) * r1, y1, z + Math.sin(a1) * r1], [x + Math.cos(a0) * r1, y1, z + Math.sin(a0) * r1],
        [nn[0] / L, nn[1] / L, nn[2] / L], cBot, cBot, cTop, cTop, owner);
    }
    if (cap && r1 > 0) { const c = this.v(x, y1, z, 0, 1, 0, cTop); for (let s = 0; s < sides; s++) { const a0 = (s / sides) * Math.PI * 2, a1 = ((s + 1) / sides) * Math.PI * 2;
      const i1 = this.v(x + Math.cos(a0) * r1, y1, z + Math.sin(a0) * r1, 0, 1, 0, cTop), i2 = this.v(x + Math.cos(a1) * r1, y1, z + Math.sin(a1) * r1, 0, 1, 0, cTop); this.tri(c, i2, i1, owner); } }
  }
  /** lathe from (radius, height) pairs, bottom to top */
  lathe(e: number, n: number, y0: number, prof: [number, number][], sides: number, c: RGB, owner = -1) {
    for (let k = 0; k + 1 < prof.length; k++) { const [ra, ya] = prof[k], [rb, yb] = prof[k + 1]; if (ra === 0 && rb === 0) continue; this.cyl(e, n, ra, rb, y0 + ya, y0 + yb, sides, c, c, owner, false); }
    const [rt, yt] = prof[prof.length - 1]; if (rt > 0) this.cyl(e, n, rt, rt, y0 + yt, y0 + yt, sides, c, c, owner, true);
  }
  /** a low mound (flattened dome) of radius r and height h, rings following the ground via groundAt */
  mound(e: number, n: number, r: number, h: number, c: RGB, groundAt: (e: number, n: number) => number, owner = -1, rings = 4, sides = 12) {
    const pts: number[][][] = [];
    for (let k = 0; k <= rings; k++) { const f = k / rings, rr = r * (1 - f * f * 0.98), ring: number[][] = [];
      for (let s = 0; s < sides; s++) { const a = (s / sides) * Math.PI * 2, pe = e + Math.cos(a) * rr, pn = n + Math.sin(a) * rr; ring.push([pe, groundAt(pe, pn) + h * Math.sin(f * Math.PI / 2) - (k === 0 ? 0.1 : 0), -pn]); }
      pts.push(ring); }
    for (let k = 0; k < rings; k++) for (let s = 0; s < sides; s++) { const s1 = (s + 1) % sides, a = pts[k][s], b = pts[k][s1], cc = pts[k + 1][s1], d = pts[k + 1][s];
      const mid = [(a[0] + b[0] + cc[0] + d[0]) / 4 - e, 0, (a[2] + b[2] + cc[2] + d[2]) / 4 + n]; const L = Math.hypot(mid[0], mid[2]) || 1; const up = 0.4 + 0.6 * (k / rings);
      const nn = [mid[0] / L * (1 - up), up, mid[2] / L * (1 - up)], nl = Math.hypot(nn[0], nn[1], nn[2]);
      this.quad(a, b, cc, d, [nn[0] / nl, nn[1] / nl, nn[2] / nl], c, c, c, c, owner); }
  }
  toGeometry(): THREE.BufferGeometry {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(this.P.view().slice(), 3)); g.setAttribute('normal', new THREE.BufferAttribute(this.N.view().slice(), 3)); g.setAttribute('color', new THREE.BufferAttribute(this.Cc.view().slice(), 3));
    const idx = this.I.view(); g.setIndex(this.verts > 65535 ? new THREE.BufferAttribute(idx.slice(), 1) : new THREE.BufferAttribute(Uint16Array.from(idx), 1));
    g.computeBoundingSphere(); g.computeBoundingBox();
    return g;
  }
}
