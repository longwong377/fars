// D-364 (B186): the palaces' plastered mud-brick walls stop being planar boxes. Every face of a mud-brick part's render geometry
// (walls, towers, benches, the roof edges' parapets and copings, the wall feet: everything drawn in the mud-brick surfaces) is
// cut by one global lattice of planes x, y, z = k x CELL (so a split edge is split at the same points in every triangle that
// shares it: no T-junction, no crack) and every vertex moved sideways by one smooth world-space field: the hand-laid brick and
// the floated plaster over it, a wall bowing and leaning by a few centimetres over metres, its corners and its top no longer
// ruled lines. The field is the same function of the world position for every part, so two parts that touch move together;
// it fades to nothing within FADE of any part in another material (stone frames, jambs, columns, timber), so nothing set
// into a wall opens a gap or is swallowed. Only horizontal motion: a wall's foot slides over its floor, its top under its roof,
// never off them. The normals follow the bow. Colliders, the nav grid and the probes keep the parts' boxes (<= AMP off).
// Amplitudes and wavelengths C (the plaster of an earthen wall hand-floated over brick: +-2-4 cm over 1-5 m; Stein et al. 2016
// for the earthen plaster, B; its flatness unrecorded).
import * as THREE from 'three/webgpu';
import { pointInPoly as pointIn, type Part } from './parts';

/** the lattice's spacing (m): fine enough for the field's shortest wavelength */
export const MUD_CELL = 2.5;
/** the field: [wavelength m, amplitude m] per octave (C) */
export const MUD_OCTAVES: [number, number][] = [[9, 0.035], [4.2, 0.02]];
export const MUD_FADE = [0.04, 0.6];
export const MUD_FOOT = 0.8; // (m: from no motion at the other material's face to full motion)
export const MUD_MATS = new Set(['mudbrick', 'mudbrick_painted', 'mudbrick_bare']);
/** kinds that support a wall (its floor, roof) rather than being set into it: no fade against them */
const SUPPORT = /^(floor|floor_finish|court|pavement|landing|portico_floor|platform|roof|ceiling.*|wall_foot)$/;

// a smooth value noise in 3-D (quintic fade, hashed lattice), in [-1, 1]
const hash3 = (x: number, y: number, z: number) => { let h = (Math.imul(x | 0, 374761393) + Math.imul(y | 0, 668265263) + Math.imul(z | 0, 1274126177)) | 0; h = Math.imul(h ^ (h >>> 13), 1274126177); h ^= h >>> 16; return (h & 0xffffff) / 0x800000 - 1; };
const fade = (t: number) => t * t * t * (t * (t * 6 - 15) + 10);
export function vnoise3(x: number, y: number, z: number): number {
  const X = Math.floor(x), Y = Math.floor(y), Z = Math.floor(z), u = fade(x - X), v = fade(y - Y), w = fade(z - Z);
  const L = (a: number, b: number, t: number) => a + (b - a) * t;
  return L(L(L(hash3(X, Y, Z), hash3(X + 1, Y, Z), u), L(hash3(X, Y + 1, Z), hash3(X + 1, Y + 1, Z), u), v),
    L(L(hash3(X, Y, Z + 1), hash3(X + 1, Y, Z + 1), u), L(hash3(X, Y + 1, Z + 1), hash3(X + 1, Y + 1, Z + 1), u), v), w);
}
/** the field's horizontal displacement (m) at a world point, before the fade; the vertical wavelength 1.6x the horizontal (a
 *  wall's courses: the bow runs along it more than up it) */
export function mudField(x: number, y: number, z: number, out: [number, number] = [0, 0]): [number, number] {
  let dx = 0, dz = 0;
  MUD_OCTAVES.forEach(([L, A], k) => { const o = 17.3 * (k + 1); dx += A * vnoise3(x / L + o, y / (1.6 * L), z / L); dz += A * vnoise3(x / L, y / (1.6 * L) + o, z / L + 3.1 * o); });
  out[0] = dx; out[1] = dz; return out;
}

