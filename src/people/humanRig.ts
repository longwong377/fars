// CPU forward kinematics for the 59-bone human skeleton (D-020, D-090). The activity pose cycles of anim.ts are written
// for a 17-channel rig (hips, spine, chest, neck, head, arms, legs); RETARGET maps each channel onto the MakeHuman bones.
// Both skeletons have identity bone orientation in the bind pose (+Z forward, +X the body's left, Y up), so an Euler
// rotation means the same thing on either. Hands (finger curl about the per-bone curl axes of the asset) and the face
// (jaw for speech, blinks, eye look-at) are added here.
// Output per person: 59 skin matrices (3×4 rows, world space: root yaw, scale and position included), written into a
// Float32Array palette at a slot offset; and the bones' world positions/rotations for props held in the hands.
import { HBONES, HB, HPARENT, FINGERS, type HBone } from './humanFormat';
import type { Pose, PoseBone } from './anim';
import { WORK_META, type WorkAnim } from './workAnims';
import { EXTRA_BONES, EXTRA_FLOATS, type BodyRig } from './bodyShape';
import { SoftState, stepSoft } from './softbody';
import { EX } from './bodyShape';
import { visemeAt, stressAt, phonesOf, pauseAt, saccade, listenNod, gazeState, JAW_OPEN, FACE0, type FaceShape, type GazeState, type Phones } from './face';

export const NBONES = HBONES.length;
export const PARENT = Int8Array.from(HBONES.map(b => (HPARENT[b] ? HB[HPARENT[b]!] : -1)));
/** floats per person in the skin palette (59 bones × 12, then D-363 the body's extras: bodyShape EX, three virtual bones) */
export const PALETTE_STRIDE = (NBONES + EXTRA_BONES) * 12;
/** texels per palette row (the bones texture's width) */
export const PALETTE_TEXELS = PALETTE_STRIDE / 4;

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
  /** gaze target (m) in the space of the rig input's root (x, y, z, yaw, scale): world space when the root is the
   *  person's, character space when the root is zero (the crowd); null: eyes follow the head, with saccades */
  look: [number, number, number] | null;
  eyeYaw: number; eyePitch: number;
  /** D-790 (face.ts): the line being spoken (its transliteration, the world time it began, its length in seconds): the
   *  mouth follows its phones. Absent: a talking jaw (jaw above TALK_JAW) speaks a seeded babble in the period's shape */
  say?: { text: string; t0: number; seconds?: number } | null;
  /** D-790: 1 while speaking, 0 not (absent: read from the jaw) */ talk?: number;
  /** D-790: the person's seed for the face's motion (absent: one per FaceState) */ seed?: number;
}
/** D-790: the head following the eyes: rate (1/s), leak back to the pose's head (1/s), dead zones (yaw, pitch; rad), the
 *  largest turn added (rad) */
export const FOLLOW = { rate: 6, leak: 0.5, dz: [0.15, 0.1] as [number, number], maxYaw: 0.35, pitch: [-0.3, 0.25] as [number, number] }; // (s18 C14: 0.5 / [-0.45, 0.35] read as a head rolled over at 0.5 m)
/** D-790: a jaw opened beyond this (rad) reads as speech or song (the crowd's talking jaw reaches 0.15; eating stays ≤ 0.06) */
export const TALK_JAW = 0.065;
/** D-790: the face's motion per FaceState (the eyes' fixations, the listening nods, the speech's phones) */
interface FaceMem { G: GazeState; seed: number; lastT: number; env: number; ph: Phones | null; phKey: string; blinkAt: number; smile: number;
  /** the eyes' last unclamped need (head frame: yaw, pitch) and the head's following turn (yaw, pitch) */ need: [number, number]; follow: [number, number] }
