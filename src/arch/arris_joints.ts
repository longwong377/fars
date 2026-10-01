// D-321 rev 4 (B145): the joints painted in the dressed-stone walls as geometry near the eye. Every vertical face of a limestone
// or terrace part is read back from its render geometry; its joints are enumerated on the CPU exactly as the shader draws them
// (materials.ts ashlarCells/headCells for the palaces' varied coursing, retainingCells for the Terrace's retaining walls:
// course tables, head joints of the runs) with the shader's own hash in float32 arithmetic, and each joint becomes an ArrisEdge
// of kind 'joint': the near-field bands draw it as a groove (the two blocks' arrises rounded, 4 mm, meeting at the 0.8 mm joint)
// and the base mesh discards its joint zone within the eye's radius. Where the shader's decision is close to a threshold (a run's
// inner joint present or not, a face's course table), the CPU keeps every candidate: an unneeded groove lies behind the wall's
// face (hidden), a needed one is never missing. Rev 5: the split blocks' beds, the Grand Stair's recess walls (their table, oblique
// heads) and the foot's polygonal joints too; D-364: the stairs' treads and risers and the up-facing slabs in arris_slabs.ts. Tier C.
import * as THREE from 'three/webgpu';
import { SURFACES } from '../render/materials';
import { MASONRY, courseTables, courseTexels } from '../render/masonry';
import { ARRIS_W, type ArrisEdge } from './arris';
import { ADIST_OFF } from '../render/blockface';
import { mxNoise3 } from '../render/mx_noise_cpu';
import { planarBounds, planarWorld, planarJointEdges, type PlanarFace } from './arris_slabs';

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
  /** a chunk's ends inside the face (no margin, half-open), and its stair attribute */ open0?: boolean; open1?: boolean; stair?: [number, number, number, number];
  /** rev 5: per bound (t0, t1, y0, y1): null, or the bound is a free arris r m from the sharp corner */ free?: (number | null)[];
  /** D-364: a tread, riser or slab (arris_slabs.ts): its own frame and triangles; n, d, t, y then only its bounds */ pf?: PlanarFace }
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
  if (F.pf) { const [u0, u1, v0, v1] = planarBounds(F.pf), lo = new THREE.Vector3(Infinity, Infinity, Infinity), hi = lo.clone().negate();
    for (const [u, v] of [[u0, v0], [u1, v0], [u0, v1], [u1, v1]]) { const q = planarWorld(F.pf, u, v); lo.min(q); hi.max(q); } return { lo, hi }; }
  const tdir = new THREE.Vector3(F.n.z, 0, -F.n.x), a = tdir.clone().multiplyScalar(F.t0).addScaledVector(F.n, F.d), b = tdir.clone().multiplyScalar(F.t1).addScaledVector(F.n, F.d);
  return { lo: new THREE.Vector3(Math.min(a.x, b.x), F.y0, Math.min(a.z, b.z)), hi: new THREE.Vector3(Math.max(a.x, b.x), F.y1, Math.max(a.z, b.z)) };
}

/** the vertical faces of a render geometry: triangles grouped by plane, each group's extent along the face (t) and up (y), and
 *  (rev 5) which of its four bounds are free arrises (from its 'adist': the joints' grooves stop where the arris band begins) */
