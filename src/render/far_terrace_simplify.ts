// D-361: the Terrace's far levels: the error bounds and the simplification itself (meshoptimizer), free of three so the
// worker (far_terrace_worker.ts) loads only this.
import { MeshoptSimplifier } from 'three/addons/libs/meshopt_simplifier.module.js';

/** the levels' absolute error bounds (m); with FAR_PX 0.5 at 1080 px over a 60 deg lens they are drawn from 84 m, 281 m,
 *  935 m and 3.7 km (never nearer than FAR_MIN): the last is the cheap far version of the plain's horizon */
export const FAR_ERR = [0.045, 0.15, 0.5, 2.0];
/** the error allowed on screen (px) when a level is drawn: half a pixel, under the antialiasing's own blur */
export const FAR_PX = 0.5;
/** no far level nearer than this (m): on and around the Terrace the near shapes are drawn as they are */
export const FAR_MIN = 150;
export interface FarInput { idx: Uint32Array; P: Float32Array; A: Float32Array; na: number; nrm: boolean; uv: boolean; lockBorder: boolean }
/** the far levels' indices (meshoptimizer, after MeshoptSimplifier.ready): each level simplifies the previous one to its
 *  bound; null where a level saves under 10 % or prunes everything (the previous level is drawn). Weights: a normal deviation
 *  of 0.5, or 2 % of the UV map, costs the whole bound. Permissive: collapses across attribute seams when the weighed error
 *  allows (a column's split crease normals); Prune: drops components under the bound; LockBorder for the open building
 *  meshes (their edges meet other meshes: no cracks) */
export function farIndices(I: FarInput): { idx: (Uint32Array | null)[]; err: number[] } {
  const out: (Uint32Array | null)[] = [], errs: number[] = []; let src = I.idx;
  for (const e of FAR_ERR) {
    const W = [...(I.nrm ? [e / 0.5, e / 0.5, e / 0.5] : []), ...(I.uv ? [e / 0.02, e / 0.02] : [])];
    const flags: ('ErrorAbsolute' | 'Prune' | 'LockBorder' | 'Permissive')[] = ['ErrorAbsolute', 'Prune', 'Permissive']; if (I.lockBorder) flags.push('LockBorder');
    const MS = MeshoptSimplifier as any; // (@types/three's declaration predates the flags and simplify)
    const [res, err] = I.na ? MS.simplifyWithAttributes(src, I.P, 3, I.A, I.na, W, null, 0, e, flags) : MS.simplify(src, I.P, 3, 0, e, flags);
    if (res.length > src.length * 0.9 || res.length === 0) { out.push(null); errs.push(0); continue; }
    src = Uint32Array.from(res); out.push(src); errs.push(err);
  }
  return { idx: out, err: errs };
}