const FACE_MEM = new WeakMap<FaceState, FaceMem>();
let faceSeq = 1;
export interface RigInput {
  joints: Float32Array; pose: Pose; face: FaceState;
  /** finger curl 0 (relaxed) … 1 (closed grip), per hand */
  grip: [number, number];
  /** root: world position of the feet origin, yaw (rad, rotation about +Y of the +Z-facing rig), uniform scale */
  x: number; y: number; z: number; yaw: number; scale: number;
  /** keep the lowest heel/ball/toe point on the ground (standing and walking poses: the cycles were authored on another
   *  rig, so its leg lengths do not match exactly; the pelvis is moved up or down by the difference) */
  plant?: boolean;
  /** seated, kneeling or lying: the lowest point of the flesh (buttocks, thighs, knees, shins, feet, back, head) is put on
   *  the ground (the hip offsets of those cycles were authored for another rig: people sat 0.2–0.3 m in the air) */
  seat?: boolean;
  /** D-363: the person's body (bodyShape.bodyRigFor: girth per bone, stoop, the fields' extras, soft tissue); absent: the
   *  variant as modelled, extras zero */
  body?: BodyRig;
  /** D-363: the soft tissue's state (made on first use) and the clock (s; absent: performance.now) */
  soft?: SoftState; t?: number;
}
/** flesh radius (m) below bone heads, for the seated contact: [bone, child or -1 (a point at the joint only), radius at
 *  the joint, radius at the middle of the bone] (C: reference-body proportions) */
const SEAT_POINTS: [number, number, number, number][] = [
  [HB.pelvis, -1, 0.1, 0], [HB.spine_01, HB.spine_02, 0.11, 0.11], [HB.spine_02, HB.spine_03, 0.11, 0.11], [HB.spine_03, HB.neck_01, 0.1, 0.1], [HB.head, -1, 0.09, 0],
  [HB.thigh_l, HB.calf_l, 0.09, 0.075], [HB.calf_l, HB.foot_l, 0.055, 0.05], [HB.thigh_r, HB.calf_r, 0.09, 0.075], [HB.calf_r, HB.foot_r, 0.055, 0.05],
  [HB.upperarm_l, HB.lowerarm_l, 0.05, 0.045], [HB.lowerarm_l, HB.hand_l, 0.04, 0.035], [HB.upperarm_r, HB.lowerarm_r, 0.05, 0.045], [HB.lowerarm_r, HB.hand_r, 0.04, 0.035],
];
/** activities whose feet carry the body (their poses are planted): the Phase 3 cycles and every work cycle that stands,
 *  stoops, squats or walks (workAnims.ts WORK_META ground 'feet'; the seated and kneeling ones rest on the ground) */
export const PLANTED = new Set(['idle', 'inspect', 'walk', 'carry_shoulder', 'carry_head', 'carry_front', 'guard', 'guard_walk', 'talk', 'chisel', 'draw_water', 'pour', 'serve', 'fan', 'charioteer',
  ...(Object.keys(WORK_META) as WorkAnim[]).filter(k => WORK_META[k].ground === 'feet')]);
