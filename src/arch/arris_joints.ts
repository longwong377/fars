// D-321 rev 4 (B145): the joints painted in the dressed-stone walls as geometry near the eye. Every vertical face of a limestone
// or terrace part is read back from its render geometry; its joints are enumerated on the CPU exactly as the shader draws them
// (materials.ts ashlarCells/headCells for the palaces' varied coursing, retainingCells for the Terrace's retaining walls:
// course tables, head joints of the runs) with the shader's own hash in float32 arithmetic, and each joint becomes an ArrisEdge
// of kind 'joint': the near-field bands draw it as a groove (the two blocks' arrises rounded, 4 mm, meeting at the 0.8 mm joint)
// and the base mesh discards its joint zone within the eye's radius. Where the shader's decision is close to a threshold (a run's
// inner joint present or not, a face's course table), the CPU keeps every candidate: an unneeded groove lies behind the wall's
// face (hidden), a needed one is never missing. Not grooved (the maps draw them): the stairs, the up-facing slabs, the split
// blocks' beds, the foot's polygonal joints and the Grand Stair's recess walls. Tier C.
import * as THREE from 'three/webgpu';
import { SURFACES } from '../render/materials';
import { MASONRY, courseTables, courseTexels } from '../render/masonry';
import type { ArrisEdge } from './arris';

const fr = Math.fround, fract = (v: number) => fr(v - Math.floor(v));
/** materials.ts hash12 in float32 steps (the shader's arithmetic) */
export function hash12f(x: number, y: number): number {
  const k = fr(0.1031), q0 = fract(fr(fr(x) * k)), q1 = fract(fr(fr(y) * k)), q2 = q0;
  const c = fr(33.33), d = fr(fr(fr(q0 * fr(q1 + c)) + fr(q1 * fr(q2 + c))) + fr(q2 * fr(q0 + c)));
  const r0 = fr(q0 + d), r1 = fr(q1 + d), r2 = fr(q2 + d);
  return fract(fr(fr(r0 + r1) * r2));
}
const MARGIN = 0.004; // a hash within this of its threshold: both outcomes kept
export interface JointFace { n: THREE.Vector3; d: number; t0: number; t1: number; y0: number; y1: number; surf: string; y0attr: number; pbox: [number, number, number, number]; ytop: number;
  /** a chunk's ends inside the face (no margin, half-open), and its stair attribute */ open0?: boolean; open1?: boolean; stair?: [number, number, number, number] }
/** a face in chunks of CHUNK m along it (the near field expands a chunk when it comes near: arris.ts ArrisField.addFaces) */
export const CHUNK = 8;
export function chunkFaces(faces: JointFace[], stair?: [number, number, number, number]): JointFace[] {
  const out: JointFace[] = [];
  for (const F of faces) { const n = Math.max(1, Math.ceil((F.t1 - F.t0) / CHUNK));
    for (let k = 0; k < n; k++) out.push({ ...F, t0: F.t0 + ((F.t1 - F.t0) * k) / n, t1: F.t0 + ((F.t1 - F.t0) * (k + 1)) / n, open0: k > 0, open1: k < n - 1, stair }); }
  return out;
}
/** the chunk's plan bounds (world x, z) and heights */
export function faceBounds(F: JointFace): { lo: THREE.Vector3; hi: THREE.Vector3 } {
  const tdir = new THREE.Vector3(F.n.z, 0, -F.n.x), a = tdir.clone().multiplyScalar(F.t0).addScaledVector(F.n, F.d), b = tdir.clone().multiplyScalar(F.t1).addScaledVector(F.n, F.d);
  return { lo: new THREE.Vector3(Math.min(a.x, b.x), F.y0, Math.min(a.z, b.z)), hi: new THREE.Vector3(Math.max(a.x, b.x), F.y1, Math.max(a.z, b.z)) };
}

/** the vertical faces of a render geometry: triangles grouped by plane, each group's extent along the face (t) and up (y) */
export function verticalFaces(g: THREE.BufferGeometry, surf: string, ytop: number): JointFace[] {
  const P = g.getAttribute('position'), N = g.getAttribute('normal'), Y0 = g.getAttribute('y0'), PB = g.getAttribute('pbox');
  const out = new Map<string, JointFace>();
  for (let i = 0; i < P.count; i++) {
    const nx = N.getX(i), ny = N.getY(i), nz = N.getZ(i); if (Math.abs(ny) > 0.05) continue;
    const hl = Math.hypot(nx, nz); if (hl < 0.9) continue;
    const n = new THREE.Vector3(nx / hl, 0, nz / hl), x = P.getX(i), y = P.getY(i), z = P.getZ(i), d = x * n.x + z * n.z, t = x * (n.z) + z * (-n.x);
    const key = `${n.x.toFixed(3)},${n.z.toFixed(3)},${d.toFixed(3)}`;
    let F = out.get(key);
    if (!F) { F = { n, d, t0: t, t1: t, y0: y, y1: y, surf, y0attr: Y0 ? Y0.getX(i) : -1000, pbox: PB ? [PB.getX(i), PB.getY(i), PB.getZ(i), PB.getW(i)] : [0, 0, -1, -1], ytop }; out.set(key, F); }
    F.t0 = Math.min(F.t0, t); F.t1 = Math.max(F.t1, t); F.y0 = Math.min(F.y0, y); F.y1 = Math.max(F.y1, y);
  }
  return [...out.values()].filter(F => F.t1 - F.t0 > 0.05 && F.y1 - F.y0 > 0.05);
}

