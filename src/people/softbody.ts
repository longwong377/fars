// Soft tissue (D-363, UD-27): springs on the flesh that moves of itself when a body moves — breasts, belly, buttocks,
// thighs, upper arms and jowls — driven by the acceleration of the bone that carries them (in that bone's frame), solved
// on the CPU per drawn person after the rig (a few dozen multiply-adds a person: humanRig.solve), and drawn by the
// bind-space fields of humanMaterial (bodyShape.bodyFieldOffset mirrors them). Each spring is a damped oscillator
// x'' = −ω²x − 2ζωx' − g·a (a: the anchor's acceleration in its bone's frame; g: the region's mass and softness,
// bodyShape.bodyRigFor), clamped to the region's reach. Frequencies and damping are C (breast motion in walking is
// measured at a few hertz and a few centimetres for large breasts in sports-science studies; not read here, Q-1171).
// The same pass is the hook the later peoplemotion package uses for hair, sashes, jewellery and loads: add a region with
// its anchor bone and write its offset into the palette's extra texels.
import { HB } from './humanFormat';
import { EX, type BodyRig, type SpringP } from './bodyShape';

/** regions: the anchor bone, the spring's axes (bone frame: x side, y up, z forward) and where its offset goes in the extras */
const REGIONS: { key: keyof BodyRig['soft']; bone: number; axes: (0 | 1 | 2)[]; out: number[] }[] = [
  { key: 'breast', bone: HB.spine_03, axes: [0, 1, 2], out: [EX.sprBL, EX.sprBL + 1, EX.sprBL + 2] },
  { key: 'breast', bone: HB.spine_03, axes: [0, 1, 2], out: [EX.sprBR, EX.sprBR + 1, EX.sprBR + 2] },
  { key: 'belly', bone: HB.spine_01, axes: [1, 2], out: [EX.sprBL + 3, EX.sprBR + 3] },
  { key: 'butt', bone: HB.pelvis, axes: [1, 2], out: [EX.spr5, EX.spr5 + 1] },
  { key: 'thigh', bone: HB.thigh_l, axes: [1], out: [EX.spr5 + 2] },
  { key: 'thigh', bone: HB.thigh_r, axes: [1], out: [EX.spr5 + 3] },
  { key: 'uarm', bone: HB.upperarm_l, axes: [1], out: [EX.ex7 + 1] },
  { key: 'uarm', bone: HB.upperarm_r, axes: [1], out: [EX.ex7 + 2] },
  { key: 'jowl', bone: HB.head, axes: [1], out: [EX.ex7 + 3] },
];
/** the two breasts differ a little (their own phase: the right one 6 % slower; C) */
const SIDE_HZ = [1, 0.94];
export const SOFT = { /** substep (s) */ h: 1 / 120, /** a gap longer than this (s) restarts the springs at rest (a person refreshed rarely, or just attached) */ gap: 0.25,
  /** the anchors' accelerations are low-passed over this time (s): pose cycles are keyed, and a raw second difference rings */ smooth: 0.03 };

export class SoftState {
  /** per region: last anchor world position (3), last velocity (3), filtered acceleration (3), spring x (3), v (3) */
  readonly s = new Float64Array(REGIONS.length * 15); t = -1; frames = 0;
  /** per region, for the rig it was made for: ω, 2ζω, ω², gain, reach */
  p = new Float64Array(REGIONS.length * 5); rig: BodyRig | null = null;
}
function params(st: SoftState, rig: BodyRig) { st.rig = rig;
  for (let r = 0; r < REGIONS.length; r++) { const R = REGIONS[r], P: SpringP = rig.soft[R.key], w = 2 * Math.PI * P.hz * (R.key === 'breast' ? SIDE_HZ[R.out[0] === EX.sprBL ? 0 : 1] : 1);
    st.p.set([w, 2 * P.zeta * w, w * w, P.gain, P.max], r * 5); } }
