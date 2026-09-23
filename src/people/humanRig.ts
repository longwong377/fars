// CPU forward kinematics for the 59-bone human skeleton (D-020, D-025). The activity pose cycles of anim.ts are written
// for a 17-channel rig (hips, spine, chest, neck, head, arms, legs); RETARGET maps each channel onto the MakeHuman bones.
// Both skeletons have identity bone orientation in the bind pose (+Z forward, +X the body's left, Y up), so an Euler
// rotation means the same thing on either. Hands (finger curl about the per-bone curl axes of the asset) and the face
// (jaw for speech, blinks, eye look-at) are added here.
// Output per person: 59 skin matrices (3×4 rows, world space: root yaw, scale and position included), written into a
// Float32Array palette at a slot offset; and the bones' world positions/rotations for props held in the hands.
import { HBONES, HB, HPARENT, FINGERS, type HBone } from './humanFormat';
import type { Pose, PoseBone } from './anim';

export const NBONES = HBONES.length;
export const PARENT = Int8Array.from(HBONES.map(b => (HPARENT[b] ? HB[HPARENT[b]!] : -1)));
/** floats per person in the skin palette (59 bones × 12) */
export const PALETTE_STRIDE = NBONES * 12;

/** pose channel → bones and share of the rotation (the old spine channel spreads over two vertebrae) */
export const RETARGET: Record<PoseBone, [HBone, number][]> = {
  hips: [['pelvis', 1]], spine: [['spine_01', 0.5], ['spine_02', 0.5]], chest: [['spine_03', 1]], neck: [['neck_01', 1]], head: [['head', 1]],
  l_upper: [['upperarm_l', 1]], l_fore: [['lowerarm_l', 1]], l_hand: [['hand_l', 1]], r_upper: [['upperarm_r', 1]], r_fore: [['lowerarm_r', 1]], r_hand: [['hand_r', 1]],
  l_thigh: [['thigh_l', 1]], l_shin: [['calf_l', 1]], l_foot: [['foot_l', 1]], r_thigh: [['thigh_r', 1]], r_shin: [['calf_r', 1]], r_foot: [['foot_r', 1]],
};
/** pelvis height of the rig the pose cycles were authored on (m); hips offsets scale with the person's pelvis height */
export const POSE_PELVIS_Y = 0.95;

export interface FaceState {
  /** jaw opening (rad, + opens) */ jaw: number;
  /** 0 open … 1 closed */ blink: number;
  /** gaze target in world space (m) or null (eyes follow the head, with small saccades in eyeYaw/eyePitch) */
  look: [number, number, number] | null;
  eyeYaw: number; eyePitch: number;
}
export interface RigInput {
  joints: Float32Array; pose: Pose; face: FaceState;
  /** finger curl 0 (relaxed) … 1 (closed grip), per hand */
  grip: [number, number];
  /** root: world position of the feet origin, yaw (rad, rotation about +Y of the +Z-facing rig), uniform scale */
  x: number; y: number; z: number; yaw: number; scale: number;
  /** keep the lowest heel/ball/toe point on the ground (standing and walking poses: the cycles were authored on another
   *  rig, so its leg lengths do not match exactly; the pelvis is moved up or down by the difference) */
  plant?: boolean;
}
/** activities whose feet carry the body (their poses are planted) */
export const PLANTED = new Set(['idle', 'inspect', 'walk', 'carry_shoulder', 'carry_head', 'carry_front', 'guard', 'guard_walk', 'talk', 'chisel', 'draw_water']);
/** relaxed resting curl per finger joint (rad) and a full grip (C: hand-set to look natural) */
const REST = [0.18, 0.22, 0.14], GRIP = [1.25, 1.45, 0.9], THUMB_REST = [0.08, 0.12, 0.1], THUMB_GRIP = [0.35, 0.55, 0.5];
/** lids: upper lid travel to close (rad), lower lid; eye rotation limits */
export const LID_CLOSE = 0.42, LID_LOWER = 0.12, EYE_YAW_MAX = 0.55, EYE_PITCH_MAX = 0.35;

