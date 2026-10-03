// D-333: bakes the motion-capture clips the game plays (src/people/mocapClips.ts, generated): every clip below is cut
// from a CMU Graphics Lab take (tools/mocap/cycles.ts), retargeted onto the reference body (retarget.ts) and stored as
// the 17 pose channels (Euler XYZ, rad) and the hips offset per frame, quantised to int16.
//   npx tsx tools/mocap/bake.ts            (takes under MOCAP_DIR, default T:/fars-assets-s12/mocap/cmu; see the manifest)
// Each clip: kind 'gait' (phase-sampled strides: stride m and speed m/s on the reference body, per = samples a cycle) or
// 'loop' (time-sampled, closed). `mirror` swaps the body's sides (a left-handed sweeper from a right-handed one).
import { writeFileSync } from 'node:fs';
import { gait, loop, type Baked } from './cycles';
import { POSE_BONES, type Pose } from '../../src/people/anim';
import { RigSolver, PALETTE_STRIDE, type RigInput } from '../../src/people/humanRig';
import { HB } from '../../src/people/humanFormat';
import { HS } from '../../src/people/poseKit';
import { assets } from './preview';

export interface Spec { id: string; take: string; fps?: number; kind: 'gait' | 'loop'; from?: number; to?: number; len?: number; cycles?: number; out?: number; mirror?: boolean; exact?: boolean; /** seated or lying: the rig's seat pass grounds it (no foot planting in the bake) */ seat?: boolean; /** keep the capture's head pitch (default: levelled, see level()) */ gaze?: boolean; win?: number; trail?: boolean; face?: number; note: string }
/** the takes' frame rates (CMU index: 120 unless listed) */
const FPS60 = new Set(['62', '74', '75', '77', '79', '80']);
const fpsOf = (take: string) => (FPS60.has(take.split('_')[0]) ? 60 : 120);

export const SPECS: Spec[] = [
  // ---- walking: men (normal pace), several subjects
  { id: 'walk_a', take: '07_01', kind: 'gait', cycles: 1, note: 'walk (subject 7)' },
  { id: 'walk_b', take: '08_01', kind: 'gait', cycles: 1, note: 'walk (subject 8)' },
  { id: 'walk_c', take: '35_02', kind: 'gait', note: 'walk (subject 35)' },
  { id: 'walk_d', take: '16_15', kind: 'gait', note: 'walk (subject 16)' },
  { id: 'walk_e', take: '136_20', kind: 'gait', note: 'normal walk (subject 136)' },
  { id: 'walk_g', take: '105_29', kind: 'gait', note: 'normal walk (subject 105)' },
  // slower and brisker
  { id: 'walk_slow_a', take: '07_04', kind: 'gait', note: 'slow walk (subject 7)' },
  { id: 'walk_slow_c', take: '105_10', kind: 'gait', note: 'slow walk (subject 105)' },
  { id: 'walk_slow_d', take: '132_46', kind: 'gait', note: 'walk slow (subject 132)' },
  { id: 'walk_brisk_a', take: '16_21', kind: 'gait', note: 'walk (subject 16, brisk)' },
  { id: 'walk_brisk_b', take: '105_17', kind: 'gait', note: 'quick walk (subject 105)' },
  // women (the database has no straight walk by a woman that is not acted or turning: subject 106's takes are runs, catches
  // and games, subject 144's walks go round figures of eight; the women walk with 114 and the shorter strides below)
  { id: 'walk_w_b', take: '114_13', kind: 'gait', note: 'walk (subject 114)' },
  // the old, the lame
  { id: 'walk_old', take: '142_07', kind: 'gait', note: 'elderly man walk (subject 142)' },
  { id: 'limp_a', take: '91_16', kind: 'gait', note: 'limp (subject 91)' },
  // carrying (a box before the body in both hands; a suitcase in one hand)
  { id: 'carry_a', take: '111_36', kind: 'gait', note: 'walk and carry (subject 111)' },
  { id: 'carry_b', take: '113_26', kind: 'gait', note: 'walk and carry (subject 113)' },
  { id: 'carry_side', take: '70_10', kind: 'gait', note: 'carry 12.5 lb suitcase (subject 70)' },
  // running (children's play)
  { id: 'run_a', take: '16_35', kind: 'gait', cycles: 1, win: 0.12, trail: true, note: 'run/jog (subject 16)' },
  { id: 'run_b', take: '09_01', kind: 'gait', cycles: 1, win: 0.12, trail: true, note: 'run (subject 9)' },
  // ---- standing
  { id: 'idle_a', take: '77_02', kind: 'loop', from: 0, to: 15.5, len: 12, out: 15, note: 'standing (subject 77)' },
  { id: 'idle_b', take: '139_02', kind: 'loop', from: 0, to: 7.8, len: 6.5, out: 15, note: 'shifting weight (subject 139)' },
  { id: 'idle_c', take: '113_21', kind: 'loop', from: 0.5, to: 11.4, len: 9, out: 15, note: 'standing still (subject 113)' },
  { id: 'idle_d', take: '82_08', kind: 'loop', from: 0, to: 8.5, len: 7, out: 15, note: 'stand still (subject 82)' },
  { id: 'idle_e', take: '111_28', kind: 'loop', from: 0, to: 4.5, len: 3.8, out: 15, note: 'standing still, arms down (subject 111)' },
  { id: 'idle_hips', take: '111_28', kind: 'loop', from: 10.5, to: 15.9, len: 4.5, out: 15, note: 'standing, hands on the hips (subject 111)' },
  // ---- talking (conversation with hand gestures)
  { id: 'talk_a', take: '18_08', kind: 'loop', from: 0, to: 17.4, len: 14, out: 20, note: 'conversation, explaining with hand gestures (subject 18)' },
  { id: 'talk_b', take: '18_08', kind: 'loop', from: 0, to: 17.4, len: 9, out: 20, mirror: true, note: 'conversation, explaining with hand gestures (subject 18; mirrored, another stretch)' },
  { id: 'talk_c', take: '80_48', kind: 'loop', from: 0, to: 19, len: 15, out: 20, note: 'arguing (subject 80)' },
  // ---- sitting on the ground
  // ---- s17 V3 (D-500): work and leisure takes (the body of a real sweeper, mopper, drinker and dancer)
  { id: 'sweep_a', take: '13_23', kind: 'loop', from: 2, to: 30, len: 6, out: 20, note: 'sweep floor (subject 13)' },
  { id: 'sweep_b', take: '14_13', kind: 'loop', from: 2, to: 25, len: 6, out: 20, note: 'mop floor (subject 14)' },
  { id: 'drink_a', take: '13_09', kind: 'loop', from: 0, to: 9, len: 6, out: 20, note: 'drink (subject 13)' },
  { id: 'dance_a', take: '55_01', kind: 'loop', from: 1, to: 14, len: 6, out: 24, note: 'dance, whirl (subject 55)' },
  { id: 'dance_b', take: '90_31', kind: 'loop', from: 0.5, to: 7.5, len: 4, out: 24, note: 'russian dance (subject 90)' },
  { id: 'sit_a', take: '82_05', kind: 'loop', gaze: true, seat: true, from: 0, to: 18.7, len: 15, out: 15, note: 'sitting on the ground relaxing (subject 82)' },
];