const _a = [0, 0, 0];
/** step the springs to time `t` (s) from the anchors' world positions and the bone rotations (character space, row-major
 *  3×3: humanRig wr) and the root yaw; writes the offsets (bind space ≈ the anchor bone's frame: bones are world-aligned in
 *  the bind pose) into `ex` */
export function stepSoft(st: SoftState, rig: BodyRig, t: number, wt: Float64Array, wr: Float64Array, root: { x: number; y: number; z: number; yaw: number; scale: number }, ex: Float32Array | Float64Array, exOff: number) {
  const dt = t - st.t, restart = st.t < 0 || dt > SOFT.gap || dt < 0; st.t = t;
  const cy = Math.cos(root.yaw), sy = Math.sin(root.yaw), s = root.scale, S = st.s, fS = restart || dt <= 0 ? 0 : 1 - Math.exp(-dt / SOFT.smooth), n = restart || dt <= 0 ? 1 : Math.min(12, Math.max(1, Math.ceil(dt / SOFT.h))), h = dt / n, inv = 1 / Math.max(dt, 1e-6);
  if (st.rig !== rig) params(st, rig); const PP = st.p;
  for (let r = 0; r < REGIONS.length; r++) {
    const R = REGIONS[r], o = r * 15, b = R.bone, gain = PP[r * 5 + 3], max = PP[r * 5 + 4];
    // the anchor in world space
    const x = wt[b * 3], y = wt[b * 3 + 1], z = wt[b * 3 + 2], wx = s * (cy * x + sy * z) + root.x, wy = s * y + root.y, wz = s * (-sy * x + cy * z) + root.z;
    if (restart || gain <= 0) { S[o] = wx; S[o + 1] = wy; S[o + 2] = wz; for (let k = 3; k < 15; k++) S[o + k] = 0; for (const q of R.out) ex[exOff + q] = 0; continue; }
    if (dt <= 0) { for (let i = 0; i < R.axes.length; i++) ex[exOff + R.out[i]] = S[o + 9 + i]; continue; }
    const vx = (wx - S[o]) * inv, vy = (wy - S[o + 1]) * inv, vz = (wz - S[o + 2]) * inv;
    let ax = (vx - S[o + 3]) * inv, ay = (vy - S[o + 4]) * inv, az = (vz - S[o + 5]) * inv;
    const first = st.frames < 2; if (first) { ax = ay = az = 0; }
    S[o] = wx; S[o + 1] = wy; S[o + 2] = wz; S[o + 3] = vx; S[o + 4] = vy; S[o + 5] = vz;
    S[o + 6] += (ax - S[o + 6]) * fS; S[o + 7] += (ay - S[o + 7]) * fS; S[o + 8] += (az - S[o + 8]) * fS;
    // world → character (inverse yaw) → the bone's frame (Rᵀ)
    const fx = S[o + 6], fy = S[o + 7], fz = S[o + 8], chx = cy * fx - sy * fz, chz = sy * fx + cy * fz, q = b * 9;
    _a[0] = wr[q] * chx + wr[q + 3] * fy + wr[q + 6] * chz; _a[1] = wr[q + 1] * chx + wr[q + 4] * fy + wr[q + 7] * chz; _a[2] = wr[q + 2] * chx + wr[q + 5] * fy + wr[q + 8] * chz;
    const c = PP[r * 5 + 1], w2 = PP[r * 5 + 2], As = -gain / s;
    for (let i = 0; i < R.axes.length; i++) { const ax3 = R.axes[i]; let X = S[o + 9 + i], V = S[o + 12 + i]; const A = As * _a[ax3];
      for (let k = 0; k < n; k++) { V += h * (-w2 * X - c * V + A); X += h * V; } // semi-implicit Euler
      if (X > max) { X = max; V = Math.min(V, 0); } else if (X < -max) { X = -max; V = Math.max(V, 0); }
      S[o + 9 + i] = X; S[o + 12 + i] = V; ex[exOff + R.out[i]] = X; }
  }
  st.frames++;
}
