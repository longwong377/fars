// D-333: the people's motion from motion capture. The clips (src/people/mocapClips.ts, baked by tools/mocap/bake.ts from
// the CMU Graphics Lab Motion Capture Database, retargeted onto the reference body's 17 pose channels) are sampled here:
// gaits by the walking phase (one loop = `cycles` strides, starting at the left foot's strike), loops by time. Per person
// (seed k) a clip of the class is chosen, its tempo varied a little and its start offset; walking blends the two clips of
// the pace classes nearest the walker's speed (normalised by the leg length), and the crowd advances the phase by the
// distance walked over the blended stride, so the planted foot stays where it was set down (crowd.ts gaitStep).
import { CLIP_META, CLIP_DATA, QA, QH, type ClipMeta } from './mocapClips';
import type { Pose } from './anim';
/** anim.ts POSE_BONES (repeated: anim.ts imports this module, and the work cycles import it before anim.ts is ready) */
const BONES = ['hips', 'spine', 'chest', 'neck', 'head', 'l_upper', 'l_fore', 'l_hand', 'r_upper', 'r_fore', 'r_hand', 'l_thigh', 'l_shin', 'l_foot', 'r_thigh', 'r_shin', 'r_foot'] as const;

let DATA: Float32Array | null = null;
/** the clips' frames as floats (54 a frame: 17 × Euler XYZ, hips offset), decoded once */
function data(): Float32Array {
  if (DATA) return DATA;
  const s = CLIP_DATA; let bytes: Uint8Array;
  if (typeof atob === 'function') { const b = atob(s); bytes = new Uint8Array(b.length); for (let i = 0; i < b.length; i++) bytes[i] = b.charCodeAt(i); }
  else bytes = new Uint8Array((globalThis as unknown as { Buffer: { from(s: string, e: string): Uint8Array } }).Buffer.from(s, 'base64'));
  const q = new Int16Array(bytes.buffer, bytes.byteOffset, bytes.byteLength >> 1), f = new Float32Array(q.length);
  for (let i = 0; i < q.length; i++) f[i] = q[i] / ((i % 54) >= 51 ? QH : QA);
  DATA = f; return DATA;
}
export type ClipId = keyof typeof CLIP_META & string;
export const CLIPS = CLIP_META as Record<string, ClipMeta>;
export const hasClip = (id: string) => id in CLIP_META;
const fr = (x: number) => x - Math.floor(x);
const TAU = 2 * Math.PI;
/** s17 V3 (D-500): the captures' anterior pelvic tilt taken out. The CMU subjects' pelvis (the root's pitch) tips forward
 *  by 3-34° on average (walk_w_b 34°, idle_e 14°) and their lumbar spine bends back to match: on the MakeHuman spine that
 *  sharp bend at spine_01 pushed the belly out and the shoulders back (every standing man read pot-bellied, the cloth over
 *  it ballooned). Per clip, its mean pitch above ${TILT_NEUTRAL} rad is taken off the pelvis and given back to the thighs and the
 *  spine channel (Euler X is the outermost rotation, so the legs and the chest keep their world orientation): the same
 *  stance with an upright pelvis and half the lumbar bend. The motion about the mean is kept. C */