const QA = 5000, QH = 10000;
function pack(b: Baked): Int16Array {
  const n = b.frames.length, a = new Int16Array(n * 54);
  b.frames.forEach((p, i) => { POSE_BONES.forEach((k, j) => { const e = p.rot[k] ?? [0, 0, 0]; for (let c = 0; c < 3; c++) a[i * 54 + j * 3 + c] = Math.max(-32767, Math.min(32767, Math.round(e[c] * QA))); });
    for (let c = 0; c < 3; c++) a[i * 54 + 51 + c] = Math.max(-32767, Math.min(32767, Math.round(p.hips[c] * QH))); });
  return a;
}
function mirrorPose(p: Pose): Pose {
  const rot: Pose['rot'] = {};
  for (const k of POSE_BONES) { const src = k.startsWith('l_') ? ('r_' + k.slice(2)) : k.startsWith('r_') ? ('l_' + k.slice(2)) : k; const e = p.rot[src as keyof Pose['rot']]; if (e) rot[k] = [e[0], -e[1], -e[2]]; }
  return { rot, hips: [-p.hips[0], p.hips[1], p.hips[2]] };
}
/** the capture subjects look down at the studio floor more than people going about a city do: where the mean pitch of the
 *  neck and head together is over 0.15 rad, it is brought to 0.12 (40 % neck, 60 % head); the motion about it is kept */
function level(b: Baked) {
  let m = 0; for (const p of b.frames) m += (p.rot.neck?.[0] ?? 0) + (p.rot.head?.[0] ?? 0); m /= b.frames.length;
  if (m <= 0.15) return; const d = m - 0.12;
  for (const p of b.frames) { const n = p.rot.neck!, h = p.rot.head!; p.rot.neck = [n[0] - 0.4 * d, n[1], n[2]]; p.rot.head = [h[0] - 0.6 * d, h[1], h[2]]; }
}
/** the feet on the ground in every frame on the reference body m03 (the rig's plant pass, done here into the hips offset):
 *  the work cycles that hold things over a captured body (the bier's pole, the jar) solve their arms in character space
 *  before the crowd's rig plants the feet, so the capture's pelvis must already stand at its planted height */
