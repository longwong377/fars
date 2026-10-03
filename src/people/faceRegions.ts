// s18 C14 (D-790): the face's measured regions the hair reads (tools/blender/sources/people_hair.ts): the lips' parting and
// the face's half width (faceGeom) and the full-beard region (beardMask), copied unchanged from outfits.ts so that the
// people_hair asset's inputs no longer cover every garment edit (C13's request). outfits.ts may import these instead of its
// own copies (no output changes).
import type { HumanAssets, HumanVariant } from './humanAssets';
import { HB, PART, type HBone } from './humanFormat';
type V3 = [number, number, number];
interface Lib { A: HumanAssets; ref: HumanVariant; J: (b: HBone) => V3 }
const P = PART;
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
const clamp = (x: number, a = 0, b = 1) => Math.max(a, Math.min(b, x));
const sstep = (e0: number, e1: number, x: number) => { const t = clamp((x - e0) / (e1 - e0)); return t * t * (3 - 2 * t); };
export function faceGeom(L: Lib) {
  const { A, ref } = L; const rvOf = (pid: number) => { for (let i = 0; i < A.NO; i++) if (A.orig[i] === pid) return i; return 0; };
  const chinI = rvOf(A.meta.landmarks.chin), noseI = rvOf(A.meta.landmarks.nose_tip);
  const cy = ref.pos[chinI * 3 + 1], ny = ref.pos[noseI * 3 + 1], nz = ref.pos[noseI * 3 + 2];
  // the lips' parting: where the midline front vertices change from head-weighted (upper lip) to jaw-weighted (lower lip)
  // (the most recessed point finds the mentolabial sulcus on MakeHuman's closed mouth, 1.5–2 cm too low)
  let upLow = Infinity, loHigh = -Infinity, best = 1e9;
  for (let i = 0; i < A.NO; i++) { if (A.part[i] !== P.head) continue; const x = ref.pos[i * 3], y = ref.pos[i * 3 + 1], z = ref.pos[i * 3 + 2];
    if (Math.abs(x) > 0.0025 || y < cy || y > ny - 0.01 || z < nz - 0.03) continue;
    let w = 0; for (let k = 0; k < 4; k++) if (A.skinIndex[i * 4 + k] === HB.jaw) w = A.skinWeight[i * 4 + k] / 255;
    if (w < 0.3) upLow = Math.min(upLow, y); else if (w > 0.5) loHigh = Math.max(loHigh, y); best = Math.min(best, z); }
  const mouthY = Number.isFinite(upLow) && Number.isFinite(loHigh) ? (upLow + loHigh) / 2 : (cy + ny) / 2;
  let halfW = 0; for (let i = 0; i < A.NO; i++) if (A.part[i] === P.head && Math.abs(ref.pos[i * 3 + 1] - ref.eyeY) < 0.015) halfW = Math.max(halfW, Math.abs(ref.pos[i * 3]));
  return { chinI, noseI, mouthY, lipZ: best, halfW };
}
/** full-beard region 0..1 per render vertex (cheeks below the cheekbone line, moustache under the nose, chin, jaw and
 *  under-chin; the lips stay bare). The D-020 baked mask bounded the beard by the jaw JOINT's height (near the ear), which
 *  left the chin bare, so the region is rebuilt here from the face measurements (C: the shape of the carved beards). */
const BEARD_CACHE = new WeakMap<HumanAssets, Float32Array>();
export function beardMask(L: Lib): Float32Array {
  const { A, ref, J } = L; const hit = BEARD_CACHE.get(A); if (hit) return hit;
  const F = faceGeom(L); const out = new Float32Array(A.NO);
  const noseY = ref.pos[F.noseI * 3 + 1], eyeY = ref.eyeY;
  for (let i = 0; i < A.NO; i++) { const pt = A.part[i]; if (pt !== P.head && pt !== P.neck) continue; const x = ref.pos[i * 3], y = ref.pos[i * 3 + 1], z = ref.pos[i * 3 + 2], ax = Math.abs(x);
    // under the nose in the middle (the subnasale: the moustache covers the philtrum and the top of the upper lip, as on
    // the reliefs; the first version stopped 1 cm lower and left a clean-shaven upper lip), the cheekbone line at the sides
    const cheekLine = lerp(noseY - 0.008, eyeY - 0.03, sstep(0.018, 0.05, ax));
    const dy = y - F.mouthY, lips = (Math.hypot(x / 0.026, dy / (dy > 0 ? 0.006 : 0.0125)) - 1) * 0.012; // outside the lips > 0
    const d = Math.min(cheekLine - y, z - (J('jaw')[2] - 0.012), y - (J('neck_01')[1] - 0.005), F.halfW - 0.004 - ax, lips);
    out[i] = sstep(-0.003, 0.005, d); }
  BEARD_CACHE.set(A, out); return out;
}
