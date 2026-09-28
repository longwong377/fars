// D-300 (Q-600): the Terrace's polygonal foot as geometry. SITE_SPEC terrace.r_masonry.foot (D-232, photograph #24 rectified)
// places a zone of large irregular blocks and dressed bedrock along the W- and S-facing retaining walls, 4.9 m high above the
// plain where present, its joints a row-jittered Voronoi of 4.6 × 1.8 m cells; until now it was drawn on the wall plane only.
// In #24 the foot's blocks stand proud of the coursed wall above (shadow lines at their tops, ~0.3-1 m in steps: Q-600). Here
// every foot cell of that same Voronoi (the shader's own cells: materials.ts retainingCells, masonry.ts retainingAt) is a block
// proud of the wall plane by its own depth, its face tilted by up to the spec's ±1.5°, its arris chamfered; the coursed ashlar
// above stays in the wall plane. Depths 0.3-0.8 m (C, Q-600's reading of #24; no section read: Schmidt 1953 NOT SEEN, B6).
// The shader's joints fall on the blocks' edges because the blocks' faces carry the same (t, y) cells.
import * as THREE from 'three/webgpu';
import type { Part, Pt } from './parts';
import { MASONRY, hash12 } from '../render/masonry';
import { mxNoise3 } from '../render/mx_noise_cpu';
import { ADIST_OFF } from '../render/blockface';
import { edgeSeed, aseedOf, type ArrisEdge } from './arris';

export interface FootBlock { poly: [number, number][]; depth: number; tilt: [number, number]; edge: number }
export interface FootEdge { a: Pt; b: Pt; n: [number, number]; t0: number; t1: number }
/** proud depth (m) of each foot block: 0.3-0.8 m (C, Q-600) */
export const FOOT_DEPTH: [number, number] = [0.3, 0.8];
const CHAMFER = 0.035; // the arris rounded off (m; the spec's foot lip 2 cm, drawn a little broader as geometry)

/** the foot's top above the plain at world (x, z) of a face with world normal (nx, nz): the shader's mask × height (0 off the
 *  W- and S-facing faces and inside the Grand Stair's recess) */
export function footTop(x: number, z: number, nx: number, nz: number, M = MASONRY): number {
  const F = M.foot, SB = M.stair.box;
  const inStair = x >= SB[0] && x <= SB[1] && z >= -SB[3] && z <= -SB[2];
  const faceWS = -nx >= 0.5 || nz >= 0.5;
  if (inStair || !faceWS) return 0;
  const v = mxNoise3(x / F.lambda + F.offset[0], 0.5, z / F.lambda + F.offset[1]), q = Math.min(1, Math.max(0, (v - (F.theta - F.w)) / (2 * F.w)));
  return q * q * (3 - 2 * q) * F.height;
}
/** the Voronoi seed of cell (cx, cy) in cell units (masonry.ts retainingAt seedOf) */
function seedOf(cx: number, cy: number, F = MASONRY.foot): [number, number] {
  return [cx + 0.5 + (hash12(cx + 0.13, cy + 9.1) - 0.5) * 2 * F.jitter[0], cy + 0.5 + (hash12(cy + 4.7, cx + 0.37) - 0.5) * 2 * F.jitter[1]];
}
/** clip a convex polygon by the half-plane a·p <= c */
function clip(poly: [number, number][], ax: number, ay: number, c: number): [number, number][] {
  const out: [number, number][] = [];
  for (let i = 0; i < poly.length; i++) {
    const p = poly[i], q = poly[(i + 1) % poly.length], dp = ax * p[0] + ay * p[1] - c, dq = ax * q[0] + ay * q[1] - c;
    if (dp <= 0) out.push(p);
    if ((dp < 0 && dq > 0) || (dp > 0 && dq < 0)) { const s = dp / (dp - dq); out.push([p[0] + (q[0] - p[0]) * s, p[1] + (q[1] - p[1]) * s]); }
  }
  return out;
}
/** the W- and S-facing edges of the Terrace platform's outline (world normals; t along the face as the shader's t = x·nz − z·nx) */
export function footEdges(parts: Part[]): FootEdge[] {
  const plat = parts.find(p => p.building === 'terrace' && p.kind === 'platform' && p.type === 'prism') as (Part & { polygon: Pt[] }) | undefined;
  if (!plat) return [];
  const P = plat.polygon.slice(); if (P.length > 2 && P[0][0] === P[P.length - 1][0] && P[0][1] === P[P.length - 1][1]) P.pop();
  let area = 0; for (let i = 0; i < P.length; i++) { const a = P[i], b = P[(i + 1) % P.length]; area += a[0] * b[1] - b[0] * a[1]; }
  const out: FootEdge[] = [];
  for (let i = 0; i < P.length; i++) {
    const a = P[i], b = P[(i + 1) % P.length], de = b[0] - a[0], dn = b[1] - a[1], L = Math.hypot(de, dn); if (L < 3) continue;
    // outward normal in grid (e, n): the polygon counter-clockwise (area > 0) has it on the right of the edge
    const s = area > 0 ? 1 : -1, ne = (dn / L) * s, nn = (-de / L) * s, nx = ne, nz = -nn; // world: x = e, z = −n
    if (!(-nx >= 0.5 || nz >= 0.5)) continue;
    const tOf = (p: Pt) => p[0] * nz - -p[1] * nx; // t = x·tx + z·tz, tx = nz, tz = −nx
    const ta = tOf(a), tb = tOf(b);
    out.push(ta <= tb ? { a, b, n: [nx, nz], t0: ta, t1: tb } : { a: b, b: a, n: [nx, nz], t0: tb, t1: ta });
  }
  return out;
}
/** the foot's blocks on one edge: each a convex polygon in (t, y) (y above the court datum), its proud depth and face tilt */
/** `groundAt(e, n)`: the plain's height (court datum) under a grid point, to bury each block's foot under it (default: the spec's
 *  plain level) */