export function verticalFaces(g: THREE.BufferGeometry, surf: string, ytop: number): JointFace[] {
  const P = g.getAttribute('position'), N = g.getAttribute('normal'), Y0 = g.getAttribute('y0'), PB = g.getAttribute('pbox'), AD = g.getAttribute('adist');
  const out = new Map<string, JointFace & { vs: number[][] }>();
  for (let i = 0; i < P.count; i++) {
    const nx = N.getX(i), ny = N.getY(i), nz = N.getZ(i); if (Math.abs(ny) > 0.05) continue;
    const hl = Math.hypot(nx, nz); if (hl < 0.9) continue;
    const n = new THREE.Vector3(nx / hl, 0, nz / hl), x = P.getX(i), y = P.getY(i), z = P.getZ(i), d = x * n.x + z * n.z, t = x * (n.z) + z * (-n.x);
    const key = `${n.x.toFixed(3)},${n.z.toFixed(3)},${d.toFixed(3)}`;
    let F = out.get(key);
    if (!F) { F = { n, d, t0: t, t1: t, y0: y, y1: y, surf, y0attr: Y0 ? Y0.getX(i) : -1000, pbox: PB ? [PB.getX(i), PB.getY(i), PB.getZ(i), PB.getW(i)] : [0, 0, -1, -1], ytop, vs: [] }; out.set(key, F); }
    F.t0 = Math.min(F.t0, t); F.t1 = Math.max(F.t1, t); F.y0 = Math.min(F.y0, y); F.y1 = Math.max(F.y1, y);
    if (AD) F.vs.push([t, y, AD.getX(i), AD.getY(i), AD.getZ(i), AD.getW(i)]);
  }
  const faces = [...out.values()].filter(F => F.t1 - F.t0 > 0.05 && F.y1 - F.y0 > 0.05);
  for (const F of faces) {
    // a component measures the distance to a free bound when, at every vertex that carries it, it equals the distance to that
    // bound plus a constant (the bevel's r: the face starts r from the sharp corner)
    const test = (f: (t: number, y: number) => number) => { for (let c = 2; c < 6; c++) { let ok = 0, bad = 0, r = 0; for (const v of F.vs) { if (v[c] === 0) continue; const k = v[c] + ADIST_OFF - f(v[0], v[1]); if (k > -0.002 && k < 0.03) { ok++; r = Math.max(r, k); } else bad++; } if (ok >= 2 && !bad) return r; } return null; };
    const r0 = test((t) => t - F.t0), r1 = test((t) => F.t1 - t), rb = test((_, y) => y - F.y0), rt = test((_, y) => F.y1 - y);
    F.free = [r0, r1, rb, rt];
    delete (F as any).vs;
  }
  return faces;
}

