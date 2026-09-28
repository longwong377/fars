// D-321 rev 4 (B145): the dressed-stone prisms (the Terrace platform's retaining walls, the palaces' podiums) get the arris
// system of the box parts: their render geometry carries the 'adist'/'aseed' attributes (the distance to each nearby free
// arris and its seed: arris.ts), and their free arrises (the top edge of each wall face, the convex vertical corners) are
// recorded for the near-field bands. The walls are cut in 4 x 4 m quads (each quad's distances are affine: exact per
// fragment), the top in a ring of strips 0.15 m wide along the outline (distance to their edge) round the inner polygon.
// The collider stays the plain extrusion (meshes.ts prismGeometry). Tier C.
import * as THREE from 'three/webgpu';
import type { Prism, Part } from './parts';
import { edgeSeed, aseedOf, type ArrisEdge } from './arris';
import { ADIST_OFF } from '../render/blockface';

const SEG = 4, RING = 0.15, EPS = 0.03;
export interface ProtoEdge { a: THREE.Vector3; b: THREE.Vector3; na: THREE.Vector3; nb: THREE.Vector3; seed: number }
type Inside = { inside(x: number, y: number, z: number, except: Part): boolean };

/** the prism's render geometry with the arris attributes, and its free arrises (null: a degenerate outline) */
export function prismArrisGeometry(p: Prism, index: Inside): { geo: THREE.BufferGeometry; edges: ProtoEdge[] } | null {
  let poly = p.polygon.map(([e, n]) => [e, n] as [number, number]);
  if (poly.length > 2 && Math.hypot(poly[0][0] - poly[poly.length - 1][0], poly[0][1] - poly[poly.length - 1][1]) < 1e-6) poly = poly.slice(0, -1);
  const N = poly.length; if (N < 3) return null;
  let area = 0; for (let i = 0; i < N; i++) { const [x0, y0] = poly[i], [x1, y1] = poly[(i + 1) % N]; area += x0 * y1 - x1 * y0; }
  const ccw = area > 0, W = (e: number, y: number, n: number) => new THREE.Vector3(e, y, -n);
  // per edge (grid): direction, length, outward normal (grid), world normal
  const E = poly.map((P, i) => { const Q = poly[(i + 1) % N], dx = Q[0] - P[0], dy = Q[1] - P[1], L = Math.hypot(dx, dy) || 1e-9;
    const on: [number, number] = ccw ? [dy / L, -dx / L] : [-dy / L, dx / L]; return { P, Q, L, d: [dx / L, dy / L] as [number, number], on, nw: new THREE.Vector3(on[0], 0, -on[1]) }; });
  // a corner (vertex i, between edge i-1 and edge i) is convex when the turn agrees with the winding
  const convex = poly.map((_, i) => { const a = E[(i + N - 1) % N].d, b = E[i].d, cr = a[0] * b[1] - a[1] * b[0]; return ccw ? cr > 1e-6 : cr < -1e-6; });
  const free = (x: number, y: number, z: number) => !index.inside(x, y, z, p);
  const edges: ProtoEdge[] = [], up = new THREE.Vector3(0, 1, 0);
  const pos: number[] = [], nrm: number[] = [], ad: number[] = [], sd: number[] = [];
  const quad = (A: THREE.Vector3, B: THREE.Vector3, C: THREE.Vector3, D: THREE.Vector3, n: THREE.Vector3, dist: (q: THREE.Vector3) => number[], seeds: number[]) => {
    // A B C D counter-clockwise seen from outside (along n)
    const cr = B.clone().sub(A).cross(D.clone().sub(A)); const pts = cr.dot(n) >= 0 ? [A, B, C, A, C, D] : [A, C, B, A, D, C];
    for (const q of pts) { pos.push(q.x, q.y, q.z); nrm.push(n.x, n.y, n.z); ad.push(...dist(q)); sd.push(...seeds); }
  };
  const nz = (v: number | null) => v === null ? 0 : v - ADIST_OFF;
  const nv = Math.max(1, Math.ceil((p.y1 - p.y0) / SEG)), ys = Array.from({ length: nv + 1 }, (_, k) => p.y0 + ((p.y1 - p.y0) * k) / nv);
  // the vertical corners' free sub-edges and their seeds, per vertex and height band
  const vSeed: (number | null)[][] = poly.map(([e, n], i) => ys.slice(0, -1).map((y, k) => {
    if (!convex[i]) return null;
    const ya = y, yb = ys[k + 1], nA = E[(i + N - 1) % N].nw, nB = E[i].nw, a = W(e, ya, n), b = W(e, yb, n);
    for (const f of [0.1, 0.5, 0.9]) { const q = a.clone().lerp(b, f); for (const [n1, n2] of [[nA, nB], [nB, nA]]) { const t = q.clone().addScaledVector(n1, EPS).addScaledVector(n2, -EPS); if (!free(t.x, t.y, t.z)) return null; } }
    const seed = edgeSeed(a.clone().add(b).multiplyScalar(0.5)); edges.push({ a, b, na: nA.clone(), nb: nB.clone(), seed }); return seed;
  }));
  for (let i = 0; i < N; i++) {
    const { P, L, d, nw } = E[i], ns = Math.max(1, Math.ceil(L / SEG));
    for (let s = 0; s < ns; s++) {
      const t0 = (L * s) / ns, t1 = (L * (s + 1)) / ns, g = (t: number) => [P[0] + d[0] * t, P[1] + d[1] * t] as [number, number];
      const [e0, n0] = g(t0), [e1, n1] = g(t1);
      // the top edge of this stretch: free if nothing stands on it or against it
      const a = W(e0, p.y1, n0), b = W(e1, p.y1, n1); let topSeed: number | null = null, ok = true;
      for (const f of [0.1, 0.5, 0.9]) { const q = a.clone().lerp(b, f); for (const t of [q.clone().addScaledVector(nw, EPS).addScaledVector(up, -EPS), q.clone().addScaledVector(nw, -EPS).addScaledVector(up, EPS)]) if (!free(t.x, t.y, t.z)) ok = false; }
      if (ok) { topSeed = edgeSeed(a.clone().add(b).multiplyScalar(0.5)); edges.push({ a, b, na: nw.clone(), nb: up.clone(), seed: topSeed }); }
      // the wall: quads of this stretch, SEG high
      for (let k = 0; k < nv; k++) {
        const sA = s === 0 ? vSeed[i][k] : null, sB = s === ns - 1 ? vSeed[(i + 1) % N][k] : null;
        const dist = (q: THREE.Vector3) => { const tq = (q.x - P[0]) * d[0] + (-q.z - P[1]) * d[1];
          return [nz(topSeed !== null ? p.y1 - q.y : null), nz(sA !== null ? tq : null), nz(sB !== null ? L - tq : null), 0]; };
        quad(W(e0, ys[k], n0), W(e1, ys[k], n1), W(e1, ys[k + 1], n1), W(e0, ys[k + 1], n0), nw, dist, [topSeed !== null ? aseedOf(topSeed) : 0, sA !== null ? aseedOf(sA) : 0, sB !== null ? aseedOf(sB) : 0, 0]);
      }
    }
  }
  // the top: the inner outline (the edges offset RING inward, mitred) and the ring of strips between
  const inner = poly.map((_, i) => { const A = E[(i + N - 1) % N], B = E[i], bis = [-(A.on[0] + B.on[0]), -(A.on[1] + B.on[1])], bl = Math.hypot(bis[0], bis[1]) || 1;
    const cosH = Math.max(0.3, (-(A.on[0]) * bis[0] - A.on[1] * bis[1]) / bl); const k = RING / cosH; return [poly[i][0] + (bis[0] / bl) * k, poly[i][1] + (bis[1] / bl) * k] as [number, number]; });
  const tri = THREE.ShapeUtils.triangulateShape(inner.map(([x, y]) => new THREE.Vector2(x, y)), []);
  if (!tri.length) return null;
  for (const [i, j, k] of tri) { const A = W(inner[i][0], p.y1, inner[i][1]), B = W(inner[j][0], p.y1, inner[j][1]), C = W(inner[k][0], p.y1, inner[k][1]);
    const cr = B.clone().sub(A).cross(C.clone().sub(A)), pts = cr.y >= 0 ? [A, B, C] : [A, C, B]; for (const q of pts) { pos.push(q.x, q.y, q.z); nrm.push(0, 1, 0); ad.push(0, 0, 0, 0); sd.push(0, 0, 0, 0); } }
  for (let i = 0; i < N; i++) {
    const { P, L, d, on } = E[i], I0 = inner[i], I1 = inner[(i + 1) % N], ns = Math.max(1, Math.ceil(L / SEG));
    for (let s = 0; s < ns; s++) {
      const f0 = s / ns, f1 = (s + 1) / ns, lerp2 = (A: number[], B: number[], f: number) => [A[0] + (B[0] - A[0]) * f, A[1] + (B[1] - A[1]) * f];
      const o0 = [P[0] + d[0] * L * f0, P[1] + d[1] * L * f0], o1 = [P[0] + d[0] * L * f1, P[1] + d[1] * L * f1], i0 = lerp2(I0, I1, f0), i1 = lerp2(I0, I1, f1);
      const a = W(o0[0], p.y1, o0[1]), b = W(o1[0], p.y1, o1[1]), mid = a.clone().add(b).multiplyScalar(0.5), seed = edgeSeed(mid);
      const isFree = edges.some(q => q.nb.y > 0.5 && Math.abs(q.seed - seed) < 1e-12);
      const dist = (q: THREE.Vector3) => [nz(isFree ? -((q.x - P[0]) * on[0] + (-q.z - P[1]) * on[1]) : null), 0, 0, 0];
      quad(a, b, W(i1[0], p.y1, i1[1]), W(i0[0], p.y1, i0[1]), up, dist, [isFree ? aseedOf(seed) : 0, 0, 0, 0]);
    }
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); geo.setAttribute('normal', new THREE.Float32BufferAttribute(nrm, 3));
  geo.setAttribute('adist', new THREE.Float32BufferAttribute(ad, 4)); geo.setAttribute('aseed', new THREE.Float32BufferAttribute(sd, 4));
  return { geo, edges };
}

