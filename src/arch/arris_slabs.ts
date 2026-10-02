// D-364 (B145's last open joints): the stairs' and the up-facing slabs' joints as geometry near the eye. D-321 rev 4-5 grooved
// every joint of the dressed walls (arris_joints.ts); the treads, risers and the paved landings kept their joints in the maps
// (a dark hairline, no edge in the geometry). Here every such face is read back from its render geometry as a planar face (its
// triangles in the face's own 2-D frame, with the 'adist' distances to its free arrises), and the joints the shader draws on it
// are enumerated on the CPU with the shader's own hash (materials.ts: the stair blocks' head joints along `across` and the row
// joint on the first tread of each block row, D-218; a slab's courses and head joints, ashlarCells on (x, z)); each becomes a
// joint edge (ArrisEdge, joint: true) clipped to the face's triangles and stopped where the face's arris band begins (dA =
// ARRIS_W), so the near-field bands (arris.ts) draw the groove and the base mesh discards the joint zone (materials.ts jd).
// Tier C.
import * as THREE from 'three/webgpu';
import { SURFACES, STAIR_BLOCK } from '../render/materials';
import { ARRIS_W, type ArrisEdge } from './arris';
import { ADIST_OFF } from '../render/blockface';
import { hash12f } from './arris_joints';

/** a planar face in its own frame: world X = U u + V v + N d; its triangles as (u, v) triples with each vertex's four arris
 *  distances (m, 'adist' + ADIST_OFF; 1000 = none) */
export interface PlanarFace {
  kind: 'slab' | 'tread' | 'riser'; U: THREE.Vector3; V: THREE.Vector3; N: THREE.Vector3; d: number;
  tris: Float64Array; /** per vertex 4 */ ad: Float64Array; /** the face's 'y0' attribute (the floor before a riser; -1000 none) */ y0: number; /** the chunk's clip rectangle in (u, v), half-open */ box: [number, number, number, number];
}
const SLAB_MIN = 0.75; // materials.ts: slab joints on up-facing faces of parts at least 1.5 m across both ways (pbox half sizes)
const CHUNK = 8, RISER_SHOW = 0.7;
const fr = Math.fround;

/** the faces of a dressed-stone part's render geometry whose joints are drawn by the shader but were not grooved: a step's tread
 *  and riser (stair attribute set), or the top of a non-step part at least 1.5 m across both ways (its pbox). Not the surfaces
 *  drawn with another top (the Terrace's court fill) or rough-dressed (the foot) */