type Seg = [number, number, number, number]; // t0, y0, t1, y1 in the face's frame
/** the joints of a face as segments in its frame (t along, y up); `beds`/`heads` the palaces' (tests) */
export function faceJoints(F: JointFace): { beds: [number, number, number][]; heads: [number, number, number][]; segs: Seg[] } {
  const J = SURFACES[F.surf]?.joints, beds: [number, number, number][] = [], heads: [number, number, number][] = [], segs: Seg[] = [];
  if (!J?.vary) return { beds, heads, segs };
  const inT = (x: number) => (F.open0 ? x >= F.t0 : x > F.t0 + 0.01) && (F.open1 ? x < F.t1 : x < F.t1 - 0.01);
  if (J.retaining) {
    const M = MASONRY, BL = M.block, L = BL.base, NB = BL.per, SP = M.split, ST = M.stair, FT = M.foot, tables = courseTables(M), tex = courseTexels(M);
    const tdir = new THREE.Vector3(F.n.z, 0, -F.n.x), W = (t: number) => tdir.clone().multiplyScalar(t).addScaledVector(F.n, F.d);
    // the Grand Stair's recess (its own table, oblique heads, more splits): by the chunk's ends, both where they differ
    const inBox = (t: number) => { const p = W(t), SB = ST.box; return p.x >= SB[0] && p.x <= SB[1] && p.z >= -SB[3] && p.z <= -SB[2]; };
    const stairs = [...new Set([inBox(F.t0 + 0.01), inBox(F.t1 - 0.01), inBox((F.t0 + F.t1) / 2)])];
    // the course table: the face's plane and heading pick a section; every candidate near a bin's edge is kept
    const cand = (v: number, eps: number) => { const f = v - Math.floor(v); return f < eps ? [Math.floor(v), Math.floor(v) - 1] : f > 1 - eps ? [Math.floor(v), Math.floor(v) + 1] : [Math.floor(v)]; };
    for (const inStair of stairs) {
      const rows = new Set<number>();
      if (inStair) rows.add(M.sections);
      else for (const dp of cand(F.d + 0.5, 0.02)) for (const hd of cand(Math.atan2(F.n.z, F.n.x) * 36 / Math.PI + 0.5, 0.02)) {
        const hv = hash12f(dp, hd + 17.3) * M.sections; for (const s of cand(hv, 0.01)) rows.add(Math.max(0, Math.min(M.sections - 1, s)));
      }
      for (const row of rows) {
        const all = tables[row];
        for (const b of all) if (b >= F.y0 - 0.01 && b <= F.y1 + 0.01) segs.push([F.t0, b, F.t1, b]);
        for (let k = 0; k + 1 < all.length; k++) {
          const top = all[k], bot = all[k + 1]; if (top < F.y0 || bot > F.y1) continue;
          const hC = Math.max(0.02, top - bot), ym = (top + bot) / 2, i = Math.min(tex.w - 1, Math.max(0, Math.floor((ym - M.y0) / M.quantum))), c = tex.data[(row * tex.w + i) * 4 + 2];
          const off = hash12f(c, 3.71) * NB * L, y0 = Math.max(bot, F.y0), y1 = Math.min(top, F.y1);
          // a joint's t at height y (the recess's heads lean with the height in the course)
          const jt = (g: number, q: number, y: number) => { const jit = q === 0 ? 0 : (hash12f(g, c + 0.25) - 0.5) * 2 * BL.jitter;
            const lean = inStair && q > 0 ? (hash12f(g + 0.75, c) - 0.5) * 2 * ST.oblique * ((y - ym) / hC) * hC : 0; return off + (g + jit) * L + lean; };
          for (let kk = Math.floor((F.t0 - off) / (NB * L)) - 1; kk <= Math.floor((F.t1 - off) / (NB * L)) + 1; kk++) {
            // the run's joints: always its ends, its inner ones when present (ambiguous ones: both readings)
            const sure: number[] = [0], maybe: number[] = [];
            for (let q = 1; q < NB; q++) { const h = hash12f(c + 0.5, kk * NB + q); if (h < BL.joint_p - MARGIN) sure.push(q); else if (h < BL.joint_p + MARGIN) maybe.push(q); }
            for (const q of [...sure, ...maybe]) { const g = kk * NB + q, a = jt(g, q, y0), b = jt(g, q, y1); if (inT((a + b) / 2)) segs.push([a, y0, b, y1]); }
            // the split blocks' beds: a block (between two present joints) of a tall course cut thin and thick
            const readings = maybe.length ? [sure, [...sure, ...maybe].sort((p, q) => p - q)] : [sure];
            for (const js of readings) for (let u = 0; u < js.length; u++) {
              const qa = js[u], qb = u + 1 < js.length ? js[u + 1] : NB, blk = kk * NB + qa, pS = inStair ? ST.split_p : SP.p;
              if (!(hash12f(blk + 0.31, c + 5.7) < pS + MARGIN) || !(hC >= SP.min_h || inStair)) continue;
              const fT = hash12f(blk + 2.9, c + 0.61), f = inStair ? ST.f[0] + fT * (ST.f[1] - ST.f[0]) : SP.f[0] + fT * (SP.f[1] - SP.f[0]), side = hash12f(blk + 7.3, c + 1.9);
              for (const top1 of Math.abs(side - 0.5) < MARGIN ? [true, false] : [side >= 0.5]) {
                const zs = bot + hC * (top1 ? 1 - f : f); if (zs < F.y0 || zs > F.y1) continue;
                const a = jt(kk * NB + qa, qa, zs), b = qb === NB ? jt((kk + 1) * NB, 0, zs) : jt(kk * NB + qb, qb, zs);
                const lo = Math.max(a, F.t0), hi = Math.min(b, F.t1); if (hi - lo > 0.02) segs.push([lo, zs, hi, zs]);
              }
            }
          }
        }
      }
      // the foot's polygonal joints (W- and S-facing walls, not in the recess): the Voronoi edges between cells of which one is
      // foot stone; the foot's top from the plan noise at the chunk's ends (every cell below the higher of them, and a margin)
      const faceWS = Math.max(-F.n.x >= 0.5 ? 1 : 0, F.n.z >= 0.5 ? 1 : 0);
      if (!inStair && faceWS) {
        const ft = (t: number) => { const p = W(t), m = mxNoise3(p.x / FT.lambda + FT.offset[0], 0.5, p.z / FT.lambda + FT.offset[1]); const q = Math.min(1, Math.max(0, (m - (FT.theta - FT.w)) / (2 * FT.w))); return q * q * (3 - 2 * q) * FT.height; };
        const top = Math.max(ft(F.t0), ft(F.t1), ft((F.t0 + F.t1) / 2)) + 0.3;
        if (top > 0.31 && F.y0 < FT.ground + top + FT.row) {
          const seed = (cx: number, cy: number): [number, number] => [cx + 0.5 + (hash12f(cx + 0.13, cy + 9.1) - 0.5) * 2 * FT.jitter[0], cy + 0.5 + (hash12f(cy + 4.7, cx + 0.37) - 0.5) * 2 * FT.jitter[1]];
          const foot = (s: [number, number]) => s[1] * FT.row <= top;
          const qx0 = Math.floor(F.t0 / FT.cell) - 1, qx1 = Math.floor(F.t1 / FT.cell) + 1, qy0 = Math.floor((F.y0 - FT.ground) / FT.row) - 1, qy1 = Math.floor((Math.min(F.y1, FT.ground + top) - FT.ground) / FT.row) + 1;
          for (let cx = qx0; cx <= qx1; cx++) for (let cy = qy0; cy <= qy1; cy++) {
            const s1 = seed(cx, cy);
            // the cell's polygon: a square round the seed clipped by the bisectors with the 24 neighbours; its edges each shared with one
            let poly: [number, number][] = [[cx - 2, cy - 2], [cx + 3, cy - 2], [cx + 3, cy + 3], [cx - 2, cy + 3]]; const nb: ([number, number] | null)[] = [null, null, null, null];
            for (let i = -2; i <= 2; i++) for (let j = -2; j <= 2; j++) {
              if (!i && !j) continue;
              const s2 = seed(cx + i, cy + j), nx = s2[0] - s1[0], ny = s2[1] - s1[1], dd = (nx * (s1[0] + s2[0]) + ny * (s1[1] + s2[1])) / 2;
              const out: [number, number][] = [], onb: ([number, number] | null)[] = [];
              for (let v = 0; v < poly.length; v++) {
                const A = poly[v], B = poly[(v + 1) % poly.length], da = nx * A[0] + ny * A[1] - dd, db = nx * B[0] + ny * B[1] - dd;
                if (da <= 0) { out.push(A); onb.push(db <= 0 ? nb[v] : nb[v]); }
                if ((da < 0 && db > 0) || (da > 0 && db < 0)) { const tt = da / (da - db); out.push([A[0] + (B[0] - A[0]) * tt, A[1] + (B[1] - A[1]) * tt]); onb.push(da < 0 ? s2 : nb[v]); }
              }
              poly = out; nb.length = 0; nb.push(...onb);
            }
            for (let v = 0; v < poly.length; v++) {
              const s2 = nb[v]; if (!s2) continue;
              if (!(foot(s1) || foot(s2))) continue;
              if (s2[0] < s1[0] || (s2[0] === s1[0] && s2[1] < s1[1])) continue; // (each shared edge once)
              const A = poly[v], B = poly[(v + 1) % poly.length], ta = A[0] * FT.cell, tb = B[0] * FT.cell, ya = FT.ground + A[1] * FT.row, yb = FT.ground + B[1] * FT.row;
              if (Math.max(ta, tb) < F.t0 || Math.min(ta, tb) > F.t1 || Math.max(ya, yb) < F.y0 || Math.min(ya, yb) > F.y1) continue;
              segs.push([ta, ya, tb, yb]);
            }
          }
        }
      }
    }
    return { beds, heads, segs };
  }
  // the palaces' varied coursing: pairs of courses of 2 x course, split at a hashed height; head joints per course
  const V = J.vary, H = J.course * 2, L = J.block;
  for (let k = Math.floor(F.y0 / H) - 1; k <= Math.floor(F.y1 / H) + 1; k++) {
    const split = hash12f(k, 7.13) * (V.course[1] - V.course[0]) + V.course[0];
    const courses: [number, number, number][] = [[k * H, k * H + split, 2 * k], [k * H + split, (k + 1) * H, 2 * k + 1]];
    for (const [yb, ya, c] of courses) {
      if (ya < F.y0 || yb > F.y1) continue;
      if (yb > F.y0 + 0.005) { beds.push([yb, F.t0, F.t1]); segs.push([F.t0, yb, F.t1, yb]); }
      const off = hash12f(c, 3.71) * L, y0 = Math.max(yb, F.y0), y1 = Math.min(ya, F.y1);
      for (let j = Math.floor((F.t0 - off) / L) - 1; j <= Math.floor((F.t1 - off) / L) + 1; j++) {
        const x = (j + (hash12f(c, j) - 0.5) * V.jitter * 0.5) * L + off;
        if (inT(x)) { heads.push([x, y0, y1]); segs.push([x, y0, x, y1]); }
      }
    }
  }
  return { beds, heads, segs };
}