/** the recorded edges with the part's attributes (y0 per face from the render geometry, pbox, ytop, stair) */
export function finishProtoEdges(p: Prism, mat: string, proto: ProtoEdge[], rg: THREE.BufferGeometry, r = 0.01): ArrisEdge[] {
  const N = rg.getAttribute('normal'), Y0 = rg.getAttribute('y0'), PB = rg.getAttribute('pbox'), ST = rg.getAttribute('stair');
  const y0Of = (n: THREE.Vector3) => { for (let i = 0; i < N.count; i += 3) if (Math.abs(N.getX(i) - n.x) + Math.abs(N.getY(i) - n.y) + Math.abs(N.getZ(i) - n.z) < 1e-3) return Y0.getX(i); return -1000; };
  const pbox: [number, number, number, number] = [PB.getX(0), PB.getY(0), PB.getZ(0), PB.getW(0)], stair: [number, number, number, number] = [ST.getX(0), ST.getY(0), ST.getZ(0), ST.getW(0)];
  return proto.map(e => ({ mat, a: e.a, b: e.b, na: e.na, nb: e.nb, r, seed: e.seed, planes: [{ n: e.na, d: e.na.dot(e.a) }, { n: e.nb, d: e.nb.dot(e.a) }], y0a: y0Of(e.na), y0b: y0Of(e.nb), pbox, ytop: p.y1, stair }));
}