/** the joints of a face as lines in its frame: beds (y, t0, t1) and heads (t, y0, y1) */
export function faceJoints(F: JointFace): { beds: [number, number, number][]; heads: [number, number, number][] } {
  const J = SURFACES[F.surf]?.joints, beds: [number, number, number][] = [], heads: [number, number, number][] = [];
  if (!J?.vary) return { beds, heads };
  if (J.retaining) {
    const M = MASONRY, BL = M.block, L = BL.base, NB = BL.per, tables = courseTables(M), tex = courseTexels(M);
    // the course table: the face's plane and heading pick a section; every candidate near a bin's edge is kept
    const cand = (v: number, eps: number) => { const f = v - Math.floor(v); return f < eps ? [Math.floor(v), Math.floor(v) - 1] : f > 1 - eps ? [Math.floor(v), Math.floor(v) + 1] : [Math.floor(v)]; };
    const rows = new Set<number>();
    for (const dp of cand(F.d + 0.5, 0.02)) for (const hd of cand(Math.atan2(F.n.z, F.n.x) * 36 / Math.PI + 0.5, 0.02)) {
      const hv = hash12f(dp, hd + 17.3) * M.sections; for (const s of cand(hv, 0.01)) rows.add(Math.max(0, Math.min(M.sections - 1, s)));
    }
    for (const row of rows) {
      const bs = tables[row].filter(b => b >= F.y0 - 0.01 && b <= F.y1 + 0.01);
      for (const b of bs) beds.push([b, F.t0, F.t1]);
      const all = tables[row];
      for (let k = 0; k + 1 < all.length; k++) {
        const top = all[k], bot = all[k + 1]; if (top < F.y0 || bot > F.y1) continue;
        const ym = (top + bot) / 2, i = Math.min(tex.w - 1, Math.max(0, Math.floor((ym - M.y0) / M.quantum))), c = tex.data[(row * tex.w + i) * 4 + 2];
        const off = hash12f(c, 3.71) * NB * L, y0 = Math.max(bot, F.y0), y1 = Math.min(top, F.y1);
        for (let kk = Math.floor((F.t0 - off) / (NB * L)) - 1; kk <= Math.floor((F.t1 - off) / (NB * L)) + 1; kk++) for (let q = 0; q < NB; q++) {
          const g = kk * NB + q; if (q > 0 && !(hash12f(c + 0.5, g) < BL.joint_p + MARGIN)) continue;
          const x = off + (g + (q === 0 ? 0 : (hash12f(g, c + 0.25) - 0.5) * 2 * BL.jitter)) * L;
          if ((F.open0 ? x >= F.t0 : x > F.t0 + 0.01) && (F.open1 ? x < F.t1 : x < F.t1 - 0.01)) heads.push([x, y0, y1]);
        }
      }
    }
    return { beds, heads };
  }
  // the palaces' varied coursing: pairs of courses of 2 x course, split at a hashed height; head joints per course
  const V = J.vary, H = J.course * 2, L = J.block;
  for (let k = Math.floor(F.y0 / H) - 1; k <= Math.floor(F.y1 / H) + 1; k++) {
    const split = hash12f(k, 7.13) * (V.course[1] - V.course[0]) + V.course[0];
    const courses: [number, number, number][] = [[k * H, k * H + split, 2 * k], [k * H + split, (k + 1) * H, 2 * k + 1]];
    for (const [yb, ya, c] of courses) {
      if (ya < F.y0 || yb > F.y1) continue;
      if (yb > F.y0 + 0.005) beds.push([yb, F.t0, F.t1]);
      const off = hash12f(c, 3.71) * L, y0 = Math.max(yb, F.y0), y1 = Math.min(ya, F.y1);
      for (let j = Math.floor((F.t0 - off) / L) - 1; j <= Math.floor((F.t1 - off) / L) + 1; j++) {
        const x = (j + (hash12f(c, j) - 0.5) * V.jitter * 0.5) * L + off;
        if ((F.open0 ? x >= F.t0 : x > F.t0 + 0.01) && (F.open1 ? x < F.t1 : x < F.t1 - 0.01)) heads.push([x, y0, y1]);
      }
    }
  }
  return { beds, heads };
}

/** a face's (or chunk's) joints as band edges */
export function jointEdgesOfFace(F: JointFace): ArrisEdge[] {
  const out: ArrisEdge[] = [], up = new THREE.Vector3(0, 1, 0), stair = F.stair ?? [0, 0, 0, 0];
  {
    const tdir = new THREE.Vector3(F.n.z, 0, -F.n.x), at = (t: number, y: number) => tdir.clone().multiplyScalar(t).addScaledVector(F.n, F.d).add(new THREE.Vector3(0, y, 0));
    const { beds, heads } = faceJoints(F);
    const mk = (a: THREE.Vector3, b: THREE.Vector3, across: THREE.Vector3): ArrisEdge => ({ mat: F.surf, a, b, na: F.n.clone(), nb: across, r: 0, seed: 0, joint: true, planes: [], y0a: F.y0attr, y0b: F.y0attr, pbox: F.pbox, ytop: F.ytop, stair });
    for (const [y, t0, t1] of beds) out.push(mk(at(t0, y), at(t1, y), up.clone()));
    for (const [t, y0, y1] of heads) out.push(mk(at(t, y0), at(t, y1), tdir.clone()));
  }
  return out;
}