export function planarFaces(g: THREE.BufferGeometry, surf: string, stair?: [number, number, number, number]): PlanarFace[] {
  const S = SURFACES[surf]; if (!S?.joints?.vary || S.top || S.blockFace === 'rough') return [];
  const P = g.getAttribute('position'), Nn = g.getAttribute('normal'), AD = g.getAttribute('adist'), PB = g.getAttribute('pbox'), Y0 = g.getAttribute('y0'), I = g.index;
  const isStep = !!stair && Math.abs(stair[1]) >= 0.05;
  if (!isStep) { if (!PB || Math.min(Math.abs(PB.getZ(0)), Math.abs(PB.getW(0))) < SLAB_MIN) return []; }
  const sd = isStep ? new THREE.Vector3(stair![2], 0, stair![3]).normalize() : null;
  const want: { kind: PlanarFace['kind']; N: THREE.Vector3; U: THREE.Vector3; V: THREE.Vector3 }[] = [];
  if (isStep) {
    const across = new THREE.Vector3(-sd!.z, 0, sd!.x); // grad of across = z sdx − x sdz
    // the riser, and the step's back face where it shows (faceCovered drops it where the next step stands against it): the shader
    // draws the head joints on both (its headMask spares only the side faces)
    want.push({ kind: 'tread', N: new THREE.Vector3(0, 1, 0), U: across, V: sd! }, { kind: 'riser', N: sd!.clone().negate(), U: across, V: new THREE.Vector3(0, 1, 0) }, { kind: 'riser', N: sd!.clone(), U: across, V: new THREE.Vector3(0, 1, 0) });
  } else want.push({ kind: 'slab', N: new THREE.Vector3(0, 1, 0), U: new THREE.Vector3(1, 0, 0), V: new THREE.Vector3(0, 0, 1) });
  const out: PlanarFace[] = [];
  const nTri = (I ? I.count : P.count) / 3, vi = (k: number) => I ? I.getX(k) : k;
  for (const W of want) {
    const tris: number[] = [], ad: number[] = []; let dSum = 0, dN = 0, y0 = -1000;
    for (let t = 0; t < nTri; t++) {
      const a = vi(3 * t), b = vi(3 * t + 1), c = vi(3 * t + 2);
      // the face's own triangles: every vertex's normal the face's (a bevel's rounded normals are not)
      if (![a, b, c].every(k => Nn.getX(k) * W.N.x + Nn.getY(k) * W.N.y + Nn.getZ(k) * W.N.z > 0.999)) continue;
      if (Y0 && !tris.length) y0 = Y0.getX(a);
      for (const k of [a, b, c]) { const x = P.getX(k), y = P.getY(k), z = P.getZ(k);
        tris.push(x * W.U.x + y * W.U.y + z * W.U.z, x * W.V.x + y * W.V.y + z * W.V.z); dSum += x * W.N.x + y * W.N.y + z * W.N.z; dN++;
        if (AD) ad.push(AD.getX(k) + ADIST_OFF, AD.getY(k) + ADIST_OFF, AD.getZ(k) + ADIST_OFF, AD.getW(k) + ADIST_OFF); else ad.push(1e3, 1e3, 1e3, 1e3); }
    }
    if (!tris.length) continue;
    const d = dSum / dN;
    // (the riser of a step: only its front face; a box's back face looks the other way and is not matched)
    let u0 = Infinity, u1 = -Infinity, v0 = Infinity, v1 = -Infinity;
    for (let i = 0; i < tris.length; i += 2) { u0 = Math.min(u0, tris[i]); u1 = Math.max(u1, tris[i]); v0 = Math.min(v0, tris[i + 1]); v1 = Math.max(v1, tris[i + 1]); }
    if (u1 - u0 < 0.05 || v1 - v0 < 0.02) continue;
    const T = new Float64Array(tris), A = new Float64Array(ad);
    // a riser shows only over the step below (the steps are founded deep, D-218): its top RISER_SHOW m (the joints below are hidden)
    if (W.kind === 'riser') v0 = Math.max(v0, v1 - RISER_SHOW);
    const nu = Math.max(1, Math.ceil((u1 - u0) / CHUNK)), nv = Math.max(1, Math.ceil((v1 - v0) / CHUNK));
    for (let i = 0; i < nu; i++) for (let j = 0; j < nv; j++) {
      const bx: [number, number, number, number] = [i === 0 ? -Infinity : u0 + ((u1 - u0) * i) / nu, i === nu - 1 ? Infinity : u0 + ((u1 - u0) * (i + 1)) / nu,
        j === 0 ? (W.kind === 'riser' ? v0 : -Infinity) : v0 + ((v1 - v0) * j) / nv, j === nv - 1 ? Infinity : v0 + ((v1 - v0) * (j + 1)) / nv];
      out.push({ kind: W.kind, U: W.U, V: W.V, N: W.N, d, tris: T, ad: A, y0, box: bx });
    }
  }
  return out;
}

/** the face's (u, v) bounds clipped to its chunk */
export function planarBounds(pf: PlanarFace): [number, number, number, number] {
  let u0 = Infinity, u1 = -Infinity, v0 = Infinity, v1 = -Infinity; const T = pf.tris;
  for (let i = 0; i < T.length; i += 2) { u0 = Math.min(u0, T[i]); u1 = Math.max(u1, T[i]); v0 = Math.min(v0, T[i + 1]); v1 = Math.max(v1, T[i + 1]); }
  return [Math.max(u0, pf.box[0]), Math.min(u1, pf.box[1]), Math.max(v0, pf.box[2]), Math.min(v1, pf.box[3])];
}
export const planarWorld = (pf: PlanarFace, u: number, v: number) => pf.U.clone().multiplyScalar(u).addScaledVector(pf.V, v).addScaledVector(pf.N, pf.d);

