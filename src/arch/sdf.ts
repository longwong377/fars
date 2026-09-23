// Signed-distance modelling kit for the sculpted architecture (D-014): SDF primitives and operators, a compact marching
// cubes (tables from three/addons MarchingCubes, MIT), quadric-error mesh simplification (Garland & Heckbert 1997) and
// crease-aware normals. Pure functions on typed arrays; no renderer dependency, so the offline tool
// (tools/build_sculpt.ts), the tests and the browser share one code path.
import { edgeTable, triTable } from 'three/addons/objects/MarchingCubes.js';

export type SDF = (x: number, y: number, z: number) => number;
export interface RawMesh { pos: Float32Array; idx: Uint32Array }

// ---------------------------------------------------------------- scalar helpers
export const clamp = (v: number, a: number, b: number) => (v < a ? a : v > b ? b : v);
export const mix = (a: number, b: number, t: number) => a + (b - a) * t;
export const smoothstep = (a: number, b: number, v: number) => { const t = clamp((v - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };
/** polynomial smooth minimum (blend radius k) */
export function smin(a: number, b: number, k: number) { if (k <= 0) return a < b ? a : b; const h = Math.max(k - Math.abs(a - b), 0) / k; return Math.min(a, b) - h * h * k * 0.25; }
export const smax = (a: number, b: number, k: number) => -smin(-a, -b, k);

// ---------------------------------------------------------------- primitives (point first, then shape parameters)
export const sdSphere = (x: number, y: number, z: number, r: number) => Math.sqrt(x * x + y * y + z * z) - r;
/** ellipsoid (IQ's bound; exact on the axes) */
export function sdEllipsoid(x: number, y: number, z: number, rx: number, ry: number, rz: number) {
  const k0 = Math.sqrt((x / rx) ** 2 + (y / ry) ** 2 + (z / rz) ** 2), k1 = Math.sqrt((x / (rx * rx)) ** 2 + (y / (ry * ry)) ** 2 + (z / (rz * rz)) ** 2);
  return k1 === 0 ? -Math.min(rx, ry, rz) : (k0 * (k0 - 1)) / k1;
}
export function sdBox(x: number, y: number, z: number, bx: number, by: number, bz: number, r = 0) {
  const qx = Math.abs(x) - bx + r, qy = Math.abs(y) - by + r, qz = Math.abs(z) - bz + r;
  return Math.sqrt(Math.max(qx, 0) ** 2 + Math.max(qy, 0) ** 2 + Math.max(qz, 0) ** 2) + Math.min(Math.max(qx, qy, qz), 0) - r;
}
/** 2D box (half extents), used for extrusions */
export function sdBox2(x: number, y: number, bx: number, by: number) { const qx = Math.abs(x) - bx, qy = Math.abs(y) - by; return Math.hypot(Math.max(qx, 0), Math.max(qy, 0)) + Math.min(Math.max(qx, qy), 0); }
/** capsule between a and b */
export function sdCapsule(x: number, y: number, z: number, ax: number, ay: number, az: number, bx: number, by: number, bz: number, r: number) {
  const px = x - ax, py = y - ay, pz = z - az, dx = bx - ax, dy = by - ay, dz = bz - az;
  const h = clamp((px * dx + py * dy + pz * dz) / (dx * dx + dy * dy + dz * dz), 0, 1);
  return Math.sqrt((px - dx * h) ** 2 + (py - dy * h) ** 2 + (pz - dz * h) ** 2) - r;
}
/** round cone between a (radius r1) and b (radius r2) (IQ) */
export function sdRoundCone(x: number, y: number, z: number, ax: number, ay: number, az: number, bx: number, by: number, bz: number, r1: number, r2: number) {
  const bax = bx - ax, bay = by - ay, baz = bz - az, l2 = bax * bax + bay * bay + baz * baz, rr = r1 - r2, a2 = l2 - rr * rr, il2 = 1 / l2;
  const pax = x - ax, pay = y - ay, paz = z - az, yy = pax * bax + pay * bay + paz * baz, zz = yy - l2;
  const qx = pax * l2 - bax * yy, qy = pay * l2 - bay * yy, qz = paz * l2 - baz * yy, x2 = qx * qx + qy * qy + qz * qz;
  const y2 = yy * yy * l2, z2 = zz * zz * l2, k = Math.sign(rr) * rr * rr * x2;
  if (Math.sign(zz) * a2 * z2 > k) return Math.sqrt(x2 + z2) * il2 - r2;
  if (Math.sign(yy) * a2 * y2 < k) return Math.sqrt(x2 + y2) * il2 - r1;
  return (Math.sqrt(x2 * a2 * il2) + yy * rr) * il2 - r1;
}
/** torus in the xz-plane (major R, minor r) */
export const sdTorus = (x: number, y: number, z: number, R: number, r: number) => Math.hypot(Math.hypot(x, z) - R, y) - r;
/** vertical capped cylinder */
export const sdCylY = (x: number, y: number, z: number, r: number, h0: number, h1: number) => { const dx = Math.hypot(x, z) - r, dy = Math.max(h0 - y, y - h1); return Math.min(Math.max(dx, dy), 0) + Math.hypot(Math.max(dx, 0), Math.max(dy, 0)); };
/** extrusion of a 2D distance d2 through a slab of half-thickness h centred at w = 0 */
export function extrude(d2: number, w: number, h: number) { const qx = d2, qy = Math.abs(w) - h; return Math.min(Math.max(qx, qy), 0) + Math.hypot(Math.max(qx, 0), Math.max(qy, 0)); }

/** distance to an Archimedean spiral band in 2D: r = r0 + pitch·θ/2π for θ ∈ [0, turns·2π], band half-width hw.
 *  dir = +1 counter-clockwise outward, −1 clockwise; phase rotates the start. */
export function sdSpiral2(u: number, v: number, r0: number, pitch: number, turns: number, hw: number, dir = 1, phase = 0) {
  const r = Math.hypot(u, v); let a = Math.atan2(v, u) * dir - phase; a = ((a % (2 * Math.PI)) + 2 * Math.PI) % (2 * Math.PI);
  let best = Infinity;
  const nMax = Math.ceil(turns);
  for (let n = 0; n <= nMax; n++) {
    const th = a + 2 * Math.PI * n; if (th > turns * 2 * Math.PI) break;
    const s = r0 + (pitch * th) / (2 * Math.PI); const d = Math.abs(r - s); if (d < best) best = d;
  }
  // ends: distance to the start and end points (so the band has rounded terminations)
  const e0x = r0 * Math.cos(phase * dir), e0y = r0 * Math.sin(phase * dir);
  const thE = turns * 2 * Math.PI, rE = r0 + pitch * turns, aE = (thE + phase) * dir;
  const d0 = Math.hypot(u - e0x, v - e0y), d1 = Math.hypot(u - rE * Math.cos(aE), v - rE * Math.sin(aE));
  return Math.min(best, d0, d1) - hw;
}

// ---------------------------------------------------------------- bounded shapes: fast unions with early-out
/** an SDF with a bounding sphere (centre c, radius R: f ≥ |p − c| − R everywhere) */
export interface Shape { f: SDF; c: [number, number, number]; R: number }
export const shape = (f: SDF, c: [number, number, number], R: number): Shape => ({ f, c, R });
/** smooth union of bounded shapes, skipping those whose bound is farther than the current value + k */
export function unionOf(shapes: Shape[], k: number): SDF {
  return (x, y, z) => {
    let d = 1e9;
    for (const s of shapes) {
      const lb = Math.sqrt((x - s.c[0]) ** 2 + (y - s.c[1]) ** 2 + (z - s.c[2]) ** 2) - s.R;
      if (lb > d + k) continue;
      d = smin(d, s.f(x, y, z), k);
    }
    return d;
  };
}

// ---------------------------------------------------------------- marching cubes
// corner offsets (Bourke numbering as used by three's MarchingCubes: x = +1, y = +row, z = +slice)
const CORNER = [[0, 0, 0], [1, 0, 0], [1, 1, 0], [0, 1, 0], [0, 0, 1], [1, 0, 1], [1, 1, 1], [0, 1, 1]];
// edge → [corner a, corner b, axis of the edge (0 x, 1 y, 2 z)]; the grid edge is keyed by its lower corner + axis
const EDGE: [number, number, number][] = [[0, 1, 0], [1, 2, 1], [3, 2, 0], [0, 3, 1], [4, 5, 0], [5, 6, 1], [7, 6, 0], [4, 7, 1], [0, 4, 2], [1, 5, 2], [2, 6, 2], [3, 7, 2]];

/** Polygonise the zero set of f (negative inside) over [min, max] at cell size h. Vertices are shared between cells
 *  (keyed by grid edge), triangles wound counter-clockwise seen from outside. Empty 8³ blocks are skipped when the
 *  SDF at the block centre proves no surface can pass within one cell of it (safety factor `lip` for non-exact SDFs). */
export function marchingCubes(f: SDF, min: [number, number, number], max: [number, number, number], h: number, lip = 1.6): RawMesh {
  const nx = Math.ceil((max[0] - min[0]) / h) + 1, ny = Math.ceil((max[1] - min[1]) / h) + 1, nz = Math.ceil((max[2] - min[2]) / h) + 1;
  const sy = nx, sz = nx * ny, N = nx * ny * nz;
  const field = new Float32Array(N);
  const B = 8, half = (B * h * Math.sqrt(3)) / 2;
  for (let bk = 0; bk < nz; bk += B) for (let bj = 0; bj < ny; bj += B) for (let bi = 0; bi < nx; bi += B) {
    const i1 = Math.min(bi + B, nx), j1 = Math.min(bj + B, ny), k1 = Math.min(bk + B, nz);
    const cx = min[0] + ((bi + i1 - 1) / 2) * h, cy = min[1] + ((bj + j1 - 1) / 2) * h, cz = min[2] + ((bk + k1 - 1) / 2) * h;
    const dc = f(cx, cy, cz);
    if (Math.abs(dc) > (half + 2 * h) * lip) { // no surface within this block (+ one cell): fill with the sign only
      const fill = dc > 0 ? h * 4 : -h * 4;
      for (let k = bk; k < k1; k++) for (let j = bj; j < j1; j++) field.fill(fill, k * sz + j * sy + bi, k * sz + j * sy + i1);
      continue;
    }
    for (let k = bk; k < k1; k++) for (let j = bj; j < j1; j++) for (let i = bi; i < i1; i++) field[k * sz + j * sy + i] = f(min[0] + i * h, min[1] + j * h, min[2] + k * h);
  }
  // the domain boundary is forced outside so every surface is closed
  for (let k = 0; k < nz; k++) for (let j = 0; j < ny; j++) for (let i = 0; i < nx; i++) {
    if (i === 0 || j === 0 || k === 0 || i === nx - 1 || j === ny - 1 || k === nz - 1) { const q = k * sz + j * sy + i; if (field[q] <= 0) field[q] = h * 0.5; }
  }
  const vmap = new Map<number, number>();
  const pos: number[] = [], tri: number[] = [];
  const cornerOff = CORNER.map(([a, b, c]) => a + b * sy + c * sz);
  const ev = new Int32Array(12);
  for (let k = 0; k < nz - 1; k++) for (let j = 0; j < ny - 1; j++) for (let i = 0; i < nx - 1; i++) {
    const q = k * sz + j * sy + i;
    let ci = 0;
    for (let c = 0; c < 8; c++) if (field[q + cornerOff[c]] < 0) ci |= 1 << c;
    const bits = edgeTable[ci]; if (!bits) continue;
    for (let e = 0; e < 12; e++) {
      if (!(bits & (1 << e))) continue;
      const [ca, cb, ax] = EDGE[e];
      const qa = q + cornerOff[ca], key = qa * 3 + ax;
      let id = vmap.get(key);
      if (id === undefined) {
        const va = field[qa], vb = field[q + cornerOff[cb]], t = va / (va - vb);
        const [ox, oy, oz] = CORNER[ca];
        const px = min[0] + (i + ox) * h, py = min[1] + (j + oy) * h, pz = min[2] + (k + oz) * h;
        id = pos.length / 3; pos.push(px + (ax === 0 ? t * h : 0), py + (ax === 1 ? t * h : 0), pz + (ax === 2 ? t * h : 0)); vmap.set(key, id);
      }
      ev[e] = id;
    }
    const o = ci * 16;
    for (let t = 0; triTable[o + t] !== -1; t += 3) { const a = ev[triTable[o + t]], b = ev[triTable[o + t + 1]], c = ev[triTable[o + t + 2]]; if (a !== b && b !== c && a !== c) tri.push(a, b, c); }
  }
  const out: RawMesh = { pos: new Float32Array(pos), idx: new Uint32Array(tri) };
  orientOutward(out, f, h);
  return out;
}
/** flip every triangle if the table's winding points into the solid (decided by the SDF gradient on a sample) */
function orientOutward(m: RawMesh, f: SDF, h: number) {
  let vote = 0; const P = m.pos, I = m.idx, step = Math.max(3, Math.floor(I.length / 3 / 200) * 3);
  for (let t = 0; t < I.length; t += step) {
    const a = I[t] * 3, b = I[t + 1] * 3, c = I[t + 2] * 3;
    const ux = P[b] - P[a], uy = P[b + 1] - P[a + 1], uz = P[b + 2] - P[a + 2], vx = P[c] - P[a], vy = P[c + 1] - P[a + 1], vz = P[c + 2] - P[a + 2];
    const nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx;
    const cx = (P[a] + P[b] + P[c]) / 3, cy = (P[a + 1] + P[b + 1] + P[c + 1]) / 3, cz = (P[a + 2] + P[b + 2] + P[c + 2]) / 3, e = h * 0.25;
    const gx = f(cx + e, cy, cz) - f(cx - e, cy, cz), gy = f(cx, cy + e, cz) - f(cx, cy - e, cz), gz = f(cx, cy, cz + e) - f(cx, cy, cz - e);
    vote += Math.sign(nx * gx + ny * gy + nz * gz);
  }
  if (vote < 0) for (let t = 0; t < I.length; t += 3) { const s = I[t + 1]; I[t + 1] = I[t + 2]; I[t + 2] = s; }
}

// ---------------------------------------------------------------- quadric error simplification
export const SIMPLIFY_STATS = { link: 0, quality: 0, flip: 0, sliver: 0, sliverFail: 0 };
/** Edge-collapse simplification to about `targetTris` triangles. Rejects collapses that flip or degrade a face or
 *  break the link condition, so a closed 2-manifold input stays closed and manifold. */
export function simplify(m: RawMesh, targetTris: number): RawMesh {
  const nV = m.pos.length / 3, nF = m.idx.length / 3;
  if (nF <= targetTris) return m;
  const P = Float64Array.from(m.pos), F = Int32Array.from(m.idx), fAlive = new Uint8Array(nF).fill(1);
  const Q = new Float64Array(nV * 10);
  const vFaces: number[][] = Array.from({ length: nV }, () => []);
  for (let f = 0; f < nF; f++) {
    const a = F[f * 3], b = F[f * 3 + 1], c = F[f * 3 + 2];
    vFaces[a].push(f); vFaces[b].push(f); vFaces[c].push(f);
    const ux = P[b * 3] - P[a * 3], uy = P[b * 3 + 1] - P[a * 3 + 1], uz = P[b * 3 + 2] - P[a * 3 + 2], vx = P[c * 3] - P[a * 3], vy = P[c * 3 + 1] - P[a * 3 + 1], vz = P[c * 3 + 2] - P[a * 3 + 2];
    let nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx; const l = Math.hypot(nx, ny, nz); if (l < 1e-20) continue;
    const area = l / 2; nx /= l; ny /= l; nz /= l; const d = -(nx * P[a * 3] + ny * P[a * 3 + 1] + nz * P[a * 3 + 2]);
    const q = [nx * nx, nx * ny, nx * nz, nx * d, ny * ny, ny * nz, ny * d, nz * nz, nz * d, d * d];
    for (const v of [a, b, c]) for (let i = 0; i < 10; i++) Q[v * 10 + i] += q[i] * area;
  }
  const vAlive = new Uint8Array(nV).fill(1), vVer = new Int32Array(nV);
  // heap of candidate collapses (append-only entry arrays; stale entries are skipped by version stamps)
  let cap = 1 << 20, n = 0, hn = 0;
  let eCost = new Float64Array(cap), eA = new Int32Array(cap), eB = new Int32Array(cap), eVA = new Int32Array(cap), eVB = new Int32Array(cap), heap = new Int32Array(cap);
  const grow = () => { cap *= 2; const g = <T extends Float64Array | Int32Array>(x: T): T => { const y = new (x.constructor as any)(cap); y.set(x); return y; }; eCost = g(eCost); eA = g(eA); eB = g(eB); eVA = g(eVA); eVB = g(eVB); heap = g(heap); };
  const less = (i: number, j: number) => eCost[heap[i]] < eCost[heap[j]];
  const push = (id: number) => { let i = hn++; heap[i] = id; while (i > 0) { const p = (i - 1) >> 1; if (!less(i, p)) break; const t = heap[i]; heap[i] = heap[p]; heap[p] = t; i = p; } };
  const pop = () => { const top = heap[0]; heap[0] = heap[--hn]; let i = 0; for (;;) { const l = 2 * i + 1, r = l + 1; let s = i; if (l < hn && less(l, s)) s = l; if (r < hn && less(r, s)) s = r; if (s === i) break; const t = heap[i]; heap[i] = heap[s]; heap[s] = t; i = s; } return top; };
  // candidate placements for collapsing edge (a, b), sorted by quadric error: the optimum (when well conditioned and
  // near the edge), the midpoint and both end points
  const cands: { x: number; y: number; z: number; e: number }[] = [];
  const candidates = (a: number, b: number) => {
    const q = Q.subarray(a * 10, a * 10 + 10), s = Q.subarray(b * 10, b * 10 + 10);
    const a11 = q[0] + s[0], a12 = q[1] + s[1], a13 = q[2] + s[2], a14 = q[3] + s[3], a22 = q[4] + s[4], a23 = q[5] + s[5], a24 = q[6] + s[6], a33 = q[7] + s[7], a34 = q[8] + s[8], a44 = q[9] + s[9];
    const err = (x: number, y: number, z: number) => Math.max(0, a11 * x * x + 2 * a12 * x * y + 2 * a13 * x * z + 2 * a14 * x + a22 * y * y + 2 * a23 * y * z + 2 * a24 * y + a33 * z * z + 2 * a34 * z + a44);
    const det = a11 * (a22 * a33 - a23 * a23) - a12 * (a12 * a33 - a23 * a13) + a13 * (a12 * a23 - a22 * a13);
    const ax = P[a * 3], ay = P[a * 3 + 1], az = P[a * 3 + 2], bx = P[b * 3], by = P[b * 3 + 1], bz = P[b * 3 + 2];
    const L = Math.hypot(bx - ax, by - ay, bz - az);
    cands.length = 0;
    if (Math.abs(det) > 1e-12 * Math.max(1, Math.abs(a11 * a22 * a33))) {
      const x = -(a14 * (a22 * a33 - a23 * a23) - a12 * (a24 * a33 - a23 * a34) + a13 * (a24 * a23 - a22 * a34)) / det;
      const y = -(a11 * (a24 * a33 - a34 * a23) - a14 * (a12 * a33 - a23 * a13) + a13 * (a12 * a34 - a24 * a13)) / det;
      const z = -(a11 * (a22 * a34 - a23 * a24) - a12 * (a12 * a34 - a24 * a13) + a14 * (a12 * a23 - a22 * a13)) / det;
      if (Math.hypot(x - (ax + bx) / 2, y - (ay + by) / 2, z - (az + bz) / 2) < L) cands.push({ x, y, z, e: err(x, y, z) });
    }
    for (const t of [0.5, 0, 1]) { const x = ax + (bx - ax) * t, y = ay + (by - ay) * t, z = az + (bz - az) * t; cands.push({ x, y, z, e: err(x, y, z) }); }
    cands.sort((p, q2) => p.e - q2.e);
    return cands[0].e + L * L * 1e-9; // tiny length term breaks ties toward short edges
  };
  const cost = candidates;
  const addEdge = (a: number, b: number) => { if (n >= cap) grow(); eCost[n] = cost(a, b); eA[n] = a; eB[n] = b; eVA[n] = vVer[a]; eVB[n] = vVer[b]; push(n); n++; };
  const neighbours = (v: number, out: Set<number>) => { out.clear(); for (const f of vFaces[v]) if (fAlive[f]) for (let k = 0; k < 3; k++) { const w = F[f * 3 + k]; if (w !== v) out.add(w); } return out; };
  const nbA = new Set<number>(), nbB = new Set<number>();
  for (let f = 0; f < nF; f++) for (let k = 0; k < 3; k++) { const a = F[f * 3 + k], b = F[f * 3 + ((k + 1) % 3)]; if (a < b) addEdge(a, b); else if (!hasFaceWith(b, a, f)) addEdge(b, a); }
  function hasFaceWith(a: number, b: number, notF: number) { // does another live face contain the directed pair as an edge (so the edge was/will be added from there)?
    for (const g of vFaces[a]) if (g !== notF) { const i0 = F[g * 3], i1 = F[g * 3 + 1], i2 = F[g * 3 + 2]; if ((i0 === a && i1 === b) || (i1 === a && i2 === b) || (i2 === a && i0 === b)) return true; }
    return false;
  }
  let live = nF;
  const faceOk = (f: number, moved: number, x: number, y: number, z: number) => {
    const ids = [F[f * 3], F[f * 3 + 1], F[f * 3 + 2]];
    const p = ids.map(v => v === moved ? [x, y, z] : [P[v * 3], P[v * 3 + 1], P[v * 3 + 2]]);
    const o = ids.map(v => [P[v * 3], P[v * 3 + 1], P[v * 3 + 2]]);
    const nrm = (q: number[][]) => { const ux = q[1][0] - q[0][0], uy = q[1][1] - q[0][1], uz = q[1][2] - q[0][2], vx = q[2][0] - q[0][0], vy = q[2][1] - q[0][1], vz = q[2][2] - q[0][2]; return [uy * vz - uz * vy, uz * vx - ux * vz, ux * vy - uy * vx]; };
    const n0 = nrm(o), n1 = nrm(p), l0 = Math.hypot(...n0), l1 = Math.hypot(...n1);
    const e2 = (q: number[][]) => (q[0][0] - q[1][0]) ** 2 + (q[0][1] - q[1][1]) ** 2 + (q[0][2] - q[1][2]) ** 2 + (q[1][0] - q[2][0]) ** 2 + (q[1][1] - q[2][1]) ** 2 + (q[1][2] - q[2][2]) ** 2 + (q[2][0] - q[0][0]) ** 2 + (q[2][1] - q[0][1]) ** 2 + (q[2][2] - q[0][2]) ** 2;
    const quality = (2 * Math.sqrt(3) * l1) / Math.max(e2(p), 1e-30), q0 = (2 * Math.sqrt(3) * l0) / Math.max(e2(o), 1e-30); // 1 = equilateral
    // never create a needle or make one clearly worse (the sliver clean-up may: it removes them in later rounds)
    if (!cleaning && quality < 0.02 && quality < q0 * 0.9) { SIMPLIFY_STATS.quality++; return false; }
    // normal turns > 60°: a fold (a needle's normal is numerically meaningless, so needles are exempt)
    if (q0 > 0.01 && (n0[0] * n1[0] + n0[1] * n1[1] + n0[2] * n1[2]) / (l0 * l1) < 0.5) { SIMPLIFY_STATS.flip++; return false; }
    return true;
  };
  /** collapse edge (a, b) at the best acceptable placement (quadric candidates, or midpoint/end points); false if every
   *  placement breaks the link condition, flips a face or creates a needle */
  let cleaning = false;
  const tryCollapse = (a: number, b: number, quadric: boolean): boolean => {
    if (a === b || !vAlive[a] || !vAlive[b]) return false;
    neighbours(a, nbA); neighbours(b, nbB);
    let common = 0; for (const w of nbA) if (nbB.has(w)) common++;
    if (common !== 2) { SIMPLIFY_STATS.link++; return false; } // link condition (closed manifold edge: exactly two opposite vertices)
    if (quadric) candidates(a, b);
    else { cands.length = 0; for (const t of [0.5, 0, 1]) cands.push({ x: P[a * 3] + (P[b * 3] - P[a * 3]) * t, y: P[a * 3 + 1] + (P[b * 3 + 1] - P[a * 3 + 1]) * t, z: P[a * 3 + 2] + (P[b * 3 + 2] - P[a * 3 + 2]) * t, e: 0 }); }
    let pick = -1;
    for (let ci = 0; ci < cands.length && pick < 0; ci++) {
      const { x, y, z } = cands[ci]; let ok = true;
      for (const f of vFaces[a]) { if (!fAlive[f]) continue; const i0 = F[f * 3], i1 = F[f * 3 + 1], i2 = F[f * 3 + 2]; if (i0 === b || i1 === b || i2 === b) continue; if (!faceOk(f, a, x, y, z)) { ok = false; break; } }
      if (ok) for (const f of vFaces[b]) { if (!fAlive[f]) continue; const i0 = F[f * 3], i1 = F[f * 3 + 1], i2 = F[f * 3 + 2]; if (i0 === a || i1 === a || i2 === a) continue; if (!faceOk(f, b, x, y, z)) { ok = false; break; } }
      if (ok) pick = ci;
    }
    if (pick < 0) return false;
    const { x, y, z } = cands[pick];
    // collapse b → a
    P[a * 3] = x; P[a * 3 + 1] = y; P[a * 3 + 2] = z; for (let i = 0; i < 10; i++) Q[a * 10 + i] += Q[b * 10 + i];
    for (const f of vFaces[b]) {
      if (!fAlive[f]) continue;
      if (F[f * 3] === a || F[f * 3 + 1] === a || F[f * 3 + 2] === a) { fAlive[f] = 0; live--; continue; }
      for (let k = 0; k < 3; k++) if (F[f * 3 + k] === b) F[f * 3 + k] = a;
      vFaces[a].push(f);
    }
    vFaces[a] = vFaces[a].filter(f => fAlive[f]); vFaces[b] = []; vAlive[b] = 0; vVer[a]++;
    for (const w of neighbours(a, nbA)) addEdge(a, w);
    return true;
  };
  const deferred: [number, number][] = [];
  for (let pass = 0; pass < 8 && live > targetTris; pass++) {
    let collapsed = 0;
    while (live > targetTris && hn > 0) {
      const e = pop(); const a = eA[e], b = eB[e];
      if (!vAlive[a] || !vAlive[b] || eVA[e] !== vVer[a] || eVB[e] !== vVer[b]) continue;
      if (tryCollapse(a, b, true)) collapsed++; else deferred.push([a, b]);
    }
    if (!collapsed) break;
    // rejected edges get another chance once their neighbourhood has changed
    for (const [a, b] of deferred.splice(0)) if (vAlive[a] && vAlive[b]) addEdge(a, b);
  }
  // sliver clean-up: marching cubes leaves near-zero-area triangles the cost order never reaches; collapse their
  // shortest edge (the mesh stays closed and manifold)
  const len2 = (a: number, b: number) => (P[a * 3] - P[b * 3]) ** 2 + (P[a * 3 + 1] - P[b * 3 + 1]) ** 2 + (P[a * 3 + 2] - P[b * 3 + 2]) ** 2;
  const triN = (a: number, b: number, c: number) => { const ux = P[b * 3] - P[a * 3], uy = P[b * 3 + 1] - P[a * 3 + 1], uz = P[b * 3 + 2] - P[a * 3 + 2], vx = P[c * 3] - P[a * 3], vy = P[c * 3 + 1] - P[a * 3 + 1], vz = P[c * 3 + 2] - P[a * 3 + 2]; return [uy * vz - uz * vy, uz * vx - ux * vz, ux * vy - uy * vx]; };
  const triQ = (a: number, b: number, c: number) => (2 * Math.sqrt(3) * Math.hypot(...triN(a, b, c))) / Math.max(len2(a, b) + len2(b, c) + len2(c, a), 1e-30);
  /** flip the edge (p, r) of face f with the face across it, if that improves the worse of the two triangles */
  const flipEdge = (f: number, p: number, r: number): boolean => {
    const rot = (g: number, v: number) => { const i = [0, 1, 2].find(k => F[g * 3 + k] === v)!; return [F[g * 3 + i], F[g * 3 + ((i + 1) % 3)], F[g * 3 + ((i + 2) % 3)]]; };
    let [a, b, c] = rot(f, p); if (b !== r) { [a, b, c] = rot(f, r); if (b !== p) return false; } // f = (a, b, c) with edge a→b
    const g = vFaces[b].find(h => h !== f && fAlive[h] && rot(h, b)[1] === a); if (g === undefined) return false;
    const d = rot(g, b)[2]; // g = (b, a, d)
    if (c === d || neighbours(c, nbA).has(d)) return false; // the new diagonal must not exist already
    const n1 = triN(a, d, c), n2 = triN(d, b, c), o1 = triN(a, b, c), o2 = triN(b, a, d), nsum = [o1[0] + o2[0], o1[1] + o2[1], o1[2] + o2[2]];
    if (n1[0] * nsum[0] + n1[1] * nsum[1] + n1[2] * nsum[2] <= 0 || n2[0] * nsum[0] + n2[1] * nsum[1] + n2[2] * nsum[2] <= 0) return false; // would fold
    if (Math.min(triQ(a, d, c), triQ(d, b, c)) <= Math.min(triQ(a, b, c), triQ(b, a, d))) return false;
    F.set([a, d, c], f * 3); F.set([d, b, c], g * 3);
    vFaces[a] = vFaces[a].filter(h => h !== g); vFaces[b] = vFaces[b].filter(h => h !== f); vFaces[c].push(g); vFaces[d].push(f);
    vVer[a]++; vVer[b]++; vVer[c]++; vVer[d]++;
    return true;
  };
  let bx0 = Infinity, bx1 = -Infinity; for (let i = 0; i < P.length; i++) { bx0 = Math.min(bx0, P[i]); bx1 = Math.max(bx1, P[i]); }
  const tiny2 = ((bx1 - bx0) * 1e-4) ** 2; // edges this short would vanish in 16-bit quantisation
  for (let round = 0; round < 6; round++) {
    let fixed = 0;
    for (let f = 0; f < nF; f++) {
      if (!fAlive[f]) continue;
      const a = F[f * 3], b = F[f * 3 + 1], c = F[f * 3 + 2];
      const ux = P[b * 3] - P[a * 3], uy = P[b * 3 + 1] - P[a * 3 + 1], uz = P[b * 3 + 2] - P[a * 3 + 2], vx = P[c * 3] - P[a * 3], vy = P[c * 3 + 1] - P[a * 3 + 1], vz = P[c * 3 + 2] - P[a * 3 + 2];
      const q = (2 * Math.sqrt(3) * Math.hypot(uy * vz - uz * vy, uz * vx - ux * vz, ux * vy - uy * vx)) / Math.max(len2(a, b) + len2(b, c) + len2(c, a), 1e-30);
      const edges = [[a, b], [b, c], [c, a]].sort((p, r) => len2(p[0], p[1]) - len2(r[0], r[1]));
      if (q >= 0.05 && len2(edges[0][0], edges[0][1]) > tiny2) continue;
      SIMPLIFY_STATS.sliver++;
      let done = false; cleaning = true;
      for (const [p, r] of edges) if (tryCollapse(p, r, false)) { fixed++; done = true; break; }
      cleaning = false;
      if (!done && flipEdge(f, edges[2][0], edges[2][1])) { fixed++; done = true; } // a cap: flip its longest edge
      if (!done) SIMPLIFY_STATS.sliverFail++;
    }
    if (!fixed) break;
  }
  // compact
  const remap = new Int32Array(nV).fill(-1); const pos: number[] = [], idx: number[] = [];
  for (let f = 0; f < nF; f++) {
    if (!fAlive[f]) continue;
    for (let k = 0; k < 3; k++) { const v = F[f * 3 + k]; if (remap[v] < 0) { remap[v] = pos.length / 3; pos.push(P[v * 3], P[v * 3 + 1], P[v * 3 + 2]); } idx.push(remap[v]); }
  }
  return { pos: new Float32Array(pos), idx: new Uint32Array(idx) };
}

// ---------------------------------------------------------------- normals with creases, welding, merging
export interface NormMesh { pos: Float32Array; nrm: Float32Array; idx: Uint32Array }
/** per-corner normals: area-weighted average of the faces around the vertex whose normal lies within `creaseDeg`
 *  of the corner's own face; corners with equal position and normal are welded. Degenerate faces are dropped. */
export function creaseNormals(m: RawMesh, creaseDeg: number): NormMesh {
  const P = m.pos, I = m.idx, nF = I.length / 3, nV = P.length / 3, cosT = Math.cos((creaseDeg * Math.PI) / 180);
  const fn = new Float64Array(nF * 3), fu = new Float64Array(nF * 3), keep = new Uint8Array(nF);
  for (let f = 0; f < nF; f++) {
    const a = I[f * 3] * 3, b = I[f * 3 + 1] * 3, c = I[f * 3 + 2] * 3;
    const ux = P[b] - P[a], uy = P[b + 1] - P[a + 1], uz = P[b + 2] - P[a + 2], vx = P[c] - P[a], vy = P[c + 1] - P[a + 1], vz = P[c + 2] - P[a + 2];
    const nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx, l = Math.hypot(nx, ny, nz);
    if (l < 1e-12) continue; keep[f] = 1;
    fn[f * 3] = nx; fn[f * 3 + 1] = ny; fn[f * 3 + 2] = nz; fu[f * 3] = nx / l; fu[f * 3 + 1] = ny / l; fu[f * 3 + 2] = nz / l;
  }
  // vertex → faces (CSR)
  const cnt = new Int32Array(nV + 1); for (let f = 0; f < nF; f++) if (keep[f]) for (let k = 0; k < 3; k++) cnt[I[f * 3 + k] + 1]++;
  for (let v = 0; v < nV; v++) cnt[v + 1] += cnt[v];
  const vf = new Int32Array(cnt[nV]), fill = cnt.slice(0, nV);
  for (let f = 0; f < nF; f++) if (keep[f]) for (let k = 0; k < 3; k++) vf[fill[I[f * 3 + k]]++] = f;
  const outP: number[] = [], outN: number[] = [], outI: number[] = [];
  const head = new Int32Array(nV).fill(-1), next: number[] = []; // per input vertex: linked list of its output copies
  for (let f = 0; f < nF; f++) {
    if (!keep[f]) continue;
    for (let k = 0; k < 3; k++) {
      const v = I[f * 3 + k]; let nx = 0, ny = 0, nz = 0;
      for (let q = cnt[v]; q < cnt[v + 1]; q++) { const g = vf[q]; if (fu[f * 3] * fu[g * 3] + fu[f * 3 + 1] * fu[g * 3 + 1] + fu[f * 3 + 2] * fu[g * 3 + 2] >= cosT) { nx += fn[g * 3]; ny += fn[g * 3 + 1]; nz += fn[g * 3 + 2]; } }
      const l = Math.hypot(nx, ny, nz) || 1; nx /= l; ny /= l; nz /= l;
      let id = head[v];
      while (id >= 0 && Math.abs(outN[id * 3] - nx) + Math.abs(outN[id * 3 + 1] - ny) + Math.abs(outN[id * 3 + 2] - nz) > 1e-3) id = next[id];
      if (id < 0) { id = outP.length / 3; outP.push(P[v * 3], P[v * 3 + 1], P[v * 3 + 2]); outN.push(nx, ny, nz); next.push(head[v]); head[v] = id; }
      outI.push(id);
    }
  }
  return { pos: new Float32Array(outP), nrm: new Float32Array(outN), idx: new Uint32Array(outI) };
}
/** weld coincident positions (tolerance tol) so separately generated strips share vertices before creaseNormals */
export function weldPositions(m: RawMesh, tol = 1e-5): RawMesh {
  const map = new Map<string, number>(), remap = new Uint32Array(m.pos.length / 3), pos: number[] = [];
  for (let v = 0; v < m.pos.length / 3; v++) {
    const key = `${Math.round(m.pos[v * 3] / tol)}|${Math.round(m.pos[v * 3 + 1] / tol)}|${Math.round(m.pos[v * 3 + 2] / tol)}`;
    let id = map.get(key); if (id === undefined) { id = pos.length / 3; pos.push(m.pos[v * 3], m.pos[v * 3 + 1], m.pos[v * 3 + 2]); map.set(key, id); }
    remap[v] = id;
  }
  const idx: number[] = [];
  for (let t = 0; t < m.idx.length; t += 3) { const a = remap[m.idx[t]], b = remap[m.idx[t + 1]], c = remap[m.idx[t + 2]]; if (a !== b && b !== c && a !== c) idx.push(a, b, c); }
  return { pos: new Float32Array(pos), idx: new Uint32Array(idx) };
}
export function mergeRaw(ms: RawMesh[]): RawMesh {
  let nv = 0, ni = 0; for (const m of ms) { nv += m.pos.length; ni += m.idx.length; }
  const pos = new Float32Array(nv), idx = new Uint32Array(ni); let ov = 0, oi = 0;
  for (const m of ms) { pos.set(m.pos, ov); for (let i = 0; i < m.idx.length; i++) idx[oi + i] = m.idx[i] + ov / 3; ov += m.pos.length; oi += m.idx.length; }
  return { pos, idx };
}
export function mergeNorm(ms: NormMesh[]): NormMesh {
  let nv = 0, ni = 0; for (const m of ms) { nv += m.pos.length; ni += m.idx.length; }
  const pos = new Float32Array(nv), nrm = new Float32Array(nv), idx = new Uint32Array(ni); let ov = 0, oi = 0;
  for (const m of ms) { pos.set(m.pos, ov); nrm.set(m.nrm, ov); for (let i = 0; i < m.idx.length; i++) idx[oi + i] = m.idx[i] + ov / 3; ov += m.pos.length; oi += m.idx.length; }
  return { pos, nrm, idx };
}
/** affine transform (3×4 row-major [m00 m01 m02 tx, m10 …]); normals by the inverse transpose; winding flipped when det < 0 */
export function transformNorm(m: NormMesh, M: number[]): NormMesh {
  const pos = new Float32Array(m.pos.length), nrm = new Float32Array(m.nrm.length);
  const [a, b, c, tx, d, e, f, ty, g, h, i, tz] = M;
  const det = a * (e * i - f * h) - b * (d * i - f * g) + c * (d * h - e * g);
  // inverse transpose (cofactor matrix / det)
  const n00 = (e * i - f * h) / det, n01 = -(d * i - f * g) / det, n02 = (d * h - e * g) / det;
  const n10 = -(b * i - c * h) / det, n11 = (a * i - c * g) / det, n12 = -(a * h - b * g) / det;
  const n20 = (b * f - c * e) / det, n21 = -(a * f - c * d) / det, n22 = (a * e - b * d) / det;
  for (let v = 0; v < m.pos.length; v += 3) {
    const x = m.pos[v], y = m.pos[v + 1], z = m.pos[v + 2];
    pos[v] = a * x + b * y + c * z + tx; pos[v + 1] = d * x + e * y + f * z + ty; pos[v + 2] = g * x + h * y + i * z + tz;
    const nx = m.nrm[v], ny = m.nrm[v + 1], nz = m.nrm[v + 2];
    const X = n00 * nx + n01 * ny + n02 * nz, Y = n10 * nx + n11 * ny + n12 * nz, Z = n20 * nx + n21 * ny + n22 * nz, l = Math.hypot(X, Y, Z) || 1;
    nrm[v] = X / l; nrm[v + 1] = Y / l; nrm[v + 2] = Z / l;
  }
  const idx = Uint32Array.from(m.idx);
  if (det < 0) for (let t = 0; t < idx.length; t += 3) { const s = idx[t + 1]; idx[t + 1] = idx[t + 2]; idx[t + 2] = s; }
  return { pos, nrm, idx };
}