/** the parts in other materials a mud-brick face fades against, on a 4 m plan grid */
export class HardIndex {
  private cells = new Map<number, Part[]>(); private floors = new Map<number, Part[]>(); private C = 4;
  constructor(parts: Part[]) {
    for (const p of parts) {
      if (p.type !== 'column' && (SUPPORT.test(p.kind) || p.material === 'court_fill' || p.material === 'terrace') && p.kind !== 'roof' && !/^ceiling/.test(p.kind)) { const [x0, x1, n0, n1] = bounds(p);
        for (let gx = Math.floor(x0 / this.C); gx <= Math.floor(x1 / this.C); gx++) for (let gy = Math.floor(n0 / this.C); gy <= Math.floor(n1 / this.C); gy++) { const k = gx * 100003 + gy; (this.floors.get(k) ?? this.floors.set(k, []).get(k)!).push(p); } }
      if (MUD_MATS.has(p.material) || p.material === 'plaster' || p.material === 'plaster_red' || p.material === 'earth' || p.material === 'court_fill' || p.material === 'roof_earth' || SUPPORT.test(p.kind)) continue;
      if (p.type === 'box' && p.door) continue; // (the leaves swing: the jambs are what the wall meets)
      const [x0, x1, n0, n1] = bounds(p), m = MUD_FADE[1];
      for (let gx = Math.floor((x0 - m) / this.C); gx <= Math.floor((x1 + m) / this.C); gx++) for (let gy = Math.floor((n0 - m) / this.C); gy <= Math.floor((n1 + m) / this.C); gy++) {
        const k = gx * 100003 + gy; (this.cells.get(k) ?? this.cells.set(k, []).get(k)!).push(p); }
    }
  }
  /** the highest floor, court or platform top at or below a world point (a function of the point only: two parts' faces at one point
   *  read the same, so they move together); -1000 none */
  floorBelow(x: number, y: number, z: number): number {
    const e = x, n = -z, L = this.floors.get(Math.floor(e / this.C) * 100003 + Math.floor(n / this.C)); if (!L) return -1000;
    let best = -1000;
    for (const p of L) { if (p.type === 'column' || p.y1 > y + 1e-3 || p.y1 <= best) continue;
      if (p.type === 'prism') { if (pointIn(e, n, p.polygon)) best = p.y1; continue; }
      const c = Math.cos(-(p.rot ?? 0)), s = Math.sin(-(p.rot ?? 0)), de = e - p.c[0], dn = n - p.c[1];
      if (Math.abs(de * c - dn * s) <= p.size[0] / 2 + 0.05 && Math.abs(de * s + dn * c) <= p.size[1] / 2 + 0.05) best = p.y1; }
    return best;
  }
  /** the distance (m) from a world point to the nearest such part (Infinity beyond the fade) */
  dist(x: number, y: number, z: number): number {
    const e = x, n = -z, L = this.cells.get(Math.floor(e / this.C) * 100003 + Math.floor(n / this.C)); if (!L) return Infinity;
    let best = Infinity;
    for (const p of L) {
      const y0 = p.y0, y1 = p.type === 'column' ? p.y0 + p.order.height : p.y1, dy = Math.max(0, y0 - y, y - y1);
      let dp: number;
      if (p.type === 'column') { const r = p.order.baseW / 2; dp = Math.hypot(Math.max(0, Math.abs(e - p.c[0]) - r), Math.max(0, Math.abs(n - p.c[1]) - r)); }
      else if (p.type === 'prism') { const [x0, x1, n0, n1] = bounds(p); dp = Math.hypot(Math.max(0, x0 - e, e - x1), Math.max(0, n0 - n, n - n1)); }
      else { const c = Math.cos(-(p.rot ?? 0)), s = Math.sin(-(p.rot ?? 0)), de = e - p.c[0], dn = n - p.c[1], le = de * c - dn * s, ln = de * s + dn * c;
        dp = Math.hypot(Math.max(0, Math.abs(le) - p.size[0] / 2), Math.max(0, Math.abs(ln) - p.size[1] / 2)); }
      best = Math.min(best, Math.hypot(dp, dy));
    }
    return best;
  }
}
function bounds(p: Part): [number, number, number, number] {
  if (p.type === 'prism') { let x0 = Infinity, x1 = -Infinity, n0 = Infinity, n1 = -Infinity; for (const [x, n] of p.polygon) { x0 = Math.min(x0, x); x1 = Math.max(x1, x); n0 = Math.min(n0, n); n1 = Math.max(n1, n); } return [x0, x1, n0, n1]; }
  if (p.type === 'column') { const r = p.order.baseW / 2; return [p.c[0] - r, p.c[0] + r, p.c[1] - r, p.c[1] + r]; }
  const r = p.rot ?? 0, cs = Math.abs(Math.cos(r)), sn = Math.abs(Math.sin(r)), ex = (cs * p.size[0] + sn * p.size[1]) / 2, ey = (sn * p.size[0] + cs * p.size[1]) / 2;
  return [p.c[0] - ex, p.c[0] + ex, p.c[1] - ey, p.c[1] + ey];
}
const smooth = (a: number, b: number, x: number) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };

/** a non-indexed geometry cut by the global lattice and displaced by the field (every attribute interpolated along the cuts);
 *  `gain` scales the field (the bare courses of the halls under construction: laid brick, less wavy). Returns a new geometry */