type Seg = [number, number, number, number]; // world-frame joint lines in the face's (u, v)
/** the joints the shader draws on the face, as segments in (u, v) over its bounds (a little beyond: clipped later) */
export function planarJoints(pf: PlanarFace, surf: string, stair: [number, number, number, number], pbox: [number, number, number, number]): Seg[] {
  const [u0, u1, v0, v1] = planarBounds(pf), segs: Seg[] = []; if (!(u1 > u0 && v1 > v0)) return segs;
  if (pf.kind === 'slab') {
    // ashlarCells(p.x, p.z, J): courses along z (pairs of 2 x course split at a hashed height), head joints along x per course
    const J = SURFACES[surf].joints!, V = J.vary!, H = J.course * 2, L = J.block; // (U = x, V = z)
    for (let k = Math.floor(v0 / H) - 1; k <= Math.floor(v1 / H) + 1; k++) {
      const split = hash12f(k, 7.13) * (V.course[1] - V.course[0]) + V.course[0];
      for (const [zb, za, c] of [[k * H, k * H + split, 2 * k], [k * H + split, (k + 1) * H, 2 * k + 1]] as [number, number, number][]) {
        if (za < v0 || zb > v1) continue;
        if (zb >= v0 && zb <= v1) segs.push([u0, zb, u1, zb]);
        const off = hash12f(c, 3.71) * L, za1 = Math.min(za, v1), zb1 = Math.max(zb, v0);
        for (let j = Math.floor((u0 - off) / L) - 1; j <= Math.floor((u1 - off) / L) + 1; j++) {
          const x = (j + (hash12f(c, j) - 0.5) * V.jitter * 0.5) * L + off;
          if (x >= u0 && x <= u1) segs.push([x, zb1, x, za1]);
        }
      }
    }
    return segs;
  }
  // a step: headCells(across, STAIR_BLOCK) per block row c = row + |seed| x 1000 (float32, as the attribute), U = across
  const c = fr(fr(stair[0]) + fr(fr(Math.abs(stair[1])) * 1000)), L = STAIR_BLOCK.length, jit = STAIR_BLOCK.jitter, off = hash12f(c, 3.71) * L;
  for (let j = Math.floor((u0 - off) / L) - 1; j <= Math.floor((u1 - off) / L) + 1; j++) {
    const x = (j + (hash12f(c, j) - 0.5) * jit * 0.5) * L + off;
    if (x >= u0 && x <= u1) segs.push([x, v0, x, v1]);
  }
  // the row's joint across the first tread of each row: along = tHalf − rowJoint from the box centre (V = the rising direction)
  if (pf.kind === 'tread' && stair[1] <= -0.05) {
    const sdx = stair[2], sdz = stair[3], tHalf = Math.abs(pbox[2]) * Math.abs(sdx) + Math.abs(pbox[3]) * Math.abs(sdz);
    const vc = pbox[0] * sdx + pbox[1] * sdz, v = vc + tHalf - STAIR_BLOCK.rowJoint; // (V·X = along + V·centre)
    segs.push([u0, v, u1, v]);
  }
  return segs;
}