/** relaxed resting curl per finger joint (rad) and a full grip (C: hand-set to look natural) */
const REST = [0.34, 0.46, 0.3], GRIP = [1.25, 1.45, 0.9], THUMB_REST = [0.14, 0.2, 0.16], THUMB_GRIP = [0.35, 0.55, 0.5];
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
  /** D-790: this solve's face controls, eye offset (yaw, pitch) and blink */
  readonly fs: FaceShape = { ...FACE0 }; readonly eyeOff: [number, number] = [0, 0]; blink = 0; private faceOn = false; private breath = 0;

  /** D-790: the face's controls for this frame (this.fs, eyeOff, blink); returns the head's added pitch, roll and yaw (rad) */
  private curM: FaceMem | null = null;
  private faceMotion(inp: RigInput): [number, number, number] {
    const f = inp.face, t = inp.t!; let M = FACE_MEM.get(f);
    if (!M) { const seed = f.seed ?? (faceSeq++ * 7919); M = { G: gazeState(seed), seed, lastT: t, env: 0, ph: null, phKey: '', blinkAt: -9, smile: 0, need: [0, 0], follow: [0, 0] }; FACE_MEM.set(f, M); }
    if (f.seed !== undefined && f.seed !== M.seed) { M.seed = f.seed; M.G = gazeState(f.seed); }
    const dt = Math.max(0, Math.min(0.25, t - M.lastT)); M.lastT = t;
    const seed = M.seed, G = M.G, fs = this.fs;
    // speaking: the line's phones, else a talking jaw's babble; the envelope eases in and out (~0.12 s)
    const say = f.say && t >= f.say.t0 && t < f.say.t0 + (f.say.seconds ?? 1e9) + 0.2 ? f.say : null;
    if (say) { const key = say.text + '|' + (say.seconds ?? ''); if (key !== M.phKey) { M.ph = phonesOf(say.text, say.seconds); M.phKey = key; } }
    if (f.talk !== undefined ? f.talk > 0 : f.jaw > TALK_JAW) G.talkSeen = t;
    const talking = !!say || t - G.talkSeen < 0.45;
    M.env += ((talking ? 1 : 0) - M.env) * Math.min(1, dt * 9);
    const env = M.env, tt = say ? t - say.t0 : t;
    if (env > 0.01) { visemeAt(say ? M.ph : null, seed, tt, fs); fs.jaw *= JAW_OPEN * env * (0.85 + 0.3 * ((seed % 89) / 89)); fs.round *= env; fs.wide *= env; fs.press *= env; fs.tuck *= env; }
    else { fs.jaw = fs.round = fs.wide = fs.press = fs.tuck = 0; }
    // not speaking: the crowd's jaw (eating, a piper's reed) with the lips closed over the chewing
    if (env < 0.99) { const j0 = Math.max(0, f.jaw) * (1 - env); fs.jaw += j0; if (f.jaw > 0 && f.jaw <= TALK_JAW) fs.press = Math.max(fs.press, 0.5 * (1 - f.jaw / TALK_JAW)); }
    const stress = env > 0.01 ? stressAt(say ? M.ph : null, seed, tt) * env : 0;
    const onFace = !!f.look, h1 = ((seed >>> 3) % 101) / 101, h2 = ((seed >>> 7) % 97) / 97;
    // brows: lifted on stress (some people far more than others), a slow thinking knit while speaking, a greeting lift
    fs.browUp = Math.min(1, stress * (0.35 + 0.9 * h1) + (onFace ? 0.12 : 0) * (0.5 + 0.5 * Math.sin(t * 0.37 + seed)));
    fs.knit = env * Math.max(0, Math.sin(t * 0.29 + seed * 0.7) - 0.55) * 1.6 * h2;
    // a faint smile for the person looked at, warmer in some (C: the warmth of a greeting; never a fixed grin)
    const smT = onFace ? 0.12 + 0.5 * h2 * (0.6 + 0.4 * Math.sin(t * 0.21 + seed)) : 0.04;
    M.smile += (smT - M.smile) * Math.min(1, dt * 2.5); fs.smile = M.smile;
    // eyes: saccades (a blink with most large ones), the drift of fixation
    const [ey, ep, bl] = saccade(G, seed, t, onFace); this.eyeOff[0] = ey; this.eyeOff[1] = ep;
    if (bl) M.blinkAt = t;
    const bt = t - M.blinkAt; this.blink = Math.max(f.blink, bt >= 0 && bt < 0.15 ? Math.sin((bt / 0.15) * Math.PI) : 0);
    // the head: a small nod on the stress (down), a tilt that drifts; listening: back-channel nods
    const nod = 0.04 * stress + (onFace && env < 0.5 ? listenNod(G, seed, t) : 0);
    const roll = (G.tilt + 0.03 * Math.sin(t * 0.43 + seed)) * (onFace ? 1 : 0.4) + 0.02 * stress * Math.sin(seed);
    // the head follows the eyes (people turn the head once the eyes are more than ~10-15 degrees off its axis, C): the eyes'
    // last need beyond the dead zone feeds the head's turn, so a captured talking head bowed over its hands lifts to the face
    // it speaks to instead of the eyes rolling up under the brows; without a target the turn eases away
    const F = M.follow, k = Math.min(1, dt * FOLLOW.rate);
    // (a slow leak back to the pose's own head: a captured head swings by itself, and a turn kept after it swung back would
    // hold the face turned away)
    if (f.look) { const dz = (v: number, d: number) => (Math.abs(v) > d ? v - Math.sign(v) * d : 0), lk = Math.min(1, dt * FOLLOW.leak);
      F[0] = Math.max(-FOLLOW.maxYaw, Math.min(FOLLOW.maxYaw, F[0] * (1 - lk) + k * dz(M.need[0], FOLLOW.dz[0]))); F[1] = Math.max(FOLLOW.pitch[0], Math.min(FOLLOW.pitch[1], F[1] * (1 - lk) + k * dz(M.need[1], FOLLOW.dz[1]))); }
    else { F[0] *= 1 - k; F[1] *= 1 - k; }
    // a speaker breathes in at the pauses between phrases (the chest lifts, the head with it a little; ~0.3 s); C
    const inhale = env > 0.01 && say && M.ph ? pauseAt(M.ph, tt) * env : env > 0.01 ? Math.max(0, Math.sin(tt * 1.9 + seed) - 0.82) * 5 * env : 0;
    this.breath = 0.035 * inhale;
    this.curM = M; this.faceOn = true;
    return [nod + F[1] - 0.3 * this.breath, roll, F[0]];
  }

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
    L.set(IDENT_ALL); this.faceOn = false; this.curM = null; this.breath = 0;
    const acc = this.acc, has = this.has; acc.fill(0); has.fill(0);
    for (const ch in inp.pose.rot) { const e = inp.pose.rot[ch as PoseBone]; if (!e) continue;
      for (const [bn, k] of RETARGET[ch as PoseBone]) { const b = HB[bn]; acc[b * 3] += e[0] * k; acc[b * 3 + 1] += e[1] * k; acc[b * 3 + 2] += e[2] * k; has[b] = 1; } }
    // D-363: the stoop of age and of carrying (+X bows forward), spread over the spine and neck, the head lifting half back
    // D-790: the face's own motion (speech, brows, the head's beats and nods, saccades): only where the caller keeps a
    // clock (the crowd, the player); an impostor bake (no clock) stays still
    // (and only for a face the caller animates: the crowd gives the far people (lod 2+) no gaze, drift or jaw, and they skip it)
    const F0 = inp.face, live = !!(F0.look || F0.jaw > 0 || F0.eyeYaw || F0.eyePitch || F0.say || F0.talk);
    const fc = inp.t !== undefined && F0.blink < 1 && live ? this.faceMotion(inp) : null;
    // (s18 C14: on the head alone: a share on the neck swung what is weighted to it, the torc out in front of the chest at 0.5 m)
    if (fc) { for (const [b, k] of [[HB.head, 1]] as [number, number][]) { acc[b * 3] += fc[0] * k; acc[b * 3 + 1] += fc[2] * k; acc[b * 3 + 2] += fc[1] * k; has[b] = 1; }
      if (this.breath) { acc[HB.spine_03 * 3] -= this.breath; has[HB.spine_03] = 1; } } // (the breath before a phrase: the chest lifts back)
    const st = inp.body?.stoop ?? 0;
    if (st) { for (const [b, k] of [[HB.spine_02, 0.35], [HB.spine_03, 0.35], [HB.neck_01, 0.3], [HB.head, -0.45]] as [number, number][]) { acc[b * 3] += st * k; has[b] = 1; } }
    for (let b = 0; b < NBONES; b++) if (has[b]) eulerXYZ(L, b * 9, acc[b * 3], acc[b * 3 + 1], acc[b * 3 + 2]);
    // fingers: resting curl blended to a grip (thumb_01 … pinky_03 are consecutive bones after each hand)
    L.set(this.fingers(0, inp.grip[0]), HB.thumb_01_l * 9); L.set(this.fingers(1, inp.grip[1]), HB.thumb_01_r * 9);
    // face: jaw opens about +X; upper lids close downward (+X), lower lids rise (−X); lids follow the gaze pitch a little
    const f = inp.face, fs = this.fs, jaw = fc ? fs.jaw : Math.max(0, f.jaw); eulerXYZ(L, HB.jaw * 9, jaw, 0, 0);
    const blink = fc ? this.blink : f.blink, lidFollow = 0.6 * (f.eyePitch + (fc ? this.eyeOff[1] : 0));
    // (D-790: the smile lifts the lower lids and narrows the eyes a little; a lifted brow opens the upper lids)
    const squint = fc ? 0.35 * fs.smile : 0, wide = fc ? 0.12 * fs.browUp : 0;
    // (D-790: the upper lid at rest covers the top of the iris by a millimetre or two, more in some people and when tired;
    // the wide-open stare of the bind pose read as a doll's; C)
    const rest = fc ? 0.06 + 0.07 * ((((this.curM as FaceMem | null)?.seed ?? 0) >>> 5) % 53) / 53 : 0;
    for (const b of [HB.lid_ul, HB.lid_ur]) eulerXYZ(L, b * 9, blink * LID_CLOSE + (lidFollow + (0.08 * squint + rest) * LID_CLOSE - wide) * (1 - blink), 0, 0);
    for (const b of [HB.lid_ll, HB.lid_lr]) eulerXYZ(L, b * 9, -blink * LID_LOWER + (0.3 * lidFollow - (0.5 * squint + 0.5 * rest) * LID_LOWER) * (1 - blink), 0, 0);
    this.pelvisY = inp.joints[HB.pelvis * 3 + 1];
  }

  /** forward kinematics; writes 59 skin matrices (12 floats each) at `off` in `palette`. Returns nothing; wr/wt keep the
   *  character-space bone transforms (apply the root for world). */
  solve(inp: RigInput, palette: Float32Array, off: number) {
    const J = inp.joints, L = this.local, WR = this.wr, WT = this.wt, P = inp.pose;
    const hs = this.pelvisY / POSE_PELVIS_Y;
    const aim = !!(inp.face.look || inp.face.eyeYaw || inp.face.eyePitch || this.faceOn);
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
    if (inp.seat || inp.plant) { const d = -(inp.seat ? Math.min(this.footLow(J), this.seatLow()) : this.footLow(J)); for (let b = 0; b < NBONES; b++) WT[b * 3 + 1] += d; }
    const cy = Math.cos(inp.yaw), sy = Math.sin(inp.yaw), s = inp.scale, X = inp.x, Y = inp.y, Z = inp.z, G = inp.body;
    for (let b = 0; b < NBONES; b++) {
      // skin matrix: root · (R_b (v − j_b) + t_b);  root = translate(x,y,z) · rotY(yaw) · scale; rotY rows [cy 0 sy], [0 1 0], [-sy 0 cy]
      const o = off + b * 12, r = b * 9, jx = J[b * 3], jy = J[b * 3 + 1], jz = J[b * 3 + 2];
      const R00 = WR[r], R01 = WR[r + 1], R02 = WR[r + 2], R10 = WR[r + 3], R11 = WR[r + 4], R12 = WR[r + 5], R20 = WR[r + 6], R21 = WR[r + 7], R22 = WR[r + 8];
      const t0 = WT[b * 3] - (R00 * jx + R01 * jy + R02 * jz), t1 = WT[b * 3 + 1] - (R10 * jx + R11 * jy + R12 * jz), t2 = WT[b * 3 + 2] - (R20 * jx + R21 * jy + R22 * jz);
      palette[o] = s * (cy * R00 + sy * R20); palette[o + 1] = s * (cy * R01 + sy * R21); palette[o + 2] = s * (cy * R02 + sy * R22); palette[o + 3] = s * (cy * t0 + sy * t2) + X;
      palette[o + 4] = s * R10; palette[o + 5] = s * R11; palette[o + 6] = s * R12; palette[o + 7] = s * t1 + Y;
      palette[o + 8] = s * (cy * R20 - sy * R00); palette[o + 9] = s * (cy * R21 - sy * R01); palette[o + 10] = s * (cy * R22 - sy * R02); palette[o + 11] = s * (cy * t2 - sy * t0) + Z;
      if (G && G.bones[b]) girthInto(palette, o, G.girth, b * 12);
    }
    // D-363: the body's extras (static fields) and the soft tissue's springs
    const eo = off + NBONES * 12;
    if (G) { palette.set(G.extras, eo);
      // D-790: the face's controls (bodyShape EX.vis, EX.brow; zero where the face is still)
      const fs = this.fs, on = this.faceOn;
      palette[eo + EX.vis] = on ? fs.round : 0; palette[eo + EX.vis + 1] = on ? fs.wide : 0; palette[eo + EX.vis + 2] = on ? fs.press : 0; palette[eo + EX.vis + 3] = on ? fs.tuck : 0;
      palette[eo + EX.brow] = on ? fs.smile : 0; palette[eo + EX.brow + 1] = on ? fs.browUp : 0; palette[eo + EX.brow + 2] = on ? fs.knit : 0;
      const S = inp.soft ?? (inp.soft = new SoftState()); stepSoft(S, G, inp.t ?? (typeof performance !== 'undefined' ? performance.now() / 1000 : 0), WT, WR, inp, palette, eo); }
    else palette.fill(0, eo, eo + EXTRA_FLOATS);
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
  /** lowest flesh point of the trunk and limbs (character space, after FK) */
  private seatLow() {
    const WT = this.wt; let low = Infinity;
    for (const [b, c, r0, r1] of SEAT_POINTS) { low = Math.min(low, WT[b * 3 + 1] - r0); if (c >= 0) low = Math.min(low, (WT[b * 3 + 1] + WT[c * 3 + 1]) / 2 - r1); }
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
    // (D-790: the saccades replace the crowd's slow sine where it gives no target: kept at a third, as drift)
    const sc = this.faceOn && !inp.face.look ? 0.3 : 1;
    let yaw = inp.face.eyeYaw * sc + (this.faceOn ? this.eyeOff[0] : 0), pitch = inp.face.eyePitch * sc + (this.faceOn ? this.eyeOff[1] : 0);
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
    if (this.curM && b === HB.eye_l) { this.curM.need[0] = inp.face.look ? yaw : 0; this.curM.need[1] = inp.face.look ? pitch : 0; } // (D-790: the head follows)
    yaw = Math.max(-EYE_YAW_MAX, Math.min(EYE_YAW_MAX, yaw)); pitch = Math.max(-EYE_PITCH_MAX, Math.min(EYE_PITCH_MAX, pitch));
    // R = Ry(yaw)·Rx(pitch): pitch > 0 looks down (a +Z point rotated about +X moves to −Y)
    eulerXYZ(this.tmp, 0, pitch, 0, 0); eulerXYZ(this.tmp2, 0, 0, yaw, 0); mul3(this.local, b * 9, this.tmp2, 0, this.tmp, 0);
  }
}