function plant(b: Baked) {
  const A = assets(), v = A.byId.m03, rig = new RigSolver(A.meta.curlAxes), pal = new Float32Array(PALETTE_STRIDE);
  for (const p of b.frames) { const inp: RigInput = { joints: v.joints, pose: p, face: { jaw: 0, blink: 0, look: null, eyeYaw: 0, eyePitch: 0 }, grip: [0, 0], x: 0, y: 0, z: 0, yaw: 0, scale: 1, plant: false };
    rig.setPose(inp); rig.solve(inp, pal, 0); const y0 = rig.wt[HB.pelvis * 3 + 1]; inp.plant = true; rig.solve(inp, pal, 0); const d = rig.wt[HB.pelvis * 3 + 1] - y0;
    p.hips = [p.hips[0], p.hips[1] + d / HS, p.hips[2]]; }
}
/** principal range at the first frame (each clip's angles start within ±π; the sequence stays continuous) */
function normalise(b: Baked) { const f0 = b.frames[0]; for (const k of POSE_BONES) { const e = f0.rot[k]; if (!e) continue; const off = e.map(x => Math.round(x / (2 * Math.PI)) * 2 * Math.PI); if (off.every(x => !x)) continue; for (const p of b.frames) { const q = p.rot[k]!; p.rot[k] = [q[0] - off[0], q[1] - off[1], q[2] - off[2]]; } } }

if (process.argv[1]?.endsWith('bake.ts')) {
  const only = process.argv[2] ? new Set(process.argv[2].split(',')) : null;
  const meta: Record<string, unknown> = {}; const parts: Int16Array[] = []; let off = 0;
  for (const s of SPECS) {
    if (only && !only.has(s.id)) continue;
    const fps = s.fps ?? fpsOf(s.take);
    const b = s.kind === 'gait' ? gait(s.take, fps, { from: s.from, to: s.to, cycles: s.cycles ?? 2, win: s.win, trail: s.trail, face: s.face }) : loop(s.take, fps, { from: s.from, to: s.to, len: s.len ?? 4, out: s.out, exact: s.exact });
    if (s.mirror) b.frames = b.frames.map(mirrorPose);
    // a cycle cut at the trailing foot starts half a stride late: turned so that every gait starts at the left strike
    if (s.trail) { const h = b.frames.length / 2; b.frames = [...b.frames.slice(h), ...b.frames.slice(0, h)]; }
    normalise(b); if (!s.gaze) level(b); if (!s.seat) plant(b);
    const q = pack(b); parts.push(q);
    meta[s.id] = { kind: s.kind, n: b.frames.length, off, dur: +b.dur.toFixed(4), ...(s.kind === 'gait' ? { cycles: s.cycles ?? 2, stride: +b.stride!.toFixed(4), speed: +b.speed!.toFixed(4) } : {}), src: `CMU ${s.take} ${b.range.map(x => x.toFixed(2)).join('-')} s${s.mirror ? ' (mirrored)' : ''}`, note: s.note };
    off += q.length;
    console.log(s.id.padEnd(14), s.kind, 'frames', b.frames.length, 'dur', b.dur.toFixed(2), s.kind === 'gait' ? `speed ${b.speed!.toFixed(2)} stride ${b.stride!.toFixed(2)}` : '', b.range.map(x => x.toFixed(2)).join('-'));
  }
  const all = new Int16Array(off); let o = 0; for (const p of parts) { all.set(p, o); o += p.length; }
  const b64 = Buffer.from(all.buffer).toString('base64');
  writeFileSync('src/people/mocapClips.ts', `// GENERATED by tools/mocap/bake.ts (D-333): motion-capture clips from the CMU Graphics Lab Motion Capture Database
// (mocap.cs.cmu.edu; the database was created with funding from NSF EIA-0196217; free for all uses), retargeted onto the
// reference body's 17 pose channels. Per frame 54 int16: 17 × Euler XYZ (rad × ${QA}) in POSE_BONES order, hips offset × ${QH}.
// Do not edit: change tools/mocap/bake.ts and run \`npx tsx tools/mocap/bake.ts\`.
export const QA = ${QA}, QH = ${QH};
export interface ClipMeta { kind: 'gait' | 'loop'; n: number; off: number; dur: number; cycles?: number; stride?: number; speed?: number; src: string; note: string }
export const CLIP_META: Record<string, ClipMeta> = ${JSON.stringify(meta, null, 0).replace(/\},"/g, '},\n  "')};
export const CLIP_DATA = '${b64}';
`);
  console.log('values', off, 'base64 KB', (b64.length / 1024).toFixed(0));
}