export const TILT_NEUTRAL = 0.03;
const TILT = new Map<string, number>();
export function tiltFix(id: string) { let t = TILT.get(id); if (t === undefined) { t = Math.max(0, Math.min(0.6, clipMean(id)[0] - TILT_NEUTRAL)); TILT.set(id, t); } return t; }
/** sample clip `id` at loop fraction u into buf (54 floats); w > 0 blends it into what buf holds by w; `fix` false: the raw capture (devAt) */
function sampleInto(buf: Float32Array, id: string, u: number, wBlend = 1, fix = true) {
  const m = CLIPS[id], D = data(), tf = fix ? tiltFix(id) : 0, f = fr(u) * m.n, i = Math.floor(f) % m.n, j = (i + 1) % m.n, w = f - Math.floor(f), a = m.off + i * 54, b = m.off + j * 54;
  for (let c = 0; c < 54; c++) { const x = D[a + c]; let y = D[b + c];
    // the loop's last frame and its first differ by whole turns where an angle wound round (unwrapped in the bake)
    if (j === 0 && c < 51) { const d = y - x; y = x + d - Math.round(d / TAU) * TAU; }
    let v = x + (y - x) * w;
    if (tf) { if (c === 0) v -= tf; else if (c === 3 || c === 33 || c === 42) v += tf; }
    if (wBlend >= 1) buf[c] = v; else { let d = v - buf[c]; if (c < 51 && (d > Math.PI || d < -Math.PI)) d -= Math.round(d / TAU) * TAU; buf[c] += d * wBlend; } }
}
/** a Pose from a sample buffer (fresh arrays: the crowd and the rig keep them) */
function toPose(buf: Float32Array): Pose {
  const b = (i: number): [number, number, number] => [buf[i], buf[i + 1], buf[i + 2]];
  // (BONES order, spelled out: a literal is much faster to build than keyed stores through the module binding)
  return { rot: { hips: b(0), spine: b(3), chest: b(6), neck: b(9), head: b(12), l_upper: b(15), l_fore: b(18), l_hand: b(21), r_upper: b(24), r_fore: b(27), r_hand: b(30),
    l_thigh: b(33), l_shin: b(36), l_foot: b(39), r_thigh: b(42), r_shin: b(45), r_foot: b(48) }, hips: [buf[51], buf[52], buf[53]] };
}
const BUF = new Float32Array(54);
/** the pose of clip `id` at loop fraction u (0…1, wrapping), linear between its frames */
export function clipAt(id: string, u: number): Pose { sampleInto(BUF, id, u); return toPose(BUF); }
/** a loop clip at time t (s): the clip's own tempo × `tempo`, started at a seeded point of its loop */
export function loopAt(id: string, t: number, k: number, tempo = 1): Pose {
  const m = CLIPS[id]; return clipAt(id, t * tempo / m.dur + fr(k * 0.618034));
}
const MEANS = new Map<string, Float32Array>();
/** a clip's mean frame (54 floats; angles averaged as unwrapped in the bake) */
export function clipMean(id: string): Float32Array {
  let M = MEANS.get(id); if (M) return M; const m = CLIPS[id], D = data(); M = new Float32Array(54);
  for (let i = 0; i < m.n; i++) for (let c = 0; c < 54; c++) M[c] += D[m.off + i * 54 + c] / m.n;
  MEANS.set(id, M); return M;
}
/** the deviation of clip `id` from its mean at loop fraction u, into buf (54 floats): the motion of a capture, laid over
 *  a pose authored elsewhere (the work cycles' trunk and head: workAnims.ts body layer) */
export function devAt(buf: Float32Array, id: string, u: number): Float32Array {
  sampleInto(buf, id, u, 1, false); const M = clipMean(id); for (let c = 0; c < 54; c++) { let d = buf[c] - M[c]; if (c < 51 && (d > Math.PI || d < -Math.PI)) d -= Math.round(d / TAU) * TAU; buf[c] = d; }
  return buf;
}
/** blend b into a by w (Euler lerp, the difference taken the short way round) */
export function blendInto(a: Pose, b: Pose, w: number, only?: readonly string[]): Pose {
  if (w <= 0) return a;
  for (const k of only ?? BONES) { const x = a.rot[k as keyof Pose['rot']], y = b.rot[k as keyof Pose['rot']]; if (!x || !y) continue;
    for (let c = 0; c < 3; c++) { let d = y[c] - x[c]; d -= Math.round(d / TAU) * TAU; x[c] += d * w; } }
  if (!only) for (let c = 0; c < 3; c++) a.hips[c] += (b.hips[c] - a.hips[c]) * w;
  return a;
}
/** a seeded choice among n */
export const pickOf = (k: number, n: number, salt = 0) => Math.floor(fr(Math.sin(k * 12.9898 + salt * 78.233) * 43758.5453) * n) % n;

// ------------------------------------------------------------------------------------------------ gaits
/** the walking classes: the clips of each, their mean speed (m/s, reference body) */
export type GaitStyle = 'man' | 'woman' | 'old' | 'carry' | 'carry_side' | 'limp' | 'run';
export const GAITS: Record<GaitStyle, { slow: string[]; normal: string[]; brisk: string[] }> = {
  // (s18 C14 D-790: + ACCAD's Male1 (walk_m_h, normal) and its woman, walk_w_c, a woman's own walk at last)
  // (and 100STYLE's performer: a neutral and a tired walk among the slow, a heavy man's among the normal)
  man: { slow: ['walk_slow_a', 'walk_slow_c', 'walk_slow_d', 'walk_neutral', 'walk_tired'], normal: ['walk_c', 'walk_d', 'walk_e', 'walk_g', 'walk_a', 'walk_m_h', 'walk_heavy'], brisk: ['walk_brisk_a', 'walk_brisk_b', 'walk_b'] },
  woman: { slow: ['walk_slow_c', 'walk_w_b'], normal: ['walk_w_c', 'walk_w_b', 'walk_w_c', 'walk_g'], brisk: ['walk_w_c', 'walk_brisk_a'] },
  // (s18 C14: the old bent forward or with their hands behind the back, 100STYLE)
  old: { slow: ['walk_slow_d', 'walk_slow_c', 'walk_bent'], normal: ['walk_slow_c', 'walk_slow_a', 'walk_behind', 'walk_bent'], brisk: ['walk_slow_a', 'walk_behind'] },
  carry: { slow: ['carry_a', 'carry_b'], normal: ['carry_a', 'carry_b', 'carry_w'], brisk: ['carry_a', 'carry_b', 'carry_w'] },
  carry_side: { slow: ['carry_side'], normal: ['carry_side'], brisk: ['carry_side'] },
  limp: { slow: ['limp_a'], normal: ['limp_a'], brisk: ['limp_a'] },
  run: { slow: ['run_a'], normal: ['run_a', 'run_b'], brisk: ['run_b'] },
};
const spd = (id: string) => CLIPS[id].speed ?? 1.2;
/** the two clips blended for a walker of style s, seed k at normalised speed v (m/s on the reference body), and the
 *  blend weight of the second */