export function footBlocks(E: FootEdge, M = MASONRY, groundAt?: (e: number, n: number) => number): FootBlock[] {
  const F = M.foot, [nx, nz] = E.n, out: FootBlock[] = [], inset = 0.4; // (keep off the wall's corners)
  const at = (t: number): [number, number] => { const s = (t - E.t0) / Math.max(1e-6, E.t1 - E.t0); return [E.a[0] + (E.b[0] - E.a[0]) * s, -(E.a[1] + (E.b[1] - E.a[1]) * s)]; };
  const rows = Math.ceil(F.height / F.row) + 1;
  for (let cx = Math.floor(E.t0 / F.cell) - 1; cx <= Math.ceil(E.t1 / F.cell) + 1; cx++) for (let cy = -1; cy <= rows; cy++) {
    const s = seedOf(cx, cy); const [x, z] = at(s[0] * F.cell); const top = footTop(x, z, nx, nz, M);
    if (!(s[1] * F.row <= top) || top <= 0) continue;
    let poly: [number, number][] = [[s[0] - 2, s[1] - 2], [s[0] + 2, s[1] - 2], [s[0] + 2, s[1] + 2], [s[0] - 2, s[1] + 2]];
    for (let i = -2; i <= 2; i++) for (let j = -2; j <= 2; j++) { if (!i && !j) continue;
      const o = seedOf(cx + i, cy + j), ax = o[0] - s[0], ay = o[1] - s[1]; poly = clip(poly, ax, ay, (ax * (o[0] + s[0]) + ay * (o[1] + s[1])) / 2); }
    // to metres, clipped to the edge (off its corners) and buried 2 m under the plain at the foot
    let pm: [number, number][] = poly.map(([u, v]) => [u * F.cell, F.ground + v * F.row]);
    pm = clip(pm, -1, 0, -(E.t0 + inset)); pm = clip(pm, 1, 0, E.t1 - inset);
    if (pm.length < 3) continue;
    // buried 1.5 m under the lowest ground along the block (never floating where the plain falls away), dropped if the ground
    // covers it
    let g = F.ground, gMax = -1e9; if (groundAt) { g = 1e9; const ts = pm.map(q => q[0]), a = Math.min(...ts), b = Math.max(...ts);
      for (let k = 0; k <= 4; k++) { const [xx, zz] = at(a + (b - a) * k / 4), y = groundAt(xx, -zz); g = Math.min(g, y); gMax = Math.max(gMax, y); } }
    pm = clip(pm, 0, -1, -(Math.min(g, F.ground) - 1.5));
    if (pm.length < 3 || Math.max(...pm.map(q => q[1])) < gMax + 0.2) continue;
    const h = hash12(cx + 17.1, cy + 3.3), depth = FOOT_DEPTH[0] + (FOOT_DEPTH[1] - FOOT_DEPTH[0]) * h;
    const tilt: [number, number] = [(hash12(cx + 2.2, cy + 7.7) - 0.5) * 2 * F.tilt, (hash12(cx + 5.9, cy + 1.4) - 0.5) * 2 * F.tilt];
    out.push({ poly: pm, depth, tilt, edge: 0 });
  }
  return out;
}
/** the foot's mesh (world coordinates) and its triangles for a collider */
/** rev 4 (D-321): the blocks' faces carry, per vertex, the distances to the block's arrises and their seeds ('adist', 'aseed':
 *  arris.ts), and the arrises are returned for the near-field bands (the face's fan from its centre, each triangle carrying its own
 *  edge and both neighbours: the distances are affine over a triangle, so exact per fragment) */