/** a face's (or chunk's) joints as band edges, stopped ARRIS_W short of its free arrises (the arris bands draw them there) */
export function jointEdgesOfFace(F: JointFace): ArrisEdge[] {
  if (F.pf) return planarJointEdges(F.pf, F.surf, { y0: F.y0attr, pbox: F.pbox, ytop: F.ytop, stair: F.stair ?? [0, 0, 0, 0] });
  const out: ArrisEdge[] = [], stair = F.stair ?? [0, 0, 0, 0], fr4 = F.free ?? [null, null, null, null];
  const tdir = new THREE.Vector3(F.n.z, 0, -F.n.x), at = (t: number, y: number) => tdir.clone().multiplyScalar(t).addScaledVector(F.n, F.d).add(new THREE.Vector3(0, y, 0));
  // the clip box: the face's bounds, less the arris band where a bound is a free arris (from the sharp corner: bound - r)
  const lo = [fr4[0] !== null && !F.open0 ? F.t0 - fr4[0] + ARRIS_W : -Infinity, fr4[2] !== null ? F.y0 - fr4[2] + ARRIS_W : -Infinity];
  const hi = [fr4[1] !== null && !F.open1 ? F.t1 + fr4[1] - ARRIS_W : Infinity, fr4[3] !== null ? F.y1 + fr4[3] - ARRIS_W : Infinity];
  for (let [t0, y0, t1, y1] of faceJoints(F).segs) {
    // clip the segment to the box (Liang-Barsky)
    let u0 = 0, u1 = 1; const dt = t1 - t0, dy = y1 - y0;
    for (const [p, q] of [[-dt, t0 - lo[0]], [dt, hi[0] - t0], [-dy, y0 - lo[1]], [dy, hi[1] - y0]] as [number, number][]) {
      if (Math.abs(p) < 1e-12) { if (q < 0) { u0 = 1; u1 = 0; } continue; }
      const r = q / p; if (p < 0) u0 = Math.max(u0, r); else u1 = Math.min(u1, r);
    }
    if (u1 - u0 < 1e-6) continue;
    const a = at(t0 + dt * u0, y0 + dy * u0), b = at(t0 + dt * u1, y0 + dy * u1); if (a.distanceTo(b) < 0.02) continue;
    const across = F.n.clone().cross(b.clone().sub(a)).normalize(); // (in the face, across the joint)
    out.push({ mat: F.surf, a, b, na: F.n.clone(), nb: across, r: 0, seed: 0, joint: true, planes: [], y0a: F.y0attr, y0b: F.y0attr, pbox: F.pbox, ytop: F.ytop, stair });
  }
  return out;
}