const PICKS = new Map<GaitStyle, Map<number, [string, string, string, number, number, number]>>();
export function gaitPair(s: GaitStyle, k: number, v: number): [string, string, number] {
  let M = PICKS.get(s); if (!M) { M = new Map(); PICKS.set(s, M); } let P = M.get(k);
  if (!P) { const G = GAITS[s]; const a = G.slow[pickOf(k, G.slow.length, 1)], b = G.normal[pickOf(k, G.normal.length, 2)], c = G.brisk[pickOf(k, G.brisk.length, 3)];
    P = [a, b, c, spd(a), spd(b), spd(c)]; if (M.size > 20000) M.clear(); M.set(k, P); }
  const [a, b, c, sa, sb, sc] = P;
  if (v <= sb) { const w = sb > sa ? (v - sa) / (sb - sa) : 1; return [a, b, Math.max(0, Math.min(1, w))]; }
  const w = sc > sb ? (v - sb) / (sc - sb) : 0; return [b, c, Math.max(0, Math.min(1, w))];
}
/** stride (m per cycle, reference body) of the blend a walker of style s, seed k walks at speed v */
export function strideAt(s: GaitStyle, k: number, v: number): number {
  const [a, b, w] = gaitPair(s, k, v); const A = CLIPS[a], B = CLIPS[b];
  return A.stride! * (1 - w) + B.stride! * w;
}
/** the walking pose at gait phase ph (rad; the left foot strikes at ph = π/2 as in the old cycles) */
export function gaitPose(s: GaitStyle, ph: number, k: number, v: number): Pose {
  const [a, b, w] = gaitPair(s, k, v); const u = (ph - Math.PI / 2) / TAU;
  // a loop holds `cycles` strides: the phase runs through one stride per 2π
  sampleInto(BUF, a, u / (CLIPS[a].cycles ?? 1)); if (w > 0.001 && b !== a) sampleInto(BUF, b, u / (CLIPS[b].cycles ?? 1), w);
  if (s === 'old') { const o = stoop(); for (let c = 3; c < 15; c++) BUF[c] += o[c]; }
  return toPose(BUF);
}
let STOOP: Float32Array | null = null;
/** the old walk's stoop: a share of the elderly capture's mean trunk, neck and head (subject 142's "elderly man": acted,
 *  so taken at 35 %) over the mean of the ordinary walks (spine, chest, neck, head channels only) */
function stoop(): Float32Array {
  if (STOOP) return STOOP; const O = clipMean('walk_old'), N = ['walk_c', 'walk_d', 'walk_e', 'walk_g'].map(clipMean); STOOP = new Float32Array(54);
  for (let c = 3; c < 15; c++) STOOP[c] = 0.35 * (O[c] - N.reduce((x, M) => x + M[c], 0) / N.length);
  return STOOP;
}
/** the standing clips a person idles through; the talking ones; sitting on the ground */
export const IDLES = ['idle_a', 'idle_b', 'idle_c', 'idle_d', 'idle_e'] as const;
export const TALKS = ['talk_a', 'talk_b', 'talk_c'] as const;
/** s18 C14 (D-790): a woman's standing and talking from ACCAD's female performer (CC BY 3.0), with two of the men's */
export const IDLES_W = ['idle_w_a', 'idle_w_b', 'idle_w_c', 'idle_b', 'idle_e'] as const;
export const TALKS_W = ['talk_w_a', 'talk_b', 'talk_w_a'] as const;
/** s18 C14 (D-790): the old standing (100STYLE's 'old' idle, CC BY 4.0) among the men's */
export const IDLES_O = ['idle_old', 'idle_a', 'idle_c', 'idle_old', 'idle_d'] as const;
