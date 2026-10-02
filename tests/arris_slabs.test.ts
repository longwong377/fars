// D-364 (B145's last open joints): the stairs' treads and risers and the up-facing slabs grooved near the eye (src/arch/arris_slabs.ts).
// Holds: wherever the shader's joint distance (its CPU mirror) puts a joint within JOINT_W of a point the base mesh draws (outside
// the arris bands), a groove lies on it (else the base would discard a hole there); every groove lies on its face; the Terrace's
// stairs and landings get them.
import { describe, it, expect } from 'vitest';
import * as THREE from 'three/webgpu';
import { buildTerrace } from '../src/arch/terrace';
import { buildMeshes } from '../src/arch/meshes';
import { jointEdgesOfFace, hash12f } from '../src/arch/arris_joints';
import { SURFACES, STAIR_BLOCK } from '../src/render/materials';

import { JOINT_W, JOINT_LAP, ARRIS_W } from '../src/arch/arris';
import type { ArrisEdge } from '../src/arch/arris';

/** materials.ts headCells / ashlarCells with the shader's float32 hash (arris_joints.ts hash12f) */
function headCells(a: number, L: number, jitter: number, c: number) {
  const u = (a - hash12f(c, 3.71) * L) / L, j0 = Math.floor(u), u0 = j0 + (hash12f(c, j0) - 0.5) * jitter * 0.5, u1 = j0 + 1 + (hash12f(c, j0 + 1) - 0.5) * jitter * 0.5;
  return { dHead: Math.min(Math.abs(u - u0), Math.abs(u - u1)) * L };
}
function ashlarCells(a: number, b: number, J: any) {
  const V = J.vary, H = J.course * 2, k = Math.floor(b / H), f = b - k * H, split = hash12f(k, 7.13) * (V.course[1] - V.course[0]) + V.course[0], above = f >= split ? 1 : 0;
  return { dBed: Math.min(f - above * split, (above ? H : split) - f), ...headCells(a, J.block, V.jitter, 2 * k + above) };
}
/** the shader's joint distance on a tread, riser or slab (materials.ts vary branch, D-364's jd) */
function shaderJd(kind: string, X: THREE.Vector3, stair: number[], pbox: number[]): number {
  if (kind === 'slab') { const W = ashlarCells(X.x, X.z, SURFACES.limestone.joints!); return Math.min(W.dBed, W.dHead); }
  const sdx = stair[2], sdz = stair[3], across = X.z * sdx - X.x * sdz, fr = Math.fround, c = fr(fr(stair[0]) + fr(fr(Math.abs(stair[1])) * 1000)) /* (the attribute is float32: ST.x + |ST.y| x 1000 in float32) */;
  const SH = headCells(across, STAIR_BLOCK.length, STAIR_BLOCK.jitter, c);
  if (kind !== 'tread' || stair[1] > -0.05) return SH.dHead;
  const along = (X.x - pbox[0]) * sdx + (X.z - pbox[1]) * sdz, tHalf = Math.abs(pbox[2]) * Math.abs(sdx) + Math.abs(pbox[3]) * Math.abs(sdz);
  return Math.min(SH.dHead, Math.abs(along - (tHalf - STAIR_BLOCK.rowJoint)));
}
function segDist(e: ArrisEdge, X: THREE.Vector3): number {
  const ab = e.b.clone().sub(e.a), t = Math.max(0, Math.min(1, X.clone().sub(e.a).dot(ab) / ab.lengthSq()));
  return X.distanceTo(e.a.clone().addScaledVector(ab, t));
}
describe('D-364 the treads, risers and slabs grooved near the eye', () => {
  const { parts } = buildTerrace(), g = buildMeshes(parts), F = g.jointFaces.filter(f => f.pf);
  it('the Terrace\'s stairs and landings carry planar joint faces', () => {
    const k = (s: string) => F.filter(f => f.pf!.kind === s).length;
    expect(k('tread')).toBeGreaterThan(500); expect(k('riser')).toBeGreaterThan(500); expect(k('slab')).toBeGreaterThan(20);
  });
  it('no hole: where the shader puts a joint on a drawn point, a groove covers it; every groove on its face', () => {
    let n = 0, miss = 0, worst = 0, edges = 0; const rnd = (() => { let s = 7; return () => (s = (s * 16807) % 2147483647) / 2147483647; })();
    for (const f of F.filter((_, i) => i % 3 === 0)) {
      const pf = f.pf!, E = jointEdgesOfFace(f); edges += E.length;
      for (const e of E) for (const q of [e.a, e.b]) expect(Math.abs(q.dot(pf.N) - pf.d)).toBeLessThan(1e-4);
      const T = pf.tris, A = pf.ad;
      for (let s = 0; s < 60; s++) {
        // a random point of a random triangle of the face, inside its chunk
        const t = Math.floor(rnd() * (T.length / 6)) * 6; let a = rnd(), b = rnd(); if (a + b > 1) { a = 1 - a; b = 1 - b; }
        const u = T[t] + (T[t + 2] - T[t]) * a + (T[t + 4] - T[t]) * b, v = T[t + 1] + (T[t + 3] - T[t + 1]) * a + (T[t + 5] - T[t + 1]) * b;
        if (u < pf.box[0] || u >= pf.box[1] || v < pf.box[2] || v >= pf.box[3]) continue;
        const vb = t / 2; let dA = 1e3; for (let c = 0; c < 4; c++) dA = Math.min(dA, A[vb * 4 + c] + (A[(vb + 1) * 4 + c] - A[vb * 4 + c]) * a + (A[(vb + 2) * 4 + c] - A[vb * 4 + c]) * b);
        if (dA < ARRIS_W + 0.003) continue; // (the arris band draws there)
        const X = pf.U.clone().multiplyScalar(u).addScaledVector(pf.V, v).addScaledVector(pf.N, pf.d);
        const jd = shaderJd(pf.kind, X, f.stair ?? [0, 0, 0, 0], f.pbox); if (jd > JOINT_W) continue;
        n++; const dg = Math.min(1e3, ...E.map(e => segDist(e, X)));
        worst = Math.max(worst, dg - jd); if (dg > JOINT_W + JOINT_LAP) { miss++; if (miss < 8) console.log(pf.kind, f.stair, X.toArray().map(x => x.toFixed(3)), (jd * 1000).toFixed(1), (dg * 1000).toFixed(1), E.length); }
      }
    }
    console.log(`D-364: ${n} joint samples, ${miss} uncovered, worst groove offset ${(worst * 1000).toFixed(2)} mm, ${edges} grooves`);
    expect(n).toBeGreaterThan(300); expect(miss).toBe(0); expect(worst).toBeLessThan(0.004);
  }, 120_000);
});