const eulerXYZ = (m: Float64Array, o: number, x: number, y: number, z: number) => { // three.js 'XYZ' order: R = Rx·Ry·Rz (row-major out)
  const a = Math.cos(x), b = Math.sin(x), c = Math.cos(y), d = Math.sin(y), e = Math.cos(z), f = Math.sin(z);
  const ae = a * e, af = a * f, be = b * e, bf = b * f;
  m[o] = c * e; m[o + 1] = -c * f; m[o + 2] = d;
  m[o + 3] = af + be * d; m[o + 4] = ae - bf * d; m[o + 5] = -b * c;
  m[o + 6] = bf - ae * d; m[o + 7] = be + af * d; m[o + 8] = a * c;
};
const axisAngle = (m: Float64Array, o: number, ax: number[], ang: number) => {
  const c = Math.cos(ang), s = Math.sin(ang), t = 1 - c, [x, y, z] = ax;
  m[o] = t * x * x + c; m[o + 1] = t * x * y - s * z; m[o + 2] = t * x * z + s * y;
  m[o + 3] = t * x * y + s * z; m[o + 4] = t * y * y + c; m[o + 5] = t * y * z - s * x;
  m[o + 6] = t * x * z - s * y; m[o + 7] = t * y * z + s * x; m[o + 8] = t * z * z + c;
};
const mul3 = (out: Float64Array, o: number, A: Float64Array, a: number, B: Float64Array, b: number) => {
  for (let r = 0; r < 3; r++) for (let c = 0; c < 3; c++) out[o + r * 3 + c] = A[a + r * 3] * B[b + c] + A[a + r * 3 + 1] * B[b + 3 + c] + A[a + r * 3 + 2] * B[b + 6 + c];
};
const IDENT = [1, 0, 0, 0, 1, 0, 0, 0, 1];
const IDENT_ALL = (() => { const m = new Float64Array(HBONES.length * 9); for (let b = 0; b < HBONES.length; b++) m.set(IDENT, b * 9); return m; })();

export class RigSolver {
  /** local rotations, world rotations (row-major 3×3), world bone-head positions (character space, before the root) */
  readonly local = new Float64Array(NBONES * 9); readonly wr = new Float64Array(NBONES * 9); readonly wt = new Float64Array(NBONES * 3);
  private tmp = new Float64Array(9); private tmp2 = new Float64Array(9);
  private pelvisY = 0; private acc = new Float64Array(NBONES * 3); private has = new Uint8Array(NBONES);
  constructor(private curlAxes: Record<string, number[]>) {}

  /** local rotations from the pose channels, hands and face (eyes are aimed during solve, once the head is placed) */
  private fingerCache = new Map<number, Float64Array>();
  /** finger bones' local rotations for a hand at a grip level (quantised to 1/20; cached: the trig is the costly part) */
  private fingers(side: 0 | 1, g: number) {
    const q = Math.max(0, Math.min(20, Math.round(g * 20))), key = side * 32 + q; let m = this.fingerCache.get(key);
    if (!m) { m = new Float64Array(15 * 9); const s = side ? 'r' : 'l'; let k = 0; const gg = q / 20;
      for (const f of FINGERS) for (let j = 0; j < 3; j++, k++) { const ax = this.curlAxes[`${f}_0${j + 1}_${s}`]; if (!ax) { m.set(IDENT, k * 9); continue; }
        axisAngle(m, k * 9, ax, f === 'thumb' ? THUMB_REST[j] + (THUMB_GRIP[j] - THUMB_REST[j]) * gg : REST[j] + (GRIP[j] - REST[j]) * gg); }
      this.fingerCache.set(key, m); }
    return m;
  }
  setPose(inp: RigInput) {
    const L = this.local;
    L.set(IDENT_ALL);
    const acc = this.acc, has = this.has; acc.fill(0); has.fill(0);
    for (const ch in inp.pose.rot) { const e = inp.pose.rot[ch as PoseBone]; if (!e) continue;
      for (const [bn, k] of RETARGET[ch as PoseBone]) { const b = HB[bn]; acc[b * 3] += e[0] * k; acc[b * 3 + 1] += e[1] * k; acc[b * 3 + 2] += e[2] * k; has[b] = 1; } }
    for (let b = 0; b < NBONES; b++) if (has[b]) eulerXYZ(L, b * 9, acc[b * 3], acc[b * 3 + 1], acc[b * 3 + 2]);
    // fingers: resting curl blended to a grip (thumb_01 … pinky_03 are consecutive bones after each hand)
    L.set(this.fingers(0, inp.grip[0]), HB.thumb_01_l * 9); L.set(this.fingers(1, inp.grip[1]), HB.thumb_01_r * 9);
    // face: jaw opens about +X; upper lids close downward (+X), lower lids rise (−X); lids follow the gaze pitch a little
    const f = inp.face; eulerXYZ(L, HB.jaw * 9, Math.max(0, f.jaw), 0, 0);
    const lidFollow = 0.6 * f.eyePitch;
    for (const b of [HB.lid_ul, HB.lid_ur]) eulerXYZ(L, b * 9, f.blink * LID_CLOSE + lidFollow * (1 - f.blink), 0, 0);
    for (const b of [HB.lid_ll, HB.lid_lr]) eulerXYZ(L, b * 9, -f.blink * LID_LOWER + 0.3 * lidFollow * (1 - f.blink), 0, 0);
    this.pelvisY = inp.joints[HB.pelvis * 3 + 1];
  }