/** a segment's parts over the face's triangles where every arris distance is >= ARRIS_W (the band draws the rest), in the chunk */
export function clipToFace(pf: PlanarFace, s: Seg): [number, number][] {
  const [ax, ay, bx, by] = s, dx = bx - ax, dy = by - ay, T = pf.tris, A = pf.ad, iv: [number, number][] = [];
  let lo0 = 0, hi0 = 1;
  // the chunk's rectangle (half-open: [u0, u1) x [v0, v1))
  for (const [p, q] of [[-dx, ax - pf.box[0]], [dx, pf.box[1] - ax], [-dy, ay - pf.box[2]], [dy, pf.box[3] - ay]] as [number, number][]) {
    if (!Number.isFinite(q)) continue; if (Math.abs(p) < 1e-12) { if (q < 0) return []; continue; }
    const r = q / p; if (p < 0) lo0 = Math.max(lo0, r); else hi0 = Math.min(hi0, r);
  }
  if (hi0 - lo0 < 1e-9) return [];
  for (let t = 0; t < T.length; t += 6) {
    const x0 = T[t], y0 = T[t + 1], x1 = T[t + 2], y1 = T[t + 3], x2 = T[t + 4], y2 = T[t + 5];
    const den = (y1 - y2) * (x0 - x2) + (x2 - x1) * (y0 - y2); if (Math.abs(den) < 1e-14) continue;
    // barycentrics along the segment: l_i(s) = a_i + b_i s
    const bary = (x: number, y: number) => [((y1 - y2) * (x - x2) + (x2 - x1) * (y - y2)) / den, ((y2 - y0) * (x - x2) + (x0 - x2) * (y - y2)) / den];
    const [p0, q0] = bary(ax, ay), [p1, q1] = bary(bx, by), la = [p0, q0, 1 - p0 - q0], lb = [p1 - p0, q1 - q0, -(p1 - p0) - (q1 - q0)];
    let lo = lo0, hi = hi0;
    for (let i = 0; i < 3 && hi > lo; i++) { const a = la[i], b = lb[i]; // a + b s >= 0
      if (Math.abs(b) < 1e-14) { if (a < -1e-9) hi = lo; continue; } const r = -a / b; if (b > 0) lo = Math.max(lo, r); else hi = Math.min(hi, r); }
    if (hi - lo < 1e-9) continue;
    // the arris distances (affine over the triangle): each >= ARRIS_W
    const vb = t / 2; // (vertex index of the triangle's first vertex)
    for (let c = 0; c < 4 && hi > lo; c++) {
      const d0 = A[(vb) * 4 + c], d1 = A[(vb + 1) * 4 + c], d2 = A[(vb + 2) * 4 + c];
      if (d0 > 900 && d1 > 900 && d2 > 900) continue;
      const a = la[0] * d0 + la[1] * d1 + la[2] * d2 - ARRIS_W, b = lb[0] * d0 + lb[1] * d1 + lb[2] * d2;
      if (Math.abs(b) < 1e-14) { if (a < 0) hi = lo; continue; } const r = -a / b; if (b > 0) lo = Math.max(lo, r); else hi = Math.min(hi, r);
    }
    if (hi - lo > 1e-9) iv.push([lo, hi]);
  }
  iv.sort((p, q) => p[0] - q[0]);
  const out: [number, number][] = [];
  for (const [a, b] of iv) { const L = out[out.length - 1]; if (L && a <= L[1] + 1e-6) L[1] = Math.max(L[1], b); else out.push([a, b]); }
  return out;
}

/** the face chunk's joints as groove edges (world) */
export function planarJointEdges(pf: PlanarFace, surf: string, attrs: { y0: number; pbox: [number, number, number, number]; ytop: number; stair: [number, number, number, number] }): ArrisEdge[] {
  const out: ArrisEdge[] = [];
  for (const s of planarJoints(pf, surf, attrs.stair, attrs.pbox)) {
    const len = Math.hypot(s[2] - s[0], s[3] - s[1]); if (len < 1e-6) continue;
    for (const [lo, hi] of clipToFace(pf, s)) {
      if ((hi - lo) * len < 0.02) continue;
      const a = planarWorld(pf, s[0] + (s[2] - s[0]) * lo, s[1] + (s[3] - s[1]) * lo), b = planarWorld(pf, s[0] + (s[2] - s[0]) * hi, s[1] + (s[3] - s[1]) * hi);
      const across = pf.N.clone().cross(b.clone().sub(a)).normalize();
      out.push({ mat: surf, a, b, na: pf.N.clone(), nb: across, r: 0, seed: 0, joint: true, planes: [], y0a: attrs.y0, y0b: attrs.y0, pbox: attrs.pbox, ytop: attrs.ytop, stair: attrs.stair });
    }
  }
  return out;
}