export function footGeometry(parts: Part[], M = MASONRY, groundAt?: (e: number, n: number) => number): { geo: THREE.BufferGeometry | null; blocks: number; edges: number; area: number; arris: ArrisEdge[] } {
  const pos: number[] = [], ad: number[] = [], sd: number[] = [], arris: ArrisEdge[] = []; let blocks = 0, area = 0;
  const E = footEdges(parts), OFF = ADIST_OFF, up = new THREE.Vector3(0, 1, 0);
  for (const e of E) {
    const [nx, nz] = e.n, wn = new THREE.Vector3(nx, 0, nz);
    const P = (t: number, y: number, o: number): [number, number, number] => { const s = (t - e.t0) / Math.max(1e-6, e.t1 - e.t0), x = e.a[0] + (e.b[0] - e.a[0]) * s, z = -(e.a[1] + (e.b[1] - e.a[1]) * s); return [x + nx * o, y, z + nz * o]; };
    const tdir = new THREE.Vector3(...P(e.t0 + 1, 0, 0)).sub(new THREE.Vector3(...P(e.t0, 0, 0))).normalize();
    const tri = (a: number[], b: number[], c: number[], da: number[], db: number[], dc: number[], seeds: number[]) => { pos.push(...a, ...b, ...c); ad.push(...da, ...db, ...dc); sd.push(...seeds, ...seeds, ...seeds); };
    for (const B of footBlocks(e, M, groundAt)) {
      blocks++;
      const n = B.poly.length, ct = B.poly.reduce((p, q) => p + q[0], 0) / n, cy = B.poly.reduce((p, q) => p + q[1], 0) / n;
      const off = (t: number, y: number) => B.depth + (t - ct) * B.tilt[0] + (y - cy) * B.tilt[1];
      const inner = B.poly.map(([t, y]) => { const d = Math.hypot(t - ct, y - cy) || 1, k = Math.min(0.45, CHAMFER / d); return [t + (ct - t) * k, y + (cy - y) * k] as [number, number]; });
      // per polygon edge: its 2-D line (the distances in the face), the sharp corner line (world) and its seed
      const ed = B.poly.map((A, k) => { const C = B.poly[(k + 1) % n], dx = C[0] - A[0], dy = C[1] - A[1], L = Math.hypot(dx, dy) || 1e-9, on: [number, number] = [dy / L, -dx / L];
        const a = new THREE.Vector3(...P(A[0], A[1], off(A[0], A[1]))), b = new THREE.Vector3(...P(C[0], C[1], off(C[0], C[1])));
        return { A, on, a, b, seed: edgeSeed(a.clone().add(b).multiplyScalar(0.5)), L }; });
      const dIn = (k: number, t: number, y: number) => -((t - ed[k].A[0]) * ed[k].on[0] + (y - ed[k].A[1]) * ed[k].on[1]); // m inside edge k (2-D)
      const F = inner.map(([t, y]) => P(t, y, off(t, y))), Cc = P(ct, cy, off(ct, cy));
      // winding: the polygons are counter-clockwise in (t, y); (t, y, outward) is a right-handed frame when t runs along
      // (nz, -nx): then CCW in (t, y) faces outward
      for (let k = 0; k < n; k++) { const j = (k + 1) % n, pk = (k + n - 1) % n, nk = j;
        const D = (t: number, y: number) => [dIn(k, t, y) - OFF, dIn(pk, t, y) - OFF, dIn(nk, t, y) - OFF, 0];
        tri(Cc, F[k], F[j], D(ct, cy), D(inner[k][0], inner[k][1]), D(inner[j][0], inner[j][1]), [aseedOf(ed[k].seed), aseedOf(ed[pk].seed), aseedOf(ed[nk].seed), 0]); }
      const O = B.poly.map(([t, y]) => P(t, y, off(t, y) - CHAMFER)), W = B.poly.map(([t, y]) => P(t, y, 0));
      for (let k = 0; k < n; k++) { const j = (k + 1) % n, s0 = [aseedOf(ed[k].seed), 0, 0, 0], z = [-OFF, 0, 0, 0];
        tri(O[k], O[j], F[j], z, z, z, s0); tri(O[k], F[j], F[k], z, z, z, s0); // the chamfer (on the arris)
        const [tk, yk] = B.poly[k], [tj, yj] = B.poly[j], dw = (t: number, y: number, o: number) => [off(t, y) - o - OFF, 0, 0, 0];
        tri(W[k], W[j], O[j], dw(tk, yk, 0), dw(tj, yj, 0), dw(tj, yj, off(tj, yj) - CHAMFER), s0); tri(W[k], O[j], O[k], dw(tk, yk, 0), dw(tj, yj, off(tj, yj) - CHAMFER), dw(tk, yk, off(tk, yk) - CHAMFER), s0); // the side back to the wall plane
        // the arris: the face (its plane's normal) against the side (outward in the wall plane), inside the chamfer's plane
        const fa = new THREE.Vector3(...F[k]), fb = new THREE.Vector3(...F[j]), fc = new THREE.Vector3(...Cc);
        const na = fb.clone().sub(fa).cross(fc.clone().sub(fa)).normalize(); if (na.dot(wn) < 0) na.negate();
        const nb = tdir.clone().multiplyScalar(ed[k].on[0]).addScaledVector(up, ed[k].on[1]).normalize();
        const oa = new THREE.Vector3(...O[k]), cn = na.clone().add(nb).normalize();
        arris.push({ mat: 'terrace_foot', a: ed[k].a, b: ed[k].b, na, nb, r: 0.02, seed: ed[k].seed, rough: true,
          planes: [{ n: na, d: na.dot(ed[k].a) }, { n: nb, d: nb.dot(ed[k].a) }, { n: cn, d: Math.max(cn.dot(oa), cn.dot(fa)) }],
          y0a: -1000, y0b: -1000, pbox: [0, 0, -1, -1], ytop: -1000, stair: [0, 0, 0, 0] });
      }
      for (let k = 1; k + 1 < n; k++) { const a = B.poly[0], b = B.poly[k], c = B.poly[k + 1]; area += Math.abs((b[0] - a[0]) * (c[1] - a[1]) - (c[0] - a[0]) * (b[1] - a[1])) / 2; }
    }
  }
  if (!pos.length) return { geo: null, blocks, edges: E.length, area, arris };
  const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); geo.computeVertexNormals();
  const nv = pos.length / 3;
  geo.setAttribute('adist', new THREE.Float32BufferAttribute(ad, 4)); geo.setAttribute('aseed', new THREE.Float32BufferAttribute(sd, 4));
  // the architecture material's part attributes: no foot band, no floor, run-off from the block's top, no stair
  geo.setAttribute('y0', new THREE.BufferAttribute(new Float32Array(nv).fill(-1000), 1));
  const pb = new Float32Array(nv * 4); for (let q = 0; q < nv; q++) pb.set([0, 0, -1, -1], q * 4); geo.setAttribute('pbox', new THREE.BufferAttribute(pb, 4));
  const yt = new Float32Array(nv); yt.fill(-1000); // (no run-off: none was drawn on the foot) geo.setAttribute('ytop', new THREE.BufferAttribute(yt, 1));
  geo.setAttribute('stair', new THREE.BufferAttribute(new Float32Array(nv * 4), 4));
  return { geo, blocks, edges: E.length, area, arris };
}