/** M ← M·G for a 3×4 skin matrix at offset o and a bind-space girth transform (3×4) at offset g (D-363) */
function girthInto(P: Float32Array, o: number, G: Float32Array, g: number) {
  for (let r = 0; r < 3; r++) { const m0 = P[o + r * 4], m1 = P[o + r * 4 + 1], m2 = P[o + r * 4 + 2];
    P[o + r * 4] = m0 * G[g] + m1 * G[g + 4] + m2 * G[g + 8]; P[o + r * 4 + 1] = m0 * G[g + 1] + m1 * G[g + 5] + m2 * G[g + 9]; P[o + r * 4 + 2] = m0 * G[g + 2] + m1 * G[g + 6] + m2 * G[g + 10];
    P[o + r * 4 + 3] += m0 * G[g + 3] + m1 * G[g + 7] + m2 * G[g + 11]; }
}
/** skin a bind-pose point with one person's palette (tests; the GPU does this per vertex) */
export function skinPoint(palette: Float32Array, off: number, idx: ArrayLike<number>, w: ArrayLike<number>, p: ArrayLike<number>, out: number[] = [0, 0, 0]) {
  out[0] = out[1] = out[2] = 0;
  for (let k = 0; k < 4; k++) { const wk = w[k]; if (!wk) continue; const o = off + idx[k] * 12;
    for (let r = 0; r < 3; r++) out[r] += wk * (palette[o + r * 4] * p[0] + palette[o + r * 4 + 1] * p[1] + palette[o + r * 4 + 2] * p[2] + palette[o + r * 4 + 3]); }
  return out;
}