export function mudFace(g: THREE.BufferGeometry, hard: HardIndex | null, gain = 1): THREE.BufferGeometry {
  if (g.index) g = g.toNonIndexed();
  const names = Object.keys(g.attributes), A = names.map(k => g.getAttribute(k)), W = A.map(a => a.itemSize), stride = W.reduce((s, w) => s + w, 0);
  const pOff = names.indexOf('position') === 0 ? 0 : W.slice(0, names.indexOf('position')).reduce((s, w) => s + w, 0);
  const nOff = W.slice(0, names.indexOf('normal')).reduce((s, w) => s + w, 0);
  let out = new Float32Array(1 << 16), on = 0; // (a growable float list: the Terrace's mud brick is ~1 M vertices)
  const push = (v: number[]) => { if (on + v.length > out.length) { const b = new Float32Array(out.length * 2); b.set(out); out = b; } out.set(v, on); on += v.length; };
  const vert = (i: number) => { const v: number[] = []; for (let k = 0; k < A.length; k++) for (let c = 0; c < W[k]; c++) v.push(A[k].array[i * W[k] + c] as number); return v; };
  const lerp = (a: number[], b: number[], t: number) => a.map((x, i) => x + (b[i] - x) * t);
  const n = g.getAttribute('position').count;
  for (let t = 0; t < n; t += 3) {
    let polys: number[][][] = [[vert(t), vert(t + 1), vert(t + 2)]];
    for (const ax of [0, 1, 2]) {
      const next: number[][][] = [];
      for (let poly of polys) {
        let lo = Infinity, hi = -Infinity; for (const v of poly) { lo = Math.min(lo, v[pOff + ax]); hi = Math.max(hi, v[pOff + ax]); }
        for (let k = Math.floor(lo / MUD_CELL) + 1; k * MUD_CELL < hi - 1e-6; k++) {
          const P = k * MUD_CELL; if (P <= lo + 1e-6) continue;
          const below: number[][] = [], above: number[][] = [];
          for (let i = 0; i < poly.length; i++) {
            const a = poly[i], b = poly[(i + 1) % poly.length], da = a[pOff + ax] - P, db = b[pOff + ax] - P;
            if (da <= 0) below.push(a); if (da >= 0) above.push(a);
            if ((da < 0 && db > 0) || (da > 0 && db < 0)) { const m = lerp(a, b, da / (da - db)); m[pOff + ax] = P; below.push(m); above.push(m); }
          }
          if (below.length >= 3) next.push(below);
          poly = above; if (poly.length < 3) break;
        }
        if (poly.length >= 3) next.push(poly);
      }
      polys = next;
    }
    for (const poly of polys) for (let i = 1; i + 1 < poly.length; i++) for (const v of [poly[0], poly[i], poly[i + 1]]) push(v);
  }
  // the displacement and its normal (the scalar motion along the face's normal, its gradient over the face)
  const D: [number, number] = [0, 0], e = 0.05, nv = on / stride;
  const disp = (x: number, y: number, z: number, nx: number, nz: number) => {
    const f = (hard ? smooth(MUD_FADE[0], MUD_FADE[1], hard.dist(x, y, z)) : 1) * (hard ? smooth(0, MUD_FOOT, y - hard.floorBelow(x, y, z)) : 1); /* (the foot stays on its floor: the wall feet and the skirting run along it) */ mudField(x, y, z, D); return [D[0] * f * gain, D[1] * f * gain, (D[0] * nx + D[1] * nz) * f * gain];
  };
  for (let i = 0; i < nv; i++) {
    const o = i * stride, x = out[o + pOff], y = out[o + pOff + 1], z = out[o + pOff + 2], nx = out[o + nOff], ny = out[o + nOff + 1], nz = out[o + nOff + 2];
    const [dx, dz, h] = disp(x, y, z, nx, nz);
    // two tangents of the face
    const t1 = Math.abs(ny) < 0.9 ? new THREE.Vector3(-nz, 0, nx).normalize() : new THREE.Vector3(1, 0, 0), N = new THREE.Vector3(nx, ny, nz), t2 = N.clone().cross(t1).normalize();
    const h1 = disp(x + t1.x * e, y + t1.y * e, z + t1.z * e, nx, nz)[2], h2 = disp(x + t2.x * e, y + t2.y * e, z + t2.z * e, nx, nz)[2];
    N.addScaledVector(t1, -(h1 - h) / e).addScaledVector(t2, -(h2 - h) / e).normalize();
    out[o + pOff] = x + dx; out[o + pOff + 2] = z + dz; out[o + nOff] = N.x; out[o + nOff + 1] = N.y; out[o + nOff + 2] = N.z;
  }
  const r = new THREE.BufferGeometry();
  let off = 0;
  names.forEach((k, j) => { const w = W[j], a = new Float32Array(nv * w); for (let i = 0; i < nv; i++) for (let c = 0; c < w; c++) a[i * w + c] = out[i * stride + off + c]; off += w; r.setAttribute(k, new THREE.BufferAttribute(a, w)); });
  r.userData = { ...g.userData };
  return r;
}