  /** forward kinematics; writes 59 skin matrices (12 floats each) at `off` in `palette`. Returns nothing; wr/wt keep the
   *  character-space bone transforms (apply the root for world). */
  solve(inp: RigInput, palette: Float32Array, off: number) {
    const J = inp.joints, L = this.local, WR = this.wr, WT = this.wt, P = inp.pose;
    const hs = this.pelvisY / POSE_PELVIS_Y;
    const aim = !!(inp.face.look || inp.face.eyeYaw || inp.face.eyePitch);
    for (let b = 0; b < NBONES; b++) {
      const p = PARENT[b];
      if (p < 0) { for (let k = 0; k < 9; k++) WR[k] = L[k]; WT[0] = J[0] + P.hips[0] * hs; WT[1] = J[1] + P.hips[1] * hs; WT[2] = J[2] + P.hips[2] * hs; continue; }
      if (aim && (b === HB.eye_l || b === HB.eye_r)) this.aimEye(inp, b, p);
      const o = b * 9, q = p * 9;
      const a00 = WR[q], a01 = WR[q + 1], a02 = WR[q + 2], a10 = WR[q + 3], a11 = WR[q + 4], a12 = WR[q + 5], a20 = WR[q + 6], a21 = WR[q + 7], a22 = WR[q + 8];
      for (let c = 0; c < 3; c++) { const b0 = L[o + c], b1 = L[o + 3 + c], b2 = L[o + 6 + c];
        WR[o + c] = a00 * b0 + a01 * b1 + a02 * b2; WR[o + 3 + c] = a10 * b0 + a11 * b1 + a12 * b2; WR[o + 6 + c] = a20 * b0 + a21 * b1 + a22 * b2; }
      const dx = J[b * 3] - J[p * 3], dy = J[b * 3 + 1] - J[p * 3 + 1], dz = J[b * 3 + 2] - J[p * 3 + 2];
      WT[b * 3] = WT[p * 3] + a00 * dx + a01 * dy + a02 * dz;
      WT[b * 3 + 1] = WT[p * 3 + 1] + a10 * dx + a11 * dy + a12 * dz;
      WT[b * 3 + 2] = WT[p * 3 + 2] + a20 * dx + a21 * dy + a22 * dz;
    }
    if (inp.plant) { const d = -this.footLow(J); for (let b = 0; b < NBONES; b++) WT[b * 3 + 1] += d; }
    const cy = Math.cos(inp.yaw), sy = Math.sin(inp.yaw), s = inp.scale, X = inp.x, Y = inp.y, Z = inp.z;
    for (let b = 0; b < NBONES; b++) {
      // skin matrix: root · (R_b (v − j_b) + t_b);  root = translate(x,y,z) · rotY(yaw) · scale; rotY rows [cy 0 sy], [0 1 0], [-sy 0 cy]
      const o = off + b * 12, r = b * 9, jx = J[b * 3], jy = J[b * 3 + 1], jz = J[b * 3 + 2];
      const R00 = WR[r], R01 = WR[r + 1], R02 = WR[r + 2], R10 = WR[r + 3], R11 = WR[r + 4], R12 = WR[r + 5], R20 = WR[r + 6], R21 = WR[r + 7], R22 = WR[r + 8];
      const t0 = WT[b * 3] - (R00 * jx + R01 * jy + R02 * jz), t1 = WT[b * 3 + 1] - (R10 * jx + R11 * jy + R12 * jz), t2 = WT[b * 3 + 2] - (R20 * jx + R21 * jy + R22 * jz);
      palette[o] = s * (cy * R00 + sy * R20); palette[o + 1] = s * (cy * R01 + sy * R21); palette[o + 2] = s * (cy * R02 + sy * R22); palette[o + 3] = s * (cy * t0 + sy * t2) + X;
      palette[o + 4] = s * R10; palette[o + 5] = s * R11; palette[o + 6] = s * R12; palette[o + 7] = s * t1 + Y;
      palette[o + 8] = s * (cy * R20 - sy * R00); palette[o + 9] = s * (cy * R21 - sy * R01); palette[o + 10] = s * (cy * R22 - sy * R02); palette[o + 11] = s * (cy * t2 - sy * t0) + Z;
    }
  }
  /** lowest foot contact point (heel, ball, toe tip; character space, after FK) */
  private footLow(J: Float32Array) {
    const WT = this.wt, WR = this.wr; let low = Infinity;
    for (const [foot, ball] of [[HB.foot_l, HB.ball_l], [HB.foot_r, HB.ball_r]]) {
      const h = J[foot * 3 + 1]; // ankle height above the sole in the bind pose
      const pts: [number, number, number, number][] = [[foot, 0, -h, -0.045], [ball, 0, 0, 0], [ball, 0, 0.004, 0.055]];
      for (const [b, x, y, z] of pts) low = Math.min(low, WT[b * 3 + 1] + WR[b * 9 + 3] * x + WR[b * 9 + 4] * y + WR[b * 9 + 5] * z);
    }
    return low;
  }
  /** world position of a bone head (after solve) */
  bonePos(inp: RigInput, b: number, out: number[] = [0, 0, 0]) {
    const cy = Math.cos(inp.yaw), sy = Math.sin(inp.yaw), s = inp.scale, x = this.wt[b * 3], y = this.wt[b * 3 + 1], z = this.wt[b * 3 + 2];
    out[0] = s * (cy * x + sy * z) + inp.x; out[1] = s * y + inp.y; out[2] = s * (-sy * x + cy * z) + inp.z; return out;
  }
  /** world rotation (row-major 3×3, without scale) of a bone (after solve) */
  boneRot(inp: RigInput, b: number, out = new Float64Array(9)) {
    const cy = Math.cos(inp.yaw), sy = Math.sin(inp.yaw), R = this.wr, o = b * 9;
    for (let c = 0; c < 3; c++) { out[c] = cy * R[o + c] + sy * R[o + 6 + c]; out[3 + c] = R[o + 3 + c]; out[6 + c] = -sy * R[o + c] + cy * R[o + 6 + c]; }
    return out;
  }
  /** eye look-at in the head's frame (the head is placed before its children in HBONES order); clamped, plus saccades */
  private aimEye(inp: RigInput, b: number, head: number) {
    let yaw = inp.face.eyeYaw, pitch = inp.face.eyePitch;
    if (inp.face.look) {
      // target → character space (inverse root), then into the head frame
      const cy = Math.cos(inp.yaw), sy = Math.sin(inp.yaw), s = inp.scale;
      const wx = (inp.face.look[0] - inp.x) / s, wy = (inp.face.look[1] - inp.y) / s, wz = (inp.face.look[2] - inp.z) / s;
      const cx = cy * wx - sy * wz, cz = sy * wx + cy * wz; // inverse rotY
      const J = inp.joints, WR = this.wr, WT = this.wt;
      // eye centre in character space
      const dx = J[b * 3] - J[head * 3], dy = J[b * 3 + 1] - J[head * 3 + 1], dz = J[b * 3 + 2] - J[head * 3 + 2];
      const ex = WT[head * 3] + WR[head * 9] * dx + WR[head * 9 + 1] * dy + WR[head * 9 + 2] * dz;
      const ey = WT[head * 3 + 1] + WR[head * 9 + 3] * dx + WR[head * 9 + 4] * dy + WR[head * 9 + 5] * dz;
      const ez = WT[head * 3 + 2] + WR[head * 9 + 6] * dx + WR[head * 9 + 7] * dy + WR[head * 9 + 8] * dz;
      const vx = cx - ex, vy = wy - ey, vz = cz - ez;
      // into the head frame: Rᵀ v
      const hx = WR[head * 9] * vx + WR[head * 9 + 3] * vy + WR[head * 9 + 6] * vz;
      const hy = WR[head * 9 + 1] * vx + WR[head * 9 + 4] * vy + WR[head * 9 + 7] * vz;
      const hz = WR[head * 9 + 2] * vx + WR[head * 9 + 5] * vy + WR[head * 9 + 8] * vz;
      if (hz > 0.05) { yaw += Math.atan2(hx, hz); pitch += -Math.atan2(hy, Math.hypot(hx, hz)); }
    }
    yaw = Math.max(-EYE_YAW_MAX, Math.min(EYE_YAW_MAX, yaw)); pitch = Math.max(-EYE_PITCH_MAX, Math.min(EYE_PITCH_MAX, pitch));
    // R = Ry(yaw)·Rx(pitch): pitch > 0 looks down (a +Z point rotated about +X moves to −Y)
    eulerXYZ(this.tmp, 0, pitch, 0, 0); eulerXYZ(this.tmp2, 0, 0, yaw, 0); mul3(this.local, b * 9, this.tmp2, 0, this.tmp, 0);
  }
}

/** skin a bind-pose point with one person's palette (tests; the GPU does this per vertex) */
export function skinPoint(palette: Float32Array, off: number, idx: ArrayLike<number>, w: ArrayLike<number>, p: ArrayLike<number>, out: number[] = [0, 0, 0]) {
  out[0] = out[1] = out[2] = 0;
  for (let k = 0; k < 4; k++) { const wk = w[k]; if (!wk) continue; const o = off + idx[k] * 12;
    for (let r = 0; r < 3; r++) out[r] += wk * (palette[o + r * 4] * p[0] + palette[o + r * 4 + 1] * p[1] + palette[o + r * 4 + 2] * p[2] + palette[o + r * 4 + 3]); }
  return out;
}
